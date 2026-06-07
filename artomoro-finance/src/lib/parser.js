// Helpers
function findColumn(headers, aliases) {
  for (const alias of aliases) {
    const found = headers.find(h => h && h.toString().trim().toLowerCase() === alias.toLowerCase());
    if (found) return found;
  }
  return null;
}

function parseAmount(val) {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  
  let str = String(val).trim();
  if (!str || str === '-') return 0;

  // Handle parentheses for negative numbers e.g. (1.500) -> -1.500
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  // Remove currency symbols and whitespace
  str = str.replace(/Rp\.?\s*/gi, '').replace(/IDR\s*/gi, '').replace(/\s/g, '');

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    const dotIdx = str.indexOf('.');
    const commaIdx = str.indexOf(',');
    if (dotIdx < commaIdx) {
      // Dot is thousands, comma is decimal (Indonesian: 1.234,56)
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Comma is thousands, dot is decimal (English: 1,234.56)
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Only commas exist. Is it a decimal or thousands separator?
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length === 2) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    // Only dots exist. Is it a decimal or thousands separator?
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 2) {
      // Decimal separator, keep it as is
    } else {
      str = str.replace(/\./g, '');
    }
  }

  let num = parseFloat(str);
  if (isNaN(num)) return 0;
  return isNegative ? -num : num;
}

// Calculate intersection duration in seconds between a session and a shift window
function calculateShiftOverlapSeconds(sessionStart, sessionEnd, shiftStartStr, shiftEndStr) {
  const year = sessionStart.getFullYear();
  const month = sessionStart.getMonth();
  const date = sessionStart.getDate();
  
  const [sH, sM] = shiftStartStr.split(':').map(Number);
  const [eH, eM] = shiftEndStr.split(':').map(Number);
  
  const shiftStart = new Date(year, month, date, sH, sM, 0, 0);
  const shiftEnd = new Date(year, month, date, eH, eM, 0, 0);
  
  const overlapStart = Math.max(sessionStart.getTime(), shiftStart.getTime());
  const overlapEnd = Math.min(sessionEnd.getTime(), shiftEnd.getTime());
  
  if (overlapEnd > overlapStart) {
    return (overlapEnd - overlapStart) / 1000;
  }
  return 0;
}

// ── Kolom Mapping ──
const ORDER_ALIASES = {
  orderId: ['No. Pesanan', 'Order ID', 'No Pesanan', 'OrderID', 'Nomor Pesanan'],
  status: ['Status Pesanan', 'Order Status', 'Status'],
  date: ['Waktu Pesanan Dibuat', 'Tanggal Pesanan', 'Tanggal Pembuatan', 'Waktu Dibuat', 'Waktu Pesanan'],
  productName: ['Nama Produk', 'Nama Variasi', 'Nama Produk / Variasi', 'Detail Produk', 'Nama Barang', 'Nama Produk/Variasi'],
  quantity: ['Jumlah', 'Quantity', 'Qty', 'Jumlah Produk', 'Pcs']
};

const INCOME_ALIASES = {
  orderId: ['No. Pesanan', 'Order ID', 'No Pesanan', 'OrderID', 'Nomor Pesanan'],
  originalPrice: [
    'Harga Asli Produk', 
    'Harga Produk', 
    'Subtotal Pesanan', 
    'Total Pembayaran', 
    'Harga Awal', 
    'Total Harga Produk',
    'Subtotal',
    'Omset Kotor',
    'Omset'
  ],
  adminFee: ['Biaya Administrasi', 'Biaya Admin', 'Biaya Administrasi Shopee', 'Administrasi', 'Komisi Shopee'],
  serviceFee: ['Biaya Layanan', 'Biaya Layanan Shopee', 'Layanan'],
  sellerShipping: [
    'Ongkos Kirim Dibayar oleh Penjual', 
    'Ongkir Penjual', 
    'Ongkos Kirim', 
    'Ongkir Ditanggung Penjual',
    'Ongkos Kirim Ditanggung Penjual'
  ],
  adjustment: ['Jumlah Penyesuaian', 'Penyesuaian', 'Adjustment', 'Penyesuaian Saldo'],
  netIncome: ['Total Penghasilan', 'Dana Cair', 'Penghasilan', 'Net Income', 'Total Transfer', 'Penghasilan Bersih'],
};

