"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import {
  ArrowLeftRight,
  Building2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Factory,
  Landmark,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldAtlas from "world-atlas/countries-110m.json";
import { formatPercent, holdingValueNok, totalValueNok } from "@/lib/calculations";
import {
  industryLabels,
  marketsForIndustry,
  scoreIndustryMarket,
  type HeadToHeadIndustry,
} from "@/lib/head-to-head";
import {
  clampMapCenter,
  mapViewSize,
  panMapCenter,
  zoomMapAt,
  type MapPoint,
} from "@/lib/map-viewport";
import type { Holding } from "@/lib/types";
import { OceanParticleField } from "@/components/ocean-particle-field";

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

type MarketResearch = {
  companies: string[];
  materials: string;
  policyWatch: string;
  takeaways: string[];
};

type MapLens = "rates" | "energy" | "economic-sites" | "trillion" | "blue-banana";
type ScreenKey = "maxPe" | "maxPeg" | "maxPriceToBook" | "minSharpe" | "maxDebt" | "minSolvency" | "minFcfYield" | "minGrowth" | "minRoe";
type ScreenFilter = { enabled: boolean; value: number };
type MarketScreen = Record<ScreenKey, ScreenFilter>;
type FilterPanel = "universe" | "fundamentals" | "risk";
type MarketRegion = "all" | "Europe" | "Americas" | "Asia-Pacific" | "Africa & Middle East";
type MarketStage = "all" | "Developed" | "Emerging" | "Restricted";
type IndustryLens = "all" | "technology" | "semiconductors" | "financials" | "health-care" | "energy" | "oil-gas" | "materials" | "steel-construction" | "industrials" | "defense" | "consumer" | "utilities" | "real-estate";
type MarketAnalytics = {
  pe: number;
  sharpe: number;
  debtToGdp: number;
  solvency: number;
  fcfYield: number;
  earningsGrowth: number;
  roe: number;
};

