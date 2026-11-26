import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, MessageSquare, ThumbsDown, ThumbsUp } from 'lucide-react'
import { FilmPoster } from '@/components/film/FilmPoster'
import { SectionLabel, TextLink } from '@/components/ui/Primitives'
import { cn, formatLongDate, percent } from '@/lib/format'
import { DECISION_COPY, STAGE_COPY, rankedObservations } from '@/lib/taste/evolution'
import type {
  Film,
  ObservationDecision,
  TasteEvolutionSnapshot,
  TasteObservation,
  WatchRecord,
} from '@/types'

const stageTone: Record<TasteObservation['current_stage'], string> = {
  emerging: 'border-ink/20 text-ink/70',
  developing: 'border-ocean/35 text-ocean',
  established: 'border-brass/50 text-brass',
  evolving: 'border-ink/40 text-ink',
}

const decisions: Array<{ id: ObservationDecision; label: string; icon?: typeof ThumbsUp }> = [
  { id: 'accepted', label: '认可', icon: ThumbsUp },
  { id: 'partially_accepted', label: '部分认可' },
  { id: 'rejected', label: '不认可', icon: ThumbsDown },
  { id: 'unsure', label: '不确定' },
]

export const ObservationSection = ({
  observations,
  films,
  records,
  snapshots,
  onFeedback,
}: {
  observations: TasteObservation[]
  films: Film[]
  records: WatchRecord[]
  snapshots: TasteEvolutionSnapshot[]
  onFeedback: (observationId: string, decision: ObservationDecision, comment?: string) => void
}) => {
  const [commentFor, setCommentFor] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const ranked = rankedObservations(observations)
  const latestSnapshots = [...snapshots]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 6)

  return (
    <section className="border-t border-ink/10">
      <div className="mx-auto max-w-shell px-5 py-14 lg:px-10 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-4">
          <div>
            <SectionLabel index="02">正在形成的审美观察</SectionLabel>
            <p className="mt-4 max-w-2xl text-[15px] leading-[1.85] text-taupe">
              每一条观察都从你确认过的分析里长出来，并且必须能回到笔记中的原句。
              阶段不是按“看过几部”自动升级，而是同时看独立记录、证据质量、跨片一致性和你的反馈。
              证据会标出来源：<span className="text-ink/75">seed</span> 是内置演示分析，
              <span className="text-ink/75">deepworks</span> 才是真实 Agent 运行。
            </p>
          </div>
          <p className="text-[12.5px] tracking-[0.05em] text-taupe">
            {ranked.length} 条观察 · {snapshots.length} 个快照
          </p>
        </div>

        {ranked.length === 0 ? (
          <div className="mt-8 border border-dashed border-ink/20 px-6 py-10">
            <p className="font-zh-title text-[1.4rem] text-ink">还没有形成可回溯的观察。</p>
            <p className="mt-2 max-w-xl text-[14.5px] leading-[1.85] text-taupe">
              这通常意味着还没有已确认的分析，或者模型给的引文无法在你的原始笔记中逐字找到。
              我们不会用电影简介或猜测把这一段填满。
            </p>
          </div>
        ) : (
          <ol className="mt-2">
            {ranked.map((observation, index) => {
              const stage = STAGE_COPY[observation.current_stage]
              const evidence = [...observation.evidence].sort((a, b) => b.strength - a.strength)
              const filmsInEvidence = Array.from(new Set(evidence.map((item) => item.film_id)))
                .map((id) => films.find((film) => film.id === id))
                .filter((film): film is Film => Boolean(film))
                .slice(0, 3)
              const record = records.find(
                (item) => item.id === observation.supporting_record_ids[0],
              )
              return (
                <li key={observation.observation_id} className="border-b border-ink/10 py-8">
                  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-[12.5px] tracking-[0.16em] text-brass/70">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <h3 className="font-zh-title text-[clamp(1.35rem,2.3vw,1.85rem)] leading-[1.35] text-ink">
                          {observation.title}
                        </h3>
                        <span
                          className={cn(
                            'border px-2 py-0.5 text-[11.5px] tracking-[0.08em]',
                            stageTone[observation.current_stage],
                          )}
                        >
                          {stage.zh} · {stage.en}
                        </span>
                        {!observation.effective && (
                          <span className="border border-ink/25 px-2 py-0.5 text-[11.5px] text-taupe">
                            已被你否定，不计入画像
                          </span>
                        )}
                      </div>

                      <p className="mt-4 max-w-2xl text-[15px] leading-[1.9] text-ink/85">
                        {observation.description}
                      </p>

                      {evidence.slice(0, 2).map((item) => (
                        <div
                          key={item.evidence_id}
                          className="mt-4 border-l border-brass/40 pl-4"
                        >
                          <p className="text-[12.5px] tracking-[0.04em] text-taupe">
                            <Link
                              to={`/archive/${item.film_id}`}
                              className="underline decoration-ink/20 underline-offset-4 hover:text-ink"
                            >
                              《{item.film_title}》
                            </Link>
                            <span className="ml-2">{formatLongDate(item.created_at.slice(0, 10))}</span>
                            <span className="ml-2">
                              {item.polarity === 'contradicting' ? '反向证据' : '支持证据'}
                            </span>
                            <span className="ml-2 text-taupe/75">
                              {item.source === 'seed'
                                ? '演示分析（seed）'
                                : item.source === 'deepworks'
                                  ? 'DeepWorks Agent'
                                  : item.source}
                            </span>
                          </p>
                          <p className="mt-1.5 font-zh-body text-[1.0625rem] leading-[1.8] text-ink">
                            “{item.original_quote}”
                          </p>
                          <p className="mt-1 text-[13.5px] leading-[1.75] text-taupe">
                            AI 的解读：{item.interpretation}
                          </p>
                        </div>
                      ))}

                      <div className="mt-5 flex flex-wrap items-center gap-2">
                        {decisions.map((decision) => {
                          const Icon = decision.icon
                          const active = observation.latest_feedback?.decision === decision.id
                          return (
                            <button
                              key={decision.id}
                              type="button"
                              onClick={() => onFeedback(observation.observation_id, decision.id)}
                              className="chip h-8 gap-1.5 text-[12.5px]"
                              data-active={active}
                              aria-pressed={active}
                            >
                              {Icon && <Icon size={11} />}
                              {decision.label}
                            </button>
                          )
                        })}
                        <button
                          type="button"
                          onClick={() => {
                            setCommentFor(commentFor === observation.observation_id ? null : observation.observation_id)
                            setComment(observation.latest_feedback?.user_comment ?? '')
                          }}
                          className="chip h-8 gap-1.5 text-[12.5px]"
                        >
                          <MessageSquare size={11} /> 补充说明
                        </button>
                        <Link
                          to={`/taste/observations/${observation.observation_id}`}
                          className="ml-auto flex items-center gap-1 text-[12.5px] tracking-[0.04em] text-taupe hover:text-ink"
                        >
                          查看证据与历史 <ArrowRight size={11} />
                        </Link>
                      </div>

                      {commentFor === observation.observation_id && (
                        <div className="mt-3 border border-ink/15 bg-paper-sheet/60 p-3">
                          <label className="text-[12.5px] text-taupe" htmlFor={`obs-comment-${observation.observation_id}`}>
                            这句话会作为纠错信息保存，并影响后续判断。
                          </label>
                          <textarea
                            id={`obs-comment-${observation.observation_id}`}
                            value={comment}
                            onChange={(event) => setComment(event.target.value)}
                            rows={3}
                            className="mt-2 w-full resize-y border border-ink/15 bg-paper px-3 py-2 text-[14px] leading-[1.8] text-ink outline-none focus:border-ocean"
                            placeholder="例如：我注意的是表演，不是摄影。"
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            {decisions.map((decision) => (
                              <button
                                key={decision.id}
                                type="button"
                                onClick={() => {
                                  onFeedback(observation.observation_id, decision.id, comment)
                                  setCommentFor(null)
                                  setComment('')
                                }}
                                className="btn btn-ghost h-8 px-3 text-[12px]"
                              >
                                {DECISION_COPY[decision.id]}并保存
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <aside className="lg:border-l lg:border-ink/10 lg:pl-8">
                      <p className="text-[12px] uppercase tracking-[0.12em] text-taupe">Confidence</p>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="num text-[1.7rem] text-ink">{percent(observation.confidence)}</span>
                        <span className="text-[12px] text-taupe">
                          {observation.record_count} 部 · {observation.evidence_count} 条证据
                        </span>
                      </div>
                      <div className="mt-2 h-px w-full bg-ink/10">
                        <div
                          className="h-px bg-ocean/70"
                          style={{ width: `${Math.max(4, observation.confidence * 100)}%` }}
                        />
                      </div>
                      <dl className="mt-4 space-y-1.5 text-[12.5px] text-taupe">
                        <div className="flex justify-between gap-2">
                          <dt>支持</dt>
                          <dd className="text-ink/80">{observation.supporting_evidence_ids.length} 条</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>反向</dt>
                          <dd className="text-ink/80">{observation.contradicting_evidence_ids.length} 条</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>你的反馈</dt>
                          <dd className="text-ink/80">
                            {observation.accepted_feedback_count} 认可 ·{' '}
                            {observation.partially_accepted_feedback_count} 部分
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>最近更新</dt>
                          <dd className="text-ink/80">
                            {formatLongDate(observation.last_updated_at.slice(0, 10))}
                          </dd>
                        </div>
                      </dl>

                      {filmsInEvidence.length > 0 && (
                        <div className="mt-4 flex gap-1.5">
                          {filmsInEvidence.map((film) => (
                            <Link
                              key={film.id}
                              to={`/archive/${film.id}`}
                              className="block w-[52px] overflow-hidden rounded-[2px] ring-1 ring-ink/10 transition-transform duration-300 hover:-translate-y-1"
                              aria-label={`${film.title}，这条观察的相关电影`}
                            >
                              <span className="block aspect-[2/3]">
                                <FilmPoster film={film} showTitle={false} />
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {record?.reflection && (
                        <p className="mt-3 text-[12.5px] leading-[1.7] text-taupe">
                          原始笔记保留在观影记录里，AI 不会覆盖它。
                        </p>
                      )}
                    </aside>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.5fr_1fr] lg:gap-16">
          <div>
            <p className="artifact-label">
              <b>—</b> 变化时间线
            </p>
            <h3 className="mt-3 font-zh-title text-[1.6rem] leading-[1.4] text-ink">
              判断不是一次写死的
            </h3>
            <p className="mt-3 text-[14.5px] leading-[1.85] text-taupe">
              每次分析被确认、证据被移除、笔记被修改，或你给出反馈，都会留下一个快照。
              旧快照不会被覆盖。
            </p>
            <TextLink to="/map" className="mt-5 inline-flex">
              在地图中查看观察与电影
            </TextLink>
          </div>
          <ol className="border-t border-ink/10">
            {latestSnapshots.length === 0 && (
              <li className="border-b border-ink/10 py-5 text-[14px] text-taupe">
                还没有快照。下一次分析确认后会生成第一个。
              </li>
            )}
            {latestSnapshots.map((snapshot) => {
              const changed = snapshot.changes.filter((change) => change.kind !== 'unchanged')
              return (
                <li
                  key={snapshot.snapshot_id}
                  className="grid gap-2 border-b border-ink/10 py-4 sm:grid-cols-[120px_1fr]"
                >
                  <p className="text-[12.5px] tracking-[0.04em] text-taupe">
                    {formatLongDate(snapshot.created_at.slice(0, 10))}
                    <span className="mt-1 block">{percent(snapshot.overall_confidence)} 整体</span>
                  </p>
                  <div>
                    <p className="text-[14.5px] leading-[1.8] text-ink/85">
                      {changed.length === 0
                        ? '这次没有观察发生变化。'
                        : changed
                            .slice(0, 2)
                            .map((change) => change.reason)
                            .join(' ')}
                    </p>
                    <p className="mt-1 text-[12px] text-taupe">
                      {snapshot.record_count} 部电影 · {snapshot.observations.length} 条观察
                      {snapshot.run_id ? ` · run ${snapshot.run_id}` : ''}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
