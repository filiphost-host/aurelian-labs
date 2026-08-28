import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Candidate = {
  symbol: string;
  name: string;
  country: string;
  industry: string;
  signal: string;
  sourceUrl: string;
};

type PricePoint = { close: number; volume: number; timestamp: number };

const candidates: Candidate[] = [
  { symbol: "VSXY", name: "Victoria's Secret", country: "United States", industry: "Specialty retail", signal: "Brand turnaround", sourceUrl: "https://www.victoriassecretandco.com/investors" },
  { symbol: "ANF", name: "Abercrombie & Fitch", country: "United States", industry: "Apparel retail", signal: "Margin and brand reset", sourceUrl: "https://corporate.abercrombie.com/investors/" },
  { symbol: "ELF", name: "e.l.f. Beauty", country: "United States", industry: "Beauty", signal: "Affordable premium", sourceUrl: "https://investor.elfbeauty.com/" },
  { symbol: "URI", name: "United Rentals", country: "United States", industry: "Equipment rental", signal: "Infrastructure cycle", sourceUrl: "https://investor-relations.unitedrentals.com/" },
  { symbol: "RR.L", name: "Rolls-Royce Holdings", country: "United Kingdom", industry: "Aerospace", signal: "Aftermarket cash flow", sourceUrl: "https://www.rolls-royce.com/investors.aspx" },
  { symbol: "RHM.DE", name: "Rheinmetall", country: "Germany", industry: "Defence", signal: "European rearmament", sourceUrl: "https://www.rheinmetall.com/en/investor-relations" },
  { symbol: "SAAB-B.ST", name: "Saab", country: "Sweden", industry: "Defence", signal: "Order-book expansion", sourceUrl: "https://www.saab.com/investors" },
  { symbol: "KOG.OL", name: "Kongsberg Gruppen", country: "Norway", industry: "Defence and maritime", signal: "Dual-use demand", sourceUrl: "https://www.kongsberg.com/investor-relations/" },
  { symbol: "UCB.BR", name: "UCB", country: "Belgium", industry: "Biopharma", signal: "Product-cycle inflection", sourceUrl: "https://www.ucb.com/investors" },
  { symbol: "7011.T", name: "Mitsubishi Heavy Industries", country: "Japan", industry: "Industrials", signal: "Energy and defence backlog", sourceUrl: "https://www.mhi.com/finance" },
  { symbol: "5803.T", name: "Fujikura", country: "Japan", industry: "Electrical equipment", signal: "Data-centre connectivity", sourceUrl: "https://www.fujikura.co.jp/eng/ir/" },
  { symbol: "012450.KS", name: "Hanwha Aerospace", country: "South Korea", industry: "Aerospace and defence", signal: "Export order cycle", sourceUrl: "https://www.hanwhaaerospace.com/eng/ir/irMain.do" },
];

const comparisons: Candidate[] = [
  candidates[0],
  { symbol: "NVDA", name: "Nvidia", country: "United States", industry: "Semiconductors", signal: "AI compute leader", sourceUrl: "https://investor.nvidia.com/" },
  { symbol: "TSM", name: "TSMC", country: "Taiwan", industry: "Semiconductor foundry", signal: "Advanced-node manufacturing", sourceUrl: "https://investor.tsmc.com/english" },
];

function metric(points: PricePoint[]) {
  if (points.length < 2) return null;
  const returns = points.slice(1).map((point, index) => point.close / points[index].close - 1);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.length > 1
    ? returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1)
    : 0;
  let peak = points[0].close;
  let maxDrawdown = 0;
  for (const point of points) {
    peak = Math.max(peak, point.close);
    maxDrawdown = Math.min(maxDrawdown, point.close / peak - 1);
  }
  const sixMonth = points.slice(-126);
  const latestVolumes = points.slice(-20).map((point) => point.volume).filter((volume) => volume > 0);
  return {
    return1y: (points.at(-1)!.close / points[0].close - 1) * 100,
    return6m: sixMonth.length > 1 ? (sixMonth.at(-1)!.close / sixMonth[0].close - 1) * 100 : null,
    sharpe: variance > 0 ? mean / Math.sqrt(variance) * Math.sqrt(252) : null,
    maxDrawdown: maxDrawdown * 100,
    largestDailyMove: Math.max(...returns.map((value) => Math.abs(value))) * 100,
    averageVolume20d: latestVolumes.length
      ? latestVolumes.reduce((sum, value) => sum + value, 0) / latestVolumes.length
      : null,
    lastPrice: points.at(-1)!.close,
    sessions: points.length,
    asOf: new Date(points.at(-1)!.timestamp * 1000).toISOString().slice(0, 10),
  };
}

