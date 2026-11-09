import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useToast } from '@/components/ui/Toast'
import { DIMENSION_MAP, MOODS, THEMES } from '@/data/taxonomy'
import { cn, formatLongDate, percent } from '@/lib/format'
import { filmById } from '@/lib/tasteEngine'
import { aiErrorMessage, analyzeFilmMemory, isAiConfigured } from '@/lib/ai/client'
import { buildAnalysisHistory, filmMetaForAi } from '@/lib/ai/history'
import { moodsOfAnalysis, themesOfAnalysis, toFilmAnalysis } from '@/lib/ai/adapter'
import type { Film, TasteDirection, WatchRecord } from '@/types'

const directionLabel = (direction: TasteDirection, key: keyof typeof DIMENSION_MAP): string => {
  const def = DIMENSION_MAP[key]
  if (direction === 'high') return def.highZh
  if (direction === 'low') return def.lowZh
  return '没有明确方向'
}

const verdictCopy = {
  unreviewed: {
    label: '待确认',
    detail: '这次分析还没有计入长期画像。',
    tone: 'border-brass/40 bg-brass/[0.08] text-brass-soft',
  },
  accepted: {
    label: '已纳入长期画像',
    detail: '你接受的分析证据会计入六维画像。',
    tone: 'border-emerald-700/30 bg-emerald-700/[0.06] text-emerald-800',
  },
  edited: {
    label: '已修改并纳入画像',
    detail: '你保留或移除了部分判断，画像会按你的选择计算。',
    tone: 'border-emerald-700/30 bg-emerald-700/[0.06] text-emerald-800',
  },
  rejected: {
    label: '已拒绝 · 不计入画像',
    detail: '这次分析不会影响六维画像，但原始记录仍然保留。',
    tone: 'border-ink/20 bg-ink/[0.04] text-ink/60',
  },
} as const

