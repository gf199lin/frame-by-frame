/**
 * Taste Evolution engine.
 *
 * Everything below is derived from data the user already has:
 *   accepted film analyses -> verbatim note quotes -> observations -> snapshots.
 *
 * It never authors a claim the user did not ground in a note, and an observation
 * is never treated as a permanent label: stage, confidence and direction are
 * recomputed from the current evidence set on every read.
 */
import { DIMENSION_MAP } from '@/data/taxonomy'
import { clamp } from '@/lib/format'
import { filmById } from '@/lib/tasteEngine'
import type {
  AIFilmAnalysis,
  AppState,
  DimensionKey,
  Film,
  ObservationChangeKind,
  ObservationDecision,
  ObservationStage,
  TasteDirection,
  TasteEvolutionChange,
  TasteEvolutionEvidence,
  TasteEvolutionSnapshot,
  TasteEvolutionSnapshotObservation,
  TasteObservation,
  TasteObservationFeedback,
  WatchRecord,
} from '@/types'

/* ------------------------------------------------------------------ */
/*  Small deterministic helpers                                        */
/* ------------------------------------------------------------------ */

const fnv = (text: string): string => {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36).padStart(7, '0')
}

const norm = (text: string): string =>
  text
    .replace(/[\s\u00a0]+/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

const depthOf = (note: string): number => clamp(note.trim().length / 420, 0, 1)

const convictionOf = (rating: number): number =>
  0.55 + clamp(Math.abs(rating - 3) / 2, 0, 1) * 0.45

const signedOf = (direction: TasteDirection): number =>
  direction === 'high' ? 1 : direction === 'low' ? -1 : 0

const DECISION_WEIGHT: Record<ObservationDecision, number> = {
  accepted: 1.1,
  partially_accepted: 0.9,
  rejected: 0.05,
  unsure: 1,
}

export const STAGE_COPY: Record<
  ObservationStage,
  { zh: string; en: string; note: string; order: number }
> = {
  emerging: {
    zh: '初步显现',
    en: 'Emerging',
    note: '只有少量记录支持，仍可能被下一次观影推翻。',
    order: 1,
  },
  developing: {
    zh: '逐渐形成',
    en: 'Developing',
    note: '多部独立电影出现了相似原句，但还允许修正。',
    order: 2,
  },
  established: {
    zh: '相对稳定',
    en: 'Established',
    note: '独立记录、证据质量和一致性都足够，并已考虑反向证据。',
    order: 3,
  },
  evolving: {
    zh: '持续变化',
    en: 'Evolving',
    note: '新证据或你的反馈与过去的判断不一致，正在重新评估。',
    order: 4,
  },
}

export const DECISION_COPY: Record<ObservationDecision, string> = {
  accepted: '我认可这个判断',
  partially_accepted: '部分认可',
  rejected: '我不认可',
  unsure: '暂时无法判断',
}

/* ------------------------------------------------------------------ */
/*  Evidence construction                                              */
/* ------------------------------------------------------------------ */

type RawEvidence = TasteEvolutionEvidence & { signed: number; confidence: number }

export type EvolutionResult = {
  observations: TasteObservation[]
  evidence: TasteEvolutionEvidence[]
  overallConfidence: number
  dimensions: TasteEvolutionSnapshot['dimensions']
  signature: string
  latestRunId: string | null
  /** Quotes produced by the model that are not verbatim in the note. */
  unverifiedEvidenceCount: number
  /** Claims with no quote at all, or one the user explicitly removed. */
  untraceableEvidenceCount: number
}

export type EvolutionInput = Pick<
  AppState,
  'records' | 'analyses' | 'observationFeedback' | 'tasteSnapshots' | 'corrections'
> & { agentObservations?: AppState['agentObservations'] }

export const isAcceptedAnalysis = (analysis: AIFilmAnalysis): boolean =>
  analysis.status === 'complete' &&
  (analysis.review.verdict === 'accepted' || analysis.review.verdict === 'edited')

const usableRecord = (
  analysis: AIFilmAnalysis,
  records: WatchRecord[],
  films: Film[],
): { record: WatchRecord; film: Film } | null => {
  const record = records.find((item) => item.id === analysis.recordId)
  if (!record) return null
  if (record.filmId !== analysis.filmId) return null
  const film = filmById(films, record.filmId)
  if (!film) return null
  return { record, film }
}

const evidenceId = (recordId: string, dimension: DimensionKey, quote: string): string =>
  `ev_${recordId}_${dimension}_${fnv(norm(quote))}`

const collectEvidence = (
  input: EvolutionInput,
  films: Film[],
): {
  byDimension: Map<DimensionKey, RawEvidence[]>
  all: TasteEvolutionEvidence[]
  unverified: number
  unverifiedByDimension: Map<DimensionKey, number>
  untraceable: number
  latestRunId: string | null
} => {
  const byDimension = new Map<DimensionKey, RawEvidence[]>()
  const all: TasteEvolutionEvidence[] = []
  const unverifiedByDimension = new Map<DimensionKey, number>()
  const seen = new Set<string>()
  let unverified = 0
  let untraceable = 0
  let latestRunId: string | null = null
  let latestAt = ''

  const analyses = [...input.analyses].sort((a, b) =>
    a.model.analyzedAt.localeCompare(b.model.analyzedAt),
  )

  for (const analysis of analyses) {
    if (!isAcceptedAnalysis(analysis)) continue
    const usable = usableRecord(analysis, input.records, films)
    if (!usable) continue
    const { record, film } = usable
    const note = norm(record.reflection)
    const depth = depthOf(record.reflection)
    const conviction = convictionOf(record.rating)
    const reviewWeight = analysis.review.verdict === 'edited' ? 0.9 : 1
    const createdAt = analysis.review.updatedAt || analysis.model.analyzedAt
    const runId = analysis.agent?.run_id
    if (runId && analysis.model.analyzedAt >= latestAt) {
      latestAt = analysis.model.analyzedAt
      latestRunId = runId
    }

    analysis.preference_evidence.forEach((claim, index) => {
      if (claim.userStatus === 'removed') {
        untraceable += 1
        return
      }
      const quote = (claim.quote ?? '').trim()
      if (!quote) {
        untraceable += 1
        return
      }
      if (!DIMENSION_MAP[claim.dimension_id]) {
        untraceable += 1
        return
      }
      if (!note.includes(norm(quote))) {
        // The model paraphrased. It must not be shown as the user's words.
        unverified += 1
        unverifiedByDimension.set(
          claim.dimension_id,
          (unverifiedByDimension.get(claim.dimension_id) ?? 0) + 1,
        )
        return
      }
      const direction: TasteDirection =
        claim.direction === 'high' ? 'high' : claim.direction === 'low' ? 'low' : 'neutral'
      const strength = clamp(
        clamp(claim.strength, 0, 1) *
          clamp(claim.confidence, 0, 1) *
          (0.55 + 0.45 * depth) *
          conviction *
          reviewWeight,
        0,
        1,
      )
      const id = evidenceId(record.id, claim.dimension_id, quote)
      if (seen.has(id)) return
      seen.add(id)
      const source = analysis.agent?.provider ?? analysis.model.provider ?? 'unknown'
      const evidence: RawEvidence = {
        evidence_id: id,
        observation_id: `obs_${claim.dimension_id}`,
        record_id: record.id,
        film_id: film.id,
        film_title: film.title,
        film_year: film.year,
        dimension: claim.dimension_id,
        original_quote: quote,
        interpretation: claim.evidence,
        polarity: 'neutral',
        strength,
        source,
        created_at: createdAt,
        ...(runId ? { run_id: runId } : {}),
        signed: signedOf(direction) * strength,
        confidence: clamp(claim.confidence, 0, 1),
      }
      const list = byDimension.get(claim.dimension_id) ?? []
      list.push(evidence)
      byDimension.set(claim.dimension_id, list)
      all.push(evidence)
      void index
    })
  }

  return {
    byDimension,
    all,
    unverified,
    unverifiedByDimension,
    untraceable,
    latestRunId,
  }
}

/* ------------------------------------------------------------------ */
/*  Observation construction                                           */
/* ------------------------------------------------------------------ */

const dominantOf = (evidence: RawEvidence[]): TasteDirection => {
  const total = evidence.reduce((sum, item) => sum + item.signed, 0)
  if (Math.abs(total) < 0.05) return 'neutral'
  return total > 0 ? 'high' : 'low'
}

const latestFeedbackOf = (feedback: TasteObservationFeedback[]): TasteObservationFeedback | undefined =>
  [...feedback].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1)

