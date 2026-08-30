import type { FactorKey, Scenario } from "@/lib/types";

export type ModelPortfolio = {
  id: string;
  name: string;
  mandate: string;
  baselineReturn: number;
  volatility: number;
  sharpe: number;
  pe: number;
  peg: number;
  priceToBook: number;
  netDebtToEbitda: number;
  exposures: Partial<Record<FactorKey, number>>;
};

export type ScenarioPortfolioResult = ModelPortfolio & {
  shockReturn: number;
  postShockReturn: number;
  postShockVolatility: number;
  postShockSharpe: number;
};

export const modelPortfolios: ModelPortfolio[] = [
  {
    id: "aurelian-growth",
    name: "Aurelian Growth",
    mandate: "S&P 500 core with Microsoft, Nvidia, Alphabet, and a measured defense sleeve.",
    baselineReturn: 12.4,
    volatility: 19.2,
    sharpe: 0.55,
    pe: 28.6,
    peg: 1.78,
    priceToBook: 7.9,
    netDebtToEbitda: 0.4,
    exposures: { globalEquity: 0.15, usEquity: 0.62, technology: 0.48, defense: 0.08, usdNok: 0.82 },
  },
  {
    id: "sp500-core",
    name: "S&P 500 Core",
    mandate: "Capital-weighted US large caps used as the neutral benchmark portfolio.",
    baselineReturn: 10.2,
    volatility: 16.1,
    sharpe: 0.49,
    pe: 24.1,
    peg: 1.92,
    priceToBook: 5.1,
    netDebtToEbitda: 1.2,
    exposures: { globalEquity: 0.15, usEquity: 0.75, technology: 0.28, industrials: 0.09, defense: 0.03, usdNok: 0.9 },
  },
  {
    id: "quality-compounders",
    name: "Quality Compounders",
    mandate: "High returns on capital, durable free cash flow, and conservative balance sheets.",
    baselineReturn: 10.8,
    volatility: 14.4,
    sharpe: 0.61,
    pe: 25.8,
    peg: 1.68,
    priceToBook: 6.2,
    netDebtToEbitda: 0.3,
    exposures: { globalEquity: 0.25, usEquity: 0.48, europeEquity: 0.12, technology: 0.23, usdNok: 0.62, nokEur: 0.12 },
  },
  {
    id: "balanced-60-40",
    name: "Balanced 60/40",
    mandate: "Global equities paired with investment-grade duration and cash reserves.",
    baselineReturn: 7.1,
    volatility: 10.2,
    sharpe: 0.50,
    pe: 18.5,
    peg: 1.74,
    priceToBook: 3.1,
    netDebtToEbitda: 0.8,
    exposures: { globalEquity: 0.42, usEquity: 0.12, europeEquity: 0.08, rates: -0.035, credit: -0.012, cash: 0.08, usdNok: 0.38, nokEur: 0.12 },
  },
  {
    id: "real-assets-defense",
    name: "Real Assets & Defense",
    mandate: "Energy, infrastructure, materials, and defense companies with pricing power.",
    baselineReturn: 9.4,
    volatility: 15.8,
    sharpe: 0.47,
    pe: 16.2,
    peg: 1.24,
    priceToBook: 2.8,
    netDebtToEbitda: 1.1,
    exposures: { globalEquity: 0.32, usEquity: 0.12, europeEquity: 0.16, industrials: 0.3, defense: 0.38, usdNok: 0.38, nokEur: 0.28 },
  },
  {
    id: "defensive-income",
    name: "Defensive Income",
    mandate: "Health care, staples, utilities, and short-duration fixed income.",
    baselineReturn: 7.6,
    volatility: 11.3,
    sharpe: 0.49,
    pe: 18.9,
    peg: 1.81,
    priceToBook: 3.4,
    netDebtToEbitda: 1.5,
    exposures: { globalEquity: 0.3, usEquity: 0.2, europeEquity: 0.12, technology: 0.04, rates: -0.015, credit: -0.006, cash: 0.1, usdNok: 0.36, nokEur: 0.18 },
  },
];

const percentFactors: FactorKey[] = [
  "globalEquity",
  "usEquity",
  "europeEquity",
  "technology",
  "industrials",
  "defense",
  "usdNok",
  "nokEur",
  "cash",
];

export function evaluateModelPortfolio(portfolio: ModelPortfolio, scenario: Scenario): ScenarioPortfolioResult {
  const percentImpact = percentFactors.reduce(
    (sum, factor) => sum + (scenario[factor] ?? 0) * (portfolio.exposures[factor] ?? 0),
    0,
  );
  const basisPointImpact = (scenario.rates ?? 0) * (portfolio.exposures.rates ?? 0)
    + (scenario.credit ?? 0) * (portfolio.exposures.credit ?? 0);
  const shockReturn = percentImpact + basisPointImpact;
  const stressIntensity = Math.min(1.2, Math.abs(shockReturn) / 24);
  const postShockVolatility = portfolio.volatility * (1 + stressIntensity * 0.32);
  const postShockReturn = portfolio.baselineReturn + shockReturn;

  return {
    ...portfolio,
    shockReturn,
    postShockReturn,
    postShockVolatility,
    postShockSharpe: (postShockReturn - 3.5) / Math.max(postShockVolatility, 0.1),
  };
}

export function rankModelPortfolios(scenario: Scenario) {
  return modelPortfolios
    .map((portfolio) => evaluateModelPortfolio(portfolio, scenario))
    .sort((a, b) => b.postShockSharpe - a.postShockSharpe);
}