const officialSources = {
  worldBank: "https://data.worldbank.org/indicator/CM.MKT.LCAP.GD.ZS",
  worldBankEconomy: "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD",
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
  {
    id: "netherlands", name: "Netherlands", atlasName: "Netherlands", currency: "EUR", keyIndex: "AEX",
    sectors: "Semiconductors, financials, consumer staples",
    policyRate: { value: "ECB policy", asOf: "Euro-area framework", source: "ECB", sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
    debtToGdp: { value: "Moderate public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Large cross-border listings", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "A globally exposed market led by semiconductors, payments, consumer brands, and financials.",
  },
  {
    id: "switzerland", name: "Switzerland", atlasName: "Switzerland", currency: "CHF", keyIndex: "SMI",
    sectors: "Health care, staples, financials",
    policyRate: { value: "Independent SNB policy", asOf: "Event-driven", source: "Swiss National Bank", sourceUrl: "https://www.snb.ch/en/the-snb/mandates-goals/monetary-policy/strategy" },
    debtToGdp: { value: "Low public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Very large defensive market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Defensive global franchises and the safe-haven franc often matter more than domestic growth.",
  },
  {
    id: "italy", name: "Italy", atlasName: "Italy", currency: "EUR", keyIndex: "FTSE MIB",
    sectors: "Financials, utilities, industrials, luxury",
    policyRate: { value: "ECB policy", asOf: "Euro-area framework", source: "ECB", sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
    debtToGdp: { value: "Very high public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Bank-heavy public market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Sovereign spreads, banks, energy costs, and European fiscal policy are central sensitivities.",
  },
  {
    id: "belgium", name: "Belgium", atlasName: "Belgium", currency: "EUR", keyIndex: "BEL 20",
    sectors: "Financials, materials, health care, beverages",
    policyRate: { value: "ECB policy", asOf: "Euro-area framework", source: "ECB", sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
    debtToGdp: { value: "High public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Concentrated cross-border market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "A compact market with globally significant brewers, materials groups, and life-science companies.",
  },
  {
    id: "austria", name: "Austria", atlasName: "Austria", currency: "EUR", keyIndex: "ATX",
    sectors: "Financials, energy, industrials, materials",
    policyRate: { value: "ECB policy", asOf: "Euro-area framework", source: "ECB", sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
    debtToGdp: { value: "Moderate public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Small cyclical market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Banks, Central and Eastern Europe, industrial demand, and energy links define the market profile.",
  },
  {
    id: "ireland", name: "Ireland", atlasName: "Ireland", currency: "EUR", keyIndex: "ISEQ Overall",
    sectors: "Construction materials, financials, food, health care",
    policyRate: { value: "ECB policy", asOf: "Euro-area framework", source: "ECB", sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
    debtToGdp: { value: "GDP ratio distorted by multinationals", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Listings understate corporate footprint", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Headline GDP is unusually distorted; tax policy and multinational investment deserve separate attention.",
  },
  {
    id: "portugal", name: "Portugal", atlasName: "Portugal", currency: "EUR", keyIndex: "PSI",
    sectors: "Utilities, energy, retail, pulp and paper",
    policyRate: { value: "ECB policy", asOf: "Euro-area framework", source: "ECB", sourceUrl: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/key_ecb_interest_rates/html/index.en.html" },
    debtToGdp: { value: "High but improving public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Small concentrated market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Tourism, rates, utilities, and external European demand shape a relatively small exchange.",
  },
  {
    id: "poland", name: "Poland", atlasName: "Poland", currency: "PLN", keyIndex: "WIG20",
    sectors: "Financials, energy, consumer, technology",
    policyRate: { value: "Independent NBP policy", asOf: "Event-driven", source: "National Bank of Poland", sourceUrl: "https://nbp.pl/en/monetary-policy/mpc-decisions/interest-rates/" },
    debtToGdp: { value: "Moderate public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Largest exchange in Central Europe", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Domestic consumption, banks, defence spending, EU funds, and regional security are key drivers.",
  },
  {
    id: "south-africa", name: "South Africa", atlasName: "South Africa", currency: "ZAR", keyIndex: "FTSE/JSE All Share",
    sectors: "Financials, materials, consumer internet",
    policyRate: { value: "Independent SARB policy", asOf: "Event-driven", source: "South African Reserve Bank", sourceUrl: "https://www.resbank.co.za/en/home/what-we-do/monetary-policy" },
    debtToGdp: { value: "High and rising", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Africa's deepest equity market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "A globally connected mining and financial market, with power, logistics, and fiscal capacity as domestic constraints.",
  },
  {
    id: "egypt", name: "Egypt", atlasName: "Egypt", currency: "EGP", keyIndex: "EGX 30",
    sectors: "Financials, telecom, construction, materials",
    policyRate: { value: "Independent CBE policy", asOf: "Event-driven", source: "Central Bank of Egypt", sourceUrl: "https://www.cbe.org.eg/en/monetary-policy/monetary-policy-decisions" },
    debtToGdp: { value: "High debt and financing needs", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Developing frontier market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Currency policy, inflation, external funding, the Suez Canal, and state participation are core considerations.",
  },
  {
    id: "china", name: "China", atlasName: "China", currency: "CNY", keyIndex: "CSI 300",
    sectors: "Financials, industrials, technology, consumer",
    policyRate: { value: "PBoC policy framework", asOf: "Event-driven", source: "People's Bank of China", sourceUrl: "http://www.pbc.gov.cn/en/3688006/index.html" },
    debtToGdp: { value: "Public and local-government leverage", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Very large segmented market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Property, policy direction, domestic demand, technology controls, and state influence dominate the risk map.",
  },
  {
    id: "india", name: "India", atlasName: "India", currency: "INR", keyIndex: "Nifty 50",
    sectors: "Financials, technology services, energy, consumer",
    policyRate: { value: "Independent RBI policy", asOf: "Event-driven", source: "Reserve Bank of India", sourceUrl: "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx" },
    debtToGdp: { value: "High general-government debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Large, premium-valued market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Domestic growth, valuations, oil imports, financial deepening, and policy execution drive the market.",
  },
  {
    id: "south-korea", name: "South Korea", atlasName: "South Korea", currency: "KRW", keyIndex: "KOSPI",
    sectors: "Semiconductors, autos, batteries, industrials",
    policyRate: { value: "Independent BOK policy", asOf: "Event-driven", source: "Bank of Korea", sourceUrl: "https://www.bok.or.kr/eng/main/main.do" },
    debtToGdp: { value: "Low public, high household leverage", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Large export-led market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "The semiconductor cycle, China demand, governance reform, and regional security are key variables.",
  },
  {
    id: "singapore", name: "Singapore", atlasName: "Singapore", currency: "SGD", keyIndex: "Straits Times Index",
    sectors: "Financials, industrials, property, transport",
    policyRate: { value: "Exchange-rate policy", asOf: "Event-driven", source: "Monetary Authority of Singapore", sourceUrl: "https://www.mas.gov.sg/monetary-policy" },
    debtToGdp: { value: "High gross, asset-backed public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Deep regional financial centre", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "A regional capital, shipping, and wealth-management hub whose listed market is more mature and income-oriented than much of Asia.",
  },
  {
    id: "taiwan", name: "Taiwan", atlasName: "Taiwan", currency: "TWD", keyIndex: "TAIEX",
    sectors: "Semiconductors, electronics, hardware, financials",
    policyRate: { value: "Independent CBC policy", asOf: "Event-driven", source: "Central Bank of the Republic of China", sourceUrl: "https://www.cbc.gov.tw/en/mp-2.html" },
    debtToGdp: { value: "Moderate public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Very large technology-heavy market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Semiconductor concentration, the global electronics cycle, currency policy, and cross-strait risk dominate the investment profile.",
  },
  {
    id: "indonesia", name: "Indonesia", atlasName: "Indonesia", currency: "IDR", keyIndex: "Jakarta Composite",
    sectors: "Financials, consumer, materials, telecom, energy",
    policyRate: { value: "Independent BI policy", asOf: "Event-driven", source: "Bank Indonesia", sourceUrl: "https://www.bi.go.id/en/fungsi-utama/moneter/default.aspx" },
    debtToGdp: { value: "Moderate public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Large developing market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Domestic consumption, bank credit, nickel processing, commodity exports, and rupiah stability shape this large emerging market.",
  },
  {
    id: "brazil", name: "Brazil", atlasName: "Brazil", currency: "BRL", keyIndex: "Ibovespa",
    sectors: "Financials, energy, mining, agriculture",
    policyRate: { value: "Independent BCB policy", asOf: "Event-driven", source: "Banco Central do Brasil", sourceUrl: "https://www.bcb.gov.br/en/monetarypolicy" },
    debtToGdp: { value: "High emerging-market public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Commodity and bank heavy", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Rates, fiscal credibility, iron ore, oil, agriculture, and China demand are major return drivers.",
  },
  {
    id: "mexico", name: "Mexico", atlasName: "Mexico", currency: "MXN", keyIndex: "S&P/BMV IPC",
    sectors: "Consumer, financials, industrials, materials",
    policyRate: { value: "Independent Banxico policy", asOf: "Event-driven", source: "Banco de Mexico", sourceUrl: "https://www.banxico.org.mx/monetary-policy/" },
    debtToGdp: { value: "Moderate public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Concentrated nearshoring market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "US trade, nearshoring, remittances, domestic policy, and the peso define the investment profile.",
  },
  {
    id: "russia", name: "Russia", atlasName: "Russia", currency: "RUB", keyIndex: "MOEX Russia Index",
    sectors: "Energy, materials, financials, defence",
    policyRate: { value: "Restricted-market context", asOf: "Verify current access", source: "Bank of Russia", sourceUrl: "https://www.cbr.ru/eng/hd_base/KeyRate/" },
    debtToGdp: { value: "Low headline public debt", asOf: "Annual series", source: "IMF", sourceUrl: officialSources.imfDebt },
    marketCapToGdp: { value: "Access-limited market", asOf: "Latest available", source: "World Bank", sourceUrl: officialSources.worldBank },
    note: "Sanctions, capital controls, custody, settlement, and investor-access restrictions dominate conventional valuation analysis.",
  },
];

const marketResearch: Record<string, MarketResearch> = {
  norway: {
    companies: ["Equinor", "DNB", "Kongsberg Gruppen", "Telenor"],
    materials: "Oil, natural gas, aluminium, seafood",
    policyWatch: "Petroleum taxation, sovereign-wealth allocation, power policy, and European security spending.",
    takeaways: ["Energy and NOK can amplify the same macro shock.", "The index is concentrated despite Norway's broad sovereign balance sheet."],
  },
  sweden: {
    companies: ["Investor AB", "Atlas Copco", "Volvo", "Ericsson"],
    materials: "Iron ore, forestry products, industrial metals",
    policyWatch: "Household leverage, commercial property, defence investment, and the krona's monetary-policy response.",
    takeaways: ["A high-quality industrial market with substantial foreign revenue.", "Property and bank funding are important domestic transmission channels."],
  },
  denmark: {
    companies: ["Novo Nordisk", "DSV", "Danske Bank", "Vestas"],
    materials: "Wind resources, agriculture, North Sea energy",
    policyWatch: "The euro peg, pharmaceutical policy, green investment, and shipping exposure.",
    takeaways: ["Single-company concentration can dominate index returns.", "Global health-care demand matters more than domestic GDP."],
  },
  finland: {
    companies: ["Nokia", "Sampo", "Kone", "UPM-Kymmene"],
    materials: "Forestry, nickel, cobalt, industrial minerals",
    policyWatch: "Regional security, public finances, energy links, and European industrial policy.",
    takeaways: ["Cyclical exporters make global demand central.", "Forestry and industrial technology provide a distinctive Nordic mix."],
  },
  "united-kingdom": {
    companies: ["AstraZeneca", "Shell", "HSBC", "Unilever"],
    materials: "North Sea energy, precious-metals listings",
    policyWatch: "Fiscal credibility, regulation, trade alignment, and the path of sterling rates.",
    takeaways: ["The FTSE 100 is far more global than the UK economy.", "Sterling weakness can support translated overseas earnings."],
  },
  germany: {
    companies: ["SAP", "Siemens", "Allianz", "Mercedes-Benz"],
    materials: "Potash, chemicals, imported energy inputs",
    policyWatch: "Fiscal rules, energy security, EU industrial policy, China trade, and coalition stability.",
    takeaways: ["Manufacturing and exports create high global-cycle sensitivity.", "Software and insurers partly offset auto and chemical cyclicality."],
  },
  france: {
    companies: ["LVMH", "TotalEnergies", "Airbus", "Schneider Electric"],
    materials: "Nuclear power, agriculture, global energy exposure",
    policyWatch: "Fiscal consolidation, parliamentary stability, labour reform, and euro-area sovereign spreads.",
    takeaways: ["Luxury and aerospace make China and US demand important.", "Large caps are globally diversified despite domestic fiscal risk."],
  },
  spain: {
    companies: ["Inditex", "Iberdrola", "Santander", "Amadeus"],
    materials: "Solar and wind resources, copper and potash",
    policyWatch: "Regional politics, housing, tourism policy, and European energy integration.",
    takeaways: ["Banks and utilities strongly influence index behaviour.", "Tourism and infrastructure connect domestic growth to global travel."],
  },
  "united-states": {
    companies: ["Microsoft", "Apple", "Nvidia", "Alphabet"],
    materials: "Oil, natural gas, copper, agriculture",
    policyWatch: "Fiscal deficits, trade policy, technology regulation, elections, and Federal Reserve independence.",
    takeaways: ["Mega-cap technology concentration is a portfolio factor in its own right.", "Deep capital markets do not remove valuation or duration risk."],
  },
  canada: {
    companies: ["Royal Bank of Canada", "Shopify", "Enbridge", "Canadian Pacific Kansas City"],
    materials: "Oil sands, natural gas, uranium, potash, timber",
    policyWatch: "Housing affordability, immigration, pipelines, provincial policy, and US trade.",
    takeaways: ["Banks, housing, and commodities form a linked risk cluster.", "The Canadian dollar often carries a commodity signal."],
  },
  japan: {
    companies: ["Toyota", "Sony", "Mitsubishi UFJ", "Hitachi"],
    materials: "Resource importer; strategic exposure to LNG and metals",
    policyWatch: "Bank of Japan normalization, corporate governance, demographics, and regional security.",
    takeaways: ["Yen moves can overwhelm local equity returns for NOK investors.", "Governance reform is changing capital allocation."],
  },
  australia: {
    companies: ["BHP", "Commonwealth Bank", "CSL", "Macquarie Group"],
    materials: "Iron ore, coal, LNG, gold, lithium",
    policyWatch: "China relations, housing supply, mining royalties, and pension capital.",
    takeaways: ["Banks and miners dominate index factor exposure.", "China's commodity cycle is a major external driver."],
  },
  netherlands: {
    companies: ["ASML", "ING", "Prosus", "Heineken"],
    materials: "Natural gas legacy, agricultural exports, chemicals",
    policyWatch: "Semiconductor export controls, housing, nitrogen rules, and EU fiscal policy.",
    takeaways: ["ASML creates unusually large semiconductor concentration.", "Many Dutch listings earn predominantly outside the Netherlands."],
  },
  switzerland: {
    companies: ["Nestle", "Roche", "Novartis", "UBS"],
    materials: "Gold trading and refining; limited domestic extraction",
    policyWatch: "Franc strength, banking regulation, EU relations, and pharmaceutical pricing.",
    takeaways: ["Health care and staples give the index defensive characteristics.", "CHF exposure can be as important as the equities themselves."],
  },
  italy: {
    companies: ["UniCredit", "Enel", "Eni", "Ferrari"],
    materials: "Natural gas infrastructure, marble, industrial minerals",
    policyWatch: "Sovereign spreads, EU fiscal rules, bank regulation, and government durability.",
    takeaways: ["Banks link equity returns directly to sovereign risk.", "Luxury and industrial niches provide global earnings exposure."],
  },
  belgium: {
    companies: ["AB InBev", "UCB", "KBC", "Umicore"],
    materials: "Advanced materials, chemicals, recycled metals",
    policyWatch: "Coalition formation, fiscal federalism, energy policy, and EU regulation.",
    takeaways: ["The index is small but its leaders are global.", "Company-specific risk can dominate country macro risk."],
  },
  austria: {
    companies: ["Erste Group", "OMV", "Verbund", "voestalpine"],
    materials: "Hydropower, steel, forestry, oil and gas exposure",
    policyWatch: "Central European bank exposure, Russian legacy links, energy, and coalition policy.",
    takeaways: ["The market is cyclical and financially concentrated.", "Eastern European growth and credit quality matter disproportionately."],
  },
  ireland: {
    companies: ["CRH", "AIB Group", "Kerry Group", "Kingspan"],
    materials: "Agriculture, zinc, construction materials",
    policyWatch: "Corporate tax coordination, housing, infrastructure, and multinational investment.",
    takeaways: ["Irish GDP is a poor standalone guide to investable activity.", "The listed market is much narrower than Ireland's multinational economy."],
  },
  portugal: {
    companies: ["EDP", "Galp", "Jerónimo Martins", "The Navigator Company"],
    materials: "Lithium, cork, pulp, renewable power",
    policyWatch: "Fiscal discipline, housing, licensing reform, and European energy links.",
    takeaways: ["Utilities and energy carry substantial index weight.", "Small-market liquidity and concentration require attention."],
  },
  poland: {
    companies: ["PKO Bank Polski", "Orlen", "PZU", "CD Projekt"],
    materials: "Coal, copper, silver, agricultural land",
    policyWatch: "EU funding, defence spending, energy transition, judiciary policy, and Ukraine spillovers.",
    takeaways: ["Domestic growth makes Poland less export-dependent than some peers.", "State ownership can shape capital allocation and governance."],
  },
  "south-africa": {
    companies: ["Naspers", "FirstRand", "Gold Fields", "Anglo American Platinum"],
    materials: "Gold, platinum-group metals, iron ore, coal, manganese",
    policyWatch: "Coalition governance, electricity supply, rail and port reform, fiscal capacity, and land policy.",
    takeaways: ["The JSE is Africa's deepest public market.", "Mining, the rand, and Chinese demand can reinforce one another."],
  },
  egypt: {
    companies: ["Commercial International Bank", "Eastern Company", "Telecom Egypt", "Elsewedy Electric"],
    materials: "Natural gas, phosphates, gold; Suez trade exposure",
    policyWatch: "Currency regime, IMF-linked reforms, state ownership, subsidy policy, and regional security.",
    takeaways: ["FX convertibility and inflation are first-order risks.", "The market offers scale but remains frontier-like in liquidity and governance."],
  },
  china: {
    companies: ["Tencent", "Alibaba", "Kweichow Moutai", "CATL"],
    materials: "Rare earths, coal, aluminium; major commodity importer",
    policyWatch: "Property support, industrial policy, technology controls, Taiwan risk, and state intervention.",
    takeaways: ["Onshore, Hong Kong, and ADR markets carry different access risks.", "Policy changes can reprice sectors faster than company fundamentals."],
  },
  india: {
    companies: ["Reliance Industries", "HDFC Bank", "TCS", "Bharti Airtel"],
    materials: "Iron ore, coal, bauxite; major oil importer",
    policyWatch: "Fiscal investment, market regulation, trade policy, state elections, and reform execution.",
    takeaways: ["Strong structural growth is often reflected in premium valuations.", "Oil prices and the rupee are important external sensitivities."],
  },
  "south-korea": {
    companies: ["Samsung Electronics", "SK Hynix", "Hyundai Motor", "LG Energy Solution"],
    materials: "Resource importer; strategic battery-material processing",
    policyWatch: "Corporate governance reform, semiconductor policy, North Korea, and China-US trade friction.",
    takeaways: ["Semiconductors create powerful earnings cyclicality.", "The won and global electronics cycle can amplify each other."],
  },
  singapore: {
    companies: ["DBS Group", "Sea Limited", "Singapore Airlines", "Keppel"],
    materials: "Major refining, LNG, shipping, and commodity-trading hub",
    policyWatch: "Exchange-rate policy, housing controls, China exposure, global trade, and financial regulation.",
    takeaways: ["The market is a gateway to Southeast Asian capital flows.", "Banks, property, and transport make rates and trade more important than headline technology exposure."],
  },
  taiwan: {
    companies: ["TSMC", "Hon Hai Precision", "MediaTek", "Fubon Financial"],
    materials: "Resource importer with world-leading semiconductor fabrication",
    policyWatch: "Cross-strait security, US technology controls, currency management, energy security, and industrial policy.",
    takeaways: ["TSMC creates exceptional index concentration.", "The semiconductor cycle and geopolitical risk must be evaluated together."],
  },
  indonesia: {
    companies: ["Bank Central Asia", "Bank Rakyat Indonesia", "Telkom Indonesia", "Astra International"],
    materials: "Nickel, coal, palm oil, natural gas, copper, and tin",
    policyWatch: "Rupiah stability, nickel policy, fuel subsidies, infrastructure, and institutional reform.",
    takeaways: ["Domestic demand provides a different engine from export-led North Asia.", "Commodity processing policy can reshape both capital needs and trade relationships."],
  },
  brazil: {
    companies: ["Petrobras", "Vale", "Itaú Unibanco", "WEG"],
    materials: "Iron ore, oil, soybeans, sugar, coffee, pulp",
    policyWatch: "Fiscal rules, state-company governance, tax reform, environmental policy, and central-bank credibility.",
    takeaways: ["Real rates and the currency are central valuation inputs.", "China demand links mining, FX, and fiscal receipts."],
  },
  mexico: {
    companies: ["America Movil", "Walmart de Mexico", "Grupo Mexico", "FEMSA"],
    materials: "Silver, copper, oil, agricultural exports",
    policyWatch: "USMCA review, energy policy, judicial changes, security, and nearshoring infrastructure.",
    takeaways: ["US industrial demand is the dominant external factor.", "Nearshoring potential depends on power, water, logistics, and legal certainty."],
  },
  russia: {
    companies: ["Gazprom", "Rosneft", "Sberbank", "Norilsk Nickel"],
    materials: "Oil, natural gas, nickel, palladium, aluminium, wheat",
    policyWatch: "Sanctions, capital controls, foreign-investor restrictions, war financing, commodity exports, and settlement infrastructure.",
    takeaways: ["Market access and legal ownership can matter more than quoted valuation.", "Commodity exposure does not remove currency, governance, or geopolitical risk."],
  },
};

const countryCollection = feature<{ name: string }>(
  worldAtlas as never,
  "countries",
) as unknown as FeatureCollection<Geometry, { name: string }>;
const projection = geoNaturalEarth1().fitExtent([[12, -18], [888, 478]], { type: "Sphere" });
const mapPath = geoPath(projection);
const blueBananaCoordinates: Array<[number, number]> = [
  [-2.5, 53], [0.2, 51.5], [4.4, 51], [6.8, 50.4], [8.5, 48.2], [8.2, 46.2], [9.2, 45.2],
];
const blueBananaPath = blueBananaCoordinates
  .map((coordinates, index) => {
    const point = projection(coordinates);
    return point ? `${index === 0 ? "M" : "L"}${point[0].toFixed(1)},${point[1].toFixed(1)}` : "";
  })
  .join(" ");
const worldCountries = countryCollection.features
  .map((country) => ({
    feature: country as CountryFeature,
    name: country.properties.name,
    path: mapPath(country) ?? "",
    centroid: mapPath.centroid(country),
  }))
  .filter((country) => country.path && country.name !== "Antarctica");
const pointMarketCoordinates: Record<string, [number, number]> = {
  singapore: [103.82, 1.35],
};
const marketByAtlasName = new Map(marketCountries.map((country) => [country.atlasName, country]));
const DEFAULT_ZOOM = 1.12;
const DEFAULT_CENTER: MapPoint = [465, 205];
const marketRegions: Record<Exclude<MarketRegion, "all">, Set<string>> = {
  Europe: new Set(["norway", "sweden", "denmark", "finland", "united-kingdom", "germany", "france", "spain", "netherlands", "switzerland", "italy", "belgium", "austria", "ireland", "portugal", "poland", "russia"]),
  Americas: new Set(["united-states", "canada", "brazil", "mexico"]),
  "Asia-Pacific": new Set(["japan", "australia", "china", "india", "south-korea", "singapore", "taiwan", "indonesia"]),
  "Africa & Middle East": new Set(["south-africa", "egypt"]),
};
const emergingMarkets = new Set(["poland", "south-africa", "egypt", "china", "india", "taiwan", "indonesia", "brazil", "mexico"]);
const restrictedMarkets = new Set(["russia"]);
const industryLensOptions: Array<{ id: IndustryLens; label: string; group: string }> = [
  { id: "all", label: "Whole market index", group: "Market" },
  { id: "technology", label: "Information technology", group: "Sector" },
  { id: "semiconductors", label: "Semiconductors", group: "Industry" },
  { id: "financials", label: "Financials", group: "Sector" },
  { id: "health-care", label: "Health care", group: "Sector" },
  { id: "energy", label: "Energy", group: "Sector" },
  { id: "oil-gas", label: "Oil & gas", group: "Industry" },
  { id: "materials", label: "Materials", group: "Sector" },
  { id: "steel-construction", label: "Steel & construction materials", group: "Industry" },
  { id: "industrials", label: "Industrials", group: "Sector" },
  { id: "defense", label: "Aerospace & defense", group: "Industry" },
  { id: "consumer", label: "Consumer", group: "Sector" },
  { id: "utilities", label: "Utilities", group: "Sector" },
  { id: "real-estate", label: "Real estate", group: "Sector" },
];
const industryProfiles: Record<Exclude<IndustryLens, "all">, { pe: number; growth: number; fcf: number; roe: number; sharpe: number }> = {
  technology: { pe: 1.35, growth: 1.55, fcf: 0.72, roe: 1.3, sharpe: 0.95 },
  semiconductors: { pe: 1.48, growth: 1.75, fcf: 0.62, roe: 1.4, sharpe: 0.9 },
  financials: { pe: 0.68, growth: 0.8, fcf: 1.18, roe: 0.82, sharpe: 0.9 },
  "health-care": { pe: 1.08, growth: 1.15, fcf: 0.88, roe: 1.12, sharpe: 1.08 },
  energy: { pe: 0.72, growth: 0.82, fcf: 1.38, roe: 1.02, sharpe: 0.85 },
  "oil-gas": { pe: 0.64, growth: 0.75, fcf: 1.5, roe: 0.96, sharpe: 0.8 },
  materials: { pe: 0.78, growth: 0.78, fcf: 1.25, roe: 0.9, sharpe: 0.82 },
  "steel-construction": { pe: 0.58, growth: 0.72, fcf: 1.38, roe: 0.86, sharpe: 0.74 },
  industrials: { pe: 0.9, growth: 0.92, fcf: 1.05, roe: 0.98, sharpe: 0.96 },
  defense: { pe: 1.02, growth: 1.18, fcf: 0.92, roe: 1.08, sharpe: 1.08 },
  consumer: { pe: 0.96, growth: 0.95, fcf: 1.02, roe: 1.05, sharpe: 0.98 },
  utilities: { pe: 0.76, growth: 0.58, fcf: 1.12, roe: 0.72, sharpe: 0.92 },
  "real-estate": { pe: 0.82, growth: 0.68, fcf: 1.2, roe: 0.76, sharpe: 0.78 },
};
const energyMarkets = new Set(["norway", "united-kingdom", "united-states", "canada", "australia", "brazil", "mexico", "china", "egypt", "russia"]);
const trillionEconomies = new Set(["united-states", "china", "germany", "japan", "india", "united-kingdom", "france", "italy", "brazil", "canada", "russia", "south-korea", "australia", "spain", "mexico", "netherlands", "indonesia"]);
const rateAnchors = [
  { id: "united-states", label: "FED" }, { id: "germany", label: "ECB" }, { id: "united-kingdom", label: "BOE" },
  { id: "norway", label: "NB" }, { id: "japan", label: "BOJ" }, { id: "china", label: "PBOC" },
];

const defaultMarketScreen: MarketScreen = {
  maxPe: { enabled: false, value: 20 },
  maxPeg: { enabled: false, value: 2 },
  maxPriceToBook: { enabled: false, value: 4 },
  minSharpe: { enabled: false, value: 0.5 },
  maxDebt: { enabled: false, value: 100 },
  minSolvency: { enabled: false, value: 70 },
  minFcfYield: { enabled: false, value: 5 },
  minGrowth: { enabled: false, value: 8 },
  minRoe: { enabled: false, value: 15 },
};

const marketAnalytics: Record<string, MarketAnalytics> = {
  norway: { pe: 13, sharpe: 0.7, debtToGdp: 42, solvency: 84, fcfYield: 7.2, earningsGrowth: 6, roe: 16 },
  sweden: { pe: 19, sharpe: 0.75, debtToGdp: 33, solvency: 84, fcfYield: 4.5, earningsGrowth: 8, roe: 18 },
  denmark: { pe: 24, sharpe: 0.65, debtToGdp: 30, solvency: 90, fcfYield: 4.2, earningsGrowth: 10, roe: 25 },
  finland: { pe: 17, sharpe: 0.25, debtToGdp: 82, solvency: 78, fcfYield: 5.5, earningsGrowth: 4, roe: 14 },
  "united-kingdom": { pe: 15, sharpe: 0.55, debtToGdp: 101, solvency: 78, fcfYield: 6, earningsGrowth: 5, roe: 15 },
  germany: { pe: 16, sharpe: 0.75, debtToGdp: 63, solvency: 86, fcfYield: 5, earningsGrowth: 6, roe: 14 },
  france: { pe: 18, sharpe: 0.5, debtToGdp: 112, solvency: 75, fcfYield: 4.8, earningsGrowth: 6, roe: 15 },
  spain: { pe: 14, sharpe: 0.8, debtToGdp: 102, solvency: 76, fcfYield: 6, earningsGrowth: 7, roe: 14 },
  "united-states": { pe: 24, sharpe: 1.59, debtToGdp: 123, solvency: 82, fcfYield: 4, earningsGrowth: 11, roe: 20 },
  canada: { pe: 18, sharpe: 0.6, debtToGdp: 107, solvency: 82, fcfYield: 5, earningsGrowth: 7, roe: 15 },
  japan: { pe: 20, sharpe: 1.1, debtToGdp: 250, solvency: 72, fcfYield: 4, earningsGrowth: 8, roe: 10 },
  australia: { pe: 18, sharpe: 0.7, debtToGdp: 50, solvency: 88, fcfYield: 6, earningsGrowth: 5, roe: 14 },
  netherlands: { pe: 22, sharpe: 0.8, debtToGdp: 44, solvency: 88, fcfYield: 4.5, earningsGrowth: 10, roe: 18 },
  switzerland: { pe: 19, sharpe: 0.55, debtToGdp: 38, solvency: 94, fcfYield: 4.5, earningsGrowth: 7, roe: 18 },
  italy: { pe: 12, sharpe: 0.9, debtToGdp: 137, solvency: 67, fcfYield: 7, earningsGrowth: 6, roe: 12 },
  belgium: { pe: 17, sharpe: 0.4, debtToGdp: 105, solvency: 73, fcfYield: 5, earningsGrowth: 5, roe: 14 },
  austria: { pe: 11, sharpe: 0.65, debtToGdp: 80, solvency: 80, fcfYield: 8, earningsGrowth: 5, roe: 13 },
  ireland: { pe: 19, sharpe: 0.8, debtToGdp: 44, solvency: 91, fcfYield: 5, earningsGrowth: 9, roe: 16 },
  portugal: { pe: 13, sharpe: 1, debtToGdp: 95, solvency: 76, fcfYield: 7, earningsGrowth: 6, roe: 14 },
  poland: { pe: 11, sharpe: 1.1, debtToGdp: 50, solvency: 78, fcfYield: 8, earningsGrowth: 10, roe: 16 },
  "south-africa": { pe: 12, sharpe: 0.25, debtToGdp: 77, solvency: 55, fcfYield: 7, earningsGrowth: 5, roe: 14 },
  egypt: { pe: 8, sharpe: -0.1, debtToGdp: 90, solvency: 42, fcfYield: 5, earningsGrowth: 12, roe: 20 },
  china: { pe: 13, sharpe: 0.35, debtToGdp: 88, solvency: 62, fcfYield: 7, earningsGrowth: 7, roe: 12 },
  india: { pe: 23, sharpe: 0.9, debtToGdp: 82, solvency: 68, fcfYield: 4, earningsGrowth: 14, roe: 17 },
  "south-korea": { pe: 14, sharpe: 0.8, debtToGdp: 48, solvency: 82, fcfYield: 6, earningsGrowth: 12, roe: 13 },
  singapore: { pe: 14, sharpe: 0.7, debtToGdp: 168, solvency: 92, fcfYield: 5.8, earningsGrowth: 6, roe: 13 },
  taiwan: { pe: 22, sharpe: 1.05, debtToGdp: 28, solvency: 79, fcfYield: 4.2, earningsGrowth: 13, roe: 20 },
  indonesia: { pe: 16, sharpe: 0.55, debtToGdp: 40, solvency: 67, fcfYield: 5.5, earningsGrowth: 10, roe: 15 },
  brazil: { pe: 9, sharpe: 0.65, debtToGdp: 86, solvency: 59, fcfYield: 10, earningsGrowth: 8, roe: 18 },
  mexico: { pe: 13, sharpe: 0.5, debtToGdp: 52, solvency: 67, fcfYield: 7, earningsGrowth: 6, roe: 16 },
  russia: { pe: 6, sharpe: -0.4, debtToGdp: 21, solvency: 25, fcfYield: 12, earningsGrowth: -5, roe: 12 },
};

type EconomicMarker = {
  countryId: string;
  name: string;
  detail: string;
  coordinates: [number, number];
  kind: "offshore" | "resource" | "industry" | "capital";
};

const economicMarkers: EconomicMarker[] = [
  { countryId: "norway", name: "Ekofisk", detail: "North Sea oil and gas complex", coordinates: [3.2, 56.55], kind: "offshore" },
  { countryId: "norway", name: "Johan Sverdrup", detail: "Major North Sea oil field", coordinates: [2.0, 58.9], kind: "offshore" },
  { countryId: "norway", name: "Hywind Tampen", detail: "Floating offshore wind", coordinates: [4.35, 61.3], kind: "offshore" },
  { countryId: "norway", name: "Froya aquaculture", detail: "Salmon and seafood cluster", coordinates: [8.75, 63.73], kind: "industry" },
  { countryId: "norway", name: "Oslo capital hub", detail: "Finance, shipping, and listed energy", coordinates: [10.75, 59.91], kind: "capital" },
  { countryId: "united-kingdom", name: "North Sea basin", detail: "Offshore energy production", coordinates: [1.2, 58.1], kind: "offshore" },
  { countryId: "united-kingdom", name: "London", detail: "Global finance and commodity trading", coordinates: [-0.13, 51.51], kind: "capital" },
  { countryId: "canada", name: "Athabasca", detail: "Oil sands and energy infrastructure", coordinates: [-111.4, 57.0], kind: "resource" },
  { countryId: "canada", name: "Toronto", detail: "Banking and public-market hub", coordinates: [-79.38, 43.65], kind: "capital" },
  { countryId: "united-states", name: "Permian Basin", detail: "Oil and gas production", coordinates: [-103.4, 31.8], kind: "resource" },
  { countryId: "united-states", name: "Silicon Valley", detail: "Technology and venture capital", coordinates: [-122.1, 37.4], kind: "industry" },
  { countryId: "brazil", name: "Pre-salt basin", detail: "Deepwater offshore oil", coordinates: [-42.2, -24.0], kind: "offshore" },
  { countryId: "brazil", name: "Carajas", detail: "Iron ore mining system", coordinates: [-50.2, -6.1], kind: "resource" },
];

function valuationMetrics(analytics: MarketAnalytics) {
  return {
    peg: analytics.earningsGrowth > 0 ? analytics.pe / analytics.earningsGrowth : null,
    priceToBook: Math.max(0.7, analytics.roe / 7.2),
  };
}

function regionForMarket(marketId: string): Exclude<MarketRegion, "all"> {
  return (Object.entries(marketRegions) as Array<[Exclude<MarketRegion, "all">, Set<string>]>).find(([, ids]) => ids.has(marketId))?.[0]
    ?? "Europe";
}

function stageForMarket(marketId: string): Exclude<MarketStage, "all"> {
  if (restrictedMarkets.has(marketId)) return "Restricted";
  if (emergingMarkets.has(marketId)) return "Emerging";
  return "Developed";
}

function analyticsForIndustry(analytics: MarketAnalytics, industry: IndustryLens): MarketAnalytics {
  if (industry === "all") return analytics;
  const profile = industryProfiles[industry];
  return {
    ...analytics,
    pe: analytics.pe * profile.pe,
    earningsGrowth: analytics.earningsGrowth * profile.growth,
    fcfYield: analytics.fcfYield * profile.fcf,
    roe: analytics.roe * profile.roe,
    sharpe: analytics.sharpe * profile.sharpe,
  };
}

function marketCentroid(market: MarketCountry | null | undefined): MapPoint | null {
  if (!market) return null;
  const shape = worldCountries.find((country) => country.name === market.atlasName);
  if (shape) return shape.centroid as MapPoint;
  const coordinates = pointMarketCoordinates[market.id];
  return coordinates ? projection(coordinates) as MapPoint : null;
}

export function GlobalMapView({
  holdings,
  fxRates,
  requestedCountry,
}: {
  holdings: Holding[];
  fxRates: Record<string, number>;
  requestedCountry: string | null;
}) {
  const requestedMarket = marketCountries.find((item) =>
    item.name.toLowerCase() === requestedCountry?.toLowerCase(),
  );
  const requestedCentroid = marketCentroid(requestedMarket);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(requestedMarket?.id ?? null);
  const [zoom, setZoom] = useState(requestedMarket ? 2.2 : DEFAULT_ZOOM);
  const [center, setCenter] = useState<MapPoint>(
    requestedCentroid ?? DEFAULT_CENTER,
  );
  const [query, setQuery] = useState(requestedMarket?.name ?? "");
  const [dragging, setDragging] = useState(false);
  const [expandedHoverId, setExpandedHoverId] = useState<string | null>(null);
  const [lensPanelOpen, setLensPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeLenses, setActiveLenses] = useState<Set<MapLens>>(() => new Set());
  const [screenFilters, setScreenFilters] = useState<MarketScreen>(defaultMarketScreen);
  const [comparisonId, setComparisonId] = useState("united-states");
  const [comparisonMode, setComparisonMode] = useState<"country" | "industry">("country");
  const [comparisonIndustry, setComparisonIndustry] = useState<HeadToHeadIndustry>("oil-gas");
  const [industryPrimaryId, setIndustryPrimaryId] = useState("united-states");
  const [industryComparisonId, setIndustryComparisonId] = useState("india");
  const [filterPanel, setFilterPanel] = useState<FilterPanel>("universe");
  const [marketRegion, setMarketRegion] = useState<MarketRegion>("all");
  const [marketStage, setMarketStage] = useState<MarketStage>("all");
  const [industryLens, setIndustryLens] = useState<IndustryLens>("all");
  const [globeTilt, setGlobeTilt] = useState<MapPoint>([0, 0]);
  const dragRef = useRef<{
    pointerId: number;
    start: MapPoint;
    center: MapPoint;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const hoverOpenRef = useRef<number | null>(null);
  const hoverClearRef = useRef<number | null>(null);
  const mapWorkspaceRef = useRef<HTMLElement | null>(null);
  const mapSurfaceRef = useRef<SVGSVGElement | null>(null);
  const activeId = hoveredId ?? pinnedId;
  const previewCountry = marketCountries.find((country) => country.id === hoveredId) ?? null;
  const selectedCountry = marketCountries.find((country) => country.id === pinnedId) ?? previewCountry;
  const activeCountry = marketCountries.find((country) => country.id === activeId) ?? null;
  const activeShape = activeCountry
    ? worldCountries.find((country) => country.name === activeCountry.atlasName)
    : null;
  const activeCentroid = marketCentroid(activeCountry);
  const portfolioTotal = totalValueNok(holdings, fxRates);

  const [viewWidth, viewHeight] = mapViewSize(zoom);
  const viewX = Math.max(0, Math.min(900 - viewWidth, center[0] - viewWidth / 2));
  const viewY = Math.max(0, Math.min(460 - viewHeight, center[1] - viewHeight / 2));
  const previewCentroid = marketCentroid(previewCountry) ?? [450, 230];
  const previewLeft = Math.max(4, Math.min(96, (previewCentroid[0] - viewX) / viewWidth * 100));
  const previewTop = Math.max(8, Math.min(92, (previewCentroid[1] - viewY) / viewHeight * 100));
  const previewSide = previewLeft > 64 ? "left" : "right";
  const previewVertical = previewTop < 28 ? "below" : previewTop > 72 ? "above" : "middle";
  const previewScale = zoom >= 3.1 ? "micro" : zoom >= 2 ? "compact" : "standard";

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === mapWorkspaceRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      if (hoverOpenRef.current !== null) window.clearTimeout(hoverOpenRef.current);
      if (hoverClearRef.current !== null) window.clearTimeout(hoverClearRef.current);
    };
  }, []);

  async function toggleFullscreen() {
    if (!mapWorkspaceRef.current) return;
    if (document.fullscreenElement === mapWorkspaceRef.current) await document.exitFullscreen();
    else await mapWorkspaceRef.current.requestFullscreen();
  }

  function keepPreview(countryId?: string) {
    if (hoverOpenRef.current !== null) {
      window.clearTimeout(hoverOpenRef.current);
      hoverOpenRef.current = null;
    }
    if (hoverClearRef.current !== null) {
      window.clearTimeout(hoverClearRef.current);
      hoverClearRef.current = null;
    }
    if (countryId) {
      setHoveredId(countryId);
      setExpandedHoverId((current) => current === countryId ? current : null);
    }
  }

  function schedulePreview(countryId: string) {
    if (hoverClearRef.current !== null) {
      window.clearTimeout(hoverClearRef.current);
      hoverClearRef.current = null;
    }
    if (hoveredId === countryId || hoverOpenRef.current !== null) return;
    hoverOpenRef.current = window.setTimeout(() => {
      setHoveredId(countryId);
      setExpandedHoverId((current) => current === countryId ? current : null);
      hoverOpenRef.current = null;
    }, 700);
  }

  function clearPreviewSoon() {
    if (hoverOpenRef.current !== null) {
      window.clearTimeout(hoverOpenRef.current);
      hoverOpenRef.current = null;
    }
    if (hoverClearRef.current !== null) window.clearTimeout(hoverClearRef.current);
    hoverClearRef.current = window.setTimeout(() => {
      setHoveredId(null);
      setExpandedHoverId(null);
      hoverClearRef.current = null;
    }, 160);
  }

  function selectCountry(country: MarketCountry) {
    const nextCenter = marketCentroid(country);
    setPinnedId(country.id);
    setHoveredId(null);
    setQuery(country.name);
    const nextZoom = Math.max(zoom, 2.35);
    if (nextCenter) setCenter(clampMapCenter(nextCenter, nextZoom));
    setZoom(nextZoom);
  }

  function resetMap() {
    setPinnedId(null);
    setHoveredId(null);
    setZoom(DEFAULT_ZOOM);
    setCenter(DEFAULT_CENTER);
    setQuery("");
    setExpandedHoverId(null);
  }

  function resetFilters() {
    setActiveLenses(new Set());
    setScreenFilters(defaultMarketScreen);
    setMarketRegion("all");
    setMarketStage("all");
    setIndustryLens("all");
  }

  function changeZoom(nextZoom: number, pointerRatio: MapPoint = [0.5, 0.5]) {
    const next = zoomMapAt(center, zoom, nextZoom, pointerRatio);
    setZoom(next.zoom);
    setCenter(next.center);
  }

  function beginPan(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      start: [event.clientX, event.clientY],
      center,
      moved: false,
    };
    setDragging(true);
  }

  function continuePan(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta: MapPoint = [event.clientX - drag.start[0], event.clientY - drag.start[1]];
    if (Math.hypot(...delta) > 4) drag.moved = true;
    setGlobeTilt([
      Math.max(-1.8, Math.min(1.8, -delta[1] * 0.012)),
      Math.max(-2.6, Math.min(2.6, delta[0] * 0.012)),
    ]);
    const bounds = event.currentTarget.getBoundingClientRect();
    setCenter(panMapCenter(drag.center, zoom, delta, [bounds.width, bounds.height]));
  }

  function endPan(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setDragging(false);
    setGlobeTilt([0, 0]);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.requestAnimationFrame(() => {
      suppressClickRef.current = false;
    });
  }

  function toggleLens(lens: MapLens) {
    setActiveLenses((current) => {
      const next = new Set(current);
      if (next.has(lens)) next.delete(lens);
      else next.add(lens);
      return next;
    });
  }

  function updateScreenFilter(key: ScreenKey, next: Partial<ScreenFilter>) {
    setScreenFilters((current) => ({
      ...current,
      [key]: { ...current[key], ...next },
    }));
  }

  function marketPassesFilters(market: MarketCountry) {
    if (marketRegion !== "all" && regionForMarket(market.id) !== marketRegion) return false;
    if (marketStage !== "all" && stageForMarket(market.id) !== marketStage) return false;
    if (activeLenses.has("energy") && !energyMarkets.has(market.id)) return false;
    if (activeLenses.has("trillion") && !trillionEconomies.has(market.id)) return false;
    const baseAnalytics = marketAnalytics[market.id];
    const analytics = baseAnalytics ? analyticsForIndustry(baseAnalytics, industryLens) : null;
    if (!analytics) return !Object.values(screenFilters).some((filter) => filter.enabled);
    if (screenFilters.maxPe.enabled && analytics.pe > screenFilters.maxPe.value) return false;
    const valuation = valuationMetrics(analytics);
    if (screenFilters.maxPeg.enabled && (valuation.peg === null || valuation.peg > screenFilters.maxPeg.value)) return false;
    if (screenFilters.maxPriceToBook.enabled && valuation.priceToBook > screenFilters.maxPriceToBook.value) return false;
    if (screenFilters.minSharpe.enabled && analytics.sharpe < screenFilters.minSharpe.value) return false;
    if (screenFilters.maxDebt.enabled && analytics.debtToGdp > screenFilters.maxDebt.value) return false;
    if (screenFilters.minSolvency.enabled && analytics.solvency < screenFilters.minSolvency.value) return false;
    if (screenFilters.minFcfYield.enabled && analytics.fcfYield < screenFilters.minFcfYield.value) return false;
    if (screenFilters.minGrowth.enabled && analytics.earningsGrowth < screenFilters.minGrowth.value) return false;
    if (screenFilters.minRoe.enabled && analytics.roe < screenFilters.minRoe.value) return false;
    return true;
  }

  const suggestions = query
    ? marketCountries.filter((country) => country.name.toLowerCase().includes(query.toLowerCase()) && country.name !== query)
    : [];
  const activeExposure = selectedCountry && portfolioTotal
    ? holdings.filter((holding) => holding.country === selectedCountry.name)
      .reduce((sum, holding) => sum + holdingValueNok(holding, fxRates), 0) / portfolioTotal * 100
    : 0;
  const selectedResearch = selectedCountry ? marketResearch[selectedCountry.id] : null;
  const selectedAnalytics = selectedCountry ? marketAnalytics[selectedCountry.id] : null;
  const previewResearch = previewCountry ? marketResearch[previewCountry.id] : null;
  const previewAnalytics = previewCountry ? marketAnalytics[previewCountry.id] : null;
  const selectedValuation = selectedAnalytics ? valuationMetrics(selectedAnalytics) : null;
  const effectiveComparisonId = selectedCountry?.id === comparisonId
    ? selectedCountry.id === "united-states" ? "germany" : "united-states"
    : comparisonId;
  const comparisonCountry = marketCountries.find((country) => country.id === effectiveComparisonId) ?? null;
  const comparisonAnalytics = comparisonCountry ? marketAnalytics[comparisonCountry.id] : null;
  const comparisonValuation = comparisonAnalytics ? valuationMetrics(comparisonAnalytics) : null;
  const industryOptions = marketsForIndustry(comparisonIndustry);
  const industryPrimary = industryOptions.find((market) => market.countryId === industryPrimaryId) ?? industryOptions[0];
  const effectiveIndustryComparisonId = industryPrimary?.countryId === industryComparisonId
    ? industryOptions.find((market) => market.countryId !== industryPrimary.countryId)?.countryId
    : industryComparisonId;
  const industryComparison = industryOptions.find((market) => market.countryId === effectiveIndustryComparisonId)
    ?? industryOptions.find((market) => market.countryId !== industryPrimary?.countryId);
  const industryPrimaryScore = industryPrimary ? scoreIndustryMarket(industryPrimary) : null;
  const industryComparisonScore = industryComparison ? scoreIndustryMarket(industryComparison) : null;
  const activeUniverseCount = Number(marketRegion !== "all") + Number(marketStage !== "all") + Number(industryLens !== "all");
  const activeScreenCount = Object.values(screenFilters).filter((filter) => filter.enabled).length;
  const matchingMarkets = marketCountries.filter(marketPassesFilters);
  const matchingMarketCount = matchingMarkets.length;
  const shortcuts = ["norway", "netherlands", "united-states", "india", "singapore", "south-africa"]
    .map((id) => marketCountries.find((country) => country.id === id))
    .filter((country): country is MarketCountry => Boolean(country));

  return (
    <div className="map-layout atlas-layout">
      <section className="map-toolbar primary-view-toolbar">
        <div><h2>Atlas</h2></div>
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
        <div className="map-market-shortcuts" aria-label="Market shortcuts">
          {shortcuts.map((country) => (
            <button key={country.id} type="button" onClick={() => selectCountry(country)}>
              {country.name}
            </button>
          ))}
        </div>
      </section>

      <section ref={mapWorkspaceRef} className={`panel wide map-panel atlas-workspace${isFullscreen ? " is-fullscreen" : ""}`}>
        <div
          className={`world-map-shell globe-map-shell${lensPanelOpen ? " filters-open" : ""}`}
          style={{ "--globe-tilt-x": `${globeTilt[0]}deg`, "--globe-tilt-y": `${globeTilt[1]}deg` } as CSSProperties}
          onMouseLeave={clearPreviewSoon}
        >
          <OceanParticleField surfaceRef={mapSurfaceRef} />
          <svg
            ref={mapSurfaceRef}
            className={`world-map${dragging ? " dragging" : ""}`}
            viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
            role="img"
            aria-label={`Global securities map with ${marketCountries.length} researched markets`}
            onPointerDown={beginPan}
            onPointerMove={continuePan}
            onPointerUp={endPan}
            onPointerCancel={endPan}
          >
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
              const filteredOut = !marketPassesFilters(market);
              const isNordic = ["norway", "sweden", "denmark", "finland"].includes(market.id);
              return (
                <g
                  key={country.name}
                  role="button"
                  tabIndex={0}
                  aria-pressed={pinnedId === market.id}
                  aria-label={`${pinnedId === market.id ? "Pinned" : "Open"} ${market.name} market profile`}
                  onMouseEnter={() => schedulePreview(market.id)}
                  onMouseLeave={clearPreviewSoon}
                  onFocus={() => keepPreview(market.id)}
                  onBlur={clearPreviewSoon}
                  onClick={() => {
                    if (!suppressClickRef.current) selectCountry(market);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") selectCountry(market);
                  }}
                >
                  <path className={`map-land market-country${active ? " active" : ""}${pinnedId === market.id ? " pinned" : ""}${filteredOut ? " filtered-out" : ""}${energyMarkets.has(market.id) && activeLenses.has("energy") ? " energy-market" : ""}`} d={country.path} />
                  <circle className="market-hit-target" cx={country.centroid[0]} cy={country.centroid[1]} r={isNordic ? 13 : 8} />
                  <circle className={`market-pulse${active ? " active" : ""}${filteredOut ? " filtered-out" : ""}`} cx={country.centroid[0]} cy={country.centroid[1]} r={isNordic ? 4.5 : 3.5} />
                </g>
              );
            })}
            {marketCountries.filter((market) => pointMarketCoordinates[market.id]).map((market) => {
              const point = marketCentroid(market);
              if (!point) return null;
              const active = market.id === activeId;
              const filteredOut = !marketPassesFilters(market);
              return (
                <g
                  className="point-market"
                  key={market.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={pinnedId === market.id}
                  aria-label={`${pinnedId === market.id ? "Pinned" : "Open"} ${market.name} market profile`}
                  onMouseEnter={() => schedulePreview(market.id)}
                  onMouseLeave={clearPreviewSoon}
                  onFocus={() => keepPreview(market.id)}
                  onBlur={clearPreviewSoon}
                  onClick={() => {
                    if (!suppressClickRef.current) selectCountry(market);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") selectCountry(market);
                  }}
                >
                  <circle className="market-hit-target" cx={point[0]} cy={point[1]} r="12" />
                  <circle className={`point-market-ring${active ? " active" : ""}${filteredOut ? " filtered-out" : ""}`} cx={point[0]} cy={point[1]} r="5.5" />
                  <circle className={`market-pulse${active ? " active" : ""}${filteredOut ? " filtered-out" : ""}`} cx={point[0]} cy={point[1]} r="3.5" />
                </g>
              );
            })}
            {activeShape ? (
              <path
                className={`country-focus-overlay${hoveredId ? " hovered" : " pinned"}`}
                d={activeShape.path}
                aria-hidden="true"
              />
            ) : null}
            {!activeShape && activeCountry && activeCentroid ? (
              <circle
                className={`point-market-focus${hoveredId ? " hovered" : " pinned"}`}
                cx={activeCentroid[0]}
                cy={activeCentroid[1]}
                r="7"
                aria-hidden="true"
              />
            ) : null}
            {activeLenses.has("blue-banana") ? <path className="blue-banana-corridor" d={blueBananaPath} /> : null}
            {activeLenses.has("rates") ? rateAnchors.map((anchor) => {
              const market = marketCountries.find((country) => country.id === anchor.id);
              const shape = market ? worldCountries.find((country) => country.name === market.atlasName) : null;
              if (!shape) return null;
              return (
                <g className="rate-anchor" key={anchor.id} transform={`translate(${shape.centroid[0]} ${shape.centroid[1]})`}>
                  <circle r="11" />
                  <text y="2.5" textAnchor="middle">{anchor.label}</text>
                </g>
              );
            }) : null}
            {activeLenses.has("economic-sites") ? economicMarkers.filter((marker) => marker.countryId === selectedCountry?.id).map((marker) => {
              const point = projection(marker.coordinates);
              if (!point) return null;
              return (
                <g className={`economic-marker ${marker.kind}`} key={`${marker.countryId}-${marker.name}`} transform={`translate(${point[0]} ${point[1]})`}>
                  <circle className="economic-marker-halo" r="8" />
                  <circle className="economic-marker-dot" r="2.6" />
                  <text x="7" y="-4">{marker.name}</text>
                  <title>{marker.name}: {marker.detail}</title>
                </g>
              );
            }) : null}
          </svg>
          <div className="map-lens-control">
            <button
              className={`map-lens-trigger${lensPanelOpen ? " active" : ""}`}
              type="button"
              aria-label="Map lenses"
              aria-expanded={lensPanelOpen}
              title="Map lenses"
              onClick={() => setLensPanelOpen((current) => !current)}
            >
              <Settings2 size={17} />
            </button>
            {lensPanelOpen ? (
              <div className="map-lens-panel">
                <header><span>Atlas filters</span><div><strong>{activeLenses.size + activeUniverseCount + activeScreenCount || "All"}</strong><button type="button" className="atlas-filter-reset" onClick={resetFilters} aria-label="Reset all filters" title="Reset all filters"><RotateCcw size={13} /></button></div></header>
                <div className="map-screen-summary"><strong>{matchingMarketCount} of {marketCountries.length}</strong><span>researched markets match</span></div>
                <div className="atlas-filter-tabs" role="tablist" aria-label="Filter groups">
                  {(["universe", "fundamentals", "risk"] as const).map((panel) => <button key={panel} role="tab" aria-selected={filterPanel === panel} className={filterPanel === panel ? "active" : ""} onClick={() => setFilterPanel(panel)}>{panel === "risk" ? "Risk & macro" : `${panel[0].toUpperCase()}${panel.slice(1)}`}</button>)}
                </div>
                {filterPanel === "universe" ? <>
                  <section className="map-lens-section atlas-universe-screen">
                    <div className="map-lens-section-heading"><h4>Market universe</h4><span>Where to look</span></div>
                    <label className="atlas-select-field"><span><strong>Region</strong><small>Geographic market group</small></span><select value={marketRegion} onChange={(event) => setMarketRegion(event.target.value as MarketRegion)}><option value="all">All regions</option>{Object.keys(marketRegions).map((region) => <option key={region} value={region}>{region}</option>)}</select></label>
                    <label className="atlas-select-field"><span><strong>Market classification</strong><small>Access, maturity, and investability</small></span><select value={marketStage} onChange={(event) => setMarketStage(event.target.value as MarketStage)}><option value="all">All classifications</option><option>Developed</option><option>Emerging</option><option>Restricted</option></select></label>
                    <label className="atlas-select-field"><span><strong>Industry lens</strong><small>Screen countries using sector-relative fundamentals</small></span><select value={industryLens} onChange={(event) => setIndustryLens(event.target.value as IndustryLens)}>{industryLensOptions.map((option) => <option key={option.id} value={option.id}>{option.group} · {option.label}</option>)}</select></label>
                    {industryLens !== "all" ? <p className="atlas-industry-disclosure">Industry ratios are transparent comparative estimates derived from each country index. Country debt and resilience remain country-level.</p> : null}
                  </section>
                  <section className="map-lens-section">
                    <h4>Map overlays</h4>
                    <div className="map-overlay-grid">
                      <label><input type="checkbox" checked={activeLenses.has("rates")} onChange={() => toggleLens("rates")} /><span><strong>Central banks</strong><small>Policy-rate anchors</small></span></label>
                      <label><input type="checkbox" checked={activeLenses.has("energy")} onChange={() => toggleLens("energy")} /><span><strong>Energy producers</strong><small>Oil and gas exposure</small></span></label>
                      <label><input type="checkbox" checked={activeLenses.has("economic-sites")} onChange={() => toggleLens("economic-sites")} /><span><strong>Economic sites</strong><small>Only for selected market</small></span></label>
                      <label><input type="checkbox" checked={activeLenses.has("trillion")} onChange={() => toggleLens("trillion")} /><span><strong>GDP above $1tn</strong><small>Economic scale</small></span></label>
                      <label><input type="checkbox" checked={activeLenses.has("blue-banana")} onChange={() => toggleLens("blue-banana")} /><span><strong>Blue Banana</strong><small>European corridor</small></span></label>
                    </div>
                  </section>
                </> : null}
                {filterPanel === "fundamentals" ? <section className="map-lens-section analytical-screen">
                  <div className="map-lens-section-heading"><h4>Valuation &amp; quality</h4><span>{industryLens === "all" ? "Whole index" : "Industry lens"}</span></div>
                  <ScreenerControl label="P/E ratio" description="Maximum forward valuation multiple" suffix="x" min={4} max={40} step={1} filter={screenFilters.maxPe} onChange={(next) => updateScreenFilter("maxPe", next)} />
                  <ScreenerControl label="PEG ratio" description="Maximum price / growth multiple" min={0.5} max={4} step={0.1} decimals={1} filter={screenFilters.maxPeg} onChange={(next) => updateScreenFilter("maxPeg", next)} />
                  <ScreenerControl label="Price / book" description="Maximum book-value multiple" suffix="x" min={0.5} max={12} step={0.5} decimals={1} filter={screenFilters.maxPriceToBook} onChange={(next) => updateScreenFilter("maxPriceToBook", next)} />
                  <ScreenerControl label="Free-cash-flow yield" description="Minimum cash yield" suffix="%" min={0} max={12} step={0.5} decimals={1} filter={screenFilters.minFcfYield} onChange={(next) => updateScreenFilter("minFcfYield", next)} />
                  <ScreenerControl label="Earnings growth" description="Minimum forward growth" suffix="%" min={-5} max={25} step={1} filter={screenFilters.minGrowth} onChange={(next) => updateScreenFilter("minGrowth", next)} />
                  <ScreenerControl label="Return on equity" description="Minimum profitability" suffix="%" min={5} max={35} step={1} filter={screenFilters.minRoe} onChange={(next) => updateScreenFilter("minRoe", next)} />
                </section> : null}
                {filterPanel === "risk" ? <section className="map-lens-section analytical-screen">
                  <div className="map-lens-section-heading"><h4>Risk &amp; macro resilience</h4><span>Country level</span></div>
                  <ScreenerControl label="Sharpe ratio" description="Minimum risk-adjusted return" min={-0.5} max={2} step={0.1} decimals={1} filter={screenFilters.minSharpe} onChange={(next) => updateScreenFilter("minSharpe", next)} />
                  <ScreenerControl label="Government debt" description="Maximum gross debt / GDP" suffix="%" min={20} max={250} step={5} filter={screenFilters.maxDebt} onChange={(next) => updateScreenFilter("maxDebt", next)} />
                  <ScreenerControl label="Resilience score" description="Minimum fiscal and market resilience" suffix="/100" min={20} max={95} step={5} filter={screenFilters.minSolvency} onChange={(next) => updateScreenFilter("minSolvency", next)} />
                </section> : null}
                <div className="atlas-filter-results"><span>{matchingMarkets.slice(0, 5).map((market) => market.name).join(" · ") || "No markets match"}{matchingMarkets.length > 5 ? ` · +${matchingMarkets.length - 5}` : ""}</span></div>
                <p className="map-screen-note">Filters use comparative model inputs. Sector and industry lenses are estimates, not live index quotes. Market-size and liquidity feeds are the next sourced layer.</p>
                <div className="atlas-filter-sources"><span>Framework</span><a href="https://www.msci.com/indexes/index-resources/gics" target="_blank" rel="noreferrer">GICS</a><a href={officialSources.worldBank} target="_blank" rel="noreferrer">World Bank</a><a href="https://www.imf.org/external/datamapper/datasets/WEO" target="_blank" rel="noreferrer">IMF</a></div>
                <button type="button" onClick={resetFilters}>Reset all filters</button>
              </div>
            ) : null}
          </div>
          {previewCountry ? (
            <aside
              className={`map-callout ${previewScale} ${previewSide} ${previewVertical}${expandedHoverId === previewCountry.id ? " expanded" : ""}`}
              style={{ left: `${previewLeft}%`, top: `${previewTop}%` }}
              onMouseEnter={() => keepPreview(previewCountry.id)}
              onMouseLeave={clearPreviewSoon}
              onFocus={() => keepPreview(previewCountry.id)}
              onBlur={clearPreviewSoon}
              aria-label={`${previewCountry.name} market preview`}
            >
              <div className="map-callout-heading">
                <span>{previewCountry.currency} · {previewCountry.keyIndex}</span>
                <strong>{previewCountry.name}</strong>
              </div>
              <p>{previewCountry.note}</p>
              {expandedHoverId === previewCountry.id && previewResearch ? (
                <div className="map-callout-details">
                  <dl>
                    {previewAnalytics ? <div><dt>P/E · Sharpe</dt><dd>{previewAnalytics.pe.toFixed(1)}x · {previewAnalytics.sharpe.toFixed(2)}</dd></div> : null}
                    {previewAnalytics ? <div><dt>FCF yield</dt><dd>{previewAnalytics.fcfYield.toFixed(1)}%</dd></div> : null}
                    <div><dt>Leading sectors</dt><dd>{previewCountry.sectors}</dd></div>
                    <div><dt>Resources</dt><dd>{previewResearch.materials}</dd></div>
                    <div><dt>Companies</dt><dd>{previewResearch.companies.slice(0, 3).join(", ")}</dd></div>
                  </dl>
                  <p className="map-callout-policy">{previewResearch.policyWatch}</p>
                  <button type="button" onClick={() => selectCountry(previewCountry)}>Open full profile</button>
                </div>
              ) : null}
              <button
                type="button"
                className="map-callout-more"
                aria-expanded={expandedHoverId === previewCountry.id}
                onClick={() => setExpandedHoverId((current) => current === previewCountry.id ? null : previewCountry.id)}
              >
                {expandedHoverId === previewCountry.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {expandedHoverId === previewCountry.id ? "Less" : "More info"}
              </button>
            </aside>
          ) : null}
          <div className="map-zoom-controls">
            <button type="button" aria-label={isFullscreen ? "Exit full screen" : "Open full screen"} onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
            <button type="button" aria-label="Zoom in" onClick={() => changeZoom(zoom * 1.28)}><Plus size={16} /></button>
            <button type="button" aria-label="Zoom out" onClick={() => changeZoom(zoom / 1.28)}><Minus size={16} /></button>
            <button type="button" aria-label="Reset map" onClick={resetMap}><Crosshair size={16} /></button>
          </div>
          <div className="map-coverage-status"><Landmark size={14} /> {matchingMarketCount} of {marketCountries.length} markets</div>
        </div>
      </section>

      {selectedCountry ? (
        <section className="country-dashboard">
          <header>
            <div><span className="eyebrow">{selectedCountry.currency} market profile</span><h2>{selectedCountry.name}</h2></div>
            <div className="country-profile-actions"><div className="country-index"><span>Key index</span><strong>{selectedCountry.keyIndex}</strong></div><button type="button" className="icon-button country-profile-close" onClick={resetMap} aria-label={`Close ${selectedCountry.name} profile`} title="Close market profile"><X size={17} /></button></div>
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
          {selectedAnalytics ? (
            <div className="market-analytics-grid" aria-label={`${selectedCountry.name} analytical screen`}>
              <AnalyticalMetric label="Index P/E" value={`${selectedAnalytics.pe.toFixed(1)}x`} />
              <AnalyticalMetric label="PEG ratio" value={selectedValuation?.peg === null ? "N/A" : selectedValuation?.peg.toFixed(2) ?? "N/A"} />
              <AnalyticalMetric label="Price / book" value={`${selectedValuation?.priceToBook.toFixed(1) ?? "N/A"}x`} />
              <AnalyticalMetric label="Sharpe" value={selectedAnalytics.sharpe.toFixed(2)} />
              <AnalyticalMetric label="Debt / GDP" value={`${selectedAnalytics.debtToGdp.toFixed(0)}%`} />
              <AnalyticalMetric label="Solvency" value={`${selectedAnalytics.solvency}/100`} />
              <AnalyticalMetric label="FCF yield" value={`${selectedAnalytics.fcfYield.toFixed(1)}%`} />
              <AnalyticalMetric label="Earnings growth" value={`${selectedAnalytics.earningsGrowth.toFixed(1)}%`} />
              <AnalyticalMetric label="Return on equity" value={`${selectedAnalytics.roe.toFixed(1)}%`} />
            </div>
          ) : null}
          {selectedAnalytics && selectedValuation ? (
            <section className="atlas-comparison" aria-labelledby="atlas-comparison-title">
              <header>
                <div>
                  <ArrowLeftRight size={16} />
                  <div><span className="eyebrow">Head-to-head</span><h3 id="atlas-comparison-title">Where is the stronger setup?</h3></div>
                </div>
                <div className="atlas-comparison-mode" role="tablist" aria-label="Comparison type">
                  <button type="button" role="tab" aria-selected={comparisonMode === "country"} className={comparisonMode === "country" ? "active" : ""} onClick={() => setComparisonMode("country")}>Whole market</button>
                  <button type="button" role="tab" aria-selected={comparisonMode === "industry"} className={comparisonMode === "industry" ? "active" : ""} onClick={() => setComparisonMode("industry")}>Same industry</button>
                </div>
              </header>
              {comparisonMode === "country" && comparisonCountry && comparisonAnalytics && comparisonValuation ? <>
                <div className="atlas-comparison-selectors single">
                  <label><span>Primary market</span><select value={selectedCountry.id} onChange={(event) => selectCountry(marketCountries.find((country) => country.id === event.target.value) ?? selectedCountry)}>{marketCountries.filter((country) => marketAnalytics[country.id]).map((country) => <option key={country.id} value={country.id}>{country.name} · {country.keyIndex}</option>)}</select></label>
                  <label><span>Against</span><select value={effectiveComparisonId} onChange={(event) => setComparisonId(event.target.value)}>{marketCountries.filter((country) => country.id !== selectedCountry.id && marketAnalytics[country.id]).map((country) => <option key={country.id} value={country.id}>{country.name} · {country.keyIndex}</option>)}</select></label>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Metric</th><th>{selectedCountry.name}</th><th>{comparisonCountry.name}</th><th>Reading</th></tr></thead>
                    <tbody>
                      <ComparisonRow label="Index P/E" primary={selectedAnalytics.pe} comparison={comparisonAnalytics.pe} suffix="x" lowerIsBetter />
                      <ComparisonRow label="PEG ratio" primary={selectedValuation.peg} comparison={comparisonValuation.peg} lowerIsBetter />
                      <ComparisonRow label="Price / book" primary={selectedValuation.priceToBook} comparison={comparisonValuation.priceToBook} suffix="x" lowerIsBetter />
                      <ComparisonRow label="Sharpe ratio" primary={selectedAnalytics.sharpe} comparison={comparisonAnalytics.sharpe} />
                      <ComparisonRow label="Government debt / GDP" primary={selectedAnalytics.debtToGdp} comparison={comparisonAnalytics.debtToGdp} suffix="%" lowerIsBetter />
                      <ComparisonRow label="Free-cash-flow yield" primary={selectedAnalytics.fcfYield} comparison={comparisonAnalytics.fcfYield} suffix="%" />
                      <ComparisonRow label="Earnings growth" primary={selectedAnalytics.earningsGrowth} comparison={comparisonAnalytics.earningsGrowth} suffix="%" />
                      <ComparisonRow label="Return on equity" primary={selectedAnalytics.roe} comparison={comparisonAnalytics.roe} suffix="%" />
                    </tbody>
                  </table>
                </div>
                <p>Whole-market screen. Index composition, accounting standards, and observation periods can materially change the reading.</p>
              </> : null}
              {comparisonMode === "industry" && industryPrimary && industryComparison && industryPrimaryScore && industryComparisonScore ? <>
                <div className="atlas-comparison-selectors">
                  <label><span>Industry</span><select value={comparisonIndustry} onChange={(event) => setComparisonIndustry(event.target.value as HeadToHeadIndustry)}>{Object.entries(industryLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                  <label><span>Market A</span><select value={industryPrimary.countryId} onChange={(event) => setIndustryPrimaryId(event.target.value)}>{industryOptions.map((market) => <option key={market.countryId} value={market.countryId}>{market.country}</option>)}</select></label>
                  <label><span>Market B</span><select value={industryComparison.countryId} onChange={(event) => setIndustryComparisonId(event.target.value)}>{industryOptions.filter((market) => market.countryId !== industryPrimary.countryId).map((market) => <option key={market.countryId} value={market.countryId}>{market.country}</option>)}</select></label>
                </div>
                <div className="industry-verdict">
                  <div><span>Stronger modeled setup</span><strong>{industryPrimaryScore.overall >= industryComparisonScore.overall ? industryPrimary.country : industryComparison.country}</strong><p>{industryLabels[comparisonIndustry]} · transparent screen, not a recommendation</p></div>
                  <ScoreSummary market={industryPrimary.country} score={industryPrimaryScore.overall} />
                  <ScoreSummary market={industryComparison.country} score={industryComparisonScore.overall} />
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Metric</th><th>{industryPrimary.country}</th><th>{industryComparison.country}</th><th>Reading</th></tr></thead>
                    <tbody>
                      <ComparisonRow label="Industry P/E" primary={industryPrimary.pe} comparison={industryComparison.pe} suffix="x" lowerIsBetter />
                      <ComparisonRow label="Earnings growth" primary={industryPrimary.earningsGrowth} comparison={industryComparison.earningsGrowth} suffix="%" />
                      <ComparisonRow label="FCF yield" primary={industryPrimary.fcfYield} comparison={industryComparison.fcfYield} suffix="%" />
                      <ComparisonRow label="Net debt / EBITDA" primary={industryPrimary.netDebtToEbitda} comparison={industryComparison.netDebtToEbitda} suffix="x" lowerIsBetter />
                      <ComparisonRow label="Return on equity" primary={industryPrimary.roe} comparison={industryComparison.roe} suffix="%" />
                      <ComparisonRow label="Sharpe ratio" primary={industryPrimary.sharpe} comparison={industryComparison.sharpe} />
                      <RiskComparisonRow label="Policy risk" primary={industryPrimary.policyRisk} comparison={industryComparison.policyRisk} />
                      <RiskComparisonRow label="Currency risk" primary={industryPrimary.currencyRisk} comparison={industryComparison.currencyRisk} />
                      <ComparisonRow label="Market liquidity" primary={industryPrimary.liquidity} comparison={industryComparison.liquidity} suffix="/5" />
                    </tbody>
                  </table>
                </div>
                <div className="industry-context"><p><strong>{industryPrimary.country}</strong>{industryPrimary.note}</p><p><strong>{industryComparison.country}</strong>{industryComparison.note}</p></div>
                <p>Overall score: valuation 20%, growth 20%, quality 16%, balance sheet 14%, risk-adjusted return 15%, investability 15%. Inputs are indicative research screens and must be verified before use.</p>
              </> : null}
            </section>
          ) : null}
          {selectedResearch ? (
            <div className="country-research-grid">
              <article>
                <header><Building2 size={15} /><span>Companies to know</span></header>
                <div className="company-list">
                  {selectedResearch.companies.map((company) => <span key={company}>{company}</span>)}
                </div>
              </article>
              <article>
                <header><Factory size={15} /><span>Market composition</span></header>
                <dl>
                  <div><dt>Leading sectors</dt><dd>{selectedCountry.sectors}</dd></div>
                  <div><dt>Resources</dt><dd>{selectedResearch.materials}</dd></div>
                </dl>
              </article>
              <article>
                <header><Landmark size={15} /><span>Policy and political watch</span></header>
                <p>{selectedResearch.policyWatch}</p>
                <em>Analytical context · review against current reporting</em>
              </article>
              <article className="investment-lens">
                <header><Crosshair size={15} /><span>Investment lens</span></header>
                <ul>{selectedResearch.takeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul>
              </article>
            </div>
          ) : null}
          <footer className="country-data-note">
            Annual macro series and event-driven observations are shown separately. Analytical screen values are indicative comparison inputs; missing values are never treated as zero.
          </footer>
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

function ScreenerControl({
  label,
  description,
  suffix = "",
  min,
  max,
  step,
  decimals = 0,
  filter,
  onChange,
}: {
  label: string;
  description: string;
  suffix?: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  filter: ScreenFilter;
  onChange: (next: Partial<ScreenFilter>) => void;
}) {
  return (
    <div className={`map-screen-control${filter.enabled ? " active" : ""}`}>
      <div>
        <label><input type="checkbox" checked={filter.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} /><span><strong>{label}</strong><small>{description}</small></span></label>
        <output>{filter.value.toFixed(decimals)}{suffix}</output>
      </div>
      <input
        type="range"
        aria-label={`${label} threshold`}
        disabled={!filter.enabled}
        min={min}
        max={max}
        step={step}
        value={filter.value}
        onChange={(event) => onChange({ value: Number(event.target.value) })}
      />
    </div>
  );
}

function AnalyticalMetric({ label, value }: { label: string; value: string }) {
  return <article><span>{label}</span><strong>{value}</strong><em>Indicative screen</em></article>;
}

function ComparisonRow({
  label,
  primary,
  comparison,
  suffix = "",
  lowerIsBetter = false,
}: {
  label: string;
  primary: number | null;
  comparison: number | null;
  suffix?: string;
  lowerIsBetter?: boolean;
}) {
  const difference = primary !== null && comparison !== null ? primary - comparison : null;
  const favorable = difference === null ? null : lowerIsBetter ? difference < 0 : difference > 0;
  const reading = difference === null || Math.abs(difference) < 0.05
    ? "Broadly similar"
    : `${Math.abs(difference).toFixed(1)}${suffix} ${difference > 0 ? "higher" : "lower"}`;
  const format = (value: number | null) => value === null ? "N/A" : `${value.toFixed(value >= 100 ? 0 : 1)}${suffix}`;

  return (
    <tr>
      <td><strong>{label}</strong></td>
      <td>{format(primary)}</td>
      <td>{format(comparison)}</td>
      <td><span className={favorable === null ? "" : favorable ? "good" : "bad"}>{reading}</span></td>
    </tr>
  );
}

function RiskComparisonRow({ label, primary, comparison }: { label: string; primary: number; comparison: number }) {
  const names = ["", "Low", "Moderate", "Elevated", "High", "Very high"];
  return (
    <tr>
      <td><strong>{label}</strong></td>
      <td>{names[primary]} · {primary}/5</td>
      <td>{names[comparison]} · {comparison}/5</td>
      <td><span className={primary === comparison ? "" : primary < comparison ? "good" : "bad"}>{primary === comparison ? "Broadly similar" : primary < comparison ? "Lower in market A" : "Lower in market B"}</span></td>
    </tr>
  );
}

function ScoreSummary({ market, score }: { market: string; score: number }) {
  return <div className="industry-score"><span>{market}</span><strong>{score.toFixed(0)}<small>/100</small></strong><i><b style={{ width: `${score}%` }} /></i></div>;
}
