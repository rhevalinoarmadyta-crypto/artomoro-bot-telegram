import React, { useState, useMemo, useEffect } from 'react'
import { Download, Plus, Trash2, FileText, Receipt } from 'lucide-react'
import { useFinanceStore } from '../store/useFinanceStore'
import { formatRupiah, formatTerbilang, getFormattedDateTimeIndo } from '../lib/utils'
import { exportToExcel } from '../lib/export'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'

export default function Report() {
  const { 
    getCombinedLedger, 
    fetchWebhookOrders, 
    operationalCosts, 
    addOpCost, 
    removeOpCost, 
    addToast 
  } = useFinanceStore()

  const excelLedger = useFinanceStore(state => state.ledger)
  const webhookOrders = useFinanceStore(state => state.webhookOrders)

  useEffect(() => {
    fetchWebhookOrders()
  }, [])

  const [sourceFilter, setSourceFilter] = useState('all') // 'all', 'shopee', 'telegram'

  const ledger = useMemo(() => {
    const combined = getCombinedLedger()
    if (sourceFilter === 'shopee') {
      return combined.filter(row => row.productName !== 'MANUAL ORDER TELEGRAM')
    } else if (sourceFilter === 'telegram') {
      return combined.filter(row => row.productName === 'MANUAL ORDER TELEGRAM')
    }
    return combined
  }, [excelLedger, webhookOrders, getCombinedLedger, sourceFilter])

  const metrics = useMemo(() => {
    const prodHpp = useFinanceStore.getState().productHpp || {}
    const itemHpp = useFinanceStore.getState().itemHpp || {}
    const globalHpp = useFinanceStore.getState().globalHpp || 0
    
    let totalGross = 0
    let totalNetIncome = 0
    let totalAdmin = 0
    let totalService = 0
    let totalShipping = 0
    let totalAdjustment = 0
    let totalHpp = 0

    ledger.forEach(row => {
      totalGross += row.originalPrice || 0
      totalNetIncome += row.netIncome || 0
      totalAdmin += row.adminFee || 0
      totalService += row.serviceFee || 0
      totalShipping += row.sellerShipping || 0
      totalAdjustment += row.adjustment || 0

      const hpp = itemHpp[row.orderId] !== undefined 
        ? itemHpp[row.orderId] 
        : (prodHpp[row.productName] !== undefined ? prodHpp[row.productName] : globalHpp)
      totalHpp += hpp
    })

    const salaryMetrics = useFinanceStore.getState().getSalaryMetrics()
    const totalTimSalaryAndBonus = Object.values(salaryMetrics).reduce((sum, item) => sum + item.salary, 0)

    const totalOpCost = operationalCosts.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0)
    const totalCombinedOpCost = totalOpCost + totalTimSalaryAndBonus

    const grossProfit = totalNetIncome - totalHpp
    const netProfit = grossProfit - totalCombinedOpCost
    const margin = totalGross > 0 ? (netProfit / totalGross) * 100 : 0

    return {
      totalGross,
      totalNetIncome,
      totalAdmin,
      totalService,
      totalShipping,
      totalAdjustment,
      totalHpp,
      totalOpCost,
      totalTimSalaryAndBonus,
      totalCombinedOpCost,
      grossProfit,
      netProfit,
      margin
    }
  }, [ledger, operationalCosts])

  const [newCostName, setNewCostName] = useState('')
  const [newCostAmount, setNewCostAmount] = useState('')

  // Dynamically calculate order date range
  const dateRange = useMemo(() => {
    if (!ledger || ledger.length === 0) return ''
    const dates = ledger
      .map(row => row.date ? String(row.date).trim().split(' ')[0] : '')
      .filter(Boolean)
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()))

    if (dates.length === 0) return ''
    const minDate = new Date(Math.min(...dates))
    const maxDate = new Date(Math.max(...dates))
    
    const formatDate = (date) => {
      const options = { year: 'numeric', month: 'short', day: 'numeric' }
      return date.toLocaleDateString('id-ID', options)
    }
    
    return `${formatDate(minDate)} - ${formatDate(maxDate)}`
  }, [ledger])

  const handleAddCost = (e) => {
    e.preventDefault()
    if (!newCostName || !newCostAmount) return
    addOpCost({ name: newCostName, amount: Number(newCostAmount) })
    addToast(`✅ Biaya "${newCostName}" ditambahkan`, 'success')
    setNewCostName('')
    setNewCostAmount('')
  }

  const handleExport = () => {
    if (!ledger || ledger.length === 0) {
      alert('Belum ada data untuk diekspor.')
      return
    }
    addToast('📥 Excel sedang diunduh...', 'info')
    setTimeout(async () => {
      try {
        await exportToExcel(metrics, ledger, operationalCosts)
        addToast('✅ Excel Berhasil diunduh', 'success')
      } catch (err) {
        addToast('❌ Gagal mengunduh Excel', 'error')
      }
    }, 300)
  }

  const handleExportPDF = () => {
    addToast('📥 PDF sedang diunduh...', 'info')
    
    setTimeout(async () => {
      try {
        const { jsPDF } = await import('jspdf')
        
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        })

        // Draw A4 page border (1.5px equivalent in PDF is ~0.6mm)
        doc.setDrawColor(0, 0, 0)
        doc.setLineWidth(0.6)
        doc.rect(10, 10, 190, 277)

        // Draw Kop Surat (Header)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(22)
        doc.text('ARTOMORO GALLERY', 105, 30, { align: 'center' })
        
        doc.setLineWidth(0.6)
        doc.line(10, 45, 200, 45) // border-bottom logo area

        // Report Header Info
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.text('LAPORAN LABA RUGI', 20, 58)

        // Meta Info (Right)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text('Tanggal Cetak', 135, 54)
        doc.text('Waktu Cetak', 135, 60)
        doc.text('Wilayah', 135, 66)
        
        doc.setFont('helvetica', 'bold')
        doc.text(': ' + new Date().toLocaleDateString('id-ID'), 160, 54)
        doc.text(': ' + new Date().toLocaleTimeString('id-ID', { hour12: false }), 160, 60)
        doc.text(': Tangerang', 160, 66)

        // Period Info
        doc.setFont('helvetica', 'normal')
        doc.text('Periode Laporan', 20, 81)
        doc.text('Jenis Laporan', 20, 87)
        
        doc.setFont('helvetica', 'bold')
        doc.text(': ' + (dateRange || '-'), 50, 81)
        doc.text(': Statement of Profit or Loss', 50, 87)
        
        doc.setLineWidth(0.6)
        doc.line(10, 93, 200, 93) // border-bottom period info

        // Table Headers
        doc.setFont('helvetica', 'bold')
        doc.text('KETERANGAN', 20, 100)
        doc.text('JUMLAH', 185, 100, { align: 'right' })
        
        doc.setLineWidth(0.6)
        doc.line(10, 104, 200, 104) // border-bottom table headers

        // Table Rows Drawing Helper
        let currentY = 112
        const drawRow = (label, value, isBold = false, isExpense = false, indent = 0) => {
          doc.setFont('helvetica', isBold ? 'bold' : 'normal')
          doc.text(label, 20 + indent, currentY)
          if (value !== null && value !== undefined) {
            const valText = (isExpense && Number(value) > 0 ? '-' : '') + formatRupiah(value).replace(/Rp\s*/g, '')
            doc.text(valText, 185, currentY, { align: 'right' })
          }
          currentY += 6.5
        }

        // A. Pendapatan
        drawRow('A. PENDAPATAN', null, true, false, 0)
        drawRow('Omset Kotor (Harga Asli Produk)', metrics.totalGross, false, false, 5)
        currentY += 2

        // B. Beban Komisi Marketplace
        drawRow('B. BEBAN KOMISI MARKETPLACE (SHOPEE)', null, true, false, 0)
        drawRow('Biaya Administrasi', metrics.totalAdmin, false, true, 5)
        drawRow('Biaya Layanan', metrics.totalService, false, true, 5)
        drawRow('Ongkir Penjual', metrics.totalShipping, false, true, 5)
        drawRow('Penyesuaian Dana (Adjustment)', Math.abs(metrics.totalAdjustment), false, metrics.totalAdjustment < 0, 5)
        
        doc.setLineWidth(0.3)
        doc.line(20, currentY, 190, currentY)
        currentY += 5
        drawRow('TOTAL DANA CAIR NET', metrics.totalNetIncome, true, false, 0)
        currentY += 2

        // C. HPP
        drawRow('C. HARGA POKOK PENJUALAN (HPP)', null, true, false, 0)
        drawRow('Beban HPP Persediaan Produk', metrics.totalHpp, false, true, 5)
        
        doc.setLineWidth(0.3)
        doc.line(20, currentY, 190, currentY)
        currentY += 5
        drawRow('LABA KOTOR', metrics.grossProfit, true, false, 0)
        currentY += 2

        // D. Beban Operasional
        drawRow('D. BEBAN OPERASIONAL INTERNAL', null, true, false, 0)
        if (metrics.totalTimSalaryAndBonus > 0) {
          drawRow('Gaji & Bonus Karyawan (Otomatis)', metrics.totalTimSalaryAndBonus, false, true, 5)
        }
        if (operationalCosts && operationalCosts.length > 0) {
          operationalCosts.forEach(cost => {
            drawRow(cost.name, cost.amount, false, true, 5)
          })
        }
        
        doc.setLineWidth(0.3)
        doc.line(20, currentY, 190, currentY)
        currentY += 5
        drawRow('TOTAL BIAYA OPERASIONAL', metrics.totalCombinedOpCost, true, true, 0)
        
        // Footer Total Box (Laba Bersih)
        doc.setLineWidth(0.6)
        doc.line(10, currentY, 200, currentY)
        
        const word = metrics.netProfit >= 0 ? formatTerbilang(metrics.netProfit) : 'Minus ' + formatTerbilang(Math.abs(metrics.netProfit))
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        doc.text('Terbilang : ' + word, 20, currentY + 8)
        
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('LABA BERSIH AKHIR', 110, currentY + 16)
        doc.text(formatRupiah(metrics.netProfit).replace(/Rp\s*/g, ''), 185, currentY + 16, { align: 'right' })
        
        doc.setLineWidth(0.6)
        doc.line(10, currentY + 22, 200, currentY + 22)
        currentY += 28

        // Margin info below the box
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`Margin Keuntungan: ${metrics.margin.toFixed(2)}%`, 20, currentY)
        currentY += 8

        // Signatures (bottom page)
        let sigY = Math.max(215, currentY + 10)
        if (sigY > 240) {
          doc.addPage()
          sigY = 30
          doc.setLineWidth(0.6)
          doc.rect(10, 10, 190, 277)
        }

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text('Penerima / Pembuat', 35, sigY, { align: 'center' })
        doc.text(`Tangerang, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 155, sigY, { align: 'center' })
        doc.text('Dwi Astuti (owner)', 155, sigY + 6, { align: 'center' })
        
        doc.text('( ___________________ )', 35, sigY + 30, { align: 'center' })
        doc.text('( Dwi Astuti )', 155, sigY + 30, { align: 'center' })

        // Audit Waktu
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text('Laporan Audit Laba Rugi: ' + getFormattedDateTimeIndo(), 105, 272, { align: 'center' })

        doc.save(`Laporan_Laba_Rugi_Shopee_${Date.now()}.pdf`)
        addToast('✅ PDF Berhasil diunduh', 'success')
      } catch (err) {
        addToast(`❌ Gagal unduh PDF: ${err.message}`, 'error')
      }
    }, 500)
  }

  if (!ledger || ledger.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-4 bg-muted/40 rounded-full text-muted-foreground">
          <FileText className="h-10 w-10" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Belum Ada Laporan Laba Rugi</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Setelah mengunggah data di Dashboard, Anda dapat melihat rincian laporan keuangan laba rugi di sini.
          </p>
        </div>
      </div>
    )
  }

  const isProfit = metrics.netProfit >= 0

  return (
    <div className="space-y-8 animate-scale pb-16">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Laporan Laba Rugi</h2>
          <p className="text-slate-500 mt-1 dark:text-slate-400 text-sm">
            Format Laporan Keuangan Profesional dengan opsi ekspor multi-format.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {/* Sumber Transaksi Dropdown Filter */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            <span>Sumber:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-white outline-none border-none cursor-pointer focus:ring-0"
            >
              <option value="all" className="bg-white dark:bg-slate-900">Semua Transaksi</option>
              <option value="shopee" className="bg-white dark:bg-slate-900">Marketplace Shopee</option>
              <option value="telegram" className="bg-white dark:bg-slate-900">Telegram Bot (Manual)</option>
            </select>
          </div>

          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-slate-800 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-slate-700 shadow-md shadow-slate-950/10 transition-colors"
          >
            <Receipt className="h-4 w-4 text-emerald-400" /> Struk PDF
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-emerald-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-emerald-500 shadow-md shadow-emerald-500/10 transition-colors"
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-8">
        {/* Statement Box */}
        <Card className="md:col-span-8 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-md bg-white dark:bg-slate-900 overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b pb-5">
            <CardTitle className="text-center font-black text-lg uppercase tracking-wider text-slate-800 dark:text-white">
              Statement of Profit or Loss
            </CardTitle>
            {dateRange && (
              <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-semibold mt-1">
                PERIODE: {dateRange.toUpperCase()}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {/* Revenue */}
              <div className="p-4 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                <span className="font-bold uppercase text-slate-400 dark:text-slate-50 text-xs tracking-wider">A. Pendapatan</span>
              </div>
              <div className="p-4 flex justify-between items-center px-6">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Omset Kotor (Harga Asli Produk)</span>
                <span className="font-bold text-slate-800 dark:text-white">{formatRupiah(metrics.totalGross)}</span>
              </div>
              
              {/* Commission/Marketplace */}
              <div className="p-4 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                <span className="font-bold uppercase text-slate-400 dark:text-slate-50 text-xs tracking-wider">B. Beban Komisi Marketplace (Shopee)</span>
              </div>
              <div className="p-4 flex justify-between items-center px-6 text-rose-600 dark:text-rose-400">
                <span>Biaya Administrasi</span>
                <span className="font-semibold">-{formatRupiah(metrics.totalAdmin)}</span>
              </div>
              <div className="p-4 flex justify-between items-center px-6 text-rose-600 dark:text-rose-400">
                <span>Biaya Layanan</span>
                <span className="font-semibold">-{formatRupiah(metrics.totalService)}</span>
              </div>
              <div className="p-4 flex justify-between items-center px-6 text-rose-600 dark:text-rose-400">
                <span>Ongkos Kirim Ditanggung Penjual</span>
                <span className="font-semibold">-{formatRupiah(metrics.totalShipping)}</span>
              </div>
              <div className="p-4 flex justify-between items-center px-6">
                <span>Penyesuaian Dana (Adjustment)</span>
                <span className={metrics.totalAdjustment < 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'}>
                  {metrics.totalAdjustment < 0 ? '-' : '+'}{formatRupiah(Math.abs(metrics.totalAdjustment))}
                </span>
              </div>
              
              {/* Dana Cair Net */}
              <div className="p-4 flex justify-between items-center bg-slate-50/50 dark:bg-emerald-950/20 font-bold border-t-2 px-6">
                <span className="text-slate-700 dark:text-slate-300">Total Transfer (Dana Cair Shopee)</span>
                <span className="text-slate-900 dark:text-white">{formatRupiah(metrics.totalNetIncome)}</span>
              </div>

              {/* HPP */}
              <div className="p-4 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                <span className="font-bold uppercase text-slate-400 dark:text-slate-50 text-xs tracking-wider">C. Harga Pokok Penjualan (HPP)</span>
              </div>
              <div className="p-4 flex justify-between items-center px-6 text-rose-600 dark:text-rose-400">
                <span>Beban HPP Persediaan Produk</span>
                <span className="font-semibold">-{formatRupiah(metrics.totalHpp)}</span>
              </div>

              {/* Laba Kotor */}
              <div className="p-4 flex justify-between items-center bg-slate-50/50 dark:bg-emerald-950/20 font-bold text-base border-t-2 px-6">
                <span className="text-slate-700 dark:text-slate-300">Laba Kotor</span>
                <span className={metrics.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {formatRupiah(metrics.grossProfit)}
                </span>
              </div>

              {/* Operational Costs */}
              <div className="p-4 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                <span className="font-bold uppercase text-slate-400 dark:text-slate-50 text-xs tracking-wider">D. Beban Operasional Internal</span>
              </div>
              
              {/* Rincian Upah Tim Otomatis dari Tab Absensi */}
              {metrics.totalTimSalaryAndBonus > 0 && (
                <div className="p-4 flex justify-between items-center px-6 text-rose-600 dark:text-rose-400 bg-emerald-500/5 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Gaji & Bonus Karyawan (Otomatis)
                  </span>
                  <span>-{formatRupiah(metrics.totalTimSalaryAndBonus)}</span>
                </div>
              )}

              {operationalCosts.map(cost => (
                <div key={cost.id} className="p-4 flex justify-between items-center px-6 text-rose-600 dark:text-rose-400">
                  <span>{cost.name}</span>
                  <span className="font-semibold">-{formatRupiah(cost.amount)}</span>
                </div>
              ))}
              
              <div className="p-4 flex justify-between items-center px-6 text-rose-600 dark:text-rose-400 font-medium border-t border-dashed">
                <span>Total Biaya Operasional</span>
                <span>-{formatRupiah(metrics.totalCombinedOpCost)}</span>
              </div>

              {/* Net Profit final */}
              <div className={`p-6 flex flex-col items-center justify-center border-t-4 ${isProfit ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-500' : 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-500'}`}>
                <span className="uppercase text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 mb-1">Laba Bersih Akhir</span>
                <span className={`text-4xl font-black ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'} tracking-tight`}>
                  {formatRupiah(metrics.netProfit)}
                </span>
                <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Margin Keuntungan: {metrics.margin.toFixed(2)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operational Form */}
        <div className="md:col-span-4 space-y-6">
          <Card className="border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-white">Input Biaya Operasional</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleAddCost} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nama Pengeluaran</label>
                  <input 
                    type="text" 
                    required
                    value={newCostName}
                    onChange={(e) => setNewCostName(e.target.value)}
                    placeholder="Contoh: Gaji Live Model, Sewa Studio" 
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent dark:text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nominal (Rp)</label>
                  <input 
                    type="number" 
                    required
                    min="0"
                    value={newCostAmount}
                    onChange={(e) => setNewCostAmount(e.target.value)}
                    placeholder="0" 
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-transparent dark:text-white"
                  />
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 py-2.5 rounded-xl hover:bg-emerald-500 transition-colors shadow-md shadow-emerald-500/10">
                  <Plus className="h-4 w-4" /> Tambah Pengeluaran
                </button>
              </form>
            </CardContent>
          </Card>

          {operationalCosts.length > 0 && (
            <Card className="border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900">
              <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-bold text-slate-800 dark:text-white">Daftar Biaya Operasional</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-3">
                {operationalCosts.map(cost => (
                  <div key={cost.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 text-sm">
                    <div className="truncate pr-2 font-medium text-slate-700 dark:text-slate-300">{cost.name}</div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-rose-500">-{formatRupiah(cost.amount)}</span>
                      <button 
                        onClick={() => {
                          removeOpCost(cost.id)
                          addToast(`🗑️ Biaya "${cost.name}" dihapus`, 'info')
                        }} 
                        className="text-slate-400 hover:text-rose-500 p-1 hover:bg-white dark:hover:bg-slate-850 rounded-md transition-all duration-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
