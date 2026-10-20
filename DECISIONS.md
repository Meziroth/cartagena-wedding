# Decisions

Choices made without asking, per CLAUDE_CODE_PROMPT.md. Newest at the bottom.

## Phase 1: scaffold and shell

- **Hash routes are `#/budget`, not the prototype's `#budget`.** That's what React Router's `HashRouter` produces. Unknown routes show a "Page not found" screen with a link home.
- **Data source.** `src/data/source.ts` defines a `DataSource` interface. With no `VITE_SUPABASE_URL` (or with `VITE_DATA_SOURCE=mock`), the app uses the in-memory example data from `src/mock/mockData.ts`, signed in as Nick. Edits last until a reload. Supabase plugs in behind the same interface in Phases 2–3.
- **Mock vs. seed.** `src/lib/seedData.ts` holds only what a real wedding starts with (events, budget categories, the 35-task template, six decision notes). `mockData.ts` adds the prototype's example vendors, payments, guests and ideas, which are never seeded into Supabase.
- **Budget categories have a nullable `key`** (`venue`, `catering`, `buffer`, …) so rules can find seeded categories (the buffer, catering for per-guest cost, florals for the flowers tip) without relying on names. Add it to the `budget_categories` table in `0001_init.sql`.
- **"Viewing as" became an account menu**: an avatar showing the signed-in name, email and role, with Sign out. The currency toggle stays in the top bar and is remembered per user under `localStorage['nt-currency:<user_id>']`.
- **The language switch is hidden** (it sits in the account menu) and appears automatically once `src/locales/es.json` has any keys.
- **"Both love it"** means every member with role `owner` has hearted the idea, not a hard-coded pair of names.
- **Placeholder screens.** Checklist, Budget, Vendors, Inspiration, Guests, Notes and Details show the prototype's heading and intro plus a one-line summary of their data until they're built in Phase 4–5. Home is fully ported except the suggestions card (Phase 6).
- **Additions to the prototype's styles**: a skip-to-content link, `body{margin:0}` (the prototype left the browser's 8px default), and styles for the account menu and the loading and error screens. These are in `shell.css` and `base.css`.
- **Playwright browsers aren't installed yet.** Run `npx playwright install chromium` before the Phase 7 suite. Phase 1 was checked by hand at 1280×800 and 390×844, using installed Edge.
