import type { ChatMessage, Target } from '../lib/conversation'
import type { ReportReason } from '../lib/moderation'
import type { Packet } from '../lib/packet'

export interface Profile {
  readonly uid: string
  readonly name: string
  readonly avatar: number
}

export interface TypingEvent {
  readonly key: string
  readonly uid: string
  readonly typing: boolean
}

export interface TransportHandlers {
  onPacket(packet: Packet): void
  onMessage(message: ChatMessage): void
  onTyping(event: TypingEvent): void
  onPresence(uid: string, online: boolean): void
  /** A moderation verdict (CometChat onMessageModerated), carrying the whole message. */
  onModerated?(message: ChatMessage): void
}

export type TransportMode = 'cometchat' | 'local'

/**
 * Everything Pixel Town needs from a realtime backend. The CometChat
 * implementation is the real one; the local one lets the UI run offline.
 */
export interface TownTransport {
  readonly mode: TransportMode
  connect(profile: Profile): Promise<void>
  disconnect(): Promise<void>
  /** Fire-and-forget world state (positions, emotes). */
  broadcast(packet: Packet): void
  /** Join the persistent group chat that backs a room. */
  enterRoom(guid: string, name: string): Promise<void>
  sendText(target: Target, text: string): Promise<ChatMessage>
  fetchHistory(target: Target, limit: number): Promise<readonly ChatMessage[]>
  startTyping(target: Target): void
  endTyping(target: Target): void
  subscribe(handlers: TransportHandlers): () => void
  /** Flag reasons configured in the CometChat dashboard (may be empty). */
  getReportReasons(): Promise<readonly ReportReason[]>
  /** Sends a message to the dashboard's flagged-messages queue. */
  reportMessage(messageId: string, reasonId: string): Promise<void>
  blockPlayer(uid: string): Promise<void>
  unblockPlayer(uid: string): Promise<void>
  /** UIDs the current player has blocked. */
  fetchBlocked(): Promise<readonly string[]>
}
