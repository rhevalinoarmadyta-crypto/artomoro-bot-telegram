const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Could not connect to database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

db.serialize(() => {
  // Drop table if exists to migrate schema cleanly
  db.run("DROP TABLE IF EXISTS manual_orders");

  db.run(`
    CREATE TABLE IF NOT EXISTS manual_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode_akun TEXT NOT NULL,
      kode_sku TEXT NOT NULL,
      total_harga INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table manual_orders', err);
    } else {
      console.log('Table manual_orders with SKU schema ready');
    }
  });
});

module.exports = db;
