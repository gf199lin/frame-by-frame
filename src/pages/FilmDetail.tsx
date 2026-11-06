import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { useToast } from '@/components/ui/Toast'
import { FilmStill } from '@/components/film/FilmStill'
import { Rating } from '@/components/ui/Rating'
import { Reveal } from '@/components/ui/Reveal'
import { PoleAxis } from '@/components/taste/TasteRadar'
import { EmptyState } from '@/components/ui/Primitives'
import { MOODS, STATUS_LABELS, THEMES, DIMENSIONS } from '@/data/taxonomy'
import { formatLongDate, formatMinutes, percent } from '@/lib/format'
import { filmById, getEvidence, recordsSorted } from '@/lib/tasteEngine'

export const FilmDetail = () => {
  const { filmId = '' } = useParams()
  const { films, records, snapshot, deleteRecord } = useAppStore()
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
          eyebrow="404 / missing frame"
          title="This film is not in the museum."
          description="The link may be old, or the record was removed."
          action={
            <Link to="/archive" className="btn btn-ghost">
              Back to the archive
            </Link>
          }
        />
      </div>
    )
  }

  if (!record) {
    return (
      <div>
        <div className="relative">
          <FilmStill film={film} ratio="free" className="h-[46vh] min-h-[300px] w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />
          <div className="shell absolute inset-x-0 bottom-0 pb-8">
            <p className="kicker">In the catalogue, not the archive</p>
            <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,5rem)] leading-[0.92] tracking-[-0.02em]">
              {film.title}
            </h1>
            <p className="mt-2 text-[9.5px] uppercase tracking-[0.2em] text-paper-dim">
              {film.titleZh} · {film.year} · {film.director}
            </p>
          </div>
        </div>
        <div className="shell grid gap-10 py-14 lg:grid-cols-12">
          <p className="measure font-display text-[1.6rem] leading-[1.4] text-paper-dim lg:col-span-7">
            {film.logline}
          </p>
          <div className="flex flex-wrap items-start gap-3 lg:col-span-4 lg:col-start-9">
            <button type="button" onClick={() => openAdd(film.id)} className="btn btn-primary">
              <Plus size={14} /> Record this film
            </button>
            <Link to="/archive" className="btn btn-ghost">
              Back
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
    push(`${film.title} was removed from the archive.`, 'success')
    navigate('/archive')
  }

  return (
    <div>
      <div className="shell pt-6">
        <Link
          to="/archive"
          className="inline-flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.2em] text-paper-muted transition-colors hover:text-paper"
        >
          <ArrowLeft size={11} /> The archive
        </Link>
      </div>

      {/* ================================================================ */}
      {/*  I — The film                                                     */}
      {/* ================================================================ */}
      <section className="relative mt-5">
        <div className="relative">
          <FilmStill film={film} ratio="free" eager className="h-[54vh] min-h-[340px] w-full lg:h-[66vh]" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-ink/35" />
          <div className="absolute inset-x-0 top-0">
            <div className="shell flex items-start justify-between gap-4 py-5">
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-paper/60">
                Frame {String(frameNumber).padStart(3, '0')} / {String(records.length).padStart(3, '0')}
              </p>
              <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-paper/60">
                {film.year} · {film.country}
              </p>
            </div>
          </div>

          <div className="shell absolute inset-x-0 bottom-0 pb-7 lg:pb-10">
            <p className="kicker">
              {STATUS_LABELS[record.status].label} · {formatLongDate(record.watchedAt)}
            </p>
            <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(2.6rem,8vw,7rem)] leading-[0.86] tracking-[-0.03em] text-balance">
              {film.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              {film.titleZh && film.titleZh !== film.title && (
                <span className="zh-title text-[12px] tracking-[0.24em] text-paper-dim">{film.titleZh}</span>
              )}
              <span className="hidden h-3 w-px bg-white/25 sm:block" />
              <span className="text-[9.5px] uppercase tracking-[0.2em] text-paper-dim">
                {film.director} · {film.year} · {film.runtime} min · {film.genres.join(' / ')}
              </span>
            </div>
          </div>
        </div>

        <div className="shell">
          <div className="flex flex-col gap-6 border-b border-white/12 py-5 lg:flex-row lg:items-center lg:justify-between">
            <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
              {[
                ['Director', film.director],
                ['Released', String(film.year)],
                ['Runtime', formatMinutes(film.runtime)],
                ['Language', film.language],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-mono text-[8px] uppercase tracking-[0.2em] text-paper-muted">{label}</dt>
                  <dd className="mt-1.5 text-[12px] text-paper-dim">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => openEdit(record)} className="btn btn-primary h-10 px-4 text-[9px]">
                <Pencil size={12} /> Edit memory
              </button>
              <Link to="/map" className="btn btn-ghost h-10 px-4 text-[9px]">
                Map <ArrowUpRight size={11} />
              </Link>
              {confirmDelete ? (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-paper-dim">Remove?</span>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="font-mono text-[9px] uppercase tracking-[0.14em] text-brass hover:text-brass-soft"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper-muted hover:text-paper"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-paper-muted transition-colors hover:text-brass"
                >
                  <Trash2 size={11} /> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  II — My memory                                                   */}
      {/* ================================================================ */}
      <section className="chapter--paper paper-texture">
        <div className="shell py-16 lg:py-24">
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <Reveal className="col-span-12 lg:col-span-3">
              <p className="artifact-label">
                <b>II</b> My memory
              </p>
              <p className="zh-title mt-4 text-[1.4rem] text-ink">我的记忆</p>

              <dl className="mt-8 space-y-4 border-t border-ink/15 pt-5">
                <div>
                  <dt className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40">Your rating</dt>
                  <dd className="mt-1.5 flex items-baseline gap-2">
                    <span className="num text-[2rem] leading-none text-ink">
                      {record.rating.toFixed(1)}
                    </span>
                    <span className="text-[11px] text-ink/40">/ 5</span>
                  </dd>
                  <Rating value={record.rating} size={10} tone="light" className="mt-2" />
                </div>
                <div>
                  <dt className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40">Watched</dt>
                  <dd className="mt-1 text-[12.5px] text-ink/75">{formatLongDate(record.watchedAt)}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40">Status</dt>
                  <dd className="mt-1 text-[12.5px] text-ink/75">
                    {STATUS_LABELS[record.status].label}
                    <span className="ml-2 zh-label text-[9px] text-ink/40">
                      {STATUS_LABELS[record.status].zh}
                    </span>
                  </dd>
                </div>
                {record.feltLike && (
                  <div>
                    <dt className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40">Felt like</dt>
                    <dd className="mt-1 text-[12.5px] text-ink/75">{record.feltLike}</dd>
                  </div>
                )}
              </dl>
            </Reveal>

            <Reveal delay={80} className="col-span-12 lg:col-span-8 lg:col-start-5">
              <blockquote className="border-t border-ink/20 pt-8">
                <p className="dropcap whitespace-pre-line font-display text-[clamp(1.5rem,2.3vw,2.1rem)] leading-[1.5] text-ink/90">
                  {record.reflection}
                </p>
              </blockquote>

              <div className="mt-10 grid gap-8 border-t border-ink/15 pt-6 sm:grid-cols-[1.1fr_1fr]">
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40">
                    Archive reading
                  </p>
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/35">
                    {record.ai.extractedFrom === 'seed'
                      ? 'Sample archive · editorial reading'
                      : `Local extraction · confidence ${percent(record.ai.confidence)}`}
                  </p>
                  <p className="mt-3 text-[12.5px] leading-relaxed text-ink/70">{record.ai.summary}</p>
                </div>
                <div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40">
                    About this reading
                  </p>
                  <p className="mt-3 text-[11px] leading-relaxed text-ink/50">
                    Extracted by a transparent keyword-and-weight pass over your note and the film's
                    tags. It is not a model's opinion, and it is stored only in this browser.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  III — What stayed with me                                        */}
      {/* ================================================================ */}
      <section className="chapter--ink">
        <div className="shell py-16 lg:py-20">
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <Reveal className="col-span-12 lg:col-span-4">
              <p className="artifact-label">
                <b>III</b> What stayed with me
              </p>
              <h2 className="mt-5 t-head">The things it left behind.</h2>
              <p className="mt-4 max-w-xs text-[11.5px] leading-relaxed text-paper-muted">
                Themes are the argument; moods are the texture. Both were read from your note and the
                film's own tags, then weighted by how often they recur.
              </p>

              <div className="mt-8">
                <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-paper-muted">
                  Emotional register
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {moods.map((mood) => (
                    <span key={mood.id} className="tag border-white/15 text-paper-dim">
                      {mood.label}
                      <span className="zh-label text-[8px] text-paper-muted/60">{mood.zh}</span>
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>

            <Reveal delay={80} className="col-span-12 lg:col-span-7 lg:col-start-6">
              <ul className="border-t border-white/15">
                {themes.map((theme, i) => (
                  <li
                    key={theme.id}
                    className="group flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-white/10 py-5"
                  >
                    <span className="font-mono text-[8px] tracking-[0.2em] text-brass">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-display text-[clamp(1.7rem,3vw,2.6rem)] leading-none text-paper">
                      {theme.label}
                    </span>
                    <span className="zh-label text-[9px] text-paper-muted/60">{theme.zh}</span>
                    <span className="ml-auto hidden max-w-[20rem] text-right text-[10.5px] leading-relaxed text-paper-muted sm:block">
                      {theme.blurb}
                    </span>
                  </li>
                ))}
                {themes.length === 0 && (
                  <li className="py-5 text-[12px] text-paper-muted">
                    No themes recorded for this entry yet.
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
      <section className="bg-[#181818] border-y border-white/10">
        <div className="shell py-16 lg:py-20">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/12 pb-5">
              <div>
                <p className="artifact-label">
                  <b>IV</b> My taste connection
                </p>
                <h2 className="mt-4 t-head">The film against your archive.</h2>
              </div>
              <p className="max-w-sm text-[11px] leading-relaxed text-paper-muted">
                Red is your archive's current position. The hollow square is this film's own
                signature. Distance is information, not error.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-x-16 gap-y-9 lg:grid-cols-2">
            {DIMENSIONS.map((def) => {
              const score = snapshot.dimensionScores.find((s) => s.key === def.key)
              const filmValue = film.signature[def.key]
              const distance = score ? Math.abs(score.value - filmValue) : 0
              return (
                <Reveal key={def.key} delay={40}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-[10.5px] uppercase tracking-[0.18em] text-paper-dim">
                      {def.label}
                    </p>
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-paper-muted">
                      {distance < 0.15 ? 'in tune' : distance < 0.32 ? 'adjacent' : 'in tension'}
                    </p>
                  </div>
                  <PoleAxis
                    value={score?.value ?? 0.5}
                    filmValue={filmValue}
                    low={def.low}
                    high={def.high}
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
                  <b>V</b> Related films
                </p>
                <h2 className="mt-4 t-head text-ink">Films that answer this one.</h2>
              </div>
              <p className="max-w-xs text-[11px] leading-relaxed text-ink/50">
                Selected by shared themes, not by genre or release year.
              </p>
            </div>
          </Reveal>

          <div className="mt-9 grid gap-8 sm:grid-cols-3">
            {related.map((item, i) => (
              <Reveal key={item.film.id} delay={i * 60}>
                <Link to={`/archive/${item.film.id}`} className="group block">
                  <FilmStill film={item.film} ratio="photo" tone="paper" />
                  <div className="mt-3 flex items-start justify-between gap-3 border-t border-ink/20 pt-2.5">
                    <div>
                      <p className="font-display text-[1.35rem] leading-tight text-ink transition-colors group-hover:text-brass">
                        {item.film.title}
                      </p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.14em] text-ink/45">
                        {item.film.director} · {item.film.year}
                      </p>
                    </div>
                    <ArrowUpRight size={13} className="mt-1 shrink-0 text-ink/30 transition-colors group-hover:text-brass" />
                  </div>
                  <p className="mt-2 text-[10.5px] text-ink/55">
                    {item.shared
                      .slice(0, 2)
                      .map((t) => THEMES[t].label)
                      .join(' · ')}
                  </p>
                </Link>
              </Reveal>
            ))}
            {related.length === 0 && (
              <p className="text-[12px] leading-relaxed text-ink/55 sm:col-span-3">
                No film shares two themes with this one yet. Add another and the map will find the
                connection.
              </p>
            )}
          </div>

          <div className="mt-14 grid gap-10 border-t border-ink/20 pt-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40">Cast</p>
              <p className="mt-2 text-[12.5px] text-ink/70">{film.cast.join(' · ')}</p>
            </div>
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-ink/40">
                Evidence from other frames
              </p>
              <ul className="mt-3 space-y-4">
                {evidence.map((item) => (
                  <li key={item.filmId} className="border-b border-ink/15 pb-3 last:border-0">
                    <Link to={`/archive/${item.filmId}`} className="group">
                      <p className="font-display text-[14px] italic leading-relaxed text-ink/70 group-hover:text-ink">
                        “{item.quote}”
                      </p>
                      <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-ink/40">
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
