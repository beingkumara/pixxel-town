import { describe, expect, test } from 'vitest'
import { SPAWN, TILE } from './map'
import { directionFor, interpolate, step } from './movement'

describe('step', () => {
  test('does not move without input', () => {
    const next = step(SPAWN, { dx: 0, dy: 0 }, 16)
    expect(next).toEqual(SPAWN)
  })

  test('moves right with positive dx and returns a new object', () => {
    const next = step(SPAWN, { dx: 1, dy: 0 }, 100)
    expect(next.x).toBeGreaterThan(SPAWN.x)
    expect(next.y).toBe(SPAWN.y)
    expect(next).not.toBe(SPAWN)
  })

  test('diagonal movement is normalised to the same speed', () => {
    const straight = step(SPAWN, { dx: 1, dy: 0 }, 100)
    const diagonal = step(SPAWN, { dx: 1, dy: 1 }, 100)
    const straightDist = straight.x - SPAWN.x
    const diagDist = Math.hypot(diagonal.x - SPAWN.x, diagonal.y - SPAWN.y)
    expect(diagDist).toBeCloseTo(straightDist, 5)
  })

  test('is blocked by walls', () => {
    const nearTopWall = { x: SPAWN.x, y: TILE * 1.5 }
    const next = step(nearTopWall, { dx: 0, dy: -1 }, 2000)
    expect(next.y).toBeGreaterThanOrEqual(TILE)
  })

  test('clamps huge frame deltas so players cannot tunnel through walls', () => {
    const next = step(SPAWN, { dx: 1, dy: 0 }, 60_000)
    expect(next.x - SPAWN.x).toBeLessThan(TILE)
  })
})

describe('interpolate', () => {
  test('moves a fraction of the way to the target', () => {
    const next = interpolate({ x: 0, y: 0 }, { x: 100, y: 0 }, 0.5)
    expect(next).toEqual({ x: 50, y: 0 })
  })

  test('snaps when the target is too far away (teleport)', () => {
    const next = interpolate({ x: 0, y: 0 }, { x: 5000, y: 0 }, 0.1)
    expect(next).toEqual({ x: 5000, y: 0 })
  })
})

describe('directionFor', () => {
  test('keeps the previous direction when idle', () => {
    expect(directionFor({ dx: 0, dy: 0 }, 'left')).toBe('left')
  })

  test('prefers horizontal direction', () => {
    expect(directionFor({ dx: 1, dy: 1 }, 'down')).toBe('right')
    expect(directionFor({ dx: 0, dy: -1 }, 'down')).toBe('up')
  })
})
