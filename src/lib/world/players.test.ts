import { describe, expect, test } from 'vitest'
import type { PosPacket } from '../packet'
import { MAX_PLAYERS, prunePlayers, removePlayer, touchPlayers, upsertPlayer } from './players'

const packet = (uid: string, x = 10): PosPacket => ({
  t: 'pos',
  uid,
  name: uid.toUpperCase(),
  avatar: 2,
  x,
  y: 20,
  dir: 'down',
  zone: null,
})

describe('players store', () => {
  test('upsert adds a new player without mutating state', () => {
    const state = {}
    const next = upsertPlayer(state, packet('a'), 1000)
    expect(state).toEqual({})
    expect(next.a).toMatchObject({ uid: 'a', targetX: 10, x: 10, lastSeen: 1000 })
  })

  test('upsert of an existing player updates the target but keeps the rendered position', () => {
    const first = upsertPlayer({}, packet('a', 10), 1000)
    const second = upsertPlayer(first, packet('a', 90), 2000)
    expect(second.a.targetX).toBe(90)
    expect(second.a.x).toBe(10)
    expect(second.a.lastSeen).toBe(2000)
    expect(first.a.targetX).toBe(10)
  })

  test('prune removes players not seen within ttl', () => {
    let state = upsertPlayer({}, packet('old'), 0)
    state = upsertPlayer(state, packet('fresh'), 9000)
    const next = prunePlayers(state, 10_000, 5000)
    expect(Object.keys(next)).toEqual(['fresh'])
  })

  test('prune returns the same reference when nothing changes', () => {
    const state = upsertPlayer({}, packet('a'), 9000)
    expect(prunePlayers(state, 10_000, 5000)).toBe(state)
  })

  test('remove drops a player', () => {
    const state = upsertPlayer({}, packet('a'), 0)
    expect(removePlayer(state, 'a')).toEqual({})
    expect(removePlayer(state, 'missing')).toBe(state)
  })

  test('ignores new players once the town is full but still updates existing ones', () => {
    let state = {}
    for (let i = 0; i < MAX_PLAYERS; i++) state = upsertPlayer(state, packet(`p${i}`), 0)
    expect(upsertPlayer(state, packet('late'), 1)).toBe(state)
    expect(upsertPlayer(state, packet('p0', 50), 1).p0.targetX).toBe(50)
  })

  test('touchPlayers refreshes lastSeen without mutating', () => {
    const state = upsertPlayer({}, packet('a'), 0)
    const touched = touchPlayers(state, 5000)
    expect(touched.a.lastSeen).toBe(5000)
    expect(state.a.lastSeen).toBe(0)
  })
})
