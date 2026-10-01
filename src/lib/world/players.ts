import type { PosPacket } from '../packet'
import type { Direction } from './movement'
import { interpolate } from './movement'

export interface RemotePlayer {
  readonly uid: string
  readonly name: string
  readonly avatar: number
  /** Rendered (interpolated) position. */
  readonly x: number
  readonly y: number
  /** Last position reported over the network. */
  readonly targetX: number
  readonly targetY: number
  readonly dir: Direction
  readonly zone: string | null
  readonly lastSeen: number
}

export type PlayerMap = Readonly<Record<string, RemotePlayer>>

/** Upper bound on tracked players, so a client cycling fake uids can't grow the map forever. */
export const MAX_PLAYERS = 100

export function upsertPlayer(state: PlayerMap, packet: PosPacket, now: number): PlayerMap {
  const existing = Object.hasOwn(state, packet.uid) ? state[packet.uid] : undefined
  if (!existing && Object.keys(state).length >= MAX_PLAYERS) return state
  const next: RemotePlayer = {
    uid: packet.uid,
    name: packet.name,
    avatar: packet.avatar,
    x: existing ? existing.x : packet.x,
    y: existing ? existing.y : packet.y,
    targetX: packet.x,
    targetY: packet.y,
    dir: packet.dir,
    zone: packet.zone,
    lastSeen: now,
  }
  return { ...state, [packet.uid]: next }
}

export function removePlayer(state: PlayerMap, uid: string): PlayerMap {
  if (!Object.hasOwn(state, uid)) return state
  const { [uid]: _removed, ...rest } = state
  return rest
}

export function prunePlayers(state: PlayerMap, now: number, ttlMs: number): PlayerMap {
  const stale = Object.values(state).filter((p) => now - p.lastSeen > ttlMs)
  if (stale.length === 0) return state
  return stale.reduce((acc, p) => removePlayer(acc, p.uid), state)
}

export function advancePlayers(state: PlayerMap, alpha: number): PlayerMap {
  const entries = Object.entries(state).map(([uid, p]) => {
    const pos = interpolate(p, { x: p.targetX, y: p.targetY }, alpha)
    return [uid, { ...p, x: pos.x, y: pos.y }] as const
  })
  return Object.fromEntries(entries)
}

/** Marks every player as just seen (used after the tab was hidden and couldn't hear heartbeats). */
export function touchPlayers(state: PlayerMap, now: number): PlayerMap {
  return Object.fromEntries(Object.entries(state).map(([uid, p]) => [uid, { ...p, lastSeen: now }]))
}
