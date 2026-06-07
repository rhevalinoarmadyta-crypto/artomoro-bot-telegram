import React, { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import { TrendingUp, PieChart as PieIcon, Activity } from 'lucide-react'
import { useFinanceStore } from '../store/useFinanceStore'
import { formatRupiah } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-4 rounded-xl shadow-xl space-y-2 text-white">
        <p className="text-xs font-black text-slate-400">{label}</p>
        <div className="space-y-1.5">
          {payload.map((item, idx) => (
            <div key={idx} className="flex items-center gap-6 justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.stroke || item.color }} />
                {item.name}
              </span>
              <span className="font-mono font-black" style={{ color: item.stroke || item.color }}>
                {formatRupiah(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

export default function Analytics() {
  const { getMetrics, getCombinedLedger } = useFinanceStore()
  const excelLedger = useFinanceStore(state => state.ledger)
  const webhookOrders = useFinanceStore(state => state.webhookOrders)
  const ledger = useMemo(() => getCombinedLedger(), [excelLedger, webhookOrders, getCombinedLedger])
  const metrics = getMetrics()

  const dailyData = useMemo(() => {
    if (!ledger || !ledger.length) return []

    const acc = {}
    ledger.forEach(row => {
      const rawDate = row.date ? String(row.date).trim() : ''
      let d = rawDate.split(' ')[0] || 'Tanpa Tanggal'
      
      if (!acc[d]) {
        acc[d] = { date: d, omset: 0, profit: 0, count: 0 }
      }
      
      const { itemHpp, globalHpp, productHpp } = useFinanceStore.getState()
      const prodHpp = productHpp || {}
      const currentHpp = itemHpp[row.orderId] !== undefined 
        ? itemHpp[row.orderId] 
        : (prodHpp[row.productName] !== undefined ? prodHpp[row.productName] : globalHpp)
      
      acc[d].omset += row.originalPrice || 0
      acc[d].profit += ((row.netIncome || 0) - currentHpp)
      acc[d].count += 1
    })

    return Object.values(acc).sort((a, b) => {
      if (a.date === 'Tanpa Tanggal') return 1
      if (b.date === 'Tanpa Tanggal') return -1
      return new Date(a.date) - new Date(b.date)
    })
  }, [ledger])

  const feeData = useMemo(() => {
    return [
      { name: 'Biaya Admin', value: metrics.totalAdmin || 0, color: '#f43f5e' }, // rose-500
      { name: 'Biaya Layanan', value: metrics.totalService || 0, color: '#3b82f6' }, // blue-500
      { name: 'Ongkir Ditanggung', value: metrics.totalShipping || 0, color: '#f59e0b' } // amber-500
    ]
  }, [metrics])

  const totalFees = metrics.totalAdmin + metrics.totalService + metrics.totalShipping

  if (!ledger || ledger.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 animate-scale">
        <div className="p-5 bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-3xl text-slate-400 dark:text-slate-500 shadow-sm">
          <TrendingUp className="h-12 w-12 text-emerald-500 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Belum Ada Data Analisis</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm leading-relaxed">
            Unggah file Shopee Anda di halaman Dashboard untuk melihat diagram tren dan rincian potongan Shopee.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-scale">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Advanced Analytics Dashboard</h2>
        <p className="text-slate-500 mt-1 dark:text-slate-400 text-sm">Visualisasi performa penjualan, margin kontribusi, dan struktur biaya potongan marketplace.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Shopee Fee Breakdown Doughnut Card */}
        <Card className="lg:col-span-1 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-850 pb-4">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <PieIcon className="h-5 w-5 text-rose-500" /> Struktur Potongan Shopee
            </CardTitle>
          </CardHeader>
          <CardContent className="py-6 flex-1 flex flex-col justify-center items-center space-y-6">
            
            {/* Doughnut Chart Container */}
            <div className="relative w-full h-[180px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={feeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {feeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatRupiah(value)} contentStyle={{ display: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Total Potongan</span>
                <span className="text-lg font-black text-rose-500 font-mono mt-0.5">{formatRupiah(totalFees).replace(/Rp\s*/g, '')}</span>
              </div>
            </div>

            {/* List Details with Color-coded bars */}
            <div className="w-full space-y-3 px-2">
              {feeData.map((item, idx) => {
                const percent = totalFees > 0 ? (item.value / totalFees) * 100 : 0
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-semibold">
                      <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-350 font-bold">
                        {formatRupiah(item.value)} ({percent.toFixed(1)}%)
                      </span>
                    </div>
                    {/* Progress indicator */}
                    <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                )
              })}
            </div>

          </CardContent>
        </Card>

        {/* Tren Harian Area Chart Card */}
        <Card className="lg:col-span-2 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900 flex flex-col overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-850 pb-4">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" /> Tren Harian: Omset vs Laba Kotor
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    {/* Omset Gradient (Blue-sky theme) */}
                    <linearGradient id="colorOmset" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                    {/* Laba Kotor Gradient (Emerald theme) */}
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="#cbd5e1" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                    tickLine={false} 
                    axisLine={false} 
                    tickMargin={10} 
                  />
                  <YAxis 
                    tickFormatter={(val) => `Rp${(val/1000000).toFixed(1)}Jt`} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                    tickLine={false} 
                    axisLine={false} 
                    width={70}
                  />
                  
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingBottom: '10px' }}
                  />

                  {/* Omset Area */}
                  <Area 
                    type="monotone" 
                    name="Omset" 
                    dataKey="omset" 
                    stroke="#0284c7" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorOmset)" 
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  
                  {/* Laba Kotor Area */}
                  <Area 
                    type="monotone" 
                    name="Laba Kotor" 
                    dataKey="profit" 
                    stroke="#10b981" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorProfit)" 
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
