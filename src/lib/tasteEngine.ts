import { DIMENSIONS, DIMENSION_MAP, MOODS, THEMES, TIMELINE_MILESTONES } from '@/data/taxonomy'
import type {
  DimensionKey,
  DimensionScore,
  EvidenceQuote,
  Film,
  TasteSnapshot,
  ThemeId,
  MoodId,
  TimelineStage,
  WatchRecord,
} from '@/types'
import { clamp, formatLongDate, parseDate, splitSentences, truncate } from './format'

/* ------------------------------------------------------------------ */
/*  Theme axis: 0 = inward / private, 1 = outward / world-facing       */
/* ------------------------------------------------------------------ */
const THEME_AXIS: Record<ThemeId, number> = {
  memory: 0.08,
  grief: 0.06,
  loss: 0.1,
  identity: 0.22,
  love: 0.24,
  loneliness: 0.14,
  family: 0.2,
  'coming-of-age': 0.26,
  forgiveness: 0.28,
  art: 0.42,
  time: 0.4,
  hope: 0.48,
  friendship: 0.46,
  sacrifice: 0.44,
  reality: 0.74,
  freedom: 0.88,
  ambition: 0.78,
  justice: 0.9,
}

export const filmById = (films: Film[], id: string): Film | undefined => films.find((f) => f.id === id)

export const recordWeight = (record: WatchRecord): number => {
  const rating = clamp(record.rating / 5, 0, 1)
  const depth = clamp(record.reflection.trim().length / 520, 0, 1)
  return (0.35 + rating * 0.9) * (0.65 + depth * 0.55)
}

const mean = (values: number[]): number =>
  values.length === 0 ? 0.5 : values.reduce((a, b) => a + b, 0) / values.length

const stdev = (values: number[]): number => {
  if (values.length < 2) return 0
  const m = mean(values)
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length)
}

const themeAxisFor = (film: Film, record: WatchRecord): number => {
  const entries = record.themes
    .map((t) => [t, film.themes[t] ?? 0.4] as const)
    .filter(([, w]) => w > 0)
  if (entries.length === 0) return 0.35
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  return entries.reduce((sum, [t, w]) => sum + THEME_AXIS[t] * w, 0) / Math.max(total, 0.0001)
}

const signatureFor = (film: Film, record: WatchRecord, key: DimensionKey): number => {
  if (key === 'thematic') return themeAxisFor(film, record)
  return film.signature[key]
}

const confidenceFor = (records: WatchRecord[], values: number[]): number => {
  const n = records.length
  const sample = 1 - Math.exp(-n / 4.2)
  const avgDepth = clamp(
    records.reduce((sum, r) => sum + clamp(r.reflection.trim().length / 420, 0, 1), 0) / n,
    0,
    1,
  )
  const consistency = 1 - clamp(stdev(values) * 1.5, 0, 0.5)
  return clamp(sample * (0.6 + 0.4 * avgDepth) * consistency, 0.04, 0.94)
}

