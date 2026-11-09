import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Plus, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { FilmStill } from '@/components/film/FilmStill'
import { FilmPoster } from '@/components/film/FilmPoster'
import { Rating } from '@/components/ui/Rating'
import { TasteRadar } from '@/components/taste/TasteRadar'
import { Reveal } from '@/components/ui/Reveal'
import { EmptyState } from '@/components/ui/Primitives'
import { filmById, favoriteRecord, recordsSorted } from '@/lib/tasteEngine'
import { sampleStateCopy } from '@/lib/ai/tasteProfile'
import type { TasteSnapshot } from '@/types'
import { THEMES, zhGenres } from '@/data/taxonomy'
import { formatLongDate, formatMinutes, percent } from '@/lib/format'
import { frameSrc } from '@/lib/media'

const ISSUE = [
  { no: '01', label: '最新一帧', en: 'The latest frame', href: '#latest' },
  { no: '02', label: '最近观看', en: 'Recent frames', href: '#recent' },
  { no: '03', label: '观影笔记', en: 'Notes from the dark', href: '#notes' },
  { no: '04', label: '审美解读', en: 'The reading', href: '#reading' },
]

const STATUS_TEXT: Record<string, string> = {
  rewatched: '一次重看',
  abandoned: '没有看完',
  watched: '第一次观看',
}

