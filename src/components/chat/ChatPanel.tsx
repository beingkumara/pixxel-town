import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { ChatMessage } from '../../lib/conversation'
import type { ReportReason } from '../../lib/moderation'
import { MAX_MESSAGE_LENGTH } from '../../hooks/useConversations'
import { MessageItem } from './MessageItem'
import './chat.css'

const TYPING_IDLE_MS = 2000
/** Re-announce long typing streaks so the remote indicator doesn't time out. */
const TYPING_REFRESH_MS = 3000

interface ChatPanelProps {
  variant: 'dm' | 'room'
  eyebrow: string
  title: string
  subtitle?: string
  messages: readonly ChatMessage[]
  typingNames: readonly string[]
  myUid: string
  placeholder: string
  onSend: (text: string) => Promise<boolean>
  onTypingChange: (typing: boolean) => void
  /** While true (e.g. still joining the room's group) the composer is disabled. */
  disabled?: boolean
  /** Flag reasons for the report menu on other people's messages. */
  reasons: readonly ReportReason[]
  /** Absent when reporting isn't available for this app. */
  onReport?: (messageId: string, reasonId: string) => Promise<boolean>
  /** Extra control in the header (e.g. Block on a whisper). */
  headerAction?: ReactNode
  children?: ReactNode
}

export function ChatPanel(props: ChatPanelProps) {
  const { variant, messages, typingNames, myUid, onSend, onTypingChange } = props
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLOListElement>(null)
  const typingRef = useRef(false)
  const typingSentAt = useRef(0)
  const idleTimer = useRef<number | undefined>(undefined)
  const onTypingRef = useRef(onTypingChange)

  useEffect(() => {
    onTypingRef.current = onTypingChange
  }, [onTypingChange])

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages.length, typingNames.length])

  const stopTyping = () => {
    window.clearTimeout(idleTimer.current)
    if (typingRef.current) {
      typingRef.current = false
      onTypingRef.current(false)
    }
  }

  // Stop the indicator if the panel closes mid-sentence (e.g. you walk away).
  useEffect(() => stopTyping, [])

  const onChange = (value: string) => {
    setDraft(value)
    if (!value) return stopTyping()
    const now = Date.now()
    if (!typingRef.current || now - typingSentAt.current > TYPING_REFRESH_MS) {
      typingRef.current = true
      typingSentAt.current = now
      onTypingRef.current(true)
    }
    window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(stopTyping, TYPING_IDLE_MS)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || sending || props.disabled) return
    setSending(true)
    stopTyping()
    const ok = await onSend(draft)
    setSending(false)
    if (ok) setDraft('')
  }

  const inputId = `chat-input-${variant}`
  return (
    <section className={`chat chat--${variant}`} aria-label={`${props.eyebrow}: ${props.title}`}>
      <header className="chat__header">
        <p className="mono chat__eyebrow">{props.eyebrow}</p>
        <h2 className="display chat__title">{props.title}</h2>
        {props.subtitle && <p className="chat__subtitle">{props.subtitle}</p>}
        {props.headerAction && <div className="chat__action">{props.headerAction}</div>}
      </header>

      {props.children}

      <ol className="chat__list" ref={listRef} aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && <li className="chat__empty">No messages yet. Say hi 👋</li>}
        {messages.map((m) => {
          const mine = m.senderUid === myUid
          return (
            <MessageItem
              key={m.id}
              message={m}
              mine={mine}
              reasons={props.reasons}
              onReport={mine ? undefined : props.onReport}
            />
          )
        })}
      </ol>

      <p className="chat__typing" aria-live="polite">
        {typingNames.length > 0 ? `${typingNames.join(', ')} ${typingNames.length > 1 ? 'are' : 'is'} typing…` : ' '}
      </p>

      <form className="chat__composer" onSubmit={submit}>
        <label htmlFor={inputId} className="visually-hidden">
          {props.placeholder}
        </label>
        <input
          id={inputId}
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          autoComplete="off"
          placeholder={props.disabled ? 'Joining…' : props.placeholder}
          disabled={props.disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={stopTyping}
        />
        <button type="submit" className="btn" disabled={sending || props.disabled || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  )
}
