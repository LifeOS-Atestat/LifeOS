require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { db, createUser, verifyAndConsumeAdminKey } = require('./database');
const multer = require('multer');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const port = 3000;

// --- Multer Config (File Upload) ---
// Set storage engine
const storage = multer.diskStorage({
    destination: './public/uploads/avatars/',
    filename: function (req, file, cb) {
        // Name file: avatar-USERID-TIMESTAMP.ext
        cb(null, 'avatar-' + req.session.userId + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Init upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    }
}).single('avatar'); // Field name 'avatar'

// Check File Type
function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb('Error: Doar imagini!');
    }
}

// ==========================================
// Middleware Configuration
// ==========================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Pentru request-uri JSON
app.use(express.static('public', { extensions: ['html'] })); // Serve static files without extension
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'))); // Explicitly serve uploads

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// ==========================================
// Authentication Middleware
// ==========================================
function requireLogin(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// ==========================================
// API Routes
// ==========================================

// --- REGISTER ---
app.post('/api/register', (req, res) => {
    const { username, email, password, adminKey } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: "Toate câmpurile sunt obligatorii." });
    }

    // Daca utilizatorul vrea sa fie admin, verificam cheia
    if (adminKey) {
        verifyAndConsumeAdminKey(adminKey, (err, isValid) => {
            if (err) return res.status(500).json({ error: "Eroare server." });
            if (!isValid) return res.status(403).json({ error: "Cheie de administrator invalidă sau deja folosită." });

            // Creare cont Admin
            registerUser(username, email, password, true, res);
        });
    } else {
        // Creare cont Standard
        registerUser(username, email, password, false, res);
    }
});

function registerUser(username, email, password, isAdmin, res) {
    createUser(username, email, password, isAdmin, (err, userId) => {
        if (err) {
            if (err.message && err.message.includes("UNIQUE constraint failed")) {
                return res.status(400).json({ error: "Utilizatorul sau email-ul există deja." });
            }
            return res.status(500).json({ error: "Eroare la crearea contului." });
        }
        res.json({ success: true, message: "Cont creat cu succes!" });
    });
}

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body;

    try {
        const user = db.prepare(`SELECT * FROM users WHERE email = ? OR username = ?`).get(identifier, identifier);

        if (!user) return res.status(401).json({ error: "Utilizator/Email sau parolă incorectă." });

        const match = await bcrypt.compare(password, user.password_hash);
        if (match) {
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.isAdmin = !!user.is_admin;
            res.json({ success: true, redirect: '/dashboard' });
        } else {
            res.status(401).json({ error: "Email sau parolă incorectă." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Eroare server." });
    }
});

// --- LOGOUT ---
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, redirect: '/login' });
});

