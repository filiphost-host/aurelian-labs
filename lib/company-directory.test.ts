import { describe, expect, it } from "vitest";
import { companyIdentityForName, companyIdentityForTicker, companyLogoForTicker } from "@/lib/company-directory";
import { stressInstrumentLibrary } from "@/lib/stress-portfolio";

describe("company directory", () => {
  it("resolves company names to verified identities", () => {
    expect(companyIdentityForName("Microsoft")?.ticker).toBe("MSFT");
    expect(companyIdentityForName("AstraZeneca")?.ticker).toBe("AZN");
  });

  it("supports common company-name aliases", () => {
    expect(companyIdentityForName("Google")?.ticker).toBe("GOOGL");
    expect(companyIdentityForName("HSBC Holdings")?.ticker).toBe("HSBA");
  });

  it("normalizes exchange ticker punctuation", () => {
    expect(companyIdentityForTicker("GOOGL")?.name).toBe("Alphabet");
    expect(companyIdentityForTicker("HSBA")?.name).toBe("HSBC");
  });

  it("provides a logo source for every stock and ETF in Scenarios", () => {
    const missing = stressInstrumentLibrary
      .filter((instrument) => instrument.assetType !== "bond")
      .filter((instrument) => !companyLogoForTicker(instrument.ticker))
      .map((instrument) => instrument.ticker);
    expect(missing).toEqual([]);
  });
});
