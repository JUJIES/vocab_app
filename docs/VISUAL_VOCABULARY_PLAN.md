# KI-Bilder für Lernkarten – Produkt- und Architekturentwurf

Status: **Planung, nicht implementiert.** Dieses Feature gehört nicht zum Montag-MVP und darf dessen Deployment nicht verzögern.

## Ziel

Lehrkräfte sollen zu einem fertig bearbeiteten Lernset eine ruhige, einheitliche Bildserie erzeugen können. Die Bilder unterstützen Begriffsverständnis und Erinnerung, ohne geschriebene Quell- oder Zielwörter, Buchstabenhinweise, Logos oder sonstige Antworttexte zu enthalten.

Das System erzeugt nicht zwanghaft für jede Karte ein Bild. Ein vorgeschalteter Bildplan unterscheidet gut visualisierbare Gegenstände, Handlungen und schwierige beziehungsweise mehrdeutige Begriffe. Die Lehrkraft bleibt vor der Veröffentlichung in Kontrolle.

## Didaktische Produktregeln

- Ein Bild gehört zum Konzept der Karte und nicht fest zur deutschen oder englischen Seite.
- `Sichten`: Das Bild darf zusammen mit der Vokabel sichtbar sein.
- `Üben`: Das Bild erscheint standardmäßig erst nach dem Aufdecken.
- `Eingabe`: Das Bild erscheint erst nach Eingabe beziehungsweise Korrektur.
- Ein späterer Modus `Bild → Wort` ist ein eigener Lernmodus mit eigener Fortschrittslogik. Er ersetzt keine normale Abrufübung.
- Bilder dürfen die Bedeutung veranschaulichen, aber niemals das geschriebene Wort, dessen Anfangsbuchstaben, Aussprache oder eine Übersetzung zeigen.
- Abstrakte oder mehrdeutige Begriffe dürfen bewusst ohne Bild bleiben. Die Lehrkraft kann die Planung übersteuern.

Diese Trennung ist wichtig, weil Bilder beim Aufbau einer Wort-Bedeutungs-Verknüpfung helfen können, informative Bilder vor einem aktiven Abruf aber zugleich die eigentliche Erinnerungsleistung erleichtern und damit schwächen können.

## Lehrerfluss

1. Set manuell erstellen oder importieren und inhaltlich prüfen.
2. Set speichern, damit stabile Set- und Karten-IDs existieren.
3. Sekundäre Aktion `Bilder ergänzen` öffnen.
4. Das System erzeugt einen strukturierten Bildplan pro Karte:
   - `generate`, `skip` oder `needs_review`
   - Bildtyp: Gegenstand, Handlung oder abstrakte Szene
   - beabsichtigte Bedeutung und Motivbeschreibung
   - Risiken wie Mehrdeutigkeit, Text im Motiv oder kulturelle Missverständnisse
5. Lehrkraft wählt Karten ab oder passt einzelne Motivbeschreibungen an.
6. `Entwürfe erzeugen` startet einen persistenten Hintergrundjob.
7. Die Oberfläche zeigt ausschließlich die zugeschnittenen Einzelbilder, nicht das technische Sheet.
8. Pro Karte stehen `Behalten`, `Neu erstellen` und `Ohne Bild` zur Verfügung.
9. Abgelehnte Bilder werden gesammelt neu erzeugt. Bei ein oder zwei Bildern ist eine Einzelgenerierung sinnvoller, ab drei Bildern ein neues kleines Sheet.
10. `Auswahl übernehmen` hängt alle akzeptierten Bilder atomar an die aktuelle Set-Revision. Vorher sehen Schüler keine halbfertige Serie.

Ein Inhaltsedit nach der Bildplanung macht betroffene Vorschläge ungültig. Ändert sich Vorder- oder Rückseite einer Karte, wird das vorhandene Bild automatisch entkoppelt. Ein reiner Bildaustausch verändert dagegen weder Karten-ID noch Lernstand.

## Technische Pipeline

```text
gespeichertes Set
  → strukturierter Bildplan mit GPT-5.6 Terra
  → Gruppierung nach Motivtyp
  → Sheet-Generierung mit GPT-Image-2
  → deterministisches Zuschneiden
  → automatische Prüfung pro Kachel
  → Lehrerprüfung
  → atomare Zuordnung zum Set
```

