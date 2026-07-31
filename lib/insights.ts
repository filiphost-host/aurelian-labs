import { allocationBy, formatMoney, holdingValueNok, portfolioSummary } from "@/lib/calculations";
import type {
  DailyBrief,
  Holding,
  HoldingDecision,
  Insight,
  MarketEvent,
  PortfolioSnapshot,
  Transaction,
} from "@/lib/types";

function insight(input: Omit<Insight, "id"> & { id?: string }): Insight {
  return {
    ...input,
    id: input.id ?? `${input.kind}-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  };
}

export function buildDailyBrief(input: {
  holdings: Holding[];
  transactions: Transaction[];
  decisions: HoldingDecision[];
  events: MarketEvent[];
  snapshots: PortfolioSnapshot[];
  asOf?: string;
  generatedAt?: string;
}): DailyBrief {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const summary = portfolioSummary(input.holdings, input.transactions, input.snapshots);
  const insights: Insight[] = [];
  const values = input.holdings
    .map((holding) => ({ holding, value: holdingValueNok(holding) }))
    .sort((a, b) => b.value - a.value);
  const top = values[0];
  const topWeight = top && summary.total ? (top.value / summary.total) * 100 : 0;

  if (top && topWeight >= 25) {
    insights.push(insight({
      kind: "risk",
      severity: topWeight >= 45 ? "attention" : "info",
      title: `${top.holding.ticker ?? top.holding.name} is the largest position`,
      fact: `${top.holding.name} represents ${topWeight.toFixed(1)}% of the current portfolio value.`,
      relevance: "A large position can dominate both gains and drawdowns, even when the underlying investment remains sound.",
      scenario: `A 20% fall in this holding alone would reduce the portfolio by roughly ${formatMoney(top.value * 0.2)}.`,
      source: "Aurelian portfolio ledger",
      source_url: null,
      as_of: asOf,
      holding_ids: [top.holding.id],
    }));
  }

  const manualHoldings = input.holdings.filter((holding) =>
    ["manual", "estimated", "stale"].includes(holding.price_provenance.status),
  );
  if (manualHoldings.length) {
    insights.push(insight({
      kind: "fact",
      severity: "attention",
      title: `${manualHoldings.length} position${manualHoldings.length === 1 ? "" : "s"} need a verified close`,
      fact: manualHoldings.map((holding) => holding.ticker ?? holding.name).join(", ") +
        " currently use manual, estimated, or stale valuation data.",
      relevance: "Portfolio totals and scenario results inherit the uncertainty of their underlying prices.",
      scenario: "Refresh the value after the next market close or keep the manual value with a dated note.",
      source: "Aurelian data-quality check",
      source_url: null,
      as_of: asOf,
      holding_ids: manualHoldings.map((holding) => holding.id),
    }));
  }

  const currency = allocationBy(input.holdings, "currency");
  const foreign = currency.filter((row) => row.name !== "NOK");
  if (foreign.length) {
    const foreignWeight = foreign.reduce((sum, row) => sum + row.percent, 0);
    insights.push(insight({
      kind: "risk",
      severity: foreignWeight > 75 ? "attention" : "info",
      title: "Currency is a material return driver",
      fact: `${foreignWeight.toFixed(1)}% of the portfolio is valued in currencies other than NOK.`,
      relevance: "NOK appreciation can reduce NOK-reported returns even when the underlying securities are unchanged.",
      scenario: "Use the NOK Strengthening preset to isolate the approximate translation effect.",
      source: "Aurelian currency allocation",
      source_url: "https://data.ecb.europa.eu/help/api/data",
      as_of: asOf,
      holding_ids: input.holdings.filter((holding) => holding.currency !== "NOK").map((holding) => holding.id),
    }));
  }

  const upcomingReviews = input.decisions.filter((decision) => {
    if (!decision.review_date) return false;
    const days = (new Date(decision.review_date).getTime() - new Date(asOf).getTime()) / 86_400_000;
    return days >= 0 && days <= 120;
  });
  for (const decision of upcomingReviews.slice(0, 3)) {
    const holding = input.holdings.find((item) => item.id === decision.holding_id);
    if (!holding) continue;
    insights.push(insight({
      kind: "review",
      severity: "info",
      title: `${holding.name} thesis review is approaching`,
      fact: `The next review is scheduled for ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(decision.review_date!))}.`,
      relevance: `Current conviction is ${decision.conviction}/5. The recorded thesis is: ${decision.thesis}`,
      scenario: "Review the return drivers and risks before changing the position.",
      source: "Decision Memory",
      source_url: null,
      as_of: asOf,
      holding_ids: [holding.id],
    }));
  }

  for (const event of input.events.filter((item) => item.status !== "reviewed").slice(0, 3)) {
    insights.push(insight({
      kind: "event",
      severity: "info",
      title: event.title,
      fact: `${event.event_type === "review" ? "Portfolio review" : "Market event"} dated ${event.event_date}.`,
      relevance: event.holding_id
        ? "This event is linked directly to one of the current holdings."
        : "This macro event can affect equity discount rates, currencies, and risk appetite.",
      scenario: "Treat the event as a reason to revisit assumptions, not as a prediction of market direction.",
      source: event.source,
      source_url: event.source_url,
      as_of: asOf,
      holding_ids: event.holding_id ? [event.holding_id] : [],
    }));
  }

  return {
    id: `brief-${asOf}`,
    brief_date: asOf,
    title: `Portfolio brief · ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date(asOf))}`,
    summary: `${summary.count} positions · ${formatMoney(summary.total)} · ${insights.filter((item) => item.severity === "attention").length} items need attention.`,
    insights,
    generated_at: input.generatedAt ?? `${asOf}T06:00:00.000Z`,
  };
}

export function redactHoldingIdentities(value: string, holdings: Holding[]) {
  return holdings.reduce((redacted, holding, index) => {
    const replacement = `Holding ${index + 1}`;
    const identities = [holding.name, holding.ticker].filter(
      (identity): identity is string => Boolean(identity),
    );

    return identities.reduce((text, identity) => {
      const escaped = identity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return text.replace(new RegExp(escaped, "gi"), replacement);
    }, redacted);
  }, value);
}

export function buildChatGptPacket(
  brief: DailyBrief,
  holdings: Holding[],
  options: { includeHoldings: boolean; includeValues: boolean; includeCommentary: boolean },
) {
  const packetInsights = options.includeHoldings
    ? brief.insights
    : brief.insights.map((insight) => ({
        ...insight,
        title: redactHoldingIdentities(insight.title, holdings),
        fact: redactHoldingIdentities(insight.fact, holdings),
        relevance: redactHoldingIdentities(insight.relevance, holdings),
        scenario: redactHoldingIdentities(insight.scenario, holdings),
      }));

  const selectedHoldings = options.includeHoldings
    ? holdings.map((holding) => ({
        name: holding.name,
        ticker: holding.ticker,
        assetType: holding.asset_type,
        currency: holding.currency,
        valueNok: options.includeValues ? holdingValueNok(holding) : undefined,
        note: options.includeCommentary ? holding.account_note : undefined,
        dataAsOf: holding.price_provenance.as_of,
        dataStatus: holding.price_provenance.status,
      }))
    : [];

  return [
    "You are reviewing a private, source-backed portfolio brief.",
    "Separate facts from interpretation. Do not recommend trades or invent missing data.",
    "Identify assumptions, concentration risks, relevant counterarguments, and questions for the investor.",
    "",
    `Brief date: ${brief.brief_date}`,
    `Summary: ${brief.summary}`,
    "",
    "Insights:",
    ...packetInsights.flatMap((item, index) => [
      `${index + 1}. ${item.title}`,
      `Fact: ${item.fact}`,
      `Portfolio relevance: ${item.relevance}`,
      `Possible scenario: ${item.scenario}`,
      `Source: ${item.source}${item.source_url ? ` (${item.source_url})` : ""}, as of ${item.as_of}`,
      "",
    ]),
    ...(selectedHoldings.length
      ? ["Selected holdings:", JSON.stringify(selectedHoldings, null, 2)]
      : ["Holdings were intentionally excluded from this analysis packet."]),
  ].join("\n");
}
