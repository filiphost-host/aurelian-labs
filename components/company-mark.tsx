import Image from "next/image";
import { ChartNoAxesCombined, ExternalLink, Landmark } from "lucide-react";
import { companyIdentityForName, companyIdentityForTicker, companyLogoForTicker, type CompanyIdentity } from "@/lib/company-directory";

export function CompanyMark({
  identity,
  name,
  ticker,
  assetType,
  size = 26,
}: {
  identity?: CompanyIdentity | null;
  name?: string;
  ticker?: string;
  assetType?: "stock" | "etf" | "bond";
  size?: number;
}) {
  const company = identity
    ?? (ticker ? companyIdentityForTicker(ticker) : null)
    ?? (name ? companyIdentityForName(name) : null);
  const logo = company?.logo ?? (ticker ? companyLogoForTicker(ticker) : null);
  if (!logo) {
    return (
      <span className="company-mark fallback" style={{ width: size, height: size }} title={assetType === "bond" ? "Bond" : "Listed instrument"}>
        {assetType === "bond" ? <Landmark size={Math.max(13, size * .52)} /> : <ChartNoAxesCombined size={Math.max(13, size * .52)} />}
      </span>
    );
  }
  return (
    <span className="company-mark" style={{ width: size, height: size }} title={company?.name ?? ticker}>
      <Image unoptimized src={logo} alt={`${company?.name ?? ticker ?? "Company"} logo`} width={size} height={size} />
    </span>
  );
}

export function CompanyLink({ identity, compact = false }: { identity: CompanyIdentity; compact?: boolean }) {
  return (
    <a
      className={`company-link${compact ? " compact" : ""}`}
      href={identity.investorUrl}
      target="_blank"
      rel="noreferrer"
      title={`Open ${identity.name} investor relations`}
    >
      <CompanyMark identity={identity} size={compact ? 20 : 27} />
      <span><strong>{identity.name}</strong><small>{identity.ticker}</small></span>
      {!compact ? <ExternalLink size={12} /> : null}
    </a>
  );
}
