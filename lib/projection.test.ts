import { describe, expect, it } from "vitest";
import { projectPortfolio } from "@/lib/projection";

const base = {
  startValueNok: 100000,
  monthlyDepositNok: 2000,
  years: 10,
  expectedReturnPercent: 7,
  volatilityPercent: 15,
};

describe("projectPortfolio", () => {
  it("returns one row per year", () => {
    const projection = projectPortfolio({ ...base, paths: 200 });
    expect(projection.years).toHaveLength(10);
    expect(projection.years.map((entry) => entry.year)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("gives the same answer every time it runs", () => {
    const first = projectPortfolio({ ...base, paths: 200 });
    const second = projectPortfolio({ ...base, paths: 200 });
    expect(second.years).toEqual(first.years);
  });

  it("keeps the percentiles in order", () => {
    const projection = projectPortfolio({ ...base, paths: 400 });
    for (const year of projection.years) {
      expect(year.p10Nok).toBeLessThanOrEqual(year.p50Nok);
      expect(year.p50Nok).toBeLessThanOrEqual(year.p90Nok);
    }
  });

  it("counts contributions as deposits only, never as growth", () => {
    const projection = projectPortfolio({ ...base, paths: 100 });
    expect(projection.years[0].contributedNok).toBe(100000 + 2000 * 12);
    expect(projection.finalContributedNok).toBe(100000 + 2000 * 120);
  });

  it("delivers exactly the annual return that was typed, not more", () => {
    // Dividing the annual rate by twelve and compounding would return 12.68%.
    const projection = projectPortfolio({
      startValueNok: 100000,
      monthlyDepositNok: 0,
      years: 1,
      expectedReturnPercent: 12,
      volatilityPercent: 0,
      paths: 50,
    });
    const year = projection.years[0];
    expect(year.p10Nok).toBeCloseTo(year.p90Nok, 6);
    expect(year.p50Nok).toBeCloseTo(112000, 4);
  });

  it("keeps a long horizon honest at higher rates", () => {
    const projection = projectPortfolio({
      startValueNok: 100000,
      monthlyDepositNok: 0,
      years: 30,
      expectedReturnPercent: 10,
      volatilityPercent: 0,
      paths: 20,
    });
    expect(projection.finalP50Nok).toBeCloseTo(100000 * 1.1 ** 30, 2);
  });

  it("clamps assumptions that would otherwise produce unusable numbers", () => {
    const wild = projectPortfolio({ ...base, expectedReturnPercent: 99999, paths: 20 });
    expect(Number.isFinite(wild.finalP50Nok)).toBe(true);
    const negative = projectPortfolio({ ...base, expectedReturnPercent: -500, paths: 20 });
    expect(Number.isFinite(negative.finalP50Nok)).toBe(true);
    expect(negative.finalP50Nok).toBeGreaterThanOrEqual(0);
  });

  it("widens the range as volatility rises", () => {
    const calm = projectPortfolio({ ...base, volatilityPercent: 5, paths: 400 });
    const wild = projectPortfolio({ ...base, volatilityPercent: 30, paths: 400 });
    const spread = (projection: typeof calm) => projection.finalP90Nok - projection.finalP10Nok;
    expect(spread(wild)).toBeGreaterThan(spread(calm));
  });

  it("never projects a negative portfolio", () => {
    const projection = projectPortfolio({
      startValueNok: 10000,
      monthlyDepositNok: 0,
      years: 20,
      expectedReturnPercent: -20,
      volatilityPercent: 60,
      paths: 300,
    });
    expect(projection.years.every((year) => year.p10Nok >= 0)).toBe(true);
  });

  it("holds the inputs inside sane bounds", () => {
    expect(projectPortfolio({ ...base, years: 200, paths: 10 }).years).toHaveLength(50);
    expect(projectPortfolio({ ...base, years: 0, paths: 10 }).years).toHaveLength(1);
    expect(projectPortfolio({ ...base, paths: 99999 }).paths).toBe(2000);
    expect(projectPortfolio({ ...base, startValueNok: -5000, paths: 10 }).years[0].contributedNok).toBe(2000 * 12);
  });
});
