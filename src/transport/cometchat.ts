import { CometChat } from '@cometchat/chat-sdk-javascript'
import { COMETCHAT } from '../config'
import { MAX_MESSAGE_LENGTH, keyForIncoming, type ChatMessage, type Target } from '../lib/conversation'
import { blockSucceeded, toModeration, type ReportReason } from '../lib/moderation'
import { parsePacket, sanitizeName, type Packet } from '../lib/packet'
import { WORLD_GUID } from '../lib/world/map'
import type { CallSignal, DeclineReason, Profile, TownTransport, TransportHandlers } from './types'

/*
 * Built from the CometChat MCP bundles `js-sdk-messaging-basics` and
 * `presence-and-typing`, plus the "Transient Messages", "Create/Join Group"
 * and "User Management" doc pages fetched through the MCP.
 */

const LISTENER_ID = 'pixel-town'

const errorCode = (err: unknown): string =>
  typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : ''

const receiverTypeFor = (target: Target): string =>
  target.kind === 'group' ? CometChat.RECEIVER_TYPE.GROUP : CometChat.RECEIVER_TYPE.USER

let initPromise: Promise<boolean> | null = null

function initOnce(): Promise<boolean> {
  if (!initPromise) {
    const settings = new CometChat.AppSettingsBuilder()
      .subscribePresenceForAllUsers()
      .setRegion(COMETCHAT.REGION)
      .autoEstablishSocketConnection(true)
      .build()
    initPromise = CometChat.init(COMETCHAT.APP_ID, settings).catch((err: unknown) => {
      initPromise = null
      throw err
    })
  }
  return initPromise
}

async function loginOrCreate(profile: Profile): Promise<void> {
  const current = await CometChat.getLoggedinUser()
  if (current?.getUid() === profile.uid) return
  if (current) await CometChat.logout()

  try {
    await CometChat.login(profile.uid, COMETCHAT.AUTH_KEY)
  } catch (err) {
    if (errorCode(err) !== 'ERR_UID_NOT_FOUND') throw err
    const user = new CometChat.User(profile.uid)
    user.setName(profile.name)
    user.setMetadata({ avatar: profile.avatar })
    await CometChat.createUser(user, COMETCHAT.AUTH_KEY)
    await CometChat.login(profile.uid, COMETCHAT.AUTH_KEY)
  }
}

async function ensureJoined(guid: string, name: string): Promise<void> {
  try {
    await CometChat.joinGroup(guid, CometChat.GroupType.Public, '')
    return
  } catch (err) {
    const code = errorCode(err)
    if (code === 'ERR_ALREADY_JOINED') return
    if (code !== 'ERR_GUID_NOT_FOUND') throw err
  }
  try {
    // The creator is joined automatically.
    await CometChat.createGroup(new CometChat.Group(guid, name, CometChat.GROUP_TYPE.PUBLIC, ''))
  } catch (err) {
    // Someone else created it between our join and create; join theirs.
    const code = errorCode(err)
    if (code !== 'ERR_GUID_ALREADY_EXISTS' && code !== 'ERR_ALREADY_JOINED') throw err
    await CometChat.joinGroup(guid, CometChat.GroupType.Public, '').catch((joinErr: unknown) => {
      if (errorCode(joinErr) !== 'ERR_ALREADY_JOINED') throw joinErr
    })
  }
}

function toChatMessage(msg: CometChat.TextMessage, myUid: string): ChatMessage {
  const sender = msg.getSender()
  return {
    id: String(msg.getId()),
    key: keyForIncoming(
      { receiverType: msg.getReceiverType(), receiverId: msg.getReceiverId(), senderUid: sender.getUid() },
      myUid,
    ),
    senderUid: sender.getUid(),
    senderName: sanitizeName(sender.getName() ?? '') || sender.getUid(),
    // Other clients can bypass our input's maxLength, so cap on receipt too.
    text: msg.getText().slice(0, MAX_MESSAGE_LENGTH),
    sentAt: (msg.getSentAt() || Math.floor(Date.now() / 1000)) * 1000,
    moderation: toModeration(msg.getModerationStatus?.()),
  }
}

