import type {
  AnalysisStage,
  DimensionDef,
  DimensionKey,
  MoodId,
  ThemeId,
  WatchStatus,
} from '@/types'

/**
 * 电影审美六维。
 * `labelZh` 是界面主文案，`label` 只作为小字号英文辅助，不承担操作说明。
 */
export const DIMENSIONS: DimensionDef[] = [
  {
    key: 'narrative',
    index: '01',
    label: 'Narrative',
    labelZh: '叙事偏好',
    low: 'Slow-burn & interior',
    high: 'Propulsive & plot-driven',
    lowZh: '慢热 · 向内',
    highZh: '强情节 · 推进',
    question: '一个故事要多快进入你，你才愿意留在里面？',
    note: '依据你评分最高的电影，在节奏与结构上的共同倾向估算。',
  },
  {
    key: 'emotion',
    index: '02',
    label: 'Emotion',
    labelZh: '情绪表达',
    low: 'Restrained & understated',
    high: 'Heightened & cathartic',
    lowZh: '克制 · 含蓄',
    highZh: '浓烈 · 宣泄',
    question: '你更信任收着的电影，还是放开的电影？',
    note: '主要来自你观影笔记里的情绪语气，而不只是电影类型。',
  },
  {
    key: 'thematic',
    index: '03',
    label: 'Theme',
    labelZh: '主题偏好',
    low: 'Inward — memory, grief, self',
    high: 'Outward — freedom, justice, world',
    lowZh: '向内 · 记忆与自我',
    highZh: '向外 · 自由与世界',
    question: '哪些主题会一次次把你拉回黑暗里？',
    note: '由你反复记录的主题与观影感受共同推导。',
  },
  {
    key: 'visual',
    index: '04',
    label: 'Visual',
    labelZh: '视觉风格',
    low: 'Naturalistic & tactile',
    high: 'Stylized & composed',
    lowZh: '自然 · 触感',
    highZh: '风格化 · 构图',
    question: '你是在看一个世界，还是在看一个人如何组织这个世界？',
    note: '根据你收录电影的视觉气质做出的估计。',
  },
  {
    key: 'character',
    index: '05',
    label: 'Character',
    labelZh: '人物塑造',
    low: 'Character-driven & transforming',
    high: 'Ensemble & situational',
    lowZh: '人物驱动 · 转变',
    highZh: '群像 · 处境',
    question: '你更愿意跟着一个人往里走，还是看一屋子人的关系？',
    note: '依据个人转变在你高分电影中的中心程度估算。',
  },
  {
    key: 'ending',
    index: '06',
    label: 'Ending',
    labelZh: '结局偏好',
    low: 'Bittersweet & unresolved',
    high: 'Resolved & hopeful',
    lowZh: '苦涩 · 未解',
    highZh: '闭合 · 希望',
    question: '片尾字幕升起时，你希望自己被留下什么？',
    note: '从你打出 4 分以上电影的结局倾向中读取。',
  },
]

export const DIMENSION_MAP: Record<DimensionKey, DimensionDef> = DIMENSIONS.reduce(
  (acc, d) => ({ ...acc, [d.key]: d }),
  {} as Record<DimensionKey, DimensionDef>,
)

/** 主题：zh 为界面主文案，label 为小字号英文辅助。 */
export const THEMES: Record<ThemeId, { label: string; zh: string; blurbZh: string; blurb: string }> = {
  memory: { label: 'Memory', zh: '记忆', blurbZh: '我们留下、删改和失去的东西。', blurb: 'What we keep, edit, and lose.' },
  loss: { label: 'Loss', zh: '失去', blurbZh: '缺席之后留下的形状。', blurb: 'The shape left behind by absence.' },
  grief: { label: 'Grief', zh: '哀悼', blurbZh: '不会按时刻表结束的悲伤。', blurb: 'Grief that will not resolve on cue.' },
  identity: { label: 'Identity', zh: '身份', blurbZh: '没有人替你书写时，你是谁。', blurb: 'Who we are when no one is writing it.' },
  love: { label: 'Love', zh: '爱', blurbZh: '依恋、时机，以及它的代价。', blurb: 'Attachment, timing, and its cost.' },
  ambition: { label: 'Ambition', zh: '野心', blurbZh: '极度渴望一件事所要付出的价格。', blurb: 'The price of wanting something badly.' },
  freedom: { label: 'Freedom', zh: '自由', blurbZh: '离开那个被安排好的世界。', blurb: 'Leaving the world you were given.' },
  family: { label: 'Family', zh: '家庭', blurbZh: '我们无法选择的第一个故事。', blurb: 'The first story we cannot choose.' },
  hope: { label: 'Hope', zh: '希望', blurbZh: '不是乐观，而是日复一日的维护。', blurb: 'Not optimism — maintenance.' },
  loneliness: { label: 'Loneliness', zh: '孤独', blurbZh: '被人群包围，却仍然没有被听见。', blurb: 'Being surrounded and still unheard.' },
  art: { label: 'Art', zh: '艺术', blurbZh: '创造比创作者活得更久的东西。', blurb: 'Making something that outlives the maker.' },
  time: { label: 'Time', zh: '时间', blurbZh: '唯一无法剪掉的那一维。', blurb: 'The one dimension we cannot cut.' },
  reality: { label: 'Reality', zh: '真实', blurbZh: '别人替我们写好的故事。', blurb: 'The stories other people write for us.' },
  friendship: { label: 'Friendship', zh: '友谊', blurbZh: '在黑暗里主动选择的同伴。', blurb: 'Chosen company against the dark.' },
  'coming-of-age': {
    label: 'Coming of Age',
    zh: '成长',
    blurbZh: '童年忽然不再合身的那一刻。',
    blurb: 'The moment childhood stops fitting.',
  },
  forgiveness: { label: 'Forgiveness', zh: '宽恕', blurbZh: '慢慢放下的一段功课。', blurb: 'The slow work of letting go.' },
  sacrifice: { label: 'Sacrifice', zh: '牺牲', blurbZh: '为了留下什么，交出了什么。', blurb: 'What is traded for what is kept.' },
  justice: { label: 'Justice', zh: '正义', blurbZh: '法律与正确之间的距离。', blurb: 'The distance between law and right.' },
}

