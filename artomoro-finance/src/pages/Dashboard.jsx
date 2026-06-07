import React, { useState, useMemo } from 'react'
import { Upload, AlertCircle, CheckCircle2, FileSpreadsheet, Layers, ArrowRight } from 'lucide-react'
import { useFinanceStore } from '../store/useFinanceStore'
import { processFiles } from '../lib/parser'
import { formatRupiah } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

// Mini Sparkline component for metric cards
const Sparkline = ({ data, dataKey, color }) => {
  return (
    <div className="h-10 w-24 opacity-80 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`${color}15`}
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function Dashboard() {
  const { setLedger, getMetrics, addToast, getProcessedAttendance, liveAttendance, shiftSubstitutions, getCombinedLedger } = useFinanceStore()
  const excelLedger = useFinanceStore(state => state.ledger)
  const webhookOrders = useFinanceStore(state => state.webhookOrders)
  const ledger = useMemo(() => getCombinedLedger(), [excelLedger, webhookOrders, getCombinedLedger])
  const processedAttendance = useMemo(() => getProcessedAttendance(), [getProcessedAttendance, liveAttendance, shiftSubstitutions])
  const metrics = getMetrics()

  const [file1, setFile1] = useState(null)
  const [file2, setFile2] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleProcess = () => {
    if (!file1 || !file2) {
      setError('Mohon unggah kedua file terlebih dahulu.')
      return
    }
    setLoading(true)
    setError('')
    
    setTimeout(async () => {
      try {
        const result = await processFiles(file1, file2)
        setLedger(result)
        addToast(`✅ Berhasil memproses ${result.length.toLocaleString('id-ID')} transaksi`, 'success')
      } catch (err) {
        setError(err.message)
        addToast(`❌ Gagal: ${err.message}`, 'error')
      } finally {
        setLoading(false)
      }
    }, 150)
  }

  const hasData = ledger && ledger.length > 0

  // 1. Process daily data for sparkline charts
  const dailyData = useMemo(() => {
    if (!ledger || !ledger.length) return []
    const acc = {}
    ledger.forEach(row => {
      const rawDate = row.date ? String(row.date).trim() : ''
      let d = rawDate.split(' ')[0] || 'Tanpa Tanggal'
      if (!acc[d]) {
        acc[d] = { date: d, omset: 0, cashIn: 0, profit: 0, margin: 0 }
      }
      
      const { itemHpp, globalHpp, productHpp } = useFinanceStore.getState()
      const prodHpp = productHpp || {}
      const currentHpp = itemHpp[row.orderId] !== undefined 
        ? itemHpp[row.orderId] 
        : (prodHpp[row.productName] !== undefined ? prodHpp[row.productName] : globalHpp)

      acc[d].omset += row.originalPrice || 0
      acc[d].cashIn += row.netIncome || 0
      acc[d].profit += ((row.netIncome || 0) - currentHpp)
    })

    return Object.values(acc).sort((a, b) => {
      if (a.date === 'Tanpa Tanggal') return 1
      if (b.date === 'Tanpa Tanggal') return -1
      return new Date(a.date) - new Date(b.date)
    }).map(item => ({
      ...item,
      margin: item.omset > 0 ? (item.profit / item.omset) * 105 : 0
    }))
  }, [ledger])

  // 2. Process Top Performing Products
  const topProducts = useMemo(() => {
    if (!ledger || !ledger.length) return []
    
    const acc = {}
    ledger.forEach(row => {
      const name = row.productName || 'Unknown Product'
      if (!acc[name]) {
        acc[name] = { name, count: 0, revenue: 0, profit: 0 }
      }
      
      const { itemHpp, globalHpp, productHpp } = useFinanceStore.getState()
      const prodHpp = productHpp || {}
      const currentHpp = itemHpp[row.orderId] !== undefined 
        ? itemHpp[row.orderId] 
        : (prodHpp[row.productName] !== undefined ? prodHpp[row.productName] : globalHpp)

      acc[name].count += 1
      acc[name].revenue += row.originalPrice || 0
      acc[name].profit += ((row.netIncome || 0) - currentHpp)
    })

    return Object.values(acc)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [ledger])

  // 3. Process Smart Insights
  const insights = useMemo(() => {
    const list = []

    if (ledger && ledger.length > 0) {
      const { itemHpp, globalHpp, productHpp } = useFinanceStore.getState()
      const prodHpp = productHpp || {}
      let unmappedCount = 0
      ledger.forEach(row => {
        const currentHpp = itemHpp[row.orderId] !== undefined 
          ? itemHpp[row.orderId] 
          : (prodHpp[row.productName] !== undefined ? prodHpp[row.productName] : globalHpp)
        if (!currentHpp || currentHpp === 0) {
          unmappedCount++
        }
      })

      if (unmappedCount > 0) {
        list.push({
          type: 'warning',
          text: `⚠️ Terdapat ${unmappedCount} pesanan yang HPP-nya belum diisi (masih Rp 0).`
        })
      } else {
        list.push({
          type: 'success',
          text: `✨ Semua pesanan telah terisi data HPP dengan lengkap.`
        })
      }

      if (dailyData.length > 0) {
        let maxProfitDay = dailyData[0]
        dailyData.forEach(d => {
          if (d.profit > maxProfitDay.profit) {
            maxProfitDay = d
          }
        })
        if (maxProfitDay && maxProfitDay.profit > 0) {
          list.push({
            type: 'info',
            text: `📈 Laba kotor tertinggi harian terjadi pada tanggal ${maxProfitDay.date} sebesar ${formatRupiah(maxProfitDay.profit)}.`
          })
        }
      }

      const margin = metrics.margin
      if (margin > 30) {
        list.push({
          type: 'success',
          text: `💡 Margin laba kotor tim Anda sangat sehat (${margin.toFixed(1)}%). Pertahankan performa live ini!`
        })
      } else if (margin > 15) {
        list.push({
          type: 'info',
          text: `💡 Margin laba kotor tim Anda saat ini berada di level sedang (${margin.toFixed(1)}%).`
        })
      } else {
        list.push({
          type: 'warning',
          text: `⚠️ Margin laba kotor Anda rendah (${margin.toFixed(1)}%). Coba optimalkan biaya operasional atau naikkan harga jual.`
        })
      }
    }

    // 4. Discipline Warning for Shift Pagi
    if (processedAttendance && processedAttendance.length > 0) {
      const morningSessions = processedAttendance.filter(r => r.name === 'Adit')
      const groupedLive = {}
      morningSessions.forEach(session => {
        const dateStr = session.date
        if (!groupedLive[dateStr]) {
          groupedLive[dateStr] = { date: dateStr, totalOverlapSeconds: 0, isAbsent: session.isAbsent }
        }
        if (!session.isAbsent) {
          groupedLive[dateStr].totalOverlapSeconds += session.overlapSeconds || 0
        }
      })
      
      Object.values(groupedLive).forEach(group => {
        const targetSeconds = 7 * 3600
        if (!group.isAbsent && group.totalOverlapSeconds < targetSeconds) {
          const totalMinutesTotal = Math.round(group.totalOverlapSeconds / 60)
          const h = Math.floor(totalMinutesTotal / 60)
          const m = totalMinutesTotal % 60
          list.push({
            type: 'warning',
            text: `⚠️ [${group.date}] Durasi Live Tidak Memenuhi Standar (Hanya ${h} Jam ${m} Menit dari target 7 Jam).`
          })
        }
      })
    }

    return list
  }, [ledger, dailyData, metrics.margin, processedAttendance])

  return (
    <div className="space-y-8 animate-scale">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            Dashboard Rekonsiliasi
          </h2>
          <p className="text-slate-500 mt-1 dark:text-slate-400 text-sm">
            Platform audit keuangan manual Shopee dengan presisi komputasi penuh.
          </p>
        </div>
      </div>

      {loading ? (
        <Card className="border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl bg-white dark:bg-slate-900 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-20 px-8 space-y-6 text-center">
              <div className="relative flex items-center justify-center">
                <div className="h-20 w-20 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
                <div className="absolute h-10 w-10 rounded-full bg-emerald-500/10 animate-ping"></div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Memproses Rekonsiliasi</h3>
                <p className="text-slate-500 text-sm max-w-sm dark:text-slate-400">
                  Sedang memproses dan menyelaraskan ribuan baris data transaksi Shopee...
                </p>
              </div>
              <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full w-full animate-pulse"></div>
              </div>
              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-xl p-4 w-full max-w-sm text-left space-y-2.5 shadow-sm">
                <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Membaca file Laporan Pesanan Selesai...
                </div>
                <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  Membaca Laporan Saldo Penjual (Sheet: Income)...
                </div>
                <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-350 font-medium animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-slate-450"></span>
                  Melakukan pencocokan relasional (Inner Join)...
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !hasData ? (
        <Card className="border border-slate-200/85 dark:border-slate-800 rounded-2xl shadow-lg bg-white dark:bg-slate-900">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-5">
            <CardTitle className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-emerald-500" />
              Mulai Rekonsiliasi Data Shopee
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* File 1 Upload Box */}
              <div className="relative group border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-emerald-50/5 dark:hover:bg-emerald-950/5 transition-all duration-300">
                <input
                  type="file"
                  id="f1"
                  className="hidden"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => {
                    setFile1(e.target.files[0])
                    addToast('File 1 terpilih: ' + e.target.files[0].name, 'success')
                  }}
                />
                <label htmlFor="f1" className="cursor-pointer flex flex-col items-center w-full h-full">
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/80 mb-4 group-hover:scale-110 transition-transform duration-300">
                    {file1 ? (
                      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    ) : (
                      <Upload className="h-10 w-10 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors" />
                    )}
                  </div>
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                    {file1 ? file1.name : 'Pilih File 1: Laporan Pesanan'}
                  </span>
                  <span className="text-xs text-slate-400 mt-1.5 max-w-[200px] leading-relaxed">
                    Unggah Laporan Pesanan Selesai (.csv / .xlsx) dari Seller Centre.
                  </span>
                </label>
              </div>

              {/* File 2 Upload Box */}
              <div className="relative group border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-emerald-50/5 dark:hover:bg-emerald-950/5 transition-all duration-300">
                <input
                  type="file"
                  id="f2"
                  className="hidden"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => {
                    setFile2(e.target.files[0])
                    addToast('File 2 terpilih: ' + e.target.files[0].name, 'success')
                  }}
                />
                <label htmlFor="f2" className="cursor-pointer flex flex-col items-center w-full h-full">
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/80 mb-4 group-hover:scale-110 transition-transform duration-300">
                    {file2 ? (
                      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    ) : (
                      <FileSpreadsheet className="h-10 w-10 text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-colors" />
                    )}
                  </div>
                  <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                    {file2 ? file2.name : 'Pilih File 2: Laporan Saldo Penjual'}
                  </span>
                  <span className="text-xs text-slate-400 mt-1.5 max-w-[200px] leading-relaxed">
                    Unggah Laporan Penghasilan/Saldo Penjual (.csv / .xlsx).
                  </span>
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 p-4 rounded-xl flex items-start gap-3 text-sm border border-rose-100 dark:border-rose-900/30">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={handleProcess}
                disabled={!file1 || !file2 || loading}
                className="flex items-center gap-2 bg-emerald-600 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-md shadow-emerald-500/10 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Mulai Rekonsiliasi
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Omset Card */}
            <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900 hover:shadow-md transition-shadow overflow-hidden">
              <CardContent className="p-5 flex items-end justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">Omset Kotor</span>
                  <div className="text-2xl font-black text-slate-850 dark:text-white tracking-tight">
                    {formatRupiah(metrics.totalGross)}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Total produk terjual</p>
                </div>
                <Sparkline data={dailyData} dataKey="omset" color="#3b82f6" />
              </CardContent>
            </Card>
            
            {/* Dana Cair Card */}
            <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900 hover:shadow-md transition-shadow overflow-hidden">
              <CardContent className="p-5 flex items-end justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">Dana Cair Shopee</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {formatRupiah(metrics.totalNetIncome)}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Potongan admin & layanan</p>
                </div>
                <Sparkline data={dailyData} dataKey="cashIn" color="#10b981" />
              </CardContent>
            </Card>

            {/* Laba Kotor Card */}
            <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900 hover:shadow-md transition-shadow overflow-hidden">
              <CardContent className="p-5 flex items-end justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">Laba Kotor</span>
                  <div className={`text-2xl font-black tracking-tight ${metrics.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatRupiah(metrics.grossProfit)}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Omset - Total HPP</p>
                </div>
                <Sparkline data={dailyData} dataKey="profit" color={metrics.grossProfit >= 0 ? '#10b981' : '#f43f5e'} />
              </CardContent>
            </Card>

            {/* Margin Card */}
            <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900 hover:shadow-md transition-shadow overflow-hidden">
              <CardContent className="p-5 flex items-end justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider block">Margin Profit</span>
                  <div className="text-2xl font-black text-slate-850 dark:text-white tracking-tight">
                    {metrics.margin.toFixed(2)}%
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Laba Kotor vs Omset</p>
                </div>
                <Sparkline data={dailyData} dataKey="margin" color="#f59e0b" />
              </CardContent>
            </Card>
          </div>

          {/* Lower Widgets Section: Top Products & Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top 5 Products Table Widget */}
            <Card className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="border-b border-slate-100 dark:border-slate-855 pb-4">
                <CardTitle className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
                  🏆 Top 5 Produk Terlaris
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col justify-center">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 uppercase font-bold text-[10px] border-b">
                      <tr>
                        <th className="px-4 py-3">Nama Produk</th>
                        <th className="px-4 py-3 text-center">Transaksi</th>
                        <th className="px-4 py-3 text-right">Omset</th>
                        <th className="px-4 py-3 text-right">Estimasi Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {topProducts.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-855/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-200 max-w-[200px] truncate" title={p.name}>
                            {p.name}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400 font-semibold">{p.count}x</td>
                          <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 font-medium">{formatRupiah(p.revenue)}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-black">{formatRupiah(p.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Quick Insights Widget */}
            <Card className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden flex flex-col justify-between">
              <CardHeader className="border-b border-slate-100 dark:border-slate-855 pb-4">
                <CardTitle className="text-base font-bold text-slate-850 dark:text-white flex items-center gap-2">
                  🔔 Insights Cerdas & Audit Alarms
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 flex-1 flex flex-col gap-3 justify-center">
                {insights.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2.5 border transition-all ${
                      item.type === 'warning' 
                        ? 'bg-rose-500/5 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-400' 
                        : item.type === 'success' 
                        ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-455'
                        : 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 text-blue-700 dark:text-blue-450'
                    }`}
                  >
                    <span className="mt-0.5">{item.type === 'warning' ? '⚠️' : item.type === 'success' ? '✨' : 'ℹ️'}</span>
                    <p className="leading-relaxed">{item.text.replace(/^[⚠️✨✅📈💡]+ /, '')}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>
          
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                setLedger([])
                addToast('Data dikosongkan. Siap unggah kembali.', 'info')
              }}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 border border-rose-100 dark:border-rose-955 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-4 py-2.5 rounded-xl transition-all duration-200"
            >
              Reset Data & Upload Ulang
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