export const Home = () => {
  const { records, films, snapshot, profile } = useAppStore()
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

  const radarSnapshot: TasteSnapshot = {
    filmCount: profile.filmCount,
    dimensionScores: profile.dimensions,
    overallConfidence: profile.overallConfidence,
    topThemes: profile.topThemes,
    topMoods: profile.topMoods,
    averageRating: profile.averageRating,
    totalMinutes: snapshot.totalMinutes,
  }
  const strongest = [...profile.dimensions]
    .filter((item) => item.sufficient)
    .sort((a, b) => b.confidence - a.confidence)[0]
  const showRadar = profile.dimensions.filter((item) => item.sufficient).length >= 2

  // The cover shows a real still from the newest film, with a poster crop
  // alongside it.
  if (records.length === 0) {
    return (
      <div className="relative isolate overflow-hidden border-b border-ink/10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-48 -top-56 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,rgba(62,74,150,0.14),rgba(62,74,150,0)_66%)]"
        />
        <div className="shell relative py-16 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-10">
            <div className="lg:col-span-7">
              <p className="kicker">Frame by Frame · 私人电影记忆博物馆</p>
              <h1 className="mt-7 max-w-4xl font-display text-[clamp(2.6rem,6.4vw,5.2rem)] leading-[0.92] tracking-[-0.026em] text-ink">
                Every Film
                <br />
                Leaves a Frame
              </h1>
              <p className="mt-6 max-w-2xl font-display text-[clamp(1.15rem,2vw,1.65rem)] italic leading-snug text-ink/55">
                Every film leaves a frame. Every frame tells your story.
              </p>
              <p className="mt-6 max-w-lg text-[16px] leading-[1.9] text-ink/70">
                这里收藏你看过的电影、写下的感受，以及它们慢慢显现出的审美偏好。
                <span className="mt-2 block text-taupe">不是待看清单，而是一座属于你的电影记忆博物馆。</span>
              </p>
              <EmptyState
                className="mt-12 max-w-2xl border-ink/20"
                eyebrow="片库还是空的"
                title="还缺你的第一帧"
                tone="light"
                description="添加一部你真正看过的电影，用自己的话写一段感受，然后看片库如何开始读取你。"
                action={
                  <button type="button" onClick={() => openAdd()} className="btn btn-primary">
                    <Plus size={14} /> 添加第一部电影
                  </button>
                }
              />
            </div>

            <div className="lg:col-span-5">
              <figure className="mount mx-auto max-w-[360px]">
                <img
                  src={frameSrc('manchester')}
                  alt="《海边的曼彻斯特》（2016）官方剧照"
                  className="aspect-[4/3] w-full rounded-[4px] object-cover"
                  loading="eager"
                  decoding="async"
                />
                <figcaption className="flex items-baseline justify-between px-1 pb-0.5 pt-2 text-[11px] tracking-[0.04em] text-taupe">
                  <span>《海边的曼彻斯特》</span>
                  <span>Still / 2016</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ================================================================ */}
      {/*  COVER                                                            */}
      {/* ================================================================ */}
      <section className="relative">
        <div className="shell pt-6 lg:pt-10">
          <div className="paper-card paper-card--offset relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-28 -top-32 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(29,35,121,0.09),rgba(29,35,121,0)_68%)]"
            />

            <div className="relative grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-8">
              <div className="lg:col-span-7">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-ink/10 pb-4">
                  <span className="micro-sm text-ink/55">Frame by Frame</span>
                  <span className="h-px w-8 bg-ink/30" />
                  <span className="text-[12px] tracking-[0.06em] text-taupe">私人电影记忆博物馆</span>
                  <span className="folio ml-auto">第一卷 — {year}</span>
                </div>

                <p className="kicker mt-7">一个人的电影刊物 · Vol. 01</p>
                <h1 className="mt-5 font-display text-[clamp(2.7rem,6.6vw,5.8rem)] leading-[0.92] tracking-[-0.03em] text-ink text-balance">
                  Every Film
                  <br />
                  Leaves a Frame
                </h1>
                <p className="mt-5 max-w-[30rem] font-display text-[clamp(1.1rem,1.8vw,1.55rem)] italic leading-snug text-ink/55">
                  Every film leaves a frame. Every frame tells your story.
                </p>

                <div className="mt-7 max-w-[34rem] border-t border-ink/10 pt-5">
                  <p className="zh-prose w-full max-w-[33rem] text-ink/75">
                    这里收藏你看过的电影、写下的感受，以及它们慢慢显现出的审美偏好。
                    不是待看清单，也不是评分网站，而是一个留给那些成为记忆一部分的电影的房间。
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => openAdd()} className="btn btn-primary">
                    <Plus size={14} /> 记录一部电影
                  </button>
                  <Link to="/archive" className="btn btn-ghost text-ink">
                    进入我的片库 <ArrowRight size={13} />
                  </Link>
                </div>

                <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-ink/10 pt-4 text-[12.5px] tracking-[0.04em] text-taupe">
                  <span>
                    <b className="num text-[15px] font-normal text-ink">{records.length}</b> 部电影
                  </span>
                  <span>
                    <b className="num text-[15px] font-normal text-ink">{hours.toFixed(1)}</b> 小时
                  </span>
                  <span>
                    <b className="num text-[15px] font-normal text-ink">{themeCount}</b> 个主题
                  </span>
                  <span className="ml-auto hidden text-[12px] text-taupe/70 sm:block">向下滚动，进入片库 ↓</span>
                </div>
              </div>

              {latest?.film && (
                <div className="lg:col-span-5">
                  <Link to={`/archive/${latest.film.id}`} className="group relative mx-auto flex max-w-[420px] items-end justify-center pb-4 pl-4 sm:pb-8 sm:pl-8">
                    <div className="absolute -left-3 top-5 hidden w-[45%] -rotate-3 sm:block">
                      <div className="mount mount--tight">
                        <FilmStill film={latest.film} ratio="photo" />
                      </div>
                    </div>

                    <div className="relative z-10 w-[70%] max-w-[268px]">
                      <div className="mount">
                        <div className="aspect-[2/3] overflow-hidden rounded-[4px]">
                          <FilmPoster film={latest.film} showTitle={false} eager />
                        </div>
                        <div className="flex items-center justify-between gap-3 px-1 pb-0.5 pt-2">
                          <span className="truncate text-[11px] tracking-[0.05em] text-taupe">
                            最新收录 · {latest.film.year}
                          </span>
                          <span className="shrink-0 font-mono text-[10.5px] text-taupe">
                            {String(records.length).padStart(3, '0')}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 text-center">
                        <p className="font-display text-[1.35rem] leading-tight text-ink transition-colors group-hover:text-ocean">
                          {latest.film.title}
                        </p>
                        {latest.film.titleZh && (
                          <p className="mt-0.5 font-serif text-[13.5px] tracking-[0.03em] text-ink/60">
                            {latest.film.titleZh}
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-center gap-3 text-[12px] tracking-[0.03em] text-taupe">
                          <span>{formatLongDate(latest.record.watchedAt)}</span>
                          <span className="h-3 w-px bg-ink/15" aria-hidden="true" />
                          <Rating value={latest.record.rating} size={10} showValue />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  ISSUE CONTENTS                                                   */}
      {/* ================================================================ */}
      <section className="shell pb-10 pt-6 lg:pb-14">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-ink/10 bg-ink/10 lg:grid-cols-4">
          {ISSUE.map((item) => (
            <a
              key={item.no}
              href={item.href}
              className="group flex items-baseline justify-between gap-3 bg-paper-sheet px-4 py-4 transition-colors hover:bg-paper-soft sm:px-5 sm:py-5"
            >
              <span className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tracking-[0.16em] text-brass">{item.no}</span>
                <span>
                  <span className="font-zh-title block text-[1.1rem] leading-none text-ink/85 transition-colors group-hover:text-ink">
                    {item.label}
                  </span>
                  <span className="mt-1.5 block text-[10px] uppercase tracking-[0.13em] text-taupe">
                    {item.en}
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
                    <b>01</b> 封面故事
                  </p>
                  <h2 className="mt-4 t-head">最新的一帧</h2>
                </div>
                <div className="text-right">
                  <p className="folio">第 {String(records.length).padStart(3, '0')} 帧</p>
                  <p className="mt-1.5 text-[12px] tracking-[0.04em] text-ink/75">
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
                  <p className="text-[12px] tracking-[0.06em] text-taupe">观看于</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink/75">
                    {formatLongDate(latest.record.watchedAt)}
                  </p>
                  <div className="mt-4 flex items-center gap-3">
                    <Rating value={latest.record.rating} size={12} showValue />
                  </div>
                  <p className="mt-4 text-[12px] tracking-[0.06em] text-brass/80">
                    {STATUS_TEXT[latest.record.status] ?? '第一次观看'}
                  </p>
                </div>

                <div className="col-span-12 sm:col-span-9 lg:col-span-7 lg:col-start-5">
                  <Link to={`/archive/${latest.film.id}`} className="group">
                    <h3 className="font-display text-[clamp(2.2rem,4.4vw,3.8rem)] leading-[0.98] tracking-[-0.02em] text-ink transition-colors group-hover:text-taupe">
                      {latest.film.title}
                    </h3>
                    {latest.film.titleZh && (
                      <p className="mt-1 text-[15px] tracking-[0.04em] text-ink/60">{latest.film.titleZh}</p>
                    )}
                  </Link>
                  <p className="mt-2.5 text-[12.5px] tracking-[0.08em] text-taupe">
                    {latest.film.director} · {latest.film.year} · {zhGenres(latest.film.genres)}
                  </p>

                  <blockquote className="mt-7 border-l border-brass pl-5">
                    <p className="font-zh-body text-[clamp(1.1rem,1.7vw,1.4rem)] leading-[1.95] text-ink/80">
                      {latest.record.reflection}
                    </p>
                  </blockquote>

                  <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <span className="text-[13px] text-taupe">
                      {latest.record.themes
                        .slice(0, 3)
                        .map((t) => THEMES[t]?.zh)
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    <Link
                      to={`/archive/${latest.film.id}`}
                      className="link-rule ml-auto text-brass hover:text-brass-soft"
                    >
                      查看完整观影记忆 <ArrowUpRight size={12} />
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
                  <b>02</b> 最近观看
                </p>
                <h2 className="mt-4 t-head">最近看过的电影</h2>
              </div>
              <Link to="/archive" className="link-rule text-ink/75 hover:text-ink">
                查看全部片库 <ArrowRight size={12} />
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
                      {film.titleZh && (
                        <p className="mt-1 text-[14px] tracking-[0.04em] text-ink/55">{film.titleZh}</p>
                      )}
                      <p className="mt-1 text-[12.5px] tracking-[0.06em] text-taupe">
                        {film.director} · {film.year}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <Rating value={record.rating} size={10} />
                      <p className="mt-1.5 font-mono text-[12px] tracking-[0.04em] text-taupe">
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
                        <p className="mt-0.5 truncate text-[12px] tracking-[0.04em] text-taupe">
                          {film.year} · {zhGenres(film.genres.slice(0, 1))}
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
                    <span className="font-mono text-[12px] tracking-[0.04em] text-taupe">
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
                    <span className="mt-1 block font-mono text-[12px] tracking-[0.04em] text-taupe">
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
      {/*  03 — NOTES FROM THE DARK                                         */}
      {/* ================================================================ */}
      <section id="notes" className="chapter--paper paper-texture">
        <div className="shell py-16 lg:py-24">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/15 pb-4">
              <div>
                <p className="artifact-label">
                  <b>03</b> 暗房笔记
                </p>
                <h2 className="mt-4 t-head text-ink">看完之后，你写下了什么</h2>
              </div>
              <p className="measure-tight text-[13.5px] leading-[1.8] text-ink/60">
                片尾字幕之后的那一段。每部电影一篇，用你自己的话。
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
                        <span>
                          <span className="font-display text-[1.45rem] leading-tight text-ink transition-colors group-hover:text-brass">
                            {film.title}
                          </span>
                          {film.titleZh && (
                            <span className="ml-2 text-[13px] tracking-[0.04em] text-ink/55">{film.titleZh}</span>
                          )}
                        </span>
                        <span className="font-mono text-[12px] tracking-[0.04em] text-ink/55">
                          {formatLongDate(record.watchedAt)}
                        </span>
                      </span>
                      <span className="mt-2 block max-w-[38rem] font-zh-body text-[15.5px] leading-[1.9] text-ink/75">
                        “{record.reflection}”
                      </span>
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>

            <Reveal delay={100} className="col-span-12 lg:col-span-4 lg:col-start-9">
              <div className="border-t border-ink/20 pt-4">
                <p className="text-[12px] tracking-[0.06em] text-ink/55">精选剧照</p>
                {latest?.film && (
                  <Link to={`/archive/${latest.film.id}`} className="group mt-4 block">
                    <FilmStill film={latest.film} ratio="portrait" tone="paper" />
                    <p className="mt-3 font-display text-[1.15rem] leading-tight text-ink">
                      {latest.film.title}
                    </p>
                    <p className="mt-1 font-mono text-[12px] tracking-[0.04em] text-ink/55">
                      第 {String(records.length).padStart(3, '0')} 帧
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
      <section className="shell py-6 lg:py-8">
        <div className="ink-panel">
          <div className="px-6 py-12 sm:px-10 lg:px-12 lg:py-14">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-paper/15 pb-5">
                <p className="artifact-label">
                  <b>04</b> 片库记录
                </p>
                <p className="max-w-xs text-right text-[13px] leading-[1.8] text-paper-dim">
                  这些数字来自你的片库。它记录的是注意力，而不是成就。
                </p>
              </div>
            </Reveal>

            <dl className="mt-2 grid grid-cols-2 gap-y-10 py-8 lg:grid-cols-4">
              {[
                { label: '片库电影', en: 'Films kept', value: String(records.length).padStart(2, '0'), sub: '已收录' },
                { label: '累计观影', en: 'Hours in the dark', value: hours.toFixed(1), sub: formatMinutes(snapshot.totalMinutes) },
                { label: '出现主题', en: 'Themes found', value: String(themeCount).padStart(2, '0'), sub: '反复出现' },
                {
                  label: '解读置信度',
                  en: 'Reading confidence',
                  value: `${Math.round(snapshot.overallConfidence * 100)}%`,
                  sub: '是估计，不是判决',
                },
              ].map((stat, i) => (
                <Reveal key={stat.label} delay={i * 60} className={i > 0 ? 'lg:border-l lg:border-paper/15 lg:pl-8' : ''}>
                  <dt className="text-[13px] font-medium tracking-[0.04em] text-paper-dim">{stat.label}</dt>
                  <dd className="num mt-3 text-[clamp(2.4rem,4.6vw,4rem)] leading-[0.9] text-paper">
                    {stat.value}
                  </dd>
                  <dd className="mt-2 text-[10.5px] uppercase tracking-[0.12em] text-paper-dim/60">{stat.en}</dd>
                  <dd className="mt-1 text-[12.5px] text-paper-dim/75">{stat.sub}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
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
                {showRadar ? (
                  <>
                    <TasteRadar snapshot={radarSnapshot} size={380} tone="light" />
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="num text-[3rem] leading-none text-ink">
                        {Math.round(profile.overallConfidence * 100)}
                        <span className="text-lg text-ink/55">%</span>
                      </p>
                      <p className="mt-1.5 text-[12px] tracking-[0.06em] text-ink/60">置信度</p>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[320px] flex-col justify-center border border-dashed border-ink/20 px-8 py-10 text-center">
                    <p className="font-zh-title text-[1.35rem] leading-[1.5] text-ink">
                      还没有可以画出的形状。
                    </p>
                    <p className="mt-3 text-[13.5px] leading-[1.9] text-ink/60">
                      雷达图只使用你确认过的 AI 证据。证据不足时，我们不会用虚构数字把它填满。
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink/60">
                六条轴线，只来自你确认过的分析证据。
              </p>
            </Reveal>

            <Reveal delay={80} className="col-span-12 lg:col-span-7 lg:col-start-6">
              <p className="artifact-label">
                <b>05</b> 审美解读
              </p>
              <h2 className="mt-5 font-zh-title text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.25] tracking-[-0.01em] text-ink">
                {profile.signature}
              </h2>
              <p className="measure mt-5 text-[15.5px] leading-[1.95] text-ink/75">
                {sampleStateCopy[profile.sampleState]}
              </p>

              <div className="mt-9 grid gap-8 border-t border-ink/15 pt-6 sm:grid-cols-2">
                <div>
                  <p className="text-[12px] tracking-[0.06em] text-ink/55">最强信号</p>
                  <p className="mt-2 font-zh-title text-[1.45rem] leading-tight text-ink">
                    {strongest ? strongest.def.labelZh : '还在聆听'}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-[1.8] text-ink/65">
                    {strongest
                      ? `${strongest.def.label} · ${percent(
                          strongest.value < 0.5 ? 1 - strongest.value : strongest.value,
                        )} 偏向「${strongest.value < 0.5 ? strongest.def.lowZh : strongest.def.highZh}」`
                      : `确认几部电影后，方向才会显现；目前有 ${profile.pendingCount} 条分析等待确认。`}
                  </p>
                </div>

                {profile.topThemes.length > 0 && (
                  <div>
                    <p className="text-[12px] tracking-[0.06em] text-ink/55">你反复回到的主题</p>
                    <ul className="mt-2.5 space-y-1.5">
                      {profile.topThemes.slice(0, 4).map((theme) => (
                        <li key={theme.id} className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-1.5">
                          <span className="text-[14px] text-ink/80">
                            {THEMES[theme.id].zh}
                            <span className="ml-2 text-[11px] uppercase tracking-[0.1em] text-ink/45">
                              {THEMES[theme.id].label}
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
                  查看完整观影品味 <ArrowRight size={12} />
                </Link>
                <p className="flex items-center gap-2 text-[12.5px] text-ink/55">
                  <Sparkles size={10} /> 只使用你确认过的 AI 证据。
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  CLOSING SPREAD                                                   */}
      {/* ================================================================ */}
      <section className="shell pb-6 pt-4 lg:pb-10">
        <div className="ink-panel relative overflow-hidden">
          {favouriteFilm && (
            <img
              src={frameSrc(favouriteFilm)}
              alt={`${favouriteFilm.title}（${favouriteFilm.year}）官方剧照`}
              className="absolute inset-0 h-full w-full object-cover object-[60%_center] opacity-25"
              loading="lazy"
              decoding="async"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-ocean via-ocean/90 to-ocean/35" />
          <div className="relative px-6 py-16 sm:px-10 lg:px-12 lg:py-20">
            <div className="max-w-3xl">
              <p className="kicker">让片卷继续转</p>
              <h2 className="mt-5 font-zh-title text-[clamp(2.1rem,4.6vw,3.9rem)] leading-[1.14] tracking-[-0.01em] text-paper">
                昨晚看了
                <br />
                <span className="text-paper-dim">哪一部？</span>
              </h2>
              <p className="mt-5 max-w-md text-[14.5px] leading-[1.9] text-paper-dim">
                一部电影，一段诚实的文字。片库会在所有页面同时更新。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button type="button" onClick={() => openAdd()} className="btn btn-primary bg-paper text-ink hover:bg-paper-soft">
                  <Plus size={14} /> 添加电影
                </button>
                <Link to="/reflection" className="btn btn-ghost">
                  查看年度回顾 <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden border-t border-paper/15 py-3">
            <div className="flex w-max animate-marquee items-center gap-8 whitespace-nowrap">
              {[...ordered, ...ordered].map((record, i) => {
                const film = filmById(films, record.filmId)
                if (!film) return null
                return (
                  <span
                    key={`${record.id}-${i}`}
                    className="flex items-center gap-8 font-mono text-[11.5px] uppercase tracking-[0.16em] text-paper-dim/55"
                  >
                    {film.title}
                    {film.titleZh && <span className="text-[11.5px] tracking-[0.08em] text-paper-dim/45">{film.titleZh}</span>}
                    <span className="text-sand">✳</span>
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
