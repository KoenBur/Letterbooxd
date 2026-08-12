# Design System

## Direction

Night Library is a contemporary cultural index: dense aubergine ink, warm paper, acidic coral wayfinding, visible grid rails, and real book covers. It should feel collected and opinionated, never like a generic SaaS dashboard or a nostalgic beige library.

## Color

- Night: `oklch(18% 0.035 323)`, page background and primary shell.
- Raised night: `oklch(22% 0.042 323)`, inputs and elevated sections.
- Paper: `oklch(95% 0.025 83)`, book-detail reading surface.
- Coral: `oklch(71% 0.19 31)`, navigation state, primary action, and page mastheads.
- Acid: `oklch(88% 0.16 108)`, tactile shadow and completion highlight only.
- Light ink: `oklch(96% 0.014 83)`, primary text on night.

Use coral in three roles: active navigation, primary controls, and mastheads. Acid is a supporting signal, not a second general accent.

## Typography

- Display: Anybody, variable width. Use for page names and book titles, with tight tracking and compressed width on major headings.
- UI and body: Public Sans. Use for controls, metadata, descriptions, reviews, and forms.
- Major marketing headings may be uppercase and highly compressed. Product labels remain conventional and readable.

## Shape and Material

- Radius scale: 3px controls, 4 to 5px panels, 5 to 7px book fore-edges.
- Avoid glass, pill-shaped general controls, and soft floating cards.
- Use thin rails for structure and offset hard shadows for tactile book objects.
- Book covers are the primary imagery and provide most of the palette variation.

## Layout

- Maximum shell width: 1400 to 1480px.
- Page mastheads use a committed coral field with a restrained diagonal rule texture.
- Content pages use predictable grids. Book detail uses a paper reading surface above night-colored tabs and reviews.
- Mobile preserves the same hierarchy rather than hiding the core book imagery.
- Homepage discovery uses three vertical catalogue columns rather than repeated horizontal shelves. Each entry pairs a compact cover with title, author, year, and reading state. The columns collapse to two at tablet width and one on mobile.

## Motion

- Controls: 160ms with `cubic-bezier(.23, 1, .32, 1)`.
- Page entry: 260ms opacity plus a 7px vertical shift.
- Book hover: a small upward move with a hard coral shadow.
- Always honor reduced-motion preferences.
- Hero recommendation changes use a 160ms opacity and 5px vertical transition for pointer input only. Keyboard selection updates immediately.
- Cover hovers preserve image saturation. Lists and Continue Reading use a small lift with a coral offset shadow; catalogue-row actions appear in a compact rail beside the cover instead of covering it.