export const MOODS: Record<MoodId, { label: string; zh: string }> = {
  melancholy: { label: 'Melancholy', zh: '忧郁' },
  tender: { label: 'Tender', zh: '温柔' },
  wistful: { label: 'Wistful', zh: '怅惘' },
  hopeful: { label: 'Hopeful', zh: '希望' },
  restrained: { label: 'Restrained', zh: '克制' },
  cathartic: { label: 'Cathartic', zh: '宣泄' },
  uneasy: { label: 'Uneasy', zh: '不安' },
  awe: { label: 'Awe', zh: '敬畏' },
  warmth: { label: 'Warmth', zh: '暖意' },
  longing: { label: 'Longing', zh: '眷恋' },
  playful: { label: 'Playful', zh: '轻盈' },
  quiet: { label: 'Quiet', zh: '静默' },
}

export const STATUS_LABELS: Record<WatchStatus, { label: string; zh: string }> = {
  watched: { label: 'Watched', zh: '看过' },
  rewatched: { label: 'Rewatched', zh: '重看' },
  abandoned: { label: 'Did not finish', zh: '未看完' },
}

export const ANALYSIS_STAGES: AnalysisStage[] = [
  {
    id: 'identify',
    label: '确认电影信息',
    detail: '在你的片库中核对片名、年份和导演。',
  },
  {
    id: 'read',
    label: '理解你的观影感受',
    detail: '阅读你写下的文字，找出真正留下来的部分。',
  },
  {
    id: 'extract',
    label: '提取情绪与主题',
    detail: '区分主题和情绪，而不是靠类型猜测。',
  },
  {
    id: 'compare',
    label: '与其他观影记忆对照',
    detail: '寻找与这部电影共享同一种画面的片子。',
  },
  {
    id: 'update',
    label: '更新你的观影品味',
    detail: '重新计算六个维度，以及这次解读的置信度。',
  },
]

/** 类型、国家、语言的界面译名。数据层仍保留原始英文值。 */
export const GENRE_LABELS: Record<string, string> = {
  Drama: '剧情',
  Romance: '爱情',
  'Sci-Fi': '科幻',
  'Science Fiction': '科幻',
  Comedy: '喜剧',
  Animation: '动画',
  Family: '家庭',
  Musical: '歌舞',
  Mystery: '悬疑',
  Thriller: '惊悚',
  Action: '动作',
  Adventure: '冒险',
  Fantasy: '奇幻',
  Horror: '恐怖',
  Crime: '犯罪',
  Documentary: '纪录',
  War: '战争',
  Western: '西部',
  History: '历史',
  Biography: '传记',
  Music: '音乐',
}

const COUNTRY_LABELS: Record<string, string> = {
  'United States': '美国',
  USA: '美国',
  'United Kingdom': '英国',
  UK: '英国',
  France: '法国',
  Japan: '日本',
  China: '中国',
  'South Korea': '韩国',
  Korea: '韩国',
  Germany: '德国',
  Italy: '意大利',
  Spain: '西班牙',
  Canada: '加拿大',
  Australia: '澳大利亚',
  Ireland: '爱尔兰',
  India: '印度',
  Taiwan: '中国台湾',
  'Hong Kong': '中国香港',
}

const LANGUAGE_LABELS: Record<string, string> = {
  English: '英语',
  French: '法语',
  Japanese: '日语',
  Chinese: '中文',
  Mandarin: '普通话',
  Cantonese: '粤语',
  Korean: '韩语',
  German: '德语',
  Italian: '意大利语',
  Spanish: '西班牙语',
  Russian: '俄语',
}

/** 未知值原样返回，避免把外部数据吞掉。 */
export const zhGenre = (genre: string): string => GENRE_LABELS[genre] ?? genre
export const zhGenres = (genres: string[]): string => genres.map(zhGenre).join(' / ')
export const zhCountry = (country: string): string => COUNTRY_LABELS[country] ?? country
export const zhLanguage = (language: string): string => LANGUAGE_LABELS[language] ?? language

/** Timeline is generated at these archive sizes. */
export const TIMELINE_MILESTONES = [1, 3, 5, 8, 10, 13, 16, 20, 25, 30]

export const GENRES = [
  'Drama',
  'Romance',
  'Sci-Fi',
  'Comedy',
  'Animation',
  'Family',
  'Musical',
  'Mystery',
]

export const STORAGE_KEY = 'fbf.state.v1'
/**
 * v2 adds AI analyses, the taste-profile change log and AI consent settings.
 * The key keeps its v1 name on purpose: changing it would orphan every
 * existing archive. Migration is handled in `src/lib/storage.ts`.
 */
export const STORAGE_VERSION = 2
