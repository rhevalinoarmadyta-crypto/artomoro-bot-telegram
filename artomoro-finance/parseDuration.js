/**
 * Reference Script: parseDuration.js
 * Node.js (with xlsx parser) implementation for parsing, grouping daily live duration,
 * and generating discipline warnings for Shift Pagi (Target: 7 Hours).
 */

const fs = require('fs');
const XLSX = require('xlsx');

// Helper to convert HH:MM:SS duration string to seconds
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = String(timeStr).trim().split(':');
  if (parts.length === 3) {
    return (parseInt(parts[0], 10) || 0) * 3600 + 
           (parseInt(parts[1], 10) || 0) * 60 + 
           (parseInt(parts[2], 10) || 0);
  } else if (parts.length === 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + 
           (parseInt(parts[1], 10) || 0);
  }
  return parseFloat(timeStr) || 0;
}

// Main logic for processing Shopee Live CSV logs
function processLivePerformance(filePath) {
  console.log(`Reading CSV: ${filePath}...`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (rows.length === 0) {
    console.error("File is empty.");
    return;
  }

  // Find columns (Start Time and Duration)
  const firstRow = rows[0];
  let startCol = null;
  let durationCol = null;

  for (const key of Object.keys(firstRow)) {
    const cleanKey = key.trim().toLowerCase();
    if (['start time', 'mulai live', 'waktu mulai'].includes(cleanKey)) {
      startCol = key;
    }
    if (['duration', 'durasi', 'durasi live', 'live duration'].includes(cleanKey)) {
      durationCol = key;
    }
  }

  if (!startCol || !durationCol) {
    console.error("Required columns ('Start Time' or 'Duration') not found.");
    return;
  }

  // Group by date
  const dailyDurations = {};

  rows.forEach((row, index) => {
    const startVal = row[startCol];
    const durationVal = row[durationCol];
    if (!startVal || !durationVal) return;

    // Parse date (DD-MM-YYYY HH:mm:ss or similar)
    const cleanStr = String(startVal).trim();
    let dateStr = '';
    
    // Check if standard date string
    const match = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (match) {
      // Extracted DD/MM/YYYY or DD-MM-YYYY part
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      dateStr = `${day}/${month}/${year}`;
    } else {
      const d = new Date(cleanStr);
      if (!isNaN(d.getTime())) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        dateStr = `${dd}/${mm}/${yyyy}`;
      } else {
        dateStr = 'Invalid Date';
      }
    }

    // Extract hour to check if Shift Pagi (08:00 - 17:00, e.g. hour >= 8 && hour < 17)
    let hour = 8;
    const timeMatch = cleanStr.match(/\s+(\d{1,2}):/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
    }

    // Only process Shift Pagi
    if (hour >= 8 && hour < 17) {
      const durationSeconds = parseTimeToSeconds(durationVal);
      if (!dailyDurations[dateStr]) {
        dailyDurations[dateStr] = 0;
      }
      dailyDurations[dateStr] += durationSeconds;
    }
  });

  // Target: 7 Hours (25,200 seconds)
  const TARGET_SECONDS = 7 * 3600;
  const evaluationLogs = [];

  for (const [date, totalSeconds] of Object.entries(dailyDurations)) {
    const totalHours = totalSeconds / 3600;
    const achieved = totalSeconds >= TARGET_SECONDS;
    
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const durationFormatted = `${h} Jam ${m} Menit`;

    let note = '';
    if (!achieved) {
      note = `Evaluasi Kedisiplinan: Pada tanggal ${date}, total durasi live hanya mencapai ${durationFormatted} dari target 7 Jam. Mohon tingkatkan komitmen waktu.`;
    } else {
      note = `Kinerja luar biasa. Target durasi terpenuhi 100% (${durationFormatted}).`;
    }

    evaluationLogs.push({
      date,
      totalDurationStr: durationFormatted,
      achieved,
      note
    });
  }

  // Sort logs by date ascending
  evaluationLogs.sort((a, b) => {
    const partsA = a.date.split('/');
    const partsB = b.date.split('/');
    return new Date(partsA[2], partsA[1] - 1, partsA[0]) - new Date(partsB[2], partsB[1] - 1, partsB[0]);
  });

  return evaluationLogs;
}

module.exports = {
  processLivePerformance
};
