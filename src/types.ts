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
  /** Chinese-first UI copy for the same dimension. */
  questionZh?: string
  noteZh?: string
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

export type ArtworkProvider = 'tmdb' | 'local' | 'remote'

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
  matchSource: 'wikidata-tmdb-id' | 'tmdb-api' | 'catalog' | 'catalogue-api'
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
  /** 简体中文剧情简介；缺失时回退到原始英文 logline。 */
  loglineZh?: string
  cast: string[]
  motif: PosterMotif
  palette: FilmPalette
  /** Verified TMDB movie id, used to fetch official artwork by id. */
  tmdbId?: number
  /** IMDb id when the record came from the external catalogue. */
  imdbId?: string
  /** How the film entered the archive. */
  externalSource?: 'imdb' | 'tmdb' | 'manual'
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
  /**
   * AI Core V1. Optional so that records written by the v1 storage schema keep
   * loading unchanged: a missing value means "legacy record, never analysed".
   */
  status?: 'complete' | 'failed' | 'skipped' | 'pending'
  model?: string
  promptVersion?: string
  analysedAt?: string
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
  /** Multiple chosen feelings; `feltLike` stays for older records and AI payloads. */
  feltLikeTags?: string[]
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

/* ------------------------------------------------------------------ */
/*  AI Core V1 — analyses, evidence and corrections                    */
/*  Original user data (records) is never overwritten by these types.   */
/* ------------------------------------------------------------------ */

export type TasteDirection = 'low' | 'high' | 'neutral'

export type AIAnalysisVerdict = 'unreviewed' | 'accepted' | 'edited' | 'rejected'

export type AIModelMeta = {
  provider: string
  model: string
  promptVersion: string
  analyzedAt: string
  latencyMs?: number
  inputChars?: number
}

/** One traceable claim that a film says something about one taste axis. */
export type TasteContribution = {
  dimension_id: DimensionKey
  direction: TasteDirection
  /** 0..1 — how strongly this single film leans toward `direction`. */
  strength: number
  /** 0..1 — model self-assessment for this specific claim. */
  confidence: number
  /** Why the model believes this, grounded in the user's own words. */
  evidence: string
  /** A short verbatim fragment of the user's note, when available. */
  quote?: string
  /** User can remove an individual claim without rejecting the whole analysis. */
  userStatus?: 'kept' | 'removed'
}

export type AIObservedEmotion = { mood: MoodId; evidence: string }
export type AIThemeFinding = { theme: ThemeId; evidence: string }

export type AIRelatedFilm = {
  filmId: string
  relationship: string
  explanation: string
}

export type AIFilmAnalysis = {
  schemaVersion: 1
  recordId: string
  filmId: string
  status: 'complete'
  summary: string
  observed_emotions: AIObservedEmotion[]
  themes_identified: AIThemeFinding[]
  narrative_observations: string[]
  character_observations: string[]
  visual_observations: string[]
  liked: string[]
  disliked: string[]
  preference_evidence: TasteContribution[]
  uncertainties: string[]
  confidence: number
  related_films: AIRelatedFilm[]
  model: AIModelMeta
  review: {
    verdict: AIAnalysisVerdict
    /** The user's own wording when they correct the reading. */
    note?: string
    updatedAt: string
  }
}

export type TasteProfileEventChange = {
  dimension: DimensionKey
  before: number
  after: number
  beforeConfidence: number
  afterConfidence: number
}

/** Append-only log of why the taste profile moved. */
export type TasteProfileEvent = {
  id: string
  at: string
  recordId?: string
  filmTitle?: string
  kind: 'accept' | 'edit' | 'reject' | 'delete' | 'correction'
  filmCount: number
  acceptedCount: number
  changes: TasteProfileEventChange[]
  reason: string
}

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
  /** AI analyses keyed by record id (one per record, replaceable). */
  analyses: AIFilmAnalysis[]
  /** Why the six-dimension profile changed over time. */
  profileHistory: TasteProfileEvent[]
  settings: {
    /** Explicit consent before private notes are sent to the model. */
    allowAiNotes: boolean
  }
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
  feltLikeTags: string[]
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

/* ------------------------------------------------------------------ */
/*  AI-backed taste profile (derived, never persisted as raw numbers)   */
/* ------------------------------------------------------------------ */

export type TasteEvidence = {
  recordId: string
  filmId: string
  filmTitle: string
  year: number
  rating: number
  /** Short fragment of the user's note that grounds the claim. */
  quote: string
  /** The model's reason for this claim. */
  evidence: string
  dimension: DimensionKey
  direction: TasteDirection
  strength: number
  confidence: number
  analysedAt: string
}

/**
 * Extends the legacy read model so existing radar/card components keep
 * working while the data behind them comes from real AI evidence.
 */
export type DimensionProfile = DimensionScore & {
  /** -1 (low pole) .. +1 (high pole), the signed evidence average. */
  lean: number
  sampleCount: number
  /** False when there is not enough accepted evidence to make a claim. */
  sufficient: boolean
  lastUpdatedAt: string | null
  aiEvidence: TasteEvidence[]
  userVerdict?: DimensionFeedback['verdict']
}

export type TasteSampleState = 'empty' | 'insufficient' | 'forming' | 'stable'

export type TasteProfile = {
  filmCount: number
  analysedCount: number
  acceptedCount: number
  pendingCount: number
  dimensions: DimensionProfile[]
  overallConfidence: number
  sampleState: TasteSampleState
  updatedAt: string | null
  signature: string
  summary: string[]
  topThemes: TasteSnapshot['topThemes']
  topMoods: TasteSnapshot['topMoods']
  averageRating: number
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
