# Aurelian Labs

A private investment workbench for a single owner. It combines a manual transaction ledger, daily portfolio insights, decision memory, sourced market context, country research, and transparent scenario analysis.

## Run locally

Use Node.js 20 or newer and pnpm.

```bash
pnpm install
cp .env.local.example .env.local
pnpm dev
```

Without Supabase variables, the app opens in a clearly labelled preview mode using local sample data.

## Private Supabase setup

1. Create a Supabase project and run all migrations in `supabase/migrations` (in filename order).
2. Pre-create the owner in Supabase Authentication.
3. Set `OWNER_EMAIL` to that exact address.
4. Add the app URL and `/auth/callback` to the allowed Auth redirect URLs.
5. Keep email registration disabled. The app also sends `shouldCreateUser: false`, checks the owner email on callback, protects private routes server-side, and relies on ownership-based Row Level Security.

Required variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OWNER_EMAIL=
CRON_SECRET=
```

Optional free-source variables:

```dotenv
OPENFIGI_API_KEY=
TWELVE_DATA_API_KEY=
EODHD_API_KEY=
```

`EODHD_API_KEY` (free tier, 20 calls/day) gives the daily cron official end-of-day closes for European and Oslo tickers that the Twelve Data free tier does not cover; without it the cron falls back to the delayed Yahoo path.

The service-role key and cron secret are server-only. Never prefix them with `NEXT_PUBLIC_`.

## Deploy to Vercel

Create a Vercel project from this directory, add the same environment variables, and deploy. `vercel.json` schedules the protected daily refresh at 05:15 UTC. Vercel automatically sends the cron authorization header when `CRON_SECRET` is configured.

Add these Supabase Auth redirects after the first deployment:

```text
https://YOUR-PROJECT.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

Public snapshot URLs contain random opaque tokens. Only token hashes are stored, snapshots expire by default after seven days, can be revoked immediately, and contain a frozen user-selected payload rather than live portfolio access.

## Data policy

- SEC EDGAR, ECB, FRED, World Bank, OpenFIGI, and market-price sources are accessed through server adapters.
- Latest quotes prefer Twelve Data when configured and otherwise use a clearly labelled delayed Yahoo Finance fallback cached for five minutes.
- Daily closes follow the chain Twelve Data → EODHD → Yahoo Finance, and valuations use the latest stored ECB rates (falling back to built-in estimates only when no stored rate exists).
- Benchmark closes (S&P 500 and OSEBX) are stored daily by the cron and drive the performance comparison; before the first cron run the chart shows a clearly labelled reference estimate instead.
- Missing data stays missing. Previous observations may remain visible as stale after a provider failure.
- Manual and estimated values are explicitly labelled.
- Shared snapshots should omit provider-controlled raw data where redistribution is unclear.
- “Analyze in ChatGPT” copies a user-reviewed packet and opens ChatGPT; it sends nothing automatically and uses no OpenAI API.

## Verification

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```
