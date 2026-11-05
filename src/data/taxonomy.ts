import type {
  AnalysisStage,
  DimensionDef,
  DimensionKey,
  MoodId,
  ThemeId,
  WatchStatus,
} from '@/types'

export const DIMENSIONS: DimensionDef[] = [
  {
    key: 'narrative',
    index: '01',
    label: 'Narrative Preference',
    labelZh: '叙事偏好',
    low: 'Slow-burn & interior',
    high: 'Propulsive & plot-driven',
    lowZh: '慢热 · 内向',
    highZh: '强情节 · 推进',
    question: 'How does a story need to move for you to stay inside it?',
    note: 'Measured from the pacing and structure of the films you rated highest.',
  },
  {
    key: 'emotion',
    index: '02',
    label: 'Emotional Expression',
    labelZh: '情绪表达',
    low: 'Restrained & understated',
    high: 'Heightened & cathartic',
    lowZh: '克制 · 含蓄',
    highZh: '浓烈 · 宣泄',
    question: 'Do you trust a film more when it holds back, or when it lets go?',
    note: 'Weighted by the emotional register of your notes, not just the genre.',
  },
  {
    key: 'thematic',
    index: '03',
    label: 'Thematic Preference',
    labelZh: '主题偏好',
    low: 'Inward — memory, grief, self',
    high: 'Outward — freedom, justice, world',
    lowZh: '向内 · 记忆与自我',
    highZh: '向外 · 自由与世界',
    question: 'Which themes keep pulling you back into the dark?',
    note: 'Derived from the themes you return to across films and reflections.',
  },
  {
    key: 'visual',
    index: '04',
    label: 'Visual Style',
    labelZh: '视觉风格',
    low: 'Naturalistic & tactile',
    high: 'Stylized & composed',
    lowZh: '自然 · 触感',
    highZh: '风格化 · 构图',
    question: 'Are you watching a world, or watching someone compose one?',
    note: 'An estimate from the visual signatures of the films you keep.',
  },
  {
    key: 'character',
    index: '05',
    label: 'Character Development',
    labelZh: '人物塑造',
    low: 'Character-driven & transforming',
    high: 'Ensemble & situational',
    lowZh: '人物驱动 · 转变',
    highZh: '群像 · 处境',
    question: 'Do you follow one person inward, or a room full of people?',
    note: 'Built from how central individual change is to your highest-rated films.',
  },
  {
    key: 'ending',
    index: '06',
    label: 'Ending Preference',
    labelZh: '结局偏好',
    low: 'Bittersweet & unresolved',
    high: 'Resolved & hopeful',
    lowZh: '苦涩 · 未解',
    highZh: '闭合 · 希望',
    question: 'What do you want to be left with when the credits start?',
    note: 'Read from the endings of the films you rate above 4.0.',
  },
]

export const DIMENSION_MAP: Record<DimensionKey, DimensionDef> = DIMENSIONS.reduce(
  (acc, d) => ({ ...acc, [d.key]: d }),
  {} as Record<DimensionKey, DimensionDef>,
)

export const THEMES: Record<ThemeId, { label: string; zh: string; blurb: string }> = {
  memory: { label: 'Memory', zh: '记忆', blurb: 'What we keep, edit, and lose.' },
  loss: { label: 'Loss', zh: '失去', blurb: 'The shape left behind by absence.' },
  grief: { label: 'Grief', zh: '哀悼', blurb: 'Grief that will not resolve on cue.' },
  identity: { label: 'Identity', zh: '身份', blurb: 'Who we are when no one is writing it.' },
  love: { label: 'Love', zh: '爱', blurb: 'Attachment, timing, and its cost.' },
  ambition: { label: 'Ambition', zh: '野心', blurb: 'The price of wanting something badly.' },
  freedom: { label: 'Freedom', zh: '自由', blurb: 'Leaving the world you were given.' },
  family: { label: 'Family', zh: '家庭', blurb: 'The first story we cannot choose.' },
  hope: { label: 'Hope', zh: '希望', blurb: 'Not optimism — maintenance.' },
  loneliness: { label: 'Loneliness', zh: '孤独', blurb: 'Being surrounded and still unheard.' },
  art: { label: 'Art', zh: '艺术', blurb: 'Making something that outlives the maker.' },
  time: { label: 'Time', zh: '时间', blurb: 'The one dimension we cannot cut.' },
  reality: { label: 'Reality', zh: '真实', blurb: 'The stories other people write for us.' },
  friendship: { label: 'Friendship', zh: '友谊', blurb: 'Chosen company against the dark.' },
  'coming-of-age': {
    label: 'Coming of Age',
    zh: '成长',
    blurb: 'The moment childhood stops fitting.',
  },
  forgiveness: { label: 'Forgiveness', zh: '宽恕', blurb: 'The slow work of letting go.' },
  sacrifice: { label: 'Sacrifice', zh: '牺牲', blurb: 'What is traded for what is kept.' },
  justice: { label: 'Justice', zh: '正义', blurb: 'The distance between law and right.' },
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
    label: 'Identifying film information',
    detail: 'Matching title, year, and director against your archive.',
  },
  {
    id: 'read',
    label: 'Understanding your reflection',
    detail: 'Reading your own words for what stayed with you.',
  },
  {
    id: 'extract',
    label: 'Extracting emotional and thematic patterns',
    detail: 'Separating themes from moods, not guessing from genre.',
  },
  {
    id: 'compare',
    label: 'Comparing with your previous memories',
    detail: 'Looking for films that share a frame with this one.',
  },
  {
    id: 'update',
    label: 'Updating your personal taste profile',
    detail: 'Recomputing six dimensions and their confidence.',
  },
]

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
export const STORAGE_VERSION = 1
