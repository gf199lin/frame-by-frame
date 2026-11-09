import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { useToast } from '@/components/ui/Toast'
import { FilmStill } from '@/components/film/FilmStill'
import { FilmPoster } from '@/components/film/FilmPoster'
import { Rating } from '@/components/ui/Rating'
import { Reveal } from '@/components/ui/Reveal'
import { PoleAxis } from '@/components/taste/TasteRadar'
import { EmptyState } from '@/components/ui/Primitives'
import { FilmAnalysisPanel } from '@/components/film/FilmAnalysisPanel'
import { MOODS, STATUS_LABELS, THEMES, DIMENSIONS, zhCountry, zhGenres, zhLanguage } from '@/data/taxonomy'
import { directorOf, loglineOf } from '@/data/filmCopy'
import { formatLongDate, formatMinutes } from '@/lib/format'
import { artworkSourceUrl, artworkVerifiedAt, resolveFilmArtwork } from '@/lib/artwork'
import { filmById, getEvidence, recordsSorted } from '@/lib/tasteEngine'

export const FilmDetail = () => {
  const { filmId = '' } = useParams()
  const { films, records, snapshot, profile, deleteRecord } = useAppStore()
  const { openAdd, openEdit } = useAddFilm()
  const { push } = useToast()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const film = filmById(films, filmId)
  const record = records.find((r) => r.filmId === filmId)

  if (!film) {
    return (
      <div className="shell py-24">
        <EmptyState
          eyebrow="404 / 找不到这一帧"
          title="这部电影不在你的片库里"
          description="链接可能已经过期，或者这条观影记录已经被移除。"
          action={
            <Link to="/archive" className="btn btn-ghost">
              返回我的片库
            </Link>
          }
        />
      </div>
    )
  }

  if (!record) {
    return (
      <div>
        <div className="relative text-paper [--brass:#fdf6e2]">
          <FilmStill film={film} ratio="free" className="h-[46vh] min-h-[300px] w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />
          <div className="shell absolute inset-x-0 bottom-0 pb-8">
            <p className="kicker">在片目中，尚未收录</p>
            <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,5rem)] leading-[0.92] tracking-[-0.02em]">
              {film.title}
            </h1>
            <p className="mt-2 text-[13px] tracking-[0.06em] text-paper/85">
              {film.titleZh} · {film.year} · {directorOf(film)}
            </p>
          </div>
        </div>
        <div className="shell grid gap-10 py-14 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="mb-3 text-[12px] tracking-[0.06em] text-taupe">剧情简介</p>
            <p className="measure font-zh-body text-[1.15rem] leading-[1.95] text-ink/75">
              {loglineOf(film)}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3 lg:col-span-4 lg:col-start-9">
            <button type="button" onClick={() => openAdd(film.id)} className="btn btn-primary">
              <Plus size={14} /> 记录这部电影
            </button>
            <Link to="/archive" className="btn btn-ghost">
              返回
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const themes = record.themes.flatMap((id) => (THEMES[id] ? [{ id, ...THEMES[id] }] : []))
  const moods = record.moods.flatMap((id) => (MOODS[id] ? [{ id, ...MOODS[id] }] : []))
  const evidence = getEvidence(snapshot, records, films, 'emotion', 4)
    .filter((item) => item.filmId !== film.id)
    .slice(0, 2)
  const frameNumber = recordsSorted(records).findIndex((r) => r.id === record.id) + 1
  const artwork = resolveFilmArtwork(film)
  const artworkUrl = artworkSourceUrl(film)

  const related = records
    .filter((r) => r.id !== record.id)
    .map((other) => {
      const otherFilm = filmById(films, other.filmId)
      if (!otherFilm) return null
      const shared = record.themes.filter((t) => other.themes.includes(t))
      if (shared.length < 2) return null
      return { film: otherFilm, record: other, shared, score: shared.length + other.rating / 5 }
    })
    .filter(
      (x): x is {
        film: NonNullable<ReturnType<typeof filmById>>
        record: typeof record
        shared: typeof record.themes
        score: number
      } => x !== null,
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const onDelete = () => {
    deleteRecord(record.id)
    push(`《${film.title}》已从片库移除。`, 'success')
    navigate('/archive')
  }

  return (
    <div>
      <div className="shell pt-6">
        <Link
          to="/archive"
          className="inline-flex items-center gap-2 text-[12px] tracking-[0.04em] text-ink/70 transition-colors hover:text-ink"
        >
          <ArrowLeft size={11} /> 我的片库
        </Link>
      </div>

      {/* ================================================================ */}
      {/*  I — The film                                                     */}
      {/* ================================================================ */}
      <section className="relative mt-5 text-paper [--brass:#fdf6e2]">
        <div className="relative">
          <FilmStill film={film} ratio="free" eager className="h-[54vh] min-h-[340px] w-full lg:h-[66vh]" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-ink/35" />
          <div className="absolute inset-x-0 top-0">
            <div className="shell flex items-start justify-between gap-4 py-5">
              <p className="font-mono text-[12px] tracking-[0.08em] text-paper/60">
                第 {String(frameNumber).padStart(3, '0')} 帧 / 共 {String(records.length).padStart(3, '0')} 帧
              </p>
              <p className="text-[12px] tracking-[0.06em] text-paper/60">
                {film.year} · {zhCountry(film.country)}
              </p>
            </div>
          </div>

          <div className="shell absolute inset-x-0 bottom-0 pb-7 lg:pb-10">
            <p className="kicker">
              {STATUS_LABELS[record.status].zh} · {formatLongDate(record.watchedAt)}
            </p>
            <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(2.6rem,8vw,7rem)] leading-[0.86] tracking-[-0.03em] text-balance">
              {film.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              {film.titleZh && film.titleZh !== film.title && (
                <span className="font-zh-title text-[1.05rem] tracking-[0.06em] text-paper-dim">{film.titleZh}</span>
              )}
              <span className="hidden h-3 w-px bg-white/25 sm:block" />
              <span className="text-[12.5px] tracking-[0.06em] text-paper-dim">
                {directorOf(film)} · {film.year} · {formatMinutes(film.runtime)} · {zhGenres(film.genres)}
              </span>
            </div>
          </div>
        </div>

        <div className="shell text-ink">
          <div className="flex flex-col gap-6 border-b border-ink/10 py-5 lg:flex-row lg:items-center lg:justify-between">
            <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
              {[
                ['导演', directorOf(film)],
                ['上映年份', String(film.year)],
                ['片长', formatMinutes(film.runtime)],
                ['语言', zhLanguage(film.language)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[12.5px] tracking-[0.04em] text-ink/60">{label}</dt>
                  <dd className="mt-1.5 text-[14px] text-ink/80">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => openEdit(record)} className="btn btn-primary h-10 px-4 text-[12.5px]">
                <Pencil size={12} /> 编辑观影记忆
              </button>
              <Link to="/map" className="btn btn-ghost h-10 px-4 text-[12.5px]">
                记忆地图 <ArrowUpRight size={11} />
              </Link>
              {confirmDelete ? (
                <div className="flex items-center gap-3">
                  <span className="text-[12.5px] text-ink/80">确定移除？</span>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="text-[12.5px] tracking-[0.04em] text-brass underline underline-offset-4 hover:text-taupe"
                  >
                    移除
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-[12.5px] tracking-[0.04em] text-ink/80 hover:text-ink"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 text-[12.5px] tracking-[0.04em] text-ink/70 transition-colors hover:text-ink"
                >
                  <Trash2 size={11} /> 移除
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  II — My memory                                                   */}
      {/* ================================================================ */}
      <div className="shell">
        <p className="border-b border-ink/10 py-3 text-[12.5px] tracking-[0.04em] text-ink/60">
          图片来源：{' '}
          {artwork ? (
            <a
              href={artworkUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-ink/60 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink"
            >
              {artwork.poster?.provider === 'tmdb' || artwork.backdrop?.provider === 'tmdb'
                ? 'TMDB'
                : artwork.poster?.credit?.includes('Letterboxd') ||
                    artwork.backdrop?.credit?.includes('Letterboxd')
                  ? 'Letterboxd'
                  : '本地图片库'}{' '}
              · 核验于 {artworkVerifiedAt(film)}
            </a>
          ) : (
            <span>暂无已核验的图片</span>
          )}
          {film.tmdbId && <span> · TMDB #{film.tmdbId}</span>}
        </p>
      </div>

      <section className="chapter--paper paper-texture">
        <div className="shell py-16 lg:py-24">
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <Reveal className="col-span-12 lg:col-span-3">
              <p className="artifact-label">
                <b>II</b> 我的记忆
              </p>
              <p className="mt-4 font-zh-title text-[1.3rem] text-ink">这次观影</p>

              <dl className="mt-8 space-y-4 border-t border-ink/15 pt-5">
                <div>
                  <dt className="text-[12.5px] tracking-[0.04em] text-ink/55">我的评分</dt>
                  <dd className="mt-1.5 flex items-baseline gap-2">
                    <span className="num text-[2rem] leading-none text-ink">
                      {record.rating.toFixed(1)}
                    </span>
                    <span className="text-[13px] text-ink/55">/ 5</span>
                  </dd>
                  <Rating value={record.rating} size={10} tone="light" className="mt-2" />
                </div>
                <div>
                  <dt className="text-[12.5px] tracking-[0.04em] text-ink/55">观看日期</dt>
                  <dd className="mt-1 text-[14px] text-ink/80">{formatLongDate(record.watchedAt)}</dd>
                </div>
                <div>
                  <dt className="text-[12.5px] tracking-[0.04em] text-ink/55">观看状态</dt>
                  <dd className="mt-1 text-[14px] text-ink/80">
                    {STATUS_LABELS[record.status].zh}
                    <span className="ml-2 text-[12px] uppercase tracking-[0.1em] text-ink/45">
                      {STATUS_LABELS[record.status].label}
                    </span>
                  </dd>
                </div>
                {record.feltLike && (
                  <div>
                    <dt className="text-[12.5px] tracking-[0.04em] text-ink/55">看完的感觉</dt>
                    <dd className="mt-1 text-[14px] text-ink/80">
                      {MOODS[record.feltLike as keyof typeof MOODS]?.zh ?? record.feltLike}
                    </dd>
                  </div>
                )}
              </dl>
            </Reveal>

            <Reveal delay={80} className="col-span-12 lg:col-span-8 lg:col-start-5">
              <blockquote className="border-t border-ink/20 pt-8">
                <p className="whitespace-pre-line font-zh-body text-[clamp(1.15rem,1.7vw,1.45rem)] leading-[1.95] text-ink/90">
                  {record.reflection}
                </p>
              </blockquote>

              <FilmAnalysisPanel film={film} record={record} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  III — What stayed with me                                        */}
      {/* ================================================================ */}
      <section className="chapter--paper">
        <div className="shell py-16 lg:py-20">
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <Reveal className="col-span-12 lg:col-span-4">
              <p className="artifact-label">
                <b>III</b> 留下的东西
              </p>
              <h2 className="mt-5 t-head">它在你身上留下了什么</h2>
              <p className="mt-4 max-w-xs text-[13.5px] leading-[1.9] text-taupe">
                主题是电影在讨论什么，情绪是它摸起来是什么质地。两者都从你的笔记和电影标签中读取，再按重复出现的次数加权。
              </p>

              <div className="mt-8">
                <p className="text-[12.5px] tracking-[0.04em] text-taupe">
                  情绪基调
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {moods.map((mood) => (
                    <span key={mood.id} className="tag border-ink/15 text-ink/75">
                      {mood.zh}
                      <span className="text-[12px] uppercase tracking-[0.08em] text-taupe">{mood.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={80} className="col-span-12 lg:col-span-7 lg:col-start-6">
              <ul className="border-t border-ink/15">
                {themes.map((theme, i) => (
                  <li
                    key={theme.id}
                    className="group flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-ink/10 py-5"
                  >
                    <span className="font-mono text-[12px] tracking-[0.2em] text-brass">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-zh-title text-[clamp(1.4rem,2.4vw,2rem)] leading-none text-ink">
                      {theme.zh}
                    </span>
                    <span className="text-[12px] uppercase tracking-[0.1em] text-taupe">{theme.label}</span>
                    <span className="ml-auto hidden max-w-[20rem] text-right text-[13px] leading-[1.8] text-taupe sm:block">
                      {theme.blurbZh}
                    </span>
                  </li>
                ))}
                {themes.length === 0 && (
                  <li className="py-5 text-[14px] text-taupe">
                    这条观影记录还没有提取出主题。
                  </li>
                )}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  IV — My taste connection                                         */}
      {/* ================================================================ */}
      <section className="chapter--paper border-y border-ink/10">
        <div className="shell py-16 lg:py-20">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/10 pb-5">
              <div>
                <p className="artifact-label">
                  <b>IV</b> 与观影品味的关联
                </p>
                <h2 className="mt-4 t-head">这部电影，对照你的片库</h2>
              </div>
              <p className="max-w-sm text-[13px] leading-[1.85] text-taupe">
                实心标记是你片库当前的位置，空心方框是这部电影自己的签名。两者之间的距离是信息，不是错误。
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-x-16 gap-y-9 lg:grid-cols-2">
            {DIMENSIONS.map((def) => {
              const score = profile.dimensions.find((s) => s.key === def.key)
              const filmValue = film.signature[def.key]
              const distance = score ? Math.abs(score.value - filmValue) : 0
              return (
                <Reveal key={def.key} delay={40}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-[13.5px] font-medium tracking-[0.04em] text-ink/75">
                      {def.labelZh}
                    </p>
                    <p className="text-[12.5px] tracking-[0.04em] text-taupe">
                      {!score?.sufficient ? '证据不足' : distance < 0.15 ? '很契合' : distance < 0.32 ? '相邻' : '有张力'}
                    </p>
                  </div>
                  <PoleAxis
                    value={score?.value ?? 0.5}
                    filmValue={filmValue}
                    low={def.lowZh}
                    high={def.highZh}
                    className="mt-3"
                  />
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  V — Related films                                                */}
      {/* ================================================================ */}
      <section className="chapter--paper-2 paper-texture">
        <div className="shell py-16 lg:py-24">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink/20 pb-4">
              <div>
                <p className="artifact-label">
                  <b>V</b> 相关的电影
                </p>
                <h2 className="mt-4 t-head text-ink">与这部片子呼应的电影</h2>
              </div>
              <p className="max-w-xs text-[13px] leading-[1.85] text-ink/60">
                按共同主题挑选，而不是按类型或上映年份。
              </p>
            </div>
          </Reveal>

          <div className="mt-9 grid gap-8 sm:grid-cols-3">
            {related.map((item, i) => (
              <Reveal key={item.film.id} delay={i * 60}>
                <Link to={`/archive/${item.film.id}`} className="group block">
                  <div className="mount mx-auto max-w-[230px]">
                    <div className="aspect-[2/3] overflow-hidden rounded-[4px]">
                      <FilmPoster film={item.film} showTitle={false} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-3 border-t border-ink/15 pt-2.5">
                    <div>
                      <p className="font-display text-[1.2rem] leading-tight text-ink transition-colors group-hover:text-ocean">
                        {item.film.title}
                      </p>
                      {item.film.titleZh && (
                        <p className="mt-0.5 text-[12.5px] tracking-[0.03em] text-ink/55">{item.film.titleZh}</p>
                      )}
                      <p className="mt-1 text-[11.5px] tracking-[0.03em] text-ink/60">
                        {directorOf(item.film)} · {item.film.year}
                      </p>
                    </div>
                    <ArrowUpRight size={13} className="mt-1 shrink-0 text-ink/40 transition-colors group-hover:text-ocean" />
                  </div>
                  <p className="mt-2 text-[12.5px] text-ink/65">
                    {item.shared
                      .slice(0, 2)
                      .map((t) => THEMES[t].zh)
                      .join(' · ')}
                  </p>
                </Link>
              </Reveal>
            ))}
            {related.length === 0 && (
              <p className="text-[14px] leading-[1.9] text-ink/65 sm:col-span-3">
                暂时还没有电影与它共享两个以上的主题。再添加一部，地图会找到联系。
              </p>
            )}
          </div>

          <div className="mt-14 grid gap-10 border-t border-ink/20 pt-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[12.5px] tracking-[0.04em] text-ink/55">主演</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{film.cast.join(' · ') || '暂无主演信息'}</p>
            </div>
            <div>
              <p className="text-[12.5px] tracking-[0.04em] text-ink/55">
                来自其他观影记忆的片段
              </p>
              <ul className="mt-3 space-y-4">
                {evidence.map((item) => (
                  <li key={item.filmId} className="border-b border-ink/15 pb-3 last:border-0">
                    <Link to={`/archive/${item.filmId}`} className="group">
                      <p className="font-zh-body text-[14.5px] leading-[1.85] text-ink/80 group-hover:text-ink">
                        “{item.quote}”
                      </p>
                      <p className="mt-1.5 text-[12px] tracking-[0.06em] text-ink/55">
                        {item.filmTitle} · {item.year}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
