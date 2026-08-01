"use client";

import {
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Copy,
  Info,
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
import type {
  DisplayCurrency,
  FactorKey,
  Holding,
  SavedScenario,
  Scenario,
  ShareOptions,
} from "@/lib/types";
import { ShareDialog } from "@/components/share-dialog";

const factorKeys = Object.keys(factorLabels) as FactorKey[];
const scenarioGuides: Record<string, { question: string; meaning: string; review: string }> = {
  "risk-off": {
    question: "What if investors suddenly reduce risk across global markets?",
    meaning: "Equities fall together, credit becomes less forgiving, and the US dollar strengthens against NOK.",
    review: "Use this to see whether diversification still works when several risks arrive at the same time.",
  },
  "us-tech": {
    question: "What if US technology valuations reset sharply?",
    meaning: "Technology and US equities fall more than the broader global market, while the dollar provides a small offset.",
    review: "Use this to reveal overlap between direct technology holdings and technology already owned through the S&P 500 ETF.",
  },
  "nok-strengthens": {
    question: "What if NOK strengthens while the underlying investments do not move?",
    meaning: "Foreign holdings are translated back into fewer Norwegian kroner even though their local market prices are unchanged.",
    review: "Use this to separate investment performance from the currency effect in your NOK-reported portfolio.",
  },
  "rates-up": {
    question: "What if interest rates rise by one percentage point?",
    meaning: "Bond prices are estimated using their stored duration. Equity valuation effects are not automatically guessed.",
    review: "Use this to understand the rate sensitivity of bonds you add to the portfolio, not to forecast equity markets.",
  },
  "credit-wide": {
    question: "What if company borrowing risk is repriced higher?",
    meaning: "Corporate bond spreads widen by 1.5 percentage points, affecting credit positions through their stored duration.",
    review: "Use this to test corporate-bond risk separately from government-rate risk.",
  },
  custom: {
    question: "What combination of market moves do you want to test?",
    meaning: "Start with no shock, then adjust only the assumptions you have a reason to examine.",
    review: "Use custom mode after a named test when you want to challenge one assumption at a time.",
  },
};
const darkTooltip = {
  backgroundColor: "rgba(20, 34, 27, 0.96)",
  border: "1px solid rgba(212, 175, 55, 0.5)",
  borderRadius: "5px",
  color: "#f5f0e5",
};

export function ScenarioView({
  holdings,
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
  const rows = useMemo(
    () => holdings.map((holding) => scenarioImpact(holding, scenario))
      .sort((a, b) => Math.abs(b.impactNok) - Math.abs(a.impactNok)),
    [holdings, scenario],
  );
  const total = totalValueNok(holdings);
  const impact = rows.reduce((sum, row) => sum + row.impactNok, 0);
  const impactPercent = total ? (impact / total) * 100 : 0;
  const currencies = [...new Set(rows.filter((row) => row.impactNok !== 0).map((row) => row.holding.currency))];
  const activeGuide = scenarioGuides[activePresetId] ?? scenarioGuides.custom;
  const materialImpact = Math.abs(impactPercent) >= 0.05;
  const topContributor = materialImpact ? rows.find((row) => row.impactNok < 0) ?? rows[0] ?? null : null;
  const resultSummary = !materialImpact
    ? "This test has almost no effect with the exposures currently stored in your portfolio."
    : impact < 0
      ? `Under these assumptions, the portfolio falls from ${formatMoney(total, displayCurrency)} to ${formatMoney(total + impact, displayCurrency)}.`
      : `Under these assumptions, the portfolio rises from ${formatMoney(total, displayCurrency)} to ${formatMoney(total + impact, displayCurrency)}.`;
  const beforeAfter = [
    { name: "Current", value: total },
    { name: "Scenario", value: total + impact },
  ];

  function selectPreset(id: string) {
    const preset = scenarioPresets.find((item) => item.id === id);
    if (!preset) return;
    setActivePresetId(id);
    setScenario({ ...preset.shocks });
  }

  function shareContent(options: ShareOptions) {
    return {
      summary: `${scenarioPresets.find((item) => item.id === activePresetId)?.name ?? "Custom scenario"} estimates ${formatMoney(impact, displayCurrency)} (${formatPercent(impactPercent)}) of portfolio impact.`,
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

        <section className="preset-strip" aria-label="Scenario presets">
          {scenarioPresets.map((preset) => (
            <button
              key={preset.id}
              className={activePresetId === preset.id ? "active" : ""}
              onClick={() => selectPreset(preset.id)}
            >
              <strong>{preset.name}</strong>
              <span>{scenarioGuides[preset.id]?.question ?? preset.description}</span>
            </button>
          ))}
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

        <section className="scenario-result-band">
          <article>
            <span>Estimated change</span>
            <strong className={impact >= 0 ? "good" : "bad"}>{formatMoney(impact, displayCurrency)}</strong>
            <em>{formatPercent(impactPercent)} of current value</em>
          </article>
          <article>
            <span>Estimated value after shock</span>
            <strong>{formatMoney(total + impact, displayCurrency)}</strong>
            <em>Currently {formatMoney(total, displayCurrency)}</em>
          </article>
          <article>
            <span>Main source of impact</span>
            <strong>{topContributor?.holding.ticker ?? topContributor?.holding.name ?? "None"}</strong>
            <em>{topContributor ? formatMoney(topContributor.impactNok, displayCurrency) : "No active exposure"}</em>
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
              <CartesianGrid stroke="rgba(214, 180, 91, 0.16)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#acb9ae", fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat("nb-NO", { notation: "compact" }).format(Number(value))} />
              <YAxis dataKey="name" type="category" width={70} tick={{ fill: "#d8dfd6", fontSize: 10 }} />
              <Tooltip contentStyle={darkTooltip} formatter={(value) => formatMoney(Number(value), displayCurrency)} />
              <Bar dataKey="impact" radius={3}>
                {rows.map((row) => <Cell key={row.holding.id} fill={row.impactNok >= 0 ? "#78b88c" : "#d07c62"} />)}
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
              <CartesianGrid stroke="rgba(214, 180, 91, 0.16)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#d8dfd6", fontSize: 10 }} />
              <YAxis tick={{ fill: "#acb9ae", fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat("nb-NO", { notation: "compact" }).format(Number(value))} />
              <Tooltip contentStyle={darkTooltip} formatter={(value) => formatMoney(Number(value), displayCurrency)} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                <Cell fill="#d4af37" /><Cell fill={impact >= 0 ? "#78b88c" : "#d07c62"} />
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
                    <td>{formatMoney(row.value, displayCurrency)}</td>
                    <td className={row.impactNok >= 0 ? "good" : "bad"}>{formatMoney(row.impactNok, displayCurrency)}</td>
                    <td>{formatMoney(row.postValue, displayCurrency)}</td>
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
                const savedImpact = holdings.reduce((sum, holding) => sum + scenarioImpact(holding, saved.shocks).impactNok, 0);
                return (
                  <article key={saved.id}>
                    <div><strong>{saved.name}</strong><span>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(saved.created_at))}</span></div>
                    <strong className={savedImpact >= 0 ? "good" : "bad"}>{formatMoney(savedImpact, displayCurrency)}</strong>
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
