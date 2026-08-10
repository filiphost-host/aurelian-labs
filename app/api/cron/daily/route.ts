import { NextResponse } from "next/server";
import { fallbackFxToNok, portfolioSummary } from "@/lib/calculations";
import { type FxRateRow, latestFxRatesFromRows } from "@/lib/fx";
import { buildDailyBrief } from "@/lib/insights";
import { fetchDailyClose, fetchEcbFxToNok, fetchYahooDailyCloses } from "@/lib/providers";
import { createAdminClient } from "@/lib/supabase-admin";
import type {
  Holding,
  HoldingDecision,
  MarketEvent,
  PortfolioSnapshot,
  Transaction,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ message: "Private storage is not configured." }, { status: 503 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: profiles, error: profileError } = await admin.from("profiles").select("id");
  if (profileError) return NextResponse.json({ message: profileError.message }, { status: 500 });

  const fx = await fetchEcbFxToNok();

  const benchmarkSymbols = [
    { symbol: "^GSPC", currency: "USD" },
    { symbol: "OSEBX.OL", currency: "NOK" },
  ];
  const benchmarks: Array<{ symbol: string; written: number; error: string | null }> = [];
  for (const benchmark of benchmarkSymbols) {
    const { count, error: countError } = await admin
      .from("benchmark_prices")
      .select("id", { count: "exact", head: true })
      .eq("symbol", benchmark.symbol);
    if (countError) {
      benchmarks.push({ symbol: benchmark.symbol, written: 0, error: countError.message });
      continue;
    }
    const closes = await fetchYahooDailyCloses(benchmark.symbol, null, (count ?? 0) < 100 ? "10y" : "5d");
    const rows = closes.map((point) => ({
      symbol: benchmark.symbol,
      price_date: point.date,
      close: point.close,
      currency: benchmark.currency,
      source: "Yahoo Finance",
      status: "delayed",
    }));
    let written = 0;
    let failure: string | null = null;
    for (let index = 0; index < rows.length && failure === null; index += 500) {
      const chunk = rows.slice(index, index + 500);
      const { error } = await admin
        .from("benchmark_prices")
        .upsert(chunk, { onConflict: "symbol,price_date" });
      if (error) failure = error.message;
      else written += chunk.length;
    }
    benchmarks.push({ symbol: benchmark.symbol, written, error: failure });
  }

  const results: Array<{ userId: string; refreshed: number; missing: number }> = [];

  for (const profile of profiles ?? []) {
    const [holdingsResult, transactionsResult, decisionsResult, eventsResult, snapshotsResult] = await Promise.all([
      admin.from("holdings").select("*").eq("user_id", profile.id),
      admin.from("transactions").select("*").eq("user_id", profile.id),
      admin.from("holding_decisions").select("*").eq("user_id", profile.id),
      admin.from("market_events").select("*").eq("user_id", profile.id),
      admin.from("portfolio_snapshots").select("*").eq("user_id", profile.id).order("snapshot_date"),
    ]);

    const holdings = (holdingsResult.data ?? []) as unknown as Holding[];
    let refreshed = 0;
    let missing = 0;
    for (const holding of holdings) {
      if (!holding.ticker || holding.asset_type === "bond" || holding.asset_type === "cash") continue;
      const close = await fetchDailyClose(holding.ticker, holding.exchange);
      if (!close) {
        missing += 1;
        continue;
      }
      refreshed += 1;
      holding.market_price = close.close;
      holding.price_provenance = {
        source: close.source,
        as_of: close.asOf,
        status: close.status,
      };
      await admin.from("daily_prices").upsert({
        user_id: profile.id,
        holding_id: holding.id,
        price_date: close.asOf,
        close_price: close.close,
        currency: holding.currency,
        source: close.source,
        status: close.status,
      }, { onConflict: "user_id,holding_id,price_date" });
      await admin.from("holdings").update({
        market_price: close.close,
        price_provenance: holding.price_provenance,
      }).eq("id", holding.id).eq("user_id", profile.id);
    }

    if (fx) {
      for (const [currency, rate] of Object.entries(fx.rates)) {
        await admin.from("fx_rates").upsert({
          user_id: profile.id,
          base_currency: currency,
          quote_currency: "NOK",
          rate,
          source: fx.source,
          as_of: fx.asOf,
        }, { onConflict: "user_id,base_currency,quote_currency,as_of" });
      }
    }

    const transactions = (transactionsResult.data ?? []) as unknown as Transaction[];
    const decisions = (decisionsResult.data ?? []) as unknown as HoldingDecision[];
    const events = (eventsResult.data ?? []) as unknown as MarketEvent[];
    const snapshots = (snapshotsResult.data ?? []) as unknown as PortfolioSnapshot[];

    let profileRates = fx ? { ...fallbackFxToNok, ...fx.rates } : fallbackFxToNok;
    if (!fx) {
      const { data: storedFx } = await admin
        .from("fx_rates")
        .select("base_currency,quote_currency,rate,as_of,source")
        .eq("user_id", profile.id)
        .order("as_of", { ascending: false })
        .limit(120);
      profileRates = latestFxRatesFromRows((storedFx ?? []) as FxRateRow[]).rates;
    }

    const summary = portfolioSummary(holdings, transactions, snapshots, profileRates);
    const brief = buildDailyBrief({
      holdings,
      transactions,
      decisions,
      events,
      snapshots,
      asOf: today,
      generatedAt: new Date().toISOString(),
      fxRates: profileRates,
    });

    await admin.from("portfolio_snapshots").upsert({
      user_id: profile.id,
      snapshot_date: today,
      total_value_nok: summary.total,
      external_flow_nok: 0,
      source: "calculated",
    }, { onConflict: "user_id,snapshot_date" });
    await admin.from("daily_briefs").upsert({
      user_id: profile.id,
      brief_date: today,
      title: brief.title,
      summary: brief.summary,
      insights: brief.insights,
      generated_at: brief.generated_at,
    }, { onConflict: "user_id,brief_date" });

    results.push({ userId: profile.id, refreshed, missing });
  }

  return NextResponse.json({
    ok: true,
    asOf: today,
    fx: fx?.asOf ?? null,
    fxSource: fx ? fx.source : "stored or built-in fallback",
    benchmarks,
    results,
  });
}
