export interface Target {
  readonly kind: 'user' | 'group'
  readonly id: string
}

export interface ChatMessage {
  readonly id: string
  /** Conversation key, see {@link conversationKey}. */
  readonly key: string
  readonly senderUid: string
  readonly senderName: string
  readonly text: string
  /** Unix milliseconds. */
  readonly sentAt: number
}

export type MessageMap = Readonly<Record<string, readonly ChatMessage[]>>

export const MAX_MESSAGES_PER_CONVERSATION = 100
export const MAX_MESSAGE_LENGTH = 500

export const conversationKey = (target: Target): string => `${target.kind}:${target.id}`

export interface IncomingRouting {
  readonly receiverType: string
  readonly receiverId: string
  readonly senderUid: string
}

export function keyForIncoming(r: IncomingRouting, myUid: string): string {
  if (r.receiverType === 'group') return conversationKey({ kind: 'group', id: r.receiverId })
  const other = r.senderUid === myUid ? r.receiverId : r.senderUid
  return conversationKey({ kind: 'user', id: other })
}

export function appendMessage(state: MessageMap, message: ChatMessage): MessageMap {
  return mergeMessages(state, message.key, [message])
}

export function mergeMessages(state: MessageMap, key: string, incoming: readonly ChatMessage[]): MessageMap {
  const existing = state[key] ?? []
  const seen = new Set(existing.map((m) => m.id))
  const fresh = incoming.filter((m) => !seen.has(m.id))
  if (fresh.length === 0 && key in state) return state
  const merged = [...existing, ...fresh]
    .sort((a, b) => a.sentAt - b.sentAt)
    .slice(-MAX_MESSAGES_PER_CONVERSATION)
  return { ...state, [key]: merged }
}
