const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.resolve(__dirname, 'atestat.db');
const db = new Database(dbPath);
console.log('Conectat la baza de date SQLite (better-sqlite3).');

initializeDatabase();

function initializeDatabase() {
  // 1. Tabel Utilizatori
  db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();

  // Migration for existing databases: Check if avatar_url exists
  const columns = db.pragma('table_info(users)');
  const hasAvatar = columns.some(c => c.name === 'avatar_url');
  if (!hasAvatar) {
    db.prepare("ALTER TABLE users ADD COLUMN avatar_url TEXT").run();
    console.log("Migrare: Am adăugat coloana 'avatar_url' în tabela 'users'.");
  }

  // 2. Tabel Chei Admin
  db.prepare(`CREATE TABLE IF NOT EXISTS admin_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_value TEXT UNIQUE NOT NULL,
      is_used INTEGER DEFAULT 0
    )`).run();

  // 3. Tabel Bugete Lunare
  db.prepare(`CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      month TEXT NOT NULL, /* Format: YYYY-MM */
      amount REAL DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

  // 4. Tabel Cheltuieli
  db.prepare(`CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT NOT NULL, /* Format: YYYY-MM-DD */
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

  // 5. Tabel Consumabile (Ex: apa, cafea) - Optional
  db.prepare(`CREATE TABLE IF NOT EXISTS consumables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      date TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

  // 6. Tabel Activități (Time Management)
  db.prepare(`CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL, /* 'fixed' sau 'recurring' */
      start_data TEXT NOT NULL, /* Format: '2024-01-20T14:00' sau 'Monday 14:00' */
      duration INTEGER NOT NULL, /* Minute */
      is_finished INTEGER DEFAULT 0,
      finished_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

  // Migration for existing databases: Check if is_finished exists
  const actColumns = db.pragma('table_info(activities)');
  const hasFinished = actColumns.some(c => c.name === 'is_finished');
  if (!hasFinished) {
    db.prepare("ALTER TABLE activities ADD COLUMN is_finished INTEGER DEFAULT 0").run();
    db.prepare("ALTER TABLE activities ADD COLUMN finished_at DATETIME").run();
    console.log("Migrare: Am adăugat coloanele 'is_finished' și 'finished_at' în tabela 'activities'.");
  }

  // 7. Configurare initiala Chei Admin
  const keyCount = db.prepare("SELECT count(*) as count FROM admin_keys").get().count;
  if (keyCount === 0) {
    db.prepare("INSERT INTO admin_keys (key_value) VALUES ('ADMIN123')").run();
    console.log("Cheie admin initiala generata: ADMIN123");
  }

  console.log('Tabelele "users", "admin_keys", "budgets", "expenses", "activities" sunt pregătite.');
}

/**
 * Helper pentru a crea un utilizator nou
 * Păstrăm interfața cu callback pentru compatibilitate cu main.js (până la refactorizarea main.js)
 */
function createUser(username, email, password, isAdmin = false, callback) {
  const saltRounds = 10;
  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) return callback(err);
    try {
      const info = db.prepare(
        `INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)`
      ).run(username, email, hash, isAdmin ? 1 : 0);
      callback(null, info.lastInsertRowid);
    } catch (dbErr) {
      callback(dbErr);
    }
  });
}

/**
 * Helper pentru a verifica cheia admin
 */
function verifyAndConsumeAdminKey(key, callback) {
  try {
    const row = db.prepare(`SELECT id FROM admin_keys WHERE key_value = ? AND is_used = 0`).get(key);
    if (!row) return callback(null, false);

    db.prepare(`UPDATE admin_keys SET is_used = 1 WHERE id = ?`).run(row.id);
    callback(null, true);
  } catch (err) {
    callback(err, false);
  }
}

module.exports = {
  db,
  createUser,
  verifyAndConsumeAdminKey
};