// --- GET CURRENT USER ---
app.get('/api/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Neautorizat" });

    try {
        const row = db.prepare("SELECT username, is_admin, avatar_url FROM users WHERE id = ?").get(req.session.userId);
        if (!row) return res.status(404).json({ error: "Utilizator negăsit" });
        res.json(row);
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

// --- UPLOAD AVATAR ---
app.post('/api/upload-avatar', requireLogin, (req, res) => {
    upload(req, res, (err) => {
        if (err) return res.status(400).json({ error: err });
        if (req.file == undefined) return res.status(400).json({ error: 'Niciun fișier selectat!' });

        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const userId = req.session.userId;

        try {
            db.prepare(`UPDATE users SET avatar_url = ? WHERE id = ?`).run(avatarUrl, userId);
            res.json({
                success: true,
                message: 'Avatar actualizat!',
                filePath: avatarUrl
            });
        } catch (dbErr) {
            res.status(500).json({ error: 'Eroare salvare DB' });
        }
    });
});

// ==========================================
// Economic API Routes
// ==========================================

// --- GET BUDGET Overview ---
app.get('/api/budget', requireLogin, (req, res) => {
    const userId = req.session.userId;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const today = new Date().toISOString().slice(0, 10);

    try {
        const budgetRow = db.prepare(`SELECT amount FROM budgets WHERE user_id = ? AND month = ?`).get(userId, currentMonth);
        const budgetTotal = budgetRow ? budgetRow.amount : 0;

        const expenseRow = db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date LIKE ?`).get(userId, `${currentMonth}%`);
        const expensesTotal = expenseRow.total || 0;
        const remaining = budgetTotal - expensesTotal;

        const todayRow = db.prepare(`SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date = ?`).get(userId, today);
        const expensesToday = todayRow.total || 0;

        const now = new Date();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysLeft = daysInMonth - now.getDate() + 1;
        const dailyBudget = daysLeft > 0 ? (remaining / daysLeft) : 0;

        res.json({
            totalBudget: budgetTotal,
            totalExpenses: expensesTotal,
            remaining: remaining,
            expensesToday: expensesToday,
            dailyBudget: dailyBudget.toFixed(2),
            daysLeft: daysLeft
        });
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

// --- SET BUDGET ---
app.post('/api/budget', requireLogin, (req, res) => {
    const { amount } = req.body;
    const userId = req.session.userId;
    const currentMonth = new Date().toISOString().slice(0, 7);

    try {
        const row = db.prepare(`SELECT id FROM budgets WHERE user_id = ? AND month = ?`).get(userId, currentMonth);
        if (row) {
            db.prepare(`UPDATE budgets SET amount = ? WHERE id = ?`).run(amount, row.id);
        } else {
            db.prepare(`INSERT INTO budgets (user_id, month, amount) VALUES (?, ?, ?)`).run(userId, currentMonth, amount);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare salvare buget" });
    }
});

// --- ADD TO BUDGET (Top-up) ---
app.patch('/api/budget/add', requireLogin, (req, res) => {
    const { amount } = req.body;
    const userId = req.session.userId;
    const currentMonth = new Date().toISOString().slice(0, 7);

    try {
        const row = db.prepare(`SELECT id, amount FROM budgets WHERE user_id = ? AND month = ?`).get(userId, currentMonth);
        if (row) {
            const newAmount = row.amount + parseFloat(amount);
            db.prepare(`UPDATE budgets SET amount = ? WHERE id = ?`).run(newAmount, row.id);
        } else {
            // If no budget set yet, treat "add" as "set"
            db.prepare(`INSERT INTO budgets (user_id, month, amount) VALUES (?, ?, ?)`).run(userId, currentMonth, amount);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare adăugare fonduri" });
    }
});

// --- ADD EXPENSE ---
app.post('/api/expenses', requireLogin, (req, res) => {
    const { amount, description, date, category } = req.body;
    const userId = req.session.userId;
    const expenseDate = date || new Date().toISOString().slice(0, 10);

    try {
        db.prepare(`INSERT INTO expenses (user_id, amount, description, date, category) VALUES (?, ?, ?, ?, ?)`).run(userId, amount, description, expenseDate, category || 'General');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare adăugare cheltuială" });
    }
});

// --- BUDGET CATEGORIES API ---
app.get('/api/budget/categories', requireLogin, (req, res) => {
    const userId = req.session.userId;
    try {
        const rows = db.prepare(`SELECT * FROM budget_categories WHERE user_id = ?`).all(userId);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

app.post('/api/budget/categories', requireLogin, (req, res) => {
    const { name, monthly_limit, color } = req.body;
    const userId = req.session.userId;
    try {
        db.prepare(`INSERT OR REPLACE INTO budget_categories (user_id, name, monthly_limit, color) VALUES (?, ?, ?, ?)`).run(userId, name, monthly_limit || 0, color || '#6366f1');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare adăugare categorie" });
    }
});

app.delete('/api/budget/categories/:id', requireLogin, (req, res) => {
    const id = req.params.id;
    const userId = req.session.userId;
    try {
        db.prepare(`DELETE FROM budget_categories WHERE id = ? AND user_id = ?`).run(id, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare ștergere" });
    }
});

// --- GET RECENT EXPENSES ---
app.get('/api/expenses', requireLogin, (req, res) => {
    const userId = req.session.userId;
    try {
        const rows = db.prepare(`SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 5`).all(userId);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

// --- GET ALL EXPENSES FOR CURRENT MONTH (For Chart) ---
app.get('/api/expenses/month', requireLogin, (req, res) => {
    const userId = req.session.userId;
    const currentMonth = new Date().toISOString().slice(0, 7);
    try {
        const rows = db.prepare(`SELECT * FROM expenses WHERE user_id = ? AND date LIKE ? ORDER BY date DESC, id DESC`).all(userId, `${currentMonth}%`);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

// ==========================================
// Time Management API Routes
// ==========================================

// --- GET ACTIVITIES ---
app.get('/api/activities', requireLogin, (req, res) => {
    const userId = req.session.userId;
    try {
        const rows = db.prepare(`SELECT * FROM activities WHERE user_id = ? ORDER BY start_data ASC`).all(userId);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

// --- ADD ACTIVITY ---
app.post('/api/activities', requireLogin, (req, res) => {
    const { title, type, start_data, duration } = req.body;
    const userId = req.session.userId;

    try {
        db.prepare(`INSERT INTO activities (user_id, title, type, start_data, duration) VALUES (?, ?, ?, ?, ?)`).run(userId, title, type, start_data, duration);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare adăugare activitate" });
    }
});

// --- DELETE ACTIVITY ---
app.delete('/api/activities/:id', requireLogin, (req, res) => {
    const activityId = req.params.id;
    const userId = req.session.userId;

    try {
        db.prepare(`DELETE FROM activities WHERE id = ? AND user_id = ?`).run(activityId, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare ștergere activitate" });
    }
});

// --- FINISH ACTIVITY (Delayed deletion) ---
app.patch('/api/activities/:id/finish', requireLogin, (req, res) => {
    const activityId = req.params.id;
    const userId = req.session.userId;
    const now = new Date().toISOString();

    try {
        db.prepare(`UPDATE activities SET is_finished = 1, finished_at = ? WHERE id = ? AND user_id = ?`)
            .run(now, activityId, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare finalizare activitate" });
    }
});

// --- SUGGEST SLOT (Simple Algorithm) ---
app.post('/api/suggest-slot', requireLogin, (req, res) => {
    const { duration } = req.body; // in minutes
    const userId = req.session.userId;

    // Simplificare: Cautăm în următoarele 3 zile, între orele 08:00 și 20:00
    // O implementare reală ar necesita verificarea complexă a suprapunerilor

    const suggestions = [];
    const now = new Date();

    // Generam cateva sloturi posibile
    for (let i = 1; i <= 3; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        d.setHours(14, 0, 0, 0); // Propune ora 14:00
        suggestions.push({
            date: d.toISOString().slice(0, 10),
            time: "14:00",
            label: `${d.toLocaleDateString('ro-RO', { weekday: 'long' })}, ora 14:00`
        });

        d.setHours(18, 0, 0, 0); // Propune ora 18:00
        suggestions.push({
            date: d.toISOString().slice(0, 10),
            time: "18:00",
            label: `${d.toLocaleDateString('ro-RO', { weekday: 'long' })}, ora 18:00`
        });
    }

    res.json(suggestions);
});

// --- GET NEXT ACTIVITIES (For Dashboard) ---
app.get('/api/next-activity', requireLogin, (req, res) => {
    const userId = req.session.userId;
    try {
        const rows = db.prepare(`SELECT * FROM activities WHERE user_id = ?`).all(userId);
        const now = new Date();
        const upcoming = [];

        rows.forEach(act => {
            let actDate = null;
            if (act.type === 'fixed') {
                actDate = new Date(act.start_data);
            } else {
                const parts = act.start_data.split(' ');
                if (parts.length === 2) {
                    const days = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
                    const targetDay = days[parts[0]];
                    const [hour, minute] = parts[1].split(':').map(Number);

                    actDate = new Date(now);
                    actDate.setHours(hour, minute, 0, 0);

                    const currentDay = now.getDay();
                    let diff = targetDay - currentDay;
                    if (diff < 0 || (diff === 0 && actDate <= now)) {
                        diff += 7;
                    }
                    if (diff !== 0) actDate.setDate(now.getDate() + diff);
                }
            }

            if (actDate && actDate > now) {
                const diffTime = actDate - now;
                const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                let daysUntilStr = '';
                if (daysDiff === 0) {
                    const totalMin = Math.floor(diffTime / (1000 * 60));
                    const h = Math.floor(totalMin / 60);
                    const m = totalMin % 60;
                    daysUntilStr = `Azi (peste ${h > 0 ? h + 'h ' : ''}${m}min)`;
                } else if (daysDiff === 1) {
                    daysUntilStr = 'Mâine';
                } else {
                    daysUntilStr = `În ${daysDiff} zile`;
                }

                upcoming.push({
                    title: act.title,
                    timestamp: actDate.getTime(),
                    time: actDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
                    dateStr: actDate.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric' }),
                    days_until: daysUntilStr
                });
            }
        });

        upcoming.sort((a, b) => a.timestamp - b.timestamp);
        res.json({ activities: upcoming.slice(0, 3) });
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

// ==========================================
// Habit Tracker API
// ==========================================

function getStreak(habitId, userId) {
    const logs = db.prepare(`SELECT date FROM habit_logs WHERE habit_id = ? AND user_id = ? ORDER BY date DESC`).all(habitId, userId);
    if (logs.length === 0) return 0;

    let streak = 0;
    const now = new Date();
    // Normalize to date string (local)
    const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = new Date(yesterday.getTime() - (yesterday.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    const lastLog = logs[0].date;
    if (lastLog !== todayStr && lastLog !== yesterdayStr) return 0;

    let checkDate = new Date(lastLog);
    for (const log of logs) {
        const dStr = log.date;
        const expected = new Date(checkDate.getTime() - (checkDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        if (dStr === expected) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

// --- GET HABITS ---
app.get('/api/habits', requireLogin, (req, res) => {
    const userId = req.session.userId;
    const today = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    try {
        const habits = db.prepare(`
            SELECT h.*, 
            (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id = h.id AND hl.date = ?) as completed_today
            FROM habits h WHERE h.user_id = ?
        `).all(today, userId);

        const habitsWithStreaks = habits.map(h => ({
            ...h,
            streak: getStreak(h.id, userId)
        }));

        res.json(habitsWithStreaks);
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

// --- ADD HABIT ---
app.post('/api/habits', requireLogin, (req, res) => {
    const { title, color } = req.body;
    const userId = req.session.userId;
    try {
        db.prepare(`INSERT INTO habits (user_id, title, color) VALUES (?, ?, ?)`).run(userId, title, color || '#6366f1');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare adăugare" });
    }
});

// --- TOGGLE HABIT ---
app.post('/api/habits/:id/toggle', requireLogin, (req, res) => {
    const habitId = req.params.id;
    const userId = req.session.userId;
    const today = new Date().toISOString().split('T')[0];

    try {
        const existing = db.prepare(`SELECT id FROM habit_logs WHERE habit_id = ? AND date = ? AND user_id = ?`).get(habitId, today, userId);
        if (existing) {
            db.prepare(`DELETE FROM habit_logs WHERE id = ?`).run(existing.id);
            res.json({ success: true, completed: false });
        } else {
            db.prepare(`INSERT INTO habit_logs (habit_id, user_id, date) VALUES (?, ?, ?)`).run(habitId, userId, today);
            res.json({ success: true, completed: true });
        }
    } catch (err) {
        res.status(500).json({ error: "Eroare toggle" });
    }
});

// --- DELETE HABIT ---
app.delete('/api/habits/:id', requireLogin, (req, res) => {
    const id = req.params.id;
    const userId = req.session.userId;
    try {
        db.prepare(`DELETE FROM habit_logs WHERE habit_id = ? AND user_id = ?`).run(id, userId);
        db.prepare(`DELETE FROM habits WHERE id = ? AND user_id = ?`).run(id, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare ștergere" });
    }
});

// ==========================================
// Notes / Journal API
// ==========================================

app.get('/api/notes', requireLogin, (req, res) => {
    const userId = req.session.userId;
    try {
        const rows = db.prepare(`SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

app.post('/api/notes', requireLogin, (req, res) => {
    const { title, content, color } = req.body;
    const userId = req.session.userId;
    if (!content) return res.status(400).json({ error: "Conținutul este obligatoriu." });

    try {
        db.prepare(`INSERT INTO notes (user_id, title, content, color) VALUES (?, ?, ?, ?)`).run(userId, title, content, color || '#ffffff');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare salvare" });
    }
});

app.delete('/api/notes/:id', requireLogin, (req, res) => {
    const id = req.params.id;
    const userId = req.session.userId;
    try {
        db.prepare(`DELETE FROM notes WHERE id = ? AND user_id = ?`).run(id, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare ștergere" });
    }
});

// ==========================================
// Savings / Goals API
// ==========================================

app.get('/api/savings', requireLogin, (req, res) => {
    const userId = req.session.userId;
    try {
        const rows = db.prepare(`SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

app.post('/api/savings', requireLogin, (req, res) => {
    const { title, target_amount, color, deadline } = req.body;
    const userId = req.session.userId;
    if (!title || !target_amount) return res.status(400).json({ error: "Titlu și suma țintă obligatorii." });

    try {
        db.prepare(`INSERT INTO savings_goals (user_id, title, target_amount, color, deadline) VALUES (?, ?, ?, ?, ?)`).run(userId, title, target_amount, color || '#6366f1', deadline);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare salvare" });
    }
});

app.post('/api/savings/:id/add', requireLogin, (req, res) => {
    const { amount } = req.body;
    const id = req.params.id;
    const userId = req.session.userId;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Sumă invalidă." });

    try {
        db.prepare(`UPDATE savings_goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?`).run(amount, id, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare actualizare" });
    }
});

app.delete('/api/savings/:id', requireLogin, (req, res) => {
    const id = req.params.id;
    const userId = req.session.userId;
    try {
        db.prepare(`DELETE FROM savings_goals WHERE id = ? AND user_id = ?`).run(id, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare ștergere" });
    }
});

// ==========================================
// Hydration API
// ==========================================

app.get('/api/hydration', requireLogin, (req, res) => {
    const userId = req.session.userId;
    try {
        const row = db.prepare(`SELECT SUM(amount_ml) as total FROM hydration WHERE user_id = ? AND date = CURRENT_DATE`).get(userId);
        res.json({ total: row.total || 0 });
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

app.post('/api/hydration/add', requireLogin, (req, res) => {
    const { amount_ml } = req.body;
    const userId = req.session.userId;
    if (!amount_ml || amount_ml <= 0) return res.status(400).json({ error: "Cantitate invalidă." });

    try {
        db.prepare(`INSERT INTO hydration (user_id, amount_ml) VALUES (?, ?)`).run(userId, amount_ml);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare salvare" });
    }
});

// ==========================================
// Analytics API
// ==========================================

app.get('/api/analytics', requireLogin, (req, res) => {
    const userId = req.session.userId;
    try {
        // 1. Spending by Category
        const categorySpending = db.prepare(`
            SELECT category, SUM(amount) as total 
            FROM expenses 
            WHERE user_id = ? 
            GROUP BY category
        `).all(userId);

        // 2. Daily Spending (Last 7 Days)
        const dailySpending = db.prepare(`
            SELECT date, SUM(amount) as total 
            FROM expenses 
            WHERE user_id = ? AND date >= date('now', '-6 days')
            GROUP BY date
            ORDER BY date ASC
        `).all(userId);

        // 3. Habits Progress (Last 7 Days)
        const dailyHabits = db.prepare(`
            SELECT date, COUNT(*) as completed 
            FROM habit_logs 
            WHERE user_id = ? AND date >= date('now', '-6 days')
            GROUP BY date
            ORDER BY date ASC
        `).all(userId);
        
        // 4. Savings Total
        const savingsTotal = db.prepare(`
            SELECT SUM(current_amount) as total 
            FROM savings_goals 
            WHERE user_id = ?
        `).get(userId);

        res.json({
            categorySpending,
            dailySpending,
            dailyHabits,
            savingsTotal: savingsTotal.total || 0
        });
    } catch (err) {
        res.status(500).json({ error: "Eroare DB Analytics" });
    }
});

// ==========================================
// Periodic Tasks
// ==========================================
// Șterge activitățile finalizate de peste 1 oră
setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    try {
        const info = db.prepare(`DELETE FROM activities WHERE is_finished = 1 AND finished_at < ?`).run(oneHourAgo);
        if (info.changes > 0) {
            console.log(`Cleanup: Am șters ${info.changes} activități finalizate de peste o oră.`);
        }
    } catch (err) {
        console.error("Eroare cleanup activități:", err);
    }
}, 60000); // Rulează la fiecare minut

// ==========================================
// Kanban / Tasks API
// ==========================================

app.get('/api/tasks', requireLogin, (req, res) => {
    const userId = req.session.userId;
    try {
        const rows = db.prepare(`SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC`).all(userId);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Eroare DB" });
    }
});

app.post('/api/tasks', requireLogin, (req, res) => {
    const { title, description, priority } = req.body;
    const userId = req.session.userId;
    if (!title) return res.status(400).json({ error: "Titlul este obligatoriu." });

    try {
        db.prepare(`INSERT INTO tasks (user_id, title, description, priority) VALUES (?, ?, ?, ?)`).run(userId, title, description, priority || 'medium');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare salvare task" });
    }
});

app.patch('/api/tasks/:id/status', requireLogin, (req, res) => {
    const { status } = req.body;
    const id = req.params.id;
    const userId = req.session.userId;
    try {
        db.prepare(`UPDATE tasks SET status = ? WHERE id = ? AND user_id = ?`).run(status, id, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare actualizare status" });
    }
});

app.delete('/api/tasks/:id', requireLogin, (req, res) => {
    const id = req.params.id;
    const userId = req.session.userId;
    try {
        db.prepare(`DELETE FROM tasks WHERE id = ? AND user_id = ?`).run(id, userId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare ștergere task" });
    }
});

// ==========================================
// Server Start
// ==========================================
app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Serverul rulează la adresa ${url}`);

    // Deschide browserul automat în funcție de sistemul de operare
    const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
    exec(`${start} ${url}`);
});
