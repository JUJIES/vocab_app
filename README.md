# Lerndeck

Lerndeck ist eine ruhige Web-App zum Lernen im Unterricht: mit Tablet-Oberfläche für Schüler und einem Desktop-Arbeitsbereich für Lehrkräfte. Schüler arbeiten ohne persönliche Registrierung über feste Gerätenamen. Lehrkräfte erstellen private Lernsets, teilen sie per sechsstelligen Code oder QR-Link und Änderungen bleiben unter derselben Set-Adresse verfügbar.

## Montag-MVP

Einsatzbereit sind:

- 29 vorbereitete Geräteprofile von `Blau 1` bis `Schwarz 6`
- einmalige Tablet-Kopplung mit Geräte-PIN und dauerhafte, widerrufbare Sitzung
- sechs vorbereitete Lehrkraftkonten: Julius, Jessi S., Jessi B., Jörg, Aksana und Matti
- direkt nutzbare Lehrkraftkonten mit einmaligem Startpasswort und eigenem Passwortwechsel im Zahnrad-Menü
- private Sets pro Lehrkraft mit Erstellen, Bearbeiten, Löschen und stabilem Set-Code; Julius hat als Admin zusätzlich eine explizite Bibliotheksauswahl für andere Lehrkräfte und darf sie prüfen, bearbeiten sowie ihre Bilder verwalten, ohne Eigentümerschaft oder Löschrecht zu übernehmen
- Desktop-Arbeitsbereich mit Lerndecks, suchbarer Set-Bibliothek und direktem Editor; Klicks öffnen Sets ohne Modal, Änderungen speichern automatisch
- direkte Set-Anlage und Autosave: neue Sets erscheinen sofort in ihrem Lerndeck, auch halbfertige Vokabeln bleiben erhalten; oben rechts bestätigt eine ruhige Statusanzeige die Speicherung, ohne Toasts
- Schnellimport aus klaren Textlisten sowie KI-Entwürfe aus Freitext, TXT, MD, CSV, Bildern, PDF, DOCX und PPTX; Titel, Fach und Beschreibung können vorgeschlagen werden, die Zuordnung von Vorder- und Rückseite wird zum Lernen bewusst im Tabellenkopf gewählt
- KI-Lernbilder für vollständige Vokabelpaare: sechs Motive pro Sheet, sichtbarer Hintergrundfortschritt, kompakte Vorschau im Karteneditor, einzelne Neugenerierung mit erhaltener Variantenhistorie und didaktisch gestufte Anzeige als Feedback nach Aufdecken beziehungsweise Antwort; `Testen` bleibt bildfrei
- flüchtige PDF-Ausgabe vollständiger Vokabelpaare als zweisprachige Vokabelliste oder frei zusammengestellter Vokabeltest; beide zeigen eine HTML-Blattvorschau, beim Test ist sie direkt bearbeitbar, und nichts davon wird im Set gespeichert
- Schülerübernahme per Code, QR oder Link; der Set-Inhalt wird nicht auf das Tablet kopiert
- Modi `Üben`, `Eingabe` und `Testen`; `Üben` mischt beim Start und lässt auf beiden Kartenseiten frei vor- und zurückwischen, im Eingabemodus müssen falsche Antworten richtig wiederholt werden, und `Testen` fragt eine zufällig ausgewählte und gemischte Teilmenge von mindestens fünf bis allen Set-Karten ohne Bilder oder Hilfen als Liste ab und zeigt nach der ersten Prüfung eindeutige Haken/Kreuze sowie eine unverbindliche Notenorientierung
- `Say it in a sentence`: 1–20 zufällige Vokabeln im Kontext übersetzen, mit kurzem Satzfeedback überarbeiten und nach Annahme bewusst weitergehen; für Deutsch–Englisch in beiden Richtungen, in Schüleransicht und Lehrervorschau
- Lernstand pro Tablet, Set und Lernmodus
- installierbare Schüler-PWA für iPads/Relution und eigener Lehrkraft-Startpunkt für Mac-Web-Apps; der Browserzugang bleibt vollständig erhalten

