"use client";

import {
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Copy,
  Gauge,
  Info,
  Landmark,
  Link2,
  MousePointerClick,
  RotateCcw,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  factorLabels,
  factorUnits,
  formatMoney,
  formatPercent,
  formatShock,
  scenarioImpact,
  totalValueNok,
} from "@/lib/calculations";
import { scenarioPresets } from "@/lib/sample-data";
import {
  scenarioCategories,
  scenarioGuides,
  type ScenarioCategory,
} from "@/lib/scenario-research";
import { rankModelPortfolios } from "@/lib/scenario-portfolios";
import type {
  DisplayCurrency,
  FactorKey,
  Holding,
  LedgerPosition,
  SavedScenario,
  Scenario,
  ShareOptions,
} from "@/lib/types";
import type { BenchmarkPricePoint } from "@/lib/portfolio-story";
import { ShareDialog } from "@/components/share-dialog";
import { TimeMachinePanel } from "@/components/time-machine-panel";
import { ProjectionPanel } from "@/components/projection-panel";

const factorKeys = Object.keys(factorLabels) as FactorKey[];
const darkTooltip = {
  backgroundColor: "rgba(14, 13, 15, 0.97)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: "5px",
  color: "#f4f1ef",
};

export function ScenarioView({
  holdings,
  positions,
  benchmarkPrices,
  fxRates,
  displayCurrency,
  scenario,
  setScenario,
  activePresetId,
  setActivePresetId,
  savedScenarios,
  onSaveScenario,
  onDeleteScenario,
}: {
  holdings: Holding[];
  positions: LedgerPosition[];
  benchmarkPrices: BenchmarkPricePoint[];
  fxRates: Record<string, number>;
  displayCurrency: DisplayCurrency;
  scenario: Scenario;
  setScenario: (scenario: Scenario) => void;
  activePresetId: string;
  setActivePresetId: (id: string) => void;
  savedScenarios: SavedScenario[];
  onSaveScenario: (scenario: SavedScenario) => void;
  onDeleteScenario: (id: string) => void;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioCategory, setScenarioCategory] = useState<ScenarioCategory>(
    scenarioGuides[activePresetId]?.category ?? "Macro",
  );
  const rows = useMemo(
    () => holdings.map((holding) => scenarioImpact(holding, scenario, fxRates))
      .sort((a, b) => Math.abs(b.impactNok) - Math.abs(a.impactNok)),
    [fxRates, holdings, scenario],
  );
  const total = totalValueNok(holdings, fxRates);
  const impact = rows.reduce((sum, row) => sum + row.impactNok, 0);
  const impactPercent = total ? (impact / total) * 100 : 0;
  const currencies = [...new Set(rows.filter((row) => row.impactNok !== 0).map((row) => row.holding.currency))];
  const activeGuide = scenarioGuides[activePresetId] ?? scenarioGuides.custom;
  const visiblePresets = scenarioPresets.filter(
    (preset) => (scenarioGuides[preset.id] ?? scenarioGuides.custom).category === scenarioCategory,
  );
  const portfolioOverlap = holdings.filter((holding) => {
    const ticker = holding.ticker?.toUpperCase() ?? "";
    return activeGuide.directTickers.includes(ticker);
  });
  const materialImpact = Math.abs(impactPercent) >= 0.05;
  const topContributor = materialImpact ? rows.find((row) => row.impactNok < 0) ?? rows[0] ?? null : null;
  const resultSummary = !materialImpact
    ? "This test has almost no effect with the exposures currently stored in your portfolio."
    : impact < 0
      ? `Under these assumptions, the portfolio falls from ${formatMoney(total, displayCurrency, fxRates)} to ${formatMoney(total + impact, displayCurrency, fxRates)}.`
      : `Under these assumptions, the portfolio rises from ${formatMoney(total, displayCurrency, fxRates)} to ${formatMoney(total + impact, displayCurrency, fxRates)}.`;
  const beforeAfter = [
    { name: "Current", value: total },
    { name: "Scenario", value: total + impact },
  ];
  const portfolioRanking = useMemo(() => rankModelPortfolios(scenario), [scenario]);
  const scenarioLeader = portfolioRanking[0];

  function selectPreset(id: string) {
    const preset = scenarioPresets.find((item) => item.id === id);
    if (!preset) return;
    setActivePresetId(id);
    setScenarioCategory((scenarioGuides[id] ?? scenarioGuides.custom).category);
    setScenario({ ...preset.shocks });
  }

  function shareContent(options: ShareOptions) {
    return {
      summary: `${scenarioPresets.find((item) => item.id === activePresetId)?.name ?? "Custom scenario"} estimates ${formatMoney(impact, displayCurrency, fxRates)} (${formatPercent(impactPercent)}) of portfolio impact.`,
      scenario,
      assumptions: "Linear factor estimate. Interest-rate and credit shocks are expressed in basis points.",
      contributors: options.includeHoldings
        ? rows.map((row) => ({
            holding: row.holding.name,
            ticker: row.holding.ticker,
            currentValue: options.includeValues ? row.value : undefined,
            impact: options.includeValues ? row.impactNok : undefined,
            impactPercent: row.impactPercent,
            assumptions: options.includeCommentary ? row.assumptions : undefined,
          }))
        : undefined,
    };
  }

  return (
    <>
      <div className="scenario-layout scenario-workbench">
        <section className="scenario-toolbar">
          <div>
            <span className="eyebrow">Understand portfolio vulnerability</span>
            <h2>Portfolio stress test</h2>
            <p>Test a difficult situation before it happens. This is an estimate, not a forecast.</p>
          </div>
          <div className="scenario-actions">
            <button className="ghost-button" onClick={() => selectPreset("custom")}><RotateCcw size={15} /> Reset</button>
            <button className="ghost-button" onClick={() => setSaveOpen(true)}><Save size={15} /> Save</button>
            <button className="primary-button" onClick={() => setShareOpen(true)}><Link2 size={15} /> Share</button>
          </div>
        </section>

        <TimeMachinePanel
          positions={positions}
          benchmarkPrices={benchmarkPrices}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
        />

        <ProjectionPanel
          startValueNok={positions.reduce((sum, position) => sum + Math.max(0, position.marketValueNok), 0)}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
        />

        <section className="scenario-how-to" aria-labelledby="scenario-how-title">
          <div className="scenario-how-heading">
            <CircleHelp size={19} />
            <div><span className="eyebrow">How to use this</span><h2 id="scenario-how-title">Ask one uncomfortable question</h2></div>
          </div>
          <ol>
            <li><span>1</span><div><strong>Choose a situation</strong><p>Pick the market event you actually want to understand.</p></div></li>
            <li><span>2</span><div><strong>Find the weak point</strong><p>Read the estimated impact and the position driving it.</p></div></li>
            <li><span>3</span><div><strong>Review, do not predict</strong><p>Use the result to question concentration and assumptions.</p></div></li>
          </ol>
        </section>

        <section className="scenario-library" aria-labelledby="scenario-library-title">
          <div className="scenario-library-heading">
            <div><span className="eyebrow">S&amp;P 500 scenario library</span><h2 id="scenario-library-title">Choose the pressure you want to understand</h2></div>
            <span>{scenarioPresets.length - 1} named tests</span>
          </div>
          <div className="scenario-category-tabs" role="tablist" aria-label="Scenario categories">
            {scenarioCategories.map((category) => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={scenarioCategory === category}
                className={scenarioCategory === category ? "active" : ""}
                onClick={() => setScenarioCategory(category)}
              >{category}</button>
            ))}
          </div>
          <div key={scenarioCategory} className="preset-strip" aria-label={`${scenarioCategory} scenarios`}>
            {visiblePresets.map((preset) => (
              <button
                key={preset.id}
                className={activePresetId === preset.id ? "active" : ""}
                onClick={() => selectPreset(preset.id)}
              >
                <strong>{preset.name}</strong>
                <span>{preset.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="scenario-question-card">
          <div className="scenario-question-copy">
            <span className="eyebrow">Question being tested</span>
            <h2>{activeGuide.question}</h2>
            <p>{activeGuide.meaning}</p>
          </div>
          <div className="scenario-purpose">
            <MousePointerClick size={18} />
            <span>What this helps you understand</span>
            <p>{activeGuide.review}</p>
          </div>
        </section>

        <section className="scenario-portfolio-lab" aria-labelledby="portfolio-lab-title">
          <div className="scenario-section-heading">
            <div>
              <span className="eyebrow">Portfolio laboratory</span>
              <h2 id="portfolio-lab-title">Which construction holds up best?</h2>
            </div>
            <span>Ranked by estimated post-shock Sharpe</span>
          </div>
          <div className="scenario-leader-row">
            <article>
              <span>Model leader</span>
              <strong>{scenarioLeader.name}</strong>
              <p>{scenarioLeader.mandate}</p>
            </article>
            <article>
              <span>Post-shock Sharpe</span>
              <strong>{scenarioLeader.postShockSharpe.toFixed(2)}</strong>
              <p>{scenarioLeader.shockReturn >= 0 ? "+" : ""}{scenarioLeader.shockReturn.toFixed(1)}% modeled shock return</p>
            </article>
            <article>
              <span>Valuation profile</span>
              <strong>{scenarioLeader.pe.toFixed(1)}x P/E</strong>
              <p>{scenarioLeader.peg.toFixed(2)} PEG · {scenarioLeader.priceToBook.toFixed(1)}x book</p>
            </article>
          </div>
          <div className="scenario-portfolio-grid">
            <div className="scenario-ranking-chart">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart layout="vertical" data={portfolioRanking} margin={{ left: 12, right: 42 }}>
                  <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#7f7a7d", fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={126} tick={{ fill: "#d7d3d1", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={darkTooltip}
                    formatter={(value) => Number(value).toFixed(2)}
                    labelFormatter={(label) => `${label} · post-shock Sharpe`}
                  />
                  <Bar dataKey="postShockSharpe" radius={[0, 3, 3, 0]}>
                    {portfolioRanking.map((portfolio, index) => (
                      <Cell key={portfolio.id} fill={index === 0 ? "#d4af37" : portfolio.postShockSharpe >= 0 ? "#4f9d78" : "#b65f69"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="table-wrap scenario-portfolio-table">
              <table>
                <thead><tr><th>Portfolio</th><th>Shock</th><th>Sharpe</th><th>P/E</th><th>PEG</th><th>P/B</th><th>Debt</th></tr></thead>
                <tbody>{portfolioRanking.map((portfolio, index) => (
                  <tr key={portfolio.id}>
                    <td><strong>#{index + 1} {portfolio.name}</strong><span>{portfolio.mandate}</span></td>
                    <td className={portfolio.shockReturn >= 0 ? "good" : "bad"}>{portfolio.shockReturn >= 0 ? "+" : ""}{portfolio.shockReturn.toFixed(1)}%</td>
                    <td><strong>{portfolio.postShockSharpe.toFixed(2)}</strong><span>was {portfolio.sharpe.toFixed(2)}</span></td>
                    <td>{portfolio.pe.toFixed(1)}x</td>
                    <td>{portfolio.peg.toFixed(2)}</td>
                    <td>{portfolio.priceToBook.toFixed(1)}x</td>
                    <td>{portfolio.netDebtToEbitda.toFixed(1)}x</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <p className="panel-note">Comparative teaching model using fixed factor sensitivities and a 3.5% risk-free assumption. It is useful for examining portfolio construction, not forecasting the winning strategy.</p>
        </section>

        <section className="scenario-transmission" aria-labelledby="transmission-title">
          <div className="scenario-section-heading">
            <div><span className="eyebrow">How the shock travels</span><h2 id="transmission-title">From event to S&amp;P 500 earnings</h2></div>
            <span>Linear teaching model</span>
          </div>
          <div className="transmission-chain">
            <article><Landmark size={17} /><span>Trigger</span><strong>{activeGuide.trigger}</strong></article>
            {activeGuide.transmission.map((step) => (
              <div className="transmission-step" key={step}><ArrowRight size={15} /><article><span>Transmission</span><strong>{step}</strong></article></div>
            ))}
          </div>
          <div className="scenario-exposure-grid">
            <article>
              <span className="scenario-exposure-label bad"><Gauge size={14} /> Likely pressure</span>
              <ul>{activeGuide.pressure.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article>
              <span className="scenario-exposure-label good"><ShieldAlert size={14} /> Possible resilience</span>
              <ul>{activeGuide.support.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
            <article>
              <span className="scenario-exposure-label"><Building2 size={14} /> Your portfolio overlap</span>
              {portfolioOverlap.length ? <div className="scenario-overlap-list">{portfolioOverlap.map((holding) => (
                <span key={holding.id}>{holding.ticker ?? holding.name}</span>
              ))}</div> : <p>No direct holding is tagged for this channel. SXR8 may still carry broad index exposure.</p>}
            </article>
          </div>
        </section>

        {activeGuide.companies.length ? <section className="scenario-company-screen" aria-labelledby="company-screen-title">
          <div className="scenario-section-heading">
            <div><span className="eyebrow">Companies to investigate</span><h2 id="company-screen-title">S&amp;P 500 sensitivity screen</h2></div>
            <span>Qualitative, not a ranking</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Company</th><th>Sensitivity</th><th>Balance-sheet lens</th><th>Why this scenario matters</th></tr></thead>
              <tbody>{activeGuide.companies.map((company) => (
                <tr key={company.ticker}>
                  <td><strong>{company.ticker}</strong><span>{company.name}</span></td>
                  <td><span className={`sensitivity-pill ${company.sensitivity.toLowerCase()}`}>{company.sensitivity}</span></td>
                  <td>{company.balanceSheet}</td>
                  <td>{company.channel}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="scenario-watchlist">
            <strong>Evidence to watch</strong>
            {activeGuide.watch.map((item) => <span key={item}>{item}</span>)}
          </div>
          <p className="panel-note">The debt labels are analytical screening classifications, not live debt figures. Verify current leverage, maturity schedules, index membership, and filings before drawing a conclusion.</p>
        </section> : null}

        <section className="scenario-result-band">
          <article>
            <span>Estimated change</span>
            <strong className={impact >= 0 ? "good" : "bad"}>{formatMoney(impact, displayCurrency, fxRates)}</strong>
            <em>{formatPercent(impactPercent)} of current value</em>
          </article>
          <article>
            <span>Estimated value after shock</span>
            <strong>{formatMoney(total + impact, displayCurrency, fxRates)}</strong>
            <em>Currently {formatMoney(total, displayCurrency, fxRates)}</em>
          </article>
          <article>
            <span>Main source of impact</span>
            <strong>{topContributor?.holding.ticker ?? topContributor?.holding.name ?? "None"}</strong>
            <em>{topContributor ? formatMoney(topContributor.impactNok, displayCurrency, fxRates) : "No active exposure"}</em>
          </article>
        </section>

        <section className="scenario-interpretation">
          <div className="scenario-verdict">
            <ShieldAlert size={21} />
            <div><span className="eyebrow">What the result says</span><h2>{resultSummary}</h2></div>
          </div>
          <div className="scenario-reading-grid">
            <article>
              <span>Review first</span>
              <strong>{topContributor?.holding.name ?? "No position identified"}</strong>
              <p>{topContributor
                ? `${formatPercent(topContributor.impactPercent)} estimated position impact. Check whether its factor exposures and portfolio weight reflect how you think about the holding.`
                : "Add holdings and factor exposures before interpreting this test."}</p>
            </article>
            <article>
              <span>Model coverage</span>
              <strong>{rows.filter((row) => row.assumptions.length > 0).length} of {rows.length} positions respond</strong>
              <p>{currencies.length ? `The active assumptions affect ${currencies.join(", ")} positions.` : "No currencies or holdings respond to the active assumptions."}</p>
            </article>
            <article>
              <span>Do not conclude</span>
              <strong>This will happen</strong>
              <p>The test does not estimate probability, timing, trading liquidity, changing correlations, or investor behaviour.</p>
            </article>
          </div>
        </section>

        <button className={`scenario-details-trigger${modelOpen ? " open" : ""}`} type="button" onClick={() => setModelOpen((current) => !current)} aria-expanded={modelOpen}>
          <div><SlidersHorizontal size={18} /><span><strong>{modelOpen ? "Hide model details" : "Adjust assumptions and inspect the model"}</strong><small>Factor sliders, contribution chart, and per-holding calculations</small></span></div>
          {modelOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {modelOpen ? <section className="panel factor-panel">
          <div className="panel-title-row">
            <div><span className="eyebrow">Editable assumptions</span><h2>Factor shocks</h2></div>
            <SlidersHorizontal size={20} />
          </div>
          <div className="slider-list">
            {factorKeys.map((key) => {
              const isBps = factorUnits[key] === "bps";
              return (
                <label key={key}>
                  <span>{factorLabels[key]}</span>
                  <strong>{formatShock(key, scenario[key])}</strong>
                  <input
                    type="range"
                    min={isBps ? -300 : -40}
                    max={isBps ? 500 : 40}
                    step={isBps ? 25 : 0.5}
                    value={scenario[key]}
                    onChange={(event) => {
                      setActivePresetId("custom");
                      setScenario({ ...scenario, [key]: Number(event.target.value) });
                    }}
                  />
                </label>
              );
            })}
          </div>
        </section> : null}

        {modelOpen ? <section className="panel contribution-panel">
          <div className="panel-title-row">
            <div><span className="eyebrow">Waterfall by position</span><h2>Impact contributors</h2></div>
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              layout="vertical"
              data={rows.map((row) => ({
                name: row.holding.ticker || row.holding.name,
                impact: row.impactNok,
              }))}
              margin={{ left: 8, right: 54 }}
            >
              <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#7f7a7d", fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat("nb-NO", { notation: "compact" }).format(Number(value))} />
              <YAxis dataKey="name" type="category" width={70} tick={{ fill: "#d7d3d1", fontSize: 10 }} />
              <Tooltip contentStyle={darkTooltip} formatter={(value) => formatMoney(Number(value), displayCurrency, fxRates)} />
              <Bar dataKey="impact" radius={3}>
                {rows.map((row) => <Cell key={row.holding.id} fill={row.impactNok >= 0 ? "#4f9d78" : "#b65f69"} />)}
                <LabelList
                  dataKey="impact"
                  position="right"
                  formatter={(value: unknown) => new Intl.NumberFormat("nb-NO", { notation: "compact" }).format(Number(value))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section> : null}

        {modelOpen ? <section className="panel before-after-panel">
          <div className="panel-title-row">
            <div><span className="eyebrow">Before and after</span><h2>Portfolio value</h2></div>
          </div>
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={beforeAfter}>
              <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#d7d3d1", fontSize: 10 }} />
              <YAxis tick={{ fill: "#7f7a7d", fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat("nb-NO", { notation: "compact" }).format(Number(value))} />
              <Tooltip contentStyle={darkTooltip} formatter={(value) => formatMoney(Number(value), displayCurrency, fxRates)} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                <Cell fill="#767276" /><Cell fill={impact >= 0 ? "#4f9d78" : "#b65f69"} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section> : null}

        {modelOpen ? <section className="panel wide">
          <div className="panel-title-row">
            <div><span className="eyebrow">Transparent model</span><h2>Holding assumptions</h2></div>
            <Info size={19} />
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Holding</th><th>Current</th><th>Impact</th><th>Post-scenario</th><th>Assumptions used</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.holding.id}>
                    <td><strong>{row.holding.name}</strong><span>{formatPercent(row.impactPercent)}</span></td>
                    <td>{formatMoney(row.value, displayCurrency, fxRates)}</td>
                    <td className={row.impactNok >= 0 ? "good" : "bad"}>{formatMoney(row.impactNok, displayCurrency, fxRates)}</td>
                    <td>{formatMoney(row.postValue, displayCurrency, fxRates)}</td>
                    <td>{row.assumptions.length ? row.assumptions.join(" · ") : "No active factor exposure"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            Educational linear estimate. It does not model changing correlations, volatility, liquidity, taxes, or second-order effects.
          </p>
        </section> : null}

        <section className="panel wide">
          <div className="panel-title-row">
            <div><span className="eyebrow">Reusable work</span><h2>Saved scenarios</h2></div>
          </div>
          {savedScenarios.length ? (
            <div className="saved-scenario-list">
              {savedScenarios.map((saved) => {
                const savedImpact = holdings.reduce((sum, holding) => sum + scenarioImpact(holding, saved.shocks, fxRates).impactNok, 0);
                return (
                  <article key={saved.id}>
                    <div><strong>{saved.name}</strong><span>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(saved.created_at))}</span></div>
                    <strong className={savedImpact >= 0 ? "good" : "bad"}>{formatMoney(savedImpact, displayCurrency, fxRates)}</strong>
                    <button className="icon-button" title="Load a copy" onClick={() => {
                      setScenario({ ...saved.shocks });
                      setActivePresetId("custom");
                    }}><Copy size={15} /></button>
                    <button className="icon-button danger" title="Delete scenario" onClick={() => onDeleteScenario(saved.id)}><Trash2 size={15} /></button>
                  </article>
                );
              })}
            </div>
          ) : <div className="empty-state">Save a scenario to compare it with future portfolio changes.</div>}
        </section>
      </div>

      {saveOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setSaveOpen(false);
        }}>
          <section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="save-scenario-title">
            <div className="modal-heading">
              <div><span className="eyebrow">Reusable stress test</span><h2 id="save-scenario-title">Save scenario</h2></div>
              <button className="icon-button" onClick={() => setSaveOpen(false)} aria-label="Close save dialog"><X size={17} /></button>
            </div>
            <label className="field"><span>Name</span><input autoFocus value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} placeholder="e.g. My cautious case" /></label>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setSaveOpen(false)}>Cancel</button>
              <button className="primary-button" disabled={!scenarioName.trim()} onClick={() => {
                onSaveScenario({ id: crypto.randomUUID(), name: scenarioName.trim(), shocks: { ...scenario }, created_at: new Date().toISOString() });
                setScenarioName("");
                setSaveOpen(false);
              }}><Save size={15} /> Save</button>
            </div>
          </section>
        </div>
      ) : null}

      {shareOpen ? (
        <ShareDialog
          title={`${scenarioPresets.find((item) => item.id === activePresetId)?.name ?? "Custom scenario"} · Aurelian Labs`}
          kind="scenario"
          content={shareContent}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </>
  );
}
