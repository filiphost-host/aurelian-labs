import { describe, expect, it } from "vitest";
import {
  buildDailyBrief,
  buildChatGptPacket,
  redactHoldingIdentities,
} from "@/lib/insights";
import {
  sampleDecisions,
  sampleEvents,
  sampleHoldings,
  sampleSnapshots,
  sampleTransactions,
} from "@/lib/sample-data";

describe("daily brief", () => {
  it("separates facts, relevance, scenarios, and source metadata", () => {
    const brief = buildDailyBrief({
      holdings: sampleHoldings,
      transactions: sampleTransactions,
      decisions: sampleDecisions,
      events: sampleEvents,
      snapshots: sampleSnapshots,
      asOf: "2026-07-30",
    });
    expect(brief.insights.length).toBeGreaterThan(2);
    expect(brief.insights.every((item) =>
      item.fact && item.relevance && item.scenario && item.source && item.as_of,
    )).toBe(true);
  });

  it("excludes private holding details from the ChatGPT packet unless selected", () => {
    const brief = buildDailyBrief({
      holdings: sampleHoldings,
      transactions: sampleTransactions,
      decisions: sampleDecisions,
      events: sampleEvents,
      snapshots: sampleSnapshots,
      asOf: "2026-07-30",
    });
    const privatePacket = buildChatGptPacket(brief, sampleHoldings, {
      includeHoldings: false,
      includeValues: false,
      includeCommentary: false,
    });
    expect(privatePacket).not.toContain("MSFT");
    expect(privatePacket).not.toContain("Microsoft");
    expect(privatePacket).toContain("Holdings were intentionally excluded");
  });

  it("redacts names and tickers from shareable narrative text", () => {
    expect(
      redactHoldingIdentities("MSFT and Microsoft are both mentioned.", sampleHoldings),
    ).toBe("Holding 1 and Holding 1 are both mentioned.");
  });

  it("values the brief with the provided FX rates instead of built-in estimates", () => {
    const marketPricedUsdHolding = {
      ...sampleHoldings[0],
      id: "fx-test-holding",
      manual_value_nok: null,
      currency: "USD",
      quantity: 10,
      market_price: 100,
    };
    const build = (fxRates?: Record<string, number>) => buildDailyBrief({
      holdings: [marketPricedUsdHolding],
      transactions: [],
      decisions: [],
      events: [],
      snapshots: sampleSnapshots,
      asOf: "2026-07-30",
      fxRates,
    });
    const inflated = build({ NOK: 1, USD: 20, EUR: 20, SEK: 2, DKK: 3, GBP: 25, CHF: 24 });
    expect(inflated.summary).not.toBe(build(undefined).summary);
  });
});
