import { describe, expect, it } from "vitest";

import { getCompanyResearch, researchTickers } from "./company-research";

describe("company research profiles", () => {
  it("resolves every supported ticker to its own profile", () => {
    for (const ticker of researchTickers) {
      expect(getCompanyResearch(ticker).ticker).toBe(ticker);
    }
  });

  it("keeps the selected instrument in its comparison set", () => {
    for (const ticker of researchTickers) {
      const profile = getCompanyResearch(ticker);
      expect(profile.peers.some((peer) => peer.ticker === ticker)).toBe(true);
    }
  });

  it("falls back to the primary portfolio company", () => {
    expect(getCompanyResearch("UNKNOWN").ticker).toBe("MSFT");
  });
});
