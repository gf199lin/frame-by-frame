/* Shared fixtures — intentionally dependency-free so both the Node test
 * runner and Vitest can import this file directly. */

export const NOTE =
  '那天我本来只想随便看看，结果在海边那场戏里停住了。她什么都没有说，只是把杯子放回桌上，我忽然想起母亲。' +
  '我喜欢它没有把和解拍成一个拥抱：两个人到最后也没有真正道歉，但都留下来了。'

export const HISTORY_IDS = ['film-b', 'film-c']

export const validAnalysis = () => ({
  summary:
    '你被打动的不是和解本身，而是两个人愿意继续坐在同一张桌子旁。你注意到的是克制的动作，而不是台词。',
  observed_emotions: [
    { mood: 'restrained', evidence: '你强调她什么都没有说，只用动作表达。' },
    { mood: 'wistful', evidence: '你把这场戏与母亲联系起来。' },
  ],
  themes_identified: [
    { theme: 'family', evidence: '你主动把电影里的关系与自己的母亲联系起来。' },
    { theme: 'forgiveness', evidence: '你明确说它没有把和解拍成拥抱。' },
  ],
  focus: {
    narrative: ['你注意到这场戏的停顿与留白。'],
    character: ['你关注人物没有说出口的部分。'],
    visual: [],
  },
  liked: ['用动作而不是台词表达和解'],
  disliked: [],
  preference_evidence: [
    {
      dimension_id: 'emotion',
      direction: 'low',
      strength: 0.7,
      confidence: 0.6,
      evidence: '你被克制的表达打动，并明确不喜欢把和解拍成拥抱。',
      quote: '我喜欢它没有把和解拍成一个拥抱',
    },
    {
      dimension_id: 'narrative',
      direction: 'low',
      strength: 0.5,
      confidence: 0.45,
      evidence: '你因为一场停顿的戏留下来。',
    },
    {
      dimension_id: 'thematic',
      direction: 'low',
      strength: 0.6,
      confidence: 0.5,
      evidence: '你把家庭与记忆联系起来。',
    },
  ],
  uncertainties: ['只有一段笔记，不能据此判断你长期偏爱家庭题材。'],
  confidence: 0.55,
  related_films: [
    { film_id: 'film-b', relationship: 'same-theme', explanation: '都在讲没有说出口的家庭关系。' },
  ],
})

export const validResponse = () => ({
  analysis: validAnalysis(),
  meta: {
    provider: 'deepseek',
    model: 'deepseek-chat',
    promptVersion: 'fbf-ai-1.0.0',
    analyzedAt: '2026-11-07T05:00:00.000Z',
    latencyMs: 3200,
    inputChars: NOTE.length,
    attempts: 1,
  },
})
