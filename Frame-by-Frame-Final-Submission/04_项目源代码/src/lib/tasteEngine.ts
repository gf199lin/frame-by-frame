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
/*  Language — Chinese-first                                           */
/* ------------------------------------------------------------------ */
export const polePhrase = (key: DimensionKey, value: number): string => {
  const low = {
    narrative: '慢热、向内的叙事',
    emotion: '克制、含蓄的情绪表达',
    thematic: '向内、私人化的主题（记忆、哀悼、自我）',
    visual: '自然、带有触感的影像',
    character: '人物驱动、强调转变的故事',
    ending: '苦涩、未必闭合的结局',
  }[key]
  const high = {
    narrative: '推进感强、情节驱动的结构',
    emotion: '浓烈、宣泄式的情绪',
    thematic: '向外、面向世界的主题（自由、正义、他者）',
    visual: '风格化、讲究构图的画面',
    character: '群像、处境式的叙事',
    ending: '闭合、留有希望的结局',
  }[key]
  if (value < 0.42) return low
  if (value > 0.58) return high
  const def = DIMENSION_MAP[key]
  return `在「${def.lowZh}」与「${def.highZh}」之间保持平衡`
}

export const leanPhrase = (score: DimensionScore): string => {
  if (score.strength < 0.12) return `在${score.def.labelZh}上没有明显倾向`
  return score.value < 0.5 ? score.def.lowZh : score.def.highZh
}

export const tasteSignature = (snapshot: TasteSnapshot): string => {
  if (snapshot.filmCount === 0) return '还没有留下任何记录。'
  const ranked = [...snapshot.dimensionScores]
    .filter((d) => d.key !== 'thematic' && d.strength > 0.14)
    .sort((a, b) => b.strength * (0.4 + b.confidence) - a.strength * (0.4 + a.confidence))
    .slice(0, 3)
  const words = ranked.map((d) => {
    const short: Record<string, [string, string]> = {
      narrative: ['慢热', '强情节'],
      emotion: ['克制', '浓烈'],
      visual: ['自然的影像', '讲究构图'],
      character: ['人物驱动', '群像感'],
      ending: ['不急着闭合', '愿意给出希望'],
    }
    const pair = short[d.key]
    return pair ? (d.value < 0.5 ? pair[0] : pair[1]) : ''
  })
  const theme = snapshot.topThemes[0]
  const themeWord = theme ? `一次次回到「${THEMES[theme.id].zh}」` : ''
  const all = [words[0], words[1], themeWord, words[2]].filter(Boolean)
  if (all.length === 0) return '还在成形——暂时没有明显的倾向。'
  return all.join('、')
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
    `在你记录的 ${snapshot.filmCount} 部电影里，最清晰的信号是${polePhrase(first.key, first.value)}。`,
  )
  if (second && second.confidence > 0.25) {
    sentences.push(
      `第二条线索是${polePhrase(second.key, second.value)}${
        Math.abs(second.value - 0.5) < 0.08 ? '，不过目前还很微弱' : ''
      }。`,
    )
  }
  if (theme) {
    sentences.push(
      `「${THEMES[theme.id].zh}」出现在 ${theme.count} 部你留下的电影里${
        mood ? `，常常以「${MOODS[mood.id].zh}」的方式出现` : ''
      }。`,
    )
  }
  sentences.push(
    `这份解读来自你的评分和笔记，目前置信度 ${Math.round(
      snapshot.overallConfidence * 100,
    )}%。它会随着你一起改变。`,
  )
  return sentences
}

