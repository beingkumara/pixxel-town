import { describe, expect, test } from 'vitest'
import { findNearest, keepPartner } from './proximity'

const me = { x: 0, y: 0 }
const players = [
  { uid: 'far', x: 500, y: 0 },
  { uid: 'near', x: 40, y: 30 },
  { uid: 'mid', x: 80, y: 0 },
]

describe('findNearest', () => {
  test('returns the closest player within radius', () => {
    expect(findNearest(me, players, 100)?.uid).toBe('near')
  })

  test('returns null when nobody is within radius', () => {
    expect(findNearest(me, players, 20)).toBeNull()
  })

  test('returns null for an empty list', () => {
    expect(findNearest(me, [], 100)).toBeNull()
  })
})

describe('keepPartner', () => {
  test('keeps a partner inside radius plus hysteresis', () => {
    expect(keepPartner(me, { x: 110, y: 0 }, 100, 20)).toBe(true)
  })

  test('drops a partner beyond radius plus hysteresis', () => {
    expect(keepPartner(me, { x: 130, y: 0 }, 100, 20)).toBe(false)
  })
})
