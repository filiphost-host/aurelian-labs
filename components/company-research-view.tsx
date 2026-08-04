"use client";

import { BarChart3, BookOpen, CalendarClock, ChevronDown, Database, Scale } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCompanyResearch, researchTickers } from "@/lib/company-research";
import type { Holding } from "@/lib/types";

type ResearchMode = "peers" | "earnings" | "thesis";

const tooltipStyle = {
  backgroundColor: "rgba(10, 9, 11, 0.97)",
  border: "1px solid rgba(255, 255, 255, 0.11)",
  borderRadius: "5px",
  color: "#f4f1ef",
};

function metric(value: number | null, suffix = "") {
  if (value === null) return "—";
  return `${value.toLocaleString("en-GB", { maximumFractionDigits: 1 })}${suffix}`;
}

export function CompanyResearchView({
  holdings,
  selectedTicker,
  onSelectedTicker,
}: {
  holdings: Holding[];
  selectedTicker: string;
  onSelectedTicker: (ticker: string) => void;
}) {
  const [mode, setMode] = useState<ResearchMode>("peers");
  const profile = getCompanyResearch(selectedTicker);
  const availableTickers = useMemo(() => {
    const held = holdings.map((holding) => holding.ticker?.toUpperCase()).filter(Boolean) as string[];
    return [...new Set([...held.filter((ticker) => researchTickers.includes(ticker)), ...researchTickers])];
  }, [holdings]);
  const currentPeer = profile.peers.find((peer) => peer.ticker === profile.ticker) ?? profile.peers[0];
  const peerPe = profile.peers.filter((peer) => peer.ticker !== profile.ticker && peer.pe !== null);
  const averagePe = peerPe.length ? peerPe.reduce((sum, peer) => sum + (peer.pe ?? 0), 0) / peerPe.length : null;
  const premium = currentPeer.pe && averagePe ? ((currentPeer.pe / averagePe) - 1) * 100 : null;

  return (
    <div className="research-workbench">
      <section className="research-identity">
        <div className="research-company">
          <span className="research-mark" aria-hidden="true">{profile.ticker.slice(0, 1)}</span>
          <div><strong>{profile.ticker}</strong><span>{profile.name}</span></div>
        </div>
        <div className="research-controls">
          <label className="research-select">
            <span>Company</span>
            <select value={profile.ticker} onChange={(event) => onSelectedTicker(event.target.value)}>
              {availableTickers.map((ticker) => <option value={ticker} key={ticker}>{ticker}</option>)}
            </select>
            <ChevronDown size={14} />
          </label>
          <div className="research-mode" role="tablist" aria-label="Company research view">
            <button role="tab" aria-selected={mode === "peers"} className={mode === "peers" ? "active" : ""} onClick={() => setMode("peers")}><Scale size={15} /> Peers</button>
            <button role="tab" aria-selected={mode === "earnings"} className={mode === "earnings" ? "active" : ""} onClick={() => setMode("earnings")}><BarChart3 size={15} /> Earnings</button>
            <button role="tab" aria-selected={mode === "thesis"} className={mode === "thesis" ? "active" : ""} onClick={() => setMode("thesis")}><BookOpen size={15} /> Thesis</button>
          </div>
        </div>
      </section>

      <section className="research-context-strip">
        <article><span>Sector lens</span><strong>{profile.sector}</strong></article>
        <article><span>Peer P/E average</span><strong>{metric(averagePe, "x")}</strong></article>
        <article><span>Valuation premium</span><strong className={premium !== null && premium > 0 ? "bad" : "good"}>{premium === null ? "—" : `${premium > 0 ? "+" : ""}${premium.toFixed(1)}%`}</strong></article>
        <article><span>Next earnings</span><strong>{profile.nextEarnings}</strong></article>
      </section>

      {mode === "peers" ? (
        <>
          <section className="research-peer-table">
            <div className="research-section-heading">
              <div><span className="eyebrow">Comparable companies</span><h2>{profile.ticker} peer analysis</h2></div>
              <span><Database size={13} /> Illustrative fundamentals</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Company</th><th>FCF / share</th><th>LTM revenue</th><th>EV / sales</th><th>P/E</th><th>Market cap</th><th>Debt / equity</th><th>1D return</th></tr></thead>
                <tbody>{profile.peers.map((peer) => (
                  <tr key={peer.ticker} className={peer.ticker === profile.ticker ? "selected-peer" : ""}>
                    <td><span className="peer-symbol">{peer.ticker.slice(0, 1)}</span><strong>{peer.ticker}</strong><em>{peer.name}</em>{peer.ticker === profile.ticker ? <small>This holding</small> : null}</td>
                    <td>{metric(peer.fcfPerShare)}</td>
                    <td>{metric(peer.revenueB, "B")}</td>
                    <td>{metric(peer.evSales, "x")}</td>
                    <td>{metric(peer.pe, "x")}</td>
                    <td>{metric(peer.marketCapB, "B")}</td>
                    <td className={peer.debtToEquity !== null && peer.debtToEquity > 100 ? "bad" : ""}>{metric(peer.debtToEquity, "%")}</td>
                    <td className={peer.oneDayReturn >= 0 ? "good" : "bad"}>{peer.oneDayReturn > 0 ? "+" : ""}{peer.oneDayReturn.toFixed(1)}%</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <section className="research-chart-grid">
            <article>
              <header><div><span>Cash generation</span><h3>FCF/share versus peers</h3></div><small>Quarterly path</small></header>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={profile.fcfHistory} margin={{ left: 0, right: 8, top: 15, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fill: "#716d70", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#716d70", fontSize: 9 }} axisLine={false} tickLine={false} width={34} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="peerAverage" stroke="#786f72" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="company" stroke="#f1edeb" strokeWidth={2} fill="rgba(212,79,101,.08)" activeDot={{ fill: "#df5268", r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </article>
            <article>
              <header><div><span>Relative valuation</span><h3>Percent premium</h3></div><small>Versus peer average</small></header>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={profile.premiumHistory} margin={{ left: 0, right: 8, top: 15, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                  <XAxis dataKey="period" tick={{ fill: "#716d70", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#716d70", fontSize: 9 }} axisLine={false} tickLine={false} width={34} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${Number(value).toFixed(1)}%`} />
                  <Line type="monotone" dataKey="average" stroke="#f1edeb" strokeDasharray="4 4" dot={false} />
                  <Area type="monotone" dataKey="premium" stroke="#c7c96c" strokeWidth={2} fill="rgba(199,201,108,.09)" activeDot={{ fill: "#c7c96c", r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </article>
          </section>
        </>
      ) : null}

      {mode === "earnings" ? (
        <section className="earnings-research">
          <div className="earnings-summary">
            <article><span>P/E ratio</span><strong>{metric(currentPeer.pe, "x")}</strong><p>{premium === null ? "Peer comparison unavailable" : `${Math.abs(premium).toFixed(1)}% ${premium >= 0 ? "above" : "below"} the peer average`}</p></article>
            <article><span>Earnings cadence</span><strong>{profile.earnings.filter((point) => point.actual !== null && (point.actual ?? 0) >= point.estimate).length} beats</strong><p>Across the four completed illustrative quarters</p></article>
            <article><span>Projected report</span><strong>{profile.nextEarnings}</strong><p>Confirm with the issuer before relying on the date</p></article>
          </div>
          <div className="earnings-chart-panel">
            <div className="research-section-heading">
              <div><span className="eyebrow">Reported versus expected</span><h2>Earnings per share</h2></div>
              <CalendarClock size={18} />
            </div>
            <ResponsiveContainer width="100%" height={330}>
              <BarChart data={profile.earnings} barGap={4}>
                <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                <XAxis dataKey="quarter" tick={{ fill: "#777275", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#777275", fontSize: 10 }} axisLine={false} tickLine={false} width={38} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#8a8588" }} />
                <Bar dataKey="estimate" name="Estimate" fill="#514d50" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="#f0edeb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="earnings-quarter-grid">
            {profile.earnings.map((point) => {
              const reported = point.actual !== null;
              const beat = reported && point.actual! >= point.estimate;
              return <article key={point.quarter} className={!reported ? "projected" : ""}>
                <span>{point.quarter}</span>
                <strong>{reported ? (beat ? "Beat" : "Miss") : "Projected"}</strong>
                <div><em className={reported ? (beat ? "good" : "bad") : ""}>{reported ? point.actual!.toFixed(2) : point.estimate.toFixed(2)}</em><em>{point.revenueB ? `$${point.revenueB.toFixed(1)}B` : "Index EPS"}</em></div>
                <small>{reported ? `Estimate ${point.estimate.toFixed(2)}` : profile.nextEarnings}</small>
              </article>;
            })}
          </div>
        </section>
      ) : null}

      {mode === "thesis" ? (
        <section className="research-thesis">
          <div><span className="eyebrow">Research frame</span><h2>What needs to remain true</h2><p>{profile.thesis}</p></div>
          <div className="research-thesis-grid">
            <article><span>Valuation</span><strong>{metric(currentPeer.pe, "x")} P/E</strong><p>Compare the premium with growth, free cash flow, and capital intensity rather than reading it alone.</p></article>
            <article><span>Balance sheet</span><strong>{metric(currentPeer.debtToEquity, "%")} debt/equity</strong><p>Review debt maturity, interest coverage, lease obligations, and net cash in the latest filing.</p></article>
            <article><span>Evidence</span><strong>Primary filings first</strong><p>Use SEC filings and company reporting to replace every illustrative value before making a decision.</p></article>
          </div>
        </section>
      ) : null}

      <footer className="research-disclaimer"><Database size={13} /> Illustrative research data for product exploration. Values are not live and are not investment advice.</footer>
    </div>
  );
}
