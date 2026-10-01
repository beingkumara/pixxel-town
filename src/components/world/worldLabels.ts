import { MAP_H, MAP_W, TILE } from '../../lib/world/map'
import { LABEL_GAP, firstClear, labelScale, overlaps, type Rect } from '../../lib/world/labels'
import { BUBBLE_TAIL, SPRITE_H, bubbleText, drawBubbleAt, drawNameTagAt, measureBubble, measureNameTag, spriteRect } from './sprites'
import { drawZoneLabels, zoneLabels, type ZoneLabel } from './tiles'

/** One speaker's in-map text. Pass actors in priority order: earlier ones keep their spot. */
export interface LabelActor {
  readonly x: number
  readonly y: number
  readonly name: string
  readonly accent: string
  readonly bubble?: { readonly text: string | null; readonly accent: string }
  /** Placed first, even on a tiny display (you, your whisper partner). */
  readonly keep?: boolean
}

/** Bubble text lengths tried in turn; lower-priority text is shortened before it is dropped. */
const BUBBLE_LENGTHS = [30, 16, 9] as const
/** How many rows a callout may be lifted above its owner (a leader line keeps it attached). */
const BUBBLE_MAX_LIFT = 1
const TAG_MAX_LIFT = 1
/** Where the owner's x may sit along a callout, as a fraction of its width (centred first). */
const ANCHORS_ALONE = [0.5, 0.3, 0.7, 0.15, 0.85] as const
/** Owner has a close neighbour on the right: extend the callout leftwards, away from them. */
const ANCHORS_LEAN_LEFT = [0.88, 0.7, 0.5, 0.3, 0.12] as const
const ANCHORS_LEAN_RIGHT = [0.12, 0.3, 0.5, 0.7, 0.88] as const
/** Neighbours closer than this (tiles) make callouts lean apart. */
const NEIGHBOUR_TILES = 4

interface Callout {
  readonly rect: Rect
  /** Where the tail / leader ends: just above the owner's tag or head. */
  readonly tipY: number
}

interface PlacedBubble extends Callout {
  readonly content: string | null
}

interface Layout {
  readonly taken: readonly Rect[]
  readonly bubbles: readonly { readonly actor: LabelActor; readonly bubble: PlacedBubble }[]
  readonly tags: readonly { readonly actor: LabelActor; readonly tag: Callout }[]
  readonly zones: readonly { label: string; fontPx: number; rect: Rect }[]
}

interface Ctx2 {
  readonly ctx: CanvasRenderingContext2D
  readonly s: number
  readonly gap: number
  /** The visible window of the map; labels stay inside it. */
  readonly view: Rect
  readonly actors: readonly LabelActor[]
}

/** Breathing room kept between in-map text and the canvas frame, CSS px. */
const FRAME_INSET = 12

const inside = (r: Rect, v: Rect, m: number) =>
  r.x >= v.x + m && r.y >= v.y + m && r.x + r.w <= v.x + v.w - m && r.y + r.h <= v.y + v.h - m

/** Anchor order for an actor: lean away from the nearest neighbour standing beside them. */
function anchorsFor(c: Ctx2, actor: LabelActor): readonly number[] {
  const near = c.actors
    .filter((o) => o !== actor && Math.abs(o.y - actor.y) < TILE * 2 && Math.abs(o.x - actor.x) < TILE * NEIGHBOUR_TILES)
    .sort((a, b) => Math.abs(a.x - actor.x) - Math.abs(b.x - actor.x))[0]
  if (!near) return ANCHORS_ALONE
  return near.x >= actor.x ? ANCHORS_LEAN_LEFT : ANCHORS_LEAN_RIGHT
}

/**
 * Finds a spot of size w×h above `anchorTop` whose owner's x falls inside it (margin `inner`)
 * and whose tail can drop straight down to the owner without crossing any other label.
 */
function placeCallout(
  c: Ctx2,
  actor: LabelActor,
  size: { w: number; h: number },
  anchorTop: number,
  drop: number,
  inner: number,
  maxLift: number,
  taken: readonly Rect[],
  anchors: readonly number[],
): Callout | null {
  const { w, h } = size
  for (let lift = 0; lift <= maxLift; lift++) {
    const y = Math.floor(anchorTop - c.gap - drop - h - lift * (h + c.gap))
    for (const f of anchors) {
      const margin = FRAME_INSET * c.s
      const x = Math.round(Math.min(Math.max(actor.x - f * w, c.view.x + margin), c.view.x + c.view.w - margin - w))
      const rect = { x, y, w, h }
      if (actor.x < x + inner || actor.x > x + w - inner || !inside(rect, c.view, margin)) continue
      const leader = { x: actor.x - c.s * 2, y: y + h, w: c.s * 4, h: Math.max(1, anchorTop - (y + h) - c.gap) }
      if (taken.some((t) => overlaps(t, rect, c.gap) || overlaps(t, leader))) continue
      return { rect, tipY: anchorTop - c.s }
    }
  }
  return null
}

/** Places a bubble centred over its speaker, shortening its text before giving up (null = hide it). */
function placeBubble(c: Ctx2, actor: LabelActor, anchorTop: number, taken: readonly Rect[]): PlacedBubble | null {
  const text = actor.bubble?.text ?? null
  const tail = BUBBLE_TAIL * c.s
  const contents = text === null ? [null] : [...new Set(BUBBLE_LENGTHS.map((len) => bubbleText(text, len)))]
  for (const content of contents) {
    const size = measureBubble(c.ctx, content, c.s)
    // Centred only: the frame inset is the one thing allowed to nudge a bubble sideways.
    const spot = placeCallout(c, actor, size, anchorTop, tail, size.h / 2 + tail, BUBBLE_MAX_LIFT, taken, [0.5])
    if (spot) return { ...spot, content }
  }
  return null
}

