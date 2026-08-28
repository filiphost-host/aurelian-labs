import { describe, expect, it } from "vitest";
import { scenarioImpact, totalValueNok } from "./calculations";
import { buildStressHoldings, normalizedAllocations, rebalanceAllocation, stressInstrumentLibrary } from "./stress-portfolio";
import { scenarioPresets } from "./sample-data";

describe("Scenario Lab portfolio builder", () => {
  it("offers a broad US, Nordic, and European research universe", () => {
    expect(stressInstrumentLibrary.length).toBeGreaterThan(50);
    expect(stressInstrumentLibrary.some((instrument) => instrument.country === "Norway")).toBe(true);
    expect(stressInstrumentLibrary.some((instrument) => instrument.country === "Sweden")).toBe(true);
    expect(stressInstrumentLibrary.some((instrument) => instrument.country === "Denmark")).toBe(true);
    expect(stressInstrumentLibrary.filter((instrument) => instrument.assetType === "etf").length).toBeGreaterThan(5);
    expect(stressInstrumentLibrary.filter((instrument) => instrument.recessionRisk != null)
      .every((instrument) => instrument.recessionRisk! >= 1 && instrument.recessionRisk! <= 100)).toBe(true);
  });

  it("normalizes user weights to 100 percent", () => {
    const result = normalizedAllocations([
      { instrumentId: "a", weight: 20 },
      { instrumentId: "b", weight: 30 },
    ]);
    expect(result.reduce((sum, row) => sum + row.weight, 0)).toBeCloseTo(100);
    expect(result[0].weight).toBeCloseTo(40);
  });

  it("keeps an edited weight exact and proportionally rebalances the rest", () => {
    const result = rebalanceAllocation([
      { instrumentId: "a", weight: 15 },
      { instrumentId: "b", weight: 35 },
      { instrumentId: "c", weight: 50 },
    ], "a", 40);
    expect(result.find((row) => row.instrumentId === "a")?.weight).toBe(40);
    expect(result.reduce((sum, row) => sum + row.weight, 0)).toBeCloseTo(100);
    expect(result.find((row) => row.instrumentId === "b")?.weight).toBeCloseTo(24.7059);
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
