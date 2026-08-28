import type { AssetType, FactorExposures, Holding } from "@/lib/types";

export type StressInstrument = {
  id: string;
  ticker: string;
  name: string;
  assetType: Exclude<AssetType, "cash">;
  country: string;
  sector: string;
  currency: string;
  exposures: FactorExposures;
  duration?: number;
  creditQuality?: string;
  exchange?: string;
  forwardPe?: number | null;
  sharpe?: number | null;
  recessionRisk?: number;
  metricSource?: string;
  metricsAsOf?: string | null;
};

export type StressAllocation = { instrumentId: string; weight: number };

const coreStressInstrumentLibrary: StressInstrument[] = [
  { id: "lab-msft", ticker: "MSFT", name: "Microsoft", assetType: "stock", country: "United States", sector: "Technology", currency: "USD", exchange: "NASDAQ", forwardPe: 29, sharpe: 0.92, recessionRisk: 38, metricSource: "Indicative Aurelian screen", metricsAsOf: "2026-08-28", exposures: { globalEquity: 0.45, usEquity: 0.8, technology: 1, usdNok: 1 } },
  { id: "lab-nvda", ticker: "NVDA", name: "Nvidia", assetType: "stock", country: "United States", sector: "Technology", currency: "USD", exchange: "NASDAQ", forwardPe: 34, sharpe: 1.28, recessionRisk: 63, metricSource: "Indicative Aurelian screen", metricsAsOf: "2026-08-28", exposures: { globalEquity: 0.55, usEquity: 0.9, technology: 1.25, usdNok: 1 } },
  { id: "lab-googl", ticker: "GOOGL", name: "Alphabet", assetType: "stock", country: "United States", sector: "Communication Services", currency: "USD", exchange: "NASDAQ", forwardPe: 22, sharpe: 0.88, recessionRisk: 42, metricSource: "Indicative Aurelian screen", metricsAsOf: "2026-08-28", exposures: { globalEquity: 0.45, usEquity: 0.8, technology: 0.6, usdNok: 1 } },
  { id: "lab-lmt", ticker: "LMT", name: "Lockheed Martin", assetType: "stock", country: "United States", sector: "Defense", currency: "USD", exchange: "NYSE", forwardPe: 18, sharpe: 0.49, recessionRisk: 29, metricSource: "Indicative Aurelian screen", metricsAsOf: "2026-08-28", exposures: { globalEquity: 0.25, usEquity: 0.55, industrials: 0.35, defense: 1, usdNok: 1 } },
  { id: "lab-saab", ticker: "SAAB-B", name: "Saab AB", assetType: "stock", country: "Sweden", sector: "Defense", currency: "SEK", exchange: "STOCKHOLM", forwardPe: 31, sharpe: 1.37, recessionRisk: 34, metricSource: "Indicative Aurelian screen", metricsAsOf: "2026-08-28", exposures: { globalEquity: 0.25, europeEquity: 0.65, industrials: 0.45, defense: 1.15 } },
  { id: "lab-novo", ticker: "NOVO-B", name: "Novo Nordisk", assetType: "stock", country: "Denmark", sector: "Health Care", currency: "DKK", exchange: "COPENHAGEN", forwardPe: 21, sharpe: 0.36, recessionRisk: 27, metricSource: "Indicative Aurelian screen", metricsAsOf: "2026-08-28", exposures: { globalEquity: 0.38, europeEquity: 0.7, technology: 0.05 } },
  { id: "lab-sxr8", ticker: "SXR8", name: "iShares Core S&P 500 UCITS ETF", assetType: "etf", country: "Ireland", sector: "Diversified", currency: "EUR", exchange: "XETRA", forwardPe: 22, sharpe: 0.84, recessionRisk: 45, metricSource: "Indicative Aurelian screen", metricsAsOf: "2026-08-28", exposures: { globalEquity: 0.75, usEquity: 1, europeEquity: 0.1, technology: 0.35, nokEur: 1 } },
  { id: "lab-eunl", ticker: "EUNL", name: "iShares Core MSCI World UCITS ETF", assetType: "etf", country: "Ireland", sector: "Diversified", currency: "EUR", exchange: "XETRA", forwardPe: 20, sharpe: 0.78, recessionRisk: 46, metricSource: "Indicative Aurelian screen", metricsAsOf: "2026-08-28", exposures: { globalEquity: 1, usEquity: 0.65, europeEquity: 0.2, technology: 0.24, nokEur: 1 } },
  { id: "lab-meud", ticker: "MEUD", name: "Amundi STOXX Europe 600 UCITS ETF", assetType: "etf", country: "France", sector: "Diversified", currency: "EUR", exchange: "PARIS", forwardPe: 16, sharpe: 0.61, recessionRisk: 49, metricSource: "Indicative Aurelian screen", metricsAsOf: "2026-08-28", exposures: { globalEquity: 0.35, europeEquity: 1, industrials: 0.18, nokEur: 1 } },
  { id: "lab-treasury", ticker: "UST 7-10Y", name: "US Treasury 7-10 year", assetType: "bond", country: "United States", sector: "Government Bond", currency: "USD", recessionRisk: 18, metricSource: "Aurelian bond model", metricsAsOf: "2026-08-28", exposures: { usdNok: 1, credit: 0 }, duration: 7.4, creditQuality: "AA+" },
  { id: "lab-corporate", ticker: "LQD", name: "US Investment Grade Corporate Bond ETF", assetType: "bond", country: "United States", sector: "Corporate Bond", currency: "USD", recessionRisk: 34, metricSource: "Aurelian bond model", metricsAsOf: "2026-08-28", exposures: { usdNok: 1, credit: 1 }, duration: 8.1, creditQuality: "Investment grade" },
  { id: "lab-nordic-bond", ticker: "NORDIC IG", name: "Nordic Investment Grade Bond", assetType: "bond", country: "Norway", sector: "Corporate Bond", currency: "NOK", recessionRisk: 34, metricSource: "Aurelian bond model", metricsAsOf: "2026-08-28", exposures: { credit: 0.75 }, duration: 3.2, creditQuality: "Investment grade" },
];

