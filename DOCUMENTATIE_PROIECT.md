# Documentație Proiect: LifeOS - Asistent Personal

## 1. Introducere
**LifeOS** este o aplicație web de tip "Personal Assistant" dezvoltată pentru a ajuta utilizatorii să își gestioneze eficient timpul și finanțele personale. Aplicația oferă o interfață modernă și intuitivă pentru monitorizarea bugetului lunar și planificarea activităților zilnice.

Proiectul a fost realizat ca lucrare de atestat, având ca scop demonstrarea competențelor de programare web (Full Stack).

## 2. Tehnologii Utilizate

### Backend (Server)
*   **Node.js**: Mediul de execuție pentru serverul de aplicație.
*   **Express.js**: Framework web rapid și minimalist pentru crearea serverului și a API-urilor REST.
*   **SQLite3**: Sistem de gestiune a bazei de date (SQL), ales pentru simplitate și portabilitate (stocare în fișier local).
*   **Bcrypt**: Bibliotecă pentru criptarea (hashing) parolelor utilizatorilor, asigurând securitatea datelor.
*   **Express-Session**: Middleware pentru gestionarea sesiunilor de autentificare.

### Frontend (Interfață)
*   **HTML5**: Structura semantică a paginilor web.
*   **CSS3**: Stilizare modernă folosind variabile CSS, Flexbox, Grid și efecte de **Glassmorphism** (transparență, blur).
*   **JavaScript (Vanilla)**: Logica de pe partea de client pentru interacțiunea cu utilizatorul și apelarea API-urilor (fetch).
*   **Biblioteci Externe**:
    *   *Flatpickr*: Pentru selectarea modernă a datei și orei.
    *   *Google Fonts (Inter)*: Pentru tipografie.

## 3. Funcționalități Principale

### A. Autentificare Securizată
*   **Înregistrare**: Utilizatorii își pot crea un cont. Există opțiunea de a crea un cont de **Administrator** prin introducerea unei chei speciale de securitate.
*   **Autentificare**: Acces securizat pe bază de email și parolă.
*   **Sesiuni**: Utilizatorul rămâne logat pe durata vizitei.

### B. Hub Central (Dashboard)
Pagina principală oferă o privire de ansamblu rapidă:
*   **Rezumat Financiar**: Afișează bugetul rămas și o bară de progres vizuală (verde/galben/roșu) în funcție de cheltuieli.
*   **Timeline**: Lista următoarelor 3 activități planificate, ordonate cronologic.
*   **Acțiuni Rapide**: Butoane pentru acces imediat la adăugarea de cheltuieli sau activități.

### 💰 Modul Economic (Buget Avansat)
*   **Gestiune Buget**: Setarea bugetului lunar și adăugarea de fonduri.
*   **Categorii Personalizate**: Clasificarea cheltuielilor pe categorii definite de utilizator (ex: Mâncare, Transport, Divertisment).
*   **Limite Lunare**: Setarea de praguri valorice maxime pe fiecare categorie, cu bare de progres dedicate și alerte vizuale (⚠️) la atingerea limitei.
*   **Vizualizare Grafică**: Diagramă tip "Doughnut" care oferă o perspectivă clară asupra distribuției cheltuielilor pe categorii.
*   **Algoritm de Calcul**: Determinarea automată a bugetului zilnic recomandat în funcție de zilele rămase din lună.

### 📋 Modul Productivitate (Kanban & Obiceiuri)
*   **Kanban Board**: Sistem de gestionare a proiectelor prin coloane ("De făcut", "În lucru", "Finalizat") cu funcționalitate intuitivă de Drag-and-Drop.
*   **Prioritizarea Task-urilor**: Posibilitatea de a seta niveluri de prioritate (Scăzut, Normal, Urgent) pentru fiecare sarcină.
*   **Habit Tracker**: Monitorizarea succesivității obiceiurilor zilnice. Sistemul calculează automat **Streak-ul** (zile consecutive de succes) pentru a încuraja disciplina utilizatorului.
*   **Widget-uri Interactive**: Vizualizarea rapidă a sarcinilor active și a progresului obiceiurilor direct pe Dashboard.

### 📅 Modul Time Management (Orar)
*   **Calendar Săptămânal**: Vizualizare interactivă a activităților, cu marcarea distinctă a zilei curente.
*   **Finalizarea Activităților**: Buton "Terminat (✓)" care marchează vizual sarcina și o păstrează în istoric timp de o oră înainte de eliminarea automată.
*   **Indicatori de Timp**: Afișarea timpului rămăs până la următoarea activitate (ex: "În 1h 20min") și a numărului de zile până la evenimentele viitoare.

### ⚙️ Setări și Personalizare
*   **Avatar Personalizat**: Încărcare de poze de profil direct din interfață.
*   **Design Unic**: Interfață cu tematică întunecată (Dark Mode) și efecte de Glassmorphism, optimizată pentru experiența utilizatorului.
*   **Confirmări Globale**: Sistem integrat de mesaje de confirmare (modale) personalizate, înlocuind ferestrele standard de sistem pentru o coerență vizuală sporită.

## 4. Arhitectura Aplicației
Aplicația este structurată pe modelul **Client-Server**:
1.  **Frontend-ul** (fișierele din `public/`) rulează în browser și trimite cereri (requests) către server.
2.  **Serverul** (`main.js`) primește cererile, interoghează baza de date (`database.db`) și returnează datele în format JSON.
3.  **Baza de Date** este relațională, având tabele pentru `users`, `budgets`, `expenses` și `activities`.

## 5. Instalare și Rulare
1.  Instalare dependențe: `npm install` (sau `pnpm install`).
2.  Pornire server dezvoltare: `npm run dev`.
3.  Accesarea aplicației: Deschideți browserul la `http://localhost:3000`.
