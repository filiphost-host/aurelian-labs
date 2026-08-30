import { describe, expect, it } from "vitest";
import {
  buildScorecard,
  convictionBuckets,
  latestDecisionByHolding,
  reviewQueue,
  thesisCoverage,
} from "@/lib/judgment";
import type { Holding, HoldingDecision, LedgerPosition } from "@/lib/types";

const today = "2026-08-10";

function holding(id: string, name: string, ticker: string | null = null): Holding {
  return {
    id,
    asset_type: "stock",
    ticker,
    name,
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
    price_provenance: { source: "Test", as_of: today, status: "manual" },
  };
}

function position(id: string, name: string, valueNok: number, costNok: number, quantity = 10): LedgerPosition {
  return {
    holding: holding(id, name, name.slice(0, 4).toUpperCase()),
    quantity,
    averageCost: 100,
    costNok,
    marketValueNok: valueNok,
    unrealizedGainNok: valueNok - costNok,
    realizedGainNok: 0,
  };
}

function decision(overrides: Partial<HoldingDecision> & { holding_id: string }): HoldingDecision {
  return {
    id: crypto.randomUUID(),
    status: "hold",
    thesis: "A recorded thesis.",
    reason_for_ownership: "",
    return_drivers: "",
    risks: "A recorded risk.",
    conviction: 3,
    review_date: null,
    note: null,
    recorded_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("latestDecisionByHolding", () => {
  it("keeps only the most recent entry per holding", () => {
    const latest = latestDecisionByHolding([
      decision({ holding_id: "a", conviction: 2, recorded_at: "2025-01-01T00:00:00.000Z" }),
      decision({ holding_id: "a", conviction: 5, recorded_at: "2026-01-01T00:00:00.000Z" }),
      decision({ holding_id: "b", conviction: 1, recorded_at: "2024-01-01T00:00:00.000Z" }),
    ]);
    expect(latest.get("a")?.conviction).toBe(5);
    expect(latest.get("b")?.conviction).toBe(1);
  });

  it("compares timestamps as instants, not as text", () => {
    // Postgres omits the fraction when it is zero; text ordering gets this backwards.
    const latest = latestDecisionByHolding([
      decision({ holding_id: "a", conviction: 2, recorded_at: "2026-01-01T09:00:00.123456+00:00" }),
      decision({ holding_id: "a", conviction: 5, recorded_at: "2026-01-01T09:00:01+00:00" }),
    ]);
    expect(latest.get("a")?.conviction).toBe(5);
  });
});

describe("buildScorecard", () => {
  const positions = [position("a", "Alpha", 6000, 4000), position("b", "Beta", 2000, 2500)];

  it("joins conviction to the position and measures its return and weight", () => {
    const rows = buildScorecard(positions, [decision({ holding_id: "a", conviction: 5 })], today);
    expect(rows[0]).toMatchObject({ holdingId: "a", conviction: 5, thesisRecorded: true, risksRecorded: true });
    expect(rows[0].unrealizedReturnPercent).toBeCloseTo(50, 6);
    expect(rows[0].weightPercent).toBeCloseTo(75, 6);
    expect(rows[1]).toMatchObject({ holdingId: "b", conviction: null });
    expect(rows[1].unrealizedReturnPercent).toBeCloseTo(-20, 6);
  });

  it("classifies the review date against today", () => {
    const rows = buildScorecard(
      [position("a", "Alpha", 100, 100), position("b", "Beta", 90, 100), position("c", "Gamma", 80, 100)],
      [
        decision({ holding_id: "a", review_date: "2026-07-01" }),
        decision({ holding_id: "b", review_date: "2026-09-01" }),
        decision({ holding_id: "c", review_date: "2027-01-01" }),
      ],
      today,
    );
    const byId = new Map(rows.map((row) => [row.holdingId, row]));
    expect(byId.get("a")?.reviewState).toBe("overdue");
    expect(byId.get("a")?.daysUntilReview).toBe(-40);
    expect(byId.get("b")?.reviewState).toBe("due-soon");
    expect(byId.get("c")?.reviewState).toBe("scheduled");
  });

  it("separates a position never written about from a decision with no review date", () => {
    expect(buildScorecard([position("a", "Alpha", 100, 100)], [], today)[0]).toMatchObject({
      reviewState: "no-decision",
      hasDecision: false,
      thesisRecorded: false,
      conviction: null,
    });
    expect(buildScorecard(
      [position("a", "Alpha", 100, 100)],
      [decision({ holding_id: "a", review_date: null })],
      today,
    )[0]).toMatchObject({ reviewState: "undated", hasDecision: true });
  });

  it("reports no return for a position with no usable price rather than a total loss", () => {
    const unpriced = position("a", "Alpha", 0, 5000);
    unpriced.holding.market_price = null;
    const row = buildScorecard([unpriced], [decision({ holding_id: "a", conviction: 5 })], today)[0];
    expect(row.priced).toBe(false);
    expect(row.unrealizedReturnPercent).toBeNull();
  });

  it("treats a review date it cannot read as undated instead of scheduled", () => {
    const rows = buildScorecard(
      [position("a", "Alpha", 100, 100)],
      [decision({ holding_id: "a", review_date: "2026-09" })],
      today,
    );
    expect(rows[0].reviewState).toBe("undated");
  });

  it("keeps a negative position value out of the weight base", () => {
    const rows = buildScorecard(
      [position("a", "Alpha", 10000, 5000), position("b", "Beta", -6000, 5000)],
      [],
      today,
    );
    expect(rows[0].weightPercent).toBeCloseTo(100, 6);
    expect(rows[1].weightPercent).toBe(0);
  });

  it("carries realized gains separately rather than blending them into the return", () => {
    const partial = position("a", "Alpha", 1000, 2000);
    partial.realizedGainNok = 16000;
    const row = buildScorecard([partial], [], today)[0];
    expect(row.realizedGainNok).toBe(16000);
    expect(row.unrealizedReturnPercent).toBeCloseTo(-50, 6);
  });

  it("leaves closed positions out", () => {
    expect(buildScorecard([position("a", "Alpha", 0, 0, 0)], [], today)).toHaveLength(0);
  });

  it("reports no return when there is no cost to measure against", () => {
    expect(buildScorecard([position("a", "Alpha", 500, 0)], [], today)[0].unrealizedReturnPercent).toBeNull();
  });
});

describe("convictionBuckets", () => {
  it("groups money and outcomes by the conviction recorded", () => {
    const rows = buildScorecard(
      [position("a", "Alpha", 6000, 4000), position("b", "Beta", 3000, 3000), position("c", "Gamma", 1000, 2000)],
      [
        decision({ holding_id: "a", conviction: 5 }),
        decision({ holding_id: "b", conviction: 5 }),
        decision({ holding_id: "c", conviction: 2 }),
      ],
      today,
    );
    const buckets = convictionBuckets(rows);
    expect(buckets[0]).toMatchObject({ conviction: 5, positions: 2 });
    expect(buckets[0].averageReturnPercent).toBeCloseTo(25, 6);
    expect(buckets[0].positiveShare).toBeCloseTo(50, 6);
    expect(buckets[0].weightPercent).toBeCloseTo(90, 6);
    expect(buckets[1]).toMatchObject({ conviction: 2, positions: 1 });
    expect(buckets[1].averageReturnPercent).toBeCloseTo(-50, 6);
  });

  it("ignores positions with no recorded conviction", () => {
    const rows = buildScorecard([position("a", "Alpha", 100, 100)], [], today);
    expect(convictionBuckets(rows)).toEqual([]);
  });
});

describe("reviewQueue", () => {
  it("splits the positions by how urgently they need a review", () => {
    const rows = buildScorecard(
      [position("a", "Alpha", 100, 100), position("b", "Beta", 100, 100), position("c", "Gamma", 100, 100)],
      [
        decision({ holding_id: "a", review_date: "2026-06-01" }),
        decision({ holding_id: "b", review_date: "2026-08-20" }),
      ],
      today,
    );
    const queue = reviewQueue(rows);
    expect(queue.overdue.map((row) => row.holdingId)).toEqual(["a"]);
    expect(queue.dueSoon.map((row) => row.holdingId)).toEqual(["b"]);
    expect(queue.noDecision.map((row) => row.holdingId)).toEqual(["c"]);
    expect(queue.undated).toEqual([]);
  });
});

describe("thesisCoverage", () => {
  it("measures coverage by money, not by count", () => {
    const rows = buildScorecard(
      [position("a", "Alpha", 9000, 9000), position("b", "Beta", 1000, 1000)],
      [decision({ holding_id: "a" })],
      today,
    );
    expect(thesisCoverage(rows)).toMatchObject({
      withThesisPercent: 90,
      withRisksPercent: 90,
      withoutThesis: 1,
      totalPositions: 2,
    });
  });

  it("counts an empty thesis as missing", () => {
    const rows = buildScorecard(
      [position("a", "Alpha", 100, 100)],
      [decision({ holding_id: "a", thesis: "   ", risks: "" })],
      today,
    );
    expect(thesisCoverage(rows).withThesisPercent).toBe(0);
    expect(thesisCoverage(rows).withRisksPercent).toBe(0);
  });
});