Für die reine Generierung ist die direkte Image API vorgesehen. Der bestehende Text-/Importdienst und die Bildgenerierung bleiben getrennte Services, verwenden aber denselben serverseitigen Geheimnis- und Fehlerbehandlungsstil. Ein optionaler separater `OPENAI_IMAGE_API_KEY` wäre für Kostenkontrolle sinnvoll; ein Fallback auf `OPENAI_API_KEY` kann lokal erlaubt werden.

## Sheet-Strategie und Validierung

Startannahme:

- 8 Motive pro Sheet
- Raster `4 × 2`
- Ausgabe `2048 × 1024`
- exakt `512 × 512` pro Kachel
- feste Reihenfolge: links nach rechts, danach nächste Zeile
- großzügiger Sicherheitsabstand innerhalb jeder Kachel
- zunächst niedrige Bildqualität für kleine Lernkarten und schnelle Entwürfe

Vor der Festlegung wird mit denselben 24 repräsentativen Karten ein Vergleich durchgeführt:

- 6 Motive: `3 × 2`
- 8 Motive: `4 × 2`
- 12 Motive: `4 × 3`

Gemessen werden korrekte Zuordnung, Textfreiheit, Schnittsicherheit, visuelle Eindeutigkeit und Stilkonsistenz. Der höchste Wert mit mindestens ungefähr 90 Prozent brauchbaren Kacheln wird Standard. Voraussichtlich benötigen Handlungen und abstrakte Szenen kleinere Sheets als einfache Gegenstände.

Die automatische Nachprüfung verwendet die erwartete Karten-ID und Motivbeschreibung. Sie verwirft Kacheln bei:

- sichtbarer Schrift, Zahlen, Logos oder Wasserzeichen
- falscher oder vertauschter Bedeutung
- Motivteilen aus einer Nachbarkachel
- unlesbarer Darstellung bei Zielgröße
- problematischer Mehrdeutigkeit oder Dublette

Die Modellprüfung ist nur eine Vorfilterung. Die Lehrkraft bestätigt das Ergebnis.

## Datenmodell und Persistenz

Das bestehende kanonische Kartenmodell wird nur optional erweitert, beispielsweise:

```json
{
  "visual": {
    "assetId": "vis_…",
    "width": 512,
    "height": 512,
    "description": "Ein einzelner Apfelbaum in einem ruhigen Obstgarten"
  }
}
```

Wichtige Regeln:

- Der Pfad wird aus `assetId` abgeleitet und nicht als beliebige URL gespeichert.
- Generierungsplan, Zwischenstände und Ablehnungsgründe liegen in einem getrennten Job-Store, nicht im öffentlichen Set-Dokument.
- Vor dem Anhängen wird ein Hash aus Karten-ID, Vorderseite und Rückseite geprüft. Veraltete Jobs dürfen keine Bilder an inzwischen geänderte Karten hängen.
- Bildänderungen erhöhen die Set-Revision, behalten aber die semantische Karten-ID.
- Inhaltlich geänderte Karten erhalten wie bisher eine neue ID und verlieren die alte Bildzuordnung.
- Bilder liegen unter `DATA_DIR`, damit Deployments sie nicht überschreiben.
- Öffentliche Set-Dokumente enthalten nur eine immutable, nicht erratbare Medienadresse. Base64 gehört nicht ins JSON.
- Einzelbilder werden nach dem Zuschneiden als WebP gespeichert. Roh-Sheets sind nur temporäre Job-Artefakte.
- Verwaiste Dateien werden zunächst sicher aufbewahrt und später über einen gezielten Cleanup mit Referenzprüfung entfernt.

Für das Zuschneiden und WebP-Encoding ist eine plattformübergreifende Bildbibliothek nötig. `sharp` ist dafür die kleinste sinnvolle Node-Abhängigkeit; ein Betriebssystemkommando wäre auf dem Windows-Beelink nicht portabel genug.

## Hintergrundjobs

Bildgenerierung darf keine lange HTTP-Anfrage im Lehrerbrowser sein. Der Server legt einen persistenten Job an und verarbeitet Sheets kontrolliert nacheinander, um Rate Limits und gleichzeitige Kosten zu begrenzen. Die UI fragt den Status ab und kann geschlossen werden.

Minimaler Jobzustand:

```text
planned → generating → reviewing → ready → applied
                     ↘ failed / interrupted
```

