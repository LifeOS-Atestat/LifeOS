/* --- GLOBAL CONFIG --- */
function initClock() {
    let clockEl = document.getElementById('globalClock');
    if (!clockEl) {
        clockEl = document.createElement('div');
        clockEl.id = 'globalClock';
        clockEl.className = 'app-clock';
        document.body.appendChild(clockEl);
    }
    const update = () => {
        const now = new Date();
        clockEl.innerText = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    update();
    setInterval(update, 1000);
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClock);
} else {
    initClock();
}

/* --- TOAST NOTIFICATIONS --- */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

const API = {
    me: '/api/me',
    login: '/api/login',
    logout: '/api/logout',
    register: '/api/register',
    budget: '/api/budget',
    budgetAdd: '/api/budget/add',
    expenses: '/api/expenses',
    activities: '/api/activities',
    nextActivity: '/api/next-activity',
    suggest: '/api/suggest-slot',
    habits: '/api/habits',
    notes: '/api/notes',
    savings: '/api/savings',
    analytics: '/api/analytics'
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Identify Page Type
    const isAuthPage = document.querySelector('body.auth-page');
    const isAppPage = document.querySelector('body.app-page');

    // 2. Global Auth Check for App Pages
    if (isAppPage) {
        checkAuth();
        initDateDisplay();
        renderSidebar(); // Shared Nav
        initGlobalModals(); // Shared Modals
        if (document.getElementById('col-todo')) initTasks();
    }

    // 3. Page Specific Logic
    if (document.getElementById('loginForm')) initLogin();
    if (document.getElementById('registerForm')) initRegister();
    if (document.getElementById('timelineList')) { initDashboard(); initTasksWidget(); } // Home
    if (document.getElementById('remainingBudget')) initBudget(); // Budget Page
    if (document.getElementById('actModal')) initSchedule(); // Schedule Page
    if (document.getElementById('habitsList')) initHabits(); // Habits Page
    if (document.getElementById('notesList')) initNotes(); // Notes Page
    if (document.getElementById('weatherDashboard')) initWeatherDashboard(); // Dashboard Weather
    if (document.getElementById('weatherMain')) initWeatherPage(); // Weather Page
    if (document.getElementById('goalsList')) initSavings(); // Savings Page
    if (document.getElementById('savingsSummary')) initSavingsWidget(); // Dashboard Widget
    if (document.getElementById('waterTotal')) initHydration(); // Hydration Widget
    if (document.getElementById('categoryChart')) initAnalytics(); // Analytics Page
});

function renderSidebar() {
    const sidebar = document.querySelector('nav.sidebar');
    if (!sidebar) return;

    const path = window.location.pathname;
    
    // Configurație Meniu
    const menuItems = [
        { href: '/dashboard', icon: '🏠', text: 'Acasă' },
        { href: '/budget', icon: '💰', text: 'Buget' },
        { href: '/schedule', icon: '📅', text: 'Timp' },
        { href: '/tasks', icon: '📋', text: 'Proiecte' },
        { href: '/habits', icon: '📈', text: 'Obiceiuri' },
        { href: '/notes', icon: '📝', text: 'Note' },
        { href: '/weather', icon: '🌤️', text: 'Vreme' },
        { href: '/savings', icon: '💎', text: 'Economii' },
        { href: '/analytics', icon: '📊', text: 'Statistici' },
        { href: '/settings', icon: '⚙️', text: 'Setări' }
    ];

    let html = `
        <div class="logo">
            <img src="/favicon.png" alt="LifeOS Logo" style="width: 28px; height: 28px; border-radius: 6px;">
            LifeOS
        </div>
    `;

    menuItems.forEach(item => {
        const isActive = path === item.href ? 'active' : '';
        html += `<a href="${item.href}" class="nav-item ${isActive}">${item.icon} ${item.text}</a>`;
    });

    html += `
        <div class="user-profile">
            <div class="avatar" id="userInitial">U</div>
            <div>
                <div style="font-size: 0.9rem; font-weight: 500;" id="userName">Loading...</div>
                <button onclick="logout()" 
                    style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.8rem; padding: 0;">Deconectare</button>
            </div>
        </div>
    `;

    sidebar.innerHTML = html;
}

