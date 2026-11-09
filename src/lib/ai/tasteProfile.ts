import { DIMENSIONS, MOODS, THEMES } from '@/data/taxonomy'
import { clamp } from '@/lib/format'
import { filmById } from '@/lib/tasteEngine'
import type {
  AIFilmAnalysis,
  AppState,
  DimensionKey,
  DimensionProfile,
  Film,
  MoodId,
  TasteEvidence,
  TasteProfile,
  TasteSampleState,
  ThemeId,
  WatchRecord,
} from '@/types'

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

const stdev = (values: number[]): number => {
  if (values.length < 2) return 0
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
}

const depth = (record: WatchRecord): number => clamp(record.reflection.trim().length / 420, 0, 1)

/** High and low ratings are both evidence; 3 stars is the weakest signal. */
const conviction = (rating: number): number => 0.55 + clamp(Math.abs(rating - 3) / 2, 0, 1) * 0.45

type ContributionRow = {
  record: WatchRecord
  analysis: AIFilmAnalysis
  film: Film
  weight: number
  signed: number
  strength: number
  confidence: number
  evidence: string
  quote: string
  direction: 'low' | 'high' | 'neutral'
}

const feedbackFactor = (state: AppState, key: DimensionKey): number => {
  const verdict = state.feedback[key]?.verdict
  if (verdict === 'agree') return 1.06
  if (verdict === 'not-quite') return 0.6
  if (verdict === 'corrected') return 0.32
  return 1
}

const usableAnalysis = (analysis: AIFilmAnalysis): boolean =>
  analysis.status === 'complete' &&
  (analysis.review.verdict === 'accepted' || analysis.review.verdict === 'edited')

const buildRows = (
  state: AppState,
  films: Film[],
  key: DimensionKey,
): ContributionRow[] => {
  const rows: ContributionRow[] = []
  for (const analysis of state.analyses) {
    if (!usableAnalysis(analysis)) continue
    const record = state.records.find((item) => item.id === analysis.recordId)
    if (!record) continue
    const film = filmById(films, analysis.filmId)
    if (!film) continue
    for (const contribution of analysis.preference_evidence) {
      if (contribution.dimension_id !== key) continue
      if (contribution.userStatus === 'removed') continue
      const signed = contribution.direction === 'high' ? 1 : contribution.direction === 'low' ? -1 : 0
      const strength = clamp(contribution.strength, 0, 1)
      const confidence = clamp(contribution.confidence * (0.55 + 0.45 * clamp(analysis.confidence, 0, 1)), 0, 1)
      const weight =
        (0.35 + 0.65 * depth(record)) *
        conviction(record.rating) *
        (0.3 + 0.7 * confidence) *
        (0.35 + 0.65 * strength)
      if (weight <= 0) continue
      rows.push({
        record,
        analysis,
        film,
        weight,
        signed,
        strength,
        confidence,
        evidence: contribution.evidence,
        quote: contribution.quote ?? '',
        direction: contribution.direction,
      })
    }
  }
  return rows
}

const toEvidence = (row: ContributionRow, key: DimensionKey): TasteEvidence => ({
  recordId: row.record.id,
  filmId: row.film.id,
  filmTitle: row.film.title,
  year: row.film.year,
  rating: row.record.rating,
  quote: row.quote || row.record.reflection.trim().slice(0, 160),
  evidence: row.evidence,
  dimension: key,
  direction: row.direction,
  strength: row.strength,
  confidence: row.confidence,
  analysedAt: row.analysis.model.analyzedAt,
})

