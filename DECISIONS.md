# Decisions

Choices made without asking, per CLAUDE_CODE_PROMPT.md. Newest at the bottom.

## Phase 1: scaffold and shell

- **Hash routes are `#/budget`, not the prototype's `#budget`.** That's what React Router's `HashRouter` produces. Unknown routes show a "Page not found" screen with a link home.
- **Data source.** `src/data/source.ts` defines a `DataSource` interface. With no `VITE_SUPABASE_URL` (or with `VITE_DATA_SOURCE=mock`), the app uses the in-memory example data from `src/mock/mockData.ts`, signed in as Nick. Edits last until a reload. Supabase plugs in behind the same interface in Phases 2–3.
- **Mock vs. seed.** `src/lib/seedData.ts` holds only what a real wedding starts with (events, budget categories, the 35-task template, six decision notes). `mockData.ts` adds the prototype's example vendors, payments, guests and ideas, which are never seeded into Supabase.
- **Budget categories have a nullable `key`** (`venue`, `catering`, `buffer`, …) so rules can find seeded categories (the buffer, catering for per-guest cost, florals for the flowers tip) without relying on names. It is a column on `budget_categories` (unique per wedding).
- **"Viewing as" became an account menu**: an avatar showing the signed-in name, email and role, with Sign out. The currency toggle stays in the top bar and is remembered per user under `localStorage['nt-currency:<user_id>']`.
- **The language switch is hidden** (it sits in the account menu) and appears automatically once `src/locales/es.json` has any keys.
- **"Both love it"** means every member with role `owner` has hearted the idea, not a hard-coded pair of names.
- **Placeholder screens.** Checklist, Budget, Vendors, Inspiration, Guests, Notes and Details show the prototype's heading and intro plus a one-line summary of their data until they're built in Phase 4–5. Home is fully ported except the suggestions card (Phase 6).
- **Additions to the prototype's styles**: a skip-to-content link, `body{margin:0}` (the prototype left the browser's 8px default), and styles for the account menu and the loading and error screens. These are in `shell.css` and `base.css`.
- **Playwright browsers aren't installed yet.** Run `npx playwright install chromium` before the Phase 7 suite. Phase 1 was checked by hand at 1280×800 and 390×844, using installed Edge.

## Phase 2: schema, RLS, storage, seed

- **Seeding is a function, not `seed.sql`.** `setup_wedding()` (in `0002_setup_wedding.sql`) is the first-run "Set up our wedding" step. Whoever calls it first becomes the first owner, and the wedding starts with the prototype's events, categories, 35 tasks and 6 decision notes. The app holds one wedding, so the function refuses once a wedding exists, and everyone else joins by invitation (Phase 3). A static `seed.sql` couldn't work, because it can't know the owner's user id.
- **One source for seed data.** `0002_setup_wedding.sql` is generated from `src/lib/seedData.ts` by `npm run gen:seed`. A test fails if the two drift apart.
- **Month math matches Postgres.** `minusMonths` now clamps to the end of the month (Jan 31 − 2 months = Nov 30), like Postgres. The prototype rolled over to Dec 1 instead. This changes no seeded date, because Jan 22 has no overflow.
- **RLS goes slightly beyond the brief:**
  - Only owners can heart ideas. The planner has no heart in the UI, so the database enforces it too.
  - `done_by` and `done_at` on tasks, `paid_at` on payments, and `created_by` on notes and ideas are set by triggers from the session, not trusted from the client.
  - The buffer category can't be deleted, and a wedding can't lose its last owner. Both are enforced by triggers. These two triggers are `security definer` so they see the real rows: running as the user, an owner who had just removed themselves mid-statement could no longer see the wedding, and the guard silently passed. The tests caught this.
  - References between rows use composite foreign keys that include `wedding_id`, so a category can't point at another wedding's event (and likewise for payments and vendors).
  - Signed-out visitors (`anon`) have every table privilege revoked, not just blocked by RLS.
- **Storage:** two private buckets, `inspiration` (JPEG, PNG or WebP up to 10 MB) and `contracts` (PDF up to 20 MB). Paths look like `{wedding_id}/{uuid}.{ext}`, and policies check membership against the first path segment. A malformed segment counts as "no wedding" instead of causing an error.
- **Realtime:** every table is in `supabase_realtime` with `replica identity full`, so delete events carry `wedding_id`.
- **No date-window constraint in the database.** The Dec 2027–Feb 2028 limit is a UI rule (the date picker). The database accepts any date, so plans can change without a migration.
- **The RLS tests are a plain SQL script** (`supabase/tests/rls.sql`), not pgTAP. `npm test` runs it in PGlite, which is real Postgres compiled to WebAssembly, so no Docker or Supabase CLI is needed. A small stand-in (`supabase/tests/support/supabase-shim.sql`) provides the `auth` and `storage` schemas and the roles. The same script can be pasted into the Supabase SQL editor on an empty project to check the live database. It rolls back at the end.

## Phase 3: sign-in and access

- **The order of screens** is decided in `src/app/AccessGate.tsx`: wait for the session → sign in → choose a password (after an invite or reset link) → set up the wedding or wait for an invite → the planner. Nothing of the planner renders, or is fetched, before a membership is found.
- **Sign-in** offers a password, an emailed sign-in link, and "Forgot password?". Links use Supabase's default (implicit) flow rather than PKCE, so an invite or reset link opened on a different device or browser from where it was requested still works. The tokens arrive in the `#…` part of the address; the client reads them before the router starts, and a failed link (expired, already used) shows a message on the sign-in screen instead of a "Page not found".
- **Sign-in links never create accounts** (`shouldCreateUser: false`), so the app stays invite-only even if sign-ups were switched back on by mistake.
- **The very first owner** has no one to invite them. Nick creates his own account in the Supabase dashboard (Authentication → Users → Add user), signs in, and sees "Set up our wedding". `can_set_up_wedding()` (migration `0003`) tells a signed-in non-member whether that screen or "You're not on the guest list yet" applies. It reveals only whether a wedding exists, and only to signed-in users.
- **Invitations** go through the `invite` Edge Function, which checks the caller is an owner, sends Supabase's invite email, and adds the `members` row with the chosen name and role. If the person already has an account (for example, created in the dashboard), no email is sent and they're simply added. That is also the fallback when email can't be sent: Supabase's built-in email service only delivers to addresses on your Supabase team and only a few per hour, so for real invitations either set up custom SMTP or create the account in the dashboard and then invite them in the app.
- **People & access** sits on the Wedding details screen (still a placeholder until Phase 4). Owners can invite and remove people; nobody can remove themselves from here, and the database already refuses to remove the last owner. Removing someone takes away their access but doesn't delete their Supabase account. Changing someone's role means removing and re-inviting them.
- **Sign out** signs out this device only (`scope: 'local'`), which also works offline. All cached data is cleared whenever the signed-in person changes.
- **Example-data mode is unchanged**: with no Supabase settings, there's no sign-in and you're Nick. Invites there only add a row in memory.
- **Display font: Playfair Display instead of Bodoni Moda** (asked for by Nick). Bodoni Moda's hairline strokes were too thin to read comfortably, especially in the italic names. Playfair Display keeps the same high-contrast, Didone-style italic with sturdier strokes. The names and monogram use weight 500 (previously 400). Hanken Grotesk stays as the body font.
