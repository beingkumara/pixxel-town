/*
 * 1:1 "whisper calls": ring the person you're standing next to. Signalling follows the
 * CometChat ringing flow fetched through the MCP (/calls/javascript/ringing): the Chat SDK
 * rings (initiateCall / acceptCall / rejectCall / endCall), the Calls SDK carries the media.
 * This reducer is the pure state machine; useDirectCall performs the side effects.
 */

export interface CallPeer {
  readonly uid: string
  readonly name: string
}

export type DirectCallState =
  | { readonly kind: 'idle' }
  /** sessionId is null until CometChat.initiateCall resolves. */
  | { readonly kind: 'outgoing'; readonly peer: CallPeer; readonly sessionId: string | null }
  | { readonly kind: 'incoming'; readonly peer: CallPeer; readonly sessionId: string }
  | { readonly kind: 'connecting'; readonly peer: CallPeer; readonly sessionId: string }
  | { readonly kind: 'live'; readonly peer: CallPeer; readonly sessionId: string }

export type CallEvent =
  | { readonly type: 'dial'; readonly peer: CallPeer }
  | { readonly type: 'dialed'; readonly sessionId: string }
  | { readonly type: 'failed' }
  | { readonly type: 'incoming'; readonly peer: CallPeer; readonly sessionId: string }
  | { readonly type: 'accept' }
  | { readonly type: 'remote-accepted'; readonly sessionId: string }
  | { readonly type: 'joined'; readonly sessionId: string }
  /** Rejected, cancelled, busy, unanswered or ended by the other side. */
  | { readonly type: 'over'; readonly sessionId: string }
  /** We hung up, declined, cancelled, or walked away. */
  | { readonly type: 'hang-up' }

export const IDLE: DirectCallState = { kind: 'idle' }

const sessionOf = (s: DirectCallState): string | null => (s.kind === 'idle' ? null : s.sessionId)

export function callReducer(state: DirectCallState, event: CallEvent): DirectCallState {
  switch (event.type) {
    case 'dial':
      return state.kind === 'idle' ? { kind: 'outgoing', peer: event.peer, sessionId: null } : state
    case 'dialed':
      return state.kind === 'outgoing' && state.sessionId === null ? { ...state, sessionId: event.sessionId } : state
    case 'failed':
      return state.kind === 'outgoing' || state.kind === 'connecting' ? IDLE : state
    case 'incoming':
      return state.kind === 'idle' ? { kind: 'incoming', peer: event.peer, sessionId: event.sessionId } : state
    case 'accept':
      return state.kind === 'incoming' ? { kind: 'connecting', peer: state.peer, sessionId: state.sessionId } : state
    case 'remote-accepted':
      return state.kind === 'outgoing' && state.sessionId === event.sessionId
        ? { kind: 'connecting', peer: state.peer, sessionId: event.sessionId }
        : state
    case 'joined':
      return state.kind === 'connecting' && state.sessionId === event.sessionId ? { ...state, kind: 'live' } : state
    case 'over':
      return sessionOf(state) === event.sessionId ? IDLE : state
    case 'hang-up':
      return IDLE
  }
}

/** True while a call occupies the player (so a new incoming call should get "busy"). */
export const isBusy = (s: DirectCallState): boolean => s.kind !== 'idle'
