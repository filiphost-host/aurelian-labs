"use client";

import { BookOpen, CalendarClock, Scale, Target } from "lucide-react";
import { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { formatMoney, formatPercent, portfolioSummary } from "@/lib/calculations";
import {
  buildScorecard,
  convictionBuckets,
  reviewQueue,
  thesisCoverage,
} from "@/lib/judgment";
import type {
  DisplayCurrency,
  Holding,
  HoldingDecision,
  PortfolioSnapshot,
  Transaction,
} from "@/lib/types";

const darkTooltip = {
  backgroundColor: "rgba(14, 13, 15, 0.97)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: "5px",
  color: "#f4f1ef",
};


export function JudgmentView({
  holdings,
  transactions,
  snapshots,
  decisions,
  fxRates,
  displayCurrency,
  asOf,
  onOpenHolding,
}: {
  holdings: Holding[];
  transactions: Transaction[];
  snapshots: PortfolioSnapshot[];
  decisions: HoldingDecision[];
  fxRates: Record<string, number>;
  displayCurrency: DisplayCurrency;
  asOf: string;
  onOpenHolding: (holdingId: string) => void;
}) {
  const summary = useMemo(
    () => portfolioSummary(holdings, transactions, snapshots, fxRates),
    [fxRates, holdings, snapshots, transactions],
  );
  const rows = useMemo(
    () => buildScorecard(summary.positions, decisions, asOf),
    [asOf, decisions, summary.positions],
  );
  const buckets = useMemo(() => convictionBuckets(rows), [rows]);
  const queue = useMemo(() => reviewQueue(rows), [rows]);
  const coverage = useMemo(() => thesisCoverage(rows), [rows]);

  const money = (value: number) => formatMoney(value, displayCurrency, fxRates);
  const scatter = rows
    .filter((row) => row.conviction !== null && row.unrealizedReturnPercent !== null)
    .map((row) => ({
      id: row.holdingId,
      conviction: row.conviction!,
      returnPercent: row.unrealizedReturnPercent!,
      valueNok: row.valueNok,
      label: row.ticker || row.name,
    }));
  const unpricedCount = rows.filter((row) => !row.priced).length;

  return (
    <div className="judgment-layout">
      <section className="metric-grid">
        <Metric
          label="Money with a thesis behind it"
          value={formatPercent(coverage.withThesisPercent)}
          note={coverage.withoutThesis > 0
            ? `By money at risk. ${coverage.withoutThesis} of ${coverage.totalPositions} positions have none recorded`
            : "By money at risk. Every position has one recorded"}
          tone={coverage.withThesisPercent >= 80 ? "good" : undefined}
        />
        <Metric
          label="Money with risks written down"
          value={formatPercent(coverage.withRisksPercent)}
          note="By money at risk, not by number of positions"
          tone={coverage.withRisksPercent >= 80 ? "good" : undefined}
        />
        <Metric
          label="Reviews overdue"
          value={String(queue.overdue.length)}
          note={queue.dueSoon.length ? `${queue.dueSoon.length} more due within 45 days` : "None due in the next 45 days"}
          tone={queue.overdue.length > 0 ? "bad" : "good"}
        />
        <Metric
          label="Never written about"
          value={String(queue.noDecision.length)}
          note={queue.undated.length > 0
            ? `${queue.undated.length} more have a decision but no review date`
            : "Positions with no decision recorded at all"}
          tone={queue.noDecision.length + queue.undated.length > 0 ? "bad" : "good"}
        />
      </section>

      <section className="panel wide">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">Calibration</span>
            <h2>Where your conviction and your results sit</h2>
          </div>
          <Target size={19} aria-hidden="true" />
        </div>

        <div className="judgment-verdict" role="note">
          <strong>Not yet. This page shows the picture; it does not score you.</strong>
          <span>
            Answering that question honestly needs the return measured from the day each conviction was
            written, sold positions included so the losers are not quietly missing, and horizons matched so a
            month is not compared against five years. None of those hold yet, so no verdict is offered. What is
            below is a description of where your convictions and your money currently sit.
          </span>
        </div>

        {scatter.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" />
              <XAxis
                type="number"
                dataKey="conviction"
                domain={[0.5, 5.5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={{ fill: "#7f7a7d", fontSize: 11 }}
                label={{ value: "Conviction recorded", position: "insideBottom", offset: -4, fill: "#7f7a7d", fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="returnPercent"
                width={58}
                tick={{ fill: "#7f7a7d", fontSize: 11 }}
                tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
              />
              <ZAxis type="number" dataKey="valueNok" name="Value" range={[60, 400]} />
              <Tooltip
                contentStyle={darkTooltip}
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(value, name) => {
                  if (name === "returnPercent") return [`${Number(value).toFixed(1)}%`, "Unrealized return"];
                  if (name === "conviction") return [`${value}/5`, "Conviction"];
                  return [money(Number(value)), "Value"];
                }}
                labelFormatter={() => ""}
              />
              <Scatter data={scatter}>
                {scatter.map((point) => (
                  <Cell key={point.id} fill={point.returnPercent >= 0 ? "#4f9d78" : "#b94b5e"} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <p className="panel-note">No position yet carries both a recorded conviction and a measurable return.</p>
        )}

        <p className="panel-note">
          Each circle is an open position, sized by how much money is in it. The return is unrealized and
          covers the whole time the position has been held, not the period since the conviction was recorded.
          Positions you have already sold do not appear at all, so this is not a record of your closed calls.
          {unpricedCount > 0
            ? ` ${unpricedCount} position${unpricedCount === 1 ? " has" : "s have"} no usable price and carry no return here.`
            : ""}
        </p>
      </section>

      {buckets.length ? (
        <section className="panel wide">
          <div className="panel-title-row">
            <div>
              <span className="eyebrow">Conviction and money</span>
              <h2>Where the money actually sits</h2>
            </div>
            <Scale size={19} aria-hidden="true" />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Conviction</th><th>Positions</th><th>Value</th><th>Share of portfolio</th><th>Average unrealized return</th><th>In profit</th></tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => (
                  <tr key={bucket.conviction}>
                    <td><strong>{bucket.conviction}/5</strong></td>
                    <td>{bucket.positions}{bucket.pricedPositions < bucket.positions ? ` (${bucket.pricedPositions} priced)` : ""}</td>
                    <td>{money(bucket.valueNok)}</td>
                    <td>{formatPercent(bucket.weightPercent)}</td>
                    <td className={bucket.averageReturnPercent === null ? undefined : bucket.averageReturnPercent >= 0 ? "good" : "bad"}>
                      {bucket.averageReturnPercent === null ? "Not measurable" : formatPercent(bucket.averageReturnPercent)}
                    </td>
                    <td>{bucket.positiveShare === null ? "—" : formatPercent(bucket.positiveShare)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            Read the share column against the conviction beside it. A large share sitting on a low conviction,
            or a small share on your strongest idea, is a disagreement between what you believe and what you own.
          </p>
        </section>
      ) : null}

      <section className="panel wide">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">Review loop</span>
            <h2>Decisions waiting to be revisited</h2>
          </div>
          <CalendarClock size={19} aria-hidden="true" />
        </div>

        {queue.overdue.length + queue.dueSoon.length + queue.undated.length + queue.noDecision.length === 0 ? (
          <p className="panel-note">Every position has a review scheduled beyond the next 45 days.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Holding</th><th>Conviction</th><th>Review</th><th>Value</th><th>Return so far</th><th aria-label="Actions" /></tr>
              </thead>
              <tbody>
                {[...queue.overdue, ...queue.dueSoon, ...queue.undated, ...queue.noDecision].map((row) => (
                  <tr key={row.holdingId}>
                    <td>
                      <strong>{row.name}</strong>
                      <span>{row.ticker || "No ticker"}{row.hasDecision && !row.thesisRecorded ? " · no thesis recorded" : ""}</span>
                    </td>
                    <td>{row.conviction === null ? "—" : `${row.conviction}/5`}</td>
                    <td>
                      <span className={`judgment-tag ${row.reviewState}`}>
                        {row.reviewState === "overdue" ? `${Math.abs(row.daysUntilReview ?? 0)} days late`
                          : row.reviewState === "due-soon" ? `in ${row.daysUntilReview} days`
                            : row.reviewState === "no-decision" ? "no decision recorded"
                              : "no date set"}
                      </span>
                    </td>
                    <td>{money(row.valueNok)}</td>
                    <td className={row.unrealizedReturnPercent === null ? undefined : row.unrealizedReturnPercent >= 0 ? "good" : "bad"}>
                      {row.unrealizedReturnPercent === null ? "—" : formatPercent(row.unrealizedReturnPercent)}
                    </td>
                    <td className="row-actions">
                      <button className="icon-button" onClick={() => onOpenHolding(row.holdingId)} title="Open in the portfolio">
                        <BookOpen size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="panel-note">
          A review is a prompt to re-read the thesis and ask whether it still holds, not a prompt to trade.
        </p>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "good" | "bad";
}) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {note ? <em>{note}</em> : null}
    </article>
  );
}
