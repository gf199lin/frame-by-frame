import type { AIFilmAnalysis, Film, TasteDirection, WatchRecord } from '@/types'
import { DIMENSIONS, MOODS, THEMES } from './taxonomy'

const firstSentence = (text: string): string => {
  const match = text.trim().match(/^(.+?[。！？!?])/)
  return (match?.[1] ?? text.trim()).slice(0, 110)
}

const directionOf = (value: number): TasteDirection =>
  value < 0.45 ? 'low' : value > 0.55 ? 'high' : 'neutral'

/**
 * 示例片库的“已解读”分析。
 *
 * 这些对象只用于首次打开时的演示，结构与真实 AI 分析完全一致：
 * 每条判断都带证据、引文和用户确认状态，因此用户可以逐条移除或修正。
 * 它们不会覆盖任何用户记录，也不会被写入外部服务。
 */
export const buildSeedAnalysis = (record: WatchRecord, film: Film): AIFilmAnalysis => {
  const preferenceEvidence = DIMENSIONS.map((def) => {
    const value = film.signature[def.key]
    const direction = directionOf(value)
    const leaning =
      direction === 'low' ? def.lowZh : direction === 'high' ? def.highZh : '两种倾向之间'
    return {
      dimension_id: def.key,
      direction,
      strength: Math.max(0.18, Math.min(0.95, Math.abs(value - 0.5) * 2)),
      confidence: Math.max(0.45, Math.min(0.88, record.ai.confidence + 0.06)),
      evidence: `《${film.title}》在「${def.labelZh}」上更接近「${leaning}」；这条判断来自影片标签与你的评分，而不是类型猜测。`,
      quote: firstSentence(record.reflection),
      userStatus: 'kept' as const,
    }
  })

  return {
    schemaVersion: 1,
    recordId: record.id,
    filmId: film.id,
    status: 'complete',
    summary: record.ai.summary,
    observed_emotions: record.moods
      .filter((mood) => MOODS[mood])
      .map((mood) => ({
        mood,
        evidence: `你的笔记与电影标签都把这次观影指向「${MOODS[mood].zh}」。`,
      })),
    themes_identified: record.themes
      .filter((theme) => THEMES[theme])
      .map((theme) => ({
        theme,
        evidence: `「${THEMES[theme].zh}」出现在这部电影的标签里，也反复出现在你的记录中。`,
      })),
    narrative_observations: [
      `这部电影的叙事更接近「${film.signature.narrative < 0.5 ? '慢热、向内' : '推进感强、情节驱动'}」。`,
    ],
    character_observations: [
      `人物塑造偏向「${film.signature.character < 0.5 ? '人物驱动、强调转变' : '群像、处境式'}」。`,
    ],
    visual_observations: [
      `画面气质偏向「${film.signature.visual < 0.5 ? '自然、带有触感' : '风格化、讲究构图'}」。`,
    ],
    liked: record.themes
      .filter((theme) => THEMES[theme])
      .slice(0, 3)
      .map((theme) => `你对「${THEMES[theme].zh}」的处理有明确反应。`),
    disliked: [],
    preference_evidence: preferenceEvidence,
    uncertainties: ['这是示例片库的编辑解读，用于展示可逐条修正的分析结构。'],
    confidence: record.ai.confidence,
    related_films: [],
    model: {
      provider: 'seed',
      model: 'editorial-seed-v1',
      promptVersion: 'seed-1',
      analyzedAt: record.updatedAt,
    },
    review: {
      verdict: 'unreviewed',
      updatedAt: record.updatedAt,
    },
  }
}

export const buildSeedAnalyses = (records: WatchRecord[], films: Film[]): AIFilmAnalysis[] =>
  records.flatMap((record) => {
    const film = films.find((item) => item.id === record.filmId)
    return film ? [buildSeedAnalysis(record, film)] : []
  })
