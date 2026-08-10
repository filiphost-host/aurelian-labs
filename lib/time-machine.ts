import type { BenchmarkPricePoint } from "@/lib/portfolio-story";
import type { FactorKey, LedgerPosition } from "@/lib/types";

/**
 * Real windows in market history, identified by date only. What happened in each
 * one is read from the benchmark closes the daily refresh stores, so the size of
 * every move comes from data rather than from memory.
 */
export type HistoricalWindow = {
  id: string;
  name: string;
  description: string;
  start: string;
  end: string;
};

export const historicalWindows: HistoricalWindow[] = [
  {
    id: "covid-crash",
    name: "The 2020 pandemic fall",
    description: "From the pre-pandemic high to the low five weeks later.",
    start: "2020-02-19",
    end: "2020-03-23",
  },
  {
    id: "covid-recovery",
    name: "The 2020 recovery",
    description: "From that low to the end of the year.",
    start: "2020-03-23",
    end: "2020-12-31",
  },
  {
    id: "bear-2022",
    name: "The 2022 decline",
    description: "From the start of 2022 to the October low.",
    start: "2022-01-03",
    end: "2022-10-12",
  },
  {
    id: "since-2023",
    name: "Everything since 2023",
    description: "The stretch that followed, up to the latest stored close.",
    start: "2023-01-03",
    end: "2100-01-01",
  },
];

export type WindowMove = {
  startDate: string;
  endDate: string;
  startClose: number;
  endClose: number;
  returnPercent: number;
  /** True when stored history does not reach the whole window. */
  truncated: boolean;
};

export type ReplayedPosition = {
  holdingId: string;
  name: string;
  ticker: string | null;
  valueNok: number;
  exposure: number;
  impactPercent: number;
  impactNok: number;
};

export type WindowReplay = {
  move: WindowMove | null;
  positions: ReplayedPosition[];
  totalValueNok: number;
  impactNok: number;
  impactPercent: number;
  coveredValueNok: number;
  uncoveredCount: number;
};

/**
 * Broad-market factors only. A sector exposure such as technology describes
 * sensitivity to that sector, not to the index being replayed, and treating it as
 * an index beta overstates every move.
 */
const equityFactors: FactorKey[] = ["usEquity", "globalEquity", "europeEquity"];

function closeOnOrBefore(prices: BenchmarkPricePoint[], date: string) {
  let match: BenchmarkPricePoint | null = null;
  for (const point of prices) {
    if (point.price_date.localeCompare(date) <= 0) match = point;
    else break;
  }
  return match;
}

function closeOnOrAfter(prices: BenchmarkPricePoint[], date: string) {
  return prices.find((point) => point.price_date.localeCompare(date) >= 0) ?? null;
}

/** What the benchmark actually did between two dates, from stored closes. */
export function windowMove(prices: BenchmarkPricePoint[], window: HistoricalWindow): WindowMove | null {
  const ordered = [...prices]
    .filter((point) => Number.isFinite(Number(point.close)) && Number(point.close) > 0)
    .sort((left, right) => left.price_date.localeCompare(right.price_date));
  if (ordered.length < 2) return null;

  // The first close on or after the start, so a window beginning before the stored
  // history is not silently measured from the wrong day.
  const start = closeOnOrAfter(ordered, window.start);
  const end = closeOnOrBefore(ordered, window.end);
  if (!start || !end || start.price_date.localeCompare(end.price_date) >= 0) return null;

  // More than a week short at either end means the stored history does not cover
  // what the window claims, and the panel has to say so.
  const week = 7 * 86_400_000;
  const requestedEnd = Math.min(Date.parse(window.end), Date.parse(ordered.at(-1)!.price_date));
  const truncated =
    Date.parse(start.price_date) - Date.parse(window.start) > week ||
    requestedEnd - Date.parse(end.price_date) > week;

  return {
    startDate: start.price_date,
    endDate: end.price_date,
    startClose: start.close,
    endClose: end.close,
    returnPercent: ((end.close - start.close) / start.close) * 100,
    truncated,
  };
}

/** The largest equity exposure recorded for a holding, used as its market sensitivity. */
export function equityExposure(exposures: Partial<Record<FactorKey, number>>) {
  const values = equityFactors
    .map((factor) => Number(exposures?.[factor] ?? 0))
    .filter((value) => Number.isFinite(value) && value !== 0);
  return values.length ? Math.max(...values) : 0;
}

/**
 * Holds today's portfolio still and puts it through a real past window.
 *
 * Each position moves with the benchmark in proportion to the equity exposure
 * recorded for it, which is a straight-line assumption and not what any individual
 * share did on those days. Positions with no equity exposure recorded do not move
 * at all and are reported separately rather than counted as unaffected.
 */
export function replayWindow(
  positions: LedgerPosition[],
  prices: BenchmarkPricePoint[],
  window: HistoricalWindow,
): WindowReplay {
  const move = windowMove(prices, window);
  const open = positions.filter((position) => position.quantity > 0 && position.marketValueNok > 0);
  const totalValueNok = open.reduce((sum, position) => sum + position.marketValueNok, 0);

  const replayed = open.map((position) => {
    const exposure = equityExposure(position.holding.factor_exposures ?? {});
    const impactPercent = move ? move.returnPercent * exposure : 0;
    return {
      holdingId: position.holding.id,
      name: position.holding.name,
      ticker: position.holding.ticker,
      valueNok: position.marketValueNok,
      exposure,
      impactPercent,
      impactNok: position.marketValueNok * (impactPercent / 100),
    };
  }).sort((left, right) => left.impactNok - right.impactNok);

  const impactNok = replayed.reduce((sum, position) => sum + position.impactNok, 0);
  const covered = replayed.filter((position) => position.exposure !== 0);

  return {
    move,
    positions: replayed,
    totalValueNok,
    impactNok,
    impactPercent: totalValueNok > 0 ? (impactNok / totalValueNok) * 100 : 0,
    coveredValueNok: covered.reduce((sum, position) => sum + position.valueNok, 0),
    uncoveredCount: replayed.length - covered.length,
  };
}
