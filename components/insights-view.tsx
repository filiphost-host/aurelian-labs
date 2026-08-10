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
  Link2,
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
import { buildChatGptPacket, redactHoldingIdentities } from "@/lib/insights";
import { formatMoney, holdingValueNok } from "@/lib/calculations";
import type { DailyBrief, Holding, MarketQuote, ShareOptions } from "@/lib/types";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { ShareDialog } from "@/components/share-dialog";

type DeskFocus = "core" | "us" | "europe" | "discover";
type InsightView = "overview" | "markets" | "signals" | "investors" | "sources";
type QuoteScope = "indices" | "portfolio";

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

const insightViews: Array<{ id: InsightView; label: string; description: string }> = [
  { id: "overview", label: "Daily overview", description: "Market pulse and priority signals" },
  { id: "markets", label: "Markets", description: "Major indices and geographic research" },
  { id: "signals", label: "Portfolio signals", description: "Facts, relevance, and scenarios" },
  { id: "investors", label: "Investor comparison", description: "Compare operating styles" },
  { id: "sources", label: "Data sources", description: "Price provenance and freshness" },
];

const marketDesk = [
  { id: "us-policy", region: "us", market: "United States", label: "Policy and liquidity", title: "Fed, inflation, and the dollar", watch: "Rate expectations, labour-market direction, financial conditions, and USD/NOK translation.", relevance: "The portfolio is dominated by US earnings and long-duration technology exposure.", source: "FRED", sourceUrl: "https://fred.stlouisfed.org/" },
  { id: "us-filings", region: "us", market: "United States", label: "Company evidence", title: "Technology earnings breadth", watch: "SEC filings, data-centre investment, margins, customer concentration, and capital returns.", relevance: "MSFT, NVDA, and GOOGL are direct overweights and are also held through the S&P 500 ETF.", source: "SEC EDGAR", sourceUrl: "https://www.sec.gov/search-filings" },
  { id: "eu-policy", region: "europe", market: "Germany", label: "Monetary transmission", title: "ECB rates and European demand", watch: "Policy rates, credit conditions, inflation, and the industrial cycle across the euro area.", relevance: "European conditions affect the ETF listing currency, global demand, and NOK/EUR translation.", source: "ECB Data Portal", sourceUrl: "https://data.ecb.europa.eu/" },
  { id: "eu-cycle", region: "europe", market: "France", label: "Cross-Atlantic check", title: "European earnings and fiscal risk", watch: "Industrial orders, consumer demand, sovereign spreads, defence budgets, and political stability.", relevance: "Europe provides a useful counterweight when US technology dominates the portfolio narrative.", source: "Eurostat", sourceUrl: "https://ec.europa.eu/eurostat" },
  { id: "japan", region: "discover", market: "Japan", label: "Discover", title: "Japan: rates, yen, and governance", watch: "Bank of Japan normalization, wage growth, yen sensitivity, and corporate capital allocation.", relevance: "A different monetary regime and industrial mix can expose assumptions hidden by a US-heavy portfolio.", source: "Bank of Japan", sourceUrl: "https://www.boj.or.jp/en/" },
  { id: "india", region: "discover", market: "India", label: "Discover", title: "India: domestic growth at a premium", watch: "Credit growth, oil imports, rupee sensitivity, market valuations, and infrastructure execution.", relevance: "Domestic demand and financial deepening differ materially from the portfolio's US mega-cap drivers.", source: "Reserve Bank of India", sourceUrl: "https://www.rbi.org.in/" },
  { id: "brazil", region: "discover", market: "Brazil", label: "Discover", title: "Brazil: real rates and commodities", watch: "Fiscal credibility, policy rates, the real, iron ore, agriculture, and China-linked demand.", relevance: "Real assets and high-rate dynamics provide a useful contrast with technology-duration exposure.", source: "Banco Central do Brasil", sourceUrl: "https://www.bcb.gov.br/en" },
  { id: "south-korea", region: "discover", market: "South Korea", label: "Discover", title: "South Korea: the semiconductor cycle", watch: "Memory pricing, export demand, governance reform, the won, and regional security.", relevance: "It broadens the AI supply-chain view beyond Nvidia while retaining clear cyclical risks.", source: "Bank of Korea", sourceUrl: "https://www.bok.or.kr/eng/main/main.do" },
] as const;

