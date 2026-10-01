import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { joinCallSession, type CallHandle } from '../../calls/callSession'
import { describe } from '../../hooks/useConversations'
import type { DirectCall } from '../../hooks/useDirectCall'
import './call.css'

interface DirectCallCardProps {
  uid: string
  call: DirectCall
}

/** Ringing UI plus the media stage for a 1:1 whisper call. */
export function DirectCallCard({ uid, call }: DirectCallCardProps) {
  const { state, accept, hangUp, joined } = call
  const stageRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<CallHandle | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const sessionId = state.kind === 'connecting' || state.kind === 'live' ? state.sessionId : null

  // Join the media session once the call is accepted; leave when it ends or the card goes away.
  useEffect(() => {
    const stage = stageRef.current
    if (!sessionId || !stage) return
    let cancelled = false
    setMediaError(null)
    joinCallSession(uid, sessionId, stage, hangUp)
      .then((handle) => {
        if (cancelled) return void handle.leave()
        handleRef.current = handle
        joined(sessionId)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setMediaError(describe(err))
        hangUp()
      })
    return () => {
      cancelled = true
    }
  }, [uid, sessionId, joined, hangUp])

  // Leave before React removes the stage, so the SDK's node can be parked while it still has a size.
  useLayoutEffect(() => {
    if (sessionId) return
    void handleRef.current?.leave()
    handleRef.current = null
  }, [sessionId])
  useLayoutEffect(
    () => () => {
      void handleRef.current?.leave()
      handleRef.current = null
    },
    [],
  )

  // The stage stays mounted even when idle: React would otherwise remove it before the layout
  // effect above can park the SDK's node, and the SDK crashes measuring a detached 0×0 box.
  const peer = state.kind === 'idle' ? null : state.peer
  return (
    <>
      {state.kind === 'idle' && mediaError && (
        <p className="town__toast" role="alert">
          Call failed: {mediaError}
          <button type="button" onClick={() => setMediaError(null)} aria-label="Dismiss">
            ×
          </button>
        </p>
      )}
      <section
        className={`dcall dcall--${state.kind}`}
        hidden={state.kind === 'idle'}
        aria-label={peer ? `Whisper call with ${peer.name}` : undefined}
      >
        {peer && (
          <div className="dcall__bar">
            <p className="dcall__status" aria-live="polite">
              {state.kind === 'outgoing' && <>📞 Calling {peer.name}…</>}
              {state.kind === 'incoming' && <>📞 {peer.name} is calling you</>}
              {state.kind === 'connecting' && <>Connecting to {peer.name}…</>}
              {state.kind === 'live' && <>● Whisper call with {peer.name}</>}
            </p>
            {state.kind === 'incoming' ? (
              <span className="dcall__actions">
                <button type="button" className="btn btn--sm btn--ghost" onClick={hangUp}>
                  Decline
                </button>
                <button type="button" className="btn btn--sm" onClick={() => void accept()}>
                  Accept
                </button>
              </span>
            ) : (
              <button type="button" className="btn btn--sm btn--danger" onClick={hangUp}>
                {state.kind === 'outgoing' ? 'Cancel' : 'Hang up'}
              </button>
            )}
          </div>
        )}
        <div ref={stageRef} className="dcall__stage" aria-label={peer ? `Video call with ${peer.name}` : undefined} />
        {(state.kind === 'live' || state.kind === 'connecting') && <p className="dcall__hint">Walk away to hang up.</p>}
      </section>
    </>
  )
}
