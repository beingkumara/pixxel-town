export const TILE = 32

/**
 * Legend
 *   #  wall        T  tree       B  table/bench     ~  pond
 *   .  grass       =  cobble path
 *   c  Lantern Café floor   w  War Room floor   g  Moon Garden floor
 */
const ROWS = [
  '##############################',
  '#cccccccc#..T.....T..#wwwwwww#',
  '#cBccccBc#...........#wwBBBww#',
  '#cccccccc#..=======..#wwBBBww#',
  '#cBccccBc#..=.....=..#wwwwwww#',
  '#ccccccccc..=.....=..wwwwwwww#',
  '##########..=.....=..#########',
  '#.......T...=.....=.....T....#',
  '#...........=======..........#',
  '#..............~~~...........#',
  '#....T.........~~~..#ggggggg##',
  '#...................gggggggg##',
  '#..T....T...........#ggTgggg##',
  '#...................#ggggggg##',
  '#.......T...........#gggBggg##',
  '#.....T.........T...#ggggggg##',
  '#............................#',
  '##############################',
] as const

export const MAP_W = ROWS[0].length
export const MAP_H = ROWS.length

if (ROWS.some((row) => row.length !== MAP_W)) {
  throw new Error('Pixel Town map rows must all be the same width')
}

const SOLID = new Set(['#', 'T', 'B', '~'])

export type TileChar = string

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Zone {
  readonly id: string
  readonly guid: string
  readonly name: string
  readonly tile: TileChar
  readonly blurb: string
  readonly center: Point
}

const tileCenter = (tx: number, ty: number): Point => ({
  x: tx * TILE + TILE / 2,
  y: ty * TILE + TILE / 2,
})

export const ZONES: readonly Zone[] = [
  {
    id: 'cafe',
    guid: 'pt-room-cafe',
    name: 'Lantern Café',
    tile: 'c',
    blurb: 'Coffee, gossip, questionable jazz.',
    center: tileCenter(4, 3),
  },
  {
    id: 'warroom',
    guid: 'pt-room-warroom',
    name: 'War Room',
    tile: 'w',
    blurb: 'Standups, whiteboards, big decisions.',
    center: tileCenter(25, 4),
  },
  {
    id: 'garden',
    guid: 'pt-room-garden',
    name: 'Moon Garden',
    tile: 'g',
    blurb: 'Quiet corner for 1:1s under the stars.',
    center: tileCenter(24, 13),
  },
]

export const ZONE_IDS: ReadonlySet<string> = new Set(ZONES.map((z) => z.id))

export const WORLD_GUID = 'pixel-town-world'

export const SPAWN: Point = tileCenter(6, 9)

/** Half-size of the player's collision box in pixels. */
export const PLAYER_HALF = 10

/**
 * A spot near the plaza so arriving players don't stack on the same pixel.
 * Offsets stay small enough that newcomers still land in whisper range.
 */
export function randomSpawn(random: () => number = Math.random): Point {
  const candidate = {
    x: SPAWN.x + (random() * 2 - 1) * TILE,
    y: SPAWN.y - random() * (TILE / 2),
  }
  return canOccupy(candidate.x, candidate.y) && zoneAt(candidate.x, candidate.y) === null ? candidate : SPAWN
}

export function tileAt(tx: number, ty: number): TileChar {
  if (ty < 0 || ty >= MAP_H || tx < 0 || tx >= MAP_W) return '#'
  return ROWS[ty][tx]
}

export function isSolidTile(tx: number, ty: number): boolean {
  return SOLID.has(tileAt(tx, ty))
}

export function canOccupy(x: number, y: number, half: number = PLAYER_HALF): boolean {
  const corners: Point[] = [
    { x: x - half, y: y - half },
    { x: x + half, y: y - half },
    { x: x - half, y: y + half },
    { x: x + half, y: y + half },
  ]
  return corners.every((c) => !isSolidTile(Math.floor(c.x / TILE), Math.floor(c.y / TILE)))
}

/** Bounding box of a zone's floor tiles, in pixels. */
export function zoneBounds(zone: Zone): { x: number; y: number; w: number; h: number } {
  const cells = ROWS.flatMap((row, ty) => Array.from(row).flatMap((ch, tx) => (ch === zone.tile ? [{ tx, ty }] : [])))
  const xs = cells.map((c) => c.tx)
  const ys = cells.map((c) => c.ty)
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  return { x: x0 * TILE, y: y0 * TILE, w: (Math.max(...xs) - x0 + 1) * TILE, h: (Math.max(...ys) - y0 + 1) * TILE }
}

export function zoneAt(x: number, y: number): Zone | null {
  const tile = tileAt(Math.floor(x / TILE), Math.floor(y / TILE))
  return ZONES.find((z) => z.tile === tile) ?? null
}

const ZONE_EXIT_MARGIN = 8

/**
 * Like zoneAt, but once you're in a room you stay in it until you're a few
 * pixels past the edge, so standing in a doorway doesn't flap the call on/off.
 */
export function zoneWithHysteresis(x: number, y: number, currentId: string | null): Zone | null {
  const here = zoneAt(x, y)
  if (here || !currentId) return here
  const m = ZONE_EXIT_MARGIN
  const nearby = [zoneAt(x - m, y), zoneAt(x + m, y), zoneAt(x, y - m), zoneAt(x, y + m)]
  return nearby.find((z) => z?.id === currentId) ?? null
}

export function zoneById(id: string | null): Zone | null {
  if (!id) return null
  return ZONES.find((z) => z.id === id) ?? null
}
