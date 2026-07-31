import { ArrowUpRight, LockKeyhole } from "lucide-react";
import { notFound } from "next/navigation";
import { hashShareToken, isValidShareToken } from "@/lib/share-tokens";
import { createAdminClient } from "@/lib/supabase-admin";
import { isExpired } from "@/lib/server-time";
import type { Insight, ShareSnapshotPayload } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function SharedSnapshotPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidShareToken(token)) notFound();
  const admin = createAdminClient();
  if (!admin) notFound();

  const { data } = await admin
    .from("share_snapshots")
    .select("payload,expires_at,revoked_at")
    .eq("token_hash", hashShareToken(token))
    .maybeSingle();
  if (!data || data.revoked_at || isExpired(data.expires_at)) notFound();

  const payload = data.payload as ShareSnapshotPayload;
  const insights = Array.isArray(payload.content.insights)
    ? payload.content.insights as Insight[]
    : [];

  return (
    <main className="share-shell">
      <header className="share-header">
        <div className="brand-lock">
          <LockKeyhole size={18} />
          <span>Read-only Aurelian snapshot</span>
        </div>
        <h1>{payload.title}</h1>
        <p>
          Frozen {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.createdAt))}
          {" · "}
          expires {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(payload.expiresAt))}
        </p>
      </header>

      {typeof payload.content.summary === "string" ? (
        <section className="share-summary">{payload.content.summary}</section>
      ) : null}

      <section className="shared-insights">
        {insights.map((item) => (
          <article className="shared-insight" key={item.id}>
            <span>{item.kind}</span>
            <h2>{item.title}</h2>
            <dl>
              <div><dt>Fact</dt><dd>{item.fact}</dd></div>
              <div><dt>Portfolio relevance</dt><dd>{item.relevance}</dd></div>
              <div><dt>Possible scenario</dt><dd>{item.scenario}</dd></div>
            </dl>
            <footer>
              {item.source_url ? (
                <a href={item.source_url} target="_blank" rel="noreferrer">
                  {item.source} <ArrowUpRight size={13} />
                </a>
              ) : item.source}
              <span>As of {item.as_of}</span>
            </footer>
          </article>
        ))}
      </section>

      {payload.kind === "scenario" ? (
        <pre className="scenario-snapshot">{JSON.stringify(payload.content.scenario, null, 2)}</pre>
      ) : null}

      <p className="share-disclaimer">
        Educational analysis only. This snapshot is not investment advice and does not update after publication.
      </p>
    </main>
  );
}
