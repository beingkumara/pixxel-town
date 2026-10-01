import type { Direction } from '../../lib/world/movement'
import { FONT_BODY, FONT_MONO, THEME } from '../../lib/theme'
import type { Rect } from '../../lib/world/labels'

/** Procedural 12×14 pixel characters — no image assets needed. */

export interface AvatarPalette {
  readonly name: string
  readonly hair: string
  readonly skin: string
  readonly shirt: string
  readonly pants: string
}

export const AVATARS: readonly AvatarPalette[] = [
  { name: 'Lamplighter', hair: '#3b2416', skin: '#f2c49b', shirt: '#fda220', pants: '#3442d9' },
  { name: 'Night Owl', hair: '#1b1b2f', skin: '#c68a5e', shirt: '#00b0f4', pants: '#23272a' },
  { name: 'Moth', hair: '#e8e1cf', skin: '#f5d6b8', shirt: '#eb459e', pants: '#3b1450' },
  { name: 'Fox', hair: '#d9602a', skin: '#f2c49b', shirt: '#57f287', pants: '#2c2f33' },
  { name: 'Ghost', hair: '#8891f2', skin: '#e9e4ff', shirt: '#ffffff', pants: '#5865f2' },
  { name: 'Ember', hair: '#8a1c1c', skin: '#8d5a3b', shirt: '#de2761', pants: '#2b1a12' },
]

const PX = 2
export const SPRITE_W = 12 * PX
export const SPRITE_H = 14 * PX

const HEAD: Record<Direction, readonly string[]> = {
  down: ['....HHHH....', '...HHHHHH...', '..HHHHHHHH..', '..HSSSSSSH..', '..SSESSESS..', '..SSSSSSSS..', '...SSSSSS...'],
  up: ['....HHHH....', '...HHHHHH...', '..HHHHHHHH..', '..HHHHHHHH..', '..HHHHHHHH..', '..SHHHHHHS..', '...SSSSSS...'],
  left: ['....HHHH....', '...HHHHHH...', '..HHHHHHHH..', '..SSSSSSHH..', '..SESSSSSH..', '..SSSSSSSS..', '...SSSSSS...'],
  right: ['....HHHH....', '...HHHHHH...', '..HHHHHHHH..', '..HHSSSSSS..', '..HSSSSSES..', '..SSSSSSSS..', '...SSSSSS...'],
}

const BODY = ['..CCCCCCCC..', '.CCCCCCCCCC.', '.SCCCCCCCCS.', '..CCCCCCCC..']
const LEGS_IDLE = ['..PPP..PPP..', '..PPP..PPP..', '..FF....FF..']
const LEGS_WALK = ['..PPP..PPP..', '.PPP....PPP.', '.FF......FF.']

function colorFor(ch: string, p: AvatarPalette): string | null {
  switch (ch) {
    case 'H':
      return p.hair
    case 'S':
      return p.skin
    case 'E':
      return '#10122b'
    case 'C':
      return p.shirt
    case 'P':
      return p.pants
    case 'F':
      return '#10122b'
    default:
      return null
  }
}

/** Draws an avatar whose feet are centred on (x, y). */
export function drawAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  avatar: number,
  dir: Direction,
  walking: boolean,
  timeMs: number,
): void {
  const palette = AVATARS[avatar % AVATARS.length]
  const walkFrame = walking && Math.floor(timeMs / 140) % 2 === 1
  const bob = walking && walkFrame ? -1 : 0
  const rows = [...HEAD[dir], ...BODY, ...(walkFrame ? LEGS_WALK : LEGS_IDLE)]
  const left = Math.round(x - SPRITE_W / 2)
  const top = Math.round(y - SPRITE_H + 6 + bob)

  // Drop shadow
  ctx.fillStyle = 'rgba(5, 6, 20, 0.45)'
  ctx.fillRect(left + 4, Math.round(y) + 4, SPRITE_W - 8, 4)

  rows.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const color = colorFor(row[rx], palette)
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(left + rx * PX, top + ry * PX, PX, PX)
    }
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Sprite footprint (feet at x, y) — labels treat it as an obstacle. */
export function spriteRect(x: number, y: number): Rect {
  return { x: Math.round(x - SPRITE_W / 2), y: Math.round(y - SPRITE_H + 6), w: SPRITE_W, h: SPRITE_H }
}

/*
 * In-map text sits on the design-system tiers at its on-screen size (label scale `s`
 * converts CSS px to map units): name tags are mono chrome 11px, bubbles are body-sm 14px.
 */
