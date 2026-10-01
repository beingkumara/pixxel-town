/** Collision-free placement for text drawn inside the world canvas. */

export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface Bounds {
  readonly w: number
  readonly h: number
}

/** Breathing room kept between any two labels, in canvas pixels. */
export const LABEL_GAP = 3
const MAX_LEVELS = 12
/** Sideways nudges tried at each level, as fractions of the label width. */
const SIDE_STEPS = [0, -0.6, 0.6, -1.2, 1.2] as const
/** A sideways nudge of 0.6× width costs as much as 1.5 levels of stacking. */
const SIDE_COST = 2.5

/** Dropping below the desired spot (level < 0) costs more than stacking above it. */
const DOWN_COST = 1.5

const cost = ({ level, side }: { level: number; side: number }) =>
  (level < 0 ? -level * DOWN_COST : level) + Math.abs(side) * SIDE_COST

/** Offsets ordered nearest-first: stacking upward is cheapest, then sliding sideways, then dropping. */
const CANDIDATES = Array.from({ length: MAX_LEVELS * 2 - 1 }, (_, i) => i - MAX_LEVELS + 1)
  .flatMap((level) => SIDE_STEPS.map((side) => ({ level, side })))
  .sort((a, b) => cost(a) - cost(b))

export function overlaps(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad
}

function clampTo(r: Rect, bounds: Bounds): Rect {
  const x = Math.min(Math.max(0, r.x), Math.max(0, bounds.w - r.w))
  const y = Math.min(Math.max(0, r.y), Math.max(0, bounds.h - r.h))
  return { ...r, x: Math.round(x), y: Math.round(y) }
}

/**
 * Returns the nearest spot to `desired` that clears every rect in `taken`.
 * Stacks upward first (labels sit above their owner), then slides sideways, then drops below.
 */
export function placeLabel(desired: Rect, taken: readonly Rect[], bounds: Bounds, gap = LABEL_GAP): Rect {
  const step = desired.h + gap
  for (const { level, side } of CANDIDATES) {
    const candidate = clampTo({ ...desired, x: desired.x + side * desired.w, y: desired.y - level * step }, bounds)
    if (!taken.some((t) => overlaps(t, candidate, gap))) return candidate
  }
  return clampTo(desired, bounds)
}

/**
 * Map-units per CSS pixel: multiplying a tier size (px) by this keeps in-map text
 * at exactly that on-screen size, whatever size the canvas is displayed at.
 */
export function labelScale(canvasWidth: number, displayWidth: number): number {
  if (displayWidth <= 0) return 1
  return canvasWidth / displayWidth
}

/**
 * Like placeLabel, but for crowded small displays: returns null instead of drifting the label
 * away from what it names (more than one row up/down or more than 0.6× its width sideways).
 */
export function placeAttached(desired: Rect, taken: readonly Rect[], bounds: Bounds, gap = LABEL_GAP): Rect | null {
  const placed = placeLabel(desired, taken, bounds, gap)
  const clear = !taken.some((t) => overlaps(t, placed, gap))
  const near = Math.abs(placed.y - desired.y) <= desired.h + gap + 1 && Math.abs(placed.x - desired.x) <= desired.w * 0.6 + 1
  return clear && near ? placed : null
}

/** The first candidate rect that clears every taken rect by `gap`, or null. */
export function firstClear(candidates: readonly Rect[], taken: readonly Rect[], gap: number): Rect | null {
  return candidates.find((c) => !taken.some((t) => overlaps(t, c, gap))) ?? null
}
