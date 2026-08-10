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
alter table public.wallets      enable row level security;
alter table public.categories   enable row level security;
alter table public.budgets      enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "own wallets"      on public.wallets;
drop policy if exists "own categories"   on public.categories;
drop policy if exists "own budgets"      on public.budgets;
drop policy if exists "own transactions" on public.transactions;

create policy "own wallets" on public.wallets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