const topCounts = <T extends string>(
  records: WatchRecord[],
  films: Film[],
  pick: (film: Film, record: WatchRecord) => Array<{ id: T; weight: number }>,
): Array<{ id: T; weight: number; count: number }> => {
  const aggregate = new Map<T, { weight: number; count: number }>()
  for (const record of records) {
    const film = filmById(films, record.filmId)
    if (!film) continue
    const w = recordWeight(record)
    const seen = new Set<T>()
    for (const item of pick(film, record)) {
      const current = aggregate.get(item.id) ?? { weight: 0, count: 0 }
      current.weight += item.weight * w
      if (!seen.has(item.id)) {
        current.count += 1
        seen.add(item.id)
      }
      aggregate.set(item.id, current)
    }
  }
  const entries = Array.from(aggregate.entries()).map(([id, v]) => ({ id, ...v }))
  const max = entries.reduce((m, e) => Math.max(m, e.weight), 0) || 1
  return entries
    .map((e) => ({ ...e, weight: e.weight / max }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count)
}

/* ------------------------------------------------------------------ */
/*  Snapshot                                                           */
/* ------------------------------------------------------------------ */
export const computeSnapshot = (records: WatchRecord[], films: Film[]): TasteSnapshot => {
  const usable = records.filter((r) => filmById(films, r.filmId))
  if (usable.length === 0) {
    return {
      filmCount: 0,
      dimensionScores: DIMENSIONS.map((def) => ({
        key: def.key,
        def,
        value: 0.5,
        confidence: 0,
        evidenceFilmIds: [],
        strength: 0,
        thin: true,
      })),
      overallConfidence: 0,
      topThemes: [],
      topMoods: [],
      averageRating: 0,
      totalMinutes: 0,
    }
  }

  const dimensionScores: DimensionScore[] = DIMENSIONS.map((def) => {
    const weighted = usable.map((r) => {
      const film = filmById(films, r.filmId) as Film
      return { record: r, film, value: signatureFor(film, r, def.key), weight: recordWeight(r) }
    })
    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0)
    const value = weighted.reduce((s, w) => s + w.value * w.weight, 0) / Math.max(totalWeight, 0.0001)
    const confidence = confidenceFor(
      usable,
      weighted.map((w) => w.value),
    )
    const evidence = [...weighted]
      .sort(
        (a, b) =>
          b.weight * (0.3 + Math.abs(b.value - 0.5)) -
          a.weight * (0.3 + Math.abs(a.value - 0.5)),
      )
      .slice(0, 3)
      .map((w) => w.film.id)

    return {
      key: def.key,
      def,
      value,
      confidence,
      evidenceFilmIds: evidence,
      strength: clamp(Math.abs(value - 0.5) * 2.4, 0, 1),
      thin: usable.length < 3 || confidence < 0.3,
    }
  })

  const averageRating =
    usable.reduce((sum, r) => sum + r.rating, 0) / Math.max(usable.length, 1)

  return {
    filmCount: usable.length,
    dimensionScores,
    overallConfidence: mean(dimensionScores.map((d) => d.confidence)),
    topThemes: topCounts<ThemeId>(usable, films, (film, record) =>
      record.themes.map((id) => ({ id, weight: film.themes[id] ?? 0.45 })),
    ).slice(0, 6),
    topMoods: topCounts<MoodId>(usable, films, (film, record) =>
      record.moods.map((id) => ({ id, weight: film.moods[id] ?? 0.45 })),
    ).slice(0, 5),
    averageRating,
    totalMinutes: usable.reduce((sum, r) => sum + (filmById(films, r.filmId)?.runtime ?? 0), 0),
  }
}

/* ------------------------------------------------------------------ */
/*  Language                                                           */
/* ------------------------------------------------------------------ */
export const polePhrase = (key: DimensionKey, value: number): string => {
  const def = DIMENSION_MAP[key]
  const low = {
    narrative: 'slow-burn, interior storytelling',
    emotion: 'restrained emotional expression',
    thematic: 'inward themes — memory, grief, the self',
    visual: 'naturalistic, tactile images',
    character: 'character-driven transformation',
    ending: 'bittersweet or unresolved endings',
  }[key]
  const high = {
    narrative: 'propulsive, plot-forward structures',
    emotion: 'heightened, cathartic feeling',
    thematic: 'outward themes — freedom, justice, the world',
    visual: 'stylised, composed frames',
    character: 'ensemble, situational storytelling',
    ending: 'resolved, hopeful endings',
  }[key]
  if (value < 0.42) return low
  if (value > 0.58) return high
  return `a balance between ${def.low.toLowerCase()} and ${def.high.toLowerCase()}`
}

export const leanPhrase = (score: DimensionScore): string => {
  if (score.strength < 0.12) return `no strong lean on ${score.def.label.toLowerCase()}`
  const side = score.value < 0.5 ? score.def.low : score.def.high
  return side.toLowerCase()
}

