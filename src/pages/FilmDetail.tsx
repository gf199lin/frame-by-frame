import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { useToast } from '@/components/ui/Toast'
import { FilmPoster } from '@/components/film/FilmPoster'
import { Rating } from '@/components/ui/Rating'
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
      <div className="mx-auto max-w-shell px-5 py-24 lg:px-10">
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
      <div className="mx-auto max-w-shell px-5 py-12 lg:px-10 lg:py-16">
        <Link to="/archive" className="micro inline-flex items-center gap-2 text-paper-muted hover:text-paper">
          <ArrowLeft size={12} /> The archive
        </Link>
        <div className="mt-10 grid gap-12 lg:grid-cols-[0.8fr_1fr] lg:gap-16">
          <div className="mx-auto w-full max-w-[360px]">
            <div className="aspect-[2/3] w-full overflow-hidden border border-white/15">
              <FilmPoster film={film} />
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <p className="micro text-brass">In the catalogue, not the archive</p>
            <h1 className="display-xl mt-3">{film.title}</h1>
            <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-paper-muted">
              {film.titleZh} · {film.year} · {film.director}
            </p>
            <p className="mt-6 max-w-lg font-display text-xl leading-relaxed text-paper-dim">{film.logline}</p>
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={() => openAdd(film.id)} className="btn btn-primary">
                <Plus size={14} /> Record this film
              </button>
              <Link to="/archive" className="btn btn-ghost">
                Back
              </Link>
            </div>
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
    .filter((x): x is { film: NonNullable<ReturnType<typeof filmById>>; record: typeof record; shared: typeof record.themes; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const onDelete = () => {
    deleteRecord(record.id)
    push(`${film.title} was removed from the archive.`, 'success')
    navigate('/archive')
  }

  return (
    <div>
      <div className="mx-auto max-w-shell px-5 pt-8 lg:px-10 lg:pt-10">
        <Link to="/archive" className="micro inline-flex items-center gap-2 text-paper-muted hover:text-paper">
          <ArrowLeft size={12} /> The archive
        </Link>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/*  Feature spread                                                     */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative mt-8 overflow-hidden border-b border-white/10 bg-ink">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(80% 90% at 18% 0%, rgba(200,59,53,0.16), transparent 58%), linear-gradient(110deg, #111111 0%, #151515 52%, #0d0d0d 100%)',
          }}
        />
        <div className="relative mx-auto grid max-w-shell gap-12 px-5 pb-14 pt-4 lg:grid-cols-[0.82fr_1.18fr] lg:gap-20 lg:px-10 lg:pb-20 lg:pt-6">
          <div className="mx-auto w-full max-w-[380px] lg:mx-0 lg:max-w-[430px]">
            <div className="relative">
              <div className="aspect-[2/3] w-full overflow-hidden border-t-2 border-brass border-x border-b border-white/20 shadow-[0_40px_120px_rgba(0,0,0,0.7)]">
                <FilmPoster film={film} eager />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3">
              <span className="font-mono text-[9px] tracking-[0.16em] text-paper-muted">
                FRAME {String(frameNumber).padStart(3, '0')} · {film.year} · {film.country}
              </span>
              <Rating value={record.rating} size={12} showValue />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-3">
              <p className="micro text-brass">{film.year} / {film.country}</p>
              <span className="h-px w-8 bg-brass" />
              <p className="micro text-paper-muted">
                {STATUS_LABELS[record.status].label} · {formatLongDate(record.watchedAt)}
              </p>
            </div>

            <h1 className="mt-5 max-w-4xl font-display text-6xl leading-[0.9] text-paper text-balance sm:text-7xl lg:text-8xl">
              {film.title}
            </h1>
            {film.titleZh && film.titleZh !== film.title && (
              <p className="mt-3 text-[12px] tracking-[0.14em] text-paper-muted">{film.titleZh}</p>
            )}

            <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-paper-dim">
              Directed by {film.director} · {film.runtime} min · {film.genres.join(' / ')}
            </p>

            <p className="mt-7 max-w-2xl font-display text-xl leading-relaxed text-paper-dim">
              {film.logline}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => openEdit(record)} className="btn btn-primary">
                <Pencil size={13} /> Edit this memory
              </button>
              <Link to={`/map`} className="btn btn-ghost">
                Find it on the map <ArrowUpRight size={12} />
              </Link>
              {confirmDelete ? (
                <div className="flex items-center gap-2 border border-brass/50 px-3 py-2">
                  <span className="text-[10px] text-paper-dim">Remove this record?</span>
                  <button type="button" onClick={onDelete} className="text-[10px] uppercase tracking-[0.14em] text-brass hover:text-brass-soft">
                    Remove
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-[10px] uppercase tracking-[0.14em] text-paper-muted hover:text-paper">
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 px-2 text-[10px] uppercase tracking-[0.14em] text-paper-muted transition-colors hover:text-brass"
                >
                  <Trash2 size={12} /> Remove
                </button>
              )}
            </div>

            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-white/15 pt-6 text-[12px] sm:grid-cols-4">
              {[
                ['Director', film.director],
                ['Released', String(film.year)],
                ['Runtime', formatMinutes(film.runtime)],
                ['Language', film.language],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="micro-sm text-paper-muted">{label}</dt>
                  <dd className="mt-1 text-paper-dim">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  The note / paper spread                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="paper-section border-b border-ink/15">
        <div className="mx-auto max-w-shell px-5 py-16 lg:px-10 lg:py-24">
          <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink/15 pb-3">
                <p className="micro text-brass">The note</p>
                <p className="font-mono text-[10px] tracking-[0.14em] text-ink/45">
                  {formatLongDate(record.watchedAt)} · {STATUS_LABELS[record.status].label}
                </p>
              </div>
              <blockquote className="mt-7">
                <p className="whitespace-pre-line font-display text-[28px] leading-[1.38] text-ink sm:text-[34px] first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-display first-letter:text-[72px] first-letter:leading-[0.7] first-letter:text-brass">
                  {record.reflection}
                </p>
              </blockquote>
              <div className="mt-9 flex flex-wrap items-center gap-4 border-t border-ink/15 pt-5">
                <Rating value={record.rating} size={13} showValue tone="light" />
                <span className="h-3 w-px bg-ink/20" />
                <span className="text-[11px] text-ink/60">
                  {record.feltLike
                    ? `Felt like: ${record.feltLike}`
                    : 'No mood recorded — the archive read it from the note.'}
                </span>
              </div>
            </div>

            <aside className="border-t border-ink/15 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <p className="micro text-brass">Archive reading</p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
                {record.ai.extractedFrom === 'seed'
                  ? 'Sample archive · editorial reading'
                  : `Local extraction · confidence ${percent(record.ai.confidence)}`}
              </p>
              <p className="mt-4 text-[13px] leading-relaxed text-ink/70">{record.ai.summary}</p>

              <div className="mt-7">
                <p className="micro-sm text-ink/50">Themes</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {themes.map((theme) => (
                    <span key={theme.id} className="tag border-brass/30 bg-brass/[0.05] text-brass">
                      {theme.label}
                      <span className="text-ink/45">{theme.zh}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="micro-sm text-ink/50">Emotional register</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {moods.map((mood) => (
                    <span key={mood.id} className="tag border-ink/20 text-ink/65">
                      {mood.label}
                      <span className="text-ink/40">{mood.zh}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-7 border-t border-ink/15 pt-5">
                <p className="micro-sm text-ink/50">About this reading</p>
                <p className="mt-2 text-[11px] leading-relaxed text-ink/50">
                  Extracted by a transparent keyword-and-weight pass over your note and the film's
                  tags. It is not a model's opinion, and it is stored only in this browser.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Position against the archive                                      */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-b border-white/10 bg-[#181818]">
        <div className="mx-auto max-w-shell px-5 py-14 lg:px-10 lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="micro text-brass">Where this film sits</p>
              <h2 className="mt-3 font-display text-4xl text-paper sm:text-5xl">
                The film against your archive.
              </h2>
            </div>
            <p className="max-w-sm text-[11px] leading-relaxed text-paper-muted">
              Red is your archive's current position. The square is this film's own signature.
              Distance is information, not error.
            </p>
          </div>

          <div className="mt-10 grid gap-x-16 gap-y-9 lg:grid-cols-2">
            {DIMENSIONS.map((def) => {
              const score = snapshot.dimensionScores.find((s) => s.key === def.key)
              const filmValue = film.signature[def.key]
              const distance = score ? Math.abs(score.value - filmValue) : 0
              return (
                <div key={def.key}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-paper-dim">
                      {def.label}
                    </p>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper-muted">
                      {distance < 0.15 ? 'in tune' : distance < 0.32 ? 'adjacent' : 'in tension'}
                    </p>
                  </div>
                  <PoleAxis
                    value={score?.value ?? 0.5}
                    filmValue={filmValue}
                    low={def.low}
                    high={def.high}
                    className="mt-2"
                  />
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Shared ground / evidence                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="paper-section">
        <div className="mx-auto max-w-shell px-5 py-16 lg:px-10 lg:py-24">
          <div className="grid gap-14 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">
            <div>
              <p className="micro text-brass">Shared ground</p>
              <h2 className="mt-3 font-display text-4xl text-ink sm:text-5xl">Films that answer this one.</h2>
              <div className="mt-8 grid gap-6 sm:grid-cols-3">
                {related.map((item) => (
                  <Link key={item.film.id} to={`/archive/${item.film.id}`} className="poster-hover group">
                    <div className="aspect-[2/3] w-full overflow-hidden border border-ink/15">
                      <FilmPoster film={item.film} showTitle={false} />
                    </div>
                    <p className="mt-3 font-display text-xl leading-tight text-ink group-hover:text-brass">
                      {item.film.title}
                    </p>
                    <p className="mt-1 text-[10px] text-ink/50">
                      {item.shared
                        .slice(0, 2)
                        .map((t) => THEMES[t].label)
                        .join(' · ')}
                    </p>
                  </Link>
                ))}
                {related.length === 0 && (
                  <p className="text-[12px] leading-relaxed text-ink/55 sm:col-span-3">
                    No film shares two themes with this one yet. Add another and the map will find the
                    connection.
                  </p>
                )}
              </div>

              <div className="mt-10 border-t border-ink/15 pt-6">
                <p className="micro text-ink/45">Cast</p>
                <p className="mt-2 text-[12px] text-ink/70">{film.cast.join(' · ')}</p>
              </div>
            </div>

            <div className="border-t border-ink/15 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <p className="micro text-brass">Evidence from other frames</p>
              <ul className="mt-4 space-y-4">
                {evidence.map((item) => (
                  <li key={item.filmId} className="border-b border-ink/15 pb-4 last:border-0">
                    <Link to={`/archive/${item.filmId}`} className="group">
                      <p className="font-display text-[15px] italic leading-relaxed text-ink/70 group-hover:text-ink">
                        “{item.quote}”
                      </p>
                      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
                        {item.filmTitle} · {item.year}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[10px] leading-relaxed text-ink/40">
                Evidence is selected by keyword proximity to the emotional dimension, not by a model
                reading the whole note.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