type ScreenedInstrument = Omit<StressInstrument, "id" | "exposures" | "metricSource" | "metricsAsOf"> & {
  region: "US" | "Europe";
  recessionRisk: number;
};

const screenedUniverse: ScreenedInstrument[] = [
  { ticker: "AAPL", name: "Apple", assetType: "stock", country: "United States", sector: "Technology", currency: "USD", exchange: "NASDAQ", region: "US", forwardPe: 29, sharpe: 0.74, recessionRisk: 43 },
  { ticker: "AMZN", name: "Amazon", assetType: "stock", country: "United States", sector: "Consumer Discretionary", currency: "USD", exchange: "NASDAQ", region: "US", forwardPe: 31, sharpe: 0.83, recessionRisk: 61 },
  { ticker: "META", name: "Meta Platforms", assetType: "stock", country: "United States", sector: "Communication Services", currency: "USD", exchange: "NASDAQ", region: "US", forwardPe: 24, sharpe: 1.04, recessionRisk: 48 },
  { ticker: "AVGO", name: "Broadcom", assetType: "stock", country: "United States", sector: "Technology", currency: "USD", exchange: "NASDAQ", region: "US", forwardPe: 31, sharpe: 1.32, recessionRisk: 54 },
  { ticker: "TSLA", name: "Tesla", assetType: "stock", country: "United States", sector: "Consumer Discretionary", currency: "USD", exchange: "NASDAQ", region: "US", forwardPe: 78, sharpe: 0.38, recessionRisk: 78 },
  { ticker: "BRK-B", name: "Berkshire Hathaway", assetType: "stock", country: "United States", sector: "Financials", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 23, sharpe: 0.92, recessionRisk: 38 },
  { ticker: "JPM", name: "JPMorgan Chase", assetType: "stock", country: "United States", sector: "Financials", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 14, sharpe: 1.07, recessionRisk: 57 },
  { ticker: "V", name: "Visa", assetType: "stock", country: "United States", sector: "Financials", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 27, sharpe: 0.91, recessionRisk: 42 },
  { ticker: "LLY", name: "Eli Lilly", assetType: "stock", country: "United States", sector: "Health Care", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 38, sharpe: 1.18, recessionRisk: 28 },
  { ticker: "JNJ", name: "Johnson & Johnson", assetType: "stock", country: "United States", sector: "Health Care", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 16, sharpe: 0.42, recessionRisk: 22 },
  { ticker: "XOM", name: "Exxon Mobil", assetType: "stock", country: "United States", sector: "Energy", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 15, sharpe: 0.63, recessionRisk: 64 },
  { ticker: "CVX", name: "Chevron", assetType: "stock", country: "United States", sector: "Energy", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 16, sharpe: 0.56, recessionRisk: 62 },
  { ticker: "CAT", name: "Caterpillar", assetType: "stock", country: "United States", sector: "Industrials", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 21, sharpe: 0.86, recessionRisk: 69 },
  { ticker: "RTX", name: "RTX", assetType: "stock", country: "United States", sector: "Defense", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 22, sharpe: 0.88, recessionRisk: 36 },
  { ticker: "NOC", name: "Northrop Grumman", assetType: "stock", country: "United States", sector: "Defense", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 20, sharpe: 0.57, recessionRisk: 31 },
  { ticker: "WMT", name: "Walmart", assetType: "stock", country: "United States", sector: "Consumer Staples", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 31, sharpe: 0.94, recessionRisk: 24 },
  { ticker: "COST", name: "Costco", assetType: "stock", country: "United States", sector: "Consumer Staples", currency: "USD", exchange: "NASDAQ", region: "US", forwardPe: 48, sharpe: 1.01, recessionRisk: 26 },
  { ticker: "KO", name: "Coca-Cola", assetType: "stock", country: "United States", sector: "Consumer Staples", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 23, sharpe: 0.48, recessionRisk: 21 },
  { ticker: "UNH", name: "UnitedHealth Group", assetType: "stock", country: "United States", sector: "Health Care", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 15, sharpe: 0.31, recessionRisk: 30 },
  { ticker: "ORCL", name: "Oracle", assetType: "stock", country: "United States", sector: "Technology", currency: "USD", exchange: "NYSE", region: "US", forwardPe: 27, sharpe: 1.12, recessionRisk: 43 },
  { ticker: "AMD", name: "Advanced Micro Devices", assetType: "stock", country: "United States", sector: "Technology", currency: "USD", exchange: "NASDAQ", region: "US", forwardPe: 34, sharpe: 0.62, recessionRisk: 63 },
  { ticker: "PLTR", name: "Palantir Technologies", assetType: "stock", country: "United States", sector: "Technology", currency: "USD", exchange: "NASDAQ", region: "US", forwardPe: 69, sharpe: 1.55, recessionRisk: 59 },
  { ticker: "EQNR", name: "Equinor", assetType: "stock", country: "Norway", sector: "Energy", currency: "NOK", exchange: "OSLO", region: "Europe", forwardPe: 11, sharpe: 0.34, recessionRisk: 61 },
  { ticker: "DNB", name: "DNB Bank", assetType: "stock", country: "Norway", sector: "Financials", currency: "NOK", exchange: "OSLO", region: "Europe", forwardPe: 10, sharpe: 0.81, recessionRisk: 53 },
  { ticker: "NHY", name: "Norsk Hydro", assetType: "stock", country: "Norway", sector: "Materials", currency: "NOK", exchange: "OSLO", region: "Europe", forwardPe: 13, sharpe: 0.46, recessionRisk: 72 },
  { ticker: "KOG", name: "Kongsberg Gruppen", assetType: "stock", country: "Norway", sector: "Defense", currency: "NOK", exchange: "OSLO", region: "Europe", forwardPe: 34, sharpe: 1.41, recessionRisk: 35 },
  { ticker: "MOWI", name: "Mowi", assetType: "stock", country: "Norway", sector: "Consumer Staples", currency: "NOK", exchange: "OSLO", region: "Europe", forwardPe: 15, sharpe: 0.52, recessionRisk: 34 },
  { ticker: "VOLV-B", name: "Volvo", assetType: "stock", country: "Sweden", sector: "Industrials", currency: "SEK", exchange: "STOCKHOLM", region: "Europe", forwardPe: 12, sharpe: 0.68, recessionRisk: 72 },
  { ticker: "ATCO-A", name: "Atlas Copco", assetType: "stock", country: "Sweden", sector: "Industrials", currency: "SEK", exchange: "STOCKHOLM", region: "Europe", forwardPe: 27, sharpe: 0.72, recessionRisk: 62 },
  { ticker: "INVE-B", name: "Investor AB", assetType: "stock", country: "Sweden", sector: "Financials", currency: "SEK", exchange: "STOCKHOLM", region: "Europe", forwardPe: 18, sharpe: 0.89, recessionRisk: 46 },
  { ticker: "ERIC-B", name: "Ericsson", assetType: "stock", country: "Sweden", sector: "Technology", currency: "SEK", exchange: "STOCKHOLM", region: "Europe", forwardPe: 16, sharpe: 0.44, recessionRisk: 61 },
  { ticker: "DSV", name: "DSV", assetType: "stock", country: "Denmark", sector: "Industrials", currency: "DKK", exchange: "COPENHAGEN", region: "Europe", forwardPe: 24, sharpe: 0.77, recessionRisk: 65 },
  { ticker: "MAERSK-B", name: "A.P. Moller - Maersk", assetType: "stock", country: "Denmark", sector: "Industrials", currency: "DKK", exchange: "COPENHAGEN", region: "Europe", forwardPe: 10, sharpe: 0.21, recessionRisk: 79 },
  { ticker: "VWS", name: "Vestas Wind Systems", assetType: "stock", country: "Denmark", sector: "Industrials", currency: "DKK", exchange: "COPENHAGEN", region: "Europe", forwardPe: 25, sharpe: 0.11, recessionRisk: 70 },
  { ticker: "ASML", name: "ASML Holding", assetType: "stock", country: "Netherlands", sector: "Technology", currency: "EUR", exchange: "AMSTERDAM", region: "Europe", forwardPe: 30, sharpe: 0.69, recessionRisk: 58 },
  { ticker: "SAP", name: "SAP", assetType: "stock", country: "Germany", sector: "Technology", currency: "EUR", exchange: "XETRA", region: "Europe", forwardPe: 31, sharpe: 1.16, recessionRisk: 40 },
  { ticker: "SIE", name: "Siemens", assetType: "stock", country: "Germany", sector: "Industrials", currency: "EUR", exchange: "XETRA", region: "Europe", forwardPe: 19, sharpe: 0.83, recessionRisk: 63 },
  { ticker: "AIR", name: "Airbus", assetType: "stock", country: "France", sector: "Industrials", currency: "EUR", exchange: "PARIS", region: "Europe", forwardPe: 23, sharpe: 0.74, recessionRisk: 58 },
  { ticker: "MC", name: "LVMH", assetType: "stock", country: "France", sector: "Consumer Discretionary", currency: "EUR", exchange: "PARIS", region: "Europe", forwardPe: 22, sharpe: 0.39, recessionRisk: 71 },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", assetType: "etf", country: "United States", sector: "Diversified", currency: "USD", exchange: "NYSE ARCA", region: "US", forwardPe: 22, sharpe: 0.84, recessionRisk: 45 },
  { ticker: "QQQ", name: "Invesco QQQ Trust", assetType: "etf", country: "United States", sector: "Technology", currency: "USD", exchange: "NASDAQ", region: "US", forwardPe: 28, sharpe: 0.96, recessionRisk: 54 },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", assetType: "etf", country: "United States", sector: "Diversified", currency: "USD", exchange: "NYSE ARCA", region: "US", forwardPe: 19, sharpe: 0.35, recessionRisk: 68 },
  { ticker: "VGK", name: "Vanguard FTSE Europe ETF", assetType: "etf", country: "United States", sector: "Diversified", currency: "USD", exchange: "NYSE ARCA", region: "Europe", forwardPe: 15, sharpe: 0.59, recessionRisk: 51 },
  { ticker: "XACT-OMXS30", name: "XACT OMXS30", assetType: "etf", country: "Sweden", sector: "Diversified", currency: "SEK", exchange: "STOCKHOLM", region: "Europe", forwardPe: 17, sharpe: 0.62, recessionRisk: 50 },
  { ticker: "EXSA", name: "iShares STOXX Europe 600 UCITS ETF", assetType: "etf", country: "Germany", sector: "Diversified", currency: "EUR", exchange: "XETRA", region: "Europe", forwardPe: 16, sharpe: 0.64, recessionRisk: 49 },
];

