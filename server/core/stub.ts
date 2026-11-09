import type { AIProvider, ChatMessage, CompletionOptions, CompletionResult } from './provider.ts'

/* ------------------------------------------------------------------ */
/*  Local verification provider                                        */
/*  This is NOT an AI model. It exists so the full request/validation   */
/*  /UI path can be exercised without an API key. It is disabled unless */
/*  AI_PROVIDER=stub AND ALLOW_STUB_PROVIDER=1, and every result is     */
/*  labelled "stub-local-verification" in the UI and in storage.        */
/* ------------------------------------------------------------------ */

type Signal = {
  dimension_id: 'narrative' | 'emotion' | 'thematic' | 'visual' | 'character' | 'ending'
  direction: 'low' | 'high'
  keywords: string[]
  evidence: string
}

const SIGNALS: Signal[] = [
  {
    dimension_id: 'emotion',
    direction: 'high',
    keywords: ['哭', '眼泪', '感动', '崩溃', '击中', 'cry', 'tears'],
    evidence: '笔记里出现了明显的情绪释放描述，说明这次观影允许自己被击中。',
  },
  {
    dimension_id: 'emotion',
    direction: 'low',
    keywords: ['克制', '安静', '沉默', '屏住呼吸', '没有哭', 'understated', 'restrained'],
    evidence: '笔记强调克制与安静的体验，情绪不是被推出来的。',
  },
  {
    dimension_id: 'narrative',
    direction: 'low',
    keywords: ['慢', '长镜头', '留白', '停顿', '不着急', 'slow', 'quiet'],
    evidence: '笔记对停顿、留白或缓慢的段落有正面反应。',
  },
  {
    dimension_id: 'narrative',
    direction: 'high',
    keywords: ['节奏', '剪辑', '结构', '推进', '紧凑', 'pacing', 'editing'],
    evidence: '笔记注意到了节奏或结构本身，并把它当成观影体验的一部分。',
  },
  {
    dimension_id: 'visual',
    direction: 'high',
    keywords: ['画面', '镜头', '色彩', '光线', '构图', '摄影', '配乐', '声音'],
    evidence: '笔记主动谈论画面、镜头或声音，形式感进入了这次体验。',
  },
  {
    dimension_id: 'character',
    direction: 'low',
    keywords: ['他', '她', '角色', '人物', '表演', '动机', '转变'],
    evidence: '笔记把注意力放在具体人物及其动机或转变上。',
  },
  {
    dimension_id: 'ending',
    direction: 'high',
    keywords: ['结尾', '最后', '片尾', '希望', '和解', 'ending', 'final'],
    evidence: '笔记对结尾留下的东西有明确反应。',
  },
]

const THEMES: Array<{ id: string; keywords: string[] }> = [
  { id: 'memory', keywords: ['记忆', '回忆', '记得', '忘记', 'memory'] },
  { id: 'grief', keywords: ['悲伤', '哀悼', '失去', '死亡', 'grief', 'loss'] },
  { id: 'identity', keywords: ['身份', '自我', '我是谁', 'identity'] },
  { id: 'love', keywords: ['爱', '爱情', '关系', 'love'] },
  { id: 'family', keywords: ['父亲', '母亲', '家庭', '家人', 'family'] },
  { id: 'freedom', keywords: ['自由', '逃离', 'freedom'] },
  { id: 'hope', keywords: ['希望', '相信', 'hope'] },
  { id: 'art', keywords: ['艺术', '诗', '音乐', 'art', 'poetry'] },
  { id: 'time', keywords: ['时间', '岁月', 'time'] },
  { id: 'loneliness', keywords: ['孤独', '一个人', 'lonely'] },
]

const MOODS: Array<{ id: string; keywords: string[] }> = [
  { id: 'cathartic', keywords: ['哭', '眼泪', '释放', 'cry'] },
  { id: 'restrained', keywords: ['克制', '安静', '沉默'] },
  { id: 'tender', keywords: ['温柔', '温暖', 'tender'] },
  { id: 'melancholy', keywords: ['悲伤', '难过', '忧郁'] },
  { id: 'awe', keywords: ['震撼', '壮阔', '宇宙'] },
  { id: 'longing', keywords: ['想念', '眷恋', '牵挂'] },
  { id: 'hopeful', keywords: ['希望', '相信'] },
  { id: 'wistful', keywords: ['怅惘', '怀旧', '苦涩'] },
]

