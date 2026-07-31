import { describe, expect, it } from "vitest";
import { marketDataSymbol } from "./market-symbols";

describe("marketDataSymbol", () => {
  it("maps European listings to provider symbols", () => {
    expect(marketDataSymbol("SXR8", "XETRA")).toBe("SXR8.DE");
    expect(marketDataSymbol("EQNR", "OSLO")).toBe("EQNR.OL");
  });

  it("leaves US and index symbols unchanged", () => {
    expect(marketDataSymbol("MSFT", "NASDAQ")).toBe("MSFT");
    expect(marketDataSymbol("^GSPC", null)).toBe("^GSPC");
  });
});
