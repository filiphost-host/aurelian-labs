export type ResearchPeer = {
  ticker: string;
  name: string;
  fcfPerShare: number | null;
  revenueB: number | null;
  evSales: number | null;
  pe: number | null;
  marketCapB: number | null;
  debtToEquity: number | null;
  oneDayReturn: number;
};

export type EarningsPoint = {
  quarter: string;
  actual: number | null;
  estimate: number;
  revenueB: number;
};

export type CompanyResearchProfile = {
  ticker: string;
  name: string;
  sector: string;
  peers: ResearchPeer[];
  fcfHistory: Array<{ period: string; company: number; peerAverage: number }>;
  premiumHistory: Array<{ period: string; premium: number; average: number }>;
  earnings: EarningsPoint[];
  nextEarnings: string;
  thesis: string;
};

const profiles: CompanyResearchProfile[] = [
  {
    ticker: "MSFT",
    name: "Microsoft",
    sector: "Enterprise software and cloud",
    nextEarnings: "Late October · estimated",
    thesis: "Recurring software cash flow supports resilience; cloud and AI capital intensity determine whether growth earns an adequate return.",
    peers: [
      { ticker: "MSFT", name: "Microsoft", fcfPerShare: 12.4, revenueB: 281.7, evSales: 12.1, pe: 37.4, marketCapB: 3470, debtToEquity: 31, oneDayReturn: 0.7 },
      { ticker: "GOOGL", name: "Alphabet", fcfPerShare: 9.1, revenueB: 371.4, evSales: 7.2, pe: 27.8, marketCapB: 2780, debtToEquity: 11, oneDayReturn: 0.3 },
      { ticker: "ORCL", name: "Oracle", fcfPerShare: 3.8, revenueB: 61.0, evSales: 9.4, pe: 35.2, marketCapB: 680, debtToEquity: 720, oneDayReturn: -0.6 },
      { ticker: "AMZN", name: "Amazon", fcfPerShare: 7.3, revenueB: 716.9, evSales: 3.5, pe: 34.6, marketCapB: 2440, debtToEquity: 44, oneDayReturn: 1.1 },
      { ticker: "SAP", name: "SAP", fcfPerShare: 7.7, revenueB: 42.6, evSales: 9.1, pe: 41.3, marketCapB: 390, debtToEquity: 26, oneDayReturn: -0.2 },
    ],
    fcfHistory: [
      { period: "Q3 24", company: 9.8, peerAverage: 5.8 }, { period: "Q4 24", company: 10.3, peerAverage: 6.1 },
      { period: "Q1 25", company: 10.8, peerAverage: 6.3 }, { period: "Q2 25", company: 11.4, peerAverage: 6.6 },
      { period: "Q3 25", company: 11.7, peerAverage: 6.9 }, { period: "Q4 25", company: 12.0, peerAverage: 7.1 },
      { period: "Q1 26", company: 12.4, peerAverage: 7.4 },
    ],
    premiumHistory: [
      { period: "Q3 24", premium: 25, average: 24 }, { period: "Q4 24", premium: 29, average: 24 },
      { period: "Q1 25", premium: 34, average: 25 }, { period: "Q2 25", premium: 38, average: 25 },
      { period: "Q3 25", premium: 32, average: 25 }, { period: "Q4 25", premium: 36, average: 26 },
      { period: "Q1 26", premium: 35, average: 26 },
    ],
    earnings: [
      { quarter: "Q2 25", actual: 3.65, estimate: 3.37, revenueB: 76.4 },
      { quarter: "Q3 25", actual: 3.72, estimate: 3.65, revenueB: 77.7 },
      { quarter: "Q4 25", actual: 3.86, estimate: 3.91, revenueB: 81.3 },
      { quarter: "Q1 26", actual: 4.11, estimate: 3.98, revenueB: 84.1 },
      { quarter: "Q2 26", actual: null, estimate: 4.18, revenueB: 86.8 },
    ],
  },
  {
    ticker: "GOOGL",
    name: "Alphabet",
    sector: "Digital advertising and cloud",
    nextEarnings: "Late October · estimated",
    thesis: "Search economics and cloud margins fund AI investment; the central question is whether AI protects or changes the search profit pool.",
    peers: [
      { ticker: "GOOGL", name: "Alphabet", fcfPerShare: 9.1, revenueB: 371.4, evSales: 7.2, pe: 27.8, marketCapB: 2780, debtToEquity: 11, oneDayReturn: 0.3 },
      { ticker: "META", name: "Meta Platforms", fcfPerShare: 17.8, revenueB: 189.5, evSales: 8.4, pe: 28.9, marketCapB: 1880, debtToEquity: 27, oneDayReturn: 0.9 },
      { ticker: "MSFT", name: "Microsoft", fcfPerShare: 12.4, revenueB: 281.7, evSales: 12.1, pe: 37.4, marketCapB: 3470, debtToEquity: 31, oneDayReturn: 0.7 },
      { ticker: "AMZN", name: "Amazon", fcfPerShare: 7.3, revenueB: 716.9, evSales: 3.5, pe: 34.6, marketCapB: 2440, debtToEquity: 44, oneDayReturn: 1.1 },
      { ticker: "SNAP", name: "Snap", fcfPerShare: 0.1, revenueB: 5.6, evSales: 2.7, pe: null, marketCapB: 14, debtToEquity: 152, oneDayReturn: -1.4 },
    ],
    fcfHistory: [
      { period: "Q3 24", company: 6.5, peerAverage: 5.1 }, { period: "Q4 24", company: 7.0, peerAverage: 5.4 },
      { period: "Q1 25", company: 7.5, peerAverage: 5.6 }, { period: "Q2 25", company: 8.0, peerAverage: 5.9 },
      { period: "Q3 25", company: 8.4, peerAverage: 6.2 }, { period: "Q4 25", company: 8.7, peerAverage: 6.4 },
      { period: "Q1 26", company: 9.1, peerAverage: 6.7 },
    ],
    premiumHistory: [
      { period: "Q3 24", premium: 14, average: 18 }, { period: "Q4 24", premium: 18, average: 18 },
      { period: "Q1 25", premium: 21, average: 19 }, { period: "Q2 25", premium: 24, average: 19 },
      { period: "Q3 25", premium: 19, average: 19 }, { period: "Q4 25", premium: 22, average: 20 },
      { period: "Q1 26", premium: 20, average: 20 },
    ],
    earnings: [
      { quarter: "Q2 25", actual: 2.31, estimate: 2.18, revenueB: 96.4 },
      { quarter: "Q3 25", actual: 2.48, estimate: 2.32, revenueB: 102.3 },
      { quarter: "Q4 25", actual: 2.62, estimate: 2.66, revenueB: 106.8 },
      { quarter: "Q1 26", actual: 2.76, estimate: 2.65, revenueB: 110.7 },
      { quarter: "Q2 26", actual: null, estimate: 2.88, revenueB: 114.9 },
    ],
  },
  {
    ticker: "NVDA",
    name: "Nvidia",
    sector: "Accelerated computing",
    nextEarnings: "Late August · estimated",
    thesis: "Demand, supply, and ecosystem leadership remain exceptional; expectations, customer concentration, and the durability of hyperscaler capex drive risk.",
    peers: [
      { ticker: "NVDA", name: "Nvidia", fcfPerShare: 4.6, revenueB: 192.5, evSales: 24.8, pe: 42.1, marketCapB: 4080, debtToEquity: 12, oneDayReturn: 1.4 },
      { ticker: "AVGO", name: "Broadcom", fcfPerShare: 4.1, revenueB: 68.3, evSales: 18.6, pe: 40.2, marketCapB: 1580, debtToEquity: 168, oneDayReturn: 0.8 },
      { ticker: "AMD", name: "Advanced Micro Devices", fcfPerShare: 2.2, revenueB: 35.1, evSales: 9.5, pe: 51.7, marketCapB: 340, debtToEquity: 7, oneDayReturn: -0.4 },
      { ticker: "INTC", name: "Intel", fcfPerShare: -2.1, revenueB: 55.8, evSales: 3.1, pe: null, marketCapB: 180, debtToEquity: 38, oneDayReturn: -0.9 },
      { ticker: "TSM", name: "TSMC", fcfPerShare: 8.7, revenueB: 118.2, evSales: 10.8, pe: 27.6, marketCapB: 1290, debtToEquity: 24, oneDayReturn: 0.5 },
    ],
    fcfHistory: [
      { period: "Q3 24", company: 1.8, peerAverage: 2.7 }, { period: "Q4 24", company: 2.2, peerAverage: 2.8 },
      { period: "Q1 25", company: 2.7, peerAverage: 3.0 }, { period: "Q2 25", company: 3.2, peerAverage: 3.1 },
      { period: "Q3 25", company: 3.7, peerAverage: 3.2 }, { period: "Q4 25", company: 4.1, peerAverage: 3.4 },
      { period: "Q1 26", company: 4.6, peerAverage: 3.5 },
    ],
    premiumHistory: [
      { period: "Q3 24", premium: 44, average: 32 }, { period: "Q4 24", premium: 52, average: 33 },
      { period: "Q1 25", premium: 61, average: 34 }, { period: "Q2 25", premium: 73, average: 35 },
      { period: "Q3 25", premium: 65, average: 35 }, { period: "Q4 25", premium: 68, average: 36 },
      { period: "Q1 26", premium: 62, average: 36 },
    ],
    earnings: [
      { quarter: "Q2 25", actual: 0.99, estimate: 0.93, revenueB: 46.7 },
      { quarter: "Q3 25", actual: 1.13, estimate: 1.09, revenueB: 52.0 },
      { quarter: "Q4 25", actual: 1.27, estimate: 1.31, revenueB: 57.4 },
      { quarter: "Q1 26", actual: 1.44, estimate: 1.39, revenueB: 62.8 },
      { quarter: "Q2 26", actual: null, estimate: 1.58, revenueB: 68.1 },
    ],
  },
];

