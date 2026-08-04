import { describe, expect, it } from "vitest";
import { scenarioGuides } from "@/lib/scenario-research";
import { sampleHoldings, scenarioPresets } from "@/lib/sample-data";
import { scenarioImpact } from "@/lib/calculations";

describe("scenario research library", () => {
  it("provides an educational guide for every preset", () => {
    for (const preset of scenarioPresets) {
      const guide = scenarioGuides[preset.id];
      expect(guide, `missing guide for ${preset.id}`).toBeDefined();
      expect(guide.transmission.length).toBeGreaterThanOrEqual(3);
      expect(guide.watch.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("distinguishes an orderly rate cut from a recessionary shock", () => {
    const sxr8 = sampleHoldings.find((holding) => holding.ticker === "SXR8")!;
    const ratesDown = scenarioPresets.find((preset) => preset.id === "rates-down")!;
    const recession = scenarioPresets.find((preset) => preset.id === "recession")!;

    expect(scenarioImpact(sxr8, ratesDown.shocks).impactNok).toBeGreaterThan(0);
    expect(scenarioImpact(sxr8, recession.shocks).impactNok).toBeLessThan(0);
  });

  it("captures AI concentration in both direct technology and the S&P 500 ETF", () => {
    const aiShock = scenarioPresets.find((preset) => preset.id === "ai-bubble")!;
    const nvda = sampleHoldings.find((holding) => holding.ticker === "NVDA")!;
    const sxr8 = sampleHoldings.find((holding) => holding.ticker === "SXR8")!;

    expect(scenarioImpact(nvda, aiShock.shocks).impactNok).toBeLessThan(0);
    expect(scenarioImpact(sxr8, aiShock.shocks).impactNok).toBeLessThan(0);
  });
});
