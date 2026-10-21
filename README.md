# Nick & Thuraya · Cartagena wedding planner

A private planner for Nick and Thuraya's wedding in Cartagena, Colombia, shared with their wedding planner.
It covers the budget (which flexes up and down), a month-by-month checklist, vendors, guests, notes, an
inspiration board, suggestions and exports. It works on phones and computers, and can be installed on an
iPhone's Home Screen with notifications.

- **The site:** https://meziroth.github.io/cartagena-wedding/
- **Where the data lives:** a free Supabase project. Only invited people can sign in, and the database itself
  enforces who may see and change what.

This README is in three parts: **using the planner**, **setting it up from scratch** (if it ever has to be
rebuilt, or moved to new accounts), and **looking after it** (backups, the free plan pausing, fixes for
common problems). A short section for developers is at the end.

---

## 1. Using the planner

### Who can do what

| Person | Role | Can do |
|---|---|---|
| Nick | Owner | Everything |
| Thuraya | Owner | Everything |
| Wedding planner | Planner | Add, edit and delete tasks, vendors, guests, notes and inspiration. Sees the budget, payments, events and wedding details, but can't change them. |

Owners can invite and remove people in **Wedding details → People & access**.

### Signing in

Go to the site and sign in with your email and password, or tap **Email me a sign-in link instead**.
**Forgot password?** emails a link to choose a new one. Nobody can create an account on their own: you have to be invited.

### Put it on your iPhone's Home Screen (and get notifications)

1. Open the site in **Safari** (it must be Safari).
2. Tap **Share**, then **Add to Home Screen**, then **Add**. An "N & T" icon appears.
3. Open the planner **from that icon** and sign in. (The Home Screen app keeps its own sign-in, separate from Safari.)
4. Go to **Wedding details → Notifications**, turn on **Notifications on this device**, and tap **Allow**.
5. Choose what to hear about: new notes, edited notes, new inspiration, checked-off tasks.
6. Tap **Send a test notification** to check it works.

Notes:
- iPhone needs **iOS 16.4 or later** for this.
- You're never notified about your own changes.
- Each device has its own switch. Signing out turns notifications off on that device.
- To stop them for good: turn the switch off, or in iPhone **Settings → Notifications → Wedding**.

On a computer, Chrome, Edge and Firefox can show notifications too. Turn them on the same way.

### Working together and offline

- Changes show up on everyone else's screen within a second or two.
- With no signal, the planner still opens with the last plan it loaded. A banner says you're offline. You
  can keep making changes; they're saved, in order, when the connection returns.

### Backups and exports (Wedding details → Export & backup)

- **Everything (JSON)**: a full backup of the plan. **Download one every month or so** and keep it somewhere
  safe (email it to yourself, or put it in Google Drive). Photos and contracts are listed by name, not
  included. They stay in Supabase.
- **Budget (CSV)**: opens in Excel, Numbers or Google Sheets.
- **Calendar (.ics)**: the wedding day, unpaid payments and open tasks. Import it into Google Calendar or
  Apple Calendar. Importing it again later updates the same events instead of adding copies.
- **Checklist for Todoist**: open tasks, in monthly sections. In Todoist, create a project, then choose
  **Import from CSV**.

---

## 2. Setting it up from scratch

