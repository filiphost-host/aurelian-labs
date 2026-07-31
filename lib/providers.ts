import "server-only";

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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 86_400 },
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

export async function fetchDailyClose(symbol: string) {
  if (!process.env.TWELVE_DATA_API_KEY) return null;
  const response = await fetchJson<{ close?: string; datetime?: string; status?: string }>(
    `https://api.twelvedata.com/eod?symbol=${encodeURIComponent(symbol)}`,
    { headers: { Authorization: `apikey ${process.env.TWELVE_DATA_API_KEY}` } },
  );
  if (!response?.close) return null;
  return {
    close: Number(response.close),
    asOf: response.datetime ?? new Date().toISOString().slice(0, 10),
    source: "Twelve Data",
    status: "delayed" as const,
  };
}

export async function fetchEcbFxToNok() {
  const response = await fetch(
    "https://data-api.ecb.europa.eu/service/data/EXR/D.NOK+USD.EUR.SP00.A?lastNObservations=1&format=csvdata",
    { signal: AbortSignal.timeout(8_000), next: { revalidate: 86_400 } },
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