/* --- AUTHENTICATION --- */
function checkAuth() {
    fetch(API.me).then(res => {
        if (res.status === 401 || res.status === 403) window.location.href = '/login';
        return res.json();
    }).then(data => {
        // Update all user info instances
        const initialEls = document.querySelectorAll('#userInitial');
        const nameEls = document.querySelectorAll('#userName');

        nameEls.forEach(el => el.innerText = data.username);

        // Handle Avatar
        if (data.avatar_url) {
            initialEls.forEach(el => {
                el.innerHTML = `<img src="${data.avatar_url}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                el.style.backgroundColor = 'transparent';
            });
            // Update settings preview if on settings page
            const settingsImg = document.getElementById('settingsAvatarImg');
            const settingsInitial = document.getElementById('settingsAvatarPreview');
            if (settingsImg && settingsInitial) {
                settingsImg.src = data.avatar_url;
                settingsImg.style.display = 'block';
                settingsInitial.style.display = 'none';
            }
        } else {
            initialEls.forEach(el => {
                el.innerText = data.username.charAt(0).toUpperCase();
                el.style.backgroundColor = ''; // Reset to css default
            });
        }

        if (document.getElementById('welcomeUser')) {
            document.getElementById('welcomeUser').innerText = data.username;
        }
    }).catch(() => window.location.href = '/login');
}

// --- SETTINGS PAGE ---
function previewAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = document.getElementById('settingsAvatarImg');
            const initial = document.getElementById('settingsAvatarPreview');
            img.src = e.target.result;
            img.style.display = 'block';
            initial.style.display = 'none';
            document.getElementById('btnUpload').disabled = false;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

if (document.getElementById('avatarForm')) {
    document.getElementById('avatarForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const statusDiv = document.getElementById('uploadStatus');

        statusDiv.innerText = 'Se încarcă...';
        statusDiv.style.color = '#94a3b8';

        try {
            const res = await fetch('/api/upload-avatar', {
                method: 'POST',
                body: formData
            });
            const result = await res.json();

            if (result.success) {
                statusDiv.innerText = 'Salvată cu succes!';
                statusDiv.style.color = 'var(--success)';
                // Refresh auth to update sidebar immediately
                checkAuth();
            } else {
                statusDiv.innerText = 'Eroare: ' + result.error;
                statusDiv.style.color = 'var(--danger)';
            }
        } catch (err) {
            console.error(err);
            statusDiv.innerText = 'Eroare de rețea.';
        }
    });
}

function initLogin() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        try {
            const res = await fetch(API.login, {
                method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' }
            });
            const result = await res.json();
            if (result.success) window.location.href = result.redirect;
            else showAuthError(result.error);
        } catch (err) { console.error(err); }
    });
}

function initRegister() {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        if (!data.adminKey) delete data.adminKey;
        try {
            const res = await fetch(API.register, {
                method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' }
            });
            const result = await res.json();
            if (result.success) { showToast('Cont creat!', 'success'); window.location.href = '/login'; }
            else showAuthError(result.error);
        } catch (err) { console.error(err); }
    });
}

function showAuthError(msg) {
    const errDiv = document.getElementById('error-msg');
    errDiv.innerText = msg;
    errDiv.style.display = 'block';
}

function toggleAdmin() {
    const el = document.getElementById('admin-input');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function logout() {
    fetch(API.logout, { method: 'POST' }).then(() => window.location.href = '/login');
}

/* --- DASHBOARD (HOME) --- */
function initDashboard() {
    // Budget Summary for Widget
    fetch(API.budget).then(res => res.json()).then(data => {
        document.getElementById('budgetSummary').innerText = `${data.remaining.toFixed(2)} RON`;
        document.getElementById('dailyRec').innerText = `${data.dailyBudget} RON`;

        const percent = data.totalBudget > 0 ? ((data.totalExpenses / data.totalBudget) * 100) : 0;
        const width = Math.min(percent, 100);
        const bar = document.getElementById('budgetBar');
        bar.style.width = `${width}%`;

        if (width < 50) bar.style.backgroundColor = 'var(--success)';
        else if (width < 80) bar.style.backgroundColor = 'var(--warning)';
        else bar.style.backgroundColor = 'var(--danger)';

        document.getElementById('spentLabel').innerText = `Cheltuit: ${data.totalExpenses} RON (${width.toFixed(0)}%)`;
        document.getElementById('daysLabel').innerText = `Zile rămase: ${data.daysLeft}`;
    });

    // Habits Progress for Widget
    fetch(API.habits).then(res => res.json()).then(habits => {
        const textEl = document.getElementById('habitStatText');
        const bar = document.getElementById('habitBar');
        const circle = document.getElementById('habitCircle');
        if (!textEl || !bar) return;

        const total = habits.length;
        const completed = habits.filter(h => h.completed_today).length;
        const percent = total > 0 ? (completed / total) * 100 : 0;

        textEl.innerText = `${completed} / ${total}`;
        bar.style.width = `${percent}%`;

        if (percent === 100 && total > 0) {
            circle.style.borderColor = '#10b981';
            circle.style.background = 'rgba(16, 185, 129, 0.1)';
        }
    });

    // Timeline
    fetch(API.nextActivity).then(res => res.json()).then(data => {
        const list = document.getElementById('timelineList');
        list.innerHTML = '';
        if (data.activities && data.activities.length > 0) {
            data.activities.forEach(act => {
                const div = document.createElement('div');
                div.className = 'timeline-item';
                div.innerHTML = `
                    <div class="timeline-date">
                        <span class="timeline-day">${act.dateStr.split(' ')[0]}</span>
                        <span class="timeline-time">${act.time}</span>
                    </div>
                    <div class="timeline-info">
                        <h4>${act.title}</h4>
                        <p>${act.days_until}</p>
                    </div>`;
                list.appendChild(div);
            });
        } else {
            list.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: #94a3b8; font-style: italic;">Nicio activitate planificată recent. Relaxează-te! 🌴</div>';
        }
    });
}

/* --- BUDGET PAGE --- */
function initBudget() {
    loadFinancialData();
    loadCategories();
}

function loadFinancialData() {
    fetch(API.budget).then(res => res.json()).then(data => {
        document.getElementById('remainingBudget').innerText = `${data.remaining.toFixed(2)} RON`;
        document.getElementById('dailyBudget').innerText = `${data.dailyBudget} RON`;
        document.getElementById('expensesToday').innerText = `${data.expensesToday.toFixed(2)} RON`;
        document.getElementById('daysLeft').innerText = data.daysLeft;

        const percent = data.totalBudget > 0 ? ((data.remaining / data.totalBudget) * 100).toFixed(0) : 0;
        const color = percent > 50 ? 'var(--success)' : (percent > 20 ? 'var(--warning)' : 'var(--danger)');
        document.getElementById('budgetProgress').innerHTML = `<span style="color: ${color}">${percent}%</span> din bugetul total`;

        // --- Render Chart (Detailed) ---
        fetch('/api/expenses/month').then(res => res.json()).then(expenses => {
            const ctx = document.getElementById('budgetChart');
            if (ctx) {
                if (window.budgetChartInstance) window.budgetChartInstance.destroy();

                // Group expenses by category for a cleaner chart
                const catMap = {};
                expenses.forEach(e => {
                    const cat = e.category || 'General';
                    catMap[cat] = (catMap[cat] || 0) + e.amount;
                });

                const labels = Object.keys(catMap);
                const values = Object.values(catMap);
                
                const colors = labels.map((name, i) => {
                    // Try to find if user set a specific color for this category
                    // (Actually needs a fetch for categories too, but let's stick to generating unless we have it)
                    const hue = 220 + (i * 45); 
                    return `hsl(${hue % 360}, 65%, 60%)`;
                });

                // Add Remaining
                if (data.remaining > 0) {
                    labels.push('Rămas');
                    values.push(data.remaining);
                    colors.push('#10b981'); // Green
                }

                // --- Calculate "Visual" Values for Chart ---
                // Goal: Ensure every slice is at least ~1.5% - 2% of the visual total so it can be seen/hovered
                const totalVal = values.reduce((a, b) => a + b, 0);
                const minSlice = totalVal * 0.02; // 2% minimum

                const displayValues = values.map(v => (v > 0 && v < minSlice) ? minSlice : v);

                window.budgetChartInstance = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: displayValues, // Use adjusted values for rendering
                            backgroundColor: colors,
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Inter' }, boxWidth: 12 } },
                            tooltip: {
                                callbacks: {
                                    label: function (context) {
                                        // Retrieve the REAL value using the index
                                        const realValue = values[context.dataIndex];
                                        return ` ${context.label}: ${realValue.toFixed(2)} RON`;
                                    }
                                }
                            }
                        },
                        cutout: '65%'
                    }
                });
            }
        });
    });

    fetch(API.expenses).then(res => res.json()).then(expenses => {
        const list = document.getElementById('expensesList');
        list.innerHTML = '';
        if (expenses.length === 0) list.innerHTML = '<li style="color: #94a3b8; font-size: 0.9rem;">Nu ai cheltuieli recente.</li>';
        expenses.forEach(ex => {
            const li = document.createElement('li');
            li.style.cssText = 'padding: 0.75rem 0; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;';

            // Format date slightly (e.g. from 2026-01-15 to 15 Jan)
            const d = new Date(ex.date);
            const dateLabel = d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });

            li.innerHTML = `
                <div style="flex: 1;">
                    <div style="font-weight: 500;">${ex.description}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8; display: flex; gap: 0.5rem; align-items: center; margin-top: 0.2rem;">
                        <span>${dateLabel}</span>
                        <span style="background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem;">${ex.category || 'General'}</span>
                    </div>
                </div>
                <span style="font-weight: 600; color: #fca5a5;">-${ex.amount.toFixed(2)} RON</span>
            `;
            list.appendChild(li);
        });
    });
}

function saveBudget() {
    const amount = document.getElementById('newBudgetAmount').value;
    if (!amount) return showToast('Introdu suma!', 'warning');
    fetch(API.budget, { method: 'POST', body: JSON.stringify({ amount }), headers: { 'Content-Type': 'application/json' } })
        .then(() => { closeModal('budgetModal'); loadFinancialData(); showToast('Buget setat!', 'success'); });
}

function saveAddedBudget() {
    const amount = document.getElementById('topupAmount').value;
    if (!amount) return showToast('Introdu suma!', 'warning');
    fetch(API.budgetAdd, { method: 'PATCH', body: JSON.stringify({ amount }), headers: { 'Content-Type': 'application/json' } })
        .then(() => { closeModal('addBudgetModal'); loadFinancialData(); showToast('Fonduri adăugate!', 'success'); });
}

function loadCategories() {
    fetch('/api/budget/categories')
        .then(res => res.json())
        .then(categories => {
            const list = document.getElementById('categoriesList');
            const select = document.getElementById('expenseCategory');
            const manageList = document.getElementById('manageCategoriesList');
            if (!list) return;

            // Update Dropdown
            if (select) {
                select.innerHTML = '<option value="General">General</option>';
                categories.forEach(c => {
                    select.innerHTML += `<option value="${c.name}">${c.name}</option>`;
                });
            }

            // Update Management List
            if (manageList) {
                manageList.innerHTML = categories.length === 0 ? '<p style="color: #94a3b8; font-size: 0.8rem;">Nicio categorie setată.</p>' : '';
                categories.forEach(c => {
                    manageList.innerHTML += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <div>
                                <span style="background: ${c.color}; width: 10px; height: 10px; display: inline-block; border-radius: 50%; margin-right: 0.5rem;"></span>
                                <b>${c.name}</b>: ${c.monthly_limit} RON
                            </div>
                            <button onclick="deleteCategory(${c.id})" style="background: none; border: none; color: #ef4444; cursor: pointer;">🗑️</button>
                        </div>
                    `;
                });
            }

            // Update Progress Bars (Limits)
            fetch('/api/expenses/month')
                .then(res => res.json())
                .then(expenses => {
                    list.innerHTML = '';
                    if (categories.length === 0) list.innerHTML = '<div style="color: #94a3b8; font-size: 0.85rem; font-style: italic;">Nicio limită setată.</div>';
                    
                    categories.forEach(c => {
                        const spent = expenses.filter(e => e.category === c.name).reduce((sum, e) => sum + e.amount, 0);
                        const percent = c.monthly_limit > 0 ? (spent / c.monthly_limit) * 100 : 0;
                        const barColor = percent >= 100 ? '#ef4444' : (percent > 80 ? '#fbbf24' : c.color);

                        list.innerHTML += `
                            <div style="margin-bottom: 1.25rem;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.4rem;">
                                    <span>${c.name}</span>
                                    <b>${spent.toFixed(0)} / ${c.monthly_limit} RON</b>
                                </div>
                                <div style="background: rgba(255,255,255,0.03); height: 6px; border-radius: 3px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                                    <div style="width: ${Math.min(percent, 100)}%; height: 100%; background: ${barColor}; border-radius: 3px; transition: all 0.4s ease;"></div>
                                </div>
                                ${percent >= 100 ? '<div style="color: #ef4444; font-size: 0.75rem; margin-top: 0.3rem; font-weight: 600;">⚠️ Limită depășită!</div>' : ''}
                            </div>
                        `;
                    });
                });
        });
}

