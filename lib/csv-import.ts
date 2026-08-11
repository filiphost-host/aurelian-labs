import type { Holding, Transaction, TransactionType } from "@/lib/types";

export type ImportField =
  | "date"
  | "type"
  | "symbol"
  | "isin"
  | "quantity"
  | "unitPrice"
  | "amount"
  | "fee"
  | "currency"
  | "fxToNok"
  | "note";

export type ColumnMapping = Partial<Record<ImportField, number>>;

/** Which separator a file uses for decimals. Decided per file, never per cell. */
export type NumberConvention = "comma" | "dot";
/** Whether a file writes dates day-first (01.08.2026) or month-first (08/01/2026). */
export type DateConvention = "dmy" | "mdy";

export type ImportCandidate = {
  rowNumber: number;
  draft: Transaction;
  instrumentLabel: string;
  matchedHoldingName: string | null;
  duplicate: "already-imported" | "matches-existing" | null;
};

export type ImportIssue = { rowNumber: number; reason: string; raw: string };

export type ImportPlan = {
  headers: string[];
  rows: string[][];
  delimiter: string;
  mapping: ColumnMapping;
  candidates: ImportCandidate[];
  issues: ImportIssue[];
  numberConvention: NumberConvention | null;
  dateConvention: DateConvention;
};

export const importFieldLabels: Record<ImportField, string> = {
  date: "Date",
  type: "Transaction type",
  symbol: "Ticker or name",
  isin: "ISIN",
  quantity: "Quantity",
  unitPrice: "Unit price",
  amount: "Amount",
  fee: "Fee",
  currency: "Currency",
  fxToNok: "FX to NOK",
  note: "Note",
};

const quantityTypes: TransactionType[] = ["opening_balance", "buy", "sell"];
/** Types whose NOK value is computed from fx_to_nok, so an unknown rate is not safe to assume. */
const fxSensitiveTypes: TransactionType[] = ["sell", "dividend", "fee", "deposit", "withdrawal"];

export function parseDelimitedText(text: string) {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const delimiter = detectDelimiter(clean);
  const records: Array<{ cells: string[]; line: number }> = [];
  let field = "";
  let cells: string[] = [];
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  for (let index = 0; index < clean.length; index += 1) {
    const character = clean[index];
    if (quoted) {
      if (character === '"') {
        if (clean[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else {
        if (character === "\n") line += 1;
        field += character;
      }
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === delimiter) {
      cells.push(field);
      field = "";
    } else if (character === "\n") {
      cells.push(field);
      records.push({ cells, line: recordLine });
      cells = [];
      field = "";
      line += 1;
      recordLine = line;
    } else field += character;
  }
  cells.push(field);
  records.push({ cells, line: recordLine });

  const usable = records
    .map((record) => ({ cells: record.cells.map((cell) => cell.trim()), line: record.line }))
    .filter((record) => record.cells.some((cell) => cell !== ""));
  const header = usable.shift();
  const headers = header?.cells ?? [];
  const rows = usable.map((record) => {
    const padded = [...record.cells];
    while (padded.length < headers.length) padded.push("");
    return padded;
  });

  return { headers, rows, delimiter, lineNumbers: usable.map((record) => record.line) };
}

function detectDelimiter(text: string) {
  const line = text.split("\n").find((candidate) => candidate.trim() !== "") ?? "";
  let best = { delimiter: ",", count: 0 };
  for (const delimiter of [";", "\t", ","]) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === '"') quoted = !quoted;
      else if (!quoted && line[index] === delimiter) count += 1;
    }
    if (count > best.count) best = { delimiter, count };
  }
  return best.delimiter;
}

function digitsOnly(value: string) {
  return value.replace(/[^0-9,.\-+\s  ]/g, "").replace(/[\s  ]/g, "");
}

/**
 * A single separator followed by exactly three digits means either a decimal or a
 * thousands group, and the cell alone cannot say which. The file decides.
 */
export function isAmbiguousNumber(value: string | null | undefined) {
  if (typeof value !== "string") return false;
  const stripped = digitsOnly(value);
  if (!/\d/.test(stripped)) return false;
  const commas = (stripped.match(/,/g) ?? []).length;
  const dots = (stripped.match(/\./g) ?? []).length;
  if (commas + dots !== 1) return false;
  const separator = commas === 1 ? "," : ".";
  const position = stripped.indexOf(separator);
  return stripped.length - position - 1 === 3 && /\d/.test(stripped.slice(0, position));
}