Bewusst vertagt sind persönliche Schülerkonten, Dino-Lernpässe, Schulen/Gruppen, Set-Zuweisungsverwaltung und Tauri.

## Zentrale Produktlogik

1. Das Tablet wählt bei Anmeldung und Ersteinrichtung seinen Gerätenamen bewusst selbst; es gibt keine Vorauswahl. Der Geräte-PIN besteht aus 4–8 Ziffern (auch für bestehende Zugänge), ruft auf Mobilgeräten die native Zifferntastatur auf und wird vor der PIN-Prüfung auf Client und Server auf dieses Format geprüft. Browser und Server halten eine widerrufbare Gerätesitzung. Ein fehlgeschlagener PIN-Versuch bindet die Anmeldesitzung zunächst an das ausgewählte Tablet und löst eine Wartezeit aus. Danach kann „Tablet wechseln“ nur die Auswahl lösen; die Fehlversuche der Sitzung und des zuvor gewählten Tablets bleiben bestehen. Nur Admins können eine solche Bindung im Tablet-Menü aufheben, PINs zurücksetzen oder Geräte entkoppeln. Normale Lehrkräfte sehen keine Tablet-Verbindungen oder Verwaltungsübersicht; Schüler-Gerätesitzungen behalten Zugriff auf ihre eigenen Verbindungen.
2. Eine Lehrkraft besitzt ihre eigenen Sets. Normale Lehrkraftkonten sehen fremde Sets nicht. Admins sehen sie nach Eigentümer getrennt und dürfen sie bearbeiten sowie Bilder verwalten; Eigentümerschaft, Löschen und Lerndeck-Organisation fremder Sets bleiben ausgeschlossen. Eigene Lerndecks haben eine Ebene; Zuordnen oder Entfernen verändert weder Set-Inhalt, Revision, Code noch Lernstände.
3. Ein neues Set erhält sofort einen stabilen Pfad und Code und erscheint im gewählten Lerndeck. Alle Inhaltsänderungen speichern nach einer kurzen Schreibpause automatisch, auch ein leerer Titel oder unvollständige Vokabeln. „Gespeichert“ erscheint erst nach Serverbestätigung; Fehler behalten die Eingaben und stoppen Set-Wechsel/Abmelden. Es gibt keinen separaten Entwurfs- oder Veröffentlichungsschritt.
   Für Lernen, Druck und Bilder werden nur vollständige Paare mit passender Seitenkonfiguration verwendet: Deutsch/Englisch, Begriff/Definition oder Frage/Antwort. `sideSelection` bewahrt auch eine erst teilweise ausgewählte Konfiguration; `sidePreset` beschreibt das vollständige Paar. Bestehende Sets behalten ihre Metadaten und Codes. Eine Anlage verteilt das Set nicht automatisch an Geräte; Code/QR übernimmt weiterhin die Freigabe.
