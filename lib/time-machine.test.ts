import { describe, expect, it } from "vitest";
import { equityExposure, historicalWindows, replayWindow, windowMove } from "@/lib/time-machine";
import type { Holding, LedgerPosition } from "@/lib/types";

const window = { id: "w", name: "W", description: "", start: "2020-02-19", end: "2020-03-23" };

const prices = [
  { price_date: "2020-01-02", close: 3200 },
  { price_date: "2020-02-19", close: 3386 },
  { price_date: "2020-03-23", close: 2237 },
  { price_date: "2020-12-31", close: 3756 },
];

function position(id: string, valueNok: number, exposures: Holding["factor_exposures"]): LedgerPosition {
  const holding: Holding = {
    id,
    asset_type: "stock",
    ticker: id.toUpperCase(),
    name: `Holding ${id}`,
    quantity: 10,
    average_cost: 100,
    market_price: 150,
    currency: "NOK",
    country: "Norway",
    sector: "Industrials",
    region: "Europe",
    account_note: null,
    manual_value_nok: null,
    factor_exposures: exposures,
    issuer: null,
    coupon_rate: null,
    maturity_date: null,
    face_value: null,
    yield_estimate: null,
    duration_estimate: null,
    credit_quality: null,
    seniority: null,
    price_provenance: { source: "Test", as_of: "2026-08-10", status: "manual" },
  };
  return {
    holding,
    quantity: 10,
    averageCost: 100,
    costNok: valueNok * 0.8,
    marketValueNok: valueNok,
    unrealizedGainNok: valueNok * 0.2,
    realizedGainNok: 0,
  };
}

describe("windowMove", () => {
  it("measures the real move between the stored closes", () => {
    const move = windowMove(prices, window)!;
    expect(move.startDate).toBe("2020-02-19");
    expect(move.endDate).toBe("2020-03-23");
    expect(move.returnPercent).toBeCloseTo(((2237 - 3386) / 3386) * 100, 6);
  });

  it("starts at the first close on or after the window, never before it", () => {
    const move = windowMove([
      { price_date: "2020-03-02", close: 3000 },
      { price_date: "2020-03-23", close: 2237 },
    ], window)!;
    expect(move.startDate).toBe("2020-03-02");
  });

  it("returns nothing when the stored history cannot cover the window", () => {
    expect(windowMove([], window)).toBeNull();
    expect(windowMove([{ price_date: "2020-02-19", close: 3386 }], window)).toBeNull();
    expect(windowMove([
      { price_date: "2021-01-01", close: 3000 },
      { price_date: "2021-06-01", close: 3200 },
    ], window)).toBeNull();
  });

  it("says when stored history covers only part of the window", () => {
    expect(windowMove(prices, window)!.truncated).toBe(false);
    const late = windowMove([
      { price_date: "2020-03-09", close: 2747 },
      { price_date: "2020-03-23", close: 2237 },
    ], window)!;
    expect(late.truncated).toBe(true);
  });

  it("ignores unusable closes", () => {
    expect(windowMove([
      { price_date: "2020-02-19", close: 0 },
      { price_date: "2020-03-23", close: 2237 },
    ], window)).toBeNull();
  });
});

describe("equityExposure", () => {
  it("takes the largest broad-market factor recorded", () => {
    expect(equityExposure({ globalEquity: 0.6, usEquity: 1 })).toBe(1);
    expect(equityExposure({ globalEquity: 0.45 })).toBe(0.45);
  });

  it("ignores sector factors, which describe a sector rather than the index", () => {
    // Sample data records technology 1.0 against usEquity 0.8; the index beta is 0.8.
    expect(equityExposure({ globalEquity: 0.45, usEquity: 0.8, technology: 1 })).toBe(0.8);
    expect(equityExposure({ technology: 1.25, defense: 2 })).toBe(0);
  });

  it("is zero for a holding with no equity exposure recorded", () => {
    expect(equityExposure({})).toBe(0);
    expect(equityExposure({ rates: 2, credit: 1 })).toBe(0);
  });
});

describe("replayWindow", () => {
  const positions = [
    position("a", 60000, { usEquity: 1 }),
    position("b", 40000, { globalEquity: 0.5 }),
  ];

  it("moves each position by the real benchmark move times its exposure", () => {
    const replay = replayWindow(positions, prices, window);
    const move = windowMove(prices, window)!;
    expect(replay.positions[0].impactPercent).toBeCloseTo(move.returnPercent * 1, 6);
    expect(replay.positions[1].impactPercent).toBeCloseTo(move.returnPercent * 0.5, 6);
    expect(replay.impactNok).toBeCloseTo(
      60000 * (move.returnPercent / 100) + 40000 * (move.returnPercent * 0.5 / 100), 6);
    expect(replay.impactPercent).toBeCloseTo((replay.impactNok / 100000) * 100, 6);
  });

  it("counts positions with no recorded exposure instead of assuming they held firm", () => {
    const replay = replayWindow([...positions, position("c", 20000, {})], prices, window);
    expect(replay.uncoveredCount).toBe(1);
    expect(replay.coveredValueNok).toBe(100000);
    expect(replay.totalValueNok).toBe(120000);
  });

  it("reports no move when the stored history cannot cover the window", () => {
    const replay = replayWindow(positions, [], window);
    expect(replay.move).toBeNull();
    expect(replay.impactNok).toBe(0);
    expect(replay.positions.every((entry) => entry.impactPercent === 0)).toBe(true);
  });

  it("leaves closed positions out", () => {
    const closed = { ...position("d", 0, { usEquity: 1 }), quantity: 0 };
    expect(replayWindow([closed], prices, window).positions).toHaveLength(0);
  });

  it("ships windows that all name a real start before their end", () => {
    for (const entry of historicalWindows) {
      expect(entry.start.localeCompare(entry.end)).toBeLessThan(0);
    }
  });
});
