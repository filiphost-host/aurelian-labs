/**
 * Norges Bank publishes the official NOK exchange rates and the key policy rate as
 * semicolon-separated data with no key and no quota. For a NOK portfolio these are
 * the rates of record, so they are preferred over the ECB cross-rates.
 */
export type NorgesBankRates = {
  rates: Record<string, number>;
  asOf: string;
  source: string;
};

/**
 * Values arrive in the en locale, where a comma groups thousands: CHF is published
 * as "1,174.17". Anything that is not exactly that shape is rejected rather than
 * coerced, so a locale change cannot turn 9,5145 into 95145.
 */
function parseEnNumber(value: string | undefined) {
  const text = (value ?? "").trim();
  const grouped = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;
  const plain = /^-?\d+(\.\d+)?$/;
  if (!grouped.test(text) && !plain.test(text)) return null;
  const parsed = Number(text.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRows(csv: string) {
  const lines = csv.trim().split(/\r?\n/).filter((line) => line.trim() !== "");
  const headers = lines.shift()?.split(";") ?? [];
  return lines.map((line) => {
    const cells = line.split(";");
    return Object.fromEntries(headers.map((header, index) => [header.trim(), (cells[index] ?? "").trim()]));
  });
}

export function parseNorgesBankRates(csv: string): NorgesBankRates | null {
  const rows = parseRows(csv);
  const rates: Record<string, number> = {};
  let asOf: string | null = null;

  for (const row of rows) {
    const base = (row.BASE_CUR ?? "").toUpperCase();
    const quote = (row.QUOTE_CUR ?? "").toUpperCase();
    const value = parseEnNumber(row.OBS_VALUE);
    const multiplier = parseEnNumber(row.UNIT_MULT);
    const date = row.TIME_PERIOD ?? "";
    if (!base || quote !== "NOK" || value === null || value <= 0 || !date) continue;
    // A unit multiplier of 2 means the quote is per 100 units of the base currency.
    rates[base] = multiplier !== null && multiplier > 0 ? value / 10 ** multiplier : value;
    if (asOf === null || date.localeCompare(asOf) > 0) asOf = date;
  }

  if (!asOf || Object.keys(rates).length === 0) return null;
  return { rates: { ...rates, NOK: 1 }, asOf, source: "Norges Bank" };
}

export function parseNorgesBankPolicyRate(csv: string) {
  const rows = parseRows(csv);
  const latest = rows
    .filter((row) => parseEnNumber(row.OBS_VALUE) !== null && (row.TIME_PERIOD ?? "") !== "")
    .sort((left, right) => (left.TIME_PERIOD ?? "").localeCompare(right.TIME_PERIOD ?? ""))
    .at(-1);
  if (!latest) return null;
  return {
    percent: parseEnNumber(latest.OBS_VALUE)!,
    asOf: latest.TIME_PERIOD,
    source: "Norges Bank key policy rate",
  };
}
