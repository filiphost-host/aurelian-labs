"use client";

import { Landmark, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";
import type { FxRates } from "@/lib/fx";
import type { Holding } from "@/lib/types";

type Connector = {
  id: string;
  name: string;
  role: string;
  keyless: boolean;
  envVar?: string;
  configured: boolean;
  docsUrl: string;
};

type DataRoom = {
  connectors: Connector[];
  policyRate: { percent: number; asOf: string; source: string } | null;
};

/** Calendar days between a stored date and today, both read in the viewer's own timezone. */
function daysSince(date: string | null) {
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - Date.UTC(year, month - 1, day)) / 86_400_000);
}

function ageLabel(date: string | null) {
  const days = daysSince(date);
  if (days === null) return "never";
  if (days < 0) return "dated ahead of today";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function DataRoomPanel({
  fxRates,
  benchmarkAsOf,
  holdings,
}: {
  fxRates: FxRates;
  benchmarkAsOf: string | null;
  holdings: Holding[];
}) {
  const [dataRoom, setDataRoom] = useState<DataRoom | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/data-room")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((payload: DataRoom) => { if (active) setDataRoom(payload); })
      .catch(() => { if (active) setError("The connector check could not be reached."); });
    return () => { active = false; };
  }, []);

  const verified = holdings.filter((holding) => ["live", "delayed"].includes(holding.price_provenance.status)).length;
  const coverage = holdings.length ? Math.round((verified / holdings.length) * 100) : 0;
  const missing = dataRoom?.connectors.filter((connector) => !connector.configured) ?? [];

  return (
    <section className="panel wide data-room">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Data room</span>
          <h2>Where today&rsquo;s numbers come from</h2>
        </div>
        <PlugZap size={19} aria-hidden="true" />
      </div>

      <div className="data-room-metrics">
        <article>
          <span>Exchange rates</span>
          <strong>{fxRates.asOf ?? "Estimated"}</strong>
          <em>{fxRates.asOf ? `${fxRates.source} · ${ageLabel(fxRates.asOf)}` : "No stored rate yet, so built-in estimates are in use"}</em>
        </article>
        <article>
          <span>Benchmark closes</span>
          <strong>{benchmarkAsOf ?? "Not stored yet"}</strong>
          <em>{benchmarkAsOf ? `Updated ${ageLabel(benchmarkAsOf)}` : "The daily refresh has not run"}</em>
        </article>
        <article>
          <span>Priced from a feed</span>
          <strong>{coverage}%</strong>
          <em>
            {verified} of {holdings.length} positions
            {holdings.length - verified > 0 ? `; ${holdings.length - verified} manual or estimated` : ""}
          </em>
        </article>
        <article>
          <span>Norwegian policy rate</span>
          <strong>{dataRoom?.policyRate ? `${dataRoom.policyRate.percent.toFixed(2)}%` : "—"}</strong>
          <em>{dataRoom?.policyRate ? `Norges Bank · ${dataRoom.policyRate.asOf}` : "Not available"}</em>
        </article>
      </div>

      {error ? <p className="panel-note">{error}</p> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Source</th><th>What it provides</th><th>Access</th><th>Status</th></tr>
          </thead>
          <tbody>
            {(dataRoom?.connectors ?? []).map((connector) => (
              <tr key={connector.id}>
                <td>
                  <a href={connector.docsUrl} target="_blank" rel="noreferrer noopener">{connector.name}</a>
                </td>
                <td>{connector.role}</td>
                <td>{connector.keyless ? "No key needed" : connector.envVar}</td>
                <td>
                  <span className={`import-tag ${connector.configured ? "ok" : "warn"}`}>
                    {connector.configured ? "Connected" : "Not connected"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {missing.length ? (
        <p className="panel-note">
          <Landmark size={14} aria-hidden="true" />{" "}
          {missing.map((connector) => connector.name).join(", ")}{" "}
          {missing.length === 1 ? "has no key set" : "have no keys set"}, so their work falls to the sources above them.
          Each offers a free tier; add the key as an environment variable to switch it on.
        </p>
      ) : null}
    </section>
  );
}
