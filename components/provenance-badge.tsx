"use client";

import { Clock3, Database, TriangleAlert } from "lucide-react";
import type { DataProvenance, PriceStatus } from "@/lib/types";

const statusLabels: Record<PriceStatus, string> = {
  live: "Live",
  delayed: "Delayed",
  manual: "Manual",
  estimated: "Estimated",
  stale: "Stale",
  unavailable: "Unavailable",
};

export function ProvenanceBadge({
  provenance,
  compact = false,
}: {
  provenance: DataProvenance;
  compact?: boolean;
}) {
  const warning = provenance.status === "stale" || provenance.status === "unavailable";
  const Icon = warning ? TriangleAlert : provenance.status === "manual" ? Database : Clock3;
  const details = [
    statusLabels[provenance.status],
    provenance.source,
    provenance.as_of ? `as of ${provenance.as_of}` : "date unavailable",
    provenance.note,
  ].filter(Boolean).join(" · ");

  return (
    <span className={`provenance ${provenance.status}${compact ? " compact" : ""}`} title={details}>
      <Icon size={compact ? 12 : 13} />
      <span>{statusLabels[provenance.status]}</span>
      {compact ? null : <em>{provenance.as_of ?? "No date"}</em>}
    </span>
  );
}
