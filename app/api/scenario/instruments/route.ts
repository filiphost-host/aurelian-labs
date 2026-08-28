import { NextResponse } from "next/server";
import { z } from "zod";
import { inferFactorExposures, recessionRiskScore } from "@/lib/instrument-research";
import { fetchAlphaVantageInstrumentMetrics, searchInstruments } from "@/lib/providers";
import type { StressInstrument } from "@/lib/stress-portfolio";

const querySchema = z.string().trim().min(2).max(40);

function assetType(type: string | null): StressInstrument["assetType"] | null {
  const normalized = type?.toLowerCase() ?? "";
  if (normalized.includes("stock") || normalized.includes("equity")) return "stock";
  if (normalized.includes("etf") || normalized.includes("etp") || normalized.includes("fund")) return "etf";
  if (normalized.includes("corp") || normalized.includes("government") || normalized.includes("municipal") || normalized.includes("bond")) return "bond";
  return null;
}

function exchangeMarket(exchange: string | null) {
  const code = exchange?.toUpperCase() ?? "";
  if (["US", "UN", "UW", "UQ", "UA", "NYSE", "NASDAQ", "ARCA"].includes(code)) return { country: "United States", currency: "USD" };
  if (["NO", "OS", "OSLO"].includes(code)) return { country: "Norway", currency: "NOK" };
  if (["SS", "ST", "STOCKHOLM"].includes(code)) return { country: "Sweden", currency: "SEK" };
  if (["DC", "CO", "COPENHAGEN"].includes(code)) return { country: "Denmark", currency: "DKK" };
  if (["GR", "GY", "XETRA"].includes(code)) return { country: "Germany", currency: "EUR" };
  if (["FP", "PARIS"].includes(code)) return { country: "France", currency: "EUR" };
  if (["NA", "AMSTERDAM"].includes(code)) return { country: "Netherlands", currency: "EUR" };
  if (["LN", "LONDON"].includes(code)) return { country: "United Kingdom", currency: "GBP" };
  return { country: "Unclassified", currency: "NOK" };
}

export async function GET(request: Request) {
  const parsed = querySchema.safeParse(new URL(request.url).searchParams.get("q"));
  if (!parsed.success) return NextResponse.json({ results: [], message: "Enter at least two characters." }, { status: 400 });

  const matches = await searchInstruments(parsed.data);
  const exactIndex = matches.findIndex((match) => match.symbol.toLowerCase() === parsed.data.toLowerCase());
  const exactMetrics = exactIndex >= 0 ? await fetchAlphaVantageInstrumentMetrics(matches[exactIndex].symbol) : null;
  const results = matches.flatMap((match, index): StressInstrument[] => {
    const resolvedType = assetType(match.instrumentType);
    if (!resolvedType || !match.symbol) return [];
    const metrics = index === exactIndex ? exactMetrics : null;
    const market = exchangeMarket(match.exchange);
    const country = match.country ?? market.country;
    const currency = metrics?.currency ?? match.currency ?? market.currency;
    const sector = metrics?.sector ?? (resolvedType === "bond" ? "Bond" : "Unclassified");
    return [{
      id: `research-${match.id}`,
      ticker: match.symbol,
      name: match.name,
      assetType: resolvedType,
      country,
      sector,
      currency,
      exchange: match.exchange ?? undefined,
      exposures: inferFactorExposures({ assetType: resolvedType, country, sector, currency }),
      forwardPe: metrics?.forwardPe ?? null,
      sharpe: metrics?.sharpe ?? null,
      recessionRisk: metrics?.recessionRisk ?? recessionRiskScore({ assetType: resolvedType, sector }),
      metricSource: metrics?.source ?? `${match.source} identity`,
      metricsAsOf: metrics?.asOf ?? null,
    }];
  });

  return NextResponse.json({
    results,
    asOf: new Date().toISOString(),
    sources: ["OpenFIGI", ...(process.env.TWELVE_DATA_API_KEY ? ["Twelve Data"] : []), ...(process.env.ALPHA_VANTAGE_API_KEY ? ["Alpha Vantage"] : [])],
    enrichment: process.env.ALPHA_VANTAGE_API_KEY ? "Exact ticker matches are enriched." : "Add ALPHA_VANTAGE_API_KEY for exact-match valuation and adjusted-return metrics.",
  });
}
