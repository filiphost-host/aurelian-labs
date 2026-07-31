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
