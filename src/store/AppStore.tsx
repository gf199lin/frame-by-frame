import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { FILMS } from '@/data/films'
import { createInitialState } from '@/data/seed'
import type {
  AIAnalysisVerdict,
  AIFilmAnalysis,
  AgentObservationBundle,
  AppState,
  DimensionFeedback,
  DimensionKey,
  Film,
  ObservationDecision,
  TasteEvolutionSnapshot,
  TasteProfileEvent,
  TimelineFeedbackMap,
  WatchRecord,
} from '@/types'
import { clearState, loadState, persistState, relisten } from '@/lib/storage'
import { buildMemoryGraph } from '@/lib/graph'
import { buildTimeline, computeSnapshot } from '@/lib/tasteEngine'
import { computeTasteProfile, dimensionProfileDelta } from '@/lib/ai/tasteProfile'
import { appendSnapshot, computeEvolution } from '@/lib/taste/evolution'
import { importEvolutionDoc, type EvolutionImportResult } from '@/lib/taste/evolutionImport'
import { useSession } from '@/auth/session'
import { getSupabaseClient } from '@/lib/supabase/client'
import { fetchRemote } from '@/lib/db/remote'
import { remoteToState } from '@/lib/db/map'
import type { SyncStatus } from '@/lib/db/rows'
import { bootstrapOps, diffState, shadowFromState, type Shadow } from '@/lib/sync/diff'
import { enqueue, flushQueue, pendingCount } from '@/lib/sync/queue'

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'ensure-snapshot'; films: Film[]; at: string }
  | {
      type: 'upsert-record'
      record: WatchRecord
      editingId?: string
      films: Film[]
      at: string
      filmTitle: string
    }
  | { type: 'delete-record'; id: string; at: string; films: Film[]; filmTitle: string }
  | { type: 'set-feedback'; key: DimensionKey; feedback: DimensionFeedback }
  | { type: 'set-timeline-feedback'; stageId: string; feedback: TimelineFeedbackMap[string] }
  | { type: 'add-correction'; id: string; scope: string; text: string; createdAt: string }
  | { type: 'add-film'; film: Film }
  | { type: 'mark-yearbook'; id: string }
  | { type: 'save-analysis'; analysis: AIFilmAnalysis; films: Film[]; at: string }
  | {
      type: 'review-analysis'
      recordId: string
      verdict: AIAnalysisVerdict
      note?: string
      at: string
      films: Film[]
      filmTitle: string
    }
  | {
      type: 'set-contribution'
      recordId: string
      dimension: DimensionKey
      status: 'kept' | 'removed'
      at: string
      films: Film[]
      filmTitle: string
    }
  | { type: 'delete-analysis'; recordId: string; at: string; films: Film[]; filmTitle: string }
  | {
      type: 'set-observation-feedback'
      observationId: string
      decision: ObservationDecision
      comment?: string
      at: string
      films: Film[]
      snapshotId: string
    }
  | {
      type: 'import-evolution'
      bundles: AgentObservationBundle[]
      snapshot: TasteEvolutionSnapshot | null
      at: string
    }
  | { type: 'set-ai-consent'; allow: boolean }
  | { type: 'reset' }

