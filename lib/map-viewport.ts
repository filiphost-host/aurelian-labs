export type MapPoint = [number, number];

export const MAP_WIDTH = 900;
export const MAP_HEIGHT = 460;
export const MIN_MAP_ZOOM = 1;
export const MAX_MAP_ZOOM = 4.2;

export function clampMapZoom(zoom: number) {
  return Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom));
}

export function mapViewSize(zoom: number): MapPoint {
  const safeZoom = clampMapZoom(zoom);
  return [MAP_WIDTH / safeZoom, MAP_HEIGHT / safeZoom];
}

export function clampMapCenter(center: MapPoint, zoom: number): MapPoint {
  const [viewWidth, viewHeight] = mapViewSize(zoom);
  const halfWidth = viewWidth / 2;
  const halfHeight = viewHeight / 2;

  return [
    Math.max(halfWidth, Math.min(MAP_WIDTH - halfWidth, center[0])),
    Math.max(halfHeight, Math.min(MAP_HEIGHT - halfHeight, center[1])),
  ];
}

export function panMapCenter(
  startCenter: MapPoint,
  zoom: number,
  pixelDelta: MapPoint,
  renderedSize: MapPoint,
) {
  const [viewWidth, viewHeight] = mapViewSize(zoom);
  const next: MapPoint = [
    startCenter[0] - pixelDelta[0] * viewWidth / Math.max(renderedSize[0], 1),
    startCenter[1] - pixelDelta[1] * viewHeight / Math.max(renderedSize[1], 1),
  ];

  return clampMapCenter(next, zoom);
}

export function zoomMapAt(
  center: MapPoint,
  currentZoom: number,
  requestedZoom: number,
  pointerRatio: MapPoint = [0.5, 0.5],
) {
  const nextZoom = clampMapZoom(requestedZoom);
  const [currentWidth, currentHeight] = mapViewSize(currentZoom);
  const [nextWidth, nextHeight] = mapViewSize(nextZoom);
  const currentX = center[0] - currentWidth / 2;
  const currentY = center[1] - currentHeight / 2;
  const focusX = currentX + pointerRatio[0] * currentWidth;
  const focusY = currentY + pointerRatio[1] * currentHeight;
  const nextCenter: MapPoint = [
    focusX - pointerRatio[0] * nextWidth + nextWidth / 2,
    focusY - pointerRatio[1] * nextHeight + nextHeight / 2,
  ];

  return { zoom: nextZoom, center: clampMapCenter(nextCenter, nextZoom) };
}
