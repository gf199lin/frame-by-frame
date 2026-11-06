import { Link } from 'react-router-dom'
import { Bookmark, Star } from 'lucide-react'
import type { Film, WatchRecord } from '@/types'
import { STATUS_LABELS } from '@/data/taxonomy'
import { cn, formatRating, formatShortDate } from '@/lib/format'
import { FilmPoster } from './FilmPoster'
import { FilmStill } from './FilmStill'
import { Rating } from '../ui/Rating'

const statusText = (record: WatchRecord) =>
  record.status === 'rewatched' ? 'Rewatch' : record.status === 'abandoned' ? 'Unfinished' : 'Watched'

/**
 * The shelf entry: a wide memory frame, a hairline, then a small typographic
 * block. No card, no border box — the photograph does the work.
 */
export const FilmCard = ({
  film,
  record,
  index,
  className,
  size = 'default',
}: {
  film: Film
  record: WatchRecord
  index?: number
  className?: string
  size?: 'default' | 'large'
}) => {
  return (
    <Link
      to={`/archive/${film.id}`}
      className={cn('group block', className)}
      aria-label={`${film.title}, ${film.year}, rated ${record.rating} out of 5`}
    >
      <div className="relative">
        <FilmStill film={film} ratio="photo" />

        {typeof index === 'number' && (
          <span className="pointer-events-none absolute left-0 top-0 bg-paper/85 px-2 py-1 font-mono text-[9px] tracking-[0.18em] text-ink/70 backdrop-blur-sm">
            {String(index).padStart(3, '0')}
          </span>
        )}

        <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          <div className="flex items-center justify-between">
            <span className="micro-sm text-paper/75">{STATUS_LABELS[record.status].label}</span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-paper/80">
              <Star size={9} className="fill-brass text-brass" /> {formatRating(record.rating)}
            </span>
          </div>
          <div>
            <p className="line-clamp-3 font-display text-[1.15rem] leading-snug text-paper/90">
              {record.reflection}
            </p>
            <span className="micro-sm mt-3 inline-flex items-center gap-1.5 text-paper">
              <Bookmark size={10} /> Open memory
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3 border-t border-ink/15 pt-2.5">
        <div className="min-w-0">
          <h3
            className={cn(
              'truncate font-display leading-tight text-ink transition-colors group-hover:text-taupe',
              size === 'large' ? 'text-[1.55rem]' : 'text-[1.15rem]',
            )}
          >
            {film.title}
          </h3>
          <p className="mt-1 truncate text-[9.5px] uppercase tracking-[0.14em] text-taupe">
            {film.director} · {film.year}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Rating value={record.rating} size={9} />
          <p className="mt-1.5 font-mono text-[9px] tracking-[0.1em] text-taupe">
            {formatShortDate(record.watchedAt)}
          </p>
        </div>
      </div>
    </Link>
  )
}

export const FilmIndexRow = ({
  film,
  record,
  index,
}: {
  film: Film
  record: WatchRecord
  index: number
}) => (
  <Link
    to={`/archive/${film.id}`}
    className="group grid grid-cols-[2rem_4.5rem_1fr_auto] items-center gap-3 border-b border-ink/12 py-4 transition-colors hover:bg-ink/[0.03] sm:grid-cols-[3.5rem_7rem_1fr_8rem_7rem] sm:gap-4"
  >
    <span className="font-mono text-[9px] tracking-[0.16em] text-taupe">
      {String(index).padStart(3, '0')}
    </span>
    <span className="relative block h-14 w-full overflow-hidden sm:h-16">
      <FilmStill film={film} ratio="free" className="h-full w-full" />
    </span>
    <span className="min-w-0">
      <span className="block truncate font-display text-[1.15rem] text-ink group-hover:text-taupe">
        {film.title}
      </span>
      <span className="mt-0.5 block truncate text-[10px] uppercase tracking-[0.12em] text-taupe">
        {film.director} · {film.year} · {film.genres.join(' / ')}
      </span>
    </span>
    <span className="justify-self-end sm:justify-self-start">
      <Rating value={record.rating} size={9} showValue />
    </span>
    <span className="hidden text-right font-mono text-[9px] uppercase tracking-[0.12em] text-taupe sm:block">
      {formatShortDate(record.watchedAt)}
      <span className="mt-1 flex items-center justify-end gap-1 text-[8px] text-taupe">
        <span className="status-dot" />
        {statusText(record)}
      </span>
    </span>
  </Link>
)

export const WaitingRoomCard = ({
  film,
  onPick,
}: {
  film: Film
  onPick: () => void
}) => (
  <button type="button" onClick={onPick} className="group block text-left">
    <div className="relative">
      <FilmStill film={film} ratio="photo" className="opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-ink/60 px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-paper/75 backdrop-blur">
        To be seen
        <span className="text-brass">+</span>
      </span>
    </div>
    <div className="mt-2.5 border-t border-ink/12 pt-2">
      <p className="truncate font-display text-[1.05rem] leading-tight text-ink/70 transition-colors group-hover:text-ink">
        {film.title}
      </p>
      <p className="mt-0.5 truncate text-[9px] uppercase tracking-[0.12em] text-taupe/80">
        {film.year} · {film.director}
      </p>
    </div>
  </button>
)

export { FilmPoster }