async function fetchMetric(symbol: string) {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y&events=div%2Csplits`,
    {
      headers: { "User-Agent": "Aurelian-Capital/1.0" },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 21_600 },
    },
  ).catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null) as {
    chart?: { result?: Array<{
      timestamp?: number[];
      indicators?: {
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
        quote?: Array<{ close?: Array<number | null>; volume?: Array<number | null> }>;
      };
    }> };
  } | null;
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.adjclose?.[0]?.adjclose ?? result?.indicators?.quote?.[0]?.close ?? [];
  const volumes = result?.indicators?.quote?.[0]?.volume ?? [];
  const points = timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    return typeof close === "number" && close > 0
      ? [{ timestamp, close, volume: typeof volumes[index] === "number" ? volumes[index]! : 0 }]
      : [];
  });
  return metric(points);
}

function qualityScore(relativeReturn: number, sharpe: number | null, maxDrawdown: number) {
  const relative = Math.max(0, Math.min(45, relativeReturn * 1.25));
  const riskAdjusted = Math.max(0, Math.min(35, ((sharpe ?? 0) + 0.5) * 14));
  const resilience = Math.max(0, Math.min(20, 20 + Math.min(0, maxDrawdown + 20) * 0.5));
  return Math.round(relative + riskAdjusted + resilience);
}

const unavailableMetric = {
  return1y: null,
  return6m: null,
  sharpe: null,
  maxDrawdown: null,
  largestDailyMove: null,
  averageVolume20d: null,
  lastPrice: null,
  sessions: 0,
  asOf: null,
};

export async function GET() {
  const universe = [...new Map([...candidates, ...comparisons].map((candidate) => [candidate.symbol, candidate])).values()];
  const [benchmarkMetric, ...metrics] = await Promise.all([
    fetchMetric("^GSPC"),
    ...universe.map((candidate) => fetchMetric(candidate.symbol)),
  ]);
  const rows = universe.map((candidate, index) => {
    const performance = metrics[index];
    const relativeReturn = performance && benchmarkMetric
      ? performance.return1y - benchmarkMetric.return1y
      : null;
    const passesGuardrails = Boolean(
      performance
      && performance.sessions >= 180
      && (performance.averageVolume20d ?? 0) >= 250_000
      && performance.lastPrice >= 5
      && performance.largestDailyMove <= 30
      && performance.maxDrawdown >= -65
      && (relativeReturn ?? -Infinity) >= 8,
    );
    return {
      ...candidate,
      ...(performance ?? unavailableMetric),
      relativeReturn,
      passesGuardrails,
      qualityScore: performance && relativeReturn !== null
        ? qualityScore(relativeReturn, performance.sharpe, performance.maxDrawdown)
        : null,
    };
  });

  return NextResponse.json({
    benchmark: benchmarkMetric ? { symbol: "^GSPC", name: "S&P 500", ...benchmarkMetric } : null,
    outperformers: rows
      .filter((row) => candidates.some((candidate) => candidate.symbol === row.symbol) && row.passesGuardrails)
      .sort((left, right) => (right.qualityScore ?? 0) - (left.qualityScore ?? 0)),
    comparison: comparisons.map((candidate) => rows.find((row) => row.symbol === candidate.symbol)).filter(Boolean),
    screenedCount: candidates.length,
    methodology: "Curated liquid-company universe. Requires at least 180 sessions, 20-day average volume above 250k, price above 5, no one-day move above 30%, maximum drawdown better than -65%, and at least 8 percentage points of one-year outperformance versus the S&P 500.",
    source: "Yahoo Finance delayed adjusted price and volume history",
    refreshedAt: new Date().toISOString(),
  });
}
