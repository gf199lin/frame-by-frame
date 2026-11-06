import { useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import type { TimelineFeedbackMap, TimelineStage } from '@/types'
import { formatShortDate } from '@/lib/format'
import { THEMES } from '@/data/taxonomy'
import { cn } from '@/lib/format'

export const HowAISeesMe = ({
  stages,
  feedback,
  onFeedback,
}: {
  stages: TimelineStage[]
  feedback: TimelineFeedbackMap
  onFeedback: (stageId: string, verdict: 'agree' | 'not-quite' | 'corrected', correction?: string) => void
}) => {
  const [editing, setEditing] = useState<string | null>(null)
  const [text, setText] = useState('')
  const ordered = [...stages].sort((a, b) => a.filmCount - b.filmCount)
  const latest = ordered[ordered.length - 1]

  return (
    <div className="relative">
      <div className="absolute bottom-0 left-[27px] top-2 w-px bg-white/10 sm:left-[35px]" aria-hidden="true" />

      <ol className="space-y-0">
        {ordered.map((stage) => {
          const state = feedback[stage.id]
          const isLatest = latest?.id === stage.id
          return (
            <li key={stage.id} className="relative grid grid-cols-[56px_1fr] gap-4 pb-9 sm:grid-cols-[72px_1fr] sm:gap-6">
              <div className="relative flex justify-start">
                <span
                  className={cn(
                    'relative z-10 flex h-[56px] w-[56px] items-center justify-center border bg-ink/[0.04] transition-colors sm:h-[72px] sm:w-[72px]',
                    isLatest ? 'border-brass/60' : 'border-ink/15',
                  )}
                >
                  <span className="text-center">
                    <span className="block font-display text-xl leading-none text-ink sm:text-2xl">
                      {String(stage.filmCount).padStart(2, '0')}
                    </span>
                    <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-taupe">
                      films
                    </span>
                  </span>
                </span>
              </div>

              <div className={cn('border-t pt-5', isLatest ? 'border-brass/30' : 'border-ink/10')}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="micro-sm text-brass/80">
                    {stage.filmCount === 1 ? 'After 1 film' : `After ${stage.filmCount} films`}
                  </p>
                  <p className="font-mono text-[12px] tracking-[0.14em] text-taupe">
                    {formatShortDate(stage.at)} · confidence {Math.round(stage.confidence * 100)}%
                  </p>
                </div>
                <h4 className="mt-2 font-display text-xl leading-snug text-ink sm:text-2xl">
                  {stage.headline}
                </h4>
                <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink/75">
                  {stage.body}
                </p>
                {stage.topTheme && (
                  <p className="mt-2 text-[12.5px] uppercase tracking-[0.16em] text-taupe">
                    Recurring theme · <span className="text-brass/70">{THEMES[stage.topTheme].label}</span>
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {state ? (
                    <>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 border px-2.5 py-1 text-[12px] uppercase tracking-[0.14em]',
                          state.verdict === 'agree'
                            ? 'border-brass/40 bg-brass/10 text-brass-soft'
                            : 'border-ink/25 text-ink/75',
                        )}
                      >
                        {state.verdict === 'agree' ? <Check size={10} /> : <X size={10} />}
                        {state.verdict === 'agree'
                          ? 'You agreed'
                          : state.verdict === 'not-quite'
                            ? 'Not quite'
                            : 'Corrected'}
                      </span>
                      {state.correction && (
                        <span className="text-[13px] italic text-taupe">“{state.correction}”</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(editing === stage.id ? null : stage.id)
                          setText(state.correction ?? '')
                        }}
                        className="text-[12px] uppercase tracking-[0.14em] text-taupe underline underline-offset-4 hover:text-ink"
                      >
                        Revise
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onFeedback(stage.id, 'agree')}
                        className="chip h-7 gap-1 text-[12px]"
                      >
                        <Check size={10} /> I agree
                      </button>
                      <button
                        type="button"
                        onClick={() => onFeedback(stage.id, 'not-quite')}
                        className="chip h-7 gap-1 text-[12px]"
                      >
                        <X size={10} /> Not quite
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(stage.id)
                          setText('')
                        }}
                        className="chip h-7 gap-1 text-[12px]"
                      >
                        <Pencil size={9} /> Let me correct you
                      </button>
                    </>
                  )}
                </div>

                {editing === stage.id && (
                  <div className="mt-4 max-w-xl">
                    <textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      rows={2}
                      className="input input-boxed text-[14px] leading-relaxed"
                      placeholder="What did it get wrong?"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={!text.trim()}
                        onClick={() => {
                          onFeedback(stage.id, 'corrected', text.trim())
                          setEditing(null)
                          setText('')
                        }}
                        className="btn btn-primary h-8 px-3 text-[12px]"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="btn btn-quiet h-8 text-[12px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