function saveCategory() {
    const name = document.getElementById('catName').value;
    const monthly_limit = document.getElementById('catLimit').value;
    const color = document.getElementById('catColor').value;
    if (!name) return showToast('Nume categorie obligatoriu!', 'warning');

    fetch('/api/budget/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, monthly_limit, color })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            showToast('Categorie salvată!', 'success');
            loadCategories();
            document.getElementById('catName').value = '';
            document.getElementById('catLimit').value = '';
        }
    });
}

function deleteCategory(id) {
    showConfirm("Șterge Categorie", "Sigur vrei să ștergi această categorie și limita ei?", () => {
        fetch(`/api/budget/categories/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast('Categorie ștearsă.', 'info');
                    loadCategories();
                }
            });
    });
}

function saveExpense() {
    const amount = document.getElementById('expenseAmount').value;
    const desc = document.getElementById('expenseDesc').value;
    const category = document.getElementById('expenseCategory').value;
    if (!amount) return showToast('Suma este obligatorie!', 'warning');
    
    fetch(API.expenses, { 
        method: 'POST', 
        body: JSON.stringify({ amount, description: desc, category }), 
        headers: { 'Content-Type': 'application/json' } 
    }).then(() => { 
        closeModal('expenseModal'); 
        loadFinancialData(); 
        loadCategories(); // Refresh bars
    });
}

/* --- SCHEDULE PAGE --- */
function initSchedule() {
    // Highlight today
    const today = new Date().getDay();
    const todayCol = document.getElementById(`col-${today}`);
    if (todayCol) {
        todayCol.parentElement.classList.add('today');
    }

    // Initialize Flatpickr if available
    if (window.flatpickr) {
        flatpickr("#actDate", { enableTime: true, dateFormat: "Y-m-d H:i", time_24hr: true, locale: "ro", minDate: "today", disableMobile: "true", theme: "dark" });
        flatpickr("#recurTime", { enableTime: true, noCalendar: true, dateFormat: "H:i", time_24hr: true, locale: "ro", theme: "dark" });
    }

    // Load
    fetch(API.activities).then(res => res.json()).then(data => data.forEach(renderActivity));
}

function renderActivity(act) {
    let colId, timeDisplay, dateInfo = '';
    const now = new Date();
    let actDate = null;

    if (act.type === 'fixed') {
        actDate = new Date(act.start_data);
        colId = `col-${actDate.getDay()}`;
        timeDisplay = actDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        dateInfo = actDate.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
    } else {
        const parts = act.start_data.split(' ');
        if (parts.length === 2) {
            const days = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
            const targetDay = days[parts[0]];
            colId = `col-${targetDay}`;
            timeDisplay = parts[1];
            dateInfo = "Săptămânal";

            // Calculate next occurrence for "days until"
            const [hour, minute] = parts[1].split(':').map(Number);
            actDate = new Date(now);
            actDate.setHours(hour, minute, 0, 0);
            let diff = targetDay - now.getDay();
            if (diff < 0 || (diff === 0 && actDate <= now)) diff += 7;
            actDate.setDate(now.getDate() + diff);
        } else return;
    }

    // Calculate "days until" and "time remaining"
    let daysUntilStr = '';
    if (act.is_finished && act.finished_at) {
        const finishedDate = new Date(act.finished_at);
        const elapsedMin = Math.floor((now - finishedDate) / (1000 * 60));
        daysUntilStr = `Terminat acum ${elapsedMin} min`;
    } else if (actDate) {
        const diffMsToday = actDate - now;
        const diffDays = Math.round((actDate.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            if (diffMsToday > 0) {
                const totalMin = Math.floor(diffMsToday / (1000 * 60));
                const h = Math.floor(totalMin / 60);
                const m = totalMin % 60;
                daysUntilStr = `Azi (peste ${h > 0 ? h + 'h ' : ''}${m}min)`;
            } else {
                // Check if it's currently happening
                const durationMs = (act.duration || 0) * 60 * 1000;
                if (diffMsToday + durationMs > 0) {
                    daysUntilStr = "Azi (În desfășurare 🟢)";
                } else {
                    daysUntilStr = "Azi (S-a încheiat)";
                }
            }
        } else if (diffDays === 1) {
            daysUntilStr = 'Mâine';
        } else if (diffDays > 1) {
            daysUntilStr = `În ${diffDays} zile`;
        } else {
            daysUntilStr = 'A trecut';
        }
    }

    const container = document.getElementById(colId);
    if (container) {
        const card = document.createElement('div');
        card.className = `event-card ${act.is_finished ? 'is-finished' : ''}`;
        card.id = `act-${act.id}`;
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div class="event-time">${timeDisplay} <span style="opacity: 0.6; font-weight: 400; margin-left: 4px;">• ${dateInfo}</span></div>
                    <div style="font-weight: 600; margin: 2px 0;">${act.title}</div>
                    <div class="event-status" style="font-size: 0.7rem; color: var(--primary); font-weight: 500;">${daysUntilStr}</div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <button onclick="requestDelete(this, ${act.id})" class="btn-delete-act" title="Șterge">×</button>
                    ${!act.is_finished ? `<button onclick="finishActivity(this, ${act.id})" class="btn-finish-act" title="Marchează ca terminat">✓</button>` : ''}
                </div>
            </div>
        `;
        container.appendChild(card);
    }
}

function requestDelete(btn, id) {
    // Find the card element (parent of parent of button typically, based on structure)
    // Structure: .event-card > div > [content, button]
    const card = btn.closest('.event-card');

    // Check if already open
    if (card.querySelector('.delete-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'delete-overlay';
    overlay.innerHTML = `
        <span style="font-size: 0.75rem; color: #fff;">Ștergi?</span>
        <button class="btn-confirm-yes" onclick="confirmDelete(${id})">Da</button>
        <button class="btn-confirm-no" onclick="cancelDelete(this)">Nu</button>
    `;
    card.appendChild(overlay);
}

function cancelDelete(btn) {
    btn.closest('.delete-overlay').remove();
}

function confirmDelete(id) {
    fetch(`${API.activities}/${id}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                location.reload();
            }
            else showToast('Eroare la ștergere!', 'error');
        });
}

function finishActivity(btn, id) {
    const card = btn.closest('.event-card');
    if (!card) return;

    // Call completion API
    fetch(`${API.activities}/${id}/finish`, { method: 'PATCH' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // Apply "is-finished" state visually
                card.classList.add('is-finished');
                // Update status text instantly
                const statusEl = card.querySelector('.event-status');
                if (statusEl) statusEl.innerText = "Terminat acum 0 min";

                // Remove the finish button
                const finishBtn = card.querySelector('.btn-finish-act');
                if (finishBtn) finishBtn.remove();

                // Add a small temporary glow for feedback
                card.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.5)';
                setTimeout(() => card.style.boxShadow = '', 2000);
            }
        });
}

function setType(type) {
    document.getElementById('actType').value = type;
    const btnFixed = document.getElementById('btnFixed');
    const btnRecur = document.getElementById('btnRecurring');
    const boxFixed = document.getElementById('inputFixed');
    const boxRecur = document.getElementById('inputRecurring');

    if (type === 'fixed') {
        btnFixed.style.cssText = 'background: var(--primary); color: white; border-color: var(--primary);';
        btnRecur.style.cssText = 'background: transparent; color: #94a3b8; border-color: #334155;';
        boxFixed.style.display = 'block'; boxRecur.style.display = 'none';
    } else {
        btnRecur.style.cssText = 'background: var(--primary); color: white; border-color: var(--primary);';
        btnFixed.style.cssText = 'background: transparent; color: #94a3b8; border-color: #334155;';
        boxFixed.style.display = 'none'; boxRecur.style.display = 'block';
    }
}

function saveActivity() {
    const title = document.getElementById('actTitle').value;
    const type = document.getElementById('actType').value;
    let start = '';
    if (type === 'fixed') {
        start = document.getElementById('actDate').value;
        if (!start) return showToast("Selectează data și ora!", "warning");
    } else {
        const dayIndex = document.getElementById('recurDay').value;
        const time = document.getElementById('recurTime').value;
        if (!time) return showToast("Selectează ora!", "warning");
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        start = `${days[dayIndex]} ${time}`;
    }
    fetch(API.activities, { method: 'POST', body: JSON.stringify({ title, type, start_data: start, duration: 60 }), headers: { 'Content-Type': 'application/json' } })
        .then(() => { closeModal('actModal'); showToast("Activitate salvată!", "success"); setTimeout(() => location.reload(), 1000); });
}

function getSuggestion() {
    fetch(API.suggest, { method: 'POST', body: JSON.stringify({ duration: 60 }), headers: { 'Content-Type': 'application/json' } })
        .then(res => res.json())
        .then(suggestions => {
            if (suggestions.length > 0) showToast(`Sugestie: ${suggestions[0].label}`, "info");
        });
}

/* --- COMMON UTILS --- */
function openModal(id = 'actModal') { document.getElementById(id).style.display = 'flex'; }
function closeModal(id = 'actModal') { document.getElementById(id).style.display = 'none'; }

function initGlobalModals() {
    if (document.getElementById('confirmModal')) return;
    
    const div = document.createElement('div');
    div.id = 'confirmModal';
    div.className = 'modal';
    div.innerHTML = `
        <div class="card" style="max-width: 350px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.2);">
            <h3 style="color: #ef4444; margin-bottom: 0.5rem;">Ești sigur? 🗑️</h3>
            <p id="confirmMessage" style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 1.5rem;">Această acțiune nu poate fi anulată.</p>
            
            <div style="display: flex; gap: 0.75rem;">
                <button id="confirmBtn" class="btn-primary" style="flex: 1; background: #ef4444;">Șterge</button>
                <button onclick="closeModal('confirmModal')" class="btn-secondary" style="flex: 1;">Anulează</button>
            </div>
        </div>
    `;
    document.body.appendChild(div);
}

function showConfirm(title, message, callback) {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
        if (confirm(message)) callback();
        return;
    }
    
    // Set title and message
    const titleEl = modal.querySelector('h3');
    const msgEl = document.getElementById('confirmMessage');
    if (titleEl) titleEl.innerText = title;
    if (msgEl) msgEl.innerText = message;
    
    // Update confirm button
    const btn = document.getElementById('confirmBtn');
    if (btn) {
        // Remove old listeners by cloning
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.onclick = () => {
            callback();
            closeModal('confirmModal');
        };
    }
    
    openModal('confirmModal');
}
/* --- HABIT TRACKER --- */
function initHabits() {
    loadHabits();
}

function loadHabits() {
    fetch(API.habits)
        .then(res => res.json())
        .then(habits => {
            const list = document.getElementById('habitsList');
            if (!list) return;
            list.innerHTML = '';

            if (habits.length === 0) {
                list.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 2rem; font-style: italic;">Niciun obicei setat încă. Începe unul azi! 🚀</div>';
                return;
            }

            habits.forEach(h => {
                const card = document.createElement('div');
                card.className = 'card';
                card.style.borderLeft = `4px solid ${h.color}`;
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h4 style="margin: 0; font-size: 1.1rem;">${h.title}</h4>
                            <div style="margin-top: 0.4rem; font-size: 0.8rem;">
                                ${h.streak > 2 ? `<span style="color: #fb923c; font-weight: 700;">🔥 ${h.streak} Zile la rând!</span>` : 
                                  h.streak > 0 ? `<span style="color: var(--primary); font-weight: 600;">🔥 Streak: ${h.streak}</span>` : 
                                  '<span style="color: #94a3b8; font-style: italic;">Începe astăzi!</span>'}
                            </div>
                        </div>
                        <button onclick="deleteHabit(${h.id})" class="btn-delete-act" style="padding: 2px 6px; font-size: 1.1rem;">×</button>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 1.5rem;">
                         <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 500;">Bifat astăzi?</span>
                         <div onclick="toggleHabit(${h.id})" 
                              style="width: 36px; height: 36px; border: 2px solid ${h.color}; border-radius: 50%; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                              background: ${h.completed_today ? h.color : 'rgba(255,255,255,0.05)'};
                              box-shadow: ${h.completed_today ? `0 0 10px ${h.color}55` : 'none'};
                              display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;
                              transform: ${h.completed_today ? 'scale(1.1)' : 'scale(1)'}">
                              ${h.completed_today ? '✓' : ''}
                         </div>
                    </div>
                `;
                list.appendChild(card);
            });
        });
}

function toggleHabit(id) {
    fetch(`/api/habits/${id}/toggle`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                loadHabits();
                if (data.completed) showToast("Excelent! Continuă tot așa! 🔥", "success");
                else showToast("Am de-bifat obiceiul.", "info");
            }
        });
}

