import { describe, expect, it } from "vitest";
import {
  annualizeReturn,
  concentration,
  dividendsByYear,
  drawdown,
  flowSummary,
  fxAttribution,
  snapshotSpanYears,
} from "@/lib/analytics";
import type { Holding, PortfolioSnapshot, Transaction } from "@/lib/types";

const rates = { NOK: 1, USD: 10, EUR: 12 };

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: "holding-1",
    asset_type: "stock",
    ticker: "TEST",
    name: "Test Holding",
    quantity: 10,
    average_cost: 100,
    market_price: 150,
    currency: "NOK",
    country: "Norway",
    sector: "Industrials",
    region: "Europe",
    account_note: null,
    manual_value_nok: null,
    factor_exposures: {},
    issuer: null,
    coupon_rate: null,
    maturity_date: null,
    face_value: null,
    yield_estimate: null,
    duration_estimate: null,
    credit_quality: null,
    seniority: null,
    price_provenance: { source: "Test", as_of: "2026-08-01", status: "manual" },
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    holding_id: "holding-1",
    type: "buy",
    occurred_at: "2024-01-01",
    quantity: 10,
    unit_price: 100,
    amount: null,
    fee: 0,
    currency: "NOK",
    fx_to_nok: 1,
    split_ratio: null,
    note: null,
    ...overrides,
  };
}

function snapshot(date: string, value: number): PortfolioSnapshot {
  return { id: date, snapshot_date: date, total_value_nok: value, external_flow_nok: 0, source: "calculated" };
}

describe("snapshotSpanYears", () => {
  it("measures the years covered by the stored snapshots", () => {
    expect(snapshotSpanYears([snapshot("2024-01-01", 100), snapshot("2026-01-01", 121)])).toBeCloseTo(2, 2);
  });

  it("returns null when there is no span", () => {
    expect(snapshotSpanYears([])).toBeNull();
    expect(snapshotSpanYears([snapshot("2024-01-01", 100)])).toBeNull();
  });
});

describe("annualizeReturn", () => {
  it("turns a total return into a per-year rate", () => {
    expect(annualizeReturn(21, 2)).toBeCloseTo(10, 6);
    expect(annualizeReturn(97.5, 6.13)).toBeCloseTo(11.7, 1);
  });

  it("leaves a one-year return unchanged", () => {
    expect(annualizeReturn(8, 1)).toBeCloseTo(8, 6);
  });

  it("returns null when it cannot be annualised", () => {
    expect(annualizeReturn(null, 2)).toBeNull();
    expect(annualizeReturn(10, null)).toBeNull();
    expect(annualizeReturn(10, 0)).toBeNull();
    expect(annualizeReturn(-150, 2)).toBeNull();
  });
});

describe("drawdown", () => {
  it("measures the deepest fall from a peak and reports where it happened", () => {
    const result = drawdown([
      snapshot("2024-01-01", 100),
      snapshot("2024-06-01", 150),
      snapshot("2024-12-01", 90),
      snapshot("2025-06-01", 120),
    ]);
    expect(result.maxDrawdownPercent).toBeCloseTo(-40, 6);
    expect(result.maxDrawdownAt).toBe("2024-12-01");
    expect(result.peakAt).toBe("2024-06-01");
    expect(result.currentDrawdownPercent).toBeCloseTo(-20, 6);
    expect(result.recovered).toBe(false);
  });

  it("reports a portfolio at a fresh high as recovered", () => {
    const result = drawdown([snapshot("2024-01-01", 100), snapshot("2024-06-01", 80), snapshot("2025-01-01", 130)]);
    expect(result.maxDrawdownPercent).toBeCloseTo(-20, 6);
    expect(result.currentDrawdownPercent).toBeCloseTo(0, 6);
    expect(result.recovered).toBe(true);
  });

  it("has nothing to report without snapshots", () => {
    expect(drawdown([])).toMatchObject({ maxDrawdownPercent: null, maxDrawdownAt: null, series: [] });
  });

  it("treats a portfolio that has only risen as recovered", () => {
    expect(drawdown([snapshot("2024-01-01", 100), snapshot("2025-01-01", 150)]).recovered).toBe(true);
  });

  it("keeps a total loss in the series rather than hiding it", () => {
    const result = drawdown([snapshot("2024-01-01", 100), snapshot("2024-06-01", 0), snapshot("2025-01-01", 120)]);
    expect(result.series).toHaveLength(3);
    expect(result.maxDrawdownPercent).toBeCloseTo(-100, 6);
  });
});

