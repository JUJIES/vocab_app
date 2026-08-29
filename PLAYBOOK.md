# Lerndeck – Produkt-Playbook

## Ziel

Lerndeck ist ein schnelles, ruhiges Lernwerkzeug für Unterrichtstablets. Kinder sollen ohne Ablenkung und ohne wiederholte Kontowahl in ihr zugewiesenes Lerndeck gelangen. Lehrkräfte verteilen Sets per Link oder QR-Code und behalten die Gerätezuordnung unter Kontrolle.

## Aktueller MVP

- ein serverseitiger Zugang pro physischem Tablet
- einmalige Registrierung mit Tablet-PIN
- dauerhafte, widerrufbare Tablet-Sitzung
- Set-Zuweisung per Link oder QR-Code
- Modi `Sichten`, `Üben` und `Eingabe`
- Lernstand pro Tablet, Set und Modus
- Lehrerbereich für Set-Freigabe und Tablet-Verwaltung
- installierbare PWA

Der Modus `Testen` und ein Lehrer-Editor/Import sind noch nicht Teil des einsatzbereiten MVP.

## Produktregeln

- Tablet-Identität, Sitzung, Set-Zuweisung und Lernstand sind getrennte Konzepte.
- Ein Deployment ersetzt niemals persistente Runtime-Daten.
- Eine erneute Anmeldung, PIN-Änderung oder Entkopplung widerruft bestehende Tablet-Sitzungen.
- Lernsets haben genau ein kanonisches JSON-Format. Ein künftiger Editor importiert und exportiert dieses Format, statt ein paralleles Datenmodell einzuführen.
- Der Schülerbereich bleibt auf Lernen und wenige klare Aktionen reduziert.
- Lehrerfunktionen bleiben PIN-geschützt und gehören in `/teacher`.

## Nächste sinnvolle Produktphase

1. Feldtest mit einem echten Set und wenigen Tablets.
2. Beobachtete Reibung bei Registrierung, QR-Zuweisung und Wiederaufnahme beheben.
3. JSON-Import im Lehrerbereich mit Schema- und Duplikatsprüfung.
4. Einfachen Set-Editor auf demselben Datenmodell ergänzen.
5. Modus `Testen` fachlich definieren und erst danach freischalten.

## Design

Tablet-first, touchfreundlich, ruhig und ohne Gamification-Druck. Die ausführliche visuelle Spezifikation liegt in `DESIGN.md`.
