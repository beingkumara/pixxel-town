import { useEffect, useRef } from 'react'
import { THEME } from '../../lib/theme'
import { MAP_H, MAP_W, TILE } from '../../lib/world/map'
import type { Direction } from '../../lib/world/movement'
import { drawAvatar } from '../world/sprites'
import { drawWorldLabels } from '../world/worldLabels'
import { fitCanvas } from '../world/fitCanvas'
import { drawLights, renderMap } from '../world/tiles'
import type { Rect } from '../../lib/world/labels'

/** Canvas-space rects of the floating chips that overlap the preview, so in-map text avoids them. */
function chipRects(canvas: HTMLCanvasElement): readonly Rect[] {
  const box = canvas.getBoundingClientRect()
  if (box.width === 0) return []
  const k = WIDTH / box.width
  const chips = canvas.closest('.lobby__world')?.querySelectorAll('.chip') ?? []
  return Array.from(chips, (chip) => {
    const r = chip.getBoundingClientRect()
    return { x: (r.left - box.left) * k, y: (r.top - box.top) * k, w: r.width * k, h: r.height * k }
  })
}

const WIDTH = MAP_W * TILE
const HEIGHT = MAP_H * TILE
const CYCLE_MS = 7000
/** The chips drift slowly, so re-measuring them twice a second is plenty (and avoids a layout read every frame). */
const CHIP_RECT_REFRESH_MS = 500

const at = (tx: number, ty: number) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 })

interface Townsperson {
  name: string
  avatar: number
  /** Position and facing at time t (ms). */
  pose(t: number): { x: number; y: number; dir: Direction; walking: boolean }
  /** What they're saying at phase p ∈ [0, 1) of the cycle, or undefined. */
  says?(p: number): { text: string | null; accent: string } | undefined
  tag: string
}

const still = (tx: number, ty: number, dir: Direction) => () => ({ ...at(tx, ty), dir, walking: false })

/** A scripted little scene that shows the idea before anyone signs in. */
const CAST: readonly Townsperson[] = [
  {
    name: 'Moth',
    avatar: 2,
    tag: THEME.dm,
    pose: still(7, 9, 'right'),
    says: (p) => (p < 0.25 ? { text: null, accent: THEME.dm } : p < 0.5 ? { text: 'psst, over here 👋', accent: THEME.dm } : undefined),
  },
  {
    name: 'Fox',
    avatar: 3,
    tag: THEME.dm,
    pose: still(8, 9, 'left'),
    says: (p) => (p > 0.55 && p < 0.7 ? { text: null, accent: THEME.dm } : p >= 0.7 && p < 0.95 ? { text: 'omg hi!', accent: THEME.dm } : undefined),
  },
  {
    name: 'Night Owl',
    avatar: 1,
    tag: THEME.room,
    pose: still(4, 3, 'right'),
    says: (p) => (p > 0.1 && p < 0.45 ? { text: 'coffee run?', accent: THEME.room } : undefined),
  },
  {
    name: 'Ember',
    avatar: 5,
    tag: THEME.room,
    pose: still(6, 3, 'left'),
    says: (p) => (p > 0.5 && p < 0.85 ? { text: 'join the call ☕', accent: THEME.room } : undefined),
  },
  {
    name: 'Ghost',
    avatar: 4,
    tag: THEME.online,
    pose: (t) => {
      // Stroll the cobble loop in the plaza.
      const p = (t % 9000) / 9000
      const from = at(12, 8)
      const to = at(18, 8)
      const forward = p < 0.5
      const k = forward ? p * 2 : (1 - p) * 2
      return { x: from.x + (to.x - from.x) * k, y: from.y, dir: forward ? 'right' : 'left', walking: true }
    },
  },
  {
    name: 'Lamplighter',
    avatar: 0,
    tag: THEME.room,
    pose: still(24, 3, 'down'),
    says: (p) => (p > 0.3 && p < 0.6 ? { text: 'standup in 5', accent: THEME.room } : undefined),
  },
]

/** Animated hero art for the lobby: the real map, lit, with a scripted cast. */
export function WorldPreview() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    let map = renderMap()
    document.fonts?.ready.then(() => {
      map = renderMap()
    })
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let frame = 0
    let chips: readonly Rect[] = []
    let chipsAt = -Infinity
    const paint = (now: number) => {
      if (now - chipsAt > CHIP_RECT_REFRESH_MS) {
        chips = chipRects(ctx.canvas)
        chipsAt = now
      }
      const t = reduced ? 2000 : now
      const phase = (t % CYCLE_MS) / CYCLE_MS
      fitCanvas(ctx, { x: 0, y: 0, w: WIDTH, h: HEIGHT })
      ctx.drawImage(map, 0, 0)
      drawLights(ctx, t)
      const poses = CAST.map((c) => ({ c, ...c.pose(t) })).sort((a, b) => a.y - b.y)
      poses.forEach(({ c, x, y, dir, walking }) => drawAvatar(ctx, x, y, c.avatar, dir, walking, t))
      drawWorldLabels(
        ctx,
        poses.map(({ c, x, y }) => ({ x, y, name: c.name, accent: c.tag, bubble: c.says?.(phase) })),
        t,
        chips,
      )
      if (!reduced) frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={ref} width={WIDTH} height={HEIGHT} className="preview__canvas" aria-hidden="true" />
}
