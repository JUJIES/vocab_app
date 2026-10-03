# Satzübung: gezielte Modell-Evaluation (2026-10-03)

## Durchführung

`node scripts/eval-sentence-practice.cjs --output tmp/sentence-eval.json` ist eine ausdrücklich kostenpflichtige Prüfung mit dem konfigurierten Satzmodell/API-Key; **kein Bestandteil von `npm run verify`**. `SENTENCE_EVAL_IDS=id1,id2` begrenzt einen Nachtest. `SENTENCE_SERVICE_MODULE` erlaubt einen isolierten Kandidaten. Nur synthetische Daten aus `scripts/sentence-eval-cases.json`, keine echten Schülerantworten oder produktiven Sets.

30 Basisfälle wurden mehrfach mit GPT‑6 Luna und Reasoning `none` durchlaufen. Der Dienst erzeugt pro Fall einen echten Satz für die gewählte Stufe; zur vergleichbaren Bewertung wird anschließend die kontrollierte Quellvorlage des Falls eingesetzt. Jede falsche/zulässige Antwort und eine korrekte Kontrollantwort werden geprüft. Ein falsch angenommener erster Versuch bleibt als Fehler im Bericht; der isolierte Testlauf wird nur zurückgesetzt, damit die Kontrollantwort trotzdem wirklich geprüft werden kann. Das ist kein Verhalten des Produkts.

Automatisches Ergebnis: erwartete Annahmeentscheidung, angenommene Kontrollantwort und abschließbares Weiter. **Feedbackqualität wird zusätzlich gelesen**, nicht aus einer grünen Annahmeentscheidung abgeleitet. Die Kriterien: richtige Problemstelle, verständlicher nächster Schritt, ehrliches konkretes Lob, keine fehlenden/korrigierten Zielwörter, kein vorgegebener Aufgabensatz, nützlicher anderer Grammatikfall statt Wiederholung der Erklärung.

## Beobachtungen und Änderungen

- Erste 30 Entscheidungen stimmten, aber die Texte zeigten falsche Zusatzdiagnosen, unpassende Beispiele und gelegentlich falsche Buchstabenzahlen. Eine korrekte Annahmequote allein reichte also nicht.
- Danach fielen Wortverklebungen beim festen Fokus und eine zu wörtliche Ablehnung von `Besuch → visitors` auf. Wortabstände werden im strukturierten Format und Dienst geprüft; ein begrenzter Generierungsversuch korrigiert Abstände/Länge. Unbestimmte Sammelbegriffe bekommen keine erfundene numerische Einschränkung.
- Einzelne Orts-/Zeit-Hinweise übersetzten das fehlende Detail bereits. Zitate müssen nun aus Vorlage/Eingabe stammen, Sinnhinweise sollen die Kategorie bzw. Originalstelle nennen, ohne sie zu übersetzen. Beispiele nutzen andere Wörter/Situationen; unsichere Extras erhalten eine begrenzte Reparatur mit `help: null`.
- Eine zu strenge Schutzprüfung blockierte Grammatikbeispiele bei Zeitfehlern und das schon korrekt verwendete trennbare Verb `ankommen`. Ein konkreter Grammatikfehler darf ein Transferbeispiel erhalten, auch wenn er die Bedeutung beeinflusst. Bereits richtig verwendete Zielvokabeln/Flexionen sind kein verratenes fehlendes Wort.
- Letzte vollständige Basisrunde: **30/30 erste Entscheidungen korrekt, alle korrekten Kontrollantworten angenommen**. Beispiele: `regular maintenance` ohne Häufigkeit und fehlende Zeit-/Orts-/Mengenangaben/Verneinungen wurden abgelehnt; kleine Tippfehler ebenfalls. Natürliche Wortstellung und Infinitiv-Flexionen wurden angenommen.
- Fünf weitere Grenzfälle ergänzen die Basis: natürliche Alternative `a visit`, gültige US-Schreibweise, fehlender wortinterner Apostroph, Satzfragment und weiteres ausgelassenes Häufigkeitswort. Alle fünf zusätzlichen Entscheidungen und ihre Kontrollantworten passten im Nachtest. Sie bleiben als wiederholbare Regressionen im Datensatz.
- Die zuletzt erzeugten Basis-Sätze hatten bei Einfach 3–5, Mittel 7–12 und Schwer 8–14 Wörter. Das bestätigt unterschiedliche Umfänge, ersetzt aber keine pädagogische Einstufung. Begleitwortschatz/Satzbau wurden gelesen; feste schwere Vokabeln werden nicht durch eine Stufe vereinfacht.

## Grenzen

Das ist ein gezielter synthetischer Test, keine Wirksamkeitsstudie mit Schülern und keine Garantie für beliebige Sätze. Modelle bleiben variabel. Das Feedback kann fachlich unvollkommen sein; unklare Ergebnisse werden nicht benotet/angenommen. Bei Prompt-/Modelländerungen gleiche Fälle erneut ausführen und besonders die Texte/Beispiele prüfen. Auswahl-Persistenz, sichtbare Bestätigung, Abbruch, Reset und Zyklusgrenzen werden unabhängig in `tests/sentence-order.test.js` getestet; UI in `scripts/sentence-practice.spec.js` (Chromium/WebKit, Hell/Dunkel, Desktop/schmal).