function saveHabit() {
    const title = document.getElementById('habitTitle').value;
    const color = document.getElementById('habitColor').value;
    if (!title) return showToast("Introdu un nume pentru obicei!", "warning");

    fetch(API.habits, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, color })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            closeModal('habitModal');
            loadHabits();
            showToast("Obicei nou adăugat!", "success");
            document.getElementById('habitTitle').value = '';
        }
    });
}

function deleteHabit(id) {
    showConfirm("Șterge Obicei", "Sigur vrei să ștergi acest obicei și tot istoricul lui?", () => {
        fetch(`/api/habits/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    loadHabits();
                    showToast("Obicei eliminat.", "info");
                }
            });
    });
}

/* --- NOTES / JOURNAL --- */
function initNotes() {
    loadNotes();
}

function loadNotes() {
    fetch(API.notes)
        .then(res => res.json())
        .then(notes => {
            const list = document.getElementById('notesList');
            if (!list) return;
            list.innerHTML = '';

            if (notes.length === 0) {
                list.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 3rem; font-style: italic;">Nicio notă încă. Scrie ceva acum! 📝</div>';
                return;
            }

            notes.forEach(n => {
                const card = document.createElement('div');
                card.className = 'note-card';
                card.style.background = n.color || 'rgba(255, 255, 255, 0.05)';
                const isColored = n.color && n.color !== '#ffffff';
                if (isColored) {
                    card.style.color = '#1e293b'; 
                }
                
                const deleteBtnColor = isColored ? '#1e293b' : '#ef4444';

                card.innerHTML = `
                    <div class="note-header">
                        <strong style="font-size: 1.1rem;">${n.title || 'Fără titlu'}</strong>
                        <button onclick="deleteNote(${n.id})" 
                                style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: ${deleteBtnColor}; opacity: 0.7;">×</button>
                    </div>
                    <div class="note-content" style="${isColored ? 'color: #1e293b;' : ''}">${n.content}</div>
                    <div class="note-date" style="${isColored ? 'border-top-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.5);' : ''}">
                        ${new Date(n.created_at).toLocaleString('ro-RO')}
                    </div>
                `;
                list.appendChild(card);
            });
        });
}

function setNoteColor(color, el) {
    document.getElementById('noteColor').value = color;
    if (el) {
        document.querySelectorAll('.color-picker').forEach(btn => btn.classList.remove('active'));
        el.classList.add('active');
    }
}

function saveNote() {
    const title = document.getElementById('noteTitle').value;
    const content = document.getElementById('noteContent').value;
    const color = document.getElementById('noteColor').value;

    if (!content) return showToast("Conținutul notei este obligatoriu!", "warning");

    fetch(API.notes, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, color })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            closeModal('noteModal');
            loadNotes();
            showToast("Notă salvată!", "success");
            document.getElementById('noteTitle').value = '';
            document.getElementById('noteContent').value = '';
            document.getElementById('noteColor').value = '#ffffff';
            // Reset active color class to white
            document.querySelectorAll('.color-picker').forEach(btn => btn.classList.remove('active'));
            const whiteBtn = Array.from(document.querySelectorAll('.color-picker')).find(b => b.style.background.includes('rgb(255, 255, 255)') || b.style.background.includes('#ffffff'));
            if (whiteBtn) whiteBtn.classList.add('active');
        }
    });
}

function deleteNote(id) {
    showConfirm("Șterge Notă", "Sigur vrei să ștergi această notă?", () => {
        fetch(`/api/notes/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    loadNotes();
                    showToast("Notă eliminată.", "info");
                }
            });
    });
}

