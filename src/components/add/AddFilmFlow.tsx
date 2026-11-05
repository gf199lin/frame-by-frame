import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react'
import type { AddFilmDraft, AnalysisResult, Film, PosterMotif, ThemeId, MoodId, WatchRecord } from '@/types'
import { ANALYSIS_STAGES, GENRES, MOODS, THEMES, STATUS_LABELS, DIMENSION_MAP } from '@/data/taxonomy'
import { analyseDraft, createRecordFromDraft } from '@/lib/analyst'
import { cn, formatLongDate, todayISO } from '@/lib/format'
import { useAppStore } from '@/store/AppStore'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { FilmPoster } from '@/components/film/FilmPoster'
import { RatingInput, Rating } from '@/components/ui/Rating'
import { ShiftRadar } from '@/components/taste/TasteRadar'

type Step = 'search' | 'manual' | 'review' | 'form' | 'analyzing' | 'result'

const STEP_INDEX: Record<Step, number> = {
  search: 0,
  manual: 0,
  review: 1,
  form: 2,
  analyzing: 3,
  result: 4,
}

const STEP_LABELS = ['Find the film', 'Confirm', 'Your memory', 'Analysis', 'In the archive']

const PALETTES: Film['palette'][] = [
  { base: '#16212B', deep: '#0A1016', accent: '#8FA7B4', soft: '#283843', paper: '#E4DCCB' },
  { base: '#241A20', deep: '#120C10', accent: '#C79A88', soft: '#3C2A32', paper: '#EADCCB' },
  { base: '#14201A', deep: '#08110C', accent: '#9AAE86', soft: '#26362C', paper: '#E2D9C6' },
  { base: '#1B1A2B', deep: '#0C0B16', accent: '#A9A0CF', soft: '#2C2A44', paper: '#E8E0D2' },
]

const MOTIFS: PosterMotif[] = ['orbit', 'shore', 'stage', 'dome', 'forest', 'mind', 'signal', 'city']

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

