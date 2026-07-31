"use client";

import {
  Copy,
  Info,
  Link2,
  RotateCcw,
  Save,
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
            <span className="eyebrow">Named stress tests</span>
            <h2>Scenario laboratory</h2>
          </div>
          <div className="scenario-actions">
            <button className="ghost-button" onClick={() => selectPreset("custom")}><RotateCcw size={15} /> Reset</button>
            <button className="ghost-button" onClick={() => setSaveOpen(true)}><Save size={15} /> Save</button>
            <button className="primary-button" onClick={() => setShareOpen(true)}><Link2 size={15} /> Share</button>
          </div>
        </section>

        <section className="preset-strip" aria-label="Scenario presets">
          {scenarioPresets.map((preset) => (
            <button
              key={preset.id}
              className={activePresetId === preset.id ? "active" : ""}
              onClick={() => selectPreset(preset.id)}
            >
              <strong>{preset.name}</strong>
              <span>{preset.description}</span>
            </button>
          ))}
        </section>

        <section className="scenario-result-band">
          <article>
            <span>Estimated portfolio impact</span>
            <strong className={impact >= 0 ? "good" : "bad"}>{formatMoney(impact, displayCurrency)}</strong>
            <em>{formatPercent(impactPercent)} from current value</em>
          </article>
          <article>
            <span>Post-scenario value</span>
            <strong>{formatMoney(total + impact, displayCurrency)}</strong>
            <em>Linear approximation</em>
          </article>
          <article>
            <span>Affected currencies</span>
            <strong>{currencies.length || 0}</strong>
            <em>{currencies.join(", ") || "None"}</em>
          </article>
        </section>

        <section className="panel factor-panel">
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
        </section>

        <section className="panel contribution-panel">
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
        </section>

        <section className="panel before-after-panel">
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
        </section>

        <section className="panel wide">
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
        </section>

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
