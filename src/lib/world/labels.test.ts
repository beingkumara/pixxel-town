import { describe, expect, test } from 'vitest'
import { firstClear, labelScale, overlaps, placeAttached, placeLabel } from './labels'

const bounds = { w: 960, h: 576 }

describe('overlaps', () => {
  test('detects intersecting rects', () => {
    expect(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true)
  })

  test('treats touching edges as clear unless padded', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 }
    const b = { x: 10, y: 0, w: 10, h: 10 }
    expect(overlaps(a, b)).toBe(false)
    expect(overlaps(a, b, 2)).toBe(true)
  })
})

describe('placeLabel', () => {
  test('keeps the desired spot when nothing is in the way', () => {
    const desired = { x: 100, y: 100, w: 40, h: 15 }
    expect(placeLabel(desired, [], bounds)).toEqual(desired)
  })

  test('moves a label so it no longer overlaps any taken rect', () => {
    const taken = [{ x: 100, y: 100, w: 40, h: 15 }]
    const placed = placeLabel({ x: 110, y: 104, w: 40, h: 15 }, taken, bounds)
    expect(taken.some((t) => overlaps(t, placed, 2))).toBe(false)
  })

  test('prefers stacking upward over sliding sideways', () => {
    const taken = [{ x: 100, y: 100, w: 40, h: 15 }]
    const placed = placeLabel({ x: 100, y: 100, w: 40, h: 15 }, taken, bounds)
    expect(placed.x).toBe(100)
    expect(placed.y).toBeLessThan(100)
  })

  test('drops below when there is no room above', () => {
    const taken = [{ x: 0, y: 0, w: 960, h: 40 }]
    const placed = placeLabel({ x: 100, y: 10, w: 40, h: 15 }, taken, bounds)
    expect(overlaps(taken[0], placed, 2)).toBe(false)
    expect(placed.y).toBeGreaterThan(40)
  })

  test('stays inside the bounds', () => {
    const placed = placeLabel({ x: -30, y: -10, w: 60, h: 15 }, [], bounds)
    expect(placed.x).toBeGreaterThanOrEqual(0)
    expect(placed.y).toBeGreaterThanOrEqual(0)
  })

  test('does not mutate the taken list or desired rect', () => {
    const desired = { x: 100, y: 100, w: 40, h: 15 }
    const taken = [{ x: 100, y: 100, w: 40, h: 15 }]
    placeLabel(desired, taken, bounds)
    expect(desired).toEqual({ x: 100, y: 100, w: 40, h: 15 })
    expect(taken).toHaveLength(1)
  })
})

describe('labelScale', () => {
  test('is 1 at native size and shrinks when the canvas is shown larger, so text keeps its tier size', () => {
    expect(labelScale(960, 960)).toBe(1)
    expect(labelScale(960, 1920)).toBe(0.5)
  })

  test('grows as the canvas is shown smaller so text keeps its on-screen size', () => {
    expect(labelScale(960, 480)).toBe(2)
  })

  test('falls back to 1 when the display size is unknown', () => {
    expect(labelScale(960, 0)).toBe(1)
  })
})

describe('placeAttached', () => {
  test('returns the label when it fits close to its spot', () => {
    const desired = { x: 100, y: 100, w: 40, h: 15 }
    expect(placeAttached(desired, [], bounds)).toEqual(desired)
  })

  test('allows one row of stacking', () => {
    const taken = [{ x: 100, y: 100, w: 40, h: 15 }]
    const placed = placeAttached({ x: 100, y: 100, w: 40, h: 15 }, taken, bounds)
    expect(placed?.y).toBe(82)
  })

  test('drops the label rather than drifting it far from its owner', () => {
    const wall = [{ x: 0, y: 40, w: 960, h: 120 }]
    expect(placeAttached({ x: 100, y: 100, w: 40, h: 15 }, wall, bounds)).toBeNull()
  })
})

describe('firstClear', () => {
  test('returns the first candidate that clears every taken rect', () => {
    const taken = [{ x: 0, y: 0, w: 50, h: 20 }]
    const a = { x: 10, y: 5, w: 20, h: 10 }
    const b = { x: 100, y: 5, w: 20, h: 10 }
    expect(firstClear([a, b], taken, 2)).toEqual(b)
  })

  test('returns null when every candidate collides', () => {
    const taken = [{ x: 0, y: 0, w: 500, h: 500 }]
    expect(firstClear([{ x: 10, y: 10, w: 5, h: 5 }], taken, 2)).toBeNull()
  })
})
