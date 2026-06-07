import React, { useState, useMemo } from 'react'
import { useFinanceStore } from '../store/useFinanceStore'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Activity, CheckCircle2, AlertTriangle, Target, Clock, User } from 'lucide-react'

export default function KinerjaLive() {
  const { getProcessedAttendance, liveAttendance, shiftSubstitutions } = useFinanceStore()
  const [activeEmployee, setActiveEmployee] = useState('Adit')

  // Memoize processed attendance
  const processedAttendance = useMemo(() => {
    return getProcessedAttendance()
  }, [getProcessedAttendance, liveAttendance, shiftSubstitutions])

  // 1. Group by date and calculate overlap metrics for the active Shift Pagi employee
  const performanceLogs = useMemo(() => {
    if (!processedAttendance || processedAttendance.length === 0) return []

    // Filter to get unique sessions for selected employee (Adit or Farhan)
    const employeeSessions = processedAttendance.filter(r => r.name === activeEmployee)

    const grouped = {}
    employeeSessions.forEach(session => {
      const dateStr = session.date
      if (!grouped[dateStr]) {
        grouped[dateStr] = {
          date: dateStr,
          totalOverlapSeconds: 0,
          isAbsent: false
        }
      }
      
      if (session.isAbsent) {
        grouped[dateStr].isAbsent = true
      } else {
        grouped[dateStr].totalOverlapSeconds += session.overlapSeconds || 0
      }
    })

    const targetSeconds = 7 * 3600 // 7 Jam
    return Object.values(grouped).map(group => {
      const totalOverlapSeconds = group.totalOverlapSeconds
      const totalHours = totalOverlapSeconds / 3600
      const achieved = totalOverlapSeconds >= targetSeconds

      const totalMinutesTotal = Math.round(totalOverlapSeconds / 60)
      const h = Math.floor(totalMinutesTotal / 60)
      const m = totalMinutesTotal % 60
      const durationFormattedStr = `${h} Jam ${m} Menit`

      // Defisit calculation
      const deficitSeconds = Math.max(0, targetSeconds - totalOverlapSeconds)
      const defH = Math.floor(deficitSeconds / 3600)
      const defM = Math.floor((deficitSeconds % 3600) / 60)
      const defS = Math.round(deficitSeconds % 60)
      const deficitFormattedStr = deficitSeconds > 0 ? `${defH} Jam ${defM} Menit ${defS} Detik` : '-'

      let note = ''
      if (group.isAbsent) {
        note = `Evaluasi Kedisiplinan: Pada tanggal ${group.date}, Anda berhalangan hadir (Absen / Ganti Shift).`
      } else if (!achieved) {
        note = `Evaluasi Kedisiplinan: Pada tanggal ${group.date}, total durasi live valid hanya mencapai ${durationFormattedStr} dari target 7 Jam. (Defisit: ${deficitFormattedStr}).`
      } else {
        note = `Kinerja luar biasa. Target durasi terpenuhi 100% (${durationFormattedStr}).`
      }

      return {
        date: group.date,
        durationSeconds: totalOverlapSeconds,
        durationStr: durationFormattedStr,
        achieved,
        isAbsent: group.isAbsent,
        deficitStr: deficitFormattedStr,
        deficitSeconds,
        note
      }
    }).sort((a, b) => {
      // Sort by date ascending (DD/MM/YYYY)
      const partsA = a.date.split('/')
      const partsB = b.date.split('/')
      return new Date(partsA[2], partsA[1] - 1, partsA[0]) - new Date(partsB[2], partsB[1] - 1, partsB[0])
    })
  }, [processedAttendance, activeEmployee])

  // 2. Statistics
  const stats = useMemo(() => {
    const totalDays = performanceLogs.length
    const achievedDays = performanceLogs.filter(log => log.achieved && !log.isAbsent).length
    const underTargetDays = performanceLogs.filter(log => !log.achieved && !log.isAbsent).length
    const absentDays = performanceLogs.filter(log => log.isAbsent).length

    // Cumulative deficit seconds
    const totalDeficitSeconds = performanceLogs.reduce((sum, log) => sum + (log.deficitSeconds || 0), 0)
    const defH = Math.floor(totalDeficitSeconds / 3600)
    const defM = Math.floor((totalDeficitSeconds % 3600) / 60)
    const defS = Math.round(totalDeficitSeconds % 60)
    const totalDeficitStr = totalDeficitSeconds > 0 ? `${defH}j ${defM}m ${defS}s` : '0j 0m 0s'

    return {
      totalDays,
      achievedDays,
      underTargetDays,
      absentDays,
      totalDeficitStr
    }
  }, [performanceLogs])

  if (!processedAttendance || processedAttendance.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4 animate-scale">
        <div className="p-5 bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 rounded-3xl text-slate-400 dark:text-slate-500 shadow-sm">
          <Activity className="h-12 w-12 text-emerald-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Belum Ada Data Kinerja Live</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm leading-relaxed">
            Unggah berkas Shopee Live CSV terlebih dahulu pada tab **Kalkulator Shopee Live (CSV)** di halaman **Absensi & Gaji**.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-scale">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Kinerja Live (Shift Pagi)</h2>
          <p className="text-slate-500 mt-1 dark:text-slate-400 text-sm">
            Evaluasi jam siaran langsung harian terhadap target kedisiplinan 7 jam per hari.
          </p>
        </div>

        {/* Employee Selector */}
        <div className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-950/40 p-1 rounded-xl w-fit border border-slate-200/50 dark:border-slate-800/80">
          <button
            onClick={() => setActiveEmployee('Adit')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeEmployee === 'Adit'
                ? 'bg-white dark:bg-slate-900 text-slate-855 dark:text-white shadow-sm border border-slate-250/10'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Adit (Host)
          </button>
          <button
            onClick={() => setActiveEmployee('Farhan')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeEmployee === 'Farhan'
                ? 'bg-white dark:bg-slate-900 text-slate-855 dark:text-white shadow-sm border border-slate-250/10'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Farhan (Admin)
          </button>
        </div>
      </div>

      {/* KPI Stats Widgets */}
      <div className="grid gap-6 sm:grid-cols-4">
        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-slate-400" /> Target Harian
            </div>
            <div className="text-2xl font-black text-slate-800 dark:text-white">7.00 Jam</div>
            <p className="text-[10px] text-slate-500 mt-1">Standar durasi minimal live</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-400" /> Total Hari Live
            </div>
            <div className="text-2xl font-black text-slate-800 dark:text-white">{stats.totalDays} Hari</div>
            <p className="text-[10px] text-slate-500 mt-1">Jumlah hari siaran aktif</p>
          </CardContent>
        </Card>

        <Card className="border border-emerald-100 dark:border-emerald-950/60 bg-emerald-50/10 dark:bg-emerald-950/10 shadow-sm rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Target Terpenuhi
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-450">{stats.achievedDays} Hari</div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Durasi live mencapai &gt;= 7 jam</p>
          </CardContent>
        </Card>

        <Card className="border border-rose-100 dark:border-rose-950 bg-rose-50/10 dark:bg-rose-950/10 shadow-sm rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-rose-600 dark:text-rose-455 text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-500" /> Total Defisit Waktu
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-450">{stats.totalDeficitStr}</div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Akumulasi kekurangan jam live</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance log table */}
      <Card className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-850 py-4 px-6">
          <CardTitle className="text-base font-bold text-slate-850 dark:text-white">Log Hasil Evaluasi Kedisiplinan ({activeEmployee})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 uppercase font-bold text-xs border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5 w-32">Tanggal</th>
                  <th className="px-6 py-3.5 w-40">Durasi Valid (Overlap)</th>
                  <th className="px-6 py-3.5 w-24">Target</th>
                  <th className="px-6 py-3.5 w-36">Defisit Waktu</th>
                  <th className="px-6 py-3.5 w-36">Status</th>
                  <th className="px-6 py-3.5">Catatan Evaluasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {performanceLogs.map((log) => {
                  const isUnder = !log.achieved && !log.isAbsent
                  return (
                    <tr 
                      key={log.date} 
                      className={`transition-colors ${
                        isUnder 
                          ? 'bg-rose-500/5 hover:bg-rose-500/10 dark:bg-rose-950/10 dark:hover:bg-rose-950/20' 
                          : 'hover:bg-slate-50/50 dark:hover:bg-slate-850/50'
                      }`}
                    >
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{log.date}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-300">
                        {log.isAbsent ? '-' : log.durationStr}
                      </td>
                      <td className="px-6 py-4 text-slate-450">7 Jam</td>
                      <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-350">
                        {log.isAbsent ? '-' : log.deficitSeconds > 0 ? (
                          <span className="text-rose-500 font-bold">{log.deficitStr}</span>
                        ) : (
                          <span className="text-emerald-500 font-bold">Terpenuhi</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {log.isAbsent ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-850 dark:text-slate-400">
                            ⚪ Absen / Ganti
                          </span>
                        ) : log.achieved ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-450">
                            ✅ Achieved
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-450 animate-pulse">
                            ❌ Under Target
                          </span>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-xs font-semibold ${isUnder ? 'text-rose-600 dark:text-rose-455' : 'text-slate-500 dark:text-slate-400'}`}>
                        {log.note}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
