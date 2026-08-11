import { describe, expect, it } from "vitest";
import { eodhdSymbol, marketDataSymbol } from "./market-symbols";

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

describe("eodhdSymbol", () => {
  it("maps exchanges to EODHD market codes", () => {
    expect(eodhdSymbol("EQNR", "OSLO")).toBe("EQNR.OL");
    expect(eodhdSymbol("SXR8", "XETRA")).toBe("SXR8.XETRA");
    expect(eodhdSymbol("MSFT", "NASDAQ")).toBe("MSFT.US");
    expect(eodhdSymbol("MSFT", null)).toBe("MSFT.US");
  });

  it("translates Yahoo-style suffixes and rejects indices", () => {
    expect(eodhdSymbol("NOVO-B.CO", null)).toBe("NOVO-B.CO");
    expect(eodhdSymbol("SAP.DE", null)).toBe("SAP.XETRA");
    expect(eodhdSymbol("^GSPC", null)).toBeNull();
  });
});
