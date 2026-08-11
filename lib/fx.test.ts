import { describe, expect, it } from "vitest";
import { fallbackFxToNok } from "@/lib/calculations";
import { fallbackFxRates, latestFxRatesFromRows } from "@/lib/fx";

function row(base: string, rate: number, asOf: string, source = "ECB Data Portal") {
  return { base_currency: base, quote_currency: "NOK", rate, as_of: asOf, source };
}

describe("latestFxRatesFromRows", () => {
  it("falls back to built-in estimates when no rows exist", () => {
    expect(latestFxRatesFromRows([])).toBe(fallbackFxRates);
  });

  it("picks the most recent rate per currency and keeps fallback for the rest", () => {
    const result = latestFxRatesFromRows([
      row("USD", 10.1, "2026-08-01"),
      row("USD", 10.4, "2026-08-08"),
      row("EUR", 11.9, "2026-08-08"),
    ]);
    expect(result.rates.USD).toBe(10.4);
    expect(result.rates.EUR).toBe(11.9);
    expect(result.rates.SEK).toBe(fallbackFxToNok.SEK);
    expect(result.rates.NOK).toBe(1);
    expect(result.asOf).toBe("2026-08-08");
    expect(result.source).toBe("ECB Data Portal");
  });

  it("ignores malformed or non-NOK rows", () => {
    const result = latestFxRatesFromRows([
      { base_currency: "USD", quote_currency: "SEK", rate: 1.2, as_of: "2026-08-08" },
      row("USD", Number.NaN, "2026-08-08"),
      row("", 10, "2026-08-08"),
    ]);
    expect(result).toBe(fallbackFxRates);
  });

  it("never mutates the shared fallback rates", () => {
    latestFxRatesFromRows([row("USD", 99, "2026-08-08")]);
    expect(fallbackFxToNok.USD).toBe(10.8);
  });
});
