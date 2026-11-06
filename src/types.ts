/* ------------------------------------------------------------------ */
/*  Core domain types                                                  */
/*  These mirror the future FastAPI / PostgreSQL contract closely      */
/*  enough that the mock layer can be swapped for a real API later.    */
/* ------------------------------------------------------------------ */

export type DimensionKey =
  | 'narrative'
  | 'emotion'
  | 'thematic'
  | 'visual'
  | 'character'
  | 'ending'

export type DimensionDef = {
  key: DimensionKey
  index: string
  label: string
  labelZh: string
  low: string
  high: string
  lowZh: string
  highZh: string
  question: string
  note: string
}

export type ThemeId =
  | 'memory'
  | 'loss'
  | 'grief'
  | 'identity'
  | 'love'
  | 'ambition'
  | 'freedom'
  | 'family'
  | 'hope'
  | 'loneliness'
  | 'art'
  | 'time'
  | 'reality'
  | 'friendship'
  | 'coming-of-age'
  | 'forgiveness'
  | 'sacrifice'
  | 'justice'

export type MoodId =
  | 'melancholy'
  | 'tender'
  | 'wistful'
  | 'hopeful'
  | 'restrained'
  | 'cathartic'
  | 'uneasy'
  | 'awe'
  | 'warmth'
  | 'longing'
  | 'playful'
  | 'quiet'

export type WatchStatus = 'watched' | 'rewatched' | 'abandoned'

export type PosterMotif =
  | 'shore'
  | 'orbit'
  | 'stage'
  | 'dome'
  | 'hotel'
  | 'bench'
  | 'space'
  | 'wall'
  | 'mind'
  | 'forest'
  | 'moon'
  | 'arrival'
  | 'signal'
  | 'drum'
  | 'city'
  | 'fire'

export type FilmPalette = {
  base: string
  deep: string
  accent: string
  soft: string
  paper: string
}

/* ------------------------------------------------------------------ */
/*  Artwork                                                            */
/*  Every image that stands for a real film must be a real, traceable   */
/*  asset. TMDB paths are preferred; verified local copies are the      */
/*  fallback. No generated imagery is allowed here.                    */
/* ------------------------------------------------------------------ */

export type ArtworkProvider = 'tmdb' | 'local'

export type FilmImage = {
  provider: ArtworkProvider
  /** TMDB file path, e.g. "/abc123.jpg". Required when provider is "tmdb". */
  path?: string
  /** Root-relative or absolute URL. Required when provider is "local". */
  url?: string
  /** Intrinsic size of the served file, used to reserve layout space. */
  width: number
  height: number
  language?: string
  /** Page where this exact file can be verified. */
  sourceUrl: string
  credit: string
  license?: string
}

export type FilmArtwork = {
  tmdbId?: number
  poster?: FilmImage
  backdrop?: FilmImage
  stills?: FilmImage[]
  /** ISO date of the last manual verification. */
  verifiedAt: string
  /** How the film ↔ artwork match was established. */
  matchSource: 'wikidata-tmdb-id' | 'tmdb-api' | 'catalog'
  /** Archived TMDB page used to harvest the paths (provenance). */
  evidenceUrl?: string
}

export type Film = {
  id: string
  title: string
  titleZh: string
  year: number
  director: string
  runtime: number
  genres: string[]
  country: string
  language: string
  tagline: string
  logline: string
  cast: string[]
  motif: PosterMotif
  palette: FilmPalette
  /** Verified TMDB movie id, used to fetch official artwork by id. */
  tmdbId?: number
  /** Verified real artwork. Never generated. */
  artwork?: FilmArtwork
  /** Legacy user-supplied image URL. */
  posterUrl?: string
  /** 0 = low pole, 1 = high pole — the film's own aesthetic signature. */
  signature: Record<DimensionKey, number>
  themes: Partial<Record<ThemeId, number>>
  moods: Partial<Record<MoodId, number>>
  narrativeTags: string[]
  characterTags: string[]
  /** Seed films users may recognise but have not recorded yet. */
  catalogOnly?: boolean
}

