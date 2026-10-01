import { useState, type FormEvent } from 'react'
import { AVATARS } from '../world/sprites'
import { AvatarPreview } from '../ui/AvatarPreview'
import { MAX_NAME_LENGTH } from '../../lib/packet'
import { validateName } from '../../lib/uid'
import type { TransportMode } from '../../transport/types'
import { WorldPreview } from './WorldPreview'
import './lobby.css'

interface LobbyProps {
  initialName: string
  initialAvatar: number
  mode: TransportMode
  busy: boolean
  error: string | null
  onEnter: (name: string, avatar: number) => void
}

const HEADLINE = ['Chat that', 'lives', 'somewhere.'] as const

export function Lobby({ initialName, initialAvatar, mode, busy, error, onEnter }: LobbyProps) {
  const [name, setName] = useState(initialName)
  const [avatar, setAvatar] = useState(initialAvatar)
  const [nameError, setNameError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const result = validateName(name)
    if (!result.ok) return setNameError(result.error)
    setNameError(null)
    onEnter(result.name, avatar)
  }

  return (
    <div className="lobby">
      <header className="lobby__nav">
        <p className="display lobby__wordmark">
          Pixel<span>Town</span>
        </p>
        <p className="mono lobby__navlabel">Zero to Chat · built on CometChat</p>
        <p className={`mono lobby__status lobby__status--${mode}`}>
          <span aria-hidden="true" />
          {mode === 'cometchat' ? '● Live: CometChat realtime' : '◌ Local demo'}
        </p>
      </header>

      <main className="lobby__hero">
        <section className="lobby__copy" aria-labelledby="lobby-title">
          <p className="mono lobby__kicker">A town where chat has a place</p>
          <h1 id="lobby-title" className="display lobby__title">
            {HEADLINE.map((line, i) => (
              <span key={line} className="lobby__line" style={{ animationDelay: `${i * 90}ms` }}>
                {line}
              </span>
            ))}
            <span className="visually-hidden">Pixel Town</span>
          </h1>
          <p className="lobby__pitch">
            Walk up to someone and a private whisper opens. Step into a room to join its chat and video call. Walk away
            and it's over, like real life.
          </p>

          <form className="lobby__card" onSubmit={submit} noValidate>
            <label className="mono lobby__label" htmlFor="lobby-name">
              Your name
            </label>
            <input
              id="lobby-name"
              className="lobby__input"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="nickname"
              placeholder="What should the town call you?"
              autoFocus
              aria-invalid={nameError !== null}
              aria-describedby={nameError ? 'lobby-name-error' : undefined}
              onChange={(e) => setName(e.target.value)}
            />
            {nameError && (
              <p id="lobby-name-error" className="lobby__error" role="alert">
                {nameError}
              </p>
            )}

            <fieldset className="lobby__avatars">
              <legend className="mono lobby__label">Pick a townsperson</legend>
              {AVATARS.map((a, i) => (
                <label key={a.name} className={`lobby__avatar${i === avatar ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="avatar"
                    value={i}
                    checked={i === avatar}
                    onChange={() => setAvatar(i)}
                    className="visually-hidden"
                  />
                  <AvatarPreview avatar={i} walking={i === avatar} />
                  <span>{a.name}</span>
                </label>
              ))}
            </fieldset>

            <div className="lobby__actions">
              <button type="submit" className="btn btn--lg" disabled={busy}>
                {busy ? 'Opening the gates…' : 'Enter town →'}
              </button>
              {mode === 'local' && (
                <p className="lobby__hint">No CometChat credentials found. Tabs on this machine can still meet.</p>
              )}
            </div>
            {error && (
              <p className="lobby__error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>

        <section className="lobby__world" aria-label="Preview of the town">
          <div className="preview">
            <WorldPreview />
          </div>
          <p className="chip chip--dm">
            <span aria-hidden="true">💬</span> Proximity whispers
          </p>
          <p className="chip chip--room">
            <span aria-hidden="true">📹</span> Room chat + video
          </p>
          <p className="chip chip--online">
            <span className="chip__dot" aria-hidden="true" /> Live presence
          </p>
        </section>
      </main>

      <footer className="mono lobby__footer">
        <span>Chat SDK</span>
        <span>Transient messages</span>
        <span>Typing indicators</span>
        <span>Calls SDK v5</span>
        <span>CometChat MCP</span>
      </footer>
    </div>
  )
}
