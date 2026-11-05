import { DIMENSION_MAP, MOODS, THEMES } from '@/data/taxonomy'
import type {
  AddFilmDraft,
  AnalysisResult,
  DimensionKey,
  Film,
  FilmConnection,
  MoodId,
  TasteFinding,
  ThemeId,
  WatchRecord,
} from '@/types'
import { clamp, truncate, uid } from './format'
import { computeSnapshot, filmById, polePhrase } from './tasteEngine'

/* ------------------------------------------------------------------ */
/*  Keyword readers                                                    */
/*  This is deliberately a transparent local heuristic, not an LLM.    */
/*  It is the seam a DeepWorks agent will replace: same input/output.  */
/* ------------------------------------------------------------------ */
const THEME_KEYWORDS: Record<ThemeId, string[]> = {
  memory: ['memory', 'memories', 'remember', 'erase', 'forget', 'past', 'nostalgia', 'archive'],
  loss: ['loss', 'lost', 'gone', 'absence', 'left', 'leaving', 'miss'],
  grief: ['grief', 'grieving', 'mourn', 'funeral', 'death', 'died', 'sadness'],
  identity: ['identity', 'myself', 'self', 'who i am', 'belong', 'name'],
  love: ['love', 'loved', 'romance', 'heart', 'kiss', 'relationship'],
  ambition: ['ambition', 'dream', 'career', 'greatness', 'succeed', 'wanted'],
  freedom: ['freedom', 'free', 'escape', 'trapped', 'control', 'outside'],
  family: ['family', 'father', 'mother', 'daughter', 'son', 'parent', 'brother', 'sister'],
  hope: ['hope', 'hopeful', 'believe', 'promise', 'light', 'survive'],
  loneliness: ['lonely', 'loneliness', 'alone', 'isolated', 'unheard', 'distance'],
  art: ['art', 'poetry', 'poem', 'paint', 'music', 'jazz', 'writing', 'film'],
  time: ['time', 'years', 'clock', 'age', 'future', 'twenty'],
  reality: ['real', 'reality', 'fake', 'television', 'show', 'script', 'world'],
  friendship: ['friend', 'friendship', 'companion', 'together'],
  'coming-of-age': ['grow', 'growing', 'childhood', 'teen', 'boy', 'girl', 'school'],
  forgiveness: ['forgive', 'forgiveness', 'apolog', 'fault', 'guilt'],
  sacrifice: ['sacrifice', 'cost', 'give up', 'trade', 'price'],
  justice: ['justice', 'unfair', 'prison', 'law', 'innocent', 'sentence'],
}

const MOOD_KEYWORDS: Record<MoodId, string[]> = {
  melancholy: ['sad', 'melancholy', 'low', 'hollow', 'grey', 'gray'],
  tender: ['tender', 'gentle', 'kind', 'warm', 'soft'],
  wistful: ['wistful', 'nostalgic', 'bittersweet', 'longing'],
  hopeful: ['hope', 'hopeful', 'light', 'free', 'believe'],
  restrained: ['restrained', 'quiet', 'silent', 'held my breath', 'understated', 'still'],
  cathartic: ['cry', 'cried', 'tears', 'wrecked', 'broke me', 'cathartic', 'sobbed'],
  uneasy: ['uneasy', 'unsettling', 'frightening', 'anxious', 'wrong'],
  awe: ['awe', 'wonder', 'vast', 'galaxy', 'beautiful', 'stunning'],
  warmth: ['warm', 'comfort', 'home', 'together', 'friend'],
  longing: ['longing', 'miss', 'ache', 'want', 'distance'],
  playful: ['funny', 'playful', 'comic', 'laugh', 'charming'],
  quiet: ['quiet', 'silent', 'still', 'slow', 'breath'],
}

