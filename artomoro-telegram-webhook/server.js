require('dotenv').config();
const express = require('express');
const axios = require('axios');
const db = require('./database');

const app = express();
app.use(express.json());

// Enable CORS middleware so the client-side SPA can fetch manual orders
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;

// Helper to determine Jakarta time (UTC+7) hour for shift classification
function getJakartaHour(unixSecs) {
  const date = new Date(unixSecs * 1000);
  // Get date string in Jakarta timezone
  const tzString = date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  const jakartaDate = new Date(tzString);
  return jakartaDate.getHours();
}

// Helper function to send message back to Telegram Chat
async function sendTelegramMessage(chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: text
    });
    console.log(`Telegram reply sent to chatId ${chatId}`);
  } catch (error) {
    console.error(`Failed to send Telegram message:`, error.response ? error.response.data : error.message);
  }
}

// Parsing function to split source, SKU, and price
function parseTelegramText(text) {
  const parts = text.split('-').map(p => p.trim());
  if (parts.length < 3) return null;

  const priceStr = parts[parts.length - 1];
  const price = parseInt(priceStr, 10);
  if (isNaN(price)) return null;

  // SKU & Source resolution
  const secondLast = parts[parts.length - 2];
  const thirdLast = parts[parts.length - 3];

  let sku = "";
  let source = "";

  const secondLastUpper = secondLast.toUpperCase();
  const thirdLastUpper = thirdLast.toUpperCase();

  // Handle case where SKU contains a dash (POLO-PDK, POLO-PNJ, CRG-PDK, CRG-PNJ, KMJ-KTN)
  if (parts.length >= 4 && ['PDK', 'PNJ', 'KTN'].includes(secondLastUpper) && ['POLO', 'CRG', 'KMJ'].includes(thirdLastUpper)) {
    sku = `${thirdLastUpper}-${secondLastUpper}`;
    source = parts.slice(0, parts.length - 3).join('-');
  } else {
    // Single-word SKU or special route like "Cargo Rejected"
    if (secondLast.toLowerCase() === 'cargo rejected') {
      sku = 'Cargo Rejected';
    } else {
      sku = secondLast;
    }
    source = parts.slice(0, parts.length - 2).join('-');
  }

  if (!sku || !source || isNaN(price)) return null;
  return { source, sku, price };
}

// Webhook POST API
app.post('/api/telegram-webhook', async (req, res) => {
  // Always acknowledge immediately with 200 OK
  res.status(200).json({ success: true });

  const message = req.body.message;
  if (!message || !message.chat || !message.text) {
    console.log('Ignored non-text or malformed update.');
    return;
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  const parsed = parseTelegramText(text);

  if (!parsed) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Format salah. Gunakan: sumber-kode sku-harga (Contoh: tf-POLO-PDK-150000)"
    );
    return;
  }

  const { source, sku, price } = parsed;
  
  // Extract and classify shift based on message timestamp
  const msgDateSec = message.date || Math.floor(Date.now() / 1000);
  const hour = getJakartaHour(msgDateSec);
  
  let shiftName = "Shift 2 (Malam)";
  if (hour >= 8 && hour < 16) {
    shiftName = "Shift 1 (Pagi)";
  }

  const createdAt = new Date(msgDateSec * 1000).toISOString();

  // Insert manual order record securely
  const query = `INSERT INTO manual_orders (kode_akun, kode_sku, total_harga, created_at) VALUES (?, ?, ?, ?)`;
  db.run(query, [source, sku, price, createdAt], async function (err) {
    if (err) {
      console.error('Database insertion error:', err.message);
      await sendTelegramMessage(chatId, "❌ Gagal merekap data ke database.");
    } else {
      console.log(`Manual order recorded. ID: ${this.lastID}, Source: ${source}, SKU: ${sku}, Price: ${price}, Shift: ${shiftName}`);
      await sendTelegramMessage(
        chatId,
        `✅ Transaksi ${source} tersimpan!\n📦 SKU: ${sku}\n💰 Omset: Rp${price.toLocaleString('id-ID')}\n⏰ Tercatat pada shift aktif (${shiftName}).`
      );
    }
  });
});

// GET endpoint for client-side React App to fetch all manual orders
app.get('/api/manual-orders', (req, res) => {
  db.all('SELECT * FROM manual_orders ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('Database fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch manual orders' });
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Webhook server is running on port ${PORT}`);
});
