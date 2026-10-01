import { describe, expect, test } from 'vitest'
import { createRateLimiter } from './rateLimit'

describe('createRateLimiter', () => {
  test('allows a burst up to capacity, then blocks', () => {
    const allow = createRateLimiter(3, 1)
    expect([allow('a', 0), allow('a', 0), allow('a', 0), allow('a', 0)]).toEqual([true, true, true, false])
  })

  test('refills over time', () => {
    const allow = createRateLimiter(1, 10)
    expect(allow('a', 0)).toBe(true)
    expect(allow('a', 50)).toBe(false)
    expect(allow('a', 150)).toBe(true)
  })

  test('tracks each key separately', () => {
    const allow = createRateLimiter(1, 1)
    expect(allow('a', 0)).toBe(true)
    expect(allow('b', 0)).toBe(true)
    expect(allow('a', 0)).toBe(false)
  })
})
