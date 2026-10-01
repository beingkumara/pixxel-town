import { describe, expect, test } from 'vitest'
import type { ChatMessage, MessageMap } from './conversation'
import { applyModeration, applyVerdict, blockSucceeded, isPlanUnavailable, toModeration, visibleMessages, withoutBlocked } from './moderation'

const msg = (id: string, senderUid: string, moderation: ChatMessage['moderation'] = 'none'): ChatMessage => ({
  id,
  key: 'group:pt-room-cafe',
  senderUid,
  senderName: senderUid,
  text: `text ${id}`,
  sentAt: Number(id),
  moderation,
})

describe('toModeration', () => {
  test('maps SDK statuses onto our states', () => {
    expect(toModeration('pending')).toBe('pending')
    expect(toModeration('approved')).toBe('approved')
    expect(toModeration('disapproved')).toBe('blocked')
    expect(toModeration('unmoderated')).toBe('none')
  })

  test('treats missing values as unmoderated', () => {
    expect(toModeration(undefined)).toBe('none')
    expect(toModeration(null)).toBe('none')
  })

  test('fails closed on statuses it does not know', () => {
    expect(toModeration('quarantined')).toBe('pending')
  })
})

describe('isPlanUnavailable', () => {
  test('recognises the free-plan error and nothing else', () => {
    expect(isPlanUnavailable('Moderation feature is not available. To enable this feature, please upgrade your plan.')).toBe(true)
    expect(isPlanUnavailable('Network request failed')).toBe(false)
    expect(isPlanUnavailable('Message not available')).toBe(false)
  })
})

describe('applyModeration', () => {
  test('updates one message immutably', () => {
    const state: MessageMap = { 'group:pt-room-cafe': [msg('1', 'me', 'pending'), msg('2', 'bo')] }
    const next = applyModeration(state, { id: '1', key: 'group:pt-room-cafe', moderation: 'blocked' })
    expect(next['group:pt-room-cafe'][0].moderation).toBe('blocked')
    expect(state['group:pt-room-cafe'][0].moderation).toBe('pending')
    expect(next['group:pt-room-cafe'][1]).toBe(state['group:pt-room-cafe'][1])
  })

  test('returns the same state when the message is unknown or unchanged', () => {
    const state: MessageMap = { 'group:pt-room-cafe': [msg('1', 'me', 'approved')] }
    expect(applyModeration(state, { id: '9', key: 'group:pt-room-cafe', moderation: 'blocked' })).toBe(state)
    expect(applyModeration(state, { id: '1', key: 'group:pt-room-cafe', moderation: 'approved' })).toBe(state)
    expect(applyModeration(state, { id: '1', key: 'user:nobody', moderation: 'blocked' })).toBe(state)
  })
})

describe('applyVerdict', () => {
  test('updates a known message', () => {
    const state: MessageMap = { 'group:pt-room-cafe': [msg('1', 'bo', 'pending')] }
    const next = applyVerdict(state, msg('1', 'bo', 'approved'))
    expect(next['group:pt-room-cafe'][0].moderation).toBe('approved')
  })

  test('inserts a message whose verdict arrived before the message itself', () => {
    const next = applyVerdict({}, msg('7', 'me', 'blocked'))
    expect(next['group:pt-room-cafe']).toHaveLength(1)
    expect(next['group:pt-room-cafe'][0].moderation).toBe('blocked')
  })
})

describe('blockSucceeded', () => {
  test('reads CometChat per-UID results', () => {
    expect(blockSucceeded({ bo: { success: true, message: 'blocked successfully' } }, 'bo')).toBe(true)
    expect(blockSucceeded({ bo: { success: false } }, 'bo')).toBe(false)
    expect(blockSucceeded({ bo: 'success' }, 'bo')).toBe(true)
    expect(blockSucceeded({ bo: 'fail' }, 'bo')).toBe(false)
    expect(blockSucceeded({}, 'bo')).toBe(false)
    expect(blockSucceeded(null, 'bo')).toBe(false)
  })
})

describe('visibleMessages', () => {
  const list = [
    msg('1', 'me', 'pending'),
    msg('2', 'me', 'blocked'),
    msg('3', 'bo', 'pending'),
    msg('4', 'bo', 'blocked'),
    msg('5', 'bo', 'approved'),
    msg('6', 'troll'),
  ]

  test('senders still see their own pending and blocked messages', () => {
    const ids = visibleMessages(list, 'me', new Set()).map((m) => m.id)
    expect(ids).toContain('1')
    expect(ids).toContain('2')
  })

  test("others' pending and blocked messages are hidden", () => {
    const ids = visibleMessages(list, 'me', new Set()).map((m) => m.id)
    expect(ids).not.toContain('3')
    expect(ids).not.toContain('4')
    expect(ids).toContain('5')
  })

  test('messages from blocked players are hidden', () => {
    const ids = visibleMessages(list, 'me', new Set(['troll'])).map((m) => m.id)
    expect(ids).not.toContain('6')
  })
})

describe('withoutBlocked', () => {
  test('drops blocked players and keeps the reference when nothing changes', () => {
    const players = { bo: { uid: 'bo' }, troll: { uid: 'troll' } }
    expect(Object.keys(withoutBlocked(players, new Set(['troll'])))).toEqual(['bo'])
    expect(withoutBlocked(players, new Set())).toBe(players)
  })
})
