import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  MAX_MESSAGE_LENGTH,
  appendMessage,
  conversationKey,
  mergeMessages,
  type ChatMessage,
  type MessageMap,
  type Target,
} from '../lib/conversation'
import { applyVerdict } from '../lib/moderation'
import { THEME } from '../lib/theme'
import type { Profile, TownTransport } from '../transport'
import type { WorldSim } from './useWorldSim'

const HISTORY_LIMIT = 30

export { MAX_MESSAGE_LENGTH }

export const ACCENT_DM = THEME.dm
export const ACCENT_ROOM = THEME.room

const accentForKey = (key: string): string => (key.startsWith('group:') ? ACCENT_ROOM : ACCENT_DM)

/** uid → typing, grouped by conversation key. */
export type TypingMap = Readonly<Record<string, readonly string[]>>

interface Options {
  transport: TownTransport
  profile: Profile
  sim: Pick<WorldSim, 'showBubble' | 'hideBubble' | 'setTyping'>
  /** Keys the player is currently "in" — only these produce map bubbles. */
  activeKeys: readonly string[]
  /** Players this user blocked (see useSafety). */
  blocked: RefObject<ReadonlySet<string>>
}

/** Others' messages only surface once moderation lets them through. */
const isCleared = (m: ChatMessage): boolean => m.moderation === 'none' || m.moderation === 'approved'

export interface UnreadWhisper {
  readonly key: string
  readonly uid: string
  readonly name: string
  readonly count: number
}

const withoutTypist = (state: TypingMap, uid: string): TypingMap =>
  Object.values(state).some((list) => list.includes(uid))
    ? Object.fromEntries(Object.entries(state).map(([k, list]) => [k, list.filter((u) => u !== uid)]))
    : state

const withTyping = (state: TypingMap, key: string, uid: string, typing: boolean): TypingMap => {
  const current = state[key] ?? []
  const has = current.includes(uid)
  if (typing === has) return state
  return { ...state, [key]: typing ? [...current, uid] : current.filter((u) => u !== uid) }
}

export function useConversations({ transport, profile, sim, activeKeys, blocked }: Options) {
  const [messages, setMessages] = useState<MessageMap>({})
  const [typing, setTypingMap] = useState<TypingMap>({})
  const [error, setError] = useState<string | null>(null)
  const [unread, setUnread] = useState<Readonly<Record<string, UnreadWhisper>>>({})
  const [seenActive, setSeenActive] = useState(activeKeys)
  const loaded = useRef<Set<string>>(new Set())
  const activeRef = useRef(activeKeys)
  /** Verdicts seen so far, so a reply from sendText can't resurrect a stale 'pending'. */
  const verdicts = useRef<ReadonlyMap<string, ChatMessage['moderation']>>(new Map())
  /** Shows someone else's cleared message: a map bubble if you're in that chat, else an unread notice. */
  const surfaceRef = useRef<(m: ChatMessage) => void>(() => {})

  // Opening a conversation marks it read (state adjusted during render, per React docs).
  if (seenActive !== activeKeys) {
    setSeenActive(activeKeys)
    if (activeKeys.some((k) => k in unread)) {
      setUnread((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !activeKeys.includes(k))))
    }
  }

  useEffect(() => {
    activeRef.current = activeKeys
  }, [activeKeys])


  const { showBubble, hideBubble, setTyping } = sim

  useEffect(() => {
    surfaceRef.current = (m: ChatMessage) => {
      if (blocked.current.has(m.senderUid) || !isCleared(m)) return
      if (activeRef.current.includes(m.key)) {
        showBubble(m.senderUid, m.text, accentForKey(m.key))
      } else if (m.key.startsWith('user:')) {
        // Proximity is decided per client, so a whisper can arrive while its panel is closed.
        setUnread((prev) => ({
          ...prev,
          [m.key]: { key: m.key, uid: m.senderUid, name: m.senderName, count: (prev[m.key]?.count ?? 0) + 1 },
        }))
      }
    }
  }, [blocked, showBubble])

  useEffect(() => {
    return transport.subscribe({
      // Someone who leaves mid-sentence never sends endTyping; clear them everywhere.
      onPacket: (packet) => {
        if (packet.t === 'bye') setTypingMap((prev) => withoutTypist(prev, packet.uid))
      },
      onPresence: (uid, online) => {
        if (!online) setTypingMap((prev) => withoutTypist(prev, uid))
      },
      onMessage: (message: ChatMessage) => {
        setMessages((prev) => appendMessage(prev, message))
        setTypingMap((prev) => withTyping(prev, message.key, message.senderUid, false))
        if (message.senderUid !== profile.uid) surfaceRef.current(message)
      },
      onModerated: (message: ChatMessage) => {
        verdicts.current = new Map(verdicts.current).set(message.id, message.moderation)
        setMessages((prev) => applyVerdict(prev, message))
        if (message.senderUid === profile.uid) {
          if (message.moderation === 'blocked') {
            hideBubble(profile.uid)
            setError('Your message was blocked by moderation.')
          }
          return
        }
        // Someone else's message just cleared moderation: surface it now.
        if (message.moderation === 'approved') surfaceRef.current(message)
      },
      onTyping: ({ key, uid, typing: isTyping }) => {
        if (blocked.current.has(uid)) return
        setTypingMap((prev) => withTyping(prev, key, uid, isTyping))
        if (activeRef.current.includes(key)) setTyping(uid, isTyping ? accentForKey(key) : null)
      },
    })
  }, [transport, profile.uid, blocked, showBubble, hideBubble, setTyping])

  const loadHistory = useCallback(
    async (target: Target) => {
      const key = conversationKey(target)
      if (loaded.current.has(key)) return
      loaded.current = new Set(loaded.current).add(key)
      try {
        const history = await transport.fetchHistory(target, HISTORY_LIMIT)
        setMessages((prev) => mergeMessages(prev, key, history))
      } catch (err) {
        const next = new Set(loaded.current)
        next.delete(key)
        loaded.current = next
        setError(`Couldn't load chat history: ${describe(err)}`)
      }
    },
    [transport],
  )

  const send = useCallback(
    async (target: Target, raw: string): Promise<boolean> => {
      const text = raw.trim().slice(0, MAX_MESSAGE_LENGTH)
      if (!text) return false
      try {
        const sent = await transport.sendText(target, text)
        const message = { ...sent, moderation: verdicts.current.get(sent.id) ?? sent.moderation }
        setMessages((prev) => appendMessage(prev, message))
        if (message.moderation === 'blocked') {
          setError('Your message was blocked by moderation.')
          return true
        }
        showBubble(profile.uid, text, accentForKey(message.key))
        setError(null)
        return true
      } catch (err) {
        setError(`Message not sent: ${describe(err)}`)
        return false
      }
    },
    [transport, profile.uid, showBubble],
  )

  return { messages, typing, unread: Object.values(unread), error, dismissError: () => setError(null), loadHistory, send }
}

export function describe(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null) {
    const e = err as { message?: unknown; code?: unknown }
    if (typeof e.message === 'string') return e.message
    if (typeof e.code === 'string') return e.code
  }
  return 'unexpected error'
}
