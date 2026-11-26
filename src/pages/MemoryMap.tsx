import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FilmPoster } from '@/components/film/FilmPoster'
import { MemoryGraphView } from '@/components/map/MemoryGraphView'
import { formatShortDate } from '@/lib/format'
import { buildCinemaConnectionGraph, buildCinemaConnections, connectionKinds } from '@/lib/cinemaConnections'
import { useAppStore } from '@/store/AppStore'

export const MemoryMapPage = () => {
  const { records, films, observations } = useAppStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [category, setCategory] = useState<keyof typeof connectionKinds | 'all'>('all')
  const connections = useMemo(() => buildCinemaConnections(records, films, observations), [records, films, observations])
  const visible = useMemo(() => connections.filter(connection => category === 'all' || connection.kind === category), [connections, category])
  const graph = useMemo(() => buildCinemaConnectionGraph(records, films, visible), [records, films, visible])
  const selected = visible.find(connection => connection.id === selectedId)
  const filmConnections = selectedId ? visible.filter(connection => connection.pair.some(({ film }) => 'film:' + film.id === selectedId)) : []
  const selectedFilm = graph.nodes.find(node => node.id === selectedId && node.kind === 'film')

  return (
    <main className="shell py-10 lg:py-16">
      <p className="kicker">Personal Cinema Memory Map</p>
      <h1 className="mt-3 font-zh-title text-5xl text-ink">记忆地图</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-ink/75">从你确认过的观影笔记里，寻找不同电影之间值得回看的联系。</p>

      <div className="my-6 flex flex-wrap gap-2" aria-label="筛选关系类型">
        <button type="button" className={'btn ' + (category === 'all' ? 'btn-primary' : 'btn-ghost')} aria-pressed={category === 'all'} onClick={() => { setCategory('all'); setSelectedId(null) }}>全部联系</button>
        {(Object.keys(connectionKinds) as (keyof typeof connectionKinds)[]).map(kind => (
          <button key={kind} type="button" className={'btn ' + (category === kind ? 'btn-primary' : 'btn-ghost')} aria-pressed={category === kind} onClick={() => { setCategory(kind); setSelectedId(null) }}>
            <svg aria-hidden="true" width="24" height="10" viewBox="0 0 24 10"><path d="M0 5H24" stroke="currentColor" strokeWidth="2" strokeDasharray={connectionKinds[kind].dash} /></svg>
            {connectionKinds[kind].label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1.45fr_1fr]">
        {graph.nodes.length > 0 ? (
          <MemoryGraphView graph={graph} films={films} selectedId={selectedId} onSelect={node => setSelectedId(node?.id ?? null)} className="min-w-0" />
        ) : <p className="border border-ink/15 p-6">记录一部电影后，它会出现在这里。</p>}

        <section className="min-w-0 border border-ink/15 bg-paper-sheet p-5 sm:p-7" aria-label="探索电影关系">
          {selected ? (
            <>
              <p className="text-sm text-ink/70">{connectionKinds[selected.kind].label} · {selected.supported ? '有多部电影的笔记支持' : '待探索'}</p>
              <h2 className="mt-2 font-zh-title text-2xl">{selected.title}</h2>
              <p className="mt-4 leading-relaxed">
                {selected.contrast
                  ? '这两条笔记触及同一项审美观察，但其中一条提供了不同方向的证据。可以把两种读法放在一起看。'
                  : '这两条笔记分别为同一项审美观察提供了线索。下面是每条原文以及它在审美观察中的解读。'}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-4">
                {selected.pair.map(({ film, record, quote }) => {
                  const path = '/archive/' + film.id
                  return <article key={record.id} className="min-w-0">
                    <Link to={path} className="block max-w-[116px]" aria-label={film.titleZh || film.title}><FilmPoster film={film} showTitle={false} /></Link>
                    <h3 className="mt-2 font-zh-title">{film.titleZh || film.title}</h3>
                    <p className="text-sm text-ink/65">{formatShortDate(record.watchedAt)}</p>
                    <blockquote className="mt-3 break-words border-l-2 border-brass/60 pl-3 leading-relaxed">“{quote}”</blockquote>
                    <Link to={path + '?record=' + encodeURIComponent(record.id) + '#viewing-' + encodeURIComponent(record.id)} className="link-rule mt-3">查看原始笔记</Link>
                  </article>
                })}
              </div>
              <details className="mt-6 border-t border-ink/15 pt-4">
                <summary className="cursor-pointer font-medium">比较关联电影</summary>
                <p className="mt-3 text-sm leading-relaxed">{selected.contrast ? '相似点是两条记录触及同一观察，差异是它们对同一观察提供了不同方向的证据。' : '两条笔记支持同一观察。具体关注点见下面两条独立解读。'}</p>
                <ul className="mt-3 space-y-3">
                  {selected.pair.map(({ film, item }) => <li key={item.evidence_id}><strong>{film.titleZh || film.title}</strong><p className="text-sm leading-relaxed">{item.interpretation}</p></li>)}
                </ul>
              </details>
              <p className="mt-5 text-sm text-ink/75">目前有 {selected.supportingCount} 部电影的笔记提供同方向的证据。</p>
              <Link className="link-rule mt-2" to={'/taste/observations/' + selected.observation.observation_id}>去观影品味查看这项观察</Link>
            </>
          ) : (
            <>
              <h2 className="font-zh-title text-2xl">{selectedFilm?.label ?? '从一条联系开始'}</h2>
              {selectedFilm?.filmId && <Link className="link-rule mt-3" to={'/archive/' + selectedFilm.filmId}>查看电影档案</Link>}
              {(selectedFilm ? filmConnections : visible).length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {(selectedFilm ? filmConnections : visible).map(connection => <li key={connection.id}><button type="button" onClick={() => setSelectedId(connection.id)} className="w-full border-b border-ink/10 py-2 text-left hover:text-brass-ink">{connection.title} <span className="block text-xs text-ink/65">{connectionKinds[connection.kind].label}</span></button></li>)}
                </ul>
              ) : <p className="mt-4 leading-relaxed text-ink/75">目前没有足够的笔记证据建立这类联系。记录更多电影并确认引用了原文的分析后，地图会更新。</p>}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
