import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Clock, Plus, X } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { useToast } from '@/components/ui/Toast'
import { TasteRadar } from '@/components/taste/TasteRadar'
import { DimensionCard } from '@/components/taste/DimensionCard'
import { HowAISeesMe } from '@/components/taste/HowAISeesMe'
import { EmptyState, SectionLabel, TextLink } from '@/components/ui/Primitives'
import { DIMENSION_MAP, THEMES } from '@/data/taxonomy'
import { formatLongDate, percent } from '@/lib/format'
import { sampleStateCopy } from '@/lib/ai/tasteProfile'
import type { DimensionKey, DimensionFeedback, TasteSnapshot } from '@/types'

const scopeLabel = (scope: string): string => {
  if (scope.startsWith('dimension:')) {
    const key = scope.replace('dimension:', '') as DimensionKey
    return DIMENSION_MAP[key]?.labelZh ?? '维度修正'
  }
  if (scope.startsWith('timeline:')) {
    return scope.replace('timeline:', '第 ') + ' 部之后'
  }
  return '修正'
}

export const Taste = () => {
  const {
    records,
    films,
    snapshot,
    profile,
    timeline,
    state,
    setDimensionFeedback,
    setTimelineFeedback,
    addCorrection,
    reviewAnalysis,
  } = useAppStore()
  const { openAdd } = useAddFilm()
  const { push } = useToast()
  const [activeKey, setActiveKey] = useState<DimensionKey | null>(null)

  const radarSnapshot: TasteSnapshot = useMemo(
    () => ({
      filmCount: profile.filmCount,
      dimensionScores: profile.dimensions,
      overallConfidence: profile.overallConfidence,
      topThemes: profile.topThemes,
      topMoods: profile.topMoods,
      averageRating: profile.averageRating,
      totalMinutes: snapshot.totalMinutes,
    }),
    [profile, snapshot.totalMinutes],
  )

  if (records.length === 0) {
    return (
      <div className="mx-auto max-w-shell px-5 py-20 lg:px-10">
        <p className="micro text-brass/80">04 — 观影品味</p>
        <h1 className="mt-4 font-zh-title text-[clamp(2.2rem,4.6vw,4rem)] leading-tight">
          还没有可以读取的东西。
        </h1>
        <EmptyState
          className="mt-12"
          eyebrow="画像是空白的"
          title="没有一帧，AI 也就看不见你。"
          description="添加一部电影，写下它留给你什么。六个维度会随着你确认过的证据逐渐出现，每个维度都带着置信度和支撑它的原句。"
          action={
            <button type="button" onClick={() => openAdd()} className="btn btn-primary">
              <Plus size={14} /> 添加电影
            </button>
          }
        />
      </div>
    )
  }

  const strongest = [...profile.dimensions]
    .filter((dimension) => dimension.sufficient)
    .sort((a, b) => b.strength * (0.4 + b.confidence) - a.strength * (0.4 + a.confidence))[0]

  const pending = state.analyses.filter((analysis) => analysis.review.verdict === 'unreviewed')

  const handleDimensionFeedback = (
    key: DimensionKey,
    verdict: DimensionFeedback['verdict'],
    correction?: string,
  ) => {
    setDimensionFeedback(key, verdict, correction)
    if (correction) addCorrection(`dimension:${key}`, correction)
    push(
      verdict === 'agree'
        ? `已记下。「${DIMENSION_MAP[key].labelZh}」维持原来的解读。`
        : verdict === 'not-quite'
          ? '已记下。这个维度的置信度会相应降低。'
          : '修正已保存。这份解读现在会带上你自己的话，并降低该项置信度。',
      'success',
    )
  }

  const handleTimelineFeedback = (
    stageId: string,
    verdict: DimensionFeedback['verdict'],
    correction?: string,
  ) => {
    setTimelineFeedback(stageId, verdict, correction)
    if (correction) addCorrection(`timeline:${stageId}`, correction)
    push(verdict === 'agree' ? '已记下，对应片库阶段已确认。' : '已记下你对这个阶段的判断。', 'success')
  }

  const jumpTo = (key: DimensionKey) => {
    setActiveKey(key)
    document.getElementById(`dimension-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const feedbackCounts = Object.values(state.feedback).reduce(
    (acc, item) => {
      if (!item) return acc
      acc[item.verdict] += 1
      return acc
    },
    { agree: 0, 'not-quite': 0, corrected: 0 } as Record<DimensionFeedback['verdict'], number>,
  )

  const showRadar = profile.dimensions.filter((item) => item.sufficient).length >= 2

  return (
    <div>
      <section className="chapter--paper relative overflow-hidden">
        <div className="shell pt-10 lg:pt-14">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
            <p className="artifact-label">
              <b>04</b> 我的观影品味
            </p>
            <p className="folio">是估计，不是判决</p>
          </div>

          <div className="grid grid-cols-12 items-center gap-x-6 gap-y-12 py-12 lg:py-16">
            <div className="col-span-12 lg:col-span-7">
              <h1 className="font-zh-title text-[clamp(2.6rem,6.4vw,5.2rem)] leading-[1.1] text-ink">
                AI 眼中的我
              </h1>
              <p className="mt-3 font-display text-[clamp(1.5rem,3vw,2.5rem)] italic leading-[1.05] text-ink/75">
                a reading in progress.
              </p>
              <p className="measure mt-7 text-[15.5px] leading-[1.95] text-ink/75">
                {profile.filmCount} 部电影 · {profile.acceptedCount} 条已确认的 AI 分析 ·{' '}
                {profile.pendingCount} 条待确认。画像只使用你确认过的证据，不使用电影简介或随机数字。
              </p>

              <div className="mt-8 border-l border-brass pl-5">
                <p className="text-[12px] tracking-[0.06em] text-brass/80">
                  {profile.sampleState === 'stable' || profile.sampleState === 'forming'
                    ? '这次解读'
                    : '目前的样本状态'}
                </p>
                <p className="mt-2 max-w-xl font-zh-title text-[clamp(1.3rem,2.3vw,1.9rem)] leading-[1.5] text-ink">
                  {profile.signature}
                </p>
              </div>

              <div className="mt-6 border border-brass/25 bg-brass/[0.05] px-4 py-3">
                <p className="text-[13.5px] leading-[1.85] text-ink/75">{sampleStateCopy[profile.sampleState]}</p>
                {profile.pendingCount > 0 && (
                  <p className="mt-2 text-[12.5px] leading-[1.8] text-taupe">
                    有 {profile.pendingCount} 条分析正在等待你的确认，它们还没有计入画像。
                  </p>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => openAdd()} className="btn btn-primary">
                  <Plus size={13} /> 再添加一帧
                </button>
                <Link to="/map" className="btn btn-ghost">
                  查看证据地图 <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-5">
              <div className="relative mx-auto w-full max-w-[460px]">
                {showRadar ? (
                  <TasteRadar
                    snapshot={radarSnapshot}
                    size={440}
                    activeKey={activeKey}
                    onSelect={jumpTo}
                    tone="light"
                    className="mx-auto"
                  />
                ) : (
                  <div className="flex min-h-[320px] flex-col justify-center border border-dashed border-ink/20 px-8 py-10 text-center">
                    <p className="font-zh-title text-[1.35rem] leading-[1.5] text-ink">
                      还没有可以画出的形状。
                    </p>
                    <p className="mt-3 text-[13.5px] leading-[1.9] text-taupe">
                      雷达图只显示你确认过的 AI 证据。没有证据时，我们不会用虚构数字把它填满。
                    </p>
                    {pending.length > 0 && (
                      <p className="mt-4 text-[13px] text-ink/70">
                        下面有 {pending.length} 条分析等待你确认。
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-4 grid w-full grid-cols-3 divide-x divide-ink/10 border-t border-ink/10 pt-3 text-center">
                  <div>
                    <p className="num text-[1.35rem] text-ink">{percent(profile.overallConfidence)}</p>
                    <p className="mt-1 text-[12.5px] tracking-[0.04em] text-taupe">整体置信度</p>
                  </div>
                  <div>
                    <p className="num text-[1.35rem] text-ink">{profile.acceptedCount}</p>
                    <p className="mt-1 text-[12.5px] tracking-[0.04em] text-taupe">已确认分析</p>
                  </div>
                  <div>
                    <p className="num text-[1.35rem] text-ink">{profile.filmCount}</p>
                    <p className="mt-1 text-[12.5px] tracking-[0.04em] text-taupe">已读电影</p>
                  </div>
                </div>
                {profile.updatedAt && (
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] text-taupe">
                    <Clock size={10} /> 最近更新 {formatLongDate(profile.updatedAt.slice(0, 10))}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-shell px-5 py-12 lg:px-10 lg:py-16">
        <div className="grid gap-8 border-y border-ink/10 py-8 sm:grid-cols-[1fr_1fr] sm:gap-16">
          <div>
            <p className="artifact-label">
              <b>—</b> 这是什么
            </p>
            <p className="mt-3 text-[14.5px] leading-[1.9] text-ink/75">
              一份来自你的评分与笔记、再由你确认的片库解读。六条轴线来自你在笔记里表达过的反应；每一个判断都能回到某句话、某个评分，
              或者被明确标为不确定。置信度反映的是证据有多少，而不是 AI 有多正确。
            </p>
          </div>
          <div className="sm:border-l sm:border-ink/10 sm:pl-16">
            <p className="artifact-label">
              <b>—</b> 这不是什么
            </p>
            <p className="mt-3 text-[14.5px] leading-[1.9] text-ink/75">
              不是人格测试，不是审美排名，也不是替你定义感受的系统。「不太像」和修正都会被保存，并降低被质疑那部分解读的置信度；
              拒绝的分析不会再计入画像，而你的原始笔记永远不会被 AI 覆盖。
            </p>
          </div>
        </div>

        {profile.summary.length > 0 && (
          <div className="mt-12 grid gap-8 lg:grid-cols-[0.55fr_1fr] lg:gap-16">
            <div>
              <p className="artifact-label">
                <b>—</b> 用一段话说
              </p>
              <p className="mt-4 font-zh-title text-[1.45rem] leading-[1.5] text-ink">
                {strongest ? `最强的信号是${strongest.def.labelZh}。` : '目前还没有足够稳定的信号。'}
              </p>
              <p className="mt-2 text-[13px] leading-[1.85] text-taupe">
                {strongest
                  ? `${strongest.def.label} · ${percent(
                      strongest.value < 0.5 ? 1 - strongest.value : strongest.value,
                    )} 偏向「${strongest.value < 0.5 ? strongest.def.lowZh : strongest.def.highZh}」 · ${strongest.sampleCount} 部电影`
                  : '需要至少 3 部电影、且证据方向相对一致，才会给出方向。'}
              </p>
            </div>
            <div className="space-y-3 border-l border-ink/10 pl-6 sm:pl-8">
              {profile.summary.map((sentence, i) => (
                <p key={i} className="text-[15px] leading-[1.95] text-ink/75">
                  {sentence}
                </p>
              ))}
            </div>
          </div>
        )}
      </section>

      {pending.length > 0 && (
        <section className="border-t border-ink/10">
          <div className="mx-auto max-w-shell px-5 py-12 lg:px-10">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-4">
              <div>
                <SectionLabel index="00">待你确认</SectionLabel>
                <p className="mt-3 max-w-2xl text-[14px] leading-[1.9] text-taupe">
                  这些分析还没有计入画像。你可以直接接受，也可以打开电影详情逐条修改或拒绝。
                </p>
              </div>
              <p className="text-[12.5px] text-taupe">{pending.length} 条</p>
            </div>
            <ul className="mt-2">
              {pending.map((analysis) => {
                const film = films.find((item) => item.id === analysis.filmId)
                return (
                  <li
                    key={analysis.recordId}
                    className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/10 py-5"
                  >
                    <div className="max-w-2xl">
                      <p className="font-zh-title text-[1.2rem] text-ink">
                        {film ? `《${film.title}》` : '一部电影'}
                        <span className="ml-2 text-[12.5px] tracking-[0.06em] text-taupe">
                          {analysis.model.model} · {formatLongDate(analysis.model.analyzedAt.slice(0, 10))}
                        </span>
                      </p>
                      <p className="mt-1.5 text-[13.5px] leading-[1.85] text-ink/70">
                        {analysis.summary}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          reviewAnalysis(analysis.recordId, 'accepted')
                          push('已接受这次分析，证据已计入画像。', 'success')
                        }}
                        className="chip h-8 gap-1.5 text-[12.5px]"
                      >
                        <Check size={11} /> 接受
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          reviewAnalysis(analysis.recordId, 'rejected')
                          push('已拒绝这次分析，它不会计入画像。', 'success')
                        }}
                        className="chip h-8 gap-1.5 text-[12.5px]"
                      >
                        <X size={11} /> 拒绝
                      </button>
                      <Link to={`/archive/${analysis.filmId}`} className="chip h-8 gap-1.5 text-[12.5px]">
                        查看 <ArrowRight size={11} />
                      </Link>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      <section className="border-t border-ink/10">
        <div className="mx-auto max-w-shell px-5 py-14 lg:px-10 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel index="01">六个维度</SectionLabel>
              <p className="mt-4 max-w-xl text-[14px] leading-[1.9] text-taupe">
                每条轴线从一端延伸到另一端。标记是你确认过的证据给出的位置，数字是置信度。样本不足时，这里会直接说明，而不是给出一个看起来确定的数字。
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12px] tracking-[0.06em] text-taupe">你给出的判断</p>
              <p className="mt-1 text-[14px] text-ink/75">
                {feedbackCounts.agree} 次同意 · {feedbackCounts['not-quite']} 次不太像 ·{' '}
                {feedbackCounts.corrected} 次修正
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-x-14 lg:grid-cols-2">
            {profile.dimensions.map((score) => (
              <div key={score.key} id={`dimension-${score.key}`}>
                <DimensionCard
                  score={score}
                  feedback={state.feedback[score.key]}
                  onFeedback={(verdict, correction) =>
                    handleDimensionFeedback(score.key, verdict, correction)
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {profile.topThemes.length > 0 && (
        <section className="chapter--paper border-y border-ink/10">
          <div className="mx-auto max-w-shell px-5 py-16 lg:px-10 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-4">
              <div>
                <p className="artifact-label">
                  <b>02</b> 主题复现
                </p>
                <h2 className="mt-4 t-head">你反复回到的地方。</h2>
                <p className="mt-3 max-w-xl text-[13.5px] leading-[1.85] text-taupe">
                  只统计已确认分析中被你回应过的主题，不统计电影本身的题材标签。
                </p>
              </div>
              <TextLink to="/map">在地图中追踪它们</TextLink>
            </div>

            <div className="mt-4 grid gap-x-16 lg:grid-cols-2">
              {profile.topThemes.map((theme, i) => (
                <div key={theme.id} className="group border-b border-ink/10 py-6">
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="flex items-baseline gap-4">
                      <span className="font-mono text-[12px] tracking-[0.2em] text-brass/70">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <p className="font-zh-title text-[clamp(1.35rem,2.2vw,1.9rem)] leading-none text-ink">
                        {THEMES[theme.id]?.zh ?? theme.id}
                      </p>
                      <span className="text-[12px] uppercase tracking-[0.1em] text-taupe">
                        {THEMES[theme.id]?.label ?? theme.id}
                      </span>
                    </div>
                    <span className="font-mono text-[12px] text-taupe">
                      {String(theme.count).padStart(2, '0')} 部
                    </span>
                  </div>
                  <div className="bar-track mt-4">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.max(12, theme.weight * 100)}%`, opacity: 1 - i * 0.08 }}
                    />
                  </div>
                  <p className="mt-2.5 text-[13px] leading-[1.85] text-taupe">
                    {THEMES[theme.id]?.blurbZh ?? ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {state.profileHistory.length > 0 && (
        <section className="mx-auto max-w-shell px-5 py-14 lg:px-10 lg:py-20">
          <SectionLabel index="03">画像为什么变化</SectionLabel>
          <p className="mt-4 max-w-2xl text-[14px] leading-[1.9] text-taupe">
            每一次接受、修改或拒绝都会留下记录。变化不是悄悄发生的，也不需要你相信一个黑箱。
          </p>
          <ol className="mt-8 border-t border-ink/10">
            {state.profileHistory.slice(0, 8).map((event) => (
              <li key={event.id} className="grid gap-3 border-b border-ink/10 py-5 sm:grid-cols-[140px_1fr]">
                <p className="text-[12px] tracking-[0.05em] text-taupe">
                  {formatLongDate(event.at.slice(0, 10))}
                  <span className="mt-1 block text-[12.5px] text-taupe/70">
                    {event.acceptedCount} 条已确认
                  </span>
                </p>
                <div>
                  <p className="text-[14px] leading-[1.85] text-ink/80">{event.reason}</p>
                  {event.changes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {event.changes.slice(0, 6).map((change) => (
                        <span key={change.dimension} className="tag border-ink/15 text-[12.5px] text-ink/70">
                          {DIMENSION_MAP[change.dimension].labelZh}{' '}
                          {change.after >= change.before ? '+' : ''}
                          {Math.round((change.after - change.before) * 100)} pts
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="mx-auto max-w-shell px-5 py-16 lg:px-10 lg:py-24">
        <SectionLabel index="04">片库时间线（本地计算）</SectionLabel>
        <div className="mt-6 grid gap-10 lg:grid-cols-[0.62fr_1fr] lg:gap-16">
          <div>
            <h2 className="font-zh-title text-[clamp(2rem,4vw,3.4rem)] leading-[1.2]">
              一条会
              <br />
              <span className="text-brass-soft">随着片库生长的线索。</span>
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-[1.95] text-ink/75">
              下面这条时间线由本地规则按片库规模计算，与 AI 六维画像相互独立。它记录的是记录数量的变化，不是 AI 对你下的结论。
            </p>
            <div className="mt-8 border-t border-ink/10 pt-5">
              <p className="text-[12px] tracking-[0.06em] text-taupe">最新阶段</p>
              <p className="mt-2 text-[14px] text-ink/75">
                {timeline[0]
                  ? `${timeline[0].filmCount} 部电影 · ${formatLongDate(timeline[0].at)} · 置信度 ${percent(
                      timeline[0].confidence,
                    )}`
                  : '—'}
              </p>
            </div>
          </div>

          <HowAISeesMe
            stages={timeline}
            feedback={state.timelineFeedback}
            onFeedback={handleTimelineFeedback}
          />
        </div>
      </section>

      {state.corrections.length > 0 && (
        <section className="border-t border-ink/10">
          <div className="mx-auto max-w-shell px-5 py-12 lg:px-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="micro text-brass/80">你的修正</p>
                <p className="mt-2 text-[14px] leading-[1.8] text-taupe">
                  只保存在本地。这些话应当比模型的解读更有分量。
                </p>
              </div>
              <p className="text-[12.5px] text-taupe">已保存 {state.corrections.length} 条</p>
            </div>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {state.corrections.slice(0, 6).map((correction) => (
                <li key={correction.id} className="border-l border-brass/40 pl-4">
                  <p className="text-[12px] tracking-[0.06em] text-taupe">
                    {scopeLabel(correction.scope)}
                  </p>
                  <p className="mt-1.5 font-zh-body text-[1rem] leading-[1.8] text-ink/75">
                    “{correction.text}”
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
