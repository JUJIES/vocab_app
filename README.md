# Lerndeck

Lerndeck ist eine ruhige, tablet-optimierte Web-App zum Lernen im Unterricht. Schüler arbeiten ohne persönliche Registrierung über feste Gerätenamen. Lehrkräfte erstellen private Lernsets, teilen sie per sechsstelligen Code oder QR-Link und Änderungen bleiben unter derselben Set-Adresse verfügbar.

## Montag-MVP

Einsatzbereit sind:

- 29 vorbereitete Geräteprofile von `Blau 1` bis `Schwarz 6`
- einmalige Tablet-Kopplung mit Geräte-PIN und dauerhafte, widerrufbare Sitzung
- sechs vorbereitete Lehrkraftkonten: Julius, Jessi S., Jessi B., Jörg, Aksana und Matti
- direkt nutzbare Lehrkraftkonten mit einmaligem Startpasswort und eigenem Passwortwechsel im Zahnrad-Menü
- ausschließlich private Sets pro Lehrkraft mit Erstellen, Bearbeiten, Löschen und stabilem Set-Code; es gibt im MVP keine Vorlagen oder zwischen Lehrkräften geteilten Bibliotheken
- automatisch gespeicherte Set-Entwürfe: erster sinnvoller Inhalt und fertige Importentwürfe werden sofort gesichert, bleiben nach einem Reload unter `Entwürfe (n)` wiederauffindbar und werden erst beim Veröffentlichen per Code oder QR für Tablets erreichbar
- Schnellimport aus klaren Textlisten sowie KI-Entwürfe aus Freitext, TXT, MD, CSV, Bildern, PDF, DOCX und PPTX; beim automatischen Erstentwurf schlägt die KI auch Titel, Fach, Beschreibung, Sprachen und Seitenbezeichnungen vor, eine optionale Importnotiz grenzt Auswahl, Umfang und Abfragerichtung ein
- KI-Lernbilder für veröffentlichte Sets: sechs Motive pro Sheet, sichtbarer Hintergrundfortschritt, kompakte Vorschau im Karteneditor, einzelne Neugenerierung mit erhaltener Variantenhistorie und didaktisch gestufte Anzeige als Feedback nach Aufdecken beziehungsweise Antwort; `Testen` bleibt bildfrei
- Schülerübernahme per Code, QR oder Link; der Set-Inhalt wird nicht auf das Tablet kopiert
- Modi `Üben`, `Eingabe` und `Testen`; im Eingabemodus müssen falsche Antworten richtig wiederholt werden, während `Testen` eine zufällige Auswahl von mindestens fünf bis allen Set-Karten ohne Bilder oder Hilfen als Liste abfragt
- Lernstand pro Tablet, Set und Lernmodus
- installierbare Schüler-PWA für iPads/Relution und eigener Lehrkraft-Startpunkt für Mac-Web-Apps; der Browserzugang bleibt vollständig erhalten

Bewusst vertagt sind persönliche Schülerkonten, Dino-Lernpässe, Schulen/Gruppen, Set-Zuweisungsverwaltung und Tauri.

## Zentrale Produktlogik

1. Das Tablet wählt einmal seinen bekannten Gerätenamen und setzt einen PIN. Browser und Server halten eine widerrufbare Gerätesitzung.
2. Eine Lehrkraft besitzt ihre eigenen Sets. Andere Lehrkraftkonten sehen diese Sets im Editor nicht.
3. Ein veröffentlichtes Set erhält genau einen stabilen Pfad und Code. Bearbeitungen erhöhen die Revision, ersetzen aber weder Pfad noch Code.
4. Ein Code fügt nur den stabilen Set-Pfad zum Tablet hinzu. Beim nächsten Öffnen oder Neuladen kommt die aktuelle Revision vom Server; ein laufender Durchgang wird nicht mitten in einer Karte umgebaut.
5. Lernstände bleiben am Tablet. Unveränderte Karten behalten bei einer Set-Bearbeitung ihre Karten-ID; nur inhaltlich geänderte Karten erhalten eine neue ID.
6. Importmaterial erzeugt immer nur einen bearbeitbaren Entwurf. Eine optionale Importnotiz wie `nur Lektion 1, Deutsch → Englisch` steuert Auswahl und Richtung. Originaldateien werden nicht gespeichert. Modellantworten werden serverseitig gegen dasselbe Set-Datenmodell validiert.
7. Das Löschen eines Entwurfs oder veröffentlichten Sets entfernt ihn sofort aus dem Lehrerbereich. Veröffentlichte Codes und Pfade sind danach nicht mehr auflösbar; Tablet-Verknüpfungen und zugehörige Lernstände werden bereinigt. Intern bleibt der Datensatz archiviert, damit ein versehentliches Löschen im Runtime-Speicher grundsätzlich wiederherstellbar bleibt.
8. Lernbilder sind eigene persistente Assets. Eine Karte referenziert nur ihre aktive Variante; ältere Generierungen bleiben für direkten Rückwechsel und die spätere Bibliothek erhalten. Inhaltsänderungen lösen die bestehende neue Karten-ID aus und entkoppeln damit veraltete Bilder.
9. `Testen` zieht ohne Wiederholung eine zufällige Teilmenge des Sets. Die erste Prüfung zählt als Testergebnis; korrekte Zeilen werden gesperrt und falsche Zeilen bleiben rot bearbeitbar, bis alle Antworten stimmen. Es gibt dort keine Bilder, Audios, Hinweise oder eingeblendeten Lösungen.

