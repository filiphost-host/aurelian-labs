"use client";

import { FileUp, ShieldCheck, TriangleAlert, Upload, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  buildImportPlan,
  importFieldLabels,
  type ColumnMapping,
  type ImportField,
} from "@/lib/csv-import";
import type { Holding, Transaction } from "@/lib/types";

const editableFields: ImportField[] = [
  "date",
  "type",
  "symbol",
  "isin",
  "quantity",
  "unitPrice",
  "amount",
  "fee",
  "currency",
  "fxToNok",
  "note",
];

const previewLimit = 500;

export function CsvImportDialog({
  holdings,
  transactions,
  onClose,
  onImport,
}: {
  holdings: Holding[];
  transactions: Transaction[];
  onClose: () => void;
  onImport: (drafts: Transaction[]) => void;
}) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<ColumnMapping | null>(null);
  // Rows the owner switched away from their default. Rows that resemble an entry
  // already in the ledger start unticked, so a duplicate needs a deliberate click.
  const [toggled, setToggled] = useState<Set<number>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);

  const plan = useMemo(
    () => (text.trim()
      ? buildImportPlan({ text, holdings, existingTransactions: transactions, mapping: overrides ?? undefined })
      : null),
    [holdings, overrides, text, transactions],
  );

  const isSelected = (candidate: { rowNumber: number; duplicate: string | null }) =>
    candidate.duplicate !== "already-imported" &&
    (candidate.duplicate === null) !== toggled.has(candidate.rowNumber);

  const importable = useMemo(
    () => plan?.candidates.filter((candidate) =>
      candidate.duplicate !== "already-imported" &&
      (candidate.duplicate === null) !== toggled.has(candidate.rowNumber)) ?? [],
    [plan, toggled],
  );

  function readFile(file: File | undefined) {
    if (!file) return;
    setReadError(null);
    const reader = new FileReader();
    reader.onerror = () => setReadError(`${file.name} could not be read.`);
    reader.onload = () => {
      setText(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
      setOverrides(null);
      setToggled(new Set());
    };
    reader.readAsText(file);
  }

  function toggleRow(rowNumber: number) {
    setToggled((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function setMapping(field: ImportField, column: number | undefined) {
    setOverrides((current) => {
      const base = { ...(current ?? plan?.mapping ?? {}) };
      if (column === undefined) delete base[field];
      else base[field] = column;
      return base;
    });
  }

  const alreadyImported = plan?.candidates.filter((candidate) => candidate.duplicate === "already-imported").length ?? 0;
  const looksExisting = plan?.candidates.filter((candidate) => candidate.duplicate === "matches-existing").length ?? 0;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Transaction ledger</span>
            <h2 id="import-title">Import from your broker</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close importer"><X size={17} /></button>
        </div>

        <p className="modal-copy import-privacy">
          <ShieldCheck size={15} aria-hidden="true" />
          The file is read in this browser and never uploaded. Only the rows you confirm are saved.
        </p>

        <div className="import-source">
          <button className="ghost-button" onClick={() => fileInput.current?.click()}>
            <FileUp size={16} /> Choose a CSV file
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            className="visually-hidden-input"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              readFile(event.target.files?.[0]);
              // Cleared so choosing the same file again still fires a change event.
              event.target.value = "";
            }}
          />
          <span>{fileName ?? "or paste the rows below"}</span>
        </div>

        <label className="field wide-field">
          <span>Pasted rows</span>
          <textarea
            rows={4}
            value={text}
            placeholder="Handelsdato;Transaksjonstype;Verdipapir;Antall;Kurs;Beløp;Kurtasje;Valuta"
            onChange={(event) => {
              setText(event.target.value);
              setOverrides(null);
              setToggled(new Set());
              setFileName(null);
            }}
          />
        </label>

        {readError ? <p className="import-error" role="alert">{readError}</p> : null}

        {plan ? (
          <>
            <div className="import-summary">
              <article><span>Ready to import</span><strong>{importable.length}</strong></article>
              <article><span>Already imported</span><strong>{alreadyImported}</strong></article>
              <article><span>Needs a second look</span><strong>{looksExisting}</strong></article>
              <article><span>Needs attention</span><strong>{plan.issues.length}</strong></article>
            </div>

            <details className="import-mapping">
              <summary>Column mapping{overrides ? " (edited)" : " (detected automatically)"}</summary>
              <div className="form-grid">
                {editableFields.map((field) => (
                  <label className="field" key={field}>
                    <span>{importFieldLabels[field]}</span>
                    <select
                      value={plan.mapping[field] ?? ""}
                      onChange={(event) => setMapping(field, event.target.value === "" ? undefined : Number(event.target.value))}
                    >
                      <option value="">Not mapped</option>
                      {plan.headers.map((header, column) => (
                        <option key={`${header}-${column}`} value={column}>{header || `Column ${column + 1}`}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>

            {plan.candidates.length ? (
              <div className="table-wrap import-preview">
                <table>
                  <thead>
                    <tr>
                      <th>Import</th>
                      <th>Row</th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Holding</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Amount</th>
                      <th>Fee</th>
                      <th>Currency</th>
                      <th>FX to NOK</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.candidates.slice(0, previewLimit).map((candidate) => {
                      const locked = candidate.duplicate === "already-imported";
                      return (
                        <tr key={candidate.rowNumber} className={locked ? "import-row-locked" : ""}>
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected(candidate)}
                              disabled={locked}
                              onChange={() => toggleRow(candidate.rowNumber)}
                              aria-label={`Import row ${candidate.rowNumber}`}
                            />
                          </td>
                          <td>{candidate.rowNumber}</td>
                          <td>{candidate.draft.occurred_at}</td>
                          <td>{candidate.draft.type.replaceAll("_", " ")}</td>
                          <td>{candidate.matchedHoldingName ?? "Portfolio cash"}</td>
                          <td>{candidate.draft.quantity ?? "—"}</td>
                          <td>{candidate.draft.unit_price ?? "—"}</td>
                          <td>{candidate.draft.amount ?? "—"}</td>
                          <td>{candidate.draft.fee}</td>
                          <td>{candidate.draft.currency}</td>
                          <td>{candidate.draft.fx_to_nok}</td>
                          <td>
                            {candidate.duplicate === "already-imported" ? <span className="import-tag locked">Already imported</span>
                              : candidate.duplicate === "matches-existing" ? <span className="import-tag warn">Matches an existing entry</span>
                                : <span className="import-tag ok">New</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {plan.candidates.length > previewLimit ? (
              <p className="panel-note">
                Showing the first {previewLimit} of {plan.candidates.length} rows. Rows past this point cannot be
                reviewed here; any of them that resemble an existing entry stay unticked and are left out.
              </p>
            ) : null}
            {looksExisting ? (
              <p className="panel-note">
                Rows marked &ldquo;matches an existing entry&rdquo; start unticked. Tick one only if the ledger
                really should hold it twice.
              </p>
            ) : null}

            {plan.issues.length ? (
              <div className="import-issues">
                <h3><TriangleAlert size={15} aria-hidden="true" /> Rows left out</h3>
                <ul>
                  {plan.issues.slice(0, 20).map((issue) => (
                    <li key={issue.rowNumber}><strong>Row {issue.rowNumber}</strong> {issue.reason}</li>
                  ))}
                </ul>
                {plan.issues.length > 20 ? <p className="panel-note">and {plan.issues.length - 20} more.</p> : null}
              </div>
            ) : null}
          </>
        ) : null}

        <div className="modal-actions">
          <button className="ghost-button" onClick={onClose}>Cancel</button>
          <button
            className="primary-button"
            disabled={importable.length === 0}
            onClick={() => onImport(importable.map((candidate) => candidate.draft))}
          >
            <Upload size={16} /> Import {importable.length} transaction{importable.length === 1 ? "" : "s"}
          </button>
        </div>
      </section>
    </div>
  );
}