const previousSnapshot = (input: EvolutionInput): TasteEvolutionSnapshot | null =>
  [...input.tasteSnapshots].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null

const stageFor = (args: {
  recordCount: number
  evidenceCount: number
  confidence: number
  consistency: number
  supporting: number
  contradicting: number
  conflict: number
  latestFeedback?: TasteObservationFeedback
  dominant: TasteDirection
  previous?: TasteEvolutionSnapshotObservation
}): ObservationStage => {
  const {
    recordCount,
    evidenceCount,
    confidence,
    consistency,
    supporting,
    contradicting,
    conflict,
    latestFeedback,
    dominant,
    previous,
  } = args

  const feedbackWantsRevision =
    latestFeedback?.decision === 'rejected' || latestFeedback?.decision === 'partially_accepted'
  const directionChanged =
    previous !== undefined &&
    previous.dominant_direction !== 'neutral' &&
    dominant !== 'neutral' &&
    previous.dominant_direction !== dominant

  // A single note can never promote an observation past emerging by itself.
  if (
    feedbackWantsRevision ||
    directionChanged ||
    (contradicting > 0 && conflict >= 0.3)
  ) {
    return 'evolving'
  }

  let stage: ObservationStage = 'emerging'
  if (
    recordCount >= 5 &&
    evidenceCount >= 5 &&
    confidence >= 0.62 &&
    consistency >= 0.7 &&
    conflict <= 0.3 &&
    (latestFeedback?.decision === 'accepted' || confidence >= 0.7)
  ) {
    stage = 'established'
  } else if (
    recordCount >= 3 &&
    evidenceCount >= 3 &&
    confidence >= 0.4 &&
    consistency >= 0.55 &&
    supporting > 0
  ) {
    stage = 'developing'
  }

  // Respect the ladder: emerging -> developing -> established.
  if (previous) {
    const previousStage = previous.stage
    if (previousStage === 'evolving') {
      // Re-entry after a revision starts from developing, never straight back.
      if (stage === 'established') stage = 'developing'
    } else {
      const allowed = Math.min(STAGE_COPY[previousStage].order + 1, STAGE_COPY.established.order)
      if (STAGE_COPY[stage].order > allowed) {
        stage = (Object.keys(STAGE_COPY) as ObservationStage[]).find(
          (key) => STAGE_COPY[key].order === allowed,
        ) ?? 'developing'
      }
    }
  }
  return stage
}

