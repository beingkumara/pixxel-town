import { COMETCHAT } from '../config'

/*
 * Built from the CometChat Calls SDK v5 docs fetched via the MCP:
 * /calls/javascript/setup, /authentication, /join-session and /events.
 * The SDK is imported lazily so the town loads fast; it's only pulled in
 * the first time someone joins a room call.
 *
 * The SDK holds ONE active session ("Single Active Session" in the docs), so
 * joins are serialised and a handle can only hang up the session it created.
 */

type CallsModule = typeof import('@cometchat/calls-sdk-javascript')
type CallsSdk = CallsModule['CometChatCalls']

const LEAVE_WAIT_MS = 4000
/** How long a parked SDK node lingers offscreen so late layout callbacks still see a real size. */
const NODE_LINGER_MS = 6000

let sdkPromise: Promise<CallsSdk> | null = null
/**
 * Tail of the call queue. Joins AND leaves run through it one at a time, so a join can never
 * start while a previous session is still tearing down (its late onSessionLeft would end the
 * new call).
 */
let queue: Promise<unknown> = Promise.resolve()
/** Generation of the session currently joined (0 = none). */
let activeGen = 0
let nextGen = 1
/** Ends the active session's handle if something else has to take over the SDK. */
let endActive: (() => void) | null = null

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task)
  queue = run.catch(() => undefined)
  return run
}

function loadSdk(uid: string): Promise<CallsSdk> {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const { CometChatCalls } = await import('@cometchat/calls-sdk-javascript')
      const init = await CometChatCalls.init({ appId: COMETCHAT.APP_ID, region: COMETCHAT.REGION })
      if (!init.success) throw new Error(`Calls SDK init failed: ${JSON.stringify(init.error)}`)
      return CometChatCalls
    })().catch((err: unknown) => {
      sdkPromise = null
      throw err
    })
  }
  return sdkPromise.then(async (sdk) => {
    const current = sdk.getLoggedInUser()
    if (current?.uid !== uid) {
      if (current) await sdk.logout()
      await sdk.login(uid, COMETCHAT.AUTH_KEY)
    }
    return sdk
  })
}

/** Resolves when the SDK reports the session left (or after a short timeout). */
function waitForLeft(sdk: CallsSdk): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(done, LEAVE_WAIT_MS)
    const off = sdk.addEventListener('onSessionLeft', done)
    function done() {
      window.clearTimeout(timer)
      off()
      resolve()
    }
  })
}

/** Safety net: if a session is somehow still active, end its handle and leave it. */
function leaveActive(sdk: CallsSdk): Promise<void> {
  if (activeGen === 0) return Promise.resolve()
  endActive?.()
  activeGen = 0
  const left = waitForLeft(sdk)
  sdk.leaveSession()
  return left
}

/**
 * The SDK's layout ResizeObserver throws if its container shrinks to 0×0 mid-teardown
 * (hidden panel, or React removing the node). So the SDK renders into a node we own,
 * and on leave that node is parked offscreen at its current size until the SDK is done.
 */
function park(node: HTMLElement): void {
  const width = node.clientWidth || 320
  const height = node.clientHeight || 240
  Object.assign(node.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: 'none',
  })
  document.body.appendChild(node)
}

/** Parks the SDK's node and removes it once the SDK can no longer be measuring it. */
function dispose(node: HTMLElement): void {
  if (node.parentElement !== document.body) park(node)
  window.setTimeout(() => node.remove(), NODE_LINGER_MS)
}

export interface CallHandle {
  /** Hangs up; resolves once the SDK has torn the session down. */
  leave(): Promise<void>
}

async function join(uid: string, sessionId: string, host: HTMLElement, onEnded: () => void): Promise<CallHandle> {
  const sdk = await loadSdk(uid)
  await leaveActive(sdk)

  const node = document.createElement('div')
  node.className = 'call__node'
  host.appendChild(node)

  const gen = nextGen++
  let ended = false
  /** Set once our own leave() has been requested; the SDK events it causes aren't "ended by peer". */
  let leaving = false
  const finish = () => {
    if (ended) return
    ended = true
    unsubscribers.forEach((off) => off())
    if (activeGen === gen) {
      activeGen = 0
      endActive = null
    }
  }
  const endedBySdk = () => {
    if (activeGen !== gen || leaving) return
    finish()
    dispose(node)
    onEnded()
  }
  const unsubscribers = [sdk.addEventListener('onSessionLeft', endedBySdk), sdk.addEventListener('onSessionTimedOut', endedBySdk)]

  let attempted = false
  try {
    // Every player in the same room uses the same session id, so they land in one call.
    const { token } = await sdk.generateToken(sessionId)
    // The panel unmounted while we were connecting: don't render into a detached (0×0) host.
    if (!host.isConnected) throw new Error('Call cancelled: left the room while connecting')
    attempted = true
    const result = await sdk.joinSession(
      token,
      { sessionType: 'VIDEO', layout: 'TILE', startAudioMuted: false, startVideoPaused: false },
      node,
    )
    if (result.error) throw new Error(`Could not join call: ${JSON.stringify(result.error)}`)
    activeGen = gen
    endActive = () => {
      finish()
      dispose(node)
      if (!leaving) onEnded()
    }
  } catch (err) {
    finish()
    park(node)
    if (attempted) {
      // joinSession may have got partway; make sure the SDK isn't left holding a session.
      const left = waitForLeft(sdk)
      sdk.leaveSession()
      await left
    }
    dispose(node)
    throw err
  }

  return {
    leave() {
      if (ended || leaving) return Promise.resolve()
      leaving = true
      // Park synchronously: when React is about to remove the host, the node must already be out.
      park(node)
      // The session stays "ours" (activeGen) until the queued leave runs, so a join queued in
      // between sees it via leaveActive and tears it down first instead of joining on top of it.
      return serial(async () => {
        if (activeGen === gen) {
          const left = waitForLeft(sdk)
          sdk.leaveSession()
          await left
        }
        finish()
        dispose(node)
      })
    },
  }
}

/** Joins a Calls SDK session (a room's shared call or a 1:1 whisper call) into `host`. */
export function joinCallSession(uid: string, sessionId: string, host: HTMLElement, onEnded: () => void): Promise<CallHandle> {
  return serial(() => join(uid, sessionId, host, onEnded))
}
