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

## Phase 4: budget, checklist, vendors, guests, notes, details

- **Every edit goes through one pipeline** (`src/data/ops.ts`, `src/data/useChange.ts`). An edit is an `Op` (insert, update, delete, update the wedding, save the budget, move the date). The same pure `applyOp()` updates the screen at once and runs the example-data mode; the Supabase source turns each Op into a database call. Edits are saved one at a time, in order. If one fails, the screen rolls back and a toast says why (offline, not allowed, or the database's own message).
- **Screens update before the next paint.** TanStack Query normally tells components about cache changes on a 0 ms timer, which made controls briefly show the old value and made quick slider key presses lose steps. It now uses a microtask (`notifyManager.setScheduler(queueMicrotask)` in `App.tsx`).
- **Row ids are made in the browser** (`crypto.randomUUID()`), so a new row appears immediately and keeps the same id once saved.
- **Two database functions** (migration `0004`) keep multi-row changes all-or-nothing, and both run with the caller's permissions, so RLS still decides: `save_budget()` saves a new total and the category amounts the flex rule produced; `set_wedding_date()` moves the date and shifts every task by the same number of days. A half-saved rebalance or date change can't happen.
- **The flex rule is ported exactly**, including the prototype's rounding (to $10, with the remainder going to the largest unlocked category). While the slider is dragged the numbers change on screen only, scaled from a snapshot taken when the drag began, and the result is saved when it's released.
- **Deleting asks first, in the page**: every trash button turns into "Delete this? Yes, delete / Cancel", and Escape cancels. This goes beyond the prototype, which deleted straight away.
- **Vendors can be edited** after they're added (Edit on the card), since quotes and contacts change. The prototype could only add and delete. Contracts are PDFs up to 20 MB in the private `contracts` bucket, opened through a one-hour signed link; replacing or removing one deletes the old file.
- **The planner sees the Budget and Wedding details with a "View only" note and disabled controls.** Wedding details is owners-only for the date, guest count, exchange rate and events, because the planner can't change the `weddings` or `events` rows (the prototype only disabled the events there).
- **The wedding date must fall between Dec 1, 2027 and Feb 29, 2028** in the app. The database itself still accepts any date (see Phase 2).
- **Not yet built:** the budget suggestions card and the export buttons arrive with the suggestions engine and exports in Phase 6. Example rows aren't marked "Example" as in the prototype; with real data there are none.

## Note tags and phone notifications (asked for by Nick after Phase 4)

- **Tags are a `text[]` column on notes** (migration `0005`), not a separate tags table: they're made up on the fly, a wedding has a handful, and a list on the row keeps search, filters and realtime simple. Up to 10 per note, 1–30 characters each, stored lower case (`#Rain Plan` → `rain plan`).
- **Tags stay out of the way.** A note without tags shows no tag line at all. The tag filter row appears only once some note has a tag, and lists only tags in use, most used first. Tags are plain muted `#text` with no boxes; their tap areas are enlarged invisibly to meet the 44px target rule. In the form, the tag field hides behind a small "+ Tag" until it's wanted, and existing tags are suggested.
- **Search** matches every word against the note, its tags, its type and its author; `#word` searches tags only. Filters: type chips and any number of tags (a note must carry all selected tags). **Sort:** newest first (default), last edited, A–Z, by tag (untagged last), by type.
- **Notes can now be edited.** "Last edited" uses the server's `updated_at`; a note shows "edited <date>" when it changed more than a minute after it was written.
- **Notifications use standard Web Push**, which iPhone supports for Home Screen web apps from iOS 16.4. The app has a web app manifest, icons (rendered from the monogram in the cement-tile colors) and a service worker (`public/sw.js`) that shows notifications and opens the right screen when one is tapped.
- **Each device chooses for itself** (Wedding details → Notifications): one on/off switch, then which kinds to hear about: new notes, edited notes, new inspiration, checked-off tasks. Nobody is notified about their own changes. Signing out turns notifications off on that device, so a shared phone doesn't keep getting someone else's.
- **How a notification is sent.** After a change is saved, the app calls the `notify` Edge Function with only the kind and the row id. The function checks the caller is in the wedding, reads the row itself (so the text can't be made up), only acts on rows changed in the last 5 minutes, and pushes to the other members' devices that asked for that kind. Devices the push service reports as gone are forgotten. Database triggers would also catch edits made outside the app, but there are none, and this keeps every secret out of the database.
- **The push encryption (RFC 8291) and VAPID signing (RFC 8292) are written with Web Crypto only** (`supabase/functions/_shared/webpush.ts`), so the same code runs in Deno and in the Node tests. Tests decrypt its output with `http_ece`, the reference implementation by the RFCs' author, and verify the VAPID signature.
- **Keys:** `npm run gen:vapid -- mailto:…` makes the key pair. The public key goes in `.env` (and later the GitHub secret `VITE_VAPID_PUBLIC_KEY`); the private key goes only to Edge Function secrets. Changing keys later stops every existing subscription, so make them once.
- **Subscriptions live in `push_subscriptions`**, one row per device, readable and removable only by its owner. Saving goes through `save_push_subscription()`, which also hands a shared device's subscription to whoever turned it on last.

## Phase 5: Inspiration

- **Photos are shrunk in the browser** to at most 1600 px on the longest side and saved as JPEG (quality 0.82) before upload, using `createImageBitmap` with the photo's own rotation so portrait phone pictures stay upright. This also drops the photo's metadata, including where it was taken. Transparent PNGs get a white background. Files go to the private `inspiration` bucket as `{wedding_id}/{uuid}.jpg` and are shown through signed links that last an hour; the app asks for them in one batch per screen and renews them after 40 minutes.
- **Several photos at once**, by "Choose photos" or by dropping them on the box. They all take the caption and category typed above, as in the prototype. Progress is announced ("Uploading 2 of 5…"); a photo that can't be read is reported without stopping the rest.
- **The link field is a plain text field with the URL keyboard**, not `type="url"`, so pasted short links without `https://` (like `pin.it/…`) are accepted and fixed up instead of being refused by the browser.
- **Link previews come from the `link-preview` Edge Function**, which reads `og:title` / `og:image` (falling back to Twitter tags and `<title>`). The card appears at once with the site's name and fills in when the preview arrives. Google Images result links carry the picture in the address, so it's used directly. Instagram usually hides previews from servers; those links show the plain site card.
- **The preview function only fetches public web pages**: signed-in members only, http(s) on standard ports, at most 4 redirects (each one checked again), 7 seconds, 750 KB, HTML only, and it refuses localhost, private, link-local and cloud-metadata addresses, including names that resolve to them. This keeps it from being used to look inside Supabase's own network.
- **Preview images are shown straight from the other site** (with `no-referrer`), not copied into storage. If the other site removes the image, the card falls back to the site's name.
- **Hearts**: each owner has a heart button with their name; only your own can be pressed. The planner sees the hearts but has none. "Both love it" means every owner has hearted the idea. Example artwork keeps its "Sample" label.
- **Deleting an idea also deletes its photo** from storage.
- **Photo notifications**: when several photos are added at once, each phone shows one notification that updates, instead of one per photo.

## Phase 6: suggestions and exports

- **Suggestions are `suggestions(data, { today, money, t, canBudget })`** in `src/lib/suggestions.ts`: every rule from the prototype, in its order, with texts from `en.json`. Keys match the prototype's ids. Some include numbers on purpose (`overdue-6`, `pp-40-15000`), so a dismissed one comes back when the situation changes.
- **Actions**: rebalance, add the unassigned money to the buffer, raise the buffer to 7% (it's held at 7% while the other unlocked categories scale, as in the prototype), open a screen, add a task, or add a question to Notes. Budget actions only show for owners; the planner still sees the suggestion.
- **Home shows the first four** with a count and "Show all"; the Budget screen shows the budget-related ones, as in the prototype. Dismissing hides a suggestion for everyone in the wedding (`dismissed_suggestions`).
- **Exports are real downloads**, generated in the browser:
  - *Everything (JSON)*: every row of every table, with photos and contracts as storage paths.
  - *Budget (CSV)*: active categories plus the total. Starts with a byte-order mark so Excel reads accents, and cells that would start a spreadsheet formula (`=`, `+`, `-`, `@`) are prefixed with an apostrophe.
  - *Calendar (.ics)*: the wedding day, unpaid payments and open tasks as all-day events. RFC 5545: CRLF line endings, escaped text, lines folded at 75 bytes, and UIDs from the row ids (`task-<id>@nick-thuraya-wedding`), so importing again updates the same events.
  - *Todoist (CSV)*: open tasks with a section per month, checked against Todoist's help page "Import or export a project as a CSV file". Priority is 4 (Todoist's lowest, i.e. no priority; an empty cell would make every task p1). The time zone is left empty so Todoist uses the account's own, instead of the prototype's fixed New York.
- **Todoist sync** is a disabled button with a "coming later" note and a TODO: the personal API token would be stored encrypted and used only from an Edge Function, never in the browser.
