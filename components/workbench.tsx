"use client";

import {
  CircleGauge,
  Globe2,
  Newspaper,
  SlidersHorizontal,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { InsightsView } from "@/components/insights-view";
import { fallbackFxRates, latestFxRatesFromRows, type FxRateRow, type FxRates } from "@/lib/fx";
import type { BenchmarkPricePoint } from "@/lib/portfolio-story";
import {
  sampleDecisions,
  sampleEvents,
  sampleHoldings,
  sampleSnapshots,
  sampleTransactions,
  scenarioPresets,
} from "@/lib/sample-data";
import { createClient } from "@/lib/supabase";
import type { AtlasScenarioHandoff } from "@/lib/stress-portfolio";
import type {
  DisplayCurrency,
  Holding,
  HoldingDecision,
  MarketEvent,
  PortfolioSnapshot,
  SavedScenario,
  Scenario,
  Transaction,
} from "@/lib/types";

const GlobalMapView = dynamic(
  () => import("@/components/global-map-view").then((module) => module.GlobalMapView),
  { ssr: false, loading: () => <div className="view-loading">Loading market map...</div> },
);
const PortfolioView = dynamic(
  () => import("@/components/portfolio-view").then((module) => module.PortfolioView),
  { ssr: false, loading: () => <div className="view-loading">Loading portfolio...</div> },
);
const ScenarioView = dynamic(
  () => import("@/components/scenario-view").then((module) => module.ScenarioView),
  { ssr: false, loading: () => <div className="view-loading">Loading scenario tools...</div> },
);
const EarningsCalendarView = dynamic(
  () => import("@/components/earnings-calendar-view").then((module) => module.EarningsCalendarView),
  { ssr: false, loading: () => <div className="view-loading">Loading event calendar...</div> },
);
const CompanyResearchView = dynamic(
  () => import("@/components/company-research-view").then((module) => module.CompanyResearchView),
  { ssr: false, loading: () => <div className="view-loading">Loading company research...</div> },
);
const AnalystDeskView = dynamic(
  () => import("@/components/analyst-desk-view").then((module) => module.AnalystDeskView),
  { ssr: false, loading: () => <div className="view-loading">Loading the analyst desk...</div> },
);
const JudgmentView = dynamic(
  () => import("@/components/judgment-view").then((module) => module.JudgmentView),
  { ssr: false, loading: () => <div className="view-loading">Loading decision review...</div> },
);

type Tab = "insights" | "portfolio" | "analyst" | "judgment" | "map" | "scenarios" | "calendar" | "research";

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "map", label: "Atlas", icon: Globe2 },
  { id: "scenarios", label: "Scenarios", icon: SlidersHorizontal },
  { id: "insights", label: "Insights", icon: Newspaper },
];

// PostgREST caps an unbounded select (1000 rows by default), which would silently
// truncate a multi-year benchmark history to its oldest page and freeze the chart.
async function loadBenchmarkPrices(
  client: NonNullable<ReturnType<typeof createClient>>,
  symbol: string,
) {
  const pageSize = 1000;
  const rows: BenchmarkPricePoint[] = [];
  for (let page = 0; ; page += 1) {
    const { data, error } = await client
      .from("benchmark_prices")
      .select("price_date,close")
      .eq("symbol", symbol)
      .order("price_date")
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []) as BenchmarkPricePoint[]);
    if ((data?.length ?? 0) < pageSize) return { data: rows, error: null };
  }
}

function normalizeHolding(holding: Holding): Holding {
  return {
    ...holding,
    price_provenance: holding.price_provenance ?? {
      source: "Manual",
      as_of: holding.updated_at?.slice(0, 10) ?? null,
      status: "manual",
    },
  };
}

