# Changelog

## 2026-08-29

- Produktname in PWA-Metadaten und Serverausgaben auf `Lerndeck` vereinheitlicht.
- Tablet-Sitzungen überleben Server-Neustarts und Deployments; persistiert werden nur Token-Hashes.
- `/health` für Beelink-Service und Deployment-Abnahme ergänzt.
- Öffentliche Dateiauslieferung auf App-Assets und Lernsets begrenzt; Runtime-Daten, Servercode und Zertifikate sind nicht mehr statisch erreichbar.
- Historisch eingecheckten lokalen CA-Privatschlüssel aus dem aktuellen Git-Stand entfernt und künftig ignoriert.
- Tablet-Runtime mit PIN-Hashes aus Git entfernt; neue Installationen starten aus einem PIN-freien Geräteverzeichnis.
- Tablet-Zugänge nach fünf falschen PINs dauerhaft sperrbar gemacht und Lehrerlogin gegen wiederholte Fehlversuche begrenzt.
- Lehrerlogin ohne gesetzten `TEACHER_PIN` deaktiviert; kein unsicherer Standard-PIN mehr.
- Beelink-Release `8c8e1cf` auf Port 6000 mit eigenem App-Dienst, Tunnel-Dienst und `https://lerndeck.jujies.app` in Betrieb genommen.
- Express und transitive Abhängigkeiten auf Versionen ohne bekannte Audit-Befunde aktualisiert.
- Veraltete UI-Tests an die aktuelle Zugangsauswahl und DOM-Struktur angepasst.
- Aktuellen Produkt-, Datenfluss- und Beelink-Betriebsstand dokumentiert.
