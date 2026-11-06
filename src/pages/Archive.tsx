import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Plus, Search, X } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { FilmCard, FilmIndexRow, WaitingRoomCard } from '@/components/film/FilmCard'
import { FilmStill } from '@/components/film/FilmStill'
import { EmptyState } from '@/components/ui/Primitives'
import { Rating } from '@/components/ui/Rating'
import { Reveal } from '@/components/ui/Reveal'
import { STATUS_LABELS } from '@/data/taxonomy'
import { cn, formatLongDate, formatMinutes } from '@/lib/format'
import { filmById } from '@/lib/tasteEngine'
import type { WatchStatus } from '@/types'

type SortKey = 'recent' | 'added' | 'rating' | 'title' | 'year' | 'runtime'

const SORT_LABELS: Record<SortKey, string> = {
  recent: 'Recently watched',
  added: 'Recently added',
  rating: 'Highest rated',
  title: 'Title A–Z',
  year: 'Release year',
  runtime: 'Longest film',
}

export const Archive = () => {
  const { records, films, snapshot } = useAppStore()
  const { openAdd } = useAddFilm()

  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('all')
  const [decade, setDecade] = useState('all')
  const [rating, setRating] = useState('all')
  const [status, setStatus] = useState<'all' | WatchStatus>('all')
  const [sort, setSort] = useState<SortKey>('recent')
  const [view, setView] = useState<'grid' | 'index'>('grid')

  const entries = useMemo(
    () =>
      records.flatMap((record) => {
        const film = filmById(films, record.filmId)
        return film ? [{ record, film }] : []
      }),
    [records, films],
  )

  const catalogOnly = useMemo(
    () => films.filter((film) => film.catalogOnly && !records.some((record) => record.filmId === film.id)),
    [films, records],
  )

  const genres = useMemo(() => {
    const set = new Set<string>()
    entries.forEach(({ film }) => film.genres.forEach((g) => set.add(g)))
    return Array.from(set).sort()
  }, [entries])

  const decades = useMemo(() => {
    const set = new Set<number>()
    entries.forEach(({ film }) => set.add(Math.floor(film.year / 10) * 10))
    return Array.from(set).sort((a, b) => b - a)
  }, [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = entries.filter(({ record, film }) => {
      if (q) {
        const haystack = `${film.title} ${film.titleZh} ${film.director} ${film.year} ${film.genres.join(' ')} ${record.reflection}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (genre !== 'all' && !film.genres.includes(genre)) return false
      if (decade !== 'all' && Math.floor(film.year / 10) * 10 !== Number(decade)) return false
      if (rating !== 'all' && record.rating < Number(rating)) return false
      if (status !== 'all' && record.status !== status) return false
      return true
    })

    return list.sort((a, b) => {
      switch (sort) {
        case 'added':
          return b.record.createdAt.localeCompare(a.record.createdAt)
        case 'rating':
          return b.record.rating - a.record.rating || b.film.year - a.film.year
        case 'title':
          return a.film.title.localeCompare(b.film.title)
        case 'year':
          return b.film.year - a.film.year
        case 'runtime':
          return b.film.runtime - a.film.runtime
        default:
          return b.record.watchedAt.localeCompare(a.record.watchedAt)
      }
    })
  }, [entries, query, genre, decade, rating, status, sort])

  const activeFilters =
    (query ? 1 : 0) +
    (genre !== 'all' ? 1 : 0) +
    (decade !== 'all' ? 1 : 0) +
    (rating !== 'all' ? 1 : 0) +
    (status !== 'all' ? 1 : 0)

  const clearAll = () => {
    setQuery('')
    setGenre('all')
    setDecade('all')
    setRating('all')
    setStatus('all')
  }

  if (records.length === 0) {
    return (
      <div className="shell py-20">
        <p className="kicker">02 / My Archive</p>
        <h1 className="display-xl mt-5">Nothing catalogued yet.</h1>
        <EmptyState
          className="mt-12"
          title="The shelves are empty."
          description="Your archive is a list of films you have actually finished, abandoned, or returned to. Start with one."
          action={
            <button type="button" onClick={() => openAdd()} className="btn btn-primary">
              <Plus size={14} /> Add a film
            </button>
          }
        />
      </div>
    )
  }

  const featured = activeFilters === 0 && filtered.length > 0 ? filtered[0] : null
  const shelf = featured ? filtered.slice(1) : filtered

  return (
    <div>
      {/* ================================================================ */}
      {/*  Masthead                                                         */}
      {/* ================================================================ */}
      <section className="chapter--paper">
        <div className="shell pt-10 lg:pt-14">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="artifact-label">
              <b>02</b> My archive
            </p>
            <p className="folio">
              {String(records.length).padStart(2, '0')} films kept · local storage
            </p>
          </div>

          <div className="mt-6 grid grid-cols-12 items-end gap-x-6 gap-y-8 border-b border-ink/10 pb-8">
            <div className="col-span-12 lg:col-span-8">
              <h1 className="font-display text-[clamp(3rem,7.6vw,6.8rem)] leading-[0.86] tracking-[-0.03em]">
                The archive.
              </h1>
              <div className="mt-5 flex flex-wrap items-baseline gap-x-5 gap-y-2">
                <p className="zh-title text-[15px] text-ink/75">电影收藏</p>
                <span className="hidden h-3 w-px bg-white/20 sm:block" />
                <p className="measure text-[14px] leading-relaxed text-taupe">
                  Every film you kept, with the date, the rating, and the paragraph you wrote after
                  the credits. Search it like a memory, not a spreadsheet.
                </p>
              </div>
            </div>

            <div className="col-span-12 flex flex-wrap items-end justify-between gap-8 lg:col-span-4 lg:justify-end">
              <div>
                <p className="micro-sm text-taupe">Average rating</p>
                <p className="num mt-1.5 text-[2.6rem] leading-none text-ink">
                  {snapshot.averageRating.toFixed(1)}
                  <span className="ml-1 text-[15px] text-taupe">/ 5</span>
                </p>
                <Rating value={snapshot.averageRating} size={9} className="mt-2" />
              </div>
              <div>
                <p className="micro-sm text-taupe">Time in the dark</p>
                <p className="num mt-1.5 text-[2.6rem] leading-none text-ink">
                  {(snapshot.totalMinutes / 60).toFixed(1)}
                  <span className="ml-1 text-[15px] text-taupe">h</span>
                </p>
                <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.14em] text-taupe">
                  {formatMinutes(snapshot.totalMinutes)}
                </p>
              </div>
            </div>
          </div>

          {/* Search line */}
          <div className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
            <label className="group flex flex-1 items-center gap-4">
              <Search size={17} className="shrink-0 text-taupe" strokeWidth={1.4} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles, directors, notes, moods…"
                className="w-full border-b border-ink/20 bg-transparent pb-2 font-display text-[1.35rem] text-ink outline-none placeholder:text-taupe/45 focus:border-brass focus-visible:outline-none sm:text-[1.6rem]"
                aria-label="Search the archive"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="text-taupe hover:text-ink"
                >
                  <X size={14} />
                </button>
              )}
            </label>

            <div className="flex shrink-0 flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-taupe">Sort</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortKey)}
                  className="select-mini select-bare w-[168px]"
                  aria-label="Sort films"
                >
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <option key={key} value={key}>
                      {SORT_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-3 border-l border-ink/15 pl-4">
                {(['grid', 'index'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setView(mode)}
                    aria-label={`${mode} view`}
                    aria-pressed={view === mode}
                    className={cn(
                      'relative pb-1 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors',
                      view === mode ? 'text-ink' : 'text-taupe hover:text-ink',
                    )}
                  >
                    {mode === 'grid' ? 'Shelf' : 'Index'}
                    <span
                      className={cn(
                        'absolute inset-x-0 bottom-0 h-px bg-brass transition-transform duration-400',
                        view === mode ? 'scale-x-100' : 'scale-x-0',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Filters — text, not pills */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-ink/10 py-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-taupe">Genre</span>
            {['all', ...genres].map((g) => {
              const active = genre === g
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenre(g === 'all' ? 'all' : genre === g ? 'all' : g)}
                  className={cn(
                    'relative pb-0.5 text-[12px] uppercase tracking-[0.16em] transition-colors',
                    active ? 'text-ink' : 'text-taupe/65 hover:text-ink',
                  )}
                  aria-pressed={active}
                >
                  {g === 'all' ? 'All' : g}
                  <span
                    className={cn(
                      'absolute inset-x-0 -bottom-[2px] h-px bg-brass transition-transform',
                      active ? 'scale-x-100' : 'scale-x-0',
                    )}
                  />
                </button>
              )
            })}

            <span className="mx-1 hidden h-3 w-px bg-white/15 sm:block" />

            <select
              value={decade}
              onChange={(event) => setDecade(event.target.value)}
              className="select-mini select-bare"
              aria-label="Filter by decade"
            >
              <option value="all">All decades</option>
              {decades.map((d) => (
                <option key={d} value={String(d)}>
                  {d}s
                </option>
              ))}
            </select>
            <select
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              className="select-mini select-bare"
              aria-label="Filter by minimum rating"
            >
              <option value="all">Any rating</option>
              <option value="3.5">3.5 and up</option>
              <option value="4">4.0 and up</option>
              <option value="4.5">4.5 and up</option>
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as 'all' | WatchStatus)}
              className="select-mini select-bare"
              aria-label="Filter by status"
            >
              <option value="all">Any status</option>
              {(Object.keys(STATUS_LABELS) as WatchStatus[]).map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABELS[key].label}
                </option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-4">
              <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-taupe">
                {filtered.length} {filtered.length === 1 ? 'film' : 'films'}
              </span>
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass underline underline-offset-4 hover:text-brass-soft"
                >
                  Clear ({activeFilters})
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  Featured film — full-bleed frame                                 */}
      {/* ================================================================ */}
      {featured && (
        <section className="chapter--ink">
          <div className="shell pb-14 pt-10 lg:pb-20">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
                <p className="artifact-label">
                  <b>Featured</b> The film at the centre of the shelf
                </p>
                <Link to={`/archive/${featured.film.id}`} className="link-rule text-brass hover:text-brass-soft">
                  Open the entry <ArrowUpRight size={12} />
                </Link>
              </div>

              <Link to={`/archive/${featured.film.id}`} className="group relative block">
                <FilmStill
                  film={featured.film}
                  ratio="wide"
                  className="w-full lg:h-[58vh] lg:max-h-[620px]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/95 via-ink/55 to-ink/5" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 lg:p-10">
                  <div className="flex flex-wrap items-end justify-between gap-6">
                    <div className="max-w-3xl">
                      <p className="micro-sm text-paper/60">
                        {formatLongDate(featured.record.watchedAt)} · {STATUS_LABELS[featured.record.status].label}
                      </p>
                      <h2 className="mt-2 font-display text-[clamp(2rem,4.6vw,4.2rem)] leading-[0.94] tracking-[-0.02em] text-paper">
                        {featured.film.title}
                      </h2>
                      <p className="mt-2 text-[12.5px] uppercase tracking-[0.2em] text-paper/60">
                        {featured.film.director} · {featured.film.year} · {featured.film.genres.join(' / ')}
                      </p>
                      <p className="mt-4 line-clamp-2 max-w-xl font-display text-[1.05rem] italic leading-snug text-paper/70">
                        “{featured.record.reflection}”
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <Rating value={featured.record.rating} size={13} showValue />
                      <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.16em] text-paper/60">
                        {featured.film.runtime} min
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            </Reveal>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/*  The shelf                                                        */}
      {/* ================================================================ */}
      <section className="chapter--paper border-t border-ink/10">
        <div className="shell py-12 lg:py-16">
          {filtered.length === 0 ? (
            <EmptyState
              eyebrow="No matches"
              title="Nothing in the archive answers to that."
              description="Try a looser search, or add the film if it is missing."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <button type="button" onClick={clearAll} className="btn btn-ghost">
                    Clear filters
                  </button>
                  <button type="button" onClick={() => openAdd()} className="btn btn-primary">
                    <Plus size={13} /> Add a film
                  </button>
                </div>
              }
            />
          ) : view === 'grid' ? (
            <>
              <Reveal>
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink/10 pb-4">
                  <p className="artifact-label">
                    <b>{featured ? '02' : '01'}</b> The shelf
                  </p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-taupe">
                    Click a frame to read the note
                  </p>
                </div>
              </Reveal>

              <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
                {shelf.map(({ record, film }, index) => (
                  <Reveal key={record.id} delay={(index % 4) * 45}>
                    <FilmCard
                      film={film}
                      record={record}
                      index={index + (featured ? 2 : 1)}
                      className={index % 4 === 2 ? 'lg:translate-y-8' : ''}
                    />
                  </Reveal>
                ))}
              </div>

              <button
                type="button"
                onClick={() => openAdd()}
                className="group mt-16 flex w-full items-center justify-between gap-4 border-t border-ink/10 pt-5 text-left"
              >
                <span className="flex items-center gap-5">
                  <Plus size={20} strokeWidth={1} className="text-brass transition-transform group-hover:rotate-90" />
                  <span>
                    <span className="block font-display text-[1.5rem] leading-none text-ink">
                      Add a film to the archive
                    </span>
                    <span className="mt-1.5 block font-mono text-[11px] uppercase tracking-[0.2em] text-taupe">
                      A new frame, a new note, a new reading
                    </span>
                  </span>
                </span>
                <span className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-brass sm:block">
                  Open the entry form →
                </span>
              </button>
            </>
          ) : (
            <div>
              <div className="hidden grid-cols-[3.5rem_7rem_1fr_8rem_7rem] gap-4 border-b border-ink/20 pb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-taupe sm:grid">
                <span>No.</span>
                <span>Frame</span>
                <span>Film</span>
                <span>Rating</span>
                <span className="text-right">Watched</span>
              </div>
              {filtered.map(({ record, film }, index) => (
                <FilmIndexRow key={record.id} film={film} record={record} index={index + 1} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ================================================================ */}
      {/*  The waiting room                                                 */}
      {/* ================================================================ */}
      {catalogOnly.length > 0 && (
        <section className="chapter--paper border-t border-ink/10">
          <div className="shell py-14 lg:py-20">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-4">
                <div>
                  <p className="artifact-label">
                    <b>Not yet archived</b>
                  </p>
                  <h2 className="mt-3 t-head">The waiting room.</h2>
                </div>
                <p className="max-w-sm text-[13px] leading-relaxed text-taupe">
                  Films already in the catalogue, waiting for a memory. Open one to record it.
                </p>
              </div>
            </Reveal>

            <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
              {catalogOnly.map((film, i) => (
                <Reveal key={film.id} delay={(i % 6) * 40}>
                  <WaitingRoomCard film={film} onPick={() => openAdd(film.id)} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="chapter--night border-t border-paper/10">
        <div className="shell flex flex-wrap items-center justify-between gap-4 py-8">
          <p className="text-[13px] text-paper-dim">
            Looking for a film that is not here?{' '}
            <button
              type="button"
              onClick={() => openAdd()}
              className="text-paper underline decoration-paper/40 underline-offset-4 hover:text-paper/80"
            >
              Add it to the archive
            </button>
            .
          </p>
          <Link to="/map" className="link-rule text-paper-dim hover:text-paper">
            See them as a memory map <ArrowRight size={12} />
          </Link>
        </div>
      </section>
    </div>
  )
}