const describeObservation = (args: {
  dimension: DimensionKey
  dominant: TasteDirection
  recordCount: number
  supporting: RawEvidence[]
  contradicting: RawEvidence[]
  stage: ObservationStage
  unverified: number
  latestFeedback?: TasteObservationFeedback
}): string => {
  const { dimension, dominant, recordCount, supporting, contradicting, stage, unverified, latestFeedback } =
    args
  const def = DIMENSION_MAP[dimension]
  const pole = dominant === 'high' ? def.highZh : dominant === 'low' ? def.lowZh : '尚未定向'
  const strongest = [...supporting, ...contradicting].sort((a, b) => b.strength - a.strength)[0]
  const parts: string[] = []

  parts.push(
    `从你确认过的 ${recordCount} 部电影里，有 ${supporting.length} 条原句指向「${pole}」` +
      (contradicting.length > 0 ? `，另有 ${contradicting.length} 条指向相反方向。` : '。'),
  )
  if (strongest) {
    parts.push(`最直接的一条来自《${strongest.film_title}》：“${strongest.original_quote}”。`)
  }
  if (unverified > 0) {
    parts.push(`另有 ${unverified} 条模型引文未能在你的笔记中逐字找到，已排除，不计入这条观察。`)
  }
  if (latestFeedback) {
    parts.push(
      latestFeedback.decision === 'rejected'
        ? '你否定了这条观察，它不再作为有效支持证据，只保留下来解释为什么被撤回。'
        : latestFeedback.decision === 'partially_accepted'
          ? `你部分认可了它${latestFeedback.user_comment ? `，并写下：“${latestFeedback.user_comment}”` : ''}。相关判断已被下调。`
          : latestFeedback.decision === 'unsure'
            ? '你暂时无法判断，因此它没有获得额外认可权重。'
            : '你认可了这条观察，它获得了一点额外权重，但仍会随新证据变化。',
    )
  }
  parts.push(
    stage === 'emerging'
      ? '目前只是初步显现，不足以称为稳定的审美偏好。'
      : stage === 'developing'
        ? '它正在形成，下一次观影仍可能修正它。'
        : stage === 'established'
          ? '它目前相对稳定，但不是永久标签。'
          : '它与过去的判断或你的反馈出现分歧，正在重新评估。',
  )
  return parts.join('')
}

