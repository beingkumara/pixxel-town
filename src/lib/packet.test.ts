import { describe, expect, test } from 'vitest'
import { parsePacket } from './packet'

describe('parsePacket', () => {
  test('accepts a valid position packet', () => {
    const data = { t: 'pos', uid: 'ana-1a2b', name: 'Ana', avatar: 3, x: 100, y: 200, dir: 'left', zone: 'cafe' }
    expect(parsePacket(data)).toEqual(data)
  })

  test('accepts a position packet outside any zone', () => {
    const data = { t: 'pos', uid: 'a', name: 'A', avatar: 0, x: 1, y: 2, dir: 'up', zone: null }
    expect(parsePacket(data)?.t).toBe('pos')
  })

  test('rejects non-finite coordinates', () => {
    expect(parsePacket({ t: 'pos', uid: 'a', name: 'A', avatar: 0, x: NaN, y: 2, dir: 'up', zone: null })).toBeNull()
  })

  test('rejects unknown directions and packet types', () => {
    expect(parsePacket({ t: 'pos', uid: 'a', name: 'A', avatar: 0, x: 1, y: 2, dir: 'sideways', zone: null })).toBeNull()
    expect(parsePacket({ t: 'nope' })).toBeNull()
    expect(parsePacket(null)).toBeNull()
    expect(parsePacket('pos')).toBeNull()
  })

  test('truncates overly long names', () => {
    const parsed = parsePacket({ t: 'pos', uid: 'a', name: 'x'.repeat(200), avatar: 0, x: 1, y: 2, dir: 'up', zone: null })
    expect(parsed && parsed.t === 'pos' && parsed.name.length).toBe(16)
  })

  test('accepts only whitelisted emotes', () => {
    expect(parsePacket({ t: 'emote', uid: 'a', emoji: '👋' })).toEqual({ t: 'emote', uid: 'a', emoji: '👋' })
    expect(parsePacket({ t: 'emote', uid: 'a', emoji: '<script>' })).toBeNull()
  })

  test('accepts hello and bye packets', () => {
    expect(parsePacket({ t: 'hello', uid: 'a' })).toEqual({ t: 'hello', uid: 'a' })
    expect(parsePacket({ t: 'bye', uid: 'a' })).toEqual({ t: 'bye', uid: 'a' })
  })

  test('rejects prototype-polluting uids', () => {
    for (const uid of ['__proto__', 'constructor', 'prototype']) {
      expect(parsePacket({ t: 'hello', uid })).toBeNull()
    }
  })

  test('rejects coordinates outside the map', () => {
    const base = { t: 'pos', uid: 'a', name: 'A', avatar: 0, dir: 'up', zone: null }
    expect(parsePacket({ ...base, x: 1e308, y: 10 })).toBeNull()
    expect(parsePacket({ ...base, x: -5, y: 10 })).toBeNull()
    expect(parsePacket({ ...base, x: 10, y: 99999 })).toBeNull()
  })

  test('strips control and bidi characters from names', () => {
    const parsed = parsePacket({ t: 'pos', uid: 'a', name: 'Ev\u202Ee\u200Bil\u0007', avatar: 0, x: 1, y: 2, dir: 'up', zone: null })
    expect(parsed && parsed.t === 'pos' && parsed.name).toBe('Eveil')
  })

  test('rejects names that are only invisible characters', () => {
    expect(parsePacket({ t: 'pos', uid: 'a', name: '\u200B\u202E', avatar: 0, x: 1, y: 2, dir: 'up', zone: null })).toBeNull()
  })

  test('does not split emoji when truncating names', () => {
    const parsed = parsePacket({ t: 'pos', uid: 'a', name: 'a'.repeat(15) + '😀😀', avatar: 0, x: 1, y: 2, dir: 'up', zone: null })
    expect(parsed && parsed.t === 'pos' && parsed.name).toBe('a'.repeat(15) + '😀')
  })
})
