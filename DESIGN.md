# Design System Specification: The Academic Sanctuary

> Status: Diese Datei beschreibt die visuelle Zielrichtung. Teile der bestehenden Schüler- und Lehreroberfläche verwenden noch das ältere dunkle Theme. Vor dem Unterrichtsrollout ist ein gezielter visueller Review vorgesehen; Produkt- und Datenlogik sollen dafür nicht erneut umgebaut werden.

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Stoic Atelier."** 

In a world of dopamine-driven educational apps filled with loud colors and frantic gamification, this system takes the opposite approach. It is an intentional, quiet environment designed for deep work and cognitive clarity. By leveraging the large canvas of a tablet, we move away from "mobile-first" density toward a "High-End Editorial" experience. 

The system breaks the "template" look through **intentional asymmetry** and **breathable compositions**. We do not use borders to define space; we use the luxury of white space and subtle shifts in tonal depth. The goal is a digital space that feels like a physical, high-quality linen notebook—substantial, tactile, and calm.

---

## 2. Colors: Tonal Architecture
This palette is rooted in soft neutrals to minimize eye strain and maximize concentration. 

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. Boundaries must be defined solely through background color shifts. For example, a `surface-container-low` section sitting on a `surface` background provides all the definition a user needs.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine paper.
- **Base Layer:** Use `surface` (#f7fafc) for the primary application background.
- **Secondary Areas:** Use `surface-container-low` (#eff4f7) for sidebar navigation or secondary content panels.
- **Actionable Containers:** Use `surface-container-lowest` (#ffffff) for the primary content cards to create a "lifted" feel.
- **Contextual Insets:** Use `surface-container-high` (#dfeaef) for recessed areas like search bars or inactive input states.

### The "Glass & Gradient" Rule
To add soul to the minimalism, main Call-to-Action (CTA) backgrounds or hero headers should utilize a subtle linear gradient from `primary` (#555f71) to `primary-container` (#d9e3f9). For floating overlays, use a **Backdrop Blur** (20px–30px) combined with a semi-transparent `surface-container-lowest` at 80% opacity to create a "frosted glass" effect.

---

## 3. Typography: The Editorial Voice
We use **Manrope** for its geometric clarity and modern humanist touch. The hierarchy is designed for legibility at a distance (tablet-first).

*   **Display (lg/md/sm):** Used for chapter titles and milestone headers. These should be set with tight letter-spacing (-0.02em) to feel like a high-end magazine.
*   **Headline & Title:** Used for lesson subtitles and card headers. High contrast between `on-surface` (#283439) and the background is non-negotiable.
*   **Body (lg/md):** The workhorse of the system. `body-lg` (1rem) is the default for reading passages. Ensure a generous line-height (1.6) to prevent visual fatigue.
*   **Labels:** Reserved for metadata and micro-copy. Use `on-surface-variant` (#546166) to create a clear distinction from primary content.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are often too "digital." We convey hierarchy through environmental light.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. The 2% shift in brightness provides a soft, natural lift.
*   **Ambient Shadows:** If a floating element (like a modal) requires a shadow, use: `box-shadow: 0 12px 40px rgba(40, 52, 57, 0.06);`. This mimics natural light rather than a harsh drop shadow.
*   **The "Ghost Border" Fallback:** If a boundary is strictly required for accessibility, use the `outline-variant` (#a7b4ba) at **15% opacity**. Never use 100% opaque borders.

---

## 5. Components: Purposeful Utility

### Buttons
*   **Primary:** Filled with `primary` (#555f71). Text is `on-primary` (#f6f7ff). Use `xl` (1.5rem) rounded corners.
*   **Secondary:** Filled with `secondary-container` (#d6e4f7). Text is `on-secondary-container` (#455363).
*   **Tertiary:** No background. Bold `primary` text. Use for less critical actions like "Back" or "Cancel."

### Cards & Lists
*   **Rule:** Forbid the use of divider lines. 
*   **Implementation:** Separate list items using `3` (1rem) vertical spacing. Use a `surface-container-low` hover state to indicate interactivity. Cards should use `lg` (1rem) rounded corners.

### Input Fields
*   **State:** Use `surface-container-high` as the background. 
*   **Focus:** Transition to a `surface-container-lowest` background with a subtle `primary` (10% opacity) "Ghost Border."
*   **Typography:** All input text must be `body-lg` for maximum readability on tablets.

### Progressive Progress Indicator (Contextual)
Instead of a gamified "XP bar," use a subtle, thin (2px) line at the top of the container using `primary-fixed-dim` (#cbd5eb), with the active progress in `primary`.

---

## 6. Do's and Don'ts

### Do
*   **Do** embrace asymmetry. Center-aligning everything feels like a template. Use the spacing scale (`20` or `24`) to create wide margins on the left or right.
*   **Do** use `headline-lg` for empty states. Treat them like a title page of a book, not an error message.
*   **Do** ensure all touch targets are at least `12` (4rem) in height/width for tablet ergonomics.

### Don't
*   **Don't** use pure black (#000000). Use `on-surface` (#283439) for a softer, premium feel.
*   **Don't** use icons as the primary way to communicate. This is an education app; rely on the beautiful typography of this system to lead the way.
*   **Don't** use "Pop" colors for success states. A successful action should feel like a quiet "noted," not a celebration. Use `tertiary` (#5c5d78) for subtle affirmations.

---

## 7. Spacing & Grid
The system operates on a flexible **8.5rem (24)** outer margin for tablets. This creates a focused central column for reading while leaving room for the user's hands to grip the device without obscuring content. Use `spacing-6` (2rem) as the standard "breathing room" between content blocks.
