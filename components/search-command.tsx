"use client";

import { Building2, Clock3, Globe2, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DailyBrief, Holding, ScenarioPreset } from "@/lib/types";

export type RemoteInstrument = {
  id: string;
  symbol: string;
  name: string;
  exchange: string | null;
  country: string | null;
  currency: string | null;
  instrumentType: string | null;
  figi: string | null;
  source: string;
};

type LocalResult = {
  id: string;
  type: "holding" | "insight" | "scenario" | "country";
  title: string;
  subtitle: string;
};

const searchableCountries = [
  "Norway", "Sweden", "Denmark", "Finland", "United Kingdom", "Germany",
  "France", "Spain", "Netherlands", "Switzerland", "Italy", "Belgium",
  "Austria", "Ireland", "Portugal", "Poland", "United States", "Canada",
  "Mexico", "Brazil", "Japan", "China", "India", "South Korea", "Australia",
  "South Africa", "Egypt",
];

export function SearchCommand({
  open,
  onClose,
  holdings,
  brief,
  presets,
  onLocalSelect,
  onInstrumentSelect,
}: {
  open: boolean;
  onClose: () => void;
  holdings: Holding[];
  brief: DailyBrief;
  presets: ScenarioPreset[];
  onLocalSelect: (result: LocalResult) => void;
  onInstrumentSelect: (result: RemoteInstrument) => void;
}) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<RemoteInstrument[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .catch(() => null);
      const payload = response?.ok
        ? await response.json() as { results?: RemoteInstrument[] }
        : null;
      setRemote(payload?.results ?? []);
      setLoading(false);
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const local = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const results: LocalResult[] = [];
    for (const holding of holdings) {
      const haystack = [holding.name, holding.ticker, holding.isin, holding.figi, holding.country, holding.sector]
        .filter(Boolean).join(" ").toLowerCase();
      if (haystack.includes(normalized)) {
        results.push({
          id: holding.id,
          type: "holding",
          title: holding.name,
          subtitle: [holding.ticker, holding.currency, holding.price_provenance.status].filter(Boolean).join(" · "),
        });
      }
    }
    for (const item of brief.insights) {
      if (`${item.title} ${item.fact}`.toLowerCase().includes(normalized)) {
        results.push({ id: item.id, type: "insight", title: item.title, subtitle: item.source });
      }
    }
    for (const preset of presets) {
      if (`${preset.name} ${preset.description}`.toLowerCase().includes(normalized)) {
        results.push({ id: preset.id, type: "scenario", title: preset.name, subtitle: preset.description });
      }
    }
    for (const country of searchableCountries) {
      if (country.toLowerCase().includes(normalized)) {
        results.push({ id: country, type: "country", title: country, subtitle: "Country market profile" });
      }
    }
    return results.slice(0, 10);
  }, [brief.insights, holdings, presets, query]);

  if (!open) return null;

  const iconFor = (type: LocalResult["type"]) => {
    if (type === "holding") return <Building2 size={16} />;
    if (type === "scenario") return <SlidersHorizontal size={16} />;
    if (type === "country") return <Globe2 size={16} />;
    return <Clock3 size={16} />;
  };

  return (
    <div className="command-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="command-menu" role="dialog" aria-modal="true" aria-label="Search Aurelian Capital">
        <div className="command-input">
          <Search size={19} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value.trim().length < 2) {
                setRemote([]);
                setLoading(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
            }}
            placeholder="Search ticker, ISIN, holding, country, insight..."
            aria-label="Search"
          />
          <button className="icon-button" onClick={onClose} aria-label="Close search"><X size={16} /></button>
        </div>

        <div className="command-results">
          {!query ? (
            <div className="command-empty">
              <Search size={22} />
              <strong>Search the whole workbench</strong>
              <span>Holdings, identifiers, decisions, countries, scenarios, and global instruments.</span>
            </div>
          ) : null}

          {local.length ? <p className="result-label">In Aurelian</p> : null}
          {local.map((result) => (
            <button key={`${result.type}-${result.id}`} onClick={() => {
              onLocalSelect(result);
              onClose();
            }}>
              <span className="result-icon">{iconFor(result.type)}</span>
              <span><strong>{result.title}</strong><em>{result.subtitle}</em></span>
              <small>{result.type}</small>
            </button>
          ))}

          {query.trim().length >= 2 ? <p className="result-label">Instrument discovery</p> : null}
          {remote.map((result) => (
            <button key={`${result.source}-${result.id}`} onClick={() => {
              onInstrumentSelect(result);
              onClose();
            }}>
              <span className="result-icon"><Globe2 size={16} /></span>
              <span><strong>{result.symbol || result.name}</strong><em>{result.name} · {result.exchange ?? "Exchange unavailable"}</em></span>
              <small>{result.source}</small>
            </button>
          ))}
          {loading ? <div className="command-loading">Searching free instrument sources...</div> : null}
          {query && !loading && !local.length && !remote.length ? (
            <div className="command-loading">No reliable match. You can still add the holding manually.</div>
          ) : null}
        </div>
        <footer><span>OpenFIGI v3</span><span>Daily-data coverage varies by exchange</span></footer>
      </section>
    </div>
  );
}
