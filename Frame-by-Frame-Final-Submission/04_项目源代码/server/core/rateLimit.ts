import { RATE_LIMIT } from './contract.ts'

export type RateDecision =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number; reason: 'minute' | 'day' }

type Bucket = { minute: number[]; day: number[] }

/**
 * In-memory sliding-window limiter. It protects a single Worker isolate /
 * Node process from runaway loops. A production multi-region deployment
 * should back this with Cloudflare KV or a Durable Object; that limitation is
 * documented in docs/ai-core.md.
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>()
  private lastSweep = 0

  check(key: string, nowMs: number): RateDecision {
    const now = nowMs
    const bucket = this.buckets.get(key) ?? { minute: [], day: [] }
    bucket.minute = bucket.minute.filter((time) => now - time < RATE_LIMIT.windowMs)
    bucket.day = bucket.day.filter((time) => now - time < RATE_LIMIT.dayMs)

    if (bucket.day.length >= RATE_LIMIT.maxPerDay) {
      this.buckets.set(key, bucket)
      const oldest = bucket.day[0] ?? now
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((oldest + RATE_LIMIT.dayMs - now) / 1000)),
        reason: 'day',
      }
    }
    if (bucket.minute.length >= RATE_LIMIT.maxPerWindow) {
      this.buckets.set(key, bucket)
      const oldest = bucket.minute[0] ?? now
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((oldest + RATE_LIMIT.windowMs - now) / 1000)),
        reason: 'minute',
      }
    }

    bucket.minute.push(now)
    bucket.day.push(now)
    this.buckets.set(key, bucket)
    this.sweep(now)
    return {
      ok: true,
      remaining: Math.max(0, RATE_LIMIT.maxPerWindow - bucket.minute.length),
    }
  }

  private sweep(nowMs: number): void {
    if (nowMs - this.lastSweep < RATE_LIMIT.windowMs) return
    this.lastSweep = nowMs
    for (const [key, bucket] of this.buckets) {
      const alive = bucket.day.some((time) => nowMs - time < RATE_LIMIT.dayMs)
      if (!alive) this.buckets.delete(key)
    }
  }
}
