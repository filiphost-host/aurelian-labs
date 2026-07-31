"use client";

import {
  ArrowUpRight,
  Check,
  Clipboard,
  Compass,
  FileSearch,
  Link2,
  MapPinned,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useState } from "react";
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
import type { DailyBrief, Holding, ShareOptions } from "@/lib/types";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { ShareDialog } from "@/components/share-dialog";

type DeskFocus = "core" | "us" | "europe" | "discover";

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
  onOpenMarket,
}: {
  brief: DailyBrief;
  holdings: Holding[];
  onOpenMarket: (country: string) => void;
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
  const attention = brief.insights.filter((item) => item.severity === "attention").length;
  const sourced = brief.insights.filter((item) => item.source_url).length;

  async function analyzeInChatGpt() {
    const packet = buildChatGptPacket(brief, holdings, chatOptions);
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
            valueNok: options.includeValues ? holdingValueNok(holding) : undefined,
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

        <section className="brief-stats" aria-label="Brief status">
          <article>
            <TriangleAlert size={17} />
            <span>Needs attention</span>
            <strong>{attention}</strong>
          </article>
          <article>
            <FileSearch size={17} />
            <span>Linked sources</span>
            <strong>{sourced}</strong>
          </article>
          <article>
            <ShieldCheck size={17} />
            <span>Automatic advice</span>
            <strong>Off</strong>
          </article>
        </section>

        <section className="market-desk wide" aria-labelledby="market-desk-title">
          <div className="section-heading">
            <div><span className="eyebrow">Geographic research desk</span><h2 id="market-desk-title">Daily focus and market discovery</h2></div>
            <div className="desk-focus" aria-label="Market desk focus">
              {([
                ["core", "US & Europe"], ["us", "United States"], ["europe", "Europe"], ["discover", "Discover"],
              ] as Array<[DeskFocus, string]>).map(([id, label]) => (
                <button key={id} type="button" className={deskFocus === id ? "active" : ""} onClick={() => setDeskFocus(id)}>{label}</button>
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

        <InvestorComparison />

        <section className="insight-feed">
          <div className="section-heading">
            <div>
              <span className="eyebrow">What changed and what to review</span>
              <h2>Today&apos;s portfolio signals</h2>
            </div>
            <span className="as-of">Generated {new Intl.DateTimeFormat("en-GB", { timeStyle: "short" }).format(new Date(brief.generated_at))}</span>
          </div>

          {brief.insights.map((item, index) => (
            <article className={`insight-card ${item.severity}`} key={item.id}>
              <div className="insight-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="insight-body">
                <div className="insight-title">
                  <span>{item.kind}</span>
                  <h3>{item.title}</h3>
                </div>
                <div className="insight-columns">
                  <div><strong>Fact</strong><p>{item.fact}</p></div>
                  <div><strong>Portfolio relevance</strong><p>{item.relevance}</p></div>
                  <div><strong>Possible scenario</strong><p>{item.scenario}</p></div>
                </div>
                <footer>
                  {item.source_url ? (
                    <a href={item.source_url} target="_blank" rel="noreferrer">
                      {item.source} <ArrowUpRight size={13} />
                    </a>
                  ) : <span>{item.source}</span>}
                  <span>As of {item.as_of}</span>
                </footer>
              </div>
            </article>
          ))}
        </section>

        <section className="panel wide data-ledger">
          <div className="section-heading">
            <div><span className="eyebrow">Provenance ledger</span><h2>Values behind this brief</h2></div>
          </div>
          <div className="data-ledger-grid">
            {holdings.map((holding) => (
              <article key={holding.id}>
                <div>
                  <strong>{holding.ticker ?? holding.name}</strong>
                  <span>{formatMoney(holdingValueNok(holding))}</span>
                </div>
                <ProvenanceBadge provenance={holding.price_provenance} />
              </article>
            ))}
          </div>
        </section>
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
              <PolarGrid stroke="rgba(214, 180, 91, 0.22)" />
              <PolarAngleAxis dataKey="axis" tick={{ fill: "#c5d0c7", fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name={leftProfile.name} dataKey="left" stroke={leftProfile.color} fill={leftProfile.color} fillOpacity={0.2} strokeWidth={2} />
              <Radar name={rightProfile.name} dataKey="right" stroke={rightProfile.color} fill={rightProfile.color} fillOpacity={0.16} strokeWidth={2} />
              <Legend wrapperStyle={{ color: "#dce3dc", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#14221b", border: "1px solid rgba(212, 175, 55, 0.45)", color: "#f5f0e5" }} />
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
