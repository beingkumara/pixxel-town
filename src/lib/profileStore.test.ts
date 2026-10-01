import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { loadProfile, resolveProfile, saveProfile } from './profileStore'

function fakeStorage(): Storage {
  let data: Record<string, string> = {}
  return {
    get length() {
      return Object.keys(data).length
    },
    clear: () => {
      data = {}
    },
    getItem: (k) => (k in data ? data[k] : null),
    key: (i) => Object.keys(data)[i] ?? null,
    removeItem: (k) => {
      const { [k]: _gone, ...rest } = data
      data = rest
    },
    setItem: (k, v) => {
      data = { ...data, [k]: String(v) }
    },
  }
}

describe('profileStore', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()))
  afterEach(() => vi.unstubAllGlobals())

  test('round-trips a valid profile', () => {
    const profile = { uid: 'pt-ana-1a2b', name: 'Ana', avatar: 2 }
    saveProfile(profile)
    expect(loadProfile()).toEqual(profile)
  })

  test('returns null when nothing is stored', () => {
    expect(loadProfile()).toBeNull()
  })

  test('rejects tampered or malformed data', () => {
    const bad = [
      'not json',
      JSON.stringify(null),
      JSON.stringify({ uid: 'admin', name: 'Ana', avatar: 0 }),
      JSON.stringify({ uid: 'pt-ana-1', name: '', avatar: 0 }),
      JSON.stringify({ uid: 'pt-ana-1', name: 'Ana', avatar: 99 }),
    ]
    for (const raw of bad) {
      localStorage.setItem('pixel-town:profile', raw)
      expect(loadProfile()).toBeNull()
    }
  })

  test('survives storage that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(loadProfile()).toBeNull()
    expect(() => saveProfile({ uid: 'pt-a-1', name: 'A', avatar: 0 })).not.toThrow()
  })

  test('resolveProfile reuses the uid only for the same name and non-fresh windows', () => {
    const stored = { uid: 'pt-ana-1a2b', name: 'Ana', avatar: 1 }
    expect(resolveProfile('Ana', 3, stored, false)).toEqual({ uid: 'pt-ana-1a2b', name: 'Ana', avatar: 3 })
    expect(resolveProfile('Bo', 3, stored, false).uid).not.toBe(stored.uid)
    expect(resolveProfile('Ana', 3, stored, true).uid).not.toBe(stored.uid)
    expect(resolveProfile('Ana', 0, null, false).uid).toMatch(/^pt-ana-/)
  })
})
