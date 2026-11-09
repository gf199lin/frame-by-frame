import type { DimensionKey, MoodId, TasteDirection, ThemeId } from '@/types'

export type AiFilmInput = {
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

export type AiHistoryItem = {
  id: string
  title: string
  year: number
  rating: number
  director?: string
  themes: string[]
  moods: string[]
  summary?: string
}

export type AiAnalyzeRequest = {
  film: AiFilmInput
  rating: number
  watchedAt?: string
  feltLike?: string
  note: string
  history: AiHistoryItem[]
  locale: 'zh-CN'
}

export type AiContribution = {
  dimension_id: DimensionKey
  direction: TasteDirection
  strength: number
  confidence: number
  evidence: string
  quote?: string
}

export type AiFocus = {
  narrative: string[]
  character: string[]
  visual: string[]
}

export type AiModelAnalysis = {
  summary: string
  observed_emotions: Array<{ mood: MoodId; evidence: string }>
  themes_identified: Array<{ theme: ThemeId; evidence: string }>
  focus: AiFocus
  liked: string[]
  disliked: string[]
  preference_evidence: AiContribution[]
  uncertainties: string[]
  confidence: number
  related_films: Array<{
    film_id: string
    relationship: string
    explanation: string
  }>
}

export type AiAnalysisMeta = {
  provider: string
  model: string
  promptVersion: string
  analyzedAt: string
  latencyMs: number
  inputChars: number
  attempts: number
}

export type AiAnalyzeResponse = {
  analysis: AiModelAnalysis
  meta: AiAnalysisMeta
}

export type AiErrorCode =
  | 'BAD_REQUEST'
  | 'AI_NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'INVALID_MODEL_OUTPUT'
  | 'INTERNAL'
  | 'NETWORK'
  | 'CLIENT_VALIDATION'

export type AiHealth = {
  ok: boolean
  configured: boolean
  provider: string | null
  model: string | null
  promptVersion: string
  reason?: string
}