const buildDimension = (state: AppState, films: Film[], key: DimensionKey): DimensionProfile => {
  const def = DIMENSIONS.find((dimension) => dimension.key === key)!
  const rows = buildRows(state, films, key)
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0)
  const lean =
    totalWeight > 0
      ? rows.reduce((sum, row) => sum + row.weight * row.signed * row.strength, 0) / totalWeight
      : 0
  const n = rows.length
  const consistency = n >= 2 ? 1 - clamp(stdev(rows.map((row) => row.signed * row.strength)) / 1.15, 0, 0.55) : 0.8
  const sampleFactor = 1 - Math.exp(-n / 3.2)
  const averageConfidence = mean(rows.map((row) => row.confidence))
  const confidence = clamp(
    sampleFactor * (0.55 + 0.45 * averageConfidence) * consistency * feedbackFactor(state, key),
    0,
    0.9,
  )
  const sufficient = n >= 3 && confidence >= 0.32 && consistency >= 0.45

  const ranked = [...rows].sort((a, b) => b.weight - a.weight)
  const seenFilms = new Set<string>()
  const evidence: TasteEvidence[] = []
  for (const row of ranked) {
    if (seenFilms.has(row.film.id)) continue
    seenFilms.add(row.film.id)
    evidence.push(toEvidence(row, key))
    if (evidence.length >= 3) break
  }

  const lastUpdatedAt =
    rows
      .map((row) => row.analysis.model.analyzedAt)
      .sort((a, b) => b.localeCompare(a))[0] ?? null

  return {
    key,
    def,
    value: clamp(0.5 + lean / 2, 0.02, 0.98),
    lean: clamp(lean, -1, 1),
    confidence,
    strength: clamp(Math.abs(lean) * 1.15, 0, 1),
    evidenceFilmIds: evidence.map((item) => item.filmId),
    thin: !sufficient,
    sampleCount: new Set(rows.map((row) => row.film.id)).size,
    sufficient,
    lastUpdatedAt,
    aiEvidence: evidence,
    userVerdict: state.feedback[key]?.verdict,
  }
}

type Rollup = { id: string; weight: number; count: number; films: Set<string> }

const rollup = (
  state: AppState,
  films: Film[],
  pick: (analysis: AIFilmAnalysis) => Array<{ id: string; weight: number }>,
  limit: number,
): Array<{ id: ThemeId | MoodId; weight: number; count: number }> => {
  const map = new Map<string, Rollup>()
  for (const analysis of state.analyses) {
    if (!usableAnalysis(analysis)) continue
    const record = state.records.find((item) => item.id === analysis.recordId)
    const film = filmById(films, analysis.filmId)
    if (!record || !film) continue
    const strength = depth(record) * conviction(record.rating) * (0.5 + 0.5 * clamp(analysis.confidence, 0, 1))
    for (const item of pick(analysis)) {
      const current = map.get(item.id) ?? { id: item.id, weight: 0, count: 0, films: new Set<string>() }
      current.weight += item.weight * strength
      if (!current.films.has(film.id)) {
        current.films.add(film.id)
        current.count += 1
      }
      map.set(item.id, current)
    }
  }
  const entries = Array.from(map.values())
  const max = entries.reduce((value, entry) => Math.max(value, entry.weight), 0) || 1
  return entries
    .map((entry) => ({
      id: entry.id as ThemeId | MoodId,
      weight: entry.weight / max,
      count: entry.count,
    }))
    .sort((a, b) => b.weight - a.weight || b.count - a.count)
    .slice(0, limit)
}

const buildSignature = (dimensions: DimensionProfile[], sampleState: TasteSampleState): string => {
  if (sampleState === 'empty') return '还没有任何已确认的 AI 分析。'
  if (sampleState === 'insufficient') return '证据还不够，暂时不能下结论。'
  const ranked = [...dimensions]
    .filter((dimension) => dimension.sufficient && dimension.strength > 0.08)
    .sort((a, b) => b.strength * (0.4 + b.confidence) - a.strength * (0.4 + a.confidence))
  const phrases = ranked.slice(0, 3).map((dimension) => {
    const pole = dimension.lean >= 0 ? dimension.def.highZh : dimension.def.lowZh
    return `${dimension.def.labelZh}偏向「${pole}」`
  })
  return phrases.length > 0 ? phrases.join('，') : '倾向存在，但方向仍然模糊。'
}

