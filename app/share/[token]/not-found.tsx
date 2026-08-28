import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function ShareNotFound() {
  return (
    <main className="share-shell compact">
      <BrandMark className="share-brand-mark" />
      <h1>This snapshot is unavailable</h1>
      <p>It may have expired, been revoked, or the link may be incomplete.</p>
      <Link className="primary-button" href="/">Return to Aurelian Capital</Link>
    </main>
  );
}
