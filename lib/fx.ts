import { fallbackFxToNok } from "@/lib/calculations";

export type FxRateRow = {
  base_currency: string;
  quote_currency: string;
  rate: number | string;
  as_of: string;
  source?: string | null;
};

export type FxRates = {
  rates: Record<string, number>;
  asOf: string | null;
  source: string;
};

export const fallbackFxRates: FxRates = {
  rates: fallbackFxToNok,
  asOf: null,
  source: "Built-in estimate",
};

export function latestFxRatesFromRows(rows: FxRateRow[]): FxRates {
  const latest = new Map<string, { rate: number; asOf: string; source: string }>();

  for (const row of rows) {
    if ((row.quote_currency ?? "").toUpperCase() !== "NOK") continue;
    const currency = (row.base_currency ?? "").toUpperCase();
    const rate = Number(row.rate);
    if (!currency || !Number.isFinite(rate) || rate <= 0) continue;
    const current = latest.get(currency);
    if (!current || row.as_of.localeCompare(current.asOf) > 0) {
      latest.set(currency, { rate, asOf: row.as_of, source: row.source ?? "Stored FX" });
    }
  }

  if (latest.size === 0) return fallbackFxRates;

  const rates: Record<string, number> = { ...fallbackFxToNok };
  let asOf: string | null = null;
  let source = "Stored FX";
  for (const [currency, entry] of latest) {
    rates[currency] = entry.rate;
    if (asOf === null || entry.asOf.localeCompare(asOf) > 0) {
      asOf = entry.asOf;
      source = entry.source;
    }
  }
  rates.NOK = 1;

  return { rates, asOf, source };
}