const investorProfiles = {
  buffett: { name: "Warren Buffett", color: "#d4af37", scores: [82, 92, 22, 58, 80] },
  ackman: { name: "Bill Ackman", color: "#c87854", scores: [96, 62, 20, 96, 72] },
  renaissance: { name: "Renaissance Technologies", color: "#63a6a1", scores: [24, 78, 100, 8, 12] },
  smith: { name: "Terry Smith", color: "#91a28f", scores: [76, 48, 48, 12, 78] },
} as const;

type InvestorId = keyof typeof investorProfiles;
const comparisonAxes = ["Concentration", "Liquidity", "Systematic", "Intervention", "Transparency"];

export function InsightsView({
  brief,
  holdings,
  fxRates,
  onOpenMarket,
  onQuotesUpdated,
}: {
  brief: DailyBrief;
  holdings: Holding[];
  fxRates: Record<string, number>;
  onOpenMarket: (country: string) => void;
  onQuotesUpdated: (quotes: MarketQuote[]) => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatOptions, setChatOptions] = useState({
    includeHoldings: false,
    includeValues: false,
    includeCommentary: false,
  });
  const [copied, setCopied] = useState(false);
  const [deskFocus, setDeskFocus] = useState<DeskFocus>("core");
  const [insightView, setInsightView] = useState<InsightView>("overview");
  const [quoteScope, setQuoteScope] = useState<QuoteScope>("indices");
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quotesRefreshedAt, setQuotesRefreshedAt] = useState<string | null>(null);
  const attention = brief.insights.filter((item) => item.severity === "attention").length;
  const sourced = brief.insights.filter((item) => item.source_url).length;
  const instrumentKey = useMemo(() => JSON.stringify(holdings
    .filter((holding) => holding.ticker && !["bond", "cash"].includes(holding.asset_type))
    .map((holding) => ({
      id: holding.id,
      symbol: holding.ticker,
      name: holding.name,
      exchange: holding.exchange,
      currency: holding.currency,
    }))), [holdings]);

  const refreshQuotes = useCallback(async () => {
    setQuotesLoading(true);
    setQuoteError(null);
    try {
      const instruments = JSON.parse(instrumentKey) as Array<{ id: string; symbol: string; name: string; exchange: string | null; currency: string }>;
      const response = await fetch("/api/market/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruments }),
      });
      if (!response.ok) throw new Error("The market feed did not respond.");
      const payload = await response.json() as { quotes?: MarketQuote[]; refreshedAt?: string };
      const nextQuotes = payload.quotes ?? [];
      setQuotes(nextQuotes);
      setQuotesRefreshedAt(payload.refreshedAt ?? new Date().toISOString());
      onQuotesUpdated(nextQuotes.filter((quote) => !quote.id.startsWith("index-")));
    } catch {
      setQuoteError("Latest quotes are temporarily unavailable. Stored values remain unchanged.");
    } finally {
      setQuotesLoading(false);
    }
  }, [instrumentKey, onQuotesUpdated]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refreshQuotes(), 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refreshQuotes]);

  async function analyzeInChatGpt() {
    const packet = buildChatGptPacket(brief, holdings, chatOptions, fxRates);
    const chatWindow = window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    await navigator.clipboard.writeText(packet);
    setCopied(true);
    if (!chatWindow) {
      window.location.assign("https://chatgpt.com/");
    }
  }

  function sharedContent(options: ShareOptions) {
    const visibleInsights = brief.insights.map((item) => ({
      ...item,
      title: options.includeHoldings ? item.title : redactHoldingIdentities(item.title, holdings),
      fact: options.includeHoldings ? item.fact : redactHoldingIdentities(item.fact, holdings),
      relevance: options.includeHoldings
        ? item.relevance
        : redactHoldingIdentities(item.relevance, holdings),
      scenario: options.includeHoldings
        ? item.scenario
        : redactHoldingIdentities(item.scenario, holdings),
    }));

    return {
      summary: options.includeHoldings
        ? brief.summary
        : redactHoldingIdentities(brief.summary, holdings),
      insights: options.includeCommentary ? visibleInsights : visibleInsights.map((item) => ({
        ...item,
        relevance: "Commentary excluded by the owner.",
        scenario: "Scenario commentary excluded by the owner.",
      })),
      holdings: options.includeHoldings
        ? holdings.map((holding) => ({
            name: holding.name,
            ticker: holding.ticker,
            valueNok: options.includeValues ? holdingValueNok(holding, fxRates) : undefined,
            currency: holding.currency,
            dataStatus: holding.price_provenance.status,
          }))
        : undefined,
    };
  }

  return (
    <>
      <div className="insights-layout insights-workbench">
        <section className="brief-hero">
          <div>
            <span className="eyebrow">Daily decision brief</span>
            <h2>{brief.title}</h2>
            <p>{brief.summary}</p>
          </div>
          <div className="brief-actions">
            <button className="ghost-button" onClick={() => setShareOpen(true)}>
              <Link2 size={16} /> Share snapshot
            </button>
            <button className="primary-button" onClick={() => setChatOpen(true)}>
              <Sparkles size={16} /> Analyze in ChatGPT
            </button>
          </div>
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
            scope={quoteScope}
            onScopeChange={setQuoteScope}
            loading={quotesLoading}
            error={quoteError}
            refreshedAt={quotesRefreshedAt}
            onRefresh={refreshQuotes}
          />
        ) : null}

        {insightView === "overview" ? (
          <section className="brief-stats" aria-label="Brief status">
            <article><TriangleAlert size={17} /><span>Needs attention</span><strong>{attention}</strong></article>
            <article><FileSearch size={17} /><span>Linked sources</span><strong>{sourced}</strong></article>
            <article><ShieldCheck size={17} /><span>Automatic advice</span><strong>Off</strong></article>
          </section>
        ) : null}

        {insightView === "markets" ? (
          <MarketResearchDesk deskFocus={deskFocus} onDeskFocus={setDeskFocus} onOpenMarket={onOpenMarket} />
        ) : null}

        {insightView === "investors" ? <InvestorComparison /> : null}

        {insightView === "overview" || insightView === "signals" ? (
          <InsightFeed
            brief={brief}
            limit={insightView === "overview" ? 3 : undefined}
            onViewAll={() => setInsightView("signals")}
          />
        ) : null}

        {insightView === "sources" ? (
          <section className="panel wide data-ledger">
            <div className="section-heading">
              <div><span className="eyebrow">Provenance ledger</span><h2>Values behind this brief</h2></div>
            </div>
            <div className="data-ledger-grid">
              {holdings.map((holding) => (
                <article key={holding.id}>
                  <div><strong>{holding.ticker ?? holding.name}</strong><span>{formatMoney(holdingValueNok(holding, fxRates), "NOK", fxRates)}</span></div>
                  <ProvenanceBadge provenance={holding.price_provenance} />
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {shareOpen ? (
        <ShareDialog
          title={brief.title}
          kind="insight"
          content={sharedContent}
          onClose={() => setShareOpen(false)}
        />
      ) : null}

      {chatOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setChatOpen(false);
        }}>
          <section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="chat-title">
            <div className="modal-heading">
              <div><span className="eyebrow">Privacy-reviewed handoff</span><h2 id="chat-title">Analyze in ChatGPT</h2></div>
              <button className="icon-button" onClick={() => setChatOpen(false)} aria-label="Close ChatGPT dialog"><X size={17} /></button>
            </div>
            <p className="modal-copy">
              Aurelian will copy a structured prompt and open ChatGPT. Nothing is transmitted automatically.
            </p>
            <div className="privacy-list">
              <label>
                <input
                  type="checkbox"
                  checked={chatOptions.includeHoldings}
                  onChange={(event) => setChatOptions((current) => ({
                    ...current,
                    includeHoldings: event.target.checked,
                    includeValues: event.target.checked ? current.includeValues : false,
                    includeCommentary: event.target.checked ? current.includeCommentary : false,
                  }))}
                />
                <span><strong>Holding names</strong><em>{chatOptions.includeHoldings ? "Included" : "Excluded"}</em></span>
              </label>
              <label>
                <input
                  type="checkbox"
                  disabled={!chatOptions.includeHoldings}
                  checked={chatOptions.includeValues}
                  onChange={(event) => setChatOptions((current) => ({ ...current, includeValues: event.target.checked }))}
                />
                <span><strong>Portfolio values</strong><em>{chatOptions.includeValues ? "Included" : "Excluded"}</em></span>
              </label>
              <label>
                <input
                  type="checkbox"
                  disabled={!chatOptions.includeHoldings}
                  checked={chatOptions.includeCommentary}
                  onChange={(event) => setChatOptions((current) => ({ ...current, includeCommentary: event.target.checked }))}
                />
                <span><strong>Portfolio notes</strong><em>{chatOptions.includeCommentary ? "Included" : "Excluded"}</em></span>
              </label>
            </div>
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
  scope,
  onScopeChange,
  loading,
  error,
  refreshedAt,
  onRefresh,
}: {
  quotes: MarketQuote[];
  scope: QuoteScope;
  onScopeChange: (scope: QuoteScope) => void;
  loading: boolean;
  error: string | null;
  refreshedAt: string | null;
  onRefresh: () => void;
}) {
  const visibleQuotes = quotes.filter((quote) => scope === "indices" ? quote.id.startsWith("index-") : !quote.id.startsWith("index-"));
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
          <div className="quote-scope" aria-label="Market monitor content">
            <button type="button" className={scope === "indices" ? "active" : ""} onClick={() => onScopeChange("indices")}>Major indices</button>
            <button type="button" className={scope === "portfolio" ? "active" : ""} onClick={() => onScopeChange("portfolio")}>My securities</button>
          </div>
          <button className="icon-button" type="button" onClick={onRefresh} disabled={loading} aria-label="Refresh market data" title="Refresh market data">
            <RefreshCw size={15} className={loading ? "spinning" : ""} />
          </button>
        </div>
      </div>
      {error ? <p className="market-feed-message bad">{error}</p> : null}
      <div className="market-monitor-grid" aria-live="polite" aria-busy={loading}>
        {loading && visibleQuotes.length === 0 ? Array.from({ length: scope === "indices" ? 7 : 5 }, (_, index) => (
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
        <span>{scope === "indices" ? "Select an index for its growth, debt, and Sharpe screen." : "Prices are applied to the Portfolio view; manual NOK value overrides remain intact."}</span>
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
            <dl><div><dt>Watch</dt><dd>{item.watch}</dd></div><div><dt>Portfolio lens</dt><dd>{item.relevance}</dd></div></dl>
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

function InsightFeed({ brief, limit, onViewAll }: { brief: DailyBrief; limit?: number; onViewAll: () => void }) {
  const insights = limit ? brief.insights.slice(0, limit) : brief.insights;
  return (
    <section className="insight-feed">
      <div className="section-heading">
        <div><span className="eyebrow">What changed and what to review</span><h2>Today&apos;s portfolio signals</h2></div>
        <span className="as-of">Generated {new Intl.DateTimeFormat("en-GB", { timeStyle: "short" }).format(new Date(brief.generated_at))}</span>
      </div>
      {insights.map((item, index) => (
        <article className={`insight-card ${item.severity}`} key={item.id}>
          <div className="insight-index">{String(index + 1).padStart(2, "0")}</div>
          <div className="insight-body">
            <div className="insight-title"><span>{item.kind}</span><h3>{item.title}</h3></div>
            <div className="insight-columns">
              <div><strong>Fact</strong><p>{item.fact}</p></div>
              <div><strong>Portfolio relevance</strong><p>{item.relevance}</p></div>
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