const buildObservations = (
  input: EvolutionInput,
  collected: ReturnType<typeof collectEvidence>,
): TasteObservation[] => {
  const previous = previousSnapshot(input)
  const observations: TasteObservation[] = []

  for (const [dimension, raw] of collected.byDimension) {
    if (raw.length === 0) continue
    const dominant = dominantOf(raw)
    const evidence: TasteEvolutionEvidence[] = raw.map((item) => ({
      evidence_id: item.evidence_id,
      observation_id: item.observation_id,
      record_id: item.record_id,
      film_id: item.film_id,
      film_title: item.film_title,
      film_year: item.film_year,
      dimension: item.dimension,
      original_quote: item.original_quote,
      interpretation: item.interpretation,
      polarity: 'neutral',
      strength: item.strength,
      source: item.source,
      created_at: item.created_at,
      ...(item.run_id ? { run_id: item.run_id } : {}),
    }))

    for (const item of evidence) {
      const rawItem = raw.find((candidate) => candidate.evidence_id === item.evidence_id)
      const direction = rawItem ? (rawItem.signed > 0 ? 'high' : rawItem.signed < 0 ? 'low' : 'neutral') : 'neutral'
      item.polarity =
        direction === 'neutral' || dominant === 'neutral'
          ? 'neutral'
          : direction === dominant
            ? 'supporting'
            : 'contradicting'
    }

    const supporting = raw.filter((item) => {
      const direction = item.signed > 0 ? 'high' : item.signed < 0 ? 'low' : 'neutral'
      return direction !== 'neutral' && dominant !== 'neutral' && direction === dominant
    })
    const contradicting = raw.filter((item) => {
      const direction = item.signed > 0 ? 'high' : item.signed < 0 ? 'low' : 'neutral'
      return direction !== 'neutral' && dominant !== 'neutral' && direction !== dominant
    })
    const neutral = raw.filter((item) => item.signed === 0)
    const supportWeight = supporting.reduce((sum, item) => sum + item.strength, 0)
    const contraWeight = contradicting.reduce((sum, item) => sum + item.strength, 0)
    const totalWeight = supportWeight + contraWeight + neutral.reduce((sum, item) => sum + item.strength, 0)
    const conflict = totalWeight > 0 ? contraWeight / totalWeight : 0
    const consistency = totalWeight > 0 ? clamp(1 - conflict, 0, 1) : 0
    const recordCount = new Set(raw.map((item) => item.record_id)).size
    const evidenceCount = raw.length
    const feedback = input.observationFeedback.filter(
      (item) => item.observation_id === `obs_${dimension}`,
    )
    const latestFeedback = latestFeedbackOf(feedback)
    const previousObs = previous?.observations.find(
      (item) => item.observation_id === `obs_${dimension}`,
    )

    const meanStrength = mean(raw.map((item) => item.strength))
    const sampleFactor = 1 - Math.exp(-recordCount / 2.6)
    const confidenceFactor = 0.45 + 0.55 * meanStrength
    const feedbackFactor = latestFeedback ? DECISION_WEIGHT[latestFeedback.decision] : 1
    const rejected = latestFeedback?.decision === 'rejected'
    const confidence = rejected
      ? 0.05
      : clamp(confidenceFactor * sampleFactor * (0.55 + 0.45 * consistency) * feedbackFactor, 0.02, 0.93)

    const stage = stageFor({
      recordCount,
      evidenceCount,
      confidence,
      consistency,
      supporting: supporting.length,
      contradicting: contradicting.length,
      conflict,
      latestFeedback,
      dominant,
      previous: previousObs,
    })

    const def = DIMENSION_MAP[dimension]
    const pole = dominant === 'high' ? def.highZh : dominant === 'low' ? def.lowZh : '方向未定'
    const title = `${def.labelZh} · ${pole}`
    const firstObservedAt = raw
      .map((item) => item.created_at)
      .sort((a, b) => a.localeCompare(b))[0]
    const lastUpdatedAt = raw
      .map((item) => item.created_at)
      .sort((a, b) => b.localeCompare(a))[0]

    const history = buildHistory(input, `obs_${dimension}`, {
      at: lastUpdatedAt,
      current: {
        stage,
        confidence,
        supporting: supporting.length,
        contradicting: contradicting.length,
      },
    })

    observations.push({
      observation_id: `obs_${dimension}`,
      dimension,
      title,
      description: describeObservation({
        dimension,
        dominant,
        recordCount,
        supporting,
        contradicting,
        stage,
        unverified: collected.unverifiedByDimension.get(dimension) ?? 0,
        latestFeedback,
      }),
      current_stage: stage,
      confidence,
      first_observed_at: firstObservedAt,
      last_updated_at: lastUpdatedAt,
      supporting_record_ids: Array.from(new Set(supporting.map((item) => item.record_id))),
      supporting_evidence_ids: supporting.map((item) => item.evidence_id),
      contradicting_evidence_ids: contradicting.map((item) => item.evidence_id),
      accepted_feedback_count: feedback.filter((item) => item.decision === 'accepted').length,
      partially_accepted_feedback_count: feedback.filter(
        (item) => item.decision === 'partially_accepted',
      ).length,
      rejected_feedback_count: feedback.filter((item) => item.decision === 'rejected').length,
      unsure_feedback_count: feedback.filter((item) => item.decision === 'unsure').length,
      ...(latestFeedback ? { latest_feedback: latestFeedback } : {}),
      history,
      evidence,
      dominant_direction: dominant,
      effective: !rejected,
      record_count: recordCount,
      evidence_count: evidenceCount,
      unverified_evidence_count: collected.unverifiedByDimension.get(dimension) ?? 0,
    })
  }

  return observations.sort(
    (a, b) => b.confidence * b.record_count - a.confidence * a.record_count,
  )
}

