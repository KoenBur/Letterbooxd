# Letterbooxd

Letterbooxd is a personal reading companion for keeping track of finished books, rating the ones that stay with you, and finding a promising next read.

The product should feel literary, warm, and thoughtfully edited: closer to a well-used independent bookshop than a generic dashboard.

## Current state

The site is a static, browser-based application. Its visual direction is still evolving, so treat the existing interface as a starting point rather than a finished design system.

The current product includes:

- a homepage with curated shelves and discovery entry points;
- book search and book-detail views;
- reading history, ratings, favourites, and a reading wishlist;
- personal and community reading lists;
- profiles and sign-in through Supabase;
- the Blind Date With a Book discovery experience.

## Product principles

- Make recording a book feel immediate.
- Make discovering a next read inviting instead of overwhelming.
- Let books and reading activity carry the visual story.
- Prefer edited clarity over dashboard density.
- Keep social activity useful but secondary.
- Give mobile screens the same level of care as desktop screens.

Avoid decorative glassmorphism, excessive gradients, generic feature-card grids, invented metrics, and a film-centric imitation of Letterboxd.

## Visual checks

After a UI change, inspect the local preview at both a desktop width (around 1440px) and a mobile width (around 390px). Check that text is readable, controls remain reachable, no content is cut off, and there is no unintended horizontal scrolling.

## Working with changes

Keep changes focused and reviewable. Test locally before committing. Commit and push only when explicitly requested.

The scripts load in the order listed in `index.html`, with `app.js` last. They use
the existing shared browser scope so inline event handlers continue to work;
there is no bundler or new dependency.
