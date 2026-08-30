import { NextResponse } from "next/server";
import { createCallBudget } from "@/lib/market-data";
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
  // Holdings come first so the owner's own positions get the metered Twelve Data
  // calls; indices fall through to the delayed public feed once the budget is spent.
  const requests = [...holdings, ...majorMarketInstruments];
  const twelveDataBudget = createCallBudget(8);
  const quotes = (await Promise.all(
    requests.map((instrument) => fetchLatestQuote(instrument, { twelveDataBudget })),
  )).filter(Boolean);
  return NextResponse.json({
    quotes,
    provider: process.env.TWELVE_DATA_API_KEY ? "Twelve Data with delayed fallback" : "Delayed public market feed",
    refreshedAt: new Date().toISOString(),
  });
}
