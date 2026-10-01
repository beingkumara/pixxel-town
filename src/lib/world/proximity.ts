import type { Point } from './map'

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)

export function findNearest<T extends Point>(me: Point, others: readonly T[], radius: number): T | null {
  let best: T | null = null
  let bestDist = radius
  for (const other of others) {
    const d = distance(me, other)
    if (d <= bestDist) {
      best = other
      bestDist = d
    }
  }
  return best
}

/** Hysteresis stops the DM panel flickering when someone hovers on the edge of the radius. */
export function keepPartner(me: Point, partner: Point, radius: number, hysteresis: number): boolean {
  return distance(me, partner) <= radius + hysteresis
}
