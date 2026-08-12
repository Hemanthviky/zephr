-- ============================================================================
-- Zephr — database schema
-- Run this whole file once in the Supabase SQL Editor (see README step 3).
-- It is idempotent: re-running it will not destroy existing rows.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto. Supabase enables it by default, but be
-- explicit so this file works on a bare Postgres too.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- goals: exactly one row per user, holding their daily targets.
-- ----------------------------------------------------------------------------
create table if not exists public.goals (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  calories   integer     not null default 2000 check (calories between 500 and 10000),
  protein    integer     not null default 100  check (protein  between 0 and 1000),
  carbs      integer     not null default 250  check (carbs    between 0 and 1000),
  fat        integer     not null default 65   check (fat      between 0 and 1000),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- entries: one row per logged food, per day, per user.
-- Macro columns are denormalised snapshots — if the food database is later
-- corrected, historical logs must not silently change.
-- ----------------------------------------------------------------------------
create table if not exists public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  date       date        not null,
  name       text        not null check (char_length(name) between 1 and 120),
  grams      numeric(8, 1)  not null check (grams > 0 and grams <= 5000),
  calories   numeric(8, 1)  not null default 0,
  protein    numeric(8, 1)  not null default 0,
  carbs      numeric(8, 1)  not null default 0,
  fat        numeric(8, 1)  not null default 0,
  fiber      numeric(8, 1)  not null default 0,
  sugar      numeric(8, 1)  not null default 0,
  sodium     numeric(8, 1)  not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Body stats, used to estimate a calorie target (Mifflin–St Jeor) in the goals
-- panel. All nullable: the calculator is an optional convenience, and goals
-- typed in by hand stay perfectly valid without any of this.
--
-- Added after the first release, so `add column if not exists` rather than a
-- change to the create above — existing rows just get nulls.
-- ----------------------------------------------------------------------------
alter table public.goals
  add column if not exists height_cm numeric(5, 1)
    check (height_cm is null or height_cm between 80 and 260),
  add column if not exists weight_kg numeric(5, 1)
    check (weight_kg is null or weight_kg between 20 and 400),
  add column if not exists age integer
    check (age is null or age between 13 and 120),
  add column if not exists sex text
    check (sex is null or sex in ('male', 'female')),
  add column if not exists activity text
    check (activity is null or activity in ('sedentary', 'light', 'moderate', 'active', 'athlete')),
  add column if not exists aim text
    check (aim is null or aim in ('lose', 'maintain', 'gain'));

-- ----------------------------------------------------------------------------
-- Which section of the day an entry belongs to. Nullable: rows logged before
-- this column existed fall back to their created_at time in the app, so no
-- backfill is needed and no history lands in the wrong bucket.
-- 'snack' is intentionally not tied to a time of day — see utils/meals.js.
-- ----------------------------------------------------------------------------
alter table public.entries
  add column if not exists meal text
    check (meal is null or meal in ('morning', 'afternoon', 'evening', 'night', 'snack'));

-- The only query the app ever runs against entries: "this user, this day,
-- oldest first". One composite index covers it.
create index if not exists entries_user_date_idx
  on public.entries (user_id, date, created_at);

-- ----------------------------------------------------------------------------
-- Row Level Security — a user may only ever touch their own rows.
-- Without these policies the anon key would expose every user's food log.
-- ----------------------------------------------------------------------------
alter table public.goals   enable row level security;
alter table public.entries enable row level security;

drop policy if exists "goals: select own"  on public.goals;
drop policy if exists "goals: insert own"  on public.goals;
drop policy if exists "goals: update own"  on public.goals;
drop policy if exists "goals: delete own"  on public.goals;

create policy "goals: select own" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals: insert own" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals: update own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals: delete own" on public.goals
  for delete using (auth.uid() = user_id);

drop policy if exists "entries: select own" on public.entries;
drop policy if exists "entries: insert own" on public.entries;
drop policy if exists "entries: update own" on public.entries;
drop policy if exists "entries: delete own" on public.entries;

create policy "entries: select own" on public.entries
  for select using (auth.uid() = user_id);
create policy "entries: insert own" on public.entries
  for insert with check (auth.uid() = user_id);
create policy "entries: update own" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "entries: delete own" on public.entries
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Give every new signup a default goals row, so the app never has to guess
-- whether "no row" means "new user" or "failed fetch".
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.goals (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep goals.updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists goals_touch_updated_at on public.goals;
create trigger goals_touch_updated_at
  before update on public.goals
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- MONEY MODULE
-- Everything below is additive — if you already have goals/entries live, run
-- only this section. Same shape as above: RLS on every table, one policy set
-- per table, all scoped to auth.uid().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- wallets: where the money came from / went. Seeded with Cash, Bank, Card on
-- the user's first visit to the Money tab.
-- ----------------------------------------------------------------------------
create table if not exists public.wallets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  name       text        not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create index if not exists wallets_user_idx on public.wallets (user_id, created_at);

-- ----------------------------------------------------------------------------
-- categories: `icon` holds a key from the app's Icon3D registry (e.g. 'burger'),
-- `color` a hex from the existing palette. `is_default` marks the seeded nine.
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid    not null references auth.users (id) on delete cascade,
  name       text    not null check (char_length(name) between 1 and 40),
  icon       text,
  color      text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_idx on public.categories (user_id, created_at);

-- ----------------------------------------------------------------------------
-- budgets: an optional monthly cap per category. `month` is always the *first*
-- day of the month — the app normalises it, and the constraint enforces it so a
-- stray mid-month date can never split one month into two budget rows.
-- ----------------------------------------------------------------------------
create table if not exists public.budgets (
  user_id     uuid    not null references auth.users (id) on delete cascade,
  category_id uuid    not null references public.categories (id) on delete cascade,
  month       date    not null check (extract(day from month) = 1),
  amount      numeric(12, 2) not null check (amount >= 0),
  primary key (user_id, category_id, month)
);

create index if not exists budgets_user_month_idx on public.budgets (user_id, month);

-- ----------------------------------------------------------------------------
-- month_budgets: one overall cap for the whole month, set directly rather than
-- inferred from the category rows above.
--
-- A separate table rather than a null-category row in `budgets`: that table's
-- primary key is (user_id, category_id, month), and Postgres will not accept a
-- null inside a primary key. Two tables also keep two different questions
-- apart — "what am I allowed to spend this month" and "how do I intend to
-- split it" — which is how the budgets panel asks them.
--
-- Optional, like everything else here. No row means no overall cap, and the
-- month falls back to the sum of the category budgets exactly as before.
-- ----------------------------------------------------------------------------
create table if not exists public.month_budgets (
  user_id uuid           not null references auth.users (id) on delete cascade,
  month   date           not null check (extract(day from month) = 1),
  amount  numeric(12, 2) not null check (amount >= 0),
  primary key (user_id, month)
);

-- ----------------------------------------------------------------------------
-- transactions: one manually entered expense or income.
-- on delete set null for wallet/category so deleting a wallet never silently
-- deletes the spending history attached to it.
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid           not null references auth.users (id) on delete cascade,
  wallet_id   uuid           references public.wallets (id) on delete set null,
  category_id uuid           references public.categories (id) on delete set null,
  amount      numeric(12, 2) not null check (amount > 0),
  type        text           not null default 'expense' check (type in ('expense', 'income')),
  note        text           check (note is null or char_length(note) <= 200),
  date        date           not null,
  created_at  timestamptz    not null default now()
);

-- The month view queries by (user, date range) and renders newest first.
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc, created_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security for the money tables.
-- `for all` with only `using` would already double as the insert check in
-- Postgres, but `with check` is spelled out so the intent survives an edit.
-- ----------------------------------------------------------------------------
alter table public.wallets       enable row level security;
alter table public.categories    enable row level security;
alter table public.budgets       enable row level security;
alter table public.month_budgets enable row level security;
alter table public.transactions  enable row level security;

drop policy if exists "own wallets"       on public.wallets;
drop policy if exists "own categories"    on public.categories;
drop policy if exists "own budgets"       on public.budgets;
drop policy if exists "own month budgets" on public.month_budgets;
drop policy if exists "own transactions"  on public.transactions;

create policy "own wallets" on public.wallets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own month budgets" on public.month_budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- HOSPITAL MODULE
-- A ward chart: what someone drank, and what medicine they were given.
-- Additive like the money section above — if the rest is already live, running
-- only this block is enough.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- hospital_logs: one row per cup of fluid or per dose of medicine.
--
-- One table rather than two, because the whole point of a chart is that both
-- appear on the same timeline in the order they happened; `kind` is what the UI
-- filters and colours by.
--
-- `date` and `at` are deliberately both stored. `date` is the calendar day the
-- row belongs to (the app queries by it, exactly as the food log does), `at` is
-- the wall-clock time it happened — which the user may edit after saving, and
-- which is *not* the same thing as when the row was created.
--
-- `item` is a key from the app's catalogue ('coconut', 'tablet'); `name` is the
-- text shown. Both are kept so renaming a catalogue entry later can never
-- rewrite what a past row says happened. `item` is null for a typed-in one-off.
-- ----------------------------------------------------------------------------
create table if not exists public.hospital_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  date       date        not null,
  kind       text        not null default 'drink' check (kind in ('drink', 'med')),
  item       text        check (item is null or char_length(item) <= 40),
  name       text        not null check (char_length(name) between 1 and 80),
  amount     numeric(8, 1) not null check (amount > 0 and amount <= 10000),
  unit       text        not null default 'ml'
               check (unit in ('ml','tablet','capsule','mg','drop','puff','sachet','unit','tsp')),
  note       text        check (note is null or char_length(note) <= 200),
  at         timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- The only query the app runs: "this user, this window of days, in clock order".
create index if not exists hospital_logs_user_date_idx
  on public.hospital_logs (user_id, date, at);

alter table public.hospital_logs enable row level security;

drop policy if exists "own hospital logs" on public.hospital_logs;

create policy "own hospital logs" on public.hospital_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================================
-- NOTES MODULE
-- A pinboard of paper notes, and a locked drawer in the same board for
-- passwords. Additive like the sections above.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- vault: the one per-user record the password half of Notes needs.
--
-- What this table deliberately does *not* hold is the master passphrase, or
-- anything derived from it that could stand in for it. `salt` is public by
-- design — it exists to make a precomputed table useless, not to be secret —
-- and `verifier` is a known token encrypted under the derived key, so the app
-- can tell "wrong passphrase" from "corrupt data" without ever comparing the
-- passphrase itself to anything.
--
-- The consequence is the important part: a passphrase that is forgotten cannot
-- be reset, because nothing on this server can decrypt what it locked. `hint`
-- is the only mitigation offered, and it's plaintext, so the UI is explicit
-- that it must not be the passphrase.
--
-- `iterations` is stored rather than hard-coded so the cost can be raised for
-- new vaults later without stranding the ones written today.
-- ----------------------------------------------------------------------------
create table if not exists public.vault (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  salt       text        not null check (char_length(salt) between 8 and 128),
  verifier   text        not null check (char_length(verifier) between 8 and 512),
  iterations integer     not null default 310000 check (iterations between 100000 and 2000000),
  hint       text        check (hint is null or char_length(hint) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- notes: one row per note *or* per saved login. One table, because they share
-- a board, a search box and a pin — `kind` is what the UI branches on, exactly
-- as hospital_logs does for drinks and doses.
--
-- The split between `body` and `secret` is the whole security model:
--
--   body   — plaintext. What a paper note says. Readable by anything holding a
--            valid session for this user, which is the point of a note.
--   secret — the login's whole payload, {username, password, url, note, fields},
--            in one of two envelopes the client can always tell apart:
--
--              base64      — AES-GCM ciphertext with its IV in front, encrypted
--                            in the browser under the key derived from the
--                            master passphrase. This server never sees the
--                            plaintext and cannot produce it.
--              'plain.v1:…' — the same payload as JSON, in the clear, for a
--                            login the user explicitly saved with the lock off.
--                            base64 cannot contain ':' so the two never collide.
--
--            The prefix is there so nothing has to guess: a row is encrypted if
--            and only if it does not carry it. Anything in a plain.v1 row is
--            readable by whatever can read this table, which is why the app
--            marks those cards as unlocked on their face.
--
--            Either way it stays out of `body` — that column is what search
--            reads, and the constraint below keeps it null on a login.
--
-- `title` stays plaintext for both kinds, because a board you cannot read the
-- labels on is not a board. Name a login "Bank" rather than "Bank — hemanth@…".
-- ----------------------------------------------------------------------------
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  kind       text        not null default 'note' check (kind in ('note', 'secret')),
  title      text        not null default '' check (char_length(title) <= 120),
  body       text        check (body is null or char_length(body) <= 20000),
  secret     text        check (secret is null or char_length(secret) <= 20000),
  color      text        not null default 'cream'
               check (color in ('cream', 'sand', 'lime', 'tangerine', 'coral', 'avocado')),
  pinned     boolean     not null default false,
  tags       text[]      not null default '{}' check (array_length(tags, 1) is null or array_length(tags, 1) <= 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Belt and braces on the model above: a plaintext body on a `secret` row would
-- be a password written on the outside of the envelope, so the database refuses
-- it rather than trusting every future edit to the form to remember.
alter table public.notes
  drop constraint if exists notes_secret_has_no_plaintext_body;
alter table public.notes
  add constraint notes_secret_has_no_plaintext_body
  check (kind <> 'secret' or body is null);

-- The board's only query: "this user's notes, pinned first, freshest first".
create index if not exists notes_user_board_idx
  on public.notes (user_id, pinned desc, updated_at desc);

alter table public.vault enable row level security;
alter table public.notes enable row level security;

drop policy if exists "own vault" on public.vault;
drop policy if exists "own notes" on public.notes;

create policy "own vault" on public.vault
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- `updated_at` is what the board sorts by, so it must not depend on the client
-- remembering to send it.
drop trigger if exists notes_touch_updated_at on public.notes;
create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_updated_at();

drop trigger if exists vault_touch_updated_at on public.vault;
create trigger vault_touch_updated_at
  before update on public.vault
  for each row execute function public.touch_updated_at();

-- ============================================================================
-- GRANTS
--
-- Policies and privileges are two different gates, and PostgREST hits the
-- privilege one first. Without these grants every request 403s with
-- "permission denied for table …" before RLS is ever consulted — which looks
-- exactly like a policy problem and isn't one.
--
-- Granting to `anon` is not a hole: RLS still applies on top, and an
-- unauthenticated request has a null auth.uid(), so every policy above
-- evaluates false and no rows come back. Grants say "you may query this
-- table"; policies say "and only these rows".
-- ============================================================================
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated;

-- Same treatment for anything added to this schema later, so a new table never
-- silently starts life unreachable.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
