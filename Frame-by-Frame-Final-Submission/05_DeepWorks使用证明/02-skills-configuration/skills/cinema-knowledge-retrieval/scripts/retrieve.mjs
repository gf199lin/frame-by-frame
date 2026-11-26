#!/usr/bin/env node
/**
 * Deterministic knowledge retrieval for the Frame by Frame cinema aesthetics KB.
 * No network, no embeddings, no external service. Every result cites a real KB id.
 *
 * Noise control (v2):
 * - A CJK bigram hit is the hard signal. Single characters only add small
 *   title/tag bonuses and can never make an entry relevant on their own.
 * - Stopword bigrams (pronouns, quantifiers, "电影") are not counted.
 * - No reliable match -> no_relevant_entry: true.
 *
 * Providers:
 *   file     (default) local knowledge/entries.json + deterministic scoring.
 *   platform Use retrieval results exported from the DeepWorks knowledge base.
 *            This adapter does NOT call any endpoint. It reads a JSON file that
 *            the platform run produced, then verifies every excerpt verbatim
 *            against the local entries so platform drift cannot pass silently.
 *
 * Usage:
 *   node retrieve.mjs --query "克制 悲伤 结局" --top 4
 *   node retrieve.mjs --input outputs/p0/inputs/run-01.json --top 4 --out /tmp/retrieval.json
 *   node retrieve.mjs --input in.json --provider platform --platform-results platform-export.json --out r.json
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback = undefined) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}

const projectRoot = process.cwd()
const entriesPath = resolve(projectRoot, 'knowledge', 'entries.json')
const kbRaw = readFileSync(entriesPath)
const kb = JSON.parse(kbRaw.toString('utf8'))
const entries = kb.entries ?? []
const kbVersion = createHash('sha256').update(kbRaw).digest('hex')

const inputPath = option('--input')
const top = Number(option('--top', '4'))
const outPath = option('--out')
const provider = String(option('--provider', 'file')).toLowerCase()
const platformResultsPath = option('--platform-results')
const allowFallback = !args.includes('--no-fallback')

let query = option('--query', '')
let input = null
if (inputPath) {
  input = JSON.parse(readFileSync(resolve(projectRoot, inputPath), 'utf8'))
  const film = input.film ?? {}
  const parts = [
    input.note ?? '',
    input.felt_like ?? input.feltLike ?? '',
    film.titleZh ?? '',
    film.title ?? '',
    ...(film.genres ?? []),
  ]
  query = parts.filter(Boolean).join(' ')
}
if (!query.trim()) {
  console.error('Missing --query or --input with a note')
  process.exit(2)
}

const STOP = new Set([
  '的', '了', '是', '在', '和', '与', '也', '就', '都', '而', '及', '或', '被', '把', '让',
  '我', '你', '他', '她', '它', '我们', '你们', '他们', '自己', '这个', '那个', '一个', '一种',
  '不', '没', '没有', '不是', '很', '太', '更', '最', '又', '还', '已经', '因为', '所以', '但是',
  '感觉', '电影', '片子', '这部', '那部', '看完', '看到', '什么', '怎么',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'this', 'that', 'with', 'for',
])

// Single characters that are too generic to carry retrieval signal.
const LOW_INFO_SINGLES = new Set([
  '看', '个', '面', '一', '有', '去', '好', '天', '电', '影', '时', '空', '动', '性', '得',
  '未', '结', '事', '发', '生', '什', '么', '但', '点', '说', '做', '想', '会', '能', '要',
  '对', '从', '到', '这', '那', '上', '下', '里', '中', '大', '小', '多', '少', '觉',
])

// Generic bigrams appear in almost any note. They may stay in the query and in
// the excerpt, but they get a very small text weight and never count as an
// effective bigram. This prevents "发生/出现/事情" from making unrelated KB
// entries look relevant, without filtering genuine aesthetic terms.
// This is a small hand-checked noise list, not a synonym table.
const GENERIC_BIGRAMS = new Set([
  '发生', '出现', '事情', '时候', '可能', '觉得', '这样', '那样',
  '一些', '有点', '一直', '其实', '然后', '现在', '开始', '知道',
  '似乎', '好像', '真的', '非常', '特别', '比较', '还有', '就是',
  '可以', '需要', '应该', '突然', '终于', '只是', '不过', '而且',
])

const tokenize = (text) => {
  const s = String(text ?? '').toLowerCase()
  const bigrams = new Set()
  const singles = new Set()
  const cjk = /[\u4e00-\u9fff]/
  let run = []
  const flush = () => {
    if (run.length === 0) return
    for (let i = 0; i < run.length; i += 1) {
      const ch = run[i]
      if (!STOP.has(ch)) singles.add(ch)
      if (i + 1 < run.length) {
        const bigram = ch + run[i + 1]
        if (!STOP.has(bigram)) bigrams.add(bigram)
      }
    }
    run = []
  }
  let ascii = ''
  const flushAscii = () => {
    if (ascii && !STOP.has(ascii)) bigrams.add(ascii)
    ascii = ''
  }
  for (const ch of s) {
    if (cjk.test(ch)) {
      flushAscii()
      run.push(ch)
    } else if (/[a-z0-9]/.test(ch)) {
      flush()
      ascii += ch
    } else {
      flush()
      flushAscii()
    }
  }
  flush()
  flushAscii()
  return { bigrams: [...bigrams], singles: [...singles] }
}

const { bigrams: queryBigrams, singles: querySingles } = tokenize(query)
const queryTokens = [...queryBigrams, ...querySingles]

const MIN_SCORE = 2
const MIN_EFFECTIVE_BIGRAMS = 1
const GENERIC_BIGRAM_WEIGHT = 0.25

const scoreEntry = (entry) => {
  const title = String(entry.title ?? '').toLowerCase()
  const text = String(entry.text ?? '').toLowerCase()
  const tags = (entry.tags ?? []).map((t) => String(t).toLowerCase())
  const matchedBigrams = []
  const matchedSingles = []
  const effectiveBigrams = []
  let score = 0

  for (const token of queryBigrams) {
    const generic = GENERIC_BIGRAMS.has(token)
    const inTitle = title.includes(token)
    const inTags = tags.some((tag) => tag.includes(token) || token.includes(tag))
    const inText = text.includes(token)
    let weight = 0
    if (inTitle) weight += 5
    if (inTags) weight += 4
    if (inText) weight += generic ? GENERIC_BIGRAM_WEIGHT : 2
    if (weight > 0) {
      score += weight
      matchedBigrams.push(token)
      // Generic words never make an entry effective, even if they appear in a
      // title or tag. At least one non-generic bigram is required.
      if (!generic) effectiveBigrams.push(token)
    }
  }
  for (const token of querySingles) {
    if (STOP.has(token) || LOW_INFO_SINGLES.has(token)) continue
    let weight = 0
    if (title.includes(token)) weight += 0.5
    if (tags.some((tag) => tag.includes(token))) weight += 0.5
    if (weight > 0) {
      score += weight
      matchedSingles.push(token)
    }
  }

  const effective = effectiveBigrams.length >= MIN_EFFECTIVE_BIGRAMS && score >= MIN_SCORE
  const matched = [
    ...effectiveBigrams,
    ...matchedBigrams.filter((token) => !effectiveBigrams.includes(token)),
    ...matchedSingles,
  ]
  return { score: Math.round(score * 10) / 10, matched, matchedBigrams, matchedSingles, effectiveBigrams, effective }
}

const excerptFor = (entry, matched) => {
  const text = String(entry.text ?? '')
  for (const token of matched) {
    const i = text.indexOf(token)
    if (i >= 0) {
      const start = Math.max(0, i - 70)
      const end = Math.min(text.length, i + token.length + 90)
      return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
    }
  }
  return text.slice(0, 160) + (text.length > 160 ? '…' : '')
}

// ---------- platform provider adapter ----------
// Reads a retrieval export produced by a real DeepWorks platform run.
// No endpoint is called here. Every excerpt must be verbatim in the local entry,
// so a platform that silently rewrites or re-chunks text will fail loudly.
const normalizeForMatch = (s) => String(s ?? '').replace(/[…\s]+/g, '')
const entryIndex = new Map(entries.map((e) => [String(e.id), e]))

const platformOutput = (payload, meta) => {
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.results)
      ? payload.results
      : null
  if (!rawList) throw new Error('platform results must be an array or { results: [] }')

  const seen = new Set()
  const rejected = []
  const items = []
  for (const raw of rawList.slice(0, 50)) {
    const id = String(raw?.kb_id ?? raw?.id ?? '')
    if (!id) {
      rejected.push({ kb_id: '', reason: 'missing kb_id' })
      continue
    }
    if (seen.has(id)) {
      rejected.push({ kb_id: id, reason: 'duplicate kb_id' })
      continue
    }
    const entry = entryIndex.get(id)
    if (!entry) {
      rejected.push({ kb_id: id, reason: 'kb_id not found in knowledge/entries.json' })
      continue
    }
    const rawExcerpt = String(raw?.excerpt ?? raw?.text ?? '')
    const excerpt = rawExcerpt || String(entry.text).slice(0, 160)
    const ex = normalizeForMatch(excerpt)
    const full = normalizeForMatch(entry.text)
    if (ex !== '' && !full.includes(ex)) {
      rejected.push({ kb_id: id, reason: 'excerpt is not a verbatim substring of local entry' })
      continue
    }
    seen.add(id)
    items.push({
      kb_id: entry.id,
      title: entry.title,
      domain: entry.domain,
      source: entry.source,
      license: entry.license,
      tags: entry.tags,
      score: typeof raw?.score === 'number' ? raw.score : null,
      matched_terms: Array.isArray(raw?.matched_terms) ? raw.matched_terms : [],
      matched_bigrams: [],
      matched_singles: [],
      effective_bigrams: [],
      excerpt,
      platform_rank: items.length + 1,
    })
  }

  const ranked = items.slice(0, Math.max(1, Math.min(top, 10)))
  const relevant = ranked.length > 0
  return {
    ok: true,
    method: 'platform-knowledge-retrieval',
    provider: 'platform',
    kb_provider: 'platform',
    kb_source: meta.source,
    kb_id: meta.kbId,
    kb_version: kbVersion,
    query,
    top,
    scores_are: 'platform-returned',
    relevant,
    no_relevant_entry: !relevant,
    ambiguous: false,
    tie_count: 0,
    results: ranked,
    rejected,
    kb_integrity_warning: rejected.length > 0,
    note: 'Results come from a platform export. Every excerpt is verified verbatim against knowledge/entries.json; rejected items did not match.',
  }
}

let platformMeta = null
if (provider === 'platform' || provider === 'auto') {
  if (!platformResultsPath) {
    if (!allowFallback) {
      console.error('--provider platform requires --platform-results <path>')
      process.exit(3)
    }
    platformMeta = { fallback_reason: 'platform-results path not provided' }
  } else {
    try {
      const payload = JSON.parse(readFileSync(resolve(projectRoot, platformResultsPath), 'utf8'))
      const result = platformOutput(payload, {
        source: platformResultsPath,
        kbId: String(payload?.kb_id ?? payload?.knowledge_base_id ?? ''),
      })
      const json = JSON.stringify(result, null, 2)
      console.log(json)
      if (outPath) {
        const file = resolve(projectRoot, outPath)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, json + '\n', 'utf8')
      }
      process.exit(0)
    } catch (err) {
      if (!allowFallback) {
        console.error(`platform provider failed: ${err.message}`)
        process.exit(3)
      }
      platformMeta = { fallback_reason: `platform provider failed: ${err.message}` }
    }
  }
}

const scored = entries
  .map((entry) => {
    const s = scoreEntry(entry)
    return { entry, ...s }
  })
  .filter((item) => item.effective && item.score >= MIN_SCORE)
  .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))

const topScore = scored[0]?.score
const tieCount = topScore === undefined ? 0 : scored.filter((item) => item.score === topScore).length

const ranked = scored.slice(0, Math.max(1, Math.min(top, 10))).map((item) => ({
  kb_id: item.entry.id,
  title: item.entry.title,
  domain: item.entry.domain,
  source: item.entry.source,
  license: item.entry.license,
  tags: item.entry.tags,
  score: item.score,
  matched_terms: item.matched,
  matched_bigrams: item.matchedBigrams,
  matched_singles: item.matchedSingles,
  effective_bigrams: item.effectiveBigrams,
  excerpt: excerptFor(item.entry, item.matched),
}))

const relevant = ranked.length > 0
const result = {
  ok: true,
  method: 'deterministic-bigram-keyword-v2',
  provider: 'file',
  kb_provider: 'file',
  kb_source: 'knowledge/entries.json',
  kb_version: kbVersion,
  query,
  query_tokens: queryTokens.slice(0, 60),
  top,
  threshold: MIN_SCORE,
  min_bigrams: MIN_EFFECTIVE_BIGRAMS,
  min_effective_bigrams: MIN_EFFECTIVE_BIGRAMS,
  generic_bigram_weight: GENERIC_BIGRAM_WEIGHT,
  ambiguous: tieCount > 1,
  tie_count: tieCount,
  relevant,
  no_relevant_entry: !relevant,
  results: ranked,
  note: 'Scores are keyword overlap scores, not semantic similarity. At least one non-generic bigram is required; generic bigrams and single characters cannot make an entry relevant.',
  ...(platformMeta ? { kb_fallback: platformMeta } : {}),
}

const json = JSON.stringify(result, null, 2)
console.log(json)
if (outPath) {
  const file = resolve(projectRoot, outPath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, json + '\n', 'utf8')
}
