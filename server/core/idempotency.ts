/**
 * Idempotency for the analysis gateway.
 *
 * Both `Idempotency-Key` and `request_id` are deduplicated: retrying a request
 * must return the original run instead of starting a second analysis.
 * This is an in-memory implementation; a Durable Object can replace it without
 * changing the call sites.
 */

export type IdempotencyStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type IdempotencyRecord = {
  key: string
  requestId: string
  runId: string
  status: IdempotencyStatus
  createdAt: number
}

export type ReserveResult = {
  record: IdempotencyRecord
  /** True when an existing run was returned instead of creating a new one. */
  reused: boolean
}

export type ReserveInput = {
  key: string
  requestId: string
  now: number
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

export class IdempotencyRegistry {
  private readonly byKey = new Map<string, IdempotencyRecord>()
  private readonly byRequest = new Map<string, string>()
  private readonly ttlMs: number
  private readonly newRunId: () => string

  constructor(
    ttlMs: number = DEFAULT_TTL_MS,
    newRunId: () => string = () =>
      `run_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
  ) {
    this.ttlMs = ttlMs
    this.newRunId = newRunId
  }

  reserve(input: ReserveInput): ReserveResult {
    this.prune(input.now)

    const byKey = this.byKey.get(input.key)
    if (byKey) return { record: byKey, reused: true }

    const knownRunId = this.byRequest.get(input.requestId)
    if (knownRunId) {
      const existing = this.findByRunId(knownRunId)
      if (existing) return { record: existing, reused: true }
    }

    const record: IdempotencyRecord = {
      key: input.key,
      requestId: input.requestId,
      runId: this.newRunId(),
      status: 'queued',
      createdAt: input.now,
    }
    this.byKey.set(record.key, record)
    this.byRequest.set(record.requestId, record.runId)
    return { record, reused: false }
  }

  private findByRunId(runId: string): IdempotencyRecord | undefined {
    for (const record of this.byKey.values()) {
      if (record.runId === runId) return record
    }
    return undefined
  }

  get(key: string): IdempotencyRecord | undefined {
    return this.byKey.get(key)
  }

  updateStatus(runId: string, status: IdempotencyStatus): boolean {
    const record = this.findByRunId(runId)
    if (!record) return false
    record.status = status
    return true
  }

  /** Drop expired records so a long-lived isolate does not grow forever. */
  prune(now: number): number {
    let removed = 0
    for (const [key, record] of this.byKey) {
      if (now - record.createdAt > this.ttlMs) {
        this.byKey.delete(key)
        this.byRequest.delete(record.requestId)
        removed += 1
      }
    }
    return removed
  }

  get size(): number {
    return this.byKey.size
  }
}
