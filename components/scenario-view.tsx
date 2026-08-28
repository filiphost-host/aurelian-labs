"use client";

import {
  ArrowRight, Check, ChevronDown, ChevronUp, Copy, Equal, Info, Landmark,
  Link2, Plus, RotateCcw, Save, Search, ShieldAlert, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  factorLabels, factorUnits, formatMoney, formatPercent, formatShock,
  holdingValueNok, scenarioImpact, totalValueNok,
} from "@/lib/calculations";
import { scenarioPresets } from "@/lib/sample-data";
import { scenarioCategories, scenarioGuides, type ScenarioCategory } from "@/lib/scenario-research";
import {
  buildStressHoldings, normalizedAllocations, stressInstrumentLibrary,
  type StressAllocation, type StressInstrument,
} from "@/lib/stress-portfolio";
import type {
  AssetType, DisplayCurrency, FactorKey, Holding, LedgerPosition,
  SavedScenario, Scenario, ShareOptions,
} from "@/lib/types";
import type { BenchmarkPricePoint } from "@/lib/portfolio-story";
import { ShareDialog } from "@/components/share-dialog";

const factorKeys = Object.keys(factorLabels) as FactorKey[];
const darkTooltip = {
  backgroundColor: "rgba(14, 13, 15, 0.97)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: "4px",
  color: "#f4f1ef",
};
type InstrumentFilter = "all" | Exclude<AssetType, "cash">;

function holdingInstrument(holding: Holding): StressInstrument {
  return {
    id: `holding-${holding.id}`,
    ticker: holding.ticker ?? holding.name.slice(0, 8).toUpperCase(),
    name: holding.name,
    assetType: holding.asset_type === "cash" ? "bond" : holding.asset_type,
    country: holding.country ?? "Unclassified",
    sector: holding.sector ?? "Unclassified",
    currency: holding.currency,
    exposures: holding.factor_exposures,
    duration: holding.duration_estimate ?? undefined,
    creditQuality: holding.credit_quality ?? undefined,
  };
}

function initialAllocations(holdings: Holding[], fxRates: Record<string, number>): StressAllocation[] {
  const eligible = holdings.filter((holding) => holding.asset_type !== "cash");
  const total = totalValueNok(eligible, fxRates);
  if (!eligible.length) return [
    { instrumentId: "lab-sxr8", weight: 60 },
    { instrumentId: "lab-msft", weight: 15 },
    { instrumentId: "lab-nvda", weight: 10 },
    { instrumentId: "lab-treasury", weight: 15 },
  ];
  return eligible.map((holding) => ({
    instrumentId: `holding-${holding.id}`,
    weight: total ? holdingValueNok(holding, fxRates) / total * 100 : 100 / eligible.length,
  }));
}

