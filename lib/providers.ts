import "server-only";

import { type CallBudget, parseEodhdClose, parseYahooCloses } from "@/lib/market-data";
import { eodhdSymbol, marketDataSymbol } from "@/lib/market-symbols";
import { parseNorgesBankPolicyRate, parseNorgesBankRates } from "@/lib/norges-bank";
import type { MarketQuote } from "@/lib/types";

export type InstrumentSearchResult = {
  id: string;
  symbol: string;
  name: string;
  exchange: string | null;
  country: string | null;
  currency: string | null;
  instrumentType: string | null;
  figi: string | null;
  source: "OpenFIGI" | "Twelve Data";
};

// `fresh` bypasses the Next.js data cache. The daily cron must never be served a
// cached payload: its revalidation window is as long as its own period, so a
// cache hit would persist yesterday's close as today's.
type FetchOptions = RequestInit & { fresh?: boolean };

async function fetchJson<T>(url: string, init?: FetchOptions): Promise<T | null> {
  const { fresh, ...requestInit } = init ?? {};
  try {
    const response = await fetch(url, {
      ...requestInit,
      signal: AbortSignal.timeout(8_000),
      ...(fresh
        ? { cache: "no-store" as const }
        : { next: requestInit.next ?? { revalidate: 86_400 } }),
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export async function searchOpenFigi(query: string): Promise<InstrumentSearchResult[]> {
  const response = await fetchJson<{
    data?: Array<{
      figi: string;
      compositeFIGI?: string | null;
      ticker?: string;
      name?: string;
      exchCode?: string;
      marketSector?: string;
      securityType2?: string;
    }>;
  }>("https://api.openfigi.com/v3/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OPENFIGI_API_KEY ? { "X-OPENFIGI-APIKEY": process.env.OPENFIGI_API_KEY } : {}),
    },
    body: JSON.stringify({ query }),
  });

  const normalizedQuery = query.trim().toLowerCase();
  const supportedTypes = new Set([
    "Common Stock",
    "ETF",
    "ETP",
    "Fund",
    "Corp",
    "Government",
    "Municipal",
  ]);
  const typePriority: Record<string, number> = {
    "Common Stock": 60,
    ETF: 55,
    ETP: 50,
    Fund: 45,
    Corp: 35,
    Government: 30,
    Municipal: 25,
  };
  const seen = new Set<string>();

  return (response?.data ?? [])
    .filter((item) => supportedTypes.has(item.securityType2 ?? ""))
    .sort((left, right) => {
      const score = (item: typeof left) => {
        const ticker = item.ticker?.toLowerCase() ?? "";
        const name = item.name?.toLowerCase() ?? "";
        return (typePriority[item.securityType2 ?? ""] ?? 0) +
          (ticker === normalizedQuery ? 200 : ticker.startsWith(normalizedQuery) ? 80 : 0) +
          (name === normalizedQuery ? 60 : name.startsWith(normalizedQuery) ? 40 : name.includes(normalizedQuery) ? 20 : 0);
      };
      return score(right) - score(left);
    })
    .filter((item) => {
      const key = item.compositeFIGI ?? `${item.ticker}:${item.securityType2}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8)
    .map((item) => ({
      id: item.compositeFIGI ?? item.figi,
      symbol: item.ticker ?? "",
      name: item.name ?? item.ticker ?? "Unknown instrument",
      exchange: item.exchCode ?? null,
      country: null,
      currency: null,
      instrumentType: item.securityType2 ?? item.marketSector ?? null,
      figi: item.compositeFIGI ?? item.figi,
      source: "OpenFIGI",
    }));
}

export async function searchTwelveData(query: string): Promise<InstrumentSearchResult[]> {
  if (!process.env.TWELVE_DATA_API_KEY) return [];
  const response = await fetchJson<{
    data?: Array<{
      symbol: string;
      instrument_name: string;
      exchange?: string;
      country?: string;
      currency?: string;
      instrument_type?: string;
    }>;
  }>(
    `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=8`,
    { headers: { Authorization: `apikey ${process.env.TWELVE_DATA_API_KEY}` } },
  );

  return (response?.data ?? []).map((item) => ({
    id: `${item.exchange ?? "unknown"}:${item.symbol}`,
    symbol: item.symbol,
    name: item.instrument_name,
    exchange: item.exchange ?? null,
    country: item.country ?? null,
    currency: item.currency ?? null,
    instrumentType: item.instrument_type ?? null,
    figi: null,
    source: "Twelve Data",
  }));
}

export async function searchInstruments(query: string) {
  const [openFigi, twelveData] = await Promise.all([
    searchOpenFigi(query),
    searchTwelveData(query),
  ]);
  const seen = new Set<string>();
  return [...twelveData, ...openFigi].filter((item) => {
    const key = `${item.exchange}:${item.symbol}:${item.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12);
}

async function fetchTwelveDataClose(symbol: string, exchange?: string | null) {
  if (!process.env.TWELVE_DATA_API_KEY) return null;
  const response = await fetchJson<{ close?: string; datetime?: string; status?: string }>(
    `https://api.twelvedata.com/eod?symbol=${encodeURIComponent(symbol)}${exchange ? `&exchange=${encodeURIComponent(exchange)}` : ""}`,
    { headers: { Authorization: `apikey ${process.env.TWELVE_DATA_API_KEY}` }, fresh: true },
  );
  if (!response?.close || response.status === "error") return null;
  const close = Number(response.close);
  if (!Number.isFinite(close) || close <= 0) return null;
  return {
    close,
    asOf: response.datetime ?? new Date().toISOString().slice(0, 10),
    source: "Twelve Data",
    status: "delayed" as const,
  };
}

async function fetchEodhdClose(symbol: string, exchange?: string | null) {
  if (!process.env.EODHD_API_KEY) return null;
  const providerSymbol = eodhdSymbol(symbol, exchange);
  if (!providerSymbol) return null;
  const payload = await fetchJson<unknown>(
    `https://eodhd.com/api/eod/${encodeURIComponent(providerSymbol)}?api_token=${process.env.EODHD_API_KEY}&fmt=json&order=d&limit=1`,
    { fresh: true },
  );
  const parsed = parseEodhdClose(payload);
  if (!parsed) return null;
  return { close: parsed.close, asOf: parsed.date, source: "EODHD", status: "delayed" as const };
}

export async function fetchYahooDailyCloses(
  symbol: string,
  exchange?: string | null,
  range: "5d" | "10y" = "5d",
) {
  const providerSymbol = marketDataSymbol(symbol, exchange);
  const payload = await fetchJson<unknown>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=1d&range=${range}`,
    { headers: { "User-Agent": "Aurelian-Labs/1.0" }, fresh: true },
  );
  return parseYahooCloses(payload);
}

async function fetchYahooClose(symbol: string, exchange?: string | null) {
  const closes = await fetchYahooDailyCloses(symbol, exchange, "5d");
  const last = closes.at(-1);
  if (!last) return null;
  return { close: last.close, asOf: last.date, source: "Yahoo Finance", status: "delayed" as const };
}

export async function fetchDailyClose(symbol: string, exchange?: string | null) {
  return await fetchTwelveDataClose(symbol, exchange) ??
    await fetchEodhdClose(symbol, exchange) ??
    await fetchYahooClose(symbol, exchange);
}

type QuoteRequest = {
  id: string;
  symbol: string;
  name: string;
  exchange?: string | null;
  currency?: string | null;
};

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchTwelveDataQuote(instrument: QuoteRequest): Promise<MarketQuote | null> {
  if (!process.env.TWELVE_DATA_API_KEY) return null;
  const response = await fetchJson<{
    close?: string;
    previous_close?: string;
    change?: string;
    percent_change?: string;
    currency?: string;
    datetime?: string;
    timestamp?: number;
    is_market_open?: boolean;
    status?: string;
  }>(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(instrument.symbol)}${instrument.exchange ? `&exchange=${encodeURIComponent(instrument.exchange)}` : ""}`, {
    headers: { Authorization: `apikey ${process.env.TWELVE_DATA_API_KEY}` },
    next: { revalidate: 300 },
  });
  const price = finiteNumber(response?.close);
  if (price === null || response?.status === "error") return null;
  const previousClose = finiteNumber(response?.previous_close);
  return {
    id: instrument.id,
    symbol: instrument.symbol,
    name: instrument.name,
    price,
    previousClose,
    change: finiteNumber(response?.change) ?? (previousClose === null ? null : price - previousClose),
    percentChange: finiteNumber(response?.percent_change) ?? (previousClose ? ((price - previousClose) / previousClose) * 100 : null),
    currency: response?.currency ?? instrument.currency ?? "",
    asOf: response?.timestamp ? new Date(response.timestamp * 1000).toISOString() : response?.datetime ?? new Date().toISOString(),
    marketState: response?.is_market_open === true ? "Open" : response?.is_market_open === false ? "Closed" : null,
    source: "Twelve Data",
    status: response?.is_market_open ? "live" : "delayed",
  };
}

async function fetchYahooChartQuote(instrument: QuoteRequest): Promise<MarketQuote | null> {
  const providerSymbol = marketDataSymbol(instrument.symbol, instrument.exchange);
  const response = await fetchJson<{
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          regularMarketPreviousClose?: number;
          previousClose?: number;
          chartPreviousClose?: number;
          currency?: string;
          regularMarketTime?: number;
          marketState?: string;
        };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  }>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=1d&range=5d`, {
    headers: { "User-Agent": "Aurelian-Labs/1.0" },
    next: { revalidate: 300 },
  });
  const result = response?.chart?.result?.[0];
  const meta = result?.meta;
  const price = finiteNumber(meta?.regularMarketPrice);
  const closes = (result?.indicators?.quote?.[0]?.close ?? []).flatMap((value) => {
    const parsed = finiteNumber(value);
    return parsed === null ? [] : [parsed];
  });
  const previousClose = finiteNumber(meta?.regularMarketPreviousClose) ?? (closes.length > 1 ? closes.at(-2)! : null);
  if (price === null) return null;
  return {
    id: instrument.id,
    symbol: instrument.symbol,
    name: instrument.name,
    price,
    previousClose,
    change: previousClose === null ? null : price - previousClose,
    percentChange: previousClose ? ((price - previousClose) / previousClose) * 100 : null,
    currency: meta?.currency ?? instrument.currency ?? "",
    asOf: meta?.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    marketState: meta?.marketState ?? null,
    source: "Yahoo Finance",
    status: "delayed",
  };
}

export async function fetchLatestQuote(
  instrument: QuoteRequest,
  options?: { twelveDataBudget?: CallBudget },
) {
  const twelveData = options?.twelveDataBudget === undefined || options.twelveDataBudget.take()
    ? await fetchTwelveDataQuote(instrument)
    : null;
  return twelveData ?? await fetchYahooChartQuote(instrument);
}

async function fetchNorgesBankText(path: string, fresh: boolean) {
  const response = await fetch(`https://data.norges-bank.no/api/data/${path}`, {
    signal: AbortSignal.timeout(8_000),
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 21_600 } }),
  }).catch(() => null);
  if (!response?.ok) return null;
  return await response.text().catch(() => null);
}

