import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { FilmPoster } from '@/components/film/FilmPoster'
import { EmptyState, SectionLabel } from '@/components/ui/Primitives'
import { cn, formatLongDate, percent } from '@/lib/format'
import { DECISION_COPY, STAGE_COPY, compareSnapshots } from '@/lib/taste/evolution'
import { DIMENSION_MAP } from '@/data/taxonomy'
import type { ObservationDecision, TasteEvolutionEvidence } from '@/types'

const decisions: Array<{ id: ObservationDecision; label: string; icon?: typeof ThumbsUp }> = [
  { id: 'accepted', label: '我认可', icon: ThumbsUp },
  { id: 'partially_accepted', label: '部分认可' },
  { id: 'rejected', label: '我不认可', icon: ThumbsDown },
  { id: 'unsure', label: '暂时不确定' },
]

const EvidenceBlock = ({
  item,
  filmId,
}: {
  item: TasteEvolutionEvidence
  filmId: string
}) => (
  <li className="border-b border-ink/10 py-5">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-[13px] tracking-[0.04em] text-taupe">
        <Link
          to={`/archive/${filmId}`}
          className="text-ink/80 underline decoration-ink/20 underline-offset-4 hover:text-ink"
        >
          《{item.film_title}》
        </Link>
        <span className="ml-2">{item.film_year}</span>
        <span className="ml-2">{formatLongDate(item.created_at.slice(0, 10))}</span>
      </p>
      <p className="text-[12px] text-taupe">
        {item.source === 'seed'
          ? '内置演示分析（seed）'
          : item.source === 'deepworks'
            ? 'DeepWorks Agent'
            : item.source}
        {item.run_id ? ` · run ${item.run_id}` : ''}
      </p>
    </div>
    <blockquote className="mt-2 border-l border-brass/50 pl-4 font-zh-body text-[1.125rem] leading-[1.85] text-ink">
      “{item.original_quote}”
    </blockquote>
    <p className="mt-2 text-[13.5px] leading-[1.8] text-taupe">
      AI 的解读：{item.interpretation}
    </p>
    <div className="mt-3 flex items-center gap-3">
      <div className="h-px w-32 bg-ink/10">
        <div
          className="h-px bg-ocean/70"
          style={{ width: `${Math.max(4, item.strength * 100)}%` }}
        />
      </div>
      <p className="text-[12px] text-taupe">证据强度 {percent(item.strength)}</p>
    </div>
  </li>
)

