# Dino Vocab App – Playbook

## 🎯 Ziel
Minimalistische, tablet-optimierte WebApp zum Vokabellernen.

Fokus:
- Konzentration statt Ablenkung  
- klare, ruhige UI  
- sehr einfache Bedienung (Touch-first)  
- schnelle Nutzung im Unterricht (QR / Link später)

## 🚀 MVP Scope

### Flashcard Mode (Kernfeature)
- Anzeige einer Vokabel (z. B. Deutsch → Englisch)
- Tap → Karte umdrehen (Flip)
- Swipe:
  - rechts → gewusst
  - links → nicht gewusst
- Pfeile unten:
  - Navigation (vor / zurück)

### Tippsystem (2-stufig)
- Tipp erst nach kurzer Verzögerung aktiv (ca. 2 Sekunden)
- Level 1: Kontextsatz ohne Wort  
- Level 2: Kontext + Anfangsbuchstabe  

### Wiederholungslogik
- falsche Karten sammeln
- am Ende erneut anzeigen
- Ziel: alle Karten einmal als „gewusst“ markieren

### Sternsystem (Schwierigkeit)
- Tap auf Stern
- 3 Levels:
  - grün = leicht
  - gelb = mittel
  - orange = schwer
- Speicherung im localStorage

## 🎨 Designprinzipien
- minimal, ruhig, fokussiert
- Flashcard ist zentrales Element
- keine visuelle Überladung
- smooth, subtile Animationen

## ⚙️ Technische Prinzipien
- Vanilla JS
- lokale JSON-Datei
- kein Login
- localStorage für Fortschritt

## ❌ Nicht Teil des MVP
- Login-System
- Backend
- Edit-Vorschläge
- Matching-Modus
- Audio

## 🧭 Entwicklungsreihenfolge
1. Flashcard UI + Anzeige
2. Tippsystem
3. Flip
4. Swipe-Bewertung
5. Wiederholungsrunde
6. Sternsystem (localStorage)
7. JSON laden

## 💡 Leitgedanke
Das Produkt soll sich wie ein ruhiges, klares Lernwerkzeug anfühlen.
