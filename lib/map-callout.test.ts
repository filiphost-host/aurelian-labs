import { describe, expect, it } from "vitest";
import { mapCalloutPlacement } from "@/lib/map-callout";

const viewport = { viewX: 0, viewY: 0, viewWidth: 900, viewHeight: 460 };

describe("Atlas callout placement", () => {
  it("anchors beyond the right edge when that side has more room", () => {
    const placement = mapCalloutPlacement({ ...viewport, bounds: [[90, 150], [310, 290]], centroid: [200, 220] });
    expect(placement.side).toBe("right");
    expect(placement.left).toBeCloseTo(34.44, 1);
  });

  it("anchors beyond the left edge for markets on the right side", () => {
    const placement = mapCalloutPlacement({ ...viewport, bounds: [[650, 130], [850, 280]], centroid: [750, 210] });
    expect(placement.side).toBe("left");
    expect(placement.left).toBeCloseTo(72.22, 1);
  });

  it("keeps the panel anchor inside the screen when zoom fills the viewport", () => {
    const placement = mapCalloutPlacement({ ...viewport, bounds: [[-180, -20], [1080, 500]], centroid: [450, 230] });
    expect(placement.left).toBeGreaterThanOrEqual(4);
    expect(placement.left).toBeLessThanOrEqual(70);
  });
});
