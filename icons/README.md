# Lerndeck-App-Icon

`lerndeck-app-icon-master-v1.png` ist der unveränderte, mit dem eingebauten ImageGen-Werkzeug erzeugte Raster-Master. Die ausgelieferten PNGs werden daraus deterministisch skaliert, auf `#081329` abgeflacht und ohne Alpha-Kanal gespeichert. Dadurch verwenden Browser, macOS, iPadOS und Relution dasselbe Motiv ohne unerwartete Maskenränder.

## Finaler ImageGen-Prompt

```text
Use case: logo-brand
Asset type: production app icon master for a calm educational flashcard web app
Primary request: Create an original, text-free app icon based on exactly three stacked learning-card layers, echoing the existing Lerndeck mark. The three layers should read immediately as a compact deck: top layer cool slate blue, middle layer restrained deep teal, bottom layer muted warm bronze.
Scene/backdrop: deep midnight navy square background with a very subtle center glow
Subject: one centered geometric stack of exactly three thin rounded diamond/card layers, slightly separated vertically, seen in a gentle isometric/front perspective; no additional objects
Style/medium: premium modern operating-system app icon, refined dimensional materials, soft satin glass/metal finish, subtle controlled highlights and ambient depth, simple enough to stay recognizable at 32 px
Composition/framing: square 1:1, symbol centered, balanced generous safe margin of at least 18 percent on every side, strong clean silhouette
Lighting/mood: calm, academic, trustworthy, understated
Color palette: midnight navy background; slate blue, deep teal, muted bronze accents; off-white only as a very small highlight if needed
Materials/textures: smooth satin surfaces with restrained depth, no noisy texture
Constraints: exactly three layers; no text, no letters, no numbers, no book, no graduation cap, no Apple logo, no trademarks, no watermark; no thin details that vanish at small sizes; opaque full-bleed background; icon artwork must remain inside the central 64 percent safe zone so it works with circular and squircle masks
Avoid: generic AI sparkles, neon colors, childish cartoon styling, photorealistic scene, excessive 3D extrusion, busy gradients, mockup presentation, device frame
```

## Ausgelieferte Varianten

- `icon-1024.png`: großer allgemeiner Manifest-Eintrag
- `icon-512.png`: allgemeiner Manifest-Eintrag
- `icon-512-maskable.png`: Maskable-Manifest-Eintrag; der Master hält die zentrale Safe-Zone ein
- `icon-192.png`: kleiner Manifest-Eintrag
- `apple-touch-icon.png`, `apple-touch-icon-167.png`, `apple-touch-icon-152.png`: Apple Home Screen
- `relution-webclip-512.png`: manueller Upload in Relution
- `favicon-32.png`: Browser-Tab

Die Größen und der fehlende Alpha-Kanal werden in `tests/pwa.test.js` geprüft.
