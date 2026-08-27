import { describe, expect, it } from "vitest";
import { scenarioPresets } from "@/lib/sample-data";
import { rankModelPortfolios } from "@/lib/scenario-portfolios";

describe("scenario portfolio comparison", () => {
  it("ranks all model portfolios by post-shock Sharpe", () => {
    const scenario = scenarioPresets.find((preset) => preset.id === "risk-off")!.shocks;
    const results = rankModelPortfolios(scenario);

    expect(results).toHaveLength(6);
    expect(results[0].postShockSharpe).toBeGreaterThanOrEqual(results[1].postShockSharpe);
    expect(results.every((result) => Number.isFinite(result.postShockSharpe))).toBe(true);
  });

  it("penalizes concentrated growth during an AI reset", () => {
    const scenario = scenarioPresets.find((preset) => preset.id === "ai-bubble")!.shocks;
    const results = rankModelPortfolios(scenario);
    const growth = results.find((result) => result.id === "aurelian-growth")!;
    const defensive = results.find((result) => result.id === "defensive-income")!;

    expect(growth.shockReturn).toBeLessThan(defensive.shockReturn);
  });
});
