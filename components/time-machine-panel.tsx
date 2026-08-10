"use client";

import { History } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney, formatPercent } from "@/lib/calculations";
import type { BenchmarkPricePoint } from "@/lib/portfolio-story";
import { historicalWindows, replayWindow } from "@/lib/time-machine";
import type { DisplayCurrency, LedgerPosition } from "@/lib/types";

export function TimeMachinePanel({
  positions,
  benchmarkPrices,
  displayCurrency,
  fxRates,
}: {
  positions: LedgerPosition[];
  benchmarkPrices: BenchmarkPricePoint[];
  displayCurrency: DisplayCurrency;
  fxRates: Record<string, number>;
}) {
  const [windowId, setWindowId] = useState(historicalWindows[0].id);
  const window = historicalWindows.find((entry) => entry.id === windowId) ?? historicalWindows[0];
  const replay = useMemo(
    () => replayWindow(positions, benchmarkPrices, window),
    [benchmarkPrices, positions, window],
  );

  const money = (value: number) => formatMoney(value, displayCurrency, fxRates);
  // Largest absolute move: in a window that rose, the smallest number is the least
  // affected holding, not the most.
  const worst = [...replay.positions]
    .sort((left, right) => Math.abs(right.impactNok) - Math.abs(left.impactNok))[0];

  return (
    <section className="panel wide time-machine">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow">Time machine</span>
          <h2>Today&rsquo;s portfolio, put through a real past</h2>
        </div>
        <History size={19} aria-hidden="true" />
      </div>

      <div className="time-machine-controls" role="tablist" aria-label="Historical windows">
        {historicalWindows.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={entry.id === windowId}
            className={entry.id === windowId ? "active" : ""}
            onClick={() => setWindowId(entry.id)}
          >{entry.name}</button>
        ))}
      </div>

      <p className="panel-note">{window.description}</p>

      {replay.move ? (
        <>
          <div className="analyst-callouts three">
            <article>
              <span>What the S&amp;P 500 did</span>
              <strong className={replay.move.returnPercent >= 0 ? "good" : "bad"}>
                {formatPercent(replay.move.returnPercent)}
              </strong>
              <em>
                {replay.move.startDate} to {replay.move.endDate}, from stored closes
                {replay.move.truncated ? " — shorter than the window, because stored history does not cover all of it" : ""}
              </em>
            </article>
            <article>
              <span>Your portfolio would have</span>
              <strong className={replay.impactNok >= 0 ? "good" : "bad"}>{money(replay.impactNok)}</strong>
              <em>{formatPercent(replay.impactPercent)} of today&rsquo;s value</em>
            </article>
            <article>
              <span>Most affected</span>
              <strong className={worst && worst.impactNok < 0 ? "bad" : "good"}>
                {worst ? worst.ticker || worst.name : "—"}
              </strong>
              <em>{worst ? `${money(worst.impactNok)} on an exposure of ${worst.exposure.toFixed(2)}` : "No priced positions"}</em>
            </article>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Holding</th><th>Value today</th><th>Equity exposure</th><th>Estimated move</th><th>Estimated change</th></tr>
              </thead>
              <tbody>
                {replay.positions.map((entry) => (
                  <tr key={entry.holdingId}>
                    <td><strong>{entry.name}</strong><span>{entry.ticker || "No ticker"}</span></td>
                    <td>{money(entry.valueNok)}</td>
                    <td>{entry.exposure === 0 ? "None recorded" : entry.exposure.toFixed(2)}</td>
                    <td className={entry.impactPercent >= 0 ? "good" : "bad"}>
                      {entry.exposure === 0 ? "—" : formatPercent(entry.impactPercent)}
                    </td>
                    <td className={entry.impactNok >= 0 ? "good" : "bad"}>
                      {entry.exposure === 0 ? "—" : money(entry.impactNok)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="panel-note">
            The benchmark move is real, read from the closes stored by the daily refresh. What each
            holding does with it is not: every position is assumed to move in a straight line with the
            index, in proportion to the largest broad-market exposure recorded for it. Sector exposures
            such as technology are left out, because they describe sensitivity to a sector rather than to
            this index. No individual share behaved that way on those days.
            {replay.uncoveredCount > 0
              ? ` ${replay.uncoveredCount} position${replay.uncoveredCount === 1 ? " has" : "s have"} no broad-market exposure recorded, so ${replay.uncoveredCount === 1 ? "it does" : "they do"} not move here at all.`
              : ""}
          </p>
        </>
      ) : (
        <p className="panel-note">
          This window is not covered by the stored benchmark closes yet. The nightly refresh backfills
          ten years on its first run, after which every window here can be measured.
        </p>
      )}
    </section>
  );
}
