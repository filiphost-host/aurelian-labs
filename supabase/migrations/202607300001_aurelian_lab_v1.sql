create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  base_currency text not null default 'NOK',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null check (asset_type in ('stock', 'etf', 'cash', 'bond')),
  ticker text,
  name text not null,
  quantity numeric not null default 0,
  average_cost numeric not null default 0,
  market_price numeric not null default 0,
  currency text not null default 'NOK',
  country text,
  sector text,
  region text,
  account_note text,
  manual_value_nok numeric,
  factor_exposures jsonb not null default '{}'::jsonb,
  issuer text,
  coupon_rate numeric,
  maturity_date date,
  face_value numeric,
  yield_estimate numeric,
  duration_estimate numeric,
  credit_quality text,
  seniority text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.allocation_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('asset_type', 'region', 'sector', 'currency', 'cash')),
  label text not null,
  min_percent numeric not null default 0,
  target_percent numeric not null default 0,
  max_percent numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.theses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid references public.holdings(id) on delete set null,
  title text not null,
  status text not null default 'hold' check (status in ('watch', 'buy', 'hold', 'sell', 'sold')),
  thesis text,
  reason_for_ownership text,
  return_drivers text,
  risks text,
  catalysts text,
  valuation_view text,
  conviction integer not null default 3 check (conviction between 1 and 5),
  time_horizon text,
  review_date date,
  post_mortem text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.thesis_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thesis_id uuid not null references public.theses(id) on delete cascade,
  snapshot jsonb not null,
  change_note text,
  created_at timestamptz not null default now()
);

create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  base_currency text not null,
  quote_currency text not null,
  rate numeric not null,
  source text not null default 'manual',
  as_of date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, base_currency, quote_currency, as_of)
);

alter table public.profiles enable row level security;
alter table public.holdings enable row level security;
alter table public.allocation_targets enable row level security;
alter table public.theses enable row level security;
alter table public.thesis_revisions enable row level security;
alter table public.fx_rates enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "holdings_select_own" on public.holdings for select to authenticated using ((select auth.uid()) = user_id);
create policy "holdings_insert_own" on public.holdings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "holdings_update_own" on public.holdings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "holdings_delete_own" on public.holdings for delete to authenticated using ((select auth.uid()) = user_id);

create policy "targets_select_own" on public.allocation_targets for select to authenticated using ((select auth.uid()) = user_id);
create policy "targets_insert_own" on public.allocation_targets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "targets_update_own" on public.allocation_targets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "targets_delete_own" on public.allocation_targets for delete to authenticated using ((select auth.uid()) = user_id);

create policy "theses_select_own" on public.theses for select to authenticated using ((select auth.uid()) = user_id);
create policy "theses_insert_own" on public.theses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "theses_update_own" on public.theses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "theses_delete_own" on public.theses for delete to authenticated using ((select auth.uid()) = user_id);

create policy "revisions_select_own" on public.thesis_revisions for select to authenticated using ((select auth.uid()) = user_id);
create policy "revisions_insert_own" on public.thesis_revisions for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "fx_select_own" on public.fx_rates for select to authenticated using ((select auth.uid()) = user_id);
create policy "fx_insert_own" on public.fx_rates for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "fx_update_own" on public.fx_rates for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "fx_delete_own" on public.fx_rates for delete to authenticated using ((select auth.uid()) = user_id);
