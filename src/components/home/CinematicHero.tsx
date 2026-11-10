import { Link } from 'react-router-dom'
import { ArrowDown, ArrowRight, Plus } from 'lucide-react'
import { FilmStill } from '@/components/film/FilmStill'
import type { Film } from '@/types'

export type HeroStats = {
  films: number
  themes: number
  hours: number
}

type CinematicHeroProps = {
  film: Film | null
  stats: HeroStats
  year: number
  empty?: boolean
  onAdd?: () => void
}

/**
 * Cinematic overlay cover.
 *
 * The still is the page furniture: a wide 21:9 frame with the title set inside
 * its lower-left corner. No cream card, no floating poster, no side-by-side
 * personal-intro layout. The frame is responsive (4:3 → 16:9 → 21:9) so the
 * overlay copy never crowds the picture on phones.
 */
export const CinematicHero = ({ film, stats, year, empty = false, onAdd }: CinematicHeroProps) => {
  const statItems = [
    { label: 'Films', value: String(stats.films) },
    { label: 'Themes', value: String(stats.themes) },
    { label: 'Hours', value: stats.hours.toFixed(1) },
  ]

  return (
    <section className="relative">
      <div className="shell pt-7 sm:pt-9 lg:pt-11">
        {/* Masthead — brand only, held together by a single hairline. */}
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-ink/15 pb-3.5">
          <span className="micro-sm text-ink/60">Frame by Frame</span>
          <span className="hidden h-3 w-px bg-ink/20 sm:block" aria-hidden="true" />
          <span className="hidden text-[11.5px] uppercase tracking-[0.14em] text-taupe sm:inline">
            私人电影记忆博物馆
          </span>
          <span className="folio ml-auto text-taupe">Vol. 01 / {year}</span>
        </div>

        <p className="mt-5 font-display text-[clamp(1.08rem,1.6vw,1.38rem)] italic leading-snug text-ink/70 sm:mt-6">
          A private museum of the films that stayed.
        </p>

        <figure className="relative mt-5 overflow-hidden rounded-[6px] bg-ocean-deep sm:mt-7">
          {film ? (
            <FilmStill
              film={film}
              ratio="free"
              eager
              position="50% 70%"
              className="hero-still__media aspect-[4/3] w-full sm:aspect-[16/9] lg:aspect-[21/9]"
            />
          ) : (
            <div className="hero-still__media aspect-[4/3] w-full bg-ocean-deep sm:aspect-[16/9] lg:aspect-[21/9]" />
          )}

          <div className="hero-scrim pointer-events-none absolute inset-0 z-20" aria-hidden="true" />

          <figcaption className="hero-copy absolute inset-x-0 bottom-0 z-30 px-5 pb-5 pt-20 sm:px-7 sm:pb-7 lg:px-10 lg:pb-9 lg:pt-24">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper-sheet/65 sm:text-[10.5px]">
              {film ? `Cover still — ${film.title}, ${film.year}` : 'Cover still'}
            </p>

            <h1 className="hero-title mt-2.5 font-display text-[clamp(2.1rem,4.1vw,3.7rem)] leading-[0.98] tracking-[-0.022em]">
              Every Film
              <br />
              Leaves a Frame.
            </h1>

            <p className="mt-2.5 font-display text-[clamp(0.98rem,1.25vw,1.16rem)] italic text-paper-sheet/80">
              Every frame tells your story.
            </p>

            {empty ? (
              <button
                type="button"
                onClick={onAdd}
                className="mt-4 inline-flex items-center gap-2.5 border-b border-paper-sheet/35 pb-1.5 pt-0.5 font-mono text-[10.5px] uppercase tracking-[0.2em] text-paper-sheet/85 transition-colors duration-300 hover:border-paper-sheet hover:text-paper-sheet sm:mt-5"
              >
                Add your first film
                <Plus size={13} strokeWidth={1.6} />
              </button>
            ) : (
              <Link
                to="/archive"
                className="group/entry mt-4 inline-flex items-center gap-2.5 border-b border-paper-sheet/35 pb-1.5 pt-0.5 font-mono text-[10.5px] uppercase tracking-[0.2em] text-paper-sheet/85 transition-colors duration-300 hover:border-paper-sheet hover:text-paper-sheet sm:mt-5"
              >
                Explore my cinema
                <ArrowRight
                  size={13}
                  strokeWidth={1.6}
                  className="transition-transform duration-300 group-hover/entry:translate-x-0.5"
                />
              </Link>
            )}
          </figcaption>
        </figure>

        {/* Light index bar under the still — no box, no counters on the left. */}
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-ink/15 pt-3.5 sm:mt-5">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            {statItems.map((item) => (
              <span
                key={item.label}
                className="text-[10.5px] uppercase tracking-[0.16em] text-taupe"
              >
                <b className="num mr-1.5 text-[12.5px] font-normal tracking-normal text-ink">
                  {item.value}
                </b>
                {item.label}
              </span>
            ))}
          </div>

          {empty ? (
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-taupe/70">
              Waiting for the first frame
            </span>
          ) : (
            <a
              href="#latest"
              className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-taupe transition-colors hover:text-ink"
            >
              Scroll to explore
              <ArrowDown size={12} strokeWidth={1.6} />
            </a>
          )}
        </div>

        {empty && (
          <div className="mt-7 max-w-[44rem] border-l border-ink/20 pl-5">
            <p className="zh-prose text-ink/75">
              这里会收藏你看过的电影、写下的感受，以及它们慢慢显现出的审美偏好。不是待看清单，而是一座属于你的电影记忆博物馆。
            </p>
          </div>
        )}
      </div>
    </section>
  )
}

