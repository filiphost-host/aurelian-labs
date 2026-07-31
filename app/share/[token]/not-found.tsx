import Link from "next/link";

export default function ShareNotFound() {
  return (
    <main className="share-shell compact">
      <div className="brand-mark" aria-hidden="true"><span>A</span></div>
      <h1>This snapshot is unavailable</h1>
      <p>It may have expired, been revoked, or the link may be incomplete.</p>
      <Link className="primary-button" href="/login">Return to Aurelian Labs</Link>
    </main>
  );
}
