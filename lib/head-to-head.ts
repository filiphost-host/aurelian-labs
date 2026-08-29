export type HeadToHeadIndustry = "oil-gas" | "technology" | "defense" | "financials" | "health-care";

export type IndustryMarket = {
  industry: HeadToHeadIndustry;
  countryId: string;
  country: string;
  benchmark: string;
  pe: number;
  earningsGrowth: number;
  fcfYield: number;
  netDebtToEbitda: number;
  roe: number;
  sharpe: number;
  policyRisk: number;
  currencyRisk: number;
  liquidity: number;
  note: string;
};

export type IndustryScore = {
  overall: number;
  valuation: number;
  growth: number;
  quality: number;
  balanceSheet: number;
  riskAdjusted: number;
  investability: number;
};

export type IndustryDerivedMetrics = {
  peg: number | null;
  priceToBook: number;
  operatingMargin: number;
  balanceSheetStrength: number;
  earningsConsistency: number;
  historicalGrowth: number;
  expectedRevenueGrowth: number;
  volatility: number;
  maxDrawdown: number;
};

export type ComparisonVerdict = {
  label: string;
  leader: string;
  note: string;
  tone: "positive" | "risk" | "neutral";
};

export const industryMetricProvenance = {
  source: "Aurelian comparative framework",
  asOf: "2026-08-29",
  freshness: "Indicative model",
  confidence: "Medium-low",
};

export const industryLabels: Record<HeadToHeadIndustry, string> = {
  "oil-gas": "Oil & gas",
  technology: "Technology",
  defense: "Defense",
  financials: "Financials",
  "health-care": "Health care",
};