const BLOCKED_PAGE = 100
/** Seconds an unanswered whisper call rings before CometChat cancels it (default is 45). */
const RING_TIMEOUT_S = 30
const BLOCKED_MAX_PAGES = 10

export function createCometChatTransport(): TownTransport {
  let me: Profile | null = null
  const handlerSets = new Set<TransportHandlers>()
  const emit = (fn: (h: TransportHandlers) => void) => handlerSets.forEach(fn)

  const requireMe = (): Profile => {
    if (!me) throw new Error('Not connected to CometChat yet')
    return me
  }

  function attachListeners(myUid: string) {
    CometChat.addMessageListener(
      LISTENER_ID,
      new CometChat.MessageListener({
        onTextMessageReceived: (msg: CometChat.TextMessage) => emit((h) => h.onMessage(toChatMessage(msg, myUid))),
        onTransientMessageReceived: (tm: CometChat.TransientMessage) => {
          const packet = parsePacket(tm.getData())
          // Reject packets that claim to be from someone other than the real sender.
          if (!packet || packet.uid !== tm.getSender()?.getUid() || packet.uid === myUid) return
          emit((h) => h.onPacket(packet))
        },
        onMessageModerated: (m: CometChat.BaseMessage) => {
          // Pixel Town only sends text, so only text verdicts matter here.
          if (!(m instanceof CometChat.TextMessage)) return
          const message = toChatMessage(m, myUid)
          emit((h) => h.onModerated?.(message))
        },
        onTypingStarted: (t: CometChat.TypingIndicator) => emitTyping(t, true),
        onTypingEnded: (t: CometChat.TypingIndicator) => emitTyping(t, false),
      }),
    )
    // Ringing for 1:1 whisper calls, per the MCP's /calls/javascript/ringing guide.
    const signal = (s: CallSignal) => emit((h) => h.onCallSignal?.(s))
    CometChat.addCallListener(
      LISTENER_ID,
      new CometChat.CallListener({
        onIncomingCallReceived: (call: CometChat.Call) => {
          if (call.getReceiverType() !== CometChat.RECEIVER_TYPE.USER) return
          const from = call.getCallInitiator()
          const peer = { uid: from.getUid(), name: sanitizeName(from.getName() ?? '') || from.getUid() }
          signal({ type: 'incoming', sessionId: call.getSessionId(), peer })
        },
        onOutgoingCallAccepted: (call: CometChat.Call) => signal({ type: 'accepted', sessionId: call.getSessionId() }),
        onOutgoingCallRejected: (call: CometChat.Call) => signal({ type: 'over', sessionId: call.getSessionId() }),
        onIncomingCallCancelled: (call: CometChat.Call) => signal({ type: 'over', sessionId: call.getSessionId() }),
        onCallEndedMessageReceived: (call: CometChat.Call) => signal({ type: 'over', sessionId: call.getSessionId() }),
      }),
    )
    CometChat.addUserListener(
      LISTENER_ID,
      new CometChat.UserListener({
        onUserOnline: (u: CometChat.User) => emit((h) => h.onPresence(u.getUid(), true)),
        onUserOffline: (u: CometChat.User) => emit((h) => h.onPresence(u.getUid(), false)),
      }),
    )

    function emitTyping(t: CometChat.TypingIndicator, typing: boolean) {
      const uid = t.getSender().getUid()
      const key = keyForIncoming({ receiverType: t.getReceiverType(), receiverId: t.getReceiverId(), senderUid: uid }, myUid)
      emit((h) => h.onTyping({ key, uid, typing }))
    }
  }

  return {
    mode: 'cometchat',

    async connect(profile) {
      await initOnce()
      await loginOrCreate(profile)
      await ensureJoined(WORLD_GUID, 'Pixel Town')
      me = profile
      attachListeners(profile.uid)
    },

    async disconnect() {
      if (me) this.broadcast({ t: 'bye', uid: me.uid })
      CometChat.removeMessageListener(LISTENER_ID)
      CometChat.removeUserListener(LISTENER_ID)
      CometChat.removeCallListener(LISTENER_ID)
      me = null
    },

    broadcast(packet: Packet) {
      if (!me) return
      const tm = new CometChat.TransientMessage(WORLD_GUID, CometChat.RECEIVER_TYPE.GROUP, packet)
      CometChat.sendTransientMessage(tm)
    },

    enterRoom: ensureJoined,

    async sendText(target, text) {
      const self = requireMe()
      const outgoing = new CometChat.TextMessage(target.id, text, receiverTypeFor(target))
      const sent = (await CometChat.sendMessage(outgoing)) as CometChat.TextMessage
      return toChatMessage(sent, self.uid)
    },

    async fetchHistory(target, limit) {
      const self = requireMe()
      const base = new CometChat.MessagesRequestBuilder()
        .setLimit(limit)
        .setCategories([CometChat.CATEGORY_MESSAGE])
        .setTypes([CometChat.MESSAGE_TYPE.TEXT])
      const builder = target.kind === 'group' ? base.setGUID(target.id) : base.setUID(target.id)
      const list: readonly CometChat.BaseMessage[] = await builder.build().fetchPrevious()
      return list
        .filter((m): m is CometChat.TextMessage => m instanceof CometChat.TextMessage)
        .map((m) => toChatMessage(m, self.uid))
    },

    async getReportReasons() {
      const reasons = await CometChat.getFlagReasons()
      return reasons.map((r): ReportReason => ({ id: r.id, label: r.name || r.id }))
    },

    async reportMessage(messageId, reasonId) {
      await CometChat.flagMessage(messageId, { reasonId })
    },

    // blockUsers/unblockUsers report per-UID success instead of rejecting (see blockSucceeded).
    async blockPlayer(uid) {
      if (!blockSucceeded(await CometChat.blockUsers([uid]), uid)) throw new Error('CometChat refused the block')
    },

    async unblockPlayer(uid) {
      if (!blockSucceeded(await CometChat.unblockUsers([uid]), uid)) throw new Error('CometChat refused the unblock')
    },

    async fetchBlocked() {
      const request = new CometChat.BlockedUsersRequestBuilder()
        .setLimit(BLOCKED_PAGE)
        .setDirection(CometChat.BlockedUsersRequest.directions.BLOCKED_BY_ME)
        .build()
      const uids: string[] = []
      for (let page = 0; page < BLOCKED_MAX_PAGES; page++) {
        const users: readonly CometChat.User[] = await request.fetchNext()
        uids.push(...users.map((u) => u.getUid()))
        if (users.length < BLOCKED_PAGE) break
      }
      return uids
    },

    async dialCall(uid) {
      const call = new CometChat.Call(uid, CometChat.CALL_TYPE.VIDEO, CometChat.RECEIVER_TYPE.USER)
      const outgoing = await CometChat.initiateCall(call, RING_TIMEOUT_S)
      return outgoing.getSessionId()
    },

    async acceptCall(sessionId) {
      await CometChat.acceptCall(sessionId)
    },

    async declineCall(sessionId, reason: DeclineReason) {
      const status = {
        rejected: CometChat.CALL_STATUS.REJECTED,
        cancelled: CometChat.CALL_STATUS.CANCELLED,
        busy: CometChat.CALL_STATUS.BUSY,
      }[reason]
      await CometChat.rejectCall(sessionId, status)
    },

    async endCall(sessionId) {
      await CometChat.endCall(sessionId)
    },

    startTyping(target) {
      CometChat.startTyping(new CometChat.TypingIndicator(target.id, receiverTypeFor(target)))
    },

    endTyping(target) {
      CometChat.endTyping(new CometChat.TypingIndicator(target.id, receiverTypeFor(target)))
    },

    subscribe(handlers) {
      handlerSets.add(handlers)
      return () => handlerSets.delete(handlers)
    },
  }
}
