import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AIFilmAnalysis,
  AgentObservationBundle,
  Film,
  TasteEvolutionSnapshot,
  TasteObservationFeedback,
  TasteProfileEvent,
  WatchRecord,
} from '@/types'
import {
  deleteAnalysis,
  insertAgentObservation,
  insertCorrection,
  insertEvent,
  insertObservationFeedback,
  insertSnapshot,
  softDeleteNote,
  writeAllowAi,
  writeAnalysis,
  writeFeedback,
  writeFilm,
  writeNote,
  writeYearbook,
  type WriteResult,
} from '@/lib/db/remote'

export type QueueOp =
  | { type: 'note.upsert'; note: WatchRecord; film?: Film }
  | { type: 'note.delete'; noteId: string }
  | { type: 'analysis.upsert'; analysis: AIFilmAnalysis }
  | { type: 'analysis.delete'; noteId: string }
  | { type: 'film.upsert'; film: Film }
  | {
      type: 'feedback.upsert'
      scope: 'dimension' | 'timeline'
      key: string
      verdict: 'agree' | 'not-quite' | 'corrected'
      correction?: string
      updatedAt: string
    }
  | { type: 'correction.insert'; correction: { id: string; scope: string; text: string; createdAt: string } }
  | { type: 'yearbook.upsert'; year: number; at: string }
  | { type: 'snapshot.insert'; snapshot: TasteEvolutionSnapshot }
  | { type: 'event.insert'; event: TasteProfileEvent }
  | { type: 'observationFeedback.insert'; feedback: TasteObservationFeedback }
  | { type: 'agentObservation.insert'; bundle: AgentObservationBundle }
  | { type: 'profile.allowAi'; allow: boolean }

export type QueueItem = {
  /** Unique per enqueue. A later edit replaces the item and gets a new id. */
  id: string
  key: string
  op: QueueOp
  attempts: number
}

export type FlushResult = {
  done: number
  remaining: number
  error: string | null
  retryable: boolean
}

const QUEUE_PREFIX = 'fbf.queue.v1.'
const queueKey = (userId: string) => `${QUEUE_PREFIX}${userId}`

export const opKey = (op: QueueOp): string => {
  switch (op.type) {
    case 'note.upsert':
      return `note:${op.note.id}`
    case 'note.delete':
      return `note:${op.noteId}`
    case 'analysis.upsert':
      return `analysis:${op.analysis.recordId}`
    case 'analysis.delete':
      return `analysis:${op.noteId}`
    case 'film.upsert':
      return `film:${op.film.id}`
    case 'feedback.upsert':
      return `feedback:${op.scope}:${op.key}`
    case 'correction.insert':
      return `correction:${op.correction.id}`
    case 'yearbook.upsert':
      return `yearbook:${op.year}`
    case 'snapshot.insert':
      return `snapshot:${op.snapshot.snapshot_id}`
    case 'event.insert':
      return `event:${op.event.id}`
    case 'observationFeedback.insert':
      return `observationFeedback:${op.feedback.feedback_id}`
    case 'agentObservation.insert':
      return `agentObservation:${op.bundle.observation.observation_id}`
    case 'profile.allowAi':
      return 'profile:allowAi'
  }
}

export const loadQueue = (userId: string): QueueItem[] => {
  try {
    const raw = window.localStorage.getItem(queueKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as { items?: QueueItem[] }
    if (!Array.isArray(parsed.items)) return []
    return parsed.items.map((item, index) => ({
      ...item,
      id: item.id || `legacy:${item.key || index}`,
    }))
  } catch {
    return []
  }
}

const saveQueue = (userId: string, items: QueueItem[]): void => {
  try {
    if (items.length === 0) {
      window.localStorage.removeItem(queueKey(userId))
      return
    }
    window.localStorage.setItem(queueKey(userId), JSON.stringify({ items, updatedAt: new Date().toISOString() }))
  } catch {
    /* Quota errors must never break the UI; the item stays in memory only. */
  }
}

const newId = (): string => {
  const random = globalThis.crypto?.randomUUID?.()
  return random ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Enqueue operations, replacing any earlier op with the same key. */
export const enqueue = (userId: string, ops: QueueOp[]): number => {
  if (ops.length === 0) return loadQueue(userId).length
  const items = loadQueue(userId)
  for (const op of ops) {
    const key = opKey(op)
    const existing = items.findIndex((item) => item.key === key)
    if (existing >= 0) items.splice(existing, 1)
    items.push({ id: newId(), key, op, attempts: 0 })
  }
  saveQueue(userId, items)
  return items.length
}

export const clearQueue = (userId: string): void => saveQueue(userId, [])

export const pendingCount = (userId: string): number => loadQueue(userId).length

const applyOp = async (
  client: SupabaseClient,
  userId: string,
  op: QueueOp,
): Promise<WriteResult> => {
  switch (op.type) {
    case 'note.upsert':
      return writeNote(client, userId, op.note, op.film)
    case 'note.delete':
      return softDeleteNote(client, op.noteId)
    case 'analysis.upsert':
      return writeAnalysis(client, userId, op.analysis)
    case 'analysis.delete':
      return deleteAnalysis(client, op.noteId)
    case 'film.upsert':
      return writeFilm(client, userId, op.film)
    case 'feedback.upsert':
      return writeFeedback(
        client,
        userId,
        op.scope,
        op.key,
        op.verdict,
        op.correction,
        op.updatedAt,
      )
    case 'correction.insert':
      return insertCorrection(client, userId, op.correction)
    case 'yearbook.upsert':
      return writeYearbook(client, userId, op.year, op.at)
    case 'snapshot.insert':
      return insertSnapshot(client, userId, op.snapshot)
    case 'event.insert':
      return insertEvent(client, userId, op.event)
    case 'observationFeedback.insert':
      return insertObservationFeedback(client, userId, op.feedback)
    case 'agentObservation.insert':
      return insertAgentObservation(client, userId, op.bundle)
    case 'profile.allowAi':
      return writeAllowAi(client, userId, op.allow)
  }
}

const removeById = (userId: string, id: string): void => {
  saveQueue(
    userId,
    loadQueue(userId).filter((item) => item.id !== id),
  )
}

const bumpAttempt = (userId: string, id: string): void => {
  const items = loadQueue(userId).map((item) =>
    item.id === id ? { ...item, attempts: item.attempts + 1 } : item,
  )
  saveQueue(userId, items)
}

/** Drain the queue in order. Stops at the first error and keeps the rest. */
export const flushQueue = async (
  client: SupabaseClient,
  userId: string,
): Promise<FlushResult> => {
  let done = 0

  while (true) {
    const items = loadQueue(userId)
    if (items.length === 0) {
      return { done, remaining: 0, error: null, retryable: false }
    }

    const item = items[0]
    const outcome = await applyOp(client, userId, item.op)

    if (outcome.error) {
      bumpAttempt(userId, item.id)
      return {
        done,
        remaining: loadQueue(userId).length,
        error: outcome.error,
        retryable: !!outcome.retryable,
      }
    }

    removeById(userId, item.id)
    done += 1
  }
}
