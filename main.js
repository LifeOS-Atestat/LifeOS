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

// --- ADD EXPENSE ---
app.post('/api/expenses', requireLogin, (req, res) => {
    const { amount, description, date } = req.body;
    const userId = req.session.userId;
    const expenseDate = date || new Date().toISOString().slice(0, 10);

    try {
        db.prepare(`INSERT INTO expenses (user_id, amount, description, date) VALUES (?, ?, ?, ?)`).run(userId, amount, description, expenseDate);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Eroare adăugare cheltuială" });
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
                upcoming.push({
                    title: act.title,
                    timestamp: actDate.getTime(),
                    time: actDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
                    dateStr: actDate.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric' }),
                    days_until: daysDiff === 0 ? 'Azi' : (daysDiff === 1 ? 'Mâine' : `În ${daysDiff} zile`)
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
// Server Start
// ==========================================
app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`Serverul rulează la adresa ${url}`);

    // Deschide browserul automat în funcție de sistemul de operare
    const start = (process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open');
    exec(`${start} ${url}`);
});
