import type {
  DimensionId,
  MoodId,
  RelationshipId,
  ThemeId,
} from './contract.ts'

export type FilmInput = {
  id: string
  title: string
  titleZh?: string
  year: number
  director?: string
  genres?: string[]
  country?: string
  language?: string
  runtime?: number
  logline?: string
}

export type HistoryItem = {
  id: string
  title: string
  year: number
  rating: number
  director?: string
  themes?: string[]
  moods?: string[]
  summary?: string
}

export type AnalyzeRequest = {
  film: FilmInput
  rating: number
  watchedAt?: string
  feltLike?: string
  /** The user's own words. This is the primary evidence. */
  note: string
  history?: HistoryItem[]
  locale?: string
}

export type ModelContribution = {
  dimension_id: DimensionId
  direction: 'low' | 'high' | 'neutral'
  strength: number
  confidence: number
  evidence: string
  quote?: string
}

export type ModelAnalysis = {
  summary: string
  observed_emotions: Array<{ mood: MoodId; evidence: string }>
  themes_identified: Array<{ theme: ThemeId; evidence: string }>
  focus: {
    narrative: string[]
    character: string[]
    visual: string[]
  }
  liked: string[]
  disliked: string[]
  preference_evidence: ModelContribution[]
  uncertainties: string[]
  confidence: number
  related_films: Array<{
    film_id: string
    relationship: RelationshipId
    explanation: string
  }>
}

export type ValidationResult<T> = {
  ok: true
  value: T
  warnings: string[]
} | {
  ok: false
  errors: string[]
}

export type AnalysisMeta = {
  provider: string
  model: string
  promptVersion: string
  analyzedAt: string
  latencyMs: number
  inputChars: number
  attempts: number
}

export type AnalyzeResponse = {
  analysis: ModelAnalysis
  meta: AnalysisMeta
}

export type AIErrorCode =
  | 'BAD_REQUEST'
  | 'AI_NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'INVALID_MODEL_OUTPUT'
  | 'INTERNAL'

export type ErrorEnvelope = {
  error: {
    code: AIErrorCode
    message: string
    retryable: boolean
    /** Only present when AI_DEBUG=1; never contains user notes. */
    detail?: string
  }
}
