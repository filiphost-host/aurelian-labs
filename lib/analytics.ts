import { fallbackFxToNok, fxRate, holdingValueNok } from "@/lib/calculations";
import type { Holding, PortfolioSnapshot, Transaction } from "@/lib/types";

export type DrawdownPoint = { date: string; valueNok: number; drawdownPercent: number };

export type DrawdownSummary = {
  series: DrawdownPoint[];
  maxDrawdownPercent: number | null;
  maxDrawdownAt: string | null;
  peakAt: string | null;
  currentDrawdownPercent: number | null;
  recovered: boolean;
};

export type ConcentrationSummary = {
  topWeightPercent: number | null;
  topFiveWeightPercent: number | null;
  effectiveHoldings: number | null;
  unpricedCount: number;
  positions: Array<{ id: string; label: string; name: string; valueNok: number; weightPercent: number }>;
};

export type FxAttribution = {
  assetGainNok: number;
  currencyGainNok: number;
  attributedGainNok: number;
  attributedValueNok: number;
  unattributedValueNok: number;
  unpricedCount: number;
  coveragePercent: number;
  currencies: Array<{ currency: string; assetGainNok: number; currencyGainNok: number; costFx: number; currentFx: number }>;
};

export type FlowSummary = {
  depositsNok: number;
  withdrawalsNok: number;
  netContributedNok: number;
  growthNok: number;
  dividendsNok: number;
  feesNok: number;
  growthSharePercent: number | null;
  /** False when the ledger records no deposits, which makes growth unmeasurable. */
  hasContributions: boolean;
};

/** A position the app cannot value: no price, or no exchange rate for its currency. */
function isUnpriced(holding: Holding, rates: Record<string, number>) {
  if (holding.manual_value_nok !== null) return false;
  if (holding.quantity <= 0) return false;
  return holding.market_price === null || !fxRate(holding.currency, rates);
}

/** Years between the first and last stored snapshot. */
export function snapshotSpanYears(snapshots: PortfolioSnapshot[]) {
  const ordered = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const first = ordered[0];
  const last = ordered.at(-1);
  if (!first || !last || first === last) return null;
  const years = (new Date(last.snapshot_date).getTime() - new Date(first.snapshot_date).getTime()) / 31_557_600_000;
  return years > 0 ? years : null;
}

/**
 * Turns a total return over a period into a per-year rate, so it can sit beside an
 * annualised figure such as XIRR without inviting a false comparison.
 */
export function annualizeReturn(totalPercent: number | null, years: number | null) {
  if (totalPercent === null || years === null || years <= 0) return null;
  const growth = 1 + totalPercent / 100;
  if (growth <= 0) return null;
  return (growth ** (1 / years) - 1) * 100;
}

/**
 * Peak-to-trough decline through the stored snapshots. With sparse snapshots this
 * describes the observations that exist, not every day the market moved.
 */
export function drawdown(snapshots: PortfolioSnapshot[]): DrawdownSummary {
  // A snapshot of zero is a total loss, not a missing observation, so it stays in.
  const ordered = [...snapshots]
    .filter((snapshot) => Number.isFinite(snapshot.total_value_nok) && snapshot.total_value_nok >= 0)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  let peak = 0;
  let peakDate: string | null = null;
  let worst = 0;
  let worstDate: string | null = null;
  let worstPeakDate: string | null = null;

  const series = ordered.map((snapshot) => {
    if (snapshot.total_value_nok > peak) {
      peak = snapshot.total_value_nok;
      peakDate = snapshot.snapshot_date;
    }
    const drawdownPercent = peak > 0 ? ((snapshot.total_value_nok - peak) / peak) * 100 : 0;
    if (drawdownPercent < worst) {
      worst = drawdownPercent;
      worstDate = snapshot.snapshot_date;
      worstPeakDate = peakDate;
    }
    return { date: snapshot.snapshot_date, valueNok: snapshot.total_value_nok, drawdownPercent };
  });

  const current = series.at(-1)?.drawdownPercent ?? null;
  return {
    series,
    maxDrawdownPercent: worstDate === null ? null : worst,
    maxDrawdownAt: worstDate,
    peakAt: worstPeakDate,
    currentDrawdownPercent: current,
    recovered: current !== null && current > -0.05,
  };
}

/**
 * How much of the portfolio sits in its largest positions. The effective number of
 * holdings is 1/HHI: twenty positions where one holds most of the money behave
 * like far fewer.
 */
export function concentration(
  holdings: Holding[],
  rates: Record<string, number> = fallbackFxToNok,
): ConcentrationSummary {
  const unpricedCount = holdings.filter((holding) => isUnpriced(holding, rates)).length;
  const positions = holdings
    .map((holding) => ({
      id: holding.id,
      label: holding.ticker?.trim() || holding.name,
      name: holding.name,
      valueNok: holdingValueNok(holding, rates),
    }))
    .filter((position) => position.valueNok > 0)
    .sort((left, right) => right.valueNok - left.valueNok);

  const total = positions.reduce((sum, position) => sum + position.valueNok, 0);
  if (total <= 0) {
    return { topWeightPercent: null, topFiveWeightPercent: null, effectiveHoldings: null, unpricedCount, positions: [] };
  }

  const weighted = positions.map((position) => ({
    ...position,
    weightPercent: (position.valueNok / total) * 100,
  }));
  const herfindahl = weighted.reduce((sum, position) => sum + (position.weightPercent / 100) ** 2, 0);

  return {
    topWeightPercent: weighted[0]?.weightPercent ?? null,
    topFiveWeightPercent: weighted.slice(0, 5).reduce((sum, position) => sum + position.weightPercent, 0),
    effectiveHoldings: herfindahl > 0 ? 1 / herfindahl : null,
    unpricedCount,
    positions: weighted,
  };
}

