"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Factory,
  Landmark,
  Minus,
  Plus,
  Search,
  Settings2,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldAtlas from "world-atlas/countries-110m.json";
import { formatPercent, holdingValueNok, totalValueNok } from "@/lib/calculations";
import {
  clampMapCenter,
  mapViewSize,
  panMapCenter,
  zoomMapAt,
  type MapPoint,
} from "@/lib/map-viewport";
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

type MarketResearch = {
  companies: string[];
  materials: string;
  policyWatch: string;
  takeaways: string[];
};

type MapLens = "rates" | "energy" | "trillion" | "blue-banana";
type ScreenKey = "maxPe" | "minSharpe" | "maxDebt" | "minSolvency" | "minFcfYield" | "minGrowth";
type ScreenFilter = { enabled: boolean; value: number };
type MarketScreen = Record<ScreenKey, ScreenFilter>;
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
const marketByAtlasName = new Map(marketCountries.map((country) => [country.atlasName, country]));
const DEFAULT_ZOOM = 1.12;
const DEFAULT_CENTER: MapPoint = [465, 205];
const energyMarkets = new Set(["norway", "united-kingdom", "united-states", "canada", "australia", "brazil", "mexico", "china", "egypt", "russia"]);
const trillionEconomies = new Set(["united-states", "china", "germany", "japan", "india", "united-kingdom", "france", "italy", "brazil", "canada", "russia", "south-korea", "australia", "spain", "mexico", "netherlands"]);
const rateAnchors = [
  { id: "united-states", label: "FED" }, { id: "germany", label: "ECB" }, { id: "united-kingdom", label: "BOE" },
  { id: "norway", label: "NB" }, { id: "japan", label: "BOJ" }, { id: "china", label: "PBOC" },
];

