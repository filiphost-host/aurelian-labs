import { describe, expect, it } from "vitest";
import {
  buildImportPlan,
  detectDateConvention,
  detectMapping,
  detectNumberConvention,
  importFingerprint,
  isAmbiguousNumber,
  normalizeAmount,
  normalizeDate,
  normalizeType,
  parseDelimitedText,
} from "@/lib/csv-import";
import type { Holding, Transaction } from "@/lib/types";

const holding = (overrides: Partial<Holding>): Holding => ({
  id: "holding-eqnr",
  asset_type: "stock",
  ticker: "EQNR",
  isin: "NO0010096985",
  exchange: "OSLO",
  name: "Equinor",
  quantity: 0,
  average_cost: 0,
  market_price: 300,
  currency: "NOK",
  country: "Norway",
  sector: "Energy",
  region: "Europe",
  account_note: null,
  manual_value_nok: null,
  factor_exposures: {},
  issuer: null,
  coupon_rate: null,
  maturity_date: null,
  face_value: null,
  yield_estimate: null,
  duration_estimate: null,
  credit_quality: null,
  seniority: null,
  price_provenance: { source: "Test", as_of: "2026-08-01", status: "manual" },
  ...overrides,
});

const holdings = [
  holding({}),
  holding({ id: "holding-msft", ticker: "MSFT", isin: "US5949181045", name: "Microsoft", currency: "USD", exchange: "NASDAQ" }),
];

describe("parseDelimitedText", () => {
  it("detects a semicolon delimiter and strips a byte-order mark", () => {
    const result = parseDelimitedText("﻿Dato;Type;Antall\n2026-08-01;Kjøpt;10\n");
    expect(result.delimiter).toBe(";");
    expect(result.headers).toEqual(["Dato", "Type", "Antall"]);
    expect(result.rows).toEqual([["2026-08-01", "Kjøpt", "10"]]);
  });

  it("keeps delimiters, newlines, and escaped quotes inside quoted fields", () => {
    const result = parseDelimitedText('a,b\n"x,1","line1\nline2"\n"He said ""hi""",2');
    expect(result.rows[0]).toEqual(["x,1", "line1\nline2"]);
    expect(result.rows[1][0]).toBe('He said "hi"');
  });

  it("ignores blank lines and pads short rows", () => {
    const result = parseDelimitedText("a,b,c\n1,2\n\n3,4,5\n");
    expect(result.rows).toEqual([["1", "2", ""], ["3", "4", "5"]]);
  });

  it("reports the real file line of each row across blank and multi-line records", () => {
    const result = parseDelimitedText('a,b\n1,2\n\n3,"multi\nline"\n5,6');
    expect(result.lineNumbers).toEqual([2, 4, 6]);
  });

  it("reads tab-separated text pasted from a spreadsheet", () => {
    expect(parseDelimitedText("Date\tType\n2026-08-01\tBuy").delimiter).toBe("\t");
  });
});

describe("number conventions", () => {
  it("reads the decimal separator from a cell that uses both", () => {
    expect(detectNumberConvention(["1.234,56"])).toBe("comma");
    expect(detectNumberConvention(["1,234.56"])).toBe("dot");
  });

  it("falls back to a cell whose decimals cannot be a thousands group", () => {
    expect(detectNumberConvention(["", "466,67"])).toBe("comma");
    expect(detectNumberConvention(["12.5"])).toBe("dot");
    expect(detectNumberConvention(["1.234.567"])).toBe("comma");
  });

  it("returns null when every cell is ambiguous", () => {
    expect(detectNumberConvention(["1.000", "3.000"])).toBeNull();
    expect(detectNumberConvention([])).toBeNull();
  });

  it("flags the genuinely ambiguous shape and nothing else", () => {
    expect(isAmbiguousNumber("1.000")).toBe(true);
    expect(isAmbiguousNumber("1,000")).toBe(true);
    expect(isAmbiguousNumber("1.234,56")).toBe(false);
    expect(isAmbiguousNumber("466,67")).toBe(false);
    expect(isAmbiguousNumber("1000")).toBe(false);
    expect(isAmbiguousNumber(",500")).toBe(false);
  });

  it("applies the file's convention to an otherwise ambiguous value", () => {
    expect(normalizeAmount("1.000", "comma")).toBe(1000);
    expect(normalizeAmount("1.000", "dot")).toBe(1);
    expect(normalizeAmount("1,000", "comma")).toBe(1);
    expect(normalizeAmount("1,000", "dot")).toBe(1000);
  });
});

