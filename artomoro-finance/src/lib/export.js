import { formatRupiah } from './utils'

export async function exportToExcel(metrics, ledger, operationalCosts) {
  const XLSX = await import('xlsx' /* webpackChunkName: "xlsx" */)
  // 1. Sheet Laporan Laba Rugi
  const plData = [
    ['LAPORAN LABA RUGI', ''],
    ['Periode', new Date().toLocaleDateString('id-ID')],
    ['', ''],
    ['PENDAPATAN', ''],
    ['Omset Kotor (Harga Asli Produk)', metrics.totalGross],
    ['', ''],
    ['BEBAN MARKETPLACE (SHOPEE)', ''],
    ['Biaya Administrasi', -metrics.totalAdmin],
    ['Biaya Layanan', -metrics.totalService],
    ['Ongkos Kirim Ditanggung Penjual', -metrics.totalShipping],
    ['Penyesuaian', metrics.totalAdjustment],
    ['Total Potongan Marketplace', -(metrics.totalAdmin + metrics.totalService + metrics.totalShipping - metrics.totalAdjustment)],
    ['', ''],
    ['DANA CAIR DITERIMA', metrics.totalNetIncome],
    ['', ''],
    ['HARGA POKOK PENJUALAN (HPP)', ''],
    ['Total HPP Terjual', -metrics.totalHpp],
    ['', ''],
    ['LABA KOTOR', metrics.grossProfit],
    ['', ''],
    ['BIAYA OPERASIONAL', '']
  ]

  // Sisipkan Gaji & Bonus Karyawan Otomatis jika ada
  if (metrics.totalTimSalaryAndBonus > 0) {
    plData.push(['Gaji & Bonus Karyawan (Otomatis)', -metrics.totalTimSalaryAndBonus])
  }

  operationalCosts.forEach(cost => {
    plData.push([cost.name, -cost.amount])
  })
  
  plData.push(['Total Biaya Operasional', -metrics.totalCombinedOpCost])
  plData.push(['', ''])
  plData.push(['LABA BERSIH', metrics.netProfit])

  const wsPL = XLSX.utils.aoa_to_sheet(plData)
  
  // Lebar kolom
  wsPL['!cols'] = [{ wch: 45 }, { wch: 20 }]

  // 2. Sheet Detail Mutasi
  const ledgerData = ledger.map(r => ({
    'No. Pesanan': r.orderId,
    'Tanggal': r.date,
    'Nama Produk': r.productName,
    'Harga Asli': r.originalPrice,
    'Biaya Admin': r.adminFee,
    'Biaya Layanan': r.serviceFee,
    'Ongkir Penjual': r.sellerShipping,
    'Penyesuaian': r.adjustment,
    'Total Penghasilan (Dana Cair)': r.netIncome
  }))
  const wsLedger = XLSX.utils.json_to_sheet(ledgerData)

  // 3. Sheet Log Operasional
  const opData = operationalCosts.map(c => ({
    'Nama Biaya': c.name,
    'Nominal': c.amount
  }))
  const wsOp = XLSX.utils.json_to_sheet(opData)

  // Build Workbook
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsPL, 'Laporan Laba Rugi')
  XLSX.utils.book_append_sheet(wb, wsLedger, 'Detail Mutasi Transaksi')
  XLSX.utils.book_append_sheet(wb, wsOp, 'Log Operasional')

  // Export
  XLSX.writeFile(wb, `Laporan_Keuangan_Artomoro_${new Date().getTime()}.xlsx`)
}
