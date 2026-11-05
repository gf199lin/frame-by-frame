import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Plus, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { FilmPoster } from '@/components/film/FilmPoster'
import { FilmCard } from '@/components/film/FilmCard'
import { Rating } from '@/components/ui/Rating'
import { TasteRadar } from '@/components/taste/TasteRadar'
import { EmptyState, SectionLabel, TextLink } from '@/components/ui/Primitives'
import {
  filmById,
  favoriteRecord,
  recordsSorted,
  summarizeTaste,
  tasteSignature,
} from '@/lib/tasteEngine'
import { THEMES } from '@/data/taxonomy'
import { formatLongDate, formatMinutes, percent } from '@/lib/format'

export const Home = () => {
  const { records, films, snapshot } = useAppStore()
  const { openAdd } = useAddFilm()

  const ordered = recordsSorted(records)
  const latest = ordered[0] ? { record: ordered[0], film: filmById(films, ordered[0].filmId) } : null
  const recent = ordered.slice(1, 5).flatMap((record) => {
    const film = filmById(films, record.filmId)
    return film ? [{ record, film }] : []
  })
  const recentCards = ordered.slice(0, 5).flatMap((record) => {
    const film = filmById(films, record.filmId)
    return film ? [{ record, film }] : []
  })
  const favourite = favoriteRecord(records, films)
  const favouriteFilm = favourite ? filmById(films, favourite.filmId) : null
  const themeCount = new Set(records.flatMap((r) => r.themes)).size
  const hours = snapshot.totalMinutes / 60
  const year = new Date().getFullYear()

  const strongest = [...snapshot.dimensionScores].sort(
    (a, b) => b.strength * (0.5 + b.confidence) - a.strength * (0.5 + a.confidence),
  )[0]
  const summary = summarizeTaste(snapshot)

  if (records.length === 0) {
    return (
      <div className="relative isolate overflow-hidden bg-ink">
        <img
          src="/images/hero-cinema.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 hero-vignette" />
        <div className="relative mx-auto max-w-shell px-5 py-24 lg:px-10 lg:py-32">
          <p className="micro text-brass">Frame by Frame · A private cinema archive</p>
          <h1 className="display-hero mt-6 max-w-4xl">
            Every film leaves a frame.
            <br />
            <span className="italic text-paper-dim">Every frame tells your story.</span>
          </h1>
          <p className="mt-7 max-w-lg text-[13px] leading-relaxed text-paper-dim">
            An independent archive of what you watched, what stayed, and what it says about you.
            <span className="mt-2 block text-paper-muted">不只是观影记录，而是一座属于你的电影记忆档案馆。</span>
          </p>
          <EmptyState
            className="mt-14 max-w-2xl border-white/15"
            eyebrow="The archive is empty"
            title="Your first frame is missing."
            description="Add a film you have actually watched, write a paragraph in your own words, and watch the archive start to read you back."
            action={
              <button type="button" onClick={() => openAdd()} className="btn btn-primary">
                <Plus size={14} /> Add the first film
              </button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ------------------------------------------------------------------ */}
      {/*  Cover / brand hero                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative isolate overflow-hidden border-b border-white/10 bg-ink">
        <img
          src="/images/hero-cinema.jpg"
          alt="A lone viewer in a dark cinema, crossed by a red projector beam"
          className="absolute inset-0 h-full w-full object-cover object-[64%_center] opacity-90"
          loading="eager"
        />
        <div className="absolute inset-0 hero-vignette" />

        <div className="relative mx-auto flex min-h-[calc(100vh-74px)] max-w-shell flex-col px-5 pt-8 lg:px-10 lg:pt-10">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/15 pb-4">
            <p className="micro text-paper/80">Frame by Frame</p>
            <span className="h-px w-8 bg-brass" />
            <p className="micro text-paper-muted">A private cinema archive</p>
            <p className="ml-auto font-mono text-[10px] tracking-[0.16em] text-paper-muted">
              VOL. 01 / {year}
            </p>
          </div>

          <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16 lg:py-16">
            <div>
              <p className="micro text-brass">Every film leaves a frame</p>
              <h1 className="display-hero mt-5 max-w-4xl text-balance">
                Every film
                <br />
                leaves a <span className="italic text-brass">frame.</span>
                <br />
                Every frame
                <br />
                tells your <span className="italic">story.</span>
              </h1>
              <p className="mt-7 max-w-lg text-[13px] leading-relaxed text-paper-dim">
                An independent archive of what you watched, what stayed, and what it says about you.
                Not a watchlist. Not a rating site. A room for the films that became part of your
                memory.
                <span className="mt-2 block text-paper-muted">
                  不只是观影记录，而是一座属于你的电影记忆档案馆。
                </span>
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => openAdd()} className="btn btn-primary">
                  <Plus size={14} /> Record a film
                </button>
                <Link to="/archive" className="btn btn-ghost">
                  Enter the archive <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {latest && latest.film && (
              <div className="hidden lg:block">
                <Link to={`/archive/${latest.film.id}`} className="group ml-auto block w-full max-w-[286px]">
                  <div className="mb-3 flex items-center justify-between border-b border-white/20 pb-2">
                    <span className="micro-sm flex items-center gap-2 text-paper-muted">
                      <span className="status-dot" /> Now showing
                    </span>
                    <span className="font-mono text-[9px] tracking-[0.16em] text-brass">
                      LATEST FRAME · NO. {String(records.length).padStart(3, '0')}
                    </span>
                  </div>
                  <div className="poster-hover relative aspect-[2/3] overflow-hidden border border-white/25 shadow-[0_35px_100px_rgba(0,0,0,0.65)]">
                    <FilmPoster film={latest.film} eager />
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-4 border-t border-white/15 pt-3">
                    <div>
                      <p className="font-display text-2xl leading-none text-paper">{latest.film.title}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-paper-muted">
                        {latest.film.director} · {latest.film.year}
                      </p>
                    </div>
                    <Rating value={latest.record.rating} size={11} showValue />
                  </div>
                  <p className="mt-3 line-clamp-2 font-display text-[15px] italic leading-snug text-paper-dim">
                    “{latest.record.reflection}”
                  </p>
                </Link>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/15 py-5 sm:grid-cols-4">
            {[
              { label: 'Films kept', value: String(records.length).padStart(2, '0'), sub: 'in the archive', red: true },
              { label: 'Hours in the dark', value: hours.toFixed(1), sub: formatMinutes(snapshot.totalMinutes) },
              { label: 'Themes found', value: String(themeCount).padStart(2, '0'), sub: 'cross-referenced' },
              {
                label: 'AI confidence',
                value: `${Math.round(snapshot.overallConfidence * 100)}%`,
                sub: 'an estimate, not a verdict',
              },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="micro-sm text-paper-muted">{stat.label}</dt>
                <dd className={`num mt-2 text-3xl leading-none ${stat.red ? 'text-brass' : 'text-paper'}`}>
                  {stat.value}
                </dd>
                <dd className="mt-1.5 text-[10px] text-paper-muted/70">{stat.sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Latest frame / paper interlude                                     */}
      {/* ------------------------------------------------------------------ */}
      {latest && latest.film && (
        <section className="paper-section relative overflow-hidden border-b border-ink/15">
          <div className="mx-auto max-w-shell px-5 py-16 lg:px-10 lg:py-24">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-4">
              <div>
                <p className="micro text-brass">01 / The latest frame</p>
                <p className="mt-2 font-mono text-[10px] tracking-[0.16em] text-ink/45">
                  ARCHIVE NO. {String(records.length).padStart(3, '0')}
                </p>
              </div>
              <p className="font-mono text-[10px] tracking-[0.14em] text-ink/50">
                {formatLongDate(latest.record.watchedAt)}
              </p>
            </div>

            <div className="mt-10 grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
              <div className="relative mx-auto w-full max-w-[320px] lg:mx-0 lg:ml-8">
                <span className="absolute -left-5 top-0 hidden h-full w-px bg-brass lg:block" />
                <Link to={`/archive/${latest.film.id}`} className="poster-hover group block">
                  <div className="aspect-[2/3] overflow-hidden border border-ink/15">
                    <FilmPoster film={latest.film} />
                  </div>
                </Link>
                <div className="mt-3 flex items-center justify-between border-t border-ink/15 pt-3">
                  <span className="font-mono text-[9px] tracking-[0.16em] text-ink/50">
                    FRAME {String(records.length).padStart(3, '0')}
                  </span>
                  <Rating value={latest.record.rating} size={11} showValue tone="light" />
                </div>
              </div>

              <div className="flex flex-col justify-center">
                <p className="micro text-brass">
                  {latest.record.status === 'rewatched'
                    ? 'Returned to'
                    : latest.record.status === 'abandoned'
                      ? 'Left unfinished'
                      : 'Watched'}{' '}
                  · {formatLongDate(latest.record.watchedAt)}
                </p>
                <Link to={`/archive/${latest.film.id}`} className="group">
                  <h2 className="mt-3 max-w-4xl font-display text-5xl leading-[0.95] text-ink transition-colors group-hover:text-brass sm:text-6xl lg:text-7xl">
                    {latest.film.title}
                  </h2>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-ink/55">
                    {latest.film.director} · {latest.film.year} · {latest.film.genres.join(' / ')}
                  </p>
                </Link>

                <blockquote className="mt-8 max-w-3xl border-l border-brass pl-5">
                  <p className="font-display text-2xl leading-[1.35] text-ink/85 sm:text-3xl">
                    “{latest.record.reflection}”
                  </p>
                </blockquote>

                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <Rating value={latest.record.rating} size={13} showValue tone="light" />
                  <span className="h-3 w-px bg-ink/20" />
                  <span className="text-[11px] text-ink/60">
                    {latest.record.themes
                      .slice(0, 3)
                      .map((t) => THEMES[t]?.label)
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>

                <Link
                  to={`/archive/${latest.film.id}`}
                  className="link-underline mt-7 w-fit text-[10px] uppercase tracking-[0.18em] text-brass"
                >
                  Read the full entry <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/*  Recent frames                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="overflow-hidden bg-ink">
        <div className="mx-auto max-w-shell px-5 py-16 lg:px-10 lg:py-24">
          <div className="flex items-end justify-between gap-6">
            <div>
              <SectionLabel index="02">Recent frames</SectionLabel>
              <p className="mt-4 max-w-md text-[12px] leading-relaxed text-paper-muted">
                Five frames from the last few months. Every one carries a note and a rating the
                archive has already read.
              </p>
            </div>
            <TextLink to="/archive" className="hidden sm:inline-flex">
              The whole archive
            </TextLink>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {recentCards.map(({ record, film }, index) => (
              <FilmCard
                key={record.id}
                film={film}
                record={record}
                index={index + 1}
                className={index % 2 === 1 ? 'lg:translate-y-10' : ''}
              />
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
            <div>
              <p className="micro text-paper-muted">Recently watched</p>
              <p className="mt-2 text-[12px] text-paper-dim">
                {recent.length > 0
                  ? recent
                      .map(({ film }) => film.title)
                      .slice(0, 3)
                      .join(' · ')
                  : 'Your next frame is waiting.'}
              </p>
            </div>
            <TextLink to="/archive" className="sm:hidden">
              All films
            </TextLink>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  The reading / paper interlude                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="paper-section border-y border-ink/15">
        <div className="mx-auto max-w-shell px-5 py-16 lg:px-10 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-20">
            <div className="relative flex flex-col items-center justify-center border-b border-ink/15 pb-10 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-16">
              <p className="micro-sm mb-5 text-ink/40">Six axes · one archive</p>
              <div className="relative w-full">
                <TasteRadar snapshot={snapshot} size={380} tone="light" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="num text-5xl leading-none text-ink">
                    {Math.round(snapshot.overallConfidence * 100)}
                    <span className="text-lg text-ink/50">%</span>
                  </p>
                  <p className="micro-sm mt-1 text-ink/50">confidence</p>
                </div>
              </div>
            </div>

            <div>
              <p className="micro flex items-center gap-2 text-brass">
                <Sparkles size={11} /> 03 / What the archive is learning
              </p>
              <h2 className="mt-4 max-w-2xl font-display text-4xl leading-[1.02] text-ink sm:text-5xl">
                {tasteSignature(snapshot)}
              </h2>
              <p className="mt-5 max-w-xl text-[13px] leading-relaxed text-ink/70">
                {summary[0]} {summary[1] ?? ''}
              </p>

              <div className="mt-8 grid gap-6 border-t border-ink/15 pt-5 sm:grid-cols-2">
                <div>
                  <p className="micro-sm text-ink/50">Strongest signal</p>
                  <p className="mt-2 font-display text-2xl text-ink">
                    {strongest ? strongest.def.label : 'Still listening'}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink/60">
                    {strongest
                      ? `${strongest.def.labelZh} · ${percent(
                          strongest.value < 0.5 ? 1 - strongest.value : strongest.value,
                        )} toward ${strongest.value < 0.5 ? strongest.def.low : strongest.def.high}.`
                      : 'Add a few more notes and a direction will emerge.'}
                  </p>
                </div>

                {snapshot.topThemes.length > 0 && (
                  <div>
                    <p className="micro-sm text-ink/50">Themes you return to</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {snapshot.topThemes.slice(0, 4).map((theme) => (
                        <span key={theme.id} className="tag border-ink/20 text-ink/70">
                          {THEMES[theme.id].label}
                          <span className="text-ink/40">{theme.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-ink/15 pt-4">
                <TextLink to="/taste" className="text-ink hover:text-brass">Read the full taste profile</TextLink>
                <p className="max-w-sm text-[10px] leading-relaxed text-ink/45">
                  Computed locally from ratings, note depth, and recurring themes. No external model
                  was called.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Keep the reel going                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-ink">
        <div className="mx-auto grid max-w-shell items-center gap-10 px-5 py-16 lg:grid-cols-[1fr_auto] lg:px-10 lg:py-24">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
            {favouriteFilm && (
              <div className="hidden w-[96px] shrink-0 sm:block">
                <div className="aspect-[2/3] overflow-hidden border border-white/15 opacity-90">
                  <FilmPoster film={favouriteFilm} showTitle={false} />
                </div>
              </div>
            )}
            <div>
              <p className="micro text-brass">Keep the reel going</p>
              <h2 className="mt-3 max-w-2xl font-display text-4xl leading-[1.02] text-paper sm:text-5xl">
                What did you watch last night?
              </h2>
              <p className="mt-3 max-w-md text-[12px] leading-relaxed text-paper-muted">
                One film, one honest paragraph. The archive updates everywhere at once.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => openAdd()} className="btn btn-primary">
              <Plus size={14} /> Add a film
            </button>
            <Link to="/reflection" className="btn btn-ghost">
              See the annual <ArrowRight size={13} />
            </Link>
          </div>
        </div>
        <div className="overflow-hidden border-t border-white/10 py-3">
          <div className="flex w-max animate-marquee items-center gap-8 whitespace-nowrap">
            {[...ordered, ...ordered].map((record, i) => {
              const film = filmById(films, record.filmId)
              if (!film) return null
              return (
                <span
                  key={`${record.id}-${i}`}
                  className="flex items-center gap-8 text-[10px] uppercase tracking-[0.2em] text-paper-muted/70"
                >
                  {film.title}
                  <span className="text-brass">✳</span>
                </span>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
