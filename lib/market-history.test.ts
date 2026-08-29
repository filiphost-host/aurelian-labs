import { describe, expect, it } from "vitest";
import { historyCategories, marketHistoryEvents, recurringHistoryPatterns } from "./market-history";

describe("market history timeline", () => {
  it("covers the requested period in chronological order", () => {
    expect(marketHistoryEvents[0].year).toBeLessThanOrEqual(1857);
    expect(marketHistoryEvents.at(-1)?.year).toBeGreaterThanOrEqual(2022);
    expect(marketHistoryEvents.map((event) => event.year)).toEqual([...marketHistoryEvents.map((event) => event.year)].sort((a, b) => a - b));
  });

  it("keeps every event source-backed and fully explainable", () => {
    for (const event of marketHistoryEvents) {
      expect(event.sourceUrl).toMatch(/^https:\/\//);
      expect(event.buildup.length).toBeGreaterThan(2);
      expect(event.transmission.length).toBeGreaterThan(2);
      expect(event.commonDenominators.length).toBeGreaterThan(2);
    }
  });

  it("surfaces recurring mechanisms across crises", () => {
    expect(historyCategories).toContain("Banking");
    expect(recurringHistoryPatterns(marketHistoryEvents).length).toBe(6);
  });
});
