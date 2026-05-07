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

  // 8. Tabel Habits (Personal Development)
  db.prepare(`CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

  // 9. Tabel Habit Logs (Track completions)
  db.prepare(`CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL, /* Format: YYYY-MM-DD */
      UNIQUE(habit_id, date),
      FOREIGN KEY(habit_id) REFERENCES habits(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

  // 10. Tabel Note / Jurnal
  db.prepare(`CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      color TEXT DEFAULT '#ffffff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

  // 11. Tabel Obiective Economisire (Savings Goals)
  db.prepare(`CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      color TEXT DEFAULT '#6366f1',
      deadline DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS hydration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount_ml INTEGER NOT NULL,
      date DATE DEFAULT CURRENT_DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

  // 13. Tabel Categorii Buget
  db.prepare(`CREATE TABLE IF NOT EXISTS budget_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      monthly_limit REAL DEFAULT 0,
      color TEXT DEFAULT '#6366f1',
      FOREIGN KEY(user_id) REFERENCES users(id),
      UNIQUE(user_id, name)
    )`).run();

  // 14. Tabel Task-uri (Kanban)
  db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo', /* 'todo', 'in-progress', 'done' */
      priority TEXT DEFAULT 'medium', /* 'low', 'medium', 'high' */
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

  // Migration for expenses: ADD category
  const expenseCols = db.pragma('table_info(expenses)');
  if (!expenseCols.some(c => c.name === 'category')) {
    db.prepare("ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'General'").run();
    console.log("Migrare: Am adăugat coloana 'category' în tabela 'expenses'.");
  }

  // 15. Tabel Linkuri Utile
  db.prepare(`CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT DEFAULT 'General',
      icon TEXT,
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`).run();

  // Migration: Add default links for existing users who have 0 links
  try {
    const usersWithNoLinks = db.prepare(`
        SELECT id FROM users 
        WHERE id NOT IN (SELECT DISTINCT user_id FROM links)
    `).all();

    if (usersWithNoLinks.length > 0) {
      console.log(`Migrare: Adăugăm link-uri implicite pentru ${usersWithNoLinks.length} utilizatori existenți.`);
      const defaults = [
        { title: 'ChatGPT', url: 'https://chat.openai.com', category: 'Utilități', icon: '🤖' },
        { title: 'Google Calendar', url: 'https://calendar.google.com', category: 'Muncă', icon: '📅' },
        { title: 'Canva', url: 'https://www.canva.com', category: 'Divertisment', icon: '🎨' },
        { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', category: 'Educație', icon: '📚' }
      ];

      const insertStmt = db.prepare(`INSERT INTO links (user_id, title, url, category, icon) VALUES (?, ?, ?, ?, ?)`);
      usersWithNoLinks.forEach(user => {
        defaults.forEach(link => {
          insertStmt.run(user.id, link.title, link.url, link.category, link.icon);
        });
      });
    }
  } catch (err) {
    console.error("Eroare la migrarea link-urilor implicite:", err);
  }

  console.log('Tabelele are ready: users, habits, notes, savings_goals, hydration, budget_categories, tasks, links, etc.');
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
