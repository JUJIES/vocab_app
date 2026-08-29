# Beelink-Deployment

## Betriebsmodell

```text
C:\Users\Julius Herrmann\Coding Projects\_dev\Lerndeck
  Entwicklungsclone

C:\Users\Julius Herrmann\Coding Projects\_services\Lerndeck\<commit>
  unveränderlicher Release einer geprüften Commit-ID

C:\Users\Julius Herrmann\Coding Projects\_runtime\Lerndeck
  persistente Daten, Konfiguration und Logs
```

Produktiver App-Port: `127.0.0.1:6000`
Healthcheck: `http://127.0.0.1:6000/health`
Öffentlicher Zugang: benannter Cloudflare-Tunnel mit eigenem HTTPS-Hostnamen

## Aktiver Stand

- Öffentliche URL: `https://lerndeck.jujies.app`
- App-Dienst: `BeelinkApp-Lerndeck`
- Tunnel-Dienst: `BeelinkTunnel-Lerndeck`
- Aktiver Release: Git-Commit `b18b145`
- Runtime: `_runtime\Lerndeck`

Der Release wurde lokal und öffentlich geprüft. App- und Tunnel-Dienst starten automatisch und haben einen kontrollierten Neustarttest bestanden.

## Deployment-Gates

Ein Release wird erst aktiviert, wenn:

1. die gewünschte Commit-ID nach GitHub gepusht wurde;
2. `npm ci --omit=dev`, Syntaxcheck und MVP-Browsertests erfolgreich sind;
3. `DATA_DIR` auf `_runtime\Lerndeck\data` zeigt;
4. ein eigener `TEACHER_PIN` außerhalb des Repositories gesetzt ist;
5. `/health`, Tablet-Anmeldung, Setstart, Lernstand und Lehrerlogin lokal funktionieren;
6. der öffentliche HTTPS-Aufruf funktioniert;
7. der vorherige Release als Rollback erhalten bleibt.

## Persistenz

Folgende Dateien gehören zur Runtime und nie in einen Release-Cutover:

- `data/tablets.json`: Tablet-Kopplungen, Set-Zuweisungen und Lernstände
- `data/tablet-sessions.json`: ausschließlich gehashte Sitzungstokens mit Ablaufzeit

Beim ersten Deployment darf `data/tablets.json` aus dem geprüften Ausgangsstand initialisiert werden. Bei allen späteren Deployments bleibt die Runtime-Datei unangetastet.

## PWA und MDM

Die App besitzt bereits Manifest, Icons und Service Worker. Für Installation oder einen MDM-Webclip muss die öffentliche HTTPS-Adresse verwendet werden. Auf iPadOS kann sie zunächst als Home-Screen-Web-App verteilt werden; eine native Paketierung ist für den Feldtest nicht erforderlich.

## Rollback

Der Windows-Dienst verweist immer auf genau einen Releaseordner. Beim Rollback wird nur dieser Pfad auf den vorherigen geprüften Commit zurückgestellt. Runtime-Daten und Tunnel-Hostname bleiben unverändert.
