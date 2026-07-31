import type {
  AllocationTarget,
  DisplayCurrency,
  FactorKey,
  Holding,
  LedgerPosition,
  PortfolioSnapshot,
  Scenario,
  Transaction,
} from "@/lib/types";

export const fallbackFxToNok: Record<string, number> = {
  NOK: 1,
  USD: 10.8,
  EUR: 11.8,
  SEK: 1.05,
  DKK: 1.58,
  GBP: 13.8,
  CHF: 12.4,
};

export const factorLabels: Record<FactorKey, string> = {
  globalEquity: "Global equity",
  usEquity: "US equity",
  europeEquity: "Europe equity",
  technology: "Technology",
  industrials: "Industrials",
  defense: "Defense",
  usdNok: "USD/NOK",
  nokEur: "NOK/EUR",
  rates: "Interest rates",
  credit: "Credit spreads",
  cash: "Cash",
};

export const factorUnits: Record<FactorKey, "%" | "bps"> = {
  globalEquity: "%",
  usEquity: "%",
  europeEquity: "%",
  technology: "%",
  industrials: "%",
  defense: "%",
  usdNok: "%",
  nokEur: "%",
  rates: "bps",
  credit: "bps",
  cash: "%",
};

export const defaultScenario: Scenario = {
  globalEquity: -8,
  usEquity: -12,
  europeEquity: -7,
  technology: -18,
  industrials: -5,
  defense: 4,
  usdNok: 6,
  nokEur: -2,
  rates: 100,
  credit: 150,
  cash: 0,
};

