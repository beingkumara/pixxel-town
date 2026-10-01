import { keyForIncoming, type ChatMessage, type Target } from '../lib/conversation'
import { FALLBACK_REPORT_REASONS } from '../lib/moderation'
import { parsePacket, type Packet } from '../lib/packet'
import type { Profile, TownTransport, TransportHandlers } from './types'

/**
 * Offline stand-in for CometChat: tabs on the same origin talk over a
 * BroadcastChannel. Used when no credentials are configured, or with ?local=1.
 * No persistence and no calling — it exists so the town is explorable offline.
 */

type Envelope =
  | { kind: 'packet'; packet: Packet }
  | { kind: 'text'; from: Profile; target: Target; id: string; text: string; sentAt: number }
  | { kind: 'typing'; from: Profile; target: Target; typing: boolean }

const CHANNEL = 'pixel-town-local'

export function createLocalTransport(): TownTransport {
  let me: Profile | null = null
  let channel: BroadcastChannel | null = null
  const joinedRooms = new Set<string>()
  const history: ChatMessage[] = []
  let blocked: ReadonlySet<string> = new Set()
  const handlerSets = new Set<TransportHandlers>()
  const emit = (fn: (h: TransportHandlers) => void) => handlerSets.forEach(fn)

  const isForMe = (target: Target, self: Profile): boolean =>
    target.kind === 'user' ? target.id === self.uid : joinedRooms.has(target.id)

  const toMessage = (from: Profile, target: Target, id: string, text: string, sentAt: number, self: Profile): ChatMessage => ({
    id,
    key: keyForIncoming({ receiverType: target.kind, receiverId: target.id, senderUid: from.uid }, self.uid),
    senderUid: from.uid,
    senderName: from.name,
    text,
    sentAt,
    moderation: 'none',
  })

  function onEnvelope(env: Envelope) {
    const self = me
    if (!self) return
    if (env.kind === 'packet') {
      const packet = parsePacket(env.packet)
      if (packet && packet.uid !== self.uid) emit((h) => h.onPacket(packet))
      return
    }
    if (env.from.uid === self.uid || !isForMe(env.target, self)) return
    if (env.kind === 'text') {
      const message = toMessage(env.from, env.target, env.id, env.text, env.sentAt, self)
      history.push(message)
      emit((h) => h.onMessage(message))
      return
    }
    const key = keyForIncoming({ receiverType: env.target.kind, receiverId: env.target.id, senderUid: env.from.uid }, self.uid)
    emit((h) => h.onTyping({ key, uid: env.from.uid, typing: env.typing }))
  }

  const post = (env: Envelope) => channel?.postMessage(env)

  const requireMe = (): Profile => {
    if (!me) throw new Error('Not connected')
    return me
  }

  return {
    mode: 'local',

    async connect(profile) {
      me = profile
      channel = new BroadcastChannel(CHANNEL)
      channel.onmessage = (e: MessageEvent<Envelope>) => onEnvelope(e.data)
    },

    async disconnect() {
      if (me) post({ kind: 'packet', packet: { t: 'bye', uid: me.uid } })
      channel?.close()
      channel = null
      me = null
    },

    broadcast(packet) {
      post({ kind: 'packet', packet })
    },

    async enterRoom(guid) {
      joinedRooms.add(guid)
    },

    async sendText(target, text) {
      const self = requireMe()
      const id = crypto.randomUUID()
      const sentAt = Date.now()
      post({ kind: 'text', from: self, target, id, text, sentAt })
      const message = toMessage(self, target, id, text, sentAt, self)
      history.push(message)
      return message
    },

    async fetchHistory(target, limit) {
      const self = requireMe()
      const key = keyForIncoming({ receiverType: target.kind, receiverId: target.id, senderUid: self.uid }, self.uid)
      return history.filter((m) => m.key === key).slice(-limit)
    },

    startTyping(target) {
      if (me) post({ kind: 'typing', from: me, target, typing: true })
    },

    endTyping(target) {
      if (me) post({ kind: 'typing', from: me, target, typing: false })
    },

    subscribe(handlers) {
      handlerSets.add(handlers)
      return () => handlerSets.delete(handlers)
    },

    // No dashboard offline: reports are accepted but go nowhere, and blocks last for this tab.
    async getReportReasons() {
      return FALLBACK_REPORT_REASONS
    },

    async reportMessage() {},

    async blockPlayer(uid) {
      blocked = new Set(blocked).add(uid)
    },

    async unblockPlayer(uid) {
      blocked = new Set([...blocked].filter((u) => u !== uid))
    },

    async fetchBlocked() {
      return [...blocked]
    },

    // Calls need the real CometChat backend.
    async dialCall() {
      throw new Error('Whisper calls need CometChat credentials (.env.local)')
    },
    async acceptCall() {},
    async declineCall() {},
    async endCall() {},
  }
}
