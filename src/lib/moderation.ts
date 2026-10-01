import { mergeMessages, type ChatMessage, type MessageMap, type Moderation } from './conversation'

/*
 * Built from the CometChat MCP: bundle `moderation-setup` plus the doc pages
 * /sdk/javascript/ai-moderation and /sdk/javascript/flag-message.
 * Rules are switched on in the CometChat dashboard; this module only reacts to
 * the verdicts, so it works (as a no-op) on apps without moderation enabled.
 */

export interface ModerationUpdate {
  readonly id: string
  readonly key: string
  readonly moderation: Moderation
}

/** A reason a player can give when reporting a message (CometChat flag reasons). */
export interface ReportReason {
  readonly id: string
  readonly label: string
}

/** Shown when the dashboard has no flag reasons configured (ids match CometChat's defaults). */
export const FALLBACK_REPORT_REASONS: readonly ReportReason[] = [
  { id: 'spam', label: 'Spam or misleading' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Other' },
]

/** True for CometChat's "Moderation feature is not available… upgrade your plan" errors. */
export function isPlanUnavailable(message: string): boolean {
  return /not available/i.test(message) && /(plan|upgrade)/i.test(message)
}

/** Maps CometChat.ModerationStatus values onto our states. Unknown statuses fail closed. */
export function toModeration(status: unknown): Moderation {
  switch (status) {
    case undefined:
    case null:
    case '':
    case 'unmoderated':
      return 'none'
    case 'approved':
      return 'approved'
    case 'disapproved':
      return 'blocked'
    default:
      return 'pending'
  }
}

/**
 * CometChat.blockUsers/unblockUsers report per-UID results instead of rejecting. SDK 4.2 returns
 * { [uid]: { success: true, message } } (observed live); the docs describe { [uid]: 'success' }.
 */
export function blockSucceeded(result: unknown, uid: string): boolean {
  if (typeof result !== 'object' || result === null) return false
  const entry = (result as Record<string, unknown>)[uid]
  if (entry === 'success') return true
  return typeof entry === 'object' && entry !== null && (entry as { success?: unknown }).success === true
}

export function applyModeration(state: MessageMap, update: ModerationUpdate): MessageMap {
  const list = state[update.key]
  if (!list) return state
  const index = list.findIndex((m) => m.id === update.id)
  if (index === -1 || list[index].moderation === update.moderation) return state
  const next = list.map((m, i) => (i === index ? { ...m, moderation: update.moderation } : m))
  return { ...state, [update.key]: next }
}

/**
 * Applies a verdict carrying the whole message. If the verdict beat the message itself
 * (common with fast AI moderation), the message is inserted with its final status.
 */
export function applyVerdict(state: MessageMap, message: ChatMessage): MessageMap {
  const known = state[message.key]?.some((m) => m.id === message.id)
  return known
    ? applyModeration(state, { id: message.id, key: message.key, moderation: message.moderation })
    : mergeMessages(state, message.key, [message])
}

/**
 * What a player should see: their own messages in any state (so they learn when something
 * was blocked), others' messages only once they pass moderation, and nothing from people
 * they've blocked.
 */
export function visibleMessages(
  list: readonly ChatMessage[],
  myUid: string,
  blocked: ReadonlySet<string>,
): readonly ChatMessage[] {
  return list.filter((m) => {
    if (m.senderUid === myUid) return true
    if (blocked.has(m.senderUid)) return false
    return m.moderation === 'approved' || m.moderation === 'none'
  })
}

export function withoutBlocked<T>(players: Readonly<Record<string, T>>, blocked: ReadonlySet<string>): Readonly<Record<string, T>> {
  if (blocked.size === 0 || !Object.keys(players).some((uid) => blocked.has(uid))) return players
  return Object.fromEntries(Object.entries(players).filter(([uid]) => !blocked.has(uid)))
}
