import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react'
import { FILMS } from '@/data/films'
import { createInitialState } from '@/data/seed'
import type {
  AIAnalysisVerdict,
  AIFilmAnalysis,
  AppState,
  DimensionFeedback,
  DimensionKey,
  Film,
  TasteProfileEvent,
  TimelineFeedbackMap,
  WatchRecord,
} from '@/types'
import { clearState, loadState, persistState, relisten } from '@/lib/storage'
import { buildMemoryGraph } from '@/lib/graph'
import { buildTimeline, computeSnapshot } from '@/lib/tasteEngine'
import { computeTasteProfile, dimensionProfileDelta } from '@/lib/ai/tasteProfile'

type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'upsert-record'; record: WatchRecord; editingId?: string }
  | { type: 'delete-record'; id: string; at: string; films: Film[]; filmTitle: string }
  | { type: 'set-feedback'; key: DimensionKey; feedback: DimensionFeedback }
  | { type: 'set-timeline-feedback'; stageId: string; feedback: TimelineFeedbackMap[string] }
  | { type: 'add-correction'; id: string; scope: string; text: string; createdAt: string }
  | { type: 'add-film'; film: Film }
  | { type: 'mark-yearbook'; id: string }
  | { type: 'save-analysis'; analysis: AIFilmAnalysis }
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

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'upsert-record': {
      const target = state.records.find(
        (r) => r.id === action.record.id || r.id === action.editingId || r.filmId === action.record.filmId,
      )
      const records = target
        ? state.records.map((r) => (r.id === target.id ? action.record : r))
        : [action.record, ...state.records]
      // If the record id changed, keep its analysis attached to the new id.
      const analyses =
        target && target.id !== action.record.id
          ? state.analyses.map((analysis) =>
              analysis.recordId === target.id ? { ...analysis, recordId: action.record.id } : analysis,
            )
          : state.analyses
      return { ...state, records, analyses }
    }
    case 'delete-record': {
      const next: AppState = {
        ...state,
        records: state.records.filter((r) => r.id !== action.id),
        analyses: state.analyses.filter((analysis) => analysis.recordId !== action.id),
      }
      if (!state.analyses.some((analysis) => analysis.recordId === action.id)) return next
      return withProfileEvent(state, next, action.films, {
        recordId: action.id,
        filmTitle: action.filmTitle,
        kind: 'delete',
        reason: `删除了《${action.filmTitle}》的观影记录，其 AI 证据也一并移除。`,
        at: action.at,
      })
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
      return {
        ...state,
        analyses: exists
          ? state.analyses.map((analysis) =>
              analysis.recordId === action.analysis.recordId ? action.analysis : analysis,
            )
          : [action.analysis, ...state.analyses],
      }
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
      return withProfileEvent(state, next, action.films, {
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
      })
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
      return withProfileEvent(state, next, action.films, {
        recordId: action.recordId,
        filmTitle: action.filmTitle,
        kind: 'edit',
        reason:
          action.status === 'removed'
            ? `你移除了《${action.filmTitle}》分析中的一项判断，它不再计入画像。`
            : `你恢复了《${action.filmTitle}》分析中的一项判断。`,
        at: action.at,
      })
    }
    case 'delete-analysis': {
      const next: AppState = {
        ...state,
        analyses: state.analyses.filter((analysis) => analysis.recordId !== action.recordId),
      }
      return withProfileEvent(state, next, action.films, {
        recordId: action.recordId,
        filmTitle: action.filmTitle,
        kind: 'delete',
        reason: `你删除了《${action.filmTitle}》的 AI 分析，原始观影记录仍然保留。`,
        at: action.at,
      })
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
  storageAvailable: boolean
  hydrated: boolean
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
  setAiConsent: (allow: boolean) => void
  resetDemo: () => void
}

const StoreContext = createContext<StoreValue | null>(null)

export const AppStoreProvider = ({ children }: { children: ReactNode }) => {
  const initial = useMemo(() => loadState(), [])
  const [state, dispatch] = useReducer(reducer, initial.state)
  const [hydrated, setHydrated] = useState(false)

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

  const snapshot = useMemo(() => computeSnapshot(state.records, films), [state.records, films])
  const profile = useMemo(() => computeTasteProfile(state, films), [state, films])
  const timeline = useMemo(() => buildTimeline(state.records, films), [state.records, films])
  const graph = useMemo(() => buildMemoryGraph(state.records, films), [state.records, films])

  const titleOf = useCallback(
    (recordId: string): string => {
      const record = state.records.find((item) => item.id === recordId)
      const film = record ? films.find((item) => item.id === record.filmId) : undefined
      return film?.title ?? '这部电影'
    },
    [state.records, films],
  )

  const upsertRecord = useCallback(
    (record: WatchRecord, editingId?: string) => dispatch({ type: 'upsert-record', record, editingId }),
    [],
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
    (analysis: AIFilmAnalysis) => dispatch({ type: 'save-analysis', analysis }),
    [],
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
    storageAvailable: initial.source !== 'unavailable',
    hydrated,
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
