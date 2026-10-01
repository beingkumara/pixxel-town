import type { Rect } from '../../lib/world/labels'

/**
 * Sizes a canvas's backing store to its displayed size × devicePixelRatio and maps drawing
 * to map coordinates for the `view` window, so in-map text rasterises crisply at any size.
 */
export function fitCanvas(ctx: CanvasRenderingContext2D, view: Rect): void {
  const canvas = ctx.canvas
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round((canvas.clientWidth || view.w) * dpr))
  const h = Math.max(1, Math.round((canvas.clientHeight || (canvas.clientWidth * view.h) / view.w || view.h) * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const sx = w / view.w
  const sy = h / view.h
  ctx.setTransform(sx, 0, 0, sy, -view.x * sx, -view.y * sy)
  ctx.imageSmoothingEnabled = false
}
