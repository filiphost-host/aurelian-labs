import { describe, expect, it } from "vitest";
import { deriveIndustryMetrics, globalIndustryBenchmark, industryComparisonVerdicts, industryMarkets, marketsForIndustry, scoreIndustryMarket } from "./head-to-head";

describe("Atlas industry comparison", () => {
  it("keeps every score within the documented 0-100 range", () => {
    for (const market of industryMarkets) {
      const score = scoreIndustryMarket(market);
      expect(Object.values(score).every((value) => value >= 0 && value <= 100)).toBe(true);
    }
  });

  it("supports oil and gas comparison across the United States and India", () => {
    const markets = marketsForIndustry("oil-gas");
    expect(markets.some((market) => market.countryId === "united-states")).toBe(true);
    expect(markets.some((market) => market.countryId === "india")).toBe(true);
  });

  it("rewards stronger cash generation and lower leverage when other inputs match", () => {
    const base = industryMarkets[0];
    const stronger = { ...base, fcfYield: base.fcfYield + 3, netDebtToEbitda: 0 };
    expect(scoreIndustryMarket(stronger).overall).toBeGreaterThan(scoreIndustryMarket(base).overall);
  });

  it("builds a transparent global reference set", () => {
    const benchmark = globalIndustryBenchmark("technology");
    expect(benchmark?.country).toBe("Global peer median");
    expect(benchmark?.pe).toBeGreaterThan(0);
    expect(benchmark?.note).toContain("not an investable index");
  });

  it("separates comparison conclusions instead of naming one winner", () => {
    const [left, right] = marketsForIndustry("oil-gas");
    const verdicts = industryComparisonVerdicts(left, right);
    expect(verdicts.map((verdict) => verdict.label)).toEqual(expect.arrayContaining(["Better valuation", "Stronger quality", "Higher growth", "Greater resilience", "Higher risk", "Uncertain evidence"]));
  });

  it("keeps unavailable PEG values explicit", () => {
    const market = { ...marketsForIndustry("technology")[0], earningsGrowth: 0 };
    expect(deriveIndustryMetrics(market).peg).toBeNull();
  });
});
