/**
 * Contoh Backend Express.js untuk Dynamic CSV Upload, Kalkulasi Overlap Shift Pagi, 
 * dan Integrasi Pembuatan PDF Slip Gaji (menggunakan pdfkit)
 * 
 * Dependencies: npm install express multer xlsx pdfkit
 */

const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// 1. Fungsi Kalkulasi Irisan Waktu (Overlap)
// Menghitung overlap dalam detik antara sesi live dan shift operasional (08:00 - 16:00)
function calculateShiftOverlapSeconds(sessionStart, sessionEnd, shiftStartStr = '08:00', shiftEndStr = '16:00') {
  const year = sessionStart.getFullYear();
  const month = sessionStart.getMonth();
  const date = sessionStart.getDate();
  
  const [sH, sM] = shiftStartStr.split(':').map(Number);
  const [eH, eM] = shiftEndStr.split(':').map(Number);
  
  const shiftStart = new Date(year, month, date, sH, sM, 0, 0);
  const shiftEnd = new Date(year, month, date, eH, eM, 0, 0);
  
  // Ambil irisan waktu (Overlap)
  const overlapStart = Math.max(sessionStart.getTime(), shiftStart.getTime());
  const overlapEnd = Math.min(sessionEnd.getTime(), shiftEnd.getTime());
  
  if (overlapEnd > overlapStart) {
    return (overlapEnd - overlapStart) / 1000; // kembalikan dalam detik
  }
  return 0;
}

// Helper: Ubah durasi format HH:MM:SS ke Detik
function parseDurationToSeconds(str) {
  if (!str) return 0;
  const parts = String(str).trim().split(':');
  if (parts.length === 3) {
    return (parseInt(parts[0], 10) || 0) * 3600 + (parseInt(parts[1], 10) || 0) * 60 + (parseInt(parts[2], 10) || 0);
  } else if (parts.length === 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  return parseFloat(str) || 0;
}

// 2. Endpoint upload dinamis
app.post('/api/upload-live-csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File tidak ditemukan.' });
  }

  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ error: 'File CSV kosong.' });
    }

    // Pendeteksian kolom dinamis (Auto-detection)
    const firstRow = rows[0];
    let startCol = null;
    let durationCol = null;

    const startAliases = ['start time', 'mulai live', 'waktu mulai', 'tanggal mulai', 'live start', 'waktu pembuatan'];
    const durationAliases = ['duration', 'durasi', 'durasi live', 'live duration', 'lama live'];

    for (const key of Object.keys(firstRow)) {
      const cleanKey = key.trim().toLowerCase();
      if (startAliases.includes(cleanKey)) startCol = key;
      if (durationAliases.includes(cleanKey)) durationCol = key;
    }

    if (!startCol || !durationCol) {
      return res.status(400).json({ error: 'Kolom Start Time atau Durasi tidak terdeteksi di file CSV.' });
    }

    // Grouping durasi overlap berdasarkan tanggal
    const dailyOverlap = {};

    rows.forEach(row => {
      const startTimeStr = row[startCol];
      const durationStr = row[durationCol];
      if (!startTimeStr || !durationStr) return;

      const startTime = new Date(startTimeStr);
      if (isNaN(startTime.getTime())) return;

      const durationSeconds = parseDurationToSeconds(durationStr);
      const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

      // Hitung overlap dengan Shift Pagi (08:00 - 16:00)
      const overlapSeconds = calculateShiftOverlapSeconds(startTime, endTime, '08:00', '16:00');

      const dateStr = startTime.toLocaleDateString('id-ID'); // Format DD/MM/YYYY

      if (!dailyOverlap[dateStr]) {
        dailyOverlap[dateStr] = 0;
      }
      dailyOverlap[dateStr] += overlapSeconds;
    });

    // Kalkulasi total defisit waktu (Target: 7 jam per hari = 25200 detik)
    const TARGET_SECONDS = 7 * 3600;
    let totalDeficitSeconds = 0;
    const dailyDetails = [];

    for (const [date, overlapSecs] of Object.entries(dailyOverlap)) {
      const deficitSecs = Math.max(0, TARGET_SECONDS - overlapSecs);
      totalDeficitSeconds += deficitSecs;

      dailyDetails.push({
        date,
        validDurationSeconds: overlapSecs,
        deficitSeconds: deficitSecs,
        achieved: overlapSecs >= TARGET_SECONDS
      });
    }

    // Konversi total defisit ke Jam, Menit, Detik
    const X = Math.floor(totalDeficitSeconds / 3600);
    const Y = Math.floor((totalDeficitSeconds % 3600) / 60);
    const Z = Math.round(totalDeficitSeconds % 60);

    // Hapus file temporary uploads
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      totalDeficitSeconds,
      deficitFormatted: { hours: X, minutes: Y, seconds: Z },
      dailyDetails
    });

  } catch (err) {
    res.status(500).json({ error: `Gagal memproses file: ${err.message}` });
  }
});