describe("normalizeAmount", () => {
  it("reads Norwegian decimal commas and spaced thousands", () => {
    expect(normalizeAmount("1 234,56")).toBe(1234.56);
    expect(normalizeAmount("1 234,56")).toBe(1234.56);
    expect(normalizeAmount("-99,5")).toBe(-99.5);
  });

  it("reads English thousands and decimals", () => {
    expect(normalizeAmount("1,234.56")).toBe(1234.56);
    expect(normalizeAmount("12.5")).toBe(12.5);
  });

  it("strips currency symbols and returns null for non-numeric text", () => {
    expect(normalizeAmount("NOK 1 000,00")).toBe(1000);
    expect(normalizeAmount("")).toBeNull();
    expect(normalizeAmount("n/a")).toBeNull();
  });

  it("treats parentheses as a negative", () => {
    expect(normalizeAmount("(1 234,56)")).toBe(-1234.56);
  });
});

describe("date conventions", () => {
  it("accepts the common broker date formats", () => {
    expect(normalizeDate("2026-08-01")).toBe("2026-08-01");
    expect(normalizeDate("01.08.2026")).toBe("2026-08-01");
    expect(normalizeDate("01/08/2026")).toBe("2026-08-01");
    expect(normalizeDate("2026-08-01 14:30:00")).toBe("2026-08-01");
  });

  it("rejects impossible and unreadable dates", () => {
    expect(normalizeDate("32.08.2026")).toBeNull();
    expect(normalizeDate("last tuesday")).toBeNull();
  });

  it("reads day-first or month-first from a date that settles it", () => {
    expect(detectDateConvention(["1/2/2026", "15/03/2026"])).toBe("dmy");
    expect(detectDateConvention(["1/2/2026", "12/25/2026"])).toBe("mdy");
    expect(detectDateConvention(["1/2/2026"])).toBeNull();
  });

  it("applies a month-first convention when the file proves it", () => {
    expect(normalizeDate("1/2/2026", "mdy")).toBe("2026-01-02");
    expect(normalizeDate("1/2/2026", "dmy")).toBe("2026-02-01");
  });
});

describe("normalizeType", () => {
  it("maps Norwegian and English transaction words", () => {
    expect(normalizeType("Kjøpt")).toBe("buy");
    expect(normalizeType("SALG")).toBe("sell");
    expect(normalizeType("Utbytte")).toBe("dividend");
    expect(normalizeType("Innskudd")).toBe("deposit");
    expect(normalizeType("Uttak")).toBe("withdrawal");
    expect(normalizeType("Gebyr")).toBe("fee");
    expect(normalizeType("Sold")).toBe("sell");
  });

  it("treats withholding tax as a cost, not as a dividend", () => {
    expect(normalizeType("Utbytteskatt")).toBe("fee");
    expect(normalizeType("DEBET KILDESKATT")).toBe("fee");
    expect(normalizeType("Dividend withholding tax")).toBe("fee");
  });

  it("returns null for words it does not recognise", () => {
    expect(normalizeType("Rebalansering")).toBeNull();
  });
});

describe("detectMapping", () => {
  it("maps Norwegian headers without confusing price with exchange rate", () => {
    const mapping = detectMapping([
      "Handelsdato", "Transaksjonstype", "Verdipapir", "ISIN",
      "Antall", "Kurs", "Beløp", "Kurtasje", "Valuta", "Vekslingskurs",
    ]);
    expect(mapping).toMatchObject({
      date: 0, type: 1, symbol: 2, isin: 3,
      quantity: 4, unitPrice: 5, amount: 6, fee: 7, currency: 8, fxToNok: 9,
    });
  });

  it("maps English headers", () => {
    const mapping = detectMapping(["Trade Date", "Transaction Type", "Ticker", "Quantity", "Price", "Amount", "Commission"]);
    expect(mapping).toMatchObject({ date: 0, type: 1, symbol: 2, quantity: 3, unitPrice: 4, amount: 5, fee: 6 });
  });

  it("leaves fields unmapped when no column resembles them", () => {
    expect(detectMapping(["Something", "Else"]).date).toBeUndefined();
  });
});

