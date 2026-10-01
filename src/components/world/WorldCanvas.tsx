import { useEffect, useRef } from 'react'
import { MAP_H, MAP_W, TILE } from '../../lib/world/map'
import { PROXIMITY_RADIUS, type SimState, type WorldSim } from '../../hooks/useWorldSim'
import { THEME } from '../../lib/theme'
import { drawAvatar, drawEmote } from './sprites'
import { drawWorldLabels, type LabelActor } from './worldLabels'
import { fitCanvas } from './fitCanvas'
import { cameraView } from '../../lib/world/camera'
import type { Rect } from '../../lib/world/labels'
import { drawLights, renderMap } from './tiles'
import './world.css'

const WIDTH = MAP_W * TILE
const HEIGHT = MAP_H * TILE
const EMOTE_MS = 1600

interface WorldCanvasProps {
  sim: Pick<WorldSim, 'simRef' | 'tick'>
  myName: string
  myAvatar: number
  myUid: string
  partnerUid: string | null
  zoneName: string | null
}

function drawProximityRing(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean, now: number) {
  const dash = 6
  const segments = 36
  const spin = (now / 3000) % (Math.PI * 2)
  ctx.fillStyle = active ? THEME.dm : 'rgba(186, 188, 217, 0.3)'
  for (let i = 0; i < segments; i += 2) {
    const a = spin + (i / segments) * Math.PI * 2
    ctx.fillRect(Math.round(x + Math.cos(a) * PROXIMITY_RADIUS) - 1, Math.round(y + Math.sin(a) * PROXIMITY_RADIUS) - 1, dash / 2, dash / 2)
  }
}

/** Edge darkening for the visible window, so a camera view is lit like the full map. */
function vignetteFor(ctx: CanvasRenderingContext2D, view: Rect): CanvasGradient {
  const cx = view.x + view.w / 2
  const cy = view.y + view.h / 2
  const g = ctx.createRadialGradient(cx, cy, Math.min(view.w, view.h) * 0.35, cx, cy, Math.max(view.w, view.h) * 0.7)
  g.addColorStop(0, 'rgba(7, 9, 32, 0)')
  g.addColorStop(1, 'rgba(8, 9, 32, 0.5)')
  return g
}

function drawFrame(ctx: CanvasRenderingContext2D, map: HTMLCanvasElement, s: SimState, props: WorldCanvasProps, now: number) {
  // Narrow screens follow you through a native-size camera instead of shrinking the whole town.
  const canvas = ctx.canvas
  const view = cameraView(s.me, { w: canvas.clientWidth, h: canvas.clientHeight }, { w: WIDTH, h: HEIGHT })
  fitCanvas(ctx, view)
  ctx.drawImage(map, 0, 0)
  drawLights(ctx, now)
  drawProximityRing(ctx, s.me.x, s.me.y, props.partnerUid !== null, now)

  type Actor = { uid: string; name: string; avatar: number; x: number; y: number; dir: SimState['me']['dir']; walking: boolean; isMe: boolean }
  const actors: Actor[] = [
    ...Object.values(s.players).map((p) => ({
      uid: p.uid,
      name: p.name,
      avatar: p.avatar,
      x: p.x,
      y: p.y,
      dir: p.dir,
      walking: Math.hypot(p.targetX - p.x, p.targetY - p.y) > 1,
      isMe: false,
    })),
    { uid: props.myUid, name: props.myName, avatar: props.myAvatar, ...s.me, isMe: true },
  ].sort((a, b) => a.y - b.y)

  actors.forEach((a) => drawAvatar(ctx, a.x, a.y, a.avatar, a.dir, a.walking, now))
  // The vignette dims the art, never the text on top of it.
  ctx.fillStyle = vignetteFor(ctx, view)
  ctx.fillRect(view.x, view.y, view.w, view.h)
  // Emotes go under the text so they never hide a name or a message.
  s.emotes.forEach((e) => {
    const a = actors.find((act) => act.uid === e.uid)
    if (a) drawEmote(ctx, a.x, a.y, e.emoji, (now - e.start) / EMOTE_MS)
  })
  // Label priority: you first, then your whisper partner, then everyone else.
  const rank = (a: Actor) => (a.isMe ? 0 : a.uid === props.partnerUid ? 1 : 2)
  const labels: LabelActor[] = [...actors]
    .sort((a, b) => rank(a) - rank(b))
    .map((a) => {
      const bubble = s.bubbles[a.uid]
      const typing = s.typing[a.uid]
      return {
        x: a.x,
        y: a.y,
        name: a.isMe ? `${a.name} (you)` : a.name,
        keep: rank(a) < 2,
        accent: a.isMe ? THEME.ember : a.uid === props.partnerUid ? THEME.dm : THEME.online,
        bubble: bubble ? { text: bubble.text, accent: bubble.accent } : typing ? { text: null, accent: typing.accent } : undefined,
      }
    })
  drawWorldLabels(ctx, labels, now, [], view)
}

export function WorldCanvas(props: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef(props)

  useEffect(() => {
    propsRef.current = props
  })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let map = renderMap()
    // Re-render once the web fonts arrive so zone labels use them.
    document.fonts?.ready.then(() => {
      map = renderMap()
    })
    ctx.imageSmoothingEnabled = false

    let frame = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = now - last
      last = now
      propsRef.current.sim.tick(dt, now)
      drawFrame(ctx, map, propsRef.current.sim.simRef.current, propsRef.current, now)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  const where = props.zoneName ? `You are in the ${props.zoneName}.` : 'You are outside in the town square.'
  return (
    <div className={`world${props.zoneName ? ' world--room' : ''}`}>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="world__canvas"
        role="img"
        aria-label={`Pixel Town map. ${where} Use arrow keys or WASD to walk.`}
      />
    </div>
  )
}
