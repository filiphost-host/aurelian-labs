"use client";

import { Check, Copy, Link2, X } from "lucide-react";
import { useState } from "react";
import type { ShareOptions } from "@/lib/types";

const defaultOptions: ShareOptions = {
  includeHoldings: false,
  includeValues: false,
  includeCommentary: true,
  expiresInDays: 7,
};

export function ShareDialog({
  title,
  kind,
  content,
  onClose,
}: {
  title: string;
  kind: "insight" | "scenario";
  content: Record<string, unknown> | ((options: ShareOptions) => Record<string, unknown>);
  onClose: () => void;
}) {
  const [options, setOptions] = useState(defaultOptions);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createShare() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        kind,
        expiresInDays: options.expiresInDays,
        options: {
          includeHoldings: options.includeHoldings,
          includeValues: options.includeValues,
          includeCommentary: options.includeCommentary,
        },
        content: typeof content === "function" ? content(options) : content,
      }),
    }).catch(() => null);
    const result = response ? await response.json().catch(() => ({})) as { url?: string; message?: string } : {};
    setBusy(false);
    if (!response?.ok || !result.url) {
      setMessage(result.message ?? "The private share service is not available in preview mode.");
      return;
    }
    setUrl(result.url);
    await navigator.clipboard.writeText(result.url).catch(() => undefined);
    setMessage("Read-only link created and copied.");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setMessage("Link copied.");
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="modal compact-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Frozen read-only snapshot</span>
            <h2 id="share-title">Share selected analysis</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close share dialog"><X size={17} /></button>
        </div>

        <p className="share-freeze-note">
          This is a frozen snapshot, not live portfolio access. The link uses an opaque token,
          expires after the period you pick (7 days by default), and can be revoked immediately
          from the Data room once created. Holding names and values stay off unless you tick them.
        </p>
        <div className="privacy-list">
          <label>
            <input
              type="checkbox"
              checked={options.includeHoldings}
              onChange={(event) => setOptions((current) => ({
                ...current,
                includeHoldings: event.target.checked,
                includeValues: event.target.checked ? current.includeValues : false,
              }))}
            />
            <span><strong>Holding names</strong><em>Off by default</em></span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.includeValues}
              disabled={!options.includeHoldings}
              onChange={(event) => setOptions((current) => ({ ...current, includeValues: event.target.checked }))}
            />
            <span><strong>Portfolio values</strong><em>Requires holding names</em></span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={options.includeCommentary}
              onChange={(event) => setOptions((current) => ({ ...current, includeCommentary: event.target.checked }))}
            />
            <span><strong>Analysis commentary</strong><em>Fact, relevance, and scenarios</em></span>
          </label>
        </div>

        <label className="field">
          <span>Link expires</span>
          <select
            value={options.expiresInDays}
            onChange={(event) => setOptions((current) => ({ ...current, expiresInDays: Number(event.target.value) }))}
          >
            <option value={1}>After 1 day</option>
            <option value={7}>After 7 days</option>
            <option value={14}>After 14 days</option>
            <option value={30}>After 30 days</option>
          </select>
        </label>

        {url ? (
          <div className="share-url">
            <Link2 size={16} />
            <span>{url}</span>
            <button className="icon-button" onClick={copyLink} aria-label="Copy share link"><Copy size={15} /></button>
          </div>
        ) : null}
        {url ? (
          <p className="panel-note">
            Anyone with the link sees only this frozen payload. Revoke it from Insights → Data sources if you need it dead before expiry.
          </p>
        ) : null}
        {message ? <p className="form-message" role="status">{message}</p> : null}

        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={createShare} disabled={busy || Boolean(url)}>
            {url ? <Check size={16} /> : <Link2 size={16} />}
            {url ? "Created" : busy ? "Creating..." : "Create link"}
          </button>
        </div>
      </section>
    </div>
  );
}
