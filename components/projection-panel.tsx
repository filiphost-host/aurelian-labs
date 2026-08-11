"use client";

import { Telescope } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/calculations";
import { projectPortfolio } from "@/lib/projection";
import type { DisplayCurrency } from "@/lib/types";

const darkTooltip = {
  backgroundColor: "rgba(14, 13, 15, 0.97)",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  borderRadius: "5px",
  color: "#f4f1ef",
};

export function ProjectionPanel({
  startValueNok,
  displayCurrency,
  fxRates,
}: {
  startValueNok: number;
  displayCurrency: DisplayCurrency;
  fxRates: Record<string, number>;
}) {
  const [monthlyDeposit, setMonthlyDeposit] = useState(2000);
  const [years, setYears] = useState(15);
  const [expectedReturn, setExpectedReturn] = useState(6);
  const [volatility, setVolatility] = useState(15);

  const projection = useMemo(
    () => projectPortfolio({
      startValueNok,
      monthlyDepositNok: monthlyDeposit,
      years,
      expectedReturnPercent: expectedReturn,
      volatilityPercent: volatility,
    }),
    [expectedReturn, monthlyDeposit, startValueNok, volatility, years],
  );

  const money = (value: number) => formatMoney(value, displayCurrency, fxRates);
  const chartData = projection.years.map((year) => ({
    year: year.year,
    contributed: year.contributedNok,
    p10: year.p10Nok,
    band: year.p90Nok - year.p10Nok,
    p50: year.p50Nok,
  }));

  return (
    <section className="panel wide projection-panel">
      <div className="panel-title-row">
        <div>
          <span className="eyebrow">Looking forward</span>
          <h2>Where steady saving could lead</h2>
        </div>
        <Telescope size={19} aria-hidden="true" />
      </div>

      <div className="form-grid projection-controls">
        <label className="field">
          <span>Saved each month</span>
          <input
            type="number" min="0" step="500" value={monthlyDeposit}
            onChange={(event) => setMonthlyDeposit(Math.max(0, Number(event.target.value) || 0))}
          />
        </label>
        <label className="field">
          <span>Years from now</span>
          <input
            type="number" min="1" max="50" value={years}
            onChange={(event) => setYears(Math.min(50, Math.max(1, Number(event.target.value) || 1)))}
          />
        </label>
        <label className="field">
          <span>Assumed return a year (%)</span>
          <input
            type="number" min="-99" max="100" step="0.5" value={expectedReturn}
            onChange={(event) => setExpectedReturn(Math.min(100, Math.max(-99, Number(event.target.value) || 0)))}
          />
        </label>
        <label className="field">
          <span>Assumed volatility (%)</span>
          <input
            type="number" min="0" max="200" step="1" value={volatility}
            onChange={(event) => setVolatility(Math.min(200, Math.max(0, Number(event.target.value) || 0)))}
          />
        </label>
      </div>

      <div className="analyst-callouts three">
        <article>
          <span>Today&rsquo;s value plus deposits</span>
          <strong>{money(projection.finalContributedNok)}</strong>
          <em>{money(startValueNok)} today, before any growth</em>
        </article>
        <article>
          <span>Middle outcome</span>
          <strong className="good">{money(projection.finalP50Nok)}</strong>
          <em>
            Half the runs land above, half below. This sits under {expectedReturn}% a year on purpose:
            a swing down costs more than the same swing up returns.
          </em>
        </article>
        <article>
          <span>The range</span>
          <strong>{money(projection.finalP10Nok)} to {money(projection.finalP90Nok)}</strong>
          <em>Eight runs in ten finish inside this band</em>
        </article>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData}>
          <CartesianGrid stroke="rgba(255, 255, 255, 0.055)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#7f7a7d", fontSize: 11 }}
            tickFormatter={(value) => `${value}y`}
          />
          <YAxis
            width={72}
            tick={{ fill: "#7f7a7d", fontSize: 11 }}
            tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
          />
          <Tooltip
            contentStyle={darkTooltip}
            labelFormatter={(value) => `Year ${value}`}
            formatter={(value, name) => [
              money(Number(value)),
              name === "contributed" ? "Paid in" : "Middle outcome",
            ]}
          />
          {/* Stacked so the band sits on top of the tenth percentile and shows the spread. */}
          <Area type="monotone" dataKey="p10" stackId="cone" stroke="none" fill="transparent" tooltipType="none" />
          <Area type="monotone" dataKey="band" stackId="cone" stroke="none" fill="rgba(79, 157, 120, 0.16)" tooltipType="none" />
          <Line type="monotone" dataKey="p50" stroke="#4f9d78" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="contributed" stroke="#b94b5e" strokeWidth={1.6} strokeDasharray="5 5" dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      <p className="panel-note">
        This is arithmetic on the four numbers above, not a forecast. It draws {projection.paths}{" "}
        random paths using an assumed average return and volatility, and shows where they land. Real markets do
        not deliver an average year on schedule, do not move independently from month to month, and have
        no obligation to resemble any of this. The dashed line is today&rsquo;s value plus everything you
        would pay in; the gap above it is growth. Because these are sampled paths, each figure carries a
        margin of a few percent, so read them as rounded rather than exact.
      </p>
    </section>
  );
}
