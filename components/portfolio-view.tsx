"use client";

import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileUp,
  FlaskConical,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  allocationBy,
  formatMoney,
  formatPercent,
  portfolioSummary,
  replayTransactions,
} from "@/lib/calculations";
import type {
  AssetType,
  DisplayCurrency,
  Holding,
  HoldingDecision,
  PortfolioSnapshot,
  Transaction,
  TransactionType,
} from "@/lib/types";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import type { RemoteInstrument } from "@/components/search-command";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { InvestorPlaybooks } from "@/components/investor-playbooks";
import { buildBenchmarkComparison, portfolioMilestones, type BenchmarkPricePoint } from "@/lib/portfolio-story";

const chartColors = ["#f0edeb", "#4f9d78", "#b36570", "#6f777c", "#c5a45b", "#587f78"];
const darkTooltip = {
  backgroundColor: "rgba(14, 13, 15, 0.97)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: "5px",
  color: "#f4f1ef",
};

function blankHolding(seed?: RemoteInstrument): Holding {
  return {
    id: "",
    asset_type: seed?.instrumentType?.toLowerCase().includes("etf") ? "etf" : "stock",
    ticker: seed?.symbol ?? "",
    isin: null,
    figi: seed?.figi ?? null,
    exchange: seed?.exchange ?? null,
    name: seed?.name ?? "",
    quantity: 0,
    average_cost: 0,
    market_price: null,
    currency: seed?.currency ?? "NOK",
    country: seed?.country ?? "",
    sector: "",
    region: "",
    account_note: "",
    manual_value_nok: null,
    factor_exposures: { globalEquity: 0.6 },
    issuer: "",
    coupon_rate: null,
    maturity_date: null,
    face_value: null,
    yield_estimate: null,
    duration_estimate: null,
    credit_quality: "",
    seniority: "",
    price_provenance: {
      source: seed?.source ?? "Manual",
      as_of: new Date().toISOString().slice(0, 10),
      status: "manual",
      note: seed ? "Instrument identity discovered remotely; price entered manually." : null,
    },
  };
}

function inputNumber(value: string) {
  return value === "" ? null : Number(value);
}