/**
 * Splits the unrealized gain into what the asset did in its own currency and what
 * the krone did to it.
 *
 * For one position: value - cost = q(p - c)·f_now + q·c·(f_now - f_cost). The first
 * term is the asset, the second is the currency. A position is only attributed when
 * its purchase exchange rate is actually known: a foreign holding whose transactions
 * all record a rate of 1 has no usable cost rate, and guessing one would invent the
 * very number this is meant to measure.
 */
export function fxAttribution(
  holdings: Holding[],
  transactions: Transaction[],
  rates: Record<string, number> = fallbackFxToNok,
): FxAttribution {
  const byCurrency = new Map<string, { assetGainNok: number; currencyGainNok: number; costFx: number; currentFx: number }>();
  let assetGainNok = 0;
  let currencyGainNok = 0;
  let attributedValueNok = 0;
  let unattributedValueNok = 0;
  const unpricedCount = holdings.filter((holding) => isUnpriced(holding, rates)).length;

  for (const holding of holdings) {
    const currency = holding.currency.toUpperCase();
    const currentFx = fxRate(currency, rates);
    const quantity = holding.quantity;
    const price = holding.market_price;
    const valueNok = holdingValueNok(holding, rates);

    if (!currentFx || price === null || quantity <= 0 || holding.manual_value_nok !== null) {
      unattributedValueNok += valueNok;
      continue;
    }

    const purchases = transactions.filter((transaction) =>
      transaction.holding_id === holding.id &&
      (transaction.type === "buy" || transaction.type === "opening_balance") &&
      (transaction.quantity ?? 0) > 0);
    const weight = purchases.reduce((sum, transaction) => sum + (transaction.quantity ?? 0) * (transaction.unit_price ?? 0), 0);
    const costFx = weight > 0
      ? purchases.reduce((sum, transaction) =>
          sum + (transaction.fx_to_nok || 1) * (transaction.quantity ?? 0) * (transaction.unit_price ?? 0), 0) / weight
      : null;

    // For a foreign holding a recorded rate of exactly 1 means no rate was recorded.
    // One such purchase is enough to corrupt the weighted cost rate, so the whole
    // position is left out rather than averaged into a number that looks real.
    const everyRateRecorded = currency === "NOK" ||
      purchases.every((transaction) => (transaction.fx_to_nok || 1) !== 1);
    const usable = costFx !== null && costFx > 0 && everyRateRecorded;
    if (!usable) {
      unattributedValueNok += valueNok;
      continue;
    }

    const assetGain = quantity * (price - holding.average_cost) * currentFx;
    const currencyGain = quantity * holding.average_cost * (currentFx - costFx!);
    assetGainNok += assetGain;
    currencyGainNok += currencyGain;
    attributedValueNok += valueNok;

    const entry = byCurrency.get(currency) ?? { assetGainNok: 0, currencyGainNok: 0, costFx: costFx!, currentFx };
    entry.assetGainNok += assetGain;
    entry.currencyGainNok += currencyGain;
    byCurrency.set(currency, entry);
  }

  const totalValue = attributedValueNok + unattributedValueNok;
  return {
    assetGainNok,
    currencyGainNok,
    attributedGainNok: assetGainNok + currencyGainNok,
    attributedValueNok,
    unattributedValueNok,
    unpricedCount,
    coveragePercent: totalValue > 0 && unpricedCount === 0 ? (attributedValueNok / totalValue) * 100 : 0,
    currencies: [...byCurrency.entries()]
      .map(([currency, entry]) => ({ currency, ...entry }))
      .sort((left, right) => Math.abs(right.currencyGainNok) - Math.abs(left.currencyGainNok)),
  };
}

/** Money put in versus money the portfolio made, plus the income and costs along the way. */
export function flowSummary(transactions: Transaction[], currentValueNok: number): FlowSummary {
  let depositsNok = 0;
  let withdrawalsNok = 0;
  let dividendsNok = 0;
  let feesNok = 0;

  let hasContributions = false;

  for (const transaction of transactions) {
    const fx = Number(transaction.fx_to_nok) || 1;
    const amount = (Number(transaction.amount) || 0) * fx;
    const fee = (Number(transaction.fee) || 0) * fx;

    if (transaction.type === "fee") {
      // A fee row carries its value in either column; the ledger reads it the same way.
      feesNok += amount || fee;
    } else {
      feesNok += fee;
      if (transaction.type === "deposit") {
        depositsNok += amount;
        hasContributions = true;
      } else if (transaction.type === "withdrawal") {
        withdrawalsNok += amount;
        hasContributions = true;
      } else if (transaction.type === "dividend") dividendsNok += amount;
    }
  }

  const netContributedNok = depositsNok - withdrawalsNok;
  const growthNok = currentValueNok - netContributedNok;
  return {
    depositsNok,
    withdrawalsNok,
    netContributedNok,
    growthNok,
    dividendsNok,
    feesNok,
    growthSharePercent: hasContributions && currentValueNok > 0 ? (growthNok / currentValueNok) * 100 : null,
    hasContributions,
  };
}

/** Dividends received per calendar year, in NOK. */
export function dividendsByYear(transactions: Transaction[]) {
  const years = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== "dividend") continue;
    const year = transaction.occurred_at.slice(0, 4);
    const value = (Number(transaction.amount) || 0) * (Number(transaction.fx_to_nok) || 1);
    years.set(year, (years.get(year) ?? 0) + value);
  }
  return [...years.entries()]
    .map(([year, amountNok]) => ({ year, amountNok }))
    .sort((left, right) => left.year.localeCompare(right.year));
}
