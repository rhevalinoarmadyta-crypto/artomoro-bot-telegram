import React, { useState, useMemo } from 'react'
import { useFinanceStore } from '../store/useFinanceStore'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Layers, AlertTriangle, CheckCircle2, History, Plus, X, Calendar, FileText, ClipboardList } from 'lucide-react'

export default function Inventory() {
  const { inventoryItems, inventoryLogs, outboundRejectedStock, addToast, addInboundBall } = useFinanceStore()

  // Modal State
  const [showModal, setShowModal] = useState(false)
  
  // Form State
  const [selectedSku, setSelectedSku] = useState('')
  const [qtyInput, setQtyInput] = useState('')
  const [purpose, setPurpose] = useState('Dibuang')
  const [notes, setNotes] = useState('')
  const [dateOut, setDateOut] = useState(() => new Date().toISOString().split('T')[0])

  // Inbound Ball Modal State
  const [showInboundModal, setShowInboundModal] = useState(false)
  const [jenisBall, setJenisBall] = useState('')
  const [kategoriBall, setKategoriBall] = useState('')
  const [totalIsi, setTotalIsi] = useState('')
  const [totalRejected, setTotalRejected] = useState('')
  const [skuRows, setSkuRows] = useState([
    { id: 'row-1', sku: '', goodQty: '', rejectQty: '' }
  ])

  const totalBagusCalculated = useMemo(() => {
    const isi = parseInt(totalIsi, 10) || 0
    const reject = parseInt(totalRejected, 10) || 0
    return Math.max(0, isi - reject)
  }, [totalIsi, totalRejected])

  const handleAddSkuRow = () => {
    setSkuRows(prev => [
      ...prev,
      { id: `row-${Date.now()}-${Math.random()}`, sku: '', goodQty: '', rejectQty: '' }
    ])
  }

  const handleRemoveSkuRow = (id) => {
    setSkuRows(prev => prev.filter(r => r.id !== id))
  }

  const handleSkuRowChange = (id, field, value) => {
    setSkuRows(prev => prev.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value }
      }
      return r
    }))
  }

  const handleOpenInboundModal = () => {
    setJenisBall('')
    setKategoriBall('')
    setTotalIsi('')
    setTotalRejected('')
    setSkuRows([{ id: 'row-1', sku: '', goodQty: '', rejectQty: '' }])
    setShowInboundModal(true)
  }

  const handleSubmitInbound = (e) => {
    e.preventDefault()

    if (!jenisBall.trim()) {
      addToast('❌ Mohon isi Jenis Ball.', 'error')
      return
    }
    if (!kategoriBall.trim()) {
      addToast('❌ Mohon isi Kategori Ball.', 'error')
      return
    }

    const isi = parseInt(totalIsi, 10)
    const reject = parseInt(totalRejected, 10)
    if (isNaN(isi) || isi <= 0) {
      addToast('❌ Total Isi Ball harus lebih besar dari 0.', 'error')
      return
    }
    if (isNaN(reject) || reject < 0) {
      addToast('❌ Total Rejected tidak boleh negatif.', 'error')
      return
    }
    if (reject > isi) {
      addToast('❌ Total Rejected tidak boleh melebihi Total Isi Ball.', 'error')
      return
    }

    // Validate SKU rows
    for (let i = 0; i < skuRows.length; i++) {
      const row = skuRows[i]
      if (!row.sku.trim()) {
        addToast(`❌ Baris ${i + 1}: SKU tidak boleh kosong.`, 'error')
        return
      }
      const gQty = parseInt(row.goodQty, 10)
      const rQty = parseInt(row.rejectQty, 10)
      if (isNaN(gQty) || gQty < 0) {
        addToast(`❌ Baris ${i + 1}: Jumlah Bagus tidak valid.`, 'error')
        return
      }
      if (isNaN(rQty) || rQty < 0) {
        addToast(`❌ Baris ${i + 1}: Jumlah Reject tidak valid.`, 'error')
        return
      }
    }

    const totalAllocatedGood = skuRows.reduce((sum, r) => sum + (parseInt(r.goodQty, 10) || 0), 0)
    const expectedGood = isi - reject

    if (totalAllocatedGood !== expectedGood) {
      addToast(`❌ Validasi Gagal: Jumlah alokasi barang bagus di baris SKU (${totalAllocatedGood} pcs) harus sama persis dengan Total Barang Bagus di kalkulator atas (${expectedGood} pcs).`, 'error')
      return
    }

    // Call store action
    const success = addInboundBall(jenisBall, kategoriBall, isi, reject, skuRows)
    if (success) {
      setShowInboundModal(false)
    }
  }

  // Get active item to display remaining reject stock
  const activeItem = useMemo(() => {
    return inventoryItems.find(item => item.sku === selectedSku)
  }, [selectedSku, inventoryItems])

  // Stats Card Calculations
  const stats = useMemo(() => {
    const totalGood = inventoryItems.reduce((sum, item) => sum + (item.stock_good || 0), 0)
    const totalRejected = inventoryItems.reduce((sum, item) => sum + (item.stock_rejected || 0), 0)
    const totalOutboundReject = inventoryLogs
      .filter(log => log.type === 'OUT_REJECT')
      .reduce((sum, log) => sum + (log.qty || 0), 0)

    return {
      totalGood,
      totalRejected,
      totalOutboundReject
    }
  }, [inventoryItems, inventoryLogs])

  const handleOpenModal = () => {
    if (inventoryItems.length > 0) {
      setSelectedSku(inventoryItems[0].sku)
    }
    setQtyInput('')
    setPurpose('Dibuang')
    setNotes('')
    setDateOut(new Date().toISOString().split('T')[0])
    setShowModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!selectedSku) {
      addToast('❌ Mohon pilih SKU barang.', 'error')
      return
    }

    const qty = parseInt(qtyInput, 10)
    if (isNaN(qty) || qty <= 0) {
      addToast('❌ Jumlah pengeluaran harus lebih besar dari 0.', 'error')
      return
    }

    if (!activeItem) {
      addToast('❌ SKU tidak ditemukan.', 'error')
      return
    }

    if (qty > activeItem.stock_rejected) {
      addToast(`❌ Jumlah pengeluaran (${qty} pcs) tidak boleh melebihi sisa reject (${activeItem.stock_rejected} pcs).`, 'error')
      return
    }

    // Call store action
    const success = outboundRejectedStock(selectedSku, qty, purpose, notes, dateOut)
    if (success) {
      setShowModal(false)
    }
  }

  return (
    <div className="space-y-8 animate-scale">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Manajemen Stok & Logistik</h2>
          <p className="text-slate-500 mt-1 dark:text-slate-400 text-sm">
            Kelola persediaan barang bagus, barang reject, dan catat pergerakan logistik secara terpusat.
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap justify-end">
          <button
            onClick={handleOpenInboundModal}
            className="flex items-center gap-2 bg-indigo-650 hover:bg-indigo-600 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-lg transition-all duration-205"
          >
            📦 Inbound / Bongkar Ball
          </button>
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md shadow-amber-500/10 hover:shadow-lg transition-all duration-200"
          >
            🗑️ Kelola Stok Reject
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Total Stok Bagus (Good)
            </div>
            <div className="text-2xl font-black text-slate-850 dark:text-white">{stats.totalGood.toLocaleString('id-ID')} Pcs</div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Stok siap jual di marketplace</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-rose-600 dark:text-rose-455 text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-500" /> Total Stok Reject
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-450">{stats.totalRejected.toLocaleString('id-ID')} Pcs</div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Stok cacat di gudang saat ini</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <History className="h-4 w-4 text-slate-400" /> Total Reject Dikeluarkan
            </div>
            <div className="text-2xl font-black text-slate-850 dark:text-white">{stats.totalOutboundReject.toLocaleString('id-ID')} Pcs</div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Jumlah barang reject yang sudah dibuang/didonasikan</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Items Table */}
      <Card className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-850 py-4 px-6">
          <CardTitle className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
            <Layers className="h-4.5 w-4.5 text-slate-500" /> Daftar Persediaan Barang (Inventory Items)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 uppercase font-bold text-xs border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 w-40">SKU</th>
                  <th className="px-6 py-3.5">Nama Barang</th>
                  <th className="px-6 py-3.5 w-44 text-right">Stok Bagus (Good)</th>
                  <th className="px-6 py-3.5 w-44 text-right">Stok Reject</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {inventoryItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-slate-700 dark:text-slate-350">{item.sku}</td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-450">{item.stock_good.toLocaleString('id-ID')} Pcs</td>
                    <td className="px-6 py-4 text-right font-bold text-rose-500 dark:text-rose-400">
                      {item.stock_rejected > 0 ? `${item.stock_rejected.toLocaleString('id-ID')} Pcs` : '0 Pcs'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mutation Logs Table */}
      <Card className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-850 py-4 px-6">
          <CardTitle className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
            <ClipboardList className="h-4.5 w-4.5 text-slate-500" /> Riwayat Mutasi Barang (Inventory Logs)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {inventoryLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
              Belum ada mutasi barang yang tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 uppercase font-bold text-xs border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5 w-36">Tanggal</th>
                    <th className="px-6 py-3.5 w-36">SKU</th>
                    <th className="px-6 py-3.5 w-36">Tipe Mutasi</th>
                    <th className="px-6 py-3.5 w-32 text-right">Jumlah</th>
                    <th className="px-6 py-3.5 w-44">Tujuan/Alasan</th>
                    <th className="px-6 py-3.5">Catatan Tambahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {inventoryLogs.map((log) => {
                    let badgeClass = "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30"
                    let qtyPrefix = "-"
                    let qtyClass = "text-slate-800 dark:text-slate-200"

                    if (log.type === 'INBOUND_BALL') {
                      badgeClass = "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30"
                      qtyPrefix = "+"
                      qtyClass = "text-emerald-600 dark:text-emerald-400 font-bold"
                    } else if (log.type === 'TERJUAL_SHOPEE') {
                      badgeClass = "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30"
                      qtyPrefix = "-"
                      qtyClass = "text-slate-800 dark:text-slate-200 font-bold"
                    } else if (log.type === 'OUT_REJECT') {
                      badgeClass = "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30"
                      qtyPrefix = "-"
                      qtyClass = "text-amber-600 dark:text-amber-400 font-bold"
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-semibold">{log.date}</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-700 dark:text-slate-350">{log.sku}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>
                            {log.type}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right font-black ${qtyClass}`}>{qtyPrefix}{log.qty} Pcs</td>
                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{log.reason}</td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs italic">{log.notes || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Form ("Keluarkan Stok Reject") */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-3xl max-w-md w-full shadow-2xl p-6 relative animate-scale overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black tracking-tight text-slate-850 dark:text-white flex items-center gap-2">
                🗑️ Keluarkan Stok Reject
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              
              {/* SKU Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Pilih SKU Barang
                  </label>
                  {activeItem && (
                    <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400">
                      [Sisa Reject Saat Ini: {activeItem.stock_rejected} pcs]
                    </span>
                  )}
                </div>
                <select
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white dark:bg-slate-950"
                  required
                >
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.sku} className="dark:bg-slate-900">
                      {item.sku} - {item.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity Outbound */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Jumlah Dikeluarkan
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={activeItem ? activeItem.stock_rejected : undefined}
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                  placeholder={`Maksimal ${activeItem ? activeItem.stock_rejected : 0} pcs`}
                  className="w-full border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                />
              </div>

              {/* Purpose / Reason */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Tujuan / Alasan Pengeluaran
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white dark:bg-slate-950"
                  required
                >
                  <option value="Dibuang" className="dark:bg-slate-900">Dibuang (Scrapped)</option>
                  <option value="Didonasikan" className="dark:bg-slate-900">Didonasikan (Donated)</option>
                  <option value="Obral/Flash Sale Murah" className="dark:bg-slate-900">Obral / Flash Sale Murah</option>
                  <option value="Lainnya" className="dark:bg-slate-900">Lainnya</option>
                </select>
              </div>

              {/* Additional Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Catatan Tambahan (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Keterangan kondisi cacat atau info donasi..."
                  rows={2}
                  className="w-full border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white resize-none"
                />
              </div>

              {/* Outbound Date */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Tanggal Keluar
                </label>
                <input
                  type="date"
                  required
                  value={dateOut}
                  onChange={(e) => setDateOut(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 dark:text-white dark:bg-slate-950"
                />
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2 rounded-lg font-bold text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-xs transition shadow-md shadow-amber-500/10"
                >
                  Konfirmasi Keluar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Form ("Inbound / Bongkar Ball") */}
      {showInboundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-3xl max-w-2xl w-full shadow-2xl p-6 relative animate-scale overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-black tracking-tight text-slate-850 dark:text-white flex items-center gap-2">
                📦 Inbound / Bongkar Ball
              </h3>
              <button
                onClick={() => setShowInboundModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body / Scrollable Form */}
            <form onSubmit={handleSubmitInbound} className="space-y-4 pt-4 overflow-y-auto flex-1 pr-1 text-slate-800 dark:text-slate-100">
              
              {/* Jenis & Kategori Ball (Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Jenis Ball
                  </label>
                  <input
                    type="text"
                    required
                    value={jenisBall}
                    onChange={(e) => setJenisBall(e.target.value)}
                    placeholder="Contoh: Ball Segel Korea"
                    className="w-full border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Kategori Ball
                  </label>
                  <input
                    type="text"
                    required
                    value={kategoriBall}
                    onChange={(e) => setKategoriBall(e.target.value)}
                    placeholder="Contoh: Campuran Cargo & Kemeja"
                    className="w-full border border-slate-200 dark:border-slate-800 bg-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                </div>
              </div>

              {/* Kalkulasi Otomatis (Total Isi, Rejected, Bagus) */}
              <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 rounded-2xl p-4">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-3">
                  Kalkulator Hasil Bongkaran
                </span>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">
                      Total Isi Ball
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={totalIsi}
                      onChange={(e) => setTotalIsi(e.target.value)}
                      placeholder="0"
                      className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">
                      Total Rejected
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={totalRejected}
                      onChange={(e) => setTotalRejected(e.target.value)}
                      placeholder="0"
                      className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white font-bold text-rose-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider">
                      Barang Bagus
                    </label>
                    <input
                      type="number"
                      disabled
                      readOnly
                      value={totalBagusCalculated}
                      className="w-full border border-slate-200/60 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 rounded-xl px-3 py-2 text-sm cursor-not-allowed dark:text-emerald-400 font-black"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic SKU Allocation Section */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <ClipboardList className="h-3.5 w-3.5 text-indigo-500" /> Alokasi Multi-SKU dalam Ball
                  </span>
                  
                  <button
                    type="button"
                    onClick={handleAddSkuRow}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-550 dark:hover:text-indigo-300 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add SKU Row
                  </button>
                </div>

                {/* SKU Rows List */}
                <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1">
                  {skuRows.map((row, index) => (
                    <div key={row.id} className="flex gap-2 items-end bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-850 p-3 rounded-xl">
                      
                      {/* SKU Dropdown Selector */}
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Kode SKU</label>
                        <select
                          required
                          value={row.sku}
                          onChange={(e) => handleSkuRowChange(row.id, 'sku', e.target.value)}
                          className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white font-mono"
                        >
                          <option value="">-- Pilih Kode SKU --</option>
                          {inventoryItems.map(item => (
                            <option key={item.id} value={item.sku}>
                              {item.sku} - {item.name}
                            </option>
                          ))}
                          <option value="Cargo Rejected">Cargo Rejected (Rute Khusus)</option>
                        </select>
                      </div>

                      {/* Jumlah Bagus */}
                      <div className="w-24 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Bagus (pcs)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={row.goodQty}
                          onChange={(e) => handleSkuRowChange(row.id, 'goodQty', e.target.value)}
                          placeholder="0"
                          className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white font-bold text-emerald-600 dark:text-emerald-450"
                        />
                      </div>

                      {/* Jumlah Reject */}
                      <div className="w-24 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reject (pcs)</label>
                        <input
                          type="number"
                          required
                          min="0"
                          value={row.rejectQty}
                          onChange={(e) => handleSkuRowChange(row.id, 'rejectQty', e.target.value)}
                          placeholder="0"
                          className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:text-white font-bold text-rose-500"
                        />
                      </div>

                      {/* Delete Action */}
                      <button
                        type="button"
                        disabled={skuRows.length <= 1}
                        onClick={() => handleRemoveSkuRow(row.id)}
                        className={`p-2 rounded-lg border transition-all ${
                          skuRows.length <= 1 
                            ? 'border-slate-100 dark:border-slate-850 text-slate-300 dark:text-slate-700 cursor-not-allowed' 
                            : 'border-rose-100 dark:border-rose-950/40 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                        }`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Allocation Progress Info */}
                <div className="bg-slate-50 dark:bg-slate-950/30 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs border border-slate-100 dark:border-slate-850">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Alokasi Barang Bagus Terinput:</span>
                  
                  {(() => {
                    const currentAllocated = skuRows.reduce((sum, r) => sum + (parseInt(r.goodQty, 10) || 0), 0)
                    const isMatched = currentAllocated === totalBagusCalculated
                    
                    return (
                      <span className={`font-bold flex items-center gap-1 ${isMatched ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                        {isMatched ? '✅' : '⚠️'} {currentAllocated} Pcs / {totalBagusCalculated} Pcs
                      </span>
                    )
                  })()}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInboundModal(false)}
                  className="border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2 rounded-lg font-bold text-xs transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-650 hover:bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold text-xs transition shadow-md shadow-indigo-600/10"
                >
                  Konfirmasi & Tambah Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
