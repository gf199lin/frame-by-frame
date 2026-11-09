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
import type { GraphNode, MoodId, ThemeId } from '@/types'

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

  const selectedRef = selected ? selected.id.split(':')[1] : ''
  const themeDef = selected?.kind === 'theme' ? THEMES[selectedRef as ThemeId] : undefined
  const moodDef = selected?.kind === 'mood' ? MOODS[selectedRef as MoodId] : undefined

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
        <p className="micro text-brass/80">03 — 记忆地图</p>
        <h1 className="mt-4 font-zh-title text-[clamp(2.2rem,4.6vw,4rem)] leading-tight">地图还没有亮起来</h1>
        <EmptyState
          className="mt-12"
          eyebrow="还没有星图"
          title="这片星座还没有形成"
          description="记忆地图会从你的电影、它们的主题，以及它们带给你的感受中自行绘制。添加两三部电影之后，连接就会出现。"
          action={
            <button type="button" onClick={() => openAdd()} className="btn btn-primary">
              添加电影
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="shell pb-20 pt-10 lg:pt-14">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <p className="artifact-label">
          <b>03</b> 记忆地图
        </p>
        <p className="folio">是一片星座，不是一张图表</p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-8 pt-7">
        <div>
          <h1 className="font-zh-title text-[clamp(2.5rem,6.4vw,5.4rem)] leading-[1.08] tracking-[-0.01em]">
            记忆地图
          </h1>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-taupe">Memory Map</p>
            <span className="hidden h-3 w-px bg-white/20 sm:block" />
            <p className="measure text-[14px] leading-[1.9] text-taupe">
              电影是一帧帧画面，主题是它们共享的地面，情绪是记忆摸起来的手感。
              拖动地图、拉动节点，沿着一条线走，直到它解释了什么。
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-10 gap-y-4 text-left sm:grid-cols-4 sm:text-right">
          {[
            ['电影', records.length],
            ['主题', themeCount],
            ['情绪', moodCount],
            ['共同关系', linkCount],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-[12px] tracking-[0.04em] text-taupe">{label}</dt>
              <dd className="num mt-1.5 text-[1.7rem] leading-none text-ink">
                {String(value).padStart(2, '0')}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-9 flex flex-wrap items-center justify-between gap-4 border-y border-ink/10 py-4">
        <GraphLegend showThemes={showThemes} showMoods={showMoods} />
        <div className="flex items-center gap-3">
          <span className="hidden text-[12px] tracking-[0.04em] text-taupe sm:inline">
            图层
          </span>
          <button
            type="button"
            onClick={() => setShowThemes((v) => !v)}
            className="relative pb-0.5 text-[12px] tracking-[0.04em] transition-colors"
            style={{ color: showThemes ? 'var(--ink)' : 'var(--taupe)' }}
            aria-pressed={showThemes}
          >
            主题
            <span
              className="absolute inset-x-0 -bottom-px h-px bg-brass transition-transform"
              style={{ transform: showThemes ? 'scaleX(1)' : 'scaleX(0)' }}
            />
          </button>
          <button
            type="button"
            onClick={() => setShowMoods((v) => !v)}
            className="relative pb-0.5 text-[12px] tracking-[0.04em] transition-colors"
            style={{ color: showMoods ? 'var(--ink)' : 'var(--taupe)' }}
            aria-pressed={showMoods}
          >
            情绪
            <span
              className="absolute inset-x-0 -bottom-px h-px bg-brass transition-transform"
              style={{ transform: showMoods ? 'scaleX(1)' : 'scaleX(0)' }}
            />
          </button>
        </div>
      </div>

      <div className="relative mt-6">
        <div className="relative h-[62vh] min-h-[480px] w-full border border-ink/20 lg:h-[68vh] lg:min-h-[560px]">
          <span className="pointer-events-none absolute -left-px -top-px z-10 h-3 w-3 border-l border-t border-brass/70" />
          <span className="pointer-events-none absolute -right-px -top-px z-10 h-3 w-3 border-r border-t border-brass/70" />
          <span className="pointer-events-none absolute -bottom-px -left-px z-10 h-3 w-3 border-b border-l border-brass/70" />
          <span className="pointer-events-none absolute -bottom-px -right-px z-10 h-3 w-3 border-b border-r border-brass/70" />
          {graph.nodes.length > 0 ? (
            <MemoryGraphView
              graph={graph}
              films={films}
              selectedId={selectedId}
              onSelect={(node: GraphNode | null) => setSelectedId(node?.id ?? null)}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[#211e19]">
              <p className="text-[14px] text-paper-dim">
                打开一个图层，地图就会重新出现。
              </p>
            </div>
          )}

          {selected && (
            <aside className="absolute bottom-4 left-4 top-4 z-10 w-[min(21rem,calc(100%-2rem))] overflow-y-auto border border-paper/20 bg-[#211e19]/95 p-5 backdrop-blur-md animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[12px] tracking-[0.06em] text-brass/80">
                  {selected.kind === 'film'
                    ? '电影节点'
                    : selected.kind === 'theme'
                      ? '主题节点'
                      : '情绪节点'}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-paper-dim transition-colors hover:text-paper"
                  aria-label="清除选择"
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
                        className="font-display text-2xl leading-tight text-paper hover:text-paper/70"
                      >
                        {selectedFilm.title}
                      </Link>
                      {selectedFilm.titleZh && (
                        <p className="mt-0.5 text-[13px] tracking-[0.04em] text-paper-dim">{selectedFilm.titleZh}</p>
                      )}
                      <p className="mt-1 text-[12px] tracking-[0.04em] text-paper-dim">
                        {selectedFilm.year} · {selectedFilm.director}
                      </p>
                      <Rating value={selectedRecord.rating} size={9} className="mt-2" />
                    </div>
                  </div>
                  <p className="mt-4 border-t border-paper/15 pt-3 font-zh-body text-[14px] leading-[1.85] text-paper-dim">
                    “{selectedRecord.reflection}”
                  </p>
                  <p className="mt-3 text-[12.5px] text-paper-dim">
                    观看于 {formatShortDate(selectedRecord.watchedAt)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {selectedRecord.themes.slice(0, 4).map((t) => (
                      <span key={t} className="tag text-[12px]">
                        {THEMES[t].zh}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={`/archive/${selectedFilm.id}`}
                    className="mt-5 inline-flex items-center gap-2 text-[12px] tracking-[0.06em] text-paper/70 hover:text-paper"
                  >
                    查看观影记忆 <ArrowUpRight size={11} />
                  </Link>
                </>
              ) : selected.kind === 'theme' ? (
                <>
                  <h3 className="mt-3 font-zh-title text-[1.6rem] text-paper">
                    {themeDef?.zh ?? selected.label}
                  </h3>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-paper-dim">
                    {themeDef?.label ?? selected.sublabel}
                  </p>
                  <p className="mt-3 text-[14px] leading-[1.85] text-paper-dim">
                    {themeDef?.blurbZh}
                  </p>
                  <p className="mt-4 text-[12.5px] tracking-[0.04em] text-paper-dim">
                    {relatedFilms.length} 部电影承载这个主题
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
                            <span className="block truncate font-display text-sm text-paper group-hover:text-paper">
                              {film.title}
                            </span>
                            <span className="text-[12px] text-paper-dim">{film.year}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <h3 className="mt-3 font-zh-title text-[1.6rem] text-paper">
                    {moodDef?.zh ?? selected.label}
                  </h3>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-paper-dim">
                    {moodDef?.label ?? selected.sublabel}
                  </p>
                  <p className="mt-3 text-[14px] leading-[1.85] text-paper-dim">
                    一种被 {relatedFilms.length} 部电影共享的感受。线是虚线，因为情绪是质地，不是议题。
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
                            <span className="block truncate font-display text-sm text-paper group-hover:text-paper">
                              {film.title}
                            </span>
                            <span className="text-[12px] text-paper-dim">{film.year}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {selected.kind === 'film' && relatedFilms.length > 0 && (
                <div className="mt-5 border-t border-paper/15 pt-4">
                  <p className="text-[12px] tracking-[0.06em] text-paper-dim">共同的地面</p>
                  <ul className="mt-2 space-y-2">
                    {relatedFilms.slice(0, 4).map(({ film, reason }) => (
                      <li key={film.id}>
                        <button
                          type="button"
                          onClick={() => {
                            const node = graph.nodes.find((n) => n.filmId === film.id)
                            if (node) setSelectedId(node.id)
                          }}
                          className="text-left text-[13px] leading-[1.8] text-paper-dim hover:text-paper"
                        >
                          <span className="text-paper-dim">{film.title}</span>
                          {reason && <span className="block text-[12.5px]">{reason}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          )}

          {!selected && (
            <div className="pointer-events-none absolute right-5 top-5 hidden max-w-[250px] border-l border-brass/60 pl-4 lg:block">
              <p className="flex items-center gap-2 text-[12px] tracking-[0.06em] text-brass">
                <Info size={10} /> 怎么读这张地图
              </p>
              <p className="mt-2.5 text-[13px] leading-[1.85] text-paper-dim">
                点一部电影，看它与哪些主题相连；点一个主题，看所有承载它的电影。
                拖动节点，可以重新排列这片星座。
              </p>
            </div>
          )}
        </div>

        <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-2 text-[12.5px] leading-relaxed text-taupe')}>
          <p>
            节点大小反映评分权重，或有多少篇笔记带着这个主题。电影之间的实线，至少需要两个共同主题。
          </p>
          <p className="font-mono tracking-[0.04em]">
            {graph.nodes.length} 个节点 · {graph.edges.length} 条连线
          </p>
        </div>
      </div>

      <div className="mt-14 grid gap-8 border-t border-ink/10 pt-10 sm:grid-cols-3">
        {[
          {
            title: '电影',
            body: '带电影自身色调的矩形。电影之间的实线表示至少有两个主题重叠——不是说明它们是同一部电影。',
          },
          {
            title: '主题',
            body: '按复现次数加权的菱形。「记忆」和「失去」在你这里靠得很近，因为你的笔记总把它们放进同一个房间。',
          },
          {
            title: '情绪',
            body: '虚线标记的是质地，而不是议题：电影让你感觉如何，而不是它论证了什么。两部电影可以只有情绪相同。',
          },
        ].map((item) => (
          <div key={item.title}>
            <p className="text-[12px] tracking-[0.06em] text-brass/80">{item.title}</p>
            <p className="mt-3 text-[14px] leading-[1.9] text-taupe">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
