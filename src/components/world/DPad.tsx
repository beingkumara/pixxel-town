import type { InputController } from '../../hooks/useKeyboard'

const BUTTONS = [
  { code: 'ArrowUp', label: '▲' },
  { code: 'ArrowLeft', label: '◀' },
  { code: 'ArrowRight', label: '▶' },
  { code: 'ArrowDown', label: '▼' },
] as const

type DPadProps = Pick<InputController, 'press' | 'release'>

/** On-screen pad for touch devices; shown only on coarse pointers via CSS. */
export function DPad({ press, release }: DPadProps) {
  return (
    <div className="dpad" aria-hidden="true">
      {BUTTONS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          tabIndex={-1}
          data-dir={code}
          onPointerDown={() => press(code)}
          onPointerUp={() => release(code)}
          onPointerLeave={() => release(code)}
          onPointerCancel={() => release(code)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
