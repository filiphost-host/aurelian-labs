import { NextResponse } from "next/server";
import { parseYahooCloses } from "@/lib/market-data";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Constituent = { symbol: string; name: string; cik?: string };

const usCompanies = {
  MSFT: { symbol: "MSFT", name: "Microsoft", cik: "0000789019" },
  NVDA: { symbol: "NVDA", name: "Nvidia", cik: "0001045810" },
  GOOGL: { symbol: "GOOGL", name: "Alphabet", cik: "0001652044" },
  META: { symbol: "META", name: "Meta Platforms", cik: "0001326801" },
  AVGO: { symbol: "AVGO", name: "Broadcom", cik: "0001730168" },
  AMZN: { symbol: "AMZN", name: "Amazon", cik: "0001018724" },
  AMD: { symbol: "AMD", name: "AMD", cik: "0000002488" },
} as const;

const trackedIndices: Record<string, { symbol: string; name: string; constituents: Constituent[] }> = {
  "index-sp500": {
    symbol: "^GSPC",
    name: "S&P 500",
    constituents: [
      usCompanies.MSFT,
      usCompanies.NVDA,
      usCompanies.GOOGL,
      usCompanies.META,
      usCompanies.AVGO,
      usCompanies.AMZN,
    ],
  },
  "index-nasdaq": {
    symbol: "^IXIC",
    name: "Nasdaq Composite",
    constituents: [
      usCompanies.NVDA,
      usCompanies.AVGO,
      usCompanies.META,
      usCompanies.GOOGL,
      usCompanies.MSFT,
      usCompanies.AMD,
    ],
  },
  "index-stoxx": {
    symbol: "^STOXX",
    name: "STOXX Europe 600",
    constituents: [
      { symbol: "ASML.AS", name: "ASML" },
      { symbol: "SAP.DE", name: "SAP" },
      { symbol: "NOVO-B.CO", name: "Novo Nordisk" },
      { symbol: "RHM.DE", name: "Rheinmetall" },
      { symbol: "SIE.DE", name: "Siemens" },
      { symbol: "AIR.PA", name: "Airbus" },
    ],
  },
  "index-dax": {
    symbol: "^GDAXI",
    name: "DAX",
    constituents: [
      { symbol: "RHM.DE", name: "Rheinmetall" },
      { symbol: "SAP.DE", name: "SAP" },
      { symbol: "SIE.DE", name: "Siemens" },
      { symbol: "ALV.DE", name: "Allianz" },
      { symbol: "DBK.DE", name: "Deutsche Bank" },
      { symbol: "DTE.DE", name: "Deutsche Telekom" },
    ],
  },
  "index-ftse": {
    symbol: "^FTSE",
    name: "FTSE 100",
    constituents: [
      { symbol: "RR.L", name: "Rolls-Royce Holdings" },
      { symbol: "BA.L", name: "BAE Systems" },
      { symbol: "NWG.L", name: "NatWest Group" },
      { symbol: "LLOY.L", name: "Lloyds Banking Group" },
      { symbol: "SHEL.L", name: "Shell" },
      { symbol: "AZN.L", name: "AstraZeneca" },
    ],
  },
  "index-nikkei": {
    symbol: "^N225",
    name: "Nikkei 225",
    constituents: [
      { symbol: "6857.T", name: "Advantest" },
      { symbol: "7011.T", name: "Mitsubishi Heavy Industries" },
      { symbol: "9984.T", name: "SoftBank Group" },
      { symbol: "8035.T", name: "Tokyo Electron" },
      { symbol: "5803.T", name: "Fujikura" },
      { symbol: "7203.T", name: "Toyota Motor" },
    ],
  },
  "index-oslo": {
    symbol: "OSEBX.OL",
    name: "Oslo Bors Benchmark",
    constituents: [
      { symbol: "KOG.OL", name: "Kongsberg Gruppen" },
      { symbol: "DNB.OL", name: "DNB Bank" },
      { symbol: "EQNR.OL", name: "Equinor" },
      { symbol: "AKRBP.OL", name: "Aker BP" },
      { symbol: "MOWI.OL", name: "Mowi" },
      { symbol: "TEL.OL", name: "Telenor" },
    ],
  },
};

const secDebtCache = new Map<string, { value: number | null; expiresAt: number }>();

type HistoryMetric = {
  growthPercent: number | null;
  sharpeRatio: number | null;
  asOf: string | null;
};

function metricFromCloses(closes: Array<{ date: string; close: number }>): HistoryMetric {
  if (closes.length < 2) return { growthPercent: null, sharpeRatio: null, asOf: null };
  const first = closes[0].close;
  const last = closes.at(-1)!.close;
  const returns = closes.slice(1).flatMap((point, index) => {
    const previous = closes[index].close;
    return previous > 0 ? [point.close / previous - 1] : [];
  });
  const mean = returns.reduce((sum, value) => sum + value, 0) / Math.max(returns.length, 1);
  const variance = returns.length > 1
    ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
    : 0;
  const volatility = Math.sqrt(variance);
  return {
    growthPercent: first > 0 ? (last / first - 1) * 100 : null,
    sharpeRatio: returns.length >= 30 && volatility > 0 ? mean / volatility * Math.sqrt(252) : null,
    asOf: closes.at(-1)?.date ?? null,
  };
}

