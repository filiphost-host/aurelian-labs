# Aurelian Capital

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

## Importing broker transactions

The transaction ledger accepts a CSV or tab-separated export from any broker. The
file is parsed in the browser and never uploaded; only the rows confirmed in the
preview are written to the ledger.

Columns are detected automatically from common Norwegian and English headers and
can be remapped by hand. A row is listed instead of guessed when its date, type,
numbers, or instrument cannot be read with certainty. That includes:

- a buy or sell missing either a quantity or a unit price
- a value such as `1.000`, which is either one thousand or one point zero, in a
  file where no other cell reveals which separator marks decimals
- a sale, dividend, fee, or cash flow in a foreign currency with no exchange-rate
  column, because its value in NOK cannot be known from the file alone
- a stock split, whose ratio has to be entered by hand

Decimal separators and day-first or month-first dates are decided once per file
from cells that settle the question, never cell by cell. Withholding tax is
imported as a cost rather than as a dividend, and a negative deposit is read as a
withdrawal.

Every imported row stores an `import_fingerprint`, a canonical description of that
row. A unique index makes re-importing the same file a no-op, so it is safe to add
a missing holding and import the file again. Rows that resemble an existing manual
entry start unticked and need a deliberate click.

One consequence worth knowing: two genuinely identical trades — same instrument,
day, quantity, price, and fee — describe themselves identically, so the second one
arriving in a later file is treated as already imported. Record that one by hand.

## The AI analyst

Insights has an **Ask the analyst** button that writes a narrative across the day's
insights, or argues the bear case against a recorded thesis.

It runs through the Vercel AI Gateway. On a Vercel deployment the OIDC token is used
automatically; elsewhere set `AI_GATEWAY_API_KEY`. Without either, the button reports
that the analyst is not connected and sends nothing. `AI_ANALYST_MODEL` overrides the
default model.

The rules it works under are enforced in the request, not just requested politely:

- The packet is built in the browser, shown in full before sending, and validated
  again on the server against a schema with size limits.
- The same redaction switches as the ChatGPT packet apply, and the packet states
  what was withheld so the model works with the gap rather than guessing at it.
- No tools are attached, so the packet is the model's only source. It is instructed
  never to state a figure the packet does not contain, never to recommend a trade,
  and never to predict prices.
- If the model stops part way through, the answer says so rather than ending
  silently. Nothing the analyst writes is stored.

## Data policy

- SEC EDGAR, ECB, FRED, World Bank, OpenFIGI, and market-price sources are accessed through server adapters.
- Latest quotes prefer Twelve Data when configured and otherwise use a clearly labelled delayed Yahoo Finance fallback cached for five minutes.
- Exchange rates come from Norges Bank, the rates of record for NOK, with the ECB cross-rates as a fallback. Valuations use the latest stored rate and fall back to built-in estimates only when nothing is stored.
- Daily closes follow the chain Twelve Data → EODHD → Yahoo Finance.
- The Data room, under Insights → Data sources, lists every source, whether it is connected, and how fresh the stored rates and benchmark closes are.
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