const TAG_FONT_PX = 11
const TAG_H = 18
const BUBBLE_FONT_PX = 14
const BUBBLE_H = 26
/** Mono chrome tracking (−0.02em). */
export const MONO_TRACKING_EM = -0.02
/** Length of a bubble's tail at its base, CSS px. */
export const BUBBLE_TAIL = 6

const tagFont = (s: number) => `500 ${TAG_FONT_PX * s}px ${FONT_MONO}`
const bubbleFont = (s: number) => `500 ${BUBBLE_FONT_PX * s}px ${FONT_BODY}`

function setTracking(ctx: CanvasRenderingContext2D, px: number): void {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`
}

/** Size of a name pill at label scale s. */
export function measureNameTag(ctx: CanvasRenderingContext2D, name: string, s: number): { w: number; h: number } {
  ctx.font = tagFont(s)
  setTracking(ctx, TAG_FONT_PX * s * MONO_TRACKING_EM)
  const w = Math.ceil(ctx.measureText(name).width + 22 * s)
  setTracking(ctx, 0)
  return { w, h: Math.round(TAG_H * s) }
}

/** Name pill: mono micro-label with a semantic status dot (online / partner / you). */
export function drawNameTagAt(ctx: CanvasRenderingContext2D, r: Rect, name: string, accent: string, s: number): void {
  roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2)
  ctx.fillStyle = 'rgba(14, 15, 45, 0.88)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(226, 226, 226, 0.18)'
  ctx.lineWidth = s
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(r.x + 8 * s, r.y + r.h / 2, 2.5 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = tagFont(s)
  setTracking(ctx, TAG_FONT_PX * s * MONO_TRACKING_EM)
  ctx.fillStyle = THEME.text
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, r.x + 14 * s, r.y + r.h / 2 + 0.5 * s)
  setTracking(ctx, 0)
}

/** Truncates bubble text to `maxChars` with an ellipsis. */
export function bubbleText(text: string, maxChars: number): string {
  const chars = Array.from(text)
  return chars.length > maxChars ? `${chars.slice(0, maxChars - 1).join('')}…` : text
}

/** Size of a chat bubble at label scale s. `content === null` is the typing indicator. */
export function measureBubble(ctx: CanvasRenderingContext2D, content: string | null, s: number): { w: number; h: number } {
  ctx.font = bubbleFont(s)
  const w = content === null ? 44 * s : Math.max(36 * s, ctx.measureText(content).width + 24 * s)
  return { w: Math.ceil(w), h: Math.round(BUBBLE_H * s) }
}

/**
 * Chat bubble in rect r. Its tail leaves the bubble at `tailX` (the speaker's x) and runs down
 * to `tipY` (the top of the speaker's name tag or head), so it always points at who spoke.
 * `content === null` renders typing dots.
 */
export function drawBubbleAt(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  tailX: number,
  tipY: number,
  content: string | null,
  accent: string,
  timeMs: number,
  s: number,
): void {
  const radius = r.h / 2
  const tail = (BUBBLE_TAIL * s) / 2 + s
  const cx = r.x + r.w / 2
  const bottom = r.y + r.h
  const wedgeTip = Math.min(tipY, bottom + BUBBLE_TAIL * s)

  roundRect(ctx, r.x, r.y, r.w, r.h, radius)
  ctx.fillStyle = THEME.text
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(tailX - tail, bottom - 1)
  ctx.lineTo(tailX, wedgeTip)
  ctx.lineTo(tailX + tail, bottom - 1)
  ctx.fill()
  // Bubble lifted above its speaker's neighbours: a leader line carries the tail down to them.
  if (tipY > wedgeTip + s) ctx.fillRect(tailX - s * 0.75, wedgeTip - s, s * 1.5, tipY - wedgeTip + s)
  // Semantic accent edge (fuchsia whisper / cerulean room)
  roundRect(ctx, r.x, r.y, 4 * s, r.h, [radius, 0, 0, radius])
  ctx.fillStyle = accent
  ctx.fill()

  if (content === null) {
    for (let i = 0; i < 3; i++) {
      const phase = (timeMs / 180 - i * 0.9) % 3
      const lift = phase < 1 ? Math.sin(phase * Math.PI) * 3 * s : 0
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(cx - 8 * s + i * 8 * s, r.y + r.h / 2 - lift, 2.8 * s, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  ctx.font = bubbleFont(s)
  ctx.fillStyle = THEME.chrome
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(content, cx + 2 * s, r.y + r.h / 2 + 0.5 * s)
}

export function drawEmote(ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string, progress: number): void {
  const rise = progress * 28
  ctx.globalAlpha = Math.max(0, 1 - progress)
  ctx.font = '22px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, x + Math.sin(progress * 8) * 3, y - SPRITE_H - 20 - rise)
  ctx.globalAlpha = 1
}