/* ------------------------------------------------------------------ */
/*  Evidence                                                           */
/* ------------------------------------------------------------------ */
const KEYWORDS: Record<DimensionKey, string[]> = {
  narrative: [
    'structure',
    'pace',
    'pacing',
    'slow',
    'editing',
    'timeline',
    'scene',
    'epilogue',
    'chapter',
    'story',
    'minutes',
    '节奏',
    '结构',
    '剪辑',
    '时间线',
    '场景',
    '段落',
    '长镜头',
    '缓慢',
  ],
  emotion: [
    'cry',
    'cried',
    'feel',
    'feeling',
    'grief',
    'moved',
    'broke',
    'held',
    'anger',
    'tender',
    'restrained',
    'quiet',
    '哭',
    '眼泪',
    '感动',
    '难过',
    '情绪',
    '愤怒',
    '温柔',
    '克制',
    '安静',
  ],
  thematic: [
    'memory',
    'loss',
    'grief',
    'identity',
    'freedom',
    'love',
    'time',
    'hope',
    'meaning',
    'about',
    'world',
    '记忆',
    '失去',
    '告别',
    '身份',
    '自由',
    '爱',
    '时间',
    '希望',
    '意义',
    '世界',
  ],
  visual: [
    'image',
    'shot',
    'frame',
    'light',
    'colour',
    'color',
    'symmetry',
    'visual',
    'picture',
    'composition',
    'scene',
    '画面',
    '镜头',
    '光线',
    '颜色',
    '色彩',
    '构图',
    '影像',
    '摄影',
  ],
  character: [
    'character',
    'performance',
    'actor',
    'protagonist',
    'person',
    'role',
    'self',
    'father',
    'mother',
    '人物',
    '角色',
    '表演',
    '演员',
    '主角',
    '父亲',
    '母亲',
  ],
  ending: [
    'ending',
    'end',
    'last',
    'final',
    'epilogue',
    'credits',
    'close',
    'resolution',
    'rain',
    'look',
    '结局',
    '最后',
    '结尾',
    '片尾',
    '字幕',
    '收束',
    '留白',
  ],
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
  if (confidence < 0.3) return '一个值得验证的轮廓'
  if (confidence < 0.42) return '一个开始有方向的解读'
  if (confidence < 0.56) return '一种可以辨认的审美'
  return '一座有自己观点的博物馆'
}

const hedge = (confidence: number): string => {
  if (confidence < 0.3) return '现在还很早，但'
  if (confidence < 0.55) return '轮廓还在形成：'
  return '你的片库现在显示：'
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
    const title = (film: Film | undefined) => film?.title ?? '一部电影'
    const themeLine = theme
      ? `「${THEMES[theme.id].zh}」出现在其中 ${theme.count} 部里`
      : '暂时还没有一个主题占据主导'

    let body: string
    if (count === 1) {
      body = `你从《${title(firstFilm)}》开始。${hedge(
        snapshot.overallConfidence,
      )}你对${polePhrase(strongest.key, strongest.value)}有反应。`
    } else if (count <= 3) {
      body = `${count} 部电影已经足够形成第一个假设：${polePhrase(
        strongest.key,
        strongest.value,
      )}。${themeLine}${mood ? `，而它们通常让你感到「${MOODS[mood.id].zh}」` : ''}。`
    } else if (count <= 5) {
      body = `两条线索正在形成：${polePhrase(strongest.key, strongest.value)}，以及${polePhrase(
        second.key,
        second.value,
      )}。${theme ? `它们在「${THEMES[theme.id].zh}」附近交汇。` : ''}这份解读仍然是暂时的。`
    } else if (count <= 8) {
      body = `${themeLine}，这已经不像巧合。最强的信号仍然是${polePhrase(
        strongest.key,
        strongest.value,
      )}，而最近的一帧是《${title(lastFilm)}》。`
    } else if (count <= 12) {
      body = `已经稳定到可以被检验：${tasteSignature(snapshot)}。${themeLine}，片库也一再选择「${
        mood ? MOODS[mood.id].zh : '同一种语气'
      }」。置信度 ${confidencePct}%。`
    } else {
      body = `这座博物馆已经有了自己的观点：${tasteSignature(snapshot)}。${
        theme
          ? `「${THEMES[theme.id].zh}」仍然是底色，「${THEMES[secondTheme?.id ?? theme.id].zh}」紧随其后。`
          : ''
      }每一条新笔记都会让解读更紧，而不是把它替换掉。`
    }

    stages.push({
      id: `stage-${count}`,
      filmCount: count,
      at: slice[slice.length - 1].watchedAt,
      headline: count === 1 ? '第一帧' : timelineHeadline(snapshot.overallConfidence),
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
  const labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
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
  if (Math.abs(delta) < 0.035) return '保持稳定'
  const moved = Math.abs(delta) >= 0.09 ? '明显转向' : '轻微偏向'
  return `${moved}${delta > 0 ? '向外、更外放的一侧' : '向内、更克制的一侧'}`
}

export const formatStageDate = (iso: string): string => formatLongDate(iso)

export const recordFor = (records: WatchRecord[], filmId: string): WatchRecord | undefined =>
  records.find((r) => r.filmId === filmId)