export const tasteSignature = (snapshot: TasteSnapshot): string => {
  if (snapshot.filmCount === 0) return 'Nothing on the record yet.'
  const ranked = [...snapshot.dimensionScores]
    .filter((d) => d.key !== 'thematic' && d.strength > 0.14)
    .sort((a, b) => b.strength * (0.4 + b.confidence) - a.strength * (0.4 + a.confidence))
    .slice(0, 3)
  const words = ranked.map((d) => {
    const short: Record<string, [string, string]> = {
      narrative: ['slow-burn', 'propulsive'],
      emotion: ['restrained', 'cathartic'],
      visual: ['naturalistic', 'composed'],
      character: ['character-led', 'ensemble-minded'],
      ending: ['unresolved', 'hopeful'],
    }
    const pair = short[d.key]
    return pair ? (d.value < 0.5 ? pair[0] : pair[1]) : ''
  })
  const theme = snapshot.topThemes[0]
  const themeWord = theme ? `${THEMES[theme.id].label.toLowerCase()}-haunted` : ''
  const all = [words[0], words[1], themeWord, words[2]].filter(Boolean)
  if (all.length === 0) return 'Still forming — no strong lean yet.'
  return all.join(', ')
}

export const summarizeTaste = (snapshot: TasteSnapshot): string[] => {
  if (snapshot.filmCount === 0) return []
  const ranked = [...snapshot.dimensionScores].sort(
    (a, b) => b.strength * (0.5 + b.confidence) - a.strength * (0.5 + a.confidence),
  )
  const first = ranked[0]
  const second = ranked[1]
  const theme = snapshot.topThemes[0]
  const mood = snapshot.topMoods[0]

  const sentences: string[] = []
  sentences.push(
    `Across ${snapshot.filmCount} recorded ${
      snapshot.filmCount === 1 ? 'film' : 'films'
    }, the clearest signal is a lean toward ${polePhrase(first.key, first.value)}.`,
  )
  if (second && second.confidence > 0.25) {
    sentences.push(
      `A second thread is ${polePhrase(second.key, second.value)}${
        Math.abs(second.value - 0.5) < 0.08 ? ', though that reading is still faint' : ''
      }.`,
    )
  }
  if (theme) {
    sentences.push(
      `${THEMES[theme.id].label} appears in ${theme.count} ${
        theme.count === 1 ? 'film' : 'films'
      } you kept${mood ? `, usually arriving as ${MOODS[mood.id].label.toLowerCase()}` : ''}.`,
    )
  }
  sentences.push(
    `This is an estimate drawn from your ratings and notes — confidence ${Math.round(
      snapshot.overallConfidence * 100,
    )}%. It should change as you do.`,
  )
  return sentences
}

/* ------------------------------------------------------------------ */
/*  Evidence                                                           */
/* ------------------------------------------------------------------ */
const KEYWORDS: Record<DimensionKey, string[]> = {
  narrative: ['structure', 'pace', 'pacing', 'slow', 'editing', 'timeline', 'scene', 'epilogue', 'chapter', 'story', 'minutes'],
  emotion: ['cry', 'cried', 'feel', 'feeling', 'grief', 'moved', 'broke', 'held', 'anger', 'tender', 'restrained', 'quiet'],
  thematic: ['memory', 'loss', 'grief', 'identity', 'freedom', 'love', 'time', 'hope', 'meaning', 'about', 'world'],
  visual: ['image', 'shot', 'frame', 'light', 'colour', 'color', 'symmetry', 'visual', 'picture', 'composition', 'scene'],
  character: ['character', 'performance', 'actor', 'protagonist', 'person', 'role', 'self', 'father', 'he ', 'she '],
  ending: ['ending', 'end', 'last', 'final', 'epilogue', 'credits', 'close', 'resolution', 'rain', 'look'],
}

export const pickEvidenceQuote = (record: WatchRecord, key: DimensionKey): string => {
  const sentences = splitSentences(record.reflection)
  if (sentences.length === 0) return ''
  const keywords = KEYWORDS[key]
  let best = sentences[0]
  let bestScore = -1
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase()
    const hits = keywords.reduce((sum, k) => sum + (lower.includes(k) ? 1 : 0), 0)
    const score = hits * 2 + Math.min(sentence.length / 140, 1)
    if (score > bestScore) {
      best = sentence
      bestScore = score
    }
  }
  return truncate(best, 230)
}

