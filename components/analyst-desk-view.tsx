"use client";

import { ArrowDownRight, Coins, Layers, TrendingDown } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  annualizeReturn,
  concentration,
  dividendsByYear,
  drawdown,
  flowSummary,
  fxAttribution,
  snapshotSpanYears,
} from "@/lib/analytics";
import { formatMoney, formatPercent, portfolioSummary } from "@/lib/calculations";
import type { DisplayCurrency, Holding, PortfolioSnapshot, Transaction } from "@/lib/types";

const darkTooltip = {
  backgroundColor: "rgba(14, 13, 15, 0.97)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: "5px",
  color: "#f4f1ef",
};

export function AnalystDeskView({
  holdings,
  transactions,
  snapshots,
  fxRates,
  displayCurrency,
}: {
  holdings: Holding[];
  transactions: Transaction[];
  snapshots: PortfolioSnapshot[];
  fxRates: Record<string, number>;
  displayCurrency: DisplayCurrency;
}) {
  const summary = useMemo(
    () => portfolioSummary(holdings, transactions, snapshots, fxRates),
    [fxRates, holdings, snapshots, transactions],
  );
  const spanYears = useMemo(() => snapshotSpanYears(snapshots), [snapshots]);
  const annualTimeWeighted = annualizeReturn(summary.timeWeightedReturn, spanYears);
  const firstSnapshot = useMemo(
    () => [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))[0]?.snapshot_date ?? null,
    [snapshots],
  );
  const decline = useMemo(() => drawdown(snapshots), [snapshots]);
  const weights = useMemo(() => concentration(holdings, fxRates), [fxRates, holdings]);
  const attribution = useMemo(
    () => fxAttribution(summary.positions.map((position) => position.holding), transactions, fxRates),
    [fxRates, summary.positions, transactions],
  );
  const flows = useMemo(() => flowSummary(transactions, summary.total), [summary.total, transactions]);
  const dividends = useMemo(() => dividendsByYear(transactions), [transactions]);

  const money = (value: number) => formatMoney(value, displayCurrency, fxRates);
  // Only a share worth quoting; near-zero totals make the ratio meaningless.
  const currencyShare = Math.abs(attribution.attributedGainNok) >= 1
    ? (attribution.currencyGainNok / attribution.attributedGainNok) * 100
    : null;
  const estimatedSnapshots = snapshots.filter((snapshot) => snapshot.source === "legacy_estimate").length;

  return (
    <div className="analyst-layout">
      <section className="metric-grid analyst-returns">
        <Metric
          label="Time-weighted return, a year"
          value={annualTimeWeighted !== null
            ? formatPercent(annualTimeWeighted)
            : snapshots.length < 2 ? "Needs two snapshots" : "Not measurable"}
          note="What the investments did, ignoring when money went in"
          tone={(annualTimeWeighted ?? 0) >= 0 ? "good" : "bad"}
        />
        <Metric
          label="Money-weighted return, a year"
          value={summary.moneyWeightedReturn === null ? "Needs cash flows" : formatPercent(summary.moneyWeightedReturn)}
          note="What you actually earned, timing included"
          tone={(summary.moneyWeightedReturn ?? 0) >= 0 ? "good" : "bad"}
        />
        <Metric
          label="Total return"
          value={summary.timeWeightedReturn === null ? "Needs two snapshots" : formatPercent(summary.timeWeightedReturn)}
          note={firstSnapshot ? `In total since ${firstSnapshot}, not per year` : "Across the stored snapshots"}
          tone={(summary.timeWeightedReturn ?? 0) >= 0 ? "good" : "bad"}
        />
        <Metric
          label="Unrealized gain"
          value={money(summary.unrealizedGain)}
          note={`Realized so far ${money(summary.realizedGain)}`}
          tone={summary.unrealizedGain >= 0 ? "good" : "bad"}
        />
      </section>

      <p className="analyst-explainer">
        The first two are both per-year rates, so they can be compared directly. Time-weighted
        judges the investments; money-weighted judges the investor. When money-weighted is the
        lower of the two, more money was in the portfolio during the weaker stretches than the
        stronger ones. The third is the same time-weighted figure as a running total, which is a
        larger number for the same performance.
        {estimatedSnapshots > 0
          ? ` ${estimatedSnapshots} of ${snapshots.length} stored observations are recorded as legacy estimates rather than calculated values, so read these as approximate.`
          : ""}
      </p>

      <section className="panel wide">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">Depth of decline</span>
            <h2>How far it has fallen from a high</h2>
          </div>
          <TrendingDown size={19} aria-hidden="true" />
        </div>

        {decline.series.length >= 2 ? (
          <>
            <div className="analyst-callouts">
              <article>
                <span>Deepest fall</span>
                <strong className={decline.maxDrawdownPercent === null ? undefined : "bad"}>
                  {decline.maxDrawdownPercent === null ? "None recorded" : formatPercent(decline.maxDrawdownPercent)}
                </strong>
                <em>{decline.peakAt && decline.maxDrawdownAt ? `Peak ${decline.peakAt}, trough ${decline.maxDrawdownAt}` : "No peak recorded"}</em>
              </article>
              <article>
                <span>Today</span>
                <strong className={(decline.currentDrawdownPercent ?? 0) < -0.05 ? "bad" : "good"}>
                  {decline.currentDrawdownPercent === null ? "—" : formatPercent(decline.currentDrawdownPercent)}
                </strong>
                <em>{decline.recovered ? "At or near a new high" : "Still below the previous high"}</em>
              </article>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={decline.series}>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#7f7a7d", fontSize: 11 }} tickFormatter={(value) => String(value).slice(0, 4)} />
                <YAxis width={52} tick={{ fill: "#7f7a7d", fontSize: 11 }} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
                <Tooltip contentStyle={darkTooltip} formatter={(value) => [`${Number(value).toFixed(1)}%`, "Below the high"]} />
                <Area type="monotone" dataKey="drawdownPercent" stroke="#d44f65" strokeWidth={1.8} fill="rgba(212, 79, 101, 0.14)" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="panel-note">
              Measured across {decline.series.length} stored snapshots, not every trading day. Daily
              detail appears as the nightly refresh builds history.
            </p>
          </>
        ) : (
          <p className="panel-note">Two stored snapshots are needed before a decline can be measured.</p>
        )}
      </section>

      <section className="panel wide">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">Concentration</span>
            <h2>How much rides on the largest positions</h2>
          </div>
          <Layers size={19} aria-hidden="true" />
        </div>

        {weights.positions.length ? (
          <>
            <div className="analyst-callouts three">
              <article>
                <span>Largest position</span>
                <strong>{weights.topWeightPercent === null ? "—" : formatPercent(weights.topWeightPercent)}</strong>
                <em>{weights.positions[0]?.name}</em>
              </article>
              <article>
                <span>Top five</span>
                <strong>{weights.topFiveWeightPercent === null ? "—" : formatPercent(weights.topFiveWeightPercent)}</strong>
                <em>of the whole portfolio</em>
              </article>
              <article>
                <span>Effective holdings</span>
                <strong>{weights.effectiveHoldings === null ? "—" : weights.effectiveHoldings.toFixed(1)}</strong>
                <em>{weights.positions.length} positions behave like this many</em>
              </article>
            </div>
            <ResponsiveContainer width="100%" height={Math.max(160, weights.positions.length * 34)}>
              <BarChart data={weights.positions} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#7f7a7d", fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                <YAxis
                  type="category"
                  dataKey="id"
                  width={78}
                  tick={{ fill: "#7f7a7d", fontSize: 11 }}
                  tickFormatter={(value) => weights.positions.find((position) => position.id === value)?.label ?? ""}
                />
                <Tooltip
                  contentStyle={darkTooltip}
                  labelFormatter={(value) => weights.positions.find((position) => position.id === value)?.name ?? ""}
                  formatter={(value) => [`${Number(value).toFixed(1)}%`, "Weight"]}
                />
                <Bar dataKey="weightPercent" radius={[0, 3, 3, 0]}>
                  {weights.positions.map((position) => (
                    <Cell key={position.id} fill={position.weightPercent >= 25 ? "#b94b5e" : "#557c69"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="panel-note">
              Effective holdings is one divided by the sum of the squared weights. Ten positions
              where one holds most of the money behave like far fewer than ten.
              {weights.unpricedCount > 0
                ? ` ${weights.unpricedCount} position${weights.unpricedCount === 1 ? " is" : "s are"} left out: no usable price or no exchange rate for its currency, so these weights describe the rest.`
                : ""}
            </p>
          </>
        ) : (
          <p className="panel-note">No priced positions to measure.</p>
        )}
      </section>

      <section className="panel wide">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">Currency</span>
            <h2>How much of the gain was the krone</h2>
          </div>
          <ArrowDownRight size={19} aria-hidden="true" />
        </div>

        {attribution.coveragePercent > 0 ? (
          <>
            <div className="analyst-callouts three">
              <article>
                <span>From the investments</span>
                <strong className={attribution.assetGainNok >= 0 ? "good" : "bad"}>{money(attribution.assetGainNok)}</strong>
                <em>Price movement in the security&rsquo;s own currency</em>
              </article>
              <article>
                <span>From the exchange rate</span>
                <strong className={attribution.currencyGainNok >= 0 ? "good" : "bad"}>{money(attribution.currencyGainNok)}</strong>
                <em>{currencyShare === null ? "The two parts nearly cancel out" : `${formatPercent(currencyShare)} of the gain below`}</em>
              </article>
              <article>
                <span>Gain against what you paid</span>
                <strong className={attribution.attributedGainNok >= 0 ? "good" : "bad"}>{money(attribution.attributedGainNok)}</strong>
                <em>The two parts together, on {formatPercent(attribution.coveragePercent)} of portfolio value</em>
              </article>
            </div>
            <p className="analyst-explainer">
              This total is measured against the kroner actually paid at the time. The unrealized gain
              on the Portfolio tab converts that cost at today&rsquo;s rate instead, so it matches the
              investments line above and leaves the currency line out. Neither is wrong; they answer
              different questions, and the difference is what the krone did while you held the position.
            </p>
            {attribution.currencies.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Currency</th><th>Purchase rate</th><th>Rate today</th><th>From the investments</th><th>From the rate</th></tr>
                  </thead>
                  <tbody>
                    {attribution.currencies.map((entry) => (
                      <tr key={entry.currency}>
                        <td><strong>{entry.currency}</strong></td>
                        <td>{entry.costFx.toFixed(4)}</td>
                        <td>{entry.currentFx.toFixed(4)}</td>
                        <td className={entry.assetGainNok >= 0 ? "good" : "bad"}>{money(entry.assetGainNok)}</td>
                        <td className={entry.currencyGainNok >= 0 ? "good" : "bad"}>{money(entry.currencyGainNok)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="panel-note">
              A foreign holding can rise while the krone strengthens and still lose value in kroner.
              This split shows which of the two moved the number.
            </p>
          </>
        ) : (
          <p className="panel-note">
            Nothing can be attributed yet. A position is only split once its purchase exchange rate is
            recorded on the transaction, so record the rate on foreign buys and this fills in.
          </p>
        )}
      </section>

      <section className="panel wide">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">Flows and costs</span>
            <h2>Saved, earned, and paid away</h2>
          </div>
          <Coins size={19} aria-hidden="true" />
        </div>

        <div className="analyst-callouts four">
          <article>
            <span>Money put in</span>
            <strong>{flows.hasContributions ? money(flows.netContributedNok) : "Not recorded"}</strong>
            <em>{flows.hasContributions
              ? `${money(flows.depositsNok)} in, ${money(flows.withdrawalsNok)} out`
              : "No deposits or withdrawals in the ledger"}</em>
          </article>
          <article>
            <span>Money it made</span>
            <strong className={flows.hasContributions ? (flows.growthNok >= 0 ? "good" : "bad") : undefined}>
              {flows.hasContributions ? money(flows.growthNok) : "Not measurable"}
            </strong>
            <em>{flows.growthSharePercent === null
              ? "Record the deposits that funded the portfolio to separate saving from growth"
              : `${formatPercent(flows.growthSharePercent)} of today's value`}</em>
          </article>
          <article>
            <span>Dividends received</span>
            <strong>{money(flows.dividendsNok)}</strong>
            <em>{dividends.length ? `across ${dividends.length} year${dividends.length === 1 ? "" : "s"}` : "None recorded"}</em>
          </article>
          <article>
            <span>Fees paid</span>
            <strong className={flows.feesNok > 0 ? "bad" : undefined}>{money(flows.feesNok)}</strong>
            <em>Every krone here compounds for someone else</em>
          </article>
        </div>

        {dividends.length ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dividends}>
              <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#7f7a7d", fontSize: 11 }} />
              <YAxis width={64} tick={{ fill: "#7f7a7d", fontSize: 11 }} />
              <Tooltip contentStyle={darkTooltip} formatter={(value) => [money(Number(value)), "Dividends"]} />
              <Bar dataKey="amountNok" radius={[3, 3, 0, 0]} fill="#557c69" />
            </BarChart>
          </ResponsiveContainer>
        ) : null}

        <p className="panel-note">
          Money put in is deposits minus withdrawals from the ledger. Everything above that line is
          what the portfolio earned rather than what was saved.
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
