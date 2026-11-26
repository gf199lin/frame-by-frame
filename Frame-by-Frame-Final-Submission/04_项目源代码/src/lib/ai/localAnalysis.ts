import { DIMENSIONS, MOODS, THEMES } from '@/data/taxonomy'
import { analyseDraft } from '@/lib/analyst'
import type { AddFilmDraft, AIFilmAnalysis, Film, TasteDirection, WatchRecord } from '@/types'

const firstSentence = (text: string): string => {
  const match = text.trim().match(/^(.+?[。！？!?])/)
  return (match?.[1] ?? text.trim()).slice(0, 110)
}

const directionOf = (value: number): TasteDirection =>
  value < 0.45 ? 'low' : value > 0.55 ? 'high' : 'neutral'

/**
 * 本地规则引擎的完整解读。
 *
 * 当在线 AI 未配置、用户未授权发送笔记，或在线服务暂时不可用时，
 * 仍然生成一份结构完整、可逐条修正的解读，让添加电影的五步流程完整可用。
 */
export const buildLocalFilmAnalysis = (
  film: Film,
  draft: AddFilmDraft,
  previousRecords: WatchRecord[],
  films: Film[],
  recordId: string,
): AIFilmAnalysis => {
  const result = analyseDraft(film, draft, previousRecords, films)
  const now = new Date().toISOString()
  const quote = firstSentence(draft.reflection)

  const preferenceEvidence = DIMENSIONS.map((def) => {
    const value = result.afterScores[def.key]
    const direction = directionOf(value)
    const finding = result.findings.find((item) => item.dimension === def.key)
    return {
      dimension_id: def.key,
      direction,
      strength: Math.max(0.16, Math.min(0.95, Math.abs(value - 0.5) * 2)),
      confidence: Math.max(0.3, Math.min(0.9, finding?.confidence ?? result.confidenceAfter)),
      evidence:
        finding?.detail ??
        `《${film.title}》与你的笔记在「${def.labelZh}」上给出了一致的信号。`,
      quote,
      userStatus: 'kept' as const,
    }
  })

  return {
    schemaVersion: 1,
    recordId,
    filmId: film.id,
    status: 'complete',
    summary: result.summary,
    observed_emotions: result.moods
      .filter((mood) => MOODS[mood])
      .map((mood) => ({
        mood,
        evidence: `你的笔记与这部电影的标签都把语气指向「${MOODS[mood].zh}」。`,
      })),
    themes_identified: result.themes
      .filter((theme) => THEMES[theme])
      .map((theme) => ({
        theme,
        evidence: `「${THEMES[theme].zh}」同时出现在你的文字和这部电影的主题标签里。`,
      })),
    narrative_observations: [
      result.findings.find((item) => item.dimension === 'narrative')?.headline ??
        `《${film.title}》的叙事位置更接近「${film.signature.narrative < 0.5 ? '慢热、向内' : '推进感强'}」。`,
    ],
    character_observations: [
      result.findings.find((item) => item.dimension === 'character')?.headline ??
        `人物塑造偏向「${film.signature.character < 0.5 ? '人物驱动' : '群像'}」。`,
    ],
    visual_observations: [
      result.findings.find((item) => item.dimension === 'visual')?.headline ??
        `画面气质偏向「${film.signature.visual < 0.5 ? '自然、带有触感' : '风格化、讲究构图'}」。`,
    ],
    liked: result.findings.slice(0, 3).map((item) => item.headline),
    disliked: [],
    preference_evidence: preferenceEvidence,
    uncertainties: ['这是本地规则引擎的解读，没有调用外部模型，可以逐条修正。'],
    confidence: result.confidenceAfter,
    related_films: result.connections.map((connection) => ({
      filmId: connection.filmId,
      relationship: '共同主题',
      explanation: connection.reason,
    })),
    model: {
      provider: 'local-engine',
      model: 'analyst-v1',
      promptVersion: 'local-1',
      analyzedAt: now,
      inputChars: draft.reflection.trim().length,
    },
    review: {
      verdict: 'accepted',
      updatedAt: now,
    },
  }
}
