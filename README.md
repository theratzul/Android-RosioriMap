# 🍽️ Roșiori Map

**Roșiori Map** este o aplicație modernă (Android și Web) dedicată orașului **Roșiorii de Vede**, creată pentru a ajuta comunitatea locală și vizitatorii să descopere restaurante, cafenele, pizzerii și fast-food-uri, să consulte meniurile complete și să realizeze rezervări rapide de mese.

---

## 👤 Autor & Dezvoltator

- **Popa Bogdan (theratzul)** – *devops / linux admin / christian*
- GitHub: [@theratzul](https://github.com/theratzul)
- Proiect: [Android-RosioriMap](https://github.com/theratzul/Android-RosioriMap)

---

## ✨ Funcționalități Principale

- 🗺️ **Hartă Interactivă & Geolocație**:
  - Hărți rapide bazate pe Leaflet și **OpenStreetMap** (funcționează direct, fără cheie API).
  - Posibilitate de schimbare stil hartă: OpenStreetMap Standard, OpenTopoMap, CARTO Voyager sau Tile Server personalizat.
  - Geolocație precisă și calcul automat al distanței până la locația selectată.

- 🍕 **Ghid Culinar & Meniuri Complete**:
  - Lista detaliată a restaurantelor locale cu adrese, orare, numere de telefon și facilități (terasă, livrare, Wi-Fi, parcare).
  - Căutare rapidă în timp real după denumirea restaurantului sau după preparate (pizza, burger, paste, ciorbă, cafea etc.).
  - Filtrare pe categorii: Toate, Restaurante, Pizzerii, Fast-food, Cafenele / Bistro.

- 📅 **Rezervări de Mese**:
  - Sistem de rezervare intuitiv cu selectare oră, număr de persoane și detalii de contact.
  - Mod hibrid: funcționare offline pe dispozitiv (stocare locală) și sincronizare opțională prin server REST.

- ☩ **Meniu Mistic & Temă Cerească (Sacred Christian Mystique)**:
  - Integrare subtilă și enigmatică a simbolisticii creștine în meniul principal (**Menu**): emblemă sacră cu serafimi (șase aripi stilizate în geometrie sacră) și Crux Mystica cu nimb celest (`stroke-linework` aur antic).
  - Paletă cromatică profundă: albastru nocturn velvet (`#050a16`), safir și aur antic luminos (`#e5c07b`).
  - Meniu rafinat cu opțiuni pentru rezervări, selecția temei vizuale, configurare hartă și informații autor (*Popa Bogdan / theratzul*).

- 🎨 **Pictogramă Nobilă cu Cruce și Litera R (Roșiori)**:
  - Iconiță realizată pe fundal albastru celest regal profund, integrând o cruce creștină aurie radiantă și litera **R** din Roșiori.
  - Generată vectorial (`icon.svg`) și raster la rezoluție înaltă (`icon-192.png`, `icon-512.png`), plus pictograme adaptive native pentru Android (`ic_launcher_background.xml`, `ic_launcher_foreground.xml`).
  - Integrată în antetul aplicației, ecusonul interactiv de pe hartă și reperul central al municipiului Roșiorii de Vede.

- 📱 **Integrare Nativă Android**:
  - Încărcare rapidă a resurselor locale prin `WebViewAssetLoader` securizat.
  - Apelare directă a restaurantului prin protocolul `tel:`.
  - Deschiderea traseului GPS în aplicația preferată (Google Maps / Waze).
  - Partajare rapidă a localului (`Android Share Sheet`).
  - Suport pentru gesturi de navigare, gest de împrospătare (`SwipeRefreshLayout`) și moduri vizuale avansate.
  - Meniu dedicat pentru informații despre autor și aplicație.

---

## 🏗️ Structura Proiectului

```
Android-RosioriMap/
├── app/                          # Proiectul Android (Kotlin)
│   ├── build.gradle.kts          # Configurație Gradle pentru modulul Android
│   └── src/main/
│       ├── AndroidManifest.xml   # Permisiuni (INTERNET, ACCESS_FINE_LOCATION)
│       ├── java/ro/rosiorimap/app/
│       │   ├── MainActivity.kt   # Activitatea principală (WebView + Geolocation + Meniu)
│       │   └── WebAppInterface.kt# Punte JavaScript <-> Kotlin (Apel, Partajare, GPS)
│       └── res/                  # Resurse Android (layout, teme, culori, meniuri)
├── web/                          # Aplicația Web & Backend
│   ├── server.js                 # Server HTTP REST cu zero dependențe externe
│   └── public/                   # Client Web (HTML, CSS, Vanilla JS)
│       ├── index.html            # Structura aplicației și interfeței
│       ├── styles.css            # Sistem de design Glassmorphism modern
│       ├── app.js                # Logica hărții, căutării, meniurilor și rezervărilor
│       ├── config.js             # Configurații inițiale
│       └── data/restaurants.json # Baza de date cu restaurantele locale
- 🌳 **Parcuri, Zone Verzi & Agrement (Parcuri & Zone Verzi)**:
  - Submeniu dedicat și secțiune specială pe hartă cu pini de smarald și stilizare tematică.
  - **Pădurea Roșiori & Fața Verde**: plămânul verde al municipiului, vechii Codri ai Teleormanului, trasee rustice de drumeție, picnic și relaxare.
  - **Baza de Agrement Vedea & Parcul Sportiv**: terenuri multifuncționale de minifotbal cu nocturnă, tenis de câmp, fitness urban și faleză pietonală de-a lungul râului Vedea.
  - **Ștrandul Municipal Roșiorii de Vede**: oază estivală cu bazine de înot, zonă de plajă cu șezlonguri și terasă de vară.
  - **Bâlciul Anual Tradițional (Obor)**: istoric secular atestat din 1385 și consfințit prin Hrisovul domnesc din 1695 al lui Constantin Brâncoveanu; parc de distracții (scrâncioburi, mașinuțe tamponabile) și micii tradiționali de 1–8 septembrie (Sfânta Maria Mică).
  - **Parcurile Istorice**: Parcul Central „Nicolae Popescu-Vedea” (alei cu tei seculari și foișorul de fanfară), Parcul „Nicolae Bălcescu” (Teatrul de Vară), Parcul C.F.R. Gara de Nord (1895) și Parcul Sfânta Vineri.
  - Comutator dinamic de moduri în interfață: comutare rapidă între vizualizarea Restaurantelor și cea a Parcurilor & Zonelor Verzi.

---

## 🏗️ Structura Proiectului

```
Android-RosioriMap/
├── app/                          # Proiectul Android (Kotlin)
│   ├── build.gradle.kts          # Configurație Gradle pentru modulul Android
│   └── src/main/
│       ├── AndroidManifest.xml   # Permisiuni (INTERNET, ACCESS_FINE_LOCATION)
│       ├── java/ro/rosiorimap/app/
│       │   ├── MainActivity.kt   # Activitatea principală (WebView + Geolocation + Meniu Nativ)
│       │   └── WebAppInterface.kt# Punte JavaScript <-> Kotlin (Apel, Partajare, GPS)
│       └── res/                  # Resurse Android (layout, teme, culori, meniuri)
├── web/                          # Aplicația Web & Backend
│   ├── server.js                 # Server HTTP REST cu zero dependențe externe
│   └── public/                   # Client Web (HTML, CSS, Vanilla JS)
│       ├── index.html            # Structura aplicației și interfeței (Portal + Submeniuri + Hartă)
│       ├── styles.css            # Sistem de design Glassmorphism modern
│       ├── app.js                # Logica hărții, căutării, restaurantelor, parcurilor și rezervărilor
│       ├── config.js             # Configurații inițiale
│       └── data/
│           ├── restaurants.json  # Baza de date cu restaurantele locale
│           └── parks.json        # Baza de date cu parcuri, pădure, agrement, ștrand și bâlci
├── .github/
│   ├── scripts/
│   │   └── generate_release_email.py # Generator HTML responsive pentru notificări de release
│   └── workflows/
│       └── build-apk.yml         # Automatizare CI/CD GitHub Actions (main + feature branches + email)
└── README.md                     # Documentația proiectului
```

---

## 🚀 Rulare și Compilare

### 1. Aplicația Web / Server Local (Node.js)

Puteți porni serverul web cu orice versiune recentă de Node.js:

```bash
cd web
node server.js
```

Aplicația va fi accesibilă la adresa: `http://localhost:8080`.

### 2. Aplicația Android (APK)

Puteți compila pachetul APK de depanare (debug) folosind Gradle:

```bash
./gradlew assembleDebug
```

Fișierul APK rezultat se va găsi în:
`app/build/outputs/apk/debug/app-debug.apk`

---

## 🤖 CI/CD & Notificări Automate prin GitHub Actions

Workflow-ul [.github/workflows/build-apk.yml](file:///.github/workflows/build-apk.yml) este configurat pentru:
1. **Compilare pe Ramuri Principale & Feature Branches**:
   - Declanșare automată la `push` pe `main`, precum și pe orice ramură de tip `feature/**`, `feat/**`, `bugfix/**`.
   - Declanșare manuală din interfața GitHub Actions (`workflow_dispatch`).
2. **Numerotare Dinamică de Versiune**:
   - `main`: `v1.0.<run_number>`
   - `feature`: `v1.0.<run_number>-<branch_slug>` (marcat ca pre-release în GitHub Releases).
3. **Notificare Email Automată către `th3ratzul@gmail.com`**:
   - Generează un email responsiv HTML cu noutățile versiunii, istoricul commit-ului, ramura și buton direct spre artefacte.
   - Atașează fișierul `.apk` compilat direct în email.
   - Folosește secretele de repository `MAIL_USERNAME` și `MAIL_PASSWORD` (de exemplu, cont Gmail cu parolă de aplicație / App Password). Dacă nu sunt configurate secretele, procesul de compilare continuă fără erori și emite un avertisment informativ.

---

## 📄 Licență

Proiect dezvoltat de **Popa Bogdan (theratzul)**. Toate drepturile rezervate.