/** Official NOK rates, published by Norges Bank without a key. */
export async function fetchNorgesBankFxToNok(options?: { fresh?: boolean }) {
  const csv = await fetchNorgesBankText(
    "EXR/B.USD+EUR+SEK+DKK+GBP+CHF.NOK.SP?lastNObservations=1&format=csv&locale=en",
    options?.fresh ?? false,
  );
  return csv ? parseNorgesBankRates(csv) : null;
}

export async function fetchNorgesBankPolicyRate() {
  const csv = await fetchNorgesBankText("IR/B.KPRA.SD.?lastNObservations=1&format=csv&locale=en", false);
  return csv ? parseNorgesBankPolicyRate(csv) : null;
}

export async function fetchEcbFxToNok() {
  const response = await fetch(
    "https://data-api.ecb.europa.eu/service/data/EXR/D.NOK+USD.EUR.SP00.A?lastNObservations=1&format=csvdata",
    { signal: AbortSignal.timeout(8_000), cache: "no-store" },
  ).catch(() => null);
  if (!response?.ok) return null;
  const rows = (await response.text()).trim().split("\n");
  const header = rows[0]?.split(",");
  const currencyIndex = header?.indexOf("CURRENCY");
  const valueIndex = header?.indexOf("OBS_VALUE");
  const dateIndex = header?.indexOf("TIME_PERIOD");
  if (currencyIndex === undefined || valueIndex === undefined || currencyIndex < 0 || valueIndex < 0) return null;

  const values = new Map<string, { value: number; date: string }>();
  for (const row of rows.slice(1)) {
    const cells = row.split(",");
    values.set(cells[currencyIndex], {
      value: Number(cells[valueIndex]),
      date: cells[dateIndex] ?? new Date().toISOString().slice(0, 10),
    });
  }
  const nokPerEur = values.get("NOK");
  const usdPerEur = values.get("USD");
  if (!nokPerEur || !usdPerEur) return null;
  return {
    rates: {
      NOK: 1,
      EUR: nokPerEur.value,
      USD: nokPerEur.value / usdPerEur.value,
    },
    asOf: nokPerEur.date,
    source: "ECB Data Portal",
  };
}