const buildSummary = (
  dimensions: DimensionProfile[],
  acceptedCount: number,
  pendingCount: number,
  theme: { id: string; count: number } | undefined,
  sampleState: TasteSampleState,
): string[] => {
  if (sampleState === 'empty') {
    return [
      '画像只会使用你确认过的 AI 分析。现在还没有一条被确认的证据，所以这里不显示任何结论。',
    ]
  }
  const sentences: string[] = []
  if (sampleState === 'insufficient') {
    sentences.push(
      `目前只有 ${acceptedCount} 部电影提供了可用的分析证据。样本不足时，任何方向都只是暂时假设。`,
    )
  } else {
    const strong = [...dimensions]
      .filter((dimension) => dimension.sufficient)
      .sort((a, b) => b.strength * b.confidence - a.strength * a.confidence)[0]
    if (strong) {
      const pole = strong.lean >= 0 ? strong.def.highZh : strong.def.lowZh
      sentences.push(
        `最清晰的信号来自${strong.def.labelZh}：在 ${strong.sampleCount} 部电影里偏向「${pole}」，置信度 ${Math.round(strong.confidence * 100)}%。`,
      )
    }
    const second = [...dimensions]
      .filter((dimension) => dimension.sufficient && dimension.key !== strong?.key)
      .sort((a, b) => b.strength * b.confidence - a.strength * a.confidence)[0]
    if (second && second.strength > 0.1) {
      const pole = second.lean >= 0 ? second.def.highZh : second.def.lowZh
      sentences.push(`第二条线索是${second.def.labelZh}，偏向「${pole}」。`)
    }
  }
  if (theme) {
    sentences.push(`「${THEMES[theme.id as ThemeId]?.zh ?? theme.id}」在 ${theme.count} 部已确认的电影里出现。`)
  }
  if (pendingCount > 0) {
    sentences.push(`还有 ${pendingCount} 条分析等待你的确认，它们目前没有计入画像。`)
  }
  sentences.push('画像只使用你确认过的证据；你随时可以拒绝或删除某一次分析。')
  return sentences
}

export const computeTasteProfile = (state: AppState, films: Film[]): TasteProfile => {
  const dimensions = DIMENSIONS.map((dimension) => buildDimension(state, films, dimension.key))
  const analyses = state.analyses.filter((analysis) => analysis.status === 'complete')
  const acceptedCount = analyses.filter(usableAnalysis).length
  const pendingCount = analyses.filter((analysis) => analysis.review.verdict === 'unreviewed').length
  const overallConfidence = mean(dimensions.map((dimension) => dimension.confidence))
  const sampleState: TasteSampleState =
    acceptedCount === 0
      ? 'empty'
      : acceptedCount < 3
        ? 'insufficient'
        : overallConfidence >= 0.45
          ? 'stable'
          : 'forming'

  const topThemes = rollup(
    state,
    films,
    (analysis) =>
      analysis.themes_identified.map((theme) => ({ id: theme.theme, weight: 0.8 })),
    6,
  ) as TasteProfile['topThemes']

  const topMoods = rollup(
    state,
    films,
    (analysis) =>
      analysis.observed_emotions.map((emotion) => ({ id: emotion.mood, weight: 0.8 })),
    5,
  ) as TasteProfile['topMoods']

  const usableRecords = state.records.filter((record) => filmById(films, record.filmId))
  const averageRating = usableRecords.length
    ? usableRecords.reduce((sum, record) => sum + record.rating, 0) / usableRecords.length
    : 0

  const updatedAt =
    analyses
      .map((analysis) => analysis.model.analyzedAt)
      .sort((a, b) => b.localeCompare(a))[0] ?? null

  return {
    filmCount: usableRecords.length,
    analysedCount: analyses.length,
    acceptedCount,
    pendingCount,
    dimensions,
    overallConfidence,
    sampleState,
    updatedAt,
    signature: buildSignature(dimensions, sampleState),
    summary: buildSummary(dimensions, acceptedCount, pendingCount, topThemes[0], sampleState),
    topThemes,
    topMoods,
    averageRating,
  }
}

export const dimensionProfileDelta = (
  before: TasteProfile,
  after: TasteProfile,
): Array<{
  dimension: DimensionKey
  before: number
  after: number
  beforeConfidence: number
  afterConfidence: number
}> =>
  after.dimensions
    .map((dimension) => {
      const previous = before.dimensions.find((item) => item.key === dimension.key)
      return {
        dimension: dimension.key,
        before: previous?.value ?? 0.5,
        after: dimension.value,
        beforeConfidence: previous?.confidence ?? 0,
        afterConfidence: dimension.confidence,
      }
    })
    .filter(
      (change) =>
        Math.abs(change.after - change.before) >= 0.005 ||
        Math.abs(change.afterConfidence - change.beforeConfidence) >= 0.02,
    )

export const sampleStateCopy: Record<TasteSampleState, string> = {
  empty: '观影记录还不够多，继续记录几部电影，我们会逐渐了解你的电影品味。',
  insufficient:
    '观影记录还不够多，继续记录几部电影，我们会逐渐了解你的电影品味。目前的任何方向都只是暂时假设。',
  forming: '画像正在成形。新增的每一部电影都会成为新的证据，而不是覆盖旧结论。',
  stable: '这已经是可以被检验的解读；它仍然只是估计，不是对你的定义。',
}

export const moodName = (id: string): string => MOODS[id as MoodId]?.zh ?? id
