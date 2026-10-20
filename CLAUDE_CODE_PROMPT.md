# Build: Nick & Thuraya's Cartagena Wedding Planner

> Paste everything below into Claude Code from an empty folder or a new GitHub repo.
> First put the prototype file `prototype.html` in the repo at `reference/prototype.html`.
> It is the visual and behavioral reference: match its look, copy and logic.

---

## 1. What you are building

A private wedding-planning web app for **Nick & Thuraya**, who are marrying in **Cartagena, Colombia** at a **hacienda with a courtyard**. The vision is **soft lights, lots of flowers and color**. The date window is **December 2027 to February 2028** (target date Saturday, January 22, 2028, not yet confirmed). They expect **30–50 guests** (plan for 40) and a **$15,000 USD** budget that must flex up or down as life changes.

The app is hosted on **GitHub Pages**, with **Supabase** (free tier) for the database, logins, file storage and real-time sync. Three people use it:

| Person | Role | Access |
|---|---|---|
| Nick | owner | Everything |
| Thuraya | owner | Everything |
| Wedding planner | planner | Create, edit and delete tasks, vendors, guests, notes and inspiration. **Budget, payments, events and wedding details are read-only.** |

Only invited emails can sign in. Without a session the app shows nothing but the sign-in screen.

`reference/prototype.html` already shows every screen working with sample data. Port it into a real app. Don't redesign it.

## 2. Tech stack (use this unless something blocks you)

- **Vite + React 18 + TypeScript**, React Router with **HashRouter** (GitHub Pages has no SPA rewrites).
- **@supabase/supabase-js v2** for auth, Postgres, storage and realtime.
- Styling: plain CSS with the prototype's design tokens (CSS custom properties) in `src/styles/tokens.css`. No component library. Keep the prototype's light and dark themes.
- Fonts: Bodoni Moda (display) and Hanken Grotesk (body) from Google Fonts, with fallbacks.
- State: TanStack Query for server state, plus Supabase realtime subscriptions that invalidate queries, so Nick and Thuraya see each other's edits live.
- i18n: **react-i18next**, with every user-facing string in `src/locales/en.json`. Spanish comes later; add an empty `es.json` and a hidden language switch.
- Tests: **Vitest** for pure logic, **Playwright** for smoke tests at 390×844 and 1280×800, **@axe-core/playwright** for accessibility.
- Deploy: a GitHub Actions workflow that builds and publishes to Pages (`actions/deploy-pages`). Set Vite `base` to the repo name.

Config comes from env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, stored as GitHub Actions secrets and in a local `.env` (git-ignored). The anon key is safe in the browser **only because RLS is on for every table**. Never use or commit the service-role key in frontend code.

## 3. Security model (important)

A GitHub Pages site is public static hosting. "Password protected" is achieved like this:
1. Every row of data lives in Supabase behind **Row Level Security**. Nothing personal goes in the JS bundle or the repo.
2. **Turn off public sign-ups** in Supabase Auth. Nick invites Thuraya and the planner from the Supabase dashboard (Auth → Users → Invite) or from an in-app "Invite" form that calls a Supabase Edge Function using the service role. The service-role key lives only in Edge Function secrets.
3. Sign-in: email + password, with magic link as an alternative. Include "forgot password".
4. A `members` table maps `auth.uid()` to a wedding and a role. RLS helper functions:
   - `is_member(wedding_id)`: the user has any role on that wedding.
   - `is_owner(wedding_id)`: the user's role is `owner`.
5. Policies:
   - `weddings`, `events`, `budget_categories`, `payments`: members can SELECT; only owners can INSERT, UPDATE or DELETE.
   - `tasks`, `vendors`, `guests`, `notes`, `ideas`, `idea_votes`, `dismissed_suggestions`: members can do everything within their wedding. On `idea_votes`, a user can only insert or delete their own vote.
   - `members`: members can SELECT their own wedding's members. Only owners can change them.
6. Storage bucket `inspiration` is **private**. Object paths look like `{wedding_id}/{uuid}.jpg`. Storage policies check `is_member` against the first path segment. Display images with signed URLs.
7. Write SQL tests (or a `supabase/tests/rls.sql` script) proving the planner cannot update `budget_categories` and that a stranger can read nothing.

## 4. Database schema

Put the schema in `supabase/migrations/0001_init.sql`. Store money as **integer whole USD**. COP is display-only, computed with the stored exchange rate.