const defaultMarketScreen: MarketScreen = {
  maxPe: { enabled: false, value: 20 },
  minSharpe: { enabled: false, value: 0.5 },
  maxDebt: { enabled: false, value: 100 },
  minSolvency: { enabled: false, value: 70 },
  minFcfYield: { enabled: false, value: 5 },
  minGrowth: { enabled: false, value: 8 },
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
  brazil: { pe: 9, sharpe: 0.65, debtToGdp: 86, solvency: 59, fcfYield: 10, earningsGrowth: 8, roe: 18 },
  mexico: { pe: 13, sharpe: 0.5, debtToGdp: 52, solvency: 67, fcfYield: 7, earningsGrowth: 6, roe: 16 },
  russia: { pe: 6, sharpe: -0.4, debtToGdp: 21, solvency: 25, fcfYield: 12, earningsGrowth: -5, roe: 12 },
};

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
  const [zoom, setZoom] = useState(requestedMarket ? 2.2 : DEFAULT_ZOOM);
  const [center, setCenter] = useState<MapPoint>(
    requestedShape ? requestedShape.centroid as MapPoint : DEFAULT_CENTER,
  );
  const [query, setQuery] = useState(requestedMarket?.name ?? "");
  const [dragging, setDragging] = useState(false);
  const [expandedHoverId, setExpandedHoverId] = useState<string | null>(null);
  const [lensPanelOpen, setLensPanelOpen] = useState(false);
  const [activeLenses, setActiveLenses] = useState<Set<MapLens>>(() => new Set());
  const [screenFilters, setScreenFilters] = useState<MarketScreen>(defaultMarketScreen);
  const dragRef = useRef<{
    pointerId: number;
    start: MapPoint;
    center: MapPoint;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const hoverOpenRef = useRef<number | null>(null);
  const hoverClearRef = useRef<number | null>(null);
  const activeId = hoveredId ?? pinnedId;
  const previewCountry = marketCountries.find((country) => country.id === hoveredId) ?? null;
  const selectedCountry = marketCountries.find((country) => country.id === pinnedId) ?? previewCountry;
  const previewShape = previewCountry
    ? worldCountries.find((country) => country.name === previewCountry.atlasName)
    : null;
  const portfolioTotal = totalValueNok(holdings);

  const [viewWidth, viewHeight] = mapViewSize(zoom);
  const viewX = Math.max(0, Math.min(900 - viewWidth, center[0] - viewWidth / 2));
  const viewY = Math.max(0, Math.min(460 - viewHeight, center[1] - viewHeight / 2));
  const previewCentroid = previewShape?.centroid ?? [450, 230];
  const previewLeft = Math.max(4, Math.min(96, (previewCentroid[0] - viewX) / viewWidth * 100));
  const previewTop = Math.max(8, Math.min(92, (previewCentroid[1] - viewY) / viewHeight * 100));
  const previewSide = previewLeft > 64 ? "left" : "right";
  const previewVertical = previewTop < 28 ? "below" : previewTop > 72 ? "above" : "middle";
  const previewScale = zoom >= 3.1 ? "micro" : zoom >= 2 ? "compact" : "standard";

  useEffect(() => {
    return () => {
      if (hoverOpenRef.current !== null) window.clearTimeout(hoverOpenRef.current);
      if (hoverClearRef.current !== null) window.clearTimeout(hoverClearRef.current);
    };
  }, []);

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
    }, 1_000);
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
    const shape = worldCountries.find((item) => item.name === country.atlasName);
    setPinnedId(country.id);
    setHoveredId(null);
    setQuery(country.name);
    const nextZoom = Math.max(zoom, 2.35);
    if (shape) setCenter(clampMapCenter(shape.centroid as MapPoint, nextZoom));
    setZoom(nextZoom);
  }

  function resetMap() {
    setPinnedId("norway");
    setHoveredId(null);
    setZoom(DEFAULT_ZOOM);
    setCenter(DEFAULT_CENTER);
    setQuery("");
    setExpandedHoverId(null);
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
    const bounds = event.currentTarget.getBoundingClientRect();
    setCenter(panMapCenter(drag.center, zoom, delta, [bounds.width, bounds.height]));
  }

  function endPan(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClickRef.current = drag.moved;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.requestAnimationFrame(() => {
      suppressClickRef.current = false;
    });
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerRatio: MapPoint = [
      (event.clientX - bounds.left) / Math.max(bounds.width, 1),
      (event.clientY - bounds.top) / Math.max(bounds.height, 1),
    ];
    changeZoom(zoom * (event.deltaY < 0 ? 1.16 : 0.86), pointerRatio);
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
    if (activeLenses.has("energy") && !energyMarkets.has(market.id)) return false;
    if (activeLenses.has("trillion") && !trillionEconomies.has(market.id)) return false;
    const analytics = marketAnalytics[market.id];
    if (!analytics) return !Object.values(screenFilters).some((filter) => filter.enabled);
    if (screenFilters.maxPe.enabled && analytics.pe > screenFilters.maxPe.value) return false;
    if (screenFilters.minSharpe.enabled && analytics.sharpe < screenFilters.minSharpe.value) return false;
    if (screenFilters.maxDebt.enabled && analytics.debtToGdp > screenFilters.maxDebt.value) return false;
    if (screenFilters.minSolvency.enabled && analytics.solvency < screenFilters.minSolvency.value) return false;
    if (screenFilters.minFcfYield.enabled && analytics.fcfYield < screenFilters.minFcfYield.value) return false;
    if (screenFilters.minGrowth.enabled && analytics.earningsGrowth < screenFilters.minGrowth.value) return false;
    return true;
  }

  const suggestions = query
    ? marketCountries.filter((country) => country.name.toLowerCase().includes(query.toLowerCase()) && country.name !== query)
    : [];
  const activeExposure = selectedCountry && portfolioTotal
    ? holdings.filter((holding) => holding.country === selectedCountry.name)
      .reduce((sum, holding) => sum + holdingValueNok(holding), 0) / portfolioTotal * 100
    : 0;
  const selectedResearch = selectedCountry ? marketResearch[selectedCountry.id] : null;
  const selectedAnalytics = selectedCountry ? marketAnalytics[selectedCountry.id] : null;
  const previewResearch = previewCountry ? marketResearch[previewCountry.id] : null;
  const previewAnalytics = previewCountry ? marketAnalytics[previewCountry.id] : null;
  const activeScreenCount = Object.values(screenFilters).filter((filter) => filter.enabled).length;
  const matchingMarketCount = marketCountries.filter(marketPassesFilters).length;
  const shortcuts = ["norway", "netherlands", "united-states", "south-africa"]
    .map((id) => marketCountries.find((country) => country.id === id))
    .filter((country): country is MarketCountry => Boolean(country));

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
        <div className="map-market-shortcuts" aria-label="Market shortcuts">
          {shortcuts.map((country) => (
            <button key={country.id} type="button" onClick={() => selectCountry(country)}>
              {country.name}
            </button>
          ))}
        </div>
      </section>

      <section className="panel wide map-panel">
        <div className="world-map-shell" onMouseLeave={clearPreviewSoon}>
          <svg
            className={`world-map${dragging ? " dragging" : ""}`}
            viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
            role="img"
            aria-label={`Global securities map with ${marketCountries.length} researched markets`}
            onPointerDown={beginPan}
            onPointerMove={continuePan}
            onPointerUp={endPan}
            onPointerCancel={endPan}
            onWheel={handleWheel}
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
                <header><span>Market screener</span><strong>{activeLenses.size + activeScreenCount || "All"}</strong></header>
                <div className="map-screen-summary"><strong>{matchingMarketCount} of {marketCountries.length}</strong><span>researched markets match</span></div>
                <section className="map-lens-section">
                  <h4>Map overlays</h4>
                  <div className="map-overlay-grid">
                    <label><input type="checkbox" checked={activeLenses.has("rates")} onChange={() => toggleLens("rates")} /><span><strong>Central banks</strong><small>Policy-rate anchors</small></span></label>
                    <label><input type="checkbox" checked={activeLenses.has("energy")} onChange={() => toggleLens("energy")} /><span><strong>Oil &amp; gas</strong><small>Producer exposure</small></span></label>
                    <label><input type="checkbox" checked={activeLenses.has("trillion")} onChange={() => toggleLens("trillion")} /><span><strong>GDP above $1tn</strong><small>Economic scale</small></span></label>
                    <label><input type="checkbox" checked={activeLenses.has("blue-banana")} onChange={() => toggleLens("blue-banana")} /><span><strong>Blue Banana</strong><small>European corridor</small></span></label>
                  </div>
                </section>
                <section className="map-lens-section analytical-screen">
                  <div className="map-lens-section-heading"><h4>Analytical filters</h4><span>Indicative screen</span></div>
                  <ScreenerControl label="Index P/E" description="Maximum valuation multiple" suffix="x" min={6} max={35} step={1} filter={screenFilters.maxPe} onChange={(next) => updateScreenFilter("maxPe", next)} />
                  <ScreenerControl label="Sharpe ratio" description="Minimum risk-adjusted return" min={-0.5} max={2} step={0.1} decimals={1} filter={screenFilters.minSharpe} onChange={(next) => updateScreenFilter("minSharpe", next)} />
                  <ScreenerControl label="Government debt" description="Maximum debt / GDP" suffix="%" min={20} max={250} step={5} filter={screenFilters.maxDebt} onChange={(next) => updateScreenFilter("maxDebt", next)} />
                  <ScreenerControl label="Solvency score" description="Minimum fiscal and market resilience" suffix="/100" min={20} max={95} step={5} filter={screenFilters.minSolvency} onChange={(next) => updateScreenFilter("minSolvency", next)} />
                  <ScreenerControl label="Free-cash-flow yield" description="Minimum index-level cash yield" suffix="%" min={0} max={12} step={0.5} decimals={1} filter={screenFilters.minFcfYield} onChange={(next) => updateScreenFilter("minFcfYield", next)} />
                  <ScreenerControl label="Earnings growth" description="Minimum forward growth screen" suffix="%" min={-5} max={20} step={1} filter={screenFilters.minGrowth} onChange={(next) => updateScreenFilter("minGrowth", next)} />
                </section>
                <p className="map-screen-note">Analytical values are comparative model inputs, not live quotes. Use Market Monitor for calculated delayed index history.</p>
                <button type="button" onClick={() => { setActiveLenses(new Set()); setScreenFilters(defaultMarketScreen); }}>Reset all filters</button>
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
          {selectedAnalytics ? (
            <div className="market-analytics-grid" aria-label={`${selectedCountry.name} analytical screen`}>
              <AnalyticalMetric label="Index P/E" value={`${selectedAnalytics.pe.toFixed(1)}x`} />
              <AnalyticalMetric label="Sharpe" value={selectedAnalytics.sharpe.toFixed(2)} />
              <AnalyticalMetric label="Debt / GDP" value={`${selectedAnalytics.debtToGdp.toFixed(0)}%`} />
              <AnalyticalMetric label="Solvency" value={`${selectedAnalytics.solvency}/100`} />
              <AnalyticalMetric label="FCF yield" value={`${selectedAnalytics.fcfYield.toFixed(1)}%`} />
              <AnalyticalMetric label="Earnings growth" value={`${selectedAnalytics.earningsGrowth.toFixed(1)}%`} />
              <AnalyticalMetric label="Return on equity" value={`${selectedAnalytics.roe.toFixed(1)}%`} />
            </div>
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