export async function processFiles(file1, file2) {
  const XLSX = await import('xlsx');
  const readExcel = async (file, isIncomeFile = false) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          let sheetName = workbook.SheetNames[0];
          if (isIncomeFile) {
            // Find sheet named 'Income' (case-insensitive)
            const foundIncomeSheet = workbook.SheetNames.find(
              name => name.trim().toLowerCase() === 'income'
            );
            if (foundIncomeSheet) {
              sheetName = foundIncomeSheet;
            } else {
              // If not found, look for any sheet name containing "income" or "saldo"
              const matchSheet = workbook.SheetNames.find(
                name => name.trim().toLowerCase().includes('income') || 
                        name.trim().toLowerCase().includes('saldo')
              );
              if (matchSheet) sheetName = matchSheet;
            }
          }
          
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) {
            reject(new Error(`Sheet tidak ditemukan di file.`));
            return;
          }
          
          // Target headers we are searching for in order to find the starting row
          const targetHeaders = ['No. Pesanan', 'Order ID', 'No Pesanan', 'OrderID', 'Nomor Pesanan'];
          const rangeArray = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          let headerRowIndex = 0;
          for (let i = 0; i < rangeArray.length; i++) {
            const row = rangeArray[i];
            if (!Array.isArray(row)) continue;
            
            const isHeader = row.some(cell => {
              if (cell == null) return false;
              const cellStr = String(cell).trim().toLowerCase();
              return targetHeaders.some(target => target.toLowerCase() === cellStr);
            });
            if (isHeader) {
              headerRowIndex = i;
              break;
            }
          }
          
          // Now parse sheet starting from the header row index
          const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: '' });
          
          // Trim all object keys for normalization
          const normalizedRows = rows.map(row => {
            const trimmed = {};
            for (const [key, val] of Object.entries(row)) {
              trimmed[key.trim()] = val;
            }
            return trimmed;
          });
          
          resolve(normalizedRows);
        } catch (err) {
          reject(new Error(`Gagal membaca file Excel: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file.'));
      reader.readAsArrayBuffer(file);
    });
  };

  const [rawOrders, rawIncomes] = await Promise.all([
    readExcel(file1, false), 
    readExcel(file2, true)
  ]);

  if (!rawOrders.length || !rawIncomes.length) {
    throw new Error('Salah satu file kosong.');
  }

  // Parse Orders
  const orderHeaders = Object.keys(rawOrders[0]);
  const oCols = {};
  for (const [key, aliases] of Object.entries(ORDER_ALIASES)) {
    oCols[key] = findColumn(orderHeaders, aliases);
  }

  if (!oCols.orderId) throw new Error('Kolom No. Pesanan tidak ditemukan di File 1.');

  const orderMap = new Map();
  for (const row of rawOrders) {
    const orderId = String(row[oCols.orderId] || '').trim();
    if (!orderId) continue;
    
    // Strict filter: Status Pesanan = 'Selesai'
    if (oCols.status) {
      const status = String(row[oCols.status] || '').trim().toLowerCase();
      if (!['selesai', 'completed', 'sukses'].includes(status)) continue;
    }

    const productName = oCols.productName ? String(row[oCols.productName] || '').trim() : '';
    const date = oCols.date ? String(row[oCols.date] || '').trim() : '';
    const quantity = oCols.quantity ? parseInt(String(row[oCols.quantity]).replace(/[^0-9]/g, ''), 10) || 1 : 1;

    if (orderMap.has(orderId)) {
      const existing = orderMap.get(orderId);
      if (productName && !existing.productName.includes(productName)) {
        existing.productName += ' + ' + productName;
      }
      existing.quantity += quantity;
    } else {
      orderMap.set(orderId, { orderId, productName, date, quantity });
    }
  }

  // Parse Incomes
  const incomeHeaders = Object.keys(rawIncomes[0]);
  const iCols = {};
  for (const [key, aliases] of Object.entries(INCOME_ALIASES)) {
    iCols[key] = findColumn(incomeHeaders, aliases);
  }

  if (!iCols.orderId) throw new Error('Kolom No. Pesanan tidak ditemukan di File 2.');

  // INNER JOIN
  const ledger = [];
  for (const row of rawIncomes) {
    const orderId = String(row[iCols.orderId] || '').trim();
    if (!orderId || !orderMap.has(orderId)) continue; // INNER JOIN

    const orderData = orderMap.get(orderId);
    
    // Ekstrak nominal
    const originalPrice = parseAmount(row[iCols.originalPrice]);
    const adminFee = Math.abs(parseAmount(row[iCols.adminFee]));
    const serviceFee = Math.abs(parseAmount(row[iCols.serviceFee]));
    const sellerShipping = Math.abs(parseAmount(row[iCols.sellerShipping]));
    const adjustment = parseAmount(row[iCols.adjustment]);
    const netIncome = parseAmount(row[iCols.netIncome]);

    // Validation Logika Sistem: Harga Asli - (Admin + Layanan + Ongkir) + Penyesuaian = Total Penghasilan
    const calculatedNet = originalPrice - (adminFee + serviceFee + sellerShipping) + adjustment;

    ledger.push({
      orderId,
      date: orderData.date,
      productName: orderData.productName,
      quantity: orderData.quantity,
      originalPrice,
      adminFee,
      serviceFee,
      sellerShipping,
      adjustment,
      netIncome,
      calculatedNet
    });
  }

  if (ledger.length === 0) {
    throw new Error('Tidak ada data yang cocok (No. Pesanan) antara File 1 dan File 2.');
  }

  // Hapus referensi memori untuk Garbage Collection
  rawOrders.length = 0;
  rawIncomes.length = 0;
  orderMap.clear();

  return ledger;
}

// ── parsing CSV untuk Shopee Live (Absensi) ──
export async function parseLiveCsv(file) {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        if (!sheet) {
          reject(new Error('Sheet tidak ditemukan di file.'));
          return;
        }

        // Target headers to identify
        const startAliases = ['Start Time', 'Mulai Live', 'Waktu Mulai', 'Tanggal Mulai', 'Live Start', 'Waktu Live Mulai', 'Waktu Pembuatan'];
        const durationAliases = ['Duration', 'Durasi', 'Durasi Live', 'Live Duration', 'Waktu Live', 'Lama Live', 'Durasi Penyiaran'];

        // Find header row index by scanning for columns containing aliases
        const rangeArray = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        let headerRowIndex = 0;
        
        for (let i = 0; i < rangeArray.length; i++) {
          const row = rangeArray[i];
          if (!Array.isArray(row)) continue;
          
          let hasStart = false;
          let hasDuration = false;
          
          row.forEach(cell => {
            if (cell == null) return;
            const cellStr = String(cell).trim().toLowerCase();
            if (startAliases.some(alias => alias.toLowerCase() === cellStr)) {
              hasStart = true;
            }
            if (durationAliases.some(alias => alias.toLowerCase() === cellStr)) {
              hasDuration = true;
            }
          });
          
          if (hasStart && hasDuration) {
            headerRowIndex = i;
            break;
          }
        }

        const rows = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex, defval: '' });
        if (rows.length === 0) {
          reject(new Error('File CSV kosong atau tidak memiliki baris data.'));
          return;
        }

        // Normalize object keys (trim headers)
        const normalizedRows = rows.map(row => {
          const trimmed = {};
          for (const [key, val] of Object.entries(row)) {
            trimmed[key.trim()] = val;
          }
          return trimmed;
        });

        // Find column headers using aliases
        const getColumn = (aliases) => {
          const firstRow = normalizedRows[0];
          for (const alias of aliases) {
            const found = Object.keys(firstRow).find(k => k && k.toLowerCase() === alias.toLowerCase());
            if (found) return found;
          }
          return null;
        };

        const startCol = getColumn(startAliases);
        const durationCol = getColumn(durationAliases);

        if (!startCol) {
          reject(new Error('Kolom Start Time / Mulai Live tidak ditemukan di file.'));
          return;
        }
        if (!durationCol) {
          reject(new Error('Kolom Durasi tidak ditemukan di file.'));
          return;
        }

        // Helper to parse date e.g. "30-05-2026 15:17"
        const parseDateString = (val) => {
          if (val == null || val === '') return null;
          if (val instanceof Date) return val;
          if (typeof val === 'number') {
            const date = new Date((val - 25569) * 86400 * 1000);
            if (!isNaN(date.getTime())) return date;
          }
          const cleanStr = String(val).trim();
          
          // Match DD-MM-YYYY HH:mm:ss or DD/MM/YYYY HH:mm:ss
          const parts = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
          if (parts) {
            const day = parseInt(parts[1], 10);
            const month = parseInt(parts[2], 10) - 1;
            const year = parseInt(parts[3], 10);
            const hour = parts[4] ? parseInt(parts[4], 10) : 0;
            const minute = parts[5] ? parseInt(parts[5], 10) : 0;
            const second = parts[6] ? parseInt(parts[6], 10) : 0;
            return new Date(year, month, day, hour, minute, second);
          }

          // Match YYYY-MM-DD HH:mm:ss or YYYY-MM-DD HH:mm:ss
          const isoParts = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
          if (isoParts) {
            const year = parseInt(isoParts[1], 10);
            const month = parseInt(isoParts[2], 10) - 1;
            const day = parseInt(isoParts[3], 10);
            const hour = isoParts[4] ? parseInt(isoParts[4], 10) : 0;
            const minute = isoParts[5] ? parseInt(isoParts[5], 10) : 0;
            const second = isoParts[6] ? parseInt(isoParts[6], 10) : 0;
            return new Date(year, month, day, hour, minute, second);
          }

          let d = new Date(cleanStr);
          if (!isNaN(d.getTime())) return d;
          return null;
        };

        // Helper to parse duration "HH:MM:SS" to seconds
        const parseDurationToSeconds = (val) => {
          if (val == null || val === '') return 0;
          if (val instanceof Date) {
            const h = val.getHours();
            const m = val.getMinutes();
            const s = val.getSeconds();
            return h * 3600 + m * 60 + s;
          }
          if (typeof val === 'number') {
            if (val < 1) {
              return Math.round(val * 86400);
            }
            return val;
          }
          const cleanStr = String(val).trim();
          const parts = cleanStr.split(':');
          if (parts.length === 3) {
            return (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60 + (parseInt(parts[2], 10) || 0);
          } else if (parts.length === 2) {
            return (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60;
          }
          const num = parseFloat(cleanStr);
          return isNaN(num) ? 0 : num;
        };

        const records = [];

        normalizedRows.forEach(row => {
          const startTimeStr = row[startCol];
          const durationStr = row[durationCol];

          const startTime = parseDateString(startTimeStr);
          if (!startTime) return;

          const durationSeconds = parseDurationToSeconds(durationStr);
          const durationHours = durationSeconds / 3600;
          const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

          const hour = startTime.getHours();
          const overlapSeconds = calculateShiftOverlapSeconds(startTime, endTime, '08:00', '16:00');
          const overlapHours = overlapSeconds / 3600;

          const dateFormatted = startTime.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });

          const startFormatted = startTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
          const endFormatted = endTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

          const sessionInfo = {
            sessionId: Math.random().toString(36).substr(2, 9),
            date: dateFormatted,
            rawDate: startTime.toISOString(),
            startTimeStr: startFormatted,
            endTimeStr: endFormatted,
            durationHours: durationHours,
            durationStr: durationStr || formatDuration(durationSeconds),
            overlapSeconds: overlapSeconds,
            overlapHours: overlapHours
          };

          if (hour >= 8 && hour < 17) {
            // Shift Pagi: Adit (Host), Farhan (Admin)
            records.push({
              ...sessionInfo,
              name: 'Adit',
              position: 'Host'
            });
            records.push({
              ...sessionInfo,
              name: 'Farhan',
              position: 'Admin'
            });
          } else {
            // Shift Malam: Rhevalino (Host & Admin)
            records.push({
              ...sessionInfo,
              name: 'Rhevalino',
              position: 'Host & Admin'
            });
          }
        });

        // Sort records by date/time ascending
        records.sort((a, b) => new Date(a.rawDate) - new Date(b.rawDate));

        // Hapus referensi memori untuk Garbage Collection
        normalizedRows.length = 0;
        rows.length = 0;

        resolve(records);
      } catch (err) {
        reject(new Error(`Gagal membaca berkas live CSV: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
    reader.readAsArrayBuffer(file);
  });
}