/* --- WEATHER SERVICE --- */
const WEATHER_CODES = {
    0: { emoji: '☀️', text: 'Senin' },
    1: { emoji: '🌤️', text: 'Mai mult senin' },
    2: { emoji: '⛅', text: 'Parțial noros' },
    3: { emoji: '☁️', text: 'Noros' },
    45: { emoji: '🌫️', text: 'Ceață' },
    48: { emoji: '🌫️', text: 'Chiciură' },
    51: { emoji: '🌦️', text: 'Burniță ușoară' },
    53: { emoji: '🌦️', text: 'Burniță' },
    55: { emoji: '🌦️', text: 'Burniță densă' },
    61: { emoji: '🌧️', text: 'Ploaie ușoară' },
    63: { emoji: '🌧️', text: 'Ploaie' },
    65: { emoji: '🌧️', text: 'Ploaie torențială' },
    71: { emoji: '❄️', text: 'Zăpadă ușoară' },
    73: { emoji: '❄️', text: 'Zăpadă' },
    75: { emoji: '❄️', text: 'Zăpadă densă' },
    80: { emoji: '🌦️', text: 'Averse ușoare' },
    81: { emoji: '🌦️', text: 'Averse de ploaie' },
    82: { emoji: '🌦️', text: 'Averse violente' },
    95: { emoji: '🌩️', text: 'Furtună' }
};

