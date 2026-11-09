import {
  DIMENSION_IDS,
  LIMITS,
  MOOD_IDS,
  RELATIONSHIP_IDS,
  THEME_IDS,
  isDimensionId,
  isMoodId,
  isRelationshipId,
  isThemeId,
} from './contract.ts'
import type {
  AnalyzeRequest,
  FilmInput,
  HistoryItem,
  ModelAnalysis,
  ValidationResult,
} from './types.ts'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : ''

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const stringList = (value: unknown, maxItems: number, maxChars: number): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => text(item, maxChars))
    .filter((item) => item.length > 0)
    .slice(0, maxItems)
}

/** Normalised form used only to prove a quote really comes from the note. */
export const normaliseForGrounding = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[\s\u3000，。！？、；：“”‘’"'.,!?;:()[\]{}<>《》—–\-…·]/g, '')

/* ------------------------------------------------------------------ */
/*  Request                                                            */
/* ------------------------------------------------------------------ */

export const validateAnalyzeRequest = (raw: unknown): ValidationResult<AnalyzeRequest> => {
  const errors: string[] = []
  if (!isObject(raw)) return { ok: false, errors: ['body must be a JSON object'] }

  const filmRaw = raw.film
  if (!isObject(filmRaw)) return { ok: false, errors: ['film must be an object'] }

  const id = text(filmRaw.id, 120)
  const title = text(filmRaw.title, LIMITS.titleMax)
  const year = finiteNumber(filmRaw.year)
  if (!id) errors.push('film.id is required')
  if (!title) errors.push('film.title is required')
  if (year === null || !Number.isInteger(year) || year < 1888 || year > 2100) {
    errors.push('film.year must be an integer between 1888 and 2100')
  }

  const rating = finiteNumber(raw.rating)
  if (rating === null || rating < 0.5 || rating > 5) {
    errors.push('rating must be a number between 0.5 and 5')
  }

  const note = text(raw.note, LIMITS.noteMax)
  if (note.length < 8) {
    errors.push('note must contain at least 8 characters of the user\u2019s own words')
  }

  const film: FilmInput = {
    id,
    title,
    year: year ?? 0,
    titleZh: text(filmRaw.titleZh, LIMITS.titleMax) || undefined,
    director: text(filmRaw.director, 160) || undefined,
    genres: stringList(filmRaw.genres, 6, 40),
    country: text(filmRaw.country, 80) || undefined,
    language: text(filmRaw.language, 80) || undefined,
    runtime: finiteNumber(filmRaw.runtime) ?? undefined,
    logline: text(filmRaw.logline, 700) || undefined,
  }

  const history: HistoryItem[] = []
  if (raw.history !== undefined && !Array.isArray(raw.history)) {
    errors.push('history must be an array when provided')
  } else if (Array.isArray(raw.history)) {
    for (const item of raw.history.slice(0, LIMITS.historyMax)) {
      if (!isObject(item)) continue
      const itemId = text(item.id, 120)
      const itemTitle = text(item.title, LIMITS.titleMax)
      if (!itemId || !itemTitle) continue
      history.push({
        id: itemId,
        title: itemTitle,
        year: finiteNumber(item.year) ?? 0,
        rating: finiteNumber(item.rating) ?? 0,
        director: text(item.director, 160) || undefined,
        themes: stringList(item.themes, 8, 40),
        moods: stringList(item.moods, 8, 40),
        summary: text(item.summary, LIMITS.historySummaryMax) || undefined,
      })
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    warnings: [],
    value: {
      film,
      rating: rating as number,
      watchedAt: text(raw.watchedAt, 40) || undefined,
      feltLike: text(raw.feltLike, 120) || undefined,
      note,
      history,
      locale: text(raw.locale, 20) || 'zh-CN',
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Model output                                                       */
/* ------------------------------------------------------------------ */

const ALLOWED_TOP_LEVEL = new Set([
  'summary',
  'observed_emotions',
  'themes_identified',
  'focus',
  'liked',
  'disliked',
  'preference_evidence',
  'uncertainties',
  'confidence',
  'related_films',
])

export const validateModelAnalysis = (
  raw: unknown,
  context: { note: string; historyIds: string[] },
): ValidationResult<ModelAnalysis> => {
  const errors: string[] = []
  const warnings: string[] = []
  if (!isObject(raw)) return { ok: false, errors: ['top level must be a JSON object'] }

  for (const key of Object.keys(raw)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) warnings.push(`ignored unknown field: ${key}`)
  }

  const summary = text(raw.summary, LIMITS.summaryMax)
  if (summary.length < 4) errors.push('summary is required and must be meaningful')

  const observed_emotions: ModelAnalysis['observed_emotions'] = []
  if (!Array.isArray(raw.observed_emotions)) {
    errors.push('observed_emotions must be an array')
  } else {
    if (raw.observed_emotions.length > LIMITS.emotionsMax) {
      warnings.push('observed_emotions truncated')
    }
    for (const [index, item] of raw.observed_emotions.slice(0, LIMITS.emotionsMax).entries()) {
      if (!isObject(item)) {
        errors.push(`observed_emotions[${index}] must be an object`)
        continue
      }
      if (!isMoodId(item.mood)) {
        errors.push(`observed_emotions[${index}].mood must be one of: ${MOOD_IDS.join(', ')}`)
        continue
      }
      const evidence = text(item.evidence, LIMITS.evidenceMax)
      if (!evidence) errors.push(`observed_emotions[${index}].evidence is required`)
      observed_emotions.push({ mood: item.mood, evidence })
    }
  }

  const themes_identified: ModelAnalysis['themes_identified'] = []
  if (!Array.isArray(raw.themes_identified)) {
    errors.push('themes_identified must be an array')
  } else {
    if (raw.themes_identified.length > LIMITS.themesMax) warnings.push('themes_identified truncated')
    for (const [index, item] of raw.themes_identified.slice(0, LIMITS.themesMax).entries()) {
      if (!isObject(item)) {
        errors.push(`themes_identified[${index}] must be an object`)
        continue
      }
      if (!isThemeId(item.theme)) {
        errors.push(`themes_identified[${index}].theme must be one of: ${THEME_IDS.join(', ')}`)
        continue
      }
      const evidence = text(item.evidence, LIMITS.evidenceMax)
      if (!evidence) errors.push(`themes_identified[${index}].evidence is required`)
      themes_identified.push({ theme: item.theme, evidence })
    }
  }

  const focusRaw = isObject(raw.focus) ? raw.focus : {}
  if (raw.focus !== undefined && !isObject(raw.focus)) errors.push('focus must be an object')
  const focus = {
    narrative: stringList(focusRaw.narrative, LIMITS.bulletsMax, LIMITS.evidenceMax),
    character: stringList(focusRaw.character, LIMITS.bulletsMax, LIMITS.evidenceMax),
    visual: stringList(focusRaw.visual, LIMITS.bulletsMax, LIMITS.evidenceMax),
  }

  const liked = stringList(raw.liked, LIMITS.likedMax, LIMITS.evidenceMax)
  const disliked = stringList(raw.disliked, LIMITS.likedMax, LIMITS.evidenceMax)

  const preference_evidence: ModelAnalysis['preference_evidence'] = []
  if (!Array.isArray(raw.preference_evidence)) {
    errors.push('preference_evidence must be an array')
  } else if (raw.preference_evidence.length === 0) {
    errors.push('preference_evidence must contain at least one claim')
  } else {
    if (raw.preference_evidence.length > LIMITS.contributionsMax) {
      warnings.push('preference_evidence truncated')
    }
    const noteNormalised = normaliseForGrounding(context.note)
    const seen = new Set<string>()
    for (const [index, item] of raw.preference_evidence
      .slice(0, LIMITS.contributionsMax)
      .entries()) {
      if (!isObject(item)) {
        errors.push(`preference_evidence[${index}] must be an object`)
        continue
      }
      if (!isDimensionId(item.dimension_id)) {
        errors.push(
          `preference_evidence[${index}].dimension_id must be one of: ${DIMENSION_IDS.join(', ')}`,
        )
        continue
      }
      const direction = item.direction
      if (direction !== 'low' && direction !== 'high' && direction !== 'neutral') {
        errors.push(`preference_evidence[${index}].direction must be low, high or neutral`)
        continue
      }
      const strength = finiteNumber(item.strength)
      const confidence = finiteNumber(item.confidence)
      if (strength === null || strength < 0 || strength > 1) {
        errors.push(`preference_evidence[${index}].strength must be between 0 and 1`)
        continue
      }
      if (confidence === null || confidence < 0 || confidence > 1) {
        errors.push(`preference_evidence[${index}].confidence must be between 0 and 1`)
        continue
      }
      const evidence = text(item.evidence, LIMITS.evidenceMax)
      if (!evidence) {
        errors.push(`preference_evidence[${index}].evidence is required`)
        continue
      }
      let quote = text(item.quote, LIMITS.quoteMax)
      if (quote) {
        const quoted = normaliseForGrounding(quote)
        if (quoted.length < 3 || !noteNormalised.includes(quoted)) {
          warnings.push(`dropped ungrounded quote at preference_evidence[${index}]`)
          quote = ''
        }
      }
      const dedupeKey = `${item.dimension_id}:${direction}:${evidence}`
      if (seen.has(dedupeKey)) {
        warnings.push(`dropped duplicate contribution at preference_evidence[${index}]`)
        continue
      }
      seen.add(dedupeKey)
      preference_evidence.push({
        dimension_id: item.dimension_id,
        direction,
        strength,
        confidence,
        evidence,
        ...(quote ? { quote } : {}),
      })
    }
    if (preference_evidence.length === 0) {
      errors.push('preference_evidence contains no usable claim')
    }
  }

  const uncertainties = stringList(raw.uncertainties, LIMITS.uncertaintiesMax, LIMITS.evidenceMax)

  const confidence = finiteNumber(raw.confidence)
  if (confidence === null || confidence < 0 || confidence > 1) {
    errors.push('confidence must be a number between 0 and 1')
  }

  const related_films: ModelAnalysis['related_films'] = []
  if (raw.related_films !== undefined && !Array.isArray(raw.related_films)) {
    errors.push('related_films must be an array when provided')
  } else if (Array.isArray(raw.related_films)) {
    const allowed = new Set(context.historyIds)
    for (const [index, item] of raw.related_films.slice(0, LIMITS.relatedMax).entries()) {
      if (!isObject(item)) {
        errors.push(`related_films[${index}] must be an object`)
        continue
      }
      const filmId = text(item.film_id, 120)
      if (!filmId) {
        errors.push(`related_films[${index}].film_id is required`)
        continue
      }
      if (!allowed.has(filmId)) {
        warnings.push(`dropped related film not present in the supplied history: ${filmId}`)
        continue
      }
      if (!isRelationshipId(item.relationship)) {
        errors.push(`related_films[${index}].relationship must be one of: ${RELATIONSHIP_IDS.join(', ')}`)
        continue
      }
      const explanation = text(item.explanation, LIMITS.evidenceMax)
      if (!explanation) errors.push(`related_films[${index}].explanation is required`)
      related_films.push({ film_id: filmId, relationship: item.relationship, explanation })
    }
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
      liked,
      disliked,
      preference_evidence,
      uncertainties,
      confidence: confidence as number,
      related_films,
    },
  }
}
