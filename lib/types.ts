export type DisplayCurrency = "NOK" | "EUR";
export type AssetType = "stock" | "etf" | "bond" | "cash";
export type PriceStatus = "live" | "delayed" | "manual" | "estimated" | "stale" | "unavailable";
export type TransactionType =
  | "opening_balance"
  | "buy"
  | "sell"
  | "deposit"
  | "withdrawal"
  | "dividend"
  | "fee"
  | "split";
export type InsightKind = "fact" | "risk" | "event" | "review";
export type InsightSeverity = "info" | "attention" | "positive";
export type ThesisStatus = "watch" | "buy" | "hold" | "sell" | "sold";
export type TargetCategory = "asset_type" | "region" | "sector" | "currency" | "cash";

export type FactorKey =
  | "globalEquity"
  | "usEquity"
  | "europeEquity"
  | "technology"
  | "industrials"
  | "defense"
  | "usdNok"
  | "nokEur"
  | "rates"
  | "credit"
  | "cash";

export type FactorExposures = Partial<Record<FactorKey, number>>;
export type Scenario = Record<FactorKey, number>;

export type DataProvenance = {
  source: string;
  source_url?: string | null;
  as_of: string | null;
  status: PriceStatus;
  note?: string | null;
};

export type Holding = {
  id: string;
  user_id?: string;
  instrument_id?: string | null;
  asset_type: AssetType;
  ticker: string | null;
  isin?: string | null;
  figi?: string | null;
  exchange?: string | null;
  name: string;
  quantity: number;
  average_cost: number;
  market_price: number | null;
  currency: string;
  country: string | null;
  sector: string | null;
  region: string | null;
  account_note: string | null;
  manual_value_nok: number | null;
  factor_exposures: FactorExposures;
  issuer: string | null;
  coupon_rate: number | null;
  maturity_date: string | null;
  face_value: number | null;
  yield_estimate: number | null;
  duration_estimate: number | null;
  credit_quality: string | null;
  seniority: string | null;
  price_provenance: DataProvenance;
  created_at?: string;
  updated_at?: string;
};

export type Transaction = {
  id: string;
  user_id?: string;
  holding_id: string | null;
  type: TransactionType;
  occurred_at: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
  fee: number;
  currency: string;
  fx_to_nok: number;
  split_ratio: number | null;
  note: string | null;
  created_at?: string;
};

export type LedgerPosition = {
  holding: Holding;
  quantity: number;
  averageCost: number;
  costNok: number;
  marketValueNok: number;
  unrealizedGainNok: number;
  realizedGainNok: number;
};

export type PortfolioSnapshot = {
  id: string;
  user_id?: string;
  snapshot_date: string;
  total_value_nok: number;
  external_flow_nok: number;
  source: "calculated" | "legacy_estimate";
  created_at?: string;
};

export type HoldingDecision = {
  id: string;
  user_id?: string;
  holding_id: string;
  status: ThesisStatus;
  thesis: string;
  reason_for_ownership: string;
  return_drivers: string;
  risks: string;
  conviction: number;
  review_date: string | null;
  note: string | null;
  recorded_at: string;
};

export type MarketEvent = {
  id: string;
  user_id?: string;
  holding_id: string | null;
  title: string;
  event_type: "filing" | "earnings" | "macro" | "review";
  event_date: string;
  source: string;
  source_url: string | null;
  status: "upcoming" | "new" | "reviewed";
};

export type Insight = {
  id: string;
  kind: InsightKind;
  severity: InsightSeverity;
  title: string;
  fact: string;
  relevance: string;
  scenario: string;
  source: string;
  source_url: string | null;
  as_of: string;
  holding_ids: string[];
};

export type DailyBrief = {
  id: string;
  brief_date: string;
  title: string;
  summary: string;
  insights: Insight[];
  generated_at: string;
};

export type ScenarioPreset = {
  id: string;
  name: string;
  description: string;
  shocks: Scenario;
};

export type SavedScenario = {
  id: string;
  name: string;
  shocks: Scenario;
  created_at: string;
};

export type ShareOptions = {
  includeHoldings: boolean;
  includeValues: boolean;
  includeCommentary: boolean;
  expiresInDays: number;
};

export type ShareSnapshotPayload = {
  title: string;
  kind: "insight" | "scenario";
  createdAt: string;
  expiresAt: string;
  options: ShareOptions;
  content: Record<string, unknown>;
};

export type AllocationTarget = {
  id: string;
  user_id?: string;
  category: TargetCategory;
  label: string;
  min_percent: number;
  target_percent: number;
  max_percent: number;
};
