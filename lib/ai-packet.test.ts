import { describe, expect, it } from "vitest";
import { analystInstructions, analystPrompt } from "@/lib/ai-prompts";
import { analystPacketSchema, buildAnalystPacket, packetToText } from "@/lib/ai-packet";
import { buildDailyBrief } from "@/lib/insights";
import {
  sampleDecisions,
  sampleEvents,
  sampleHoldings,
  sampleSnapshots,
  sampleTransactions,
} from "@/lib/sample-data";

const brief = buildDailyBrief({
  holdings: sampleHoldings,
  transactions: sampleTransactions,
  decisions: sampleDecisions,
  events: sampleEvents,
  snapshots: sampleSnapshots,
  asOf: "2026-07-30",
});

const open = { includeHoldings: true, includeValues: true, includeCommentary: true };
const closed = { includeHoldings: false, includeValues: false, includeCommentary: false };

function build(overrides: Partial<Parameters<typeof buildAnalystPacket>[0]> = {}) {
  return buildAnalystPacket({
    mode: "brief",
    brief,
    holdings: sampleHoldings,
    decisions: sampleDecisions,
    options: open,
    ...overrides,
  });
}

describe("buildAnalystPacket", () => {
  it("produces a packet the server schema accepts", () => {
    expect(analystPacketSchema.safeParse(build()).success).toBe(true);
  });

  it("carries the brief and its insights", () => {
    const packet = build();
    expect(packet.insights.length).toBeGreaterThan(2);
    expect(packet.holdings.length).toBe(sampleHoldings.length);
    expect(packet.omissions).toEqual([]);
  });

  it("withholds identities, values, and commentary when the owner says so", () => {
    const packet = build({ options: closed });
    const text = packetToText(packet);
    expect(packet.holdings).toEqual([]);
    expect(text).not.toContain("MSFT");
    expect(text).not.toContain("Microsoft");
    expect(packet.insights.every((insight) => insight.relevance === "Withheld by the owner.")).toBe(true);
    expect(packet.omissions).toHaveLength(3);
  });

  it("keeps values out while still naming holdings, when only values are withheld", () => {
    const packet = build({ options: { ...open, includeValues: false } });
    expect(packet.holdings.every((holding) => holding.valueNok === null && holding.weightPercent === null)).toBe(true);
    expect(packet.holdings.some((holding) => holding.label === "MSFT")).toBe(true);
  });

  it("includes the recorded thesis when red-teaming a holding", () => {
    const subject = sampleDecisions[0];
    const packet = build({ mode: "red-team", subjectHoldingId: subject.holding_id });
    expect(packet.subject).not.toBeNull();
    expect(packet.subject!.thesis).toBe(subject.thesis);
    expect(packet.subject!.conviction).toBe(subject.conviction);
    expect(packetToText(packet)).toContain("Thesis under review");
  });

  it("says so when the holding has no recorded thesis to argue against", () => {
    const packet = build({ mode: "red-team", subjectHoldingId: sampleHoldings[0].id, decisions: [] });
    expect(packet.subject).toBeNull();
    expect(packet.omissions.join(" ")).toMatch(/no thesis has been recorded/i);
  });

  it("redacts the thesis text too when identities are withheld", () => {
    const subject = sampleDecisions[0];
    const packet = build({ mode: "red-team", subjectHoldingId: subject.holding_id, options: closed });
    expect(packet.subject!.label).toBe("the holding under review");
    expect(packetToText(packet)).not.toContain("Microsoft");
  });

  it("withholds figures written into the brief's own prose, not just the number fields", () => {
    const text = packetToText(build({ options: { ...open, includeValues: false } }));
    // The brief writes the portfolio total and the largest weight into its sentences.
    expect(text).not.toMatch(/\d[\d\s ]*\s?kr/i);
    expect(text).not.toMatch(/\d+([.,]\d+)?\s?%/);
    expect(text).toContain("an amount");
  });

  it("redacts the source line, which names the company just as plainly as the title", () => {
    const withEvent = {
      ...brief,
      insights: [{
        ...brief.insights[0],
        title: "Microsoft files its 10-Q",
        source: "SEC EDGAR — Microsoft Corporation 10-Q",
      }],
    };
    const packet = buildAnalystPacket({
      mode: "brief",
      brief: withEvent,
      holdings: sampleHoldings,
      decisions: sampleDecisions,
      options: closed,
    });
    expect(packetToText(packet)).not.toContain("Microsoft");
  });

  it("shows every value it sends, so the preview cannot under-report", () => {
    const packet = build();
    const text = packetToText(packet);
    for (const holding of packet.holdings) {
      if (holding.valueNok !== null) expect(text).toContain(String(holding.valueNok));
    }
  });

  it("treats a decision with a blank thesis as nothing to argue against", () => {
    const packet = build({
      mode: "red-team",
      subjectHoldingId: sampleHoldings[0].id,
      decisions: [{ ...sampleDecisions[0], holding_id: sampleHoldings[0].id, thesis: "   " }],
    });
    expect(packet.subject).toBeNull();
    expect(packet.omissions.join(" ")).toMatch(/no thesis/i);
  });

  it("rejects a packet that exceeds the server limits", () => {
    const packet = build();
    const oversized = { ...packet, summary: "x".repeat(8001) };
    expect(analystPacketSchema.safeParse(oversized).success).toBe(false);
  });
});

describe("analyst instructions", () => {
  it("forbids invented facts and trading advice in both modes", () => {
    for (const mode of ["brief", "red-team"] as const) {
      const instructions = analystInstructions(mode);
      expect(instructions).toMatch(/only source/i);
      expect(instructions).toMatch(/never state a number/i);
      expect(instructions).toMatch(/never recommend/i);
      expect(instructions).toMatch(/do not predict prices/i);
    }
  });

  it("asks the brief for a counterargument and the red team for falsifying evidence", () => {
    expect(analystInstructions("brief")).toMatch(/counterargument/i);
    expect(analystInstructions("red-team")).toMatch(/bear case/i);
    expect(analystInstructions("red-team")).toMatch(/evidence that would show/i);
  });

  it("wraps the packet in clear boundaries so the model can see where it ends", () => {
    const packet = build();
    const prompt = analystPrompt(packet, packetToText(packet));
    expect(prompt).toContain("--- PACKET START ---");
    expect(prompt).toContain("--- PACKET END ---");
  });
});
