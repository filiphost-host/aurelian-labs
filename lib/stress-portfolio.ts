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
};

export type StressAllocation = { instrumentId: string; weight: number };

export const stressInstrumentLibrary: StressInstrument[] = [
  { id: "lab-msft", ticker: "MSFT", name: "Microsoft", assetType: "stock", country: "United States", sector: "Technology", currency: "USD", exposures: { globalEquity: 0.45, usEquity: 0.8, technology: 1, usdNok: 1 } },
  { id: "lab-nvda", ticker: "NVDA", name: "Nvidia", assetType: "stock", country: "United States", sector: "Technology", currency: "USD", exposures: { globalEquity: 0.55, usEquity: 0.9, technology: 1.25, usdNok: 1 } },
  { id: "lab-googl", ticker: "GOOGL", name: "Alphabet", assetType: "stock", country: "United States", sector: "Communication Services", currency: "USD", exposures: { globalEquity: 0.45, usEquity: 0.8, technology: 0.6, usdNok: 1 } },
  { id: "lab-lmt", ticker: "LMT", name: "Lockheed Martin", assetType: "stock", country: "United States", sector: "Defense", currency: "USD", exposures: { globalEquity: 0.25, usEquity: 0.55, industrials: 0.35, defense: 1, usdNok: 1 } },
  { id: "lab-saab", ticker: "SAAB-B", name: "Saab AB", assetType: "stock", country: "Sweden", sector: "Defense", currency: "SEK", exposures: { globalEquity: 0.25, europeEquity: 0.65, industrials: 0.45, defense: 1.15 } },
  { id: "lab-novo", ticker: "NOVO-B", name: "Novo Nordisk", assetType: "stock", country: "Denmark", sector: "Health Care", currency: "DKK", exposures: { globalEquity: 0.38, europeEquity: 0.7, technology: 0.05 } },
  { id: "lab-sxr8", ticker: "SXR8", name: "iShares Core S&P 500 UCITS ETF", assetType: "etf", country: "Ireland", sector: "Diversified", currency: "EUR", exposures: { globalEquity: 0.75, usEquity: 1, europeEquity: 0.1, technology: 0.35, nokEur: 1 } },
  { id: "lab-eunl", ticker: "EUNL", name: "iShares Core MSCI World UCITS ETF", assetType: "etf", country: "Ireland", sector: "Diversified", currency: "EUR", exposures: { globalEquity: 1, usEquity: 0.65, europeEquity: 0.2, technology: 0.24, nokEur: 1 } },
  { id: "lab-meud", ticker: "MEUD", name: "Amundi STOXX Europe 600 UCITS ETF", assetType: "etf", country: "France", sector: "Diversified", currency: "EUR", exposures: { globalEquity: 0.35, europeEquity: 1, industrials: 0.18, nokEur: 1 } },
  { id: "lab-treasury", ticker: "UST 7-10Y", name: "US Treasury 7-10 year", assetType: "bond", country: "United States", sector: "Government Bond", currency: "USD", exposures: { usdNok: 1, credit: 0 }, duration: 7.4, creditQuality: "AA+" },
  { id: "lab-corporate", ticker: "LQD", name: "US Investment Grade Corporate Bond ETF", assetType: "bond", country: "United States", sector: "Corporate Bond", currency: "USD", exposures: { usdNok: 1, credit: 1 }, duration: 8.1, creditQuality: "Investment grade" },
  { id: "lab-nordic-bond", ticker: "NORDIC IG", name: "Nordic Investment Grade Bond", assetType: "bond", country: "Norway", sector: "Corporate Bond", currency: "NOK", exposures: { credit: 0.75 }, duration: 3.2, creditQuality: "Investment grade" },
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