describe("concentration", () => {
  it("measures the largest weights and the effective number of holdings", () => {
    const result = concentration([
      holding({ id: "a", quantity: 1, market_price: 500 }),
      holding({ id: "b", quantity: 1, market_price: 300 }),
      holding({ id: "c", quantity: 1, market_price: 200 }),
    ], rates);
    expect(result.topWeightPercent).toBeCloseTo(50, 6);
    expect(result.topFiveWeightPercent).toBeCloseTo(100, 6);
    // 1 / (0.5^2 + 0.3^2 + 0.2^2) = 1 / 0.38
    expect(result.effectiveHoldings).toBeCloseTo(2.6316, 3);
  });

  it("counts equal positions as their full number", () => {
    const equal = concentration([
      holding({ id: "a", quantity: 1, market_price: 100 }),
      holding({ id: "b", quantity: 1, market_price: 100 }),
      holding({ id: "c", quantity: 1, market_price: 100 }),
      holding({ id: "d", quantity: 1, market_price: 100 }),
    ], rates);
    expect(equal.effectiveHoldings).toBeCloseTo(4, 6);
  });

  it("returns nothing measurable for an empty portfolio", () => {
    expect(concentration([], rates)).toMatchObject({ effectiveHoldings: null, positions: [] });
  });

  it("counts positions it cannot value instead of quietly dropping them", () => {
    const result = concentration([
      holding({ id: "a", quantity: 1, market_price: 1000 }),
      holding({ id: "b", quantity: 1, market_price: 500, currency: "JPY" }),
      holding({ id: "c", quantity: 1, market_price: null }),
    ], rates);
    expect(result.unpricedCount).toBe(2);
    expect(result.positions).toHaveLength(1);
  });
});

describe("fxAttribution", () => {
  it("splits the gain into what the asset did and what the krone did", () => {
    // 10 shares bought at USD 100 when USD/NOK was 8, now USD 150 with USD/NOK at 10.
    const result = fxAttribution(
      [holding({ currency: "USD", quantity: 10, average_cost: 100, market_price: 150 })],
      [transaction({ currency: "USD", fx_to_nok: 8 })],
      rates,
    );
    expect(result.assetGainNok).toBeCloseTo(5000, 6);
    expect(result.currencyGainNok).toBeCloseTo(2000, 6);
    // The two parts must reconstruct value minus cost exactly.
    expect(result.attributedGainNok).toBeCloseTo(10 * 150 * 10 - 10 * 100 * 8, 6);
    expect(result.coveragePercent).toBeCloseTo(100, 6);
  });

  it("weights the purchase rate across several buys", () => {
    const result = fxAttribution(
      [holding({ currency: "USD", quantity: 20, average_cost: 100, market_price: 100 })],
      [
        transaction({ currency: "USD", quantity: 10, unit_price: 100, fx_to_nok: 8 }),
        transaction({ currency: "USD", quantity: 10, unit_price: 100, fx_to_nok: 9, occurred_at: "2024-06-01" }),
      ],
      rates,
    );
    // Cost rate 8.5, so the currency contributed 20 x 100 x (10 - 8.5).
    expect(result.currencyGainNok).toBeCloseTo(3000, 6);
    expect(result.assetGainNok).toBeCloseTo(0, 6);
  });

  it("refuses a foreign holding where only some purchases recorded a rate", () => {
    const result = fxAttribution(
      [holding({ currency: "USD", quantity: 20, average_cost: 100, market_price: 150 })],
      [
        transaction({ currency: "USD", quantity: 10, unit_price: 100, fx_to_nok: 8 }),
        transaction({ currency: "USD", quantity: 10, unit_price: 100, fx_to_nok: 1, occurred_at: "2024-06-01" }),
      ],
      rates,
    );
    expect(result.coveragePercent).toBe(0);
    expect(result.attributedGainNok).toBe(0);
  });

  it("refuses to attribute a foreign holding whose purchase rate was never recorded", () => {
    const result = fxAttribution(
      [holding({ currency: "USD", quantity: 10, average_cost: 100, market_price: 150 })],
      [transaction({ currency: "USD", fx_to_nok: 1 })],
      rates,
    );
    expect(result.attributedGainNok).toBe(0);
    expect(result.coveragePercent).toBe(0);
    expect(result.unattributedValueNok).toBeCloseTo(15000, 6);
  });

  it("attributes a NOK holding, where a rate of 1 is the real rate", () => {
    const result = fxAttribution([holding()], [transaction()], rates);
    expect(result.assetGainNok).toBeCloseTo(500, 6);
    expect(result.currencyGainNok).toBeCloseTo(0, 6);
    expect(result.coveragePercent).toBeCloseTo(100, 6);
  });

  it("leaves a manually valued holding out of the split", () => {
    const result = fxAttribution(
      [holding({ currency: "USD", manual_value_nok: 50000 })],
      [transaction({ currency: "USD", fx_to_nok: 8 })],
      rates,
    );
    expect(result.coveragePercent).toBe(0);
    expect(result.unattributedValueNok).toBeCloseTo(50000, 6);
  });
});