export const getEvidence = (
  snapshot: TasteSnapshot,
  records: WatchRecord[],
  films: Film[],
  key: DimensionKey,
  limit = 2,
  excludeQuotes: string[] = [],
): EvidenceQuote[] => {
  const score = snapshot.dimensionScores.find((d) => d.key === key)
  if (!score) return []
  const candidates = score.evidenceFilmIds.slice(0, 4).flatMap((id) => {
    const record = records.find((r) => r.filmId === id)
    const film = filmById(films, id)
    if (!record || !film) return []
    return [
      {
        filmId: film.id,
        filmTitle: film.title,
        year: film.year,
        quote: pickEvidenceQuote(record, key),
        rating: record.rating,
        watchedAt: record.watchedAt,
      },
    ]
  })
  const fresh = candidates.filter((item) => !excludeQuotes.includes(item.quote))
  return (fresh.length > 0 ? fresh : candidates).slice(0, limit)
}

/* ------------------------------------------------------------------ */
/*  Timeline                                                           */
/* ------------------------------------------------------------------ */
const timelineHeadline = (confidence: number): string => {
  if (confidence < 0.3) return 'A shape worth testing'
  if (confidence < 0.42) return 'A reading with direction'
  if (confidence < 0.56) return 'A recognisable sensibility'
  return 'A museum with a point of view'
}

const hedge = (confidence: number): string => {
  if (confidence < 0.3) return 'It is early, but'
  if (confidence < 0.55) return 'The pattern is still forming:'
  return 'The archive now says:'
}

export const buildTimeline = (
  records: WatchRecord[],
  films: Film[],
  milestones: number[] = TIMELINE_MILESTONES,
): TimelineStage[] => {
  const ordered = [...records].sort(
    (a, b) => a.watchedAt.localeCompare(b.watchedAt) || a.createdAt.localeCompare(b.createdAt),
  )
  const stages: TimelineStage[] = []
  const counts = Array.from(
    new Set([...milestones.filter((m) => m <= ordered.length), ordered.length]),
  ).sort((a, b) => a - b)
  for (const count of counts) {
    if (count < 1) continue
    const slice = ordered.slice(0, count)
    const snapshot = computeSnapshot(slice, films)
    const strongest = [...snapshot.dimensionScores].sort(
      (a, b) => b.strength * (0.5 + b.confidence) - a.strength * (0.5 + a.confidence),
    )[0]
    const second = [...snapshot.dimensionScores]
      .filter((d) => d.key !== strongest.key)
      .sort((a, b) => b.strength * (0.5 + b.confidence) - a.strength * (0.5 + a.confidence))[0]
    const theme = snapshot.topThemes[0]
    const secondTheme = snapshot.topThemes[1]
    const mood = snapshot.topMoods[0]
    const firstFilm = filmById(films, slice[0].filmId)
    const lastFilm = filmById(films, slice[slice.length - 1].filmId)
    const confidencePct = Math.round(snapshot.overallConfidence * 100)
    const title = (film: Film | undefined) => film?.title ?? 'a film'
    const themeLine = theme
      ? `${THEMES[theme.id].label} appears in ${theme.count} of them`
      : 'No single theme dominates yet'

    let body: string
    if (count === 1) {
      body = `You started with ${title(firstFilm)}. ${hedge(
        snapshot.overallConfidence,
      )} you respond to ${polePhrase(strongest.key, strongest.value)}.`
    } else if (count <= 3) {
      body = `${count} ${count === 1 ? 'film' : 'films'} is enough for a first hypothesis: ${polePhrase(
        strongest.key,
        strongest.value,
      )}. ${themeLine}${mood ? `, and they tend to leave you ${MOODS[mood.id].label.toLowerCase()}` : ''}.`
    } else if (count <= 5) {
      body = `Two threads are forming: ${polePhrase(strongest.key, strongest.value)} and ${polePhrase(
        second.key,
        second.value,
      )}.${theme ? ` They meet around ${THEMES[theme.id].label}.` : ''} The reading is still provisional.`
    } else if (count <= 8) {
      body = `${themeLine}, which stops looking like coincidence. The strongest signal remains ${polePhrase(
        strongest.key,
        strongest.value,
      )}, and the most recent frame is ${title(lastFilm)}.`
    } else if (count <= 12) {
      body = `Stable enough to test: ${tasteSignature(snapshot)}. ${themeLine}, and the archive keeps choosing ${
        mood ? MOODS[mood.id].label.toLowerCase() : 'the same register'
      }. Confidence is ${confidencePct}%.`
    } else {
      body = `The museum now has a point of view: ${tasteSignature(snapshot)}.${
        theme ? ` ${THEMES[theme.id].label} remains the ground, with ${THEMES[secondTheme?.id ?? theme.id].label.toLowerCase()} close behind.` : ''
      } Each new note tightens the reading rather than replacing it.`
    }

    stages.push({
      id: `stage-${count}`,
      filmCount: count,
      at: slice[slice.length - 1].watchedAt,
      headline: count === 1 ? 'The first frame' : timelineHeadline(snapshot.overallConfidence),
      body,
      topTheme: theme?.id,
      confidence: snapshot.overallConfidence,
      filmIds: slice.map((r) => r.filmId),
    })
  }
  return stages.reverse()
}

