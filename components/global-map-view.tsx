"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import { Crosshair, Map as MapIcon, Minus, Plus, Search } from "lucide-react";
import { useState } from "react";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldAtlas from "world-atlas/countries-110m.json";
import { formatPercent, holdingValueNok, totalValueNok } from "@/lib/calculations";
import type { Holding } from "@/lib/types";

type CountryFeature = Feature<Geometry, { name: string }> & { id?: string | number };
type MarketCountry = {
  id: string;
  name: string;
  atlasName: string;
  currency: string;
  keyIndex: string;
  sectors: string;
  policyRate: { value: string; asOf: string; source: string; sourceUrl: string };
  debtToGdp: { value: string; asOf: string; source: string; sourceUrl: string };
  marketCapToGdp: { value: string; asOf: string; source: string; sourceUrl: string };
  note: string;
};

const officialSources = {
  worldBank: "https://data.worldbank.org/indicator/CM.MKT.LCAP.GD.ZS",
  imfDebt: "https://www.imf.org/external/datamapper/GG_DEBT_GDP@GDD",
  policy: "https://www.bis.org/statistics/cbpol.htm",
};

const marketCountries: MarketCountry[] = [
  {
    id: "norway", name: "Norway", atlasName: "Norway", currency: "NOK", keyIndex: "OSEBX",
    sectors: "Energy, financials, seafood, shipping",
    policyRate: { value: "Verify latest", asOf: "Daily source pending", source: "Norges Bank", sourceUrl: "https://www.norges-bank.no/en/topics/Monetary-policy/Policy-rate/" },
    debtToGdp: { value: "Low sovereign debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Annual series", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "A small, concentrated market with material energy and global-risk sensitivity.",
  },
  {
    id: "sweden", name: "Sweden", atlasName: "Sweden", currency: "SEK", keyIndex: "OMXS30",
    sectors: "Industrials, financials, technology",
    policyRate: { value: "Verify latest", asOf: "Daily source pending", source: "Riksbank", sourceUrl: "https://www.riksbank.se/en-gb/statistics/search-interest--exchange-rates/policy-rate-deposit-and-lending-rate/" },
    debtToGdp: { value: "Moderate public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Large Nordic equity market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Industrial quality and global demand matter; household leverage and property are important domestic risks.",
  },
  {
    id: "denmark", name: "Denmark", atlasName: "Denmark", currency: "DKK", keyIndex: "OMXC25",
    sectors: "Health care, industrials, renewables",
    policyRate: { value: "EUR-peg framework", asOf: "Current regime", source: "Danmarks Nationalbank", sourceUrl: "https://www.nationalbanken.dk/en/what-we-do/stable-prices-monetary-policy-and-the-danish-economy/official-interest-rates" },
    debtToGdp: { value: "Low public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Concentrated large-cap market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Index performance can be dominated by a small number of global health-care companies.",
  },
  {
    id: "finland", name: "Finland", atlasName: "Finland", currency: "EUR", keyIndex: "OMXH25",
    sectors: "Industrials, telecom, materials",
    policyRate: { value: "ECB policy", asOf: "Euro-area framework", source: "ECB", sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
    debtToGdp: { value: "Trending higher", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Export-oriented market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "External demand, regional geopolitics, and the European industrial cycle are central sensitivities.",
  },
  {
    id: "united-kingdom", name: "United Kingdom", atlasName: "United Kingdom", currency: "GBP", keyIndex: "FTSE 100",
    sectors: "Financials, energy, health care, staples",
    policyRate: { value: "Verify latest", asOf: "Daily source pending", source: "Bank of England", sourceUrl: "https://www.bankofengland.co.uk/boeapps/database/Bank-Rate.asp" },
    debtToGdp: { value: "High public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Deep global equity market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Global revenue exposure makes the FTSE less representative of the domestic UK economy than its name suggests.",
  },
  {
    id: "germany", name: "Germany", atlasName: "Germany", currency: "EUR", keyIndex: "DAX",
    sectors: "Industrials, autos, chemicals, software",
    policyRate: { value: "ECB policy", asOf: "Euro-area framework", source: "ECB", sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
    debtToGdp: { value: "Moderate developed-market debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Export-led public market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Export demand, energy costs, China exposure, and the European manufacturing cycle matter.",
  },
  {
    id: "france", name: "France", atlasName: "France", currency: "EUR", keyIndex: "CAC 40",
    sectors: "Luxury, industrials, financials, energy",
    policyRate: { value: "ECB policy", asOf: "Euro-area framework", source: "ECB", sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
    debtToGdp: { value: "High public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Large global companies", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Luxury demand, aerospace, euro-area spreads, and fiscal policy are meaningful market drivers.",
  },
  {
    id: "spain", name: "Spain", atlasName: "Spain", currency: "EUR", keyIndex: "IBEX 35",
    sectors: "Financials, utilities, telecom, infrastructure",
    policyRate: { value: "ECB policy", asOf: "Euro-area framework", source: "ECB", sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
    debtToGdp: { value: "High public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Bank and utility heavy", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Tourism, bank margins, energy, and European growth are important sensitivities.",
  },
  {
    id: "united-states", name: "United States", atlasName: "United States of America", currency: "USD", keyIndex: "S&P 500",
    sectors: "Technology, financials, health care",
    policyRate: { value: "Verify latest", asOf: "Daily source pending", source: "Federal Reserve", sourceUrl: "https://fred.stlouisfed.org/series/DFEDTARU" },
    debtToGdp: { value: "High and rising", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Very high developed-market ratio", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "The deepest public market globally, with returns increasingly influenced by a small group of mega-cap companies.",
  },
  {
    id: "canada", name: "Canada", atlasName: "Canada", currency: "CAD", keyIndex: "S&P/TSX Composite",
    sectors: "Financials, energy, materials",
    policyRate: { value: "Verify latest", asOf: "Daily source pending", source: "Bank of Canada", sourceUrl: "https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/" },
    debtToGdp: { value: "Household leverage matters", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Resource and bank heavy", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Commodity prices, housing, and financials dominate the market profile.",
  },
  {
    id: "japan", name: "Japan", atlasName: "Japan", currency: "JPY", keyIndex: "Nikkei 225",
    sectors: "Industrials, technology, consumer exporters",
    policyRate: { value: "Verify latest", asOf: "Daily source pending", source: "Bank of Japan", sourceUrl: "https://www.boj.or.jp/en/mopo/mpmdeci/mpr_2026/index.htm" },
    debtToGdp: { value: "Very high public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Large developed market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Yen moves, governance reform, and Bank of Japan policy drive global spillovers.",
  },
  {
    id: "australia", name: "Australia", atlasName: "Australia", currency: "AUD", keyIndex: "ASX 200",
    sectors: "Financials, materials, energy",
    policyRate: { value: "Verify latest", asOf: "Daily source pending", source: "Reserve Bank of Australia", sourceUrl: "https://www.rba.gov.au/statistics/cash-rate/" },
    debtToGdp: { value: "Housing and private credit matter", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Bank and commodity heavy", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "China demand, iron ore, housing, and bank credit are central market drivers.",
  },
];

const countryCollection = feature<{ name: string }>(
  worldAtlas as never,
  "countries",
) as unknown as FeatureCollection<Geometry, { name: string }>;
const projection = geoNaturalEarth1().fitExtent([[0, -34], [900, 492]], { type: "Sphere" });
const mapPath = geoPath(projection);
const worldCountries = countryCollection.features
  .map((country) => ({
    feature: country as CountryFeature,
    name: country.properties.name,
    path: mapPath(country) ?? "",
    centroid: mapPath.centroid(country),
  }))
  .filter((country) => country.path);
const marketByAtlasName = new Map(marketCountries.map((country) => [country.atlasName, country]));

export function GlobalMapView({
  holdings,
  requestedCountry,
}: {
  holdings: Holding[];
  requestedCountry: string | null;
}) {
  const requestedMarket = marketCountries.find((item) =>
    item.name.toLowerCase() === requestedCountry?.toLowerCase(),
  );
  const requestedShape = requestedMarket
    ? worldCountries.find((item) => item.name === requestedMarket.atlasName)
    : null;
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(requestedMarket?.id ?? "norway");
  const [zoom, setZoom] = useState(requestedMarket ? 1.7 : 1.5);
  const [center, setCenter] = useState<[number, number]>(
    requestedShape ? requestedShape.centroid as [number, number] : [485, 205],
  );
  const [query, setQuery] = useState(requestedMarket?.name ?? "");
  const activeId = hoveredId ?? pinnedId;
  const previewCountry = marketCountries.find((country) => country.id === hoveredId) ?? null;
  const selectedCountry = marketCountries.find((country) => country.id === pinnedId) ?? previewCountry;
  const previewShape = previewCountry
    ? worldCountries.find((country) => country.name === previewCountry.atlasName)
    : null;
  const portfolioTotal = totalValueNok(holdings);

  const viewWidth = 900 / zoom;
  const viewHeight = 460 / zoom;
  const viewX = Math.max(0, Math.min(900 - viewWidth, center[0] - viewWidth / 2));
  const viewY = Math.max(0, Math.min(460 - viewHeight, center[1] - viewHeight / 2));
  const previewCentroid = previewShape?.centroid ?? [450, 230];
  const calloutX = previewCentroid[0] > 540 ? previewCentroid[0] - 270 : previewCentroid[0] + 28;
  const calloutY = Math.max(18, previewCentroid[1] - 80);

  function selectCountry(country: MarketCountry) {
    const shape = worldCountries.find((item) => item.name === country.atlasName);
    setPinnedId(country.id);
    setHoveredId(null);
    setQuery(country.name);
    if (shape) setCenter(shape.centroid as [number, number]);
    setZoom((current) => Math.max(current, 1.48));
  }

  function resetMap() {
    setPinnedId("norway");
    setHoveredId(null);
    setZoom(1.5);
    setCenter([485, 205]);
    setQuery("");
  }

  const suggestions = query
    ? marketCountries.filter((country) => country.name.toLowerCase().includes(query.toLowerCase()) && country.name !== query)
    : [];
  const activeExposure = selectedCountry && portfolioTotal
    ? holdings.filter((holding) => holding.country === selectedCountry.name)
      .reduce((sum, holding) => sum + holdingValueNok(holding), 0) / portfolioTotal * 100
    : 0;

  return (
    <div className="map-layout">
      <section className="map-toolbar">
        <div>
          <span className="eyebrow">Sourced country context</span>
          <h2>Global securities map</h2>
        </div>
        <div className="country-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a market"
            aria-label="Find a country market"
          />
          {suggestions.length ? (
            <div className="country-suggestions">
              {suggestions.map((country) => (
                <button key={country.id} onClick={() => selectCountry(country)}>
                  <strong>{country.name}</strong><span>{country.keyIndex} · {country.currency}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel wide map-panel">
        <div className="world-map-shell" onMouseLeave={() => setHoveredId(null)}>
          <svg className="world-map" viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`} role="img" aria-label="Interactive global securities map">
            <defs>
              <filter id="map-grain-filter">
                <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="3" stitchTiles="stitch" />
                <feComponentTransfer><feFuncA type="table" tableValues="0 0.14" /></feComponentTransfer>
              </filter>
              <linearGradient id="mapGold" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#efd27b" />
                <stop offset="52%" stopColor="#c99738" />
                <stop offset="100%" stopColor="#725418" />
              </linearGradient>
            </defs>
            <rect width="900" height="460" className="map-ocean" />
            <rect width="900" height="460" className="map-grain" />
            <g className="map-grid-lines">
              {[120, 240, 360, 480, 600, 720].map((x) => <line key={`x-${x}`} x1={x} y1="0" x2={x} y2="460" />)}
              {[90, 170, 250, 330, 410].map((y) => <line key={`y-${y}`} x1="0" y1={y} x2="900" y2={y} />)}
            </g>
            {worldCountries.map((country) => {
              const market = marketByAtlasName.get(country.name);
              if (!market) return <path key={country.name} className="map-land muted" d={country.path} />;
              const active = market.id === activeId;
              const isNordic = ["norway", "sweden", "denmark", "finland"].includes(market.id);
              return (
                <g
                  key={country.name}
                  role="button"
                  tabIndex={0}
                  aria-pressed={pinnedId === market.id}
                  aria-label={`${pinnedId === market.id ? "Pinned" : "Open"} ${market.name} market profile`}
                  onMouseEnter={() => setHoveredId(market.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(market.id)}
                  onBlur={() => setHoveredId(null)}
                  onClick={() => selectCountry(market)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") selectCountry(market);
                  }}
                >
                  <path className={`map-land market-country${active ? " active" : ""}${pinnedId === market.id ? " pinned" : ""}`} d={country.path} />
                  <circle className="market-hit-target" cx={country.centroid[0]} cy={country.centroid[1]} r={isNordic ? 13 : 8} />
                  <circle className="market-pulse" cx={country.centroid[0]} cy={country.centroid[1]} r={isNordic ? 4.5 : 3.5} />
                </g>
              );
            })}
            {previewCountry ? (
              <g className="callout-layer" pointerEvents="none">
                <line className="callout-line" x1={previewCentroid[0]} y1={previewCentroid[1]} x2={calloutX} y2={calloutY + 30} />
                <circle className="callout-anchor" cx={previewCentroid[0]} cy={previewCentroid[1]} r="6" />
                <foreignObject x={calloutX} y={calloutY} width="235" height="125">
                  <div className="map-callout">
                    <span>{previewCountry.currency} · {previewCountry.keyIndex}</span>
                    <strong>{previewCountry.name}</strong>
                    <p>{previewCountry.note}</p>
                  </div>
                </foreignObject>
              </g>
            ) : null}
          </svg>
          <div className="map-zoom-controls">
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((current) => Math.min(current + 0.16, 2.1))}><Plus size={16} /></button>
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((current) => Math.max(current - 0.16, 1))}><Minus size={16} /></button>
            <button type="button" aria-label="Reset map" onClick={resetMap}><Crosshair size={16} /></button>
          </div>
          <div className="map-instruction"><MapIcon size={14} /> Hover to preview · click to pin</div>
        </div>
      </section>

      {selectedCountry ? (
        <section className="country-dashboard">
          <header>
            <div><span className="eyebrow">{selectedCountry.currency} market profile</span><h2>{selectedCountry.name}</h2></div>
            <div className="country-index"><span>Key index</span><strong>{selectedCountry.keyIndex}</strong></div>
          </header>
          <div className="country-metrics">
            <Metric title="Policy framework" data={selectedCountry.policyRate} cadence="Daily / event-driven" />
            <Metric title="Government debt / GDP" data={selectedCountry.debtToGdp} cadence="Annual observation" />
            <Metric title="Equity market cap / GDP" data={selectedCountry.marketCapToGdp} cadence="Annual observation" />
            <article>
              <span>Portfolio exposure</span>
              <strong>{formatPercent(activeExposure)}</strong>
              <em>{activeExposure ? "Based on direct country tags" : "No directly tagged holdings"}</em>
            </article>
          </div>
          <div className="country-sectors"><span>Dominant public-market sectors</span><strong>{selectedCountry.sectors}</strong></div>
        </section>
      ) : null}
    </div>
  );
}

function Metric({
  title,
  data,
  cadence,
}: {
  title: string;
  data: MarketCountry["policyRate"];
  cadence: string;
}) {
  return (
    <article>
      <span>{title}</span>
      <strong>{data.value}</strong>
      <em>{cadence} · {data.asOf}</em>
      <a href={data.sourceUrl} target="_blank" rel="noreferrer">{data.source}</a>
    </article>
  );
}