/** Reads the file's decimal separator from any cell that uses both separators. */
export function detectNumberConvention(samples: Array<string | null | undefined>): NumberConvention | null {
  for (const sample of samples) {
    if (typeof sample !== "string") continue;
    const stripped = digitsOnly(sample);
    const lastComma = stripped.lastIndexOf(",");
    const lastDot = stripped.lastIndexOf(".");
    if (lastComma >= 0 && lastDot >= 0) return lastComma > lastDot ? "comma" : "dot";
  }
  for (const sample of samples) {
    if (typeof sample !== "string") continue;
    const stripped = digitsOnly(sample);
    const commas = (stripped.match(/,/g) ?? []).length;
    const dots = (stripped.match(/\./g) ?? []).length;
    if (commas > 1 && dots === 0) return "dot";
    if (dots > 1 && commas === 0) return "comma";
    const separator = commas === 1 ? "," : dots === 1 ? "." : null;
    if (!separator) continue;
    const position = stripped.indexOf(separator);
    const decimals = stripped.length - position - 1;
    if (decimals !== 3 && /\d/.test(stripped.slice(0, position))) {
      return separator === "," ? "comma" : "dot";
    }
  }
  return null;
}

export function normalizeAmount(value: string | null | undefined, convention?: NumberConvention | null) {
  if (typeof value !== "string") return null;
  const negated = /\(.*\)/.test(value);
  const stripped = digitsOnly(value);
  if (!/\d/.test(stripped)) return null;

  const lastComma = stripped.lastIndexOf(",");
  const lastDot = stripped.lastIndexOf(".");
  let normalized = stripped;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? stripped.replace(/\./g, "").replace(",", ".")
      : stripped.replace(/,/g, "");
  } else if (lastComma >= 0 || lastDot >= 0) {
    const separator = lastComma >= 0 ? "," : ".";
    const position = lastComma >= 0 ? lastComma : lastDot;
    const decimals = stripped.length - position - 1;
    const decimalSeparator = convention === "comma" ? "," : convention === "dot" ? "." : null;
    const isDecimal = decimalSeparator !== null
      ? separator === decimalSeparator
      : separator === "," ? !(decimals === 3 && /\d/.test(stripped.slice(0, position))) : true;
    normalized = isDecimal
      ? `${stripped.slice(0, position)}.${stripped.slice(position + 1)}`
      : stripped.replace(new RegExp(`\\${separator}`, "g"), "");
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return negated ? -Math.abs(parsed) : parsed;
}

/** Reads day-first vs month-first from any date whose components settle it. */
export function detectDateConvention(samples: Array<string | null | undefined>): DateConvention | null {
  for (const sample of samples) {
    if (typeof sample !== "string") continue;
    const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(sample.trim().split(/[\sT]/)[0] ?? "");
    if (!match) continue;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12 && second <= 12) return "dmy";
    if (second > 12 && first <= 12) return "mdy";
  }
  return null;
}

export function normalizeDate(value: string | null | undefined, convention: DateConvention = "dmy") {
  if (typeof value !== "string") return null;
  const token = value.trim().split(/[\sT]/)[0] ?? "";
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(token);
  const local = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(token);
  const parts = iso
    ? { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) }
    : local
      ? {
          year: Number(local[3]),
          month: convention === "mdy" ? Number(local[1]) : Number(local[2]),
          day: convention === "mdy" ? Number(local[2]) : Number(local[1]),
        }
      : null;
  if (!parts) return null;

  const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (
    candidate.getUTCFullYear() !== parts.year ||
    candidate.getUTCMonth() !== parts.month - 1 ||
    candidate.getUTCDate() !== parts.day
  ) return null;
  return candidate.toISOString().slice(0, 10);
}

// Tax and reversal wording is checked before the plain words it contains, so
// "utbytteskatt" is a cost rather than a dividend.
const typeKeywords: Array<{ type: TransactionType; words: string[] }> = [
  { type: "fee", words: ["utbytteskatt", "kildeskatt", "forskuddstrekk", "withholding", "skatt", "tax"] },
  { type: "opening_balance", words: ["inngående", "inngaende", "opening balance", "opening"] },
  { type: "dividend", words: ["utbytte", "dividend"] },
  { type: "withdrawal", words: ["uttak", "withdrawal", "utbetaling"] },
  { type: "deposit", words: ["innskudd", "innbetaling", "deposit"] },
  { type: "fee", words: ["kurtasje", "gebyr", "avgift", "courtage", "commission", "fee"] },
  { type: "split", words: ["splitt", "split"] },
  { type: "sell", words: ["salg", "solgt", "selg", "innløsning", "sold", "sell"] },
  { type: "buy", words: ["kjøpt", "kjøp", "kjopt", "kjop", "tegning", "bought", "buy", "purchase"] },
];

export function normalizeType(value: string | null | undefined): TransactionType | null {
  if (typeof value !== "string") return null;
  const text = value.trim().toLowerCase();
  if (!text) return null;
  for (const entry of typeKeywords) {
    if (entry.words.some((word) => text.includes(word))) return entry.type;
  }
  return null;
}

