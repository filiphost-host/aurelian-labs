import { NextResponse } from "next/server";
import { fetchNorgesBankPolicyRate } from "@/lib/providers";

export const runtime = "nodejs";

/**
 * Reports which data sources this deployment can reach. It returns only whether a
 * key is present, never the key itself.
 */
export async function GET() {
  const connectors = [
    {
      id: "norges-bank",
      name: "Norges Bank",
      role: "Official NOK exchange rates and the key policy rate",
      keyless: true,
      configured: true,
      docsUrl: "https://data.norges-bank.no/",
    },
    {
      id: "ecb",
      name: "ECB Data Portal",
      role: "Euro reference rates, used when Norges Bank is unavailable",
      keyless: true,
      configured: true,
      docsUrl: "https://data.ecb.europa.eu/help/api/data",
    },
    {
      id: "sec-edgar",
      name: "SEC EDGAR",
      role: "Reported fundamentals for companies that file with the SEC",
      keyless: true,
      configured: true,
      docsUrl: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
    },
    {
      id: "yahoo",
      name: "Yahoo Finance",
      role: "Delayed quotes and benchmark closes, used as the last fallback",
      keyless: true,
      configured: true,
      docsUrl: "https://finance.yahoo.com/",
    },
    {
      id: "twelve-data",
      name: "Twelve Data",
      role: "Preferred quotes and daily closes for US listings",
      keyless: false,
      envVar: "TWELVE_DATA_API_KEY",
      configured: Boolean(process.env.TWELVE_DATA_API_KEY),
      docsUrl: "https://twelvedata.com/pricing",
    },
    {
      id: "eodhd",
      name: "EODHD",
      role: "Daily closes for Oslo and other European listings",
      keyless: false,
      envVar: "EODHD_API_KEY",
      configured: Boolean(process.env.EODHD_API_KEY),
      docsUrl: "https://eodhd.com/pricing",
    },
    {
      id: "openfigi",
      name: "OpenFIGI",
      role: "Instrument identity when searching for a security",
      keyless: false,
      envVar: "OPENFIGI_API_KEY",
      configured: Boolean(process.env.OPENFIGI_API_KEY),
      docsUrl: "https://www.openfigi.com/api",
    },
  ];

  const policyRate = await fetchNorgesBankPolicyRate();

  return NextResponse.json({
    connectors,
    policyRate,
    checkedAt: new Date().toISOString(),
  });
}
