import { forceLocalMode, isCometChatConfigured } from '../config'
import { createCometChatTransport } from './cometchat'
import { createLocalTransport } from './local'
import type { TownTransport } from './types'

export function createTransport(): TownTransport {
  if (!forceLocalMode() && isCometChatConfigured()) return createCometChatTransport()
  return createLocalTransport()
}

export type { Profile, TownTransport, TransportHandlers, TypingEvent } from './types'
