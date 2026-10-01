import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { conversationKey, type ChatMessage, type Target } from '../../lib/conversation'
import { visibleMessages } from '../../lib/moderation'
import { zoneById } from '../../lib/world/map'
import { ACCENT_DM, useConversations, describe } from '../../hooks/useConversations'
import { useKeyboard } from '../../hooks/useKeyboard'
import { useDirectCall } from '../../hooks/useDirectCall'
import { useSafety, type Safety } from '../../hooks/useSafety'
import { useWorldSim, type RosterEntry } from '../../hooks/useWorldSim'
import type { Profile, TownTransport } from '../../transport'
import { CallPanel } from '../call/CallPanel'
import { DirectCallCard } from '../call/DirectCallCard'
import { ChatPanel } from '../chat/ChatPanel'
import { Hud } from '../hud/Hud'
import { AvatarPreview } from '../ui/AvatarPreview'
import { DPad } from '../world/DPad'
import { WorldCanvas } from '../world/WorldCanvas'
import './town.css'

interface TownProps {
  transport: TownTransport
  profile: Profile
  onLeave: () => void
}

export function Town({ transport, profile, onLeave }: TownProps) {
  const emoteRef = useRef<(index: number) => void>(() => {})
  const callKeyRef = useRef<() => void>(() => {})
  const input = useKeyboard(
    (i) => emoteRef.current(i),
    () => callKeyRef.current(),
  )
  const safety = useSafety(transport)
  const sim = useWorldSim({ transport, profile, held: input.held, blocked: safety.blockedRef })
  const { zone, partner, roster } = sim
  const [roomError, setRoomError] = useState<{ zoneId: string; message: string } | null>(null)
  const [readyRoom, setReadyRoom] = useState<string | null>(null)

  useEffect(() => {
    emoteRef.current = sim.emote
  }, [sim.emote])

  const roomTarget: Target | null = useMemo(() => (zone ? { kind: 'group', id: zone.guid } : null), [zone])
  const dmTarget: Target | null = useMemo(() => (partner ? { kind: 'user', id: partner.uid } : null), [partner])
  const activeKeys = useMemo(
    () => [roomTarget, dmTarget].filter((t): t is Target => t !== null).map(conversationKey),
    [roomTarget, dmTarget],
  )

  const chat = useConversations({ transport, profile, sim, activeKeys, blocked: safety.blockedRef })
  const inRoomCallRef = useRef(false)
  const [inRoomCall, setInRoomCall] = useState(false)
  const onRoomCallActive = useCallback((active: boolean) => {
    inRoomCallRef.current = active
    setInRoomCall(active)
  }, [])
  const call = useDirectCall({ transport, myUid: profile.uid, inRoomCall: inRoomCallRef, partner, blocked: safety.blockedRef })
  const canCall = transport.mode === 'cometchat'

  useEffect(() => {
    callKeyRef.current = () => {
      if (canCall && partner && call.state.kind === 'idle') void call.dial(partner)
    }
  }, [canCall, partner, call])

  // Show who's ringing you on the map, above their head.
  const { showBubble, hideBubble } = sim
  const ringingUid = call.state.kind === 'incoming' ? call.state.peer.uid : null
  useEffect(() => {
    if (!ringingUid) return
    showBubble(ringingUid, '📞 calling you…', ACCENT_DM)
    return () => hideBubble(ringingUid)
  }, [ringingUid, showBubble, hideBubble])
  const { loadHistory } = chat

  useEffect(() => {
    if (!zone || !roomTarget) return
    let cancelled = false
    transport
      .enterRoom(zone.guid, zone.name)
      .then(() => {
        if (cancelled) return
        setReadyRoom(zone.id)
        return loadHistory(roomTarget)
      })
      .catch((err: unknown) => {
        if (!cancelled) setRoomError({ zoneId: zone.id, message: `Couldn't open ${zone.name}: ${describe(err)}` })
      })
    return () => {
      cancelled = true
    }
  }, [zone, roomTarget, transport, loadHistory])

  useEffect(() => {
    if (dmTarget) loadHistory(dmTarget)
  }, [dmTarget, loadHistory])

  const nameOf = useMemo(() => {
    const map = new Map(roster.map((r) => [r.uid, r.name]))
    return (uid: string) => map.get(uid) ?? uid
  }, [roster])

  const typingFor = (target: Target | null) =>
    target
      ? (chat.typing[conversationKey(target)] ?? []).filter((u) => u !== profile.uid && !safety.blocked.has(u)).map(nameOf)
      : []

  const roomMates = zone ? roster.filter((r) => r.zone === zone.id) : []

  const shown = (target: Target): readonly ChatMessage[] =>
    visibleMessages(chat.messages[conversationKey(target)] ?? [], profile.uid, safety.blocked)
  const unread = chat.unread.filter((u) => !safety.blocked.has(u.uid))

  return (
    <div className="town">
      <Hud mode={transport.mode} zone={zone} onlineCount={roster.length} onEmote={sim.emote} onLeave={onLeave} />

      <main className="town__main">
        <div className="town__stage">
          <WorldCanvas
            sim={sim}
            myUid={profile.uid}
            myName={profile.name}
            myAvatar={profile.avatar}
            partnerUid={partner?.uid ?? null}
            zoneName={zone?.name ?? null}
          />
          <DPad press={input.press} release={input.release} />
          <p className="mono town__keys">
            <span className="town__key">
              <kbd>WASD</kbd>/
              <span className="town__arrows">
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                <kbd>←</kbd>
                <kbd>→</kbd>
              </span>{' '}
              walk
            </span>
            <span className="town__key">
              <kbd>1-5</kbd> emote
            </span>
            {canCall && (
              <span className="town__key">
                <kbd>C</kbd> call
              </span>
            )}
            <span className="town__key">walk up to someone to whisper</span>
          </p>
        </div>

        <aside className="town__side" aria-label="Conversations">
          {chat.error && (
            <p className="town__toast" role="alert">
              {chat.error}
              <button type="button" onClick={chat.dismissError} aria-label="Dismiss">
                ×
              </button>
            </p>
          )}
          <DirectCallCard uid={profile.uid} call={call} />
          {call.error && (
            <p className="town__toast" role="alert">
              {call.error}
              <button type="button" onClick={call.dismissError} aria-label="Dismiss">
                ×
              </button>
            </p>
          )}
          {safety.notice && (
            <p className="town__toast town__toast--info" role="status">
              {safety.notice}
              <button type="button" onClick={safety.dismissNotice} aria-label="Dismiss">
                ×
              </button>
            </p>
          )}
          {roomError && roomError.zoneId === zone?.id && (
            <p className="town__toast" role="alert">
              {roomError.message}
            </p>
          )}

          {unread.length > 0 && (
            <ul className="town__unread" aria-live="polite">
              {unread.map((u) => (
                <li key={u.key}>
                  💌 <strong>{u.name}</strong> whispered to you{u.count > 1 ? ` (${u.count})` : ''}. Walk over to reply.
                </li>
              ))}
            </ul>
          )}

          {zone && roomTarget && (
            <ChatPanel
              key={roomTarget.id}
              variant="room"
              eyebrow="Room chat"
              title={zone.name}
              subtitle={`${zone.blurb} · ${roomMates.length + 1} here`}
              messages={shown(roomTarget)}
              reasons={safety.reasons}
              onReport={safety.canReport ? safety.report : undefined}
              typingNames={typingFor(roomTarget)}
              myUid={profile.uid}
              placeholder={`Message ${zone.name}`}
              onSend={(text) => chat.send(roomTarget, text)}
              onTypingChange={(t) => (t ? transport.startTyping(roomTarget) : transport.endTyping(roomTarget))}
              disabled={readyRoom !== zone.id}
            >
              <CallPanel
                uid={profile.uid}
                sessionId={zone.guid}
                roomName={zone.name}
                available={transport.mode === 'cometchat'}
                busyReason={call.state.kind !== 'idle' ? 'Hang up your whisper call to join the room call.' : undefined}
                onActiveChange={onRoomCallActive}
              />
            </ChatPanel>
          )}

          {partner && dmTarget && (
            <ChatPanel
              key={dmTarget.id}
              variant="dm"
              eyebrow="Whisper · proximity DM"
              title={partner.name}
              subtitle="Only the two of you see this. Walk away to close it."
              messages={shown(dmTarget)}
              reasons={safety.reasons}
              onReport={safety.canReport ? safety.report : undefined}
              headerAction={
                <span className="chat__actions">
                  {canCall && call.state.kind === 'idle' && !inRoomCall && (
                    <button
                      type="button"
                      className="btn btn--sm"
                      title="Call (C)"
                      onClick={() => void call.dial(partner)}
                    >
                      📞 Call
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => void safety.block(partner.uid, partner.name)}
                  >
                    Block
                  </button>
                </span>
              }
              typingNames={typingFor(dmTarget)}
              myUid={profile.uid}
              placeholder={`Whisper to ${partner.name}`}
              onSend={(text) => chat.send(dmTarget, text)}
              onTypingChange={(t) => (t ? transport.startTyping(dmTarget) : transport.endTyping(dmTarget))}
            />
          )}

          {!zone && !partner && <Wander roster={roster} safety={safety} />}
        </aside>
      </main>
    </div>
  )
}

function Wander({ roster, safety }: { roster: readonly RosterEntry[]; safety: Safety }) {
  return (
    <section className="wander" aria-labelledby="wander-title">
      <div className="wander__hero">
        <h2 id="wander-title" className="display wander__title">
          Go for a <span>wander</span>
        </h2>
      </div>
      <ul className="wander__tips">
        <li>
          <span className="mono tip tip--dm">Whisper</span> Walk next to anyone. A private DM opens, and their typing
          shows as a bubble over their head.
        </li>
        <li>
          <span className="mono tip tip--room">Rooms</span> Step into the Café, War Room or Moon Garden to join that
          room's chat and video call.
        </li>
        <li>
          <span className="mono tip tip--emote">Emote</span> Press 1–5 to react.
        </li>
      </ul>

      <div className="wander__people">
        <h3 className="mono wander__subtitle">Townsfolk online · {roster.length}</h3>
        {roster.length === 0 ? (
          <p className="wander__empty">It's just you so far. Open a second window to invite yourself over.</p>
        ) : (
          <ul className="wander__roster">
            {roster.map((r) => (
              <li key={r.uid}>
                <AvatarPreview avatar={r.avatar} scale={1} />
                <span className="wander__name">{r.name}</span>
                <span className="wander__where">{zoneById(r.zone)?.name ?? 'town square'}</span>
              </li>
            ))}
          </ul>
        )}
        {safety.blocked.size > 0 && (
          <>
            <h3 className="mono wander__subtitle wander__subtitle--blocked">Blocked · {safety.blocked.size}</h3>
            <ul className="wander__roster">
              {[...safety.blocked].map((uid) => (
                <li key={uid}>
                  <span className="wander__name wander__name--blocked">{safety.nameOf(uid)}</span>
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => void safety.unblock(uid)}>
                    Unblock
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
