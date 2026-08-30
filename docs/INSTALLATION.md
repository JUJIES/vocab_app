# Lerndeck installieren und verteilen

Lerndeck bleibt eine Web-App mit einer gemeinsamen Server-Runtime. Es gibt zwei installierbare Einstiege mit derselben Marke:

- Lehrkräfte auf dem Mac: `https://lerndeck.jujies.app/teacher`
- Schüler-iPads beziehungsweise Relution: `https://lerndeck.jujies.app/`

Die getrennten Start-URLs verhindern, dass eine installierte Lehrkraft-App im Schülerzugang startet. Konten, Sets und Tablet-Lernstände bleiben dennoch im selben System.

## Mac

### Safari ab macOS Sonoma 14

1. `https://lerndeck.jujies.app/teacher` in Safari öffnen.
2. `Ablage` → `Zum Dock hinzufügen …` wählen. Alternativ im Teilen-Menü `Zum Dock hinzufügen` verwenden.
3. Den vorgeschlagenen Namen `Lerndeck Lehrkraft` bestätigen.

Safari legt die Web-App im Programme-Ordner des Benutzeraccounts ab und nimmt sie ins Dock auf. Sie besitzt einen eigenen Loginzustand; deshalb muss sich die Lehrkraft in der installierten App einmal anmelden. Für eine Verknüpfung auf dem Schreibtisch kann anschließend im Finder aus dem Programme-Ordner ein Alias angelegt werden.

In Chrome oder Edge wird dieselbe Lehrkraft-URL über die Installieren-Aktion in der Adressleiste als eigenständige PWA installiert.

Offizielle Mac-Anleitung: [Apple – Safari-Web-Apps auf dem Mac](https://support.apple.com/de-de/104996)

## Relution auf iPads

Relution verteilt die Schülerseite als Weblink; es ist keine IPA-Datei und kein Apple-Developer-Konto nötig.

1. In Relution unter `App Store` → `Add` → `Web Link` die URL `https://lerndeck.jujies.app/` anlegen.
2. Den Namen `Lerndeck` setzen, den Status `Productive` aktivieren und als vorbereitetes Icon die Datei unter `https://lerndeck.jujies.app/icons/relution-webclip-512.png` verwenden.
3. Den Weblink per Auto Deployment an die gewünschte Gruppe verteilen oder in einer iOS-Policy als `Weblink` hinterlegen.
4. Bei der Policy `Full Screen` aktivieren und als öffnende App Safari verwenden beziehungsweise keine andere Browser-App auswählen.
5. Optional den Weblink über `Homescreen Layout` an der gewünschten Position ablegen.
6. Bei Relution Shared Devices muss die App-Compliance-Policy Weblinks erlauben.

Relution verteilt nur Start-URL und Icon. Die Geräteidentität wird weiterhin einmalig in Lerndeck gewählt und mit dem Tablet-PIN gekoppelt; Relution injiziert keine Lerndeck-ID.

Offizielle Relution-Anleitung: [Relution – Weblinks bereitstellen und verwalten](https://hub.relution.io/en/docs/apple-ios/help/weblinks/)

## Icon-Dateien

- Master: `icons/lerndeck-app-icon-master-v1.png`
- Manifest/Browser: `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-512-maskable.png`, `icons/icon-1024.png`
- Apple Home Screen: `icons/apple-touch-icon.png`, `icons/apple-touch-icon-167.png`, `icons/apple-touch-icon-152.png`
- Relution-Upload: `icons/relution-webclip-512.png` beziehungsweise öffentlich `https://lerndeck.jujies.app/icons/relution-webclip-512.png`

Alle ausgelieferten Varianten werden aus demselben Master erzeugt, besitzen einen opaken Hintergrund und halten die Maskable-Safe-Zone ein.
