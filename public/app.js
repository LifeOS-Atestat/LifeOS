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
    suggest: '/api/suggest-slot'
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Identify Page Type
    const isAuthPage = document.querySelector('body.auth-page');
    const isAppPage = document.querySelector('body.app-page');

    // 2. Global Auth Check for App Pages
    if (isAppPage) {
        checkAuth();
        initDateDisplay();
    }

    // 3. Page Specific Logic
    if (document.getElementById('loginForm')) initLogin();
    if (document.getElementById('registerForm')) initRegister();
    if (document.getElementById('timelineList')) initDashboard(); // Home
    if (document.getElementById('remainingBudget')) initBudget(); // Budget Page
    if (document.getElementById('actModal')) initSchedule(); // Schedule Page
});

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

                const labels = expenses.map(e => e.description);
                const values = expenses.map(e => e.amount);
                const colors = expenses.map((_, i) => {
                    // Generate palette: Red/Orange/Pink spectrum for expenses
                    const hue = 340 + (i * 20); // start at reddish, shift
                    return `hsl(${hue % 360}, 70%, 60%)`;
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
                <div>
                    <div style="font-weight: 500;">${ex.description}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8;">${dateLabel}</div>
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

function saveExpense() {
    const amount = document.getElementById('expenseAmount').value;
    const desc = document.getElementById('expenseDesc').value;
    fetch(API.expenses, { method: 'POST', body: JSON.stringify({ amount, description: desc }), headers: { 'Content-Type': 'application/json' } })
        .then(() => { closeModal('expenseModal'); loadFinancialData(); });
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
function initDateDisplay() {
    const el = document.getElementById('dateDisplay');
    if (el) el.innerText = new Date().toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
