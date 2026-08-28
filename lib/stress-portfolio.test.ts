import { describe, expect, it } from "vitest";
import { scenarioImpact, totalValueNok } from "./calculations";
import { buildStressHoldings, normalizedAllocations, stressInstrumentLibrary } from "./stress-portfolio";
import { scenarioPresets } from "./sample-data";

describe("Scenario Lab portfolio builder", () => {
  it("normalizes user weights to 100 percent", () => {
    const result = normalizedAllocations([
      { instrumentId: "a", weight: 20 },
      { instrumentId: "b", weight: 30 },
    ]);
    expect(result.reduce((sum, row) => sum + row.weight, 0)).toBeCloseTo(100);
    expect(result[0].weight).toBeCloseTo(40);
  });

  it("builds a test portfolio at the requested NOK capital", () => {
    const holdings = buildStressHoldings(stressInstrumentLibrary, [
      { instrumentId: "lab-sxr8", weight: 70 },
      { instrumentId: "lab-treasury", weight: 30 },
    ], 1_000_000);
    expect(totalValueNok(holdings)).toBeCloseTo(1_000_000);
    expect(holdings.map((holding) => holding.asset_type)).toEqual(["etf", "bond"]);
  });

  it("applies equity and rate stress to different selected instruments", () => {
    const holdings = buildStressHoldings(stressInstrumentLibrary, [
      { instrumentId: "lab-nvda", weight: 50 },
      { instrumentId: "lab-treasury", weight: 50 },
    ], 1_000_000);
    const rates = scenarioPresets.find((preset) => preset.id === "rates-up")!.shocks;
    const results = holdings.map((holding) => scenarioImpact(holding, rates));
    expect(results.find((row) => row.holding.asset_type === "bond")?.impactPercent).not.toBe(0);
    expect(results.find((row) => row.holding.ticker === "NVDA")?.impactPercent).not.toBe(0);
  });
});
