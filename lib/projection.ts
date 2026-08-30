export type ProjectionInput = {
  startValueNok: number;
  monthlyDepositNok: number;
  years: number;
  expectedReturnPercent: number;
  volatilityPercent: number;
  paths?: number;
};

export type ProjectionYear = {
  year: number;
  contributedNok: number;
  p10Nok: number;
  p50Nok: number;
  p90Nok: number;
};

export type Projection = {
  years: ProjectionYear[];
  finalContributedNok: number;
  finalP10Nok: number;
  finalP50Nok: number;
  finalP90Nok: number;
  paths: number;
};

/**
 * A small deterministic generator. The cone has to be the same every render, or a
 * projection would appear to change on its own each time the panel is opened.
 */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let drawn = Math.imul(state ^ (state >>> 15), 1 | state);
    drawn = (drawn + Math.imul(drawn ^ (drawn >>> 7), 61 | drawn)) ^ drawn;
    return ((drawn ^ (drawn >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller, so the monthly draws are normal rather than uniform. */
function normalDraw(random: () => number) {
  const first = Math.max(random(), Number.EPSILON);
  const second = random();
  return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

function percentile(sorted: number[], fraction: number) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/**
 * Projects the portfolio forward by simulating many monthly paths.
 *
 * This is arithmetic on assumptions the owner supplies, not a forecast. The spread
 * shows how wide the range of outcomes is for those assumptions; it says nothing
 * about which one will happen, and real markets are neither normal nor independent
 * month to month.
 */
export function projectPortfolio(input: ProjectionInput): Projection {
  const paths = Math.max(1, Math.min(input.paths ?? 2000, 2000));
  const years = Math.max(1, Math.min(Math.round(input.years), 50));
  const months = years * 12;
  // Compounded, not divided: dividing by twelve would hand back more than the
  // annual return that was typed in.
  const annualReturn = Math.max(-99, Math.min(input.expectedReturnPercent, 100));
  const monthlyReturn = (1 + annualReturn / 100) ** (1 / 12) - 1;
  const monthlyVolatility = Math.max(0, Math.min(input.volatilityPercent, 200)) / 100 / Math.sqrt(12);
  const start = Math.max(0, input.startValueNok);
  const deposit = Math.max(0, input.monthlyDepositNok);

  const values = new Array<number>(paths).fill(start);
  const random = seededRandom(20260810);
  const byYear: ProjectionYear[] = [];

  for (let month = 1; month <= months; month += 1) {
    for (let path = 0; path < paths; path += 1) {
      const growth = monthlyReturn + monthlyVolatility * normalDraw(random);
      values[path] = Math.max(0, values[path] * (1 + growth) + deposit);
    }

    if (month % 12 === 0) {
      const sorted = [...values].sort((left, right) => left - right);
      byYear.push({
        year: month / 12,
        contributedNok: start + deposit * month,
        p10Nok: percentile(sorted, 0.1),
        p50Nok: percentile(sorted, 0.5),
        p90Nok: percentile(sorted, 0.9),
      });
    }
  }

  const final = byYear.at(-1);
  return {
    years: byYear,
    finalContributedNok: final?.contributedNok ?? start,
    finalP10Nok: final?.p10Nok ?? start,
    finalP50Nok: final?.p50Nok ?? start,
    finalP90Nok: final?.p90Nok ?? start,
    paths,
  };
}