const readThemes = (film: Film, reflection: string): ThemeId[] => {
  const text = reflection.toLowerCase()
  const seen = new Map<ThemeId, number>()
  for (const [theme, weight] of Object.entries(film.themes) as Array<[ThemeId, number]>) {
    seen.set(theme, (weight ?? 0) + 0.1)
  }
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS) as Array<[ThemeId, string[]]>) {
    const hits = keywords.filter((k) => text.includes(k)).length
    if (hits > 0) seen.set(theme, (seen.get(theme) ?? 0) + Math.min(0.24 + hits * 0.16, 0.6))
  }
  return Array.from(seen.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([theme]) => theme)
}

const readMoods = (film: Film, reflection: string, rating: number): MoodId[] => {
  const text = reflection.toLowerCase()
  const seen = new Map<MoodId, number>()
  for (const [mood, weight] of Object.entries(film.moods) as Array<[MoodId, number]>) {
    seen.set(mood, weight ?? 0)
  }
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS) as Array<[MoodId, string[]]>) {
    const hits = keywords.filter((k) => text.includes(k)).length
    if (hits > 0) seen.set(mood, (seen.get(mood) ?? 0) + Math.min(0.3 + hits * 0.18, 0.75))
  }
  if (rating <= 2.5) seen.set('uneasy', (seen.get('uneasy') ?? 0) + 0.4)
  return Array.from(seen.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([mood]) => mood)
}

const buildConnections = (
  film: Film,
  themes: ThemeId[],
  moods: MoodId[],
  previous: WatchRecord[],
  films: Film[],
): FilmConnection[] => {
  return previous
    .map((record) => {
      const other = filmById(films, record.filmId)
      if (!other) return null
      const shared = themes.filter((t) => record.themes.includes(t))
      const sharedMoods = moods.filter((m) => record.moods.includes(m))
      const sameDirector = other.director === film.director
      if (shared.length === 0 && !sameDirector) return null
      const score = shared.length * 2 + sharedMoods.length + (sameDirector ? 1.5 : 0) + record.rating / 5
      const labels = shared.slice(0, 3).map((t) => THEMES[t].label)
      const reason = [
        shared.length > 0
          ? `Shared ground: ${labels.join(', ')}.`
          : `Same director: ${film.director}.`,
        sharedMoods.length > 0
          ? `Both leave you ${sharedMoods
              .slice(0, 2)
              .map((m) => MOODS[m].label.toLowerCase())
              .join(' and ')}.`
          : '',
      ]
        .filter(Boolean)
        .join(' ')
      return { film: other, score, connection: { filmId: other.id, title: other.title, reason, shared: labels } }
    })
    .filter((x): x is { film: Film; score: number; connection: FilmConnection } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.connection)
}

const findingHeadline = (key: DimensionKey, before: number, after: number): string => {
  const def = DIMENSION_MAP[key]
  const delta = after - before
  const direction = delta > 0 ? def.high : def.low
  if (Math.abs(delta) < 0.022) return `A steady read on ${def.label.toLowerCase()}`
  if (Math.abs(delta) < 0.06) return `A slight pull toward ${direction.toLowerCase()}`
  return `A clearer pull toward ${direction.toLowerCase()}`
}

const findingDetail = (key: DimensionKey, before: number, after: number, confidence: number): string => {
  const def = DIMENSION_MAP[key]
  const direction = after >= before ? 'up' : 'down'
  return `${def.label} moved ${direction} from ${Math.round(before * 100)} to ${Math.round(
    after * 100,
  )} on the ${def.low.toLowerCase()} → ${def.high.toLowerCase()} axis. This reading now sits at ${Math.round(
    confidence * 100,
  )}% confidence.`
}

const buildFindings = (
  film: Film,
  before: AnalysisResult['beforeScores'],
  after: AnalysisResult['afterScores'],
  confidence: number,
): TasteFinding[] => {
  const keys = Object.keys(before) as DimensionKey[]
  const ranked = keys
    .map((key) => ({ key, delta: Math.abs(after[key] - before[key]) }))
    .sort((a, b) => b.delta - a.delta)
  return ranked.slice(0, 3).map(({ key }) => {
    const def = DIMENSION_MAP[key]
    const filmValue = film.signature[key]
    const small = Math.abs(after[key] - before[key]) < 0.02
    return {
      key,
      dimension: key,
      headline: small
        ? `Your ${def.label.toLowerCase()} holds`
        : findingHeadline(key, before[key], after[key]),
      detail: small
        ? `This film sits at ${Math.round(filmValue * 100)} on the axis; your archive reads ${Math.round(
            after[key] * 100,
          )}. It reinforces the existing shape rather than bending it.`
        : findingDetail(key, before[key], after[key], confidence),
      before: before[key],
      after: after[key],
      confidence,
    }
  })
}

