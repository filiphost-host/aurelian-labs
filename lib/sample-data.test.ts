import { describe, expect, it } from "vitest";
import { portfolioSummary, totalValueNok } from "@/lib/calculations";
import { sampleHoldings, sampleSnapshots, sampleTransactions } from "@/lib/sample-data";

describe("Aurelian preview portfolio", () => {
  it("keeps the intended NOK 450,000 four-position allocation", () => {
    expect(totalValueNok(sampleHoldings)).toBe(450000);
    expect(sampleHoldings.map((holding) => holding.ticker)).toEqual([
      "MSFT",
      "GOOGL",
      "NVDA",
      "SXR8",
    ]);
    expect(portfolioSummary(sampleHoldings, sampleTransactions, sampleSnapshots).gainPercent).toBeCloseTo(97.5, 1);
  });
});