const sentences = (note: string): string[] =>
  note
    .split(/(?<=[。！？.!?])|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 3)

const quoteFor = (note: string, keywords: string[]): string | undefined => {
  const found = sentences(note).find((sentence) =>
    keywords.some((keyword) => sentence.toLowerCase().includes(keyword.toLowerCase())),
  )
  return found ? found.slice(0, 200) : undefined
}

const between = (text: string, start: string, end: string): string => {
  const from = text.indexOf(start)
  if (from === -1) return ''
  const to = text.indexOf(end, from + start.length)
  if (to === -1) return ''
  return text.slice(from + start.length, to).trim()
}

export class StubProvider implements AIProvider {
  readonly name = 'stub-local-verification'
  readonly model = 'stub-local-verification'

  async complete(messages: ChatMessage[], _options: CompletionOptions): Promise<CompletionResult> {
    const user = messages.find((message) => message.role === 'user')?.content ?? ''
    const note = between(user, '<<<NOTE', 'NOTE>>>')

    const contributions: Array<Record<string, unknown>> = []
    for (const signal of SIGNALS) {
      if (!signal.keywords.some((keyword) => note.toLowerCase().includes(keyword.toLowerCase()))) {
        continue
      }
      const quote = quoteFor(note, signal.keywords)
      contributions.push({
        dimension_id: signal.dimension_id,
        direction: signal.direction,
        strength: 0.55,
        confidence: 0.4,
        evidence: `【本地验证替代实现】${signal.evidence}`,
        ...(quote ? { quote } : {}),
      })
    }
    if (contributions.length === 0) {
      contributions.push({
        dimension_id: 'emotion',
        direction: 'neutral',
        strength: 0.2,
        confidence: 0.15,
        evidence: '【本地验证替代实现】没有识别到明确方向，仅用于验证前后端链路。',
      })
    }

    const themes = THEMES.filter((theme) =>
      theme.keywords.some((keyword) => note.toLowerCase().includes(keyword.toLowerCase())),
    )
      .slice(0, 4)
      .map((theme) => ({
        theme: theme.id,
        evidence: '【本地验证替代实现】笔记出现了与该主题相关的词。',
      }))

    const moods = MOODS.filter((mood) =>
      mood.keywords.some((keyword) => note.toLowerCase().includes(keyword.toLowerCase())),
    )
      .slice(0, 3)
      .map((mood) => ({
        mood: mood.id,
        evidence: '【本地验证替代实现】笔记出现了与该情绪相关的词。',
      }))

    const historyIds = Array.from(user.matchAll(/id=([A-Za-z0-9_-]+)/g)).map((match) => match[1])

    const payload = {
      summary:
        '【STUB 本地验证】这是一条由本地替代实现生成的示例结果，用于验证请求、结构校验与界面流程，不是真实模型输出。真实分析需要配置 DEEPSEEK_API_KEY。',
      observed_emotions: moods.length > 0 ? moods : [{ mood: 'quiet', evidence: '笔记语气偏安静。' }],
      themes_identified: themes,
      focus: {
        narrative: ['【STUB】笔记提到了节奏或结构。'],
        character: [],
        visual: [],
      },
      liked: ['【STUB】用户笔记中的具体细节。'],
      disliked: [],
      preference_evidence: contributions,
      uncertainties: ['【STUB】所有结论仅用于链路验证，不能视为真实的审美判断。'],
      confidence: 0.2,
      related_films: historyIds.slice(0, 1).map((filmId) => ({
        film_id: filmId,
        relationship: 'same-theme',
        explanation: '【STUB】用于验证关联影片展示。',
      })),
    }

    return {
      text: JSON.stringify(payload),
      provider: this.name,
      model: this.model,
    }
  }
}