export function PortfolioView({
  holdings,
  transactions,
  decisions,
  snapshots,
  fxRates,
  benchmarkPrices,
  displayCurrency,
  focusedHoldingId,
  instrumentSeed,
  onConsumeInstrumentSeed,
  onSaveHolding,
  onDeleteHolding,
  onSaveTransaction,
  onDeleteTransaction,
  onImportTransactions,
  onSaveDecision,
  onOpenResearch,
}: {
  holdings: Holding[];
  transactions: Transaction[];
  decisions: HoldingDecision[];
  snapshots: PortfolioSnapshot[];
  fxRates: Record<string, number>;
  benchmarkPrices: BenchmarkPricePoint[];
  displayCurrency: DisplayCurrency;
  focusedHoldingId: string | null;
  instrumentSeed: RemoteInstrument | null;
  onConsumeInstrumentSeed: () => void;
  onSaveHolding: (holding: Holding) => void;
  onDeleteHolding: (holdingId: string) => void;
  onSaveTransaction: (transaction: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onImportTransactions: (transactions: Transaction[]) => void;
  onSaveDecision: (decision: HoldingDecision) => void;
  onOpenResearch: (ticker: string | null | undefined) => void;
}) {
  const summary = useMemo(
    () => portfolioSummary(holdings, transactions, snapshots, fxRates),
    [fxRates, holdings, snapshots, transactions],
  );
  const effectiveHoldings = summary.positions.map((position) => position.holding);
  const assetAllocation = allocationBy(effectiveHoldings, "asset_type", fxRates);
  const regionAllocation = allocationBy(effectiveHoldings, "region", fxRates);
  const sectorAllocation = allocationBy(effectiveHoldings, "sector", fxRates).slice(0, 8);
  const [holdingEditor, setHoldingEditor] = useState<{ holding?: Holding; seed?: RemoteInstrument } | null>(null);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [decisionHolding, setDecisionHolding] = useState<Holding | null>(null);
  const [openMilestoneId, setOpenMilestoneId] = useState<string | null>("google-entry");
  const comparison = useMemo(
    () => buildBenchmarkComparison(snapshots, benchmarkPrices),
    [benchmarkPrices, snapshots],
  );

  const activeHoldingEditor = holdingEditor ?? (instrumentSeed ? { seed: instrumentSeed } : null);

  return (
    <>
      <div className="portfolio-layout portfolio-workbench">
        <section className="metric-grid portfolio-metrics">
          <Metric label="Portfolio value" value={formatMoney(summary.total, displayCurrency, fxRates)} />
          <Metric
            label="Total return"
            value={formatPercent(summary.gainPercent)}
            tone={summary.gainPercent >= 0 ? "good" : "bad"}
            note="Since the 2020 opening balance"
          />
          <Metric
            label="Unrealized gain"
            value={formatMoney(summary.unrealizedGain, displayCurrency, fxRates)}
            tone={summary.unrealizedGain >= 0 ? "good" : "bad"}
          />
          <Metric
            label="Money-weighted return"
            value={summary.moneyWeightedReturn === null ? "Needs cash flows" : formatPercent(summary.moneyWeightedReturn)}
            note="Annualized XIRR"
          />
        </section>

        <section className="panel wide performance-panel">
          <div className="panel-title-row">
            <div>
              <span className="eyebrow">Portfolio vs. S&amp;P 500</span>
              <h2>Indexed return since 2020</h2>
            </div>
            <div className="history-status">
              <span>Portfolio</span>
              <span className="benchmark-key">
                {comparison.benchmarkSource === "stored" ? "S&P 500 (stored closes)" : "S&P 500 reference"}
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={comparison.series}>
              <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#7f7a7d", fontSize: 11 }} tickFormatter={(value) => String(value).slice(0, 4)} />
              <YAxis
                width={58}
                tick={{ fill: "#7f7a7d", fontSize: 11 }}
                tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={darkTooltip}
                formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name === "portfolioReturn" ? "Portfolio" : "S&P 500 reference"]}
              />
              <Area
                type="monotone"
                dataKey="portfolioReturn"
                stroke="#f0edeb"
                strokeWidth={2}
                fill="rgba(255, 255, 255, 0.025)"
                activeDot={{ fill: "#df5268", stroke: "#f0edeb", strokeWidth: 2, r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="benchmarkReturn"
                stroke="#b94b5e"
                strokeWidth={1.6}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ fill: "#b94b5e", stroke: "#f0edeb", strokeWidth: 1, r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="panel-note">
            {comparison.benchmarkSource === "stored"
              ? `The S&P 500 line is computed from stored daily closes (Yahoo Finance, delayed), indexed to the portfolio where their histories first overlap${comparison.rebasedAt ? ` (${comparison.rebasedAt})` : ""}. Latest close ${comparison.benchmarkAsOf ?? "unknown"}. Price return, not total return: dividends are excluded.`
              : "Portfolio points are legacy estimates. The S&P 500 line is an indexed reference path, not a live total-return series; it is replaced automatically once stored benchmark closes exist."}
          </p>
        </section>

        <section className="panel wide portfolio-story-panel">
          <div className="panel-title-row">
            <div>
              <span className="eyebrow">Decision history</span>
              <h2>Trades worth remembering</h2>
            </div>
            <span className="story-count">5 recorded decisions</span>
          </div>
          <div className="portfolio-story-grid">
            {portfolioMilestones.map((milestone) => {
              const open = openMilestoneId === milestone.id;
              return (
                <button
                  key={milestone.id}
                  className={`portfolio-story-card ${milestone.accent} ${open ? "open" : ""}`}
                  onClick={() => setOpenMilestoneId(open ? null : milestone.id)}
                  aria-expanded={open}
                >
                  <span className="story-card-topline">
                    <i>{milestone.ticker}</i>
                    <em>{milestone.status}</em>
                  </span>
                  <strong>{milestone.instrument}</strong>
                  <span className="story-action">{milestone.action}</span>
                  <span className="story-open-label">{open ? "Hide review" : "Review decision"}{open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
                  {open ? (
                    <span className="story-details">
                      <span><small>Outcome</small>{milestone.outcome}</span>
                      <span><small>Lesson</small>{milestone.lesson}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="panel-note">Entries are based on your recollection and remain qualitative until dates, quantities, fees, and exact fills are added to the transaction ledger.</p>
        </section>

        <section className="panel wide holdings-panel">
          <div className="panel-title-row">
            <div>
              <span className="eyebrow">Current positions</span>
              <h2>Holdings</h2>
            </div>
            <div className="panel-actions">
              <button className="ghost-button" onClick={() => setTransactionOpen(true)}>
                <ReceiptText size={16} /> Record transaction
              </button>
              <button className="primary-button" onClick={() => setHoldingEditor({})}>
                <Plus size={16} /> Add holding
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Holding</th>
                  <th>Position</th>
                  <th>Price</th>
                  <th>Value</th>
                  <th>Unrealized</th>
                  <th>Exposure</th>
                  <th>Data</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {summary.positions.map((position) => {
                  const holding = position.holding;
                  return (
                    <tr
                      key={holding.id}
                      className={focusedHoldingId === holding.id ? "focused-row" : ""}
                      id={`holding-${holding.id}`}
                    >
                      <td>
                        <strong>{holding.name}</strong>
                        <span>{holding.ticker || "No ticker"} · {holding.asset_type.toUpperCase()}</span>
                      </td>
                      <td>
                        {position.quantity.toLocaleString("nb-NO", { maximumFractionDigits: 4 })}
                        <span>Avg. {holding.average_cost.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} {holding.currency}</span>
                      </td>
                      <td>
                        {holding.market_price === null
                          ? "Unavailable"
                          : `${holding.market_price.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} ${holding.currency}`}
                      </td>
                      <td><strong>{formatMoney(position.marketValueNok, displayCurrency, fxRates)}</strong></td>
                      <td className={position.unrealizedGainNok >= 0 ? "good" : "bad"}>
                        {formatMoney(position.unrealizedGainNok, displayCurrency, fxRates)}
                      </td>
                      <td>{holding.region || "Unclassified"}<span>{holding.sector || "No sector"}</span></td>
                      <td><ProvenanceBadge provenance={holding.price_provenance} compact /></td>
                      <td className="row-actions">
                        <button className="icon-button" onClick={() => onOpenResearch(holding.ticker)} title="Open company research">
                          <FlaskConical size={15} />
                        </button>
                        <button className="icon-button" onClick={() => setDecisionHolding(holding)} title="Decision Memory">
                          <BookOpen size={15} />
                        </button>
                        <button className="icon-button" onClick={() => setHoldingEditor({ holding })} title="Edit holding">
                          <Pencil size={15} />
                        </button>
                        <button className="icon-button danger" onClick={() => onDeleteHolding(holding.id)} title="Delete holding">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <AllocationPanel title="Asset allocation" data={assetAllocation} />
        <AllocationPanel title="Region exposure" data={regionAllocation} />

        <InvestorPlaybooks />

        <section className="panel wide">
          <div className="panel-title-row">
            <div><span className="eyebrow">Concentration</span><h2>Top sectors</h2></div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sectorAllocation}>
              <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#7f7a7d", fontSize: 11 }} />
              <YAxis tick={{ fill: "#7f7a7d", fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
              <Tooltip contentStyle={darkTooltip} formatter={(value) => `${Number(value).toFixed(1)}%`} />
              <Bar dataKey="percent" radius={[3, 3, 0, 0]} fill="#557c69" />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <TransactionLedger
          transactions={transactions}
          holdings={holdings}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
          onAdd={() => setTransactionOpen(true)}
          onImport={() => setImportOpen(true)}
          onDelete={onDeleteTransaction}
        />

        <DecisionMemoryPanel
          holdings={effectiveHoldings}
          decisions={decisions}
          onSelect={setDecisionHolding}
        />

        {effectiveHoldings.some((holding) => holding.asset_type === "bond") ? (
          <BondPanel
            holdings={effectiveHoldings.filter((holding) => holding.asset_type === "bond")}
            displayCurrency={displayCurrency}
            fxRates={fxRates}
          />
        ) : null}
      </div>

      {activeHoldingEditor ? (
        <HoldingEditor
          holding={activeHoldingEditor.holding}
          seed={activeHoldingEditor.seed}
          onClose={() => {
            setHoldingEditor(null);
            onConsumeInstrumentSeed();
          }}
          onSave={(holding) => {
            onSaveHolding(holding);
            setHoldingEditor(null);
            onConsumeInstrumentSeed();
          }}
        />
      ) : null}
      {transactionOpen ? (
        <TransactionEditor
          holdings={holdings}
          onClose={() => setTransactionOpen(false)}
          onSave={(transaction) => {
            onSaveTransaction(transaction);
            setTransactionOpen(false);
          }}
        />
      ) : null}
      {importOpen ? (
        <CsvImportDialog
          holdings={holdings}
          transactions={transactions}
          onClose={() => setImportOpen(false)}
          onImport={(drafts) => {
            onImportTransactions(drafts);
            setImportOpen(false);
          }}
        />
      ) : null}
      {decisionHolding ? (
        <DecisionEditor
          holding={decisionHolding}
          history={decisions.filter((decision) => decision.holding_id === decisionHolding.id)}
          onClose={() => setDecisionHolding(null)}
          onSave={(decision) => {
            onSaveDecision(decision);
            setDecisionHolding(null);
          }}
        />
      ) : null}
    </>
  );
}

function Metric({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
  note?: string;
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {note ? <em>{note}</em> : null}
    </article>
  );
}

function AllocationPanel({
  title,
  data,
}: {
  title: string;
  data: Array<{ name: string; value: number; percent: number }>;
}) {
  let cursor = 0;
  const gradient = data.length
    ? `conic-gradient(${data.map((row, index) => {
      const start = cursor;
      cursor += row.percent;
      return `${chartColors[index % chartColors.length]} ${start}% ${cursor}%`;
    }).join(", ")})`
    : "conic-gradient(#52675a 0 100%)";

  return (
    <section className="panel allocation-panel">
      <h2>{title}</h2>
      <div className="allocation-content">
        <div className="allocation-chart">
          <div
            className="allocation-donut"
            style={{ background: gradient }}
            role="img"
            aria-label={`${title}: ${data.map((row) => `${row.name} ${formatPercent(row.percent)}`).join(", ")}`}
          >
            <div><strong>{data.length}</strong><span>segments</span></div>
          </div>
        </div>
        <div className="legend-list">
          {data.map((row, index) => (
            <div key={row.name}>
              <i style={{ background: chartColors[index % chartColors.length] }} />
              <span>{row.name}</span>
              <strong>{formatPercent(row.percent)}</strong>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HoldingEditor({
  holding,
  seed,
  onClose,
  onSave,
}: {
  holding?: Holding;
  seed?: RemoteInstrument;
  onClose: () => void;
  onSave: (holding: Holding) => void;
}) {
  const [draft, setDraft] = useState<Holding>(() => holding ? structuredClone(holding) : blankHolding(seed));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  function update<Key extends keyof Holding>(key: Key, value: Holding[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="modal holding-modal" role="dialog" aria-modal="true" aria-labelledby="holding-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{holding ? "Position settings" : seed ? `Discovered via ${seed.source}` : "Manual portfolio entry"}</span>
            <h2 id="holding-title">{holding ? `Edit ${holding.name}` : "Add holding"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close holding editor"><X size={17} /></button>
        </div>

        <div className="form-section">
          <h3>Identity</h3>
          <div className="form-grid">
            <Field label="Type">
              <select value={draft.asset_type} onChange={(event) => update("asset_type", event.target.value as AssetType)}>
                <option value="stock">Stock</option>
                <option value="etf">ETF</option>
                <option value="cash">Cash</option>
                <option value="bond">Individual bond</option>
              </select>
            </Field>
            <Field label="Ticker"><input value={draft.ticker ?? ""} onChange={(event) => update("ticker", event.target.value)} /></Field>
            <Field label="Name"><input value={draft.name} onChange={(event) => update("name", event.target.value)} /></Field>
            <Field label="Currency"><input value={draft.currency} maxLength={3} onChange={(event) => update("currency", event.target.value.toUpperCase())} /></Field>
          </div>
        </div>

        <div className="form-section">
          <h3>Position and valuation</h3>
          <div className="form-grid">
            <Field label="Opening quantity"><input type="number" min="0" step="any" value={draft.quantity} onChange={(event) => update("quantity", Number(event.target.value))} /></Field>
            <Field label="Average cost"><input type="number" min="0" step="any" value={draft.average_cost} onChange={(event) => update("average_cost", Number(event.target.value))} /></Field>
            <Field label="Latest close"><input type="number" min="0" step="any" value={draft.market_price ?? ""} onChange={(event) => update("market_price", inputNumber(event.target.value))} /></Field>
            <Field label="Manual NOK value"><input type="number" min="0" step="any" value={draft.manual_value_nok ?? ""} onChange={(event) => update("manual_value_nok", inputNumber(event.target.value))} /></Field>
          </div>
        </div>

        <button className="advanced-toggle" onClick={() => setDetailsOpen((current) => !current)}>
          {detailsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          Identifiers, classification, and data source
        </button>
        {detailsOpen ? (
          <div className="form-section optional-details">
            <div className="form-grid">
              <Field label="ISIN"><input value={draft.isin ?? ""} onChange={(event) => update("isin", event.target.value.toUpperCase())} /></Field>
              <Field label="FIGI"><input value={draft.figi ?? ""} onChange={(event) => update("figi", event.target.value)} /></Field>
              <Field label="Exchange"><input value={draft.exchange ?? ""} onChange={(event) => update("exchange", event.target.value)} /></Field>
              <Field label="Country"><input value={draft.country ?? ""} onChange={(event) => update("country", event.target.value)} /></Field>
              <Field label="Region"><input value={draft.region ?? ""} onChange={(event) => update("region", event.target.value)} /></Field>
              <Field label="Sector"><input value={draft.sector ?? ""} onChange={(event) => update("sector", event.target.value)} /></Field>
              <Field label="Price source"><input value={draft.price_provenance.source} onChange={(event) => update("price_provenance", { ...draft.price_provenance, source: event.target.value })} /></Field>
              <Field label="Price date"><input type="date" value={draft.price_provenance.as_of ?? ""} onChange={(event) => update("price_provenance", { ...draft.price_provenance, as_of: event.target.value })} /></Field>
              <Field label="Data status">
                <select value={draft.price_provenance.status} onChange={(event) => update("price_provenance", {
                  ...draft.price_provenance,
                  status: event.target.value as Holding["price_provenance"]["status"],
                })}>
                  <option value="manual">Manual</option>
                  <option value="delayed">Delayed</option>
                  <option value="estimated">Estimated</option>
                  <option value="stale">Stale</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </Field>
              <Field label="Account note" wide><input value={draft.account_note ?? ""} onChange={(event) => update("account_note", event.target.value)} /></Field>
            </div>
          </div>
        ) : null}

        {draft.asset_type === "bond" ? (
          <div className="form-section">
            <h3>Bond details</h3>
            <div className="form-grid">
              <Field label="Issuer"><input value={draft.issuer ?? ""} onChange={(event) => update("issuer", event.target.value)} /></Field>
              <Field label="Coupon %"><input type="number" step="any" value={draft.coupon_rate ?? ""} onChange={(event) => update("coupon_rate", inputNumber(event.target.value))} /></Field>
              <Field label="Maturity"><input type="date" value={draft.maturity_date ?? ""} onChange={(event) => update("maturity_date", event.target.value)} /></Field>
              <Field label="Face value"><input type="number" step="any" value={draft.face_value ?? ""} onChange={(event) => update("face_value", inputNumber(event.target.value))} /></Field>
              <Field label="Yield estimate %"><input type="number" step="any" value={draft.yield_estimate ?? ""} onChange={(event) => update("yield_estimate", inputNumber(event.target.value))} /></Field>
              <Field label="Duration estimate"><input type="number" step="any" value={draft.duration_estimate ?? ""} onChange={(event) => update("duration_estimate", inputNumber(event.target.value))} /></Field>
              <Field label="Credit quality"><input value={draft.credit_quality ?? ""} onChange={(event) => update("credit_quality", event.target.value)} /></Field>
              <Field label="Seniority/type"><input value={draft.seniority ?? ""} onChange={(event) => update("seniority", event.target.value)} /></Field>
            </div>
          </div>
        ) : null}

        <button className="advanced-toggle" onClick={() => setAdvanced((current) => !current)}>
          {advanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          Advanced factor exposures
        </button>
        {advanced ? (
          <div className="factor-grid">
            {Object.entries(draft.factor_exposures).map(([key, value]) => (
              <Field label={key} key={key}>
                <input
                  type="number"
                  step="0.1"
                  value={value ?? 0}
                  onChange={(event) => update("factor_exposures", {
                    ...draft.factor_exposures,
                    [key]: Number(event.target.value),
                  })}
                />
              </Field>
            ))}
          </div>
        ) : null}

        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>Cancel</button>
          <button
            className="primary-button"
            disabled={!draft.name.trim() || !draft.currency.trim()}
            onClick={() => onSave({ ...draft, id: draft.id || crypto.randomUUID() })}
          >
            <Save size={16} /> Save holding
          </button>
        </div>
      </section>
    </div>
  );
}

function TransactionEditor({
  holdings,
  onClose,
  onSave,
}: {
  holdings: Holding[];
  onClose: () => void;
  onSave: (transaction: Transaction) => void;
}) {
  const [type, setType] = useState<TransactionType>("buy");
  const [holdingId, setHoldingId] = useState(holdings[0]?.id ?? "");
  const holding = holdings.find((item) => item.id === holdingId);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("0");
  const [currency, setCurrency] = useState(holding?.currency ?? "NOK");
  const [fx, setFx] = useState(currency === "NOK" ? "1" : "1");
  const [splitRatio, setSplitRatio] = useState("");
  const [note, setNote] = useState("");
  const requiresHolding = !["deposit", "withdrawal"].includes(type);
  const usesQuantity = ["opening_balance", "buy", "sell"].includes(type);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title">
        <div className="modal-heading">
          <div><span className="eyebrow">Portfolio ledger</span><h2 id="transaction-title">Record transaction</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close transaction editor"><X size={17} /></button>
        </div>
        <div className="form-grid two-column">
          <Field label="Transaction type">
            <select value={type} onChange={(event) => setType(event.target.value as TransactionType)}>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="dividend">Dividend</option>
              <option value="fee">Fee</option>
              <option value="split">Stock split</option>
              <option value="opening_balance">Opening balance</option>
            </select>
          </Field>
          <Field label="Date"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          {requiresHolding ? (
            <Field label="Holding" wide>
              <select value={holdingId} onChange={(event) => {
                setHoldingId(event.target.value);
                const selected = holdings.find((item) => item.id === event.target.value);
                if (selected) setCurrency(selected.currency);
              }}>
                {holdings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
          ) : null}
          {usesQuantity ? <Field label="Quantity"><input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></Field> : null}
          {usesQuantity ? <Field label="Unit price"><input type="number" min="0" step="any" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} /></Field> : null}
          {!usesQuantity && type !== "split" ? <Field label="Amount"><input type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field> : null}
          {type === "split" ? <Field label="Split ratio"><input type="number" min="0" step="any" placeholder="e.g. 2" value={splitRatio} onChange={(event) => setSplitRatio(event.target.value)} /></Field> : null}
          <Field label="Fee"><input type="number" min="0" step="any" value={fee} onChange={(event) => setFee(event.target.value)} /></Field>
          <Field label="Currency"><input value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></Field>
          <Field label="FX to NOK"><input type="number" min="0" step="any" value={fx} onChange={(event) => setFx(event.target.value)} /></Field>
          <Field label="Decision note" wide><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why did you make this transaction?" /></Field>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>Cancel</button>
          <button
            className="primary-button"
            disabled={(requiresHolding && !holdingId) || (usesQuantity && (!quantity || !unitPrice)) || (!usesQuantity && type !== "split" && !amount)}
            onClick={() => onSave({
              id: crypto.randomUUID(),
              holding_id: requiresHolding ? holdingId : null,
              type,
              occurred_at: date,
              quantity: usesQuantity ? Number(quantity) : null,
              unit_price: usesQuantity ? Number(unitPrice) : null,
              amount: !usesQuantity && type !== "split" ? Number(amount) : null,
              fee: Number(fee) || 0,
              currency,
              fx_to_nok: Number(fx) || 1,
              split_ratio: type === "split" ? Number(splitRatio) : null,
              note: note || null,
            })}
          >
            <Save size={16} /> Add to ledger
          </button>
        </div>
      </section>
    </div>
  );
}

function TransactionLedger({
  transactions,
  holdings,
  displayCurrency,
  fxRates,
  onAdd,
  onImport,
  onDelete,
}: {
  transactions: Transaction[];
  holdings: Holding[];
  displayCurrency: DisplayCurrency;
  fxRates: Record<string, number>;
  onAdd: () => void;
  onImport: () => void;
  onDelete: (id: string) => void;
}) {
  const holdingById = new Map(holdings.map((holding) => [holding.id, holding]));
  const ordered = [...transactions].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return (
    <section className="panel wide">
      <div className="panel-title-row">
        <div><span className="eyebrow">Source of truth</span><h2>Transaction ledger</h2></div>
        <div className="panel-actions">
          <button className="ghost-button" onClick={onImport}><FileUp size={16} /> Import from broker</button>
          <button className="ghost-button" onClick={onAdd}><Plus size={16} /> Record transaction</button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Holding</th><th>Quantity</th><th>Amount</th><th>FX</th><th>Note</th><th /></tr></thead>
          <tbody>
            {ordered.map((transaction) => {
              const holding = transaction.holding_id ? holdingById.get(transaction.holding_id) : null;
              const rawAmount = transaction.amount ??
                ((transaction.quantity ?? 0) * (transaction.unit_price ?? 0) + transaction.fee);
              return (
                <tr key={transaction.id}>
                  <td>{transaction.occurred_at}</td>
                  <td><strong>{transaction.type.replaceAll("_", " ")}</strong></td>
                  <td>{holding?.ticker ?? holding?.name ?? "Portfolio cash"}</td>
                  <td>{transaction.quantity ?? "—"}</td>
                  <td>{formatMoney(rawAmount * transaction.fx_to_nok, displayCurrency, fxRates)}</td>
                  <td>{transaction.fx_to_nok.toFixed(2)}</td>
                  <td>{transaction.note ?? "—"}</td>
                  <td><button className="icon-button danger" onClick={() => onDelete(transaction.id)} title="Delete transaction"><Trash2 size={14} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DecisionMemoryPanel({
  holdings,
  decisions,
  onSelect,
}: {
  holdings: Holding[];
  decisions: HoldingDecision[];
  onSelect: (holding: Holding) => void;
}) {
  return (
    <section className="panel wide">
      <div className="panel-title-row">
        <div><span className="eyebrow">Investment discipline</span><h2>Decision Memory</h2></div>
        <BookOpen size={20} />
      </div>
      <div className="decision-grid">
        {holdings.map((holding) => {
          const history = decisions
            .filter((decision) => decision.holding_id === holding.id)
            .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
          const latest = history[0];
          return (
            <button key={holding.id} onClick={() => onSelect(holding)}>
              <div><strong>{holding.ticker ?? holding.name}</strong><span>{latest?.status ?? "No decision"}</span></div>
              <p>{latest?.thesis ?? "Record why this holding belongs in the portfolio."}</p>
              <footer>
                <span>Conviction {latest ? `${latest.conviction}/5` : "—"}</span>
                <span>{latest?.review_date ? `Review ${latest.review_date}` : "No review date"}</span>
              </footer>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DecisionEditor({
  holding,
  history,
  onClose,
  onSave,
}: {
  holding: Holding;
  history: HoldingDecision[];
  onClose: () => void;
  onSave: (decision: HoldingDecision) => void;
}) {
  const latest = [...history].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
  const [draft, setDraft] = useState({
    status: latest?.status ?? "hold",
    thesis: latest?.thesis ?? "",
    reason: latest?.reason_for_ownership ?? "",
    drivers: latest?.return_drivers ?? "",
    risks: latest?.risks ?? "",
    conviction: latest?.conviction ?? 3,
    reviewDate: latest?.review_date ?? "",
    note: "",
  });

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="modal decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-title">
        <div className="modal-heading">
          <div><span className="eyebrow">{holding.ticker ?? holding.name}</span><h2 id="decision-title">Decision Memory</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close Decision Memory"><X size={17} /></button>
        </div>
        <div className="decision-editor-grid">
          <div className="decision-form">
            <div className="form-grid two-column">
              <Field label="Current stance">
                <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as HoldingDecision["status"] })}>
                  <option value="watch">Watch</option><option value="buy">Buy</option><option value="hold">Hold</option><option value="sell">Sell</option><option value="sold">Sold</option>
                </select>
              </Field>
              <Field label={`Conviction ${draft.conviction}/5`}>
                <input type="range" min="1" max="5" value={draft.conviction} onChange={(event) => setDraft({ ...draft, conviction: Number(event.target.value) })} />
              </Field>
              <Field label="Review date"><input type="date" value={draft.reviewDate} onChange={(event) => setDraft({ ...draft, reviewDate: event.target.value })} /></Field>
            </div>
            <Field label="Thesis"><textarea value={draft.thesis} onChange={(event) => setDraft({ ...draft, thesis: event.target.value })} /></Field>
            <Field label="Reason for ownership"><textarea value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></Field>
            <Field label="Expected return drivers"><textarea value={draft.drivers} onChange={(event) => setDraft({ ...draft, drivers: event.target.value })} /></Field>
            <Field label="Risks that could break the thesis"><textarea value={draft.risks} onChange={(event) => setDraft({ ...draft, risks: event.target.value })} /></Field>
            <Field label="What changed since the last entry?"><textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></Field>
          </div>
          <aside className="decision-history">
            <h3>History</h3>
            {history.length ? [...history].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)).map((item) => (
              <article key={item.id}>
                <span>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(item.recorded_at))}</span>
                <strong>{item.status} · {item.conviction}/5</strong>
                <p>{item.thesis}</p>
                {item.note ? <em>{item.note}</em> : null}
              </article>
            )) : <p>No prior decision entries.</p>}
          </aside>
        </div>
        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={!draft.thesis.trim()} onClick={() => onSave({
            id: crypto.randomUUID(),
            holding_id: holding.id,
            status: draft.status as HoldingDecision["status"],
            thesis: draft.thesis,
            reason_for_ownership: draft.reason,
            return_drivers: draft.drivers,
            risks: draft.risks,
            conviction: draft.conviction,
            review_date: draft.reviewDate || null,
            note: draft.note || null,
            recorded_at: new Date().toISOString(),
          })}><Save size={16} /> Record new entry</button>
        </div>
      </section>
    </div>
  );
}

function BondPanel({
  holdings,
  displayCurrency,
  fxRates,
}: {
  holdings: Holding[];
  displayCurrency: DisplayCurrency;
  fxRates: Record<string, number>;
}) {
  const rows = replayTransactions(holdings, [], fxRates);
  return (
    <section className="panel wide">
      <div className="panel-title-row">
        <div><span className="eyebrow">Fixed income</span><h2>Bond exposure</h2></div>
        <CircleDollarSign size={20} />
      </div>
      <div className="bond-grid">
        {rows.map(({ holding, marketValueNok }) => (
          <article key={holding.id}>
            <strong>{holding.issuer || holding.name}</strong>
            <span>{formatMoney(marketValueNok, displayCurrency, fxRates)}</span>
            <dl>
              <div><dt>Coupon</dt><dd>{holding.coupon_rate ?? "—"}%</dd></div>
              <div><dt>Maturity</dt><dd>{holding.maturity_date ?? "—"}</dd></div>
              <div><dt>Duration</dt><dd>{holding.duration_estimate ?? "—"}</dd></div>
              <div><dt>Credit</dt><dd>{holding.credit_quality ?? "Unrated"}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return <label className={`field${wide ? " wide-field" : ""}`}><span>{label}</span>{children}</label>;
}
