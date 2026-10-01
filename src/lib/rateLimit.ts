/**
 * Per-key token bucket. Returns `allow(key, nowMs)`, which spends one token
 * when available. Used to stop a single client flooding the world channel.
 */
export function createRateLimiter(capacity: number, refillPerSecond: number): (key: string, nowMs: number) => boolean {
  const buckets = new Map<string, { tokens: number; at: number }>()
  return (key, nowMs) => {
    const prev = buckets.get(key) ?? { tokens: capacity, at: nowMs }
    const refilled = Math.min(capacity, prev.tokens + ((nowMs - prev.at) / 1000) * refillPerSecond)
    const allowed = refilled >= 1
    buckets.set(key, { tokens: allowed ? refilled - 1 : refilled, at: nowMs })
    return allowed
  }
}
