import { describe, expect, it } from "vitest";
import { createCallBudget, parseEodhdClose, parseYahooCloses } from "@/lib/market-data";

describe("createCallBudget", () => {
  it("allows exactly the configured number of calls", () => {
    const budget = createCallBudget(2);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(true);
    expect(budget.take()).toBe(false);
    expect(budget.used()).toBe(2);
  });
});

describe("parseEodhdClose", () => {
  it("reads the newest row of an EOD response", () => {
    expect(parseEodhdClose([
      { date: "2026-08-08", close: 123.45 },
      { date: "2026-08-07", close: 120 },
    ])).toEqual({ date: "2026-08-08", close: 123.45 });
  });

  it("rejects malformed payloads", () => {
    expect(parseEodhdClose(null)).toBeNull();
    expect(parseEodhdClose([])).toBeNull();
    expect(parseEodhdClose([{ date: "2026-08-08", close: "not-a-number" }])).toBeNull();
    expect(parseEodhdClose({ s: "error" })).toBeNull();
  });
});

describe("parseYahooCloses", () => {
  it("pairs timestamps with finite closes as dated points", () => {
    const points = parseYahooCloses({
      chart: {
        result: [{
          timestamp: [1754697600, 1754784000],
          indicators: { quote: [{ close: [100, null] }] },
        }],
      },
    });
    expect(points).toEqual([{ date: "2025-08-09", close: 100 }]);
  });

  it("returns an empty list for malformed payloads", () => {
    expect(parseYahooCloses(null)).toEqual([]);
    expect(parseYahooCloses({ chart: {} })).toEqual([]);
  });
});
