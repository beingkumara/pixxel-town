import { useState } from 'react'
import type { ChatMessage } from '../../lib/conversation'
import type { ReportReason } from '../../lib/moderation'

interface MessageItemProps {
  message: ChatMessage
  mine: boolean
  reasons: readonly ReportReason[]
  /** Absent when reporting isn't available (e.g. your own messages). */
  onReport?: (messageId: string, reasonId: string) => Promise<boolean>
}

const timeOf = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function MessageItem({ message: m, mine, reasons, onReport }: MessageItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [reported, setReported] = useState(false)
  const blocked = m.moderation === 'blocked'
  const pending = m.moderation === 'pending'

  const report = async (reasonId: string) => {
    if (!onReport) return
    setMenuOpen(false)
    if (await onReport(m.id, reasonId)) setReported(true)
  }

  const classes = ['chat__msg', mine && 'chat__msg--mine', pending && 'chat__msg--pending', blocked && 'chat__msg--blocked']
    .filter(Boolean)
    .join(' ')

  return (
    <li className={classes}>
      <span className="chat__meta">
        {mine ? 'you' : m.senderName} · {timeOf(m.sentAt)}
        {pending && ' · checking…'}
        {reported && ' · reported'}
      </span>
      <span className="chat__text">{blocked ? 'Blocked by moderation. Only you can see this.' : m.text}</span>
      {onReport && !reported && (
        <button
          type="button"
          className="chat__report"
          aria-label={`Report message from ${m.senderName}`}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          ⚑
        </button>
      )}
      {menuOpen && (
        <div className="chat__reasons" role="group" aria-label="Why are you reporting this?">
          {reasons.map((r) => (
            <button key={r.id} type="button" className="btn btn--sm btn--ghost" onClick={() => void report(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
    </li>
  )
}
