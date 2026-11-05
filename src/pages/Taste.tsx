import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { useToast } from '@/components/ui/Toast'
import { TasteRadar } from '@/components/taste/TasteRadar'
import { DimensionCard } from '@/components/taste/DimensionCard'
import { HowAISeesMe } from '@/components/taste/HowAISeesMe'
import { EmptyState, SectionLabel, TextLink } from '@/components/ui/Primitives'
import { DIMENSION_MAP, THEMES } from '@/data/taxonomy'
import { getEvidence, summarizeTaste, tasteSignature } from '@/lib/tasteEngine'
import { formatLongDate, percent } from '@/lib/format'
import type { DimensionKey, DimensionFeedback } from '@/types'

export const Taste = () => {
  const {
    records,
    films,
    snapshot,
    timeline,
    state,
    setDimensionFeedback,
    setTimelineFeedback,
    addCorrection,
  } = useAppStore()
  const { openAdd } = useAddFilm()
  const { push } = useToast()
  const [activeKey, setActiveKey] = useState<DimensionKey | null>(null)

  if (records.length === 0) {
    return (
      <div className="mx-auto max-w-shell px-5 py-20 lg:px-10">
        <p className="micro text-brass/80">04 — My Taste</p>
        <h1 className="display-xl mt-4">Nothing to read yet.</h1>
        <EmptyState
          className="mt-12"
          eyebrow="The profile is blank"
          title="The AI cannot see you without a frame."
          description="Add a film and write what stayed with you. Six dimensions will appear, each with a confidence level and the exact sentences that support it."
          action={
            <button type="button" onClick={() => openAdd()} className="btn btn-primary">
              <Plus size={14} /> Add a film
            </button>
          }
        />
      </div>
    )
  }

  const summary = summarizeTaste(snapshot)
  const usedQuotes: string[] = []
  const evidenceByDimension = snapshot.dimensionScores.reduce(
    (acc, score) => {
      const evidence = getEvidence(snapshot, records, films, score.key, 2, usedQuotes)
      evidence.forEach((item) => usedQuotes.push(item.quote))
      acc[score.key] = evidence
      return acc
    },
    {} as Record<DimensionKey, ReturnType<typeof getEvidence>>,
  )
  const strongest = [...snapshot.dimensionScores].sort(
    (a, b) => b.strength * (0.5 + b.confidence) - a.strength * (0.5 + a.confidence),
  )[0]

  const feedbackCounts = Object.values(state.feedback).reduce(
    (acc, item) => {
      if (!item) return acc
      acc[item.verdict] += 1
      return acc
    },
    { agree: 0, 'not-quite': 0, corrected: 0 } as Record<DimensionFeedback['verdict'], number>,
  )

  const handleDimensionFeedback = (
    key: DimensionKey,
    verdict: DimensionFeedback['verdict'],
    correction?: string,
  ) => {
    setDimensionFeedback(key, verdict, correction)
    if (correction) addCorrection(`dimension:${key}`, correction)
    push(
      verdict === 'agree'
        ? `Noted. “${DIMENSION_MAP[key].label}” stays as read.`
        : verdict === 'not-quite'
          ? 'Noted. The confidence for that dimension is reduced.'
          : 'Correction saved. The reading now carries your own words.',
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
    push(
      verdict === 'agree'
        ? 'Noted against that stage of the archive.'
        : verdict === 'not-quite'
          ? 'Noted. That stage is marked as contested.'
          : 'Correction saved against that stage.',
      'success',
    )
  }

  const jumpTo = (key: DimensionKey) => {
    setActiveKey(key)
    document.getElementById(`dimension-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div>
      <section className="spotlight relative border-b border-white/10">
        <div className="mx-auto max-w-shell px-5 pb-14 pt-12 lg:px-10 lg:pb-20 lg:pt-16">
          <div className="flex flex-wrap items-center gap-3">
            <p className="micro text-brass/80">04 — My Taste</p>
            <span className="h-px w-8 bg-white/20" />
            <p className="micro text-paper-muted">An estimate, not a verdict</p>
          </div>

          <div className="mt-8 grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20">
            <div>
              <h1 className="display-hero">
                AI 眼中的我
                <br />
                <span className="italic text-paper-dim">a reading in progress.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[13px] leading-relaxed text-paper-dim">
                {snapshot.filmCount} films and {records.filter((r) => r.reflection.trim().length > 0).length}{' '}
                written notes produce the profile below. It is a weighted interpretation of what you
                keep choosing — not a score of how good your taste is, and not a finished portrait.
              </p>

              <div className="mt-8 border-l border-brass/40 pl-5">
                <p className="micro-sm text-brass/80">The reading</p>
                <p className="mt-2 font-display text-3xl leading-tight text-paper sm:text-4xl">
                  {tasteSignature(snapshot)}
                </p>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => openAdd()} className="btn btn-primary">
                  <Plus size={13} /> Add another frame
                </button>
                <Link to="/map" className="btn btn-ghost">
                  See the evidence map <ArrowRight size={12} />
                </Link>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <TasteRadar
                snapshot={snapshot}
                size={440}
                activeKey={activeKey}
                onSelect={jumpTo}
                className="mx-auto"
              />
              <div className="mt-6 grid w-full max-w-[420px] grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-4 text-center">
                <div>
                  <p className="num text-xl text-paper">{percent(snapshot.overallConfidence)}</p>
                  <p className="micro-sm mt-1 text-paper-muted">confidence</p>
                </div>
                <div>
                  <p className="num text-xl text-paper">{snapshot.filmCount}</p>
                  <p className="micro-sm mt-1 text-paper-muted">films read</p>
                </div>
                <div>
                  <p className="num text-xl text-paper">{feedbackCounts.agree + feedbackCounts['not-quite'] + feedbackCounts.corrected}</p>
                  <p className="micro-sm mt-1 text-paper-muted">verdicts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-shell px-5 py-14 lg:px-10 lg:py-16">
        <div className="grid gap-8 border border-white/10 bg-white/[0.015] p-6 sm:grid-cols-[1fr_1fr] lg:p-8">
          <div>
            <p className="micro flex items-center gap-2 text-brass/80">
              <Sparkles size={11} /> What this is
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-paper-dim">
              A transparent, local reading of your archive. Six axes are computed from ratings,
              note depth, and the themes that recur. Every claim links back to a sentence you wrote.
              Confidence reflects how much evidence exists — not how correct the AI is.
            </p>
          </div>
          <div>
            <p className="micro text-paper-muted">What this is not</p>
            <p className="mt-3 text-[12px] leading-relaxed text-paper-dim">
              Not a personality test, not an aesthetic ranking, and not a live language model. No
              text leaves this browser. “Not quite” and corrections are stored and visibly reduce
              the confidence of the reading they challenge.
            </p>
          </div>
        </div>

        {summary.length > 0 && (
          <div className="mt-10 grid gap-8 lg:grid-cols-[0.55fr_1fr] lg:gap-16">
            <div>
              <p className="micro text-paper-muted">In a paragraph</p>
              <p className="mt-3 font-display text-2xl leading-snug text-paper">
                {strongest?.def.label} is the loudest signal.
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-paper-muted">
                {strongest
                  ? `${strongest.def.labelZh} · ${percent(
                      strongest.value < 0.5 ? 1 - strongest.value : strongest.value,
                    )} toward ${(strongest.value < 0.5 ? strongest.def.low : strongest.def.high).toLowerCase()}`
                  : ''}
              </p>
            </div>
            <div className="space-y-3 border-l border-white/10 pl-6 sm:pl-8">
              {summary.map((sentence, i) => (
                <p key={i} className="text-[13px] leading-relaxed text-paper-dim">
                  {sentence}
                </p>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-shell px-5 py-14 lg:px-10 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel index="01">Six dimensions</SectionLabel>
              <p className="mt-4 max-w-xl text-[12px] leading-relaxed text-paper-muted">
                Each axis runs from one pole to the other. The marker is your archive's position;
                the number is confidence. Read the direction, not the percentage as a grade.
              </p>
            </div>
            <div className="text-right">
              <p className="micro-sm text-paper-muted">Feedback given</p>
              <p className="mt-1 text-[12px] text-paper-dim">
                {feedbackCounts.agree} agree · {feedbackCounts['not-quite']} not quite ·{' '}
                {feedbackCounts.corrected} corrections
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-x-14 lg:grid-cols-2">
            {snapshot.dimensionScores.map((score) => (
              <div key={score.key} id={`dimension-${score.key}`}>
                <DimensionCard
                  score={score}
                  evidence={evidenceByDimension[score.key]}
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

      {snapshot.topThemes.length > 0 && (
        <section className="border-y border-white/10 bg-[#181818]">
          <div className="mx-auto max-w-shell px-5 py-14 lg:px-10 lg:py-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <SectionLabel index="02">Thematic recurrence</SectionLabel>
                <p className="mt-4 max-w-lg text-[12px] leading-relaxed text-paper-muted">
                  Themes are counted across every note, weighted by rating and depth. This is the
                  ground the archive keeps returning to.
                </p>
              </div>
              <TextLink to="/map">Trace them on the map</TextLink>
            </div>

            <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {snapshot.topThemes.map((theme, i) => (
                <div key={theme.id} className="border-t border-white/10 pt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-display text-2xl text-paper">
                      {THEMES[theme.id].label}
                      <span className="ml-2 text-[11px] tracking-[0.1em] text-paper-muted">
                        {THEMES[theme.id].zh}
                      </span>
                    </p>
                    <span className="font-mono text-[10px] text-paper-muted">
                      {String(theme.count).padStart(2, '0')} films
                    </span>
                  </div>
                  <div className="bar-track mt-3">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.max(12, theme.weight * 100)}%`, opacity: 1 - i * 0.1 }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-paper-muted">
                    {THEMES[theme.id].blurb}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-shell px-5 py-16 lg:px-10 lg:py-24">
        <SectionLabel index="03">How AI sees me</SectionLabel>
        <div className="mt-6 grid gap-10 lg:grid-cols-[0.62fr_1fr] lg:gap-16">
          <div>
            <h2 className="display-xl">
              A reading that
              <br />
              <span className="italic text-brass-soft">grows with the archive.</span>
            </h2>
            <p className="mt-5 max-w-md text-[13px] leading-relaxed text-paper-dim">
              These are real snapshots, recomputed from the first N films at each milestone — not
              decorative copy. Each stage keeps the films it was built from, and each one can be
              agreed with, contested, or corrected.
            </p>
            <p className="mt-4 max-w-md text-[11px] leading-relaxed text-paper-muted">
              The newest stage is highlighted. If you add another film, a new stage appears above it
              and the whole profile re-reads itself.
            </p>
            <div className="mt-8 border-t border-white/10 pt-5">
              <p className="micro-sm text-paper-muted">Latest stage</p>
              <p className="mt-2 text-[12px] text-paper-dim">
                {timeline[0]
                  ? `${timeline[0].filmCount} films · ${formatLongDate(timeline[0].at)} · ${percent(
                      timeline[0].confidence,
                    )} confidence`
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
        <section className="border-t border-white/10">
          <div className="mx-auto max-w-shell px-5 py-12 lg:px-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="micro text-brass/80">Your corrections</p>
                <p className="mt-2 text-[12px] text-paper-muted">
                  Kept locally. These are the sentences that should outrank the engine's reading.
                </p>
              </div>
              <p className="font-mono text-[10px] text-paper-muted">
                {state.corrections.length} saved
              </p>
            </div>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {state.corrections.slice(0, 6).map((correction) => (
                <li key={correction.id} className="border-l border-brass/40 pl-4">
                  <p className="text-[9px] uppercase tracking-[0.16em] text-paper-muted">
                    {correction.scope.replace('dimension:', '').replace('timeline:', 'stage ')}
                  </p>
                  <p className="mt-1.5 font-display text-lg italic leading-snug text-paper-dim">
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
