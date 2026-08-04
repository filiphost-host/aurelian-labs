import { describe, expect, it } from "vitest";

import { buildBenchmarkSeries, portfolioMilestones } from "./portfolio-story";

describe("portfolio story", () => {
  it("preserves the user-entered investment decisions", () => {
    expect(portfolioMilestones.map((milestone) => milestone.ticker)).toEqual([
      "GOOGL",
      "NOVO-B",
      "TSLA",
      "SAAB-B",
      "LMT",
    ]);
  });

  it("indexes the portfolio and benchmark from the same starting point", () => {
    const series = buildBenchmarkSeries([
      { snapshot_date: "2020-01-01", total_value_nok: 100 },
      { snapshot_date: "2026-01-01", total_value_nok: 197.5 },
    ]);
    expect(series[0]).toMatchObject({ portfolioReturn: 0, benchmarkReturn: 0 });
    expect(series[1].portfolioReturn).toBeCloseTo(97.5, 8);
  });
});
