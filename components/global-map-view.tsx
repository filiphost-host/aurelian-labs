"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import { Building2, Crosshair, Factory, Landmark, Minus, Plus, Search } from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
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
};

const countryCollection = feature<{ name: string }>(
  worldAtlas as never,
  "countries",
) as unknown as FeatureCollection<Geometry, { name: string }>;
const projection = geoNaturalEarth1().fitExtent([[12, -18], [888, 478]], { type: "Sphere" });
const mapPath = geoPath(projection);
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
  const dragRef = useRef<{
    pointerId: number;
    start: MapPoint;
    center: MapPoint;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
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
  const calloutX = previewCentroid[0] > 540 ? previewCentroid[0] - 270 : previewCentroid[0] + 28;
  const calloutY = Math.max(18, previewCentroid[1] - 80);

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

  const suggestions = query
    ? marketCountries.filter((country) => country.name.toLowerCase().includes(query.toLowerCase()) && country.name !== query)
    : [];
  const activeExposure = selectedCountry && portfolioTotal
    ? holdings.filter((holding) => holding.country === selectedCountry.name)
      .reduce((sum, holding) => sum + holdingValueNok(holding), 0) / portfolioTotal * 100
    : 0;
  const selectedResearch = selectedCountry ? marketResearch[selectedCountry.id] : null;
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
        <div className="world-map-shell" onMouseLeave={() => setHoveredId(null)}>
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
                  onClick={() => {
                    if (!suppressClickRef.current) selectCountry(market);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") selectCountry(market);
                  }}
                >
                  <path className={`map-land market-country${active ? " active" : ""}${pinnedId === market.id ? " pinned" : ""}`} d={country.path} />
                  <circle className="market-hit-target" cx={country.centroid[0]} cy={country.centroid[1]} r={isNordic ? 13 : 8} />
                  <circle className={`market-pulse${active ? " active" : ""}`} cx={country.centroid[0]} cy={country.centroid[1]} r={isNordic ? 4.5 : 3.5} />
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
            <button type="button" aria-label="Zoom in" onClick={() => changeZoom(zoom * 1.28)}><Plus size={16} /></button>
            <button type="button" aria-label="Zoom out" onClick={() => changeZoom(zoom / 1.28)}><Minus size={16} /></button>
            <button type="button" aria-label="Reset map" onClick={resetMap}><Crosshair size={16} /></button>
          </div>
          <div className="map-coverage-status"><Landmark size={14} /> {marketCountries.length} researched markets</div>
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
            Annual macro series and event-driven market observations are shown separately. Missing values are not treated as zero.
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
