"use client";

import {
  ArrowRight, Check, ChevronDown, ChevronUp, Copy, Equal, Info, Landmark,
  Link2, Plus, RotateCcw, Save, ShieldAlert, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  factorLabels, factorUnits, formatMoney, formatPercent, formatShock,
  holdingValueNok, scenarioImpact, totalValueNok,
} from "@/lib/calculations";
import { scenarioPresets } from "@/lib/sample-data";
import { scenarioCategories, scenarioGuides, type ScenarioCategory } from "@/lib/scenario-research";
import {
  buildStressHoldings, normalizedAllocations, rebalanceAllocation, stressInstrumentLibrary,
  type AtlasScenarioHandoff, type StressAllocation,
} from "@/lib/stress-portfolio";
import type {
  AssetType, DisplayCurrency, FactorKey,
  SavedScenario, Scenario, ShareOptions,
} from "@/lib/types";
import {
  buildScenarioTimeline, type ScenarioTimelinePoint, type TimelineStressEvent,
} from "@/lib/scenario-timeline";
import { ShareDialog } from "@/components/share-dialog";
import { CompanyMark } from "@/components/company-mark";

const factorKeys = Object.keys(factorLabels) as FactorKey[];
const darkTooltip = {
  backgroundColor: "rgba(14, 13, 15, 0.97)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: "4px",
  color: "#f4f1ef",
};
type InstrumentFilter = "all" | Exclude<AssetType, "cash">;

type HistoricalTimelineEvent = Omit<TimelineStressEvent, "impactPercent"> & { shocks: Scenario };

const historicalTimelineEvents: HistoricalTimelineEvent[] = [
  {
    id: "dot-com", name: "Technology Bubble Unwinds", shortLabel: "2000 Tech", date: "2000-10", recoveryMonths: 42,
    recap: "Unprofitable technology valuations reset, capital dried up, and the shock spread through a highly concentrated growth market.",
    shocks: { globalEquity: -18, usEquity: -12, europeEquity: -9, technology: -42, industrials: -7, defense: 1, usdNok: 8, nokEur: -3, rates: -100, credit: 160, cash: 0 },
  },
  {
    id: "gfc", name: "2008 Financial Crisis", shortLabel: "2008 GFC", date: "2008-10", recoveryMonths: 34,
    recap: "Housing losses, bank failures, forced deleveraging, and a global credit contraction drove a deep equity drawdown.",
    shocks: { globalEquity: -32, usEquity: -8, europeEquity: -11, technology: -5, industrials: -13, defense: 2, usdNok: 19, nokEur: -8, rates: -250, credit: 350, cash: 0 },
  },
  {
    id: "euro-crisis", name: "Euro-area Sovereign Crisis", shortLabel: "2011 Euro", date: "2011-09", recoveryMonths: 24,
    recap: "Sovereign funding stress weakened European banks, widened peripheral spreads, and raised redenomination fears.",
    shocks: { globalEquity: -10, usEquity: -4, europeEquity: -24, technology: -4, industrials: -11, defense: -2, usdNok: 9, nokEur: -12, rates: -75, credit: 220, cash: 0 },
  },
  {
    id: "oil-collapse", name: "Oil Price Collapse", shortLabel: "2015 Oil", date: "2015-01", recoveryMonths: 22,
    recap: "Surging supply and weakening demand cut oil prices, energy earnings, capital spending, and oil-linked currencies.",
    shocks: { globalEquity: -5, usEquity: -2, europeEquity: -4, technology: 1, industrials: -9, defense: 0, usdNok: 14, nokEur: -7, rates: -50, credit: 120, cash: 0 },
  },
  {
    id: "covid", name: "COVID-19 Shock", shortLabel: "2020 COVID", date: "2020-03", recoveryMonths: 10,
    recap: "Lockdowns stopped activity, markets repriced abruptly, and extraordinary policy support accelerated the recovery.",
    shocks: { globalEquity: -24, usEquity: -7, europeEquity: -10, technology: 2, industrials: -16, defense: -3, usdNok: 15, nokEur: -6, rates: -150, credit: 240, cash: 0 },
  },
  {
    id: "rates-2022", name: "2022 Rate Reset", shortLabel: "2022 Rates", date: "2022-10", recoveryMonths: 22,
    recap: "Inflation forced rapid tightening, compressing long-duration valuations and pressuring government and corporate bonds.",
    shocks: { globalEquity: -12, usEquity: -5, europeEquity: -7, technology: -18, industrials: -3, defense: 4, usdNok: 12, nokEur: -4, rates: 250, credit: 90, cash: 0 },
  },
];

