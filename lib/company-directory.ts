export type CompanyIdentity = {
  name: string;
  ticker: string;
  country: "United States" | "United Kingdom";
  logo: string;
  investorUrl: string;
  aliases?: string[];
};

export const companyDirectory: CompanyIdentity[] = [
  { name: "Microsoft", ticker: "MSFT", country: "United States", logo: "/company-logos/microsoft.svg", investorUrl: "https://www.microsoft.com/en-us/investor" },
  { name: "Apple", ticker: "AAPL", country: "United States", logo: "/company-logos/apple.svg", investorUrl: "https://investor.apple.com/investor-relations/" },
  { name: "Nvidia", ticker: "NVDA", country: "United States", logo: "/company-logos/nvidia.svg", investorUrl: "https://investor.nvidia.com/", aliases: ["NVIDIA"] },
  { name: "Alphabet", ticker: "GOOGL", country: "United States", logo: "/company-logos/google.svg", investorUrl: "https://abc.xyz/investor/", aliases: ["Google"] },
  { name: "AstraZeneca", ticker: "AZN", country: "United Kingdom", logo: "/company-logos/astrazeneca.png", investorUrl: "https://www.astrazeneca.com/investor-relations.html" },
  { name: "Shell", ticker: "SHEL", country: "United Kingdom", logo: "/company-logos/shell.svg", investorUrl: "https://www.shell.com/investors" },
  { name: "HSBC", ticker: "HSBA", country: "United Kingdom", logo: "/company-logos/hsbc.svg", investorUrl: "https://www.hsbc.com/investors", aliases: ["HSBC Holdings"] },
  { name: "Unilever", ticker: "ULVR", country: "United Kingdom", logo: "/company-logos/unilever.svg", investorUrl: "https://www.unilever.com/investors/" },
];

const logoDomainByTicker: Record<string, string> = {
  "005930": "samsung.com", "012450": "hanwhaaerospace.com", "2330": "tsmc.com", "2454": "mediatek.com",
  "4502": "takeda.com", "7011": "mhi.com", AAPL: "apple.com", AIR: "airbus.com", AMD: "amd.com",
  AMZN: "amazon.com", ASML: "asml.com", "ATCO-A": "atlascopcogroup.com", AVGO: "broadcom.com",
  AZN: "astrazeneca.com", BA: "baesystems.com", "BRK-B": "berkshirehathaway.com", CAT: "caterpillar.com",
  CNQ: "cnrl.com", COST: "costco.com", CVX: "chevron.com", D05: "dbs.com", DNB: "dnb.no", DSV: "dsv.com",
  EQNR: "equinor.com", "ERIC-B": "ericsson.com", EUNL: "ishares.com", EXSA: "ishares.com", GOOGL: "abc.xyz",
  HDFCBANK: "hdfcbank.com", HSBA: "hsbc.com", INFY: "infosys.com", "INVE-B": "investorab.com",
  ITA: "ishares.com", IWM: "ishares.com", JNJ: "jnj.com", JPM: "jpmorganchase.com", KO: "coca-colacompany.com",
  KOG: "kongsberg.com", LLY: "lilly.com", LMT: "lockheedmartin.com", LQD: "ishares.com", "MAERSK-B": "maersk.com",
  MC: "lvmh.com", META: "meta.com", MEUD: "amundietf.com", MOWI: "mowi.com", MSFT: "microsoft.com",
  NHY: "hydro.com", NOC: "northropgrumman.com", "NOVO-B": "novonordisk.com", NVDA: "nvidia.com",
  ORCL: "oracle.com", PBR: "petrobras.com.br", PLTR: "palantir.com", QQQ: "invesco.com", RELIANCE: "ril.com",
  RHM: "rheinmetall.com", ROG: "roche.com", RTX: "rtx.com", RY: "rbc.com", "SAAB-B": "saab.com",
  SAF: "safran-group.com", SAP: "sap.com", SHEL: "shell.com", SIE: "siemens.com", SUNPHARMA: "sunpharma.com",
  SXR8: "ishares.com", TSLA: "tesla.com", UNH: "unitedhealthgroup.com", V: "visa.com", VGK: "vanguard.com",
  "VOLV-B": "volvogroup.com", VOO: "vanguard.com", VWS: "vestas.com", WMT: "walmart.com",
  "XACT-OMXS30": "xact.se", XLE: "ssga.com", XLF: "ssga.com", XLK: "ssga.com", XLV: "ssga.com",
  XOM: "exxonmobil.com",
};

function normalizeCompany(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function companyIdentityForName(name: string) {
  const normalized = normalizeCompany(name);
  return companyDirectory.find((company) =>
    [company.name, ...(company.aliases ?? [])].some((candidate) => normalizeCompany(candidate) === normalized),
  ) ?? null;
}

export function companyIdentityForTicker(ticker: string) {
  const normalized = ticker.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return companyDirectory.find((company) => company.ticker.replace(/[^A-Z0-9]/g, "") === normalized) ?? null;
}

export function companyLogoForTicker(ticker: string) {
  const normalized = ticker.toUpperCase();
  const identity = companyIdentityForTicker(normalized);
  if (identity) return identity.logo;
  const domain = logoDomainByTicker[normalized];
  return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : null;
}
