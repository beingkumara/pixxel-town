import { DIRECTIONS, type Direction } from './world/movement'
import { MAP_H, MAP_W, TILE, ZONE_IDS } from './world/map'

/**
 * Packets are sent as CometChat transient messages to the world group.
 * They're never persisted, so they're ideal for high-frequency avatar state.
 * Everything arriving here is untrusted, so it's validated field by field.
 */

export const EMOTES = ['👋', '❤️', '😂', '🎉', '🔥'] as const
export type Emote = (typeof EMOTES)[number]

export const AVATAR_COUNT = 6
export const MAX_NAME_LENGTH = 16

export interface PosPacket {
  readonly t: 'pos'
  readonly uid: string
  readonly name: string
  readonly avatar: number
  readonly x: number
  readonly y: number
  readonly dir: Direction
  readonly zone: string | null
}

export interface EmotePacket {
  readonly t: 'emote'
  readonly uid: string
  readonly emoji: Emote
}

/** Sent on arrival so everyone re-broadcasts their position immediately. */
export interface HelloPacket {
  readonly t: 'hello'
  readonly uid: string
}

export interface ByePacket {
  readonly t: 'bye'
  readonly uid: string
}

export type Packet = PosPacket | EmotePacket | HelloPacket | ByePacket

const UID_RE = /^[A-Za-z0-9_-]{1,64}$/

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Keys that would resolve to Object.prototype members when used as record keys. */
const RESERVED_UIDS = new Set(['__proto__', 'constructor', 'prototype'])

const isUid = (v: unknown): v is string => typeof v === 'string' && UID_RE.test(v) && !RESERVED_UIDS.has(v)

const inRange = (v: unknown, max: number): v is number => typeof v === 'number' && v >= 0 && v <= max

/** Strips control, format (bidi overrides, zero-width) and other invisible code points, then caps by code point. */
export function sanitizeName(raw: string): string {
  const visible = raw.replace(/[\p{C}]/gu, '').trim()
  return Array.from(visible).slice(0, MAX_NAME_LENGTH).join('')
}

function parsePos(d: Record<string, unknown>, uid: string): PosPacket | null {
  const { avatar, x, y, dir, zone } = d
  const name = typeof d.name === 'string' ? sanitizeName(d.name) : ''
  if (name === '') return null
  if (!Number.isInteger(avatar) || (avatar as number) < 0 || (avatar as number) >= AVATAR_COUNT) return null
  if (!inRange(x, MAP_W * TILE) || !inRange(y, MAP_H * TILE)) return null
  if (!DIRECTIONS.includes(dir as Direction)) return null
  if (zone !== null && !(typeof zone === 'string' && ZONE_IDS.has(zone))) return null
  return {
    t: 'pos',
    uid,
    name,
    avatar: avatar as number,
    x,
    y,
    dir: dir as Direction,
    zone: zone as string | null,
  }
}

export function parsePacket(data: unknown): Packet | null {
  if (!isRecord(data) || !isUid(data.uid)) return null
  const uid = data.uid
  switch (data.t) {
    case 'pos':
      return parsePos(data, uid)
    case 'emote':
      return EMOTES.includes(data.emoji as Emote) ? { t: 'emote', uid, emoji: data.emoji as Emote } : null
    case 'hello':
      return { t: 'hello', uid }
    case 'bye':
      return { t: 'bye', uid }
    default:
      return null
  }
}
