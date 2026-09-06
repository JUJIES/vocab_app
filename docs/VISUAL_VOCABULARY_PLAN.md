# KI-Bilder für Lernkarten

Status: **erste vollständige Produktstufe implementiert.** Sheet-Erstellung, Einzelvarianten, Asset-Historie, Fortschritt, Lehrkraftvorschau und die didaktisch gestufte Schülerdarstellung sind Bestandteil der App. Eine setübergreifende Bildbibliothek und ein eigener Modus `Bild → Wort` bleiben vertagt.

## Produktlogik

- Ein Bild gehört zum Konzept einer Karte, nicht fest zu einer Sprachseite.
- Bilder können erst für veröffentlichte Sets erzeugt werden, weil dafür stabile Set- und Karten-IDs nötig sind.
- `Bilder erstellen` verarbeitet nur Karten, denen noch kein Bild zugeordnet ist. Vorhandene Bilder werden nicht still überschrieben.
- `Alle Bilder neu` plant und erzeugt sämtliche Karten eines veröffentlichten Sets neu. Die neuen Varianten werden erst nach einem vollständig erfolgreichen Job aktiviert; alle bisherigen Varianten bleiben auswählbar.
- Ein Klick auf `Neu erstellen` erzeugt eine einzelne neue Variante, aktiviert sie nach erfolgreicher Erstellung und bewahrt alle älteren Varianten auf. Eine optionale kurze Bildnotiz steuert nur diese Variante und bleibt als Asset-Metadatum für weitere Iterationen erhalten; sie verändert weder Karteninhalt noch Karten-ID.
- Die kompakten Bildschaltflächen im Karteneditor öffnen per Hover, Fokus oder Klick eine größere Vorschau. Bis zu fünf bisherige Varianten lassen sich dort direkt wieder auswählen.
- Eine inhaltlich geänderte Karte erhält wie bisher eine neue Karten-ID und verliert damit bewusst ihre alte Bildzuordnung. Reine Bildwechsel erhalten Karten-ID und Lernstand.

## Didaktische Darstellung

- `Üben`: Das Bild bleibt auf der Frageseite verborgen und erscheint erst nach dem Aufdecken auf der Antwortseite.
- `Eingabe`: Das Bild erscheint nach dem ersten Prüfen und bleibt auch während eines nötigen Korrekturversuchs als Feedback sichtbar.
- `Testen`: Das Bild bleibt als Hilfe verborgen.
- In `Eingabe` und `Testen` wird ein verborgenes Bild mitsamt Alternativtext aus dem DOM-Zugänglichkeitsbaum genommen, damit es die Lösung nicht unbemerkt verrät.
- Karten ohne Bild behalten unverändert das bestehende ruhige Layout und zeigen keinen leeren Platzhalter.
- Die Quelldatei ist 512 × 512 Pixel groß; die Oberfläche zeigt sie je nach Modus ungefähr 140–224 CSS-Pixel groß.

## Generierung

Vor jedem Bildaufruf erzeugt ein Textmodell einen strukturierten Visual-Brief. Es erhält Set-Titel, Fach, Beschreibung, Sprachrichtung, Seitenlabels und das vollständige Deutsch/Englisch-Paar. Der Brief hält für jede Karte die beabsichtigte englische Bedeutung, eine konkrete textfreie Szene, zu vermeidende Nachbarbedeutungen, die Darstellungsstrategie und einen Unsicherheitsgrad fest. Dadurch wird beispielsweise `convenient` als „praktisch/günstig für die Situation“ geplant und ausdrücklich gegen das körperliche `comfortable` abgegrenzt. Eine fehlende oder unvollständige Planung bricht den Job ab, bevor Bilder zugeordnet werden; es gibt keinen stillen Rückfall auf die bloße Übersetzung.

Die fachliche Planung nutzt `OPENAI_VISUAL_PLANNER_MODEL`, ersatzweise das bereits konfigurierte `OPENAI_IMPORT_MODEL` beziehungsweise `gpt-5.6-terra`, mit mittlerem Reasoning und strengem JSON-Schema. Die App verwendet danach die OpenAI Images API mit `gpt-image-2` (konfigurierbar über `OPENAI_IMAGE_MODEL`). Ein Sheet enthält sechs Motive in einem festen Raster:

- Ausgabe: `1536 × 1024`, `quality: low`, WebP
- Raster: `3 × 2`
- Kachel: exakt `512 × 512`
- Reihenfolge: links nach rechts, danach die zweite Zeile
- ruhige, textfreie, konsistente Editorial-Illustrationen auf dunklem Hintergrund
- Sheets werden nacheinander erzeugt; die Lehrkraft kann parallel im Editor weiterarbeiten