function initWeatherDashboard() {
    getCoordinates((lat, lon) => {
        // 1. Fetch Weather
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`)
            .then(res => res.json())
            .then(data => {
                const current = data.current_weather;
                const weather = WEATHER_CODES[current.weathercode] || { emoji: '🌡️', text: 'Vreme' };
                
                const iconEl = document.getElementById('weatherIcon');
                const tempEl = document.getElementById('weatherTemp');
                const descEl = document.getElementById('weatherDesc');

                if (iconEl) iconEl.innerText = weather.emoji;
                if (tempEl) tempEl.innerText = `${Math.round(current.temperature)}°C`;
                if (descEl) descEl.innerText = weather.text;
            });

        // 2. Fetch City Name (Reverse Geocoding)
        fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`)
            .then(res => res.json())
            .then(data => {
                const locEl = document.getElementById('weatherLoc');
                if (locEl) {
                    const city = data.address.city || data.address.town || data.address.village || "Locație necunoscută";
                    locEl.innerText = `📍 ${city}`;
                }
            })
            .catch(() => {
                const locEl = document.getElementById('weatherLoc');
                if (locEl) locEl.innerText = "📍 Recunoaștere locație...";
            });
    });
}

function initWeatherPage() {
    getCoordinates((lat, lon) => {
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,apparent_temperature_max&timezone=auto`)
            .then(res => res.json())
            .then(data => {
                const current = data.current_weather;
                const daily = data.daily;
                const weather = WEATHER_CODES[current.weathercode] || { emoji: '🌡️', text: 'Vreme' };

                if (document.getElementById('mainIcon')) document.getElementById('mainIcon').innerText = weather.emoji;
                if (document.getElementById('mainDesc')) document.getElementById('mainDesc').innerText = weather.text;
                if (document.getElementById('mainTemp')) document.getElementById('mainTemp').innerText = `${Math.round(current.temperature)}°`;
                if (document.getElementById('mainHumidity')) document.getElementById('mainHumidity').innerText = '--%';
                if (document.getElementById('mainWind')) document.getElementById('mainWind').innerText = `${current.windspeed} km/h`;
                if (document.getElementById('mainFeels')) document.getElementById('mainFeels').innerText = `${Math.round(daily.apparent_temperature_max[0])}°`;

                // Fetch Location Name for Detail Page
                fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`)
                    .then(res => res.json())
                    .then(locData => {
                        const city = locData.address.city || locData.address.town || locData.address.village || "Locație necunoscută";
                        if (document.getElementById('mainLoc')) document.getElementById('mainLoc').innerText = `📍 ${city}`;
                    });

                const forecastGrid = document.getElementById('forecastGrid');
                if (forecastGrid) {
                    forecastGrid.innerHTML = '';
                    for (let i = 0; i < 7; i++) {
                        const date = new Date(daily.time[i]);
                        const dayName = i === 0 ? 'Azi' : date.toLocaleDateString('ro-RO', { weekday: 'short' });
                        const dayWeather = WEATHER_CODES[daily.weathercode[i]] || { emoji: '🌡️', text: 'Vreme' };

                        const card = document.createElement('div');
                        card.className = 'forecast-card';
                        card.innerHTML = `
                            <div style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 600;">${dayName}</div>
                            <div style="font-size: 2rem; margin: 0.5rem 0;">${dayWeather.emoji}</div>
                            <div style="font-weight: 700; font-size: 1.1rem;">${Math.round(daily.temperature_2m_max[i])}° <span style="font-weight: 400; color: #64748b; font-size: 0.9rem;">${Math.round(daily.temperature_2m_min[i])}°</span></div>
                            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem;">${dayWeather.text}</div>
                        `;
                        forecastGrid.appendChild(card);
                    }
                }
            });
    });
}

function getCoordinates(callback) {
    const saved = localStorage.getItem('user_location');
    if (saved) {
        const { lat, lon } = JSON.parse(saved);
        return callback(lat, lon);
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => callback(pos.coords.latitude, pos.coords.longitude),
            () => callback(44.43, 26.10) // Fallback to Bucharest
        );
    } else {
        callback(44.43, 26.10);
    }
}

