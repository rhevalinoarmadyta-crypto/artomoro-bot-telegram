import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { calculateSalesBonus, isTimeInShift } from '../lib/bonusCalculator'

// Time parsing helper
function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

// Duration helper
function calculateDurationHours(start, end) {
  const startMin = parseTimeToMinutes(start);
  let endMin = parseTimeToMinutes(end);
  if (endMin === 0 && startMin > 0) {
    endMin = 1440;
  }
  let diff = endMin - startMin;
  if (diff < 0) {
    diff += 1440;
  }
  return diff / 60;
}

// Format duration to string
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Default position mapper
function getPositionForEmployee(name) {
  if (name === 'Adit') return 'Host';
  if (name === 'Farhan') return 'Admin';
  return 'Host & Admin';
}

export const useFinanceStore = create(
  persist(
    (set, get) => ({
      ledger: [],
      globalHpp: 0,
      itemHpp: {}, // { orderId: number }
      productHpp: {}, // { productName: number }
      operationalCosts: [], // { id, name, amount }
      toasts: [],
      liveAttendance: [], // Absensi Shopee Live
      liveOrders: [], // Transaksi Penjualan Shopee Live untuk Bonus
      
      // Default shift configurations (can be edited by user)
      shifts: [
        { id: 'pagi', name: 'Shift Pagi', start: '08:00', end: '16:00', hostEmployee: 'Adit', adminEmployee: 'Farhan', hostRate: 500, adminRate: 200 },
        { id: 'malam', name: 'Shift Malam', start: '16:00', end: '08:00', hostEmployee: 'Rhevalino', adminEmployee: 'Rhevalino', hostRate: 500, adminRate: 200 }
      ],

      // Shift substitutions/manual overrides
      shiftSubstitutions: [],

      // Inventory initial state
      inventoryItems: [
        { id: '1', sku: 'POLO-PDK', name: 'Polo Shirt Pendek', stock_good: 100, stock_rejected: 10 },
        { id: '2', sku: 'POLO-PNJ', name: 'Polo Shirt Panjang', stock_good: 120, stock_rejected: 5 },
        { id: '3', sku: 'CRG-PDK', name: 'Cargo Pendek', stock_good: 80, stock_rejected: 15 },
        { id: '4', sku: 'CRG-PNJ', name: 'Cargo Panjang', stock_good: 90, stock_rejected: 8 },
        { id: '5', sku: 'KMJ-KTN', name: 'Kemeja Katun', stock_good: 150, stock_rejected: 12 },
      ],
      inventoryLogs: [],
      isStockDeducted: false,
      productSkuMappings: {}, // Maps productName -> SKU string
      webhookOrders: [], // Orders received via Telegram Webhook SQLite database

      // Set Absensi Shopee Live
      setLiveAttendance: (data) => set({ liveAttendance: data }),
      // Set Transaksi Penjualan untuk Bonus
      setLiveOrders: (data) => set({ liveOrders: data }),
      // Update Shift Config
      updateShiftConfig: (shiftId, updatedFields) => set((state) => ({
        shifts: state.shifts.map(s => s.id === shiftId ? { ...s, ...updatedFields } : s)
      })),

      // Shift Substitution Actions
      addShiftSubstitution: (sub) => set((state) => ({
        shiftSubstitutions: [...state.shiftSubstitutions, { ...sub, id: Date.now().toString() }]
      })),

      removeShiftSubstitution: (id) => set((state) => ({
        shiftSubstitutions: state.shiftSubstitutions.filter(s => s.id !== id)
      })),

      outboundRejectedStock: (sku, qty, reason, notes, date) => {
        const { inventoryItems, inventoryLogs, addToast } = get()
        const item = inventoryItems.find(i => i.sku === sku)
        if (!item) {
          addToast('❌ SKU tidak ditemukan!', 'error')
          return false
        }
        if (qty > item.stock_rejected) {
          addToast('❌ Jumlah pengeluaran melebihi sisa reject!', 'error')
          return false
        }

        const updatedItems = inventoryItems.map(i => 
          i.sku === sku 
            ? { ...i, stock_rejected: i.stock_rejected - qty } 
            : i
        )

        const newLog = {
          id: Date.now().toString(),
          sku,
          type: 'OUT_REJECT',
          qty,
          reason,
          notes: notes || '',
          date: date || new Date().toISOString().split('T')[0]
        }

        set({
          inventoryItems: updatedItems,
          inventoryLogs: [newLog, ...inventoryLogs]
        })

        addToast(`✅ Berhasil mengeluarkan ${qty} pcs reject untuk SKU ${sku}`, 'success')
        return true
      },

  // Toast Actions
  addToast: (message, type = 'success') => {
    const id = Date.now().toString()
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
    }, 4000)
  },
  
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(t => t.id !== id)
  })),

  // Set data setelah upload
  setLedger: (data) => set({ 
    ledger: data, 
    itemHpp: {}, 
    operationalCosts: [], 
    isStockDeducted: false, 
    productSkuMappings: {},
    webhookOrders: []
  }),
  
  // Global SKU Mapping Actions
  setProductSkuMappings: (mappings) => set((state) => {
    const updatedLedger = state.ledger.map(row => ({
      ...row,
      sku: mappings[row.productName] || ''
    }))
    return {
      productSkuMappings: mappings,
      ledger: updatedLedger
    }
  }),

  // Telegram Webhook fetch action
  fetchWebhookOrders: async () => {
    try {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiUrl = isLocal 
        ? 'http://localhost:3000' 
        : 'https://light-bees-move.loca.lt';

      const response = await fetch(`${apiUrl}/api/manual-orders`, {
        headers: {
          'Bypass-Tunnel-Reminder': 'true'
        }
      });
      if (response.ok) {
        const data = await response.json();
        set({ webhookOrders: data });
      }
    } catch (error) {
      console.error('Failed to fetch manual orders from webhook server:', error);
    }
  },

  // Selector combining Excel ledger with Webhook orders
  getCombinedLedger: () => {
    const { ledger, webhookOrders } = get()
    const mappedWebhook = (webhookOrders || []).map(item => {
      const dateObj = new Date(item.created_at || Date.now())
      
      const day = String(dateObj.getDate()).padStart(2, '0')
      const month = String(dateObj.getMonth() + 1).padStart(2, '0')
      const year = dateObj.getFullYear()
      const dateFormatted = `${day}/${month}/${year}`

      // Format Time to HH:MM
      const hour = dateObj.getHours()
      const minute = String(dateObj.getMinutes()).padStart(2, '0')
      const second = String(dateObj.getSeconds()).padStart(2, '0')
      const timeFormatted = `${String(hour).padStart(2, '0')}:${minute}`

      const timeId = `T${String(hour).padStart(2, '0')}${minute}${second}`
      const orderId = `${(item.kode_akun || 'OFFLINE').toUpperCase()}-${timeId}`

      return {
        orderId,
        date: dateFormatted,
        productName: "MANUAL ORDER TELEGRAM",
        sku: item.kode_sku || '',
        quantity: 1,
        originalPrice: item.total_harga || 0,
        netIncome: item.total_harga || 0,
        adminFee: 0,
        serviceFee: 0,
        sellerShipping: 0,
        adjustment: 0,
        calculatedNet: item.total_harga || 0,
        isWebhookOrder: true,
        webhookId: item.id
      }
    })

    return [...ledger, ...mappedWebhook]
  },

  // Stock Auto-Deduction Logic
  applyStockDeduction: () => {
    const { getCombinedLedger, inventoryItems, inventoryLogs, isStockDeducted, addToast } = get()
    if (isStockDeducted) {
      addToast('⚠️ Stok untuk ledger ini sudah dikurangi/dideduksi!', 'error')
      return false
    }

    const ledger = getCombinedLedger()
    const mappedRows = ledger.filter(row => row.sku)
    if (mappedRows.length === 0) {
      addToast('❌ Tidak ada produk ter-mapping ke SKU untuk dipotong stoknya.', 'error')
      return false
    }

    // Accumulate total qty per SKU from ledger rows
    const skuQtyMap = {}
    mappedRows.forEach(row => {
      const qty = Number(row.quantity) || 1
      skuQtyMap[row.sku] = (skuQtyMap[row.sku] || 0) + qty
    })

    let updatedItems = [...inventoryItems]
    const newLogs = []
    const todayStr = new Date().toISOString().split('T')[0]

    for (const [sku, qty] of Object.entries(skuQtyMap)) {
      if (sku === 'Cargo Rejected') {
        // Special Routing Exception: deduct from stock_rejected of CRG-PDK
        const itemIndex = updatedItems.findIndex(i => i.sku === 'CRG-PDK')
        if (itemIndex === -1) {
          addToast(`❌ SKU CRG-PDK tidak ditemukan di persediaan untuk routing Cargo Rejected.`, 'error')
          return false
        }
        
        const currentItem = updatedItems[itemIndex]
        updatedItems[itemIndex] = {
          ...currentItem,
          stock_rejected: Math.max(0, currentItem.stock_rejected - qty)
        }

        newLogs.push({
          id: `deduct-${Date.now()}-cargo-rejected`,
          sku: 'CRG-PDK',
          type: 'TERJUAL_SHOPEE',
          qty,
          reason: 'Penjualan Otomatis via Shopee Ledger (Cargo Rejected)',
          notes: `Pemotongan otomatis dari stock_rejected milik SKU CRG-PDK (Rute Cargo Rejected).`,
          date: todayStr
        })
      } else {
        // Standard Deduction from stock_good
        const itemIndex = updatedItems.findIndex(i => i.sku === sku)
        if (itemIndex === -1) {
          addToast(`❌ SKU ${sku} tidak ditemukan di persediaan.`, 'error')
          return false
        }
        
        const currentItem = updatedItems[itemIndex]
        updatedItems[itemIndex] = {
          ...currentItem,
          stock_good: Math.max(0, currentItem.stock_good - qty)
        }

        newLogs.push({
          id: `deduct-${Date.now()}-${sku}-${Math.random().toString(36).substr(2, 4)}`,
          sku,
          type: 'TERJUAL_SHOPEE',
          qty,
          reason: 'Penjualan Otomatis via Shopee Ledger',
          notes: `Pemotongan otomatis dari data Ledger Shopee.`,
          date: todayStr
        })
      }
    }

    set({
      inventoryItems: updatedItems,
      inventoryLogs: [...newLogs, ...inventoryLogs],
      isStockDeducted: true
    })

    addToast(`✅ Berhasil memotong stok untuk ${Object.keys(skuQtyMap).length} SKU barang!`, 'success')
    return true
  },

  // Inbound / Bongkar Ball Action
  addInboundBall: (jenisBall, kategoriBall, totalIsi, totalRejected, skuRows) => {
    const { inventoryItems, inventoryLogs, addToast } = get()

    const totalAllocatedGood = skuRows.reduce((sum, r) => sum + (Number(r.goodQty) || 0), 0)
    const expectedGood = totalIsi - totalRejected

    if (totalAllocatedGood !== expectedGood) {
      addToast(`❌ Total alokasi barang bagus (${totalAllocatedGood} pcs) harus sama dengan hasil kalkulator (${expectedGood} pcs).`, 'error')
      return false
    }

    let updatedItems = [...inventoryItems]
    const newLogs = []
    const todayStr = new Date().toISOString().split('T')[0]

    skuRows.forEach((row, index) => {
      const sku = row.sku
      const goodQty = Number(row.goodQty) || 0
      const rejectQty = Number(row.rejectQty) || 0
      const totalQty = goodQty + rejectQty

      if (sku === 'Cargo Rejected') {
        // Special Inbound Routing: dilarang masuk stock_good, dialihkan ke stock_rejected milik SKU CRG-PDK
        const targetSku = 'CRG-PDK'
        const itemIndex = updatedItems.findIndex(i => i.sku === targetSku)
        if (itemIndex !== -1) {
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            stock_rejected: updatedItems[itemIndex].stock_rejected + totalQty
          }
        }
        
        newLogs.push({
          id: `inbound-log-${Date.now()}-cargo-rejected-${index}`,
          sku: targetSku,
          type: 'INBOUND_BALL',
          qty: totalQty,
          reason: `Bongkar Ball (Rute Cargo Rejected): ${jenisBall} (${kategoriBall})`,
          notes: `Dialihkan ke stock_rejected milik SKU CRG-PDK. Asal: Bagus = ${goodQty} pcs, Reject = ${rejectQty} pcs.`,
          date: todayStr
        })
      } else {
        // Standard Inbound logic
        const itemIndex = updatedItems.findIndex(i => i.sku === sku)
        if (itemIndex !== -1) {
          updatedItems[itemIndex] = {
            ...updatedItems[itemIndex],
            stock_good: updatedItems[itemIndex].stock_good + goodQty,
            stock_rejected: updatedItems[itemIndex].stock_rejected + rejectQty
          }
        } else {
          // Create dynamic SKU if not found
          updatedItems.push({
            id: `inbound-${Date.now()}-${index}`,
            sku,
            name: `Barang Baru SKU ${sku}`,
            stock_good: goodQty,
            stock_rejected: rejectQty
          })
        }

        newLogs.push({
          id: `inbound-log-${Date.now()}-${sku}-${index}`,
          sku,
          type: 'INBOUND_BALL',
          qty: totalQty,
          reason: `Bongkar Ball: ${jenisBall} (${kategoriBall})`,
          notes: `Alokasi Inbound Ball: Bagus = ${goodQty} pcs, Reject = ${rejectQty} pcs.`,
          date: todayStr
        })
      }
    })

    set({
      inventoryItems: updatedItems,
      inventoryLogs: [...newLogs, ...inventoryLogs]
    })

    addToast(`✅ Berhasil membongkar Ball: ${jenisBall}. Stok diperbarui!`, 'success')
    return true
  },

  // HPP Actions
  setGlobalHpp: (amount) => set({ globalHpp: amount }),
  setItemHpp: (orderId, amount) => set((state) => ({
    itemHpp: { ...state.itemHpp, [orderId]: amount }
  })),
  setProductHpp: (productName, amount) => set((state) => ({
    productHpp: { ...state.productHpp, [productName]: amount }
  })),
  setMultipleProductHpp: (mappings) => set((state) => ({
    productHpp: { ...state.productHpp, ...mappings }
  })),

  // Operational Costs Actions
  addOpCost: (cost) => set((state) => ({
    operationalCosts: [...state.operationalCosts, { ...cost, id: Date.now() }]
  })),
  removeOpCost: (id) => set((state) => ({
    operationalCosts: state.operationalCosts.filter(c => c.id !== id)
  })),
  updateOpCost: (id, amount) => set((state) => ({
    operationalCosts: state.operationalCosts.map(c => c.id === id ? { ...c, amount } : c)
  })),

  // Selectors / Getters (Kalkulasi realtime rekonsiliasi keuangan)
  getMetrics: () => {
    const { getCombinedLedger, globalHpp, itemHpp, productHpp, operationalCosts } = get()
    const ledger = getCombinedLedger()
    const prodHpp = productHpp || {}
    
    let totalGross = 0
    let totalNetIncome = 0
    let totalAdmin = 0
    let totalService = 0
    let totalShipping = 0
    let totalAdjustment = 0
    let totalHpp = 0

    if (ledger && ledger.length > 0) {
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
    }

    // Integrasikan Gaji & Bonus Tim dari modul Absensi secara otomatis
    const salaryMetrics = get().getSalaryMetrics()
    const totalTimSalaryAndBonus = Object.values(salaryMetrics).reduce((sum, item) => sum + item.salary, 0)

    const totalOpCost = operationalCosts.reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0)
    const totalCombinedOpCost = totalOpCost + totalTimSalaryAndBonus // gabungan manual + otomatis

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
      totalOpCost, // hanya manual
      totalTimSalaryAndBonus, // otomatis gaji & bonus tim
      totalCombinedOpCost, // gabungan opex
      grossProfit,
      netProfit,
      margin
    }
  },

  // Helper selector to get processed attendance applying shift substitutions/manual overrides
  getProcessedAttendance: () => {
    const { liveAttendance, shiftSubstitutions } = get()
    if (!liveAttendance) return []

    let processed = [...liveAttendance]

    // Apply shift substitutions
    ;(shiftSubstitutions || []).forEach(sub => {
      // sub.date is "YYYY-MM-DD"
      // We convert it to "DD/MM/YYYY" to match liveAttendance's locale format
      const [yr, mo, dy] = sub.date.split('-');
      const subDateStr = `${dy}/${mo}/${yr}`;

      let foundAuto = false;
      let autoDurationHours = 0;
      let autoDurationStr = '00:00:00';

      processed = processed.map(record => {
        // Match date and check if record's startTime is within the substitution hours
        if (record.date === subDateStr && isTimeInShift(record.startTimeStr, sub.start, sub.end)) {
          if (record.name === sub.absentEmployee) {
            foundAuto = true;
            autoDurationHours = record.durationHours || 0;
            autoDurationStr = record.durationStr || '00:00:00';

            // Mark absent employee's record as Substituted / Absent (hours set to 0)
            return {
              ...record,
              isSubstituted: true,
              isAbsent: true,
              substitute: sub.substituteEmployee,
              durationHours: 0,
              durationStr: '00:00:00'
            };
          } else if (record.name === sub.substituteEmployee) {
            // If substitute already has an auto record in this shift, update it with substituted flag
            return {
              ...record,
              isSubstituted: true,
              replaced: sub.absentEmployee,
              position: sub.position
            };
          }
        }
        return record;
      });

      // If there was an automatic record for the absent employee, clone it to transfer the hours to the substitute
      if (foundAuto) {
        // Only add if substitute doesn't already have a record in this slot
        const alreadyHasSubRecord = processed.some(r => 
          r.date === subDateStr && 
          r.name === sub.substituteEmployee && 
          isTimeInShift(r.startTimeStr, sub.start, sub.end)
        );
        if (!alreadyHasSubRecord) {
          const origRecord = liveAttendance.find(r => 
            r.date === subDateStr && 
            r.name === sub.absentEmployee && 
            isTimeInShift(r.startTimeStr, sub.start, sub.end)
          );
          processed.push({
            ...origRecord,
            sessionId: `sub-active-${sub.id}-${origRecord?.sessionId || Date.now()}`,
            name: sub.substituteEmployee,
            position: sub.position,
            isSubstituted: true,
            replaced: sub.absentEmployee,
            durationHours: autoDurationHours,
            durationStr: autoDurationStr
          });
        }
      } else {
        // If NO automatic records exist for this shift, create manual records:
        // 1. Absent record for the absent employee
        // 2. Active record for the substitute employee
        const durHours = calculateDurationHours(sub.start, sub.end);
        const durStr = formatDuration(durHours * 3600);
        const rawDateTime = new Date(sub.date).toISOString();

        // Check if absent employee record is already in processed
        const hasAbsentRecord = processed.some(r => 
          r.date === subDateStr && 
          r.name === sub.absentEmployee && 
          r.isAbsent &&
          r.startTimeStr === sub.start
        );
        if (!hasAbsentRecord) {
          processed.push({
            sessionId: `sub-absent-${sub.id}`,
            date: subDateStr,
            rawDate: rawDateTime,
            startTimeStr: sub.start,
            endTimeStr: sub.end,
            name: sub.absentEmployee,
            position: getPositionForEmployee(sub.absentEmployee),
            durationHours: 0,
            durationStr: '00:00:00',
            isSubstituted: true,
            isAbsent: true,
            substitute: sub.substituteEmployee
          });
        }

        // Check if substitute record is already in processed
        const hasSubstituteRecord = processed.some(r => 
          r.date === subDateStr && 
          r.name === sub.substituteEmployee && 
          r.startTimeStr === sub.start
        );
        if (!hasSubstituteRecord) {
          processed.push({
            sessionId: `sub-active-${sub.id}`,
            date: subDateStr,
            rawDate: rawDateTime,
            startTimeStr: sub.start,
            endTimeStr: sub.end,
            name: sub.substituteEmployee,
            position: sub.position,
            durationHours: durHours,
            durationStr: durStr,
            isSubstituted: true,
            replaced: sub.absentEmployee
          });
        }
      }
    });

    return processed.sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));
  },

  // Selektor kalkulasi gaji & bonus dinamis
  getSalaryMetrics: () => {
    const { getProcessedAttendance, liveOrders, webhookOrders, shifts, shiftSubstitutions } = get()
    const processedAttendance = getProcessedAttendance()
    
    const aditRecords = processedAttendance.filter(r => r.name === 'Adit')
    const farhanRecords = processedAttendance.filter(r => r.name === 'Farhan')
    const rhevalinoRecords = processedAttendance.filter(r => r.name === 'Rhevalino')

    // Hitung Hari Unik (excluding absent overrides)
    const aditDays = new Set(aditRecords.filter(r => !r.isAbsent).map(r => r.date)).size
    const farhanDays = new Set(farhanRecords.filter(r => !r.isAbsent).map(r => r.date)).size
    const rhevalinoDays = new Set(rhevalinoRecords.filter(r => !r.isAbsent).map(r => r.date)).size

    // Hitung Total Jam
    const aditHours = aditRecords.reduce((sum, r) => sum + (r.durationHours || 0), 0)
    const farhanHours = farhanRecords.reduce((sum, r) => sum + (r.durationHours || 0), 0)
    const rhevalinoHours = rhevalinoRecords.reduce((sum, r) => sum + (r.durationHours || 0), 0)

    // Formula Gaji Pokok
    const aditBase = aditDays * 120000 // Rp 120.000 / Hari (Host)
    const farhanBase = farhanDays * 91000 // Rp 91.000 / Hari (Admin)
    const rhevalinoBase = (rhevalinoHours * 23000) + (rhevalinoHours * 17000) // Rp 23.000 (Host) + Rp 17.000 (Admin) / Jam

    // Convert webhook orders to the structure required by calculateSalesBonus
    const webhookOrdersForBonus = (webhookOrders || []).map(item => {
      const dateObj = new Date(item.created_at || Date.now())
      const day = String(dateObj.getDate()).padStart(2, '0')
      const month = String(dateObj.getMonth() + 1).padStart(2, '0')
      const year = dateObj.getFullYear()
      
      return {
        hour: dateObj.getHours(),
        timeStr: `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`,
        dateStr: `${year}-${month}-${day}`, // YYYY-MM-DD
        qty: 1, // manual order counts as 1 pc
        status: 'Selesai',
        cancelStatus: ''
      }
    })

    const combinedOrders = [...(liveOrders || []), ...webhookOrdersForBonus]

    // Dynamic sales bonus using universal calculator
    const { employeeTotals } = calculateSalesBonus(combinedOrders, shifts, shiftSubstitutions)

    const aditBonus = employeeTotals['Adit']?.bonus || 0
    const farhanBonus = employeeTotals['Farhan']?.bonus || 0
    const rhevalinoBonus = employeeTotals['Rhevalino']?.bonus || 0

    const aditPcs = employeeTotals['Adit']?.pcs || 0
    const farhanPcs = employeeTotals['Farhan']?.pcs || 0
    const rhevalinoPcs = employeeTotals['Rhevalino']?.pcs || 0

    return {
      Adit: {
        name: 'Adit',
        role: 'Host',
        days: aditDays,
        hours: aditHours,
        rateText: 'Rp 120.000 / Hari',
        baseSalary: aditBase,
        bonus: aditBonus,
        pcs: aditPcs,
        bonusRate: shifts.find(s => s.id === 'pagi')?.hostRate || 500,
        bonusRateText: `Rp ${shifts.find(s => s.id === 'pagi')?.hostRate || 500} / Pcs (Host)`,
        salary: aditBase + aditBonus
      },
      Farhan: {
        name: 'Farhan',
        role: 'Admin',
        days: farhanDays,
        hours: farhanHours,
        rateText: 'Rp 91.000 / Hari',
        baseSalary: farhanBase,
        bonus: farhanBonus,
        pcs: farhanPcs,
        bonusRate: shifts.find(s => s.id === 'pagi')?.adminRate || 200,
        bonusRateText: `Rp ${shifts.find(s => s.id === 'pagi')?.adminRate || 200} / Pcs (Admin)`,
        salary: farhanBase + farhanBonus
      },
      Rhevalino: {
        name: 'Rhevalino',
        role: 'Host + Admin (Leader)',
        days: rhevalinoDays,
        hours: rhevalinoHours,
        rateText: 'Rp 23.000 (Host) + Rp 17.000 (Admin) / Jam',
        baseSalary: rhevalinoBase,
        bonus: rhevalinoBonus,
        pcs: rhevalinoPcs,
        bonusRate: (shifts.find(s => s.id === 'malam')?.hostRate || 500) + (shifts.find(s => s.id === 'malam')?.adminRate || 200),
        bonusRateText: `Rp ${(shifts.find(s => s.id === 'malam')?.hostRate || 500) + (shifts.find(s => s.id === 'malam')?.adminRate || 200)} / Pcs (Host + Admin)`,
        salary: rhevalinoBase + rhevalinoBonus
      }
    }
  }
  }),
  {
    name: 'artomoro_finance_storage',
    partialize: (state) => ({
      ledger: state.ledger,
      globalHpp: state.globalHpp,
      itemHpp: state.itemHpp,
      productHpp: state.productHpp,
      operationalCosts: state.operationalCosts,
      liveAttendance: state.liveAttendance,
      liveOrders: state.liveOrders,
      shifts: state.shifts,
      shiftSubstitutions: state.shiftSubstitutions,
      inventoryItems: state.inventoryItems,
      inventoryLogs: state.inventoryLogs,
      isStockDeducted: state.isStockDeducted,
      productSkuMappings: state.productSkuMappings,
      webhookOrders: state.webhookOrders
    }),
  }
))