const eventId = () => `pf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const withProfileEvent = (
  before: AppState,
  next: AppState,
  films: Film[],
  meta: {
    recordId?: string
    filmTitle?: string
    kind: TasteProfileEvent['kind']
    reason: string
    at: string
  },
): AppState => {
  const previousProfile = computeTasteProfile(before, films)
  const nextProfile = computeTasteProfile(next, films)
  const event: TasteProfileEvent = {
    id: eventId(),
    at: meta.at,
    ...(meta.recordId ? { recordId: meta.recordId } : {}),
    ...(meta.filmTitle ? { filmTitle: meta.filmTitle } : {}),
    kind: meta.kind,
    filmCount: nextProfile.filmCount,
    acceptedCount: nextProfile.acceptedCount,
    changes: dimensionProfileDelta(previousProfile, nextProfile),
    reason: meta.reason,
  }
  return { ...next, profileHistory: [event, ...next.profileHistory].slice(0, 80) }
}

/** Exported for tests: the store itself always goes through this reducer. */
export const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'ensure-snapshot': {
      if (state.tasteSnapshots.length > 0) return state
      return appendSnapshot(state, action.films, action.at)
    }
    case 'upsert-record': {
      const target = state.records.find(
        (r) => r.id === action.record.id || r.id === action.editingId || r.filmId === action.record.filmId,
      )
      const records = target
        ? state.records.map((r) => (r.id === target.id ? action.record : r))
        : [action.record, ...state.records]
      const noteChanged =
        target !== undefined && target.reflection.trim() !== action.record.reflection.trim()
      // If the record id changed, keep its analysis attached to the new id.
      let analyses =
        target && target.id !== action.record.id
          ? state.analyses.map((analysis) =>
              analysis.recordId === target.id ? { ...analysis, recordId: action.record.id } : analysis,
            )
          : state.analyses
      if (noteChanged && target) {
        // A changed note invalidates the old reading: its quotes can no longer
        // be verified against the note, so they stop feeding the profile.
        analyses = analyses.map((analysis) =>
          analysis.recordId === target.id
            ? {
                ...analysis,
                review: {
                  verdict: 'unreviewed' as const,
                  note: '原始笔记已修改，旧证据暂停计入画像，等待重新分析。',
                  updatedAt: action.at,
                },
              }
            : analysis,
        )
      }
      const next: AppState = { ...state, records, analyses }
      if (!noteChanged || !target) return appendSnapshot(next, action.films, action.at)
      return appendSnapshot(
        withProfileEvent(state, next, action.films, {
          recordId: target.id,
          filmTitle: action.filmTitle,
          kind: 'edit',
          reason: `你修改了《${action.filmTitle}》的原始笔记，旧证据暂停计入画像，等待新的确认。`,
          at: action.at,
        }),
        action.films,
        action.at,
      )
    }
    case 'delete-record': {
      const next: AppState = {
        ...state,
        records: state.records.filter((r) => r.id !== action.id),
        analyses: state.analyses.filter((analysis) => analysis.recordId !== action.id),
      }
      const hadAnalysis = state.analyses.some((analysis) => analysis.recordId === action.id)
      if (!hadAnalysis) return appendSnapshot(next, action.films, action.at)
      return appendSnapshot(
        withProfileEvent(state, next, action.films, {
          recordId: action.id,
          filmTitle: action.filmTitle,
          kind: 'delete',
          reason: `删除了《${action.filmTitle}》的观影记录，其 AI 证据也一并移除。`,
          at: action.at,
        }),
        action.films,
        action.at,
      )
    }
    case 'set-feedback':
      return { ...state, feedback: { ...state.feedback, [action.key]: action.feedback } }
    case 'set-timeline-feedback':
      return {
        ...state,
        timelineFeedback: { ...state.timelineFeedback, [action.stageId]: action.feedback },
      }
    case 'add-correction':
      return {
        ...state,
        corrections: [
          { id: action.id, scope: action.scope, text: action.text, createdAt: action.createdAt },
          ...state.corrections,
        ],
      }
    case 'add-film': {
      const exists = state.customFilms.some((film) => film.id === action.film.id)
      return {
        ...state,
        customFilms: exists
          ? state.customFilms.map((film) => (film.id === action.film.id ? action.film : film))
          : [...state.customFilms, action.film],
      }
    }
    case 'mark-yearbook':
      return {
        ...state,
        yearbookGenerations: [action.id, ...state.yearbookGenerations].slice(0, 12),
      }
    case 'save-analysis': {
      const exists = state.analyses.some((analysis) => analysis.recordId === action.analysis.recordId)
      const next: AppState = {
        ...state,
        analyses: exists
          ? state.analyses.map((analysis) =>
              analysis.recordId === action.analysis.recordId ? action.analysis : analysis,
            )
          : [action.analysis, ...state.analyses],
      }
      return appendSnapshot(next, action.films, action.at)
    }
    case 'review-analysis': {
      const existing = state.analyses.find((analysis) => analysis.recordId === action.recordId)
      if (!existing) return state
      const next: AppState = {
        ...state,
        analyses: state.analyses.map((analysis) =>
          analysis.recordId === action.recordId
            ? {
                ...analysis,
                review: {
                  verdict: action.verdict,
                  ...(action.note ? { note: action.note } : {}),
                  updatedAt: action.at,
                },
              }
            : analysis,
        ),
      }
      const reason =
        action.verdict === 'accepted'
          ? `你接受了《${action.filmTitle}》的 AI 分析，证据被纳入画像。`
          : action.verdict === 'edited'
            ? `你修改后接受了《${action.filmTitle}》的 AI 分析。`
            : action.verdict === 'rejected'
              ? `你拒绝了《${action.filmTitle}》的 AI 分析，其证据不再计入画像。`
              : `《${action.filmTitle}》的分析回到待确认状态。`
      return appendSnapshot(
        withProfileEvent(state, next, action.films, {
          recordId: action.recordId,
          filmTitle: action.filmTitle,
          kind:
            action.verdict === 'rejected'
              ? 'reject'
              : action.verdict === 'edited'
                ? 'edit'
                : 'accept',
          reason,
          at: action.at,
        }),
        action.films,
        action.at,
      )
    }
    case 'set-contribution': {
      const existing = state.analyses.find((analysis) => analysis.recordId === action.recordId)
      if (!existing) return state
      const next: AppState = {
        ...state,
        analyses: state.analyses.map((analysis) =>
          analysis.recordId === action.recordId
            ? {
                ...analysis,
                review: {
                  verdict: analysis.review.verdict === 'unreviewed' ? 'edited' : analysis.review.verdict,
                  ...(analysis.review.note ? { note: analysis.review.note } : {}),
                  updatedAt: action.at,
                },
                preference_evidence: analysis.preference_evidence.map((contribution) =>
                  contribution.dimension_id === action.dimension
                    ? { ...contribution, userStatus: action.status }
                    : contribution,
                ),
              }
            : analysis,
        ),
      }
      return appendSnapshot(
        withProfileEvent(state, next, action.films, {
          recordId: action.recordId,
          filmTitle: action.filmTitle,
          kind: 'edit',
          reason:
            action.status === 'removed'
              ? `你移除了《${action.filmTitle}》分析中的一项判断，它不再计入画像。`
              : `你恢复了《${action.filmTitle}》分析中的一项判断。`,
          at: action.at,
        }),
        action.films,
        action.at,
      )
    }
    case 'delete-analysis': {
      const next: AppState = {
        ...state,
        analyses: state.analyses.filter((analysis) => analysis.recordId !== action.recordId),
      }
      return appendSnapshot(
        withProfileEvent(state, next, action.films, {
          recordId: action.recordId,
          filmTitle: action.filmTitle,
          kind: 'delete',
          reason: `你删除了《${action.filmTitle}》的 AI 分析，原始观影记录仍然保留。`,
          at: action.at,
        }),
        action.films,
        action.at,
      )
    }
    case 'set-observation-feedback': {
      const existing = state.observationFeedback.find(
        (feedback) => feedback.observation_id === action.observationId,
      )
      if (
        existing &&
        existing.decision === action.decision &&
        (existing.user_comment ?? '') === (action.comment ?? '')
      ) {
        // Identical feedback is counted once, never twice.
        return state
      }
      const feedback = {
        feedback_id: `fb_${action.observationId}_${Date.now().toString(36)}${Math.random()
          .toString(36)
          .slice(2, 5)}`,
        observation_id: action.observationId,
        decision: action.decision,
        ...(action.comment?.trim() ? { user_comment: action.comment.trim() } : {}),
        created_at: action.at,
        affected_snapshot_id: action.snapshotId,
      }
      const next: AppState = {
        ...state,
        observationFeedback: [feedback, ...state.observationFeedback],
        corrections:
          action.comment?.trim()
            ? [
                {
                  id: `cor_${Date.now().toString(36)}`,
                  scope: `observation:${action.observationId}`,
                  text: action.comment.trim(),
                  createdAt: action.at,
                },
                ...state.corrections,
              ]
            : state.corrections,
      }
      return appendSnapshot(next, action.films, action.at)
    }
    case 'import-evolution': {
      if (action.bundles.length === 0 && !action.snapshot) return state
      const byId = new Map(
        state.agentObservations.map((bundle) => [bundle.observation.observation_id, bundle]),
      )
      for (const bundle of action.bundles) {
        byId.set(bundle.observation.observation_id, bundle)
      }
      const agentObservations = Array.from(byId.values()).sort((a, b) =>
        b.analyzed_at.localeCompare(a.analyzed_at),
      )
      let tasteSnapshots = state.tasteSnapshots
      if (
        action.snapshot &&
        !tasteSnapshots.some((item) => item.snapshot_id === action.snapshot!.snapshot_id)
      ) {
        tasteSnapshots = [action.snapshot, ...tasteSnapshots].slice(0, 80)
      }
      return { ...state, agentObservations, tasteSnapshots }
    }
    case 'set-ai-consent':
      return { ...state, settings: { ...state.settings, allowAiNotes: action.allow } }
    case 'reset':
      return createInitialState()
    default:
      return state
  }
}

type StoreValue = {
  state: AppState
  records: WatchRecord[]
  films: Film[]
  customFilms: Film[]
  snapshot: ReturnType<typeof computeSnapshot>
  profile: ReturnType<typeof computeTasteProfile>
  timeline: ReturnType<typeof buildTimeline>
  graph: ReturnType<typeof buildMemoryGraph>
  evolution: ReturnType<typeof computeEvolution>
  observations: ReturnType<typeof computeEvolution>['observations']
  storageAvailable: boolean
  hydrated: boolean
  syncStatus: SyncStatus
  syncError: string | null
  pendingWrites: number
  retrySync: () => void
  upsertRecord: (record: WatchRecord, editingId?: string) => void
  deleteRecord: (id: string) => void
  setDimensionFeedback: (
    key: DimensionKey,
    verdict: DimensionFeedback['verdict'],
    correction?: string,
  ) => void
  setTimelineFeedback: (stageId: string, verdict: TimelineFeedbackMap[string]['verdict'], correction?: string) => void
  addCorrection: (scope: string, text: string) => void
  addCustomFilm: (film: Film) => void
  markYearbook: (id: string) => void
  saveAnalysis: (analysis: AIFilmAnalysis) => void
  reviewAnalysis: (recordId: string, verdict: AIAnalysisVerdict, note?: string) => void
  setContributionStatus: (recordId: string, dimension: DimensionKey, status: 'kept' | 'removed') => void
  deleteAnalysis: (recordId: string) => void
  setObservationFeedback: (
    observationId: string,
    decision: ObservationDecision,
    comment?: string,
  ) => void
  importEvolution: (doc: unknown) => Promise<EvolutionImportResult>
  setAiConsent: (allow: boolean) => void
  resetDemo: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export const AppStoreProvider = ({ children }: { children: ReactNode }) => {
  const initial = useMemo(() => loadState(), [])
  const [state, dispatch] = useReducer(appReducer, initial.state)
  const [hydrated, setHydrated] = useState(false)
  const { user } = useSession()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncError, setSyncError] = useState<string | null>(null)
  const [pendingWrites, setPendingWrites] = useState(0)
  const shadowRef = useRef<Shadow | null>(null)
  const syncedUserRef = useRef<string | null>(null)
  const flushingRef = useRef(false)

  const runFlush = useCallback(async (uid: string) => {
    const client = getSupabaseClient()
    if (!client || flushingRef.current) return
    flushingRef.current = true
    setSyncStatus('syncing')
    try {
      for (let round = 0; round < 5; round += 1) {
        const result = await flushQueue(client, uid)
        setPendingWrites(result.remaining)
        if (result.error) {
          setSyncError(result.error)
          setSyncStatus('error')
          return
        }
        if (result.remaining === 0) break
      }
      setSyncError(null)
      setSyncStatus(pendingCount(uid) > 0 ? 'pending' : 'idle')
    } finally {
      flushingRef.current = false
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setHydrated(true), 380)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    persistState(state)
  }, [state])

  useEffect(() => relisten((next) => dispatch({ type: 'hydrate', state: next })), [])

  const films = useMemo(() => {
    const builtIn = new Set(FILMS.map((film) => film.id))
    return [...FILMS, ...state.customFilms.filter((film) => !builtIn.has(film.id))]
  }, [state.customFilms])

  const filmsRef = useRef(films)
  filmsRef.current = films

  /* Hydrate from Supabase once per account, then keep writing in the background. */
  useEffect(() => {
    const uid = user?.id
    if (!uid) return
    const client = getSupabaseClient()
    if (!client) {
      setSyncStatus('error')
      setSyncError('还没有连接到云端，请检查 .env.local 中的 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY。')
      return
    }

    let cancelled = false
    syncedUserRef.current = null
    shadowRef.current = null

    void (async () => {
      setSyncStatus('syncing')
      setSyncError(null)

      try {
        // Never let a pull overwrite notes that are still waiting to be uploaded.
        if (pendingCount(uid) > 0) {
          const flushed = await flushQueue(client, uid)
          if (flushed.error) {
            if (cancelled) return
            setPendingWrites(flushed.remaining)
            setSyncError(flushed.error)
            setSyncStatus('error')
            return
          }
        }

        const remote = await fetchRemote(client, uid)
        if (cancelled) return

        if (remote.isEmpty) {
          // First login on this account: upload what is already on this device.
          const local = loadState().state
          const ops = bootstrapOps(local, filmsRef.current)
          enqueue(uid, ops)
          shadowRef.current = shadowFromState(local)
          syncedUserRef.current = uid
          setPendingWrites(ops.length)
          void runFlush(uid)
          return
        }

        const next = remoteToState(remote)
        shadowRef.current = shadowFromState(next)
        syncedUserRef.current = uid
        dispatch({ type: 'hydrate', state: next })
        const remaining = pendingCount(uid)
        setPendingWrites(remaining)
        setSyncStatus(remaining > 0 ? 'pending' : 'idle')
      } catch (error) {
        if (cancelled) return
        setSyncError(error instanceof Error ? error.message : String(error))
        setSyncStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user?.id, runFlush])

  /* Minimal diff -> queue -> flush. Runs after every local state change. */
  useEffect(() => {
    const uid = user?.id
    if (!uid || syncedUserRef.current !== uid || !shadowRef.current) return
    const { ops, next } = diffState(state, shadowRef.current, filmsRef.current)
    shadowRef.current = next
    if (ops.length === 0) return
    const total = enqueue(uid, ops)
    setPendingWrites(total)
    setSyncStatus('pending')
    void runFlush(uid)
  }, [state, user?.id, runFlush])

  const snapshot = useMemo(() => computeSnapshot(state.records, films), [state.records, films])
  const profile = useMemo(() => computeTasteProfile(state, films), [state, films])
  const timeline = useMemo(() => buildTimeline(state.records, films), [state.records, films])
  const evolution = useMemo(() => computeEvolution(state, films), [state, films])
  const graph = useMemo(
    () =>
      buildMemoryGraph(state.records, films, {
        observations: evolution.observations,
      }),
    [state.records, films, evolution.observations],
  )

  /* One baseline snapshot so the first visit already has a time anchor. */
  useEffect(() => {
    if (state.tasteSnapshots.length === 0) {
      dispatch({ type: 'ensure-snapshot', films, at: new Date().toISOString() })
    }
  }, [state.tasteSnapshots.length, films])

  const titleOf = useCallback(
    (recordId: string): string => {
      const record = state.records.find((item) => item.id === recordId)
      const film = record ? films.find((item) => item.id === record.filmId) : undefined
      return film?.title ?? '这部电影'
    },
    [state.records, films],
  )

  const upsertRecord = useCallback(
    (record: WatchRecord, editingId?: string) => {
      const film = films.find((item) => item.id === record.filmId)
      dispatch({
        type: 'upsert-record',
        record,
        editingId,
        films,
        at: new Date().toISOString(),
        filmTitle: film?.title ?? '这部电影',
      })
    },
    [films],
  )

  const deleteRecord = useCallback(
    (id: string) => {
      const record = state.records.find((item) => item.id === id)
      const film = record ? films.find((item) => item.id === record.filmId) : undefined
      dispatch({
        type: 'delete-record',
        id,
        at: new Date().toISOString(),
        films,
        filmTitle: film?.title ?? '这部电影',
      })
    },
    [state.records, films],
  )

  const setDimensionFeedback = useCallback(
    (key: DimensionKey, verdict: DimensionFeedback['verdict'], correction?: string) => {
      dispatch({
        type: 'set-feedback',
        key,
        feedback: { verdict, correction, updatedAt: new Date().toISOString() },
      })
    },
    [],
  )

  const setTimelineFeedback = useCallback(
    (stageId: string, verdict: TimelineFeedbackMap[string]['verdict'], correction?: string) => {
      dispatch({
        type: 'set-timeline-feedback',
        stageId,
        feedback: { verdict, correction, updatedAt: new Date().toISOString() },
      })
    },
    [],
  )

  const addCorrection = useCallback((scope: string, text: string) => {
    dispatch({
      type: 'add-correction',
      id: `cor_${Date.now().toString(36)}`,
      scope,
      text,
      createdAt: new Date().toISOString(),
    })
  }, [])

  const addCustomFilm = useCallback((film: Film) => dispatch({ type: 'add-film', film }), [])
  const markYearbook = useCallback((id: string) => dispatch({ type: 'mark-yearbook', id }), [])

  const saveAnalysis = useCallback(
    (analysis: AIFilmAnalysis) =>
      dispatch({ type: 'save-analysis', analysis, films, at: new Date().toISOString() }),
    [films],
  )

  const reviewAnalysis = useCallback(
    (recordId: string, verdict: AIAnalysisVerdict, note?: string) => {
      dispatch({
        type: 'review-analysis',
        recordId,
        verdict,
        note,
        at: new Date().toISOString(),
        films,
        filmTitle: titleOf(recordId),
      })
    },
    [films, titleOf],
  )

  const setContributionStatus = useCallback(
    (recordId: string, dimension: DimensionKey, status: 'kept' | 'removed') => {
      dispatch({
        type: 'set-contribution',
        recordId,
        dimension,
        status,
        at: new Date().toISOString(),
        films,
        filmTitle: titleOf(recordId),
      })
    },
    [films, titleOf],
  )

  const deleteAnalysis = useCallback(
    (recordId: string) => {
      dispatch({
        type: 'delete-analysis',
        recordId,
        at: new Date().toISOString(),
        films,
        filmTitle: titleOf(recordId),
      })
    },
    [films, titleOf],
  )

  const setObservationFeedback = useCallback(
    (observationId: string, decision: ObservationDecision, comment?: string) => {
      const latestSnapshot = [...state.tasteSnapshots].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )[0]
      dispatch({
        type: 'set-observation-feedback',
        observationId,
        decision,
        comment,
        at: new Date().toISOString(),
        films,
        snapshotId: latestSnapshot?.snapshot_id ?? 'none',
      })
    },
    [state.tasteSnapshots, films],
  )

  const importEvolution = useCallback(
    async (doc: unknown): Promise<EvolutionImportResult> => {
      const result = await importEvolutionDoc(doc, state)
      if (result.ok && !result.alreadyImported) {
        dispatch({
          type: 'import-evolution',
          bundles: result.bundles,
          snapshot: result.snapshot,
          at: new Date().toISOString(),
        })
      }
      return result
    },
    [state],
  )

  const setAiConsent = useCallback(
    (allow: boolean) => dispatch({ type: 'set-ai-consent', allow }),
    [],
  )

  const resetDemo = useCallback(() => {
    clearState()
    dispatch({ type: 'reset' })
  }, [])

  const value: StoreValue = {
    state,
    records: state.records,
    films,
    customFilms: state.customFilms,
    snapshot,
    profile,
    timeline,
    graph,
    evolution,
    observations: evolution.observations,
    storageAvailable: initial.source !== 'unavailable',
    hydrated,
    syncStatus,
    syncError,
    pendingWrites,
    retrySync: () => {
      if (user) void runFlush(user.id)
    },
    upsertRecord,
    deleteRecord,
    setDimensionFeedback,
    setTimelineFeedback,
    addCorrection,
    addCustomFilm,
    markYearbook,
    saveAnalysis,
    reviewAnalysis,
    setContributionStatus,
    deleteAnalysis,
    setObservationFeedback,
    importEvolution,
    setAiConsent,
    resetDemo,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useAppStore = (): StoreValue => {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider')
  return value
}