function manualSearch() {
    const input = document.getElementById('citySearch');
    if (!input) return;
    const query = input.value;
    if (!query) return showToast("Introdu numele orașului!", "warning");
    
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`)
        .then(res => res.json())
        .then(results => {
            if (results.length > 0) {
                const { lat, lon } = results[0];
                const location = { lat: parseFloat(lat), lon: parseFloat(lon) };
                localStorage.setItem('user_location', JSON.stringify(location));
                initWeatherPage();
                showToast(`📍 Oraș setat: ${results[0].display_name.split(',')[0]}!`, "success");
            } else {
                showToast("Orașul nu a fost găsit.", "error");
            }
        })
        .catch(() => showToast("Eroare la căutare.", "error"));
}

function resetToGPS() {
    localStorage.removeItem('user_location');
    initWeatherPage();
    showToast("Am revenit la detectarea automată GPS.", "info");
}

/* --- SAVINGS GOALS --- */
function initSavings() {
    loadSavings();
}

function loadSavings() {
    fetch(API.savings)
        .then(res => res.json())
        .then(goals => {
            const list = document.getElementById('goalsList');
            if (!list) return;
            list.innerHTML = '';

            if (goals.length === 0) {
                list.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 3rem; font-style: italic;">Nu ai obiective setate. Creează unul acum! 💎</div>';
                return;
            }

            goals.forEach(g => {
                const percent = Math.min((g.current_amount / g.target_amount) * 100, 100);
                const card = document.createElement('div');
                card.className = 'goal-card';
                card.innerHTML = `
                    <div class="goal-header">
                        <strong style="color: ${g.color}; font-size: 1.1rem;">${g.title}</strong>
                        <button onclick="deleteGoal(${g.id})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size: 1.5rem; line-height: 1;">×</button>
                    </div>
                    <div class="goal-stats">
                        <span>Adunat: <b>${g.current_amount.toFixed(2)} RON</b></span>
                        <span>Țintă: <b>${g.target_amount.toFixed(2)} RON</b></span>
                    </div>
                    <div class="goal-progress-bg">
                        <div class="goal-progress-fill" style="width: ${percent}%; background: ${g.color};"></div>
                    </div>
                    <div style="font-size: 0.8rem; color: #64748b;">
                        Progres: <b>${percent.toFixed(1)}%</b> ${g.deadline ? `| Termen: ${new Date(g.deadline).toLocaleDateString('ro-RO')}` : ''}
                    </div>
                    <div class="goal-actions">
                        <input type="number" id="amt-${g.id}" class="goal-sum-input" placeholder="Sumă">
                        <button onclick="addSaving(${g.id})" class="btn-primary" style="padding: 0.5rem 1rem; border-radius: 8px;">➕ Adaugă</button>
                    </div>
                `;
                list.appendChild(card);
            });
        });
}

function saveGoal() {
    const title = document.getElementById('goalTitle').value;
    const target = document.getElementById('goalTarget').value;
    const color = document.getElementById('goalColor').value;
    const deadline = document.getElementById('goalDeadline').value;

    if (!title || !target) return showToast("Titlul și suma sunt obligatorii!", "warning");

    fetch(API.savings, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, target_amount: target, color, deadline })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            closeModal('goalModal');
            loadSavings();
            showToast("Obiectiv salvat!", "success");
            document.getElementById('goalTitle').value = '';
            document.getElementById('goalTarget').value = '';
        }
    });
}

function addSaving(id) {
    const input = document.getElementById(`amt-${id}`);
    const amount = parseFloat(input.value);
    if (!amount || amount <= 0) return showToast("Introdu o sumă validă!", "warning");

    fetch(`${API.savings}/${id}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            loadSavings();
            initSavingsWidget();
            showToast("Bani adăugați cu succes! 💰", "success");
            input.value = '';
        }
    });
}

