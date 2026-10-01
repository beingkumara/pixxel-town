import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { joinCallSession, type CallHandle } from '../../calls/callSession'
import { describe } from '../../hooks/useConversations'
import './call.css'

type CallState = { status: 'idle' } | { status: 'joining' } | { status: 'live' } | { status: 'error'; message: string }

interface CallPanelProps {
  uid: string
  sessionId: string
  roomName: string
  /** Calls need real CometChat credentials; the local demo transport can't place them. */
  available: boolean
  /** Set while a whisper call holds the (single) Calls SDK session. */
  busyReason?: string
  /** Reports whether this room call is joining/live, so whisper calls can stay out of its way. */
  onActiveChange?: (active: boolean) => void
}

/**
 * One video call per room. Everyone standing in the room shares the room's
 * session id. Walking out of the room unmounts this panel, which hangs up.
 */
export function CallPanel({ uid, sessionId, roomName, available, busyReason, onActiveChange }: CallPanelProps) {
  const [state, setState] = useState<CallState>({ status: 'idle' })
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<CallHandle | null>(null)
  const mounted = useRef(true)
  const active = state.status === 'joining' || state.status === 'live'
  const onActiveRef = useRef(onActiveChange)

  useEffect(() => {
    onActiveRef.current = onActiveChange
  }, [onActiveChange])

  useEffect(() => {
    onActiveRef.current?.(active)
  }, [active])

  useEffect(() => () => onActiveRef.current?.(false), [])

  // Layout effect: its cleanup runs before React removes the stage, so the SDK's node is
  // parked offscreen while it still has a size (see callSession.park).
  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      void handleRef.current?.leave()
      handleRef.current = null
    }
  }, [])

  const join = async () => {
    const container = containerRef.current
    if (!container) return
    setState({ status: 'joining' })
    try {
      const handle = await joinCallSession(uid, sessionId, container, () => {
        handleRef.current = null
        if (mounted.current) setState({ status: 'idle' })
      })
      // If we walked out of the room while connecting, hang up immediately.
      if (!mounted.current) {
        void handle.leave()
        return
      }
      handleRef.current = handle
      setState({ status: 'live' })
    } catch (err) {
      if (mounted.current) setState({ status: 'error', message: describe(err) })
    }
  }

  const leave = () => {
    void handleRef.current?.leave()
    handleRef.current = null
    setState({ status: 'idle' })
  }

  return (
    <div className={`call call--${state.status}`}>
      <div className="call__bar">
        {state.status === 'live' ? (
          <>
            <span className="mono call__live" aria-live="polite">
              ● LIVE in {roomName}
            </span>
            <button type="button" className="btn btn--sm btn--danger" onClick={leave}>
              Hang up
            </button>
          </>
        ) : (
          <>
            <span className="call__hint">
              {!available
                ? 'Video calls need CometChat credentials (.env.local).'
                : busyReason ?? 'Everyone in this room shares one call.'}
            </span>
            <button
              type="button"
              className="btn btn--sm"
              onClick={join}
              disabled={!available || Boolean(busyReason) || state.status === 'joining'}
            >
              {state.status === 'joining' ? 'Joining…' : '📹 Join call'}
            </button>
          </>
        )}
      </div>
      {state.status === 'error' && (
        <p className="call__error" role="alert">
          {state.message}
        </p>
      )}
      <div ref={containerRef} className="call__stage" aria-label={`${roomName} video call`} />
    </div>
  )
}
