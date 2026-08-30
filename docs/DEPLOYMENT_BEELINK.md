# Beelink-Deployment

## Betriebsmodell

```text
C:\Users\Julius Herrmann\Coding Projects\_dev\Lerndeck
  Entwicklungsclone

C:\Users\Julius Herrmann\Coding Projects\_services\Lerndeck\<commit>
  unveränderlicher Release einer geprüften Commit-ID

C:\Users\Julius Herrmann\Coding Projects\_runtime\Lerndeck
  persistente Daten, Geheimnisse und Logs
```

Produktiver App-Port: `127.0.0.1:6000`

Healthcheck: `http://127.0.0.1:6000/health`

Öffentlicher Zugang: benannter Cloudflare-Tunnel mit eigenem HTTPS-Hostnamen

## Aktiver Stand

- Öffentliche URL: `https://lerndeck.jujies.app`
- App-Dienst: `BeelinkApp-Lerndeck`
- Tunnel-Dienst: `BeelinkTunnel-Lerndeck`
- Aktiver Release: über den Dienstpfad von `BeelinkApp-Lerndeck` ermitteln; die unveränderliche Release-ID ist dort der vollständige Git-Commit und wird nicht zusätzlich als schnell veraltende Kopie in dieser Datei gepflegt.
- Runtime: `_runtime\Lerndeck`

Der Montag-MVP mit Lehrkraftkonten, privater Set-Bibliothek, Editor und multimodalem Import wurde am 30. August 2026 aktiviert. Lokaler und öffentlicher Healthcheck, öffentlicher Lehrkraftlogin, private Julius-Setliste, Set-Code-Auflösung, Logout sowie ein nicht persistierter KI-Import wurden nach dem Cutover erfolgreich geprüft. Der Schüler-Empty-State wurde über den öffentlichen Tunnel bei 1024, 700 und 390 Pixeln abgenommen; PWA-Shell `v94` verteilt ihn an bestehende Installationen. Der vereinheitlichte Lehrer-Header einschließlich Account-Menü, Tabs und Logout wurde öffentlich bei 1150, 720 und 390 Pixeln geprüft. Release `2562950` ergänzt automatische Metadatenvorschläge beim Erstimport; zwölf Service-Tests, der isolierte Editorfluss und der öffentliche Healthcheck waren erfolgreich. Release `2a58023` entfernt die redundante Importüberschrift und wurde bei 1024 sowie 390 Pixeln visuell geprüft. Release `2804d29` führt serverseitig automatisch gespeicherte Set-Entwürfe ein; vierzehn Service-Tests, der vollständige Entwurf-bis-Veröffentlichung-Browserflow sowie die Darstellung bei 1024 und 390 Pixeln waren erfolgreich. Release `e7ce364` ergänzt lokale Bildminiaturen und typisierte Dokumentkacheln im Import; Mehrfachauswahl, Entfernen und responsive Darstellung wurden im vollständigen Editorflow geprüft. Release `81adb4c` sichert den ersten sinnvollen Entwurfsstand sowie fertige automatische Importentwürfe sofort und gruppiert sie im Lehrermenü unter `Entwürfe (n)`; unmittelbarer Reload, Wiederöffnen mit Metadaten und Karten sowie anschließendes Veröffentlichen wurden im Browserflow geprüft. Release `0a657ee` übernimmt die Set-Bezeichnungen wie `Deutsch/Englisch` in die Kartenüberschriften, zentriert die Desktop-Spaltenköpfe und nutzt dieselben Begriffe in der mobilen Kartenansicht; Desktop und 390-Pixel-Ansicht sowie der vollständige Editorflow wurden geprüft. Release `42a2c6d` versioniert die Lehrer-Assets neu, damit bereits gecachte Editor-Dateien beim nächsten Seitenreload sicher durch diese Darstellung ersetzt werden. Release `75dd92a` reduziert die Dateivorschau nach der Auswahl auf die Vorschaukacheln und die zentrierte Aktion `Weitere Inhalte hinzufügen`; der technische Provider-/Speicherungshinweis wurde entfernt und der vollständige Mehrfachdatei-Importflow erneut geprüft. Release `d883903` trennt in der Schülerkartenlogik eine Hauptantwort von gleichwertigen Varianten, unterdrückt identische Antwortwiederholungen und wurde durch PWA-Shell `v96` verteilt; iPad-Querformat und die Einzelakzeptanz aller Varianten sind durch einen eigenen Browserflow abgesichert. Release `9addb99` ergänzt die frei wählbare Abfragerichtung in `Sichten` und `Üben` sowie das einheitliche Zahnrad. PWA-Shell `v98` liefert die neuen Assets; PWA-Steuerdateien umgehen jetzt Zwischen-Caches. Öffentlicher Healthcheck und Cache-Header waren erfolgreich, und Tablet-Tag sowie Logout wurden live bei 1024 und 390 Pixeln mit identischer Kontrollmittelachse geprüft. PWA-Shell `v99` ergänzt für Schüler- und Lehrer-App einen gemeinsamen Standalone-Splash mit Bereitschaftssignal und Zeit-Fallback; beide Einstiege wurden bei 1024 und 390 Pixeln sowie der normale Browserweg ohne Verzögerung geprüft.