const fieldPatterns: Record<ImportField, string[]> = {
  date: ["handelsdato", "handelsdag", "transaksjonsdato", "oppgjørsdato", "bokføringsdato", "bokføringsdag", "trade date", "booking date", "dato", "dag", "date"],
  type: ["transaksjonstype", "transaction type", "transaksjon", "transaction", "hendelse", "event", "type"],
  symbol: ["verdipapir", "instrument", "security", "ticker", "symbol", "aksje", "navn", "name"],
  isin: ["isin"],
  quantity: ["antall", "quantity", "shares", "andeler", "volum", "qty", "stk"],
  unitPrice: ["kjøpskurs", "salgskurs", "unit price", "price", "kurs", "pris"],
  amount: ["nettobeløp", "bruttobeløp", "beløp", "belop", "amount", "total", "verdi", "sum"],
  fee: ["kurtasje", "courtage", "commission", "gebyr", "avgift", "fee"],
  currency: ["valutakode", "valuta", "currency", "ccy"],
  fxToNok: ["vekslingskurs", "valutakurs", "exchange rate", "kurs mot nok", "fx"],
  note: ["beskrivelse", "description", "kommentar", "notat", "note", "tekst"],
};

export function detectMapping(headers: string[]): ColumnMapping {
  const scores: Array<{ field: ImportField; column: number; score: number }> = [];
  headers.forEach((header, column) => {
    const text = header.trim().toLowerCase();
    if (!text) return;
    for (const [field, patterns] of Object.entries(fieldPatterns) as Array<[ImportField, string[]]>) {
      let best = 0;
      for (const pattern of patterns) {
        if (text === pattern) best = Math.max(best, 100);
        else if (text.startsWith(pattern)) best = Math.max(best, 60);
        else if (text.endsWith(pattern)) best = Math.max(best, 50);
        else if (text.includes(pattern)) best = Math.max(best, 30);
      }
      if (best > 0) scores.push({ field, column, score: best });
    }
  });

  scores.sort((left, right) => right.score - left.score || left.column - right.column);
  const mapping: ColumnMapping = {};
  const usedColumns = new Set<number>();
  for (const entry of scores) {
    if (mapping[entry.field] !== undefined || usedColumns.has(entry.column)) continue;
    mapping[entry.field] = entry.column;
    usedColumns.add(entry.column);
  }
  return mapping;
}

export function importFingerprint(input: {
  type: string;
  occurred_at: string;
  instrument: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number | null;
  fee: number;
  currency: string;
  occurrence: number;
}) {
  const number = (value: number | null) => (value === null ? "" : value.toFixed(6));
  return [
    input.occurred_at,
    input.type,
    input.instrument.toUpperCase(),
    number(input.quantity),
    number(input.unitPrice),
    number(input.amount),
    number(input.fee),
    input.currency.toUpperCase(),
    input.occurrence,
  ].join("|");
}

function matchHolding(holdings: Holding[], symbol: string, isin: string) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const bareSymbol = normalizedSymbol.split(".")[0];
  const normalizedIsin = isin.trim().toUpperCase();
  return holdings.find((holding) => {
    if (normalizedIsin && holding.isin && holding.isin.toUpperCase() === normalizedIsin) return true;
    if (!normalizedSymbol) return false;
    const holdingTicker = holding.ticker?.trim().toUpperCase() ?? "";
    return holdingTicker !== "" &&
      (holdingTicker === normalizedSymbol ||
        holdingTicker.split(".")[0] === bareSymbol ||
        holding.name.trim().toUpperCase() === normalizedSymbol);
  }) ?? null;
}

function sameLedgerEntry(left: Transaction, right: Transaction) {
  return left.type === right.type &&
    left.occurred_at === right.occurred_at &&
    left.holding_id === right.holding_id &&
    left.quantity === right.quantity &&
    left.unit_price === right.unit_price &&
    left.amount === right.amount &&
    left.currency.toUpperCase() === right.currency.toUpperCase();
}

