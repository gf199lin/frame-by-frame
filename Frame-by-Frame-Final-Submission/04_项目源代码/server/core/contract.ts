/* ------------------------------------------------------------------ */
/*  AI Core V1 — shared contract                                       */
/*  This file is intentionally dependency-free so it can run inside    */
/*  Cloudflare Workers, Node 20+, and the test runner.                 */
/* ------------------------------------------------------------------ */

export const PROMPT_VERSION = 'fbf-ai-1.0.0'
export const SCHEMA_VERSION = 1

export const DIMENSION_IDS = [
  'narrative',
  'emotion',
  'thematic',
  'visual',
  'character',
  'ending',
] as const

export type DimensionId = (typeof DIMENSION_IDS)[number]

/**
 * The six axes mirror the existing My Taste radar. Each axis is a single
 * bipolar line, so a claim must say which pole it points at. Definitions are
 * written for the model: they describe what counts as evidence, not a genre.
 */
export const DIMENSION_GUIDE: Record<
  DimensionId,
  { label: string; low: string; high: string; definition: string; signals: string }
> = {
  narrative: {
    label: '叙事偏好',
    low: '慢热、内向、由氛围与留白推进',
    high: '强情节、推进感强、由事件与因果驱动',
    definition:
      '用户如何被一个故事带进去：他更享受缓慢进入、允许停顿和省略的结构，还是更享受目标明确、节奏推进、事件密集的结构。',
    signals: '对节奏、剪辑、时间线、结构、冗长/紧凑的具体评价；被哪一场戏留下。',
  },
  emotion: {
    label: '情绪表达',
    low: '克制、含蓄、不外露',
    high: '浓烈、宣泄、直接击中',
    definition:
      '用户偏好哪种情绪被呈现和传递的方式：收着的、需要自己靠近的情绪，还是外放的、允许哭出来的情绪。',
    signals: '“哭/没有哭”“克制/用力”“被按住/被击中”等对情绪强度的具体反应。',
  },
  thematic: {
    label: '主题偏好',
    low: '向内：记忆、哀悼、自我、家庭',
    high: '向外：自由、正义、野心、世界',
    definition:
      '用户反复被哪些主题吸引。注意：电影的主题本身不等于用户的偏好，只有用户明确回应过的主题才算证据。',
    signals: '用户主动谈论、反复引用、与自己生活建立联系的主题。',
  },
  visual: {
    label: '视觉风格',
    low: '自然、触感、纪录式的影像',
    high: '风格化、构图明确、形式感强',
    definition:
      '用户对画面、摄影、色彩、镜头语言和声音设计的敏感度与偏好方向。',
    signals: '主动提到镜头、光线、颜色、构图、配乐、声音；或明确表示不在意形式。',
  },
  character: {
    label: '人物塑造',
    low: '人物驱动、强调个人转变与动机',
    high: '群像、处境式、关系网络',
    definition:
      '用户更被单个复杂人物的内在转变吸引，还是更被一群人之间的关系与处境吸引。',
    signals: '谈论角色动机、表演、人物成长，或谈论群像、关系、社会处境。',
  },
  ending: {
    label: '结局偏好',
    low: '苦涩、未解、拒绝闭合',
    high: '闭合、和解、留有希望',
    definition:
      '用户希望电影结束时被留下什么：一个不急着被解决的伤口，还是一个可以带走的答案。',
    signals: '对结尾、最后一场戏、字幕升起时感受的具体描述。',
  },
}

export const THEME_IDS = [
  'memory',
  'loss',
  'grief',
  'identity',
  'love',
  'ambition',
  'freedom',
  'family',
  'hope',
  'loneliness',
  'art',
  'time',
  'reality',
  'friendship',
  'coming-of-age',
  'forgiveness',
  'sacrifice',
  'justice',
] as const

export type ThemeId = (typeof THEME_IDS)[number]

export const MOOD_IDS = [
  'melancholy',
  'tender',
  'wistful',
  'hopeful',
  'restrained',
  'cathartic',
  'uneasy',
  'awe',
  'warmth',
  'longing',
  'playful',
  'quiet',
] as const

export type MoodId = (typeof MOOD_IDS)[number]

export const RELATIONSHIP_IDS = [
  'same-theme',
  'same-mood',
  'same-director',
  'same-era',
  'contrast',
  'other',
] as const

export type RelationshipId = (typeof RELATIONSHIP_IDS)[number]

export const LIMITS = {
  /** Characters of the user's note sent to the model. */
  noteMax: 3200,
  /** How many past films may be attached as context. */
  historyMax: 8,
  historySummaryMax: 160,
  titleMax: 200,
  bodyBytesMax: 64 * 1024,
  requestTimeoutMs: 45_000,
  maxOutputTokens: 1800,
  summaryMax: 400,
  evidenceMax: 240,
  quoteMax: 200,
  uncertaintiesMax: 5,
  relatedMax: 4,
  emotionsMax: 6,
  themesMax: 6,
  bulletsMax: 4,
  likedMax: 5,
  contributionsMin: 1,
  contributionsMax: 12,
} as const

export const RATE_LIMIT = {
  windowMs: 60_000,
  maxPerWindow: 12,
  dayMs: 24 * 60 * 60 * 1000,
  maxPerDay: 80,
} as const

export const isDimensionId = (value: unknown): value is DimensionId =>
  typeof value === 'string' && (DIMENSION_IDS as readonly string[]).includes(value)

export const isThemeId = (value: unknown): value is ThemeId =>
  typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value)

export const isMoodId = (value: unknown): value is MoodId =>
  typeof value === 'string' && (MOOD_IDS as readonly string[]).includes(value)

export const isRelationshipId = (value: unknown): value is RelationshipId =>
  typeof value === 'string' && (RELATIONSHIP_IDS as readonly string[]).includes(value)
