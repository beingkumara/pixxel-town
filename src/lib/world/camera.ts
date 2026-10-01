import type { Rect } from './labels'

/** Below this displayed width (CSS px) the town is shown through a camera, not shrunk whole. */
export const CAMERA_BREAKPOINT = 640
/** Camera zoom: CSS px per map pixel. 1 keeps the pixel art and in-map text at native size. */
export const CAMERA_ZOOM = 1

/**
 * The window of the map to draw. Wide displays see the whole map; narrow ones get a
 * window of `display / zoom` map pixels centred on `focus` and clamped to the map edges.
 */
export function cameraView(
  focus: { x: number; y: number },
  display: { w: number; h: number },
  map: { w: number; h: number },
): Rect {
  if (display.w <= 0 || display.h <= 0 || display.w >= CAMERA_BREAKPOINT) return { x: 0, y: 0, w: map.w, h: map.h }
  const w = Math.min(map.w, display.w / CAMERA_ZOOM)
  const h = Math.min(map.h, display.h / CAMERA_ZOOM)
  const x = Math.min(Math.max(focus.x - w / 2, 0), map.w - w)
  const y = Math.min(Math.max(focus.y - h / 2, 0), map.h - h)
  return { x: Math.round(x), y: Math.round(y), w, h }
}