export const AddFilmFlow = ({
  open,
  onClose,
  initialFilmId,
  editRecord,
}: {
  open: boolean
  onClose: () => void
  initialFilmId?: string
  editRecord?: WatchRecord
}) => {
  const { records, films, upsertRecord, addCustomFilm } = useAppStore()
  const { push } = useToast()
  const navigate = useNavigate()

  const startStep: Step = editRecord ? 'form' : initialFilmId ? 'review' : 'search'
  const [step, setStep] = useState<Step>(startStep)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Film | null>(() => {
    if (!initialFilmId) return null
    return films.find((f) => f.id === initialFilmId) ?? null
  })
  const [draft, setDraft] = useState<AddFilmDraft>(() => ({
    filmId: initialFilmId ?? '',
    rating: editRecord?.rating ?? 0,
    watchedAt: editRecord?.watchedAt ?? todayISO(),
    status: editRecord?.status ?? 'watched',
    reflection: editRecord?.reflection ?? '',
    feltLike: editRecord?.feltLike ?? '',
  }))
  const [error, setError] = useState('')
  const [activeStage, setActiveStage] = useState(-1)
  const [pending, setPending] = useState<{ result: AnalysisResult; record: WatchRecord } | null>(null)
  const committed = useRef(false)

  /* manual entry */
  const [manual, setManual] = useState({
    title: '',
    year: String(new Date().getFullYear()),
    director: '',
    runtime: '110',
    genre: 'Drama',
  })

  const recordedIds = useMemo(() => new Set(records.map((r) => r.filmId)), [records])
  const previousRecords = useMemo(
    () => records.filter((r) => r.id !== editRecord?.id),
    [records, editRecord?.id],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = films.filter((f) => (editRecord ? f.id === editRecord.filmId : !recordedIds.has(f.id)))
    if (!q) return pool.slice(0, 8)
    return pool
      .filter(
        (f) =>
          f.title.toLowerCase().includes(q) ||
          f.titleZh.includes(q) ||
          f.director.toLowerCase().includes(q) ||
          String(f.year).includes(q) ||
          f.genres.some((g) => g.toLowerCase().includes(q)),
      )
      .slice(0, 8)
  }, [films, query, recordedIds, editRecord])

  const archivedMatch = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || editRecord) return null
    return (
      films.find(
        (f) => recordedIds.has(f.id) && (f.title.toLowerCase().includes(q) || f.titleZh.includes(q)),
      ) ?? null
    )
  }, [films, query, recordedIds, editRecord])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && step !== 'analyzing') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, step])

  /* commit only after the simulated read completes */
  useEffect(() => {
    if (step !== 'analyzing' || !pending) return
    let cancelled = false
    let timer = 0
    let index = 0
    const run = () => {
      if (cancelled) return
      if (index >= ANALYSIS_STAGES.length) {
        if (!committed.current) {
          committed.current = true
          upsertRecord(pending.record, editRecord?.id)
          push(
            `${selected?.title ?? 'Film'} is in your archive. Six dimensions recomputed.`,
            'success',
          )
        }
        setStep('result')
        return
      }
      setActiveStage(index)
      index += 1
      timer = window.setTimeout(run, index === 1 ? 620 : 780)
    }
    timer = window.setTimeout(run, 420)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [step, pending, upsertRecord, editRecord?.id, push, selected?.title])

  const chooseFilm = (film: Film) => {
    setSelected(film)
    setDraft((d) => ({ ...d, filmId: film.id }))
    setStep('review')
  }

  const createManual = () => {
    const title = manual.title.trim()
    const year = Number(manual.year)
    if (!title || !Number.isFinite(year) || year < 1888 || year > 2100) {
      setError('A title and a plausible year are required.')
      return
    }
    const hash = Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const film: Film = {
      id: `custom-${slug(title) || 'film'}-${Date.now().toString(36).slice(-4)}`,
      title,
      titleZh: '',
      year,
      director: manual.director.trim() || 'Unknown director',
      runtime: Math.min(400, Math.max(20, Number(manual.runtime) || 110)),
      genres: [manual.genre],
      country: 'Personal entry',
      language: '—',
      tagline: '',
      logline: 'Added to the archive by hand. The local engine will read the note for themes.',
      cast: [],
      motif: MOTIFS[hash % MOTIFS.length],
      palette: PALETTES[hash % PALETTES.length],
      signature: { narrative: 0.5, emotion: 0.5, thematic: 0.4, visual: 0.5, character: 0.5, ending: 0.5 },
      themes: {},
      moods: {},
      narrativeTags: [],
      characterTags: [],
    }
    addCustomFilm(film)
    setSelected(film)
    setDraft((d) => ({ ...d, filmId: film.id }))
    setError('')
    setStep('form')
  }

  const submit = () => {
    if (!selected) return
    if (draft.rating <= 0) {
      setError('Give the film a rating first — even a half star is a signal.')
      return
    }
    if (draft.reflection.trim().length < 18) {
      setError('Write at least a sentence or two. The engine reads your words, not the film synopsis.')
      return
    }
    setError('')
    const result = analyseDraft(selected, draft, previousRecords, films)
    const record = createRecordFromDraft(selected, draft, result)
    const finalRecord: WatchRecord = editRecord
      ? {
          ...record,
          id: editRecord.id,
          createdAt: editRecord.createdAt,
          source: 'user',
        }
      : record
    setPending({ result, record: finalRecord })
    setActiveStage(-1)
    setStep('analyzing')
  }

  const reset = () => {
    setStep('search')
    setSelected(null)
    setQuery('')
    setDraft({
      filmId: '',
      rating: 0,
      watchedAt: todayISO(),
      status: 'watched',
      reflection: '',
      feltLike: '',
    })
    setPending(null)
    committed.current = false
    setError('')
  }

  const goTo = (path: string) => {
    onClose()
    navigate(path)
  }

  const currentIndex = STEP_INDEX[step]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      hideClose={step === 'analyzing'}
      labelledBy="add-film-title"
      className="my-0 min-h-full sm:min-h-0"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 py-4 pl-5 pr-14 sm:pl-8 sm:pr-16">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] tracking-[0.2em] text-brass">
            {String(currentIndex + 1).padStart(2, '0')}<span className="text-paper-muted">/05</span>
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex items-center gap-1">
                <span
                  className={cn(
                    'h-px w-8 transition-colors duration-500',
                    i <= currentIndex ? 'bg-brass/70' : 'bg-white/15',
                  )}
                />
                <span
                  className={cn(
                    'hidden text-[9px] uppercase tracking-[0.18em] lg:block',
                    i === currentIndex ? 'text-paper' : 'text-paper-muted/60',
                  )}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <span className="font-display text-lg text-paper">
          {editRecord ? 'Edit a memory' : 'Add a film'}
        </span>
      </div>

      {step === 'search' && (
        <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_0.85fr]">
          <div className="border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="micro text-brass/80">Step one</p>
            <h2 id="add-film-title" className="mt-3 font-display text-4xl leading-none text-paper sm:text-5xl">
              What did you watch?
            </h2>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-paper-muted">
              Search your catalogue. Films already in the archive are hidden — this is a new frame,
              not a duplicate.
            </p>

            <label className="mt-8 flex items-center gap-3 border-b border-white/20 pb-3 focus-within:border-brass/70">
              <Search size={16} className="text-paper-muted" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title, director, year…"
                className="w-full bg-transparent text-lg text-paper outline-none placeholder:text-paper-muted/50 focus-visible:outline-none"
                aria-label="Search films"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="micro-sm text-paper-muted hover:text-paper"
                >
                  Clear
                </button>
              )}
            </label>

            <div className="mt-6">
              {results.length === 0 ? (
                <div className="border border-dashed border-white/15 p-6">
                  <p className="font-display text-xl text-paper">Not in the catalogue.</p>
                  <p className="mt-2 text-[12px] leading-relaxed text-paper-muted">
                    You can still record it. A manual entry gets a generated poster and is read from
                    your note the same way.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setManual((m) => ({ ...m, title: query.trim() || m.title }))
                      setError('')
                      setStep('manual')
                    }}
                    className="btn btn-ghost mt-4 h-9 px-4 text-[9px]"
                  >
                    <Plus size={12} /> Add it manually
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {results.map((film) => (
                    <li key={film.id}>
                      <button
                        type="button"
                        onClick={() => chooseFilm(film)}
                        className="group flex w-full items-center gap-4 py-3 text-left transition-colors hover:bg-white/[0.025]"
                      >
                        <span className="relative block h-[68px] w-[46px] shrink-0 overflow-hidden">
                          <FilmPoster film={film} showTitle={false} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className="truncate font-display text-lg text-paper group-hover:text-brass-soft">
                              {film.title}
                            </span>
                            <span className="font-mono text-[10px] text-paper-muted">{film.year}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[11px] text-paper-muted">
                            {film.director} · {film.genres.join(' / ')} · {film.runtime} min
                          </span>
                          <span className="mt-1 block truncate text-[11px] text-paper-dim/80">
                            {film.tagline}
                          </span>
                        </span>
                        <ChevronRight
                          size={15}
                          className="shrink-0 text-paper-muted transition-transform group-hover:translate-x-1 group-hover:text-brass"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {archivedMatch && (
                <p className="mt-6 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-paper-muted">
                  <span className="text-paper-dim">{archivedMatch.title}</span> is already in your
                  archive.{' '}
                  <button
                    type="button"
                    onClick={() => goTo(`/archive/${archivedMatch.id}`)}
                    className="text-brass underline underline-offset-4 hover:text-brass-soft"
                  >
                    Open its memory
                  </button>
                </p>
              )}
            </div>
          </div>

          <div className="hidden flex-col justify-between p-8 lg:flex">
            <div>
              <p className="micro text-paper-muted">The ritual</p>
              <ol className="mt-6 space-y-5">
                {[
                  ['Find the film', 'Choose from your catalogue.'],
                  ['Write what stayed', 'One honest paragraph is enough.'],
                  ['Let the engine read', 'Themes, moods, and where it sits against your archive.'],
                  ['See what changed', 'Six dimensions, with evidence and a confidence level.'],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-4">
                    <span className="mt-1 font-mono text-[9px] text-brass/70">0{i + 1}</span>
                    <span>
                      <span className="block text-[12px] text-paper">{title}</span>
                      <span className="mt-1 block text-[11px] leading-relaxed text-paper-muted">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <blockquote className="border-l border-brass/40 pl-4">
              <p className="font-display text-xl italic leading-snug text-paper/80">
                “Every film leaves a frame. Every frame tells your story.”
              </p>
            </blockquote>
          </div>
        </div>
      )}

      {step === 'manual' && (
        <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_0.8fr]">
          <div className="border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <button
              type="button"
              onClick={() => setStep('search')}
              className="micro inline-flex items-center gap-2 text-paper-muted hover:text-paper"
            >
              <ArrowLeft size={12} /> Back to search
            </button>
            <h2 className="mt-6 font-display text-4xl leading-none text-paper">A film off the map</h2>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-paper-muted">
              Keep it factual. The poster is generated, but your memory of it will be treated like
              any other record.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="field-label">Title <span className="normal-case tracking-normal text-paper-muted/60">required</span></span>
                <input
                  autoFocus
                  className="input"
                  value={manual.title}
                  onChange={(e) => setManual({ ...manual, title: e.target.value })}
                  placeholder="The film you watched"
                />
              </label>
              <label>
                <span className="field-label">Year</span>
                <input
                  className="input"
                  value={manual.year}
                  inputMode="numeric"
                  onChange={(e) => setManual({ ...manual, year: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })}
                />
              </label>
              <label>
                <span className="field-label">Runtime (min)</span>
                <input
                  className="input"
                  value={manual.runtime}
                  inputMode="numeric"
                  onChange={(e) => setManual({ ...manual, runtime: e.target.value.replace(/[^0-9]/g, '') })}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">Director</span>
                <input
                  className="input"
                  value={manual.director}
                  onChange={(e) => setManual({ ...manual, director: e.target.value })}
                  placeholder="Optional"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">Primary genre</span>
                <select
                  className="input"
                  value={manual.genre}
                  onChange={(e) => setManual({ ...manual, genre: e.target.value })}
                >
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error && <p className="mt-5 text-[12px] text-[#d99a8a]">{error}</p>}

            <div className="mt-8 flex gap-3">
              <button type="button" onClick={createManual} className="btn btn-primary">
                Continue <ArrowRight size={13} />
              </button>
              <button type="button" onClick={() => setStep('search')} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </div>
          <div className="hidden items-center justify-center bg-white/[0.015] p-8 lg:flex">
            <div className="w-full max-w-[260px]">
              <div className="aspect-[2/3] w-full border border-white/10">
                <FilmPoster
                  film={{
                    id: 'manual-preview',
                    title: manual.title || 'Untitled',
                    titleZh: '',
                    year: Number(manual.year) || 2026,
                    director: manual.director || 'Unknown director',
                    runtime: Number(manual.runtime) || 110,
                    genres: [manual.genre],
                    country: 'Personal entry',
                    language: '—',
                    tagline: '',
                    logline: '',
                    cast: [],
                    motif: 'orbit',
                    palette: PALETTES[0],
                    signature: { narrative: 0.5, emotion: 0.5, thematic: 0.4, visual: 0.5, character: 0.5, ending: 0.5 },
                    themes: {},
                    moods: {},
                    narrativeTags: [],
                    characterTags: [],
                  }}
                />
              </div>
              <p className="mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-paper-muted">
                Generated cover preview
              </p>
            </div>
          </div>
        </div>
      )}

      {(step === 'review' || step === 'form') && selected && (
        <div className="grid flex-1 gap-0 lg:grid-cols-[0.82fr_1fr]">
          <div className={cn('border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r', step === 'form' && 'hidden lg:block')}>
            <div className="mx-auto w-full max-w-[240px] sm:max-w-[300px]">
              <div className="aspect-[2/3] w-full border border-white/10">
                <FilmPoster film={selected} eager />
              </div>
              <div className="mt-5 flex items-start justify-between gap-3 border-t border-white/10 pt-4">
                <div>
                  <h3 className="font-display text-2xl leading-tight text-paper">{selected.title}</h3>
                  <p className="mt-1 text-[11px] text-paper-muted">
                    {selected.year} · {selected.director}
                  </p>
                </div>
                <span className="font-mono text-[10px] text-paper-muted">{selected.runtime}m</span>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-paper-dim">{selected.logline}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {selected.genres.map((g) => (
                  <span key={g} className="tag">
                    {g}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            {step === 'review' ? (
              <div className="flex h-full flex-col">
                <button
                  type="button"
                  onClick={() => {
                    if (editRecord) return
                    setStep('search')
                    setSelected(null)
                  }}
                  className="micro inline-flex items-center gap-2 text-paper-muted hover:text-paper"
                >
                  <ArrowLeft size={12} /> Choose another
                </button>
                <p className="micro mt-8 text-brass/80">Step two</p>
                <h2 className="mt-3 font-display text-4xl leading-none text-paper">
                  Is this the film?
                </h2>
                <p className="mt-3 text-[13px] leading-relaxed text-paper-muted">
                  {selected.titleZh} · {selected.country} · {selected.language}
                </p>

                <dl className="mt-8 divide-y divide-white/10 border-y border-white/10 text-[12px]">
                  {[
                    ['Director', selected.director],
                    ['Released', String(selected.year)],
                    ['Runtime', `${selected.runtime} minutes`],
                    ['Cast', selected.cast.slice(0, 3).join(', ') || '—'],
                    ['Genre', selected.genres.join(' / ')],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-6 py-3">
                      <dt className="text-paper-muted">{label}</dt>
                      <dd className="text-right text-paper-dim">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto flex flex-wrap gap-3 pt-8">
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="btn btn-primary"
                  >
                    This is the one <ArrowRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('search')
                      setQuery(selected.title)
                    }}
                    className="btn btn-ghost"
                  >
                    Not quite
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <p className="micro text-brass/80">Step three</p>
                  {!editRecord && (
                    <button
                      type="button"
                      onClick={() => setStep('review')}
                      className="micro inline-flex items-center gap-2 text-paper-muted hover:text-paper"
                    >
                      <ArrowLeft size={12} /> Film details
                    </button>
                  )}
                </div>
                <h2 id="add-film-title" className="mt-3 font-display text-4xl leading-none text-paper">
                  {editRecord ? 'Rewrite the memory' : 'Now the part only you have'}
                </h2>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-brass lg:hidden">
                  {selected.title} · {selected.year}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-paper-muted">
                  No synopsis. Just what the film did to you. The local engine reads this text for
                  themes and moods — nothing leaves your browser.
                </p>

                <div className="mt-7 grid gap-7">
                  <div>
                    <span className="field-label">Your rating</span>
                    <RatingInput value={draft.rating} onChange={(rating) => setDraft({ ...draft, rating })} />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <label>
                      <span className="field-label">Watch date</span>
                      <input
                        type="date"
                        className="input"
                        max={todayISO()}
                        value={draft.watchedAt}
                        onChange={(e) => setDraft({ ...draft, watchedAt: e.target.value })}
                      />
                    </label>
                    <div>
                      <span className="field-label">Watch status</span>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setDraft({ ...draft, status: key })}
                            className="chip"
                            data-active={draft.status === key}
                          >
                            {STATUS_LABELS[key].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="field-label">
                      <span>Personal reflection</span>
                      <span className="normal-case tracking-normal text-paper-muted/60">
                        {draft.reflection.trim().length} characters
                      </span>
                    </div>
                    <textarea
                      value={draft.reflection}
                      onChange={(e) => {
                        setDraft({ ...draft, reflection: e.target.value })
                        if (error) setError('')
                      }}
                      rows={6}
                      placeholder="Start with the scene you can still see. Then say what it reminded you of — a person, a year, a version of yourself."
                      className="input input-boxed min-h-[9rem] resize-y text-[13px] leading-relaxed"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['What stayed with you?', 'What did it remind you of?', 'Which scene?', 'How did it end for you?'].map(
                        (prompt) => (
                          <span key={prompt} className="text-[10px] text-paper-muted/70">
                            · {prompt}
                          </span>
                        ),
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="field-label">How did it leave you? (optional)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(MOODS) as MoodId[]).slice(0, 8).map((mood) => (
                        <button
                          key={mood}
                          type="button"
                          onClick={() =>
                            setDraft({ ...draft, feltLike: draft.feltLike === mood ? '' : mood })
                          }
                          className="chip h-7 text-[9px]"
                          data-active={draft.feltLike === mood}
                        >
                          {MOODS[mood].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <p className="border-l border-[#b0624f] bg-[#b0624f]/5 px-3 py-2 text-[12px] text-[#d99a8a]">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
                    <button type="button" onClick={submit} className="btn btn-primary">
                      <Sparkles size={13} />
                      {editRecord ? 'Save & re-analyse' : 'Analyse this memory'}
                    </button>
                    <span className="text-[10px] text-paper-muted">
                      Five stages · about four seconds
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'analyzing' && selected && (
        <div className="grid flex-1 lg:grid-cols-[0.7fr_1fr]">
          <div className="relative hidden overflow-hidden border-r border-white/10 lg:block">
            <FilmPoster film={selected} />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute left-0 right-0 h-24 animate-scan bg-gradient-to-b from-transparent via-brass/20 to-transparent" />
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <p className="micro text-brass/90">Reading</p>
              <p className="mt-2 font-display text-3xl leading-tight text-paper">{selected.title}</p>
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-10">
            <p className="micro text-brass/80">Local analysis</p>
            <h2 id="add-film-title" className="mt-3 font-display text-4xl leading-none text-paper">
              Listening to what you wrote.
            </h2>
            <p className="mt-3 max-w-md text-[12px] leading-relaxed text-paper-muted">
              No model is being called. Five deterministic passes run over your note, rating, and
              the 16-film catalogue.
            </p>

            <ol className="mt-9 space-y-1">
              {ANALYSIS_STAGES.map((stage, i) => {
                const done = i < activeStage
                const active = i === activeStage
                return (
                  <li
                    key={stage.id}
                    className={cn(
                      'flex items-start gap-4 border-l py-3 pl-4 transition-all duration-500',
                      done
                        ? 'border-brass/40 opacity-70'
                        : active
                          ? 'border-brass bg-brass/[0.04]'
                          : 'border-white/10 opacity-35',
                    )}
                  >
                    <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center border border-current text-[9px]">
                      {done ? (
                        <Check size={11} className="text-brass" />
                      ) : active ? (
                        <Loader2 size={11} className="animate-spin text-brass" />
                      ) : (
                        <span className="font-mono text-paper-muted">{i + 1}</span>
                      )}
                    </span>
                    <span>
                      <span
                        className={cn(
                          'block text-[12px]',
                          active ? 'text-paper' : done ? 'text-paper-dim' : 'text-paper-muted',
                        )}
                      >
                        {stage.label}
                        <span className="text-paper-muted/60">…</span>
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-paper-muted">
                        {stage.detail}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>

            <div className="mt-8">
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${Math.max(4, ((activeStage + 1) / ANALYSIS_STAGES.length) * 100)}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-[9px] tracking-[0.16em] text-paper-muted">
                {Math.min(activeStage + 1, ANALYSIS_STAGES.length)} / {ANALYSIS_STAGES.length} PASSES
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 'result' && selected && pending && (
        <div className="flex flex-1 flex-col">
          <div className="border-b border-white/10 p-5 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="micro text-brass/80">Step five · written</p>
                <h2 id="add-film-title" className="mt-3 font-display text-4xl leading-none text-paper sm:text-5xl">
                  {selected.title} is in the archive.
                </h2>
                <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-paper-dim">
                  {pending.result.summary}
                </p>
              </div>
              <div className="flex items-center gap-6 border-l border-white/10 pl-6">
                <div>
                  <p className="micro-sm text-paper-muted">Confidence</p>
                  <p className="num mt-1 text-2xl text-paper">
                    {Math.round(pending.result.confidenceBefore * 100)}
                    <span className="text-brass"> → </span>
                    {Math.round(pending.result.confidenceAfter * 100)}
                    <span className="ml-0.5 text-sm text-paper-muted">%</span>
                  </p>
                </div>
                <div>
                  <p className="micro-sm text-paper-muted">Archive</p>
                  <p className="num mt-1 text-2xl text-paper">
                    {String(records.length).padStart(2, '0')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_1fr_0.9fr]">
            <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="micro text-paper-muted">Extracted from your note</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {pending.result.themes.length > 0 ? (
                  pending.result.themes.map((theme: ThemeId) => (
                    <span key={theme} className="tag border-brass/30 bg-brass/[0.06] text-brass-soft">
                      {THEMES[theme].label} <span className="text-paper-muted">{THEMES[theme].zh}</span>
                    </span>
                  ))
                ) : (
                  <p className="text-[12px] text-paper-muted">
                    No clear theme yet. A longer note usually gives the engine more to hold.
                  </p>
                )}
              </div>

              <p className="micro mt-8 text-paper-muted">Emotional register</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {pending.result.moods.map((mood: MoodId) => (
                  <span key={mood} className="tag">
                    {MOODS[mood].label}
                  </span>
                ))}
              </div>

              <div className="mt-8 border-t border-white/10 pt-5">
                <p className="micro text-paper-muted">Where it connects</p>
                {pending.result.connections.length > 0 ? (
                  <ul className="mt-4 space-y-4">
                    {pending.result.connections.map((connection) => (
                      <li key={connection.filmId}>
                        <button
                          type="button"
                          onClick={() => goTo(`/archive/${connection.filmId}`)}
                          className="group text-left"
                        >
                          <span className="flex items-center gap-2 font-display text-base text-paper group-hover:text-brass-soft">
                            {connection.title}
                            <ArrowRight
                              size={11}
                              className="text-paper-muted transition-transform group-hover:translate-x-0.5"
                            />
                          </span>
                          <span className="mt-1 block text-[11px] leading-relaxed text-paper-muted">
                            {connection.reason}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[12px] leading-relaxed text-paper-muted">
                    This is the first film of its kind here. The graph will grow around it.
                  </p>
                )}
              </div>
            </div>

            <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="micro text-paper-muted">What moved</p>
              <ul className="mt-5 space-y-5">
                {pending.result.findings.map((finding) => {
                  const delta = finding.after - finding.before
                  const def = DIMENSION_MAP[finding.dimension]
                  return (
                    <li key={finding.key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[11px] uppercase tracking-[0.14em] text-paper-dim">
                          {def.label}
                        </span>
                        <span
                          className={cn(
                            'font-mono text-[10px] tabular-nums',
                            Math.abs(delta) < 0.01
                              ? 'text-paper-muted'
                              : delta > 0
                                ? 'text-brass-soft'
                                : 'text-[#9fb4b0]',
                          )}
                        >
                          {delta > 0 ? '+' : ''}
                          {Math.round(delta * 100)} pts
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] leading-snug text-paper">{finding.headline}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="font-mono text-[9px] text-paper-muted">
                          {Math.round(finding.before * 100)}
                        </span>
                        <div className="bar-track flex-1">
                          <div className="bar-fill" style={{ width: `${Math.round(finding.after * 100)}%` }} />
                        </div>
                        <span className="font-mono text-[9px] text-paper-dim">
                          {Math.round(finding.after * 100)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-6 flex items-center gap-5 border-t border-white/10 pt-5">
                <ShiftRadar
                  before={pending.result.beforeScores}
                  after={pending.result.afterScores}
                  size={136}
                />
                <div>
                  <p className="micro text-paper-muted">Profile shape</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-paper-dim">
                    Dashed: before this film. Red: after {records.length} films.
                  </p>
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-paper-muted">
                    Six axes · recomputed locally
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[10px] leading-relaxed text-paper-muted">
                {pending.result.findings.every((f) => Math.abs(f.after - f.before) < 0.02)
                  ? 'This film confirmed your existing shape more than it bent it. The confidence reading still moved, because the archive now holds more evidence.'
                  : 'Values are positions on each pole axis, recomputed from every record. They are estimates of preference, not a score of taste.'}
              </p>
            </div>

            <div className="flex flex-col p-5 sm:p-7">
              <div className="border border-white/10 p-4">
                <p className="micro text-brass/80">The frame</p>
                <div className="mt-3 aspect-[2/3] w-full max-w-[170px]">
                  <FilmPoster film={selected} showTitle={false} />
                </div>
                <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-paper-muted">
                  {formatLongDate(pending.record.watchedAt)} · {STATUS_LABELS[pending.record.status].label}
                </p>
                <Rating value={pending.record.rating} className="mt-2" />
              </div>

              <div className="mt-auto space-y-2 pt-6">
                <button
                  type="button"
                  onClick={() => goTo('/taste')}
                  className="btn btn-primary w-full"
                >
                  See My Taste <ArrowRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(`/archive/${selected.id}`)}
                  className="btn btn-ghost w-full"
                >
                  Open the memory
                </button>
                <button type="button" onClick={reset} className="btn btn-quiet w-full">
                  <Plus size={12} /> Add another film
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
