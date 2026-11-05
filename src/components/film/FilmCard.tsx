import { Link } from 'react-router-dom'
import { Bookmark, Star } from 'lucide-react'
import type { Film, WatchRecord } from '@/types'
import { STATUS_LABELS } from '@/data/taxonomy'
import { cn, formatRating, formatShortDate } from '@/lib/format'
import { FilmPoster } from './FilmPoster'
import { Rating } from '../ui/Rating'

export const FilmCard = ({
  film,
  record,
  index,
  className,
}: {
  film: Film
  record: WatchRecord
  index?: number
  className?: string
}) => {
  return (
    <Link
      to={`/archive/${film.id}`}
      className={cn('poster-hover group block', className)}
      aria-label={`${film.title}, ${film.year}, rated ${record.rating} out of 5`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <FilmPoster film={film} />
        {typeof index === 'number' && (
          <span className="absolute left-3 top-0 -translate-y-1/2 bg-ink px-2 font-mono text-[10px] tracking-[0.18em] text-brass">
            {String(index).padStart(2, '0')}
          </span>
        )}
        <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/85 via-black/10 to-transparent p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          <div className="flex items-center justify-between">
            <span className="micro-sm text-paper/80">
              {STATUS_LABELS[record.status].label}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-paper/80">
              <Star size={10} className="fill-brass text-brass" /> {formatRating(record.rating)}
            </span>
          </div>
          <div>
            <p className="line-clamp-3 font-display text-lg leading-snug text-paper/90">
              {record.reflection}
            </p>
            <span className="micro-sm mt-3 inline-flex items-center gap-1.5 text-brass">
              <Bookmark size={10} /> Open memory
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 border-t border-white/10 pt-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 min-h-[2.4em] font-display text-[1.05rem] leading-tight text-paper transition-colors group-hover:text-brass-soft">
            {film.title}
          </h3>
          <p className="mt-1 truncate text-[11px] text-paper-muted">
            {film.director} · {film.year}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Rating value={record.rating} size={9} />
          <p className="mt-1 font-mono text-[9px] tracking-[0.1em] text-paper-muted">
            {formatShortDate(record.watchedAt)}
          </p>
          <p className="mt-0.5 flex items-center justify-end gap-1 font-mono text-[8px] uppercase tracking-[0.12em] text-brass/70">
            <span className="status-dot" />
            {record.status === 'rewatched' ? 'Rewatch' : record.status === 'abandoned' ? 'Unfinished' : 'Watched'}
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
    className="group grid grid-cols-[2rem_3rem_1fr_auto] items-center gap-3 border-b border-white/10 py-4 transition-colors hover:bg-white/[0.025] sm:grid-cols-[3.5rem_7rem_1fr_8rem_7rem] sm:gap-4"
  >
    <span className="font-mono text-[10px] tracking-[0.16em] text-paper-muted">
      {String(index).padStart(3, '0')}
    </span>
    <span className="relative block h-16 w-12 overflow-hidden sm:h-20 sm:w-14">
      <FilmPoster film={film} showTitle={false} />
    </span>
    <span className="min-w-0">
      <span className="block truncate font-display text-lg text-paper group-hover:text-brass-soft">
        {film.title}
      </span>
      <span className="mt-0.5 block truncate text-[11px] text-paper-muted">
        {film.director} · {film.year} · {film.genres.join(' / ')}
      </span>
    </span>
    <span className="justify-self-end sm:justify-self-start">
      <Rating value={record.rating} size={9} showValue />
    </span>
    <span className="hidden text-right font-mono text-[9px] uppercase tracking-[0.12em] text-paper-muted sm:block">
      {formatShortDate(record.watchedAt)}
      <span className="mt-1 flex items-center justify-end gap-1 text-[8px] text-brass/70">
        <span className="status-dot" />
        {record.status === 'rewatched' ? 'Rewatch' : record.status === 'abandoned' ? 'Unfinished' : 'Watched'}
      </span>
    </span>
  </Link>
)
