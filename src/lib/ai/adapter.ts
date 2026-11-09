import type { AddFilmDraft, AIFilmAnalysis, Film, MoodId, ThemeId, WatchRecord } from '@/types'
import { clamp } from '@/lib/format'
import { feltLikeMoodIds, feltLikeText } from '@/lib/feltLike'
import type { AiAnalyzeResponse } from './types'

export const themesOfAnalysis = (analysis: AIFilmAnalysis): ThemeId[] =>
  Array.from(new Set(analysis.themes_identified.map((item) => item.theme)))

export const moodsOfAnalysis = (analysis: AIFilmAnalysis): MoodId[] =>
  Array.from(new Set(analysis.observed_emotions.map((item) => item.mood)))

/**
 * Converts the validated model payload into the persisted analysis record.
 * User corrections are intentionally not applied here: a fresh analysis is
 * always unreviewed until the user accepts it.
 */
export const toFilmAnalysis = (
  response: AiAnalyzeResponse,
  recordId: string,
  filmId: string,
  reviewedAt: string,
): AIFilmAnalysis => ({
  schemaVersion: 1,
  recordId,
  filmId,
  status: 'complete',
  summary: response.analysis.summary,
  observed_emotions: response.analysis.observed_emotions,
  themes_identified: response.analysis.themes_identified,
  narrative_observations: response.analysis.focus.narrative,
  character_observations: response.analysis.focus.character,
  visual_observations: response.analysis.focus.visual,
  liked: response.analysis.liked,
  disliked: response.analysis.disliked,
  preference_evidence: response.analysis.preference_evidence,
  uncertainties: response.analysis.uncertainties,
  confidence: response.analysis.confidence,
  related_films: response.analysis.related_films.map((item) => ({
    filmId: item.film_id,
    relationship: item.relationship,
    explanation: item.explanation,
  })),
  model: {
    provider: response.meta.provider,
    model: response.meta.model,
    promptVersion: response.meta.promptVersion,
    analyzedAt: response.meta.analyzedAt,
    latencyMs: response.meta.latencyMs,
    inputChars: response.meta.inputChars,
  },
  review: { verdict: 'unreviewed', updatedAt: reviewedAt },
})

export const createRecordFromAnalysis = (
  film: Film,
  draft: AddFilmDraft,
  analysis: AIFilmAnalysis,
  recordId: string,
): WatchRecord => {
  const now = new Date().toISOString()
  return {
    id: recordId,
    filmId: film.id,
    rating: clamp(draft.rating, 0.5, 5),
    watchedAt: draft.watchedAt,
    status: draft.status,
    reflection: draft.reflection.trim(),
    feltLike: feltLikeText(draft.feltLikeTags) || undefined,
    feltLikeTags: draft.feltLikeTags,
    themes: themesOfAnalysis(analysis),
    moods: moodsOfAnalysis(analysis),
    createdAt: now,
    updatedAt: now,
    source: 'user',
    ai: {
      summary: analysis.summary,
      extractedFrom: analysis.model.provider === 'local-engine' ? 'local-engine' : 'backend',
      confidence: analysis.confidence,
      status: 'complete',
      model: analysis.model.model,
      promptVersion: analysis.model.promptVersion,
      analysedAt: analysis.model.analyzedAt,
    },
  }
}

/** Saving without a completed analysis must never fabricate tags. */
export const createRecordWithoutAnalysis = (
  film: Film,
  draft: AddFilmDraft,
  recordId: string,
  reason: 'failed' | 'skipped',
): WatchRecord => {
  const now = new Date().toISOString()
  return {
    id: recordId,
    filmId: film.id,
    rating: clamp(draft.rating, 0.5, 5),
    watchedAt: draft.watchedAt,
    status: draft.status,
    reflection: draft.reflection.trim(),
    feltLike: feltLikeText(draft.feltLikeTags) || undefined,
    feltLikeTags: draft.feltLikeTags,
    themes: [],
    moods: feltLikeMoodIds(draft.feltLikeTags),
    createdAt: now,
    updatedAt: now,
    source: 'user',
    ai: {
      summary: '',
      extractedFrom: 'local-engine',
      confidence: 0,
      status: reason,
    },
  }
}

export const analysisForRecord = (
  analyses: AIFilmAnalysis[],
  recordId: string,
): AIFilmAnalysis | undefined => analyses.find((analysis) => analysis.recordId === recordId)
