export type MarketHistoryCategory = "Banking" | "Valuation" | "Inflation" | "Currency" | "External shock";

export type MarketHistoryEvent = {
  id: string;
  year: number;
  endYear?: number;
  title: string;
  category: MarketHistoryCategory;
  geography: string;
  severity: 1 | 2 | 3 | 4 | 5;
  summary: string;
  trigger: string;
  buildup: string[];
  transmission: string[];
  policyResponse: string;
  recovery: string;
  commonDenominators: string[];
  lesson: string;
  source: string;
  sourceUrl: string;
};

export const marketHistoryEvents: MarketHistoryEvent[] = [
  {
    id: "panic-1857", year: 1857, endYear: 1858, title: "Panic of 1857", category: "Banking", geography: "United States · global spillovers", severity: 4,
    summary: "Railroad and land speculation met fragile bank funding, forced liquidation, and a rapid loss of confidence.",
    trigger: "The failure of Ohio Life Insurance and Trust exposed losses and accelerated withdrawals and loan calls.",
    buildup: ["Railroad mileage and financing expanded rapidly", "Western land and railroad securities became speculative", "Banks held assets vulnerable to falling collateral values"],
    transmission: ["Depositors demanded cash", "Banks called loans", "Securities dealers sold into falling markets", "Credit contraction spread internationally"],
    policyResponse: "With no central bank, clearing houses and commercial banks provided the main liquidity response; the Treasury had limited room to intervene.",
    recovery: "The acute contraction lasted about eighteen months, although political disruption complicated the subsequent recovery.",
    commonDenominators: ["Leverage", "Maturity mismatch", "Confidence shock", "Forced selling"],
    lesson: "Fast asset growth financed by fragile short-term claims can turn a valuation decline into a payments crisis.",
    source: "FDIC history", sourceUrl: "https://www.fdic.gov/history/1850-1899",
  },
  {
    id: "panic-1873", year: 1873, endYear: 1879, title: "Panic of 1873", category: "Banking", geography: "United States · Europe", severity: 4,
    summary: "Railway overbuilding and bond losses broke the financing chain between European capital, US banks, and industrial expansion.",
    trigger: "Jay Cooke & Co. failed after railroad financing became impossible to roll over.",
    buildup: ["Railroad capacity expanded ahead of demand", "Returns fell while new projects kept borrowing", "European investors reduced US railroad exposure"],
    transmission: ["Bond prices fell", "Railroads defaulted", "Bank losses rose", "Credit and industrial activity contracted"],
    policyResponse: "Private clearing-house support and temporary market closures substituted for a formal lender of last resort.",
    recovery: "The panic began a prolonged period of weak activity historically associated with the Long Depression.",
    commonDenominators: ["Overcapacity", "Debt rollover", "Cross-border capital reversal", "Intermediary failure"],
    lesson: "A productive technology can still produce poor investment outcomes when capacity and financing run too far ahead of demand.",
    source: "Federal Reserve History", sourceUrl: "https://www.federalreservehistory.org/essays/banking-panics-of-the-gilded-age",
  },
  {
    id: "panic-1907", year: 1907, endYear: 1908, title: "Panic of 1907", category: "Banking", geography: "United States · global", severity: 4,
    summary: "Runs on lightly regulated trust companies converted a speculative failure into a systemic liquidity crisis.",
    trigger: "A failed attempt to corner United Copper undermined institutions connected to the speculators.",
    buildup: ["Trust companies grew outside clearing-house protections", "Deposits funded less liquid assets", "No central bank could coordinate system-wide liquidity"],
    transmission: ["Trust-company withdrawals surged", "Credit availability collapsed", "Industrial output and real activity fell sharply"],
    policyResponse: "J. P. Morgan and clearing-house banks coordinated private liquidity and rescues; the episode helped motivate creation of the Federal Reserve.",
    recovery: "The real economy recovered in a little over a year, faster than after the Great Depression or 2008.",
    commonDenominators: ["Shadow banking", "Liquidity mismatch", "Institutional gaps", "Contagion"],
    lesson: "Risk often accumulates just outside the institutions protected by the existing safety framework.",
    source: "Federal Reserve History", sourceUrl: "https://www.federalreservehistory.org/essays/panic-of-1907",
  },
  {
    id: "great-depression", year: 1929, endYear: 1933, title: "Great Depression", category: "Banking", geography: "Global", severity: 5,
    summary: "An equity crash, banking panics, policy errors, debt deflation, and the gold standard reinforced one another.",
    trigger: "The 1929 market break damaged confidence, but banking failures and monetary contraction turned weakness into depression.",
    buildup: ["Equity speculation and margin debt rose", "Monetary policy tightened", "Banking systems lacked robust deposit protection", "The gold standard constrained policy"],
    transmission: ["Asset prices fell", "Banks failed and money contracted", "Demand and prices declined", "Real debt burdens rose", "Global trade collapsed"],
    policyResponse: "Bank holidays, deposit insurance, abandonment of gold constraints, fiscal programs, and institutional reform arrived after severe damage.",
    recovery: "Activity improved after 1933 but did not return to normal quickly; the 1937–38 contraction interrupted recovery.",
    commonDenominators: ["Leverage", "Policy constraint", "Bank runs", "Debt deflation", "Delayed response"],
    lesson: "A crash is not automatically a depression; the decisive question is whether finance, money, and policy amplify it.",
    source: "Federal Reserve History", sourceUrl: "https://www.federalreservehistory.org/essays/great-depression",
  },
  {
    id: "oil-1973", year: 1973, endYear: 1975, title: "Oil shock and stagflation", category: "Inflation", geography: "Advanced economies", severity: 4,
    summary: "An energy supply shock hit an economy already carrying inflation pressure, weak productivity, and monetary instability.",
    trigger: "The oil embargo and OPEC pricing power sharply increased energy costs.",
    buildup: ["Bretton Woods had broken down", "Inflation pressure was already broad", "Demand and commodity prices were strong", "Productivity growth was weakening"],
    transmission: ["Energy costs rose", "Real household income fell", "Margins compressed", "Inflation and unemployment increased together"],
    policyResponse: "Monetary and fiscal responses struggled with the trade-off between inflation and growth; later tightening restored credibility at high economic cost.",
    recovery: "Markets and activity recovered unevenly while inflation remained a defining problem into the early 1980s.",
    commonDenominators: ["Supply constraint", "Policy credibility", "Second-order inflation", "Margin pressure"],
    lesson: "Not every recession begins with leverage: a scarce input can expose economies and businesses built around cheap supply.",
    source: "Federal Reserve History", sourceUrl: "https://www.federalreservehistory.org/essays/oil-shock-of-1973-74",
  },
  {
    id: "black-monday", year: 1987, title: "Black Monday", category: "Valuation", geography: "Global equity markets", severity: 3,
    summary: "A globally synchronized selloff was accelerated by portfolio insurance, market structure, and a shortage of buyers.",
    trigger: "On 19 October, cascading sell orders drove the Dow down 22.6% in one session.",
    buildup: ["US equities had risen rapidly", "Portfolio insurance embedded mechanical selling", "Cash, futures, and options markets settled differently"],
    transmission: ["Losses triggered more hedging sales", "Liquidity disappeared", "Global markets transmitted fear within hours"],
    policyResponse: "The Federal Reserve supplied liquidity and encouraged bank lending; exchanges later introduced circuit breakers and clearing reforms.",
    recovery: "The crash did not become a banking crisis or recession, and US markets exceeded prior highs in less than two years.",
    commonDenominators: ["Crowding", "Mechanical selling", "Liquidity vacuum", "Market plumbing"],
    lesson: "Market structure can make a price decline violent even when the underlying economy remains intact.",
    source: "Federal Reserve History", sourceUrl: "https://www.federalreservehistory.org/essays/stock-market-crash-of-1987",
  },
  {
    id: "asia-1997", year: 1997, endYear: 1998, title: "Asian financial crisis", category: "Currency", geography: "East and Southeast Asia", severity: 4,
    summary: "Short-term foreign-currency debt, fixed exchange rates, credit booms, and capital flight produced a regional crisis.",
    trigger: "Thailand floated the baht after reserves and confidence were exhausted.",
    buildup: ["Capital inflows financed rapid domestic credit", "Companies borrowed short-term in foreign currency", "Exchange-rate stability hid currency risk", "Property and asset prices rose"],
    transmission: ["Currencies fell", "Foreign-currency debt burdens jumped", "Banks and companies failed", "Capital flight spread across the region"],
    policyResponse: "IMF programs, bank restructuring, exchange-rate flexibility, reserve accumulation, and stronger local capital markets followed.",
    recovery: "Many economies recovered strongly after painful adjustment and entered 2008 with lower external vulnerability.",
    commonDenominators: ["Currency mismatch", "Short-term foreign debt", "Capital-flow reversal", "Credit boom"],
    lesson: "Solvency can disappear quickly when liabilities are in a currency the borrower cannot create.",
    source: "International Monetary Fund", sourceUrl: "https://www.imf.org/en/Publications/WP/Issues/2016/12/30/The-Asia-Crisis-Causes-Policy-Responses-and-Outcomes-3295",
  },
  {
    id: "dot-com", year: 2000, endYear: 2002, title: "Dot-com unwind", category: "Valuation", geography: "United States · global technology", severity: 3,
    summary: "Capital chased internet growth before durable economics were established, then vanished when expectations reset.",
    trigger: "Profit warnings, tighter funding, and collapsing confidence broke the cycle of rising prices and easy issuance.",
    buildup: ["Narrative outran cash flow", "IPO funding rewarded scale over profitability", "Benchmark concentration and momentum increased", "Telecom capacity expanded rapidly"],
    transmission: ["Valuations compressed", "Equity funding closed", "Investment and employment fell", "Telecom defaults damaged creditors"],
    policyResponse: "Rates were cut as the economy entered the 2001 recession; viable infrastructure and business models survived the capital washout.",
    recovery: "The broad market recovered earlier than many speculative technology shares; sector leadership changed materially.",
    commonDenominators: ["Narrative excess", "Weak cash flow", "Overcapacity", "Funding dependence"],
    lesson: "A transformative technology and an overvalued security can both be true at the same time.",
    source: "Federal Reserve History", sourceUrl: "https://www.federalreservehistory.org/essays/great-moderation",
  },
  {
    id: "gfc", year: 2007, endYear: 2009, title: "Global financial crisis", category: "Banking", geography: "United States · Europe · global", severity: 5,
    summary: "Housing leverage, opaque securitization, wholesale funding, and interconnected balance sheets turned mortgage losses into systemic failure.",
    trigger: "Mortgage losses impaired structured products and funding markets; Lehman’s failure accelerated the global run.",
    buildup: ["Home prices and mortgage credit rose together", "Underwriting weakened", "Leverage migrated through securitization", "Banks relied on short-term market funding"],
    transmission: ["Collateral values fell", "Funding markets froze", "Forced deleveraging spread", "Credit and real activity contracted globally"],
    policyResponse: "Rate cuts, emergency liquidity, guarantees, recapitalization, fiscal support, and large-scale asset purchases stabilized the system.",
    recovery: "The US recession ended in June 2009, but employment, credit, and European sovereign conditions recovered slowly.",
    commonDenominators: ["Leverage", "Opaque risk transfer", "Wholesale funding", "Collateral spiral", "Interconnectedness"],
    lesson: "Diversifying the ownership of a risk does not remove it when everyone depends on the same collateral and funding markets.",
    source: "Federal Reserve History", sourceUrl: "https://www.federalreservehistory.org/essays/great-recession-of-200709",
  },
  {
    id: "euro-crisis", year: 2010, endYear: 2012, title: "Euro-area sovereign debt crisis", category: "Currency", geography: "Euro area", severity: 4,
    summary: "Bank losses, sovereign debt, and a monetary union without a complete fiscal and banking union reinforced one another.",
    trigger: "Investors questioned sovereign debt sustainability and the ability of banks and governments to support each other.",
    buildup: ["Post-2008 bank balance sheets remained weak", "Capital flowed across the euro area without equal risk pricing", "Countries lacked independent currencies and central banks"],
    transmission: ["Sovereign spreads widened", "Banks lost funding", "Credit fragmented by country", "Austerity weakened demand"],
    policyResponse: "Rescue programs, fiscal adjustment, bank support, and the ECB’s lender-of-last-resort commitment reduced redenomination risk.",
    recovery: "Financial stress eased after 2012, while growth, debt, and banking repair remained uneven for years.",
    commonDenominators: ["Sovereign-bank loop", "Institutional incompleteness", "Funding fragmentation", "Policy credibility"],
    lesson: "Shared currency exposure does not eliminate country risk when fiscal capacity and banking losses remain national.",
    source: "International Monetary Fund", sourceUrl: "https://www.imf.org/external/pubs/ft/fandd/2014/03/pdf/fd0314i.pdf",
  },
  {
    id: "covid", year: 2020, title: "COVID-19 shutdown", category: "External shock", geography: "Global", severity: 5,
    summary: "A health emergency stopped activity directly, creating a simultaneous cash-flow, employment, funding, and supply-chain shock.",
    trigger: "Pandemic restrictions and voluntary distancing abruptly reduced mobility and commerce.",
    buildup: ["Just-in-time supply chains had limited slack", "Some sectors carried high fixed costs", "Markets initially underestimated nonfinancial contagion"],
    transmission: ["Revenue stopped in exposed sectors", "Dash for cash hit markets", "Supply chains broke", "Policy support altered household and corporate balance sheets"],
    policyResponse: "Central banks supplied extraordinary liquidity while governments used transfers, guarantees, and fiscal support to bridge lost income.",
    recovery: "The NBER-dated US contraction lasted two months, but reopening, inflation, sector outcomes, and labor supply normalized at different speeds.",
    commonDenominators: ["Exogenous trigger", "Liquidity demand", "Operational fragility", "Massive policy bridge"],
    lesson: "A market crisis can originate outside finance; resilience includes operational continuity and access to liquidity, not only low leverage.",
    source: "NBER business-cycle chronology", sourceUrl: "https://www.nber.org/research/business-cycle-dating",
  },
  {
    id: "inflation-reset", year: 2022, endYear: 2023, title: "Inflation and rate reset", category: "Inflation", geography: "Global", severity: 3,
    summary: "Persistent inflation forced the fastest tightening in decades, repricing bonds, growth equities, currencies, and refinancing risk.",
    trigger: "Central banks shifted from transitory-inflation patience to forceful rate increases.",
    buildup: ["Pandemic support sustained demand", "Supply constraints persisted", "Energy prices rose after Russia’s invasion of Ukraine", "Long-duration assets were priced for low rates"],
    transmission: ["Bond prices fell", "Equity duration repriced", "Dollar strength tightened global conditions", "Refinancing became more expensive"],
    policyResponse: "Central banks tightened and reduced balance-sheet support while fiscal authorities managed energy and cost-of-living pressures.",
    recovery: "Inflation moderated unevenly; the episode left a higher-rate baseline and exposed duration risk in banks and portfolios.",
    commonDenominators: ["Duration mismatch", "Inflation surprise", "Policy repricing", "Crowded low-rate assumptions"],
    lesson: "Assets that look diversified by name can share one hidden exposure: dependence on a low discount rate.",
    source: "BIS policy-rate statistics", sourceUrl: "https://www.bis.org/statistics/cbpol.htm",
  },
];

export const historyCategories: Array<"All" | MarketHistoryCategory> = ["All", "Banking", "Valuation", "Inflation", "Currency", "External shock"];

export function recurringHistoryPatterns(events: MarketHistoryEvent[]) {
  const counts = new Map<string, number>();
  for (const event of events) for (const pattern of event.commonDenominators) counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);
}
