import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MessageSquare, Pencil, X } from 'lucide-react'
import type { DimensionFeedback, DimensionScore, EvidenceQuote } from '@/types'
import { cn, percent } from '@/lib/format'
import { PoleAxis } from './TasteRadar'
import { Rating } from '../ui/Rating'

export const DimensionCard = ({
  score,
  evidence,
  feedback,
  onFeedback,
  className,
}: {
  score: DimensionScore
  evidence: EvidenceQuote[]
  feedback?: DimensionFeedback
  onFeedback: (verdict: DimensionFeedback['verdict'], correction?: string) => void
  className?: string
}) => {
  const [correcting, setCorrecting] = useState(false)
  const [text, setText] = useState('')
  const def = score.def
  const leaning = score.value < 0.5 ? def.low : def.high
  const leanPct = Math.round((score.value < 0.5 ? 1 - score.value : score.value) * 100)
  const adjustedConfidence =
    feedback?.verdict === 'corrected' || feedback?.verdict === 'not-quite'
      ? score.confidence * 0.84
      : score.confidence

  return (
    <article className={cn('group border-t border-ink/10 py-7', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-[9px] tracking-[0.2em] text-brass/70">{def.index}</span>
          <div>
            <h3 className="font-display text-[1.8rem] leading-none text-ink">{def.label}</h3>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-taupe">
              <span>{def.labelZh}</span>
              <span className="h-2 w-px bg-white/20" />
              <span>{score.thin ? 'Still learning' : 'Reading established'}</span>
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-taupe">
            Confidence
          </p>
          <p className="num mt-0.5 text-[1.6rem] leading-none text-ink">
            {percent(score.confidence)}
            {adjustedConfidence !== score.confidence && (
              <span className="ml-2 font-sans text-[10px] text-taupe">
                → {percent(adjustedConfidence)}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <PoleAxis value={score.value} low={def.low} high={def.high} />
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <p className="text-[12px] leading-relaxed text-ink/65">
              Your archive leans{' '}
              <span className="text-brass-soft">{leanPct}% toward {leaning.toLowerCase()}</span>.
              {' '}
              {def.note}
            </p>
            <span className="shrink-0 font-mono text-[10px] text-taupe">
              {score.strength < 0.15 ? 'faint' : score.strength < 0.4 ? 'clear' : 'strong'}
            </span>
          </div>

          {feedback ? (
            <div className="mt-4 flex items-start gap-2 border-l border-brass/40 pl-3">
              <span className="mt-[2px] text-[9px] uppercase tracking-[0.16em] text-brass">
                {feedback.verdict === 'agree'
                  ? 'You agreed'
                  : feedback.verdict === 'not-quite'
                    ? 'You pushed back'
                    : 'You corrected this'}
              </span>
              {feedback.correction && (
                <p className="text-[11px] leading-relaxed text-ink/65">“{feedback.correction}”</p>
              )}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onFeedback('agree')}
              className={cn(
                'chip h-8 gap-1.5 text-[9px]',
                feedback?.verdict === 'agree' && 'border-brass/40 bg-brass/10 text-brass-soft',
              )}
            >
              <Check size={11} /> I agree
            </button>
            <button
              type="button"
              onClick={() => onFeedback('not-quite')}
              className={cn(
                'chip h-8 gap-1.5 text-[9px]',
                feedback?.verdict === 'not-quite' && 'border-ink/40 text-ink',
              )}
            >
              <X size={11} /> Not quite
            </button>
            <button
              type="button"
              onClick={() => setCorrecting((v) => !v)}
              className="chip h-8 gap-1.5 text-[9px]"
            >
              <Pencil size={10} /> Let me correct you
            </button>
          </div>

          {correcting && (
            <div className="mt-3">
              <label className="field-label" htmlFor={`correction-${def.key}`}>
                <span>In your words</span>
                <span className="normal-case tracking-normal text-taupe/60">
                  Stored locally, not sent anywhere
                </span>
              </label>
              <textarea
                id={`correction-${def.key}`}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={3}
                className="input input-boxed text-[12px] leading-relaxed"
                placeholder={`e.g. “I'm not drawn to ${def.low.toLowerCase()} — I just rewatch films from my childhood.”`}
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
                  className="btn btn-primary h-8 px-3 text-[9px]"
                >
                  Save correction
                </button>
                <button
                  type="button"
                  onClick={() => setCorrecting(false)}
                  className="btn btn-quiet h-8 text-[9px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-l-0 border-ink/10 lg:border-l lg:pl-5">
          <p className="flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-taupe">
            <MessageSquare size={10} /> Evidence from your notes
          </p>
          <ul className="mt-3 space-y-4">
            {evidence.map((item) => (
              <li key={item.filmId}>
                <Link
                  to={`/archive/${item.filmId}`}
                  className="group/quote block border-b border-ink/[0.07] pb-3 last:border-0"
                >
                  <p className="font-display text-[13px] italic leading-relaxed text-ink/65 transition-colors group-hover/quote:text-ink">
                    “{item.quote}”
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-taupe">
                    <span className="text-brass/80">{item.filmTitle}</span>
                    <span>·</span>
                    <Rating value={item.rating} size={8} />
                  </p>
                </Link>
              </li>
            ))}
            {evidence.length === 0 && (
              <li className="text-[11px] leading-relaxed text-taupe">
                Record a film with a written note and the evidence will appear here.
              </li>
            )}
          </ul>
        </div>
      </div>
    </article>
  )
}
