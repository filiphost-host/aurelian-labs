import { z } from "zod";
import { holdingValueNok } from "@/lib/calculations";
import { redactFigures, redactHoldingIdentities } from "@/lib/insights";
import type { DailyBrief, Holding, HoldingDecision, ShareOptions } from "@/lib/types";

export type AnalystMode = "brief" | "red-team";

/**
 * Everything the model is allowed to see. It is built in the browser, shown to the
 * owner before anything is sent, and validated again on the server. The model gets
 * no tools and no other source, so anything it states has to come from here.
 */
export const analystPacketSchema = z.object({
  mode: z.enum(["brief", "red-team"]),
  asOf: z.string().max(40),
  title: z.string().max(300),
  summary: z.string().max(8000),
  insights: z.array(z.object({
    kind: z.string().max(40),
    severity: z.string().max(40),
    title: z.string().max(300),
    fact: z.string().max(8000),
    relevance: z.string().max(8000),
    scenario: z.string().max(8000),
    source: z.string().max(200),
    asOf: z.string().max(40),
  })).max(60),
  holdings: z.array(z.object({
    label: z.string().max(200),
    assetType: z.string().max(40),
    currency: z.string().max(10),
    weightPercent: z.number().nullable(),
    valueNok: z.number().nullable(),
    dataStatus: z.string().max(40),
  })).max(200),
  subject: z.object({
    label: z.string().max(200),
    thesis: z.string().max(4000),
    reasonForOwnership: z.string().max(4000),
    returnDrivers: z.string().max(4000),
    risks: z.string().max(4000),
    conviction: z.number().nullable(),
    weightPercent: z.number().nullable(),
    returnPercent: z.number().nullable(),
  }).nullable(),
  omissions: z.array(z.string().max(300)).max(20),
});

export type AnalystPacket = z.infer<typeof analystPacketSchema>;

export type PacketOptions = Pick<ShareOptions, "includeHoldings" | "includeValues" | "includeCommentary">;

function round(value: number | null) {
  return value === null || !Number.isFinite(value) ? null : Math.round(value * 100) / 100;
}

