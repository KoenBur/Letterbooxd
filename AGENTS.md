# Letterbooxd agent guide

## Project intent

Letterbooxd helps readers log books, keep a reading history, rate books, and discover a next read. The interface should feel literary, warm, calm, and contemporary.

## Repository map

- `index.html`: application markup
- `css/style.css`: base styles
- `css/night-library.css`: editorial visual layer and responsive styles
- `js/app.js`: application behaviour, data loading, and routing

## Working rules

- Keep each change narrowly scoped to the requested outcome.
- Preserve existing user changes that are unrelated to the task.
- Do not add product features, external dependencies, or third-party services unless the user asks.
- Do not commit or push unless the user explicitly asks.

## Design rules

- Prioritise logging and discovering books.
- Use real books and reading activity as the visual focus.
- Prefer editorial clarity over dashboard density.
- Avoid glassmorphism, excessive gradients, generic feature-card grids, invented metrics, and a Letterboxd-like film aesthetic.
- Treat the current visual system as evolving. Propose major directional changes before implementing them.

## Local preview and verification

Start the static site from the repository root:

```powershell
py -3.14 -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173` for visual checks. For UI work, check desktop around 1440px wide and mobile around 390px wide. Verify readable text, reachable controls, responsive layout, and no unintended horizontal scrolling.

There is no automated test suite or build step. Use targeted source checks and the local preview appropriate to the change.

## Parallel work

When parallel help is requested, give only one agent write access to an implementation area. Other agents should inspect, research, or review so their changes do not conflict.
