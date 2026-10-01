import { TILE, canOccupy, type Point } from './map'

export type Direction = 'up' | 'down' | 'left' | 'right'

export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right']

export interface MoveInput {
  readonly dx: number
  readonly dy: number
}

/** Walking speed in pixels per second. */
export const SPEED = 150
/** Frame deltas above this are clamped so a stalled tab can't tunnel through walls. */
const MAX_DT_MS = 100
/** Remote players further than this from their target snap instead of gliding. */
const TELEPORT_DISTANCE = TILE * 8

export function step(pos: Point, input: MoveInput, dtMs: number): Point {
  if (input.dx === 0 && input.dy === 0) return pos

  const len = Math.hypot(input.dx, input.dy)
  const dist = (SPEED * Math.min(dtMs, MAX_DT_MS)) / 1000
  const vx = (input.dx / len) * dist
  const vy = (input.dy / len) * dist

  // Resolve each axis separately so players slide along walls.
  const x = canOccupy(pos.x + vx, pos.y) ? pos.x + vx : pos.x
  const y = canOccupy(x, pos.y + vy) ? pos.y + vy : pos.y
  return { x, y }
}

export function interpolate(current: Point, target: Point, alpha: number): Point {
  const dx = target.x - current.x
  const dy = target.y - current.y
  if (Math.hypot(dx, dy) > TELEPORT_DISTANCE) return { x: target.x, y: target.y }
  return { x: current.x + dx * alpha, y: current.y + dy * alpha }
}

export function directionFor(input: MoveInput, previous: Direction): Direction {
  if (input.dx > 0) return 'right'
  if (input.dx < 0) return 'left'
  if (input.dy > 0) return 'down'
  if (input.dy < 0) return 'up'
  return previous
}
