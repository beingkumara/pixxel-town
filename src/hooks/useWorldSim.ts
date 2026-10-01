import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { EMOTES, type Emote, type Packet } from '../lib/packet'
import { TILE, randomSpawn, zoneWithHysteresis, type Zone } from '../lib/world/map'
import { directionFor, step, type Direction } from '../lib/world/movement'
import { advancePlayers, prunePlayers, removePlayer, touchPlayers, upsertPlayer, type PlayerMap } from '../lib/world/players'
import { findNearest, keepPartner } from '../lib/world/proximity'
import type { Profile, TownTransport } from '../transport'
import { createRateLimiter } from '../lib/rateLimit'
import { readInput } from './useKeyboard'

/** How close (px) someone must be before a proximity DM opens. */
export const PROXIMITY_RADIUS = TILE * 2.5
const PROXIMITY_HYSTERESIS = TILE * 0.75
const BROADCAST_MOVING_MS = 120
const BROADCAST_IDLE_MS = 2500
const PLAYER_TTL_MS = 9000
const BUBBLE_MS = 5000
const TYPING_TTL_MS = 6000
const EMOTE_MS = 1600
const INTERPOLATION = 0.25
const ROSTER_REFRESH_MS = 1000
const MAX_EMOTES = 30
/** A frame gap this long means the tab was hidden; don't prune everyone on return. */
const STALL_MS = 1000
const HEARTBEAT_CHECK_MS = 1000
/** Legit clients send ~8 packets/s while walking; allow bursts, drop floods. */
const PACKET_BURST = 24
const PACKETS_PER_SECOND = 12

export interface Bubble {
  readonly text: string
  readonly accent: string
  readonly until: number
}

export interface FloatingEmote {
  readonly uid: string
  readonly emoji: Emote
  readonly start: number
}

export interface SimState {
  readonly me: { readonly x: number; readonly y: number; readonly dir: Direction; readonly walking: boolean }
  readonly players: PlayerMap
  readonly bubbles: Readonly<Record<string, Bubble>>
  readonly typing: Readonly<Record<string, Bubble>>
  readonly emotes: readonly FloatingEmote[]
}

export interface Partner {
  readonly uid: string
  readonly name: string
  readonly avatar: number
}

export interface RosterEntry {
  readonly uid: string
  readonly name: string
  readonly avatar: number
  readonly zone: string | null
}

interface Options {
  transport: TownTransport
  profile: Profile
  held: RefObject<Set<string>>
}

