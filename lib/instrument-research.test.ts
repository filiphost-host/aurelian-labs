import { describe, expect, it } from "vitest";
import { annualizedSharpeFromCloses, inferFactorExposures, recessionRiskScore } from "./instrument-research";

describe("instrument research", () => {
  it("calculates an annualized Sharpe ratio from weekly closes", () => {
    const closes = Array.from({ length: 53 }, (_, index) => 100 * (1.006 ** index) * (1 + Math.sin(index) * 0.01));
    expect(annualizedSharpeFromCloses(closes)).toBeGreaterThan(0);
  });

  it("requires enough observations for Sharpe", () => {
    expect(annualizedSharpeFromCloses([100, 101, 102])).toBeNull();
  });

  it("scores defensive assets below cyclical high-beta assets", () => {
    const defensive = recessionRiskScore({ assetType: "stock", sector: "Consumer Staples", beta: 0.55, operatingMargin: 0.28 });
    const cyclical = recessionRiskScore({ assetType: "stock", sector: "Consumer Discretionary", beta: 1.7, operatingMargin: 0.05 });
    expect(defensive).toBeLessThan(cyclical);
    expect(cyclical).toBeLessThanOrEqual(100);
  });

  it("infers regional, sector, and currency factors", () => {
    expect(inferFactorExposures({ assetType: "stock", country: "United States", sector: "Technology", currency: "USD" }))
      .toMatchObject({ usEquity: 0.8, technology: 1, usdNok: 1 });
  });
});