// 3. Fungsi Pembuatan PDF Slip Gaji (Integrasi pdfkit)
function generatePdfSlip(employeeData, outputPath) {
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(fs.createWriteStream(outputPath));

  // Kop Surat
  doc.fontSize(20).text('ARTOMORO GALLERY', { align: 'center' });
  doc.moveDown();
  doc.fontSize(14).text('SLIP GAJI BULANAN', { align: 'left' });
  doc.fontSize(10).text(`Nama: ${employeeData.name}`);
  doc.text(`Jabatan: ${employeeData.role}`);
  doc.text(`Periode: ${employeeData.dateRange}`);
  doc.moveDown();

  // Rincian Gaji Table
  doc.text('Keterangan', 50, 180);
  doc.text('Jumlah', 400, 180);
  doc.lineCap('butt').moveTo(50, 195).lineTo(550, 195).stroke();

  let currentY = 210;
  employeeData.items.forEach(item => {
    doc.text(item.name, 50, currentY);
    doc.text(`Rp ${item.amount.toLocaleString('id-ID')}`, 400, currentY);
    currentY += 20;
  });

  doc.lineCap('butt').moveTo(50, currentY).lineTo(550, currentY).stroke();
  currentY += 15;
  doc.fontSize(12).text('TOTAL DITERIMA:', 50, currentY);
  doc.text(`Rp ${employeeData.totalSalary.toLocaleString('id-ID')}`, 400, currentY);
  currentY += 30;

  // 4. Integrasi Slip Gaji dengan Catatan Evaluasi Kedisiplinan
  if (employeeData.totalDeficitSeconds > 0) {
    const X = Math.floor(employeeData.totalDeficitSeconds / 3600);
    const Y = Math.floor((employeeData.totalDeficitSeconds % 3600) / 60);
    const Z = Math.round(employeeData.totalDeficitSeconds % 60);

    const noteText = `Catatan Evaluasi: Jam tayang live Anda pada periode ini masih di bawah target yang ditentukan (Kurang ${X} jam ${Y} menit ${Z} detik). Yuk, tingkatkan lagi komitmen waktu dan kedisiplinannya di bulan depan!`;

    // Draw warning box (Rose theme)
    doc.rect(50, currentY, 500, 60)
       .fillColor('#FFF1F2') // rose-50 fill
       .strokeColor('#E11D48') // rose-600 border
       .fillAndStroke();

    doc.fillColor('#E11D48')
       .fontSize(8.5)
       .text(noteText, 60, currentY + 15, { width: 480, align: 'left' });

    currentY += 80;
  } else {
    currentY += 30;
  }

  // Draw Signatures Block
  doc.fillColor('#000000').fontSize(9);
  
  // Date above signature block
  doc.text(`Tangerang, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 350, currentY, { align: 'center', width: 200 });
  currentY += 15;

  // Signatures Titles
  doc.text('Disetujui Oleh,', 50, currentY, { align: 'center', width: 200 });
  doc.text('Mengetahui,', 350, currentY, { align: 'center', width: 200 });

  currentY += 40;

  // Disetujui Oleh (Rhevalino Armadyta Putra - Leader)
  doc.font('Helvetica-Bold').text('Rhevalino Armadyta Putra', 50, currentY, { align: 'center', width: 200 });
  doc.font('Helvetica').text('Leader', 50, currentY + 12, { align: 'center', width: 200 });

  // Mengetahui (Dwi Astuti - Owner)
  doc.font('Helvetica-Bold').text('Dwi Astuti', 350, currentY, { align: 'center', width: 200 });
  doc.font('Helvetica').text('Owner', 350, currentY + 12, { align: 'center', width: 200 });

  doc.end();
}

app.listen(3000, () => console.log('Server berjalan di port 3000'));
