"use client";

import { ArrowRight, BookOpen, ExternalLink, Landmark, RotateCcw, ShieldAlert, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { historyCategories, marketHistoryEvents, recurringHistoryPatterns, type MarketHistoryCategory, type MarketHistoryEvent } from "@/lib/market-history";
import { TimelineParticleField } from "@/components/timeline-particle-field";

function eventRange(event: MarketHistoryEvent) {
  return event.endYear && event.endYear !== event.year ? `${event.year}–${event.endYear}` : String(event.year);
}

export function MarketHistoryView() {
  const [category, setCategory] = useState<"All" | MarketHistoryCategory>("All");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scrubYear, setScrubYear] = useState<number | null>(null);
  const timelineSurfaceRef = useRef<HTMLDivElement | null>(null);
  const visibleEvents = useMemo(() => category === "All" ? marketHistoryEvents : marketHistoryEvents.filter((event) => event.category === category), [category]);
  const selected = marketHistoryEvents.find((event) => event.id === selectedId) ?? null;
  const preview = visibleEvents.find((event) => event.id === hoveredId) ?? null;
  const patterns = recurringHistoryPatterns(visibleEvents);

  return <div className="history-layout">
    <section className="history-toolbar primary-view-toolbar"><div><h2>Timeline</h2></div></section>
    <section className="history-workspace" aria-labelledby="market-history-title">
    <header className="history-heading">
      <div><span className="eyebrow">1857 to today</span><h3 id="market-history-title">Market history, transmission, and repair</h3><p>Explore what broke, how stress traveled, and which conditions repeat. Events are selected for learning value, not as a complete chronology.</p></div>
      <button type="button" className="ghost-button" onClick={() => { setCategory("All"); setHoveredId(null); setSelectedId(null); }}><RotateCcw size={14} /> Reset</button>
    </header>

    <div className="history-category-tabs" role="tablist" aria-label="Historical event category">
      {historyCategories.map((item) => <button type="button" role="tab" aria-selected={category === item} className={category === item ? "active" : ""} key={item} onClick={() => { setCategory(item); setHoveredId(null); setSelectedId(null); }}>{item}</button>)}
    </div>

    <div className="history-pattern-band" aria-label="Recurring patterns">
      <span>Recurring in this view</span>
      {patterns.map(([pattern, count]) => <div key={pattern}><strong>{pattern}</strong><small>{count} events</small></div>)}
    </div>

    <div ref={timelineSurfaceRef} className="history-timeline-shell">
      <TimelineParticleField surfaceRef={timelineSurfaceRef} onYearChange={setScrubYear} />
      {scrubYear != null ? <div className="history-year-scrubber" style={{ left: `${(scrubYear - 1850) / (2026 - 1850) * 100}%` }} aria-hidden="true"><span>{scrubYear}</span><i /></div> : null}
      <div className="history-era-labels"><span>Industrial finance</span><span>Central banking</span><span>Global markets</span><span>Digital and policy era</span></div>
      <div className="history-timeline" role="list" aria-label="Major market and economic crises">
        <div className="history-axis" aria-hidden="true" />
        {visibleEvents.map((event, index) => <button
          type="button"
          role="listitem"
          key={event.id}
          className={`${event.category.toLowerCase().replaceAll(" ", "-")}${selected?.id === event.id ? " selected" : ""}${scrubYear != null && Math.abs(event.year - scrubYear) <= 3 ? " cursor-near" : ""}${index === 0 || event.year - visibleEvents[index - 1].year >= 5 ? " labelled" : ""}`}
          style={{ left: `${(event.year - 1850) / (2026 - 1850) * 100}%` }}
          aria-label={`${eventRange(event)} ${event.title}. ${event.summary}`}
          onMouseEnter={() => setHoveredId(event.id)}
          onMouseLeave={() => setHoveredId(null)}
          onFocus={() => setHoveredId(event.id)}
          onBlur={() => setHoveredId(null)}
          onClick={() => setSelectedId(event.id)}
        ><i style={{ height: `${22 + event.severity * 8}px` }} />{index === 0 || event.year - visibleEvents[index - 1].year >= 5 ? <span>{event.year}</span> : null}<strong>{event.title}</strong></button>)}
      </div>
      {preview ? <aside className="history-preview" style={{ left: `${Math.max(9, Math.min(76, (preview.year - 1850) / (2026 - 1850) * 100))}%` }}>
        <button type="button" aria-label="Close preview" onClick={() => setHoveredId(null)}><X size={12} /></button>
        <span>{eventRange(preview)} · {preview.category}</span><strong>{preview.title}</strong><p>{preview.summary}</p><small>Click the event for the full story</small>
      </aside> : null}
    </div>

    {selected ? <article className="history-story" key={selected.id}>
      <header><div><span className="eyebrow">Full story · {selected.category}</span><h3>{selected.title}</h3><p>{eventRange(selected)} · {selected.geography}</p></div><div className={`history-severity severity-${selected.severity}`}><span>System severity</span><strong>{selected.severity}/5</strong></div></header>
      <div className="history-story-lead"><ShieldAlert size={18} /><div><span>Trigger</span><strong>{selected.trigger}</strong></div></div>
      <div className="history-story-grid">
        <section><h4>Buildup</h4>{selected.buildup.map((item) => <p key={item}><ArrowRight size={12} />{item}</p>)}</section>
        <section><h4>Transmission</h4>{selected.transmission.map((item) => <p key={item}><ArrowRight size={12} />{item}</p>)}</section>
        <section><h4>Policy response</h4><p>{selected.policyResponse}</p></section>
        <section><h4>Recovery</h4><p>{selected.recovery}</p></section>
      </div>
      <div className="history-lesson"><Landmark size={17} /><div><span>Common denominator</span><strong>{selected.lesson}</strong><p>{selected.commonDenominators.join(" · ")}</p></div></div>
      <footer><BookOpen size={14} /><span>Primary research reference</span><a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.source}<ExternalLink size={12} /></a><em>Historical synthesis · reviewed 29 Aug 2026</em></footer>
    </article> : <div className="history-story-prompt"><BookOpen size={17} /><div><strong>Select an event to open its full story</strong><span>Hover for the short version. Click when you want the cause, transmission, policy response, recovery, and recurring lesson.</span></div></div>}
    </section>
  </div>;
}
