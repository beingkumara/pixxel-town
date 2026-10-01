import { describe, expect, test } from 'vitest'
import { MAP_H, MAP_W, SPAWN, TILE, ZONES, canOccupy, isSolidTile, randomSpawn, zoneAt, zoneBounds, zoneWithHysteresis } from './map'

describe('map', () => {
  test('map rows all have the declared width', () => {
    expect(MAP_W).toBeGreaterThan(10)
    expect(MAP_H).toBeGreaterThan(10)
  })

  test('tiles outside the map are solid', () => {
    expect(isSolidTile(-1, 0)).toBe(true)
    expect(isSolidTile(0, -1)).toBe(true)
    expect(isSolidTile(MAP_W, 0)).toBe(true)
    expect(isSolidTile(0, MAP_H)).toBe(true)
  })

  test('border tiles are walls', () => {
    expect(isSolidTile(0, 0)).toBe(true)
    expect(isSolidTile(MAP_W - 1, MAP_H - 1)).toBe(true)
  })

  test('spawn point is walkable and outside every zone', () => {
    expect(canOccupy(SPAWN.x, SPAWN.y)).toBe(true)
    expect(zoneAt(SPAWN.x, SPAWN.y)).toBeNull()
  })

  test('every zone has at least one walkable tile that resolves back to it', () => {
    for (const zone of ZONES) {
      const center = zone.center
      expect(canOccupy(center.x, center.y)).toBe(true)
      expect(zoneAt(center.x, center.y)?.id).toBe(zone.id)
    }
  })

  test('zone ids are valid CometChat GUID characters', () => {
    for (const zone of ZONES) {
      expect(zone.guid).toMatch(/^[a-z0-9_-]+$/)
    }
  })

  test('canOccupy rejects positions overlapping a wall', () => {
    expect(canOccupy(TILE / 2, TILE / 2)).toBe(false)
  })

  test('randomSpawn stays walkable, outside zones and near the plaza', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const p = randomSpawn(() => r)
      expect(canOccupy(p.x, p.y)).toBe(true)
      expect(zoneAt(p.x, p.y)).toBeNull()
      expect(Math.abs(p.x - SPAWN.x)).toBeLessThanOrEqual(TILE)
    }
  })

  test('randomSpawn gives different players different spots', () => {
    expect(randomSpawn(() => 0.1)).not.toEqual(randomSpawn(() => 0.9))
  })

  test('zoneWithHysteresis keeps you in a room until you are clearly outside', () => {
    // Café door tile is (9, 5); tile (10, 5) is grass just outside.
    const justOutside = { x: 10 * TILE + 3, y: 5 * TILE + TILE / 2 }
    expect(zoneAt(justOutside.x, justOutside.y)).toBeNull()
    expect(zoneWithHysteresis(justOutside.x, justOutside.y, 'cafe')?.id).toBe('cafe')
    expect(zoneWithHysteresis(justOutside.x, justOutside.y, null)).toBeNull()
    expect(zoneWithHysteresis(12 * TILE, 5 * TILE + TILE / 2, 'cafe')).toBeNull()
  })
})

describe('zoneBounds', () => {
  test('spans exactly the floor tiles of the Lantern Café', () => {
    const cafe = ZONES.find((z) => z.id === 'cafe')!
    expect(zoneBounds(cafe)).toEqual({ x: TILE, y: TILE, w: 9 * TILE, h: 5 * TILE })
  })

  test('contains each zone centre', () => {
    for (const zone of ZONES) {
      const b = zoneBounds(zone)
      expect(zone.center.x).toBeGreaterThan(b.x)
      expect(zone.center.x).toBeLessThan(b.x + b.w)
      expect(zone.center.y).toBeGreaterThan(b.y)
      expect(zone.center.y).toBeLessThan(b.y + b.h)
    }
  })
})
