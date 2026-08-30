"use client";

import { Activity, Landmark, ShieldCheck, Sigma, TrendingDown } from "lucide-react";
import { useState, type ComponentType } from "react";

type Playbook = {
  id: string;
  name: string;
  vehicle: string;
  region: string;
  style: string;
  crisis: string;
  result: string;
  principle: string;
  blindSpot: string;
  sourceLabel: string;
  sourceUrl: string;
  Icon: ComponentType<{ size?: number }>;
};

const playbooks: Playbook[] = [
  {
    id: "buffett",
    name: "Warren Buffett",
    vehicle: "Berkshire Hathaway",
    region: "United States",
    style: "Quality businesses, insurance float, patient liquidity",
    crisis: "Global Financial Crisis · 2008",
    result: "Berkshire's per-share market value fell 31.8% in 2008 versus 37.0% for the S&P 500. It was resilient, not immune; liquidity created room to deploy capital while others were constrained.",
    principle: "Treat cash as option value when opportunities are scarce, while measuring its drag during ordinary markets.",
    blindSpot: "A famous investor's cash balance does not reveal your own timing horizon, liabilities, or opportunity set.",
    sourceLabel: "Berkshire 2008 shareholder letter",
    sourceUrl: "https://www.berkshirehathaway.com/letters/2008ltr.pdf",
    Icon: ShieldCheck,
  },
  {
    id: "ackman",
    name: "Bill Ackman",
    vehicle: "Pershing Square",
    region: "United States",
    style: "Concentrated quality, activism, occasional asymmetric hedges",
    crisis: "COVID shock · 2020",
    result: "A roughly $27 million credit hedge generated about $2.6 billion. Pershing reported that the proceeds offset portfolio losses and supplied capital to reinvest during the dislocation.",
    principle: "A hedge can be designed to create liquidity in a specific failure state, rather than merely lowering everyday volatility.",
    blindSpot: "This was an exceptional, path-dependent outcome. Repeatedly buying crisis insurance can be expensive and difficult to time.",
    sourceLabel: "Pershing Square 2023 annual report",
    sourceUrl: "https://pershingsquareholdings.com/wp-content/uploads/2025/02/Pershing-Square-Holdings-Ltd.-2023-Annual-Report-1.pdf",
    Icon: TrendingDown,
  },
  {
    id: "renaissance",
    name: "Renaissance Technologies",
    vehicle: "Public 13F lens",
    region: "United States",
    style: "Systematic signals, broad diversification, rapid portfolio turnover",
    crisis: "Model opacity · all periods",
    result: "The public filing shows a delayed subset of US long positions. It does not disclose shorts, derivatives, intraperiod trading, or the Medallion strategy, so a holdings clone would be misleading.",
    principle: "Use rules, many independent signals, and disciplined sizing; test the whole process rather than admiring individual positions.",
    blindSpot: "Public holdings are incomplete and stale. Apparent concentration or conviction may be offset elsewhere in the portfolio.",
    sourceLabel: "Renaissance Technologies SEC 13F",
    sourceUrl: "https://www.sec.gov/Archives/edgar/data/1037389/000103738926000023/0001037389-26-000023-index.html",
    Icon: Sigma,
  },
  {
    id: "smith",
    name: "Terry Smith",
    vehicle: "Fundsmith Equity Fund",
    region: "Europe / global",
    style: "Buy good companies, do not overpay, do nothing",
    crisis: "Rate reset · 2022",
    result: "Fundsmith's 2022 report recorded a negative year as interest rates and valuations reset. High-quality companies still carry valuation duration and can fall together.",
    principle: "Separate business quality from the price paid, then write down which operating measures would invalidate the thesis.",
    blindSpot: "Quality is not a complete factor mix. Similar durable-growth businesses can share hidden rate and valuation exposure.",
    sourceLabel: "Fundsmith 2022 shareholder letter",
    sourceUrl: "https://www.fundsmith.co.uk/media/bm0lyc22/annual-letter-to-shareholders-2022.pdf",
    Icon: Landmark,
  },
];

export function InvestorPlaybooks() {
  const [selectedId, setSelectedId] = useState(playbooks[0].id);
  const selected = playbooks.find((playbook) => playbook.id === selectedId) ?? playbooks[0];
  const SelectedIcon = selected.Icon;

  return (
    <section className="investor-playbooks wide" aria-labelledby="investor-playbooks-title">
      <header className="playbook-heading">
        <div>
          <span className="eyebrow">Pattern library</span>
          <h2 id="investor-playbooks-title">Investor playbooks under pressure</h2>
        </div>
        <div className="playbook-disclaimer"><Activity size={14} /> Historical cases, not model portfolios</div>
      </header>

      <div className="playbook-selector" role="tablist" aria-label="Investor playbooks">
        {playbooks.map((playbook) => {
          const Icon = playbook.Icon;
          const active = playbook.id === selected.id;
          return (
            <button
              key={playbook.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={active ? "active" : ""}
              onClick={() => setSelectedId(playbook.id)}
            >
              <Icon size={18} />
              <span><strong>{playbook.name}</strong><small>{playbook.vehicle}</small></span>
            </button>
          );
        })}
      </div>

      <article className="playbook-detail" role="tabpanel">
        <div className="playbook-profile">
          <span className="playbook-icon"><SelectedIcon size={24} /></span>
          <div><span>{selected.region}</span><h3>{selected.name}</h3><p>{selected.style}</p></div>
        </div>
        <div className="playbook-case">
          <span>Crisis case</span>
          <strong>{selected.crisis}</strong>
          <p>{selected.result}</p>
        </div>
        <div className="playbook-lesson">
          <div><span>What to borrow</span><p>{selected.principle}</p></div>
          <div><span>What not to assume</span><p>{selected.blindSpot}</p></div>
        </div>
        <footer>
          <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Primary source · {selected.sourceLabel}</a>
          <span>Historical observation · educational context</span>
        </footer>
      </article>
    </section>
  );
}