4. Ein Code fügt nur den stabilen Set-Pfad zum Tablet hinzu. Beim Öffnen kommt die aktuelle Revision direkt vom Server. Während eines laufenden `Üben`-Durchgangs werden ausschließlich neu fertiggestellte Bilder anhand stabiler Karten-IDs ergänzt; Reihenfolge, Position, Kartenseite und Hinweise bleiben erhalten. Inhaltliche Kartenänderungen greifen erst beim nächsten Start.
5. Lernstände bleiben am Tablet. Unveränderte Karten behalten bei einer Set-Bearbeitung ihre Karten-ID; nur inhaltlich geänderte Karten erhalten eine neue ID.
6. Importmaterial wird als bearbeitbarer Vorschlag in den bestehenden Editor übernommen und automatisch gespeichert. Die Seitenauswahl bleibt bewusst der Lehrkraft überlassen. Eine optionale Importnotiz wie `nur Lektion 1, Deutsch → Englisch` steuert Auswahl und Richtung. Originaldateien werden nicht gespeichert. Modellantworten werden serverseitig gegen dasselbe Set-Datenmodell validiert.
7. Das Löschen eines Sets entfernt ihn sofort aus dem Lehrerbereich. Codes und Pfade sind danach nicht mehr auflösbar; Tablet-Verknüpfungen und zugehörige Lernstände werden bereinigt. Intern bleibt der Datensatz archiviert, damit ein versehentliches Löschen im Runtime-Speicher grundsätzlich wiederherstellbar bleibt.
8. Lernbilder sind eigene persistente Assets. Eine Karte referenziert nur ihre aktive Variante; ältere Generierungen bleiben für direkten Rückwechsel und die spätere Bibliothek erhalten. Inhaltsänderungen lösen die bestehende neue Karten-ID aus und entkoppeln damit veraltete Bilder. Beim Ergänzen eines Sets startet „Neue Bilder (N)“ ausschließlich die in dieser Bearbeitung neu angelegten vollständigen Karten als gemeinsamen Sheet-Job. Die Aktion wartet auf Autosave; ältere bildlose Karten bleiben dabei unberührt. Ohne neue Karten bleibt „Bilder erstellen“ für alle fehlenden Bilder verfügbar.
9. `Üben` mischt beim Start und ist danach ein zyklisch vor- und rückwärts durchwischbarer Stapel ohne Selbsteinschätzung oder Wiederholungsrunde. Die freiwillige Hilfe zeigt beim ersten Klick den Anfang jedes längeren Antwortworts sowie sehr kurze Funktionswörter und ergänzt mit jedem weiteren Klick pro Wort einen Buchstaben bis zur vollständigen Lösung; Wortgrenzen und Satzzeichen bleiben unverdeckt. `Testen` zieht ohne Wiederholung eine zufällig ausgewählte und gemischte Teilmenge des Sets. Die erste Prüfung zählt als Testergebnis; korrekte Zeilen werden mit Farbe und Haken gesperrt, falsche bleiben mit Farbe und Kreuz bearbeitbar, bis alle Antworten stimmen. Unter der Liste bleibt das Ergebnis des ersten Versuchs als Anzahl, Prozentwert und unverbindliche Notenorientierung nach dem IHK-Schlüssel sichtbar. Es gibt dort keine Bilder, Audios, Hinweise oder eingeblendeten Lösungen.
10. Druckausgaben lesen das aktuelle Set nur aus. Bei Vokabeltest und Vokabelliste sind links stets alle Set-Vokabeln sichtbar; Klicks nehmen sie nur für die jeweilige Druckausgabe auf oder heraus. Die Liste startet mit allen Vokabeln, der Test mit den ersten zehn. Beim Test fügen Klicks eine temporäre Kopie unten auf dem HTML-Blatt hinzu oder entfernen sie. Titel, Klasse, Arbeitsauftrag, beide Spaltenüberschriften und Blatt-Begriffe sind dort direkt bearbeitbar. Die Überschriften starten neutral als „Begriff“/„Antwort“, weil die Abfragerichtung je Aufgabe unterschiedlich sein kann. Die HTML-Vorschau teilt beide Druckarten automatisch in feste A4-Seiten und wiederholt Fortsetzungsköpfe, Spalten sowie Seitennummern nach denselben nutzbaren Höhen wie der PDF-Export. Auf Folgeseiten des Tests stehen nur ein kompakter Fortsetzungskopf, die Spalten und die weiterlaufenden Aufgaben; Klasse, Name, Datum und Arbeitsauftrag werden nicht wiederholt. Test und Liste nutzen im PDF eine durchgehende klassische Serifenschrift. Die geschützte PDF-Route akzeptiert nur vorhandene, eindeutige Karten-IDs und validiert die temporären Blatttexte; sie erzeugt das PDF ohne Testkonfiguration oder Datei im Runtime-Speicher abzulegen. Der Download der Liste wird erst nach erfolgreicher PDF-Erstellung freigegeben.

