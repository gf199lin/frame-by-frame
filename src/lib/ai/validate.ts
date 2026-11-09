import { DIMENSIONS, MOODS, THEMES } from '@/data/taxonomy'
import type { DimensionKey, MoodId, ThemeId } from '@/types'
import type { AiAnalyzeResponse, AiContribution, AiModelAnalysis } from './types'

export type AiValidation<T> = { ok: true; value: T; warnings: string[] } | { ok: false; errors: string[] }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const list = (value: unknown, maxItems: number, maxChars: number): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => text(item, maxChars))
    .filter(Boolean)
    .slice(0, maxItems)
}

const DIMENSION_KEYS = DIMENSIONS.map((dimension) => dimension.key) as DimensionKey[]
const THEME_KEYS = Object.keys(THEMES) as ThemeId[]
const MOOD_KEYS = Object.keys(MOODS) as MoodId[]

const normalise = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\s\u3000，。！？、；：“”‘’"'.,!?;:()[\]{}<>《》—–\-…·]/g, '')

/**
 * Client-side mirror of the server validator. The server is authoritative;
 * this exists so a malformed or truncated response can never reach storage.
 */
export const validateModelAnalysis = (
  raw: unknown,
  context: { note: string; historyIds: string[] },
): AiValidation<AiModelAnalysis> => {
  const errors: string[] = []
  const warnings: string[] = []
  if (!isObject(raw)) return { ok: false, errors: ['analysis must be an object'] }

  const summary = text(raw.summary, 400)
  if (summary.length < 4) errors.push('summary is missing')

  const observed_emotions: AiModelAnalysis['observed_emotions'] = []
  if (!Array.isArray(raw.observed_emotions)) {
    errors.push('observed_emotions must be an array')
  } else {
    for (const item of raw.observed_emotions.slice(0, 6)) {
      if (!isObject(item)) {
        errors.push('observed_emotions contains a non-object')
        continue
      }
      const mood = item.mood
      if (typeof mood !== 'string' || !MOOD_KEYS.includes(mood as MoodId)) {
        errors.push(`unknown mood: ${String(mood)}`)
        continue
      }
      const evidence = text(item.evidence, 240)
      if (!evidence) errors.push('observed_emotions evidence is missing')
      observed_emotions.push({ mood: mood as MoodId, evidence })
    }
  }

  const themes_identified: AiModelAnalysis['themes_identified'] = []
  if (!Array.isArray(raw.themes_identified)) {
    errors.push('themes_identified must be an array')
  } else {
    for (const item of raw.themes_identified.slice(0, 6)) {
      if (!isObject(item)) {
        errors.push('themes_identified contains a non-object')
        continue
      }
      const theme = item.theme
      if (typeof theme !== 'string' || !THEME_KEYS.includes(theme as ThemeId)) {
        errors.push(`unknown theme: ${String(theme)}`)
        continue
      }
      const evidence = text(item.evidence, 240)
      if (!evidence) errors.push('themes_identified evidence is missing')
      themes_identified.push({ theme: theme as ThemeId, evidence })
    }
  }

  const focusRaw = isObject(raw.focus) ? raw.focus : {}
  const focus = {
    narrative: list(focusRaw.narrative, 4, 240),
    character: list(focusRaw.character, 4, 240),
    visual: list(focusRaw.visual, 4, 240),
  }

  const preference_evidence: AiContribution[] = []
  if (!Array.isArray(raw.preference_evidence) || raw.preference_evidence.length === 0) {
    errors.push('preference_evidence must contain at least one claim')
  } else {
    const noteNormalised = normalise(context.note)
    for (const item of raw.preference_evidence.slice(0, 12)) {
      if (!isObject(item)) {
        errors.push('preference_evidence contains a non-object')
        continue
      }
      const dimension = item.dimension_id
      if (typeof dimension !== 'string' || !DIMENSION_KEYS.includes(dimension as DimensionKey)) {
        errors.push(`unknown dimension_id: ${String(dimension)}`)
        continue
      }
      const direction = item.direction
      if (direction !== 'low' && direction !== 'high' && direction !== 'neutral') {
        errors.push('preference_evidence direction must be low, high or neutral')
        continue
      }
      const strength = num(item.strength)
      const confidence = num(item.confidence)
      if (strength === null || strength < 0 || strength > 1) {
        errors.push('preference_evidence strength must be between 0 and 1')
        continue
      }
      if (confidence === null || confidence < 0 || confidence > 1) {
        errors.push('preference_evidence confidence must be between 0 and 1')
        continue
      }
      const evidence = text(item.evidence, 240)
      if (!evidence) {
        errors.push('preference_evidence evidence is missing')
        continue
      }
      let quote = text(item.quote, 200)
      if (quote && (normalise(quote).length < 3 || !noteNormalised.includes(normalise(quote)))) {
        warnings.push('dropped a quote that was not found in the user note')
        quote = ''
      }
      preference_evidence.push({
        dimension_id: dimension as DimensionKey,
        direction,
        strength,
        confidence,
        evidence,
        ...(quote ? { quote } : {}),
      })
    }
    if (preference_evidence.length === 0) errors.push('no usable preference evidence')
  }

  const confidence = num(raw.confidence)
  if (confidence === null || confidence < 0 || confidence > 1) {
    errors.push('confidence must be between 0 and 1')
  }

  const allowed = new Set(context.historyIds)
  const related_films: AiModelAnalysis['related_films'] = []
  if (Array.isArray(raw.related_films)) {
    for (const item of raw.related_films.slice(0, 4)) {
      if (!isObject(item)) continue
      const filmId = text(item.film_id, 120)
      if (!filmId || !allowed.has(filmId)) {
        if (filmId) warnings.push(`dropped unknown related film: ${filmId}`)
        continue
      }
      const explanation = text(item.explanation, 240)
      if (!explanation) continue
      related_films.push({
        film_id: filmId,
        relationship: text(item.relationship, 40) || 'other',
        explanation,
      })
    }
  } else if (raw.related_films !== undefined) {
    errors.push('related_films must be an array')
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    warnings,
    value: {
      summary,
      observed_emotions,
      themes_identified,
      focus,
      liked: list(raw.liked, 5, 240),
      disliked: list(raw.disliked, 5, 240),
      preference_evidence,
      uncertainties: list(raw.uncertainties, 5, 240),
      confidence: confidence as number,
      related_films,
    },
  }
}

export const validateAnalyzeResponse = (
  raw: unknown,
  context: { note: string; historyIds: string[] },
): AiValidation<AiAnalyzeResponse> => {
  if (!isObject(raw)) return { ok: false, errors: ['response must be an object'] }
  if (!isObject(raw.meta)) return { ok: false, errors: ['response.meta is missing'] }
  const meta = raw.meta
  const model = text(meta.model, 120)
  const provider = text(meta.provider, 120)
  const promptVersion = text(meta.promptVersion, 60)
  const analyzedAt = text(meta.analyzedAt, 40)
  if (!model || !provider || !promptVersion || !analyzedAt) {
    return { ok: false, errors: ['response.meta is incomplete'] }
  }
  const analysis = validateModelAnalysis(raw.analysis, context)
  if (!analysis.ok) return analysis
  return {
    ok: true,
    warnings: analysis.warnings,
    value: {
      analysis: analysis.value,
      meta: {
        provider,
        model,
        promptVersion,
        analyzedAt,
        latencyMs: num(meta.latencyMs) ?? 0,
        inputChars: num(meta.inputChars) ?? context.note.length,
        attempts: num(meta.attempts) ?? 1,
      },
    },
  }
}