const buildHistory = (
  input: EvolutionInput,
  observationId: string,
  current: {
    at: string
    current: { stage: ObservationStage; confidence: number; supporting: number; contradicting: number }
  },
): TasteObservation['history'] => {
  const entries = input.tasteSnapshots
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .flatMap((snapshot) => {
      const observed = snapshot.observations.find((item) => item.observation_id === observationId)
      if (!observed) return []
      const change = snapshot.changes.find((item) => item.observation_id === observationId)
      return [
        {
          at: snapshot.created_at,
          snapshot_id: snapshot.snapshot_id,
          stage: observed.stage,
          confidence: observed.confidence,
          supporting_count: observed.supporting_count,
          contradicting_count: observed.contradicting_count,
          reason: change?.reason ?? '快照记录了这个时间点的判断。',
        },
      ]
    })

  const now = current.current
  const last = entries.at(-1)
  if (
    !last ||
    last.stage !== now.stage ||
    Math.abs(last.confidence - now.confidence) >= 0.005 ||
    last.supporting_count !== now.supporting ||
    last.contradicting_count !== now.contradicting
  ) {
    entries.push({
      at: current.at,
      snapshot_id: 'current',
      stage: now.stage,
      confidence: now.confidence,
      supporting_count: now.supporting,
      contradicting_count: now.contradicting,
      reason: last ? '最新的已确认证据改变了这条观察。' : '这条观察第一次出现。',
    })
  }
  return entries
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export const computeEvolution = (input: EvolutionInput, films: Film[]): EvolutionResult => {
  const collected = collectEvidence(input, films)
  const derived = buildObservations(input, collected)
  // Imported agent observations are authoritative for their ids: the site must
  // show what the run actually said, not a local re-computation of it.
  const agentBundles = input.agentObservations ?? []
  const merged = new Map(derived.map((item) => [item.observation_id, item]))
  for (const bundle of agentBundles) {
    merged.set(bundle.observation.observation_id, bundle.observation)
  }
  const observations = Array.from(merged.values()).sort(
    (a, b) => b.confidence - a.confidence || a.observation_id.localeCompare(b.observation_id),
  )
  const evidenceById = new Map<string, TasteEvolutionEvidence>()
  for (const item of collected.all) evidenceById.set(item.evidence_id, item)
  for (const bundle of agentBundles) {
    for (const item of bundle.evidence) evidenceById.set(item.evidence_id, item)
  }
  const allEvidence = Array.from(evidenceById.values())

  const dimensions = Array.from(
    new Set<DimensionKey>(observations.map((item) => item.dimension)),
  ).map((key) => {
    const related = observations.filter((item) => item.dimension === key)
    const lean = mean(related.map((item) => signedOf(item.dominant_direction) * item.confidence))
    return {
      key,
      lean: clamp(lean, -1, 1),
      confidence: mean(related.filter((item) => item.effective).map((item) => item.confidence)),
      sampleCount: Math.max(0, ...related.map((item) => item.record_count)),
    }
  })

  const effective = observations.filter((item) => item.effective)
  const overallConfidence = mean(effective.map((item) => item.confidence))

  const signatureParts = [
    ...input.records
      .map((record) => `${record.id}:${fnv(norm(record.reflection))}:${record.rating}`)
      .sort(),
    ...input.analyses
      .map(
        (analysis) =>
          `${analysis.recordId}:${analysis.review.verdict}:${analysis.model.analyzedAt}:${analysis.preference_evidence
            .map((claim) => claim.userStatus ?? 'kept')
            .join(',')}`,
      )
      .sort(),
    ...input.observationFeedback
      .map((feedback) => `${feedback.feedback_id}:${feedback.decision}`)
      .sort(),
    ...agentBundles
      .map(
        (bundle) =>
          `${bundle.run_id}:${bundle.observation.observation_id}:${bundle.observation.confidence}:${bundle.observation.current_stage}:${bundle.evidence.map((item) => item.evidence_id).join(',')}`,
      )
      .sort(),
  ]
  const signature = fnv(signatureParts.join('|'))
  const latestAgentRun =
    [...agentBundles].sort((a, b) => b.analyzed_at.localeCompare(a.analyzed_at))[0]?.run_id ?? null

  return {
    observations,
    evidence: allEvidence,
    overallConfidence,
    dimensions,
    signature,
    latestRunId: latestAgentRun ?? collected.latestRunId,
    unverifiedEvidenceCount: collected.unverified,
    untraceableEvidenceCount: collected.untraceable,
  }
}

const snapshotId = (signature: string): string => `snap_${signature}`

const changeReason = (
  kind: ObservationChangeKind,
  before: TasteEvolutionSnapshotObservation | undefined,
  after: TasteObservation,
): string => {
  if (kind === 'created') return '新的已确认证据第一次形成了这条观察。'
  if (kind === 'withdrawn') return '支撑它的记录或分析已被删除或撤回，这条观察暂时退出画像。'
  if (!before) return '这条观察在本快照中被更新。'
  const supportDelta = after.supporting_evidence_ids.length - before.supporting_count
  const confidenceDelta = after.confidence - before.confidence
  const stageChanged = before.stage !== after.current_stage
  const parts: string[] = []
  if (supportDelta > 0) parts.push(`新增 ${supportDelta} 条支持证据`)
  if (supportDelta < 0) parts.push(`减少 ${Math.abs(supportDelta)} 条支持证据`)
  if (after.contradicting_evidence_ids.length > before.contradicting_count) {
    parts.push(`出现 ${after.contradicting_evidence_ids.length - before.contradicting_count} 条反向证据`)
  }
  if (Math.abs(confidenceDelta) >= 0.005) {
    parts.push(`置信度从 ${Math.round(before.confidence * 100)}% 变为 ${Math.round(after.confidence * 100)}%`)
  }
  if (stageChanged) {
    parts.push(`阶段从「${STAGE_COPY[before.stage].zh}」进入「${STAGE_COPY[after.current_stage].zh}」`)
  }
  if (after.latest_feedback && after.latest_feedback.decision === 'rejected') {
    parts.push('你否定了它，它不再计入画像')
  } else if (after.latest_feedback && after.latest_feedback.decision === 'partially_accepted') {
    parts.push('你部分认可了它，判断已下调')
  }
  return parts.length > 0 ? `${parts.join('，')}。` : '本次没有新的支持或反向证据。'
}

const toSnapshotObservation = (observation: TasteObservation): TasteEvolutionSnapshotObservation => ({
  observation_id: observation.observation_id,
  dimension: observation.dimension,
  title: observation.title,
  description: observation.description,
  stage: observation.current_stage,
  confidence: observation.confidence,
  dominant_direction: observation.dominant_direction,
  supporting_count: observation.supporting_evidence_ids.length,
  contradicting_count: observation.contradicting_evidence_ids.length,
  film_ids: Array.from(new Set(observation.evidence.map((item) => item.film_id))),
  evidence_ids: observation.evidence.map((item) => item.evidence_id),
  effective: observation.effective,
})

export const buildSnapshot = (
  input: EvolutionInput,
  films: Film[],
  at: string,
): { snapshot: TasteEvolutionSnapshot; result: EvolutionResult } => {
  const result = computeEvolution(input, films)
  const previous = previousSnapshot(input)
  const beforeById = new Map(previous?.observations.map((item) => [item.observation_id, item]) ?? [])
  const afterById = new Map(result.observations.map((item) => [item.observation_id, item]))
  const changes: TasteEvolutionChange[] = []

  for (const observation of result.observations) {
    const before = beforeById.get(observation.observation_id)
    let kind: ObservationChangeKind = 'created'
    if (before) {
      kind =
        before.stage === observation.current_stage &&
        Math.abs(before.confidence - observation.confidence) < 0.005 &&
        before.supporting_count === observation.supporting_evidence_ids.length &&
        before.contradicting_count === observation.contradicting_evidence_ids.length
          ? 'unchanged'
          : 'updated'
    }
    changes.push({
      observation_id: observation.observation_id,
      kind,
      reason: changeReason(kind, before, observation),
      ...(before ? { before_confidence: before.confidence } : {}),
      after_confidence: observation.confidence,
      ...(before ? { before_stage: before.stage } : {}),
      after_stage: observation.current_stage,
    })
  }
  for (const before of previous?.observations ?? []) {
    if (afterById.has(before.observation_id)) continue
    changes.push({
      observation_id: before.observation_id,
      kind: 'withdrawn',
      reason: '支撑它的记录或分析已被删除或撤回，这条观察暂时退出画像。',
      before_confidence: before.confidence,
      after_confidence: 0,
      before_stage: before.stage,
    })
  }

  const corrections = input.observationFeedback
    .filter((feedback) => Boolean(feedback.user_comment?.trim()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map((feedback) => `${DECISION_COPY[feedback.decision]}：${feedback.user_comment}`)

  const snapshot: TasteEvolutionSnapshot = {
    snapshot_id: snapshotId(result.signature),
    created_at: at,
    run_id: result.latestRunId,
    record_count: new Set(result.evidence.map((item) => item.record_id)).size,
    observations: result.observations.map(toSnapshotObservation),
    dimensions: result.dimensions,
    overall_confidence: result.overallConfidence,
    changes,
    corrections_applied: corrections,
    signature: result.signature,
  }
  return { snapshot, result }
}

/**
 * Append a snapshot unless the evidence fingerprint is identical to the latest
 * one. Old snapshots are never mutated or removed by an update.
 */
export const appendSnapshot = (
  state: AppState,
  films: Film[],
  at: string,
): AppState => {
  const { snapshot } = buildSnapshot(state, films, at)
  const latest = [...state.tasteSnapshots].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0]
  if (latest?.signature === snapshot.signature) return state
  return {
    ...state,
    tasteSnapshots: [snapshot, ...state.tasteSnapshots].slice(0, 80),
  }
}

/** Compare two snapshots for the Before / After view. */
export const compareSnapshots = (
  before: TasteEvolutionSnapshot,
  after: TasteEvolutionSnapshot,
  observationId?: string,
): TasteEvolutionChange[] =>
  (observationId
    ? after.changes.filter((change) => change.observation_id === observationId)
    : after.changes
  ).map((change) => {
    const old = before.observations.find((item) => item.observation_id === change.observation_id)
    const current = after.observations.find((item) => item.observation_id === change.observation_id)
    return {
      ...change,
      ...(old ? { before_confidence: old.confidence, before_stage: old.stage } : {}),
      ...(current ? { after_confidence: current.confidence, after_stage: current.stage } : {}),
    }
  })

/** The observations sorted for the My Taste page: effective first, then strength. */
export const rankedObservations = (observations: TasteObservation[]): TasteObservation[] =>
  [...observations].sort((a, b) => {
    if (a.effective !== b.effective) return a.effective ? -1 : 1
    const stageDelta = STAGE_COPY[b.current_stage].order - STAGE_COPY[a.current_stage].order
    if (stageDelta !== 0) return stageDelta
    return b.confidence - a.confidence
  })
