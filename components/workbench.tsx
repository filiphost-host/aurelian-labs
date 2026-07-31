"use client";

import {
  BarChart3,
  CircleGauge,
  Globe2,
  LogOut,
  Newspaper,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InsightsView } from "@/components/insights-view";
import {
  SearchCommand,
  type RemoteInstrument,
} from "@/components/search-command";
import { buildDailyBrief } from "@/lib/insights";
import {
  sampleDecisions,
  sampleEvents,
  sampleHoldings,
  sampleSnapshots,
  sampleTransactions,
  scenarioPresets,
} from "@/lib/sample-data";
import { createClient, hasSupabaseEnv } from "@/lib/supabase";
import type {
  DailyBrief,
  DisplayCurrency,
  Holding,
  HoldingDecision,
  MarketQuote,
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

type Tab = "insights" | "portfolio" | "map" | "scenarios";
type LocalSearchResult = {
  id: string;
  type: "holding" | "insight" | "scenario" | "country";
  title: string;
  subtitle: string;
};

const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "insights", label: "Insights", icon: Newspaper },
  { id: "portfolio", label: "Portfolio", icon: BarChart3 },
  { id: "map", label: "Global Map", icon: Globe2 },
  { id: "scenarios", label: "Scenarios", icon: SlidersHorizontal },
];

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
  const configured = hasSupabaseEnv();
  const supabase = useMemo(() => createClient(), []);
  const [activeTab, setActiveTab] = useState<Tab>("insights");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("NOK");
  const [holdings, setHoldings] = useState<Holding[]>(configured ? [] : sampleHoldings);
  const [transactions, setTransactions] = useState<Transaction[]>(configured ? [] : sampleTransactions);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>(configured ? [] : sampleSnapshots);
  const [decisions, setDecisions] = useState<HoldingDecision[]>(configured ? [] : sampleDecisions);
  const [events, setEvents] = useState<MarketEvent[]>(configured ? [] : sampleEvents);
  const [storedBrief, setStoredBrief] = useState<DailyBrief | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [scenario, setScenario] = useState<Scenario>({ ...scenarioPresets[0].shocks });
  const [activePresetId, setActivePresetId] = useState(scenarioPresets[0].id);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(configured);
  const [status, setStatus] = useState(
    configured ? "Loading private workspace..." : "Preview data · private storage not connected",
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusedHoldingId, setFocusedHoldingId] = useState<string | null>(null);
  const [instrumentSeed, setInstrumentSeed] = useState<RemoteInstrument | null>(null);
  const [requestedCountry, setRequestedCountry] = useState<string | null>(null);

  useEffect(() => {
    function keyboard(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);

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
        briefRows,
        scenarioRows,
      ] = await Promise.all([
        supabase!.from("holdings").select("*").order("created_at"),
        supabase!.from("transactions").select("*").order("occurred_at"),
        supabase!.from("portfolio_snapshots").select("*").order("snapshot_date"),
        supabase!.from("holding_decisions").select("*").order("recorded_at"),
        supabase!.from("market_events").select("*").order("event_date"),
        supabase!.from("daily_briefs").select("*").order("brief_date", { ascending: false }).limit(1),
        supabase!.from("saved_scenarios").select("*").order("created_at", { ascending: false }),
      ]);

      const firstError = [
        holdingRows.error,
        transactionRows.error,
        snapshotRows.error,
        decisionRows.error,
        eventRows.error,
        briefRows.error,
        scenarioRows.error,
      ].find(Boolean);
      if (firstError) {
        setStatus(`Workspace loaded with a data warning: ${firstError.message}`);
      } else {
        setStatus("Private workspace · daily close mode");
      }

      setHoldings(((holdingRows.data ?? []) as unknown as Holding[]).map(normalizeHolding));
      setTransactions((transactionRows.data ?? []) as unknown as Transaction[]);
      setSnapshots((snapshotRows.data ?? []) as unknown as PortfolioSnapshot[]);
      setDecisions((decisionRows.data ?? []) as unknown as HoldingDecision[]);
      setEvents((eventRows.data ?? []) as unknown as MarketEvent[]);
      setSavedScenarios((scenarioRows.data ?? []) as unknown as SavedScenario[]);
      const savedBrief = briefRows.data?.[0];
      if (savedBrief) {
        setStoredBrief({
          id: savedBrief.id,
          brief_date: savedBrief.brief_date,
          title: savedBrief.title,
          summary: savedBrief.summary,
          insights: savedBrief.insights,
          generated_at: savedBrief.generated_at,
        } as DailyBrief);
      }
      setLoading(false);
    }

    loadWorkspace();
  }, [configured, supabase]);

  const calculatedBrief = useMemo(
    () => buildDailyBrief({
      holdings,
      transactions,
      decisions,
      events,
      snapshots,
      asOf: snapshots.at(-1)?.snapshot_date ?? initialAsOf,
      generatedAt: initialGeneratedAt,
    }),
    [decisions, events, holdings, initialAsOf, initialGeneratedAt, snapshots, transactions],
  );
  const brief = storedBrief?.brief_date === calculatedBrief.brief_date ? storedBrief : calculatedBrief;

  function openTab(tab: Tab) {
    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  }

  const applyMarketQuotes = useCallback((quotes: MarketQuote[]) => {
    if (quotes.length === 0) return;
    const byHoldingId = new Map(quotes.map((quote) => [quote.id, quote]));
    setHoldings((current) => current.map((holding) => {
      const quote = byHoldingId.get(holding.id);
      if (!quote) return holding;
      return {
        ...holding,
        market_price: quote.price,
        price_provenance: {
          source: quote.source,
          as_of: quote.asOf,
          status: quote.status,
          note: quote.status === "delayed" ? "Latest available quote; exchange delays may apply." : null,
        },
      };
    }));
    if (supabase && userId) {
      void Promise.all(quotes.map((quote) => supabase.from("holdings").update({
        market_price: quote.price,
        price_provenance: {
          source: quote.source,
          as_of: quote.asOf,
          status: quote.status,
          note: quote.status === "delayed" ? "Latest available quote; exchange delays may apply." : null,
        },
      }).eq("id", quote.id).eq("user_id", userId)));
    }
  }, [supabase, userId]);

  async function saveHolding(holding: Holding) {
    const isNew = !holdings.some((item) => item.id === holding.id);
    const normalized = normalizeHolding(holding);
    setHoldings((current) => isNew
      ? [...current, normalized]
      : current.map((item) => item.id === holding.id ? normalized : item));
    setStoredBrief(null);

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
    setStoredBrief(null);
    if (supabase && userId) {
      const { error } = await supabase.from("holdings").delete().eq("id", id).eq("user_id", userId);
      setStatus(error ? error.message : `${holding.name} deleted.`);
    }
  }

  async function saveTransaction(transaction: Transaction) {
    setTransactions((current) => [...current.filter((item) => item.id !== transaction.id), transaction]);
    setStoredBrief(null);
    if (supabase && userId) {
      const { error } = await supabase.from("transactions").upsert({ ...transaction, user_id: userId });
      setStatus(error ? error.message : "Transaction recorded.");
    } else {
      setStatus("Transaction recorded in this preview session.");
    }
  }

  async function deleteTransaction(id: string) {
    if (!window.confirm("Delete this ledger entry? Portfolio returns will be recalculated.")) return;
    setTransactions((current) => current.filter((item) => item.id !== id));
    setStoredBrief(null);
    if (supabase && userId) {
      const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", userId);
      setStatus(error ? error.message : "Transaction deleted.");
    }
  }

  async function saveDecision(decision: HoldingDecision) {
    setDecisions((current) => [...current, decision]);
    setStoredBrief(null);
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

  function handleLocalSearch(result: LocalSearchResult) {
    if (result.type === "holding") {
      openTab("portfolio");
      setFocusedHoldingId(result.id);
      window.setTimeout(() => document.getElementById(`holding-${result.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    } else if (result.type === "insight") {
      openTab("insights");
    } else if (result.type === "scenario") {
      const preset = scenarioPresets.find((item) => item.id === result.id);
      if (preset) {
        setScenario({ ...preset.shocks });
        setActivePresetId(preset.id);
      }
      openTab("scenarios");
    } else {
      setRequestedCountry(result.title);
      openTab("map");
    }
  }

  const consumeInstrumentSeed = useCallback(() => setInstrumentSeed(null), []);
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  }

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
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true"><span>A</span></div>
          <div><strong>Aurelian Labs</strong><span>Private investment workbench</span></div>
        </div>

        <nav aria-label="Primary navigation">
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
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="currency-toggle" aria-label="Display currency">
            <button className={displayCurrency === "NOK" ? "active" : ""} onClick={() => setDisplayCurrency("NOK")}>NOK</button>
            <button className={displayCurrency === "EUR" ? "active" : ""} onClick={() => setDisplayCurrency("EUR")}>EUR</button>
          </div>
          {configured ? (
            <button className="sidebar-signout" onClick={signOut}><LogOut size={15} /> Sign out</button>
          ) : null}
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Private analysis environment</p>
            <h1>{tabs.find((tab) => tab.id === activeTab)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setSearchOpen(true)}>
              <Search size={16} /><span>Search Aurelian</span><kbd>⌘ K</kbd>
            </button>
            <div className="status-pill" role="status"><i />{status}</div>
          </div>
        </header>

        <div className="view-stage" key={activeTab} role="region" aria-label={`${tabs.find((tab) => tab.id === activeTab)?.label} view`}>
          {activeTab === "insights" ? (
            <InsightsView
              brief={brief}
              holdings={holdings}
              onQuotesUpdated={applyMarketQuotes}
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
              displayCurrency={displayCurrency}
              focusedHoldingId={focusedHoldingId}
              instrumentSeed={instrumentSeed}
              onConsumeInstrumentSeed={consumeInstrumentSeed}
              onSaveHolding={saveHolding}
              onDeleteHolding={deleteHolding}
              onSaveTransaction={saveTransaction}
              onDeleteTransaction={deleteTransaction}
              onSaveDecision={saveDecision}
            />
          ) : null}
          {activeTab === "map" ? (
            <GlobalMapView
              key={requestedCountry ?? "default-map"}
              holdings={holdings}
              requestedCountry={requestedCountry}
            />
          ) : null}
          {activeTab === "scenarios" ? (
            <ScenarioView
              holdings={holdings}
              displayCurrency={displayCurrency}
              scenario={scenario}
              setScenario={setScenario}
              activePresetId={activePresetId}
              setActivePresetId={setActivePresetId}
              savedScenarios={savedScenarios}
              onSaveScenario={saveScenario}
              onDeleteScenario={deleteScenario}
            />
          ) : null}
        </div>
      </section>

      {searchOpen ? (
        <SearchCommand
          open
          onClose={() => setSearchOpen(false)}
          holdings={holdings}
          brief={brief}
          presets={scenarioPresets}
          onLocalSelect={handleLocalSearch}
          onInstrumentSelect={(instrument) => {
            setInstrumentSeed(instrument);
            openTab("portfolio");
          }}
        />
      ) : null}
    </main>
  );
}
