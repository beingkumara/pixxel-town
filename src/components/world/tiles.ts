import { MAP_H, MAP_W, TILE, ZONES, tileAt, zoneBounds } from '../../lib/world/map'
import { FONT_MONO, RGB } from '../../lib/theme'
import type { Rect } from '../../lib/world/labels'

/** Deterministic per-tile noise so the map looks hand-placed but never changes. */
function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0
  h = (h ^ (h >>> 13)) * 1274126177
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

type Ctx = CanvasRenderingContext2D

function speckle(ctx: Ctx, px: number, py: number, tx: number, ty: number, colors: readonly string[], count: number) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(hash(tx, ty, i) * colors.length)]
    const sx = Math.floor(hash(tx, ty, i + 50) * 15) * 2
    const sy = Math.floor(hash(tx, ty, i + 99) * 15) * 2
    ctx.fillRect(px + sx, py + sy, 2, 2)
  }
}

function grass(ctx: Ctx, px: number, py: number, tx: number, ty: number) {
  ctx.fillStyle = '#23443a'
  ctx.fillRect(px, py, TILE, TILE)
  speckle(ctx, px, py, tx, ty, ['#2d5647', '#1b362e', '#35634f'], 7)
}

function drawTile(ctx: Ctx, tx: number, ty: number) {
  const px = tx * TILE
  const py = ty * TILE
  const ch = tileAt(tx, ty)

  switch (ch) {
    case '#': {
      ctx.fillStyle = '#0b0c26'
      ctx.fillRect(px, py, TILE, TILE)
      ctx.fillStyle = '#191b4a'
      for (let row = 0; row < 4; row++) {
        const offset = row % 2 === 0 ? 0 : 8
        for (let col = -1; col < 3; col++) ctx.fillRect(px + col * 16 + offset + 1, py + row * 8 + 1, 14, 6)
      }
      ctx.fillStyle = '#343a8a'
      ctx.fillRect(px, py, TILE, 2)
      return
    }
    case '=': {
      ctx.fillStyle = '#4a4050'
      ctx.fillRect(px, py, TILE, TILE)
      speckle(ctx, px, py, tx, ty, ['#5d5264', '#3b3342', '#6a5e70'], 10)
      return
    }
    case '~': {
      ctx.fillStyle = '#1a3a78'
      ctx.fillRect(px, py, TILE, TILE)
      ctx.fillStyle = '#3a66b8'
      ctx.fillRect(px + 4 + Math.floor(hash(tx, ty) * 8), py + 10, 10, 2)
      ctx.fillRect(px + 12, py + 22, 12, 2)
      return
    }
    case 'T': {
      grass(ctx, px, py, tx, ty)
      ctx.fillStyle = '#3b2416'
      ctx.fillRect(px + 13, py + 20, 6, 10)
      ctx.fillStyle = '#123a2c'
      ctx.fillRect(px + 4, py + 2, 24, 20)
      ctx.fillRect(px + 2, py + 6, 28, 12)
      ctx.fillStyle = '#1d5a40'
      ctx.fillRect(px + 6, py + 4, 12, 8)
      return
    }
    case 'c':
      return drawCafeTile(ctx, px, py, ty, false)
    case 'B': {
      const zone = zoneTileFor(tx, ty)
      if (zone === 'w') return drawWarRoomTile(ctx, px, py, tx, ty, true)
      if (zone === 'g') return drawGardenTile(ctx, px, py, tx, ty, true)
      return drawCafeTile(ctx, px, py, ty, true)
    }
    case 'w':
      return drawWarRoomTile(ctx, px, py, tx, ty, false)
    case 'g':
      return drawGardenTile(ctx, px, py, tx, ty, false)
    default:
      grass(ctx, px, py, tx, ty)
  }
}

/** Furniture tiles ('B') inherit the floor style of the zone around them. */
function zoneTileFor(tx: number, ty: number): string {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const t = tileAt(tx + dx, ty + dy)
    if (t === 'c' || t === 'w' || t === 'g') return t
  }
  return 'c'
}

function drawCafeTile(ctx: Ctx, px: number, py: number, ty: number, table: boolean) {
  ctx.fillStyle = ty % 2 === 0 ? '#6b3f22' : '#774729'
  ctx.fillRect(px, py, TILE, TILE)
  ctx.fillStyle = '#5a321a'
  ctx.fillRect(px, py + 15, TILE, 2)
  if (!table) return
  ctx.fillStyle = '#2a1608'
  ctx.fillRect(px + 4, py + 6, 24, 20)
  ctx.fillStyle = '#b8743c'
  ctx.fillRect(px + 6, py + 8, 20, 14)
  ctx.fillStyle = '#fda220'
  ctx.fillRect(px + 14, py + 11, 4, 6)
}

function drawWarRoomTile(ctx: Ctx, px: number, py: number, tx: number, ty: number, desk: boolean) {
  ctx.fillStyle = (tx + ty) % 2 === 0 ? '#28325a' : '#2e3966'
  ctx.fillRect(px, py, TILE, TILE)
  if (!desk) return
  ctx.fillStyle = '#0c1026'
  ctx.fillRect(px + 1, py + 4, 30, 24)
  ctx.fillStyle = '#44507f'
  ctx.fillRect(px + 3, py + 6, 26, 18)
  ctx.fillStyle = '#00b0f4'
  ctx.fillRect(px + 8, py + 10, 16, 2)
  ctx.fillRect(px + 8, py + 15, 10, 2)
}

