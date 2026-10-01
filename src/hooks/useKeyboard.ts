import { useEffect, useRef, type RefObject } from 'react'
import type { MoveInput } from '../lib/world/movement'

const KEY_VECTORS: Readonly<Record<string, MoveInput>> = {
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  KeyW: { dx: 0, dy: -1 },
  KeyS: { dx: 0, dy: 1 },
  KeyA: { dx: -1, dy: 0 },
  KeyD: { dx: 1, dy: 0 },
}

const isTypingTarget = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)

export interface InputController {
  /** Currently held movement codes (keyboard + on-screen pad). */
  readonly held: RefObject<Set<string>>
  press(code: string): void
  release(code: string): void
}

export function readInput(held: ReadonlySet<string>): MoveInput {
  let dx = 0
  let dy = 0
  held.forEach((code) => {
    const v = KEY_VECTORS[code]
    if (v) {
      dx += v.dx
      dy += v.dy
    }
  })
  return { dx: Math.sign(dx), dy: Math.sign(dy) }
}

/**
 * Tracks movement keys, ignoring keystrokes aimed at chat inputs.
 * Digit keys 1–5 trigger `onDigit` (used for emotes).
 */
export function useKeyboard(onDigit: (index: number) => void, onCallKey?: () => void): InputController {
  const held = useRef<Set<string>>(new Set())
  const onDigitRef = useRef(onDigit)
  const onCallRef = useRef(onCallKey)

  useEffect(() => {
    onDigitRef.current = onDigit
    onCallRef.current = onCallKey
  }, [onDigit, onCallKey])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.code in KEY_VECTORS) {
        e.preventDefault()
        held.current = new Set(held.current).add(e.code)
        return
      }
      if (e.code === 'KeyC' && !e.repeat) {
        onCallRef.current?.()
        return
      }
      const digit = /^Digit([1-5])$/.exec(e.code)
      if (digit && !e.repeat) onDigitRef.current(Number(digit[1]) - 1)
    }
    const up = (e: KeyboardEvent) => {
      if (!held.current.has(e.code)) return
      const next = new Set(held.current)
      next.delete(e.code)
      held.current = next
    }
    const clear = () => {
      held.current = new Set()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

  return {
    held,
    press: (code) => {
      held.current = new Set(held.current).add(code)
    },
    release: (code) => {
      const next = new Set(held.current)
      next.delete(code)
      held.current = next
    },
  }
}
