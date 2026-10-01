import { EMOTES } from '../../lib/packet'
import type { Zone } from '../../lib/world/map'
import type { TransportMode } from '../../transport/types'
import './hud.css'

interface HudProps {
  mode: TransportMode
  zone: Zone | null
  onlineCount: number
  onEmote: (index: number) => void
  onLeave: () => void
}

export function Hud({ mode, zone, onlineCount, onEmote, onLeave }: HudProps) {
  return (
    <header className="hud">
      <p className="display hud__logo">
        Pixel<span>Town</span>
      </p>

      <p className={`mono hud__zone${zone ? ' hud__zone--room' : ''}`} aria-live="polite">
        {zone ? zone.name : 'Town square'}
      </p>

      <p className="hud__online">
        <span className="hud__dot" aria-hidden="true" /> {onlineCount + 1} online
      </p>

      <nav className="hud__emotes" aria-label="Emotes">
        {EMOTES.map((emoji, i) => (
          <button key={emoji} type="button" onClick={() => onEmote(i)} title={`Emote (key ${i + 1})`} aria-label={`Send ${emoji} emote`}>
            {emoji}
            <kbd>{i + 1}</kbd>
          </button>
        ))}
      </nav>

      <p className={`mono hud__mode hud__mode--${mode}`}>{mode === 'cometchat' ? 'CometChat live' : 'Local demo'}</p>

      <button type="button" className="btn btn--sm btn--ghost" onClick={onLeave}>
        Leave
      </button>
    </header>
  )
}