Ein Serverneustart markiert einen laufenden Job zunächst als `interrupted`; die Lehrkraft kann ihn idempotent fortsetzen. Pro Set darf nur ein aktiver Bildjob existieren.

## Darstellung in der Schüler-App

- Zielgröße in der Oberfläche ungefähr 220–280 CSS-Pixel; Quelldatei 512 × 512 für scharfe iPads.
- Ruhige Einbettung in den bestehenden Karteninhalt, ohne zusätzliche Animation oder dekorative Rahmen.
- Beim Sichten bleibt die Bildposition beim Drehen stabil, damit Wort und Bedeutung als Einheit wahrgenommen werden.
- In Abrufmodi wird das Bild erst nach dem Antwortversuch eingeblendet.
- Die Bildbeschreibung darf vor der Antwort nicht als zugänglicher Alternativtext die Lösung verraten. Vor dem Aufdecken ist das Bild deshalb dekorativ oder verborgen; nach dem Aufdecken kann eine sinnvolle Beschreibung verfügbar sein.
- Karten ohne Bild müssen ohne leere Platzhalter genauso wertig aussehen.

## Promptentwurf für ein 4×2-Sheet

```text
Use case: scientific-educational
Asset type: vocabulary-learning contact sheet for deterministic cropping

Primary request:
Create exactly eight independent mnemonic illustrations in one image.
They support foreign-language vocabulary learning. Communicate meaning
visually, but never display the written source word, translation, spelling,
initial letters, pronunciation clues, captions, or labels.

Canvas:
Exact 2048 × 1024 image. Exact 4-column × 2-row grid.
Each cell is an independent 512 × 512 square in row-major order.
Keep every important subject inside a generous safe margin.
No object or background element may cross into another cell.

Visual style:
Calm, high-quality editorial classroom illustration. Soft natural shapes,
restrained warm colors, subtle texture, one clear focal subject or action,
quiet backgrounds, consistent lighting and level of detail. Clearly
recognizable at small size and suitable for students.

Cell plan:
1. Top-left: <precise visual concept and intended sense>
2. Top-center-left: <concept>
3. Top-center-right: <concept>
4. Top-right: <concept>
5. Bottom-left: <concept>
6. Bottom-center-left: <concept>
7. Bottom-center-right: <concept>
8. Bottom-right: <concept>

Hard constraints:
No text of any kind. No letters, numbers, captions, labels, speech bubbles,
watermarks, logos, written signs, or recognizable branding. No rebuses or
spelling clues. Do not repeat subjects, merge neighboring scenes, or add
unrequested objects. Represent the exact intended sense of ambiguous words.
```

Der Bildplan formuliert die Zellbeschreibungen anhand beider Kartenseiten. Beispielsweise muss `bank` zusammen mit `Sitzbank` ein anderes Motiv erhalten als zusammen mit `Bankinstitut`.

## Umsetzungsschritte

1. **Technischer Spike:** 24 reale Karten mit 6er-, 8er- und 12er-Sheets erzeugen, zuschneiden und bewerten. Zugang zu GPT-Image-2 und reale Laufzeit/Kosten prüfen.
2. **Backend-Grundlage:** optionales Karten-Visual, persistente Assets, Job-Store, sichere Medienroute und Inhalts-Hash ergänzen.
3. **Lehreroberfläche:** Bildplan, Auswahl, Fortschritt, Review und gesammelt erneuern.
4. **Schüleroberfläche:** zuerst nur `Sichten` sowie Bild nach Aufdecken/Korrektur integrieren.
5. **Feldtest:** Ablenkung, Verständlichkeit, Ladezeit und Nutzen auf iPad Gen 9 beobachten.
6. **Spätere Erweiterung:** eigenen Modus `Bild → Wort` fachlich definieren und mit separatem Lernstand ergänzen.

## Offene Entscheidungen vor Implementierung

- maximales Sheet-Raster nach dem technischen Vergleich
- `quality: low` als endgültige Thumbnailqualität oder nur als Entwurf
- exakte visuelle Stilrichtung nach einer kleinen Referenzserie
- Aufbewahrungsdauer abgelehnter und verwaister Bilder
- separater Image-API-Key und mögliche Kostenbegrenzung pro Lehrkraft
- Verhalten für bereits laufende Jobs bei Serverneustart

