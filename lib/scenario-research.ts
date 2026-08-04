export type ScenarioCategory = "Macro" | "Rates & credit" | "Technology" | "Currency";

export type ScenarioCompany = {
  ticker: string;
  name: string;
  sensitivity: "High" | "Medium" | "Low";
  balanceSheet: string;
  channel: string;
};

export type ScenarioGuide = {
  category: ScenarioCategory;
  question: string;
  meaning: string;
  review: string;
  trigger: string;
  transmission: string[];
  pressure: string[];
  support: string[];
  watch: string[];
  directTickers: string[];
  companies: ScenarioCompany[];
};

export const scenarioCategories: ScenarioCategory[] = ["Macro", "Rates & credit", "Technology", "Currency"];

export const scenarioGuides: Record<string, ScenarioGuide> = {
  "risk-off": {
    category: "Macro",
    question: "What if investors suddenly reduce risk across global markets?",
    meaning: "Equities fall together, credit becomes less forgiving, and the US dollar strengthens against NOK.",
    review: "Test whether diversification still works when correlations rise and several risks arrive together.",
    trigger: "Confidence shock",
    transmission: ["Equity multiples contract", "Credit spreads widen", "USD becomes a refuge"],
    pressure: ["Cyclical earnings", "Leveraged balance sheets", "High valuation shares"],
    support: ["Cash-rich quality", "Defensive revenue", "USD exposure for a NOK investor"],
    watch: ["VIX and credit spreads", "S&P 500 market breadth", "USD/NOK", "Earnings revisions"],
    directTickers: ["MSFT", "NVDA", "GOOGL", "SXR8", "ITA"],
    companies: [
      { ticker: "NVDA", name: "Nvidia", sensitivity: "High", balanceSheet: "Low leverage; high valuation sensitivity", channel: "Multiple compression and AI concentration" },
      { ticker: "BA", name: "Boeing", sensitivity: "High", balanceSheet: "Debt and execution pressure", channel: "Funding conditions plus cyclical demand" },
      { ticker: "MSFT", name: "Microsoft", sensitivity: "Medium", balanceSheet: "Strong liquidity", channel: "Valuation pressure partly offset by recurring revenue" },
      { ticker: "WMT", name: "Walmart", sensitivity: "Low", balanceSheet: "Defensive cash generation", channel: "Essential spending can soften the earnings shock" },
    ],
  },
  recession: {
    category: "Macro",
    question: "What if the US enters a recession and S&P 500 earnings contract?",
    meaning: "Demand weakens, earnings estimates fall, lenders become cautious, and policy rates eventually decline.",
    review: "Separate the benefit of lower rates from the damage caused by weaker revenue and credit quality.",
    trigger: "Demand and employment weaken",
    transmission: ["Revenue estimates fall", "Operating leverage hurts margins", "Defaults and spreads rise"],
    pressure: ["Industrials and discretionary", "Banks with credit losses", "Highly indebted cyclicals"],
    support: ["Healthcare and staples", "Recurring software revenue", "Long-duration government bonds"],
    watch: ["Payrolls and unemployment", "ISM new orders", "High-yield spreads", "Forward EPS revisions"],
    directTickers: ["SXR8", "ITA", "MSFT", "GOOGL"],
    companies: [
      { ticker: "F", name: "Ford", sensitivity: "High", balanceSheet: "Capital intensive with financing exposure", channel: "Auto demand and credit losses weaken together" },
      { ticker: "BA", name: "Boeing", sensitivity: "High", balanceSheet: "Elevated funding needs", channel: "Cyclical orders and refinancing pressure" },
      { ticker: "CAT", name: "Caterpillar", sensitivity: "Medium", balanceSheet: "Cyclical operating leverage", channel: "Lower construction and equipment demand" },
      { ticker: "PG", name: "Procter & Gamble", sensitivity: "Low", balanceSheet: "Stable consumer cash flows", channel: "Staples demand is usually less cyclical" },
    ],
  },
  stagflation: {
    category: "Macro",
    question: "What if growth slows but inflation prevents the Fed from cutting rates?",
    meaning: "Revenue growth weakens while wages, energy, and financing costs remain elevated: an awkward mix for both equities and bonds.",
    review: "Look for holdings that require both strong growth and falling discount rates to justify their value.",
    trigger: "Sticky inflation plus weak growth",
    transmission: ["Input costs remain high", "Rate relief is delayed", "Real earnings weaken"],
    pressure: ["Long-duration technology", "Low-margin consumers", "Long-duration bonds"],
    support: ["Pricing power", "Energy producers", "Short-duration cash instruments"],
    watch: ["Core services inflation", "Inflation expectations", "Real yields", "Gross-margin guidance"],
    directTickers: ["SXR8", "NVDA", "MSFT", "GOOGL"],
    companies: [
      { ticker: "AMZN", name: "Amazon", sensitivity: "High", balanceSheet: "Investment-heavy model", channel: "Consumer demand and discount-rate pressure" },
      { ticker: "TSLA", name: "Tesla", sensitivity: "High", balanceSheet: "Low debt; valuation-sensitive", channel: "Financing costs and discretionary demand" },
      { ticker: "WMT", name: "Walmart", sensitivity: "Medium", balanceSheet: "Defensive demand", channel: "Traffic can hold while margins face cost pressure" },
      { ticker: "XOM", name: "Exxon Mobil", sensitivity: "Low", balanceSheet: "Commodity-linked cash flow", channel: "Energy inflation may support realized prices" },
    ],
  },
  "oil-shock": {
    category: "Macro",
    question: "What if an oil supply disruption lifts energy prices and inflation?",
    meaning: "Transport and input costs rise, consumers lose purchasing power, and central banks have less room to ease.",
    review: "Identify second-order margin exposure, not only the obvious energy winners and airline losers.",
    trigger: "Oil supply falls",
    transmission: ["Energy prices jump", "Margins and consumption weaken", "Inflation expectations rise"],
    pressure: ["Airlines and transport", "Low-margin manufacturers", "Consumer discretionary"],
    support: ["Integrated energy", "Oilfield services", "Some defense demand"],
    watch: ["Brent crude", "Fuel crack spreads", "Breakeven inflation", "Freight and airline guidance"],
    directTickers: ["SXR8", "ITA"],
    companies: [
      { ticker: "DAL", name: "Delta Air Lines", sensitivity: "High", balanceSheet: "Debt plus fuel intensity", channel: "Fuel expense and consumer sensitivity" },
      { ticker: "FDX", name: "FedEx", sensitivity: "High", balanceSheet: "Capital intensive", channel: "Fuel costs meet weaker shipment demand" },
      { ticker: "CAT", name: "Caterpillar", sensitivity: "Medium", balanceSheet: "Cyclical industrial", channel: "Input costs offset energy-sector orders" },
      { ticker: "XOM", name: "Exxon Mobil", sensitivity: "Low", balanceSheet: "Commodity-linked cash flow", channel: "Higher realized energy prices" },
    ],
  },
  "rates-up": {
    category: "Rates & credit",
    question: "What if US rates rise by one percentage point?",
    meaning: "Discount rates rise immediately; highly indebted companies then face a slower refinancing squeeze as fixed-rate debt matures.",
    review: "Find the difference between valuation duration and balance-sheet debt. A debt-light growth company can still be rate-sensitive.",
    trigger: "Treasury yields +100 bps",
    transmission: ["Equity multiples compress", "New debt becomes costlier", "Interest expense resets over time"],
    pressure: ["REITs and utilities", "Telecom and capital-intensive firms", "Unprofitable growth"],
    support: ["Net-cash companies", "Insurers with reinvestment income", "Short-duration assets"],
    watch: ["10-year real yield", "Interest coverage", "Debt due within 3 years", "Net debt / EBITDA"],
    directTickers: ["SXR8", "NVDA", "MSFT", "GOOGL"],
    companies: [
      { ticker: "CCI", name: "Crown Castle", sensitivity: "High", balanceSheet: "Debt-funded infrastructure", channel: "Refinancing costs and bond-proxy valuation" },
      { ticker: "VZ", name: "Verizon", sensitivity: "High", balanceSheet: "Large debt load", channel: "Higher interest cost with limited revenue growth" },
      { ticker: "F", name: "Ford", sensitivity: "High", balanceSheet: "Capital and financing intensive", channel: "Borrowing costs affect both company and customer" },
      { ticker: "D", name: "Dominion Energy", sensitivity: "High", balanceSheet: "Regulated utility leverage", channel: "Funding cost and yield competition" },
      { ticker: "MSFT", name: "Microsoft", sensitivity: "Medium", balanceSheet: "Net-cash quality", channel: "Valuation duration, not refinancing stress" },
    ],
  },
  "rates-down": {
    category: "Rates & credit",
    question: "What if the Fed cuts rates by one percentage point without a recession?",
    meaning: "Lower discount and refinancing rates support duration-sensitive assets, while bank margins may narrow.",
    review: "This is a soft-landing test. A recessionary rate cut belongs in the separate recession scenario.",
    trigger: "Orderly Fed easing",
    transmission: ["Discount rates fall", "Refinancing pressure eases", "Yield-seeking returns"],
    pressure: ["Bank net-interest margins", "Cash yields", "Insurer reinvestment income"],
    support: ["REITs and utilities", "Homebuilders", "Long-duration technology"],
    watch: ["Fed funds futures", "Yield-curve slope", "Mortgage rates", "Bank deposit betas"],
    directTickers: ["SXR8", "NVDA", "MSFT", "GOOGL"],
    companies: [
      { ticker: "CCI", name: "Crown Castle", sensitivity: "High", balanceSheet: "Debt-funded infrastructure", channel: "Lower refinancing cost and yield competition" },
      { ticker: "D", name: "Dominion Energy", sensitivity: "High", balanceSheet: "Regulated utility leverage", channel: "Lower funding rates support allowed returns" },
      { ticker: "LEN", name: "Lennar", sensitivity: "High", balanceSheet: "Housing-cycle exposure", channel: "Mortgage affordability can revive demand" },
      { ticker: "JPM", name: "JPMorgan Chase", sensitivity: "Medium", balanceSheet: "Bank funding model", channel: "Deposit and loan pricing determine margin impact" },
    ],
  },
  "credit-wide": {
    category: "Rates & credit",
    question: "What if a refinancing wall widens corporate spreads by 150 bps?",
    meaning: "The risk-free rate is unchanged, but lenders demand more compensation from weaker and highly leveraged borrowers.",
    review: "Focus on maturity schedules, interest coverage, and access to capital rather than debt alone.",
    trigger: "Credit risk reprices",
    transmission: ["Spreads widen", "Refinancing gets selective", "Equity absorbs distress risk"],
    pressure: ["Near-term maturities", "Weak free cash flow", "Cyclical leveraged firms"],
    support: ["Net-cash balance sheets", "Investment-grade issuers", "Stable free cash flow"],
    watch: ["High-yield OAS", "Interest coverage", "Debt maturity walls", "Rating downgrades"],
    directTickers: ["SXR8", "ITA"],
    companies: [
      { ticker: "BA", name: "Boeing", sensitivity: "High", balanceSheet: "Elevated debt and cash needs", channel: "Execution risk raises the cost of capital" },
      { ticker: "VZ", name: "Verizon", sensitivity: "High", balanceSheet: "Large debt load", channel: "Spread widening makes refinancing more expensive" },
      { ticker: "F", name: "Ford", sensitivity: "High", balanceSheet: "Cyclical financing exposure", channel: "Funding and credit losses can reinforce each other" },
      { ticker: "GOOGL", name: "Alphabet", sensitivity: "Low", balanceSheet: "Net cash and strong free cash flow", channel: "Limited direct refinancing dependence" },
    ],
  },
  "ai-bubble": {
    category: "Technology",
    question: "What if the AI investment narrative breaks and valuation multiples reset?",
    meaning: "Semiconductors take the first hit, then cloud platforms and the S&P 500 feel the effect through concentration and lower expected capex returns.",
    review: "Reveal direct AI exposure plus the AI exposure already embedded in SXR8. This is a valuation shock, not a claim that AI disappears.",
    trigger: "AI returns disappoint",
    transmission: ["Chip multiples compress", "Hyperscaler capex is questioned", "Index concentration amplifies the fall"],
    pressure: ["AI accelerators", "Data-centre suppliers", "Mega-cap index weights"],
    support: ["Equal-weight sectors", "Cash-generative defensives", "Firms adopting AI without selling the infrastructure"],
    watch: ["Hyperscaler capex guidance", "GPU lead times", "AI revenue disclosure", "S&P 500 equal-weight relative return"],
    directTickers: ["NVDA", "MSFT", "GOOGL", "SXR8"],
    companies: [
      { ticker: "NVDA", name: "Nvidia", sensitivity: "High", balanceSheet: "Low leverage; concentrated expectations", channel: "Accelerator demand and valuation reset" },
      { ticker: "AVGO", name: "Broadcom", sensitivity: "High", balanceSheet: "Acquisition debt plus AI exposure", channel: "Custom silicon demand and multiple compression" },
      { ticker: "MSFT", name: "Microsoft", sensitivity: "High", balanceSheet: "Strong balance sheet; heavy AI capex", channel: "Cloud returns must justify investment" },
      { ticker: "GOOGL", name: "Alphabet", sensitivity: "High", balanceSheet: "Net cash; heavy AI capex", channel: "Search disruption risk plus infrastructure returns" },
    ],
  },
  "ai-capex": {
    category: "Technology",
    question: "What if hyperscalers slow AI data-centre spending?",
    meaning: "The first-order effect hits chips, networking, power, and cooling; the platforms may benefit from lower capital intensity if revenue holds.",
    review: "Distinguish an infrastructure spending pause from a full technology-market crash.",
    trigger: "Cloud capex guidance falls",
    transmission: ["Chip orders slow", "Data-centre supply chain weakens", "Free cash flow shifts back to platforms"],
    pressure: ["Semiconductors", "Networking and servers", "Power and cooling build-out"],
    support: ["Asset-light software", "Platforms with durable AI revenue", "Non-tech sectors"],
    watch: ["MSFT, GOOGL, AMZN and META capex", "Data-centre bookings", "Semiconductor inventories", "Free cash flow conversion"],
    directTickers: ["NVDA", "MSFT", "GOOGL", "SXR8"],
    companies: [
      { ticker: "NVDA", name: "Nvidia", sensitivity: "High", balanceSheet: "Low leverage; capex-cycle exposure", channel: "Accelerator orders are the direct spending channel" },
      { ticker: "AVGO", name: "Broadcom", sensitivity: "High", balanceSheet: "Acquisition leverage", channel: "Networking and custom accelerators" },
      { ticker: "VRT", name: "Vertiv", sensitivity: "High", balanceSheet: "Build-out dependent", channel: "Power and cooling demand follows data centres" },
      { ticker: "MSFT", name: "Microsoft", sensitivity: "Medium", balanceSheet: "Strong liquidity", channel: "Lower capex can help cash flow but question demand" },
    ],
  },
  "mega-cap-rotation": {
    category: "Technology",
    question: "What if the S&P 500 rises but mega-cap technology loses leadership?",
    meaning: "The equal-weight index and cyclicals advance while concentrated technology holdings lag.",
    review: "Test benchmark risk: a portfolio can underperform even when the headline index is positive.",
    trigger: "Market breadth broadens",
    transmission: ["Multiples converge", "Capital rotates to laggards", "Equal-weight beats cap-weight"],
    pressure: ["Crowded mega-cap positions", "Long-duration growth", "Momentum strategies"],
    support: ["Industrials", "Financials", "Smaller profitable companies"],
    watch: ["Equal-weight / cap-weight ratio", "Advance-decline breadth", "Sector earnings revisions", "Mega-cap fund flows"],
    directTickers: ["NVDA", "MSFT", "GOOGL", "SXR8", "ITA"],
    companies: [
      { ticker: "NVDA", name: "Nvidia", sensitivity: "High", balanceSheet: "Low leverage; crowded leadership", channel: "Multiple and momentum normalization" },
      { ticker: "MSFT", name: "Microsoft", sensitivity: "Medium", balanceSheet: "Strong balance sheet", channel: "Index weight makes relative returns important" },
      { ticker: "JPM", name: "JPMorgan Chase", sensitivity: "Low", balanceSheet: "Large diversified bank", channel: "Broader growth can support loan and fee income" },
      { ticker: "CAT", name: "Caterpillar", sensitivity: "Low", balanceSheet: "Cyclical industrial", channel: "Rotation can reward non-tech earnings" },
    ],
  },
  "nok-strengthens": {
    category: "Currency",
    question: "What if NOK strengthens while the underlying investments do not move?",
    meaning: "Foreign holdings translate into fewer Norwegian kroner even when local market prices are unchanged.",
    review: "Separate company performance from the currency effect in your NOK-reported portfolio.",
    trigger: "NOK appreciates",
    transmission: ["USD and EUR buy fewer NOK", "Foreign returns translate lower", "Local fundamentals stay unchanged"],
    pressure: ["Unhedged USD exposure", "Unhedged EUR exposure", "Foreign dividends in NOK terms"],
    support: ["NOK cash", "Currency-hedged funds", "Foreign purchases made after appreciation"],
    watch: ["USD/NOK and EUR/NOK", "Oil prices", "Norges Bank rate path", "Risk appetite"],
    directTickers: ["MSFT", "NVDA", "GOOGL", "SXR8", "ITA"],
    companies: [
      { ticker: "SXR8", name: "S&P 500 UCITS ETF", sensitivity: "High", balanceSheet: "EUR-listed; US equity exposure", channel: "EUR/NOK translation applies to the stored holding" },
      { ticker: "MSFT", name: "Microsoft", sensitivity: "High", balanceSheet: "USD holding", channel: "USD/NOK translation changes NOK value" },
      { ticker: "NVDA", name: "Nvidia", sensitivity: "High", balanceSheet: "USD holding", channel: "USD/NOK translation changes NOK value" },
    ],
  },
  custom: {
    category: "Currency",
    question: "What combination of market moves do you want to test?",
    meaning: "Start with no shock, then adjust only assumptions you have a reason to examine.",
    review: "Use custom mode after a named test when you want to challenge one assumption at a time.",
    trigger: "Your assumption",
    transmission: ["Choose a factor", "Set its direction and size", "Inspect holding-level contribution"],
    pressure: ["Depends on selected factors"],
    support: ["Depends on selected factors"],
    watch: ["Document the reason", "Save the test", "Revisit when evidence changes"],
    directTickers: [],
    companies: [],
  },
};
