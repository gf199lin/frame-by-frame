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
  AppState,
  DimensionFeedback,
  DimensionKey,
  Film,
  TimelineFeedbackMap,
  WatchRecord,
} from '@/types'
import { clearState, loadState, persistState, relisten } from '@/lib/storage'
import { buildMemoryGraph } from '@/lib/graph'
import { buildTimeline, computeSnapshot } from '@/lib/tasteEngine'

type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'upsert-record'; record: WatchRecord; editingId?: string }
  | { type: 'delete-record'; id: string }
  | { type: 'set-feedback'; key: DimensionKey; feedback: DimensionFeedback }
  | { type: 'set-timeline-feedback'; stageId: string; feedback: TimelineFeedbackMap[string] }
  | { type: 'add-correction'; id: string; scope: string; text: string; createdAt: string }
  | { type: 'add-film'; film: Film }
  | { type: 'mark-yearbook'; id: string }
  | { type: 'reset' }

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'upsert-record': {
      const exists = state.records.some(
        (r) => r.id === action.record.id || r.id === action.editingId || r.filmId === action.record.filmId,
      )
      const records = exists
        ? state.records.map((r) =>
            r.id === action.record.id || r.id === action.editingId || r.filmId === action.record.filmId
              ? action.record
              : r,
          )
        : [action.record, ...state.records]
      return { ...state, records }
    }
    case 'delete-record':
      return { ...state, records: state.records.filter((r) => r.id !== action.id) }
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
  const timeline = useMemo(() => buildTimeline(state.records, films), [state.records, films])
  const graph = useMemo(() => buildMemoryGraph(state.records, films), [state.records, films])

  const upsertRecord = useCallback(
    (record: WatchRecord, editingId?: string) => dispatch({ type: 'upsert-record', record, editingId }),
    [],
  )
  const deleteRecord = useCallback((id: string) => dispatch({ type: 'delete-record', id }), [])

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
    resetDemo,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useAppStore = (): StoreValue => {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useAppStore must be used inside AppStoreProvider')
  return value
}