const etfProfile: CompanyResearchProfile = {
  ticker: "SXR8",
  name: "iShares Core S&P 500 UCITS ETF",
  sector: "US large-cap equity index",
  nextEarnings: "Index constituents report throughout the quarter",
  thesis: "Broad US earnings exposure with meaningful mega-cap concentration; index-level valuation and breadth matter more than one issuer's balance sheet.",
  peers: [
    { ticker: "SXR8", name: "iShares Core S&P 500 UCITS", fcfPerShare: null, revenueB: null, evSales: null, pe: 24.8, marketCapB: null, debtToEquity: null, oneDayReturn: 0.4 },
    { ticker: "SPY", name: "SPDR S&P 500 ETF", fcfPerShare: null, revenueB: null, evSales: null, pe: 24.8, marketCapB: null, debtToEquity: null, oneDayReturn: 0.4 },
    { ticker: "IVV", name: "iShares Core S&P 500 ETF", fcfPerShare: null, revenueB: null, evSales: null, pe: 24.8, marketCapB: null, debtToEquity: null, oneDayReturn: 0.4 },
    { ticker: "RSP", name: "Invesco S&P 500 Equal Weight", fcfPerShare: null, revenueB: null, evSales: null, pe: 19.7, marketCapB: null, debtToEquity: null, oneDayReturn: 0.2 },
  ],
  fcfHistory: [
    { period: "Q3 24", company: 100, peerAverage: 100 }, { period: "Q4 24", company: 108, peerAverage: 106 },
    { period: "Q1 25", company: 113, peerAverage: 111 }, { period: "Q2 25", company: 119, peerAverage: 116 },
    { period: "Q3 25", company: 125, peerAverage: 122 }, { period: "Q4 25", company: 131, peerAverage: 128 },
    { period: "Q1 26", company: 137, peerAverage: 134 },
  ],
  premiumHistory: [
    { period: "Q3 24", premium: 18, average: 15 }, { period: "Q4 24", premium: 20, average: 15 },
    { period: "Q1 25", premium: 22, average: 16 }, { period: "Q2 25", premium: 24, average: 16 },
    { period: "Q3 25", premium: 25, average: 17 }, { period: "Q4 25", premium: 23, average: 17 },
    { period: "Q1 26", premium: 24, average: 17 },
  ],
  earnings: [
    { quarter: "Q2 25", actual: 62.1, estimate: 60.7, revenueB: 0 },
    { quarter: "Q3 25", actual: 64.8, estimate: 63.4, revenueB: 0 },
    { quarter: "Q4 25", actual: 66.2, estimate: 66.8, revenueB: 0 },
    { quarter: "Q1 26", actual: 69.1, estimate: 68.0, revenueB: 0 },
    { quarter: "Q2 26", actual: null, estimate: 71.3, revenueB: 0 },
  ],
};