const buildSummary = (
  film: Film,
  themes: ThemeId[],
  reflection: string,
  after: AnalysisResult['afterScores'],
  filmCount: number,
): string => {
  const topTheme = themes[0] ? THEMES[themes[0]].label : 'memory'
  const strongest = (Object.keys(after) as DimensionKey[]).sort(
    (a, b) => Math.abs(after[b] - 0.5) - Math.abs(after[a] - 0.5),
  )[0]
  const quote = truncate(reflection.trim().split(/(?<=[.!?])\s+/)[0] ?? '', 120)
  return `Your note on ${film.title} keeps returning to ${topTheme.toLowerCase()}${
    quote ? ` — “${quote}”` : ''
  }. Read against ${filmCount} ${filmCount === 1 ? 'film' : 'films'}, this strengthens ${polePhrase(
    strongest,
    after[strongest],
  )}.`
}

/* ------------------------------------------------------------------ */
/*  Public analyst                                                     */
/* ------------------------------------------------------------------ */
export const analyseDraft = (
  film: Film,
  draft: AddFilmDraft,
  previousRecords: WatchRecord[],
  films: Film[],
): AnalysisResult => {
  const themes = readThemes(film, draft.reflection)
  const moods = readMoods(film, draft.reflection, draft.rating)
  const beforeSnapshot = computeSnapshot(previousRecords, films)

  const synthetic: WatchRecord = {
    id: 'preview',
    filmId: film.id,
    rating: draft.rating,
    watchedAt: draft.watchedAt,
    status: draft.status,
    reflection: draft.reflection,
    feltLike: draft.feltLike,
    themes,
    moods,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'user',
    ai: { summary: '', extractedFrom: 'local-engine', confidence: 0 },
  }
  const afterSnapshot = computeSnapshot([...previousRecords, synthetic], films)

  const beforeScores = beforeSnapshot.dimensionScores.reduce(
    (acc, d) => ({ ...acc, [d.key]: d.value }),
    {} as AnalysisResult['beforeScores'],
  )
  const afterScores = afterSnapshot.dimensionScores.reduce(
    (acc, d) => ({ ...acc, [d.key]: d.value }),
    {} as AnalysisResult['afterScores'],
  )

  return {
    themes,
    moods,
    connections: buildConnections(film, themes, moods, previousRecords, films),
    findings: buildFindings(film, beforeScores, afterScores, afterSnapshot.overallConfidence),
    summary: buildSummary(film, themes, draft.reflection, afterScores, afterSnapshot.filmCount),
    beforeScores,
    afterScores,
    confidenceBefore: beforeSnapshot.overallConfidence,
    confidenceAfter: afterSnapshot.overallConfidence,
  }
}

export const createRecordFromDraft = (
  film: Film,
  draft: AddFilmDraft,
  analysis: AnalysisResult,
): WatchRecord => {
  const now = new Date().toISOString()
  return {
    id: uid('rec'),
    filmId: film.id,
    rating: clamp(draft.rating, 0.5, 5),
    watchedAt: draft.watchedAt,
    status: draft.status,
    reflection: draft.reflection.trim(),
    feltLike: draft.feltLike,
    themes: analysis.themes,
    moods: analysis.moods,
    createdAt: now,
    updatedAt: now,
    source: 'user',
    ai: {
      summary: analysis.summary,
      extractedFrom: 'local-engine',
      confidence: analysis.confidenceAfter,
    },
  }
}

export const themeLabel = (id: ThemeId): string => THEMES[id].label