export type AIMeta = {
  /** Hand-written for seed records; generated for user records. */
  summary: string
  extractedFrom: 'seed' | 'local-engine' | 'backend'
  confidence: number
}

export type WatchRecord = {
  id: string
  filmId: string
  rating: number
  watchedAt: string
  status: WatchStatus
  reflection: string
  /** How the user felt while watching, chosen, not inferred. */
  feltLike?: string
  themes: ThemeId[]
  moods: MoodId[]
  createdAt: string
  updatedAt: string
  source: 'seed' | 'user'
  ai: AIMeta
}

export type DimensionFeedback = {
  verdict: 'agree' | 'not-quite' | 'corrected'
  correction?: string
  updatedAt: string
}

export type TimelineVerdict = {
  verdict: 'agree' | 'not-quite' | 'corrected'
  correction?: string
  updatedAt: string
}

export type TasteFeedbackMap = Partial<Record<DimensionKey, DimensionFeedback>>
export type TimelineFeedbackMap = Record<string, TimelineVerdict>

export type AppState = {
  version: number
  /** Seed records and user records live in one list. */
  records: WatchRecord[]
  feedback: TasteFeedbackMap
  timelineFeedback: TimelineFeedbackMap
  /** Films added manually (not in the built-in catalog). */
  customFilms: Film[]
  /** Free-form notes the user writes when correcting the AI. */
  corrections: Array<{ id: string; scope: string; text: string; createdAt: string }>
  yearbookGenerations: string[]
}

/* ------------------------------------------------------------------ */
/*  Analysis contracts (local mock now, DeepWorks agents later)        */
/* ------------------------------------------------------------------ */

export type FilmMatch = {
  film: Film
  score: number
}

export type TasteFinding = {
  key: string
  dimension: DimensionKey
  headline: string
  detail: string
  before: number
  after: number
  confidence: number
}

export type FilmConnection = {
  filmId: string
  title: string
  reason: string
  shared: string[]
}

export type AnalysisResult = {
  themes: ThemeId[]
  moods: MoodId[]
  connections: FilmConnection[]
  findings: TasteFinding[]
  summary: string
  /** Taste scores the engine had before this record was committed. */
  beforeScores: Record<DimensionKey, number>
  afterScores: Record<DimensionKey, number>
  confidenceBefore: number
  confidenceAfter: number
}

export type AnalysisStage = {
  id: string
  label: string
  detail: string
}

export type AddFilmDraft = {
  filmId: string
  rating: number
  watchedAt: string
  status: WatchStatus
  reflection: string
  feltLike?: string
}

/* ------------------------------------------------------------------ */
/*  Aggregated read models                                             */
/* ------------------------------------------------------------------ */

export type DimensionScore = {
  key: DimensionKey
  def: DimensionDef
  /** 0..1 position on the pole axis. */
  value: number
  /** 0..1 */
  confidence: number
  evidenceFilmIds: string[]
  /** how much this dimension leans toward either pole, 0..1 */
  strength: number
  /** true when there is not enough data to be opinionated */
  thin: boolean
}

export type EvidenceQuote = {
  filmId: string
  filmTitle: string
  year: number
  quote: string
  rating: number
  watchedAt: string
}

export type TasteSnapshot = {
  filmCount: number
  dimensionScores: DimensionScore[]
  overallConfidence: number
  topThemes: Array<{ id: ThemeId; weight: number; count: number }>
  topMoods: Array<{ id: MoodId; weight: number; count: number }>
  averageRating: number
  totalMinutes: number
}

export type TimelineStage = {
  id: string
  filmCount: number
  at: string
  headline: string
  body: string
  topTheme?: ThemeId
  confidence: number
  /** films included in this snapshot */
  filmIds: string[]
}

export type GraphNode = {
  id: string
  kind: 'film' | 'theme' | 'mood'
  label: string
  sublabel?: string
  weight: number
  filmId?: string
  degree: number
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  kind: 'film-theme' | 'film-mood' | 'film-film'
  weight: number
  reason?: string
}

export type MemoryGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
