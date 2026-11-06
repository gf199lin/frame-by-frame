import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
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
import {
  filmFromCatalogue,
  loadCatalogueDetail,
  searchFilms,
  CatalogueError,
  type SearchHit,
} from '@/lib/catalogue'
import { readTmdbToken, writeTmdbToken } from '@/lib/catalogue/tmdb'

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

const EXAMPLES = ['Zootopia', '疯狂动物城', '海边的曼彻斯特']

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

const HitPoster = ({ hit, eager = false }: { hit: SearchHit; eager?: boolean }) => {
  const [failed, setFailed] = useState(false)
  return (
    <span className="relative block h-[84px] w-[56px] shrink-0 overflow-hidden bg-white/[0.04]">
      {hit.posterUrl && !failed ? (
        <img
          src={hit.posterUrl}
          alt={`${hit.title} official poster`}
          className="h-full w-full object-cover"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={eager ? 'high' : 'auto'}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 border border-white/15 px-1 text-center">
          <span className="font-mono text-[12px] uppercase leading-tight tracking-[0.1em] text-paper-muted">
            No poster
          </span>
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 border border-white/10" aria-hidden="true" />
    </span>
  )
}

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

  /* search */
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searchError, setSearchError] = useState<CatalogueError | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  const [tmdbOpen, setTmdbOpen] = useState(false)
  const [tmdbToken, setTmdbToken] = useState('')
  const [tokenDraft, setTokenDraft] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)

  /* manual entry */
  const [manual, setManual] = useState({
    title: '',
    year: String(new Date().getFullYear()),
    director: '',
    runtime: '110',
    genre: 'Drama',
  })

  const previousRecords = useMemo(
    () => records.filter((r) => r.id !== editRecord?.id),
    [records, editRecord?.id],
  )

  useEffect(() => {
    if (!open) return
    setTmdbToken(readTmdbToken())
  }, [open])

  useEffect(() => {
    if (!open || step !== 'search') return
    const q = query.trim()
    const isChinese = /[\u3400-\u9fff]/.test(q)
    if (!q || (q.length < 2 && !isChinese)) {
      setStatus('idle')
      setHits([])
      setSearchError(null)
      return
    }

    setStatus('loading')
    const controller = new AbortController()
    let active = true
    const timer = window.setTimeout(() => {
      searchFilms({ query: q, films, records, signal: controller.signal })
        .then((found) => {
          if (!active) return
          setHits(found)
          setStatus('ready')
          setSearchError(null)
        })
        .catch((cause) => {
          if (!active || (cause as Error)?.name === 'AbortError') return
          setHits([])
          setSearchError(
            cause instanceof CatalogueError
              ? cause
              : new CatalogueError('unknown', (cause as Error)?.message ?? 'Search failed.'),
          )
          setStatus('error')
        })
    }, 380)

    return () => {
      active = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, step, query, films, records, retryTick, tmdbToken])

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

  const goTo = (path: string) => {
    onClose()
    navigate(path)
  }

  const chooseHit = (hit: SearchHit) => {
    if (hit.inArchive && hit.localFilm) {
      goTo(`/archive/${hit.localFilm.id}`)
      return
    }
    const base = hit.localFilm ?? (hit.catalogue ? filmFromCatalogue(hit.catalogue) : null)
    if (!base) return

    if (hit.catalogue && !hit.localFilm) addCustomFilm(base)
    setSelected(base)
    setDraft((d) => ({ ...d, filmId: base.id }))
    setError('')
    setDetailLoading(false)
    setStep('review')

    if (hit.catalogue && !hit.localFilm) {
      setDetailLoading(true)
      loadCatalogueDetail(hit.catalogue)
        .then((detail) => {
          if (!detail || Object.keys(detail).length === 0) return
          const enriched = filmFromCatalogue({ ...hit.catalogue!, ...detail })
          addCustomFilm(enriched)
          setSelected((previous) => (previous?.id === enriched.id ? enriched : previous))
        })
        .catch(() => {
          /* basic metadata from the search result is still usable */
        })
        .finally(() => setDetailLoading(false))
    }
  }

  const startManual = () => {
    setManual((current) => ({ ...current, title: query.trim() || current.title }))
    setError('')
    setStep('manual')
  }

  const saveToken = () => {
    writeTmdbToken(tokenDraft)
    setTmdbToken(readTmdbToken())
    setTmdbOpen(false)
    setRetryTick((tick) => tick + 1)
  }

  const removeToken = () => {
    writeTmdbToken('')
    setTmdbToken('')
    setTokenDraft('')
    setRetryTick((tick) => tick + 1)
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
      externalSource: 'manual',
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
    setStatus('idle')
    setHits([])
  }

  const currentIndex = STEP_INDEX[step]
  const yearLabel = selected?.year ? String(selected.year) : 'Year unknown'
  const runtimeLabel = selected?.runtime ? `${selected.runtime} minutes` : 'Runtime unknown'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      hideClose={step === 'analyzing'}
      labelledBy="add-film-title"
      className="my-0 min-h-full sm:min-h-0"
    >
      <div className="border-b border-white/12 px-5 py-4 pr-14 sm:px-8 sm:pr-16">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-mono text-[14px] tracking-[0.18em] text-paper">
              {String(currentIndex + 1).padStart(2, '0')}
              <span className="text-paper-muted">/05</span>
            </span>
            <span className="truncate text-[13px] uppercase tracking-[0.18em] text-paper-dim sm:hidden">
              {STEP_LABELS[currentIndex]}
            </span>
          </div>
          <span className="font-display text-[20px] leading-none text-paper">
            {editRecord ? 'Edit a memory' : 'Add a film'}
          </span>
        </div>

        <ol className="mt-3 hidden items-center gap-2.5 sm:flex" aria-label="Progress">
          {STEP_LABELS.map((label, index) => (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={cn(
                  'h-[2px] shrink-0 transition-all duration-500',
                  index === currentIndex ? 'w-7 bg-paper' : 'w-4 bg-white/25',
                  index < currentIndex && 'bg-paper/60',
                )}
              />
              <span
                className={cn(
                  'truncate text-[13px] uppercase tracking-[0.14em] lg:text-[13.5px]',
                  index === currentIndex
                    ? 'font-medium text-paper'
                    : index < currentIndex
                      ? 'text-paper-dim'
                      : 'text-paper-muted',
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex gap-1.5 sm:hidden" aria-hidden="true">
          {STEP_LABELS.map((label, index) => (
            <span
              key={label}
              className={cn('h-[2px] flex-1', index <= currentIndex ? 'bg-paper/75' : 'bg-white/20')}
            />
          ))}
        </div>
      </div>

      {step === 'search' && (
        <div className="grid flex-1 gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="border-b border-white/12 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="micro text-paper-dim">Step one</p>
            <h2
              id="add-film-title"
              className="mt-3 font-display text-[2.6rem] leading-[0.95] text-paper sm:text-[3.4rem]"
            >
              What did you watch?
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-paper-dim">
              Search the film catalogue by English or Chinese title, year, or director. Results
              carry real release posters — never generated artwork.
            </p>

            <label className="mt-7 flex items-center gap-3 border-b-2 border-paper/25 pb-3 focus-within:border-paper/70">
              <Search size={20} className="shrink-0 text-paper-dim" aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title, year, or director"
                className="w-full bg-transparent text-[19px] leading-tight text-paper outline-none placeholder:text-paper-muted focus-visible:outline-none"
                aria-label="Search films"
                autoComplete="off"
                spellCheck={false}
              />
              {status === 'loading' && (
                <Loader2 size={17} className="shrink-0 animate-spin text-paper-dim" />
              )}
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="shrink-0 text-[14px] uppercase tracking-[0.16em] text-paper-dim transition-colors hover:text-paper"
                >
                  Clear
                </button>
              )}
            </label>

            <div className="mt-6">
              {status === 'idle' && (
                <div className="border border-dashed border-white/20 p-5 sm:p-6">
                  <p className="text-[15px] leading-relaxed text-paper-dim">
                    Type a title to search. English and Chinese both work, and a trailing year
                    narrows the match.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {EXAMPLES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setQuery(example)}
                        className="border border-white/20 px-3 py-1.5 text-[15px] text-paper-dim transition-colors hover:border-paper/50 hover:text-paper"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {status === 'loading' && (
                <ul className="divide-y divide-white/10" aria-label="Searching">
                  {[0, 1, 2].map((row) => (
                    <li key={row} className="flex items-center gap-4 py-4">
                      <span className="h-[84px] w-[56px] shrink-0 animate-pulse bg-white/[0.06]" />
                      <span className="flex-1 space-y-2">
                        <span className="block h-3 w-2/3 animate-pulse bg-white/[0.08]" />
                        <span className="block h-2.5 w-1/3 animate-pulse bg-white/[0.06]" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {status === 'error' && searchError && (
                <div className="border border-white/20 p-5">
                  <p className="flex items-center gap-2 text-[15px] font-medium text-paper">
                    <TriangleAlert size={16} /> Unable to reach the movie catalogue.
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed text-paper-dim">
                    {searchError.message} Please check your connection and try again.
                  </p>
                  {searchError.status && (
                    <p className="mt-2 font-mono text-[13px] uppercase tracking-[0.12em] text-paper-muted">
                      Diagnostic · {searchError.kind} · HTTP {searchError.status}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRetryTick((tick) => tick + 1)}
                      className="btn btn-ghost h-10 px-4 text-[14px]"
                    >
                      <RefreshCw size={13} /> Try again
                    </button>
                    <button type="button" onClick={startManual} className="btn btn-ghost h-10 px-4 text-[14px]">
                      <Plus size={13} /> Add it manually
                    </button>
                  </div>
                </div>
              )}

              {status === 'ready' && hits.length === 0 && (
                <div className="border border-dashed border-white/20 p-5">
                  <p className="text-[16px] text-paper">No matching films found.</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-paper-dim">
                    You can try another title, or add the film manually. A manual entry never
                    invents a poster or an external id.
                  </p>
                  <button
                    type="button"
                    onClick={startManual}
                    className="btn btn-ghost mt-4 h-10 px-4 text-[14px]"
                  >
                    <Plus size={13} /> Add it manually
                  </button>
                </div>
              )}

              {status === 'ready' && hits.length > 0 && (
                <>
                  <ul className="max-h-[min(52vh,30rem)] divide-y divide-white/10 overflow-y-auto pr-1">
                    {hits.map((hit, index) => (
                      <li key={hit.key}>
                        <button
                          type="button"
                          onClick={() => chooseHit(hit)}
                          className="group flex w-full items-start gap-4 py-4 text-left transition-colors hover:bg-white/[0.03]"
                          aria-label={
                            hit.inArchive
                              ? `${hit.title} is already in your archive. Open its memory.`
                              : `Choose ${hit.title}${hit.year ? ` (${hit.year})` : ''}`
                          }
                        >
                          <HitPoster hit={hit} eager={index < 4} />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                              <span className="font-display text-[19px] leading-tight text-paper">
                                {hit.title}
                              </span>
                              {hit.year ? (
                                <span className="font-mono text-[14px] text-paper-dim">{hit.year}</span>
                              ) : null}
                              {hit.inArchive && (
                                <span className="border border-paper/30 px-1.5 py-0.5 font-mono text-[12.5px] uppercase tracking-[0.12em] text-paper-dim">
                                  Already in your archive
                                </span>
                              )}
                            </span>
                            {hit.titleZh && (
                              <span className="mt-1 block text-[15px] text-paper-dim">
                                {hit.titleZh}
                              </span>
                            )}
                            {hit.originalTitle && (
                              <span className="mt-1 block text-[15px] italic text-paper-muted">
                                {hit.originalTitle}
                              </span>
                            )}
                            <span className="mt-1.5 block truncate text-[15px] text-paper-muted">
                              {[hit.genres.slice(0, 3).join(' / '), hit.inArchive ? 'Open its memory' : '']
                                .filter(Boolean)
                                .join(' · ') || 'Feature film'}
                            </span>
                          </span>
                          <ChevronRight
                            size={17}
                            className="mt-1 shrink-0 text-paper-muted transition-transform group-hover:translate-x-1 group-hover:text-paper"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={startManual}
                    className="mt-2 inline-flex items-center gap-2 py-3 text-[15px] text-paper-dim underline underline-offset-4 transition-colors hover:text-paper"
                  >
                    <Plus size={13} /> Can't find it? Add it manually
                  </button>
                </>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 pt-4 text-[14px] text-paper-muted">
                <span>
                  Catalogue: IMDb · no API key required
                  {tmdbToken ? ' · TMDB connected' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTokenDraft(tmdbToken)
                    setTmdbOpen((openState) => !openState)
                  }}
                  className="uppercase tracking-[0.12em] text-paper-dim underline underline-offset-4 hover:text-paper"
                >
                  {tmdbOpen ? 'Close' : tmdbToken ? 'Manage TMDB' : 'Connect TMDB'}
                </button>
              </div>

              {tmdbOpen && (
                <div className="mt-4 border border-white/15 p-4">
                  <p className="text-[15px] leading-relaxed text-paper-dim">
                    Add a TMDB read access token (v4) for Chinese titles and richer metadata. It is
                    stored only in this browser and never committed. TMDB may be unreachable on some
                    networks; IMDb results keep working.
                  </p>
                  <input
                    type="password"
                    value={tokenDraft}
                    onChange={(event) => setTokenDraft(event.target.value)}
                    placeholder="TMDB read access token"
                    className="mt-3 w-full border-b border-white/25 bg-transparent py-2 text-[15px] text-paper outline-none placeholder:text-paper-muted focus:border-paper/60"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveToken}
                      disabled={!tokenDraft.trim()}
                      className="btn btn-ghost h-9 px-3 text-[14px]"
                    >
                      Save token
                    </button>
                    {tmdbToken && (
                      <button
                        type="button"
                        onClick={removeToken}
                        className="btn btn-quiet h-9 px-2 text-[14px]"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="hidden flex-col justify-between p-8 lg:flex">
            <div>
              <p className="micro text-paper-muted">The ritual</p>
              <ol className="mt-6 space-y-6">
                {[
                  ['Find the film', 'Choose the exact release — poster, original title, and year.'],
                  ['Write what stayed', 'One honest paragraph is enough.'],
                  ['Let the engine read', 'Themes, moods, and where it sits in your archive.'],
                  ['See what changed', 'Six dimensions, with evidence and a confidence level.'],
                ].map(([title, body], index) => (
                  <li key={title} className="flex gap-4">
                    <span className="mt-0.5 font-mono text-[13px] text-paper-dim">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span>
                      <span className="block text-[15px] leading-snug text-paper">{title}</span>
                      <span className="mt-1.5 block text-[15px] leading-relaxed text-paper-dim">
                        {body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <blockquote className="border-l border-paper/30 pl-5">
              <p className="font-display text-[24px] italic leading-snug text-paper/85">
                “Every film leaves a frame. Every frame tells your story.”
              </p>
            </blockquote>
          </aside>
        </div>
      )}

      {step === 'manual' && (
        <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_0.8fr]">
          <div className="border-b border-white/12 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <button
              type="button"
              onClick={() => setStep('search')}
              className="inline-flex items-center gap-2 text-[14px] uppercase tracking-[0.16em] text-paper-dim hover:text-paper"
            >
              <ArrowLeft size={13} /> Back to search
            </button>
            <h2 className="mt-6 font-display text-[2.4rem] leading-none text-paper sm:text-[2.9rem]">
              A film off the map
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-paper-dim">
              Keep it factual. A verified poster is matched by title and year when available;
              otherwise the archive shows a designed placeholder rather than invented artwork.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="field-label">
                  Title{' '}
                  <span className="normal-case tracking-normal text-paper-muted">required</span>
                </span>
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
                  onChange={(e) =>
                    setManual({ ...manual, year: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })
                  }
                />
              </label>
              <label>
                <span className="field-label">Runtime (min)</span>
                <input
                  className="input"
                  value={manual.runtime}
                  inputMode="numeric"
                  onChange={(e) =>
                    setManual({ ...manual, runtime: e.target.value.replace(/[^0-9]/g, '') })
                  }
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

            {error && <p className="mt-5 text-[15px] text-[#e0a898]">{error}</p>}

            <div className="mt-8 flex gap-3">
              <button type="button" onClick={createManual} className="btn btn-primary">
                Continue <ArrowRight size={14} />
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
                    signature: {
                      narrative: 0.5,
                      emotion: 0.5,
                      thematic: 0.4,
                      visual: 0.5,
                      character: 0.5,
                      ending: 0.5,
                    },
                    themes: {},
                    moods: {},
                    narrativeTags: [],
                    characterTags: [],
                  }}
                />
              </div>
              <p className="mt-3 text-center text-[13px] uppercase tracking-[0.16em] text-paper-muted">
                Generated cover preview
              </p>
            </div>
          </div>
        </div>
      )}

      {(step === 'review' || step === 'form') && selected && (
        <div className="grid flex-1 gap-0 lg:grid-cols-[0.82fr_1fr]">
          <div
            className={cn(
              'border-b border-white/12 p-5 sm:p-8 lg:border-b-0 lg:border-r',
              step === 'form' && 'hidden lg:block',
            )}
          >
            <div className="mx-auto w-full max-w-[240px] sm:max-w-[300px]">
              <div className="aspect-[2/3] w-full border border-white/10">
                <FilmPoster film={selected} eager />
              </div>
              <div className="mt-5 flex items-start justify-between gap-3 border-t border-white/10 pt-4">
                <div>
                  <h3 className="font-display text-[26px] leading-tight text-paper">{selected.title}</h3>
                  <p className="mt-1 text-[15px] text-paper-dim">
                    {yearLabel} · {selected.director}
                  </p>
                  {selected.titleZh && (
                    <p className="mt-1 text-[15px] text-paper-muted">{selected.titleZh}</p>
                  )}
                </div>
                <span className="font-mono text-[14px] text-paper-dim">
                  {selected.runtime ? `${selected.runtime}m` : '—'}
                </span>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-paper-dim">{selected.logline}</p>
              {detailLoading && (
                <p className="mt-2 flex items-center gap-2 text-[14px] text-paper-muted">
                  <Loader2 size={12} className="animate-spin" /> Reading catalogue details…
                </p>
              )}
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
                  className="inline-flex items-center gap-2 text-[14px] uppercase tracking-[0.16em] text-paper-dim hover:text-paper"
                >
                  <ArrowLeft size={13} /> Choose another
                </button>
                <p className="micro mt-8 text-paper-dim">Step two</p>
                <h2 className="mt-3 font-display text-[2.5rem] leading-none text-paper sm:text-[2.9rem]">
                  Is this the film?
                </h2>
                <p className="mt-3 text-[15px] leading-relaxed text-paper-dim">
                  {[selected.titleZh, selected.country, selected.language]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                <dl className="mt-8 divide-y divide-white/10 border-y border-white/10 text-[15px]">
                  {[
                    ['Director', selected.director],
                    ['Released', selected.year ? String(selected.year) : 'Unknown'],
                    ['Runtime', runtimeLabel],
                    ['Cast', selected.cast.slice(0, 3).join(', ') || '—'],
                    ['Genre', selected.genres.join(' / ') || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-6 py-3.5">
                      <dt className="text-paper-dim">{label}</dt>
                      <dd className="max-w-[65%] text-right text-paper">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto flex flex-wrap gap-3 pt-8">
                  <button type="button" onClick={() => setStep('form')} className="btn btn-primary">
                    This is the one <ArrowRight size={14} />
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
                <div className="flex items-center justify-between gap-3">
                  <p className="micro text-paper-dim">Step three</p>
                  {!editRecord && (
                    <button
                      type="button"
                      onClick={() => setStep('review')}
                      className="inline-flex items-center gap-2 text-[14px] uppercase tracking-[0.16em] text-paper-dim hover:text-paper"
                    >
                      <ArrowLeft size={13} /> Film details
                    </button>
                  )}
                </div>
                <h2
                  id="add-film-title"
                  className="mt-3 font-display text-[2.4rem] leading-none text-paper sm:text-[2.9rem]"
                >
                  {editRecord ? 'Rewrite the memory' : 'Now the part only you have'}
                </h2>
                <p className="mt-2 font-mono text-[14px] uppercase tracking-[0.12em] text-paper lg:hidden">
                  {selected.title} · {yearLabel}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-paper-dim">
                  No synopsis. Just what the film did to you. The local engine reads this text for
                  themes and moods — nothing leaves your browser.
                </p>

                <div className="mt-7 grid gap-7">
                  <div>
                    <span className="field-label">Your rating</span>
                    <RatingInput
                      value={draft.rating}
                      onChange={(rating) => setDraft({ ...draft, rating })}
                    />
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
                      <span className="normal-case tracking-normal text-paper-muted">
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
                      className="input input-boxed min-h-[9rem] resize-y text-[15px] leading-relaxed"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        'What stayed with you?',
                        'What did it remind you of?',
                        'Which scene?',
                        'How did it end for you?',
                      ].map((prompt) => (
                        <span key={prompt} className="text-[14px] text-paper-muted">
                          · {prompt}
                        </span>
                      ))}
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
                          className="chip h-8 text-[13px]"
                          data-active={draft.feltLike === mood}
                        >
                          {MOODS[mood].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <p className="border-l border-[#c07a66] bg-[#c07a66]/10 px-3 py-2 text-[15px] text-[#e8b2a2]">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
                    <button type="button" onClick={submit} className="btn btn-primary">
                      <Sparkles size={14} />
                      {editRecord ? 'Save & re-analyse' : 'Analyse this memory'}
                    </button>
                    <span className="text-[14px] text-paper-muted">
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
          <div className="relative hidden overflow-hidden border-r border-white/12 lg:block">
            <FilmPoster film={selected} />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute left-0 right-0 h-24 animate-scan bg-gradient-to-b from-transparent via-paper/20 to-transparent" />
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <p className="micro text-paper/90">Reading</p>
              <p className="mt-2 font-display text-[32px] leading-tight text-paper">{selected.title}</p>
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-10">
            <p className="micro text-paper-dim">Local analysis</p>
            <h2 id="add-film-title" className="mt-3 font-display text-[2.5rem] leading-none text-paper">
              Listening to what you wrote.
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-paper-dim">
              No model is being called. Five deterministic passes run over your note, rating, and
              the archive.
            </p>

            <ol className="mt-9 space-y-1">
              {ANALYSIS_STAGES.map((stage, index) => {
                const done = index < activeStage
                const active = index === activeStage
                return (
                  <li
                    key={stage.id}
                    className={cn(
                      'flex items-start gap-4 border-l py-3 pl-4 transition-all duration-500',
                      done
                        ? 'border-paper/30 opacity-70'
                        : active
                          ? 'border-paper bg-paper/[0.04]'
                          : 'border-white/10 opacity-40',
                    )}
                  >
                    <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center border border-current text-[12.5px]">
                      {done ? (
                        <Check size={12} className="text-paper" />
                      ) : active ? (
                        <Loader2 size={12} className="animate-spin text-paper" />
                      ) : (
                        <span className="font-mono text-paper-muted">{index + 1}</span>
                      )}
                    </span>
                    <span>
                      <span
                        className={cn(
                          'block text-[15px]',
                          active ? 'text-paper' : done ? 'text-paper-dim' : 'text-paper-muted',
                        )}
                      >
                        {stage.label}
                        <span className="text-paper-muted"> ·</span>
                      </span>
                      <span className="mt-1 block text-[15px] leading-relaxed text-paper-dim">
                        {stage.detail}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>

            <div className="mt-8">
              <div className="bar-track bar-track--dark">
                <div
                  className="bar-fill bar-fill--dark"
                  style={{
                    width: `${Math.max(4, ((activeStage + 1) / ANALYSIS_STAGES.length) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 font-mono text-[13px] tracking-[0.14em] text-paper-dim">
                {Math.min(activeStage + 1, ANALYSIS_STAGES.length)} / {ANALYSIS_STAGES.length} PASSES
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 'result' && selected && pending && (
        <div className="flex flex-1 flex-col">
          <div className="border-b border-white/12 p-5 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="micro text-paper-dim">Step five · written</p>
                <h2
                  id="add-film-title"
                  className="mt-3 font-display text-[2.5rem] leading-none text-paper sm:text-[3.2rem]"
                >
                  {selected.title} is in the archive.
                </h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-paper-dim">
                  {pending.result.summary}
                </p>
              </div>
              <div className="flex items-center gap-6 border-l border-white/12 pl-6">
                <div>
                  <p className="micro-sm text-paper-muted">Confidence</p>
                  <p className="num mt-1 text-[26px] text-paper">
                    {Math.round(pending.result.confidenceBefore * 100)}
                    <span className="text-paper"> →</span>
                    {Math.round(pending.result.confidenceAfter * 100)}
                    <span className="ml-0.5 text-[15px] text-paper-muted">%</span>
                  </p>
                </div>
                <div>
                  <p className="micro-sm text-paper-muted">Archive</p>
                  <p className="num mt-1 text-[26px] text-paper">
                    {String(records.length).padStart(2, '0')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_1fr_0.9fr]">
            <div className="border-b border-white/12 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="micro text-paper-muted">Extracted from your note</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {pending.result.themes.length > 0 ? (
                  pending.result.themes.map((theme: ThemeId) => (
                    <span key={theme} className="tag border-paper/30 bg-paper/[0.06] text-paper">
                      {THEMES[theme].label}{' '}
                      <span className="text-paper-muted">{THEMES[theme].zh}</span>
                    </span>
                  ))
                ) : (
                  <p className="text-[15px] text-paper-dim">
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
                          <span className="flex items-center gap-2 font-display text-[18px] text-paper">
                            {connection.title}
                            <ArrowRight
                              size={12}
                              className="text-paper-muted transition-transform group-hover:translate-x-0.5"
                            />
                          </span>
                          <span className="mt-1 block text-[15px] leading-relaxed text-paper-dim">
                            {connection.reason}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[15px] leading-relaxed text-paper-dim">
                    This is the first film of its kind here. The graph will grow around it.
                  </p>
                )}
              </div>
            </div>

            <div className="border-b border-white/12 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="micro text-paper-muted">What moved</p>
              <ul className="mt-5 space-y-5">
                {pending.result.findings.map((finding) => {
                  const delta = finding.after - finding.before
                  const def = DIMENSION_MAP[finding.dimension]
                  return (
                    <li key={finding.key}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[14px] uppercase tracking-[0.12em] text-paper-dim">
                          {def.label}
                        </span>
                        <span
                          className={cn(
                            'font-mono text-[13px] tabular-nums',
                            Math.abs(delta) < 0.01
                              ? 'text-paper-muted'
                              : delta > 0
                                ? 'text-paper-soft'
                                : 'text-[#a8bfba]',
                          )}
                        >
                          {delta > 0 ? '+' : ''}
                          {Math.round(delta * 100)} pts
                        </span>
                      </div>
                      <p className="mt-1 text-[15px] leading-snug text-paper">{finding.headline}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="font-mono text-[12.5px] text-paper-muted">
                          {Math.round(finding.before * 100)}
                        </span>
                        <div className="bar-track bar-track--dark flex-1">
                          <div
                            className="bar-fill bar-fill--dark"
                            style={{ width: `${Math.round(finding.after * 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-[12.5px] text-paper-dim">
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
                  <p className="mt-2 text-[14px] leading-relaxed text-paper-dim">
                    Dashed: before this film. Solid: after {records.length} films.
                  </p>
                  <p className="mt-2 font-mono text-[12.5px] uppercase tracking-[0.1em] text-paper-muted">
                    Six axes · recomputed locally
                  </p>
                </div>
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-paper-muted">
                {pending.result.findings.every((f) => Math.abs(f.after - f.before) < 0.02)
                  ? 'This film confirmed your existing shape more than it bent it. The confidence reading still moved, because the archive now holds more evidence.'
                  : 'Values are positions on each pole axis, recomputed from every record. They are estimates of preference, not a score of taste.'}
              </p>
            </div>

            <div className="flex flex-col p-5 sm:p-7">
              <div className="border border-white/10 p-4">
                <p className="micro text-paper-dim">The frame</p>
                <div className="mt-3 aspect-[2/3] w-full max-w-[170px]">
                  <FilmPoster film={selected} showTitle={false} />
                </div>
                <p className="mt-3 text-[13px] uppercase tracking-[0.14em] text-paper-dim">
                  {formatLongDate(pending.record.watchedAt)} ·{' '}
                  {STATUS_LABELS[pending.record.status].label}
                </p>
                <Rating value={pending.record.rating} className="mt-2" />
              </div>

              <div className="mt-auto space-y-2 pt-6">
                <button type="button" onClick={() => goTo('/taste')} className="btn btn-primary w-full">
                  See My Taste <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(`/archive/${selected.id}`)}
                  className="btn btn-ghost w-full"
                >
                  Open the memory
                </button>
                <button type="button" onClick={reset} className="btn btn-quiet w-full">
                  <Plus size={13} /> Add another film
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}