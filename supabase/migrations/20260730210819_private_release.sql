create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text,
  name text not null,
  isin text,
  figi text,
  exchange text,
  currency text,
  country text,
  instrument_type text,
  source text not null default 'manual',
  source_identifier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.holdings
  add column if not exists instrument_id uuid references public.instruments(id) on delete set null,
  add column if not exists isin text,
  add column if not exists figi text,
  add column if not exists exchange text,
  add column if not exists price_provenance jsonb not null default jsonb_build_object(
    'source', 'Manual',
    'as_of', current_date::text,
    'status', 'manual'
  );

alter table public.holdings
  alter column market_price drop not null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid references public.holdings(id) on delete set null,
  type text not null check (type in (
    'opening_balance', 'buy', 'sell', 'deposit', 'withdrawal', 'dividend', 'fee', 'split'
  )),
  occurred_at date not null,
  quantity numeric,
  unit_price numeric,
  amount numeric,
  fee numeric not null default 0,
  currency text not null default 'NOK',
  fx_to_nok numeric not null default 1 check (fx_to_nok > 0),
  split_ratio numeric,
  note text,
  created_at timestamptz not null default now(),
  check (quantity is null or quantity >= 0),
  check (fee >= 0),
  check (split_ratio is null or split_ratio > 0)
);

create table public.daily_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid not null references public.holdings(id) on delete cascade,
  price_date date not null,
  close_price numeric not null check (close_price >= 0),
  currency text not null,
  source text not null,
  status text not null check (status in ('live', 'delayed', 'manual', 'estimated', 'stale', 'unavailable')),
  created_at timestamptz not null default now(),
  unique (user_id, holding_id, price_date)
);

create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  total_value_nok numeric not null check (total_value_nok >= 0),
  external_flow_nok numeric not null default 0,
  source text not null check (source in ('calculated', 'legacy_estimate')),
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);

create table public.holding_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid not null references public.holdings(id) on delete cascade,
  status text not null default 'hold' check (status in ('watch', 'buy', 'hold', 'sell', 'sold')),
  thesis text not null default '',
  reason_for_ownership text not null default '',
  return_drivers text not null default '',
  risks text not null default '',
  conviction integer not null default 3 check (conviction between 1 and 5),
  review_date date,
  note text,
  recorded_at timestamptz not null default now()
);

create table public.market_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid references public.holdings(id) on delete cascade,
  title text not null,
  event_type text not null check (event_type in ('filing', 'earnings', 'macro', 'review')),
  event_date date not null,
  source text not null,
  source_url text,
  status text not null default 'new' check (status in ('upcoming', 'new', 'reviewed')),
  created_at timestamptz not null default now()
);

create table public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brief_date date not null,
  title text not null,
  summary text not null,
  insights jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  unique (user_id, brief_date)
);

create table public.saved_scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  shocks jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.share_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  title text not null,
  kind text not null check (kind in ('insight', 'scenario')),
  payload jsonb not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index instruments_user_search_idx on public.instruments (user_id, lower(name), lower(symbol));
create index transactions_user_date_idx on public.transactions (user_id, occurred_at desc);
create index transactions_holding_date_idx on public.transactions (holding_id, occurred_at desc);
create index daily_prices_holding_date_idx on public.daily_prices (holding_id, price_date desc);
create index snapshots_user_date_idx on public.portfolio_snapshots (user_id, snapshot_date desc);
create index decisions_holding_date_idx on public.holding_decisions (holding_id, recorded_at desc);
create index events_user_date_idx on public.market_events (user_id, event_date);
create index share_snapshots_expiry_idx on public.share_snapshots (expires_at) where revoked_at is null;

alter table public.instruments enable row level security;
alter table public.transactions enable row level security;
alter table public.daily_prices enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.holding_decisions enable row level security;
alter table public.market_events enable row level security;
alter table public.daily_briefs enable row level security;
alter table public.saved_scenarios enable row level security;
alter table public.share_snapshots enable row level security;

create policy "instruments_select_own" on public.instruments for select to authenticated using ((select auth.uid()) = user_id);
create policy "instruments_insert_own" on public.instruments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "instruments_update_own" on public.instruments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "instruments_delete_own" on public.instruments for delete to authenticated using ((select auth.uid()) = user_id);

