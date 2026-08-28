import { describe, expect, it } from "vitest";
import { buildScenarioTimeline } from "./scenario-timeline";

describe("scenario timeline", () => {
  const event = {
    id: "gfc",
    name: "2008 Financial Crisis",
    shortLabel: "GFC",
    date: "2008-10",
    impactPercent: -35,
    recoveryMonths: 30,
    recap: "Credit losses and forced deleveraging spread through the financial system.",
  };

  it("draws down at the event and recovers toward the baseline", () => {
    const points = buildScenarioTimeline(100_000, [event], "2008-01", "2014-01");
    const trough = points.find((point) => point.date === "2008-10")!;
    const later = points.find((point) => point.date === "2014-01")!;
    expect(trough.portfolioNok).toBeLessThan(trough.baselineNok * 0.7);
    expect(later.portfolioNok / later.baselineNok).toBeGreaterThan(0.95);
  });

  it("surfaces event context around the selected period", () => {
    const points = buildScenarioTimeline(100_000, [event], "2008-01", "2009-01");
    expect(points.find((point) => point.date === "2008-10")?.eventName).toBe("2008 Financial Crisis");
  });
});