You'll need about an hour, a computer, and:
- a **GitHub** account (free): https://github.com
- a **Supabase** account (free): https://supabase.com
- **Node.js** version 22 or later on the computer (https://nodejs.org, the "LTS" download). Only needed for
  the command-line steps; everything else is in a web browser.

Commands below are typed in a terminal (on Windows: **PowerShell**), inside the project folder.
The first time, run `npm install` there.

### Step 1: Create the Supabase project

1. In Supabase, click **New project**. Give it a name (for example `wedding`), set a strong **database
   password** and save it in your password manager, and pick the region closest to you.
2. Wait a minute while it's created.
3. In **Project Settings → General**, copy the **Project ID** (the "reference", 20 letters).
4. In **Project Settings → API**, note the **Project URL** and the **anon public** key. Both are safe to put in
   the website. Don't use the **service_role** key anywhere: it bypasses all the protections.

### Step 2: Create the database

**Option A, from the terminal (recommended):**

```
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_ID
npx supabase db push
```

`login` opens a browser window to approve it. `link` asks for the database password from step 1.

**Option B, by pasting into Supabase:** open **SQL Editor** in Supabase, and for each file in
`supabase/migrations`, **in order** (`0001` → `0002` → `0003` → `0004` → `0005`), paste its whole contents and
click **Run**.

**Optional check, on the new empty project only:** paste `supabase/tests/rls.sql` into the SQL Editor and run
it. It ends with "All RLS checks passed" and undoes everything it did. (Or run
`npx supabase db query --linked -f supabase/tests/rls.sql`.)

### Step 3: Make it invite-only

In Supabase, go to **Authentication → Sign In / Providers** and turn **off** **Allow new users to sign up**.

### Step 4: Tell Supabase where the site is

In **Authentication → URL Configuration**:
- **Site URL**: `https://YOUR_GITHUB_NAME.github.io/cartagena-wedding/`
- **Redirect URLs**: add the same address. (If you also run it on your own computer, add
  `http://localhost:5173/cartagena-wedding/` too.)

Without this, sign-in links, password resets and invitations would open the wrong address.

### Step 5: Notification keys and the server functions

The planner has three small server functions: **invite** (sends invitations), **notify** (sends phone
notifications) and **link-preview** (reads the picture and title of saved links).

1. Make the notification key pair, using an email address that the push services (Apple, Google) can contact:
   ```
   npm run gen:vapid -- mailto:you@example.com
   ```
   This writes the public key into `.env` and the private key into `supabase/functions/.env`. Neither file is
   uploaded to GitHub. **Make these keys only once:** new keys stop every phone's notifications until each
   person turns them on again.
2. Give the private key to Supabase, then deploy the functions:
   ```
   npx supabase secrets set --env-file supabase/functions/.env
   npx supabase functions deploy invite --use-api
   npx supabase functions deploy notify --use-api
   npx supabase functions deploy link-preview --use-api
   ```
   (`--use-api` builds the functions on Supabase's side, so you don't need Docker installed.)

### Step 6: Put the site on GitHub Pages

1. On GitHub, create a **new repository** named exactly **`cartagena-wedding`**, **Public**, with nothing in
   it (no README). The name matters: the site's addresses are built from it. (A private repository works
   only on a paid GitHub plan.)
2. In the repository, open **Settings → Secrets and variables → Actions → New repository secret**, and add
   these three. The values are in the `.env` file in the project folder; copy only what's after the `=`:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the Project URL |
   | `VITE_SUPABASE_ANON_KEY` | the anon public key |
   | `VITE_VAPID_PUBLIC_KEY` | the public notification key from step 5 |

3. In **Settings → Pages**, set **Source** to **GitHub Actions**.
4. Upload the project (in the project folder):
   ```
   git remote add origin https://github.com/YOUR_GITHUB_NAME/cartagena-wedding.git
   git push -u origin main
   ```
5. Open the repository's **Actions** tab. "Deploy to GitHub Pages" checks the code, runs the tests, builds the
   site and publishes it (about 5 minutes). When it's green, the site is at
   `https://YOUR_GITHUB_NAME.github.io/cartagena-wedding/`.

From then on, every change pushed to `main` redeploys the site automatically. If the tests fail, nothing is
published and the previous version stays up.

### Step 7: First sign-in and setting up the wedding

Because sign-ups are off, the first owner creates their own account in Supabase:

1. **Authentication → Users → Add user → Create new user**: your email and a password, with
   **Auto Confirm User** ticked.
2. Open the site, sign in, enter your first name, and click **Set up our wedding**. The plan starts with the
   Cartagena checklist, a $15,000 budget and the first decisions. You're its first owner.

### Step 8: Invite Thuraya and the planner

In the planner: **Wedding details → People & access → Invite someone**. Enter their email and name, choose
**Owner** (Thuraya) or **Planner**, and click **Send invitation**. They get an email with a link to choose a
password.

