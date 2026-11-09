/**
 * Frame by Frame — 简体中文界面文案层
 *
 * 约定：
 * 1. 这里只放“跨页面复用”和“定义产品术语”的文案，避免同一功能出现多种叫法。
 * 2. 页面里一次性的编辑式句子留在组件内部，保持文案与版式在一起。
 * 3. 电影原始英文片名、导演、演员、API 字段和内部变量名不翻译。
 */

/** 全站统一术语。任何页面都不要再使用「收藏 / 档案 / 影院」作为功能名。 */
export const TERM = {
  brand: 'Frame by Frame',
  film: '电影',
  archive: '片库',
  memory: '观影记忆',
  reflection: '观影感受',
  taste: '观影品味',
  map: '记忆地图',
  annual: '年度回顾',
  addFilm: '添加电影',
} as const

export const NAV = [
  { to: '/', label: '我的电影', en: 'My Cinema', index: '01' },
  { to: '/archive', label: '我的片库', en: 'My Archive', index: '02' },
  { to: '/map', label: '记忆地图', en: 'Memory Map', index: '03' },
  { to: '/taste', label: '观影品味', en: 'My Taste', index: '04' },
  { to: '/reflection', label: '年度回顾', en: 'Reflection', index: '05' },
] as const

export const ACTION = {
  addFilm: '添加电影',
  addFirstFilm: '添加第一部电影',
  recordFilm: '记录一部电影',
  edit: '编辑',
  editMemory: '编辑观影记忆',
  delete: '删除',
  remove: '移除',
  save: '保存',
  saveChanges: '保存修改',
  cancel: '取消',
  confirm: '确认',
  search: '搜索',
  clear: '清空',
  viewDetails: '查看详情',
  openMemory: '查看观影记忆',
  back: '返回',
  backToArchive: '返回我的片库',
  continue: '继续',
  tryAgain: '重新尝试',
  addManually: '手动添加',
  chooseAnother: '重新选择',
  notQuite: '不太对',
  thisIsIt: '就是这部',
  clearFilters: '清空筛选',
} as const

export const STATE = {
  loading: '正在加载……',
  searching: '正在搜索……',
  saving: '正在保存……',
  saved: '已保存',
  failed: '操作失败',
  success: '操作成功',
  noData: '暂无记录',
  genericError: '出现了一点问题，请稍后重试。',
  networkError: '网络连接失败，请检查网络后重试。',
  inArchive: '这部电影已经在你的片库中了',
  emptyArchiveTitle: '这里还没有收藏电影',
  emptyArchiveBody: '添加第一部电影，开始建立你的私人电影记忆博物馆。',
} as const

export const SEARCH = {
  placeholder: '搜索片名、导演、笔记或情绪……',
  placeholderShort: '搜索电影',
  byTitle: '按电影名称搜索',
  sortBy: '排序方式',
  filter: '筛选',
  allFilms: '全部电影',
  recentlyWatched: '最近观看',
  recentlyAdded: '最近添加',
  highestRated: '评分最高',
  releaseYear: '上映年份',
  rating: '我的评分',
  noResults: '没有找到符合条件的电影',
} as const

/** 添加电影五步流程。中文是主标题，英文只作为小字号辅助。 */
export const ADD_STEPS = [
  { label: '搜索电影', en: 'Find the film' },
  { label: '确认影片', en: 'Confirm' },
  { label: '记录感受', en: 'Your memory' },
  { label: 'AI 分析', en: 'Analysis' },
  { label: '加入片库', en: 'In the archive' },
] as const

/** 右侧「记录一部电影」仪式区。 */
export const RITUAL = [
  { no: '01', title: '找到电影', body: '选择你看过的影片。' },
  { no: '02', title: '写下感受', body: '记录这次观影留给你的印象。' },
  {
    no: '03',
    title: '让 AI 阅读',
    body: '分析主题、情绪，以及它与你的电影收藏之间的联系。',
  },
  {
    no: '04',
    title: '看见变化',
    body: '查看你的六维电影审美画像，以及它随着时间产生的变化。',
  },
] as const

export const BRAND_LINE_EN = 'Every film leaves a frame. Every frame tells your story.'

export const pageTitle = (label?: string): string =>
  label ? `${label} · Frame by Frame` : 'Frame by Frame — 私人电影记忆博物馆'

export const filmCount = (count: number): string => `${count} 部电影`

/** 统一的中文标点式计数，避免出现「1 films」。 */
export const countLabel = (count: number, unit = '部'): string => `${count} ${unit}`
