export const majorMarketInstruments = [
  { id: "index-sp500", symbol: "^GSPC", name: "S&P 500", currency: "USD" },
  { id: "index-nasdaq", symbol: "^IXIC", name: "Nasdaq Composite", currency: "USD" },
  { id: "index-stoxx", symbol: "^STOXX", name: "STOXX Europe 600", currency: "EUR" },
  { id: "index-dax", symbol: "^GDAXI", name: "DAX", currency: "EUR" },
  { id: "index-ftse", symbol: "^FTSE", name: "FTSE 100", currency: "GBP" },
  { id: "index-nikkei", symbol: "^N225", name: "Nikkei 225", currency: "JPY" },
  { id: "index-oslo", symbol: "OSEBX.OL", name: "Oslo Bors Benchmark", currency: "NOK" },
] as const;

const exchangeSuffixes: Record<string, string> = {
  XETRA: ".DE",
  XTRA: ".DE",
  FRANKFURT: ".F",
  LONDON: ".L",
  LSE: ".L",
  OSLO: ".OL",
  OSL: ".OL",
  STOCKHOLM: ".ST",
  COPENHAGEN: ".CO",
  HELSINKI: ".HE",
  EURONEXT: ".AS",
};

export function marketDataSymbol(symbol: string, exchange?: string | null) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol || normalizedSymbol.startsWith("^") || normalizedSymbol.includes(".")) {
    return normalizedSymbol;
  }
  const suffix = exchange ? exchangeSuffixes[exchange.trim().toUpperCase()] : undefined;
  return suffix ? `${normalizedSymbol}${suffix}` : normalizedSymbol;
}

const eodhdExchangeCodes: Record<string, string> = {
  XETRA: "XETRA",
  XTRA: "XETRA",
  FRANKFURT: "F",
  LONDON: "LSE",
  LSE: "LSE",
  OSLO: "OL",
  OSL: "OL",
  STOCKHOLM: "ST",
  COPENHAGEN: "CO",
  HELSINKI: "HE",
  EURONEXT: "AS",
};

const yahooToEodhdSuffix: Record<string, string> = {
  DE: "XETRA",
  F: "F",
  L: "LSE",
  OL: "OL",
  ST: "ST",
  CO: "CO",
  HE: "HE",
  AS: "AS",
  PA: "PA",
};

export function eodhdSymbol(symbol: string, exchange?: string | null) {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized || normalized.startsWith("^")) return null;
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex > 0) {
    const base = normalized.slice(0, dotIndex);
    const suffix = normalized.slice(dotIndex + 1);
    const mapped = yahooToEodhdSuffix[suffix];
    return mapped ? `${base}.${mapped}` : normalized;
  }
  const code = exchange ? eodhdExchangeCodes[exchange.trim().toUpperCase()] : undefined;
  return `${normalized}.${code ?? "US"}`;
}
