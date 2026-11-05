import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Info, X } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { MemoryGraphView, GraphLegend } from '@/components/map/MemoryGraphView'
import { FilmPoster } from '@/components/film/FilmPoster'
import { EmptyState } from '@/components/ui/Primitives'
import { Rating } from '@/components/ui/Rating'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { buildMemoryGraph } from '@/lib/graph'
import { MOODS, THEMES } from '@/data/taxonomy'
import { cn, formatShortDate } from '@/lib/format'
import type { GraphNode } from '@/types'

export const MemoryMapPage = () => {
  const { records, films } = useAppStore()
  const { openAdd } = useAddFilm()
  const [showThemes, setShowThemes] = useState(true)
  const [showMoods, setShowMoods] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const graph = useMemo(
    () => buildMemoryGraph(records, films, { showThemes, showMoods }),
    [records, films, showThemes, showMoods],
  )

  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null
  const themeCount = graph.nodes.filter((n) => n.kind === 'theme').length
  const moodCount = graph.nodes.filter((n) => n.kind === 'mood').length
  const linkCount = graph.edges.filter((e) => e.kind === 'film-film').length

  const relatedFilms = useMemo(() => {
    if (!selected) return []
    if (selected.kind === 'film') {
      const record = records.find((r) => r.filmId === selected.filmId)
      if (!record) return []
      return graph.edges
        .filter((e) => e.kind === 'film-film' && (e.source === selected.id || e.target === selected.id))
        .map((edge) => {
          const otherId = edge.source === selected.id ? edge.target : edge.source
          const other = graph.nodes.find((n) => n.id === otherId)
          const film = other?.filmId ? films.find((f) => f.id === other.filmId) : null
          return film ? { film, reason: edge.reason ?? '' } : null
        })
        .filter((x): x is { film: NonNullable<ReturnType<typeof films.find>>; reason: string } => x !== null)
    }
    return graph.edges
      .filter((e) => e.kind !== 'film-film' && (e.source === selected.id || e.target === selected.id))
      .map((edge) => {
        const filmNodeId = edge.source === selected.id ? edge.target : edge.source
        const filmNode = graph.nodes.find((n) => n.id === filmNodeId)
        const film = filmNode?.filmId ? films.find((f) => f.id === filmNode.filmId) : null
        return film ? { film, reason: '' } : null
      })
      .filter((x): x is { film: NonNullable<ReturnType<typeof films.find>>; reason: string } => x !== null)
  }, [selected, graph, films, records])

  const selectedRecord = selected?.filmId
    ? records.find((r) => r.filmId === selected.filmId)
    : undefined
  const selectedFilm = selected?.filmId ? films.find((f) => f.id === selected.filmId) : undefined

  if (records.length === 0) {
    return (
      <div className="mx-auto max-w-shell px-5 py-20 lg:px-10">
        <p className="micro text-brass/80">03 — Memory Map</p>
        <h1 className="display-xl mt-4">The map is dark.</h1>
        <EmptyState
          className="mt-12"
          title="No constellation yet."
          description="The memory map draws itself from your films, their themes, and how they made you feel. Add two or three records and connections will appear."
          action={
            <button type="button" onClick={() => openAdd()} className="btn btn-primary">
              Add a film
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-shell px-5 pb-20 pt-12 lg:px-10 lg:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="micro whitespace-nowrap text-brass/80">03 — Memory Map</p>
            <span className="hidden h-px w-8 bg-white/20 sm:block" />
            <p className="micro hidden text-paper-muted sm:block">A constellation, not a chart</p>
          </div>
          <h1 className="display-hero mt-5">Memory map.</h1>
          <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-paper-dim">
            Films are frames. Themes are the ground they share. Moods are how the memory felt. Drag
            the map, pull a node, and follow a line until it explains something.
            <span className="mt-1 block text-paper-muted">
              电影是节点，主题是共同的地面，情绪是记忆的质地。
            </span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-left sm:grid-cols-4 sm:text-right">
          {[
            ['Films', records.length],
            ['Themes', themeCount],
            ['Moods', moodCount],
            ['Shared links', linkCount],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="micro-sm text-paper-muted">{label}</dt>
              <dd className="num mt-1 text-2xl leading-none text-paper">{String(value).padStart(2, '0')}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-white/10 py-4">
        <GraphLegend showThemes={showThemes} showMoods={showMoods} />
        <div className="flex items-center gap-2">
          <span className="hidden text-[9px] uppercase tracking-[0.16em] text-paper-muted sm:inline">
            Layers
          </span>
          <button
            type="button"
            onClick={() => setShowThemes((v) => !v)}
            className="chip h-8 text-[9px]"
            data-active={showThemes}
            aria-pressed={showThemes}
          >
            Themes
          </button>
          <button
            type="button"
            onClick={() => setShowMoods((v) => !v)}
            className="chip h-8 text-[9px]"
            data-active={showMoods}
            aria-pressed={showMoods}
          >
            Moods
          </button>
        </div>
      </div>

      <div className="relative mt-6">
        <div className="relative h-[62vh] min-h-[480px] w-full border border-white/10 lg:h-[68vh] lg:min-h-[560px]">
          {graph.nodes.length > 0 ? (
            <MemoryGraphView
              graph={graph}
              films={films}
              selectedId={selectedId}
              onSelect={(node: GraphNode | null) => setSelectedId(node?.id ?? null)}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#111111]">
              <p className="text-[12px] text-paper-muted">
                Turn a layer back on to see the map.
              </p>
            </div>
          )}

          {selected && (
            <aside className="absolute bottom-4 left-4 top-4 z-10 w-[min(21rem,calc(100%-2rem))] overflow-y-auto border border-white/15 bg-[#111111]/94 p-5 backdrop-blur-md animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <p className="micro-sm text-brass/80">
                  {selected.kind === 'film'
                    ? 'Film node'
                    : selected.kind === 'theme'
                      ? 'Theme node'
                      : 'Mood node'}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-paper-muted transition-colors hover:text-paper"
                  aria-label="Clear selection"
                >
                  <X size={13} />
                </button>
              </div>

              {selected.kind === 'film' && selectedFilm && selectedRecord ? (
                <>
                  <div className="mt-4 flex gap-3">
                    <Link to={`/archive/${selectedFilm.id}`} className="w-[74px] shrink-0">
                      <div className="aspect-[2/3] w-full overflow-hidden">
                        <FilmPoster film={selectedFilm} showTitle={false} />
                      </div>
                    </Link>
                    <div>
                      <Link
                        to={`/archive/${selectedFilm.id}`}
                        className="font-display text-2xl leading-tight text-paper hover:text-brass-soft"
                      >
                        {selectedFilm.title}
                      </Link>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-paper-muted">
                        {selectedFilm.year} · {selectedFilm.director}
                      </p>
                      <Rating value={selectedRecord.rating} size={9} className="mt-2" />
                    </div>
                  </div>
                  <p className="mt-4 border-t border-white/10 pt-3 text-[12px] leading-relaxed text-paper-dim">
                    “{selectedRecord.reflection}”
                  </p>
                  <p className="mt-3 text-[10px] text-paper-muted">
                    Watched {formatShortDate(selectedRecord.watchedAt)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {selectedRecord.themes.slice(0, 4).map((t) => (
                      <span key={t} className="tag text-[9px]">
                        {THEMES[t].label}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={`/archive/${selectedFilm.id}`}
                    className="micro mt-5 inline-flex items-center gap-2 text-brass hover:text-brass-soft"
                  >
                    Open memory <ArrowUpRight size={11} />
                  </Link>
                </>
              ) : selected.kind === 'theme' ? (
                <>
                  <h3 className="mt-3 font-display text-3xl text-paper">
                    {THEMES[selected.label as keyof typeof THEMES]?.label ?? selected.label}
                  </h3>
                  <p className="mt-1 text-[11px] tracking-[0.12em] text-paper-muted">
                    {THEMES[selected.label as keyof typeof THEMES]?.zh ?? selected.sublabel}
                  </p>
                  <p className="mt-3 text-[12px] leading-relaxed text-paper-dim">
                    {THEMES[selected.label as keyof typeof THEMES]?.blurb}
                  </p>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-paper-muted">
                    {relatedFilms.length} films hold this theme
                  </p>
                  <ul className="mt-3 divide-y divide-white/10">
                    {relatedFilms.map(({ film }) => (
                      <li key={film.id}>
                        <button
                          type="button"
                          onClick={() => {
                            const node = graph.nodes.find((n) => n.filmId === film.id)
                            if (node) setSelectedId(node.id)
                          }}
                          className="group flex w-full items-center gap-3 py-2.5 text-left"
                        >
                          <span className="relative block h-10 w-7 shrink-0 overflow-hidden">
                            <FilmPoster film={film} showTitle={false} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-sm text-paper group-hover:text-brass-soft">
                              {film.title}
                            </span>
                            <span className="text-[9px] text-paper-muted">{film.year}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <h3 className="mt-3 font-display text-3xl text-paper">
                    {MOODS[selected.label as keyof typeof MOODS]?.label ?? selected.label}
                  </h3>
                  <p className="mt-1 text-[11px] tracking-[0.12em] text-paper-muted">
                    {MOODS[selected.label as keyof typeof MOODS]?.zh ?? selected.sublabel}
                  </p>
                  <p className="mt-3 text-[12px] leading-relaxed text-paper-dim">
                    A felt register shared by {relatedFilms.length} films. The line is dashed because
                    mood is a texture, not a topic.
                  </p>
                  <ul className="mt-3 divide-y divide-white/10">
                    {relatedFilms.map(({ film }) => (
                      <li key={film.id}>
                        <button
                          type="button"
                          onClick={() => {
                            const node = graph.nodes.find((n) => n.filmId === film.id)
                            if (node) setSelectedId(node.id)
                          }}
                          className="group flex w-full items-center gap-3 py-2.5 text-left"
                        >
                          <span className="relative block h-10 w-7 shrink-0 overflow-hidden">
                            <FilmPoster film={film} showTitle={false} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-sm text-paper group-hover:text-brass-soft">
                              {film.title}
                            </span>
                            <span className="text-[9px] text-paper-muted">{film.year}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {selected.kind === 'film' && relatedFilms.length > 0 && (
                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="micro-sm text-paper-muted">Shared ground</p>
                  <ul className="mt-2 space-y-2">
                    {relatedFilms.slice(0, 4).map(({ film, reason }) => (
                      <li key={film.id}>
                        <button
                          type="button"
                          onClick={() => {
                            const node = graph.nodes.find((n) => n.filmId === film.id)
                            if (node) setSelectedId(node.id)
                          }}
                          className="text-left text-[11px] leading-relaxed text-paper-muted hover:text-paper"
                        >
                          <span className="text-paper-dim">{film.title}</span>
                          {reason && <span className="block text-[10px]">{reason}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          )}

          {!selected && (
            <div className="pointer-events-none absolute right-4 top-4 hidden max-w-[230px] border border-white/10 bg-[#111111]/70 p-3 backdrop-blur lg:block">
              <p className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-brass/80">
                <Info size={10} /> How to read
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-paper-muted">
                Click a film to see its shared themes. Click a theme to see every film that carries
                it. Drag a node to rearrange the constellation.
              </p>
            </div>
          )}
        </div>

        <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-paper-muted/60')}>
          <p>
            Node size reflects rating weight or how many notes carry that theme. Solid lines between
            films require at least two shared themes.
          </p>
          <p className="font-mono uppercase tracking-[0.14em]">
            {graph.nodes.length} nodes · {graph.edges.length} edges
          </p>
        </div>
      </div>

      <div className="mt-14 grid gap-8 border-t border-white/10 pt-10 sm:grid-cols-3">
        {[
          {
            title: 'Films',
            body: "A rectangle with the film's own palette. The solid lines between films mean at least two themes overlap — not that they are the same film.",
          },
          {
            title: 'Themes',
            body: 'Diamonds weighted by recurrence. Memory and Loss are close neighbours here because your notes keep putting them in the same room.',
          },
          {
            title: 'Moods',
            body: 'Dashed lines mark texture rather than topic: how a film felt, not what it argued. Two films can share a mood and nothing else.',
          },
        ].map((item) => (
          <div key={item.title}>
            <p className="micro text-brass/80">{item.title}</p>
            <p className="mt-3 text-[12px] leading-relaxed text-paper-muted">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