function safeNumber(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

export function fxRate(currency: string, rates: Record<string, number> = fallbackFxToNok) {
  return rates[currency.toUpperCase()] ?? 0;
}

export function holdingValueNok(holding: Holding, rates: Record<string, number> = fallbackFxToNok) {
  if (holding.manual_value_nok !== null && Number.isFinite(holding.manual_value_nok)) {
    return holding.manual_value_nok;
  }

  const fx = fxRate(holding.currency, rates);
  if (!fx || holding.market_price === null) return 0;
  return holding.quantity * holding.market_price * fx;
}

export function displayValue(valueNok: number, currency: DisplayCurrency) {
  return currency === "NOK" ? valueNok : valueNok / fallbackFxToNok.EUR;
}

export function formatMoney(valueNok: number, currency: DisplayCurrency = "NOK") {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(displayValue(valueNok, currency));
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export function formatShock(key: FactorKey, value: number) {
  const unit = factorUnits[key];
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${unit === "bps" ? " bps" : "%"}`;
}

export function totalValueNok(holdings: Holding[]) {
  return holdings.reduce((sum, holding) => sum + holdingValueNok(holding), 0);
}

export function allocationBy(
  holdings: Holding[],
  key: "asset_type" | "region" | "sector" | "currency",
) {
  const total = totalValueNok(holdings) || 1;
  const groups = new Map<string, number>();

  holdings.forEach((holding) => {
    const label = key === "asset_type" ? assetLabel(holding.asset_type) : holding[key] || "Unclassified";
    groups.set(label, (groups.get(label) ?? 0) + holdingValueNok(holding));
  });

  return Array.from(groups.entries())
    .map(([name, value]) => ({ name, value, percent: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

export function assetLabel(assetType: Holding["asset_type"]) {
  return {
    stock: "Equity",
    etf: "Equity",
    cash: "Cash",
    bond: "Bond",
  }[assetType];
}

export function replayTransactions(holdings: Holding[], transactions: Transaction[]): LedgerPosition[] {
  const holdingById = new Map(holdings.map((holding) => [holding.id, holding]));
  const state = new Map<string, { quantity: number; averageCost: number; realizedGainNok: number }>();
  const ordered = [...transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  for (const transaction of ordered) {
    if (!transaction.holding_id || !holdingById.has(transaction.holding_id)) continue;
    const current = state.get(transaction.holding_id) ?? {
      quantity: 0,
      averageCost: 0,
      realizedGainNok: 0,
    };
    const quantity = safeNumber(transaction.quantity);
    const unitPrice = safeNumber(transaction.unit_price);
    const fee = safeNumber(transaction.fee);
    const fx = safeNumber(transaction.fx_to_nok) || 1;

    if (transaction.type === "opening_balance" || transaction.type === "buy") {
      const nextQuantity = current.quantity + quantity;
      const currentCost = current.quantity * current.averageCost;
      const addedCost = quantity * unitPrice + fee;
      current.averageCost = nextQuantity > 0 ? (currentCost + addedCost) / nextQuantity : 0;
      current.quantity = nextQuantity;
    } else if (transaction.type === "sell") {
      const soldQuantity = Math.min(quantity, current.quantity);
      current.realizedGainNok += ((unitPrice - current.averageCost) * soldQuantity - fee) * fx;
      current.quantity = Math.max(0, current.quantity - soldQuantity);
      if (current.quantity === 0) current.averageCost = 0;
    } else if (transaction.type === "split" && transaction.split_ratio && transaction.split_ratio > 0) {
      current.quantity *= transaction.split_ratio;
      current.averageCost /= transaction.split_ratio;
    } else if (transaction.type === "dividend") {
      current.realizedGainNok += (safeNumber(transaction.amount) - fee) * fx;
    } else if (transaction.type === "fee") {
      current.realizedGainNok -= (safeNumber(transaction.amount) || fee) * fx;
    }

    state.set(transaction.holding_id, current);
  }

  return holdings.map((holding) => {
    const ledger = state.get(holding.id);
    const quantity = ledger?.quantity ?? holding.quantity;
    const averageCost = ledger?.averageCost ?? holding.average_cost;
    const fx = fxRate(holding.currency) || 1;
    const marketValueNok = holding.manual_value_nok ??
      (holding.market_price === null ? 0 : quantity * holding.market_price * fx);
    const costNok = quantity * averageCost * fx;

    return {
      holding: { ...holding, quantity, average_cost: averageCost },
      quantity,
      averageCost,
      costNok,
      marketValueNok,
      unrealizedGainNok: marketValueNok - costNok,
      realizedGainNok: ledger?.realizedGainNok ?? 0,
    };
  });
}

export function externalCashFlows(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.type === "deposit" || transaction.type === "withdrawal")
    .map((transaction) => {
      const value = safeNumber(transaction.amount) * (safeNumber(transaction.fx_to_nok) || 1);
      return {
        date: transaction.occurred_at,
        value: transaction.type === "deposit" ? -value : value,
      };
    });
}

export function xirr(cashFlows: Array<{ date: string; value: number }>) {
  if (cashFlows.length < 2 || !cashFlows.some((flow) => flow.value < 0) || !cashFlows.some((flow) => flow.value > 0)) {
    return null;
  }

  const firstDate = new Date(cashFlows[0].date).getTime();
  const years = cashFlows.map((flow) => (new Date(flow.date).getTime() - firstDate) / 31_557_600_000);
  let rate = 0.1;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    let value = 0;
    let derivative = 0;
    for (let index = 0; index < cashFlows.length; index += 1) {
      const denominator = Math.pow(1 + rate, years[index]);
      value += cashFlows[index].value / denominator;
      derivative -= (years[index] * cashFlows[index].value) / Math.pow(1 + rate, years[index] + 1);
    }
    if (Math.abs(value) < 0.01) return rate * 100;
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-10) break;
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    rate = next;
  }

  return null;
}

export function moneyWeightedReturn(transactions: Transaction[], endingValueNok: number, asOf: string) {
  return xirr([...externalCashFlows(transactions), { date: asOf, value: endingValueNok }]);
}

export function timeWeightedReturn(snapshots: PortfolioSnapshot[]) {
  const ordered = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  if (ordered.length < 2) return null;

  let growth = 1;
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1].total_value_nok;
    if (previous <= 0) continue;
    growth *= (ordered[index].total_value_nok - ordered[index].external_flow_nok) / previous;
  }
  return (growth - 1) * 100;
}

export function portfolioSummary(
  holdings: Holding[],
  transactions: Transaction[] = [],
  snapshots: PortfolioSnapshot[] = [],
) {
  const positions = replayTransactions(holdings, transactions);
  const total = positions.reduce((sum, position) => sum + position.marketValueNok, 0);
  const cost = positions.reduce((sum, position) => sum + position.costNok, 0);
  const unrealizedGain = positions.reduce((sum, position) => sum + position.unrealizedGainNok, 0);
  const realizedGain = positions.reduce((sum, position) => sum + position.realizedGainNok, 0);
  const asOf = snapshots.at(-1)?.snapshot_date ?? new Date().toISOString().slice(0, 10);

  return {
    total,
    cost,
    gain: unrealizedGain,
    unrealizedGain,
    realizedGain,
    gainPercent: cost ? (unrealizedGain / cost) * 100 : 0,
    moneyWeightedReturn: moneyWeightedReturn(transactions, total, asOf),
    timeWeightedReturn: timeWeightedReturn(snapshots),
    count: positions.filter((position) => position.quantity > 0).length,
    positions,
  };
}

export function scenarioImpact(holding: Holding, scenario: Scenario) {
  const value = holdingValueNok(holding);
  const assumptions: string[] = [];
  let impactPercent = 0;

  for (const [rawKey, rawExposure] of Object.entries(holding.factor_exposures ?? {})) {
    const key = rawKey as FactorKey;
    const exposure = Number(rawExposure) || 0;
    if (!exposure || key === "rates" || key === "credit") continue;
    const shock = scenario[key] ?? 0;
    impactPercent += shock * exposure;
    assumptions.push(`${factorLabels[key]} ${formatShock(key, shock)} × ${exposure.toFixed(1)}`);
  }

  if (holding.asset_type === "bond") {
    const duration = holding.duration_estimate ?? 0;
    const rateImpact = -duration * ((scenario.rates ?? 0) / 100);
    const creditExposure = Number(holding.factor_exposures.credit ?? 1);
    const creditImpact = -duration * ((scenario.credit ?? 0) / 100) * creditExposure;
    impactPercent += rateImpact + creditImpact;
    assumptions.push(`Duration ${duration.toFixed(1)} × rates ${formatShock("rates", scenario.rates)}`);
    assumptions.push(`Spread duration proxy × ${formatShock("credit", scenario.credit)}`);
  }

  const impactNok = value * (impactPercent / 100);
  return {
    holding,
    value,
    impactPercent,
    impactNok,
    postValue: value + impactNok,
    assumptions,
  };
}

export function targetRows(holdings: Holding[], targets: AllocationTarget[]) {
  const sources = {
    asset_type: allocationBy(holdings, "asset_type"),
    region: allocationBy(holdings, "region"),
    sector: allocationBy(holdings, "sector"),
    currency: allocationBy(holdings, "currency"),
    cash: allocationBy(holdings, "asset_type").filter((row) => row.name === "Cash"),
  };

  return targets.map((target) => {
    const actual = sources[target.category]
      .find((row) => row.name.toLowerCase() === target.label.toLowerCase())?.percent ?? 0;
    const drift = actual < target.min_percent
      ? actual - target.min_percent
      : actual > target.max_percent
        ? actual - target.max_percent
        : 0;
    return { ...target, actual, drift };
  });
}
