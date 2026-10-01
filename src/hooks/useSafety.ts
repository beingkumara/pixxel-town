import { useCallback, useEffect, useRef, useState } from 'react'
import { FALLBACK_REPORT_REASONS, isPlanUnavailable, type ReportReason } from '../lib/moderation'
import type { TownTransport } from '../transport'
import { describe } from './useConversations'

const BLOCKED_RETRY_MS = 3000

/**
 * Player-side safety tools backed by CometChat: blocking (CometChat.blockUsers) and
 * reporting messages to the dashboard's flagged queue (CometChat.flagMessage).
 */
export function useSafety(transport: TownTransport) {
  const [blocked, setBlocked] = useState<ReadonlySet<string>>(new Set())
  const [reasons, setReasons] = useState<readonly ReportReason[]>(FALLBACK_REPORT_REASONS)
  const [notice, setNotice] = useState<string | null>(null)
  /** False once CometChat says moderation isn't on this app's plan; the Report UI then hides. */
  const [canReport, setCanReport] = useState(true)
  const blockedRef = useRef<ReadonlySet<string>>(blocked)
  /** Display names for players blocked this session (the server list only has UIDs). */
  const [names, setNames] = useState<Readonly<Record<string, string>>>({})

  /** Updates the ref synchronously so packets/messages arriving before the next render are filtered. */
  const commit = useCallback((next: ReadonlySet<string>) => {
    blockedRef.current = next
    setBlocked(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = (attempt: number) => {
      transport
        .fetchBlocked()
        // Merge, so a block made while the list was loading isn't lost.
        .then((uids) => {
          if (!cancelled) commit(new Set([...blockedRef.current, ...uids]))
        })
        .catch((err: unknown) => {
          if (cancelled) return
          if (attempt === 0) window.setTimeout(() => load(1), BLOCKED_RETRY_MS)
          else setNotice(`Couldn't load your blocked list: ${describe(err)}`)
        })
    }
    load(0)
    transport
      .getReportReasons()
      .then((list) => {
        if (!cancelled && list.length > 0) setReasons(list)
      })
      .catch((err: unknown) => {
        // Moderation not on this plan: hide reporting rather than offer a button that always fails.
        if (!cancelled && isPlanUnavailable(describe(err))) setCanReport(false)
        // Otherwise the dashboard simply has no flag reasons configured: keep the defaults.
      })
    return () => {
      cancelled = true
    }
  }, [transport, commit])

  const block = useCallback(
    async (uid: string, name: string) => {
      commit(new Set(blockedRef.current).add(uid))
      setNames((prev) => ({ ...prev, [uid]: name }))
      try {
        await transport.blockPlayer(uid)
        setNotice(`${name} is blocked: hidden from your map and chats. Room video calls can't hide people, so skip calls they're in.`)
      } catch (err) {
        commit(new Set([...blockedRef.current].filter((u) => u !== uid)))
        setNotice(`Couldn't block ${name}: ${describe(err)}`)
      }
    },
    [transport, commit],
  )

  const unblock = useCallback(
    async (uid: string) => {
      commit(new Set([...blockedRef.current].filter((u) => u !== uid)))
      try {
        await transport.unblockPlayer(uid)
      } catch (err) {
        commit(new Set(blockedRef.current).add(uid))
        setNotice(`Couldn't unblock: ${describe(err)}`)
      }
    },
    [transport, commit],
  )

  const report = useCallback(
    async (messageId: string, reasonId: string): Promise<boolean> => {
      try {
        await transport.reportMessage(messageId, reasonId)
        setNotice('Thanks. The message was sent to the moderators.')
        return true
      } catch (err) {
        const reason = describe(err)
        if (isPlanUnavailable(reason)) {
          setCanReport(false)
          setNotice("Reporting isn't available: this CometChat app's plan doesn't include moderation.")
        } else {
          setNotice(`Report not sent: ${reason.replace(/\.+$/, '')}.`)
        }
        return false
      }
    },
    [transport],
  )

  // Pixel Town UIDs look like "pt-<name>-<suffix>"; fall back to the name part when unknown.
  const nameOf = (uid: string): string => names[uid] ?? uid.replace(/^pt-/, '').replace(/-[a-z0-9]{4}$/, '')

  return { blocked, blockedRef, reasons, canReport, block, unblock, report, nameOf, notice, dismissNotice: () => setNotice(null) }
}

export type Safety = ReturnType<typeof useSafety>
