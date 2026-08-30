export type PortfolioMilestone = {
  id: string;
  instrument: string;
  ticker: string;
  action: string;
  outcome: string;
  lesson: string;
  status: "closed" | "holding";
  accent: "positive" | "reflection" | "active";
};

export const portfolioMilestones: PortfolioMilestone[] = [
  {
    id: "google-entry",
    instrument: "Alphabet",
    ticker: "GOOGL",
    action: "Bought near USD 210",
    outcome: "The position remains in the portfolio; the current quote is supplied separately by the market-data feed.",
    lesson: "Record what made the entry attractive so later price gains do not rewrite the original thesis.",
    status: "holding",
    accent: "active",
  },
  {
    id: "novo-exit",
    instrument: "Novo Nordisk",
    ticker: "NOVO-B",
    action: "Sold near NOK 1,000",
    outcome: "Exited before the later decline and protected the gain.",
    lesson: "Separate a strong outcome from a repeatable process: write down the valuation, risk, and exit evidence that supported the sale.",
    status: "closed",
    accent: "positive",
  },
  {
    id: "tesla-trade",
    instrument: "Tesla",
    ticker: "TSLA",
    action: "Bought around 550; sold into 750 and 880",
    outcome: "Captured a large part of the upward move through staged exits.",
    lesson: "Predefined exit levels can reduce the temptation to improvise after a sharp move.",
    status: "closed",
    accent: "positive",
  },
  {
    id: "saab-exit",
    instrument: "Saab",
    ticker: "SAAB-B",
    action: "Sold after a profitable holding period",
    outcome: "The share later benefited from Europe's defence-spending re-rating.",
    lesson: "A profitable sale can still carry opportunity cost. Review whether the long-term thesis broke or only the price target was reached.",
    status: "closed",
    accent: "reflection",
  },
  {
    id: "lockheed-exit",
    instrument: "Lockheed Martin",
    ticker: "LMT",
    action: "Closed the position",
    outcome: "Realised the investment and reduced single-contractor exposure.",
    lesson: "Compare the exit thesis with the defence allocation still held indirectly through the S&P 500.",
    status: "closed",
    accent: "reflection",
  },
];

const sp500ReferenceReturn = [0, 24, 8, 31, 56, 78, 91];

export type BenchmarkPricePoint = { price_date: string; close: number };

export type BenchmarkComparison = {
  series: Array<{ date: string; portfolioReturn: number; benchmarkReturn: number | null }>;
  benchmarkSource: "stored" | "estimate";
  benchmarkAsOf: string | null;
  rebasedAt: string | null;
};

export function buildBenchmarkComparison(
  snapshots: Array<{ snapshot_date: string; total_value_nok: number }>,
  benchmarkPrices: BenchmarkPricePoint[] = [],
): BenchmarkComparison {
  const ordered = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const startingValue = ordered[0]?.total_value_nok ?? 0;
  const prices = [...benchmarkPrices]
    .filter((point) => Number.isFinite(Number(point.close)) && Number(point.close) > 0)
    .sort((a, b) => a.price_date.localeCompare(b.price_date));

  const closeOnOrBefore = (date: string) => {
    let match: BenchmarkPricePoint | null = null;
    for (const point of prices) {
      if (point.price_date.localeCompare(date) <= 0) match = point;
      else break;
    }
    return match;
  };

  const portfolioIndexAt = (value: number) => (startingValue > 0 ? (value / startingValue) * 100 : 100);

  let baseline: { close: number; portfolioIndex: number; date: string } | null = null;
  for (const snapshot of ordered) {
    const close = closeOnOrBefore(snapshot.snapshot_date);
    if (close) {
      baseline = {
        close: close.close,
        portfolioIndex: portfolioIndexAt(snapshot.total_value_nok),
        date: snapshot.snapshot_date,
      };
      break;
    }
  }
  const usable = baseline !== null && prices.length >= 2;

  const series = ordered.map((snapshot, index) => {
    const portfolioReturn = portfolioIndexAt(snapshot.total_value_nok) - 100;
    if (!usable) {
      return {
        date: snapshot.snapshot_date,
        portfolioReturn,
        benchmarkReturn: sp500ReferenceReturn[Math.min(index, sp500ReferenceReturn.length - 1)] as number | null,
      };
    }
    const close = closeOnOrBefore(snapshot.snapshot_date);
    return {
      date: snapshot.snapshot_date,
      portfolioReturn,
      benchmarkReturn: close === null
        ? null
        : baseline!.portfolioIndex * (close.close / baseline!.close) - 100,
    };
  });

  return {
    series,
    benchmarkSource: usable ? "stored" : "estimate",
    benchmarkAsOf: usable ? prices.at(-1)?.price_date ?? null : null,
    rebasedAt: usable ? baseline!.date : null,
  };
}