Die 6er-Entscheidung priorisiert ausreichend große, eindeutig erkennbare Motive gegenüber maximaler Packdichte. Ein einzelnes Ersatzbild wird als `1024 × 1024`-Bild erzeugt und anschließend auf 512 × 512 normalisiert. Die Prompts verlangen randfüllende Hintergründe und einen einheitlichen Motivabstand. Zusätzlich entfernt die zentrale Normalisierung ausschließlich zusammenhängende, überwiegend helle Außenränder (maximal 20 Prozent je Seite) und skaliert danach wieder quadratisch; dunkle Motivflächen werden nicht pauschal beschnitten. Roh-Sheets werden nur im Arbeitsspeicher verarbeitet und nicht dauerhaft gespeichert.

## Datenmodell

Die Karte referenziert nur die aktive Variante:

```json
{
  "visual": {
    "assetId": "vis_…",
    "width": 512,
    "height": 512,
    "alt": "Lernbild zu aufwachen",
    "createdAt": "2026-08-30T12:00:00.000Z"
  }
}
```

Der öffentliche Pfad wird serverseitig aus der nicht erratbaren `assetId` als `/media/visuals/<assetId>.webp` abgeleitet. Beliebige gespeicherte URLs sind nicht erlaubt.

Alle Varianten liegen unabhängig von der aktiven Kartenreferenz im Asset-Store:

- Metadaten: `DATA_DIR/visual-assets.json`
- Dateien: `DATA_DIR/visual-assets/*.webp`
- Jobs: `DATA_DIR/visual-jobs.json`

Jedes neue Asset speichert zusätzlich seinen Visual-Brief. Damit bleiben Bedeutungsentscheidung, geplante Szene und ausgeschlossene Verwechslungen bei späteren Varianten nachvollziehbar.

Damit ist die spätere setübergreifende Bibliothek ohne Datenmigration möglich. Das Entfernen verwaister Assets bleibt bewusst einem späteren referenzprüfenden Cleanup vorbehalten.

## Job- und Konsistenzmodell

```text
queued → generating → applying → completed
                    ↘ failed
Neustart: queued/generating/applying → interrupted
```

- Pro Set ist nur ein aktiver Bildjob erlaubt.
- Die UI fragt den persistenten Status alle 1,5 Sekunden ab und zeigt `Sheet 1/3` beziehungsweise `Bild wird erstellt`.
- Ergebnisse werden erst nach erfolgreicher Verarbeitung des ganzen Jobs zugeordnet.
- Zu jedem Job gehört ein Inhalts-Hash aus Vorderseite, Rückseite und gültigen Antworten.
- Beim Anwenden wird dieser Hash erneut gegen die aktuelle Karte geprüft. Parallel geänderte Karten werden übersprungen statt mit einem veralteten Motiv versehen; das erzeugte Asset bleibt erhalten.
- Eine Bildzuordnung erhöht die Set-Revision, verändert aber nicht die Karten-ID.
- Ein Serverneustart markiert laufende Jobs als `interrupted`; die Lehrkraft startet die fehlenden Bilder anschließend erneut. Bereits vollständig gespeicherte Assets bleiben erhalten.

## Sicherheit und Betrieb

- Der OpenAI-Key bleibt ausschließlich in der Dienstumgebung; Browser und öffentliche Set-Dokumente erhalten ihn nie.
- Öffentliche Medien werden nur aus dem fest abgeleiteten Asset-Ordner und für streng normalisierte IDs ausgeliefert; der Dateiname kann keinen freien Pfad enthalten.
- Die Medienroute verwendet immutable Cache-Header. Jede neue Variante besitzt eine neue URL.
- Fehlertexte unterscheiden Konfiguration, Rate Limit und allgemeinen Providerfehler, ohne Schlüssel- oder Providerdetails auszugeben.
- Der Runtime-Ordner muss wie alle anderen Lerndeck-Daten außerhalb des Releases liegen und in Backups enthalten sein.

## Bewusst vertagt

- setübergreifende Suche und Wiederverwendung aus der vorhandenen Asset-Bibliothek
- Lehrkraft-Budgetgrenzen und Kostenübersicht
- modellgestützte automatische Prüfung des fertigen Pixels auf Schrift, vertauschte Zellen und Abweichungen vom Visual-Brief
- eigener Lernmodus `Bild → Wort` mit separatem Lernstand
- referenzprüfender Cleanup nicht mehr benötigter Assets
