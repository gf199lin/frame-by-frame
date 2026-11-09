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
  memory: ['memory', 'memories', 'remember', 'erase', 'forget', 'past', 'nostalgia', 'archive', '记忆', '回忆', '记得', '忘记', '过去', '怀旧'],
  loss: ['loss', 'lost', 'gone', 'absence', 'left', 'leaving', 'miss', '失去', '离开', '缺席', '错过', '放下'],
  grief: ['grief', 'grieving', 'mourn', 'funeral', 'death', 'died', 'sadness', '悲伤', '哀悼', '葬礼', '死亡', '难过', '想念'],
  identity: ['identity', 'myself', 'self', 'who i am', 'belong', 'name', '身份', '自我', '我是谁', '归属', '名字'],
  love: ['love', 'loved', 'romance', 'heart', 'kiss', 'relationship', '爱', '爱情', '心动', '吻', '关系', '喜欢'],
  ambition: ['ambition', 'dream', 'career', 'greatness', 'succeed', 'wanted', '野心', '梦想', '事业', '成功', '想要'],
  freedom: ['freedom', 'free', 'escape', 'trapped', 'control', 'outside', '自由', '逃离', '困住', '控制', '外面'],
  family: ['family', 'father', 'mother', 'daughter', 'son', 'parent', 'brother', 'sister', '家庭', '父亲', '母亲', '女儿', '儿子', '父母', '兄弟', '姐妹', '家人'],
  hope: ['hope', 'hopeful', 'believe', 'promise', 'light', 'survive', '希望', '相信', '承诺', '光', '活下去'],
  loneliness: ['lonely', 'loneliness', 'alone', 'isolated', 'unheard', 'distance', '孤独', '独自', '一个人', '隔离', '距离'],
  art: ['art', 'poetry', 'poem', 'paint', 'music', 'jazz', 'writing', 'film', '艺术', '诗', '绘画', '音乐', '爵士', '写作', '电影'],
  time: ['time', 'years', 'clock', 'age', 'future', 'twenty', '时间', '岁月', '时钟', '年龄', '未来', '多年'],
  reality: ['real', 'reality', 'fake', 'television', 'show', 'script', 'world', '真实', '现实', '虚假', '电视', '节目', '剧本', '世界'],
  friendship: ['friend', 'friendship', 'companion', 'together', '朋友', '友谊', '同伴', '一起'],
  'coming-of-age': ['grow', 'growing', 'childhood', 'teen', 'boy', 'girl', 'school', '成长', '长大', '童年', '少年', '女孩', '男孩', '学校'],
  forgiveness: ['forgive', 'forgiveness', 'apolog', 'fault', 'guilt', '原谅', '宽恕', '道歉', '内疚'],
  sacrifice: ['sacrifice', 'cost', 'give up', 'trade', 'price', '牺牲', '代价', '放弃', '交换', '付出'],
  justice: ['justice', 'unfair', 'prison', 'law', 'innocent', 'sentence', '正义', '不公', '监狱', '法律', '无辜', '判决'],
}

const MOOD_KEYWORDS: Record<MoodId, string[]> = {
  melancholy: ['sad', 'melancholy', 'low', 'hollow', 'grey', 'gray', '难过', '忧郁', '低落', '空洞', '灰'],
  tender: ['tender', 'gentle', 'kind', 'warm', 'soft', '温柔', '轻柔', '善良', '温暖', '柔软'],
  wistful: ['wistful', 'nostalgic', 'bittersweet', 'longing', '怅惘', '怀旧', '苦涩', '眷恋'],
  hopeful: ['hope', 'hopeful', 'light', 'free', 'believe', '希望', '光', '自由', '相信'],
  restrained: ['restrained', 'quiet', 'silent', 'held my breath', 'understated', 'still', '克制', '安静', '沉默', '屏住呼吸', '不动声色'],
  cathartic: ['cry', 'cried', 'tears', 'wrecked', 'broke me', 'cathartic', 'sobbed', '哭', '眼泪', '崩溃', '释放', '大哭'],
  uneasy: ['uneasy', 'unsettling', 'frightening', 'anxious', 'wrong', '不安', '不适', '害怕', '焦虑', '不对劲'],
  awe: ['awe', 'wonder', 'vast', 'galaxy', 'beautiful', 'stunning', '敬畏', '惊叹', '壮阔', '宇宙', '震撼'],
  warmth: ['warm', 'comfort', 'home', 'together', 'friend', '温暖', '安慰', '家', '一起', '朋友'],
  longing: ['longing', 'miss', 'ache', 'want', 'distance', '眷恋', '想念', '牵挂', '想要', '距离'],
  playful: ['funny', 'playful', 'comic', 'laugh', 'charming', '好笑', '轻快', '诙谐', '笑', '可爱'],
  quiet: ['quiet', 'silent', 'still', 'slow', 'breath', '安静', '沉默', '静止', '缓慢', '呼吸'],
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
      const labels = shared.slice(0, 3).map((t) => THEMES[t].zh)
      const reason = [
        shared.length > 0
          ? `共同主题：${labels.join('、')}。`
          : `同一位导演：${film.director}。`,
        sharedMoods.length > 0
          ? `两部电影都让你感到「${sharedMoods
              .slice(0, 2)
              .map((m) => MOODS[m].zh)
              .join('」与「')}」。`
          : '',
      ]
        .filter(Boolean)
        .join('')
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
  const direction = delta > 0 ? def.highZh : def.lowZh
  if (Math.abs(delta) < 0.022) return `${def.labelZh}保持稳定`
  if (Math.abs(delta) < 0.06) return `略微偏向「${direction}」`
  return `更明显地偏向「${direction}」`
}

const findingDetail = (key: DimensionKey, before: number, after: number, confidence: number): string => {
  const def = DIMENSION_MAP[key]
  return `${def.labelZh}从 ${Math.round(before * 100)} 移动到 ${Math.round(
    after * 100,
  )}，位置在「${def.lowZh} → ${def.highZh}」这条轴上。这次解读的置信度为 ${Math.round(
    confidence * 100,
  )}%。`
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
        ? `你的${def.labelZh}保持稳定`
        : findingHeadline(key, before[key], after[key]),
      detail: small
        ? `这部电影位于轴上的 ${Math.round(filmValue * 100)}，你的片库读数为 ${Math.round(
            after[key] * 100,
          )}。它强化了已有的轮廓，而不是把它掰弯。`
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
  const topTheme = themes[0] ? THEMES[themes[0]].zh : '记忆'
  const strongest = (Object.keys(after) as DimensionKey[]).sort(
    (a, b) => Math.abs(after[b] - 0.5) - Math.abs(after[a] - 0.5),
  )[0]
  const quote = truncate(reflection.trim().split(/(?<=[.!?。！？])\s*/)[0] ?? '', 120)
  return `你关于《${film.title}》的笔记反复回到「${topTheme}」${
    quote ? `——“${quote}”` : ''
  }。对照 ${filmCount} 部电影来看，这强化了${polePhrase(strongest, after[strongest])}。`
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

export const themeLabel = (id: ThemeId): string => THEMES[id].zh
