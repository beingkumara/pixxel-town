import { useEffect, useRef } from 'react'
import { SPRITE_H, SPRITE_W, drawAvatar } from '../world/sprites'

interface AvatarPreviewProps {
  avatar: number
  scale?: number
  walking?: boolean
}

/** Tiny canvas rendering of a player sprite, for the lobby and roster. */
export function AvatarPreview({ avatar, scale = 2, walking = false }: AvatarPreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    let frame = 0
    const paint = (now: number) => {
      ctx.clearRect(0, 0, SPRITE_W + 8, SPRITE_H + 12)
      drawAvatar(ctx, (SPRITE_W + 8) / 2, SPRITE_H + 2, avatar, 'down', walking, now)
      if (walking) frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [avatar, walking])

  return (
    <canvas
      ref={ref}
      width={SPRITE_W + 8}
      height={SPRITE_H + 12}
      aria-hidden="true"
      style={{ width: (SPRITE_W + 8) * scale, height: (SPRITE_H + 12) * scale, imageRendering: 'pixelated' }}
    />
  )
}
