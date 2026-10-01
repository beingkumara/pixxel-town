import { useCallback, useEffect, useReducer, useRef, useState, type RefObject } from 'react'
import { IDLE, callReducer, isBusy, type CallEvent, type CallPeer, type DirectCallState } from '../lib/directCall'
import type { TownTransport } from '../transport'
import { describe } from './useConversations'
import type { Partner } from './useWorldSim'

/** How long the other person can be out of whisper range before the call ends. */
const WALK_AWAY_GRACE_MS = 1500

interface Options {
  transport: TownTransport
  myUid: string
  /** True while this player is in a room's shared call (the Calls SDK holds one session). */
  inRoomCall: RefObject<boolean>
  /** Who you're standing next to right now (null when nobody is in range). */
  partner: Partner | null
  blocked: RefObject<ReadonlySet<string>>
}

/**
 * Side effects for 1:1 whisper calls (state machine in lib/directCall.ts). Signalling is the
 * Chat SDK ringing flow; the Calls SDK media session is joined by DirectCallCard.
 */
export function useDirectCall({ transport, myUid, inRoomCall, partner, blocked }: Options) {
  const [state, setState] = useReducer(callReducer, IDLE)
  const [error, setError] = useState<string | null>(null)
  const stateRef = useRef<DirectCallState>(IDLE)
  /** accepted/over signals that beat initiateCall's response, replayed once we know our session id. */
  const early = useRef<ReadonlyMap<string, 'accepted' | 'over'>>(new Map())
  const acceptRef = useRef<() => Promise<void>>(async () => {})

  /** Keeps the ref in step synchronously, so async callbacks see the latest state. */
  const dispatch = useCallback((event: CallEvent) => {
    stateRef.current = callReducer(stateRef.current, event)
    setState(event)
  }, [])

  useEffect(() => {
    return transport.subscribe({
      onPacket: () => {},
      onMessage: () => {},
      onTyping: () => {},
      onPresence: () => {},
      onCallSignal: (signal) => {
        const now = stateRef.current
        if (signal.type === 'incoming') {
          // A redelivered ring for the call we're already handling.
          if (now.kind !== 'idle' && now.sessionId === signal.sessionId) return
          if (blocked.current.has(signal.peer.uid)) {
            void transport.declineCall(signal.sessionId, 'rejected').catch(() => undefined)
            return
          }
          // Glare: we're both ringing each other. The lower uid keeps its call; the other side
          // cancels its own ring and picks up instead.
          if (now.kind === 'outgoing' && now.peer.uid === signal.peer.uid && myUid > signal.peer.uid) {
            dispatch({ type: 'hang-up' })
            if (now.sessionId) void transport.declineCall(now.sessionId, 'cancelled').catch(() => undefined)
            dispatch({ type: 'incoming', sessionId: signal.sessionId, peer: signal.peer })
            void acceptRef.current()
            return
          }
          if (isBusy(now) || inRoomCall.current) {
            void transport.declineCall(signal.sessionId, 'busy').catch(() => undefined)
            return
          }
          dispatch({ type: 'incoming', sessionId: signal.sessionId, peer: signal.peer })
          return
        }
        if (now.kind === 'outgoing' && now.sessionId === null) {
          early.current = new Map(early.current).set(signal.sessionId, signal.type)
          return
        }
        if (signal.type === 'accepted') dispatch({ type: 'remote-accepted', sessionId: signal.sessionId })
        else dispatch({ type: 'over', sessionId: signal.sessionId })
      },
    })
  }, [transport, myUid, inRoomCall, blocked, dispatch])

  const dial = useCallback(
    async (peer: CallPeer) => {
      if (isBusy(stateRef.current) || inRoomCall.current) return
      early.current = new Map()
      setError(null)
      dispatch({ type: 'dial', peer })
      try {
        const sessionId = await transport.dialCall(peer.uid)
        const now = stateRef.current
        // Hung up (or walked away) before CometChat answered: cancel the ring we just started.
        if (now.kind !== 'outgoing' || now.peer.uid !== peer.uid || now.sessionId !== null) {
          await transport.declineCall(sessionId, 'cancelled').catch(() => undefined)
          return
        }
        dispatch({ type: 'dialed', sessionId })
        const pending = early.current.get(sessionId)
        early.current = new Map()
        if (pending === 'accepted') dispatch({ type: 'remote-accepted', sessionId })
        else if (pending === 'over') dispatch({ type: 'over', sessionId })
      } catch (err) {
        dispatch({ type: 'failed' })
        setError(`Couldn't call ${peer.name}: ${describe(err)}`)
      }
    },
    [transport, inRoomCall, dispatch],
  )

  const accept = useCallback(async () => {
    const now = stateRef.current
    if (now.kind !== 'incoming') return
    // Move to 'connecting' first: a double-click or a Decline racing the request becomes a no-op
    // or a proper endCall, instead of a reject crossing an accept.
    dispatch({ type: 'accept' })
    try {
      await transport.acceptCall(now.sessionId)
    } catch (err) {
      if (stateRef.current.kind !== 'idle' && stateRef.current.sessionId === now.sessionId) dispatch({ type: 'hang-up' })
      setError(`Couldn't answer: ${describe(err)}`)
    }
  }, [transport, dispatch])

  useEffect(() => {
    acceptRef.current = accept
  }, [accept])

  /** Declines, cancels or ends, whichever fits the current state. */
  const hangUp = useCallback(() => {
    const now = stateRef.current
    dispatch({ type: 'hang-up' })
    if (now.kind === 'idle' || now.sessionId === null) return
    const done =
      now.kind === 'incoming'
        ? transport.declineCall(now.sessionId, 'rejected')
        : now.kind === 'outgoing'
          ? transport.declineCall(now.sessionId, 'cancelled')
          : transport.endCall(now.sessionId)
    // The call is over locally either way; a failed signal just means the other side times out.
    void done.catch(() => undefined)
  }, [transport, dispatch])

  const joined = useCallback((sessionId: string) => dispatch({ type: 'joined', sessionId }), [dispatch])

  // Leaving town mid-call: tell the other side, and free CometChat's active-call slot.
  const hangUpRef = useRef(hangUp)
  useEffect(() => {
    hangUpRef.current = hangUp
  }, [hangUp])
  useEffect(() => () => hangUpRef.current(), [])

  // Spatial rule: a whisper call only lasts while you're standing together.
  const partnerUid = partner?.uid ?? null
  useEffect(() => {
    if (state.kind === 'idle' || state.kind === 'incoming') return
    if (partnerUid === state.peer.uid) return
    const timer = window.setTimeout(hangUp, WALK_AWAY_GRACE_MS)
    return () => window.clearTimeout(timer)
  }, [state, partnerUid, hangUp])

  return { state, error, dismissError: () => setError(null), dial, accept, hangUp, joined }
}

export type DirectCall = ReturnType<typeof useDirectCall>
