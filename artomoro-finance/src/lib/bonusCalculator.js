/**
 * Helper to convert "HH:MM" time string to total minutes from midnight.
 * Supports strings like "14:30" or "02:15".
 */
export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Check if a given time falls within a shift start and end time.
 * Handles shifts that cross midnight (e.g. 16:00 - 08:00 next day).
 */
export function isTimeInShift(timeStr, startStr, endStr) {
  const current = timeToMinutes(timeStr);
  let start = timeToMinutes(startStr);
  let end = timeToMinutes(endStr);

  // If the end is 00:00 (midnight) and start is on the same day,
  // we treat end as 24:00 (1440 minutes) to keep start < end.
  if (end === 0 && start > 0) {
    end = 1440;
  }

  if (start < end) {
    // Standard shift (does NOT cross midnight, e.g. 08:00 - 16:00)
    return current >= start && current < end;
  } else {
    // Overnight shift (crosses midnight, e.g. 16:00 - 08:00 next day)
    return current >= start || current < end;
  }
}

/**
 * Universal calculation function for sales bonus.
 * 
 * @param {Array} orders - Array of order objects/rows from Excel/CSV.
 * @param {Array} shifts - Configurable shifts array.
 * @param {Array} substitutions - Shift overrides/substitutions list.
 * @returns {Object} { shiftMetrics, employeeTotals }
 */
export function calculateSalesBonus(orders, shifts, substitutions) {
  const shiftGroups = {};
  const employeeTotals = {};

  // Initialize employee totals based on configured shifts
  shifts.forEach(shift => {
    if (shift.hostEmployee) {
      employeeTotals[shift.hostEmployee] = employeeTotals[shift.hostEmployee] || {
        name: shift.hostEmployee,
        pcs: 0,
        bonus: 0
      };
    }
    if (shift.adminEmployee) {
      employeeTotals[shift.adminEmployee] = employeeTotals[shift.adminEmployee] || {
        name: shift.adminEmployee,
        pcs: 0,
        bonus: 0
      };
    }
  });

  if (!orders || orders.length === 0) {
    return { shiftMetrics: [], employeeTotals };
  }

  orders.forEach((order, index) => {
    // 1. FILTER PESANAN VALID
    // Order status must be "Selesai" or "Completed"
    const statusClean = (order.status || '').trim().toLowerCase();
    if (statusClean !== 'selesai' && statusClean !== 'completed') {
      return;
    }

    // 2. FILTER RETUR
    // If cancellation/return status contains "permintaan disetujui", ignore.
    const cancelClean = (order.cancelStatus || '').trim().toLowerCase();
    if (cancelClean.includes('permintaan disetujui')) {
      return;
    }

    // 3. PCS CALCULATION
    const qty = parseInt(order.qty, 10) || 0;
    if (qty <= 0) return;

    // 4. GROUPING BY SHIFT
    // Extract transaction time (standardize to HH:MM format)
    let orderTime = order.timeStr;
    if (!orderTime && order.hour !== undefined) {
      orderTime = `${String(order.hour).padStart(2, '0')}:00`;
    }
    if (!orderTime) {
      orderTime = '00:00';
    }

    // Find the matching shift based on the transaction time
    let matchedShift = null;
    for (const shift of shifts) {
      if (isTimeInShift(orderTime, shift.start, shift.end)) {
        matchedShift = shift;
        break;
      }
    }

    // If order falls outside any shift, ignore
    if (!matchedShift) return;

    // Determine target host & admin for this order
    let hostEmployee = matchedShift.hostEmployee;
    let adminEmployee = matchedShift.adminEmployee;

    // Apply substitution to role assignment for this specific order date and shift
    if (substitutions && substitutions.length > 0) {
      const activeSub = substitutions.find(s => 
        s.date === order.dateStr && 
        s.shiftId === matchedShift.id
      );

      if (activeSub) {
        // If the absent employee was the host, and the substitute position includes Host
        if (activeSub.absentEmployee === hostEmployee && (activeSub.position === 'Host' || activeSub.position === 'Host & Admin' || activeSub.position === 'Host + Admin (Leader)')) {
          hostEmployee = activeSub.substituteEmployee;
        }
        // If the absent employee was the admin, and the substitute position includes Admin
        if (activeSub.adminEmployee === adminEmployee || (activeSub.absentEmployee === adminEmployee && (activeSub.position === 'Admin' || activeSub.position === 'Host & Admin' || activeSub.position === 'Host + Admin (Leader)'))) {
          // If substitute position includes Admin, replace absent admin
          if (activeSub.absentEmployee === adminEmployee) {
            adminEmployee = activeSub.substituteEmployee;
          }
        }
      }
    }

    // 5. BONUS RATES
    const hostRate = matchedShift.hostRate !== undefined ? matchedShift.hostRate : 500;
    const adminRate = matchedShift.adminRate !== undefined ? matchedShift.adminRate : 200;

    const bonusHost = qty * hostRate;
    const bonusAdmin = qty * adminRate;

    // Grouping per shift per date (for charts/tables)
    const date = order.dateStr || 'Unknown';
    const groupKey = `${date}|${matchedShift.id}`;

    if (!shiftGroups[groupKey]) {
      shiftGroups[groupKey] = {
        date: date,
        shiftName: matchedShift.name,
        shiftId: matchedShift.id,
        totalPcs: 0,
        bonusHost: 0,
        bonusAdmin: 0
      };
    }

    shiftGroups[groupKey].totalPcs += qty;
    shiftGroups[groupKey].bonusHost += bonusHost;
    shiftGroups[groupKey].bonusAdmin += bonusAdmin;

    // Accumulate for employee payroll sync
    if (hostEmployee) {
      const emp = employeeTotals[hostEmployee] = employeeTotals[hostEmployee] || { name: hostEmployee, pcs: 0, bonus: 0 };
      emp.pcs += qty;
      emp.bonus += bonusHost;
    }
    if (adminEmployee) {
      const emp = employeeTotals[adminEmployee] = employeeTotals[adminEmployee] || { name: adminEmployee, pcs: 0, bonus: 0 };
      // Avoid double counting total pcs if same employee does both roles (e.g. Rhevalino)
      if (hostEmployee !== adminEmployee) {
        emp.pcs += qty;
      }
      emp.bonus += bonusAdmin;
    }
  });

  // Convert shiftGroups to array sorted by date and shift name
  const shiftMetrics = Object.values(shiftGroups).sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.shiftName.localeCompare(b.shiftName);
  });

  return {
    shiftMetrics,
    employeeTotals
  };
}