/** Where an actor's name tag wants to sit: centred just above their head. */
function tagSpot(c: Ctx2, actor: LabelActor): Rect {
  const size = measureNameTag(c.ctx, actor.name, c.s)
  const sprite = spriteRect(actor.x, actor.y)
  return { x: Math.round(actor.x - size.w / 2), y: Math.floor(sprite.y - c.gap - size.h), ...size }
}

/** Priority 1: speech bubbles, centred over their speaker, above where the name tag goes. */
function bubbleStep(c: Ctx2, layout: Layout, actor: LabelActor): Layout {
  const bubble = placeBubble(c, actor, tagSpot(c, actor).y, layout.taken)
  if (!bubble) return layout
  return { ...layout, taken: [...layout.taken, bubble.rect], bubbles: [...layout.bubbles, { actor, bubble }] }
}

/** Priority 2 and 4: name tags. A speaker's tag stays in its row under the bubble; others may lift one row. */
function tagStep(c: Ctx2, layout: Layout, actor: LabelActor, maxLift: number): Layout {
  const spot = tagSpot(c, actor)
  const sprite = spriteRect(actor.x, actor.y)
  const tag = placeCallout(c, actor, spot, sprite.y, 0, spot.h / 2, maxLift, layout.taken, anchorsFor(c, actor))
  if (!tag) return layout
  return { ...layout, taken: [...layout.taken, tag.rect], tags: [...layout.tags, { actor, tag }] }
}

/** A zone sign goes in the first free spot inside its room, or is left out. */
function placeZone(c: Ctx2, layout: Layout, zone: ZoneLabel): Layout {
  const visible = zone.spots.filter((r) => inside(r, c.view, FRAME_INSET * c.s))
  const rect = firstClear(visible, layout.taken, c.gap)
  if (!rect) return layout
  return { ...layout, taken: [...layout.taken, rect], zones: [...layout.zones, { label: zone.label, fontPx: zone.fontPx, rect }] }
}

/**
 * Lays out zone signs, name tags and chat bubbles so none collide and each stays attached to
 * what it names: tags sit over their owner, bubble tails run to their speaker, signs stay inside
 * their room. Text keeps its design-system size on screen however small the canvas is shown;
 * what cannot fit near its owner is shortened, then left out.
 * `reserved` marks areas (in map pixels) covered by page UI that labels must avoid;
 * `view` is the visible window of the map (the whole map unless a camera is following you).
 */
export function drawWorldLabels(
  ctx: CanvasRenderingContext2D,
  actors: readonly LabelActor[],
  now: number,
  reserved: readonly Rect[] = [],
  view: Rect = { x: 0, y: 0, w: MAP_W * TILE, h: MAP_H * TILE },
): void {
  const s = labelScale(view.w, ctx.canvas.clientWidth)
  // Only people in view get labels (a camera shows part of the map on narrow screens).
  const visible = actors.filter((a) => a.x >= view.x && a.x <= view.x + view.w && a.y >= view.y && a.y <= view.y + view.h + SPRITE_H)
  // Keep the on-screen gap between labels constant (~3px) whatever the display size.
  const c: Ctx2 = { ctx, s, gap: LABEL_GAP * s, view, actors: visible }
  // Page UI over the canvas is an obstacle up to its edge, not its edge plus a label gap.
  const inset = (r: Rect): Rect => ({ x: r.x + c.gap / 2, y: r.y + c.gap / 2, w: Math.max(0, r.w - c.gap), h: Math.max(0, r.h - c.gap) })
  const start: Layout = {
    taken: [...reserved.map(inset), ...actors.map((a) => spriteRect(a.x, a.y))],
    bubbles: [],
    tags: [],
    zones: [],
  }
  const zones = zoneLabels(ctx, s)

  // Priority: speech bubbles > speakers' (and your / your partner's) tags > zone signs > other tags.
  // Lower-priority text moves or hides; a bubble never leaves its speaker.
  const isFront = (a: LabelActor) => Boolean(a.bubble) || Boolean(a.keep)
  type Step = (l: Layout) => Layout
  const steps: Step[] = [
    ...visible.filter((a) => a.bubble).map((a): Step => (l) => bubbleStep(c, l, a)),
    ...visible.filter(isFront).map((a): Step => (l) => tagStep(c, l, a, 0)),
    ...zones.map((z): Step => (l) => placeZone(c, l, z)),
    ...visible.filter((a) => !isFront(a)).map((a): Step => (l) => tagStep(c, l, a, TAG_MAX_LIFT)),
  ]
  const layout = steps.reduce((l, step) => step(l), start)

  drawZoneLabels(ctx, layout.zones, s)
  layout.tags.forEach(({ actor, tag }) => {
    // A lifted tag keeps a hairline leader down to its owner's head.
    const bottom = tag.rect.y + tag.rect.h
    if (tag.tipY - bottom > c.gap * 1.5) {
      ctx.fillStyle = 'rgba(226, 226, 226, 0.55)'
      ctx.fillRect(actor.x - s / 2, bottom, s, tag.tipY - bottom)
    }
    drawNameTagAt(ctx, tag.rect, actor.name, actor.accent, s)
  })
  layout.bubbles.forEach(({ actor, bubble }) => {
    if (actor.bubble) drawBubbleAt(ctx, bubble.rect, actor.x, bubble.tipY, bubble.content, actor.bubble.accent, now, s)
  })
}