function drawGardenTile(ctx: Ctx, px: number, py: number, tx: number, ty: number, bench: boolean) {
  ctx.fillStyle = '#183b3a'
  ctx.fillRect(px, py, TILE, TILE)
  speckle(ctx, px, py, tx, ty, ['#1f4a48', '#123030'], 5)
  if (hash(tx, ty, 7) > 0.7) {
    ctx.fillStyle = hash(tx, ty, 8) > 0.5 ? '#eb459e' : '#babcd9'
    ctx.fillRect(px + 10, py + 12, 2, 2)
    ctx.fillRect(px + 20, py + 22, 2, 2)
  }
  if (!bench) return
  ctx.fillStyle = '#3b2416'
  ctx.fillRect(px + 2, py + 10, 28, 12)
  ctx.fillStyle = '#6b4a2e'
  ctx.fillRect(px + 2, py + 10, 28, 4)
}

/* Zone signs are mono chrome (11px, 10px when the room is too narrow), uppercase, −0.02em. */
const ZONE_FONT_SIZES = [11, 10] as const
const ZONE_H = 20
const ZONE_PAD_X = 8
/** Clearance kept between a sign and its room's walls, CSS px. */
const ZONE_INSET = 2

export interface ZoneLabel {
  readonly label: string
  readonly fontPx: number
  /** Candidate spots, all fully inside the room, best first (top, bottom, middle). */
  readonly spots: readonly Rect[]
}

const zoneFont = (px: number, s: number) => `500 ${px * s}px ${FONT_MONO}`

function setTracking(ctx: Ctx, px: number): void {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`
}

function measureZone(ctx: Ctx, label: string, px: number, s: number): number {
  ctx.font = zoneFont(px, s)
  setTracking(ctx, px * s * -0.02)
  const w = ctx.measureText(label).width + ZONE_PAD_X * 2 * s
  setTracking(ctx, 0)
  return Math.ceil(w)
}

/** Sign candidates for every zone at label scale s; a zone whose room can't fit its sign has none. */
export function zoneLabels(ctx: Ctx, s: number): readonly ZoneLabel[] {
  return ZONES.map((zone) => {
    const label = zone.name.toUpperCase()
    const room = zoneBounds(zone)
    const inset = ZONE_INSET * s
    const h = Math.round(ZONE_H * s)
    const fontPx = ZONE_FONT_SIZES.find((px) => measureZone(ctx, label, px, s) <= room.w - inset * 2) ?? 0
    if (!fontPx) return { label, fontPx: ZONE_FONT_SIZES[0], spots: [] }
    const w = measureZone(ctx, label, fontPx, s)
    const x = Math.round(Math.min(Math.max(zone.center.x - w / 2, room.x + inset), room.x + room.w - inset - w))
    const top = Math.ceil(room.y + inset)
    const bottom = Math.floor(room.y + room.h - inset - h)
    const ys = [top, bottom, Math.round(zone.center.y - h / 2), Math.round(zone.center.y + TILE)]
    const spots = ys.filter((y) => y >= top && y <= bottom).map((y) => ({ x, y, w, h }))
    return { label, fontPx, spots }
  })
}

/** Zone signs, drawn per frame so they keep their tier size at any display size. */
export function drawZoneLabels(ctx: Ctx, zones: readonly { readonly label: string; readonly fontPx: number; readonly rect: Rect }[], s: number): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const { label, fontPx, rect } of zones) {
    ctx.beginPath()
    ctx.roundRect(rect.x, rect.y, rect.w, rect.h, rect.h / 2)
    ctx.fillStyle = 'rgba(14, 15, 45, 0.82)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 176, 244, 0.55)'
    ctx.lineWidth = s
    ctx.stroke()
    ctx.font = zoneFont(fontPx, s)
    setTracking(ctx, fontPx * s * -0.02)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5 * s)
    setTracking(ctx, 0)
  }
}

/** Renders the static map once; the game loop blits it every frame. */
export function renderMap(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = MAP_W * TILE
  canvas.height = MAP_H * TILE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser')
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) drawTile(ctx, tx, ty)
  return canvas
}

/** Lantern glows, each lit in its area's semantic color. Positions are in pixels. */
export const LANTERNS: readonly { x: number; y: number; color: string }[] = [
  { x: TILE * 2.5, y: TILE * 2.5, color: RGB.ember },
  { x: TILE * 7.5, y: TILE * 4.5, color: RGB.ember },
  { x: TILE * 25, y: TILE * 3, color: RGB.room },
  { x: TILE * 24.5, y: TILE * 14.5, color: RGB.dm },
  { x: TILE * 12, y: TILE * 7.5, color: RGB.blurple },
  { x: TILE * 18.5, y: TILE * 12, color: RGB.ember },
]

export function drawLights(ctx: CanvasRenderingContext2D, now: number): void {
  ctx.globalCompositeOperation = 'lighter'
  LANTERNS.forEach((l, i) => {
    const flicker = 0.85 + Math.sin(now / 220 + i * 1.7) * 0.06 + Math.sin(now / 97 + i) * 0.03
    const r = TILE * 3.2 * flicker
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r)
    g.addColorStop(0, `rgba(${l.color}, 0.3)`)
    g.addColorStop(1, `rgba(${l.color}, 0)`)
    ctx.fillStyle = g
    ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2)
  })
  ctx.globalCompositeOperation = 'source-over'
}
