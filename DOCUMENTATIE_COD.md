# Documentație Tehnică a Codului

Această documentație explică în detaliu structura codului sursă și modul de funcționare a fiecărei componente.

## I. Backend (Server-Side)

### 1. `main.js` (Punctul de intrare)
Acesta este fișierul principal care configurează serverul web Express.

*   **Configurare**:
    *   Inițializează `express`, `session` și conexiunea la baza de date.
    *   `app.use(express.static(...))`: Servește fișierele din folderul `public` (HTML, CSS, JS) direct către utilizator. Opțiunea `{ extensions: ['html'] }` permite accesarea paginilor fără extensia `.html` în URL (ex: `/dashboard`).
*   **Middleware `requireLogin`**:
    *   Funcție care protejează rutele private. Dacă utilizatorul nu are o sesiune activă (`req.session.userId`), este redirectat automat la `/login`.
*   **API Routes (`/api/...`)**:
    *   Aceste rute răspund la cereri AJAX de la frontend și returnează date JSON.
    *   **Auth**: `/api/register`, `/api/login`, `/api/logout`. Se ocupă de verificarea parolelor (cu `bcrypt`) și crearea sesiunilor.
    *   **Economic**:
        *   `GET /api/budget`: Calculează bugetul total, cheltuielile și bugetul zilnic recomandat folosind agregate SQL (`SUM`).
        *   `GET /api/budget/categories`: Preia toate categoriile și calculează gradul de ocupare al limitelor setate.
        *   `POST /api/expenses`: Inserează o nouă cheltuială, asociind-o cu o categorie specifică.
    *   **Productivitate (Kanban)**:
        *   `GET /api/tasks`: Returnează lista sarcinilor.
        *   `PATCH /api/tasks/:id/status`: Mută un task între coloane (todo, in-progress, done).
        *   `DELETE /api/tasks/:id`: Ștergere securizată pe baza ID-ului de utilizator.
    *   **Time**:
        *   `GET /api/next-activity`: Filtrează și sortează activitățile pentru a găsi următoarele 3 evenimente din viitor, calculând timpul rămas în minute.

### 2. `database.js` (Baza de Date)
Gestionează interacțiunea directă cu fișierul SQLite `database.db`.

*   **Inițializare**: La pornire, creează automat tabelele dacă nu există (`CREATE TABLE IF NOT EXISTS`):
    *   `users`: ID, username, email, hash parolă.
    *   `budgets`: Bugetul lunar per utilizator.
    *   `expenses`: Cheltuieli individuale legate de user și dată.
    *   `activities`: Evenimente cu tip (fix/recurent), dată start și durată.
*   **Funcții Helper**:
    *   `createUser`: Wrapper pentru inserarea sigură a unui utilizator nou.

## II. Frontend (Client-Side)

### 1. Structura Fișierelor (`public/`)
*   **HTML**: Scheletul paginilor (`index.html`, `dashboard.html`, etc.). Acestea sunt "curate", conținând doar structura și containerele goale (`div`-uri cu ID-uri) unde JavaScript va injecta datele.
*   **CSS (`style.css`)**:
    *   Definește design-ul global (culori, fonturi).
    *   Folosește clase utilitare precum `.card`, `.btn-primary` pentru consistență.
    *   Conține regulile pentru layout-ul responsive (Flexbox/Grid).

### 2. Logica Aplicației (`app.js`)
Acest fișier conține "creierul" interfeței. Este modularizat pe funcționalități.

*   **Configurație Globală**: Obiectul `API` centralizează rutele către server.
*   **Router Client-Side**:
    *   La încărcarea paginii (`DOMContentLoaded`), scriptul detectează pe ce pagină se află verificând existența anumitor elemente HTML (ex: dacă există `loginForm`, inițializează logica de login).
*   **Funcții Principale**:
    *   `checkAuth()`: Verifică dacă utilizatorul e logat apelând `/api/me`. Dacă nu, redirectează la login.
    *   `initDashboard()`:
        *   Apelează `/api/budget` pentru a popula widget-ul financiar și bara de progres.
        *   Apelează `/api/next-activity` pentru a genera lista cu timeline-ul.
    *   `initTasks()`: Configurează interacțiunea Drag-and-Drop între coloanele Kanban și salvează starea în DB.
    *   `getStreak()`: Algoritm ce analizează istoricul log-urilor pentru a determina consecvența fără întreruperi.
    *   `showConfirm()`: Manager de interacțiune asincronă care afișează confirmări modale personlizate.

### 3. Securitate & Validare
*   Validarea formularelor se face atât în HTML (`required`, `type="email"`) cât și în JavaScript înainte de trimitere.
*   Parolele nu sunt stocate niciodată în text clar, nici în baza de date, nici în `localStorage`.

## III. Fluxul de Date (Exemplu: Adăugare Cheltuială)
1.  **Utilizator**: Apasă butonul "Adaugă Cheltuială" și completează suma în modal.
2.  **Frontend (`app.js`)**: Funcția `saveExpense()` preia valoarea și trimite un `POST` către `/api/expenses`.
3.  **Backend (`main.js`)**: Primește cererea, validează sesiunea, și execută `INSERT INTO expenses` în baza de date.
4.  **Răspuns**: Serverul confirmă succesul.
5.  **Frontend**: `app.js` primește confirmarea, închide modalul și reapelează `loadFinancialData()` pentru a actualiza sumele afișate pe ecran fără a reîncărca pagina.
