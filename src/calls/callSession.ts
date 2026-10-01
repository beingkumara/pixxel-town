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
/** Tail of the join queue. */
let queue: Promise<unknown> = Promise.resolve()
/** Generation of the session currently joined (0 = none). */
let activeGen = 0
let nextGen = 1
/** The most recent hang-up. A new join waits for it so a late onSessionLeft can't end the new call. */
let teardown: Promise<void> = Promise.resolve()

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

/** Leave whatever session is active and wait (briefly) for the SDK to confirm. */
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

function leaveActive(sdk: CallsSdk): Promise<void> {
  if (activeGen === 0) return Promise.resolve()
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
  await teardown
  const sdk = await loadSdk(uid)
  await leaveActive(sdk)

  const node = document.createElement('div')
  node.className = 'call__node'
  host.appendChild(node)

  const gen = nextGen++
  let ended = false
  const finish = () => {
    if (ended) return
    ended = true
    unsubscribers.forEach((off) => off())
    if (activeGen === gen) activeGen = 0
  }
  const endedBySdk = () => {
    if (activeGen !== gen) return
    finish()
    dispose(node)
    onEnded()
  }
  const unsubscribers = [sdk.addEventListener('onSessionLeft', endedBySdk), sdk.addEventListener('onSessionTimedOut', endedBySdk)]

  try {
    // Every player in the same room uses the same session id, so they land in one call.
    const { token } = await sdk.generateToken(sessionId)
    const result = await sdk.joinSession(
      token,
      { sessionType: 'VIDEO', layout: 'TILE', startAudioMuted: false, startVideoPaused: false },
      node,
    )
    if (result.error) throw new Error(`Could not join call: ${JSON.stringify(result.error)}`)
    activeGen = gen
  } catch (err) {
    finish()
    dispose(node)
    throw err
  }

  return {
    async leave() {
      if (ended) return
      // Only hang up if this handle still owns the SDK's single session.
      const wasActive = activeGen === gen
      finish()
      park(node)
      if (!wasActive) {
        dispose(node)
        return
      }
      const left = waitForLeft(sdk)
      sdk.leaveSession()
      teardown = left.then(() => dispose(node))
      await teardown
    },
  }
}

export function joinRoomCall(uid: string, sessionId: string, host: HTMLElement, onEnded: () => void): Promise<CallHandle> {
  const attempt = queue.then(() => join(uid, sessionId, host, onEnded))
  queue = attempt.catch(() => undefined)
  return attempt
}