export function ScenarioView({
  holdings, fxRates, displayCurrency, scenario, setScenario, activePresetId,
  setActivePresetId, savedScenarios, onSaveScenario, onDeleteScenario,
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
  const currentCapital = Math.max(100_000, Math.round(totalValueNok(holdings, fxRates) / 10_000) * 10_000);
  const [capitalNok, setCapitalNok] = useState(currentCapital || 1_000_000);
  const [allocations, setAllocations] = useState<StressAllocation[]>(() => initialAllocations(holdings, fxRates));
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentFilter>("all");
  const [instrumentQuery, setInstrumentQuery] = useState("");
  const [remoteInstruments, setRemoteInstruments] = useState<StressInstrument[]>([]);
  const [searchStatus, setSearchStatus] = useState<"idle" | "searching" | "ready" | "unavailable">("idle");
  const [scenarioCategory, setScenarioCategory] = useState<ScenarioCategory>(scenarioGuides[activePresetId]?.category ?? "Macro");
  const [modelOpen, setModelOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState("");

  const instruments = useMemo(() => {
    const personal = holdings.filter((holding) => holding.asset_type !== "cash").map(holdingInstrument);
    const existingTickers = new Set(personal.map((instrument) => instrument.ticker.toUpperCase()));
    const curated = stressInstrumentLibrary.filter((instrument) => !existingTickers.has(instrument.ticker.toUpperCase()));
    const remoteByTicker = new Map<string, StressInstrument>();
    remoteInstruments.forEach((instrument) => {
      const ticker = instrument.ticker.toUpperCase();
      if (!remoteByTicker.has(ticker)) remoteByTicker.set(ticker, instrument);
    });
    const base = [...personal, ...curated].map((instrument) => {
      const researched = remoteByTicker.get(instrument.ticker.toUpperCase());
      if (!researched) return instrument;
      remoteByTicker.delete(instrument.ticker.toUpperCase());
      return {
        ...instrument,
        forwardPe: researched.forwardPe ?? instrument.forwardPe,
        sharpe: researched.sharpe ?? instrument.sharpe,
        recessionRisk: researched.recessionRisk ?? instrument.recessionRisk,
        metricSource: researched.forwardPe != null || researched.sharpe != null ? researched.metricSource : instrument.metricSource,
        metricsAsOf: researched.metricsAsOf ?? instrument.metricsAsOf,
      };
    });
    return [...base, ...remoteByTicker.values()];
  }, [holdings, remoteInstruments]);

  useEffect(() => {
    const query = instrumentQuery.trim();
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchStatus("searching");
      try {
        const response = await fetch(`/api/scenario/instruments?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const payload = await response.json() as { results?: StressInstrument[] };
        setRemoteInstruments(payload.results ?? []);
        setSearchStatus("ready");
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setRemoteInstruments([]);
          setSearchStatus("unavailable");
        }
      }
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [instrumentQuery]);
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
  const topContributor = rows.find((row) => row.impactNok < 0) ?? rows[0] ?? null;
  const activeGuide = scenarioGuides[activePresetId] ?? scenarioGuides.custom;
  const activePreset = scenarioPresets.find((preset) => preset.id === activePresetId);
  const visiblePresets = scenarioPresets.filter((preset) =>
    preset.id !== "custom" && (scenarioGuides[preset.id] ?? scenarioGuides.custom).category === scenarioCategory,
  );
  const filteredInstruments = instruments.filter((instrument) => {
    if (instrumentFilter !== "all" && instrument.assetType !== instrumentFilter) return false;
    const query = instrumentQuery.trim().toLowerCase();
    return !query || `${instrument.ticker} ${instrument.name} ${instrument.country} ${instrument.sector}`.toLowerCase().includes(query);
  });
  const assetMix = (["stock", "etf", "bond"] as const).map((assetType) => ({
    assetType,
    weight: stressHoldings.filter((holding) => holding.asset_type === assetType)
      .reduce((sum, holding) => sum + holdingValueNok(holding, fxRates), 0) / Math.max(total, 1) * 100,
  }));

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
  function updateWeight(id: string, weight: number) {
    setAllocations((current) => current.map((allocation) => allocation.instrumentId === id
      ? { ...allocation, weight: Math.max(0, Math.min(100, weight)) } : allocation));
  }
  function equalWeight() {
    if (allocations.length) setAllocations(allocations.map((allocation) => ({ ...allocation, weight: 100 / allocations.length })));
  }
  function loadCurrentPortfolio() {
    setAllocations(initialAllocations(holdings, fxRates));
    setCapitalNok(currentCapital);
  }
  function scrollToStep(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      <section className="scenario-toolbar">
        <div><span className="eyebrow">Construct · shock · inspect</span><h2>Scenario Lab</h2><p>Build the portfolio you want to test, then decide what changes in the market.</p></div>
        <div className="scenario-actions">
          <button className="ghost-button" onClick={() => selectPreset("custom")}><RotateCcw size={15} /> Clear shock</button>
          <button className="ghost-button" onClick={() => setSaveOpen(true)}><Save size={15} /> Save</button>
          <button className="primary-button" onClick={() => setShareOpen(true)}><Link2 size={15} /> Share</button>
        </div>
      </section>

      <nav className="scenario-step-rail" aria-label="Stress test steps">
        <button onClick={() => scrollToStep("scenario-step-portfolio")}><span>1</span><strong>Build portfolio</strong><small>{stressHoldings.length} positions · {formatMoney(total, displayCurrency, fxRates)}</small></button><ArrowRight size={16} />
        <button onClick={() => scrollToStep("scenario-step-event")}><span>2</span><strong>Choose market move</strong><small>{activePreset?.name ?? "Custom assumptions"}</small></button><ArrowRight size={16} />
        <button onClick={() => scrollToStep("scenario-step-results")}><span>3</span><strong>Read stress result</strong><small className={impact >= 0 ? "good" : "bad"}>{formatPercent(impactPercent)}</small></button>
      </nav>

      <section id="scenario-step-portfolio" className="stress-builder">
        <div className="scenario-section-heading">
          <div><span className="eyebrow">Step 1 · Test portfolio</span><h2>What do you want to stress?</h2></div>
          <div className="stress-builder-actions"><button className="ghost-button" onClick={loadCurrentPortfolio}>Use my holdings</button><button className="ghost-button" onClick={equalWeight}><Equal size={15} /> Equal weight</button></div>
        </div>
        <div className="stress-builder-grid">
          <div className="stress-selected">
            <div className="stress-capital-row">
              <label><span>Test capital in NOK</span><input type="number" min="10000" step="10000" value={capitalNok} onChange={(event) => setCapitalNok(Math.max(10_000, Number(event.target.value) || 10_000))} /></label>
              <div>{assetMix.map((item) => <span key={item.assetType}><strong>{item.weight.toFixed(0)}%</strong>{item.assetType === "etf" ? "ETFs" : `${item.assetType}s`}</span>)}</div>
            </div>
            <div className="stress-allocation-list">
              {normalized.map((allocation) => {
                const instrument = instruments.find((item) => item.id === allocation.instrumentId);
                if (!instrument) return null;
                return <article key={instrument.id}>
                  <button className="icon-button danger" title={`Remove ${instrument.name}`} onClick={() => toggleInstrument(instrument.id)}><X size={14} /></button>
                  <div><strong>{instrument.ticker}</strong><span>{instrument.name} · {instrument.assetType}</span></div>
                  <label><input aria-label={`${instrument.name} weight`} type="number" min="0" max="100" step="1" value={Number(allocation.weight.toFixed(1))} onChange={(event) => updateWeight(instrument.id, Number(event.target.value))} /><span>%</span></label>
                </article>;
              })}
              {!normalized.length ? <div className="empty-state">Select at least one stock, ETF, or bond from the instrument list.</div> : null}
            </div>
          </div>
          <div className="stress-universe">
            <div className="stress-universe-tools">
              <label><Search size={15} /><input value={instrumentQuery} onChange={(event) => { const query = event.target.value; setInstrumentQuery(query); if (query.trim().length < 2) { setRemoteInstruments([]); setSearchStatus("idle"); } }} placeholder="Ticker, company, ETF, ISIN or FIGI" />{searchStatus === "searching" ? <span className="stress-search-state">Searching</span> : null}</label>
              <div>{(["all", "stock", "etf", "bond"] as const).map((filter) => <button key={filter} className={instrumentFilter === filter ? "active" : ""} onClick={() => setInstrumentFilter(filter)}>{filter === "all" ? "All" : filter === "etf" ? "ETFs" : `${filter[0].toUpperCase()}${filter.slice(1)}s`}</button>)}</div>
              <p>Forward P/E is estimate-based. Sharpe uses one year of adjusted weekly returns when sourced. Recession risk is Aurelian&apos;s transparent 1–100 model.</p>
            </div>
            <div className="stress-instrument-list">
              <div className="stress-instrument-head"><span>Instrument</span><span>Fwd P/E</span><span>Sharpe</span><span>Recession risk</span></div>
              {filteredInstruments.map((instrument) => {
                const selected = selectedIds.has(instrument.id);
                return <button key={instrument.id} className={selected ? "selected" : ""} onClick={() => toggleInstrument(instrument.id)}>
                  <span className="stress-asset-icon">{selected ? <Check size={14} /> : <Plus size={14} />}</span>
                  <span className="stress-instrument-name"><strong>{instrument.ticker}</strong><small>{instrument.name} · {instrument.country}</small></span>
                  <span className="stress-metric"><strong>{instrument.forwardPe == null ? "—" : instrument.forwardPe.toFixed(1)}</strong><small>{instrument.forwardPe == null ? "Unavailable" : "Estimate"}</small></span>
                  <span className="stress-metric"><strong>{instrument.sharpe == null ? "—" : instrument.sharpe.toFixed(2)}</strong><small>1Y weekly</small></span>
                  <span className={`stress-risk risk-${(instrument.recessionRisk ?? 50) < 35 ? "low" : (instrument.recessionRisk ?? 50) < 65 ? "medium" : "high"}`}><span><i style={{ width: `${instrument.recessionRisk ?? 50}%` }} /></span><strong>{instrument.recessionRisk ?? 50}</strong><small>{instrument.metricSource ?? "Modeled"}</small></span>
                </button>;
              })}
              {!filteredInstruments.length && searchStatus !== "searching" ? <div className="empty-state">No matching instrument. Try the full company name, ticker, ISIN, or FIGI.</div> : null}
              {searchStatus === "unavailable" ? <div className="stress-search-warning">The wider market search is temporarily unavailable. The built-in catalog remains usable.</div> : null}
            </div>
          </div>
        </div>
        <p className="panel-note">Weights are normalized to 100% for the calculation. This portfolio exists only inside the Scenario Lab and does not change your stored holdings.</p>
      </section>

      <section id="scenario-step-event" className="scenario-library">
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
      </section>

      <section id="scenario-step-results" className="stress-results">
        <div className="scenario-section-heading"><div><span className="eyebrow">Step 3 · Stress result</span><h2>{activeGuide.question}</h2></div><span>Linear estimate · no probability assigned</span></div>
        <div className="scenario-result-band">
          <article><span>Estimated portfolio move</span><strong className={impact >= 0 ? "good" : "bad"}>{formatPercent(impactPercent)}</strong><em>{formatMoney(impact, displayCurrency, fxRates)}</em></article>
          <article><span>Value after stress</span><strong>{formatMoney(total + impact, displayCurrency, fxRates)}</strong><em>Before {formatMoney(total, displayCurrency, fxRates)}</em></article>
          <article><span>Largest weak point</span><strong>{topContributor?.holding.ticker ?? "None"}</strong><em>{topContributor ? `${formatPercent(topContributor.impactPercent)} position impact` : "No responsive exposure"}</em></article>
        </div>
        <div className="stress-results-grid">
          <div className="stress-contribution-chart">
            <ResponsiveContainer width="100%" height={Math.max(260, rows.length * 46)}>
              <BarChart layout="vertical" data={rows.map((row) => ({ name: row.holding.ticker || row.holding.name, impact: row.impactNok }))} margin={{ left: 8, right: 64 }}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#7f7a7d", fontSize: 10 }} tickFormatter={(value) => new Intl.NumberFormat("nb-NO", { notation: "compact" }).format(Number(value))} />
                <YAxis dataKey="name" type="category" width={82} tick={{ fill: "#d7d3d1", fontSize: 10 }} />
                <Tooltip contentStyle={darkTooltip} formatter={(value) => formatMoney(Number(value), displayCurrency, fxRates)} />
                <Bar dataKey="impact" radius={[0, 3, 3, 0]}>{rows.map((row) => <Cell key={row.holding.id} fill={row.impactNok >= 0 ? "#4f9d78" : "#b65f69"} />)}<LabelList dataKey="impact" position="right" formatter={(value: unknown) => new Intl.NumberFormat("nb-NO", { notation: "compact" }).format(Number(value))} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="stress-reading">
            <article><ShieldAlert size={18} /><span>What this exposes</span><strong>{topContributor?.holding.name ?? "No weak point identified"}</strong><p>{topContributor ? `${formatMoney(topContributor.impactNok, displayCurrency, fxRates)} of the modeled move comes from this position. Review its weight and factor assumptions first.` : "Choose a scenario with an active factor for this portfolio."}</p></article>
            <article><Landmark size={18} /><span>How the move travels</span><strong>{activeGuide.trigger}</strong><div>{activeGuide.transmission.map((step) => <span key={step}><ArrowRight size={12} />{step}</span>)}</div></article>
            <article><Info size={18} /><span>What not to conclude</span><strong>This is not a forecast</strong><p>Probability, timing, liquidity, changing correlations, taxes, and second-order effects are outside this model.</p></article>
          </div>
        </div>
        <div className="table-wrap stress-result-table"><table><thead><tr><th>Position</th><th>Type</th><th>Weight</th><th>Current</th><th>Impact</th><th>After stress</th><th>Assumptions used</th></tr></thead><tbody>{rows.map((row) => <tr key={row.holding.id}><td><strong>{row.holding.ticker}</strong><span>{row.holding.name}</span></td><td>{row.holding.asset_type}</td><td>{formatPercent(total ? row.value / total * 100 : 0)}</td><td>{formatMoney(row.value, displayCurrency, fxRates)}</td><td className={row.impactNok >= 0 ? "good" : "bad"}>{formatMoney(row.impactNok, displayCurrency, fxRates)}</td><td>{formatMoney(row.postValue, displayCurrency, fxRates)}</td><td>{row.assumptions.length ? row.assumptions.join(" · ") : "No active exposure"}</td></tr>)}</tbody></table></div>
        <p className="panel-note">Bonds use duration for rate and credit-spread shocks. Stocks and ETFs use editable linear factor exposures. This lab uses explicit model assumptions rather than live forecasts.</p>
      </section>

      <section className="panel wide scenario-saved-compact">
        <div className="panel-title-row"><div><span className="eyebrow">Reusable work</span><h2>Saved market moves</h2></div></div>
        {savedScenarios.length ? <div className="saved-scenario-list">{savedScenarios.map((saved) => {
          const savedImpact = stressHoldings.reduce((sum, holding) => sum + scenarioImpact(holding, saved.shocks, fxRates).impactNok, 0);
          return <article key={saved.id}><div><strong>{saved.name}</strong><span>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(saved.created_at))}</span></div><strong className={savedImpact >= 0 ? "good" : "bad"}>{formatMoney(savedImpact, displayCurrency, fxRates)}</strong><button className="icon-button" title="Load scenario" onClick={() => { setScenario({ ...saved.shocks }); setActivePresetId("custom"); scrollToStep("scenario-step-results"); }}><Copy size={15} /></button><button className="icon-button danger" title="Delete scenario" onClick={() => onDeleteScenario(saved.id)}><Trash2 size={15} /></button></article>;
        })}</div> : <div className="empty-state">Save a market move to reuse it against a different test portfolio.</div>}
      </section>
    </div>

    {saveOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSaveOpen(false); }}><section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="save-scenario-title"><div className="modal-heading"><div><span className="eyebrow">Reusable market move</span><h2 id="save-scenario-title">Save scenario</h2></div><button className="icon-button" onClick={() => setSaveOpen(false)} aria-label="Close save dialog"><X size={17} /></button></div><label className="field"><span>Name</span><input autoFocus value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} placeholder="e.g. Rates stay higher" /></label><div className="modal-actions"><button className="ghost-button" onClick={() => setSaveOpen(false)}>Cancel</button><button className="primary-button" disabled={!scenarioName.trim()} onClick={() => { onSaveScenario({ id: crypto.randomUUID(), name: scenarioName.trim(), shocks: { ...scenario }, created_at: new Date().toISOString() }); setScenarioName(""); setSaveOpen(false); }}><Save size={15} /> Save</button></div></section></div> : null}
    {shareOpen ? <ShareDialog title={`${activePreset?.name ?? "Custom stress test"} · Aurelian Capital`} kind="scenario" content={shareContent} onClose={() => setShareOpen(false)} /> : null}
  </>;
}
