import type { HoldingDecision, LedgerPosition } from "@/lib/types";

export type ReviewState = "overdue" | "due-soon" | "scheduled" | "undated" | "no-decision";

export type DecisionRow = {
  holdingId: string;
  name: string;
  ticker: string | null;
  hasDecision: boolean;
  conviction: number | null;
  status: HoldingDecision["status"] | null;
  thesisRecorded: boolean;
  risksRecorded: boolean;
  reviewDate: string | null;
  reviewState: ReviewState;
  daysUntilReview: number | null;
  recordedAt: string | null;
  valueNok: number;
  costNok: number;
  realizedGainNok: number;
  /** Null when the position has no usable price, rather than reading as a total loss. */
  unrealizedReturnPercent: number | null;
  priced: boolean;
  weightPercent: number;
};

export type ConvictionBucket = {
  conviction: number;
  positions: number;
  valueNok: number;
  weightPercent: number;
  pricedPositions: number;
  averageReturnPercent: number | null;
  positiveShare: number | null;
};

export type ThesisCoverage = {
  withThesisPercent: number;
  withRisksPercent: number;
  withoutThesis: number;
  totalPositions: number;
};

const dayMs = 86_400_000;

function calendarDays(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const elapsed = Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / dayMs,
  );
  // A date this cannot read must not quietly become "scheduled".
  return Number.isFinite(elapsed) ? elapsed : null;
}

function recordedAtValue(decision: HoldingDecision) {
  const parsed = Date.parse(decision.recorded_at);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/** The most recent decision recorded for each holding. */
export function latestDecisionByHolding(decisions: HoldingDecision[]) {
  const latest = new Map<string, HoldingDecision>();
  for (const decision of decisions) {
    const current = latest.get(decision.holding_id);
    if (!current || recordedAtValue(decision) >= recordedAtValue(current)) {
      latest.set(decision.holding_id, decision);
    }
  }
  return latest;
}

/**
 * Joins each open position to the conviction recorded for it.
 *
 * The return measured is unrealized, over the whole time the position has been held
 * rather than since the decision was written, because measuring from the decision
 * date needs a stored price for that day. Realized gains are carried separately
 * instead of being blended into a single percentage that would describe neither.
 */
export function buildScorecard(
  positions: LedgerPosition[],
  decisions: HoldingDecision[],
  today: string,
  dueSoonDays = 45,
): DecisionRow[] {
  const latest = latestDecisionByHolding(decisions);
  const open = positions.filter((position) => position.quantity > 0);
  const total = open.reduce((sum, position) => sum + Math.max(0, position.marketValueNok), 0);

  return open.map((position) => {
    const decision = latest.get(position.holding.id) ?? null;
    const reviewDate = decision?.review_date ?? null;
    const daysUntilReview = reviewDate ? calendarDays(today, reviewDate) : null;
    const reviewState: ReviewState = !decision
      ? "no-decision"
      : daysUntilReview === null
        ? "undated"
        : daysUntilReview < 0
          ? "overdue"
          : daysUntilReview <= dueSoonDays
            ? "due-soon"
            : "scheduled";

    // A holding with no price is valued at zero by the ledger; that is a missing
    // price, not a wipeout, so it carries no return rather than minus one hundred.
    const priced = position.holding.manual_value_nok !== null || position.holding.market_price !== null;

    return {
      holdingId: position.holding.id,
      name: position.holding.name,
      ticker: position.holding.ticker,
      hasDecision: Boolean(decision),
      conviction: decision?.conviction ?? null,
      status: decision?.status ?? null,
      thesisRecorded: Boolean(decision?.thesis?.trim()),
      risksRecorded: Boolean(decision?.risks?.trim()),
      reviewDate,
      reviewState,
      daysUntilReview,
      recordedAt: decision?.recorded_at ?? null,
      valueNok: position.marketValueNok,
      costNok: position.costNok,
      realizedGainNok: position.realizedGainNok,
      unrealizedReturnPercent: priced && position.costNok > 0
        ? ((position.marketValueNok - position.costNok) / position.costNok) * 100
        : null,
      priced,
      weightPercent: total > 0 ? (Math.max(0, position.marketValueNok) / total) * 100 : 0,
    };
  }).sort((left, right) => right.valueNok - left.valueNok);
}

/** Money and outcomes grouped by the conviction that was recorded for them. */
export function convictionBuckets(rows: DecisionRow[]): ConvictionBucket[] {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.valueNok), 0);
  const buckets = new Map<number, DecisionRow[]>();
  for (const row of rows) {
    if (row.conviction === null) continue;
    buckets.set(row.conviction, [...(buckets.get(row.conviction) ?? []), row]);
  }

  return [...buckets.entries()]
    .map(([conviction, entries]) => {
      const scored = entries.filter((entry) => entry.unrealizedReturnPercent !== null);
      const valueNok = entries.reduce((sum, entry) => sum + entry.valueNok, 0);
      return {
        conviction,
        positions: entries.length,
        valueNok,
        weightPercent: total > 0 ? (Math.max(0, valueNok) / total) * 100 : 0,
        pricedPositions: scored.length,
        averageReturnPercent: scored.length
          ? scored.reduce((sum, entry) => sum + entry.unrealizedReturnPercent!, 0) / scored.length
          : null,
        positiveShare: scored.length
          ? (scored.filter((entry) => entry.unrealizedReturnPercent! > 0).length / scored.length) * 100
          : null,
      };
    })
    .sort((left, right) => right.conviction - left.conviction);
}

export function reviewQueue(rows: DecisionRow[]) {
  const byUrgency = (left: DecisionRow, right: DecisionRow) =>
    (left.daysUntilReview ?? 0) - (right.daysUntilReview ?? 0);
  return {
    overdue: rows.filter((row) => row.reviewState === "overdue").sort(byUrgency),
    dueSoon: rows.filter((row) => row.reviewState === "due-soon").sort(byUrgency),
    undated: rows.filter((row) => row.reviewState === "undated"),
    noDecision: rows.filter((row) => row.reviewState === "no-decision"),
  };
}

export function thesisCoverage(rows: DecisionRow[]): ThesisCoverage {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.valueNok), 0);
  const valueWith = (predicate: (row: DecisionRow) => boolean) =>
    rows.filter(predicate).reduce((sum, row) => sum + Math.max(0, row.valueNok), 0);

  return {
    withThesisPercent: total > 0 ? (valueWith((row) => row.thesisRecorded) / total) * 100 : 0,
    withRisksPercent: total > 0 ? (valueWith((row) => row.risksRecorded) / total) * 100 : 0,
    withoutThesis: rows.filter((row) => !row.thesisRecorded).length,
    totalPositions: rows.length,
  };
}
