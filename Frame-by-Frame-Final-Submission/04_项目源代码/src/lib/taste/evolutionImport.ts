import type {
  AgentObservationBundle,
  AppState,
  DimensionKey,
  ObservationPolarity,
  ObservationStage,
  TasteEvolutionEvidence,
  TasteEvolutionSnapshot,
  TasteObservation,
} from '@/types'
import { DIMENSIONS } from '@/data/taxonomy'

const STAGES: ObservationStage[] = ['emerging', 'developing', 'established', 'evolving']
const DIRECTIONS: ObservationPolarity[] = ['supporting', 'contradicting', 'neutral']

const norm = (text: string): string =>
  text
    .replace(/[\s\u00a0]+/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()

export const sha256Hex = async (text: string): Promise<string> => {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const inRange = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 1

export type EvolutionImportResult = {
  ok: boolean
  failures: string[]
  warnings: string[]
  bundles: AgentObservationBundle[]
  snapshot: TasteEvolutionSnapshot | null
  runId: string | null
  alreadyImported: boolean
}

const empty = (failures: string[], warnings: string[] = []): EvolutionImportResult => ({
  ok: false,
  failures,
  warnings,
  bundles: [],
  snapshot: null,
  runId: null,
  alreadyImported: false,
})

/**
 * Validates an agent evolution document against the live state, then turns it
 * into observations/snapshot for the reducer. Nothing is written here, so a
 * failed run can never overwrite the last good snapshot.
 */
export const importEvolutionDoc = async (
  doc: unknown,
  state: AppState,
  now: string = new Date().toISOString(),
): Promise<EvolutionImportResult> => {
  const failures: string[] = []
  const warnings: string[] = []
  if (!isObject(doc)) return empty(['文档不是 JSON 对象'])
  if (doc.schema_version !== 'taste-evolution.v1') {
    return empty([`schema_version 必须是 taste-evolution.v1，收到 ${String(doc.schema_version)}`])
  }

  const runId = isText(doc.run_id) ? doc.run_id : ''
  const recordId = isText(doc.record_id) ? doc.record_id : ''
  const filmId = isText(doc.film_id) ? doc.film_id : ''
  const analyzedAt = isText(doc.analyzed_at) ? doc.analyzed_at : ''
  if (!runId) failures.push('run_id 缺失')
  if (!recordId) failures.push('record_id 缺失')
  if (!filmId) failures.push('film_id 缺失')
  if (!analyzedAt) failures.push('analyzed_at 缺失')

  const record = state.records.find((item) => item.id === recordId)
  if (!record) failures.push(`record_id ${recordId || '(空)'} 不在本地记录中`)
  if (record && record.filmId !== filmId) {
    failures.push(`film_id 不一致：记录是 ${record.filmId}，文档是 ${filmId || '(空)'}`)
  }

  const inputs = isObject(doc.inputs) ? doc.inputs : {}
  const claimedHash = typeof inputs.note_sha256 === 'string' ? inputs.note_sha256 : ''
  if (!claimedHash) {
    failures.push('inputs.note_sha256 缺失')
  } else if (record) {
    const actual = await sha256Hex(record.reflection)
    if (actual !== claimedHash) failures.push('note_sha256 与本地原文不一致（原文可能已被修改）')
  }

  const observationsRaw = Array.isArray(doc.observations) ? doc.observations : []
  const evidenceRaw = Array.isArray(doc.evidence) ? doc.evidence : []
  if (observationsRaw.length === 0) failures.push('observations 不能为空')
  if (evidenceRaw.length === 0) failures.push('evidence 不能为空')

  const evidenceById = new Map<string, TasteEvolutionEvidence>()
  for (const [index, item] of evidenceRaw.entries()) {
    const label = `evidence[${index}]`
    if (!isObject(item)) {
      failures.push(`${label} 不是对象`)
      continue
    }
    const id = isText(item.evidence_id) ? item.evidence_id : ''
    const quote = typeof item.original_quote === 'string' ? item.original_quote : ''
    const dimension = item.dimension as DimensionKey
    const polarity = item.polarity as ObservationPolarity
    if (!id) failures.push(`${label}.evidence_id 缺失`)
    if (!DIMENSIONS.some((dim) => dim.key === dimension)) {
      failures.push(`${label}.dimension 非法：${String(item.dimension)}`)
    }
    if (!DIRECTIONS.includes(polarity)) failures.push(`${label}.polarity 非法`)
    if (!inRange(item.strength)) failures.push(`${label}.strength 必须在 0..1`)
    if (!isText(item.created_at)) failures.push(`${label}.created_at 缺失`)
    if (quote.trim().length < 6) failures.push(`${label}.original_quote 少于 6 字`)
    const evidenceRecord = state.records.find((candidate) => candidate.id === item.record_id)
    if (!evidenceRecord) {
      failures.push(`${label}.record_id 不在本地记录中：${String(item.record_id)}`)
    } else {
      if (isText(item.film_id) && evidenceRecord.filmId !== item.film_id) {
        failures.push(`${label}.film_id 与记录 ${evidenceRecord.id} 不一致`)
      }
      if (quote && !norm(evidenceRecord.reflection).includes(norm(quote))) {
        failures.push(`${label}.original_quote 不在记录 ${evidenceRecord.id} 的原文中`)
      }
    }
    if (evidenceById.has(id)) failures.push(`${label}.evidence_id 重复：${id}`)
    evidenceById.set(id, {
      ...(item as unknown as TasteEvolutionEvidence),
      observation_id: isText(item.observation_id) ? item.observation_id : '',
      source: isText(item.source) ? item.source : 'deepworks',
      run_id: isText(item.run_id) ? item.run_id : runId,
    })
  }

  const bundles: AgentObservationBundle[] = []
  const observationIds = new Set<string>()
  for (const [index, item] of observationsRaw.entries()) {
    const label = `observations[${index}]`
    if (!isObject(item)) {
      failures.push(`${label} 不是对象`)
      continue
    }
    const id = isText(item.observation_id) ? item.observation_id : ''
    if (!id) {
      failures.push(`${label}.observation_id 缺失`)
      continue
    }
    if (observationIds.has(id)) failures.push(`${label}.observation_id 重复：${id}`)
    observationIds.add(id)
    if (!DIMENSIONS.some((dim) => dim.key === item.dimension)) {
      failures.push(`${label}.dimension 非法：${String(item.dimension)}`)
    }
    if (!STAGES.includes(item.current_stage as ObservationStage)) {
      failures.push(`${label}.current_stage 非法：${String(item.current_stage)}`)
    }
    if (!inRange(item.confidence)) failures.push(`${label}.confidence 必须在 0..1`)
    const supporting = Array.isArray(item.supporting_evidence_ids)
      ? (item.supporting_evidence_ids as string[])
      : []
    const contradicting = Array.isArray(item.contradicting_evidence_ids)
      ? (item.contradicting_evidence_ids as string[])
      : []
    for (const evidenceId of supporting) {
      const evidence = evidenceById.get(evidenceId)
      if (!evidence) failures.push(`${label} 引用了不存在的支持证据 ${evidenceId}`)
      else if (evidence.polarity !== 'supporting') {
        failures.push(`${label} 的 ${evidenceId} 不是 supporting`)
      }
    }
    for (const evidenceId of contradicting) {
      const evidence = evidenceById.get(evidenceId)
      if (!evidence) failures.push(`${label} 引用了不存在的反向证据 ${evidenceId}`)
      else if (evidence.polarity !== 'contradicting') {
        failures.push(`${label} 的 ${evidenceId} 不是 contradicting`)
      }
    }
    if (!Array.isArray(item.history)) failures.push(`${label}.history 必须是数组`)

    const own = Array.from(evidenceById.values()).filter(
      (evidence) => evidence.observation_id === id,
    )
    bundles.push({
      observation: {
        ...(item as unknown as TasteObservation),
        observation_id: id,
        evidence: own,
        effective: item.effective !== false,
        record_count: Array.isArray(item.supporting_record_ids)
          ? item.supporting_record_ids.length
          : 0,
        evidence_count: supporting.length + contradicting.length,
        unverified_evidence_count: 0,
      },
      evidence: own,
      run_id: runId,
      record_id: recordId,
      film_id: filmId,
      note_sha256: claimedHash,
      analyzed_at: analyzedAt,
      imported_at: now,
    })
  }
  for (const evidence of evidenceById.values()) {
    if (!observationIds.has(evidence.observation_id)) {
      failures.push(`证据 ${evidence.evidence_id} 指向不存在的观察 ${evidence.observation_id}`)
    }
  }

  const snapshotRaw = isObject(doc.snapshot) ? doc.snapshot : null
  if (!snapshotRaw) {
    failures.push('snapshot 缺失')
  } else {
    if (!isText(snapshotRaw.snapshot_id)) failures.push('snapshot.snapshot_id 缺失')
    if (!isText(snapshotRaw.created_at)) failures.push('snapshot.created_at 缺失')
    if (!Array.isArray(snapshotRaw.observations)) failures.push('snapshot.observations 必须是数组')
    if (isText(snapshotRaw.run_id) && snapshotRaw.run_id !== runId) {
      failures.push('snapshot.run_id 与文档 run_id 不一致')
    }
  }

  if (failures.length > 0) return empty(failures, warnings)

  const existing = state.agentObservations.find((bundle) => bundle.run_id === runId)
  if (existing) {
    return {
      ok: true,
      failures: [],
      warnings: [`run ${runId} 已经导入过，本次不做任何写入`],
      bundles: [],
      snapshot: null,
      runId,
      alreadyImported: true,
    }
  }

  const newest = [...state.agentObservations].sort((a, b) =>
    b.analyzed_at.localeCompare(a.analyzed_at),
  )[0]
  if (newest && analyzedAt < newest.analyzed_at) {
    return empty([
      `这次运行（${analyzedAt}）早于已导入的最新运行（${newest.analyzed_at}），拒绝用旧结果覆盖新状态`,
    ])
  }

  const prior = typeof inputs.prior_snapshot_id === 'string' ? inputs.prior_snapshot_id : ''
  if (prior && !state.tasteSnapshots.some((item) => item.snapshot_id === prior)) {
    warnings.push(`prior_snapshot_id ${prior} 在本地快照中找不到；仍按追加方式导入`)
  }

  const snapshot = {
    ...(doc.snapshot as unknown as TasteEvolutionSnapshot),
    run_id: runId,
  }
  if (!snapshot.signature) snapshot.signature = snapshot.snapshot_id
  if (!Array.isArray(snapshot.changes)) snapshot.changes = []
  if (!Array.isArray(snapshot.corrections_applied)) snapshot.corrections_applied = []
  if (!Array.isArray(snapshot.dimensions)) snapshot.dimensions = []

  return {
    ok: true,
    failures: [],
    warnings,
    bundles: bundles.filter((bundle) => bundle.observation.observation_id),
    snapshot,
    runId,
    alreadyImported: false,
  }
}