- `weddings`: id, couple_names, wedding_date (date), date_confirmed (bool), guest_target (int, default 40), total_budget_usd (int, default 15000), fx_cop_per_usd (numeric, default 3194), created_at.
- `members`: wedding_id, user_id, email, display_name, role (`owner` | `planner`).
- `events`: id, wedding_id, key, name, is_on, is_fixed, sort. Seed four rows: Welcome drinks (on), Ceremony & reception (on, fixed), Rehearsal dinner (off), Day-after: Rosario Islands boat day (off).
- `budget_categories`: id, wedding_id, event_id, name, amount_usd, is_locked (must-have), is_buffer, sort.
- `payments`: id, wedding_id, category_id, label, amount_usd, due_date, is_paid, paid_at.
- `tasks`: id, wedding_id, title, area, assignee (`Both` | `Nick` | `Thuraya` | `Planner`), due_date, is_done, done_by, done_at, months_before (numeric, null for custom tasks), sort.
- `vendors`: id, wedding_id, category_id, name, status (0–4: Researching, Contacted, Quote received, Booked, Paid in full), quote_usd, contact, notes, contract_path (storage, optional).
- `ideas`: id, wedding_id, kind (`image` | `link`), title, tag (Venue, Florals, Lighting, Décor, Palette, Attire, Cake, Other), storage_path, url, preview_title, preview_image_url, created_by.
- `idea_votes`: idea_id, user_id (PK both).
- `guests`: id, wedding_id, name, party_size, side (Nick | Thuraya | Both), rsvp (Pending | Yes | Maybe | No), travel (Not yet | Flights booked | Flights + hotel), notes.
- `notes`: id, wedding_id, type (decision | note | question), body, created_by, created_at.
- `dismissed_suggestions`: wedding_id, suggestion_key.

Add `updated_at` triggers and enable realtime on all of these tables.

**Seed** (`supabase/seed.sql`, or a first-run "Set up our wedding" flow for the owner):
- Budget categories with amounts and locks exactly as in the prototype's `seed()`. Florals & décor and Lighting are locked. Totals: $15,000 across the active events.
- The 35-task Cartagena checklist from the prototype's `TEMPLATE` array, with due dates computed as `wedding_date − months_before`. The first three are already done.
- Six decision notes from the prototype (budget, guest count, date window, vision, events, planner access).
- **Don't seed** the example vendors, payments, guests or inspiration. Those were only placeholders.

## 5. Features, screen by screen

Match the prototype's layout: a left sidebar on desktop, and on phones a top bar plus a bottom tab bar (Home, Checklist, Budget, Ideas, More). Keep the "Viewing as" idea only as the real signed-in identity, shown as an avatar menu with Sign out.

### Home
Couple names hero with the cement-tile pattern, the target or confirmed date, a days-to-go countdown, three stat cards (budget planned vs. total, checklist progress, guests), top suggestions, the next 5 open tasks, the next 3 unpaid payments, and a "Our vision" strip showing ideas **both** owners hearted.