const omit = <T,>(rec: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> => {
  if (!(key in rec)) return rec
  const { [key]: _gone, ...rest } = rec
  return rest
}

const initialState = (): SimState => {
  const spawn = randomSpawn()
  return {
    me: { x: spawn.x, y: spawn.y, dir: 'down', walking: false },
    players: {},
    bubbles: {},
    typing: {},
    emotes: [],
  }
}

export function useWorldSim({ transport, profile, held }: Options) {
  const simRef = useRef<SimState>(initialState())
  const lastBroadcast = useRef({ at: 0, x: NaN, y: NaN })
  const partnerRef = useRef<string | null>(null)
  const zoneRef = useRef<string | null>(null)

  const [zone, setZone] = useState<Zone | null>(null)
  const [partner, setPartner] = useState<Partner | null>(null)
  const [roster, setRoster] = useState<readonly RosterEntry[]>([])

  const update = (fn: (s: SimState) => SimState) => {
    simRef.current = fn(simRef.current)
  }

  const broadcastPosition = useCallback(
    (now: number) => {
      const { me } = simRef.current
      transport.broadcast({
        t: 'pos',
        uid: profile.uid,
        name: profile.name,
        avatar: profile.avatar,
        x: Math.round(me.x),
        y: Math.round(me.y),
        dir: me.dir,
        zone: zoneRef.current,
      })
      lastBroadcast.current = { at: now, x: me.x, y: me.y }
    },
    [transport, profile],
  )

  // Network → sim
  useEffect(() => {
    const allow = createRateLimiter(PACKET_BURST, PACKETS_PER_SECOND)
    const onPacket = (packet: Packet) => {
      const now = performance.now()
      if (!allow(packet.uid, now)) return
      switch (packet.t) {
        case 'pos':
          update((s) => ({ ...s, players: upsertPlayer(s.players, packet, now) }))
          return
        case 'hello':
          // A newcomer: answer right away so they see us without waiting for a heartbeat.
          broadcastPosition(now)
          return
        case 'emote':
          update((s) => ({ ...s, emotes: [...s.emotes, { uid: packet.uid, emoji: packet.emoji, start: now }].slice(-MAX_EMOTES) }))
          return
        case 'bye':
          update((s) => ({ ...s, players: removePlayer(s.players, packet.uid) }))
      }
    }
    const unsubscribe = transport.subscribe({
      onPacket,
      onMessage: () => {},
      onTyping: () => {},
      onPresence: (uid, online) => {
        if (!online) update((s) => ({ ...s, players: removePlayer(s.players, uid) }))
      },
    })
    transport.broadcast({ t: 'hello', uid: profile.uid })
    broadcastPosition(performance.now())
    return unsubscribe
  }, [transport, profile, broadcastPosition])

  // Heartbeat on a timer, not rAF: browsers pause rAF in hidden tabs, which would make us vanish
  // for everyone else. On becoming visible again, re-announce and forgive stale lastSeen values.
  useEffect(() => {
    const beat = window.setInterval(() => {
      const now = performance.now()
      if (now - lastBroadcast.current.at >= BROADCAST_IDLE_MS) broadcastPosition(now)
    }, HEARTBEAT_CHECK_MS)
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const now = performance.now()
      update((s) => ({ ...s, players: touchPlayers(s.players, now) }))
      transport.broadcast({ t: 'hello', uid: profile.uid })
      broadcastPosition(now)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(beat)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [transport, profile, broadcastPosition])

  // Dev-only hook so E2E tests can place players deterministically instead of timing key presses.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as Window & { __pixelTownTeleport?: (x: number, y: number) => void }
    w.__pixelTownTeleport = (x, y) => update((s) => ({ ...s, me: { ...s.me, x, y } }))
    return () => {
      delete w.__pixelTownTeleport
    }
  }, [])

  // Low-frequency roster for the HUD.
  useEffect(() => {
    const id = window.setInterval(() => {
      const list = Object.values(simRef.current.players).map(({ uid, name, avatar, zone: z }) => ({ uid, name, avatar, zone: z }))
      setRoster((prev) =>
        prev.length === list.length && prev.every((p, i) => p.uid === list[i].uid && p.zone === list[i].zone) ? prev : list,
      )
    }, ROSTER_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [])

  const tick = useCallback(
    (dtMs: number, now: number) => {
      const input = readInput(held.current)
      const walking = input.dx !== 0 || input.dy !== 0

      update((s) => {
        const pos = step(s.me, input, dtMs)
        const alive = dtMs > STALL_MS ? touchPlayers(s.players, now) : prunePlayers(s.players, now, PLAYER_TTL_MS)
        return {
          me: { x: pos.x, y: pos.y, dir: directionFor(input, s.me.dir), walking },
          players: advancePlayers(alive, INTERPOLATION),
          bubbles: Object.fromEntries(Object.entries(s.bubbles).filter(([, b]) => b.until > now)),
          typing: Object.fromEntries(Object.entries(s.typing).filter(([, b]) => b.until > now)),
          emotes: s.emotes.filter((e) => now - e.start < EMOTE_MS),
        }
      })

      const { me, players } = simRef.current

      // Zone transitions
      const currentZone = zoneWithHysteresis(me.x, me.y, zoneRef.current)
      if ((currentZone?.id ?? null) !== zoneRef.current) {
        zoneRef.current = currentZone?.id ?? null
        setZone(currentZone)
        broadcastPosition(now)
      }

      // Proximity partner with hysteresis
      const others = Object.values(players)
      const current = partnerRef.current ? players[partnerRef.current] : undefined
      const nextPartner =
        current && keepPartner(me, current, PROXIMITY_RADIUS, PROXIMITY_HYSTERESIS)
          ? current
          : findNearest(me, others, PROXIMITY_RADIUS)
      if ((nextPartner?.uid ?? null) !== partnerRef.current) {
        partnerRef.current = nextPartner?.uid ?? null
        setPartner(nextPartner ? { uid: nextPartner.uid, name: nextPartner.name, avatar: nextPartner.avatar } : null)
      }

      // Throttled position broadcast
      const last = lastBroadcast.current
      const moved = me.x !== last.x || me.y !== last.y
      const interval = moved ? BROADCAST_MOVING_MS : BROADCAST_IDLE_MS
      if (now - last.at >= interval) broadcastPosition(now)
    },
    [held, broadcastPosition],
  )

  const emote = useCallback(
    (index: number) => {
      const emoji = EMOTES[index]
      if (!emoji) return
      transport.broadcast({ t: 'emote', uid: profile.uid, emoji })
      update((s) => ({ ...s, emotes: [...s.emotes, { uid: profile.uid, emoji, start: performance.now() }] }))
    },
    [transport, profile],
  )

  const showBubble = useCallback((uid: string, text: string, accent: string) => {
    const bubble = { text, accent, until: performance.now() + BUBBLE_MS }
    update((s) => ({ ...s, bubbles: { ...s.bubbles, [uid]: bubble }, typing: omit(s.typing, uid) }))
  }, [])

  const setTyping = useCallback((uid: string, accent: string | null) => {
    update((s) => ({
      ...s,
      typing: accent ? { ...s.typing, [uid]: { text: '', accent, until: performance.now() + TYPING_TTL_MS } } : omit(s.typing, uid),
    }))
  }, [])

  return { simRef, tick, zone, partner, roster, emote, showBubble, setTyping }
}

export type WorldSim = ReturnType<typeof useWorldSim>
