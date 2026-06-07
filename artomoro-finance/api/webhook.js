// Serverless Telegram Webhook Handler for Vercel
// Endpoint: GET/POST /api/webhook

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8605041130:AAH_MCDxLr6EL_S0wTdqd2vkYxXETpdMLTY';
const BUCKET_ID = process.env.KVDB_BUCKET_ID || 'GHZuj4zaR2QWYxhRqEaxas';
const KV_STORE_URL = `https://kvdb.io/${BUCKET_ID}/manual_orders`;

// Helper to determine Jakarta time (UTC+7) hour for shift classification
function getJakartaHour(unixSecs) {
  const date = new Date(unixSecs * 1000);
  const tzString = date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' });
  const jakartaDate = new Date(tzString);
  return jakartaDate.getHours();
}

// Helper function to send message back to Telegram Chat
async function sendTelegramMessage(chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: text })
    });
    console.log(`Telegram reply sent to chatId ${chatId}`);
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
}

// Parsing function to split source, SKU, and price
function parseTelegramText(text) {
  const parts = text.split('-').map(p => p.trim());
  if (parts.length < 3) return null;

  const priceStr = parts[parts.length - 1];
  const price = parseInt(priceStr, 10);
  if (isNaN(price)) return null;

  const secondLast = parts[parts.length - 2];
  const thirdLast = parts[parts.length - 3];

  let sku = "";
  let source = "";

  const secondLastUpper = secondLast.toUpperCase();
  const thirdLastUpper = thirdLast.toUpperCase();

  if (parts.length >= 4 && ['PDK', 'PNJ', 'KTN'].includes(secondLastUpper) && ['POLO', 'CRG', 'KMJ'].includes(thirdLastUpper)) {
    sku = `${thirdLastUpper}-${secondLastUpper}`;
    source = parts.slice(0, parts.length - 3).join('-');
  } else {
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

// In-memory cache to prevent duplicate request processing from Telegram retries
const processedUpdates = new Set();

export default async function handler(req, res) {
  // Always set CORS headers for API safety
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    // GET method returns list of manual orders from cloud KV database
    try {
      const kvRes = await fetch(KV_STORE_URL);
      if (kvRes.ok) {
        const data = await kvRes.json();
        return res.status(200).json(data);
      }
      return res.status(200).json([]);
    } catch (error) {
      console.error('Failed to fetch from KV Store:', error);
      return res.status(500).json({ error: 'Failed to fetch manual orders' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Deduplicate updates from Telegram
  const updateId = req.body && req.body.update_id;
  if (updateId) {
    if (processedUpdates.has(updateId)) {
      console.log(`Duplicate update detected and ignored: ${updateId}`);
      return res.status(200).json({ success: true, message: 'Duplicate update ignored' });
    }
    processedUpdates.add(updateId);
    if (processedUpdates.size > 200) {
      const firstVal = processedUpdates.values().next().value;
      processedUpdates.delete(firstVal);
    }
  }

  // Handle Telegram POST update
  const message = req.body && req.body.message;
  if (!message || !message.chat || !message.text) {
    return res.status(200).json({ success: true, message: 'Ignored non-text update' });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();
  const parsed = parseTelegramText(text);

  if (!parsed) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Format salah. Gunakan: sumber-kode sku-harga (Contoh: tf-POLO-PDK-150000)"
    );
    return res.status(200).json({ success: true, message: 'Parsing failed, warning sent' });
  }

  const { source, sku, price } = parsed;
  const msgDateSec = message.date || Math.floor(Date.now() / 1000);
  const hour = getJakartaHour(msgDateSec);
  
  let shiftName = "Shift 2 (Malam)";
  if (hour >= 8 && hour < 16) {
    shiftName = "Shift 1 (Pagi)";
  }

  const createdAt = new Date(msgDateSec * 1000).toISOString();

  const newOrder = {
    id: Date.now(),
    kode_akun: source,
    kode_sku: sku,
    total_harga: price,
    created_at: createdAt
  };

  try {
    // Read existing orders
    let orders = [];
    const kvRes = await fetch(KV_STORE_URL);
    if (kvRes.ok) {
      const rawText = await kvRes.text();
      try {
        orders = JSON.parse(rawText);
        if (!Array.isArray(orders)) orders = [];
      } catch (e) {
        orders = [];
      }
    }
    
    // Add new order to the top of the array
    orders.unshift(newOrder);

    // Save back to KV Store
    await fetch(KV_STORE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orders)
    });

    console.log(`Saved order to KV: ${JSON.stringify(newOrder)}`);

    await sendTelegramMessage(
      chatId,
      `✅ Transaksi ${source} tersimpan!\n📦 SKU: ${sku}\n💰 Omset: Rp${price.toLocaleString('id-ID')}\n⏰ Tercatat pada shift aktif (${shiftName}).`
    );

    return res.status(200).json({ success: true, order: newOrder });
  } catch (error) {
    console.error('Error saving order to KV Store:', error);
    await sendTelegramMessage(chatId, "❌ Gagal merekap data ke database Vercel.");
    return res.status(200).json({ success: true, error: 'Database save failed' });
  }
}