export const FilmAnalysisPanel = ({ film, record }: { film: Film; record: WatchRecord }) => {
  const {
    films,
    records,
    state,
    upsertRecord,
    saveAnalysis,
    reviewAnalysis,
    setContributionStatus,
    deleteAnalysis,
    setAiConsent,
    addCorrection,
  } = useAppStore()
  const { push } = useToast()
  const analysis = state.analyses.find((item) => item.recordId === record.id)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [correcting, setCorrecting] = useState(false)
  const [correction, setCorrection] = useState(analysis?.review.note ?? '')

  const consent = state.settings.allowAiNotes

  const run = async () => {
    setError(null)
    setNotice(null)

    if (!isAiConfigured()) {
      setNotice('还没有连接到 AI 服务。请先配置 VITE_AI_API_BASE，或启动本地 server。')
      return
    }
    if (!consent) {
      setNotice('请先勾选授权，AI 才能读取这次笔记。')
      return
    }

    setRunning(true)
    try {
      const response = await analyzeFilmMemory({
        film: filmMetaForAi(film),
        rating: record.rating,
        watchedAt: record.watchedAt,
        ...(record.feltLike ? { feltLike: record.feltLike } : {}),
        note: record.reflection.trim(),
        history: buildAnalysisHistory(
          records.filter((item) => item.id !== record.id),
          films,
          film,
        ),
        locale: 'zh-CN',
      })
      const now = new Date().toISOString()
      const next = toFilmAnalysis(response, record.id, film.id, now)
      upsertRecord(
        {
          ...record,
          themes: themesOfAnalysis(next),
          moods: moodsOfAnalysis(next),
          updatedAt: now,
          ai: {
            summary: next.summary,
            extractedFrom: 'backend',
            confidence: next.confidence,
            status: 'complete',
            model: next.model.model,
            promptVersion: next.model.promptVersion,
            analysedAt: next.model.analyzedAt,
          },
        },
        record.id,
      )
      saveAnalysis(next)
      push('分析完成。它还没有计入画像，等待你的确认。', 'success')
    } catch (cause) {
      // Keep the existing analysis; never replace a model result with a local guess.
      setError(cause as Error)
      push('在线 AI 没有返回可用结果，原有分析已保留。', 'error')
    } finally {
      setRunning(false)
    }
  }

  const handleCorrection = () => {
    if (!analysis) return
    reviewAnalysis(record.id, 'edited', correction.trim() || undefined)
    if (correction.trim()) addCorrection(`film:${record.id}`, correction.trim())
    setCorrecting(false)
    push('修正已保存。这条分析会按你的选择计入画像。', 'success')
  }

  if (!analysis) {
    const configured = isAiConfigured()
    return (
      <section className="border-t border-ink/15">
        <div className="grid gap-8 py-10 lg:grid-cols-[0.42fr_1fr] lg:gap-16">
          <div>
            <p className="artifact-label">
              <b>AI</b> 观影分析
            </p>
            <h2 className="mt-4 font-zh-title text-[1.7rem] leading-tight text-ink">
              这次还没有 AI 解读
            </h2>
          </div>
          <div>
            <p className="max-w-2xl text-[14.5px] leading-[1.95] text-ink/75">
              分析会读取你写下的笔记、评分，以及少量相关旧片摘要；每条判断都会附上原文依据。
              只有你主动授权后，才会把这次记录发送给在线 AI 服务。原始笔记不会被修改，
              结论也只在你确认后计入六维画像；未连接或未授权时，不会生成任何解读。
            </p>
            {!consent && configured && (
              <label className="mt-5 flex items-start gap-2.5 border-l border-brass/40 pl-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setAiConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-[13px] leading-[1.8] text-ink/70">
                  允许把这次观影笔记发送给在线 AI 服务（可选）。只会发送这一部电影和少量相关旧片摘要。
                </span>
              </label>
            )}
            {notice && <p className="mt-4 text-[13px] leading-[1.8] text-[#8c4b3a]">{notice}</p>}
            {error && (
              <div className="mt-5 border-l border-[#b46b57] bg-[#b46b57]/[0.07] px-3 py-2">
                <p className="text-[13.5px] leading-[1.8] text-[#8c4b3a]">{aiErrorMessage(error)}</p>
              </div>
            )}
            <p className="mt-4 flex items-start gap-2 text-[12.5px] leading-[1.8] text-ink/60">
              <ShieldCheck size={12} className="mt-[3px] shrink-0" />
              {!configured
                ? '当前没有连接 AI 服务，因此不会生成解读。'
                : !consent
                  ? '只有勾选授权后，分析才会开始；笔记不会写入日志。'
                  : '笔记只会发送给已配置的 AI 服务，不会写入日志。'}
            </p>
            <button
              type="button"
              onClick={run}
              disabled={running || !configured || !consent}
              className="btn btn-primary mt-6 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {running
                ? '正在分析…'
                : !configured
                  ? 'AI 服务未连接'
                  : !consent
                    ? '先勾选授权'
                    : '开始 AI 分析'}
            </button>
          </div>
        </div>
      </section>
    )
  }

  const copy = verdictCopy[analysis.review.verdict]
  const rejected = analysis.review.verdict === 'rejected'

  return (
    <section className="border-t border-ink/15">
      <div className="py-10">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 pb-5">
          <div>
            <p className="artifact-label">
              <b>AI</b> 观影分析
            </p>
            <h2 className="mt-3 font-zh-title text-[1.7rem] leading-tight text-ink">
              {analysis.model.provider === 'seed'
                ? '示例解读 · 编辑撰写，不是模型输出'
                : analysis.model.provider === 'local-engine'
                  ? '本地引擎读到的，和你写下的'
                  : '模型读到的，和你写下的'}
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-[1.85] text-taupe">
              下面全部是分析引擎生成的解读，不是你的原文。你的笔记在上方「我的记忆」中保持原样。
              {analysis.model.provider === 'seed'
                ? '编辑示例 · 非模型输出 · 需要你确认后才计入画像'
                : analysis.model.provider === 'local-engine'
                  ? '本地规则引擎 · 未调用外部模型'
                  : `${analysis.model.provider} · ${analysis.model.model} · 提示词版本 ${analysis.model.promptVersion}`}{' '}
              · {formatLongDate(analysis.model.analyzedAt.slice(0, 10))}
            </p>
          </div>
          <span className={cn('border px-3 py-1.5 text-[12px] tracking-[0.04em]', copy.tone)}>
            {copy.label}
          </span>
        </div>

        <p className="mt-5 max-w-3xl font-zh-body text-[1.05rem] leading-[1.95] text-ink/85">
          {analysis.summary}
        </p>
        <p className="mt-2 text-[12.5px] text-taupe">{copy.detail}</p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-14">
          <div>
            <p className="text-[12px] tracking-[0.06em] text-ink/55">观察到的情绪</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {analysis.observed_emotions.map((item) => (
                <span key={item.mood} className="tag border-ink/15 text-ink/75">
                  {MOODS[item.mood]?.zh ?? item.mood}
                </span>
              ))}
              {analysis.observed_emotions.length === 0 && (
                <span className="text-[13px] text-taupe">没有明确的情绪表达。</span>
              )}
            </div>

            <p className="mt-7 text-[12px] tracking-[0.06em] text-ink/55">主题（只算你回应过的）</p>
            <ul className="mt-3 space-y-3">
              {analysis.themes_identified.map((item) => (
                <li key={item.theme} className="border-l border-ink/15 pl-3">
                  <p className="text-[14.5px] font-medium text-ink/85">
                    {THEMES[item.theme]?.zh ?? item.theme}
                  </p>
                  <p className="mt-1 text-[13px] leading-[1.8] text-ink/60">{item.evidence}</p>
                </li>
              ))}
              {analysis.themes_identified.length === 0 && (
                <li className="text-[13px] text-taupe">这次笔记没有指向明确主题。</li>
              )}
            </ul>

            {(analysis.liked.length > 0 || analysis.disliked.length > 0) && (
              <div className="mt-7 grid gap-5 sm:grid-cols-2">
                {analysis.liked.length > 0 && (
                  <div>
                    <p className="text-[12px] tracking-[0.06em] text-ink/55">你喜欢的</p>
                    <ul className="mt-2 space-y-1.5 text-[13.5px] leading-[1.8] text-ink/75">
                      {analysis.liked.map((item) => (
                        <li key={item}>· {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.disliked.length > 0 && (
                  <div>
                    <p className="text-[12px] tracking-[0.06em] text-ink/55">你不喜欢的</p>
                    <ul className="mt-2 space-y-1.5 text-[13.5px] leading-[1.8] text-ink/75">
                      {analysis.disliked.map((item) => (
                        <li key={item}>· {item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-[12px] tracking-[0.06em] text-ink/55">偏好证据</p>
            <ul className="mt-3 space-y-4">
              {analysis.preference_evidence.map((contribution, index) => {
                const def = DIMENSION_MAP[contribution.dimension_id]
                const removed = contribution.userStatus === 'removed'
                return (
                  <li
                    key={`${contribution.dimension_id}-${index}`}
                    className={cn('border-l pl-3', removed ? 'border-ink/10 opacity-50' : 'border-brass/40')}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-[13.5px] font-medium text-ink/85">
                        {def.labelZh} · {directionLabel(contribution.direction, contribution.dimension_id)}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setContributionStatus(
                            record.id,
                            contribution.dimension_id,
                            removed ? 'kept' : 'removed',
                          )
                        }
                        className="text-[11.5px] tracking-[0.04em] text-taupe underline decoration-ink/20 underline-offset-2 hover:text-ink"
                      >
                        {removed ? '恢复这条判断' : '这条不像我'}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-[1.85] text-ink/75">{contribution.evidence}</p>
                    {contribution.quote && (
                      <p className="mt-1.5 font-zh-body text-[13px] leading-[1.8] text-taupe">
                        “{contribution.quote}”
                      </p>
                    )}
                    <p className="mt-1.5 flex flex-wrap gap-3 font-mono text-[11px] text-taupe">
                      <span>强度 {Math.round(contribution.strength * 100)}%</span>
                      <span>置信度 {percent(contribution.confidence)}</span>
                      {removed && <span>已从画像移除</span>}
                    </p>
                  </li>
                )
              })}
            </ul>

            {analysis.uncertainties.length > 0 && (
              <div className="mt-6 border-t border-ink/10 pt-4">
                <p className="text-[12px] tracking-[0.06em] text-ink/55">AI 不确定的地方</p>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-[1.8] text-ink/65">
                  {analysis.uncertainties.map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {(analysis.narrative_observations.length > 0 ||
          analysis.character_observations.length > 0 ||
          analysis.visual_observations.length > 0) && (
          <div className="mt-8 grid gap-6 border-t border-ink/10 pt-6 sm:grid-cols-3">
            {[
              ['叙事', analysis.narrative_observations],
              ['人物', analysis.character_observations],
              ['视听', analysis.visual_observations],
            ].map(([label, items]) => (
              <div key={label as string}>
                <p className="text-[12px] tracking-[0.06em] text-ink/55">{label as string}</p>
                <ul className="mt-2 space-y-1.5 text-[13px] leading-[1.8] text-ink/70">
                  {(items as string[]).map((item) => (
                    <li key={item}>· {item}</li>
                  ))}
                  {(items as string[]).length === 0 && <li className="text-taupe">这次没有明确反应。</li>}
                </ul>
              </div>
            ))}
          </div>
        )}

        {analysis.related_films.length > 0 && (
          <div className="mt-8 border-t border-ink/10 pt-5">
            <p className="text-[12px] tracking-[0.06em] text-ink/55">在这座片库里的关联</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {analysis.related_films.map((item) => {
                const related = filmById(films, item.filmId)
                if (!related) return null
                return (
                  <li key={item.filmId}>
                    <Link to={`/archive/${related.id}`} className="group block border-l border-ink/15 pl-3">
                      <p className="text-[14px] text-ink/85 group-hover:underline">{related.title}</p>
                      <p className="mt-1 text-[13px] leading-[1.8] text-taupe">{item.explanation}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {!consent && isAiConfigured() && (
          <label className="mt-6 flex items-start gap-2.5 border-l border-brass/40 pl-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setAiConsent(event.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span className="text-[13px] leading-[1.8] text-ink/70">
              允许把这次观影笔记发送给在线 AI 服务。勾选后才能重新分析。
            </span>
          </label>
        )}
        <div className="mt-9 flex flex-wrap items-center gap-2 border-t border-ink/10 pt-5">
          {analysis.review.verdict !== 'accepted' && analysis.review.verdict !== 'edited' && (
            <button
              type="button"
              onClick={() => {
                reviewAnalysis(record.id, 'accepted')
                push('已接受。这次分析的证据已计入画像。', 'success')
              }}
              className="btn btn-primary"
            >
              <Check size={13} /> 接受并纳入画像
            </button>
          )}
          {analysis.review.verdict !== 'rejected' && (
            <button
              type="button"
              onClick={() => {
                reviewAnalysis(record.id, 'rejected')
                push('已拒绝这次分析，它不会再计入画像。', 'success')
              }}
              className="btn btn-ghost"
            >
              <X size={13} /> 拒绝这次分析
            </button>
          )}
          {rejected && (
            <button
              type="button"
              onClick={() => {
                reviewAnalysis(record.id, 'accepted')
                push('已重新接受这次分析。', 'success')
              }}
              className="btn btn-ghost"
            >
              <ShieldCheck size={13} /> 重新接受
            </button>
          )}
          <button type="button" onClick={() => setCorrecting((value) => !value)} className="btn btn-quiet">
            补充我的解释
          </button>
          <button
            type="button"
            onClick={run}
            disabled={running || !consent || !isAiConfigured()}
            className="btn btn-quiet disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} 重新分析
          </button>
          <button
            type="button"
            onClick={() => {
              deleteAnalysis(record.id)
              push('AI 分析已删除，原始观影记录仍然保留。', 'success')
            }}
            className="btn btn-quiet ml-auto"
          >
            <Trash2 size={13} /> 删除分析
          </button>
        </div>

        {notice && <p className="mt-4 text-[13px] leading-[1.8] text-[#8c4b3a]">{notice}</p>}
        {error && (
          <div className="mt-4 border-l border-[#b46b57] bg-[#b46b57]/[0.07] px-3 py-2">
            <p className="text-[13.5px] leading-[1.8] text-[#8c4b3a]">{aiErrorMessage(error)}</p>
          </div>
        )}

        {correcting && (
          <div className="mt-4">
            <label className="field-label" htmlFor="film-correction">
              <span>用你自己的话补充或纠正</span>
              <span className="text-[12px] font-normal tracking-normal text-taupe">
                会保存在本地，并在画像中降低被纠正判断的权重
              </span>
            </label>
            <textarea
              id="film-correction"
              value={correction}
              onChange={(event) => setCorrection(event.target.value)}
              rows={3}
              className="input input-boxed text-[14.5px] leading-[1.8]"
              placeholder="例如：“我喜欢它不是因为怀旧，而是因为它允许人物不和解。”"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCorrection}
                disabled={!correction.trim()}
                className="btn btn-primary h-8 px-3 text-[12.5px]"
              >
                保存修改
              </button>
              <button
                type="button"
                onClick={() => setCorrecting(false)}
                className="btn btn-quiet h-8 text-[12.5px]"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
