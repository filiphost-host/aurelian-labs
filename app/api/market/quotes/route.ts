import { NextResponse } from "next/server";
import { majorMarketInstruments } from "@/lib/market-symbols";
import { fetchLatestQuote } from "@/lib/providers";

export const runtime = "nodejs";

type RequestedInstrument = {
  id?: unknown;
  symbol?: unknown;
  name?: unknown;
  exchange?: unknown;
  currency?: unknown;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { instruments?: RequestedInstrument[] } | null;
  const holdings = (body?.instruments ?? []).slice(0, 20).flatMap((item) => {
    if (typeof item.id !== "string" || typeof item.symbol !== "string" || typeof item.name !== "string") return [];
    return [{
      id: item.id,
      symbol: item.symbol.slice(0, 24),
      name: item.name.slice(0, 100),
      exchange: typeof item.exchange === "string" ? item.exchange.slice(0, 40) : null,
      currency: typeof item.currency === "string" ? item.currency.slice(0, 8) : null,
    }];
  });
  const requests = [...majorMarketInstruments, ...holdings];
  const quotes = (await Promise.all(requests.map((instrument) => fetchLatestQuote(instrument)))).filter(Boolean);
  return NextResponse.json({
    quotes,
    provider: process.env.TWELVE_DATA_API_KEY ? "Twelve Data with delayed fallback" : "Delayed public market feed",
    refreshedAt: new Date().toISOString(),
  });
}
