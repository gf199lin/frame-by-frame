import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Plus, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { FilmPoster } from '@/components/film/FilmPoster'
import { FilmStill } from '@/components/film/FilmStill'
import { Rating } from '@/components/ui/Rating'
import { TasteRadar } from '@/components/taste/TasteRadar'
import { Reveal } from '@/components/ui/Reveal'
import { EmptyState } from '@/components/ui/Primitives'
import {
  filmById,
  favoriteRecord,
  recordsSorted,
  summarizeTaste,
  tasteSignature,
} from '@/lib/tasteEngine'
import { THEMES } from '@/data/taxonomy'
import { formatLongDate, formatMinutes, percent } from '@/lib/format'
import { frameSrc } from '@/lib/media'
import { backdropOf } from '@/lib/artwork'

const ISSUE = [
  { no: '01', label: 'The latest frame', zh: '最新一帧', href: '#latest' },
  { no: '02', label: 'Recent frames', zh: '最近的帧', href: '#recent' },
  { no: '03', label: 'Notes from the dark', zh: '暗房笔记', href: '#notes' },
  { no: '04', label: 'The reading', zh: '审美解读', href: '#reading' },
]

export const Home = () => {
  const { records, films, snapshot } = useAppStore()
  const { openAdd } = useAddFilm()

  const ordered = recordsSorted(records)
  const latest = ordered[0] ? { record: ordered[0], film: filmById(films, ordered[0].filmId) } : null
  const recentCards = ordered.slice(0, 5).flatMap((record) => {
    const film = filmById(films, record.filmId)
    return film ? [{ record, film }] : []
  })
  const recent = recentCards.slice(1)
  const favourite = favoriteRecord(records, films)
  const favouriteFilm = favourite ? filmById(films, favourite.filmId) : null
  const themeCount = new Set(records.flatMap((r) => r.themes)).size
  const hours = snapshot.totalMinutes / 60
  const year = new Date().getFullYear()

  const strongest = [...snapshot.dimensionScores].sort(
    (a, b) => b.strength * (0.5 + b.confidence) - a.strength * (0.5 + a.confidence),
  )[0]
  const summary = summarizeTaste(snapshot)

  // A real backdrop for the cover. If the newest film only has a poster, fall
  // back to the first catalogue film with a verified TMDB backdrop.
  const coverFilm =
    latest?.film && backdropOf(latest.film) ? latest.film : films.find((f) => backdropOf(f))

  if (records.length === 0) {
    return (
      <div className="relative isolate overflow-hidden bg-ink text-paper [--brass:#e9e0d0]">
        <img
          src={frameSrc('manchester')}
          alt="Manchester by the Sea (2016) — official backdrop"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 hero-vignette" />
        <div className="shell relative py-24 lg:py-32">
          <p className="kicker">Frame by Frame · A private cinema archive</p>
          <h1 className="display-hero mt-7 max-w-4xl">
            Every film leaves a frame.
            <br />
            <span className="italic text-paper-dim">Every frame tells your story.</span>
          </h1>
          <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-paper-dim">
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
      {/* ================================================================ */}
      {/*  COVER                                                            */}
      {/* ================================================================ */}
      <section className="relative isolate overflow-hidden bg-ink text-paper [--brass:#e9e0d0]">
        <img
          src={coverFilm ? frameSrc(coverFilm) : frameSrc('manchester')}
          alt={
            coverFilm
              ? `${coverFilm.title} (${coverFilm.year}) — official backdrop`
              : 'Official film backdrop'
          }
          className="absolute inset-0 h-full w-full object-cover object-[58%_center]"
          style={{ filter: 'brightness(1.05) saturate(0.92) contrast(1.02)' }}
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 cover-scrim" />

        <div className="shell relative flex min-h-[calc(100vh-69px)] flex-col">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/15 py-3">
            <span className="micro-sm text-paper/70">Frame by Frame</span>
            <span className="h-px w-10 bg-paper/60" />
            <span className="micro-sm text-paper-muted">A private cinema archive</span>
            <span className="folio ml-auto">
              Vol. 01 — {year}
            </span>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-y-12 py-12 lg:grid-cols-12 lg:items-center lg:gap-x-6 lg:py-16">
            <div className="lg:col-span-8">
              <p className="kicker">Every film leaves a frame</p>
              <h1 className="mt-6 font-display text-[clamp(2.7rem,9.2vw,8.6rem)] leading-[0.86] tracking-[-0.03em] text-balance">
                Every film
                <br />
                leaves a <span className="italic text-paper">frame.</span>
              </h1>

              <div className="mt-9 flex max-w-[46rem] flex-col gap-5 border-t border-white/20 pt-5 lg:flex-row lg:items-start lg:gap-8">
                <p className="t-lead w-full max-w-[27rem] text-paper-dim">
                  An archive of what you watched, what stayed, and what it says about you. Not a
                  watchlist. Not a rating site. A room for the films that became part of your memory.
                </p>
                <p className="zh-label max-w-[13rem] text-[13px] leading-[2] text-paper-dim">
                  不只是观影记录，
                  <br />
                  而是一座属于你的
                  <br />
                  电影记忆档案馆。
                </p>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => openAdd()} className="btn btn-primary">
                  <Plus size={14} /> Record a film
                </button>
                <Link to="/archive" className="btn btn-ghost border-paper/45 text-paper hover:border-paper/75">
                  Enter the archive <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            {latest?.film && (
              <div className="w-full max-w-[240px] lg:col-span-3 lg:col-start-10 lg:max-w-none">
                <Link to={`/archive/${latest.film.id}`} className="group block">
                  <div className="mb-3 flex items-baseline justify-between border-b border-white/20 pb-2">
                    <span className="micro-sm flex items-center gap-2 text-paper-muted">
                      <span className="status-dot" /> Now showing
                    </span>
                    <span className="folio text-brass">
                      No. {String(records.length).padStart(3, '0')}
                    </span>
                  </div>
                  <div className="aspect-[2/3] w-full max-w-[240px] overflow-hidden shadow-[0_40px_110px_rgba(0,0,0,0.7)] lg:ml-auto">
                    <FilmPoster film={latest.film} showTitle={false} eager />
                  </div>
                  <div className="mt-4 max-w-[240px] border-t border-white/15 pt-3 lg:ml-auto">
                    <p className="font-display text-xl leading-tight text-paper">{latest.film.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-paper-muted">
                        {formatLongDate(latest.record.watchedAt)}
                      </p>
                      <Rating value={latest.record.rating} size={10} showValue />
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 py-4">
            <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-paper-muted">
              {String(records.length).padStart(2, '0')} films
              <span className="mx-2 text-white/25">/</span>
              {hours.toFixed(1)} hours in the dark
              <span className="mx-2 text-white/25">/</span>
              {String(themeCount).padStart(2, '0')} themes
            </p>
            <p className="font-mono text-[12px] uppercase tracking-[0.22em] text-paper-muted/60">
              Scroll to enter ↓
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  ISSUE CONTENTS                                                   */}
      {/* ================================================================ */}
      <section className="chapter--paper border-b border-ink/10">
        <div className="shell">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {ISSUE.map((item, i) => (
              <a
                key={item.no}
                href={item.href}
                className={`group flex items-baseline justify-between gap-3 border-ink/10 py-5 pr-4 transition-colors hover:text-ink ${
                  i === 0 ? 'lg:border-l-0' : 'border-l'
                } ${i < 2 ? 'border-b lg:border-b-0' : ''} ${i % 2 === 1 ? 'border-l' : ''} pl-4 lg:pl-6`}
              >
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-brass">{item.no}</span>
                  <span>
                    <span className="block font-display text-[1.35rem] leading-none text-ink/75 transition-colors group-hover:text-ink">
                      {item.label}
                    </span>
                    <span className="zh-label mt-1.5 block text-[12px] text-taupe">
                      {item.zh}
                    </span>
                  </span>
                </span>
                <ArrowUpRight
                  size={13}
                  className="shrink-0 text-taupe/40 transition-all group-hover:-translate-y-0.5 group-hover:text-brass"
                />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  01 — THE COVER STORY                                             */}
      {/* ================================================================ */}
      {latest?.film && (
        <section id="latest" className="chapter--paper">
          <div className="shell pt-16 lg:pt-24">
            <Reveal>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-4">
                <div>
                  <p className="artifact-label">
                    <b>01</b> The cover story
                  </p>
                  <h2 className="mt-4 t-head">The latest frame.</h2>
                </div>
                <div className="text-right">
                  <p className="folio">Frame no. {String(records.length).padStart(3, '0')}</p>
                  <p className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.18em] text-ink/75">
                    {formatLongDate(latest.record.watchedAt)}
                  </p>
                </div>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <Link to={`/archive/${latest.film.id}`} className="group block">
                <FilmStill
                  film={latest.film}
                  ratio="wide"
                  className="w-full lg:h-[54vh] lg:max-h-[600px]"
                  label={`${latest.film.year} · ${latest.film.director}`}
                />
              </Link>
            </Reveal>

            <Reveal delay={120}>
              <div className="mt-8 grid grid-cols-12 gap-x-6 gap-y-8 pb-16 lg:pb-24">
                <div className="col-span-12 sm:col-span-3">
                  <p className="micro-sm text-taupe">Watched</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink/75">
                    {formatLongDate(latest.record.watchedAt)}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <Rating value={latest.record.rating} size={12} showValue />
                  </div>
                  <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.16em] text-brass/80">
                    {latest.record.status === 'rewatched'
                      ? 'A return'
                      : latest.record.status === 'abandoned'
                        ? 'Left unfinished'
                        : 'First viewing'}
                  </p>
                </div>

                <div className="col-span-12 sm:col-span-9 lg:col-span-7 lg:col-start-5">
                  <Link to={`/archive/${latest.film.id}`} className="group">
                    <h3 className="font-display text-[clamp(2.2rem,4.4vw,3.8rem)] leading-[0.98] tracking-[-0.02em] text-ink transition-colors group-hover:text-taupe">
                      {latest.film.title}
                    </h3>
                  </Link>
                  <p className="mt-2.5 text-[12px] uppercase tracking-[0.2em] text-taupe">
                    {latest.film.director} · {latest.film.year} · {latest.film.genres.join(' / ')}
                  </p>

                  <blockquote className="mt-7 border-l border-brass pl-5">
                    <p className="dropcap font-display text-[clamp(1.35rem,2.1vw,1.85rem)] leading-[1.45] text-ink/80">
                      {latest.record.reflection}
                    </p>
                  </blockquote>

                  <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <span className="text-[13px] text-taupe">
                      {latest.record.themes
                        .slice(0, 3)
                        .map((t) => THEMES[t]?.label)
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <Link
                      to={`/archive/${latest.film.id}`}
                      className="link-rule ml-auto text-brass hover:text-brass-soft"
                    >
                      Read the full entry <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/*  02 — RECENT FRAMES                                               */}
      {/* ================================================================ */}
      <section id="recent" className="chapter--paper border-y border-ink/10">
        <div className="shell py-16 lg:py-24">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-4">
              <div>
                <p className="artifact-label">
                  <b>02</b> Recent frames
                </p>
                <h2 className="mt-4 t-head">What the last months kept.</h2>
              </div>
              <Link to="/archive" className="link-rule text-ink/75 hover:text-ink">
                The whole archive <ArrowRight size={12} />
              </Link>
            </div>
          </Reveal>

          {/* Asymmetric three-up spread */}
          <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-10">
            {recent.slice(0, 1).map(({ record, film }) => (
              <Reveal key={record.id} delay={0} className="col-span-12 lg:col-span-7">
                <Link to={`/archive/${film.id}`} className="group block">
                  <FilmStill film={film} ratio="photo" />
                  <div className="mt-4 flex items-start justify-between gap-4 border-t border-ink/10 pt-3">
                    <div>
                      <h3 className="font-display text-[1.75rem] leading-tight text-ink transition-colors group-hover:text-taupe">
                        {film.title}
                      </h3>
                      <p className="mt-1 text-[12.5px] uppercase tracking-[0.16em] text-taupe">
                        {film.director} · {film.year}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Rating value={record.rating} size={10} />
                      <p className="mt-1.5 font-mono text-[12px] tracking-[0.12em] text-taupe">
                        {formatLongDate(record.watchedAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}

            <div className="col-span-12 flex flex-col gap-10 lg:col-span-4 lg:col-start-9 lg:pt-16">
              {recent.slice(1, 3).map(({ record, film }, i) => (
                <Reveal key={record.id} delay={80 + i * 60}>
                  <Link to={`/archive/${film.id}`} className="group block">
                    <FilmStill film={film} ratio="photo" />
                    <div className="mt-3 flex items-start justify-between gap-3 border-t border-ink/10 pt-2.5">
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-[1.2rem] leading-tight text-ink transition-colors group-hover:text-taupe">
                          {film.title}
                        </h3>
                        <p className="mt-0.5 truncate text-[12px] uppercase tracking-[0.14em] text-taupe">
                          {film.year} · {film.genres[0]}
                        </p>
                      </div>
                      <Rating value={record.rating} size={9} />
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>

            {recent.slice(3, 4).map(({ record, film }) => (
              <Reveal key={record.id} delay={40} className="col-span-8 col-start-1 lg:col-span-5 lg:col-start-2">
                <Link to={`/archive/${film.id}`} className="group block lg:-mt-6">
                  <FilmStill film={film} ratio="photo" />
                  <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-ink/10 pt-2.5">
                    <h3 className="font-display text-[1.2rem] leading-tight text-ink transition-colors group-hover:text-taupe">
                      {film.title}
                    </h3>
                    <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-taupe">
                      {film.year}
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}

            {recent.slice(4, 5).map(({ record, film }) => (
              <Reveal key={record.id} delay={80} className="col-span-12 sm:col-span-8 sm:col-start-5 lg:col-span-4 lg:col-start-9">
                <Link to={`/archive/${film.id}`} className="group flex items-center gap-4 border-t border-ink/10 pt-4">
                  <span className="relative block h-16 w-24 shrink-0 overflow-hidden">
                    <FilmStill film={film} ratio="free" className="h-full w-full" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-[1.1rem] text-ink group-hover:text-taupe">
                      {film.title}
                    </span>
                    <span className="mt-1 block font-mono text-[12px] uppercase tracking-[0.14em] text-taupe">
                      {formatLongDate(record.watchedAt)}
                    </span>
                  </span>
                  <ArrowUpRight size={13} className="ml-auto shrink-0 text-taupe/50" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  03 — NOTES FROM THE DARK (paper chapter)                         */}
      {/* ================================================================ */}
      <section id="notes" className="chapter--paper paper-texture">
        <div className="shell py-16 lg:py-24">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-4">
              <div>
                <p className="artifact-label">
                  <b>03</b> Notes from the dark
                </p>
                <h2 className="mt-4 t-head text-ink">What you wrote afterwards.</h2>
              </div>
              <p className="measure-tight text-[13px] leading-relaxed text-ink/60">
                The paragraph after the credits. One per film, kept in your own words.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid grid-cols-12 gap-x-6 gap-y-10">
            <div className="col-span-12 lg:col-span-7">
              {recentCards.slice(0, 3).map(({ record, film }, i) => (
                <Reveal key={record.id} delay={i * 70}>
                  <Link
                    to={`/archive/${film.id}`}
                    className="group grid grid-cols-[2rem_1fr] gap-x-4 border-b border-ink/15 py-6 first:pt-0"
                  >
                    <span className="font-mono text-[12px] tracking-[0.16em] text-ink/50">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>
                      <span className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-display text-[1.45rem] leading-tight text-ink transition-colors group-hover:text-brass">
                          {film.title}
                        </span>
                        <span className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink/55">
                          {formatLongDate(record.watchedAt)}
                        </span>
                      </span>
                      <span className="mt-2 block max-w-[38rem] text-[15px] leading-[1.75] text-ink/75">
                        “{record.reflection}”
                      </span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>

            <Reveal delay={100} className="col-span-12 lg:col-span-4 lg:col-start-9">
              <div className="border-t border-ink/20 pt-4">
                <p className="micro-sm text-ink/55">Selected still</p>
                {latest?.film && (
                  <Link to={`/archive/${latest.film.id}`} className="group mt-4 block">
                    <FilmStill film={latest.film} ratio="portrait" tone="paper" />
                    <p className="mt-3 font-display text-[1.15rem] leading-tight text-ink">
                      {latest.film.title}
                    </p>
                    <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.14em] text-ink/55">
                      Frame no. {String(records.length).padStart(3, '0')}
                    </p>
                  </Link>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  THE RECORD — oversized numbers, no cards                         */}
      {/* ================================================================ */}
      <section className="chapter--ink border-t border-paper/15">
        <div className="shell py-16 lg:py-20">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <p className="artifact-label">
                <b>04</b> The record
              </p>
              <p className="max-w-xs text-right text-[13px] leading-relaxed text-paper-dim">
                Counted from the archive. A record of attention, not of achievement.
              </p>
            </div>
          </Reveal>

          <dl className="mt-8 grid grid-cols-2 gap-y-10 border-y border-paper/10 py-10 lg:grid-cols-4">
            {[
              { label: 'Films kept', zh: '收藏电影', value: String(records.length).padStart(2, '0'), sub: 'in the archive' },
              { label: 'Hours in the dark', zh: '黑暗中的小时', value: hours.toFixed(1), sub: formatMinutes(snapshot.totalMinutes) },
              { label: 'Themes found', zh: '反复出现的主题', value: String(themeCount).padStart(2, '0'), sub: 'cross-referenced' },
              {
                label: 'Reading confidence',
                zh: '解读把握',
                value: `${Math.round(snapshot.overallConfidence * 100)}%`,
                sub: 'an estimate, not a verdict',
              },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 60} className={i > 0 ? 'lg:border-l lg:border-paper/10 lg:pl-8' : ''}>
                <dt className="text-[12px] uppercase tracking-[0.2em] text-paper-dim">{stat.label}</dt>
                <dd className="num mt-3 text-[clamp(2.6rem,5vw,4.4rem)] leading-[0.9] text-paper">
                  {stat.value}
                </dd>
                <dd className="zh-label mt-2 text-[12px] text-paper-dim/55">{stat.zh}</dd>
                <dd className="mt-1 text-[12.5px] text-paper-dim/70">{stat.sub}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  05 — THE READING                                                 */}
      {/* ================================================================ */}
      <section id="reading" className="chapter--paper-2 paper-texture border-t border-ink/10">
        <div className="shell py-16 lg:py-24">
          <div className="grid grid-cols-12 gap-x-6 gap-y-12">
            <Reveal className="col-span-12 lg:col-span-5 xl:col-span-4">
              <div className="relative">
                <TasteRadar snapshot={snapshot} size={380} tone="light" />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="num text-[3rem] leading-none text-ink">
                    {Math.round(snapshot.overallConfidence * 100)}
                    <span className="text-lg text-ink/55">%</span>
                  </p>
                  <p className="micro-sm mt-1.5 text-ink/60">confidence</p>
                </div>
              </div>
              <p className="mt-2 text-center text-[12.5px] text-ink/60">
                Six axes, read from ratings, note depth and recurring themes.
              </p>
            </Reveal>

            <Reveal delay={80} className="col-span-12 lg:col-span-7 lg:col-start-6">
              <p className="artifact-label">
                <b>05</b> The reading
              </p>
              <h2 className="mt-5 font-display text-[clamp(2.1rem,4vw,3.4rem)] leading-[1.02] tracking-[-0.02em] text-ink">
                {tasteSignature(snapshot)}
              </h2>
              <p className="measure mt-5 text-[15px] leading-[1.8] text-ink/75">
                {summary[0]} {summary[1] ?? ''}
              </p>

              <div className="mt-9 grid gap-8 border-t border-ink/15 pt-6 sm:grid-cols-2">
                <div>
                  <p className="micro-sm text-ink/55">Strongest signal</p>
                  <p className="mt-2 font-display text-[1.7rem] leading-tight text-ink">
                    {strongest ? strongest.def.label : 'Still listening'}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink/65">
                    {strongest
                      ? `${strongest.def.labelZh} · ${percent(
                          strongest.value < 0.5 ? 1 - strongest.value : strongest.value,
                        )} toward ${strongest.value < 0.5 ? strongest.def.low : strongest.def.high}.`
                      : 'Add a few more notes and a direction will emerge.'}
                  </p>
                </div>

                {snapshot.topThemes.length > 0 && (
                  <div>
                    <p className="micro-sm text-ink/55">Themes you return to</p>
                    <ul className="mt-2.5 space-y-1.5">
                      {snapshot.topThemes.slice(0, 4).map((theme) => (
                        <li key={theme.id} className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-1.5">
                          <span className="text-[14px] text-ink/80">
                            {THEMES[theme.id].label}
                            <span className="ml-2 zh-label text-[12px] text-ink/55">
                              {THEMES[theme.id].zh}
                            </span>
                          </span>
                          <span className="font-mono text-[12px] text-ink/55">
                            {String(theme.count).padStart(2, '0')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <Link to="/taste" className="link-rule text-brass-ink hover:text-ink">
                  Read the full taste profile <ArrowRight size={12} />
                </Link>
                <p className="flex items-center gap-2 text-[12.5px] text-ink/55">
                  <Sparkles size={10} /> Computed locally. No external model was called.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  CLOSING SPREAD                                                   */}
      {/* ================================================================ */}
      <section className="relative isolate overflow-hidden bg-ink text-paper [--brass:#e9e0d0]">
        {favouriteFilm && (
          <img
            src={frameSrc(favouriteFilm)}
            alt={`${favouriteFilm.title} (${favouriteFilm.year}) — official backdrop`}
            className="absolute inset-0 h-full w-full object-cover object-[60%_center] opacity-30"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/40" />
        <div className="shell relative py-20 lg:py-28">
          <div className="max-w-3xl">
            <p className="kicker">Keep the reel going</p>
            <h2 className="mt-5 font-display text-[clamp(2.4rem,5.4vw,4.6rem)] leading-[0.96] tracking-[-0.025em] text-paper">
              What did you watch
              <br />
              <span className="italic text-paper-dim">last night?</span>
            </h2>
            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-paper-dim">
              One film, one honest paragraph. The archive updates everywhere at once.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={() => openAdd()} className="btn btn-primary">
                <Plus size={14} /> Add a film
              </button>
              <Link to="/reflection" className="btn btn-ghost">
                See the annual <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>

        <div className="overflow-hidden border-t border-paper/10 py-3">
          <div className="flex w-max animate-marquee items-center gap-8 whitespace-nowrap">
            {[...ordered, ...ordered].map((record, i) => {
              const film = filmById(films, record.filmId)
              if (!film) return null
              return (
                <span
                  key={`${record.id}-${i}`}
                  className="flex items-center gap-8 font-mono text-[12px] uppercase tracking-[0.24em] text-paper-dim/50"
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