Runtime-Daten liegen ausschließlich in `DATA_DIR` und dürfen bei Deployments nicht ersetzt werden. JSON-Schreibvorgänge laufen serialisiert und über atomare Dateiersetzung. Das ist für den einzelnen Beelink-Prozess bewusst einfach; bei mehreren Serverinstanzen muss die Store-Schicht später durch eine gemeinsame Datenbank ersetzt werden.

Die fünf historisch mitgelieferten Lernsets werden beim ersten Start idempotent Julius zugeordnet. Dabei bleiben Set-Pfade, Karten-IDs und damit bestehende Set-Verknüpfungen der Tablets und Lernstände erhalten. Die Dateien unter `sets/` dienen danach nur noch als einmalige Migrationsquelle und erscheinen nicht als Vorlagen.

## Lokaler Start

```bash
npm install
npm run provision:teachers -- --data-dir=/absoluter/pfad/zur/runtime/data
DATA_DIR=/absoluter/pfad/zur/runtime/data OPENAI_API_KEY=... npm start
```

Der Provisionierungsschritt gibt einmalig zufällige Startpasswörter für Konten ohne Passwort aus. Bereits eingerichtete Konten bleiben unverändert. Die Startpasswörter werden sicher persönlich weitergegeben; nach der ersten Anmeldung führt Lerndeck direkt zum Passwortwechsel im Zahnrad-Menü. `--reset-passwords` setzt bewusst auch bestehende Passwörter zurück und gehört nicht in den normalen Ablauf. Passwörter und API-Key gehören weder ins Repository noch in Screenshots oder Tickets.

Ein einzelnes vergessenes Lehrkraftpasswort wird gezielt zurückgesetzt, ohne andere Konten zu verändern: `npm run provision:teachers -- --data-dir=/absoluter/pfad/zur/runtime/data --reset-teacher=julius`. Dabei werden bestehende Sitzungen dieses Kontos widerrufen und ein neues einmaliges Startpasswort ausgegeben.

Der KI-Import überträgt eingegebenes Material an die konfigurierte OpenAI API. Für den Feldtest nur Material ohne personenbezogene Schülerdaten verwenden und die organisatorische Freigabe der Schule beziehungsweise des Trägers beachten.

Bilder und Screenshots werden für kleine Buchschrift in Originalauflösung visuell ausgewertet; PDFs liefern Text und Seitenbilder in hoher Detailstufe. Bei DOCX und PPTX verarbeitet die API dagegen den extrahierten Text, nicht darin eingebettete Bilder oder Diagramme. Buchseiten deshalb direkt als Bild oder PDF hochladen. Begriffe müssen aus dem Material stammen; ausdrücklich gewünschte Übersetzungen oder kurze Definitionen darf das Modell fachlich ergänzen.

Wichtige Umgebungsvariablen:

- `DATA_DIR`: persistenter Runtime-Ordner, im Betrieb zwingend außerhalb des Releases
- `OPENAI_API_KEY`: serverseitiger Key für KI-Import und Bildgenerierung; ohne ihn funktionieren manuelle Sets und klare Textlisten weiter
- `OPENAI_IMPORT_MODEL`: optional, Standard `gpt-5.6-terra`
- `OPENAI_IMAGE_MODEL`: optional, Standard `gpt-image-2`
- `PUBLIC_BASE_URL`: öffentliche HTTPS-Basis für erzeugte QR-Links
- `PORT` und `HOST`: Standard `3000` und `0.0.0.0`

## Checks

```bash
npm run verify
npm audit --omit=dev
```

Der isolierte Browser-Smoke-Test braucht eine laufende Testinstanz, einen aktivierten Testaccount und ein wegwerfbares `DATA_DIR`:

```bash
BASE_URL=http://127.0.0.1:4012 \
TEACHER_ID=julius \
TEACHER_PASSWORD=... \
npx playwright test scripts/mvp-smoke.spec.js
```

Der Test erstellt ein Set und mutiert ein Tablet; niemals gegen echte Unterrichtsdaten laufen lassen. Der Healthcheck liegt unter `/health`.

## Betrieb

Die verbindlichen Beelink-Schritte stehen in [docs/DEPLOYMENT_BEELINK.md](docs/DEPLOYMENT_BEELINK.md). Die Installation auf Macs und die Verteilung per Relution beschreibt [docs/INSTALLATION.md](docs/INSTALLATION.md). Produktentscheidungen und vertagte Komponenten stehen in [docs/DECISIONS.md](docs/DECISIONS.md). Datenfluss und didaktische Regeln der Bildgenerierung sind in [docs/VISUAL_VOCABULARY_PLAN.md](docs/VISUAL_VOCABULARY_PLAN.md) festgehalten. Der Lehrerbereich ist unter `/teacher`, die Schüler-App unter `/` erreichbar.