/* ------------------------------------------------------------------ */
/*  Aggregations for Reflection                                        */
/* ------------------------------------------------------------------ */
export const recordsSorted = (records: WatchRecord[], direction: 'asc' | 'desc' = 'desc'): WatchRecord[] =>
  [...records].sort((a, b) =>
    direction === 'desc'
      ? b.watchedAt.localeCompare(a.watchedAt) || b.createdAt.localeCompare(a.createdAt)
      : a.watchedAt.localeCompare(b.watchedAt) || a.createdAt.localeCompare(b.createdAt),
  )

export const monthlyStats = (
  records: WatchRecord[],
  films: Film[],
  year: number,
): Array<{ month: number; label: string; count: number; minutes: number; average: number; records: WatchRecord[] }> => {
  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return labels.map((label, index) => {
    const monthRecords = records
      .filter((r) => {
        const d = parseDate(r.watchedAt)
        return d !== null && d.getFullYear() === year && d.getMonth() === index
      })
      .sort(
        (a, b) =>
          b.watchedAt.localeCompare(a.watchedAt) || b.createdAt.localeCompare(a.createdAt),
      )
    const minutes = monthRecords.reduce((sum, r) => sum + (filmById(films, r.filmId)?.runtime ?? 0), 0)
    const average = monthRecords.length
      ? monthRecords.reduce((sum, r) => sum + r.rating, 0) / monthRecords.length
      : 0
    return { month: index + 1, label, count: monthRecords.length, minutes, average, records: monthRecords }
  })
}

export const availableYears = (records: WatchRecord[]): number[] => {
  const years = new Set<number>()
  for (const record of records) {
    const d = parseDate(record.watchedAt)
    if (d) years.add(d.getFullYear())
  }
  return Array.from(years).sort((a, b) => b - a)
}

export const favoriteRecord = (records: WatchRecord[], films: Film[]): WatchRecord | null => {
  if (records.length === 0) return null
  return [...records].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating
    const la = filmById(films, a.filmId)?.runtime ?? 0
    const lb = filmById(films, b.filmId)?.runtime ?? 0
    return lb - la
  })[0]
}

export const splitPeriods = (records: WatchRecord[]) => {
  const ordered = recordsSorted(records, 'asc')
  const mid = Math.floor(ordered.length / 2)
  return { first: ordered.slice(0, mid), second: ordered.slice(mid) }
}

export const describeShift = (before: number, after: number): string => {
  const delta = after - before
  if (Math.abs(delta) < 0.035) return 'held steady'
  const moved = Math.abs(delta) >= 0.09 ? 'shifted clearly' : 'drifted'
  return `${moved} ${delta > 0 ? 'toward the outward / heightened side' : 'toward the inward / restrained side'}`
}

export const formatStageDate = (iso: string): string => formatLongDate(iso)

export const recordFor = (records: WatchRecord[], filmId: string): WatchRecord | undefined =>
  records.find((r) => r.filmId === filmId)
