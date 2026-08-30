export type CalloutPoint = [number, number];

export function mapCalloutPlacement({
  bounds,
  centroid,
  viewX,
  viewY,
  viewWidth,
  viewHeight,
}: {
  bounds: [CalloutPoint, CalloutPoint] | null;
  centroid: CalloutPoint;
  viewX: number;
  viewY: number;
  viewWidth: number;
  viewHeight: number;
}) {
  const centroidLeft = (centroid[0] - viewX) / viewWidth * 100;
  const rawLeft = bounds ? (bounds[0][0] - viewX) / viewWidth * 100 : centroidLeft;
  const rawRight = bounds ? (bounds[1][0] - viewX) / viewWidth * 100 : centroidLeft;
  const leftRoom = Math.max(0, rawLeft);
  const rightRoom = Math.max(0, 100 - rawRight);
  const side = rightRoom === leftRoom
    ? centroidLeft > 50 ? "left" : "right"
    : rightRoom > leftRoom ? "right" : "left";
  const rawAnchor = side === "right" ? rawRight : rawLeft;
  const left = Math.max(side === "right" ? 4 : 30, Math.min(side === "right" ? 70 : 96, rawAnchor));
  const top = Math.max(8, Math.min(92, (centroid[1] - viewY) / viewHeight * 100));
  const vertical = top < 28 ? "below" : top > 72 ? "above" : "middle";

  return { left, top, side, vertical } as const;
}
