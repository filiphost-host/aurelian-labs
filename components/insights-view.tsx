"use client";

import {
  ArrowUpRight,
  Activity,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Compass,
  FileSearch,
  Gauge,
  Gem,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { FxRates } from "@/lib/fx";
import { DataRoomPanel } from "@/components/data-room-panel";
import { MarketHistoryView } from "@/components/market-history-view";
import type { DailyBrief, MarketQuote } from "@/lib/types";

type DeskFocus = "core" | "us" | "europe" | "discover";
type InsightView = "overview" | "markets" | "history" | "under-radar" | "signals" | "investors" | "sources";
type IndexResearch = {
  index: {
    id: string;
    symbol: string;
    name: string;
    growthPercent: number | null;
    sharpeRatio: number | null;
    asOf: string | null;
  };
  thresholdPercent: number;
  trackedCount: number;
  availableCount: number;
  companies: Array<{
    symbol: string;
    name: string;
    growthPercent: number | null;
    sharpeRatio: number | null;
    debtToEquity: number | null;
    asOf: string | null;
  }>;
  source: string;
  methodology: string;
};

type RadarCompany = {
  symbol: string;
  name: string;
  country: string;
  industry: string;
  signal: string;
  sourceUrl: string;
  return1y: number | null;
  return6m: number | null;
  sharpe: number | null;
  maxDrawdown: number | null;
  largestDailyMove: number | null;
  averageVolume20d: number | null;
  relativeReturn: number | null;
  qualityScore: number | null;
  passesGuardrails: boolean;
  asOf: string | null;
};

type UnderRadarResponse = {
  benchmark: { name: string; return1y: number; asOf: string } | null;
  outperformers: RadarCompany[];
  comparison: RadarCompany[];
  screenedCount: number;
  methodology: string;
  source: string;
  refreshedAt: string;
};

const insightViews: Array<{ id: InsightView; label: string; description: string }> = [
  { id: "overview", label: "Daily overview", description: "Market pulse and priority signals" },
  { id: "markets", label: "Markets", description: "Major indices and geographic research" },
  { id: "history", label: "Market history", description: "Crises, transmission, and recurring patterns since 1857" },
  { id: "under-radar", label: "Under the Radar", description: "Durable outliers beyond the headline names" },
  { id: "signals", label: "Market signals", description: "Facts, relevance, and scenarios" },
  { id: "investors", label: "Investor comparison", description: "Compare operating styles" },
  { id: "sources", label: "Data sources", description: "Price provenance and freshness" },
];

const marketDesk = [
  { id: "us-policy", region: "us", market: "United States", label: "Policy and liquidity", title: "Fed, inflation, and the dollar", watch: "Rate expectations, labour-market direction, financial conditions, and dollar transmission.", relevance: "US discount rates influence global equity valuations, funding conditions, and currency markets.", source: "FRED", sourceUrl: "https://fred.stlouisfed.org/" },
  { id: "us-filings", region: "us", market: "United States", label: "Company evidence", title: "Technology earnings breadth", watch: "SEC filings, data-centre investment, margins, customer concentration, and capital returns.", relevance: "Earnings breadth helps distinguish an index-wide expansion from performance led by a few very large companies.", source: "SEC EDGAR", sourceUrl: "https://www.sec.gov/search-filings" },
  { id: "eu-policy", region: "europe", market: "Germany", label: "Monetary transmission", title: "ECB rates and European demand", watch: "Policy rates, credit conditions, inflation, and the industrial cycle across the euro area.", relevance: "European bank lending and industrial demand provide a useful contrast with US market structure.", source: "ECB Data Portal", sourceUrl: "https://data.ecb.europa.eu/" },
  { id: "eu-cycle", region: "europe", market: "France", label: "Cross-Atlantic check", title: "European earnings and fiscal risk", watch: "Industrial orders, consumer demand, sovereign spreads, defence budgets, and political stability.", relevance: "Europe combines globally exposed companies with country-level fiscal and political transmission channels.", source: "Eurostat", sourceUrl: "https://ec.europa.eu/eurostat" },
  { id: "japan", region: "discover", market: "Japan", label: "Discover", title: "Japan: rates, yen, and governance", watch: "Bank of Japan normalization, wage growth, yen sensitivity, and corporate capital allocation.", relevance: "Japan offers a different monetary regime, currency dynamic, and industrial mix from the US and euro area.", source: "Bank of Japan", sourceUrl: "https://www.boj.or.jp/en/" },
  { id: "india", region: "discover", market: "India", label: "Discover", title: "India: domestic growth at a premium", watch: "Credit growth, oil imports, rupee sensitivity, market valuations, and infrastructure execution.", relevance: "Domestic demand and financial deepening make India structurally different from export-led Asian markets.", source: "Reserve Bank of India", sourceUrl: "https://www.rbi.org.in/" },
  { id: "brazil", region: "discover", market: "Brazil", label: "Discover", title: "Brazil: real rates and commodities", watch: "Fiscal credibility, policy rates, the real, iron ore, agriculture, and China-linked demand.", relevance: "Brazil shows how real rates, commodities, fiscal policy, and currency moves can interact.", source: "Banco Central do Brasil", sourceUrl: "https://www.bcb.gov.br/en" },
  { id: "south-korea", region: "discover", market: "South Korea", label: "Discover", title: "South Korea: the semiconductor cycle", watch: "Memory pricing, export demand, governance reform, the won, and regional security.", relevance: "South Korea connects the semiconductor cycle to exports, currency sensitivity, and industrial policy.", source: "Bank of Korea", sourceUrl: "https://www.bok.or.kr/eng/main/main.do" },
] as const;

function buildMarketBrief(asOf: string, generatedAt: string): DailyBrief {
  return {
    id: `market-brief-${asOf}`,
    brief_date: asOf,
    title: `Global market learning brief · ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date(asOf))}`,
    summary: "A general market-level framework for understanding rates, earnings breadth, currencies, and credit conditions. It contains no personal holdings, balances, or investment recommendations.",
    generated_at: generatedAt,
    insights: [
      { id: "rates-discounting", kind: "fact", severity: "info", title: "Rates change the price of future cash flows", fact: "Higher discount rates reduce the present value of distant expected earnings, all else equal.", relevance: "Long-duration growth companies and highly leveraged borrowers are usually more rate-sensitive than cash-rich, near-term earners.", scenario: "Compare a +100 bps rate shock with a -100 bps shock and inspect which sectors carry the largest modeled change.", source: "FRED", source_url: "https://fred.stlouisfed.org/", as_of: asOf, holding_ids: [] },
      { id: "earnings-breadth", kind: "fact", severity: "info", title: "Index returns can hide narrow leadership", fact: "A capitalization-weighted index can rise even when many constituents are flat or falling if its largest companies advance strongly.", relevance: "Market breadth helps separate broad earnings improvement from concentration in a small group of index leaders.", scenario: "Stress mega-cap technology separately from the wider US equity factor to see how concentration changes the result.", source: "SEC EDGAR", source_url: "https://www.sec.gov/search-filings", as_of: asOf, holding_ids: [] },
      { id: "currency-translation", kind: "risk", severity: "info", title: "Currency can change the investor experience", fact: "The same local-market return can produce a different NOK or EUR result after exchange-rate translation.", relevance: "Currency exposure is a separate source of return and risk from the underlying company or index.", scenario: "Apply NOK strengthening and weakening shocks while keeping equity assumptions unchanged.", source: "ECB Data Portal", source_url: "https://data.ecb.europa.eu/", as_of: asOf, holding_ids: [] },
      { id: "credit-cycle", kind: "risk", severity: "info", title: "Credit spreads reveal financing stress", fact: "Corporate borrowing costs can rise even when central-bank policy rates are unchanged because investors demand more compensation for default and liquidity risk.", relevance: "Companies with refinancing needs, weak coverage, or cyclical cash flows are generally more exposed to wider spreads.", scenario: "Apply a +150 bps credit-spread shock and compare investment-grade bonds, high-yield bonds, and leveraged equities.", source: "BIS", source_url: "https://www.bis.org/statistics/", as_of: asOf, holding_ids: [] },
    ],
  };
}

const investorProfiles = {
  buffett: { name: "Warren Buffett", color: "#d4af37", scores: [82, 92, 22, 58, 80] },
  ackman: { name: "Bill Ackman", color: "#c87854", scores: [96, 62, 20, 96, 72] },
  renaissance: { name: "Renaissance Technologies", color: "#63a6a1", scores: [24, 78, 100, 8, 12] },
  smith: { name: "Terry Smith", color: "#91a28f", scores: [76, 48, 48, 12, 78] },
} as const;

type InvestorId = keyof typeof investorProfiles;
const comparisonAxes = ["Concentration", "Liquidity", "Systematic", "Intervention", "Transparency"];

export function InsightsView({
  asOf,
  generatedAt,
  fxMeta,
  benchmarkAsOf,
  onOpenMarket,
}: {
  asOf: string;
  generatedAt: string;
  fxMeta: FxRates;
  benchmarkAsOf: string | null;
  onOpenMarket: (country: string) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deskFocus, setDeskFocus] = useState<DeskFocus>("core");
  const [insightView, setInsightView] = useState<InsightView>("overview");
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quotesRefreshedAt, setQuotesRefreshedAt] = useState<string | null>(null);
  const brief = useMemo(() => buildMarketBrief(asOf, generatedAt), [asOf, generatedAt]);
  const sourced = brief.insights.filter((item) => item.source_url).length;

  const refreshQuotes = useCallback(async () => {
    setQuotesLoading(true);
    setQuoteError(null);
    try {
      const response = await fetch("/api/market/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruments: [] }),
      });
      if (!response.ok) throw new Error("The market feed did not respond.");
      const payload = await response.json() as { quotes?: MarketQuote[]; refreshedAt?: string };
      const nextQuotes = payload.quotes ?? [];
      setQuotes(nextQuotes);
      setQuotesRefreshedAt(payload.refreshedAt ?? new Date().toISOString());
    } catch {
      setQuoteError("Latest index quotes are temporarily unavailable.");
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refreshQuotes(), 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshQuotes]);

  async function analyzeInChatGpt() {
    const packet = [
      "You are reviewing a general, source-backed market learning brief.",
      "Separate facts from interpretation. Do not recommend trades or invent missing data.",
      "Explain the transmission mechanisms, important counterarguments, and useful follow-up questions.",
      "",
      `Brief date: ${brief.brief_date}`,
      `Summary: ${brief.summary}`,
      "",
      ...brief.insights.flatMap((item, index) => [
        `${index + 1}. ${item.title}`,
        `Fact: ${item.fact}`,
        `Why it matters: ${item.relevance}`,
        `Possible scenario: ${item.scenario}`,
        `Source: ${item.source}${item.source_url ? ` (${item.source_url})` : ""}, as of ${item.as_of}`,
        "",
      ]),
    ].join("\n");
    const chatWindow = window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    await navigator.clipboard.writeText(packet);
    setCopied(true);
    if (!chatWindow) {
      window.location.assign("https://chatgpt.com/");
    }
  }

  return (
    <>
      <div className="insights-layout insights-workbench">
        <section className="brief-hero primary-view-toolbar">
          <div><h2>Insights</h2></div>
          <div className="brief-actions">
            <button className="ghost-button" onClick={() => setChatOpen(true)}>
              <Sparkles size={16} /> Analyze in ChatGPT
            </button>
          </div>
        </section>

        <section className="insights-brief-copy" aria-labelledby="daily-brief-title">
          <span className="eyebrow">Market learning brief</span>
          <h3 id="daily-brief-title">{brief.title}</h3>
          <p>{brief.summary}</p>
        </section>

        <section className="insights-control-bar" aria-label="Insights view controls">
          <div className="insights-view-select">
            <Activity size={17} />
            <label htmlFor="insights-view">Workspace</label>
            <div className="select-shell">
              <select id="insights-view" value={insightView} onChange={(event) => setInsightView(event.target.value as InsightView)}>
                {insightViews.map((view) => <option key={view.id} value={view.id}>{view.label} - {view.description}</option>)}
              </select>
              <ChevronDown size={15} aria-hidden="true" />
            </div>
          </div>
          <span>{insightViews.find((view) => view.id === insightView)?.description}</span>
        </section>

        {insightView === "overview" || insightView === "markets" ? (
          <MarketMonitor
            quotes={quotes}
            loading={quotesLoading}
            error={quoteError}
            refreshedAt={quotesRefreshedAt}
            onRefresh={refreshQuotes}
          />
        ) : null}

        {insightView === "history" ? <MarketHistoryView /> : null}

        {insightView === "overview" ? (
          <section className="brief-stats" aria-label="Brief status">
            <article><TriangleAlert size={17} /><span>Core questions</span><strong>{brief.insights.length}</strong></article>
            <article><FileSearch size={17} /><span>Linked sources</span><strong>{sourced}</strong></article>
            <article><ShieldCheck size={17} /><span>Automatic advice</span><strong>Off</strong></article>
          </section>
        ) : null}

        {insightView === "markets" ? (
          <MarketResearchDesk deskFocus={deskFocus} onDeskFocus={setDeskFocus} onOpenMarket={onOpenMarket} />
        ) : null}

        {insightView === "under-radar" ? <UnderTheRadarDesk /> : null}

        {insightView === "investors" ? <InvestorComparison /> : null}

        {insightView === "overview" || insightView === "signals" ? (
          <InsightFeed
            brief={brief}
            limit={insightView === "overview" ? 3 : undefined}
            onViewAll={() => setInsightView("signals")}
          />
        ) : null}

        {insightView === "sources" ? (
          <DataRoomPanel fxRates={fxMeta} benchmarkAsOf={benchmarkAsOf} />
        ) : null}
      </div>

      {chatOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setChatOpen(false);
        }}>
          <section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="chat-title">
            <div className="modal-heading">
              <div><span className="eyebrow">Market-learning handoff</span><h2 id="chat-title">Analyze in ChatGPT</h2></div>
              <button className="icon-button" onClick={() => setChatOpen(false)} aria-label="Close ChatGPT dialog"><X size={17} /></button>
            </div>
            <p className="modal-copy">
              Aurelian will copy a structured prompt and open ChatGPT. Nothing is transmitted automatically.
            </p>
            <p className="panel-note">The packet contains only the general market brief shown on this page. It includes no holdings, balances, or personal notes.</p>
            {copied ? <p className="success-message"><Check size={15} /> Analysis packet copied. Paste it into the ChatGPT tab.</p> : null}
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setChatOpen(false)}>Cancel</button>
              <button className="primary-button" onClick={analyzeInChatGpt}>
                <Clipboard size={16} /> Copy and open ChatGPT
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function MarketMonitor({
  quotes,
  loading,
  error,
  refreshedAt,
  onRefresh,
}: {
  quotes: MarketQuote[];
  loading: boolean;
  error: string | null;
  refreshedAt: string | null;
  onRefresh: () => void;
}) {
  const visibleQuotes = quotes.filter((quote) => quote.id.startsWith("index-"));
  const [selectedIndexId, setSelectedIndexId] = useState<string | null>(null);
  const [research, setResearch] = useState<IndexResearch | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);

  async function toggleIndexResearch(quote: MarketQuote) {
    if (selectedIndexId === quote.id) {
      setSelectedIndexId(null);
      setResearch(null);
      setResearchError(null);
      return;
    }
    setSelectedIndexId(quote.id);
    setResearch(null);
    setResearchError(null);
    setResearchLoading(true);
    try {
      const response = await fetch("/api/market/index-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexId: quote.id }),
      });
      if (!response.ok) throw new Error("Index research is unavailable.");
      setResearch(await response.json() as IndexResearch);
    } catch {
      setResearchError("The delayed history provider is temporarily unavailable. Try refreshing this index later.");
    } finally {
      setResearchLoading(false);
    }
  }

  return (
    <section className="market-monitor wide" aria-labelledby="market-monitor-title">
      <div className="section-heading market-monitor-heading">
        <div><span className="eyebrow">Latest available market data</span><h2 id="market-monitor-title">Market monitor</h2></div>
        <div className="market-monitor-actions">
          <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh market data" title="Refresh market data">
            <RefreshCw size={15} className={loading ? "spinning" : ""} />
          </button>
        </div>
      </div>
      {error ? <p className="market-feed-message bad">{error}</p> : null}
      <div className="market-monitor-grid" aria-live="polite" aria-busy={loading}>
        {loading && visibleQuotes.length === 0 ? Array.from({ length: 7 }, (_, index) => (
          <div className="quote-card quote-skeleton" key={index} aria-hidden="true"><i /><i /><i /></div>
        )) : visibleQuotes.map((quote) => {
          const positive = (quote.percentChange ?? 0) >= 0;
          const expandable = quote.id.startsWith("index-");
          return (
            <article className={`quote-card${selectedIndexId === quote.id ? " expanded" : ""}`} key={quote.id}>
              {expandable ? (
                <button
                  className="quote-card-open"
                  type="button"
                  aria-label={`${selectedIndexId === quote.id ? "Close" : "Open"} ${quote.name} index research`}
                  aria-expanded={selectedIndexId === quote.id}
                  onClick={() => void toggleIndexResearch(quote)}
                />
              ) : null}
              <header><span>{quote.symbol}</span><i className={quote.status} title={quote.status === "live" ? "Live quote" : "Delayed quote"} /></header>
              <strong>{quote.price.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>{quote.currency}</small></strong>
              <div><span>{quote.name}</span><em className={positive ? "good" : "bad"}>{quote.percentChange === null ? "-" : `${positive ? "+" : ""}${quote.percentChange.toFixed(2)}%`}</em></div>
              <footer>
                <span>{quote.source} · {formatQuoteTime(quote.asOf)}</span>
                {expandable ? <span className="quote-research-cue">Research {selectedIndexId === quote.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}</span> : null}
              </footer>
            </article>
          );
        })}
      </div>
      {selectedIndexId ? (
        <section className="index-research-panel" aria-live="polite">
          {researchLoading ? (
            <div className="index-research-loading"><RefreshCw size={17} className="spinning" /> Calculating trailing growth and risk metrics...</div>
          ) : researchError ? (
            <div className="index-research-empty"><TriangleAlert size={17} /><span>{researchError}</span></div>
          ) : research ? (
            <>
              <header className="index-research-heading">
                <div><span className="eyebrow">Index research</span><h3>{research.index.name}</h3></div>
                <span>As of {research.index.asOf ?? "latest available"}</span>
              </header>
              <div className="index-research-metrics">
                <article><TrendingUp size={16} /><span>Trailing 1Y growth</span><strong>{research.index.growthPercent === null ? "Unavailable" : `${research.index.growthPercent >= 0 ? "+" : ""}${research.index.growthPercent.toFixed(1)}%`}</strong></article>
                <article><Gauge size={16} /><span>Sharpe estimate</span><strong>{research.index.sharpeRatio === null ? "Unavailable" : research.index.sharpeRatio.toFixed(2)}</strong></article>
                <article><Building2 size={16} /><span>Growth screen</span><strong>{research.companies.length} above {research.thresholdPercent}%</strong></article>
              </div>
              <div className="index-company-screen">
                <div className="index-company-screen-title">
                  <div><span className="eyebrow">Tracked constituents</span><h3>Companies above {research.thresholdPercent}% trailing growth</h3></div>
                  <span>{research.availableCount} of {research.trackedCount} histories available</span>
                </div>
                {research.companies.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Company</th><th>1Y growth</th><th>Debt / equity</th><th>Sharpe</th><th>As of</th></tr></thead>
                      <tbody>{research.companies.map((company) => (
                        <tr key={company.symbol}>
                          <td><strong>{company.name}</strong><span>{company.symbol}</span></td>
                          <td className="good">+{company.growthPercent?.toFixed(1)}%</td>
                          <td>{company.debtToEquity === null ? <span className="unavailable-value">Unavailable</span> : `${company.debtToEquity.toFixed(0)}%`}</td>
                          <td>{company.sharpeRatio === null ? <span className="unavailable-value">Unavailable</span> : company.sharpeRatio.toFixed(2)}</td>
                          <td>{company.asOf ?? "-"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : (
                  <div className="index-research-empty">
                    <TriangleAlert size={17} />
                    <span>{research.availableCount ? `No tracked constituents cleared the ${research.thresholdPercent}% threshold.` : "Constituent history is unavailable from the delayed provider right now."}</span>
                  </div>
                )}
              </div>
              <footer className="index-research-method"><span>{research.methodology}</span><span>{research.source}</span></footer>
            </>
          ) : null}
        </section>
      ) : null}
      <footer className="market-monitor-footer">
        <span>Select an index for its growth, debt, and Sharpe screen.</span>
        <span>{refreshedAt ? `Refreshed ${formatQuoteTime(refreshedAt)}` : "Connecting to market feed"}</span>
      </footer>
    </section>
  );
}

function MarketResearchDesk({ deskFocus, onDeskFocus, onOpenMarket }: {
  deskFocus: DeskFocus;
  onDeskFocus: (focus: DeskFocus) => void;
  onOpenMarket: (country: string) => void;
}) {
  return (
    <section className="market-desk wide" aria-labelledby="market-desk-title">
      <div className="section-heading">
        <div><span className="eyebrow">Geographic research desk</span><h2 id="market-desk-title">Daily focus and market discovery</h2></div>
        <div className="desk-focus" aria-label="Market desk focus">
          {([ ["core", "US & Europe"], ["us", "United States"], ["europe", "Europe"], ["discover", "Discover"] ] as Array<[DeskFocus, string]>).map(([id, label]) => (
            <button key={id} type="button" className={deskFocus === id ? "active" : ""} onClick={() => onDeskFocus(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="market-desk-grid">
        {marketDesk.filter((item) => deskFocus === "core" ? item.region !== "discover" : item.region === deskFocus).map((item) => (
          <article key={item.id}>
            <header><span>{item.label}</span><strong>{item.market}</strong></header>
            <h3>{item.title}</h3>
            <dl><div><dt>Watch</dt><dd>{item.watch}</dd></div><div><dt>Why it matters</dt><dd>{item.relevance}</dd></div></dl>
            <footer>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.source} <ArrowUpRight size={12} /></a>
              <button type="button" onClick={() => onOpenMarket(item.market)}><MapPinned size={13} /> Open map</button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

const alternativeSignals = [
  {
    name: "Lipstick effect",
    grade: "Empirical, narrow",
    tone: "evidence",
    reads: "Substitution from larger discretionary purchases toward smaller beauty purchases during stress.",
    caution: "Observed in specific groups and periods; it is not a standalone recession forecast.",
    source: "Journal of Behavioral and Experimental Economics",
    sourceUrl: "https://www.sciencedirect.com/science/article/pii/S2214804319304884",
  },
  {
    name: "Temporary employment",
    grade: "Hard data",
    tone: "data",
    reads: "Employers often adjust temporary staffing before permanent payrolls.",
    caution: "Industry mix and structural labour changes can weaken the historical relationship.",
    source: "FRED",
    sourceUrl: "https://fred.stlouisfed.org/series/TEMPHELPS",
  },
  {
    name: "Freight and packaging",
    grade: "Real-economy proxy",
    tone: "proxy",
    reads: "Shipping and packaging demand can reveal changes in physical goods activity before headline GDP.",
    caution: "Services, inventory cycles, and e-commerce mix can distort the signal.",
    source: "FRED transportation data",
    sourceUrl: "https://fred.stlouisfed.org/categories/32261",
  },
  {
    name: "Men's underwear index",
    grade: "Folklore",
    tone: "folklore",
    reads: "The story says replacement purchases are deferred when household confidence weakens.",
    caution: "There is no robust, investable public series. Treat it as a question, not evidence.",
    source: "Concept note",
    sourceUrl: "https://www.theatlantic.com/newsletters/archive/2025/09/recession-indicator-meme/684376/",
  },
] as const;

function marketRegion(country: string) {
  if (["United States"].includes(country)) return "US";
  if (["Japan", "South Korea", "Taiwan"].includes(country)) return "Asia";
  return "Europe";
}

function signedPercent(value: number | null) {
  if (value === null) return "Unavailable";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function UnderTheRadarDesk() {
  const [data, setData] = useState<UnderRadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<"All" | "US" | "Europe" | "Asia">("All");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/market/under-radar");
      if (!response.ok) throw new Error("Screen unavailable");
      setData(await response.json() as UnderRadarResponse);
    } catch {
      setError("The delayed history feed is unavailable. The research framework remains visible below.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const visible = (data?.outperformers ?? []).filter((company) =>
    region === "All" || marketRegion(company.country) === region,
  );

  return (
    <section className="under-radar-desk" aria-labelledby="under-radar-title">
      <header className="under-radar-heading">
        <div><span className="eyebrow">Breadth beyond the obvious</span><h2 id="under-radar-title">Under the Radar</h2><p>Find liquid companies whose sustained price action is stronger than the headline narrative, then inspect the business signal behind it.</p></div>
        <button className="icon-button" type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh under-the-radar screen" title="Refresh screen"><RefreshCw size={15} className={loading ? "spinning" : ""} /></button>
      </header>

      <div className="radar-guardrail-band">
        <Gem size={17} />
        <div><strong>Quality guardrails are on</strong><span>Thin trading, sub-5 prices, one-day jumps above 30%, short histories, and extreme drawdowns are rejected.</span></div>
        <em>{data ? `${data.outperformers.length} of ${data.screenedCount} qualify` : "Screening"}</em>
      </div>

      <section className="headline-comparison" aria-label="Victoria's Secret semiconductor comparison">
        <div className="headline-comparison-copy"><span className="eyebrow">The comparison that prompted this</span><h3>Victoria&apos;s Secret vs semiconductor leaders</h3><p>Victoria&apos;s Secret now trades as <strong>VSXY</strong> (formerly VSCO); TSMC&apos;s US ticker is <strong>TSM</strong>. This compares price performance without pretending the businesses share the same economics.</p></div>
        <div className="headline-comparison-grid">
          {loading && !data ? Array.from({ length: 3 }, (_, index) => <div className="radar-company-card loading" key={index} />) : data?.comparison.map((company) => (
            <article className="radar-company-card" key={company.symbol}>
              <header><span>{company.symbol}</span><em>{company.industry}</em></header>
              <strong>{signedPercent(company.return1y)}</strong>
              <p>{company.name}</p>
              <footer><span>6M {signedPercent(company.return6m)}</span><span>Sharpe {company.sharpe?.toFixed(2) ?? "-"}</span><span className={company.passesGuardrails ? "comparison-qualified" : "comparison-review"} title={company.passesGuardrails ? "Passes every durability guardrail" : `Review required: largest daily move ${signedPercent(company.largestDailyMove)}`}>{company.passesGuardrails ? "Qualified" : `Review · ${signedPercent(company.largestDailyMove)} day`}</span></footer>
            </article>
          ))}
        </div>
      </section>

      <div className="radar-screen-heading">
        <div><span className="eyebrow">Qualified relative strength</span><h3>Durable outliers</h3></div>
        <div className="radar-region-filter" role="group" aria-label="Outperformer region">
          {(["All", "US", "Europe", "Asia"] as const).map((item) => <button key={item} className={region === item ? "active" : ""} onClick={() => setRegion(item)}>{item}</button>)}
        </div>
      </div>
      {error ? <div className="index-research-empty"><TriangleAlert size={17} /><span>{error}</span></div> : null}
      {!error && !loading && !visible.length ? <div className="radar-empty"><ShieldCheck size={18} /><strong>No company clears every guardrail in this region today.</strong><span>That is a valid result. The screen does not lower its standards to manufacture an idea.</span></div> : null}
      {visible.length ? (
        <div className="radar-outlier-table table-wrap">
          <table>
            <thead><tr><th>Company</th><th>Hidden signal</th><th>1Y return</th><th>vs S&amp;P 500</th><th>Sharpe</th><th>Max drawdown</th><th>Screen</th></tr></thead>
            <tbody>{visible.map((company) => <tr key={company.symbol}>
              <td><a href={company.sourceUrl} target="_blank" rel="noreferrer"><strong>{company.name}</strong><span>{company.symbol} · {company.country}</span></a></td>
              <td><strong>{company.signal}</strong><span>{company.industry}</span></td>
              <td className={(company.return1y ?? 0) >= 0 ? "good" : "bad"}>{signedPercent(company.return1y)}</td>
              <td className="good">{signedPercent(company.relativeReturn)}</td>
              <td>{company.sharpe?.toFixed(2) ?? "-"}</td>
              <td className="bad">{signedPercent(company.maxDrawdown)}</td>
              <td><span className="radar-quality-score"><i style={{ width: `${company.qualityScore ?? 0}%` }} />{company.qualityScore ?? "-"}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
      ) : null}
      <p className="radar-methodology">{data?.methodology ?? "The screen waits for delayed market history before ranking companies."} {data ? `${data.source}. As of ${formatQuoteTime(data.refreshedAt)}.` : ""}</p>

      <section className="alternative-signals">
        <div className="section-heading"><div><span className="eyebrow">Unconventional economic evidence</span><h2>Signals behind the headlines</h2></div><span className="as-of">Evidence grade shown explicitly</span></div>
        <div className="alternative-signal-grid">{alternativeSignals.map((signal) => <article key={signal.name}>
          <header><strong>{signal.name}</strong><span className={signal.tone}>{signal.grade}</span></header>
          <dl><div><dt>What it may reveal</dt><dd>{signal.reads}</dd></div><div><dt>Why to be careful</dt><dd>{signal.caution}</dd></div></dl>
          <a href={signal.sourceUrl} target="_blank" rel="noreferrer">{signal.source} <ArrowUpRight size={12} /></a>
        </article>)}</div>
      </section>
    </section>
  );
}

function InsightFeed({ brief, limit, onViewAll }: { brief: DailyBrief; limit?: number; onViewAll: () => void }) {
  const insights = limit ? brief.insights.slice(0, limit) : brief.insights;
  return (
    <section className="insight-feed">
      <div className="section-heading">
        <div><span className="eyebrow">How to read the market</span><h2>Core market signals</h2></div>
        <span className="as-of">Generated {new Intl.DateTimeFormat("en-GB", { timeStyle: "short" }).format(new Date(brief.generated_at))}</span>
      </div>
      {insights.map((item, index) => (
        <article className={`insight-card ${item.severity}`} key={item.id}>
          <div className="insight-index">{String(index + 1).padStart(2, "0")}</div>
          <div className="insight-body">
            <div className="insight-title"><span>{item.kind}</span><h3>{item.title}</h3></div>
            <div className="insight-columns">
              <div><strong>Fact</strong><p>{item.fact}</p></div>
              <div><strong>Why it matters</strong><p>{item.relevance}</p></div>
              <div><strong>Possible scenario</strong><p>{item.scenario}</p></div>
            </div>
            <footer>
              {item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">{item.source} <ArrowUpRight size={13} /></a> : <span>{item.source}</span>}
              <span>As of {item.as_of}</span>
            </footer>
          </div>
        </article>
      ))}
      {limit && brief.insights.length > limit ? <button className="signals-more" type="button" onClick={onViewAll}>View all {brief.insights.length} signals <ArrowUpRight size={14} /></button> : null}
    </section>
  );
}

function formatQuoteTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function InvestorComparison() {
  const [left, setLeft] = useState<InvestorId>("buffett");
  const [right, setRight] = useState<InvestorId>("renaissance");
  const leftProfile = investorProfiles[left];
  const rightProfile = investorProfiles[right];
  const data = comparisonAxes.map((axis, index) => ({ axis, left: leftProfile.scores[index], right: rightProfile.scores[index] }));

  return (
    <section className="investor-comparison wide" aria-labelledby="investor-comparison-title">
      <div className="section-heading">
        <div><span className="eyebrow">Strategy comparison</span><h2 id="investor-comparison-title">Compare investor operating systems</h2></div>
        <div className="investor-selectors">
          <label><span>Investor A</span><select value={left} onChange={(event) => setLeft(event.target.value as InvestorId)}>{Object.entries(investorProfiles).map(([id, profile]) => <option key={id} value={id}>{profile.name}</option>)}</select></label>
          <label><span>Investor B</span><select value={right} onChange={(event) => setRight(event.target.value as InvestorId)}>{Object.entries(investorProfiles).map(([id, profile]) => <option key={id} value={id}>{profile.name}</option>)}</select></label>
        </div>
      </div>
      <div className="investor-comparison-body">
        <div className="investor-radar">
          <ResponsiveContainer width="100%" height={330}>
            <RadarChart data={data} outerRadius="72%">
              <PolarGrid stroke="rgba(255, 255, 255, 0.09)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: "#aaa5a8", fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name={leftProfile.name} dataKey="left" stroke={leftProfile.color} fill={leftProfile.color} fillOpacity={0.2} strokeWidth={2} />
              <Radar name={rightProfile.name} dataKey="right" stroke={rightProfile.color} fill={rightProfile.color} fillOpacity={0.16} strokeWidth={2} />
              <Legend wrapperStyle={{ color: "#dce3dc", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#0e0d0f", border: "1px solid rgba(255, 255, 255, 0.14)", color: "#f4f1ef" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="comparison-notes">
          <Compass size={20} />
          <h3>Read shape, not rank</h3>
          <p>The scores describe visible process characteristics, not expected return or investment quality. A high score is not automatically better.</p>
          <p>Renaissance&apos;s public filings do not reveal Medallion&apos;s full strategy. Buffett&apos;s liquidity and Ackman&apos;s intervention are also difficult to reproduce from a personal account.</p>
          <span>Qualitative Aurelian framework · 0-100 descriptive scale</span>
        </div>
      </div>
    </section>
  );
}
