# Changelog

## Unreleased

- Einzelne Lehrkraftpasswörter lassen sich nun gezielt zurücksetzen, ohne die übrigen Konten zu verändern; bestehende Sitzungen des betroffenen Kontos werden widerrufen.
- Falsche Zuweisungsmetapher aus der Lehrer-Setliste entfernt: eine kompakte Tablet-Zahl zeigt nun, auf wie vielen Geräten das Set hinzugefügt wurde; Details heißen klar „Vom Tablet entfernen“.
- Lehrkraft-Einrichtungscodes durch einmalig provisionierte Startpasswörter ersetzt; erster Login öffnet den Passwortwechsel, der später über ein neues Zahnrad-Menü erreichbar bleibt und alle alten Sitzungen rotiert.
- Lehrerbibliothek auf private `Meine Sets` reduziert: Vorlagen/geteilte Sets entfernt und die fünf historischen App-Sets idempotent Julius zugeordnet, ohne bestehende Set-Pfade, Karten-IDs, Beispiele oder Audioverweise zu verlieren.
- Druckaktion aus dem Teilen-Dialog entfernt; Link kopieren bleibt als einzige, klar fokussierte Aktion bestehen.
- Sechsstelligen Set-Code aus dem Dialogkopf direkt unter den QR-Code verschoben und dort als gut lesbare Kennung in den QR-Block integriert.
- Set-Erstellung in einen ruhigen Startschritt, einen manuellen Editor und eine separate Automatikansicht geteilt; spätere Importe ergänzen vorhandene Karten, ohne bestehende Set-Metadaten zu überschreiben.
- QR-Codes im Lehrer-Teilen-Dialog werden nach dem Rendern pixelgenau im weißen Ausschnitt zentriert und durch einen geometrischen Browsertest abgesichert.
- Lehrer- und Schülerzugang verwenden jetzt dieselbe zentrale Lerndeck-Wortmarke mit gemeinsamem Stack-Icon; der Lehrer-Login trennt Marke und Formular wie der bereits ausgearbeitete Schülerzugang.
- Schüler-Startheader vereinfacht: Deck-Statistik aus der Wortmarke entfernt, Geräteidentität kompakt dargestellt und das iPad-Querformat ohne umbrechende Aktionszeile stabilisiert; responsive Browserchecks decken 1024 bis 390 Pixel ab.
- Optionales Feld „Was soll daraus werden?“ ergänzt; Importnotizen können Material eingrenzen und Übersetzungs- beziehungsweise Definitionsrichtung vorgeben.
- Zwei reale Buchseiten-Importe gegen GPT-5.6 Terra geprüft; Quelltreue für Wörterbuchseiten und gezielte Übersetzung von Begriffen aus Fließtexten fachlich getrennt. Dichte Bilder werden in Originalauflösung übertragen.
- Multimodalen Importprompt gegen Anweisungen aus Quelldokumenten abgegrenzt und PDF-Seiten explizit in hoher Detailstufe verarbeitet.
- Service-Tests für gesteuerte Textlisten sowie Bild-, DOCX- und PDF-Payloads ergänzt.
- Beelink-Deployment um einen reproduzierbaren Prepare-/Activate-Ablauf mit Release-Gates, isoliertem Kandidaten-Healthcheck, Runtime-Sicherung und automatischem Service-Rollback ergänzt.
- OpenAI-Key kann ohne Shell-History oder Prozessargumente über Standard Input in die geschützte Windows-Dienstkonfiguration übernommen werden.

## 2026-08-29

- Sechs persönliche Lehrkraftkonten mit einmaliger Aktivierung, individuellen Passwörtern, persistenten gehashten Sitzungen und Login-Sperre ergänzt.
- Private Lehrkraft-Sets mit stabilem Pfad, stabilem sechsstelligen Code, Revisionen und kartenbezogener Lernstandskontinuität ergänzt.
- Browser-Editor für manuelle Sets und bearbeitbare Importentwürfe aus Text, Bildern, PDF, DOCX und PPTX ergänzt.
- OpenAI-Import serverseitig über die Responses API mit strukturiertem Ergebnis, `store: false` und konfigurierbarem Modell integriert; klare Zweispaltenlisten funktionieren ohne Modellaufruf.
- Schüler können Sets per Code, QR oder Link übernehmen; dynamische Sets liefern beim Öffnen die aktuelle Revision.
- Eingabemodus startet mit verpflichtender Korrektur falscher Antworten.
- Schreibzugriffe auf Runtime-JSON serialisiert und neue Stores atomar gemacht; Service- und Browser-Smoke-Tests ergänzt.
- Produktentscheidungen, Runtime-Dateien und Beelink-Cutover für den Montag-MVP dokumentiert.
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