export const industryMarkets: IndustryMarket[] = [
  { industry: "oil-gas", countryId: "united-states", country: "United States", benchmark: "S&P Oil & Gas E&P", pe: 13.8, earningsGrowth: 7.5, fcfYield: 7.4, netDebtToEbitda: 1.1, roe: 18.5, sharpe: 0.72, policyRisk: 2, currencyRisk: 2, liquidity: 5, note: "Deep capital markets and shale flexibility, with commodity-cycle and policy exposure." },
  { industry: "oil-gas", countryId: "india", country: "India", benchmark: "Nifty Oil & Gas", pe: 14.9, earningsGrowth: 10.8, fcfYield: 5.8, netDebtToEbitda: 1.6, roe: 16.2, sharpe: 0.81, policyRisk: 3, currencyRisk: 3, liquidity: 4, note: "Demand growth is attractive; state influence, refining economics, and INR exposure matter." },
  { industry: "oil-gas", countryId: "norway", country: "Norway", benchmark: "OSE Energy", pe: 10.7, earningsGrowth: 4.2, fcfYield: 10.5, netDebtToEbitda: 0.7, roe: 24.1, sharpe: 0.84, policyRisk: 1, currencyRisk: 3, liquidity: 3, note: "Strong cash generation and governance, but a concentrated market and NOK cyclicality." },
  { industry: "oil-gas", countryId: "canada", country: "Canada", benchmark: "TSX Energy", pe: 12.4, earningsGrowth: 5.8, fcfYield: 8.7, netDebtToEbitda: 1.0, roe: 19.6, sharpe: 0.76, policyRisk: 2, currencyRisk: 3, liquidity: 4, note: "Long-life reserves and disciplined producers offset takeaway and regulatory constraints." },
  { industry: "oil-gas", countryId: "brazil", country: "Brazil", benchmark: "B3 Oil, Gas & Biofuels", pe: 8.6, earningsGrowth: 8.9, fcfYield: 12.1, netDebtToEbitda: 1.2, roe: 28.4, sharpe: 0.63, policyRisk: 4, currencyRisk: 5, liquidity: 3, note: "Low-cost pre-salt assets and valuation support come with material state and BRL risk." },

  { industry: "technology", countryId: "united-states", country: "United States", benchmark: "S&P 500 Information Technology", pe: 31.4, earningsGrowth: 15.2, fcfYield: 3.2, netDebtToEbitda: 0.2, roe: 34.5, sharpe: 1.12, policyRisk: 2, currencyRisk: 2, liquidity: 5, note: "Exceptional scale and profitability at a demanding valuation and high index concentration." },
  { industry: "technology", countryId: "india", country: "India", benchmark: "Nifty IT", pe: 27.1, earningsGrowth: 11.4, fcfYield: 3.8, netDebtToEbitda: 0.1, roe: 27.3, sharpe: 0.91, policyRisk: 2, currencyRisk: 3, liquidity: 4, note: "Cash-rich global services franchises depend on enterprise spending and INR competitiveness." },
  { industry: "technology", countryId: "south-korea", country: "South Korea", benchmark: "KRX Technology", pe: 18.2, earningsGrowth: 13.1, fcfYield: 5.1, netDebtToEbitda: 0.5, roe: 16.8, sharpe: 0.79, policyRisk: 3, currencyRisk: 4, liquidity: 4, note: "Semiconductor leverage offers upside and pronounced memory-cycle sensitivity." },
  { industry: "technology", countryId: "taiwan", country: "Taiwan", benchmark: "TAIEX Electronics", pe: 22.6, earningsGrowth: 16.4, fcfYield: 4.4, netDebtToEbitda: 0.1, roe: 29.5, sharpe: 1.06, policyRisk: 5, currencyRisk: 3, liquidity: 4, note: "World-class semiconductor economics carry unusually concentrated geopolitical risk." },
  { industry: "technology", countryId: "netherlands", country: "Netherlands", benchmark: "AEX Technology", pe: 29.8, earningsGrowth: 14.7, fcfYield: 3.5, netDebtToEbitda: 0.4, roe: 31.2, sharpe: 0.98, policyRisk: 2, currencyRisk: 2, liquidity: 3, note: "Critical semiconductor equipment exposure in a small and highly concentrated public market." },

  { industry: "defense", countryId: "united-states", country: "United States", benchmark: "S&P Aerospace & Defense", pe: 24.2, earningsGrowth: 9.1, fcfYield: 4.1, netDebtToEbitda: 2.0, roe: 26.4, sharpe: 0.82, policyRisk: 2, currencyRisk: 2, liquidity: 5, note: "Scale, backlog, and budgets are strong; program execution and leverage vary widely." },
  { industry: "defense", countryId: "sweden", country: "Sweden", benchmark: "OMX Sweden Defense basket", pe: 34.7, earningsGrowth: 18.6, fcfYield: 2.3, netDebtToEbitda: 0.3, roe: 23.1, sharpe: 1.18, policyRisk: 1, currencyRisk: 4, liquidity: 3, note: "European rearmament supports growth, while valuation and single-company concentration are high." },
  { industry: "defense", countryId: "france", country: "France", benchmark: "CAC Aerospace & Defense basket", pe: 25.6, earningsGrowth: 12.2, fcfYield: 3.7, netDebtToEbitda: 0.8, roe: 20.4, sharpe: 0.94, policyRisk: 2, currencyRisk: 2, liquidity: 4, note: "Broad aerospace and defense capability with civil-aircraft and government exposure." },
  { industry: "defense", countryId: "germany", country: "Germany", benchmark: "DAX Defense basket", pe: 38.2, earningsGrowth: 20.1, fcfYield: 1.9, netDebtToEbitda: 0.6, roe: 18.8, sharpe: 1.09, policyRisk: 2, currencyRisk: 2, liquidity: 3, note: "Rapid budget normalization creates growth but leaves little valuation margin for error." },
  { industry: "defense", countryId: "united-kingdom", country: "United Kingdom", benchmark: "FTSE Aerospace & Defense", pe: 21.8, earningsGrowth: 10.4, fcfYield: 4.6, netDebtToEbitda: 1.4, roe: 24.7, sharpe: 0.88, policyRisk: 2, currencyRisk: 3, liquidity: 4, note: "Global programs and exports offer diversification across a mature defense ecosystem." },

  { industry: "financials", countryId: "united-states", country: "United States", benchmark: "S&P 500 Financials", pe: 15.2, earningsGrowth: 8.4, fcfYield: 6.3, netDebtToEbitda: 1.4, roe: 14.8, sharpe: 0.79, policyRisk: 2, currencyRisk: 2, liquidity: 5, note: "Depth and diversification offset sensitivity to the credit cycle and regulation." },
  { industry: "financials", countryId: "india", country: "India", benchmark: "Nifty Financial Services", pe: 18.6, earningsGrowth: 13.8, fcfYield: 5.1, netDebtToEbitda: 1.7, roe: 16.9, sharpe: 0.96, policyRisk: 3, currencyRisk: 3, liquidity: 4, note: "Credit penetration and formalization support growth; underwriting and valuation remain key." },
  { industry: "financials", countryId: "singapore", country: "Singapore", benchmark: "STI Financials", pe: 11.7, earningsGrowth: 6.3, fcfYield: 7.8, netDebtToEbitda: 1.1, roe: 15.4, sharpe: 0.92, policyRisk: 1, currencyRisk: 2, liquidity: 3, note: "Well-capitalized regional banks combine income with slower structural growth." },
  { industry: "financials", countryId: "united-kingdom", country: "United Kingdom", benchmark: "FTSE 350 Financials", pe: 10.9, earningsGrowth: 5.7, fcfYield: 8.2, netDebtToEbitda: 1.3, roe: 13.7, sharpe: 0.68, policyRisk: 2, currencyRisk: 3, liquidity: 4, note: "Low multiples and global exposure meet modest growth and UK macro sensitivity." },
  { industry: "financials", countryId: "canada", country: "Canada", benchmark: "TSX Financials", pe: 13.1, earningsGrowth: 6.1, fcfYield: 7.0, netDebtToEbitda: 1.2, roe: 15.1, sharpe: 0.73, policyRisk: 2, currencyRisk: 3, liquidity: 4, note: "A concentrated oligopoly with durable returns and meaningful housing exposure." },

  { industry: "health-care", countryId: "united-states", country: "United States", benchmark: "S&P 500 Health Care", pe: 22.4, earningsGrowth: 10.2, fcfYield: 4.5, netDebtToEbitda: 1.3, roe: 21.8, sharpe: 0.83, policyRisk: 3, currencyRisk: 2, liquidity: 5, note: "Diverse innovation and services exposure with recurring pricing and policy debates." },
  { industry: "health-care", countryId: "denmark", country: "Denmark", benchmark: "OMXC25 Health Care", pe: 28.8, earningsGrowth: 14.6, fcfYield: 3.6, netDebtToEbitda: 0.2, roe: 42.1, sharpe: 0.91, policyRisk: 2, currencyRisk: 2, liquidity: 3, note: "Exceptional economics are dominated by a small number of global pharmaceutical franchises." },
  { industry: "health-care", countryId: "switzerland", country: "Switzerland", benchmark: "SMI Health Care", pe: 18.9, earningsGrowth: 7.4, fcfYield: 5.2, netDebtToEbitda: 1.1, roe: 24.3, sharpe: 0.86, policyRisk: 1, currencyRisk: 2, liquidity: 4, note: "Defensive global franchises and CHF resilience trade against slower growth." },
  { industry: "health-care", countryId: "united-kingdom", country: "United Kingdom", benchmark: "FTSE 350 Health Care", pe: 17.6, earningsGrowth: 6.8, fcfYield: 5.7, netDebtToEbitda: 1.5, roe: 22.5, sharpe: 0.78, policyRisk: 2, currencyRisk: 3, liquidity: 4, note: "Global pharmaceutical exposure at moderate valuations, with pipeline concentration." },
  { industry: "health-care", countryId: "japan", country: "Japan", benchmark: "TOPIX Pharmaceuticals", pe: 23.1, earningsGrowth: 8.7, fcfYield: 4.1, netDebtToEbitda: 0.4, roe: 12.8, sharpe: 0.71, policyRisk: 2, currencyRisk: 4, liquidity: 4, note: "Balance-sheet strength and innovation meet lower capital efficiency and yen volatility." },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function scoreIndustryMarket(market: IndustryMarket): IndustryScore {
  const valuation = clamp(((35 - market.pe) / 27) * 58 + (market.fcfYield / 12) * 42);
  const growth = clamp(((market.earningsGrowth + 2) / 24) * 100);
  const quality = clamp((market.roe / 35) * 100);
  const balanceSheet = clamp(((3.5 - market.netDebtToEbitda) / 3.5) * 100);
  const riskAdjusted = clamp(((market.sharpe + 0.2) / 1.5) * 100);
  const investability = clamp(
    (market.liquidity / 5) * 50
      + ((6 - market.policyRisk) / 5) * 25
      + ((6 - market.currencyRisk) / 5) * 25,
  );
  const overall = valuation * 0.2
    + growth * 0.2
    + quality * 0.16
    + balanceSheet * 0.14
    + riskAdjusted * 0.15
    + investability * 0.15;

  return { overall, valuation, growth, quality, balanceSheet, riskAdjusted, investability };
}

export function deriveIndustryMetrics(market: IndustryMarket): IndustryDerivedMetrics {
  const riskLoad = (market.policyRisk + market.currencyRisk) / 2;
  const volatility = clamp(35 - market.sharpe * 11 + riskLoad * 1.8);
  return {
    peg: market.earningsGrowth > 0 ? market.pe / market.earningsGrowth : null,
    priceToBook: market.pe * market.roe / 100,
    operatingMargin: clamp(market.roe * 0.62 + market.fcfYield * 0.45),
    balanceSheetStrength: clamp(100 - market.netDebtToEbitda * 22 - riskLoad * 3),
    earningsConsistency: clamp(48 + market.sharpe * 24 - riskLoad * 2),
    historicalGrowth: market.earningsGrowth * 0.78,
    expectedRevenueGrowth: market.earningsGrowth * 0.72,
    volatility,
    maxDrawdown: -Math.min(70, volatility * 1.45),
  };
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

export function globalIndustryBenchmark(industry: HeadToHeadIndustry): IndustryMarket | null {
  const markets = marketsForIndustry(industry);
  if (!markets.length) return null;
  return {
    industry,
    countryId: "global",
    country: "Global peer median",
    benchmark: `Aurelian ${industryLabels[industry]} peer set`,
    pe: average(markets.map((market) => market.pe)),
    earningsGrowth: average(markets.map((market) => market.earningsGrowth)),
    fcfYield: average(markets.map((market) => market.fcfYield)),
    netDebtToEbitda: average(markets.map((market) => market.netDebtToEbitda)),
    roe: average(markets.map((market) => market.roe)),
    sharpe: average(markets.map((market) => market.sharpe)),
    policyRisk: Math.round(average(markets.map((market) => market.policyRisk))),
    currencyRisk: Math.round(average(markets.map((market) => market.currencyRisk))),
    liquidity: average(markets.map((market) => market.liquidity)),
    note: `Equal-weighted comparison across ${markets.length} researched markets. It is a reference set, not an investable index.`,
  };
}

export function industryComparisonVerdicts(primary: IndustryMarket, comparison: IndustryMarket): ComparisonVerdict[] {
  const primaryScore = scoreIndustryMarket(primary);
  const comparisonScore = scoreIndustryMarket(comparison);
  const primaryDerived = deriveIndustryMetrics(primary);
  const comparisonDerived = deriveIndustryMetrics(comparison);
  const pick = (left: number, right: number, lowerIsBetter = false) => {
    if (Math.abs(left - right) < 0.01) return "Broadly similar";
    const primaryLeads = lowerIsBetter ? left < right : left > right;
    return primaryLeads ? primary.country : comparison.country;
  };
  const primaryRisk = primary.policyRisk + primary.currencyRisk + primaryDerived.volatility / 10;
  const comparisonRisk = comparison.policyRisk + comparison.currencyRisk + comparisonDerived.volatility / 10;
  return [
    { label: "Better valuation", leader: pick(primaryScore.valuation, comparisonScore.valuation), note: "P/E and free-cash-flow yield", tone: "positive" },
    { label: "Stronger quality", leader: pick(primaryScore.quality, comparisonScore.quality), note: "ROE and modeled operating margin", tone: "positive" },
    { label: "Higher growth", leader: pick(primaryScore.growth, comparisonScore.growth), note: "Expected earnings and revenue direction", tone: "positive" },
    { label: "Greater resilience", leader: pick((primaryScore.balanceSheet + primaryScore.riskAdjusted) / 2, (comparisonScore.balanceSheet + comparisonScore.riskAdjusted) / 2), note: "Balance sheet and risk-adjusted behavior", tone: "positive" },
    { label: "Higher risk", leader: pick(primaryRisk, comparisonRisk), note: "Volatility, currency, and policy exposure", tone: "risk" },
    { label: "Uncertain evidence", leader: "Both markets", note: "Several industry metrics are comparative estimates", tone: "neutral" },
  ];
}

export function marketsForIndustry(industry: HeadToHeadIndustry) {
  return industryMarkets.filter((market) => market.industry === industry);
}