Runtime-Daten liegen ausschließlich in `DATA_DIR` und dürfen bei Deployments nicht ersetzt werden. JSON-Schreibvorgänge laufen serialisiert und über atomare Dateiersetzung. Das ist für den einzelnen Beelink-Prozess bewusst einfach; bei mehreren Serverinstanzen muss die Store-Schicht später durch eine gemeinsame Datenbank ersetzt werden.

Die fünf historisch mitgelieferten Lernsets werden beim ersten Start idempotent Julius zugeordnet. Dabei bleiben Set-Pfade, Karten-IDs und damit bestehende Set-Verknüpfungen der Tablets und Lernstände erhalten. Die Dateien unter `sets/` dienen danach nur noch als einmalige Migrationsquelle und erscheinen nicht als Vorlagen.

## Lehrer-Arbeitsbereich

Die Lehreransicht nutzt die gesamte Desktopbreite für Lerndecks, Set-Liste und Editor. Zuordnung und Reihenfolge werden ausschließlich in den beiden linken Bibliotheks-Panels geändert: Sets auf ein Lerndeck oder `Nicht eingeordnet` ziehen; Sets und Lerndecks innerhalb ihrer Liste sortieren. Ziehgriffe funktionieren auch per Touch; Alt + Pfeil hoch/runter sortiert, Alt + Pfeil links/rechts wechselt bei Sets das Lerndeck. Die Reihenfolge bleibt nach Inhaltsspeicherung und Reload erhalten. Der Editor zeigt die Zuordnung nur im Pfad am Titel, ohne Auswahlfeld. Admins wechseln über die anklickbare Bereichsüberschrift oben links zwischen Lernsets und Tablets. Das kleine Menü zeigt beide Bereiche mit Icon; normale Lehrkräfte erhalten eine einfache Lernsets-Überschrift ohne Bereichswechsel. Die Tablet-Info neben `Teilen` zeigt Admins beim Darüberfahren, Fokussieren oder Anklicken die Geräte, die das Set hinzugefügt haben, und aktualisiert sich beim Öffnen. Der Set-Editor bietet keine Entfernung vom Tablet; Schüler ordnen ihre Sets selbst. Tabletverwaltung und diese Info bleiben auch serverseitig auf Admins beschränkt. Neue Sets und Änderungen speichern automatisch. Oben rechts stehen „Wird gespeichert …“, „Gespeichert“ oder „Nicht gespeichert“ mit erneuter Speicheroption. Beim Wechsel werden laufende Änderungen zuerst abgeschlossen; Fehler behalten den Editor offen. Es gibt keine Speichern-/Veröffentlichen-Buttons und keine Entwurfsansicht. Die Speicherbestätigung sitzt am Set-Titel, Lernen/Drucken/Teilen bilden darunter eine gemeinsame Zeile. Die Vokabelliste ist eine offene Tabelle mit feinen Zeilentrennern und erst beim Bearbeiten hervorgehobenen Feldern. Import und Bilder stehen bei den Vokabeln; neue Vokabeln werden nur über die Plus-Zeile am Tabellenende ergänzt. Diese Aktionen verwenden die bisherigen Abläufe. `Lernen` startet die gemeinsame Schüler-Modusauswahl in einem eigenen Tab, ohne Tablet-Lernstände zu schreiben; der Editor bleibt im Hintergrund geöffnet. Details zu Rechten, Persistenz, Navigation und Browserchecks: [docs/TEACHER_WORKSPACE_PLAN.md](docs/TEACHER_WORKSPACE_PLAN.md).

## Helles und dunkles Design

Es gibt genau zwei Darstellungen: **Hell = Leinen**, **Dunkel = Nachtblau** (Standard). Lehrkräfte wechseln direkt im Zahnrad-Menü, Schüler mit dem kleinen Schalter oben in ihrer Lernset-Übersicht. Es gibt keinen zusätzlichen Darstellungsdialog und keine Farb-Unterauswahl. Die Schülerwahl gilt auch beim Öffnen von Üben, Eingabe und Testen; eine Lehrervorschau übernimmt stattdessen die Lehrerwahl. Helle Flächen sind warm sandfarben getönt. Das gestapelte Lerndeck-Logo behält in beiden Modi seine drei Originalfarben; Druckblätter bleiben weiß. Wortmarke und Spinner des App-Ladebildschirms verwenden in Lehrer- und Lernansichten dieselben Theme-Farben; auf Leinen ist die Wortmarke dunkel.