function screenedInstrument(instrument: ScreenedInstrument): StressInstrument {
  const { region, ...values } = instrument;
  const exposures: FactorExposures = instrument.assetType === "bond"
    ? { credit: 0.75 }
    : {
        globalEquity: instrument.assetType === "etf" ? 0.8 : 0.4,
        ...(region === "US" ? { usEquity: instrument.assetType === "etf" ? 0.9 : 0.8 } : { europeEquity: instrument.assetType === "etf" ? 0.85 : 0.65 }),
        ...(instrument.sector === "Technology" ? { technology: 1 } : {}),
        ...(["Industrials", "Defense"].includes(instrument.sector) ? { industrials: 0.5 } : {}),
        ...(instrument.sector === "Defense" ? { defense: 1 } : {}),
        ...(instrument.currency === "USD" ? { usdNok: 1 } : {}),
        ...(instrument.currency === "EUR" ? { nokEur: 1 } : {}),
      };
  return {
    ...values,
    id: `screen-${instrument.ticker.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    exposures,
    metricSource: "Indicative Aurelian screen",
    metricsAsOf: "2026-08-28",
  };
}

export const stressInstrumentLibrary: StressInstrument[] = [
  ...coreStressInstrumentLibrary,
  ...screenedUniverse.map(screenedInstrument),
];

export function normalizedAllocations(allocations: StressAllocation[]) {
  const cleaned = allocations.map((allocation) => ({
    ...allocation,
    weight: Math.max(0, Number.isFinite(allocation.weight) ? allocation.weight : 0),
  }));
  const total = cleaned.reduce((sum, allocation) => sum + allocation.weight, 0);
  if (!total) return cleaned.map((allocation) => ({ ...allocation, weight: 0 }));
  return cleaned.map((allocation) => ({ ...allocation, weight: allocation.weight / total * 100 }));
}

export function buildStressHoldings(
  instruments: StressInstrument[],
  allocations: StressAllocation[],
  capitalNok: number,
): Holding[] {
  const byId = new Map(instruments.map((instrument) => [instrument.id, instrument]));
  return normalizedAllocations(allocations).flatMap((allocation) => {
    const instrument = byId.get(allocation.instrumentId);
    if (!instrument || allocation.weight <= 0) return [];
    return [{
      id: `stress-${instrument.id}`,
      asset_type: instrument.assetType,
      ticker: instrument.ticker,
      name: instrument.name,
      quantity: 1,
      average_cost: 0,
      market_price: null,
      currency: instrument.currency,
      country: instrument.country,
      sector: instrument.sector,
      region: null,
      account_note: "Temporary Scenario Lab position",
      manual_value_nok: capitalNok * allocation.weight / 100,
      factor_exposures: instrument.exposures,
      issuer: instrument.assetType === "bond" ? instrument.name : null,
      coupon_rate: null,
      maturity_date: null,
      face_value: instrument.assetType === "bond" ? capitalNok * allocation.weight / 100 : null,
      yield_estimate: null,
      duration_estimate: instrument.duration ?? null,
      credit_quality: instrument.creditQuality ?? null,
      seniority: null,
      price_provenance: { source: "Scenario Lab allocation", as_of: null, status: "estimated" as const, note: "Normalized test value; not a market quote." },
    }];
  });
}
