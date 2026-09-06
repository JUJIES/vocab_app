# Lerndeck – Produkt-Playbook

## Ziel

Lerndeck ist ein schnelles, ruhiges Lernwerkzeug für Unterrichtstablets. Kinder sollen ohne persönliche Registrierung und ohne wiederholte Kontowahl in ihre Lernsets gelangen. Lehrkräfte erstellen private Sets und teilen sie per kurzem Code oder QR-Link.

## Aktueller MVP

- ein serverseitiger Zugang pro physischem Tablet
- einmalige Registrierung mit Tablet-PIN
- dauerhafte, widerrufbare Tablet-Sitzung
- Set-Zuweisung per Link oder QR-Code
- Set-Übernahme per sechsstelliger Code-Eingabe
- Modi `Üben`, `Eingabe` und `Testen`
- falsche Eingaben werden bis zur korrekten Eingabe wiederholt
- Testumfang von mindestens fünf bis allen Karten; zufällige Auswahl, tabellarische Eingabe, strikte Korrekturschleife ohne Bilder oder Hilfen
- Lernstand pro Tablet, Set und Modus
- sechs persönliche Lehrkraftkonten mit einmaliger Aktivierung
- Lehrerbereich für Editor, Import, Set-Freigabe und Tablet-Verwaltung
- Textimport ohne KI sowie multimodaler KI-Entwurf mit optionaler Importnotiz und anschließender Prüfung
- getrennt installierbare PWA-Einstiege für Schüler (`/`) und Lehrkräfte (`/teacher`) mit gemeinsamer Runtime

Schülerkonten, Lernpässe, Gruppen/Schulen und Tauri sind noch nicht Teil des einsatzbereiten MVP.

## Produktregeln

- Tablet-Identität, Sitzung, Set-Abonnement und Lernstand sind getrennte Konzepte.
- Ein Deployment ersetzt niemals persistente Runtime-Daten.
- Eine erneute Anmeldung, PIN-Änderung oder Entkopplung widerruft bestehende Tablet-Sitzungen.
- Lehrkraftkonten besitzen Sets; Set-Codes sind öffentlich lesbare Freigaben, aber keine Bearbeitungsrechte.
- Ein Set behält Pfad und Code über Bearbeitungen. Aktueller Inhalt wird beim Öffnen geladen, nicht als Kopie im Tablet gespeichert.
- Lernsets haben genau ein kanonisches Modell. Editor, Import und öffentliche Set-Ausgabe verwenden dieselbe Validierung.
- KI-Ausgaben sind Entwürfe. Quelldateien werden nach der Anfrage nicht gespeichert.
- Eine Importnotiz steuert Auswahl, Umfang und Abfragerichtung. Sobald sie gesetzt ist, läuft auch eine klare Textliste über den KI-Entwurf, damit der Auftrag nicht stillschweigend ignoriert wird.
- Importbegriffe müssen im Material vorkommen. Sichtbare Begriffspaare werden übernommen und von Lautschrift sowie Buchcodes bereinigt. Nur wenn die Importnotiz es verlangt, ergänzt das Modell für vorhandene Begriffe eine knappe Übersetzung oder Definition.
- Der Schülerbereich bleibt auf Lernen und wenige klare Aktionen reduziert.
- Lehrerfunktionen sind per individuellem Passwort geschützt und gehören in `/teacher`.
- Installationen verändern keine Produktidentität: Relution verteilt nur den Schüler-Weblink, Mac-Web-Apps starten direkt im Lehrerbereich, und beide verwenden weiterhin die serverseitigen Sitzungen und Datenflüsse.

## Nächste sinnvolle Produktphase

1. Feldtest mit einem echten Set und wenigen Tablets.
2. Beobachtete Reibung bei Geräte-Ersteinrichtung, Code-Übernahme und Wiederaufnahme beheben.
3. Lehrer- und Schüleroberfläche gezielt auf Ruhe, Tastaturbedienung und iPad quer prüfen.
4. Dino-Lernpässe erst nach dem Gerätetest als getrennte persönliche Identität fachlich definieren.
5. Den Testmodus im Feldtest auf sinnvolle Standardgröße und verständliches Kurzfeedback prüfen.

## Design

Tablet-first, touchfreundlich, ruhig und ohne Gamification-Druck. Die ausführliche visuelle Spezifikation liegt in `DESIGN.md`.