function eventTimestamp(date: string) {
  const [year, month] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, 1);
}

function initialAllocations(): StressAllocation[] {
  return [
    { instrumentId: "lab-sxr8", weight: 60 },
    { instrumentId: "lab-msft", weight: 15 },
    { instrumentId: "lab-nvda", weight: 10 },
    { instrumentId: "lab-treasury", weight: 15 },
  ];
}

export function ScenarioView({
  fxRates, displayCurrency, scenario, setScenario, activePresetId,
  setActivePresetId, savedScenarios, onSaveScenario, onDeleteScenario,
  atlasHandoff, onReturnToAtlas,
}: {
  fxRates: Record<string, number>;
  displayCurrency: DisplayCurrency;
  scenario: Scenario;
  setScenario: (scenario: Scenario) => void;
  activePresetId: string;
  setActivePresetId: (id: string) => void;
  savedScenarios: SavedScenario[];
  onSaveScenario: (scenario: SavedScenario) => void;
  onDeleteScenario: (id: string) => void;
  atlasHandoff: AtlasScenarioHandoff | null;
  onReturnToAtlas: () => void;
}) {
  const [capitalNok, setCapitalNok] = useState(100_000);
  const [allocations, setAllocations] = useState<StressAllocation[]>(() => atlasHandoff?.instrumentIds.length
    ? normalizedAllocations(atlasHandoff.instrumentIds.map((instrumentId) => ({ instrumentId, weight: 1 })))
    : initialAllocations());
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentFilter>("all");
  const [weightDrafts, setWeightDrafts] = useState<Record<string, string>>({});
  const [scenarioCategory, setScenarioCategory] = useState<ScenarioCategory>(scenarioGuides[activePresetId]?.category ?? "Macro");
  const [modelOpen, setModelOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [timelineEventIds, setTimelineEventIds] = useState<Set<string>>(() => new Set(["gfc", "covid"]));
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [resultsOpen, setResultsOpen] = useState(false);
  const capitalDisplayRate = displayCurrency === "EUR" ? (fxRates.EUR || 11.8) : 1;
  const displayedCapital = Number((capitalNok / capitalDisplayRate).toFixed(2));

  const instruments = stressInstrumentLibrary;
  const selectedIds = new Set(allocations.map((allocation) => allocation.instrumentId));
  const normalized = normalizedAllocations(allocations);
  const stressHoldings = useMemo(
    () => buildStressHoldings(instruments, allocations, capitalNok),
    [allocations, capitalNok, instruments],
  );
  const rows = useMemo(
    () => stressHoldings.map((holding) => scenarioImpact(holding, scenario, fxRates))
      .sort((a, b) => Math.abs(b.impactNok) - Math.abs(a.impactNok)),
    [fxRates, scenario, stressHoldings],
  );
  const total = totalValueNok(stressHoldings, fxRates);
  const impact = rows.reduce((sum, row) => sum + row.impactNok, 0);
  const impactPercent = total ? impact / total * 100 : 0;
  const selectedTimelineEvents = useMemo<TimelineStressEvent[]>(() => {
    const historical = historicalTimelineEvents
      .filter((event) => timelineEventIds.has(event.id))
      .map((event) => {
        const eventImpact = stressHoldings.reduce(
          (sum, holding) => sum + scenarioImpact(holding, event.shocks, fxRates).impactNok,
          0,
        );
        return { ...event, impactPercent: total ? eventImpact / total * 100 : 0 };
      });
    const current = Math.abs(impactPercent) < 0.01 ? [] : [{
      id: "current-scenario",
      name: activePresetId === "custom" ? "Current custom scenario" : (scenarioPresets.find((preset) => preset.id === activePresetId)?.name ?? "Current scenario"),
      shortLabel: "Current",
      date: "2026-08",
      impactPercent,
      recoveryMonths: 18,
      recap: activePresetId === "custom"
        ? "The portfolio path reflects the factor assumptions currently set in Scenario Lab."
        : (scenarioPresets.find((preset) => preset.id === activePresetId)?.description ?? "The active Scenario Lab assumptions are applied here."),
    }];
    return [...historical, ...current];
  }, [activePresetId, fxRates, impactPercent, stressHoldings, timelineEventIds, total]);
  const timelineData = useMemo(
    () => buildScenarioTimeline(100, selectedTimelineEvents),
    [selectedTimelineEvents],
  );
  const topContributor = rows.find((row) => row.impactNok < 0) ?? rows[0] ?? null;
  const activeGuide = scenarioGuides[activePresetId] ?? scenarioGuides.custom;
  const activePreset = scenarioPresets.find((preset) => preset.id === activePresetId);
  const visiblePresets = scenarioPresets.filter((preset) =>
    preset.id !== "custom" && (scenarioGuides[preset.id] ?? scenarioGuides.custom).category === scenarioCategory,
  );
  const filteredInstruments = instruments.filter((instrument) =>
    instrumentFilter === "all" || instrument.assetType === instrumentFilter,
  );
  const assetMix = (["stock", "etf", "bond"] as const).map((assetType) => ({
    assetType,
    weight: stressHoldings.filter((holding) => holding.asset_type === assetType)
      .reduce((sum, holding) => sum + holdingValueNok(holding, fxRates), 0) / Math.max(total, 1) * 100,
  }));
  const currencyOnlyScenario: Scenario = {
    globalEquity: 0, usEquity: 0, europeEquity: 0, technology: 0, industrials: 0,
    defense: 0, usdNok: scenario.usdNok, nokEur: scenario.nokEur, rates: 0, credit: 0, cash: 0,
  };
  const currencyImpact = stressHoldings.reduce((sum, holding) => sum + scenarioImpact(holding, currencyOnlyScenario, fxRates).impactNok, 0);
  const largestBefore = normalized.reduce((largest, allocation) => Math.max(largest, allocation.weight), 0);
  const postTotal = Math.max(1, total + impact);
  const largestAfter = rows.reduce((largest, row) => Math.max(largest, row.postValue / postTotal * 100), 0);
  const weakInstrumentId = topContributor?.holding.id.replace(/^stress-/, "");
  const shift = weakInstrumentId ? Math.min(10, normalized.find((item) => item.instrumentId === weakInstrumentId)?.weight ?? 0) : 0;
  const alternativeSeed = normalized
    .filter((item) => item.instrumentId !== "lab-treasury")
    .map((item) => item.instrumentId === weakInstrumentId ? { ...item, weight: Math.max(0, item.weight - shift) } : item);
  const existingTreasury = normalized.find((item) => item.instrumentId === "lab-treasury")?.weight ?? 0;
  const alternativeAllocations = normalizedAllocations([...alternativeSeed, { instrumentId: "lab-treasury", weight: existingTreasury + shift }]);
  const alternativeHoldings = buildStressHoldings(instruments, alternativeAllocations, capitalNok);
  const alternativeImpact = alternativeHoldings.reduce((sum, holding) => sum + scenarioImpact(holding, scenario, fxRates).impactNok, 0);
  const recoverySensitivity = Math.max(6, Math.round(8 + Math.abs(impactPercent) * 0.9));

  function selectPreset(id: string) {
    const preset = scenarioPresets.find((item) => item.id === id);
    if (!preset) return;
    setActivePresetId(id);
    setScenarioCategory((scenarioGuides[id] ?? scenarioGuides.custom).category);
    setScenario({ ...preset.shocks });
  }
  function toggleInstrument(id: string) {
    if (selectedIds.has(id)) {
      setAllocations((current) => current.filter((allocation) => allocation.instrumentId !== id));
    } else {
      setAllocations((current) => normalizedAllocations([...current, { instrumentId: id, weight: current.length ? 10 : 100 }]));
    }
  }
  function updateWeight(id: string, value: string) {
    setWeightDrafts((current) => ({ ...current, [id]: value }));
    if (value === "") return;
    setAllocations((current) => rebalanceAllocation(current, id, Number(value)));
  }
  function commitWeight(id: string) {
    const draft = weightDrafts[id];
    if (draft !== undefined) setAllocations((current) => rebalanceAllocation(current, id, Number(draft || 0)));
    setWeightDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  function equalWeight() {
    if (allocations.length) setAllocations(allocations.map((allocation) => ({ ...allocation, weight: 100 / allocations.length })));
  }
  function toggleTimelineEvent(id: string) {
    setTimelineEventIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function loadSamplePortfolio() {
    setAllocations(initialAllocations());
  }
  function scrollToStep(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function goToStep(step: 1 | 2 | 3) {
    setActiveStep(step);
    window.requestAnimationFrame(() => scrollToStep(step === 1 ? "scenario-step-portfolio" : step === 2 ? "scenario-step-event" : "scenario-step-results"));
  }
  function shareContent(options: ShareOptions) {
    return {
      summary: `${activePreset?.name ?? "Custom scenario"} estimates ${formatMoney(impact, displayCurrency, fxRates)} (${formatPercent(impactPercent)}) against a ${stressHoldings.length}-position test portfolio.`,
      scenario,
      assumptions: "Normalized Scenario Lab portfolio. Linear factor estimate; rates and credit spreads use basis points.",
      contributors: options.includeHoldings ? rows.map((row) => ({
        holding: row.holding.name, ticker: row.holding.ticker,
        currentValue: options.includeValues ? row.value : undefined,
        impact: options.includeValues ? row.impactNok : undefined,
        impactPercent: row.impactPercent,
        assumptions: options.includeCommentary ? row.assumptions : undefined,
      })) : undefined,
    };
  }

  return <>
    <div className="scenario-layout scenario-workbench scenario-lab-v2">
      <section className="scenario-toolbar primary-view-toolbar">
        <div><h2>Scenarios</h2></div>
        <div className="scenario-actions">
          <button className="ghost-button" onClick={() => selectPreset("custom")}><RotateCcw size={15} /> Clear shock</button>
          <button className="ghost-button" onClick={() => setSaveOpen(true)}><Save size={15} /> Save</button>
          <button className="primary-button" onClick={() => setShareOpen(true)}><Link2 size={15} /> Share</button>
        </div>
      </section>

      {atlasHandoff ? <section className="atlas-handoff-banner">
        <div><span className="eyebrow">From Atlas</span><strong>{atlasHandoff.context.title}</strong><small>{atlasHandoff.instrumentIds.length} selected securities · temporary and not stored</small></div>
        <button type="button" className="ghost-button" onClick={onReturnToAtlas}><ArrowRight className="atlas-back-arrow" size={15} /> Back to comparison</button>
      </section> : null}

      <nav className="scenario-step-rail" aria-label="Stress test steps">
        <button className={activeStep === 1 ? "active" : ""} aria-current={activeStep === 1 ? "step" : undefined} onClick={() => goToStep(1)}><span>1</span><strong>Build portfolio</strong><small>{stressHoldings.length} positions · {formatMoney(total, displayCurrency, fxRates)}</small></button><ArrowRight size={16} />
        <button className={activeStep === 2 ? "active" : ""} aria-current={activeStep === 2 ? "step" : undefined} onClick={() => goToStep(2)}><span>2</span><strong>Choose market move</strong><small>{activePreset?.name ?? "Custom assumptions"}</small></button><ArrowRight size={16} />
        <button className={activeStep === 3 ? "active" : ""} aria-current={activeStep === 3 ? "step" : undefined} onClick={() => goToStep(3)}><span>3</span><strong>Understand the result</strong><small className={impact >= 0 ? "good" : "bad"}>{formatMoney(impact, displayCurrency, fxRates)} · {formatPercent(impactPercent)}</small></button>
      </nav>

      {activeStep === 1 ? <section id="scenario-step-portfolio" className="stress-builder scenario-step-panel">
        <div className="scenario-section-heading">
          <div><span className="eyebrow">Step 1 · Test portfolio</span><h2>What do you want to stress?</h2></div>
          <div className="stress-builder-actions"><button className="ghost-button" onClick={loadSamplePortfolio}>Reset example</button><button className="ghost-button" onClick={equalWeight}><Equal size={15} /> Equal weight</button></div>
        </div>
        <div className="stress-builder-grid">
          <div className="stress-selected">
            <div className="stress-capital-row">
              <label className="stress-capital-input"><span>Hypothetical test amount in {displayCurrency}</span><input type="number" min="1000" step="1000" inputMode="decimal" value={capitalNok ? displayedCapital : ""} onChange={(event) => setCapitalNok(Math.max(0, Number(event.target.value) * capitalDisplayRate))} onBlur={() => setCapitalNok((current) => Math.max(1_000 * capitalDisplayRate, current || 100_000))} /><small>Used only to translate the percentage shock into an illustrative gain or loss</small></label>
              <div>{assetMix.map((item) => <span key={item.assetType}><strong>{item.weight.toFixed(0)}%</strong>{item.assetType === "etf" ? "ETFs" : `${item.assetType}s`}</span>)}</div>
            </div>
            <div className="stress-allocation-list">
              {normalized.map((allocation) => {
                const instrument = instruments.find((item) => item.id === allocation.instrumentId);
                if (!instrument) return null;
                return <article key={instrument.id}>
                  <button className="icon-button danger" title={`Remove ${instrument.name}`} onClick={() => toggleInstrument(instrument.id)}><X size={14} /></button>
                  <div className="stress-selected-name"><CompanyMark ticker={instrument.ticker} assetType={instrument.assetType} size={27} /><span><strong>{instrument.ticker}</strong><span>{instrument.name} · {instrument.assetType}</span></span></div>
                  <label><input aria-label={`${instrument.name} weight`} type="number" min="0" max="100" step="1" inputMode="decimal" value={weightDrafts[instrument.id] ?? Number(allocation.weight.toFixed(1))} onChange={(event) => updateWeight(instrument.id, event.target.value)} onBlur={() => commitWeight(instrument.id)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /><span>%</span></label>
                </article>;
              })}
              {!normalized.length ? <div className="empty-state">Select at least one stock, ETF, or bond from the instrument list.</div> : null}
            </div>
          </div>
          <div className="stress-universe">
            <div className="stress-universe-tools">
              <div>{(["all", "stock", "etf", "bond"] as const).map((filter) => <button key={filter} className={instrumentFilter === filter ? "active" : ""} onClick={() => setInstrumentFilter(filter)}>{filter === "all" ? "All" : filter === "etf" ? "ETFs" : `${filter[0].toUpperCase()}${filter.slice(1)}s`}</button>)}</div>
              <p>Forward P/E is estimate-based. Sharpe uses one year of adjusted weekly returns when sourced. Recession risk is Aurelian&apos;s transparent 1–100 model.</p>
            </div>
            <div className="stress-instrument-list">
              <div className="stress-instrument-head"><span>Instrument</span><span>Fwd P/E</span><span>Sharpe</span><span>Recession risk</span></div>
              {filteredInstruments.map((instrument) => {
                const selected = selectedIds.has(instrument.id);
                return <button key={instrument.id} className={selected ? "selected" : ""} onClick={() => toggleInstrument(instrument.id)}>
                  <span className="stress-asset-icon">{selected ? <Check size={14} /> : <Plus size={14} />}</span>
                  <span className="stress-instrument-name"><CompanyMark ticker={instrument.ticker} assetType={instrument.assetType} size={27} /><span><strong>{instrument.ticker}</strong><small>{instrument.name} · {instrument.country}</small></span></span>
                  <span className="stress-metric"><strong>{instrument.forwardPe == null ? "—" : instrument.forwardPe.toFixed(1)}</strong><small>{instrument.forwardPe == null ? "Unavailable" : "Estimate"}</small></span>
                  <span className="stress-metric"><strong>{instrument.sharpe == null ? "—" : instrument.sharpe.toFixed(2)}</strong><small>1Y weekly</small></span>
                  <span className={`stress-risk risk-${(instrument.recessionRisk ?? 50) < 35 ? "low" : (instrument.recessionRisk ?? 50) < 65 ? "medium" : "high"}`}><span><i style={{ width: `${instrument.recessionRisk ?? 50}%` }} /></span><strong>{instrument.recessionRisk ?? 50}</strong><small>{instrument.metricSource ?? "Modeled"}</small></span>
                </button>;
              })}
              {!filteredInstruments.length ? <div className="empty-state">No instruments are available in this category.</div> : null}
            </div>
          </div>
        </div>
        <p className="panel-note">Weights are normalized to 100% for the calculation. This temporary hypothetical mix is not stored.</p>
        <div className="scenario-step-actions"><span>{normalized.length ? `${normalized.length} instruments ready` : "Choose at least one instrument"}</span><button className="primary-button" disabled={!normalized.length} onClick={() => goToStep(2)}>Choose market move <ArrowRight size={15} /></button></div>
      </section> : null}

      {activeStep === 2 ? <section id="scenario-step-event" className="scenario-library scenario-step-panel">
        <div className="scenario-library-heading"><div><span className="eyebrow">Step 2 · Market move</span><h2>What should happen?</h2></div><span>{scenarioPresets.length - 1} named stress tests</span></div>
        <div className="scenario-category-tabs" role="tablist" aria-label="Scenario categories">
          {scenarioCategories.map((category) => <button key={category} role="tab" aria-selected={scenarioCategory === category} className={scenarioCategory === category ? "active" : ""} onClick={() => setScenarioCategory(category)}>{category}</button>)}
        </div>
        <div key={scenarioCategory} className="preset-strip">
          {visiblePresets.map((preset) => <button key={preset.id} className={activePresetId === preset.id ? "active" : ""} onClick={() => selectPreset(preset.id)}><strong>{preset.name}</strong><span>{preset.description}</span>{activePresetId === preset.id ? <Check size={15} /> : null}</button>)}
        </div>
        <button className={`scenario-details-trigger${modelOpen ? " open" : ""}`} onClick={() => setModelOpen((current) => !current)} aria-expanded={modelOpen}>
          <div><SlidersHorizontal size={17} /><span><strong>{modelOpen ? "Hide custom assumptions" : "Adjust the market move manually"}</strong><small>Equities and currencies in percent; rates and spreads in basis points</small></span></div>{modelOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
        {modelOpen ? <div className="stress-factor-grid">{factorKeys.map((key) => {
          const isBps = factorUnits[key] === "bps";
          return <label key={key}><span>{factorLabels[key]}<strong>{formatShock(key, scenario[key])}</strong></span><input type="range" min={isBps ? -300 : -40} max={isBps ? 500 : 40} step={isBps ? 25 : 0.5} value={scenario[key]} onChange={(event) => { setActivePresetId("custom"); setScenario({ ...scenario, [key]: Number(event.target.value) }); }} /></label>;
        })}</div> : null}
        <div className="scenario-step-actions"><button className="ghost-button" onClick={() => goToStep(1)}>Back to portfolio</button><button className="primary-button" onClick={() => goToStep(3)}>Run stress test <ArrowRight size={15} /></button></div>
      </section> : null}

      {activeStep === 3 ? <section id="scenario-step-results" className="stress-results scenario-step-panel">
        <div className="scenario-section-heading"><div><span className="eyebrow">Step 3 · Stress result</span><h2>{activeGuide.question}</h2></div><span>Linear estimate · no probability assigned</span></div>
        <div className="scenario-result-band">
          <article><span>{impact >= 0 ? "Estimated gain" : "Estimated loss"}</span><strong className={impact >= 0 ? "good" : "bad"}>{formatMoney(impact, displayCurrency, fxRates)}</strong><em>{formatPercent(impactPercent)} of {formatMoney(total, displayCurrency, fxRates)}</em></article>
          <article><span>Value after stress</span><strong>{formatMoney(total + impact, displayCurrency, fxRates)}</strong><em>Before {formatMoney(total, displayCurrency, fxRates)}</em></article>
          <article><span>Largest weak point</span><strong>{topContributor?.holding.ticker ?? "None"}</strong><em>{topContributor ? `${formatPercent(topContributor.impactPercent)} position impact` : "No responsive exposure"}</em></article>
        </div>
        <div className="scenario-diagnostics">
          <article><span>Currency contribution</span><strong className={currencyImpact >= 0 ? "good" : "bad"}>{formatMoney(currencyImpact, displayCurrency, fxRates)}</strong><small>Isolates USD/NOK and NOK/EUR assumptions</small></article>
          <article><span>Largest position</span><strong>{largestBefore.toFixed(1)}% → {largestAfter.toFixed(1)}%</strong><small>Concentration before and immediately after stress</small></article>
          <article><span>Recovery sensitivity</span><strong>About {recoverySensitivity} months</strong><small>Illustrative severity rule, not a forecast</small></article>
          <article><span>Diversification counterfactual</span><strong className={alternativeImpact >= 0 ? "good" : "bad"}>{formatMoney(alternativeImpact, displayCurrency, fxRates)}</strong><small>{shift ? `Moves ${shift.toFixed(0)} points from ${topContributor?.holding.ticker} to an investment-grade Treasury` : "No weak position available to rebalance"}</small></article>
        </div>
        <div className="stress-reading stress-reading-summary">
          <article><ShieldAlert size={18} /><span>Main cause</span><strong>{topContributor?.holding.name ?? "No weak point identified"}</strong><p>{topContributor ? `${formatMoney(topContributor.impactNok, displayCurrency, fxRates)} of the modeled move comes from this position.` : "Choose a scenario with an active factor for this portfolio."}</p></article>
          <article><Landmark size={18} /><span>How the shock travels</span><strong>{activeGuide.trigger}</strong><div>{activeGuide.transmission.slice(0, 3).map((step) => <span key={step}><ArrowRight size={12} />{step}</span>)}</div></article>
          <article><Info size={18} /><span>Interpretation</span><strong>Stress estimate, not forecast</strong><p>Use this to identify concentration and transmission risk. It does not assign a probability or predict timing.</p></article>
        </div>
        <button className={`scenario-details-trigger scenario-results-trigger${resultsOpen ? " open" : ""}`} onClick={() => setResultsOpen((current) => !current)} aria-expanded={resultsOpen}>
          <div><SlidersHorizontal size={17} /><span><strong>{resultsOpen ? "Hide detailed analysis" : "Open charts, historical path, and assumptions"}</strong><small>Inspect contributors, historical stress periods, and the position-level model</small></span></div>{resultsOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
        {resultsOpen ? <div className="scenario-result-details"><div className="scenario-timeline">
          <div className="scenario-timeline-head">
            <div><strong>Indexed stress path</strong><span>Hypothetical mix starting at 100</span></div>
            <div className="timeline-event-toggles" aria-label="Historical events shown on timeline">
              {historicalTimelineEvents.map((event) => <button key={event.id} type="button" aria-pressed={timelineEventIds.has(event.id)} className={timelineEventIds.has(event.id) ? "active" : ""} onClick={() => toggleTimelineEvent(event.id)}>{event.shortLabel}</button>)}
            </div>
          </div>
          <div className="scenario-timeline-chart">
            <ResponsiveContainer width="100%" height={330}>
              <LineChart data={timelineData} margin={{ top: 28, right: 34, bottom: 6, left: 8 }}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <XAxis dataKey="timestamp" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={{ fill: "#747a76", fontSize: 9 }} tickFormatter={(value) => String(new Date(Number(value)).getUTCFullYear())} minTickGap={42} />
                <YAxis width={82} tick={{ fill: "#747a76", fontSize: 9 }} tickFormatter={(value) => new Intl.NumberFormat("nb-NO", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))} />
                <Tooltip cursor={{ stroke: "rgba(216,193,123,.28)", strokeWidth: 1 }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as ScenarioTimelinePoint;
                  return <div className="timeline-tooltip"><span>{new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(point.timestamp))}</span><strong>Index {point.portfolioNok.toFixed(1)}</strong><small>Baseline {point.baselineNok.toFixed(1)}</small>{point.eventName ? <><em>{point.eventName} · {formatPercent(point.eventImpactPercent ?? 0)}</em><p>{point.eventRecap}</p></> : null}</div>;
                }} />
                {selectedTimelineEvents.map((event) => <ReferenceLine key={event.id} x={eventTimestamp(event.date)} stroke="rgba(204,82,98,.46)" strokeDasharray="3 4" label={{ value: event.shortLabel, position: "insideTopRight", fill: "#a66a72", fontSize: 8 }} />)}
                <Line type="monotone" dataKey="baselineNok" stroke="#4e5451" strokeWidth={1.2} strokeDasharray="4 5" dot={false} isAnimationActive animationDuration={600} />
                <Line key={selectedTimelineEvents.map((event) => `${event.id}-${event.impactPercent.toFixed(2)}`).join("|")} type="monotone" dataKey="portfolioNok" stroke="#d8c17b" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "#e4cf8b", stroke: "#171815", strokeWidth: 2 }} isAnimationActive animationDuration={900} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="timeline-legend"><span><i className="portfolio-line" />Modeled test mix</span><span><i className="baseline-line" />No-shock baseline</span><small>Indexed illustration, not personal or observed historical performance. Hover to inspect each period.</small></div>
        </div>
          <div className="stress-results-grid stress-results-grid-detail">
          <div className="stress-contribution-chart">
            <ResponsiveContainer width="100%" height={Math.max(260, rows.length * 46)}>
              <BarChart layout="vertical" data={rows.map((row) => ({ name: row.holding.ticker || row.holding.name, impact: row.impactNok }))} margin={{ left: 8, right: 128 }}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#7f7a7d", fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat("nb-NO", { notation: "compact" }).format(Number(value))} />
                <YAxis dataKey="name" type="category" width={96} tick={{ fill: "#d7d3d1", fontSize: 10 }} />
                <Tooltip contentStyle={darkTooltip} formatter={(value) => formatMoney(Number(value), displayCurrency, fxRates)} />
                <Bar dataKey="impact" radius={[0, 3, 3, 0]}>{rows.map((row) => <Cell key={row.holding.id} fill={row.impactNok >= 0 ? "#4f9d78" : "#b65f69"} />)}<LabelList dataKey="impact" position="right" fill="#c9c5c0" fontSize={9} formatter={(value: unknown) => new Intl.NumberFormat("nb-NO", { notation: "compact" }).format(Number(value))} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="table-wrap stress-result-table"><table><thead><tr><th>Position</th><th>Type</th><th>Weight</th><th>Current</th><th>Impact</th><th>After stress</th><th>Assumptions used</th></tr></thead><tbody>{rows.map((row) => <tr key={row.holding.id}><td><strong>{row.holding.ticker}</strong><span>{row.holding.name}</span></td><td>{row.holding.asset_type}</td><td>{formatPercent(total ? row.value / total * 100 : 0)}</td><td>{formatMoney(row.value, displayCurrency, fxRates)}</td><td className={row.impactNok >= 0 ? "good" : "bad"}>{formatMoney(row.impactNok, displayCurrency, fxRates)}</td><td>{formatMoney(row.postValue, displayCurrency, fxRates)}</td><td>{row.assumptions.length ? row.assumptions.join(" · ") : "No active exposure"}</td></tr>)}</tbody></table></div>
        <p className="panel-note">Bonds use duration for rate and credit-spread shocks. Stocks and ETFs use editable linear factor exposures. This lab uses explicit model assumptions rather than live forecasts.</p></div> : null}
        <div className="scenario-step-actions"><button className="ghost-button" onClick={() => goToStep(2)}>Change market move</button><button className="ghost-button" onClick={() => goToStep(1)}>Edit portfolio</button></div>
      </section> : null}

      {activeStep === 2 && savedScenarios.length ? <section className="panel wide scenario-saved-compact">
        <div className="panel-title-row"><div><span className="eyebrow">Reusable work</span><h2>Saved market moves</h2></div></div>
        <div className="saved-scenario-list">{savedScenarios.map((saved) => {
          const savedImpact = stressHoldings.reduce((sum, holding) => sum + scenarioImpact(holding, saved.shocks, fxRates).impactNok, 0);
          return <article key={saved.id}><div><strong>{saved.name}</strong><span>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(saved.created_at))}</span></div><strong className={savedImpact >= 0 ? "good" : "bad"}>{formatMoney(savedImpact, displayCurrency, fxRates)}</strong><button className="icon-button" title="Load scenario" onClick={() => { setScenario({ ...saved.shocks }); setActivePresetId("custom"); goToStep(3); }}><Copy size={15} /></button><button className="icon-button danger" title="Delete scenario" onClick={() => onDeleteScenario(saved.id)}><Trash2 size={15} /></button></article>;
        })}</div>
      </section> : null}
    </div>

    {saveOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSaveOpen(false); }}><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="save-scenario-title"><div className="modal-heading"><div><span className="eyebrow">Reusable market move</span><h2 id="save-scenario-title">Save scenario</h2></div><button className="icon-button" onClick={() => setSaveOpen(false)} aria-label="Close save dialog"><X size={17} /></button></div><label className="field"><span>Name</span><input autoFocus value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} placeholder="e.g. Rates stay higher" /></label><div className="modal-actions"><button className="ghost-button" onClick={() => setSaveOpen(false)}>Cancel</button><button className="primary-button" disabled={!scenarioName.trim()} onClick={() => { onSaveScenario({ id: crypto.randomUUID(), name: scenarioName.trim(), shocks: { ...scenario }, created_at: new Date().toISOString() }); setScenarioName(""); setSaveOpen(false); }}><Save size={15} /> Save</button></div></section></div> : null}
    {shareOpen ? <ShareDialog title={`${activePreset?.name ?? "Custom stress test"} · Aurelian Capital`} kind="scenario" content={shareContent} onClose={() => setShareOpen(false)} /> : null}
  </>;
}
