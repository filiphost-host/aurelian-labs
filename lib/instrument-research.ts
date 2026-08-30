import type { AssetType, FactorExposures } from "@/lib/types";

const defensiveSectors = new Set(["Consumer Staples", "Health Care", "Utilities", "Government Bond"]);
const cyclicalSectors = new Set(["Consumer Discretionary", "Energy", "Financials", "Industrials", "Materials", "Real Estate"]);

export function annualizedSharpeFromCloses(
  closes: number[],
  annualRiskFreeRate = 0.035,
  periodsPerYear = 52,
) {
  const clean = closes.filter((value) => Number.isFinite(value) && value > 0);
  if (clean.length < 9) return null;
  const returns = clean.slice(1).map((value, index) => value / clean[index] - 1);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(returns.length - 1, 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(periodsPerYear);
  if (!Number.isFinite(volatility) || volatility === 0) return null;
  const annualizedReturn = mean * periodsPerYear;
  return (annualizedReturn - annualRiskFreeRate) / volatility;
}

export function recessionRiskScore({
  assetType,
  sector,
  beta,
  operatingMargin,
  creditQuality,
}: {
  assetType: Exclude<AssetType, "cash">;
  sector: string;
  beta?: number | null;
  operatingMargin?: number | null;
  creditQuality?: string | null;
}) {
  if (assetType === "bond") {
    const quality = creditQuality?.toUpperCase() ?? "";
    if (quality.includes("GOVERNMENT") || quality.startsWith("AAA") || quality.startsWith("AA")) return 18;
    if (quality.includes("INVESTMENT") || quality.startsWith("A") || quality.startsWith("BBB")) return 34;
    return 66;
  }

  let score = assetType === "etf" ? 45 : 48;
  if (defensiveSectors.has(sector)) score -= 15;
  if (cyclicalSectors.has(sector)) score += 13;
  if (sector === "Technology" || sector === "Communication Services") score += 5;
  if (beta != null && Number.isFinite(beta)) score += Math.max(-12, Math.min(18, (beta - 1) * 20));
  if (operatingMargin != null && Number.isFinite(operatingMargin)) {
    if (operatingMargin >= 0.25) score -= 8;
    else if (operatingMargin <= 0.08) score += 10;
  }
  return Math.round(Math.max(1, Math.min(100, score)));
}

export function inferFactorExposures({
  assetType,
  country,
  sector,
  currency,
}: {
  assetType: Exclude<AssetType, "cash">;
  country: string;
  sector: string;
  currency: string;
}): FactorExposures {
  const exposures: FactorExposures = {};
  if (assetType === "bond") exposures.credit = 0.75;
  else exposures.globalEquity = assetType === "etf" ? 0.8 : 0.4;

  if (country === "United States") exposures.usEquity = assetType === "etf" ? 0.9 : 0.8;
  else if (["Norway", "Sweden", "Denmark", "Finland", "Germany", "France", "Netherlands", "United Kingdom", "Ireland", "Switzerland", "Italy", "Spain"].includes(country)) exposures.europeEquity = assetType === "etf" ? 0.8 : 0.65;
  if (sector === "Technology") exposures.technology = 1;
  if (["Industrials", "Defense"].includes(sector)) exposures.industrials = 0.5;
  if (sector === "Defense") exposures.defense = 1;
  if (currency === "USD") exposures.usdNok = 1;
  if (currency === "EUR") exposures.nokEur = 1;
  return exposures;
}