## Einmalige Vorbereitung des MVP-Releases

Der Windows-Dienst erhält außerhalb des Repositories mindestens:

```text
DATA_DIR=C:\Users\Julius Herrmann\Coding Projects\_runtime\Lerndeck\data
PUBLIC_BASE_URL=https://lerndeck.jujies.app
OPENAI_API_KEY=<serverseitiger Key>
OPENAI_IMPORT_MODEL=gpt-5.6-terra
PORT=6000
HOST=127.0.0.1
```

Den API-Key über die Dienstkonfiguration oder eine geschützte Runtime-Umgebung setzen, nicht über eine eingecheckte `.env`-Datei. Nach einem Key-Wechsel den App-Dienst neu starten.

Auf dem Beelink liegen zwei wiederverwendbare Deployment-Helfer im geschützten Dienstordner. Der Key wird über Standard Input übertragen, damit er weder in der Shell-History noch in Prozessargumenten steht:

```powershell
pbpaste | ssh beelink powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:/ProgramData/Beelink/Services/lerndeck/set-beelink-openai-key.ps1
```

Nach Review, Commit und Push bereitet der folgende Aufruf einen unveränderlichen Release vor, installiert ausschließlich Produktionsabhängigkeiten, führt Checks, Tests, Audit und einen isolierten Healthcheck auf Port `6100` aus, ändert aber noch keinen laufenden Dienst:

```powershell
ssh beelink powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:/ProgramData/Beelink/Services/lerndeck/deploy-beelink.ps1 -Commit <vollständige-commit-id>
```

Erst der erneute Aufruf mit `-Activate` sichert die Runtime, provisioniert fehlende Lehrkraftkonten, stellt den Dienst auf den geprüften Release um und rollt bei einem fehlgeschlagenen Healthcheck automatisch auf den vorherigen Releasepfad zurück:

```powershell
ssh beelink powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:/ProgramData/Beelink/Services/lerndeck/deploy-beelink.ps1 -Commit <vollständige-commit-id> -Activate
```

Im neuen Release mit dem produktiven `DATA_DIR` einmal ausführen:

```powershell
node scripts/provision-teachers.js --data-dir="C:\Users\Julius Herrmann\Coding Projects\_runtime\Lerndeck\data"
```

Die ausgegebenen Startpasswörter sicher persönlich an Julius, Jessi S., Jessi B., Jörg, Aksana und Matti verteilen. Nach der ersten Anmeldung öffnet Lerndeck direkt den Passwortwechsel; später bleibt er über das Zahnrad erreichbar. Ein erneuter Provisionierungslauf lässt Konten mit Passwort unverändert. `--reset-passwords` ist ein bewusster Passwortreset für alle Lehrkräfte und gehört nicht in den normalen Deployment-Ablauf. Die Ausgabe des ersten Laufs nicht in Logs, Tickets oder das Repository kopieren.

## Deployment-Gates

Ein Release wird erst aktiviert, wenn:

1. die gewünschte Commit-ID nach GitHub gepusht wurde;
2. `npm ci --omit=dev`, `npm run check` und die Service-Tests erfolgreich sind;
3. der Browser-Smoke-Test gegen ein wegwerfbares Test-`DATA_DIR` erfolgreich ist;
4. `DATA_DIR` auf `_runtime\Lerndeck\data` zeigt und die bestehende Runtime unangetastet bleibt;
5. `PUBLIC_BASE_URL` und `OPENAI_API_KEY` nur in der Dienstumgebung gesetzt sind;
6. `/health`, Lehrkraftlogin, Set-Erstellung, Code-Auflösung, Tablet-Anmeldung und Eingabekorrektur lokal funktionieren;
7. der öffentliche HTTPS-Aufruf in Safari/iPadOS funktioniert;
8. der vorherige Release als Rollback erhalten bleibt.