**About invitation emails.** Supabase's built-in email only delivers to people on your Supabase team, and only
a few emails an hour. Two ways round it:
- **Simplest:** create their account yourself in Supabase (**Authentication → Users → Add user → Create new
  user**, with **Auto Confirm User** ticked and a temporary password), then use **Invite someone** in the
  planner with the same email. It recognises the account and adds them straight away (no email). Give them
  the temporary password; they can change it with **Forgot password?**.
- **Proper email:** set up a free email-sending service (for example Resend or Brevo) and enter its details in
  Supabase under **Authentication → Emails → SMTP Settings**. Then invitations, sign-in links and password
  resets go to anyone.

---

## 3. Looking after it

### Backups

Download **Wedding details → Export & backup → Everything (JSON)** every month or so, and before any big change.
Supabase's free plan doesn't include backups you can download and restore yourself, so this file is your safety net.

### The free plan pauses after a week without use

Supabase pauses free projects after **one week of inactivity** (see Supabase's
[Project Pausing guide](https://supabase.com/docs/guides/platform/free-project-pausing)). While it's paused,
the planner shows a banner, **"Can't reach the planner's server"**, with the last copy saved on that device (or
"We couldn't load your wedding data" on a device that has never opened it). Changes may not save until it's
resumed. Nothing is lost.

**To bring it back:** sign in to https://supabase.com, open the project, and click **Resume** (or "Restore
project"). It takes a few minutes. According to Supabase's docs, a paused free project can be resumed from the
dashboard for up to a year. After that, you can still download the data, but not resume it with one click.

**To keep it from pausing:**
- Just use it: someone opening the planner during the week counts. During active planning this happens
  naturally.
- Or upgrade the Supabase project to the Pro plan, which never pauses (paid).

### When something goes wrong

| What you see | What to do |
|---|---|
| "Can't reach the planner's server" or "We couldn't load your wedding data" | Check your internet. If that's fine, the Supabase project may be paused: resume it (above). |
| A sign-in or reset link opens the wrong page, or says the link is invalid | Check step 4 (Site URL and Redirect URLs). Links expire after an hour and work once; request a new one. |
| "That email hasn't been invited" | They need an account and to be added under People & access (step 8). |
| An invitation email never arrives | See "About invitation emails" in step 8. Also check spam. |
| No "Notifications" switch on iPhone, only a message | Open the planner from the Home Screen icon, not Safari. Update to iOS 16.4 or later. |
| Notifications stopped | iPhone **Settings → Notifications → Wedding** must be allowed. Turn the switch in Wedding details off and on again. |
| The GitHub deploy failed | Open the failed run in the **Actions** tab. "Add the VITE_SUPABASE_URL…" means a secret is missing (step 6). If tests failed, the report is attached to the run. |

---

## 4. For developers

```
npm install
npm run dev        # http://localhost:5173/cartagena-wedding/ (uses Supabase if .env is filled in)
npm run dev:mock   # built-in example data, no Supabase needed
npm test           # unit tests, database and RLS tests (Postgres in WebAssembly via PGlite)
npm run e2e        # Playwright + axe at 390×844 and 1280×800, on the example data
npm run lint
npm run build
```

- `CLAUDE_CODE_PROMPT.md`: the original brief. `DECISIONS.md`: every choice made along the way, and why.
- `reference/prototype.html`: the visual and behavioural reference.
- `src/lib`: pure logic with tests (budget flex rule, checklist, suggestions, exports, notes).
- `src/data`: the data layer. Every edit is an `Op` applied optimistically and then saved; realtime and the
  offline copy live here too.
- `supabase/migrations`: the schema, RLS, storage and functions. `0002_setup_wedding.sql` is generated from
  `src/lib/seedData.ts` with `npm run gen:seed`; don't edit it by hand.
- `supabase/functions`: the `invite`, `notify` and `link-preview` Edge Functions.
- `supabase/tests/rls.sql`: proves the planner can't change the budget and that strangers can read nothing.
