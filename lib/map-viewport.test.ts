import { describe, expect, it } from "vitest";
import { clampMapCenter, mapViewSize, panMapCenter, zoomMapAt } from "@/lib/map-viewport";

describe("map viewport", () => {
  it("clamps the viewport inside the projected map", () => {
    expect(clampMapCenter([-100, 900], 2)).toEqual([225, 345]);
  });

  it("converts drag distance from rendered pixels into map coordinates", () => {
    expect(panMapCenter([450, 230], 2, [100, -50], [900, 460]))
      .toEqual([400, 255]);
  });

  it("keeps the geographic point under the pointer stable while zooming", () => {
    const result = zoomMapAt([450, 230], 1, 2, [0.75, 0.25]);
    expect(result.zoom).toBe(2);
    expect(result.center).toEqual([562.5, 172.5]);
    expect(mapViewSize(result.zoom)).toEqual([450, 230]);
  });
});
