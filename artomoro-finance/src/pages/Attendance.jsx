import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Upload, AlertCircle, CheckCircle2, FileSpreadsheet, Users, Download, Receipt, Clock, Calendar, Coins, Trash2, Plus, CalendarDays, Edit3, Save } from 'lucide-react'
import { useFinanceStore } from '../store/useFinanceStore'
import { parseLiveCsv, parseLiveOrders } from '../lib/parser'
import { calculateSalesBonus } from '../lib/bonusCalculator'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatRupiah, formatTerbilang, getFormattedDateTimeIndo } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'

// Date range helper for employee specific records
const getEmployeeDateRange = (empRecords) => {
  if (!empRecords || empRecords.length === 0) return ''
  const dates = empRecords
    .map(r => r.rawDate ? new Date(r.rawDate) : null)
    .filter(Boolean)
    .filter(d => !isNaN(d.getTime()))
  if (dates.length === 0) return ''
  const minDate = new Date(Math.min(...dates))
  const maxDate = new Date(Math.max(...dates))
  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })
  }
  return `${formatDate(minDate)} - ${formatDate(maxDate)}`
}

const AttendanceRow = React.memo(({ row, realIndex, onPrintSlip, rowHeight }) => {
  return (
    <tr 
      className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors border-b border-slate-100 dark:border-slate-800/80"
      style={{ height: rowHeight }}
    >
      <td className="px-6 py-3 text-center text-slate-400 font-bold text-xs">{realIndex}</td>
      <td className="px-6 py-3 font-bold text-slate-700 dark:text-slate-200">
        <div className="flex flex-col">
          <span>{row.name}</span>
          {row.isSubstituted && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded w-max mt-0.5 ${
              row.isAbsent 
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-450' 
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-450'
            }`}>
              {row.isAbsent ? `Absent (Diganti ${row.substitute})` : `Substituted (Ganti ${row.replaced})`}
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-3 text-slate-500 dark:text-slate-400 font-medium">{row.date}</td>
      <td className="px-6 py-3 text-slate-500 dark:text-slate-400 font-medium">{row.startTimeStr}</td>
      <td className="px-6 py-3 text-slate-500 dark:text-slate-400 font-medium">{row.endTimeStr}</td>
      <td className="px-6 py-3 text-slate-700 dark:text-slate-350 font-bold">{row.durationStr}</td>
      <td className="px-6 py-3 text-slate-500 dark:text-slate-450">
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800/80">
          {row.position}
        </span>
      </td>
      <td className="px-6 py-3 text-center">
        {row.isAbsent ? (
          <span className="text-xs font-semibold text-rose-500 italic">No Slip (Absent)</span>
        ) : (
          <button
            onClick={() => onPrintSlip(row.name)}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-emerald-500 px-2 py-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-emerald-100 dark:hover:border-emerald-900/30"
            title={`Cetak Slip Gaji ${row.name}`}
          >
            <Receipt className="h-4 w-4 text-emerald-500" />
            <span>Slip</span>
          </button>
        )}
      </td>
    </tr>
  )
})

export default function Attendance() {
  const {
    liveAttendance,
    setLiveAttendance,
    liveOrders,
    setLiveOrders,
    getSalaryMetrics,
    addToast,
    shifts,
    updateShiftConfig,
    getProcessedAttendance,
    shiftSubstitutions,
    addShiftSubstitution,
    removeShiftSubstitution
  } = useFinanceStore()
  const processedAttendance = useMemo(() => getProcessedAttendance(), [getProcessedAttendance, liveAttendance, shiftSubstitutions])
  const salaryMetrics = getSalaryMetrics()

  // Tabs state: 'portal' | 'shopee' | 'bonusan'
  const [activeTab, setActiveTab] = useState('portal')

  // Local state for editing shifts
  const [editShifts, setEditShifts] = useState(shifts || []);

  useEffect(() => {
    if (shifts) {
      setEditShifts(shifts);
    }
  }, [shifts]);

  const handleShiftChange = (id, field, value) => {
    setEditShifts(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSaveShifts = () => {
    editShifts.forEach(s => {
      updateShiftConfig(s.id, s);
    });
    addToast('✅ Konfigurasi shift berhasil disimpan!', 'success');
  };

  // Calculate shift metrics for dashboard
  const { shiftMetrics } = useMemo(() => {
    return calculateSalesBonus(liveOrders, shifts || [], shiftSubstitutions);
  }, [liveOrders, shifts, shiftSubstitutions]);

  // Portal logs state (from localStorage)
  const [portalLogs, setPortalLogs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('artomoro_attendance_logs')) || []
    } catch {
      return []
    }
  })

  // Date Filters state
  const [dateFilter, setDateFilter] = useState('hari-ini') // 'hari-ini' | 'minggu-ini' | 'bulan-ini' | 'kustom'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Manual Log Entry modal/form state
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualName, setManualName] = useState('Adit')
  const [manualAction, setManualAction] = useState('Clock In')
  const [manualDate, setManualDate] = useState('')
  const [manualTime, setManualTime] = useState('')

  // Manual Override / Ganti Shift state
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideDate, setOverrideDate] = useState('')
  const [overrideAbsentEmp, setOverrideAbsentEmp] = useState('Farhan')
  const [overrideSubEmp, setOverrideSubEmp] = useState('Adit')
  const [overridePos, setOverridePos] = useState('Admin')
  const [overrideShiftId, setOverrideShiftId] = useState('pagi')
  const [overrideStart, setOverrideStart] = useState('08:00')
  const [overrideEnd, setOverrideEnd] = useState('16:00')

  const handleShiftSelect = (shiftId) => {
    setOverrideShiftId(shiftId)
    const selectedShift = (shifts || []).find(s => s.id === shiftId)
    if (selectedShift) {
      setOverrideStart(selectedShift.start)
      setOverrideEnd(selectedShift.end)
    }
  }

  const handleSaveOverride = (e) => {
    e.preventDefault()
    if (!overrideDate || !overrideStart || !overrideEnd) {
      addToast('❌ Mohon lengkapi semua field input.', 'error')
      return
    }
    if (overrideAbsentEmp === overrideSubEmp) {
      addToast('❌ Karyawan pengganti tidak boleh sama dengan karyawan yang berhalangan.', 'error')
      return
    }

    addShiftSubstitution({
      date: overrideDate,
      absentEmployee: overrideAbsentEmp,
      substituteEmployee: overrideSubEmp,
      position: overridePos,
      shiftId: overrideShiftId,
      start: overrideStart,
      end: overrideEnd
    })

    addToast(`✅ Pergantian shift berhasil disimpan: ${overrideAbsentEmp} ➡️ ${overrideSubEmp}`, 'success')
  }

  const [liveFile, setLiveFile] = useState(null)
  const [orderFile, setOrderFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedName, setSelectedName] = useState('Semua Tim')

  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef(null)
  const [clientHeight, setClientHeight] = useState(500)

  const rowHeight = 52
  const buffer = 300

  // Reload logs whenever tab changes to stay synced
  useEffect(() => {
    if (activeTab === 'portal') {
      try {
        const stored = JSON.parse(localStorage.getItem('artomoro_attendance_logs')) || []
        setPortalLogs(stored)
      } catch {}
    }
  }, [activeTab])

  // Filter portal logs by date
  const filteredPortalLogs = useMemo(() => {
    const today = new Date()

    return portalLogs.filter(log => {
      const logDate = new Date(log.timestamp)

      if (dateFilter === 'hari-ini') {
        return logDate.toDateString() === today.toDateString()
      }

      if (dateFilter === 'minggu-ini') {
        // Current calendar week (Monday to Sunday)
        const dayOfWeek = today.getDay()
        const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        const monday = new Date(today)
        monday.setDate(today.getDate() + distanceToMonday)
        monday.setHours(0, 0, 0, 0)
        
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 7) // up to end of week
        
        return logDate >= monday && logDate < sunday
      }

      if (dateFilter === 'bulan-ini') {
        return logDate.getMonth() === today.getMonth() && logDate.getFullYear() === today.getFullYear()
      }

      if (dateFilter === 'kustom') {
        let match = true
        if (startDate) {
          const start = new Date(startDate)
          start.setHours(0, 0, 0, 0)
          match = match && logDate >= start
        }
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          match = match && logDate <= end
        }
        return match
      }

      return true
    })
  }, [portalLogs, dateFilter, startDate, endDate])

  // Portal Logs Statistics
  const portalStats = useMemo(() => {
    const aditIns = filteredPortalLogs.filter(l => l.name === 'Adit' && l.action === 'Clock In').length
    const aditOuts = filteredPortalLogs.filter(l => l.name === 'Adit' && l.action === 'Clock Out').length
    const farhanIns = filteredPortalLogs.filter(l => l.name === 'Farhan' && l.action === 'Clock In').length
    const farhanOuts = filteredPortalLogs.filter(l => l.name === 'Farhan' && l.action === 'Clock Out').length

    return {
      aditIns,
      aditOuts,
      farhanIns,
      farhanOuts,
      total: filteredPortalLogs.length
    }
  }, [filteredPortalLogs])

  // Add Manual Log Correction
  const handleAddManualLog = (e) => {
    e.preventDefault()
    if (!manualDate || !manualTime) {
      addToast('❌ Mohon isi tanggal dan waktu log koreksi.', 'error')
      return
    }

    const timestamp = new Date(`${manualDate}T${manualTime}`).toISOString()
    const newEntry = {
      name: manualName,
      action: manualAction,
      timestamp
    }

    const updated = [newEntry, ...portalLogs]
    // Sort logs by timestamp descending (newest first)
    updated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

    setPortalLogs(updated)
    localStorage.setItem('artomoro_attendance_logs', JSON.stringify(updated))
    addToast(`✅ Koreksi log berhasil ditambahkan untuk ${manualName}`, 'success')
    
    // Reset inputs
    setManualDate('')
    setManualTime('')
    setShowManualModal(false)
  }

  // Delete Log Entry
  const handleDeleteLog = (timestampToDelete, name) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus log absensi ${name} ini?`)) {
      const updated = portalLogs.filter(l => l.timestamp !== timestampToDelete)
      setPortalLogs(updated)
      localStorage.setItem('artomoro_attendance_logs', JSON.stringify(updated))
      addToast('🗑️ Log absensi berhasil dihapus.', 'success')
    }
  }

  // Export Portal Logs to Excel
  const handleExportPortalExcel = () => {
    if (filteredPortalLogs.length === 0) {
      addToast('⚠️ Tidak ada data log untuk diekspor.', 'error')
      return
    }
    addToast('📥 Excel log portal sedang diunduh...', 'info')

    setTimeout(() => {
      try {
        let html = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <!--[if gte mso 9]>
            <xml>
              <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                  <x:ExcelWorksheet>
                    <x:Name>Log Portal Absensi</x:Name>
                    <x:WorksheetOptions>
                      <x:DisplayGridlines/>
                    </x:WorksheetOptions>
                  </x:ExcelWorksheet>
                </x:ExcelWorksheets>
              </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
              table { border-collapse: collapse; }
              th { background-color: #f1f5f9; font-weight: bold; border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
              td { border: 1px solid #cbd5e1; padding: 8px; }
              .late-row { background-color: #fee2e2; color: #991b1b; } /* Soft red background */
              .badge-in { color: #16a34a; font-weight: bold; }
              .badge-out { color: #dc2626; font-weight: bold; }
              .text-center { text-align: center; }
              .bold { font-weight: bold; }
            </style>
          </head>
          <body>
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Karyawan</th>
                  <th>Tipe Absen</th>
                  <th>Hari & Tanggal</th>
                  <th>Jam Log</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
        `

        filteredPortalLogs.forEach((log, idx) => {
          const logDate = new Date(log.timestamp)
          const dateStr = logDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          const timeStr = logDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
          
          const isClockIn = log.action === 'Clock In'
          const hours = logDate.getHours()
          const minutes = logDate.getMinutes()
          const isLate = isClockIn && (log.name === 'Adit' || log.name === 'Farhan') && ((hours > 7) || (hours === 7 && minutes >= 55))
          
          const rowClass = isLate ? 'class="late-row"' : ''
          const statusText = isLate ? 'TERLAMBAT (>= 07:55)' : (isClockIn ? 'TEPAT WAKTU' : 'LOG KELUAR')

          html += `
            <tr ${rowClass}>
              <td class="text-center">${idx + 1}</td>
              <td class="bold">${log.name}</td>
              <td><span class="${isClockIn ? 'badge-in' : 'badge-out'}">${isClockIn ? 'Absen Datang' : 'Absen Pulang'}</span></td>
              <td>${dateStr}</td>
              <td class="bold">${timeStr}</td>
              <td class="bold">${statusText}</td>
            </tr>
          `
        })

        html += `
              </tbody>
            </table>
          </body>
          </html>
        `

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Log_Absensi_Portal_${Date.now()}.xls`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        addToast('✅ Excel Log Portal dengan tanda merah berhasil diunduh', 'success')
      } catch (err) {
        addToast('❌ Gagal mengekspor Excel', 'error')
      }
    }, 300)
  }

  // Filter Shopee Live records
  const filteredAttendance = useMemo(() => {
    if (!processedAttendance) return []
    if (selectedName === 'Semua Tim') return processedAttendance
    return processedAttendance.filter(r => r.name === selectedName)
  }, [processedAttendance, selectedName])

  // Virtualization math calculations
  const { visibleRows, paddingTop, paddingBottom, totalHeight } = useMemo(() => {
    const totalCount = filteredAttendance.length
    const tHeight = totalCount * rowHeight
    
    const startIdx = Math.max(0, Math.floor((scrollTop - buffer) / rowHeight))
    const endIdx = Math.min(totalCount - 1, Math.floor((scrollTop + clientHeight + buffer) / rowHeight))
    
    const slice = filteredAttendance.slice(startIdx, endIdx + 1)
    const pTop = startIdx * rowHeight
    const pBottom = Math.max(0, tHeight - pTop - (slice.length * rowHeight))
    
    return {
      visibleRows: slice,
      paddingTop: pTop,
      paddingBottom: pBottom,
      totalHeight: tHeight
    }
  }, [filteredAttendance, scrollTop, clientHeight])

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop)
  }

  // Update client size
  useEffect(() => {
    if (containerRef.current) {
      setClientHeight(containerRef.current.clientHeight)
      
      const handleResize = () => {
        if (containerRef.current) {
          setClientHeight(containerRef.current.clientHeight)
        }
      }
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [processedAttendance])

  const handleProcess = () => {
    if (!liveFile) {
      setError('Mohon pilih file CSV Shopee Live terlebih dahulu.')
      return
    }
    setLoading(true)
    setError('')

    setTimeout(async () => {
      try {
        const liveResult = await parseLiveCsv(liveFile)
        setLiveAttendance(liveResult)

        let orderCount = 0
        if (orderFile) {
          const orderResult = await parseLiveOrders(orderFile)
          setLiveOrders(orderResult)
          orderCount = orderResult.length
        } else {
          setLiveOrders([])
        }

        let msg = `✅ Berhasil memproses ${liveResult.length.toLocaleString('id-ID')} absensi live`
        if (orderFile) {
          msg += ` & ${orderCount.toLocaleString('id-ID')} transaksi untuk perhitungan bonus`
        }
        addToast(msg, 'success')
      } catch (err) {
        setError(err.message)
        addToast(`❌ Gagal: ${err.message}`, 'error')
      } finally {
        setLoading(false)
      }
    }, 150)
  }

  // Print slip for single employee
  const handlePrintSlip = useCallback((empKey) => {
    const metrics = salaryMetrics[empKey]
    if (!metrics) return
    const empRecords = processedAttendance.filter(r => r.name === empKey)
    const empDateRange = getEmployeeDateRange(empRecords)
    
    const isShiftPagi = empKey === 'Adit' || empKey === 'Farhan'
    let totalDeficitSeconds = 0
    
    if (isShiftPagi) {
      const uniqueDates = Array.from(new Set(empRecords.map(r => r.date)))
      uniqueDates.forEach(dateStr => {
        const isEmpAbsent = empRecords.some(r => r.date === dateStr && r.isAbsent)
        if (isEmpAbsent) return
        
        // Sum overlapSeconds of all non-absent sessions on this date for this employee
        const daySessions = empRecords.filter(r => r.date === dateStr && !r.isAbsent)
        const totalOverlapSeconds = daySessions.reduce((sum, r) => sum + (r.overlapSeconds || 0), 0)
        
        const targetSeconds = 7 * 3600 // 25200 seconds
        if (totalOverlapSeconds < targetSeconds) {
          totalDeficitSeconds += (targetSeconds - totalOverlapSeconds)
        }
      })
    }
    
    addToast(`📥 Menyiapkan Slip Gaji ${empKey}...`, 'info')
    
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
        
        // Slip Header Info
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.text('SLIP GAJI', 20, 58)
        
        // Meta Info (Right)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        const refNo = Date.now().toString().slice(-8)
        const empCode = empKey === 'Adit' ? 'AD' : empKey === 'Farhan' ? 'FA' : 'RV'
        
        doc.text('Tanggal', 135, 54)
        doc.text('No. Referensi', 135, 60)
        doc.text('Kode Karyawan', 135, 66)
        
        doc.setFont('helvetica', 'bold')
        doc.text(': ' + new Date().toLocaleDateString('id-ID'), 160, 54)
        doc.text(': REF-' + refNo, 160, 60)
        doc.text(': ' + empCode, 160, 66)
        
        doc.setLineWidth(0.6)
        doc.line(10, 72, 200, 72) // border-bottom slip header
        
        // Employee Info
        doc.setFont('helvetica', 'normal')
        doc.text('Nama', 20, 81)
        doc.text('Jabatan', 20, 87)
        doc.text(': ' + metrics.name.toUpperCase(), 35, 81)
        doc.text(': ' + metrics.role.toUpperCase(), 35, 87)
        
        doc.text('Alamat', 110, 81)
        doc.text('Telepon', 110, 87)
        doc.text(': Tangerang, Banten', 125, 81)
        doc.text(': 081241026368', 125, 87)
        
        doc.setLineWidth(0.6)
        doc.line(10, 93, 200, 93) // border-bottom employee-info
        
        // Salary Table Headers
        doc.setFont('helvetica', 'bold')
        doc.text('NO', 20, 100)
        doc.text('KETERANGAN', 40, 100)
        doc.text('JUMLAH', 185, 100, { align: 'right' })
        
        doc.setLineWidth(0.6)
        doc.line(10, 104, 200, 104) // border-bottom table headers
        
        // Table Rows (Dynamic Height Tracker)
        doc.setFont('helvetica', 'normal')
        let currentY = 112
        let rowNum = 1
        
        if (empKey === 'Rhevalino') {
          // Row 1: Gaji Pokok Host
          doc.text(String(rowNum++), 20, currentY)
          doc.text(`Gaji Pokok Host (Double) (${metrics.hours.toFixed(2)} Jam x Rp 23.000)`, 40, currentY)
          doc.text(formatRupiah(metrics.hours * 23000).replace(/Rp\s*/g, ''), 185, currentY, { align: 'right' })
          currentY += 8
          
          // Row 2: Gaji Pokok Admin
          doc.text(String(rowNum++), 20, currentY)
          doc.text(`Gaji Pokok Admin (Double) (${metrics.hours.toFixed(2)} Jam x Rp 17.000)`, 40, currentY)
          doc.text(formatRupiah(metrics.hours * 17000).replace(/Rp\s*/g, ''), 185, currentY, { align: 'right' })
          currentY += 8
          
          // Row 3: Bonus (Double Host + Admin)
          doc.text(String(rowNum++), 20, currentY)
          doc.text(`Bonus Penjualan Double (Host Rp 500 + Admin Rp 200) (${metrics.pcs.toLocaleString('id-ID')} Pcs x Rp 700)`, 40, currentY)
          doc.text(formatRupiah(metrics.bonus).replace(/Rp\s*/g, ''), 185, currentY, { align: 'right' })
          currentY += 8
        } else {
          // Row 1: Gaji Pokok
          doc.text(String(rowNum++), 20, currentY)
          const rate = empKey === 'Adit' ? 120000 : 91000
          doc.text(`Gaji Pokok (${metrics.days} Hari x ${formatRupiah(rate)})`, 40, currentY)
          doc.text(formatRupiah(metrics.baseSalary).replace(/Rp\s*/g, ''), 185, currentY, { align: 'right' })
          currentY += 8
          
          // Row 2: Bonus
          doc.text(String(rowNum++), 20, currentY)
          const bonusDesc = empKey === 'Adit' ? 'Host (Rp 500 / Pcs)' : 'Admin (Rp 200 / Pcs)'
          doc.text(`Bonus Penjualan ${bonusDesc} (${metrics.pcs.toLocaleString('id-ID')} Pcs x Rp ${metrics.bonusRate})`, 40, currentY)
          doc.text(formatRupiah(metrics.bonus).replace(/Rp\s*/g, ''), 185, currentY, { align: 'right' })
          currentY += 8
        }
        
        // Table Subtotal Line
        doc.setLineWidth(0.3)
        doc.line(20, currentY - 1, 190, currentY - 1)
        
        doc.setFont('helvetica', 'bold')
        doc.text(formatRupiah(metrics.salary).replace(/Rp\s*/g, ''), 185, currentY + 6, { align: 'right' })
        
        doc.setLineWidth(0.6)
        doc.line(10, currentY + 12, 200, currentY + 12) // border-bottom table / top slip-footer
        currentY += 12
        
        // Footer Total Box
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(9)
        doc.text('Terbilang : ' + formatTerbilang(metrics.salary), 20, currentY + 8)
        
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text('TOTAL DITERIMA', 110, currentY + 16)
        doc.text(formatRupiah(metrics.salary).replace(/Rp\s*/g, ''), 185, currentY + 16, { align: 'right' })
        
        doc.setLineWidth(0.6)
        doc.line(10, currentY + 22, 200, currentY + 22) // border-bottom slip-footer
        currentY += 22
        
        if (isShiftPagi && totalDeficitSeconds > 0) {
          const deficitSecsRounded = Math.round(totalDeficitSeconds)
          const X = Math.floor(deficitSecsRounded / 3600)
          const Y = Math.floor((deficitSecsRounded % 3600) / 60)
          const Z = deficitSecsRounded % 60
          
          const noteText = `Catatan Evaluasi: Jam tayang live Anda pada periode ini masih di bawah target yang ditentukan (Kurang ${X} jam ${Y} menit ${Z} detik). Yuk, tingkatkan lagi komitmen waktu dan kedisiplinannya di bulan depan!`
          
          const splitNote = doc.splitTextToSize(noteText, 160)
          const lineCount = splitNote.length
          const boxHeight = 8 + (lineCount * 5)
          
          doc.setDrawColor(225, 29, 72) // rose-600
          doc.setFillColor(255, 241, 242) // rose-50
          doc.setLineWidth(0.4)
          doc.rect(20, currentY + 4, 170, boxHeight, 'FD')
          
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8.5)
          doc.setTextColor(225, 29, 72)
          
          splitNote.forEach((line, lineIdx) => {
            doc.text(line, 25, currentY + 10 + (lineIdx * 5))
          })
          
          doc.setTextColor(0, 0, 0)
          currentY += boxHeight + 8
        }
        
        // Signatures
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`Tangerang, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 155, currentY + 6, { align: 'center' })
        
        doc.text('Disetujui Oleh,', 55, currentY + 13, { align: 'center' })
        doc.text('Mengetahui,', 155, currentY + 13, { align: 'center' })
        
        doc.setFont('helvetica', 'bold')
        doc.text('Rhevalino Armadyta Putra', 55, currentY + 44, { align: 'center' })
        doc.text('Dwi Astuti', 155, currentY + 44, { align: 'center' })
        
        doc.setFont('helvetica', 'normal')
        doc.text('Leader', 55, currentY + 49, { align: 'center' })
        doc.text('Owner', 155, currentY + 49, { align: 'center' })
        
        // Report time detail at bottom
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text('Waktu Cetak Slip: ' + getFormattedDateTimeIndo(), 105, 272, { align: 'center' })
        
        doc.save(`Slip_Gaji_${metrics.name}_${Date.now()}.pdf`)
        addToast(`✅ Slip Gaji ${metrics.name} berhasil diunduh`, 'success')
      } catch (err) {
        addToast(`❌ Gagal: ${err.message}`, 'error')
      }
    }, 500)
  }, [salaryMetrics, processedAttendance, addToast])

  // Print PDF slip gaji for all employees (Semua Tim) or selected employee
  const handlePrintAllSlips = () => {
    if (selectedName !== 'Semua Tim') {
      handlePrintSlip(selectedName)
      return
    }

    addToast('📥 Menyiapkan Slip Gaji Tim...', 'info')
    
    setTimeout(async () => {
      try {
        const { jsPDF } = await import('jspdf')
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        })
        
        const employees = ['Adit', 'Farhan', 'Rhevalino']
        
        employees.forEach((empKey, idx) => {
          if (idx > 0) {
            doc.addPage()
          }
          
          const metrics = salaryMetrics[empKey]
          const empRecords = processedAttendance.filter(r => r.name === empKey)
          const isShiftPagi = empKey === 'Adit' || empKey === 'Farhan'
          let totalDeficitSeconds = 0
          
          if (isShiftPagi) {
            const uniqueDates = Array.from(new Set(empRecords.map(r => r.date)))
            uniqueDates.forEach(dateStr => {
              const isEmpAbsent = empRecords.some(r => r.date === dateStr && r.isAbsent)
              if (isEmpAbsent) return
              
              // Sum overlapSeconds of all non-absent sessions on this date for this employee
              const daySessions = empRecords.filter(r => r.date === dateStr && !r.isAbsent)
              const totalOverlapSeconds = daySessions.reduce((sum, r) => sum + (r.overlapSeconds || 0), 0)
              
              const targetSeconds = 7 * 3600 // 25200 seconds
              if (totalOverlapSeconds < targetSeconds) {
                totalDeficitSeconds += (targetSeconds - totalOverlapSeconds)
              }
            })
          }
          
          // Draw A4 page border
          doc.setDrawColor(0, 0, 0)
          doc.setLineWidth(0.6)
          doc.rect(10, 10, 190, 277)
          
          // Draw Kop Surat (Header)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(22)
          doc.text('ARTOMORO GALLERY', 105, 30, { align: 'center' })
          
          doc.setLineWidth(0.6)
          doc.line(10, 45, 200, 45) // border-bottom logo area
          
          // Slip Header Info
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(16)
          doc.text('SLIP GAJI', 20, 58)
          
          // Meta Info (Right)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          const refNo = (Date.now() + idx).toString().slice(-8)
          const empCode = empKey === 'Adit' ? 'AD' : empKey === 'Farhan' ? 'FA' : 'RV'
          
          doc.text('Tanggal', 135, 54)
          doc.text('No. Referensi', 135, 60)
          doc.text('Kode Karyawan', 135, 66)
          
          doc.setFont('helvetica', 'bold')
          doc.text(': ' + new Date().toLocaleDateString('id-ID'), 160, 54)
          doc.text(': REF-' + refNo, 160, 60)
          doc.text(': ' + empCode, 160, 66)
          
          doc.setLineWidth(0.6)
          doc.line(10, 72, 200, 72) // border-bottom slip header
          
          // Employee Info
          doc.setFont('helvetica', 'normal')
          doc.text('Nama', 20, 81)
          doc.text('Jabatan', 20, 87)
          doc.text(': ' + metrics.name.toUpperCase(), 35, 81)
          doc.text(': ' + metrics.role.toUpperCase(), 35, 87)
          
          doc.text('Alamat', 110, 81)
          doc.text('Telepon', 110, 87)
          doc.text(': Tangerang, Banten', 125, 81)
          doc.text(': 081241026368', 125, 87)
          
          doc.setLineWidth(0.6)
          doc.line(10, 93, 200, 93) // border-bottom employee-info
          
          // Table Headers
          doc.setFont('helvetica', 'bold')
          doc.text('NO', 20, 100)
          doc.text('KETERANGAN', 40, 100)
          doc.text('JUMLAH', 185, 100, { align: 'right' })
          
          doc.setLineWidth(0.6)
          doc.line(10, 104, 200, 104) // border-bottom table headers
          
          // Table Rows (Dynamic Height Tracker)
          doc.setFont('helvetica', 'normal')
          let currentY = 112
          let rowNum = 1
          
          if (empKey === 'Rhevalino') {
            // Row 1: Gaji Pokok Host
            doc.text(String(rowNum++), 20, currentY)
            doc.text(`Gaji Pokok Host (Double) (${metrics.hours.toFixed(2)} Jam x Rp 23.000)`, 40, currentY)
            doc.text(formatRupiah(metrics.hours * 23000).replace(/Rp\s*/g, ''), 185, currentY, { align: 'right' })
            currentY += 8
            
            // Row 2: Gaji Pokok Admin
            doc.text(String(rowNum++), 20, currentY)
            doc.text(`Gaji Pokok Admin (Double) (${metrics.hours.toFixed(2)} Jam x Rp 17.000)`, 40, currentY)
            doc.text(formatRupiah(metrics.hours * 17000).replace(/Rp\s*/g, ''), 185, currentY, { align: 'right' })
            currentY += 8
            
            // Row 3: Bonus (Double Host + Admin)
            doc.text(String(rowNum++), 20, currentY)
            doc.text(`Bonus Penjualan Double (Host Rp 500 + Admin Rp 200) (${metrics.pcs.toLocaleString('id-ID')} Pcs x Rp 700)`, 40, currentY)
            doc.text(formatRupiah(metrics.bonus).replace(/Rp\s*/g, ''), 185, currentY, { align: 'right' })
            currentY += 8
          } else {
            // Row 1: Gaji Pokok
            doc.text(String(rowNum++), 20, currentY)
            const rate = empKey === 'Adit' ? 120000 : 91000
            doc.text(`Gaji Pokok (${metrics.days} Hari x ${formatRupiah(rate)})`, 40, currentY)
            doc.text(formatRupiah(metrics.baseSalary).replace(/Rp\s*/g, ''), 185, currentY, { align: 'right' })
            currentY += 8
            
            // Row 2: Bonus
            doc.text(String(rowNum++), 20, currentY)
            const bonusDesc = empKey === 'Adit' ? 'Host (Rp 500 / Pcs)' : 'Admin (Rp 200 / Pcs)'
            doc.text(`Bonus Penjualan ${bonusDesc} (${metrics.pcs.toLocaleString('id-ID')} Pcs x Rp ${metrics.bonusRate})`, 40, currentY)
            doc.text(formatRupiah(metrics.bonus).replace(/Rp\s*/g, ''), 185, currentY, { align: 'right' })
            currentY += 8
          }
          
          // Table Subtotal Line
          doc.setLineWidth(0.3)
          doc.line(20, currentY - 1, 190, currentY - 1)
          
          doc.setFont('helvetica', 'bold')
          doc.text(formatRupiah(metrics.salary).replace(/Rp\s*/g, ''), 185, currentY + 6, { align: 'right' })
          
          doc.setLineWidth(0.6)
          doc.line(10, currentY + 12, 200, currentY + 12) // border-bottom table / top slip-footer
          currentY += 12
          
          // Footer Total Box
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(9)
          doc.text('Terbilang : ' + formatTerbilang(metrics.salary), 20, currentY + 8)
          
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text('TOTAL DITERIMA', 110, currentY + 16)
          doc.text(formatRupiah(metrics.salary).replace(/Rp\s*/g, ''), 185, currentY + 16, { align: 'right' })
          
          doc.setLineWidth(0.6)
          doc.line(10, currentY + 22, 200, currentY + 22) // border-bottom slip-footer
          currentY += 22
          
          if (isShiftPagi && totalDeficitSeconds > 0) {
            const deficitSecsRounded = Math.round(totalDeficitSeconds)
            const X = Math.floor(deficitSecsRounded / 3600)
            const Y = Math.floor((deficitSecsRounded % 3600) / 60)
            const Z = deficitSecsRounded % 60
            
            const noteText = `Catatan Evaluasi: Jam tayang live Anda pada periode ini masih di bawah target yang ditentukan (Kurang ${X} jam ${Y} menit ${Z} detik). Yuk, tingkatkan lagi komitmen waktu dan kedisiplinannya di bulan depan!`
            
            const splitNote = doc.splitTextToSize(noteText, 160)
            const lineCount = splitNote.length
            const boxHeight = 8 + (lineCount * 5)
            
            doc.setDrawColor(225, 29, 72) // rose-600
            doc.setFillColor(255, 241, 242) // rose-50
            doc.setLineWidth(0.4)
            doc.rect(20, currentY + 4, 170, boxHeight, 'FD')
            
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8.5)
            doc.setTextColor(225, 29, 72)
            
            splitNote.forEach((line, lineIdx) => {
              doc.text(line, 25, currentY + 10 + (lineIdx * 5))
            })
            
            doc.setTextColor(0, 0, 0)
            currentY += boxHeight + 8
          }
          
          // Signatures
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(9)
          doc.text(`Tangerang, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 155, currentY + 6, { align: 'center' })
          
          doc.text('Disetujui Oleh,', 55, currentY + 13, { align: 'center' })
          doc.text('Mengetahui,', 155, currentY + 13, { align: 'center' })
          
          doc.setFont('helvetica', 'bold')
          doc.text('Rhevalino Armadyta Putra', 55, currentY + 44, { align: 'center' })
          doc.text('Dwi Astuti', 155, currentY + 44, { align: 'center' })
          
          doc.setFont('helvetica', 'normal')
          doc.text('Leader', 55, currentY + 49, { align: 'center' })
          doc.text('Owner', 155, currentY + 49, { align: 'center' })
          
          // Report time detail at bottom
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(8)
          doc.text('Waktu Cetak Slip: ' + getFormattedDateTimeIndo(), 105, 272, { align: 'center' })
        })
        
        doc.save(`Slip_Gaji_Semua_Tim_${Date.now()}.pdf`)
        addToast('✅ Slip Gaji Semua Tim berhasil diunduh', 'success')
      } catch (err) {
        addToast(`❌ Gagal: ${err.message}`, 'error')
      }
    }, 500)
  }

  const handleExportExcel = () => {
    if (!processedAttendance || processedAttendance.length === 0) return
    addToast('📥 Excel sedang diunduh...', 'info')
    
    setTimeout(async () => {
      try {
        const XLSX = await import('xlsx')
        const wb = XLSX.utils.book_new()
        
        const historyData = filteredAttendance.map((row, idx) => ({
          'No': idx + 1,
          'Nama Karyawan': row.name,
          'Tanggal': row.date,
          'Mulai Live': row.startTimeStr,
          'Selesai Live': row.endTimeStr,
          'Durasi (Jam)': Number(row.durationHours.toFixed(4)),
          'Durasi Asli': row.durationStr,
          'Posisi': row.position
        }))
        const wsHistory = XLSX.utils.json_to_sheet(historyData)
        XLSX.utils.book_append_sheet(wb, wsHistory, 'Riwayat Live')
        
        const salaryData = Object.values(salaryMetrics).map(item => ({
          'Nama Karyawan': item.name,
          'Posisi': item.role,
          'Total Hari Hadir': item.days,
          'Total Jam Kerja': Number(item.hours.toFixed(2)),
          'Gaji Pokok': item.baseSalary,
          'Pcs Terjual': item.pcs,
          'Bonus Penjualan': item.bonus,
          'Total Gaji Bersih (THP)': item.salary
        }))
        const wsSalary = XLSX.utils.json_to_sheet(salaryData)
        XLSX.utils.book_append_sheet(wb, wsSalary, 'Perhitungan Gaji')
        
        XLSX.writeFile(wb, `Rekap_Absensi_Gaji_${Date.now()}.xlsx`)
        addToast('✅ Excel Berhasil diunduh', 'success')
      } catch (err) {
        addToast('❌ Gagal mengunduh Excel', 'error')
      }
    }, 300)
  }

  const hasData = processedAttendance && processedAttendance.length > 0

  const activeMetrics = useMemo(() => {
    if (!hasData) return { days: 0, hours: 0, baseSalary: 0, bonus: 0, salary: 0, role: '' }
    
    if (selectedName === 'Semua Tim') {
      const allMetrics = Object.values(salaryMetrics)
      const totalDays = allMetrics.reduce((sum, item) => sum + item.days, 0)
      const totalHours = allMetrics.reduce((sum, item) => sum + item.hours, 0)
      const totalBase = allMetrics.reduce((sum, item) => sum + item.baseSalary, 0)
      const totalBonus = allMetrics.reduce((sum, item) => sum + item.bonus, 0)
      const totalSalary = allMetrics.reduce((sum, item) => sum + item.salary, 0)
      return { days: totalDays, hours: totalHours, baseSalary: totalBase, bonus: totalBonus, salary: totalSalary, role: 'Tim' }
    }
    
    return salaryMetrics[selectedName] || { days: 0, hours: 0, baseSalary: 0, bonus: 0, salary: 0, role: '' }
  }, [processedAttendance, selectedName, salaryMetrics, hasData])

  const formatLogDate = (isoString) => {
    const d = new Date(isoString)
    return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  const formatLogTime = (isoString) => {
    const d = new Date(isoString)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  }

  return (
    <div className="space-y-8 animate-scale pb-16">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">Absensi & Gaji Tim</h2>
          <p className="text-slate-500 mt-1 dark:text-slate-400 text-sm">
            Pantau kehadiran portal absensi mandiri karyawan atau kelola kalkulasi gaji berbasis Shopee Live.
          </p>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('portal')}
          className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'portal'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="h-4 w-4" /> Log Portal Absensi Mandiri
        </button>
        <button
          onClick={() => setActiveTab('shopee')}
          className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'shopee'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" /> Kalkulator Shopee Live (CSV)
        </button>
        <button
          onClick={() => setActiveTab('bonusan')}
          className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'bonusan'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Coins className="h-4 w-4" /> Laporan Bonusan (Shift)
        </button>
      </div>

      {/* ── TAB CONTENT ── */}
      {activeTab === 'portal' && (
        <div className="space-y-6">
          
          {/* Filters & Actions Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Periode:</span>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="hari-ini">Hari Ini</option>
                  <option value="minggu-ini">Minggu Ini</option>
                  <option value="bulan-ini">Bulan Ini</option>
                  <option value="kustom">Pilih Periode Hari</option>
                </select>
              </div>

              {dateFilter === 'kustom' && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col">
                    <input 
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <span className="text-slate-400 text-xs">s/d</span>
                  <div className="flex flex-col">
                    <input 
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => setShowManualModal(true)}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-slate-800 text-white font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-700 shadow-md shadow-slate-950/10 transition-colors"
              >
                <Plus className="h-4 w-4 text-emerald-400" /> Koreksi Log
              </button>
              <button
                onClick={handleExportPortalExcel}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-emerald-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-emerald-500 shadow-md shadow-emerald-500/10 transition-colors"
              >
                <Download className="h-4 w-4" /> Ekspor Excel
              </button>
            </div>
          </div>

          {/* Portal Stats cards */}
          <div className="grid gap-6 sm:grid-cols-4">
            <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900">
              <CardContent className="pt-6">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Adit Datang</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white">{portalStats.aditIns} Kali</div>
                <p className="text-[10px] text-slate-500 mt-1">Total absensi masuk</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900">
              <CardContent className="pt-6">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Adit Pulang</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white">{portalStats.aditOuts} Kali</div>
                <p className="text-[10px] text-slate-500 mt-1">Total absensi pulang</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900">
              <CardContent className="pt-6">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Farhan Datang</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white">{portalStats.farhanIns} Kali</div>
                <p className="text-[10px] text-slate-500 mt-1">Total absensi masuk</p>
              </CardContent>
            </Card>
            <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900">
              <CardContent className="pt-6">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Farhan Pulang</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white">{portalStats.farhanOuts} Kali</div>
                <p className="text-[10px] text-slate-500 mt-1">Total absensi pulang</p>
              </CardContent>
            </Card>
          </div>

          {/* Modal Koreksi Log Manual */}
          {showManualModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Tambah Log Koreksi Manual</h3>
                  <p className="text-slate-400 text-xs mt-1">Masukkan data koreksi untuk absensi portal.</p>
                </div>

                <form onSubmit={handleAddManualLog} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Karyawan</label>
                    <select
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                    >
                      <option value="Adit">Adit</option>
                      <option value="Farhan">Farhan</option>
                      <option value="Rhevalino">Rhevalino</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipe Absen</label>
                    <select
                      value={manualAction}
                      onChange={(e) => setManualAction(e.target.value)}
                      className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                    >
                      <option value="Clock In">Absen Datang</option>
                      <option value="Clock Out">Absen Pulang</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal</label>
                      <input
                        type="date"
                        required
                        value={manualDate}
                        onChange={(e) => setManualDate(e.target.value)}
                        className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jam</label>
                      <input
                        type="time"
                        required
                        value={manualTime}
                        onChange={(e) => setManualTime(e.target.value)}
                        className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowManualModal(false)}
                      className="flex-1 bg-slate-800 text-slate-300 font-bold text-sm py-2.5 rounded-xl hover:bg-slate-700 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 text-white font-bold text-sm py-2.5 rounded-xl hover:bg-emerald-500 transition-colors"
                    >
                      Simpan Log
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Logs table */}
          <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-850">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Daftar Riwayat Kehadiran Terfilter</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 uppercase font-bold text-xs border-b">
                  <tr>
                    <th className="px-6 py-3 text-center w-16">No</th>
                    <th className="px-6 py-3">Nama Karyawan</th>
                    <th className="px-6 py-3">Tipe Absen</th>
                    <th className="px-6 py-3">Hari & Tanggal</th>
                    <th className="px-6 py-3">Jam Log</th>
                    <th className="px-6 py-3 text-center w-28">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredPortalLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Tidak ada log absensi terdaftar untuk periode ini.
                      </td>
                    </tr>
                  ) : (
                    filteredPortalLogs.map((log, idx) => {
                      const isClockIn = log.action === 'Clock In'
                      const logDate = new Date(log.timestamp)
                      const hours = logDate.getHours()
                      const minutes = logDate.getMinutes()
                      const isLate = isClockIn && (log.name === 'Adit' || log.name === 'Farhan') && ((hours > 7) || (hours === 7 && minutes >= 55))

                      return (
                        <tr 
                          key={log.timestamp + idx} 
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors ${
                            isLate ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200' : ''
                          }`}
                        >
                          <td className="px-6 py-4 text-center text-slate-400 font-semibold">{idx + 1}</td>
                          <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{log.name}</td>
                          <td className="px-6 py-4 flex items-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              isClockIn 
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            }`}>
                              {isClockIn ? '🟢 Absen Datang' : '🔴 Absen Pulang'}
                            </span>
                            {isLate && (
                              <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white animate-pulse">
                                TERLAMBAT
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">{formatLogDate(log.timestamp)}</td>
                          <td className="px-6 py-4 text-slate-700 dark:text-slate-350 font-bold">{formatLogTime(log.timestamp)}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleDeleteLog(log.timestamp, log.name)}
                              className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 p-2 rounded-lg transition-colors border border-transparent"
                              title="Hapus Koreksi Log"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shopee' && (
        <div className="space-y-6">
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowOverrideModal(true)}
              className="flex items-center gap-2 bg-slate-800 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-slate-700 shadow-md shadow-slate-950/10 transition-colors border border-slate-750 dark:border-slate-800"
            >
              <Users className="h-4 w-4 text-emerald-400" /> Input Manual / Ganti Shift
            </button>
            {hasData && (
              <>
                <button 
                  onClick={handlePrintAllSlips}
                  className="flex items-center gap-2 bg-slate-800 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-slate-700 shadow-md shadow-slate-950/10 transition-colors"
                >
                  <Receipt className="h-4 w-4 text-emerald-400" /> Ekspor Slip Gaji (PDF)
                </button>
                <button 
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 bg-emerald-600 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-emerald-500 shadow-md shadow-emerald-500/10 transition-colors"
                >
                  <Download className="h-4 w-4" /> Rekap Excel
                </button>
              </>
            )}
          </div>

          {/* Modal Ganti Shift / Manual Override */}
          {showOverrideModal && (
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-4 text-white overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-emerald-400" /> Input Manual / Ganti Shift Karyawan
                    </h3>
                    <p className="text-slate-400 text-xs mt-1">Lakukan pergantian shift ad-hoc atau input jam kerja manual.</p>
                  </div>
                  <button
                    onClick={() => setShowOverrideModal(false)}
                    className="text-slate-400 hover:text-white transition-colors font-bold text-sm bg-slate-800 hover:bg-slate-755 px-2.5 py-1 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-1 flex-1">
                  {/* Left Column: Form */}
                  <form onSubmit={handleSaveOverride} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal</label>
                        <input
                          type="date"
                          required
                          value={overrideDate}
                          onChange={(e) => setOverrideDate(e.target.value)}
                          className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pilih Shift</label>
                        <select
                          value={overrideShiftId}
                          onChange={(e) => handleShiftSelect(e.target.value)}
                          className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                        >
                          {(shifts || []).map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.start}-{s.end})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Berhalangan Hadir</label>
                        <select
                          value={overrideAbsentEmp}
                          onChange={(e) => setOverrideAbsentEmp(e.target.value)}
                          className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                        >
                          <option value="Adit">Adit (Host)</option>
                          <option value="Farhan">Farhan (Admin)</option>
                          <option value="Rhevalino">Rhevalino (Leader)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Karyawan Pengganti</label>
                        <select
                          value={overrideSubEmp}
                          onChange={(e) => setOverrideSubEmp(e.target.value)}
                          className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                        >
                          <option value="Adit">Adit (Host)</option>
                          <option value="Farhan">Farhan (Admin)</option>
                          <option value="Rhevalino">Rhevalino (Leader)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1 col-span-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Posisi Pengganti</label>
                        <select
                          value={overridePos}
                          onChange={(e) => setOverridePos(e.target.value)}
                          className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                        >
                          <option value="Host">Host</option>
                          <option value="Admin">Admin</option>
                          <option value="Host & Admin">Host & Admin</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jam Mulai</label>
                        <input
                          type="text"
                          required
                          value={overrideStart}
                          onChange={(e) => setOverrideStart(e.target.value)}
                          placeholder="08:00"
                          className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jam Selesai</label>
                        <input
                          type="text"
                          required
                          value={overrideEnd}
                          onChange={(e) => setOverrideEnd(e.target.value)}
                          placeholder="16:00"
                          className="w-full border border-slate-800 bg-slate-950 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowOverrideModal(false)}
                        className="flex-1 bg-slate-800 text-slate-300 font-bold text-sm py-2.5 rounded-xl hover:bg-slate-700 transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-emerald-600 text-white font-bold text-sm py-2.5 rounded-xl hover:bg-emerald-500 transition-colors"
                      >
                        Simpan Pergantian
                      </button>
                    </div>
                  </form>

                  {/* Right Column: Active Overrides */}
                  <div className="space-y-3 flex flex-col h-full border-l border-slate-800/85 pl-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daftar Pergantian Aktif</span>
                      <span className="bg-slate-800 text-[10px] font-semibold text-emerald-400 px-2 py-0.5 rounded-full">
                        {(shiftSubstitutions || []).length} Data
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 max-h-[260px] pr-1">
                      {(!shiftSubstitutions || shiftSubstitutions.length === 0) ? (
                        <div className="text-center py-12 text-xs text-slate-500 italic">
                          Tidak ada pergantian shift aktif saat ini.
                        </div>
                      ) : (
                        shiftSubstitutions.map((sub) => {
                          const shiftObj = (shifts || []).find(s => s.id === sub.shiftId);
                          return (
                            <div key={sub.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-3 flex justify-between items-center text-xs animate-scale">
                              <div className="space-y-1">
                                <div className="font-bold text-emerald-400">{sub.date}</div>
                                <div className="text-slate-300">
                                  <span className="text-rose-400 font-medium">{sub.absentEmployee}</span> (Absent) ➡️ <span className="text-emerald-400 font-bold">{sub.substituteEmployee}</span>
                                </div>
                                <div className="text-slate-400 text-[10px] flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-slate-800 px-1.5 py-0.5 rounded text-white">{shiftObj?.name || sub.shiftId}</span>
                                  <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{sub.start} - {sub.end}</span>
                                  <span className="bg-slate-850 px-1.5 py-0.5 rounded text-emerald-500 font-semibold">{sub.position}</span>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Hapus pergantian shift pada ${sub.date} untuk ${sub.absentEmployee}?`)) {
                                    removeShiftSubstitution(sub.id);
                                    addToast('🗑️ Pergantian shift berhasil dihapus.', 'success');
                                  }
                                }}
                                className="text-rose-500 hover:text-rose-400 p-2 hover:bg-rose-950/20 rounded-lg transition-colors border border-transparent"
                                title="Hapus Pergantian Shift"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <Card className="border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl bg-white dark:bg-slate-900">
              <CardContent className="p-0">
                <div className="flex flex-col items-center justify-center py-20 px-8 space-y-6 text-center">
                  <div className="relative flex items-center justify-center">
                    <div className="h-20 w-20 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
                    <div className="absolute h-10 w-10 rounded-full bg-emerald-500/10 animate-ping"></div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Memproses Absensi & Bonus</h3>
                    <p className="text-slate-500 text-sm max-w-sm dark:text-slate-400">
                      Sedang membaca berkas, memetakan shift, dan menghitung bonus penjualan...
                    </p>
                  </div>
                  <div className="w-full max-w-xs bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-500 h-1.5 rounded-full w-full animate-pulse"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : !hasData ? (
            <Card className="border border-slate-200/85 dark:border-slate-800 rounded-2xl shadow-lg bg-white dark:bg-slate-900">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-5">
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-emerald-500" />
                  Unggah Laporan Shopee (Laporan Live & Transaksi Pesanan)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 p-8">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Dropzone 1: Live CSV */}
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-emerald-50/5 dark:hover:bg-emerald-950/5 transition-all duration-300">
                    <input
                      type="file"
                      id="live-file"
                      className="hidden"
                      accept=".csv"
                      onChange={(e) => {
                        setLiveFile(e.target.files[0])
                        addToast('File Shopee Live terpilih: ' + e.target.files[0].name, 'success')
                      }}
                    />
                    <label htmlFor="live-file" className="cursor-pointer flex flex-col items-center w-full">
                      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/80 mb-4 group-hover:scale-110 transition-all duration-350">
                        {liveFile ? (
                          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                        ) : (
                          <Upload className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                        )}
                      </div>
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                        {liveFile ? liveFile.name : 'Pilih File 1: CSV Shopee Live'}
                      </span>
                      <span className="text-xs text-slate-400 mt-1.5 max-w-[240px] leading-relaxed">
                        Wajib diunggah untuk mencatat jam mulai & durasi live absensi karyawan.
                      </span>
                    </label>
                  </div>

                  {/* Dropzone 2: Orders CSV */}
                  <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-emerald-50/5 dark:hover:bg-emerald-950/5 transition-all duration-300">
                    <input
                      type="file"
                      id="order-file"
                      className="hidden"
                      accept=".csv, .xlsx, .xls"
                      onChange={(e) => {
                        setOrderFile(e.target.files[0])
                        addToast('File Transaksi Pesanan terpilih: ' + e.target.files[0].name, 'success')
                      }}
                    />
                    <label htmlFor="order-file" className="cursor-pointer flex flex-col items-center w-full">
                      <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/80 mb-4 group-hover:scale-110 transition-all duration-350">
                        {orderFile ? (
                          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                        ) : (
                          <FileSpreadsheet className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                        )}
                      </div>
                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                        {orderFile ? orderFile.name : 'Pilih File 2: CSV Laporan Pesanan (Bonus)'}
                      </span>
                      <span className="text-xs text-slate-400 mt-1.5 max-w-[240px] leading-relaxed">
                        Opsional. Digunakan untuk menghitung bonus penjualan per pcs berdasarkan jam transaksi.
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
                    disabled={!liveFile || loading}
                    className="bg-emerald-600 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-md hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    Proses Absensi & Bonus Gaji
                  </button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Dropdown Filters */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Karyawan:</span>
                  <select
                    value={selectedName}
                    onChange={(e) => setSelectedName(e.target.value)}
                    className="border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Semua Tim">Semua Karyawan (Tim)</option>
                    <option value="Adit">Adit (Host Pagi)</option>
                    <option value="Farhan">Farhan (Admin Pagi)</option>
                    <option value="Rhevalino">Rhevalino (Leader Malam)</option>
                  </select>
                </div>
                
                <button
                  onClick={() => {
                    setLiveAttendance([])
                    setLiveOrders([])
                    addToast('Daftar absensi & transaksi bonus dikosongkan.', 'info')
                  }}
                  className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
                >
                  Reset Absensi
                </button>
              </div>

              {/* KPI Widget Cards */}
              <div className="grid gap-6 sm:grid-cols-4">
                <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900">
                  <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Hari Live</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {activeMetrics.days} Hari
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">Berdasarkan tanggal live unik</p>
                  </CardContent>
                </Card>

                <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900">
                  <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Durasi Live</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {activeMetrics.hours.toFixed(2)} Jam
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">Waktu siaran akumulatif</p>
                  </CardContent>
                </Card>

                <Card className="border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900">
                  <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
                    <Coins className="h-4 w-4 text-slate-400" />
                    <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gaji Pokok</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                      {formatRupiah(activeMetrics.baseSalary)}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      {selectedName === 'Semua Tim' ? 'Total Gaji Pokok' : `Sistem upah: ${activeMetrics.rateText}`}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border border-emerald-150 dark:border-emerald-950/80 rounded-2xl shadow-sm bg-emerald-50/20 dark:bg-emerald-950/10">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      {selectedName === 'Semua Tim' ? 'Gaji & Bonus Tim (Opex)' : 'Gaji Bersih (THP)'}
                    </CardTitle>
                    {selectedName !== 'Semua Tim' && (
                      <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full uppercase">
                        {activeMetrics.role}
                      </span>
                    )}
                  </CardHeader>
                  <CardContent className="flex justify-between items-end">
                    <div>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                        {formatRupiah(activeMetrics.salary)}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                        Termasuk Bonus: {formatRupiah(activeMetrics.bonus)}
                      </p>
                    </div>
                    {selectedName !== 'Semua Tim' && (
                      <button
                        onClick={() => handlePrintSlip(selectedName)}
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-850 text-white dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold px-3 py-2 rounded-xl shadow-md transition-colors"
                      >
                        <Receipt className="h-3.5 w-3.5 text-emerald-400" /> Cetak Slip
                      </button>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Rekap Tim Table */}
              {selectedName === 'Semua Tim' && (
                <Card className="border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-sm font-bold text-slate-800 dark:text-white">Rekapitulasi Gaji & Bonus Tim</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 uppercase font-bold text-xs border-b">
                        <tr>
                          <th className="px-6 py-3">Nama Karyawan</th>
                          <th className="px-6 py-3">Posisi/Role</th>
                          <th className="px-6 py-3 text-right">Hari Kerja</th>
                          <th className="px-6 py-3 text-right">Gaji Pokok</th>
                          <th className="px-6 py-3 text-right">Barang Terjual</th>
                          <th className="px-6 py-3 text-right">Bonus</th>
                          <th className="px-6 py-3 text-right font-black">Take Home Pay</th>
                          <th className="px-6 py-3 text-center">Cetak Slip Gaji</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {Object.entries(salaryMetrics).map(([key, item]) => (
                          <tr key={key} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{item.name}</td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-semibold">
                              {item.role}
                              {item.name === 'Rhevalino' && (
                                <span className="block text-[10px] text-slate-450 dark:text-slate-500 font-normal mt-0.5">
                                  (Gaji Host & Admin)
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-medium">{item.days} Hari</td>
                            <td className="px-6 py-4 text-right font-medium">{formatRupiah(item.baseSalary)}</td>
                            <td className="px-6 py-4 text-right font-medium">{item.pcs.toLocaleString('id-ID')} Pcs</td>
                            <td className="px-6 py-4 text-right text-rose-500 font-bold">+{formatRupiah(item.bonus)}</td>
                            <td className="px-6 py-4 text-right font-black text-emerald-600 dark:text-emerald-400">{formatRupiah(item.salary)}</td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => handlePrintSlip(key)}
                                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-emerald-500 px-3 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg transition-colors text-xs font-bold border border-transparent hover:border-emerald-100 dark:hover:border-emerald-900/30"
                                title={`Cetak Slip Gaji ${item.name}`}
                              >
                                <Receipt className="h-4 w-4 text-emerald-500" />
                                <span>Cetak Slip</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* Table history */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white tracking-tight">Riwayat Live & Absensi</h3>
                  <button
                    onClick={handlePrintAllSlips}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-md transition-colors"
                    title="Cetak Slip Gaji Semua Karyawan"
                  >
                    <Receipt className="h-3.5 w-3.5 text-emerald-400" /> Cetak Slip Gaji (PDF)
                  </button>
                </div>
                <div 
                  ref={containerRef}
                  onScroll={handleScroll}
                  className="overflow-auto border border-slate-200/80 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm"
                  style={{ height: '400px' }}
                >
                  <table className="w-full text-sm text-left table-fixed" style={{ minWidth: '800px' }}>
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 uppercase font-bold text-xs border-b sticky top-0 z-20">
                      <tr>
                        <th className="px-6 py-3 w-16 bg-slate-50 dark:bg-slate-900/90 text-center">#</th>
                        <th className="px-6 py-3 w-40 bg-slate-50 dark:bg-slate-900/90">Nama Karyawan</th>
                        <th className="px-6 py-3 w-32 bg-slate-50 dark:bg-slate-900/90">Tanggal</th>
                        <th className="px-6 py-3 w-32 bg-slate-50 dark:bg-slate-900/90">Mulai Live</th>
                        <th className="px-6 py-3 w-32 bg-slate-50 dark:bg-slate-900/90">Selesai Live</th>
                        <th className="px-6 py-3 w-32 bg-slate-50 dark:bg-slate-900/90">Total Durasi</th>
                        <th className="px-6 py-3 w-32 bg-slate-50 dark:bg-slate-900/90">Posisi</th>
                        <th className="px-6 py-3 w-28 bg-slate-50 dark:bg-slate-900/90 text-center">Slip Gaji</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paddingTop > 0 && (
                        <tr style={{ height: paddingTop }}>
                          <td colSpan={8} style={{ height: paddingTop, padding: 0 }} />
                        </tr>
                      )}
                      
                      {visibleRows.map((row, index) => {
                        const realIndex = Math.floor(paddingTop / rowHeight) + index + 1
                        return (
                          <AttendanceRow
                            key={row.sessionId}
                            row={row}
                            realIndex={realIndex}
                            onPrintSlip={handlePrintSlip}
                            rowHeight={rowHeight}
                          />
                        )
                      })}
                      
                      {paddingBottom > 0 && (
                        <tr style={{ height: paddingBottom }}>
                          <td colSpan={8} style={{ height: paddingBottom, padding: 0 }} />
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'bonusan' && (
        <div className="space-y-6">
          {/* Shift Configuration Editor Card */}
          <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 px-6 py-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-emerald-500" />
                  Pengaturan Jam & Tarif Shift (Host & Admin)
                </CardTitle>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Sesuaikan jam kerja, pembagian personil, dan tarif bonus penjualan per pcs.
                </p>
              </div>
              <button
                onClick={handleSaveShifts}
                className="flex items-center gap-2 bg-emerald-600 text-white font-bold text-sm px-4 py-2 rounded-xl hover:bg-emerald-500 shadow-sm transition-all active:scale-95"
              >
                <Save className="h-4 w-4" />
                Simpan Shift
              </button>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {editShifts.map((shift) => (
                  <div key={shift.id} className="border border-slate-100 dark:border-slate-800 p-4 rounded-xl bg-slate-50/55 dark:bg-slate-850/50 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-2">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{shift.name}</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase">ID: {shift.id}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Jam Mulai</label>
                        <input
                          type="text"
                          value={shift.start}
                          onChange={(e) => handleShiftChange(shift.id, 'start', e.target.value)}
                          placeholder="e.g. 08:00"
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Jam Selesai</label>
                        <input
                          type="text"
                          value={shift.end}
                          onChange={(e) => handleShiftChange(shift.id, 'end', e.target.value)}
                          placeholder="e.g. 16:00"
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-200/40 dark:border-slate-800/50 pt-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Host Ditugaskan</label>
                        <select
                          value={shift.hostEmployee}
                          onChange={(e) => handleShiftChange(shift.id, 'hostEmployee', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none"
                        >
                          <option value="Adit">Adit</option>
                          <option value="Farhan">Farhan</option>
                          <option value="Rhevalino">Rhevalino</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Admin Ditugaskan</label>
                        <select
                          value={shift.adminEmployee}
                          onChange={(e) => handleShiftChange(shift.id, 'adminEmployee', e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none"
                        >
                          <option value="Adit">Adit</option>
                          <option value="Farhan">Farhan</option>
                          <option value="Rhevalino">Rhevalino</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-slate-200/40 dark:border-slate-800/50 pt-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Tarif Host / Pcs</label>
                        <input
                          type="number"
                          value={shift.hostRate}
                          onChange={(e) => handleShiftChange(shift.id, 'hostRate', parseInt(e.target.value, 10) || 0)}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Tarif Admin / Pcs</label>
                        <input
                          type="number"
                          value={shift.adminRate}
                          onChange={(e) => handleShiftChange(shift.id, 'adminRate', parseInt(e.target.value, 10) || 0)}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Report Display Section */}
          {shiftMetrics.length > 0 ? (
            <div className="grid grid-cols-1 gap-6">
              {/* Visual Recharts Card */}
              <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl p-6">
                <CardTitle className="text-lg font-bold text-slate-800 dark:text-white mb-4">Grafik Bonusan & Penjualan per Shift</CardTitle>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={shiftMetrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} className="dark:hidden" />
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} className="hidden dark:block" />
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickFormatter={(tick) => {
                        try {
                          const parts = tick.split('-');
                          if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
                          return tick;
                        } catch {
                          return tick;
                        }
                      }} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                          border: 'none', 
                          borderRadius: '12px', 
                          color: '#f8fafc',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }} 
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="totalPcs" name="Total Pcs Terjual" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bonusHost" name="Total Bonus Host (Rp)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bonusAdmin" name="Total Bonus Admin (Rp)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Data Table Card */}
              <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-slate-800/80 px-6 py-4">
                  <CardTitle className="text-lg font-bold text-slate-800 dark:text-white">Rincian Bonus Penjualan per Shift</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 uppercase font-bold text-xs border-b">
                      <tr>
                        <th className="px-6 py-3">Tanggal</th>
                        <th className="px-6 py-3">Shift</th>
                        <th className="px-6 py-3 text-center">Total Pcs Valid</th>
                        <th className="px-6 py-3 text-right">Bonus Host</th>
                        <th className="px-6 py-3 text-right">Bonus Admin</th>
                        <th className="px-6 py-3 text-right">Total Gabungan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {shiftMetrics.map((row, idx) => {
                        const totalCombine = row.bonusHost + row.bonusAdmin;
                        let displayDate = row.date;
                        try {
                          const dateObj = new Date(row.date);
                          if (!isNaN(dateObj.getTime())) {
                            displayDate = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
                          }
                        } catch {}
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 transition-colors">
                            <td className="px-6 py-3.5 font-medium text-slate-700 dark:text-slate-300">{displayDate}</td>
                            <td className="px-6 py-3.5">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {row.shiftName}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-center font-bold text-slate-700 dark:text-slate-350">{row.totalPcs.toLocaleString('id-ID')} pcs</td>
                            <td className="px-6 py-3.5 text-right font-medium text-blue-600 dark:text-blue-400">+{formatRupiah(row.bonusHost)}</td>
                            <td className="px-6 py-3.5 text-right font-medium text-amber-600 dark:text-amber-500">+{formatRupiah(row.bonusAdmin)}</td>
                            <td className="px-6 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatRupiah(totalCombine)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-2xl p-12 text-center">
              <AlertCircle className="h-12 w-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Belum Ada Data Bonus Penjualan</h3>
              <p className="text-slate-500 dark:text-slate-500 text-sm mt-1 max-w-md mx-auto">
                Silakan unggah berkas CSV Laporan Pesanan terlebih dahulu di tab <strong>Kalkulator Shopee Live (CSV)</strong> untuk memproses dan melihat laporan bonusan.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