const defenseProfile: CompanyResearchProfile = {
  ticker: "ITA",
  name: "iShares U.S. Aerospace & Defense ETF",
  sector: "Aerospace and defense",
  nextEarnings: "Constituent calendar · multiple dates",
  thesis: "Long-cycle backlogs and defense budgets support demand, while execution, fixed-price contracts, and supplier constraints shape cash conversion.",
  peers: [
    { ticker: "ITA", name: "iShares U.S. Aerospace & Defense ETF", fcfPerShare: null, revenueB: null, evSales: null, pe: 31.2, marketCapB: null, debtToEquity: null, oneDayReturn: 0.5 },
    { ticker: "RTX", name: "RTX", fcfPerShare: 5.8, revenueB: 88.1, evSales: 3.0, pe: 28.4, marketCapB: 245, debtToEquity: 72, oneDayReturn: 0.6 },
    { ticker: "LMT", name: "Lockheed Martin", fcfPerShare: 28.4, revenueB: 76.3, evSales: 1.8, pe: 17.1, marketCapB: 118, debtToEquity: 310, oneDayReturn: 0.2 },
    { ticker: "NOC", name: "Northrop Grumman", fcfPerShare: 16.9, revenueB: 43.8, evSales: 2.0, pe: 21.7, marketCapB: 82, debtToEquity: 134, oneDayReturn: -0.1 },
    { ticker: "GD", name: "General Dynamics", fcfPerShare: 15.2, revenueB: 52.4, evSales: 2.1, pe: 22.3, marketCapB: 94, debtToEquity: 55, oneDayReturn: 0.4 },
  ],
  fcfHistory: [
    { period: "Q3 24", company: 100, peerAverage: 100 }, { period: "Q4 24", company: 104, peerAverage: 103 },
    { period: "Q1 25", company: 108, peerAverage: 106 }, { period: "Q2 25", company: 112, peerAverage: 109 },
    { period: "Q3 25", company: 116, peerAverage: 112 }, { period: "Q4 25", company: 121, peerAverage: 115 },
    { period: "Q1 26", company: 126, peerAverage: 119 },
  ],
  premiumHistory: [
    { period: "Q3 24", premium: 18, average: 15 }, { period: "Q4 24", premium: 21, average: 16 },
    { period: "Q1 25", premium: 24, average: 17 }, { period: "Q2 25", premium: 26, average: 18 },
    { period: "Q3 25", premium: 29, average: 18 }, { period: "Q4 25", premium: 27, average: 19 },
    { period: "Q1 26", premium: 25, average: 19 },
  ],
  earnings: [
    { quarter: "Q2 25", actual: 12.6, estimate: 12.2, revenueB: 0 },
    { quarter: "Q3 25", actual: 13.1, estimate: 12.8, revenueB: 0 },
    { quarter: "Q4 25", actual: 13.4, estimate: 13.6, revenueB: 0 },
    { quarter: "Q1 26", actual: 14.0, estimate: 13.7, revenueB: 0 },
    { quarter: "Q2 26", actual: null, estimate: 14.3, revenueB: 0 },
  ],
};

export function getCompanyResearch(ticker: string | null | undefined) {
  const normalized = ticker?.toUpperCase() ?? "MSFT";
  if (normalized === "SXR8") return etfProfile;
  if (normalized === "ITA") return defenseProfile;
  return profiles.find((profile) => profile.ticker === normalized) ?? profiles[0];
}

export const researchTickers = [...profiles.map((profile) => profile.ticker), "SXR8", "ITA"];
