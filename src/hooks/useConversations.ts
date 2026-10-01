import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MAX_MESSAGE_LENGTH,
  appendMessage,
  conversationKey,
  mergeMessages,
  type ChatMessage,
  type MessageMap,
  type Target,
} from '../lib/conversation'
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
  sim: Pick<WorldSim, 'showBubble' | 'setTyping'>
  /** Keys the player is currently "in" — only these produce map bubbles. */
  activeKeys: readonly string[]
}

export interface UnreadWhisper {
  readonly key: string
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

export function useConversations({ transport, profile, sim, activeKeys }: Options) {
  const [messages, setMessages] = useState<MessageMap>({})
  const [typing, setTypingMap] = useState<TypingMap>({})
  const [error, setError] = useState<string | null>(null)
  const [unread, setUnread] = useState<Readonly<Record<string, UnreadWhisper>>>({})
  const [seenActive, setSeenActive] = useState(activeKeys)
  const loaded = useRef<Set<string>>(new Set())
  const activeRef = useRef(activeKeys)

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

  const { showBubble, setTyping } = sim

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
        if (activeRef.current.includes(message.key)) {
          showBubble(message.senderUid, message.text, accentForKey(message.key))
        } else if (message.key.startsWith('user:') && message.senderUid !== profile.uid) {
          // Proximity is decided per client, so a whisper can arrive while its panel is closed.
          setUnread((prev) => ({
            ...prev,
            [message.key]: { key: message.key, name: message.senderName, count: (prev[message.key]?.count ?? 0) + 1 },
          }))
        }
      },
      onTyping: ({ key, uid, typing: isTyping }) => {
        setTypingMap((prev) => withTyping(prev, key, uid, isTyping))
        if (activeRef.current.includes(key)) setTyping(uid, isTyping ? accentForKey(key) : null)
      },
    })
  }, [transport, profile.uid, showBubble, setTyping])

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
        const message = await transport.sendText(target, text)
        setMessages((prev) => appendMessage(prev, message))
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
