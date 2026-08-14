# Zephr

The day-to-day tracker: four modules behind one login, covering the things worth writing down on an ordinary day.

- **Calories** — log what you ate in grams, see calories and macros land against your daily goal, day by day.
- **Money** — log expenses and income by hand, see what's left this month, where it went, and how the last six months compare.
- **Intake** — a ward chart: every drink in millilitres and every dose of medicine, on one timeline, with the time it happened. For looking after someone (or yourself) through an admission.
- **Notes** — a pinboard for the loose ends, with a passphrase-locked vault for logins that are encrypted in your browser before they're stored.

No bank syncing, no barcode scanning, no AI photo estimates. You type what happened; the app does the arithmetic and remembers it. Everything is per-user and syncs across devices through Supabase.

**Stack:** React 18 + Vite · Tailwind (custom theme) · Supabase (Postgres + Auth) · recharts · framer-motion · deploys to Vercel as a static build.

---

## 1. Prerequisites

| You need | Version | Notes |
| --- | --- | --- |
| Node.js | **18.18+** (22 LTS recommended) | `node --version` |
| npm | 9+ | ships with Node |
| Supabase account | free tier | [supabase.com](https://supabase.com) — no card required |

The free Supabase tier is enough for this app indefinitely: it's a handful of small tables and no server-side compute.

---

## 2. Create a Supabase project and find your keys

1. Go to [app.supabase.com](https://app.supabase.com) → **New project**.
2. Give it a name, set a database password (save it somewhere — you won't need it for this app, but you'll want it later), pick the region closest to you, and create.
3. Wait ~2 minutes for provisioning.
4. Open **Project Settings → API**. You need two values:
   - **Project URL** → `VITE_SUPABASE_URL` (looks like `https://abcdefgh.supabase.co`)
   - **Project API keys → `anon` `public`** → `VITE_SUPABASE_ANON_KEY` (a long JWT)

> **Never use the `service_role` key in this app.** It bypasses Row Level Security, and anything in a Vite `VITE_*` variable ends up in the browser bundle. The `anon` key is safe to ship *because* RLS is enabled on every table — that's what step 3 sets up.

### Email confirmation

By default Supabase emails a confirmation link on signup. The app handles this — it shows a "check your inbox" screen instead of silently failing. To skip it while developing, go to **Authentication → Providers → Email** and turn **Confirm email** off.

---

## 3. Run the schema

Open **SQL Editor → New query** in your Supabase dashboard, paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.

The whole file is idempotent (`create table if not exists`, `drop policy if exists` before each `create policy`), so re-running it is safe and won't touch existing rows.

It creates eight tables:

| Table | Module | What it holds |
| --- | --- | --- |
| `goals` | Calories | One row per user: daily calorie/protein/carb/fat targets. Auto-created on signup by a trigger. |
| `entries` | Calories | One row per logged food: name, grams, and a snapshot of its nutrition. |
| `wallets` | Money | Cash / Bank / Card, plus any you add. Seeded on first visit to the Money tab. |
| `categories` | Money | Nine defaults (Food & Dining, Transport, Rent & Housing, Shopping, Bills & Utilities, Entertainment, Health, Groceries, Other) plus your own. Seeded on first visit. |
| `budgets` | Money | Optional monthly cap per category. Primary key is `(user_id, category_id, month)`; `month` is always the 1st. |
| `month_budgets` | Money | Optional overall cap for a whole month — one row per `(user_id, month)`. Set directly rather than inferred from the category rows, and it's what the month bar counts down from when present. |
| `transactions` | Money | One row per manually entered expense or income. |
| `hospital_logs` | Intake | One row per drink or per dose: what it was, how much, and the wall-clock time it happened (`at`, editable) alongside the calendar day it belongs to (`date`). |

**Already running an older version with just `goals` and `entries`?** The money tables are appended in a clearly marked `MONEY MODULE` section at the bottom of the file — run only that section.

**Already running everything except the Intake tab?** Same story: the `HOSPITAL MODULE` section is marked off just before the grants at the bottom. Run that section and the grants below it. Until you do, the Intake tab loads but every save tells you to re-run this file.

**Already running the money module without `month_budgets`?** Re-run the whole file; `create table if not exists` leaves your existing rows alone. Until you do, the Money tab works exactly as before — the overall-budget field just reads as empty, and trying to save one tells you to run this file.

Every table has Row Level Security enabled with policies restricting all operations to `auth.uid() = user_id`. Nutrition snapshots on `entries` are deliberately denormalised: correcting the food database later must not silently rewrite what you ate last March. Same reasoning applies to `transactions`, whose `wallet_id`/`category_id` foreign keys are `on delete set null` — deleting a wallet never deletes the spending history attached to it.

---

## 4. Run it locally

```bash
npm install

cp .env.example .env      # Windows: copy .env.example .env
# paste your two values into .env

npm run dev               # http://localhost:5173
```

Your `.env`:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

`.env` is gitignored; `.env.example` is not. If either variable is missing the app renders a setup screen telling you so, rather than failing at the first fetch. Vite only reads env vars at startup — **restart the dev server after editing `.env`.**

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built output locally |
| `npm run lint` | ESLint over `src/` |

---

## 5. Deploy to Vercel (free)

1. Push the repo to GitHub.
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Vercel detects Vite. Confirm:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Install command:** `npm install`
4. Under **Environment Variables**, add both — for Production, Preview *and* Development:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | your project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon key |

5. **Deploy.**
6. Back in Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel domain and add it to **Redirect URLs**. Without this, confirmation emails point at `localhost`.

Adding env vars after a deploy requires a redeploy to take effect — they're baked in at build time.

No serverless functions, no custom server, nothing to configure beyond the above.

---

## Using it

**Calories.** Search 160 foods (fruit, veg, grains, proteins, dairy, Indian dishes, fast food, snacks, drinks) — type "dosa" or "dal" and pick. Selecting one pre-fills its typical serving in grams; adjust and the calories update live before you commit. The arc shows what's left of your calorie goal; the three bars are protein, carbs and fat. Arrows move between days, and you can't navigate into the future.

**Money.** Tap **Add expense** for amount → category → wallet → note → date, with an expense/income toggle. The month reads as a bar rather than a dial — a budget isn't a daily gauge that refills, it's drawn down across a month that's running out too, so spending fills from the left and a marker shows where today falls. Filled past the marker means you're spending faster than the month is passing. It counts down from whichever cap you've set: an overall total for the month if there is one, otherwise the sum of your category budgets, otherwise income logged that month. Below it: a donut of where the month went, a six-month trend line, and the transaction list grouped by day — tap a row to edit, trash to delete.

**Hospital.** Two buttons, **Drink** and **Medicine**, because both are equally common. A drink is a dropdown (water, tomato soup, chicken soup, tender coconut water, buttermilk, lassi, watermelon juice, musk melon juice, orange juice, tea, black tea, coffee, black coffee, iced tea, kanji/rice water, IV fluid, ORS, or type your own), an amount in millilitres with the ward's usual tumblers one tap away, and a time. A medicine is its name, the form it came in, a dose in whatever it's measured in (tablets, ml, mg, drops, puffs, units…), and a time. **The time defaults to the clock and stays editable** — ±5 minutes, a native time picker, or "back to now" — and so does everything else: tap any row on the chart to change what it was, how much, or when, long after it's saved.

The day's fluids and medicines share one timeline, oldest first, split into Overnight / Morning / Afternoon / Evening / Night, with the clock down the left edge and each drink carrying the running total it produced. The summary is a drip bag: how much has gone in, against a daily target you set on the card itself. That target is stored per device and per user (a fluid restriction comes from a ward round, not a settings panel), so it doesn't sync — everything on the chart itself does.

**Reports.** Every tab has a download icon at the top-right. Pick a period — Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, This year, Everything, or two dates of your own — and the sheet shows what's in it (rows, totals, daily average) before you commit to anything. Then:

- **CSV** — one row per entry, opens in Excel or Sheets. Amounts are bare numbers so you can sum them; expenses are negative and income positive. UTF-8 with a BOM, so ₹ survives the trip into Excel.
- **Print / PDF** — a laid-out page grouped by day, with the summary at the top and a repeating table header on every sheet of paper. "Save as PDF" in the print dialog is the PDF exporter; nothing extra is bundled to produce one.
- **Save the laid-out page** as a self-contained `.html` file, if you'd rather email it than print it.

Files are named `zephr-intake-2026-08-01_2026-08-10.csv` — module, then span — so a folder of them sorts itself.

**Goals and budgets** live behind the sliders icon at the top-right of each tab. Calorie goals are one set of numbers that carry forever. Money budgets are per month: one overall total, and — optionally — a split of it across categories. Set either, both, or neither; a total wins over the split, because it's a figure you stated rather than one the app inferred, and a half-filled breakdown shouldn't quietly lower a cap you typed by hand.

Every navigator has a third control people miss: the label between the arrows is a button. Tapping it opens a calendar — days on the Calories and Intake tabs, months on the Money tab — because arrows are right for yesterday and wrong for the 3rd of last March.

Switching tabs preserves each side's state — the day you were on, the month you'd scrolled to, the data already fetched, and your scroll position. Reloading preserves the tab itself: the active one is mirrored into the URL fragment (`#money`, `#hospital`), so a refresh mid-month doesn't drop you back on Calories.

---

## Project structure

```
src/
├── App.jsx                    tab routing, auth gate, per-tab scroll/state retention
├── main.jsx
├── index.css                  Tailwind layers + base theme
├── lib/supabaseClient.js      client + human-readable error translation
├── data/
│   ├── foodDatabase.js        160 foods, per-100g, with search ranking
│   ├── defaultCategories.js   seeded categories, wallets, icon/colour choices
│   └── hospitalItems.js       drinks, medicine forms, dose units
├── hooks/
│   ├── useAuth.js             session, sign in/up/out
│   ├── useEntries.js          a day's food log (optimistic writes)
│   ├── useGoals.js            daily nutrition targets
│   ├── useTransactions.js     a month's transactions + 6 months of history
│   ├── useWallets.js          wallets, seeded on first use
│   ├── useCategories.js       categories, seeded on first use
│   ├── useBudgets.js          the month's overall cap + its per-category split
│   ├── useHospitalLog.js      a day's chart + 30 days of medicine suggestions
│   └── useReportData.js       an arbitrary date range, fetched on demand
├── utils/
│   ├── dateHelpers.js         local-timezone calendar days (never UTC)
│   ├── nutritionMath.js       scaling, totals, goal status
│   ├── expenseMath.js         months, currency, category totals, budget summary
│   ├── hospitalMath.js        wall-clock times, day bands, ml totals
│   ├── reports.js             range presets, CSV, the printable document
│   └── reportBuilders.js      what each module's report says (columns, totals)
└── components/
    ├── Auth/                  AuthLayout, LoginForm, SignupForm
    ├── Tracker/               the Calories module
    ├── Expenses/              the Money module
    ├── Hospital/              the Intake module — the ward chart — fluids and medicines
    ├── Reports/ReportPanel    one export sheet, all three modules
    ├── Settings/GoalsPanel    nutrition goals
    └── shared/                Button, Input, ProgressBar, Icon3D, TabBar
```

### Notes for whoever works on this next

- **Dates are local, always.** `toISODate()` builds `YYYY-MM-DD` from local calendar parts. Using `toISOString()` anywhere would shift a 1am log in IST onto the previous day. `budgets.month` is always the 1st, enforced by a check constraint.
- **Writes are optimistic with rollback.** Add/edit/delete update local state first and restore the previous snapshot if Supabase rejects the change, surfacing a real error message. Nothing fails silently.
- **Seeding only happens on a confirmed-empty fetch**, once per mount. A failed request must never be mistaken for "new user", or the default categories would duplicate on every network hiccup.
- **Currency is one constant.** `CURRENCY` in `utils/expenseMath.js` is set to INR/₹; change those three fields and every amount in the app follows.
- **3D icons** come from Microsoft's Fluent Emoji set over jsDelivr, wrapped in `Icon3D`. If the CDN is blocked it falls back to the platform's own colour emoji, so nothing renders as a broken image. lucide-react is used only for small inline chrome (chevrons, trash, close).
- **The Money and Intake modules are lazy-loaded** — recharts is larger than the rest of the app combined, and opening Zephr to log a banana shouldn't download a charting library or a ward chart.
- **CSV cells starting with `=`, `+`, `-` or `@` get an apostrophe.** Spreadsheets execute those as formulas, so a note someone typed becomes code on whoever's machine opens the file. `csvCell()` in `utils/reports.js` is the only place that needs to know.
- **Reports fetch nothing until opened.** The panel is mounted beside all three modules; `useReportData` is gated on `enabled` so a page load never pulls a year of history.
- **A chart row keeps `date` and `at` separately.** `date` is the calendar day it belongs to and the only thing queried; `at` is the wall-clock time, built from local parts in `isoAt()` and freely editable afterwards. They are not derived from each other — logging last night's 11pm dose at 8am this morning has to land on yesterday's chart at 23:00, and only two independent fields can say that.
