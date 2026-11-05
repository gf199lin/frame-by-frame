import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, List, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { FilmCard, FilmIndexRow } from '@/components/film/FilmCard'
import { FilmPoster } from '@/components/film/FilmPoster'
import { EmptyState } from '@/components/ui/Primitives'
import { Rating } from '@/components/ui/Rating'
import { STATUS_LABELS } from '@/data/taxonomy'
import { cn, formatMinutes } from '@/lib/format'
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
      <div className="mx-auto max-w-shell px-5 py-20 lg:px-10">
        <p className="micro text-brass">02 / My Archive</p>
        <h1 className="display-xl mt-4">Nothing catalogued yet.</h1>
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

  return (
    <div className="mx-auto max-w-shell px-5 pb-20 pt-12 lg:px-10 lg:pt-16">
      <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
        <div>
          <div className="flex items-center gap-3">
            <p className="micro text-brass">02 / My Archive</p>
            <span className="h-px w-8 bg-brass" />
            <p className="micro text-paper-muted">{records.length} films kept</p>
          </div>
          <h1 className="display-hero mt-5">The archive.</h1>
          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-paper-dim">
            Every film you have kept, with the date, the rating, and the paragraph you wrote after
            the credits. Search it like a memory, not a spreadsheet.
            <span className="mt-1 block text-paper-muted">你的全部电影记忆，按时间与情绪归档。</span>
          </p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-8 lg:justify-end">
          <div>
            <p className="micro-sm text-paper-muted">Average rating</p>
            <p className="num mt-1 text-4xl leading-none text-paper">
              {snapshot.averageRating.toFixed(1)}
              <span className="ml-1 text-sm text-paper-muted">/ 5</span>
            </p>
            <Rating value={snapshot.averageRating} size={10} className="mt-2" />
          </div>
          <div>
            <p className="micro-sm text-paper-muted">Time in the dark</p>
            <p className="num mt-1 text-4xl leading-none text-paper">
              {(snapshot.totalMinutes / 60).toFixed(1)}
              <span className="ml-1 text-sm text-paper-muted">h</span>
            </p>
            <p className="mt-2 text-[10px] text-paper-muted">{formatMinutes(snapshot.totalMinutes)}</p>
          </div>
          <button type="button" onClick={() => openAdd()} className="btn btn-primary">
            <Plus size={14} /> Add a Film
          </button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="mt-12 border-y border-white/10 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <label className="flex flex-1 items-center gap-3 border-b border-white/20 pb-2 focus-within:border-brass">
            <Search size={15} className="text-paper-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, directors, notes, moods…"
              className="w-full bg-transparent text-[14px] text-paper outline-none placeholder:text-paper-muted/50 focus-visible:outline-none"
              aria-label="Search the archive"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="text-paper-muted hover:text-paper">
                <X size={13} />
              </button>
            )}
          </label>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="hidden text-[9px] uppercase tracking-[0.16em] text-paper-muted sm:inline">
                Sort
              </span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="select-mini w-[172px]"
                aria-label="Sort films"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex shrink-0 border border-white/15">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-label="Grid view"
                aria-pressed={view === 'grid'}
                className={cn('flex h-8 w-8 items-center justify-center transition-colors', view === 'grid' ? 'bg-brass text-white' : 'text-paper-muted hover:text-paper')}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                type="button"
                onClick={() => setView('index')}
                aria-label="Index view"
                aria-pressed={view === 'index'}
                className={cn('flex h-8 w-8 items-center justify-center transition-colors', view === 'index' ? 'bg-brass text-white' : 'text-paper-muted hover:text-paper')}
              >
                <List size={13} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 hidden items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-paper-muted sm:flex">
            <SlidersHorizontal size={11} /> Genre
          </span>
          <button
            type="button"
            onClick={() => setGenre('all')}
            className="chip h-8 text-[9px]"
            data-active={genre === 'all'}
          >
            All
          </button>
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(genre === g ? 'all' : g)}
              className="chip h-8 text-[9px]"
              data-active={genre === g}
            >
              {g}
            </button>
          ))}

          <span className="mx-2 hidden h-4 w-px bg-white/15 sm:block" />

          <select
            value={decade}
            onChange={(event) => setDecade(event.target.value)}
            className="select-mini"
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
            className="select-mini"
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
            className="select-mini"
            aria-label="Filter by status"
          >
            <option value="all">Any status</option>
            {(Object.keys(STATUS_LABELS) as WatchStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS_LABELS[key].label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[11px] text-paper-muted">
            <span>{filtered.length} {filtered.length === 1 ? 'film' : 'films'}</span>
            {activeFilters > 0 && <span>· filtered</span>}
            <span className="hidden items-center gap-1.5 sm:inline-flex">
              <span className="status-dot" /> watched / <span className="text-paper-dim">rewatch</span>
            </span>
          </div>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[9px] uppercase tracking-[0.16em] text-paper-muted underline underline-offset-4 hover:text-paper"
            >
              Clear filters ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          className="mt-12"
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
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map(({ record, film }, index) => (
              <FilmCard
                key={record.id}
                film={film}
                record={record}
                index={index + 1}
                className={index % 7 === 3 ? 'lg:translate-y-8' : ''}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => openAdd()}
            className="group mt-12 flex w-full items-center justify-between gap-4 border border-dashed border-white/20 px-5 py-4 text-left transition-colors hover:border-brass hover:bg-white/[0.02]"
          >
            <span className="flex items-center gap-4">
              <Plus size={18} strokeWidth={1} className="text-brass transition-transform group-hover:scale-110" />
              <span>
                <span className="block font-display text-xl text-paper">Add a film to the archive</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-paper-muted">
                  A new frame, a new note, a new reading
                </span>
              </span>
            </span>
            <span className="micro text-brass">Open the entry form →</span>
          </button>

          <p className="mt-8 text-center text-[10px] uppercase tracking-[0.18em] text-paper-muted/60">
            Click any poster to read the note, the themes, and how it sits in your taste
          </p>
        </>
      ) : (
        <div className="mt-8">
          <div className="hidden grid-cols-[3.5rem_7rem_1fr_8rem_7rem] gap-4 border-b border-white/20 pb-2 text-[9px] uppercase tracking-[0.18em] text-paper-muted sm:grid">
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

      {/* The waiting room — catalogue titles not yet archived */}
      {catalogOnly.length > 0 && (
        <section className="mt-20 border-t border-white/10 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="micro text-brass">Not yet archived</p>
              <h2 className="mt-3 font-display text-4xl text-paper sm:text-5xl">The waiting room.</h2>
            </div>
            <p className="max-w-sm text-[11px] leading-relaxed text-paper-muted">
              Films already in the catalogue, waiting for a memory. Open one to record it.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
            {catalogOnly.map((film) => (
              <button
                key={film.id}
                type="button"
                onClick={() => openAdd(film.id)}
                className="poster-hover group text-left"
              >
                <div className="relative aspect-[2/3] overflow-hidden border border-white/10 opacity-80 transition-opacity group-hover:opacity-100">
                  <FilmPoster film={film} showTitle={false} />
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-paper/80 backdrop-blur">
                    To be seen <Plus size={10} className="text-brass" />
                  </span>
                </div>
                <div className="mt-3 border-t border-white/10 pt-2">
                  <p className="truncate font-display text-base text-paper group-hover:text-brass-soft">
                    {film.title}
                  </p>
                  <p className="mt-1 truncate text-[9px] uppercase tracking-[0.12em] text-paper-muted">
                    {film.year} · {film.director}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
        <p className="text-[11px] text-paper-muted">
          Looking for a film that is not here?{' '}
          <button
            type="button"
            onClick={() => openAdd()}
            className="text-brass underline underline-offset-4 hover:text-brass-soft"
          >
            Add it to the archive
          </button>
          .
        </p>
        <Link to="/map" className="micro text-paper-dim hover:text-paper">
          See them as a memory map →
        </Link>
      </div>
    </div>
  )
}