Die Auswahl wird getrennt pro Browser/App in `lerndeck-teacher-appearance-v1` beziehungsweise `lerndeck-student-appearance-v1` als `{ mode }` gespeichert, unabhängig von Konto, Tablet-PIN und Lernset. Alte Lehrerpräferenzen behalten ihre Helligkeit und verwenden ab sofort Leinen/Nachtblau. Ungültige Werte starten dunkel; bei gesperrtem Speicher funktioniert der Schalter weiterhin für den aktuellen Besuch.

`appearance.js` lädt die Wahl vor dem ersten Darstellen und erzeugt beide Schalter, `appearance.css` enthält die gemeinsame Palette. Schüler-Komponenten verwenden semantische Farbrollen mit ihren bisherigen Dunkelfarben als Fallback; Lernbilder, Deckfarben und Feedback bleiben eigenständig. Browserchecks für Auswahl, Reload, getrennte Präferenzen, Kontrast, Druck und Lernmodi: `BASE_URL=http://127.0.0.1:4012 npx playwright test scripts/teacher-appearance.spec.js scripts/student-appearance.spec.js scripts/teacher-practice-flow.spec.js scripts/pwa-appearance.spec.js`. Screenshots liegen unter `artifacts/teacher-appearance/` und `artifacts/student-appearance/`; Ladebildschirm-Checks liegen unter `artifacts/pwa-appearance/`.

## Lokaler Start

```bash
npm install
npm run provision:teachers -- --data-dir=/absoluter/pfad/zur/runtime/data
DATA_DIR=/absoluter/pfad/zur/runtime/data OPENAI_API_KEY=... npm start
```

Der Provisionierungsschritt gibt einmalig zufällige Startpasswörter für Konten ohne Passwort aus und gleicht Rollen aus `data/teachers.seed.json` ab. Bereits eingerichtete Passwörter und Sitzungen bleiben bei einer Rollenänderung unverändert. Die Startpasswörter werden sicher persönlich weitergegeben; nach der ersten Anmeldung führt Lerndeck direkt zum Passwortwechsel im Zahnrad-Menü. `--reset-passwords` setzt bewusst auch bestehende Passwörter zurück und gehört nicht in den normalen Ablauf. Passwörter und API-Key gehören weder ins Repository noch in Screenshots oder Tickets.

Ein einzelnes vergessenes Lehrkraftpasswort wird gezielt zurückgesetzt, ohne andere Konten zu verändern: `npm run provision:teachers -- --data-dir=/absoluter/pfad/zur/runtime/data --reset-teacher=julius`. Dabei werden bestehende Sitzungen dieses Kontos widerrufen und ein neues einmaliges Startpasswort ausgegeben.

Der KI-Import überträgt eingegebenes Material an die konfigurierte OpenAI API. Für den Feldtest nur Material ohne personenbezogene Schülerdaten verwenden und die organisatorische Freigabe der Schule beziehungsweise des Trägers beachten.

Bilder und Screenshots werden für kleine Buchschrift in Originalauflösung visuell ausgewertet; PDFs liefern Text und Seitenbilder in hoher Detailstufe. Bei DOCX und PPTX verarbeitet die API dagegen den extrahierten Text, nicht darin eingebettete Bilder oder Diagramme. Buchseiten deshalb direkt als Bild oder PDF hochladen. Begriffe müssen aus dem Material stammen; ausdrücklich gewünschte Übersetzungen oder kurze Definitionen darf das Modell fachlich ergänzen.

Wichtige Umgebungsvariablen:

- `DATA_DIR`: persistenter Runtime-Ordner, im Betrieb zwingend außerhalb des Releases
- `OPENAI_API_KEY`: serverseitiger Key für KI-Import und Bildgenerierung; ohne ihn funktionieren manuelle Sets und klare Textlisten weiter
- `OPENAI_IMPORT_MODEL`: optional, Standard `gpt-5.6-terra`
- `OPENAI_IMAGE_GENERATION_MODEL`: optional, vorerst Standard `gpt-image-2` für neue Bilder und 6er-Sheets
- `OPENAI_IMAGE_EDIT_MODEL`: optional, vorerst Standard `gpt-image-2` für gezielte Korrekturen vorhandener Varianten; die getrennte Konfiguration erlaubt später einen geprüften Modellwechsel
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

## Satzübung „Say it in a sentence“

Die gemeinsame Modusauswahl ergänzt die bisherigen Übungen. Sprachrichtung und Umfang (1 bis höchstens 20 vollständige Set-Karten, ohne Wiederholung) werden vor dem Start gewählt. Pro Karte erzeugt der Server einen kurzen Satz in der sichtbaren Sprache. Der fett markierte Ausdruck kommt aus der Set-Vokabel und ist im Antwortschema fest vorgegeben; die Übersetzung bleibt verborgen. Bei Alternativen wird ein Ausdruck, bei einer Verbformenreihe der Infinitiv fokussiert. Bereits hinterlegte ganze Sätze bleiben als Übersetzungsauftrag möglich.

`lib/sentence-service.js` prüft Verständlichkeit/Grammatik, vollständige Bedeutung und Zielvokabel separat. Richtige Satzstellung, Flexionen und hinterlegte Antwortvarianten sind erlaubt. Ein kurzer deutscher Hinweis unterstützt die Überarbeitung, ohne eine fertige Übersetzung zu liefern. Unsicherheit und technische Fehler nehmen keinen Satz an. `Weiter` wird erst nach Annahme angeboten; der vollständige Lauf zählt wertungsfrei im bestehenden `modeProgress.sentence`. Lehrervorschauen schreiben keine Tablet-Lernstände.

`POST /api/sentence-practice/:action` (`start`, `resume`, `check`, `next`) verlangt bei jedem Aufruf eine aktive Tablet-Sitzung plus Set-Abonnement oder Lehrkraftsitzung plus bestehendes Set-Leserecht. Set-Inhalte, Ziele und Kartenwahl kommen vom Server. Lauf-ID und Satz-ID verhindern fremde/alte Prüfungen und übersprungene Aufgaben. Gleiche Antworten und wiederholte Weiter-Anfragen sind idempotent. Pro Identität höchstens 3 Starts und 40 Prüf-/Weiter-Anfragen pro Minute, global 8 parallele Aufrufe; Läufe sind auf 1000 begrenzt.

Konfiguration: `OPENAI_SENTENCE_API_KEY` optional, sonst vorhandener serverseitiger `OPENAI_API_KEY`; `OPENAI_SENTENCE_MODEL` standardmäßig `gpt-6-luna`, Responses API mit `reasoning.effort: none`, strukturiertem JSON, `store: false`, 20 Sekunden Timeout und ohne automatische Provider-Retries. Keine Schlüssel im Browser. Eine Generierung pro benötigtem Satz und eine Prüfung pro geändertem Versuch; keine Vorabgenerierung ungenutzter Sätze. Anbieteraufrufe werden in Tests injiziert/gemockt.

Läufe und letzte Versuche bleiben höchstens 12 Stunden im Server-Arbeitsspeicher; keine Satzinhalte in Runtime-JSON oder Logs. Im aktuellen Browser-Tab hält `sessionStorage` Lauf-ID und Eingabe für Reloads bereit. Nach Serverneustart/Fristablauf bietet die Oberfläche einen bewussten Neustart an. Set-Editor, Bildgenerierung, Export und die bisherigen Übungen bleiben eigene Abläufe. Modellfeedback kann pädagogisch falsch liegen; deshalb keine Note, keine automatische Beherrschungsbehauptung und bei Unklarheit Überarbeiten/Lehrkraft.
