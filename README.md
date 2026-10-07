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
├── .github/workflows/
│   └── build-apk.yml             # Automatizare CI/CD pentru generare Release APK
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

De asemenea, pachetele APK sunt compilate și publicate automat la fiecare push pe ramura `main` prin **GitHub Actions**.

---

## 📄 Licență

Proiect dezvoltat de **Popa Bogdan (theratzul)**. Toate drepturile rezervate.
