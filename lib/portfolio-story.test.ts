import { describe, expect, it } from "vitest";

import { buildBenchmarkComparison, portfolioMilestones } from "./portfolio-story";

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
});

describe("buildBenchmarkComparison", () => {
  const snapshots = [
    { snapshot_date: "2020-01-01", total_value_nok: 100 },
    { snapshot_date: "2026-01-01", total_value_nok: 197.5 },
  ];

  it("labels the reference path as an estimate when no stored closes exist", () => {
    const comparison = buildBenchmarkComparison(snapshots, []);
    expect(comparison.benchmarkSource).toBe("estimate");
    expect(comparison.benchmarkAsOf).toBeNull();
    expect(comparison.series[0]).toMatchObject({ portfolioReturn: 0, benchmarkReturn: 0 });
    expect(comparison.series[1].portfolioReturn).toBeCloseTo(97.5, 8);
  });

  it("indexes stored closes against the portfolio from the first overlapping date", () => {
    const comparison = buildBenchmarkComparison(snapshots, [
      { price_date: "2019-12-31", close: 3000 },
      { price_date: "2026-01-01", close: 6000 },
    ]);
    expect(comparison.benchmarkSource).toBe("stored");
    expect(comparison.rebasedAt).toBe("2020-01-01");
    expect(comparison.benchmarkAsOf).toBe("2026-01-01");
    expect(comparison.series[0].benchmarkReturn).toBeCloseTo(0, 8);
    expect(comparison.series[1].benchmarkReturn).toBeCloseTo(100, 8);
  });

  it("starts the benchmark overlay at the first snapshot with data and rebases to the portfolio", () => {
    const comparison = buildBenchmarkComparison([
      { snapshot_date: "2020-01-01", total_value_nok: 100 },
      { snapshot_date: "2023-06-01", total_value_nok: 150 },
      { snapshot_date: "2026-01-01", total_value_nok: 200 },
    ], [
      { price_date: "2023-01-01", close: 4000 },
      { price_date: "2026-01-01", close: 6000 },
    ]);
    expect(comparison.series[0].benchmarkReturn).toBeNull();
    expect(comparison.series[1].benchmarkReturn).toBeCloseTo(50, 8);
    expect(comparison.series[2].benchmarkReturn).toBeCloseTo(125, 8);
    expect(comparison.rebasedAt).toBe("2023-06-01");
  });
});
