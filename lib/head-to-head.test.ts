import { describe, expect, it } from "vitest";
import { industryMarkets, marketsForIndustry, scoreIndustryMarket } from "./head-to-head";

describe("Atlas industry head-to-head", () => {
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
});
