import type { DimensionKey, Film, MemoryGraph, TasteObservation, WatchRecord } from '@/types'

export const connectionKinds = {
  thematic: { label: '思想与主题', dash: undefined, stroke: '#292f75' },
  character: { label: '人物与选择', dash: '8 4', stroke: '#6b552f' },
  cinematic: { label: '电影艺术表达', dash: '2 4', stroke: '#455778' },
  personal: { label: '个人记忆与情感共鸣', dash: '10 3 2 3', stroke: '#8a6c38' },
} as const

const dimensionKind: Record<DimensionKey, keyof typeof connectionKinds> = {
  thematic: 'thematic',
  character: 'character',
  narrative: 'cinematic',
  visual: 'cinematic',
  ending: 'cinematic',
  emotion: 'personal',
}

export const buildCinemaConnections = (records: WatchRecord[], films: Film[], observations: TasteObservation[]) => {
  const recordById = new Map(records.map(record => [record.id, record]))
  const filmById = new Map(films.map(film => [film.id, film]))
  return observations.flatMap(observation => {
    if (observation.latest_feedback?.decision === 'rejected') return []
    const evidence = observation.evidence.flatMap(item => {
      const record = recordById.get(item.record_id)
      const film = filmById.get(item.film_id)
      const quote = item.original_quote.trim()
      if (!film || !record || record.source === 'seed' || record.filmId !== film.id ||
          item.user_removed || item.polarity === 'neutral' || !quote || !record.reflection.includes(quote)) return []
      return [{ item, film, record, quote }]
    }).sort((a, b) => b.item.strength - a.item.strength)

    const supporting = evidence.filter(({ item }) => item.polarity === 'supporting')
    const supportingCount = new Set(supporting.map(({ film }) => film.id)).size
    if (!supportingCount) return []
    const primary = supporting[0]
    const contrast = evidence.find(({ item, film }) => item.polarity === 'contradicting' && film.id !== primary.film.id)
    const second = contrast ?? supporting.find(({ film }) => film.id !== primary.film.id)
    if (!second) return []

    return [{
      id: 'observation:' + observation.observation_id,
      observation,
      kind: dimensionKind[observation.dimension],
      title: observation.title,
      pair: [primary, second] as const,
      supportingCount,
      contrast: Boolean(contrast),
      supported: supportingCount >= 3 && observation.current_stage === 'established',
    }]
  })
}

export type CinemaConnection = ReturnType<typeof buildCinemaConnections>[number]

export const buildCinemaConnectionGraph = (records: WatchRecord[], films: Film[], connections: CinemaConnection[]): MemoryGraph => {
  const recordedFilms = new Set(records.map(record => record.filmId))
  const edges = connections.flatMap(connection => connection.pair.map(({ film }) => ({
    id: connection.id + ':' + film.id,
    source: connection.id,
    target: 'film:' + film.id,
    kind: 'film-observation' as const,
    connectionKind: connection.kind,
    weight: 0.8,
  })))
  return {
    edges,
    nodes: [
      ...films.filter(film => recordedFilms.has(film.id)).map(film => ({
        id: 'film:' + film.id,
        filmId: film.id,
        label: film.titleZh || film.title,
        sublabel: film.title,
        kind: 'film' as const,
        weight: 1,
        degree: edges.filter(edge => edge.target === 'film:' + film.id).length,
      })),
      ...connections.map(connection => ({
        id: connection.id,
        label: connection.title,
        sublabel: connectionKinds[connection.kind].label,
        kind: 'observation' as const,
        weight: 0.8,
        degree: 2,
      })),
    ],
  }
}
