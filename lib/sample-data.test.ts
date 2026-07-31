import { describe, expect, it } from "vitest";
import { totalValueNok } from "@/lib/calculations";
import { sampleHoldings } from "@/lib/sample-data";

describe("Aurelian preview portfolio", () => {
  it("keeps the intended NOK 445,000 US-led allocation", () => {
    expect(totalValueNok(sampleHoldings)).toBe(445000);
    expect(sampleHoldings.map((holding) => holding.ticker)).toEqual([
      "MSFT",
      "GOOGL",
      "NVDA",
      "SXR8",
      "ITA",
    ]);
  });
});
