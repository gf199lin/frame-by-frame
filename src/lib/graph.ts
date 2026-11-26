import { MOODS, THEMES } from '@/data/taxonomy'
import type {
  Film,
  GraphEdge,
  GraphNode,
  MemoryGraph,
  MoodId,
  TasteObservation,
  ThemeId,
  WatchRecord,
} from '@/types'
import { filmById, recordsSorted } from './tasteEngine'
import { STAGE_COPY } from './taste/evolution'

const filmNodeId = (id: string) => `film:${id}`
const themeNodeId = (id: ThemeId) => `theme:${id}`
const moodNodeId = (id: MoodId) => `mood:${id}`
const observationNodeId = (id: string) => `observation:${id}`

export type GraphOptions = {
  showThemes?: boolean
  showMoods?: boolean
  showObservations?: boolean
  /** Derived taste observations; never passed in from a hand-written list. */
  observations?: TasteObservation[]
}

/**
 * Builds a three-layer memory graph:
 *   film — theme — film   (shared thematic ground)
 *   film — mood           (how the memory felt)
 * Everything is derived from the archive, never authored by hand.
 */
export const buildMemoryGraph = (
  records: WatchRecord[],
  films: Film[],
  options: GraphOptions = {},
): MemoryGraph => {
  const { showThemes = true, showMoods = true, showObservations = true } = options
  const observations = showObservations ? (options.observations ?? []) : []
  const latestByFilm = new Map(recordsSorted(records, 'asc').map((record) => [record.filmId, record]))
  const usable = [...latestByFilm.values()].filter((record) => filmById(films, record.filmId))
  if (usable.length === 0 && observations.length === 0) return { nodes: [], edges: [] }

  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []

  const themeAgg = new Map<ThemeId, { weight: number; count: number }>()
  const moodAgg = new Map<MoodId, { weight: number; count: number }>()

  for (const record of usable) {
    const film = filmById(films, record.filmId) as Film
    nodes.set(filmNodeId(film.id), {
      id: filmNodeId(film.id),
      kind: 'film',
      label: film.title,
      sublabel: `${film.year} · ${film.director}`,
      weight: 0.55 + record.rating / 10,
      filmId: film.id,
      degree: 0,
    })

    for (const theme of record.themes) {
      const w = film.themes[theme] ?? 0.45
      const agg = themeAgg.get(theme) ?? { weight: 0, count: 0 }
      themeAgg.set(theme, { weight: agg.weight + w, count: agg.count + 1 })
    }
    for (const mood of record.moods) {
      const w = film.moods[mood] ?? 0.45
      const agg = moodAgg.get(mood) ?? { weight: 0, count: 0 }
      moodAgg.set(mood, { weight: agg.weight + w, count: agg.count + 1 })
    }
  }

  const maxTheme = Math.max(...Array.from(themeAgg.values()).map((v) => v.weight), 1)
  const maxMood = Math.max(...Array.from(moodAgg.values()).map((v) => v.weight), 1)

  if (showThemes) {
    for (const [id, agg] of themeAgg) {
      nodes.set(themeNodeId(id), {
        id: themeNodeId(id),
        kind: 'theme',
        label: THEMES[id].zh,
        sublabel: THEMES[id].label,
        weight: 0.3 + (agg.weight / maxTheme) * 0.7,
        degree: agg.count,
      })
    }
  }
  if (showMoods) {
    for (const [id, agg] of moodAgg) {
      nodes.set(moodNodeId(id), {
        id: moodNodeId(id),
        kind: 'mood',
        label: MOODS[id].zh,
        sublabel: MOODS[id].label,
        weight: 0.25 + (agg.weight / maxMood) * 0.55,
        degree: agg.count,
      })
    }
  }

  for (const record of usable) {
    const film = filmById(films, record.filmId) as Film
    if (showThemes) {
      for (const theme of record.themes) {
        edges.push({
          id: `${film.id}-${theme}`,
          source: filmNodeId(film.id),
          target: themeNodeId(theme),
          kind: 'film-theme',
          weight: film.themes[theme] ?? 0.45,
        })
      }
    }
    if (showMoods) {
      for (const mood of record.moods) {
        edges.push({
          id: `${film.id}-${mood}`,
          source: filmNodeId(film.id),
          target: moodNodeId(mood),
          kind: 'film-mood',
          weight: film.moods[mood] ?? 0.45,
        })
      }
    }
  }

  /* film ↔ film, only when at least two themes are genuinely shared */
  const filmLinks: GraphEdge[] = []
  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      const a = usable[i]
      const b = usable[j]
      const shared = a.themes.filter((t) => b.themes.includes(t))
      if (shared.length < 2) continue
      const titleA = filmById(films, a.filmId)?.title ?? 'A film'
      const titleB = filmById(films, b.filmId)?.title ?? 'A film'
      const labels = shared
        .slice(0, 3)
        .map((t) => THEMES[t].zh)
        .join('、')
      filmLinks.push({
        id: `link-${a.filmId}-${b.filmId}`,
        source: filmNodeId(a.filmId),
        target: filmNodeId(b.filmId),
        kind: 'film-film',
        weight: Math.min(1, shared.length / 4),
        reason: `《${titleA}》与《${titleB}》共享「${labels}」。`,
      })
    }
  }

  /* Taste observations: a fourth layer that only exists while evidence exists. */
  if (observations.length > 0) {
    for (const observation of observations) {
      const filmIds = Array.from(new Set(observation.evidence.map((item) => item.film_id)))
      if (filmIds.length === 0) continue
      nodes.set(observationNodeId(observation.observation_id), {
        id: observationNodeId(observation.observation_id),
        kind: 'observation',
        label: observation.title,
        sublabel: `${STAGE_COPY[observation.current_stage].zh} · ${Math.round(
          observation.confidence * 100,
        )}%`,
        weight: Math.max(0.15, observation.confidence),
        degree: filmIds.length,
      })
      for (const filmId of filmIds) {
        if (!filmById(films, filmId)) continue
        const evidence = observation.evidence.find((item) => item.film_id === filmId)
        edges.push({
          id: `${observation.observation_id}-${filmId}`,
          source: observationNodeId(observation.observation_id),
          target: filmNodeId(filmId),
          kind: 'film-observation',
          weight: evidence?.strength ?? 0.3,
          reason:
            evidence?.polarity === 'contradicting'
              ? `《${evidence.film_title}》提供了反向证据。`
              : evidence
                ? `这条观察由《${evidence.film_title}》中的原句支撑。`
                : undefined,
        })
      }
    }
  }

  /* Keep the graph legible: three strongest links per film. */
  const keptLinks: GraphEdge[] = []
  for (const node of Array.from(nodes.values()).filter((n) => n.kind === 'film')) {
    const perFilm = filmLinks
      .filter((e) => e.source === node.id || e.target === node.id)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
    for (const edge of perFilm) {
      if (!keptLinks.some((e) => e.id === edge.id)) keptLinks.push(edge)
    }
  }

  const allEdges = [...edges, ...keptLinks]
  const degree = new Map<string, number>()
  for (const edge of allEdges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }
  for (const node of nodes.values()) {
    node.degree = degree.get(node.id) ?? node.degree
  }

  /* Drop orphan theme/mood nodes that lost their films to filters. */
  const nodeIds = new Set(nodes.keys())
  const filteredEdges = allEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
  const linked = new Set(filteredEdges.flatMap((e) => [e.source, e.target]))
  for (const id of Array.from(nodes.keys())) {
    if (!linked.has(id) && nodes.get(id)?.kind !== 'film') nodes.delete(id)
  }

  return { nodes: Array.from(nodes.values()), edges: filteredEdges }
}

export const nodeFilmId = (node: GraphNode): string | undefined =>
  node.kind === 'film' ? node.filmId : undefined

export const neighborsOf = (graph: MemoryGraph, nodeId: string): MemoryGraph => {
  const edgeSet = graph.edges.filter((e) => e.source === nodeId || e.target === nodeId)
  const keep = new Set<string>([nodeId])
  for (const e of edgeSet) {
    keep.add(e.source)
    keep.add(e.target)
  }
  return {
    nodes: graph.nodes.filter((n) => keep.has(n.id)),
    edges: edgeSet,
  }
}
