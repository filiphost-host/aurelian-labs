import { describe, expect, it } from "vitest";
import { parseNorgesBankPolicyRate, parseNorgesBankRates } from "@/lib/norges-bank";

const ratesCsv = [
  "FREQ;Frequency;BASE_CUR;Base Currency;QUOTE_CUR;Quote Currency;TENOR;Tenor;DECIMALS;CALCULATED;UNIT_MULT;Unit Multiplier;COLLECTION;Collection Indicator;TIME_PERIOD;OBS_VALUE",
  "B;Business;USD;US dollar;NOK;Norwegian krone;SP;Spot;4;false;0;Units;C;ECB concertation time 14:15 CET;2026-08-07;9.5145",
  "B;Business;EUR;Euro;NOK;Norwegian krone;SP;Spot;4;false;0;Units;C;ECB concertation time 14:15 CET;2026-08-07;10.975",
].join("\n");

const policyCsv = [
  "FREQ;Frequency;INSTRUMENT_TYPE;Instrument Type;TENOR;Tenor;UNIT_MEASURE;Unit of Measure;DECIMALS;COLLECTION;Collection Indicator;TIME_PERIOD;OBS_VALUE;CALC_METHOD;Calculation Method",
  "B;Business;KPRA;Key policy rate;SD;Policy rate;R;Rate;2;E;End of day;2026-08-06;4.25;;",
].join("\n");

describe("parseNorgesBankRates", () => {
  it("reads the official NOK rates and their observation date", () => {
    const result = parseNorgesBankRates(ratesCsv);
    expect(result).toMatchObject({ asOf: "2026-08-07", source: "Norges Bank" });
    expect(result!.rates).toMatchObject({ USD: 9.5145, EUR: 10.975, NOK: 1 });
  });

  it("divides by the unit multiplier when a rate is quoted per 100 units", () => {
    const perHundred = ratesCsv.replace(";0;Units;C;ECB concertation time 14:15 CET;2026-08-07;9.5145", ";2;Hundreds;C;ECB concertation time 14:15 CET;2026-08-07;951.45");
    expect(parseNorgesBankRates(perHundred)!.rates.USD).toBeCloseTo(9.5145, 6);
  });

  it("reads a grouped thousands value, which is how rates above 10 NOK are published", () => {
    // The live CHF row: quoted per 100 units, so the value carries a comma group.
    const withChf = `${ratesCsv}\nB;Business;CHF;Swiss franc;NOK;Norwegian krone;SP;Spot;2;false;2;Hundreds;C;ECB concertation time 14:15 CET;2026-08-07;1,174.17`;
    expect(parseNorgesBankRates(withChf)!.rates.CHF).toBeCloseTo(11.7417, 6);
  });

  it("rejects a value that is not in the expected locale rather than misreading it", () => {
    const decimalComma = ratesCsv.replace(";2026-08-07;9.5145", ";2026-08-07;9,5145");
    expect(parseNorgesBankRates(decimalComma)!.rates.USD).toBeUndefined();
  });

  it("ignores rows that are not quoted in NOK or carry no usable value", () => {
    const noisy = `${ratesCsv}\nB;Business;SEK;Swedish krona;EUR;Euro;SP;Spot;4;false;0;Units;C;x;2026-08-07;0.09\nB;Business;GBP;Pound;NOK;Norwegian krone;SP;Spot;4;false;0;Units;C;x;2026-08-07;na`;
    const result = parseNorgesBankRates(noisy)!;
    expect(result.rates.SEK).toBeUndefined();
    expect(result.rates.GBP).toBeUndefined();
  });

  it("returns null when the response carries no usable rate", () => {
    expect(parseNorgesBankRates("")).toBeNull();
    expect(parseNorgesBankRates("FREQ;BASE_CUR\nB;USD")).toBeNull();
  });
});

describe("parseNorgesBankPolicyRate", () => {
  it("reads the latest published key policy rate", () => {
    expect(parseNorgesBankPolicyRate(policyCsv)).toMatchObject({ percent: 4.25, asOf: "2026-08-06" });
  });

  it("returns null when nothing is published", () => {
    expect(parseNorgesBankPolicyRate("")).toBeNull();
  });

  it("ignores an empty observation rather than reporting it as zero", () => {
    const withBlank = `${policyCsv}\nB;Business;KPRA;Key policy rate;SD;Policy rate;R;Rate;2;E;End of day;2026-08-07;;;`;
    expect(parseNorgesBankPolicyRate(withBlank)).toMatchObject({ percent: 4.25, asOf: "2026-08-06" });
  });
});
