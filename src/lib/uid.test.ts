import { describe, expect, test } from 'vitest'
import { makeUid, validateName } from './uid'

describe('validateName', () => {
  test('trims and accepts normal names', () => {
    expect(validateName('  Ana  ')).toEqual({ ok: true, name: 'Ana' })
  })

  test('rejects empty and too-long names', () => {
    expect(validateName('   ').ok).toBe(false)
    expect(validateName('x'.repeat(17)).ok).toBe(false)
  })
})

describe('makeUid', () => {
  test('produces a CometChat-safe uid with a random suffix', () => {
    const uid = makeUid('Ana María!', () => 0.5)
    expect(uid).toMatch(/^[a-z0-9_-]+$/)
    expect(uid.startsWith('pt-ana-mar')).toBe(true)
  })

  test('falls back when the name has no safe characters', () => {
    expect(makeUid('🙂🙂', () => 0.1)).toMatch(/^pt-player-[a-z0-9]+$/)
  })

  test('different random sources give different uids', () => {
    expect(makeUid('ana', () => 0.1)).not.toBe(makeUid('ana', () => 0.9))
  })
})