### Budget (core feature, port the logic exactly)
- Total budget display, a slider (5,000–40,000, step 250), quick chips (−20%, −10%, +10%, +20%), and an exact-amount input. Show cost per guest.
- **Flex rule (`rebalance(total)`)**: only categories of events that are switched on count. Locked categories keep their amount. The pool is `total − sum(locked)`. Each unlocked category becomes `round10(amount × pool / sum(unlocked))`, and the rounding remainder goes to the largest unlocked category. If the pool is negative, refuse and explain that the locked must-haves exceed the total. While the slider is being dragged, always scale from a snapshot taken when the drag began, so there is no rounding drift. Put this in `src/lib/budget.ts` with unit tests.
- A status line: "matches your total", "over by X → Rebalance to fit", or "X not assigned → Add to buffer / Spread it out".
- Categories grouped by event, each with a lock toggle, amount input, % of total, paid-progress bar and delete (the buffer can't be deleted). Add category.
- Event chips that switch an event on or off. Switching one on adds its categories and usually pushes the plan over, which the status line then shows.
- Payments and deposits: label, category, amount, due date, paid checkbox. Overdue ones turn red.
- USD/COP toggle in the top bar, remembered per user in localStorage. Inputs accept the displayed currency and convert to USD on save. Format COP as `COP 47.916.600` (es-CO grouping).
- Planner sees all of this with a "View only" banner and disabled controls. Enforce it in RLS too, not just the UI.

### Checklist
Tasks grouped by month with a "N months out" label, filter chips (All, Open, Done, Nick, Thuraya, Planner; "Both" tasks show for Nick and Thuraya), add task, check off (record who and when), delete. **Changing the wedding date shifts every task's due date by the same number of days.** Overdue tasks are flagged.

### Vendors
Cards with name, budget category, a 5-step status progress bar plus a status select, quote (flag it when the quote exceeds its category's budget), contact (note that WhatsApp is the norm in Colombia), notes, and an optional contract upload (PDF to storage).

### Inspiration
- Upload multiple images by file picker or drag-and-drop. Resize them on the client to a maximum of 1600px as JPEG before upload.
- Save links (Pinterest, Google Images, Instagram). Add a Supabase Edge Function `link-preview` that fetches the URL server-side and returns the `og:title` and `og:image`, so link cards show a real preview. If that fails, show a domain card.
- Caption, category tag, filter chips including "Both love", and sort by Newest or Most loved.
- Hearts: Nick and Thuraya each toggle only their own heart. Show "Both love it" when both have. The planner can view and add ideas but has no heart.
- Masonry layout (CSS columns), as in the prototype.

### Guests
Summary cards (people on the list vs. target, RSVPs by status, travel booked). A table on desktop that becomes cards on phones. Add a guest or party with a party size. Inline RSVP and travel selects. Show a warning when the list goes over 50, with the per-guest catering cost.

### Notes & decisions
Entries typed Decision, Note or Question, with author and date and a filter. Newest first.

### Wedding details
Date picker limited to 2027-12-01 → 2028-02-29, a "confirmed with venue" toggle, guest target slider, exchange-rate field (the default 3,194 was Colombia's official TRM on Oct 13, 2026), event toggles, members and roles with an invite form (owners only), exports, and sign out.

## 6. Suggestions engine (rules, no AI)

`src/lib/suggestions.ts` is a pure function of wedding data that returns `{key, tone: 'alert'|'warn'|'tip', title, body, action?}`. Users can dismiss suggestions, which is stored per wedding. Port every rule from the prototype's `suggestions()`:
over budget · unassigned money · buffer under 5% (action: raise to 7%) · more than 60% of the budget locked · payments due within 30 days or overdue · overdue tasks · date not confirmed (Christmas–New Year is peak season; mid-Jan–Feb is still dry season) · venue not booked within 16 months · legal vs. symbolic ceremony (apostilled, translated documents) · flowers are good value in Colombia (only if florals are locked) · confirm quotes include IVA (19% VAT) · late-afternoon ceremony (sunset around 6 pm) · hora loca tradition · cost per guest at 30, 40 and 50.
Actions can: rebalance, add to the buffer, navigate to a section, add a task, or add a note. Unit-test the rules.

## 7. Exports and integrations

All of these are real file downloads in this version:
- **Everything (JSON)**: full backup of the wedding's rows, with image paths rather than image data.
- **Budget (CSV)**: Event, Category, Planned USD, Planned COP, Paid USD, Must-have.
- **Calendar (.ics)**: the wedding day, unpaid payment due dates and open task due dates as all-day events. Use valid RFC 5545 with CRLF line endings, escaping and stable UIDs (the row id), so a re-import updates events instead of duplicating them.
- **Todoist (CSV)**: open tasks in Todoist's CSV template format (`TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT,DEADLINE,DEADLINE_LANG`), with a `section` row per month. Check the current format against Todoist's help docs before you finalize it, including the PRIORITY value for "no priority".
- **Phase 2 (stub the UI and leave a TODO)**: direct Todoist sync with a personal API token, stored encrypted and only used from an Edge Function, never in the browser.

## 8. Design, accessibility and mobile requirements

- Use the prototype's tokens and both themes: limewash plaster, terracotta, bougainvillea, sage, ochre, a cement-tile motif, and an italic Bodoni names display.
- Mobile-first. Nothing may scroll sideways at 360px. Tap targets are at least 44px. Respect the safe areas for the bottom tab bar.
- WCAG 2.2 AA: contrast, visible focus, labeled inputs, `aria-pressed` on toggles, live-region toasts, keyboard-operable everything, `prefers-reduced-motion`. axe must report zero serious or critical issues on every route.
- Confirmation steps are built into the page (no `window.confirm`). Show loading and empty states, and friendly errors that say what went wrong and how to fix it.
- Optimistic updates with rollback on error. Handle being offline gracefully with a banner, and retry when the connection returns.

## 9. Deliverables and order of work

Work in phases. Commit after each one and keep `npm run build`, `npm test` and lint passing.
1. Scaffold, tokens and layout shell (sidebar, tab bar, routes), with mock data from the prototype.
2. Supabase schema, RLS, storage policies, seed data and RLS tests.
3. Auth: sign-in, invite-only access, roles, sign out.
4. Budget (with `budget.ts` tests), then Checklist, Vendors, Guests, Notes, Details.
5. Inspiration with uploads, the link-preview Edge Function and votes.
6. Suggestions engine and exports.
7. Realtime sync, offline handling, the Playwright and axe suite, and the GitHub Pages workflow.
8. **README for a non-developer.** Step by step: create the Supabase project, run the migrations (Supabase CLI or paste into the SQL editor), turn off public sign-ups, set the Site URL and redirect URLs to the Pages URL, deploy the Edge Functions, add the two GitHub secrets, enable Pages ("GitHub Actions" source), invite Thuraya and the planner, and back up via the JSON export. Note that **Supabase pauses free projects after a period of inactivity**, and explain how to restore one or keep it active.

Ask me only when you're truly blocked. Otherwise make the sensible choice and note it in `DECISIONS.md`.
