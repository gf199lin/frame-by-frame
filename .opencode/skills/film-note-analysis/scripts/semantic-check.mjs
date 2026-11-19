/**
 * Conservative semantic status for a viewing note.
 *
 * Statuses:
 * - relevant: film-related AND a recognizable viewing experience/emotion/aesthetic judgement
 * - narrative_only: mostly plot recap, without enough personal experience or aesthetic judgement
 * - unrelated: clearly not about a film / viewing experience
 * - uncertain: cannot be judged reliably (default)
 *
 * This is deliberately conservative. Missing film jargon is NOT evidence of
 * invalidity: first-person + emotional/body reaction is enough for relevant.
 */

const FILM_TERMS = [
  '电影', '片子', '影片', '镜头', '画面', '台词', '配乐', '声音', '表演', '导演',
  '剧情', '角色', '人物', '结局', '结尾', '叙事', '剪辑', '节奏', '类型', '故事',
  '桥段', '场面', '长镜头', '特写', '光影', '色彩', '运镜', '转场', '对白', '旁白',
]

const EXPERIENCE_TERMS = [
  '喜欢', '不喜欢', '难受', '感动', '闷', '哭', '笑', '紧张', '温暖', '孤独',
  '害怕', '震撼', '舒服', '无聊', '心疼', '说不出话', '坐不住', '心跳', '鸡皮疙瘩',
  '上头', '后劲', '戳', '共情', '代入', '出戏', '好看', '难看', '精彩', '平淡',
  '动人', '压抑', '治愈', '意难平', '回味', '打动', '感染', '沉浸', '走神', '困',
  '美', '漂亮', '克制', '含蓄', '自然', '做作', '用力', '高级', '俗套', '惊喜', '失望',
]

const FIRST_PERSON = ['我', '自己', '让我', '令我', '我觉得', '我感觉', '对我来说', '看得我']

const BODY_REACTION = [
  '说不出话', '坐不住', '心跳', '鸡皮疙瘩', '喘不过气', '屏住呼吸', '眼眶',
  '鼻子一酸', '后背发凉', '手心出汗', '笑出声', '哭出来',
]

const PLOT_TERMS = [
  '相遇', '离开', '分手', '死亡', '发生', '决定', '寻找', '回到', '开始', '结束',
  '最后', '后来', '然后', '他们', '主角', '男主', '女主', '父亲', '母亲', '儿子',
  '女儿', '朋友', '恋人', '男孩', '女孩', '丈夫', '妻子', '一家人', '警察', '杀手',
]

const DAILY_TERMS = [
  '天气', '超市', '牛奶', '面包', '上班', '下班', '吃饭', '买菜', '作业', '考试',
  '地铁', '公交', '快递', '手机', '同事', '工资', '房租', '做饭', '洗衣服', '堵车',
]

const countHits = (text, terms) => terms.filter((t) => text.includes(t))

export function checkSemantic({ note = '', film = {} } = {}) {
  const text = String(note ?? '').trim()
  const filmHits = countHits(text, FILM_TERMS)
  const expHits = countHits(text, EXPERIENCE_TERMS)
  const firstHits = countHits(text, FIRST_PERSON)
  const bodyHits = countHits(text, BODY_REACTION)
  const plotHits = countHits(text, PLOT_TERMS)
  const dailyHits = countHits(text, DAILY_TERMS)

  const title = String(film?.titleZh ?? film?.title ?? '').trim()
  const titleHit = title && title.length >= 2 && text.includes(title)

  const signals = {
    film_terms: filmHits,
    experience_terms: expHits,
    first_person: firstHits,
    body_reaction: bodyHits,
    plot_terms: plotHits,
    daily_terms: dailyHits,
    title_hit: Boolean(titleHit),
  }

  const reasons = []
  const hasExperience = expHits.length > 0
  const hasPersonal = firstHits.length > 0 || bodyHits.length > 0
  const hasFilm = filmHits.length > 0 || Boolean(titleHit)

  if (text.length < 6) {
    reasons.push('note_too_short')
    return { status: 'uncertain', reasons, signals }
  }

  // relevant: personal experience, even without any film jargon.
  if (hasExperience && hasPersonal) {
    reasons.push('personal_experience_with_emotion')
    return { status: 'relevant', reasons, signals }
  }
  if (bodyHits.length > 0 && hasPersonal) {
    reasons.push('personal_body_reaction')
    return { status: 'relevant', reasons, signals }
  }
  if (hasFilm && (hasExperience || hasPersonal)) {
    reasons.push('film_signal_with_experience')
    return { status: 'relevant', reasons, signals }
  }

  // unrelated: clearly daily-life text with no film/experience/plot signal.
  if (dailyHits.length >= 2 && !hasFilm && !hasExperience && plotHits.length === 0) {
    reasons.push('daily_life_only')
    return { status: 'unrelated', reasons, signals }
  }

  // narrative_only: plot recap dominates, no personal experience/judgement.
  if (plotHits.length >= 2 && !hasExperience && !hasPersonal && !hasFilm) {
    reasons.push('plot_recap_without_experience')
    return { status: 'narrative_only', reasons, signals }
  }

  reasons.push('insufficient_signal')
  return { status: 'uncertain', reasons, signals }
}
