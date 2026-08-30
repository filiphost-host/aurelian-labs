import { describe, expect, it } from "vitest";
import {
  displayValue,
  fallbackFxToNok,
  holdingValueNok,
  portfolioSummary,
  replayTransactions,
  scenarioImpact,
  timeWeightedReturn,
  xirr,
} from "@/lib/calculations";
import type { Holding, PortfolioSnapshot, Scenario, Transaction } from "@/lib/types";

const baseHolding: Holding = {
  id: "holding-1",
  asset_type: "stock",
  ticker: "TEST",
  name: "Test Holding",
  quantity: 0,
  average_cost: 0,
  market_price: 150,
  currency: "NOK",
  country: "Norway",
  sector: "Industrials",
  region: "Europe",
  account_note: null,
  manual_value_nok: null,
  factor_exposures: { globalEquity: 1 },
  issuer: null,
  coupon_rate: null,
  maturity_date: null,
  face_value: null,
  yield_estimate: null,
  duration_estimate: null,
  credit_quality: null,
  seniority: null,
  price_provenance: { source: "Test", as_of: "2026-07-30", status: "manual" },
};

function transaction(input: Partial<Transaction>): Transaction {
  return {
    id: crypto.randomUUID(),
    holding_id: "holding-1",
    type: "buy",
    occurred_at: "2024-01-01",
    quantity: 0,
    unit_price: 0,
    amount: null,
    fee: 0,
    currency: "NOK",
    fx_to_nok: 1,
    split_ratio: null,
    note: null,
    ...input,
  };
}

const blankScenario: Scenario = {
  globalEquity: 0,
  usEquity: 0,
  europeEquity: 0,
  technology: 0,
  industrials: 0,
  defense: 0,
  usdNok: 0,
  nokEur: 0,
  rates: 0,
  credit: 0,
  cash: 0,
};

describe("transaction ledger", () => {
  it("uses moving-average cost and realizes gains on a partial sale", () => {
    const positions = replayTransactions([baseHolding], [
      transaction({ quantity: 10, unit_price: 100 }),
      transaction({ occurred_at: "2024-02-01", quantity: 10, unit_price: 120 }),
      transaction({ occurred_at: "2024-03-01", type: "sell", quantity: 5, unit_price: 140, fee: 10 }),
    ]);
    expect(positions[0].quantity).toBe(15);
    expect(positions[0].averageCost).toBe(110);
    expect(positions[0].realizedGainNok).toBe(140);
    expect(positions[0].unrealizedGainNok).toBe(600);
  });

  it("adjusts quantity and average cost for a stock split", () => {
    const positions = replayTransactions([baseHolding], [
      transaction({ quantity: 10, unit_price: 100 }),
      transaction({ occurred_at: "2024-02-01", type: "split", split_ratio: 2, quantity: null, unit_price: null }),
    ]);
    expect(positions[0].quantity).toBe(20);
    expect(positions[0].averageCost).toBe(50);
  });
});

describe("returns and currency", () => {
  it("calculates an annualized internal rate of return", () => {
    const result = xirr([
      { date: "2024-01-01", value: -1000 },
      { date: "2025-01-01", value: 1100 },
    ]);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(10, 1);
  });

  it("removes external flows from time-weighted return", () => {
    const snapshots: PortfolioSnapshot[] = [
      { id: "1", snapshot_date: "2024-01-01", total_value_nok: 100, external_flow_nok: 100, source: "calculated" },
      { id: "2", snapshot_date: "2024-06-01", total_value_nok: 220, external_flow_nok: 100, source: "calculated" },
      { id: "3", snapshot_date: "2025-01-01", total_value_nok: 242, external_flow_nok: 0, source: "calculated" },
    ];
    expect(timeWeightedReturn(snapshots)).toBeCloseTo(32, 5);
  });

  it("converts NOK values to the EUR display currency without changing storage", () => {
    expect(displayValue(1180, "EUR")).toBe(100);
  });

  it("treats an unavailable price as unavailable rather than substituting a fake price", () => {
    expect(holdingValueNok({ ...baseHolding, market_price: null })).toBe(0);
  });
});

describe("scenario engine", () => {
  it("applies percentage shocks through editable factor exposure", () => {
    const result = scenarioImpact(
      { ...baseHolding, quantity: 100 },
      { ...blankScenario, globalEquity: -20 },
    );
    expect(result.impactPercent).toBe(-20);
    expect(result.impactNok).toBe(-3000);
  });

  it("uses basis points and duration for bonds", () => {
    const bond: Holding = {
      ...baseHolding,
      asset_type: "bond",
      quantity: 1,
      market_price: 100000,
      duration_estimate: 5,
      factor_exposures: { credit: 1 },
    };
    const result = scenarioImpact(bond, { ...blankScenario, rates: 100, credit: 150 });
    expect(result.impactPercent).toBeCloseTo(-12.5, 4);
    expect(result.impactNok).toBeCloseTo(-12500, 2);
  });

  it("reports only assumptions that are active in the selected stress test", () => {
    const result = scenarioImpact(baseHolding, { ...blankScenario, rates: 100 });
    expect(result.impactNok).toBe(0);
    expect(result.assumptions).toEqual([]);
  });
});

describe("live FX threading", () => {
  const liveRates = { ...fallbackFxToNok, USD: 10, EUR: 12 };

  it("values foreign holdings with the provided rates", () => {
    const usdHolding = { ...baseHolding, currency: "USD", quantity: 2, market_price: 50 };
    expect(holdingValueNok(usdHolding, liveRates)).toBe(1000);
    expect(holdingValueNok(usdHolding)).toBeCloseTo(2 * 50 * fallbackFxToNok.USD, 8);
  });

  it("threads rates through the portfolio summary", () => {
    const usdHolding = { ...baseHolding, currency: "USD" };
    const summary = portfolioSummary(
      [usdHolding],
      [transaction({ quantity: 10, unit_price: 100 })],
      [],
      liveRates,
    );
    expect(summary.total).toBe(10 * 150 * 10);
  });

  it("uses the live EUR rate for display conversion", () => {
    expect(displayValue(1200, "EUR", liveRates)).toBe(100);
  });
});