export function buildImportPlan(input: {
  text: string;
  holdings: Holding[];
  existingTransactions: Transaction[];
  mapping?: ColumnMapping;
}): ImportPlan {
  const { headers, rows, delimiter, lineNumbers } = parseDelimitedText(input.text);
  const mapping = input.mapping ?? detectMapping(headers);
  const candidates: ImportCandidate[] = [];
  const issues: ImportIssue[] = [];
  const occurrences = new Map<string, number>();
  const existingFingerprints = new Set(
    input.existingTransactions
      .map((transaction) => transaction.import_fingerprint)
      .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
  );

  const cell = (row: string[], field: ImportField) => {
    const column = mapping[field];
    return column === undefined ? "" : row[column] ?? "";
  };

  const numericFields: ImportField[] = ["quantity", "unitPrice", "amount", "fee", "fxToNok"];
  const numberConvention = detectNumberConvention(
    rows.flatMap((row) => numericFields.map((field) => cell(row, field))),
  );
  const dateConvention = detectDateConvention(rows.map((row) => cell(row, "date"))) ?? "dmy";

  rows.forEach((row, index) => {
    const rowNumber = lineNumbers[index] ?? index + 2;
    const raw = row.join(delimiter);
    const fail = (reason: string) => issues.push({ rowNumber, reason, raw });

    const occurredAt = normalizeDate(cell(row, "date"), dateConvention);
    if (!occurredAt) return fail("Could not read a transaction date in this row.");

    const type = normalizeType(cell(row, "type"));
    if (!type) return fail("Unrecognised transaction type.");
    if (type === "split") {
      return fail("Stock splits must be recorded by hand so the split ratio is explicit.");
    }

    const ambiguous = numericFields
      .filter((field) => isAmbiguousNumber(cell(row, field)))
      .map((field) => importFieldLabels[field]);
    if (numberConvention === null && ambiguous.length) {
      return fail(`${ambiguous.join(" and ")} could be read two ways because this file never shows which separator marks decimals. Correct the value or import it by hand.`);
    }

    const symbol = cell(row, "symbol");
    const isin = cell(row, "isin");
    const instrumentLabel = symbol || isin;
    const needsHolding = type !== "deposit" && type !== "withdrawal";
    const holding = needsHolding ? matchHolding(input.holdings, symbol, isin) : null;
    if (needsHolding && !holding) {
      return fail(instrumentLabel
        ? `No matching holding for ${instrumentLabel}. Add the holding first, then import again.`
        : "This row needs a holding but names no instrument.");
    }

    const read = (field: ImportField) => normalizeAmount(cell(row, field), numberConvention);
    const magnitude = (value: number | null) => (value === null ? null : Math.abs(value));
    const usesQuantity = quantityTypes.includes(type);
    const quantity = usesQuantity ? magnitude(read("quantity")) : null;
    const unitPrice = usesQuantity ? magnitude(read("unitPrice")) : null;
    const signedAmount = usesQuantity ? null : read("amount");
    const fee = magnitude(read("fee")) ?? 0;

    // A negative deposit is a withdrawal, and the reverse; for these two the sign
    // is the only thing that distinguishes a booking from its reversal.
    let effectiveType = type;
    if (signedAmount !== null && signedAmount < 0) {
      if (type === "deposit") effectiveType = "withdrawal";
      else if (type === "withdrawal") effectiveType = "deposit";
    }
    const amount = signedAmount === null ? null : Math.abs(signedAmount);

    if (usesQuantity && (quantity === null || quantity === 0 || unitPrice === null)) {
      return fail("A buy or sell needs both a quantity and a unit price. This row is missing one of them.");
    }
    if (!usesQuantity && amount === null) {
      return fail("This row has no readable amount.");
    }

    const currency = (cell(row, "currency").trim().toUpperCase() || holding?.currency || "NOK").slice(0, 3);
    const fxToNok = read("fxToNok");
    const hasFx = fxToNok !== null && fxToNok > 0;
    if (currency !== "NOK" && !hasFx && fxSensitiveTypes.includes(effectiveType)) {
      return fail(`This ${effectiveType.replace("_", " ")} is in ${currency} and its NOK value depends on the exchange rate. Map the file's exchange-rate column, or record the row by hand.`);
    }

    const fingerprintBase = {
      type: effectiveType,
      occurred_at: occurredAt,
      instrument: holding?.id ?? instrumentLabel,
      quantity,
      unitPrice,
      amount,
      fee,
      currency,
    };
    const occurrenceKey = importFingerprint({ ...fingerprintBase, occurrence: 0 });
    const occurrence = occurrences.get(occurrenceKey) ?? 0;
    occurrences.set(occurrenceKey, occurrence + 1);

    const draft: Transaction = {
      id: crypto.randomUUID(),
      holding_id: holding?.id ?? null,
      type: effectiveType,
      occurred_at: occurredAt,
      quantity,
      unit_price: unitPrice,
      amount,
      fee,
      currency,
      fx_to_nok: hasFx ? fxToNok : 1,
      split_ratio: null,
      note: cell(row, "note").trim() || null,
      import_fingerprint: importFingerprint({ ...fingerprintBase, occurrence }),
    };

    candidates.push({
      rowNumber,
      draft,
      instrumentLabel,
      matchedHoldingName: holding?.name ?? null,
      duplicate: existingFingerprints.has(draft.import_fingerprint!)
        ? "already-imported"
        : input.existingTransactions.some((transaction) => sameLedgerEntry(transaction, draft))
          ? "matches-existing"
          : null,
    });
  });

  return { headers, rows, delimiter, mapping, candidates, issues, numberConvention, dateConvention };
}
