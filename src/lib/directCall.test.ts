import { describe, expect, test } from 'vitest'
import { IDLE, callReducer, type CallPeer, type DirectCallState } from './directCall'

const bo: CallPeer = { uid: 'bo', name: 'Bo' }
const run = (events: Parameters<typeof callReducer>[1][], from: DirectCallState = IDLE) => events.reduce(callReducer, from)

describe('callReducer: outgoing', () => {
  test('dial → ringing with a session id → accepted → live', () => {
    const dialing = run([{ type: 'dial', peer: bo }])
    expect(dialing).toEqual({ kind: 'outgoing', peer: bo, sessionId: null })
    const ringing = callReducer(dialing, { type: 'dialed', sessionId: 's1' })
    expect(ringing).toEqual({ kind: 'outgoing', peer: bo, sessionId: 's1' })
    const connecting = callReducer(ringing, { type: 'remote-accepted', sessionId: 's1' })
    expect(connecting).toEqual({ kind: 'connecting', peer: bo, sessionId: 's1' })
    expect(callReducer(connecting, { type: 'joined', sessionId: 's1' })).toEqual({ kind: 'live', peer: bo, sessionId: 's1' })
  })

  test('a rejection or failure returns to idle', () => {
    const ringing = run([{ type: 'dial', peer: bo }, { type: 'dialed', sessionId: 's1' }])
    expect(callReducer(ringing, { type: 'over', sessionId: 's1' })).toBe(IDLE)
    expect(callReducer(run([{ type: 'dial', peer: bo }]), { type: 'failed' })).toBe(IDLE)
  })

  test('cannot dial while another call is in progress', () => {
    const ringing = run([{ type: 'dial', peer: bo }, { type: 'dialed', sessionId: 's1' }])
    expect(callReducer(ringing, { type: 'dial', peer: { uid: 'cy', name: 'Cy' } })).toBe(ringing)
  })
})

describe('callReducer: incoming', () => {
  test('incoming → accept → connecting → live', () => {
    const ringing = run([{ type: 'incoming', peer: bo, sessionId: 's2' }])
    expect(ringing).toEqual({ kind: 'incoming', peer: bo, sessionId: 's2' })
    const connecting = callReducer(ringing, { type: 'accept' })
    expect(connecting).toEqual({ kind: 'connecting', peer: bo, sessionId: 's2' })
    expect(callReducer(connecting, { type: 'joined', sessionId: 's2' }).kind).toBe('live')
  })

  test('a second incoming call does not replace the current one', () => {
    const ringing = run([{ type: 'incoming', peer: bo, sessionId: 's2' }])
    expect(callReducer(ringing, { type: 'incoming', peer: { uid: 'cy', name: 'Cy' }, sessionId: 's3' })).toBe(ringing)
  })
})

describe('callReducer: ending', () => {
  test('events for another session are ignored', () => {
    const live = run([{ type: 'incoming', peer: bo, sessionId: 's2' }, { type: 'accept' }, { type: 'joined', sessionId: 's2' }])
    expect(callReducer(live, { type: 'over', sessionId: 'other' })).toBe(live)
    expect(callReducer(live, { type: 'joined', sessionId: 'other' })).toBe(live)
  })

  test('hang-up from any active state returns to idle', () => {
    const states: DirectCallState[] = [
      run([{ type: 'dial', peer: bo }]),
      run([{ type: 'incoming', peer: bo, sessionId: 's2' }]),
      run([{ type: 'incoming', peer: bo, sessionId: 's2' }, { type: 'accept' }]),
    ]
    for (const s of states) expect(callReducer(s, { type: 'hang-up' })).toBe(IDLE)
    expect(callReducer(IDLE, { type: 'hang-up' })).toBe(IDLE)
  })
})