function deleteGoal(id) {
    showConfirm("Șterge Obiectiv", "Sigur vrei să ștergi acest obiectiv?", () => {
        fetch(`${API.savings}/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    loadSavings();
                    showToast("Obicei eliminat.", "info");
                }
            });
    });
}

function initSavingsWidget() {
    fetch(API.savings)
        .then(res => res.json())
        .then(goals => {
            const summaryEl = document.getElementById('savingsSummary');
            if (!summaryEl) return;
            
            if (goals.length === 0) {
                summaryEl.innerHTML = '<div style="color: #94a3b8; font-size: 0.85rem; padding: 1rem 0; font-style: italic;">Niciun obiectiv activ.</div>';
                return;
            }

            // Sort by current amount descending
            const sortedGoals = [...goals].sort((a, b) => b.current_amount - a.current_amount);
            
            // Take top 2
            const topTwo = sortedGoals.slice(0, 2);
            
            summaryEl.innerHTML = topTwo.map((goal, idx) => {
                const percent = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
                return `
                    <div style="margin-top: ${idx === 0 ? '0.5rem' : '1.25rem'};">
                        <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 0.4rem;">
                            <span style="font-weight: 500;">${goal.title}</span>
                            <span style="color: ${goal.color}; font-weight: 700;">${percent.toFixed(0)}%</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.05); height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                            <div style="width: ${percent}%; height: 100%; background: ${goal.color}; border-radius: 4px; transition: width 0.3s ease;"></div>
                        </div>
                        <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.4rem; display: flex; justify-content: space-between;">
                            <span>${Math.round(goal.current_amount)} / ${Math.round(goal.target_amount)} RON</span>
                            <span style="opacity: 0.7;">Rămas: ${Math.max(0, Math.round(goal.target_amount - goal.current_amount))}</span>
                        </div>
                    </div>
                `;
            }).join('');
        });
}

/* --- POMODORO TIMER --- */
let pomoInterval;
let pomoSeconds = 25 * 60;
let pomoRunning = false;
let pomoMode = 'work'; 

function startPomodoro() {
    if (pomoRunning) return;
    pomoRunning = true;
    const btn = document.getElementById('pomoStartBtn');
    if (btn) btn.innerText = 'În curs...';
    pomoInterval = setInterval(() => {
        pomoSeconds--;
        const min = Math.floor(pomoSeconds / 60);
        const sec = pomoSeconds % 60;
        const el = document.getElementById('pomodoroTimer');
        if (el) el.innerText = `${min}:${sec.toString().padStart(2, '0')}`;
        
        if (pomoSeconds <= 0) {
            clearInterval(pomoInterval);
            pomoRunning = false;
            if (btn) btn.innerText = 'Start';
            showToast(pomoMode === 'work' ? "Munca s-a terminat! Ia o pauză. ☕" : "Pauza s-a terminat! Înapoi la muncă. 💪", "success");
            alert(pomoMode === 'work' ? "Timpul de muncă s-a terminat! Ia o pauză. ☕" : "Pauza s-a terminat! Înapoi la muncă. 💪");
            resetPomodoro();
        }
    }, 1000);
}

function pausePomodoro() {
    clearInterval(pomoInterval);
    pomoRunning = false;
    const btn = document.getElementById('pomoStartBtn');
    if (btn) btn.innerText = 'Start';
}

function resetPomodoro() {
    pausePomodoro();
    pomoSeconds = pomoMode === 'work' ? 25 * 60 : 5 * 60;
    const el = document.getElementById('pomodoroTimer');
    if (el) el.innerText = pomoMode === 'work' ? "25:00" : "5:00";
}

function setPomodoroMode(mode) {
    pomoMode = mode;
    const w = document.getElementById('modeWork');
    const s = document.getElementById('modeShort');
    if (w) w.classList.toggle('active', mode === 'work');
    if (s) s.classList.toggle('active', mode === 'short');
    resetPomodoro();
    resetPomodoro();
}

/* --- HYDRATION --- */
function initHydration() {
    loadHydration();
}

function loadHydration() {
    fetch('/api/hydration')
        .then(res => res.json())
        .then(data => {
            const total = data.total;
            const target = 2000;
            const percent = Math.min((total / target) * 100, 100);
            
            const totalEl = document.getElementById('waterTotal');
            const bar = document.getElementById('waterBar');
            const wave = document.getElementById('waterWave');

            if (totalEl) totalEl.innerText = `${total} / ${target} ml`;
            if (bar) bar.style.width = `${percent}%`;
            
            if (wave) {
                if (percent >= 100) wave.innerText = '🌊';
                else if (percent >= 50) wave.innerText = '💧';
                else wave.innerText = '🥛';
            }
        });
}

function addWater(amount) {
    fetch('/api/hydration/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_ml: amount })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            loadHydration();
            showToast(`Ai adăugat ${amount}ml de apă! 💧`, "success");
        }
    });
}

/* --- ANALYTICS --- */
function initAnalytics() {
    loadAnalytics();
}

function loadAnalytics() {
    fetch(API.analytics)
        .then(res => res.json())
        .then(data => {
            const totalEl = document.getElementById('totalSaved');
            if (totalEl) totalEl.innerText = `${data.savingsTotal.toFixed(2)} RON`;
            
            Chart.defaults.color = '#94a3b8';
            Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

            const ctx1 = document.getElementById('categoryChart')?.getContext('2d');
            if (ctx1) {
                new Chart(ctx1, {
                    type: 'doughnut',
                    data: {
                        labels: data.categorySpending.map(item => item.category),
                        datasets: [{
                            data: data.categorySpending.map(item => item.total),
                            backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } }
                    }
                });
            }

            const ctx2 = document.getElementById('spendingChart')?.getContext('2d');
            if (ctx2) {
                new Chart(ctx2, {
                    type: 'bar',
                    data: {
                        labels: data.dailySpending.map(item => item.date),
                        datasets: [{
                            label: 'RON Cheltuiți',
                            data: data.dailySpending.map(item => item.total),
                            backgroundColor: 'rgba(99, 102, 241, 0.5)',
                            borderColor: '#6366f1',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true } }
                    }
                });
            }

            const ctx3 = document.getElementById('habitChart')?.getContext('2d');
            if (ctx3) {
                new Chart(ctx3, {
                    type: 'line',
                    data: {
                        labels: data.dailyHabits.map(item => item.date),
                        datasets: [{
                            label: 'Obiceiuri Complate',
                            data: data.dailyHabits.map(item => item.completed),
                            borderColor: '#10b981',
                            tension: 0.3,
                            fill: true,
                            backgroundColor: 'rgba(16, 185, 129, 0.1)'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                    }
                });
            }
            
            const rateEl = document.getElementById('habitRate');
            if (rateEl && data.dailyHabits.length > 0) {
                const totalCompleted = data.dailyHabits.reduce((acc, curr) => acc + curr.completed, 0);
                const avg = totalCompleted / Math.max(1, data.dailyHabits.length);
                rateEl.innerText = `${avg.toFixed(1)} / zi`;
            }
        });
}

/* --- KANBAN BOARD / TASKS --- */
function initTasks() {
    loadTasks();
}

function loadTasks() {
    fetch('/api/tasks')
        .then(res => res.json())
        .then(tasks => {
            const containers = {
                todo: document.getElementById('container-todo'),
                'in-progress': document.getElementById('container-in-progress'),
                done: document.getElementById('container-done')
            };

            const counts = { todo: 0, 'in-progress': 0, done: 0 };
            Object.values(containers).forEach(c => { if(c) c.innerHTML = ''; });

            tasks.forEach(t => {
                const card = document.createElement('div');
                card.id = `task-${t.id}`;
                card.className = 'task-card';
                card.draggable = true;
                
                // Add drag listener manually since it's injected
                card.ondragstart = (ev) => {
                    ev.dataTransfer.setData("text", ev.target.id);
                    ev.target.classList.add('dragging');
                };
                card.ondragend = (ev) => ev.target.classList.remove('dragging');

                counts[t.status]++;
                
                card.innerHTML = `
                    <div class="priority-badge priority-${t.priority}">${t.priority}</div>
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${t.title}</div>
                    <div style="font-size: 0.8rem; color: #94a3b8;">${t.description || ''}</div>
                    <div class="task-actions">
                        <button onclick="deleteTask(${t.id})" class="btn-delete" title="Șterge">🗑️</button>
                    </div>
                `;

                if (containers[t.status]) containers[t.status].appendChild(card);
            });

            // Update counts
            Object.keys(counts).forEach(s => {
                const el = document.getElementById(`count-${s}`);
                if (el) el.innerText = counts[s];
            });
        });
}

function saveTask() {
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDesc').value;
    const priority = document.getElementById('taskPriority').value;

    if (!title) return showToast("Titlul este obligatoriu!", "warning");

    fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, priority })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            closeModal('taskModal');
            loadTasks();
            showToast("Task adăugat!", "success");
            document.getElementById('taskTitle').value = '';
            document.getElementById('taskDesc').value = '';
        }
    });
}

function updateTaskStatus(id, status) {
    fetch(`/api/tasks/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    }).then(() => {
        // Find counts
        loadTasks(); // Robust reload
    });
}

function deleteTask(id) {
    showConfirm("Șterge Task", "Sigur vrei să elimini acest task?", () => {
        fetch(`/api/tasks/${id}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    showToast("Task eliminat.", "info");
                    loadTasks();
                }
            });
    });
}

function initTasksWidget() {
    const container = document.getElementById('tasksDashboard');
    if (!container) return;

    fetch('/api/tasks')
        .then(res => res.json())
        .then(tasks => {
            container.innerHTML = '';
            
            // Filter: only show 'todo' or 'in-progress'
            const activeTasks = tasks.filter(t => t.status !== 'done').slice(0, 2);
            
            if (activeTasks.length === 0) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; padding: 1rem; text-align: center; color: #94a3b8; font-style: italic;">
                        Toate task-urile sunt finalizate! 🎉
                    </div>
                `;
                return;
            }

            activeTasks.forEach(t => {
                const card = document.createElement('div');
                card.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; justify-content: space-between;';
                
                const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
                const dotColor = priorityColors[t.priority] || '#94a3b8';

                card.innerHTML = `
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor};"></span>
                            <span style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: #64748b;">${t.priority}</span>
                        </div>
                        <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem;">${t.title}</div>
                        <div style="font-size: 0.75rem; color: #94a3b8; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${t.description || 'Fără descriere'}</div>
                    </div>
                    <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.7rem; background: rgba(99, 102, 241, 0.1); color: var(--primary); padding: 2px 8px; border-radius: 10px;">
                            ${t.status === 'in-progress' ? '⚡ În lucru' : '🎯 De făcut'}
                        </span>
                        <a href="/tasks" style="text-decoration: none; font-size: 0.8rem; opacity: 0.6; color: white;">✏️</a>
                    </div>
                `;
                container.appendChild(card);
            });
        });
}

function initDateDisplay() {
    const el = document.getElementById('dateDisplay');
    if (el) el.innerText = new Date().toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
