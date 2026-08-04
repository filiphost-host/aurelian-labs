"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Holding, MarketEvent } from "@/lib/types";

type CalendarMode = "day" | "week" | "month";
type CalendarEvent = {
  id: string;
  ticker: string;
  name: string;
  date: string;
  timing: "BMO" | "AMC" | "TBD";
  outcome?: "beat" | "miss";
  portfolio: boolean;
};

const researchEvents: CalendarEvent[] = [
  { id: "jul-msft", ticker: "MSFT", name: "Microsoft", date: "2026-07-29", timing: "AMC", outcome: "beat", portfolio: true },
  { id: "jul-meta", ticker: "META", name: "Meta Platforms", date: "2026-07-30", timing: "AMC", outcome: "beat", portfolio: false },
  { id: "aug-amzn", ticker: "AMZN", name: "Amazon", date: "2026-08-03", timing: "AMC", outcome: "beat", portfolio: false },
  { id: "aug-pltr", ticker: "PLTR", name: "Palantir", date: "2026-08-04", timing: "AMC", outcome: "beat", portfolio: false },
  { id: "aug-dis", ticker: "DIS", name: "Walt Disney", date: "2026-08-05", timing: "BMO", outcome: "miss", portfolio: false },
  { id: "aug-uber", ticker: "UBER", name: "Uber", date: "2026-08-06", timing: "BMO", portfolio: false },
  { id: "aug-lly", ticker: "LLY", name: "Eli Lilly", date: "2026-08-07", timing: "BMO", portfolio: false },
  { id: "aug-hd", ticker: "HD", name: "Home Depot", date: "2026-08-18", timing: "BMO", portfolio: false },
  { id: "aug-wmt", ticker: "WMT", name: "Walmart", date: "2026-08-20", timing: "BMO", portfolio: false },
  { id: "aug-nvda", ticker: "NVDA", name: "Nvidia", date: "2026-08-26", timing: "AMC", portfolio: true },
  { id: "aug-crm", ticker: "CRM", name: "Salesforce", date: "2026-08-27", timing: "AMC", portfolio: false },
  { id: "sep-avgo", ticker: "AVGO", name: "Broadcom", date: "2026-09-03", timing: "AMC", portfolio: false },
  { id: "sep-orcl", ticker: "ORCL", name: "Oracle", date: "2026-09-10", timing: "AMC", portfolio: false },
  { id: "sep-adbe", ticker: "ADBE", name: "Adobe", date: "2026-09-17", timing: "AMC", portfolio: false },
];

const weekdayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthBusinessGrid(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const start = new Date(first);
  const firstDay = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - firstDay);
  const cells: Date[] = [];
  const cursor = new Date(start);
  while (cells.length < 30) {
    const weekday = (cursor.getDay() + 6) % 7;
    if (weekday < 5) cells.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

function sameWeek(date: Date, target: Date) {
  const monday = new Date(target);
  monday.setDate(target.getDate() - ((target.getDay() + 6) % 7));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return date >= monday && date <= friday;
}

export function EarningsCalendarView({
  holdings,
  events,
  onOpenResearch,
}: {
  holdings: Holding[];
  events: MarketEvent[];
  onOpenResearch: (ticker: string) => void;
}) {
  const [month, setMonth] = useState(() => new Date(2026, 7, 1));
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 7, 4));
  const [mode, setMode] = useState<CalendarMode>("month");
  const [holdingsOnly, setHoldingsOnly] = useState(false);
  const [query, setQuery] = useState("");
  const holdingTickers = useMemo(() => new Set(holdings.map((holding) => holding.ticker?.toUpperCase()).filter(Boolean)), [holdings]);
  const allEvents = useMemo(() => researchEvents.map((event) => ({
    ...event,
    portfolio: holdingTickers.has(event.ticker),
  })), [holdingTickers]);
  const visibleEvents = allEvents.filter((event) => {
    if (holdingsOnly && !event.portfolio) return false;
    if (query && !`${event.ticker} ${event.name}`.toLowerCase().includes(query.toLowerCase())) return false;
    const date = new Date(`${event.date}T12:00:00`);
    if (mode === "day") return isoDate(selectedDate) === event.date;
    if (mode === "week") return sameWeek(date, selectedDate);
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
  });
  const grid = monthBusinessGrid(month);
  const eventByDate = new Map<string, CalendarEvent[]>();
  visibleEvents.forEach((event) => eventByDate.set(event.date, [...(eventByDate.get(event.date) ?? []), event]));
  const planningEvents = events.filter((event) => event.status === "upcoming").slice(0, 4);

  function shiftMonth(delta: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelectedDate(next);
  }

  return (
    <div className="calendar-workbench">
      <section className="calendar-toolbar">
        <div className="calendar-title"><CalendarDays size={19} /><div><span className="eyebrow">Portfolio event planning</span><h2>Earnings calendar</h2></div></div>
        <div className="calendar-tools">
          <label className="calendar-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter ticker" aria-label="Filter earnings calendar by ticker" /></label>
          <label className="calendar-toggle"><span>Holdings only</span><input type="checkbox" checked={holdingsOnly} onChange={(event) => setHoldingsOnly(event.target.checked)} /></label>
          <div className="calendar-modes" role="tablist" aria-label="Calendar range">
            {(["day", "week", "month"] as CalendarMode[]).map((item) => <button key={item} role="tab" aria-selected={mode === item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>)}
          </div>
        </div>
      </section>

      <section className="calendar-surface">
        <header>
          <button className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <div><strong>{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(month)}</strong><span>Dates are illustrative planning estimates</span></div>
          <button className="icon-button" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button>
        </header>

        {mode === "month" ? (
          <div className="earnings-month-grid">
            {weekdayLabels.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
            {grid.map((date) => {
              const key = isoDate(date);
              const dayEvents = eventByDate.get(key) ?? [];
              const isCurrentMonth = date.getMonth() === month.getMonth();
              const isSelected = key === isoDate(selectedDate);
              return <button className={`calendar-day${isCurrentMonth ? "" : " outside"}${isSelected ? " selected" : ""}`} key={key} onClick={() => setSelectedDate(date)}>
                <span>{date.getDate() === 1 || !isCurrentMonth ? new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric" }).format(date) : date.getDate()}</span>
                <div>{dayEvents.slice(0, 3).map((event) => <span className="calendar-event" key={event.id} onClick={(clickEvent) => { clickEvent.stopPropagation(); onOpenResearch(event.ticker); }}>
                  <i>{event.ticker.slice(0, 1)}</i><strong>{event.ticker}</strong><em className={event.outcome === "beat" ? "good" : event.outcome === "miss" ? "bad" : ""}>{event.outcome ?? event.timing}</em>
                </span>)}</div>
                {dayEvents.length > 3 ? <small>{dayEvents.length - 3} more</small> : null}
              </button>;
            })}
          </div>
        ) : (
          <div className="calendar-agenda">
            {visibleEvents.length ? visibleEvents.map((event) => <button key={event.id} onClick={() => onOpenResearch(event.ticker)}>
              <span>{new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${event.date}T12:00:00`))}</span>
              <i>{event.ticker.slice(0, 1)}</i><strong>{event.ticker}</strong><em>{event.name}</em><small>{event.timing}</small>
            </button>) : <div className="calendar-empty">No matching events in this range.</div>}
          </div>
        )}
      </section>

      <section className="calendar-footer-grid">
        <article><Filter size={16} /><div><span>Research scope</span><strong>{visibleEvents.length} earnings {visibleEvents.length === 1 ? "event" : "events"}</strong><p>Use the calendar to plan research, then confirm every date with the issuer.</p></div></article>
        <article><Clock3 size={16} /><div><span>Portfolio reviews</span><strong>{planningEvents.length} upcoming</strong><p>{planningEvents[0]?.title ?? "No Decision Memory reviews are scheduled."}</p></div></article>
      </section>
    </div>
  );
}