describe("flowSummary edge cases", () => {
  it("reports growth as unmeasurable when the ledger records no deposits", () => {
    const result = flowSummary([transaction({ type: "buy" })], 12000);
    expect(result.hasContributions).toBe(false);
    expect(result.growthSharePercent).toBeNull();
  });

  it("counts a fee row once when the value appears in both columns", () => {
    const result = flowSummary([
      transaction({ type: "fee", amount: 500, fee: 500, quantity: null, unit_price: null }),
    ], 1000);
    expect(result.feesNok).toBe(500);
  });
});

describe("flowSummary", () => {
  const transactions = [
    transaction({ type: "deposit", holding_id: null, amount: 100000, quantity: null, unit_price: null }),
    transaction({ type: "deposit", holding_id: null, amount: 50000, quantity: null, unit_price: null }),
    transaction({ type: "withdrawal", holding_id: null, amount: 20000, quantity: null, unit_price: null }),
    transaction({ type: "dividend", amount: 2000, quantity: null, unit_price: null }),
    transaction({ type: "fee", amount: 500, quantity: null, unit_price: null }),
    transaction({ type: "buy", fee: 29 }),
  ];

  it("separates money put in from money the portfolio made", () => {
    const result = flowSummary(transactions, 200000);
    expect(result.depositsNok).toBe(150000);
    expect(result.withdrawalsNok).toBe(20000);
    expect(result.netContributedNok).toBe(130000);
    expect(result.growthNok).toBe(70000);
    expect(result.growthSharePercent).toBeCloseTo(35, 6);
  });

  it("adds trading fees to fee entries as the total cost drag", () => {
    expect(flowSummary(transactions, 200000).feesNok).toBe(529);
  });

  it("converts foreign cash flows with the recorded rate", () => {
    const result = flowSummary([
      transaction({ type: "deposit", holding_id: null, amount: 1000, currency: "USD", fx_to_nok: 10, quantity: null, unit_price: null }),
    ], 20000);
    expect(result.depositsNok).toBe(10000);
  });
});

describe("dividendsByYear", () => {
  it("totals dividends per calendar year in date order", () => {
    expect(dividendsByYear([
      transaction({ type: "dividend", occurred_at: "2025-03-01", amount: 100, quantity: null, unit_price: null }),
      transaction({ type: "dividend", occurred_at: "2025-09-01", amount: 150, quantity: null, unit_price: null }),
      transaction({ type: "dividend", occurred_at: "2024-05-01", amount: 80, quantity: null, unit_price: null }),
      transaction({ type: "buy" }),
    ])).toEqual([
      { year: "2024", amountNok: 80 },
      { year: "2025", amountNok: 250 },
    ]);
  });
});