// ── parsing CSV Laporan Pesanan untuk Bonus Shift ──
export async function parseLiveOrders(file) {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        if (!sheet) {
          reject(new Error('Sheet tidak ditemukan di file.'));
          return;
        }

        // Target aliases
        const timeAliases = [
          'Waktu Pembayaran Dilakukan',
          'Waktu Pembayaran',
          'Payment Time',
          'Waktu Pesanan Dibuat',
          'Tanggal Pesanan',
          'Order Creation Time',
          'Create Time',
          'Waktu Dibuat',
          'Waktu Pesanan'
        ];
        const qtyAliases = ['Jumlah', 'Quantity', 'Qty', 'Jumlah Produk', 'Pcs'];
        const statusAliases = ['Status Pesanan', 'Order Status', 'Status'];
        const cancelStatusAliases = [
          'Status Pembatalan/ Pengembalian',
          'Status Pembatalan/Pengembalian',
          'Status Pembatalan',
          'Status Pengembalian',
          'Cancellation/Return Status',
          'Return Status',
          'Cancellation Status'
        ];

        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (rows.length === 0) {
          reject(new Error('File kosong atau tidak memiliki baris data.'));
          return;
        }

        // Normalize object keys
        const normalizedRows = rows.map(row => {
          const trimmed = {};
          for (const [key, val] of Object.entries(row)) {
            trimmed[key.trim()] = val;
          }
          return trimmed;
        });

        const getColumn = (aliases) => {
          const firstRow = normalizedRows[0];
          for (const alias of aliases) {
            const found = Object.keys(firstRow).find(k => k && k.toLowerCase() === alias.toLowerCase());
            if (found) return found;
          }
          return null;
        };

        const timeCol = getColumn(timeAliases);
        const qtyCol = getColumn(qtyAliases);
        const statusCol = getColumn(statusAliases);
        const cancelStatusCol = getColumn(cancelStatusAliases);

        if (!timeCol) {
          reject(new Error('Kolom Waktu Pembayaran Dilakukan atau Waktu Pesanan Dibuat tidak ditemukan di file.'));
          return;
        }
        if (!qtyCol) {
          reject(new Error('Kolom Jumlah/Quantity tidak ditemukan di file.'));
          return;
        }
        
        // Helper to parse date
        const parseDateString = (str) => {
          if (!str) return null;
          const cleanStr = String(str).trim();
          let d = new Date(cleanStr);
          if (!isNaN(d.getTime())) return d;

          // Try custom YYYY-MM-DD HH:mm:ss or DD-MM-YYYY HH:mm:ss
          const parts = cleanStr.match(/^(\d{4}|\d{1,2})[-/](\d{1,2})[-/](\d{4}|\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
          if (parts) {
            let year, month, day;
            if (parts[1].length === 4) {
              year = parseInt(parts[1], 10);
              month = parseInt(parts[2], 10) - 1;
              day = parseInt(parts[3], 10);
            } else {
              day = parseInt(parts[1], 10);
              month = parseInt(parts[2], 10) - 1;
              year = parseInt(parts[3], 10);
            }
            const hour = parseInt(parts[4], 10);
            const minute = parseInt(parts[5], 10);
            const second = parts[6] ? parseInt(parts[6], 10) : 0;
            return new Date(year, month, day, hour, minute, second);
          }
          return null;
        };

        const parsedOrders = [];
        normalizedRows.forEach(row => {
          const dateObj = parseDateString(row[timeCol]);
          if (!dateObj) return;

          // Qty check
          let qty = parseInt(String(row[qtyCol]).replace(/[^0-9]/g, ''), 10);
          if (isNaN(qty)) qty = 0;

          // Status check
          const status = statusCol ? String(row[statusCol]).trim() : 'Selesai';
          const cancelStatus = cancelStatusCol ? String(row[cancelStatusCol]).trim() : '';

          parsedOrders.push({
            hour: dateObj.getHours(),
            timeStr: dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }),
            dateStr: dateObj.toLocaleDateString('en-CA'), // Standard YYYY-MM-DD
            qty: qty,
            status: status,
            cancelStatus: cancelStatus
          });
        });

        // Hapus referensi memori untuk Garbage Collection
        normalizedRows.length = 0;
        rows.length = 0;

        resolve(parsedOrders);
      } catch (err) {
        reject(new Error(`Gagal membaca berkas pesanan CSV: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas.'));
    reader.readAsArrayBuffer(file);
  });
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
