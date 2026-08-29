# Lerndeck

Lerndeck ist eine ruhige, tablet-optimierte Web-App zum Vokabellernen im Unterricht. Ein Tablet wird einmal einem festen Gerätezugang zugeordnet, bleibt angemeldet und erhält Lernsets per Link oder QR-Code. Lernstände werden serverseitig pro Tablet und Lernmodus gespeichert.

## Aktueller Produktstand

Für einen ersten Unterrichtstest verfügbar:

- Tablet einmalig auswählen, mit PIN registrieren und dauerhaft anmelden
- Lernsets per Link oder QR-Code hinzufügen
- Lernmodi `Sichten`, `Üben` und `Eingabe`
- Sterne, Durchgänge und Ergebnisse pro Tablet speichern
- Lehrerbereich unter `/teacher` für Lernsets, QR-Codes und Tablet-Verwaltung
- installierbare PWA mit Manifest und Service Worker

Noch nicht fertig:

- `Testen` ist in der Oberfläche als späterer Modus markiert
- Lernsets können im Lehrerbereich noch nicht erstellt oder als Datei importiert werden
- Sets werden derzeit als validierte JSON-Dateien unter `sets/` abgelegt und in `sets/sets-index.json` registriert

## Zentrale Datenflüsse

1. Ein Tablet wird aus dem serverseitigen Tablet-Verzeichnis gewählt und mit einem eigenen PIN registriert.
2. Der Browser speichert Geräte-ID und Sitzung lokal. Der Server speichert nur einen Hash des Sitzungstokens unter `DATA_DIR/tablet-sessions.json`.
3. Ein Set-Link fügt das Set zum Tablet hinzu. Die Setdatei bleibt unveränderlicher Inhalt unter `sets/`.
4. Lernstände und Set-Zuweisungen werden in `DATA_DIR/tablets.json` gespeichert.
5. Entkoppeln oder erneutes Anmelden widerruft vorhandene Tablet-Sitzungen.

`DATA_DIR` muss im Betrieb außerhalb des Release-Verzeichnisses liegen. Ein neues Deployment darf diese Daten nicht überschreiben.
Fehlt `DATA_DIR/tablets.json` beim ersten Start, initialisiert der Server es aus dem PIN-freien `data/tablets.seed.json`.

## Lokaler Start

```bash
npm install
npm start
```

Standardmäßig läuft die App auf `http://localhost:3000`. Für einen echten Lehrerzugang sollte `TEACHER_PIN` gesetzt werden. Der Standard `0000` ist ausschließlich für lokale Entwicklung gedacht.

Wichtige Checks:

```bash
npm run check
npm audit --omit=dev
```

Mit einem isolierten `DATA_DIR`, einem laufenden Server auf Port `4012` und gesetztem `TEACHER_PIN` prüft folgender Test den vollständigen Montag-MVP:

```bash
BASE_URL=http://127.0.0.1:4012 TEACHER_PIN=... npx playwright test scripts/mvp-smoke.spec.js
```

Der Healthcheck liegt unter `/health`.

## Lernset hinzufügen

Eine vorhandene Setdatei unter `sets/` ist das aktuelle Importformat. Ihr Aufbau folgt den bestehenden Beispielen, insbesondere `sets/food-basics-01.json`. Danach wird genau ein Eintrag in `sets/sets-index.json` ergänzt. Vor dem Deployment müssen ID, Pfad, Titel und Kartenanzahl geprüft werden.

Ein Browser-Import gehört zur nächsten Produktphase. Er sollte dieselbe JSON-Struktur validieren und keine zweite Set-Datenstruktur einführen.

## Deployment

Der verbindliche Beelink-Ablauf steht in [docs/DEPLOYMENT_BEELINK.md](docs/DEPLOYMENT_BEELINK.md). Releases und persistente Daten bleiben dabei strikt getrennt.