export const ObservationDetail = () => {
  const { observationId = '' } = useParams()
  const { observations, films, state, setObservationFeedback } = useAppStore()
  const [comment, setComment] = useState('')

  const observation = observations.find((item) => item.observation_id === observationId)

  if (!observation) {
    return (
      <div className="mx-auto max-w-shell px-5 py-20 lg:px-10">
        <p className="micro text-brass/80">审美观察</p>
        <h1 className="mt-4 font-zh-title text-[clamp(2.2rem,4.6vw,4rem)] leading-tight">
          这条观察已经不在当前证据里
        </h1>
        <EmptyState
          className="mt-10"
          eyebrow="没有可展示的证据"
          title="它可能被撤回，或支撑它的记录已被删除"
          description="历史快照仍然保留在 My Taste 的时间线里。当前画像只使用仍然成立的证据。"
          action={
            <Link to="/taste" className="btn btn-primary">
              返回 My Taste
            </Link>
          }
        />
      </div>
    )
  }

  const stage = STAGE_COPY[observation.current_stage]
  const def = DIMENSION_MAP[observation.dimension]
  const supporting = observation.evidence.filter((item) => item.polarity === 'supporting')
  const contradicting = observation.evidence.filter((item) => item.polarity === 'contradicting')
  const neutral = observation.evidence.filter((item) => item.polarity === 'neutral')
  const feedback = state.observationFeedback
    .filter((item) => item.observation_id === observation.observation_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  const snapshots = [...state.tasteSnapshots].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )
  const latest = snapshots[0]
  const previous = snapshots[1]
  const beforeObs = previous?.observations.find(
    (item) => item.observation_id === observation.observation_id,
  )
  const afterObs = latest?.observations.find(
    (item) => item.observation_id === observation.observation_id,
  )
  const change =
    latest && previous
      ? compareSnapshots(previous, latest, observation.observation_id)[0]
      : latest?.changes.find((item) => item.observation_id === observation.observation_id)
  const film = films.find(
    (item) => item.id === (supporting[0] ?? observation.evidence[0])?.film_id,
  )

  return (
    <div className="shell pb-20 pt-10 lg:pt-14">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <p className="artifact-label">
          <b>04</b> 审美观察
        </p>
        <Link
          to="/taste"
          className="flex items-center gap-1 text-[12.5px] tracking-[0.05em] text-taupe hover:text-ink"
        >
          <ArrowLeft size={12} /> 返回 My Taste
        </Link>
      </div>

      <header className="grid gap-10 py-10 lg:grid-cols-[1fr_280px] lg:gap-16 lg:py-14">
        <div>
          <p className="text-[12px] uppercase tracking-[0.14em] text-taupe">
            {def.label} · {def.labelZh}
          </p>
          <h1 className="mt-3 font-zh-title text-[clamp(2.2rem,5.4vw,4.4rem)] leading-[1.15] text-ink">
            {observation.title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="border border-ink/20 px-2.5 py-1 text-[12px] tracking-[0.08em] text-ink/75">
              {stage.zh} · {stage.en}
            </span>
            <span className="text-[13px] text-taupe">置信度 {percent(observation.confidence)}</span>
            <span className="text-[13px] text-taupe">
              {observation.record_count} 部电影 · {observation.evidence_count} 条证据
            </span>
          </div>
          <p className="measure mt-6 text-[16px] leading-[1.95] text-ink/85">
            {observation.description}
          </p>
          <p className="mt-4 text-[13.5px] leading-[1.8] text-taupe">{stage.note}</p>
          {observation.unverified_evidence_count > 0 && (
            <p className="mt-4 border-l border-ink/25 pl-4 text-[13.5px] leading-[1.8] text-taupe">
              有 {observation.unverified_evidence_count} 条模型引文没有在你的笔记中逐字出现，已被排除。
            </p>
          )}
        </div>

        <aside className="border-t border-ink/10 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <p className="text-[12px] uppercase tracking-[0.12em] text-taupe">你怎么看</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {decisions.map((decision) => {
              const Icon = decision.icon
              const active = observation.latest_feedback?.decision === decision.id
              return (
                <button
                  key={decision.id}
                  type="button"
                  onClick={() => setObservationFeedback(observation.observation_id, decision.id)}
                  className="chip h-8 gap-1.5 text-[12.5px]"
                  data-active={active}
                  aria-pressed={active}
                >
                  {Icon && <Icon size={11} />}
                  {decision.label}
                </button>
              )
            })}
          </div>
          <label className="mt-4 block text-[12.5px] text-taupe" htmlFor="observation-comment">
            补充说明会作为纠错信息进入后续分析
          </label>
          <textarea
            id="observation-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            className="mt-2 w-full resize-y border border-ink/15 bg-paper px-3 py-2 text-[14px] leading-[1.8] text-ink outline-none focus:border-ocean"
            placeholder="例如：这更像是一次偶然，不是我长期关注的东西。"
          />
          <button
            type="button"
            onClick={() => {
              setObservationFeedback(
                observation.observation_id,
                observation.latest_feedback?.decision ?? 'unsure',
                comment,
              )
              setComment('')
            }}
            className="btn btn-ghost mt-2 h-8 px-3 text-[12px]"
          >
            <MessageSquare size={11} /> 保存说明
          </button>

          {film && (
            <Link
              to={`/archive/${film.id}`}
              className="mt-8 flex items-center gap-3 border-t border-ink/10 pt-5"
            >
              <span className="block w-[54px] overflow-hidden rounded-[2px] ring-1 ring-ink/10">
                <span className="block aspect-[2/3]">
                  <FilmPoster film={film} showTitle={false} />
                </span>
              </span>
              <span>
                <span className="block text-[12px] uppercase tracking-[0.1em] text-taupe">
                  First evidence
                </span>
                <span className="mt-1 block font-zh-title text-[1.1rem] text-ink">
                  《{film.title}》
                </span>
                <span className="mt-1 flex items-center gap-1 text-[12px] text-taupe">
                  查看这部电影 <ArrowRight size={10} />
                </span>
              </span>
            </Link>
          )}
        </aside>
      </header>

      <section className="border-t border-ink/10 py-12">
        <SectionLabel index="01">支持证据</SectionLabel>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-[1.85] text-taupe">
          每条引文都是原始笔记的逐字片段。下面标为“AI 的解读”的文字是模型对这段笔记的解释，
          不是你说过的话。
        </p>
        <ul className="mt-5">
          {supporting.map((item) => (
            <EvidenceBlock key={item.evidence_id} item={item} filmId={item.film_id} />
          ))}
          {supporting.length === 0 && (
            <li className="border-b border-ink/10 py-5 text-[14px] text-taupe">
              目前没有方向一致的支持证据。
            </li>
          )}
        </ul>

        {(contradicting.length > 0 || neutral.length > 0) && (
          <div className="mt-12">
            <SectionLabel index="02">反向与未定向证据</SectionLabel>
            <p className="mt-3 max-w-2xl text-[14.5px] leading-[1.85] text-taupe">
              反向证据不会被丢掉。它可能意味着判断正在变化，也可能意味着这条观察还需要更多记录。
            </p>
            <ul className="mt-5">
              {[...contradicting, ...neutral].map((item) => (
                <EvidenceBlock key={item.evidence_id} item={item} filmId={item.film_id} />
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="grid gap-12 border-t border-ink/10 py-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <SectionLabel index="03">Before / After</SectionLabel>
          {!previous || !latest ? (
            <p className="mt-4 text-[14.5px] leading-[1.85] text-taupe">
              目前只有一个快照。再经历一次分析确认、笔记修改或反馈后，这里会显示判断如何改变。
            </p>
          ) : (
            <div className="mt-5 border-t border-ink/10">
              <div className="grid gap-4 border-b border-ink/10 py-5 sm:grid-cols-2">
                <div>
                  <p className="text-[12px] uppercase tracking-[0.1em] text-taupe">Before</p>
                  <p className="mt-2 font-zh-title text-[1.15rem] leading-[1.5] text-ink/80">
                    {beforeObs ? beforeObs.title : '尚未形成'}
                  </p>
                  <p className="mt-1 text-[12.5px] text-taupe">
                    {beforeObs
                      ? `${STAGE_COPY[beforeObs.stage].zh} · ${percent(beforeObs.confidence)}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] uppercase tracking-[0.1em] text-taupe">After</p>
                  <p className="mt-2 font-zh-title text-[1.15rem] leading-[1.5] text-ink">
                    {afterObs ? afterObs.title : '已退出画像'}
                  </p>
                  <p className="mt-1 text-[12.5px] text-taupe">
                    {afterObs
                      ? `${STAGE_COPY[afterObs.stage].zh} · ${percent(afterObs.confidence)}`
                      : '—'}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[14.5px] leading-[1.9] text-ink/85">
                {change?.reason ?? '这次快照没有改变这条观察。'}
              </p>
              {latest.corrections_applied.length > 0 && (
                <div className="mt-4 border-l border-brass/40 pl-4">
                  <p className="text-[12px] uppercase tracking-[0.1em] text-taupe">
                    这次计入的修正
                  </p>
                  {latest.corrections_applied.map((item, index) => (
                    <p key={index} className="mt-1 text-[13.5px] leading-[1.75] text-ink/80">
                      {item}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <SectionLabel index="04">你的反馈历史</SectionLabel>
          {feedback.length === 0 ? (
            <p className="mt-4 text-[14.5px] leading-[1.85] text-taupe">
              你还没有对这条观察表态。反馈会作为额外信号参与后续判断，而不是只停留在按钮上。
            </p>
          ) : (
            <ol className="mt-5 border-t border-ink/10">
              {feedback.map((item) => (
                <li key={item.feedback_id} className="border-b border-ink/10 py-4">
                  <p className="text-[12.5px] text-taupe">
                    {formatLongDate(item.created_at.slice(0, 10))} · {DECISION_COPY[item.decision]}
                  </p>
                  {item.user_comment && (
                    <p className="mt-1.5 font-zh-body text-[1.0625rem] leading-[1.8] text-ink/85">
                      “{item.user_comment}”
                    </p>
                  )}
                  <p className="mt-1 text-[12px] text-taupe">
                    影响快照 {item.affected_snapshot_id}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="border-t border-ink/10 py-12">
        <SectionLabel index="05">观察的时间线</SectionLabel>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-[1.85] text-taupe">
          每一步都能回到当时的快照、证据和电影记录。阶段可以前进，也可以因为反向证据或你的反馈退回。
        </p>
        <ol className="mt-6 border-t border-ink/10">
          {[...observation.history].reverse().map((entry, index) => (
            <li
              key={`${entry.snapshot_id}-${index}`}
              className="grid gap-3 border-b border-ink/10 py-5 sm:grid-cols-[150px_1fr]"
            >
              <p className="text-[12.5px] tracking-[0.04em] text-taupe">
                {entry.snapshot_id === 'current'
                  ? '现在'
                  : formatLongDate(entry.at.slice(0, 10))}
                <span className="mt-1 block">
                  {entry.supporting_count} 支持 · {entry.contradicting_count} 反向
                </span>
              </p>
              <div>
                <p className="text-[14.5px] leading-[1.85] text-ink/85">
                  {STAGE_COPY[entry.stage].zh} · 置信度 {percent(entry.confidence)}
                </p>
                <p className="mt-1 text-[13.5px] leading-[1.75] text-taupe">{entry.reason}</p>
                {entry.snapshot_id !== 'current' && (
                  <p className="mt-1 font-mono text-[11.5px] text-taupe/80">
                    snapshot {entry.snapshot_id}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
        {observation.history.length === 1 && (
          <p className={cn('mt-4 text-[13px] text-taupe')}>
            这是第一次记录。下一次证据变化会在这里追加，而不是覆盖这一条。
          </p>
        )}
      </section>
    </div>
  )
}
