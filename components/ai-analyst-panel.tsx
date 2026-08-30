"use client";

import { Bot, Loader2, ShieldCheck, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildAnalystPacket,
  packetToText,
  type AnalystMode,
  type PacketOptions,
} from "@/lib/ai-packet";
import type { DailyBrief, Holding, HoldingDecision } from "@/lib/types";

export function AiAnalystPanel({
  brief,
  holdings,
  decisions,
  fxRates,
  onClose,
}: {
  brief: DailyBrief;
  holdings: Holding[];
  decisions: HoldingDecision[];
  fxRates: Record<string, number>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<AnalystMode>("brief");
  const [subjectHoldingId, setSubjectHoldingId] = useState<string>(
    () => decisions.find((decision) => decision.thesis.trim())?.holding_id ?? "",
  );
  const [options, setOptions] = useState<PacketOptions>({
    includeHoldings: true,
    includeValues: false,
    includeCommentary: true,
  });
  const [packetOpen, setPacketOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Closing the dialog stops the request, so a generation nobody is reading is not
  // left running and billing.
  useEffect(() => () => abortRef.current?.abort(), []);

  const packet = useMemo(
    () => buildAnalystPacket({
      mode,
      brief,
      holdings,
      decisions,
      options,
      fxRates,
      subjectHoldingId: mode === "red-team" ? subjectHoldingId : null,
    }),
    [brief, decisions, fxRates, holdings, mode, options, subjectHoldingId],
  );
  const preview = useMemo(() => packetToText(packet), [packet]);
  const holdingsWithThesis = holdings.filter((holding) =>
    decisions.some((decision) => decision.holding_id === holding.id && decision.thesis.trim()));

  async function ask() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAnswer("");
    setError(null);
    setStatus("streaming");

    try {
      const response = await fetch("/api/ai/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packet),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        setError(payload?.message ?? "The analyst could not be reached.");
        setStatus("error");
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        setAnswer((current) => current + value);
      }
      setStatus("idle");
    } catch (caught) {
      if ((caught as Error).name === "AbortError") {
        setStatus("idle");
        return;
      }
      setError("The analyst could not be reached. Nothing was saved.");
      setStatus("error");
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="modal analyst-modal" role="dialog" aria-modal="true" aria-labelledby="analyst-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Reads only what you send</span>
            <h2 id="analyst-title">Ask the analyst</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close the analyst"><X size={17} /></button>
        </div>

        <p className="modal-copy analyst-privacy">
          <ShieldCheck size={15} aria-hidden="true" />
          The packet below is the model&rsquo;s only source. It has no tools and no access to your workspace,
          and it is told not to recommend trades or state anything the packet does not contain.
        </p>

        <div className="form-grid two-column analyst-controls">
          <label className="field">
            <span>What to ask for</span>
            <select value={mode} onChange={(event) => setMode(event.target.value as AnalystMode)}>
              <option value="brief">A narrative across today&rsquo;s insights</option>
              <option value="red-team">The bear case against one of my theses</option>
            </select>
          </label>
          {mode === "red-team" ? (
            <label className="field">
              <span>Thesis to attack</span>
              <select value={subjectHoldingId} onChange={(event) => setSubjectHoldingId(event.target.value)}>
                {holdingsWithThesis.length === 0 ? <option value="">No holding has a recorded thesis</option> : null}
                {holdingsWithThesis.map((holding) => (
                  <option key={holding.id} value={holding.id}>{holding.ticker ?? holding.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <fieldset className="analyst-options">
          <legend>What the model may see</legend>
          {([
            ["includeHoldings", "Holding names and tickers"],
            ["includeValues", "Position values and weights"],
            ["includeCommentary", "My own commentary on each insight"],
          ] as const).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(event) => setOptions((current) => ({ ...current, [key]: event.target.checked }))}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <details className="analyst-packet" open={packetOpen} onToggle={(event) => setPacketOpen(event.currentTarget.open)}>
          <summary>Read the exact packet before sending it ({preview.length.toLocaleString("nb-NO")} characters)</summary>
          <pre>{preview}</pre>
        </details>

        {error ? <p className="import-error" role="alert">{error}</p> : null}

        {answer ? (
          <article className="analyst-answer">
            {answer.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {status === "streaming" ? <span className="analyst-cursor" aria-hidden="true" /> : null}
          </article>
        ) : null}

        {answer && status !== "streaming" ? (
          <p className="panel-note">
            Analysis, not advice. It can be wrong, and it has only read the packet above.
          </p>
        ) : null}

        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>Close</button>
          {status === "streaming" ? (
            <button className="ghost-button" onClick={() => abortRef.current?.abort()}>
              <Square size={15} /> Stop
            </button>
          ) : null}
          <button
            className="primary-button"
            disabled={status === "streaming" || (mode === "red-team" && !packet.subject)}
            onClick={ask}
          >
            {status === "streaming"
              ? <><Loader2 size={16} className="analyst-spin" /> Thinking</>
              : <><Bot size={16} /> {answer ? "Ask again" : "Send the packet"}</>}
          </button>
        </div>
      </section>
    </div>
  );
}