export function Workbench({
  initialAsOf,
  initialGeneratedAt,
}: {
  initialAsOf: string;
  initialGeneratedAt: string;
}) {
  const configured = false;
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("NOK");
  const [holdings, setHoldings] = useState<Holding[]>(configured ? [] : sampleHoldings);
  const [transactions, setTransactions] = useState<Transaction[]>(configured ? [] : sampleTransactions);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>(configured ? [] : sampleSnapshots);
  const [decisions, setDecisions] = useState<HoldingDecision[]>(configured ? [] : sampleDecisions);
  const [events, setEvents] = useState<MarketEvent[]>(configured ? [] : sampleEvents);
  const [fxRates, setFxRates] = useState<FxRates>(fallbackFxRates);
  const [benchmarkPrices, setBenchmarkPrices] = useState<BenchmarkPricePoint[]>([]);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [scenario, setScenario] = useState<Scenario>({ ...scenarioPresets[0].shocks });
  const [activePresetId, setActivePresetId] = useState(scenarioPresets[0].id);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(configured);
  const [status, setStatus] = useState("Public session · changes stay in this browser tab");
  const [focusedHoldingId, setFocusedHoldingId] = useState<string | null>(null);
  const instrumentSeed = null;
  const [requestedCountry, setRequestedCountry] = useState<string | null>(null);
  const [atlasHandoff, setAtlasHandoff] = useState<AtlasScenarioHandoff | null>(null);
  const [researchTicker, setResearchTicker] = useState("MSFT");

  useEffect(() => {
    if (!configured || !supabase) return;

    async function loadWorkspace() {
      const { data: authData } = await supabase!.auth.getUser();
      if (!authData.user) {
        window.location.href = "/login";
        return;
      }
      setUserId(authData.user.id);

      const [
        holdingRows,
        transactionRows,
        snapshotRows,
        decisionRows,
        eventRows,
        scenarioRows,
        fxRows,
        benchmarkRows,
      ] = await Promise.all([
        supabase!.from("holdings").select("*").order("created_at"),
        supabase!.from("transactions").select("*").order("occurred_at"),
        supabase!.from("portfolio_snapshots").select("*").order("snapshot_date"),
        supabase!.from("holding_decisions").select("*").order("recorded_at"),
        supabase!.from("market_events").select("*").order("event_date"),
        supabase!.from("saved_scenarios").select("*").order("created_at", { ascending: false }),
        supabase!.from("fx_rates").select("base_currency,quote_currency,rate,as_of,source").order("as_of", { ascending: false }).limit(120),
        loadBenchmarkPrices(supabase!, "^GSPC"),
      ]);

      const firstError = [
        holdingRows.error,
        transactionRows.error,
        snapshotRows.error,
        decisionRows.error,
        eventRows.error,
        scenarioRows.error,
      ].find(Boolean);
      if (firstError) {
        setStatus(`Workspace loaded with a data warning: ${firstError.message}`);
      } else {
        setStatus("Private workspace · daily close mode");
      }

      if (!fxRows.error) {
        setFxRates(latestFxRatesFromRows((fxRows.data ?? []) as FxRateRow[]));
      }
      if (!benchmarkRows.error) {
        setBenchmarkPrices((benchmarkRows.data ?? []) as BenchmarkPricePoint[]);
      }
      setHoldings(((holdingRows.data ?? []) as unknown as Holding[]).map(normalizeHolding));
      setTransactions((transactionRows.data ?? []) as unknown as Transaction[]);
      setSnapshots((snapshotRows.data ?? []) as unknown as PortfolioSnapshot[]);
      setDecisions((decisionRows.data ?? []) as unknown as HoldingDecision[]);
      setEvents((eventRows.data ?? []) as unknown as MarketEvent[]);
      setSavedScenarios((scenarioRows.data ?? []) as unknown as SavedScenario[]);
      setLoading(false);
    }

    loadWorkspace();
  }, [configured, supabase]);

  function openTab(tab: Tab) {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  }

  function openResearch(ticker: string | null | undefined) {
    if (ticker) setResearchTicker(ticker.toUpperCase());
    openTab("research");
  }

  async function saveHolding(holding: Holding) {
    const isNew = !holdings.some((item) => item.id === holding.id);
    const normalized = normalizeHolding(holding);
    setHoldings((current) => isNew
      ? [...current, normalized]
      : current.map((item) => item.id === holding.id ? normalized : item));

    if (isNew && holding.quantity > 0) {
      const opening: Transaction = {
        id: crypto.randomUUID(),
        holding_id: holding.id,
        type: "opening_balance",
        occurred_at: new Date().toISOString().slice(0, 10),
        quantity: holding.quantity,
        unit_price: holding.average_cost,
        amount: null,
        fee: 0,
        currency: holding.currency,
        fx_to_nok: holding.currency === "NOK" ? 1 : 1,
        split_ratio: null,
        note: "Opening balance created with the holding.",
      };
      setTransactions((current) => [...current, opening]);
      if (supabase && userId) {
        await supabase.from("transactions").insert({ ...opening, user_id: userId });
      }
    }

    if (supabase && userId) {
      const { error } = await supabase.from("holdings").upsert({ ...normalized, user_id: userId });
      setStatus(error ? error.message : `${holding.name} saved.`);
    } else {
      setStatus(`${holding.name} saved in this preview session.`);
    }
  }

  async function deleteHolding(id: string) {
    const holding = holdings.find((item) => item.id === id);
    if (!holding || !window.confirm(`Delete ${holding.name} and its linked ledger history?`)) return;
    setHoldings((current) => current.filter((item) => item.id !== id));
    setTransactions((current) => current.filter((transaction) => transaction.holding_id !== id));
    setDecisions((current) => current.filter((decision) => decision.holding_id !== id));
    if (supabase && userId) {
      const { error } = await supabase.from("holdings").delete().eq("id", id).eq("user_id", userId);
      setStatus(error ? error.message : `${holding.name} deleted.`);
    }
  }

  async function saveTransaction(transaction: Transaction) {
    setTransactions((current) => [...current.filter((item) => item.id !== transaction.id), transaction]);
    if (supabase && userId) {
      const { error } = await supabase.from("transactions").upsert({ ...transaction, user_id: userId });
      setStatus(error ? error.message : "Transaction recorded.");
    } else {
      setStatus("Transaction recorded in this preview session.");
    }
  }

  async function importTransactions(drafts: Transaction[]) {
    if (!drafts.length) return;
    setTransactions((current) => [...current, ...drafts]);

    if (!supabase || !userId) {
      setStatus(`${drafts.length} imported transactions added to this preview session.`);
      return;
    }

    const { error } = await supabase
      .from("transactions")
      .insert(drafts.map((draft) => ({ ...draft, user_id: userId })));
    if (error) {
      const importedIds = new Set(drafts.map((draft) => draft.id));
      setTransactions((current) => current.filter((item) => !importedIds.has(item.id)));
      setStatus(error.code === "23505"
        ? "Nothing imported: some of these rows are already in the ledger. Reopen the importer to refresh."
        : `Nothing imported: ${error.message}`);
      return;
    }
    setStatus(`Imported ${drafts.length} transaction${drafts.length === 1 ? "" : "s"}.`);
  }

  async function deleteTransaction(id: string) {
    if (!window.confirm("Delete this ledger entry? Portfolio returns will be recalculated.")) return;
    setTransactions((current) => current.filter((item) => item.id !== id));
    if (supabase && userId) {
      const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", userId);
      setStatus(error ? error.message : "Transaction deleted.");
    }
  }

  async function saveDecision(decision: HoldingDecision) {
    setDecisions((current) => [...current, decision]);
    if (supabase && userId) {
      const { error } = await supabase.from("holding_decisions").insert({ ...decision, user_id: userId });
      setStatus(error ? error.message : "Decision Memory updated.");
    } else {
      setStatus("Decision Memory updated in this preview session.");
    }
  }

  async function saveScenario(saved: SavedScenario) {
    setSavedScenarios((current) => [saved, ...current]);
    if (supabase && userId) {
      const { error } = await supabase.from("saved_scenarios").insert({ ...saved, user_id: userId });
      setStatus(error ? error.message : "Scenario saved.");
    }
  }

  async function deleteScenario(id: string) {
    setSavedScenarios((current) => current.filter((saved) => saved.id !== id));
    if (supabase && userId) {
      const { error } = await supabase.from("saved_scenarios").delete().eq("id", id).eq("user_id", userId);
      setStatus(error ? error.message : "Scenario deleted.");
    }
  }

  const consumeInstrumentSeed = () => {};
  if (loading) {
    return (
      <main className="app-shell centered">
        <div className="loader-card">
          <CircleGauge size={28} />
          <p>{status}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-masthead">
        <div className="brand">
          <strong
            className="masthead-wordmark"
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const x = ((event.clientX - bounds.left) / bounds.width) * 100;
              const y = ((event.clientY - bounds.top) / bounds.height) * 100;
              event.currentTarget.style.setProperty("--wordmark-shine-x", `${x}%`);
              event.currentTarget.style.setProperty("--wordmark-shine-y", `${y}%`);
            }}
            onPointerLeave={(event) => {
              event.currentTarget.style.setProperty("--wordmark-shine-x", "42%");
              event.currentTarget.style.setProperty("--wordmark-shine-y", "45%");
            }}
          >
            Aurelian Capital
          </strong>
        </div>
        <div className="masthead-controls">
          <div className="currency-toggle" aria-label="Display currency">
            <button className={displayCurrency === "NOK" ? "active" : ""} onClick={() => setDisplayCurrency("NOK")}>NOK</button>
            <button className={displayCurrency === "EUR" ? "active" : ""} onClick={() => setDisplayCurrency("EUR")}>EUR</button>
          </div>
        </div>
      </header>

      <section className="workspace">
        <div className="view-stage" key={activeTab} role="region" aria-label={`${tabs.find((tab) => tab.id === activeTab)?.label} view`}>
          {activeTab === "insights" ? (
            <InsightsView
              asOf={initialAsOf}
              generatedAt={initialGeneratedAt}
              fxMeta={fxRates}
              benchmarkAsOf={benchmarkPrices.at(-1)?.price_date ?? null}
              onOpenMarket={(country) => {
                setRequestedCountry(country);
                openTab("map");
              }}
            />
          ) : null}
          {activeTab === "portfolio" ? (
            <PortfolioView
              holdings={holdings}
              transactions={transactions}
              snapshots={snapshots}
              decisions={decisions}
              fxRates={fxRates.rates}
              benchmarkPrices={benchmarkPrices}
              displayCurrency={displayCurrency}
              focusedHoldingId={focusedHoldingId}
              instrumentSeed={instrumentSeed}
              onConsumeInstrumentSeed={consumeInstrumentSeed}
              onSaveHolding={saveHolding}
              onDeleteHolding={deleteHolding}
              onSaveTransaction={saveTransaction}
              onDeleteTransaction={deleteTransaction}
              onImportTransactions={importTransactions}
              onSaveDecision={saveDecision}
              onOpenResearch={openResearch}
            />
          ) : null}
          {activeTab === "analyst" ? (
            <AnalystDeskView
              holdings={holdings}
              transactions={transactions}
              snapshots={snapshots}
              fxRates={fxRates.rates}
              displayCurrency={displayCurrency}
            />
          ) : null}
          {activeTab === "judgment" ? (
            <JudgmentView
              holdings={holdings}
              transactions={transactions}
              snapshots={snapshots}
              decisions={decisions}
              fxRates={fxRates.rates}
              displayCurrency={displayCurrency}
              asOf={initialAsOf}
              onOpenHolding={(holdingId) => {
                openTab("portfolio");
                setFocusedHoldingId(holdingId);
                window.setTimeout(
                  () => document.getElementById(`holding-${holdingId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
                  100,
                );
              }}
            />
          ) : null}
          {activeTab === "research" ? (
            <CompanyResearchView
              holdings={holdings}
              selectedTicker={researchTicker}
              onSelectedTicker={setResearchTicker}
            />
          ) : null}
          {activeTab === "calendar" ? (
            <EarningsCalendarView
              holdings={holdings}
              events={events}
              onOpenResearch={openResearch}
            />
          ) : null}
          {activeTab === "map" ? (
            <GlobalMapView
              key={`${requestedCountry ?? "default-map"}-${atlasHandoff?.id ?? "fresh"}`}
              requestedCountry={requestedCountry}
              restoreComparison={atlasHandoff?.context ?? null}
              initialInstrumentIds={atlasHandoff?.instrumentIds ?? []}
              onSendToScenarios={(handoff) => {
                setAtlasHandoff(handoff);
                openTab("scenarios");
              }}
            />
          ) : null}
          {activeTab === "scenarios" ? (
            <ScenarioView
              fxRates={fxRates.rates}
              displayCurrency={displayCurrency}
              scenario={scenario}
              setScenario={setScenario}
              activePresetId={activePresetId}
              setActivePresetId={setActivePresetId}
              savedScenarios={savedScenarios}
              onSaveScenario={saveScenario}
              onDeleteScenario={deleteScenario}
              atlasHandoff={atlasHandoff}
              onReturnToAtlas={() => {
                setRequestedCountry(atlasHandoff?.context.primaryCountry ?? null);
                openTab("map");
              }}
            />
          ) : null}
        </div>
      </section>

      <nav className="floating-dock" aria-label="Primary navigation">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => openTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              aria-label={tab.label}
              title={tab.label}
            >
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}
