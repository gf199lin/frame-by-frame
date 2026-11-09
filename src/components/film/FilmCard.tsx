import { Link } from 'react-router-dom'
import { Bookmark, Star } from 'lucide-react'
import type { Film, WatchRecord } from '@/types'
import { STATUS_LABELS, zhGenres } from '@/data/taxonomy'
import { directorOf } from '@/data/filmCopy'
import { cn, formatRating, formatShortDate } from '@/lib/format'
import { FilmPoster } from './FilmPoster'
import { Rating } from '../ui/Rating'

const statusText = (record: WatchRecord) =>
  record.status === 'rewatched' ? '重看' : record.status === 'abandoned' ? '未看完' : '看过'

/**
 * The shelf entry: a real poster mounted like a print, a caption below.
 * No dashboard card — the artwork carries the memory.
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
      aria-label={`${film.title}，${film.year}，评分 ${record.rating} 分（满分 5 分）`}
    >
      <div className="mount">
        <div className="relative aspect-[2/3] overflow-hidden rounded-[4px] bg-ink/90">
          <FilmPoster film={film} showTitle={false} />

          {typeof index === 'number' && (
            <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-paper-sheet/90 px-2 py-0.5 font-mono text-[10.5px] tracking-[0.12em] text-ink/80 backdrop-blur-sm">
              {String(index).padStart(3, '0')}
            </span>
          )}

          <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-ink/90 via-ink/55 to-transparent p-3 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] tracking-[0.04em] text-paper/80">{STATUS_LABELS[record.status].zh}</span>
              <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-paper/85">
                <Star size={9} className="fill-sand text-sand" /> {formatRating(record.rating)}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-3 font-zh-body text-[12.5px] leading-[1.75] text-paper/90">
              {record.reflection}
            </p>
            <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] tracking-[0.05em] text-paper">
              <Bookmark size={10} /> 查看观影记忆
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3.5 border-t border-ink/10 pt-2.5">
        <h3
          className={cn(
            'line-clamp-2 font-display leading-tight text-ink transition-colors group-hover:text-ocean',
            size === 'large' ? 'text-[1.5rem]' : 'text-[1.12rem]',
          )}
        >
          {film.title}
        </h3>
        {film.titleZh && (
          <p className="mt-0.5 line-clamp-1 text-[12.5px] tracking-[0.03em] text-ink/60">{film.titleZh}</p>
        )}
        <p className="mt-1 line-clamp-1 text-[11.5px] tracking-[0.03em] text-taupe">
          {directorOf(film)} · {film.year}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Rating value={record.rating} size={8} />
          <p className="shrink-0 font-mono text-[11px] tracking-[0.03em] text-taupe">
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
    className="group grid grid-cols-[2rem_2.6rem_1fr_auto] items-center gap-3 border-b border-ink/10 py-3.5 transition-colors hover:bg-ink/[0.025] sm:grid-cols-[3.5rem_3rem_1fr_8rem_7rem] sm:gap-4"
  >
    <span className="font-mono text-[11.5px] tracking-[0.12em] text-taupe">
      {String(index).padStart(3, '0')}
    </span>
    <span className="relative block aspect-[2/3] w-full overflow-hidden rounded-[2px]">
      <FilmPoster film={film} showTitle={false} />
    </span>
    <span className="min-w-0">
      <span className="block truncate font-display text-[1.12rem] text-ink group-hover:text-ocean">
        {film.title}
      </span>
      {film.titleZh && (
        <span className="mt-0.5 block truncate text-[12px] tracking-[0.03em] text-ink/55">
          {film.titleZh}
        </span>
      )}
      <span className="mt-0.5 block truncate text-[11.5px] tracking-[0.03em] text-taupe">
        {directorOf(film)} · {film.year} · {zhGenres(film.genres)}
      </span>
    </span>
    <span className="justify-self-end sm:justify-self-start">
      <Rating value={record.rating} size={9} showValue />
    </span>
    <span className="hidden text-right font-mono text-[11.5px] tracking-[0.03em] text-taupe sm:block">
      {formatShortDate(record.watchedAt)}
      <span className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-taupe">
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
    <div className="mount">
      <div className="relative aspect-[2/3] overflow-hidden rounded-[4px]">
        <div className="h-full w-full opacity-80 transition-opacity duration-500 group-hover:opacity-100">
          <FilmPoster film={film} showTitle={false} />
        </div>
        <span className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-full bg-paper-sheet/90 px-2.5 py-1 text-[10.5px] tracking-[0.03em] text-ink/75 backdrop-blur">
          待收录
          <span className="text-ocean">+</span>
        </span>
      </div>
    </div>
    <div className="mt-2.5 border-t border-ink/10 pt-2">
      <p className="truncate font-display text-[1.02rem] leading-tight text-ink/85 transition-colors group-hover:text-ink">
        {film.title}
      </p>
      {film.titleZh && (
        <p className="truncate text-[12px] tracking-[0.03em] text-ink/55">{film.titleZh}</p>
      )}
      <p className="mt-0.5 truncate text-[11.5px] tracking-[0.03em] text-taupe/80">
        {film.year} · {directorOf(film)}
      </p>
    </div>
  </button>
)

export { FilmPoster }
