import { NextResponse } from "next/server";
import { z } from "zod";
import { searchInstruments } from "@/lib/providers";

const querySchema = z.string().trim().min(2).max(80);

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q");
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ results: [], message: "Enter at least two characters." }, { status: 400 });
  }

  const results = await searchInstruments(parsed.data);
  return NextResponse.json({
    results,
    asOf: new Date().toISOString(),
    sources: ["OpenFIGI", ...(process.env.TWELVE_DATA_API_KEY ? ["Twelve Data"] : [])],
  });
}