export function buildAnalystPacket(input: {
  mode: AnalystMode;
  brief: DailyBrief;
  holdings: Holding[];
  decisions: HoldingDecision[];
  options: PacketOptions;
  fxRates?: Record<string, number>;
  subjectHoldingId?: string | null;
}): AnalystPacket {
  const { brief, holdings, options, fxRates } = input;
  // Withholding values has to apply to prose too, not only to the numeric fields:
  // the brief writes kroner and percentages into its own sentences.
  const reveal = (text: string) => {
    const named = options.includeHoldings ? text : redactHoldingIdentities(text, holdings);
    return options.includeValues ? named : redactFigures(named);
  };
  const total = holdings.reduce((sum, holding) => sum + holdingValueNok(holding, fxRates), 0);
  const omissions: string[] = [];

  if (!options.includeHoldings) omissions.push("Holding names and tickers were withheld by the owner.");
  if (!options.includeValues) omissions.push("Position values and weights were withheld by the owner.");
  if (!options.includeCommentary) omissions.push("The owner's own commentary was withheld.");

  const subjectHolding = input.subjectHoldingId
    ? holdings.find((holding) => holding.id === input.subjectHoldingId) ?? null
    : null;
  const latestForSubject = subjectHolding
    ? [...input.decisions]
        .filter((decision) => decision.holding_id === subjectHolding.id)
        .sort((left, right) => right.recorded_at.localeCompare(left.recorded_at))[0] ?? null
    : null;
  // A decision row with an empty thesis is nothing to argue against.
  const subjectDecision = latestForSubject?.thesis?.trim() ? latestForSubject : null;

  if (input.mode === "red-team" && subjectHolding && !subjectDecision) {
    omissions.push("No thesis has been recorded for this holding, so there is nothing to argue against.");
  }

  const value = subjectHolding ? holdingValueNok(subjectHolding, fxRates) : 0;

  return {
    mode: input.mode,
    asOf: brief.brief_date,
    title: reveal(brief.title),
    summary: reveal(brief.summary),
    insights: brief.insights.map((insight) => ({
      kind: insight.kind,
      severity: insight.severity,
      title: reveal(insight.title),
      fact: reveal(insight.fact),
      relevance: options.includeCommentary ? reveal(insight.relevance) : "Withheld by the owner.",
      scenario: options.includeCommentary ? reveal(insight.scenario) : "Withheld by the owner.",
      source: reveal(insight.source),
      asOf: insight.as_of,
    })),
    holdings: options.includeHoldings
      ? holdings.map((holding) => ({
          label: holding.ticker ?? holding.name,
          assetType: holding.asset_type,
          currency: holding.currency,
          weightPercent: options.includeValues && total > 0
            ? round((holdingValueNok(holding, fxRates) / total) * 100)
            : null,
          valueNok: options.includeValues ? round(holdingValueNok(holding, fxRates)) : null,
          dataStatus: holding.price_provenance.status,
        }))
      : [],
    subject: subjectHolding && subjectDecision
      ? {
          label: options.includeHoldings ? subjectHolding.ticker ?? subjectHolding.name : "the holding under review",
          thesis: reveal(subjectDecision.thesis),
          reasonForOwnership: reveal(subjectDecision.reason_for_ownership),
          returnDrivers: reveal(subjectDecision.return_drivers),
          risks: reveal(subjectDecision.risks),
          conviction: subjectDecision.conviction,
          weightPercent: options.includeValues && total > 0 ? round((value / total) * 100) : null,
          returnPercent: options.includeValues && subjectHolding.market_price !== null && subjectHolding.average_cost > 0
            ? round(((subjectHolding.market_price - subjectHolding.average_cost) / subjectHolding.average_cost) * 100)
            : null,
        }
      : null,
    omissions,
  };
}

/** The packet as the owner reads it before deciding to send it. */
export function packetToText(packet: AnalystPacket) {
  const lines = [
    `Mode: ${packet.mode === "brief" ? "Daily brief narrative" : "Thesis red team"}`,
    `As of: ${packet.asOf}`,
    "",
    packet.title,
    packet.summary,
    "",
    `Insights (${packet.insights.length}):`,
    ...packet.insights.map((insight, index) =>
      `${index + 1}. [${insight.severity}] ${insight.title}\n   Fact: ${insight.fact}\n   Relevance: ${insight.relevance}\n   Scenario: ${insight.scenario}\n   Source: ${insight.source} (${insight.asOf})`),
  ];

  if (packet.subject) {
    lines.push("", `Thesis under review: ${packet.subject.label}`,
      `Conviction: ${packet.subject.conviction ?? "not recorded"}/5`,
      `Share of portfolio: ${packet.subject.weightPercent === null ? "withheld" : `${packet.subject.weightPercent}%`}`,
      `Return so far: ${packet.subject.returnPercent === null ? "withheld" : `${packet.subject.returnPercent}%`}`,
      `Thesis: ${packet.subject.thesis}`,
      `Reason for ownership: ${packet.subject.reasonForOwnership}`,
      `Return drivers: ${packet.subject.returnDrivers}`,
      `Risks already identified: ${packet.subject.risks}`);
  }

  if (packet.holdings.length) {
    lines.push("", `Holdings (${packet.holdings.length}):`,
      ...packet.holdings.map((holding) =>
        `- ${holding.label} · ${holding.assetType} · ${holding.currency}` +
        `${holding.weightPercent === null ? "" : ` · ${holding.weightPercent}% of portfolio`}` +
        `${holding.valueNok === null ? "" : ` · ${holding.valueNok} NOK`}` +
        ` · price data: ${holding.dataStatus}`));
  }

  if (packet.omissions.length) {
    lines.push("", "Withheld from this packet:", ...packet.omissions.map((omission) => `- ${omission}`));
  }

  return lines.join("\n");
}