create policy "transactions_select_own" on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy "transactions_insert_own" on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "transactions_update_own" on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "transactions_delete_own" on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "daily_prices_select_own" on public.daily_prices for select to authenticated using ((select auth.uid()) = user_id);
create policy "daily_prices_insert_own" on public.daily_prices for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "daily_prices_update_own" on public.daily_prices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "daily_prices_delete_own" on public.daily_prices for delete to authenticated using ((select auth.uid()) = user_id);

create policy "snapshots_select_own" on public.portfolio_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy "snapshots_insert_own" on public.portfolio_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "snapshots_update_own" on public.portfolio_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "snapshots_delete_own" on public.portfolio_snapshots for delete to authenticated using ((select auth.uid()) = user_id);

create policy "decisions_select_own" on public.holding_decisions for select to authenticated using ((select auth.uid()) = user_id);
create policy "decisions_insert_own" on public.holding_decisions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "decisions_update_own" on public.holding_decisions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "decisions_delete_own" on public.holding_decisions for delete to authenticated using ((select auth.uid()) = user_id);

create policy "events_select_own" on public.market_events for select to authenticated using ((select auth.uid()) = user_id);
create policy "events_insert_own" on public.market_events for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "events_update_own" on public.market_events for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "events_delete_own" on public.market_events for delete to authenticated using ((select auth.uid()) = user_id);

create policy "briefs_select_own" on public.daily_briefs for select to authenticated using ((select auth.uid()) = user_id);
create policy "briefs_insert_own" on public.daily_briefs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "briefs_update_own" on public.daily_briefs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "briefs_delete_own" on public.daily_briefs for delete to authenticated using ((select auth.uid()) = user_id);

create policy "scenarios_select_own" on public.saved_scenarios for select to authenticated using ((select auth.uid()) = user_id);
create policy "scenarios_insert_own" on public.saved_scenarios for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "scenarios_update_own" on public.saved_scenarios for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "scenarios_delete_own" on public.saved_scenarios for delete to authenticated using ((select auth.uid()) = user_id);

create policy "shares_select_own" on public.share_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy "shares_insert_own" on public.share_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "shares_update_own" on public.share_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "shares_delete_own" on public.share_snapshots for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table
  public.profiles,
  public.holdings,
  public.allocation_targets,
  public.theses,
  public.thesis_revisions,
  public.fx_rates,
  public.instruments,
  public.transactions,
  public.daily_prices,
  public.portfolio_snapshots,
  public.holding_decisions,
  public.market_events,
  public.daily_briefs,
  public.saved_scenarios,
  public.share_snapshots
to authenticated;

insert into public.transactions (
  user_id, holding_id, type, occurred_at, quantity, unit_price, fee, currency, fx_to_nok, note
)
select
  user_id,
  id,
  'opening_balance',
  coalesce(created_at::date, current_date),
  quantity,
  average_cost,
  0,
  currency,
  case upper(currency)
    when 'NOK' then 1
    when 'USD' then 10.8
    when 'EUR' then 11.8
    when 'SEK' then 1.05
    when 'DKK' then 1.58
    when 'GBP' then 13.8
    when 'CHF' then 12.4
    else 1
  end,
  'Migrated from the original holding'
from public.holdings
where quantity > 0
  and not exists (
    select 1 from public.transactions existing_transaction
    where existing_transaction.holding_id = holdings.id
  );

insert into public.transactions (
  user_id, holding_id, type, occurred_at, amount, fee, currency, fx_to_nok, note
)
select
  user_id,
  null,
  'deposit',
  min(coalesce(created_at::date, current_date)),
  sum(
    quantity * average_cost *
    case upper(currency)
      when 'NOK' then 1
      when 'USD' then 10.8
      when 'EUR' then 11.8
      when 'SEK' then 1.05
      when 'DKK' then 1.58
      when 'GBP' then 13.8
      when 'CHF' then 12.4
      else 1
    end
  ),
  0,
  'NOK',
  1,
  'Legacy opening capital'
from public.holdings
group by user_id
having count(*) > 0;

insert into public.holding_decisions (
  user_id, holding_id, status, thesis, reason_for_ownership, return_drivers,
  risks, conviction, review_date, note, recorded_at
)
select
  user_id,
  holding_id,
  status,
  coalesce(thesis, ''),
  coalesce(reason_for_ownership, ''),
  coalesce(return_drivers, ''),
  coalesce(risks, ''),
  conviction,
  review_date,
  coalesce(post_mortem, valuation_view),
  coalesce(updated_at, created_at)
from public.theses
where holding_id is not null;
