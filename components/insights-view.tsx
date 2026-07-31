"use client";

import {
  ArrowUpRight,
  Check,
  Clipboard,
  FileSearch,
  Link2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import { buildChatGptPacket, redactHoldingIdentities } from "@/lib/insights";
import { formatMoney, holdingValueNok } from "@/lib/calculations";
import type { DailyBrief, Holding, ShareOptions } from "@/lib/types";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { ShareDialog } from "@/components/share-dialog";

export function InsightsView({
  brief,
  holdings,
}: {
  brief: DailyBrief;
  holdings: Holding[];
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatOptions, setChatOptions] = useState({
    includeHoldings: false,
    includeValues: false,
    includeCommentary: false,
  });
  const [copied, setCopied] = useState(false);
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
      <div className="insights-layout">
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
