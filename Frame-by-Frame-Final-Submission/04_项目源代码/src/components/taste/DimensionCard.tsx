import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MessageSquare, Pencil, X } from 'lucide-react'
import type { DimensionFeedback, DimensionProfile } from '@/types'
import { cn, formatLongDate, percent } from '@/lib/format'
import { PoleAxis } from './TasteRadar'
import { Rating } from '../ui/Rating'

export const DimensionCard = ({
  score,
  feedback,
  onFeedback,
  className,
}: {
  score: DimensionProfile
  feedback?: DimensionFeedback
  onFeedback: (verdict: DimensionFeedback['verdict'], correction?: string) => void
  className?: string
}) => {
  const [correcting, setCorrecting] = useState(false)
  const [text, setText] = useState('')
  const def = score.def
  const leaning = score.value < 0.5 ? def.lowZh : def.highZh
  const leanPct = Math.round((score.value < 0.5 ? 1 - score.value : score.value) * 100)
  const adjustedConfidence =
    feedback?.verdict === 'corrected' || feedback?.verdict === 'not-quite'
      ? score.confidence * 0.84
      : score.confidence
  const sufficient = score.sufficient

  return (
    <article className={cn('group border-t border-ink/10 py-7', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[12px] tracking-[0.2em] text-brass/70">{def.index}</span>
          <div>
            <h3 className="font-zh-title text-[1.8rem] leading-tight text-ink">{def.labelZh}</h3>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] tracking-[0.06em] text-taupe">
              <span className="uppercase tracking-[0.12em]">{def.label}</span>
              <span className="h-2 w-px bg-ink/15" />
              <span>
                {sufficient ? `${score.sampleCount} 部电影的证据` : '样本不足'}
              </span>
              {score.lastUpdatedAt && (
                <>
                  <span className="h-2 w-px bg-ink/15" />
                  <span>{formatLongDate(score.lastUpdatedAt.slice(0, 10))}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[12.5px] tracking-[0.06em] text-taupe">置信度</p>
          <p className="num mt-0.5 text-[1.75rem] leading-none text-ink">
            {percent(score.confidence)}
            {adjustedConfidence !== score.confidence && (
              <span className="ml-2 font-sans text-[12.5px] text-taupe">
                → {percent(adjustedConfidence)}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <PoleAxis value={score.value} low={def.lowZh} high={def.highZh} />
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <p className="copy-body text-ink/85">
              {sufficient ? (
                <>你的片库有 {leanPct}% 偏向「{leaning}」。</>
              ) : (
                <>
                  目前只有 {score.sampleCount} 部电影的可用证据，还不足以判断你偏向「{leaning}」。
                  继续记录，或确认更多 AI 分析。
                </>
              )}
              {' '}
              {def.note}
            </p>
            <span className="shrink-0 text-[12.5px] tracking-[0.06em] text-taupe">
              {!sufficient ? '不下结论' : score.strength < 0.15 ? '微弱' : score.strength < 0.4 ? '清晰' : '强烈'}
            </span>
          </div>

          {feedback ? (
            <div className="mt-4 flex items-start gap-2 border-l border-brass/40 pl-3">
              <span className="mt-[2px] text-[12.5px] tracking-[0.06em] text-brass">
                {feedback.verdict === 'agree'
                  ? '你同意了'
                  : feedback.verdict === 'not-quite'
                    ? '你提出了异议'
                    : '你做了修正'}
              </span>
              {feedback.correction && (
                <p className="text-[14.5px] leading-relaxed text-ink/80">“{feedback.correction}”</p>
              )}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onFeedback('agree')}
              className={cn(
                'chip h-8 gap-1.5 text-[13px]',
                feedback?.verdict === 'agree' && 'border-brass/40 bg-brass/10 text-brass-soft',
              )}
            >
              <Check size={11} /> 我同意
            </button>
            <button
              type="button"
              onClick={() => onFeedback('not-quite')}
              className={cn(
                'chip h-8 gap-1.5 text-[13px]',
                feedback?.verdict === 'not-quite' && 'border-ink/40 text-ink',
              )}
            >
              <X size={11} /> 不太像
            </button>
            <button
              type="button"
              onClick={() => setCorrecting((v) => !v)}
              className="chip h-8 gap-1.5 text-[13px]"
            >
              <Pencil size={10} /> 让我来纠正
            </button>
          </div>

          {correcting && (
            <div className="mt-3">
              <label className="field-label" htmlFor={`correction-${def.key}`}>
                <span>用你自己的话说</span>
                <span className="text-[12.5px] font-normal tracking-normal text-taupe">
                  只保存在本地
                </span>
              </label>
              <textarea
                id={`correction-${def.key}`}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                className="input input-boxed text-[15px] leading-[1.8]"
                placeholder={`例如：“我并不是偏爱${def.lowZh}，我只是会反复重看童年的电影。”`}
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!text.trim()}
                  onClick={() => {
                    onFeedback('corrected', text.trim())
                    setCorrecting(false)
                    setText('')
                  }}
                  className="btn btn-primary h-8 px-3 text-[12.5px]"
                >
                  保存修正
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

        <div className="border-l-0 border-ink/10 lg:border-l lg:pl-5">
          <p className="flex items-center gap-2 text-[13px] tracking-[0.05em] text-ink/70">
            <MessageSquare size={10} /> AI 给出的依据
          </p>
          <ul className="mt-3 space-y-4">
            {score.aiEvidence.map((item) => (
              <li key={`${item.recordId}-${item.dimension}`}>
                <Link
                  to={`/archive/${item.filmId}`}
                  className="group/quote block border-b border-ink/[0.07] pb-3 last:border-0"
                >
                  {item.quote && (
                    <p className="font-zh-body text-[16px] leading-[1.85] text-ink/90 transition-colors group-hover/quote:text-ink">
                      “{item.quote}”
                    </p>
                  )}
                  <p className="mt-2 text-[14.5px] leading-[1.75] text-ink/80">{item.evidence}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] tracking-[0.04em] text-taupe">
                    <span className="font-display text-[15px] tracking-[0.01em] text-brass">{item.filmTitle}</span>
                    <span>·</span>
                    <Rating value={item.rating} size={8} />
                    <span>·</span>
                    <span>判断置信度 {percent(item.confidence)}</span>
                  </p>
                </Link>
              </li>
            ))}
            {score.aiEvidence.length === 0 && (
              <li className="text-[14.5px] leading-[1.85] text-taupe">
                这个维度还没有被你确认过的证据。确认一条 AI 分析后，依据会出现在这里。
              </li>
            )}
          </ul>
        </div>
      </div>
    </article>
  )
}