describe("buildImportPlan", () => {
  const text = [
    "Handelsdato;Transaksjonstype;Verdipapir;Antall;Kurs;Beløp;Kurtasje;Valuta;Vekslingskurs",
    "01.08.2026;Kjøpt;EQNR;10;300,00;3 000,00;29,00;NOK;1",
    "02.08.2026;Utbytte;MSFT;;;125,50;0;USD;10,80",
    "03.08.2026;Innskudd;;;;5 000,00;0;NOK;1",
  ].join("\n");

  it("builds transactions, matches holdings, and keeps values positive", () => {
    const plan = buildImportPlan({ text, holdings, existingTransactions: [] });
    expect(plan.issues).toEqual([]);
    expect(plan.candidates).toHaveLength(3);

    const [buy, dividend, deposit] = plan.candidates;
    expect(buy.draft).toMatchObject({
      type: "buy", occurred_at: "2026-08-01", holding_id: "holding-eqnr",
      quantity: 10, unit_price: 300, fee: 29, currency: "NOK",
    });
    expect(dividend.draft).toMatchObject({ type: "dividend", holding_id: "holding-msft", amount: 125.5, currency: "USD", fx_to_nok: 10.8 });
    expect(deposit.draft).toMatchObject({ type: "deposit", holding_id: null, amount: 5000 });
    expect(deposit.matchedHoldingName).toBeNull();
  });

  it("treats a negative broker amount as magnitude and lets the type carry direction", () => {
    const plan = buildImportPlan({
      text: "Dato;Type;Verdipapir;Antall;Kurs;Beløp\n01.08.2026;Salg;EQNR;-5;310,00;-1 550,00",
      holdings,
      existingTransactions: [],
    });
    expect(plan.candidates[0].draft).toMatchObject({ type: "sell", quantity: 5, unit_price: 310 });
  });

  it("reads a negative deposit as a withdrawal", () => {
    const plan = buildImportPlan({
      text: "Dato;Type;Beløp;Valuta\n01.08.2026;Innskudd;10 000,00;NOK\n02.08.2026;Innskudd;-10 000,00;NOK",
      holdings,
      existingTransactions: [],
    });
    expect(plan.candidates.map((candidate) => candidate.draft.type)).toEqual(["deposit", "withdrawal"]);
    expect(plan.candidates.map((candidate) => candidate.draft.amount)).toEqual([10000, 10000]);
  });

  it("reports unreadable rows instead of importing a guess", () => {
    const plan = buildImportPlan({
      text: [
        "Dato;Type;Verdipapir;Antall;Kurs;Beløp",
        "not-a-date;Kjøpt;EQNR;10;300;3000",
        "01.08.2026;Rebalansering;EQNR;10;300;3000",
        "01.08.2026;Kjøpt;TSLA;10;300;3000",
      ].join("\n"),
      holdings,
      existingTransactions: [],
    });
    expect(plan.candidates).toHaveLength(0);
    expect(plan.issues.map((issue) => issue.rowNumber)).toEqual([2, 3, 4]);
    expect(plan.issues[0].reason).toMatch(/date/i);
    expect(plan.issues[1].reason).toMatch(/type/i);
    expect(plan.issues[2].reason).toMatch(/holding/i);
  });

  it("refuses a buy or sell that is missing a quantity or a unit price", () => {
    const plan = buildImportPlan({
      text: [
        "Dato;Type;Verdipapir;Antall;Kurs;Beløp",
        "01.08.2026;Kjøpt;EQNR;;;3 000,00",
        "02.08.2026;Salg;EQNR;10;;3 100,00",
      ].join("\n"),
      holdings,
      existingTransactions: [],
    });
    expect(plan.candidates).toHaveLength(0);
    expect(plan.issues).toHaveLength(2);
    expect(plan.issues[0].reason).toMatch(/quantity and a unit price/i);
  });

  it("refuses a row whose amount cannot be read", () => {
    const plan = buildImportPlan({
      text: "Dato;Type;Verdipapir;Beløp\n01.08.2026;Utbytte;EQNR;",
      holdings,
      existingTransactions: [],
    });
    expect(plan.candidates).toHaveLength(0);
    expect(plan.issues[0].reason).toMatch(/amount/i);
  });

  it("refuses a foreign-currency row whose NOK value depends on an unknown rate", () => {
    const plan = buildImportPlan({
      text: "Dato;Type;Verdipapir;Beløp;Valuta\n02.08.2026;Utbytte;MSFT;125,50;USD",
      holdings,
      existingTransactions: [],
    });
    expect(plan.candidates).toHaveLength(0);
    expect(plan.issues[0].reason).toMatch(/exchange rate/i);
  });

  it("still imports a foreign-currency buy, whose cost does not depend on the row's rate", () => {
    const plan = buildImportPlan({
      text: "Dato;Type;Verdipapir;Antall;Kurs;Valuta\n02.08.2026;Kjøpt;MSFT;5;466,67;USD",
      holdings,
      existingTransactions: [],
    });
    expect(plan.issues).toEqual([]);
    expect(plan.candidates[0].draft).toMatchObject({ type: "buy", currency: "USD", quantity: 5 });
  });

  it("refuses a split rather than importing a ratio it cannot know", () => {
    const plan = buildImportPlan({
      text: "Dato;Type;Verdipapir;Antall\n01.08.2026;Splitt;EQNR;10",
      holdings,
      existingTransactions: [],
    });
    expect(plan.candidates).toHaveLength(0);
    expect(plan.issues[0].reason).toMatch(/split ratio/i);
  });

  it("refuses an ambiguous number when the file never reveals its decimal separator", () => {
    const plan = buildImportPlan({
      text: "Dato;Type;Verdipapir;Antall;Kurs\n01.08.2026;Kjøpt;EQNR;10;1.000",
      holdings,
      existingTransactions: [],
    });
    expect(plan.numberConvention).toBeNull();
    expect(plan.candidates).toHaveLength(0);
    expect(plan.issues[0].reason).toMatch(/two ways/i);
  });

  it("reads dot-grouped thousands once another cell reveals the convention", () => {
    const plan = buildImportPlan({
      text: "Dato;Type;Verdipapir;Antall;Kurs\n01.08.2026;Kjøpt;EQNR;10;1.000\n02.08.2026;Kjøpt;EQNR;5;1.234,50",
      holdings,
      existingTransactions: [],
    });
    expect(plan.numberConvention).toBe("comma");
    expect(plan.candidates[0].draft.unit_price).toBe(1000);
    expect(plan.candidates[1].draft.unit_price).toBe(1234.5);
  });

  it("keeps two genuinely identical rows distinct but stays stable across re-imports", () => {
    const twice = "Dato;Type;Verdipapir;Antall;Kurs\n01.08.2026;Kjøpt;EQNR;10;300,00\n01.08.2026;Kjøpt;EQNR;10;300,00";
    const first = buildImportPlan({ text: twice, holdings, existingTransactions: [] });
    expect(first.candidates).toHaveLength(2);
    expect(first.candidates[0].draft.import_fingerprint).not.toBe(first.candidates[1].draft.import_fingerprint);

    const second = buildImportPlan({ text: twice, holdings, existingTransactions: [] });
    expect(second.candidates.map((item) => item.draft.import_fingerprint))
      .toEqual(first.candidates.map((item) => item.draft.import_fingerprint));
  });

  it("flags rows already imported and rows that look like existing manual entries", () => {
    const first = buildImportPlan({ text, holdings, existingTransactions: [] });
    const imported = first.candidates.map((candidate) => candidate.draft);
    const reimported = buildImportPlan({ text, holdings, existingTransactions: imported });
    expect(reimported.candidates.every((candidate) => candidate.duplicate === "already-imported")).toBe(true);

    const manual: Transaction = { ...imported[0], id: "manual-1", import_fingerprint: null };
    const againstManual = buildImportPlan({ text, holdings, existingTransactions: [manual] });
    expect(againstManual.candidates[0].duplicate).toBe("matches-existing");
    expect(againstManual.candidates[1].duplicate).toBeNull();
  });

  it("honours a manual column mapping override", () => {
    const plan = buildImportPlan({
      text: "one;two;three;four;five\n01.08.2026;Kjøpt;EQNR;10;300,00",
      holdings,
      existingTransactions: [],
      mapping: { date: 0, type: 1, symbol: 2, quantity: 3, unitPrice: 4 },
    });
    expect(plan.candidates[0].draft).toMatchObject({ occurred_at: "2026-08-01", quantity: 10, unit_price: 300 });
  });
});

describe("importFingerprint", () => {
  it("changes when any meaningful field changes", () => {
    const base = { type: "buy", occurred_at: "2026-08-01", instrument: "EQNR", quantity: 10, unitPrice: 300, amount: null, fee: 29, currency: "NOK", occurrence: 0 } as const;
    const reference = importFingerprint(base);
    expect(importFingerprint({ ...base, quantity: 11 })).not.toBe(reference);
    expect(importFingerprint({ ...base, occurrence: 1 })).not.toBe(reference);
    expect(importFingerprint({ ...base })).toBe(reference);
  });
});
