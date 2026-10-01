import { AVATAR_COUNT } from './packet'
import { makeUid, validateName } from './uid'

export interface StoredProfile {
  readonly uid: string
  readonly name: string
  readonly avatar: number
}

const KEY = 'pixel-town:profile'

/** Remembered per browser so a reload keeps the same CometChat user. Storage may be unavailable. */
export function loadProfile(): StoredProfile | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const { uid, name, avatar } = data as Record<string, unknown>
    if (typeof uid !== 'string' || !/^pt-[a-z0-9_-]+$/.test(uid)) return null
    if (typeof name !== 'string' || !validateName(name).ok) return null
    if (!Number.isInteger(avatar) || (avatar as number) < 0 || (avatar as number) >= AVATAR_COUNT) return null
    return { uid, name, avatar: avatar as number }
  } catch {
    return null
  }
}

export function saveProfile(profile: StoredProfile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile))
  } catch {
    // Private mode or blocked storage: the profile just won't persist.
  }
}

/**
 * Reuse the stored uid when the name hasn't changed; otherwise mint a new one.
 * Separate windows can force a fresh identity with ?fresh=1 (handy for demos).
 */
export function resolveProfile(name: string, avatar: number, stored: StoredProfile | null, fresh: boolean): StoredProfile {
  const uid = !fresh && stored && stored.name === name ? stored.uid : makeUid(name)
  return { uid, name, avatar }
}