async function fetchHistoryMetric(symbol: string): Promise<HistoryMetric> {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`,
    {
      headers: { "User-Agent": "Aurelian-Labs/1.0" },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 21_600 },
    },
  ).catch(() => null);
  if (!response?.ok) return { growthPercent: null, sharpeRatio: null, asOf: null };
  const payload = await response.json().catch(() => null);
  return metricFromCloses(parseYahooCloses(payload));
}

function latestSecValue(facts: Record<string, { units?: { USD?: Array<{ val?: number; filed?: string }> } }> | undefined, tags: string[]) {
  for (const tag of tags) {
    const observations = facts?.[tag]?.units?.USD ?? [];
    const latest = observations
      .filter((item) => typeof item.val === "number")
      .sort((left, right) => (left.filed ?? "").localeCompare(right.filed ?? ""))
      .at(-1)?.val;
    if (typeof latest === "number") return latest;
  }
  return null;
}

const SEC_CACHE_TTL_MS = 86_400_000;

async function readStoredSecDebt(cik: string) {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("sec_metric_cache")
    .select("value,expires_at")
    .eq("cik", cik)
    .eq("metric", "debt_to_equity")
    .maybeSingle();
  const expiresAt = data ? new Date(data.expires_at).getTime() : 0;
  if (!data || expiresAt <= Date.now()) return null;
  return { value: data.value === null ? null : Number(data.value), expiresAt };
}

async function storeSecDebt(cik: string, value: number | null, expiresAt: number) {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("sec_metric_cache").upsert({
    cik,
    metric: "debt_to_equity",
    value,
    computed_at: new Date().toISOString(),
    expires_at: new Date(expiresAt).toISOString(),
  }, { onConflict: "cik,metric" });
}

async function fetchSecDebtToEquity(cik: string) {
  const cached = secDebtCache.get(cik);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const stored = await readStoredSecDebt(cik);
  if (stored) {
    secDebtCache.set(cik, { value: stored.value, expiresAt: stored.expiresAt });
    return stored.value;
  }
  const response = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
    headers: { "User-Agent": process.env.SEC_USER_AGENT ?? "Aurelian Labs https://aurelian-labs.vercel.app" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null) as {
    facts?: { "us-gaap"?: Record<string, { units?: { USD?: Array<{ val?: number; filed?: string }> } }> };
  } | null;
  const facts = payload?.facts?.["us-gaap"];
  const currentDebt = latestSecValue(facts, [
    "LongTermDebtAndFinanceLeaseObligationsCurrent",
    "LongTermDebtCurrent",
  ]);
  const noncurrentDebt = latestSecValue(facts, [
    "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
    "LongTermDebtNoncurrent",
  ]);
  const shortTermDebt = latestSecValue(facts, ["ShortTermBorrowings", "ShortTermDebt"]);
  const equity = latestSecValue(facts, ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"]);
  const debtParts = [currentDebt, noncurrentDebt, shortTermDebt].filter((value): value is number => value !== null);
  const value = !debtParts.length || equity === null || equity <= 0
    ? null
    : debtParts.reduce((sum, item) => sum + item, 0) / equity * 100;
  const expiresAt = Date.now() + SEC_CACHE_TTL_MS;
  secDebtCache.set(cik, { value, expiresAt });
  await storeSecDebt(cik, value, expiresAt);
  return value;
}

async function fetchYahooDebtToEquity(symbol: string) {
  const now = Math.floor(Date.now() / 1000);
  const response = await fetch(
    `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?symbol=${encodeURIComponent(symbol)}&type=quarterlyTotalDebt,quarterlyStockholdersEquity&period1=${now - 86_400 * 550}&period2=${now}`,
    {
      headers: { "User-Agent": "Aurelian-Labs/1.0" },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 86_400 },
    },
  ).catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null) as {
    timeseries?: { result?: Array<{ meta?: { type?: string }; timestamp?: number[]; reportedValue?: Array<{ raw?: number }> }> };
  } | null;
  const series = payload?.timeseries?.result ?? [];
  const latest = (type: string) => {
    const row = series.find((item) => item.meta?.type === type);
    return row?.reportedValue?.flatMap((value) => typeof value.raw === "number" ? [value.raw] : []).at(-1) ?? null;
  };
  const debt = latest("quarterlyTotalDebt");
  const equity = latest("quarterlyStockholdersEquity");
  return debt !== null && equity !== null && equity > 0 ? debt / equity * 100 : null;
}

async function fetchDebtToEquity(company: Constituent) {
  if (company.cik) {
    const secValue = await fetchSecDebtToEquity(company.cik);
    if (secValue !== null) return secValue;
  }
  return fetchYahooDebtToEquity(company.symbol);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { indexId?: unknown } | null;
  const indexId = typeof body?.indexId === "string" ? body.indexId : "";
  if (!Object.hasOwn(trackedIndices, indexId)) {
    return NextResponse.json({ error: "Unsupported index" }, { status: 404 });
  }
  const index = trackedIndices[indexId];

  const [benchmark, ...companies] = await Promise.all([
    fetchHistoryMetric(index.symbol),
    ...index.constituents.map(async (company) => {
      const [history, debtToEquity] = await Promise.all([
        fetchHistoryMetric(company.symbol),
        fetchDebtToEquity(company),
      ]);
      return { ...company, ...history, debtToEquity };
    }),
  ]);

  const available = companies.filter((company) => company.growthPercent !== null);
  const qualifying = available
    .filter((company) => company.growthPercent! >= 8)
    .sort((left, right) => right.growthPercent! - left.growthPercent!);

  return NextResponse.json({
    index: { id: indexId, symbol: index.symbol, name: index.name, ...benchmark },
    thresholdPercent: 8,
    companies: qualifying,
    trackedCount: index.constituents.length,
    availableCount: available.length,
    source: "Yahoo Finance delayed history; SEC company facts for available US debt figures",
    methodology: "Trailing one-year price growth. Sharpe is annualized from daily returns using a 0% cash rate. Debt is latest available current, non-current, and short-term debt / shareholder equity.",
  });
}
