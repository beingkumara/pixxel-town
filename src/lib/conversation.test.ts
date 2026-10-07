import { describe, expect, test } from 'vitest'
import { appendMessage, conversationKey, keyForIncoming, mergeMessages, recentOnly, type ChatMessage } from './conversation'

const msg = (id: string, key = 'user:bob'): ChatMessage => ({
  id,
  key,
  senderUid: 'bob',
  senderName: 'Bob',
  text: `hi ${id}`,
  sentAt: Number(id),
  moderation: 'none',
})

describe('conversationKey', () => {
  test('builds stable keys for users and groups', () => {
    expect(conversationKey({ kind: 'user', id: 'bob' })).toBe('user:bob')
    expect(conversationKey({ kind: 'group', id: 'pt-room-cafe' })).toBe('group:pt-room-cafe')
  })
})

describe('keyForIncoming', () => {
  test('group messages key on the group', () => {
    expect(keyForIncoming({ receiverType: 'group', receiverId: 'g1', senderUid: 'bob' }, 'me')).toBe('group:g1')
  })

  test('DMs from others key on the sender', () => {
    expect(keyForIncoming({ receiverType: 'user', receiverId: 'me', senderUid: 'bob' }, 'me')).toBe('user:bob')
  })

  test('my own DMs (e.g. from another tab) key on the receiver', () => {
    expect(keyForIncoming({ receiverType: 'user', receiverId: 'bob', senderUid: 'me' }, 'me')).toBe('user:bob')
  })
})

describe('appendMessage', () => {
  test('appends immutably', () => {
    const state = {}
    const next = appendMessage(state, msg('1'))
    expect(state).toEqual({})
    expect(next['user:bob']).toHaveLength(1)
  })

  test('ignores duplicates by id', () => {
    const once = appendMessage({}, msg('1'))
    expect(appendMessage(once, msg('1'))).toBe(once)
  })

  test('keeps messages sorted by time and capped', () => {
    let state = {}
    for (let i = 200; i > 0; i--) state = appendMessage(state, msg(String(i)))
    const list = appendMessage(state, msg('0'))['user:bob']
    expect(list).toHaveLength(100)
    expect(list[list.length - 1].id).toBe('200')
    expect(list[0].sentAt).toBeLessThan(list[1].sentAt)
  })
})

describe('mergeMessages with moderation', () => {
  test('a reload refreshes a message stuck in pending', () => {
    const state = appendMessage({}, { ...msg('1'), moderation: 'pending' })
    const next = mergeMessages(state, 'user:bob', [{ ...msg('1'), moderation: 'approved' }])
    expect(next['user:bob'][0].moderation).toBe('approved')
  })

  test('a stale pending copy never overwrites a verdict', () => {
    const state = appendMessage({}, { ...msg('1'), moderation: 'blocked' })
    expect(appendMessage(state, { ...msg('1'), moderation: 'pending' })).toBe(state)
  })
})

describe('recentOnly', () => {
  test('keeps only messages inside the window', () => {
    const now = 1_000_000
    const list = [{ ...msg('1'), sentAt: now - 20 * 60_000 }, { ...msg('2'), sentAt: now - 5 * 60_000 }, { ...msg('3'), sentAt: now }]
    expect(recentOnly(list, now, 15 * 60_000).map((m) => m.id)).toEqual(['2', '3'])
  })
})
