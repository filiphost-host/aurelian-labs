create table public.benchmark_prices (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  price_date date not null,
  close numeric not null check (close > 0),
  currency text not null,
  source text not null,
  status text not null check (status in ('live', 'delayed', 'manual', 'estimated', 'stale', 'unavailable')),
  created_at timestamptz not null default now(),
  unique (symbol, price_date)
);

create index benchmark_prices_symbol_date_idx on public.benchmark_prices (symbol, price_date desc);

alter table public.benchmark_prices enable row level security;

create policy "benchmark_select_authenticated" on public.benchmark_prices
  for select to authenticated using (true);

grant select on table public.benchmark_prices to authenticated;

-- Intentionally no client policies or grants: only the service role reads or
-- writes this cache.
create table public.sec_metric_cache (
  cik text not null,
  metric text not null,
  value numeric,
  computed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (cik, metric)
);

alter table public.sec_metric_cache enable row level security;