Für den ersten Schultest nur unkritisches Unterrichtsmaterial ohne Namen, Schülerdaten oder andere personenbezogene Inhalte in den KI-Import geben. Die organisatorische Datenschutz-/Vertragsprüfung für den verwendeten OpenAI-API-Zugang bleibt eine Freigabe des Trägers beziehungsweise der Schule.

Für den Release-Build:

```powershell
npm ci --omit=dev
npm run check
npm audit --omit=dev
```

Die Node-Service-Tests benötigen Dev-Abhängigkeiten nicht, können also vor dem Produktions-Cut ebenfalls mit `npm test` laufen. Der Playwright-Smoke-Test läuft sinnvollerweise im Entwicklungsclone oder CI mit installierten Dev-Abhängigkeiten.

## Persistenz

Folgende Dateien gehören zur Runtime und nie in einen Release-Cutover:

- `data/tablets.json`: Tablet-Kopplungen, hinzugefügte Set-Pfade und Lernstände
- `data/tablet-sessions.json`: gehashte Tablet-Sitzungstokens
- `data/teachers.json`: Lehrkraftkonten, Passwort-Hashes und Status des ersten Passwortwechsels
- `data/teacher-sessions.json`: gehashte Lehrkraft-Sitzungstokens
- `data/teacher-sets.json`: private Set-Quellen, stabile Codes und Revisionen

`data/tablets.seed.json` und `data/teachers.seed.json` sind dagegen versionskontrollierte, geheimnisfreie Vorlagen. Bestehende Tablet-Daten werden durch den neuen MVP nicht migriert oder gelöscht. Fehlende neue Lehrkraftdateien werden beim ersten Start aus dem Seed erzeugt.

Beim ersten Start eines Releases mit privater Set-Bibliothek werden die fünf historischen JSON-Sets aus `sets/sets-index.json` einmalig in `data/teacher-sets.json` als Eigentum von Julius übernommen. Die Migration ist idempotent und überschreibt spätere Bearbeitungen nicht. Alte Set-Pfade und Karten-IDs bleiben bestehen, damit auf Tablets bereits hinzugefügte Sets und ihre Lernstände weiter funktionieren. Vor dem Cutover deshalb wie üblich den gesamten Runtime-Ordner sichern und nach dem Start prüfen, dass Julius die Sets unter `Meine Sets` sieht, ein anderes Lehrkraftkonto dagegen nicht.

Vor dem Cutover eine datenschutzkonforme Sicherung des gesamten Runtime-Ordners erstellen. Rollback ändert nur den Releasepfad; Runtime-Daten und Tunnel-Hostname bleiben erhalten. Da ein alter Release die neuen Lehrerdateien ignoriert, bleiben sie beim Rollback bestehen.

## PWA und Relution

Safari unter der öffentlichen HTTPS-Adresse bleibt der vollständige, unabhängige Zugangsweg. Die Schüler-PWA verwendet ID und Start-URL `/`; die Lehrkraft-PWA startet unter `/teacher`. Relution verteilt ausschließlich den Schüler-Weblink `https://lerndeck.jujies.app/` im Full-Screen-Modus und verwendet `https://lerndeck.jujies.app/icons/relution-webclip-512.png` als vorbereitetes Icon. Es injiziert keine Geräteidentität und ist keine Laufzeitabhängigkeit. Die vollständigen Mac- und Relution-Schritte stehen in [INSTALLATION.md](INSTALLATION.md).

## Abnahme nach Cutover

1. `/health` lokal und öffentlich prüfen.
2. Mit einem Test-Lehrkraftkonto anmelden und eine klare Zweispaltenliste importieren.
3. Set speichern, Code auf einem frischen Browser öffnen und einem freien Testtablet hinzufügen.
4. Eingabemodus starten, eine falsche und danach die richtige Antwort eingeben.
5. Set-Titel ändern und prüfen, dass Code und Pfad gleich bleiben und der neue Titel nach Neuladen erscheint.
6. Testtablet danach über den Lehrerbereich wieder entkoppeln.
