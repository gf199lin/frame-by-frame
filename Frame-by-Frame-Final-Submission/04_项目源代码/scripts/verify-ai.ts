/**
 * Real-model verification (Test 1).
 *
 *   npm run ai:verify
 *
 * Requires DEEPSEEK_API_KEY in .env / .env.local / .dev.vars or the process
 * environment. `--stub` is available only to rehearse the pipeline and is
 * clearly labelled as not-a-model in the written evidence.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadEnvFiles } from '../server/core/loadEnv.ts'
import { readConfig } from '../server/core/env.ts'
import { createProvider } from '../server/core/provider.ts'
import { AIError, analyzeFilm } from '../server/core/service.ts'

const args = new Set(process.argv.slice(2))
const env = loadEnvFiles()

if (args.has('--stub')) {
  env.AI_PROVIDER = 'stub'
  env.ALLOW_STUB_PROVIDER = '1'
}

const configResult = readConfig(env)
if (!configResult.configured) {
  console.error(
    configResult.reason === 'missing_key'
      ? '[verify] DEEPSEEK_API_KEY is missing. Add it to .env (server-only) and re-run.'
      : '[verify] Provider is not configured. Use --stub only for pipeline rehearsal.',
  )
  process.exit(2)
}

const config = configResult.config

const SAMPLE_NOTE =
  '重看的时候，最打动我的不是那句“我走不出来”，而是他在警局里突然去夺警察的枪。那一刻我才明白，' +
  '他不是在悲伤，他是在为自己还活着而受罚。整部电影几乎没有让人哭出来的场面，可我一直屏着呼吸。' +
  '我喜欢它没有给一个和解的结尾：冬天过去了，但有些东西没有被修好，只是被允许继续存在。'

const request = {
  film: {
    id: 'verify-manchester',
    title: 'Manchester by the Sea',
    titleZh: '海边的曼彻斯特',
    year: 2016,
    director: 'Kenneth Lonergan',
    genres: ['Drama'],
    runtime: 137,
    logline: 'A man returns to his hometown after his brother dies.',
  },
  rating: 4.5,
  watchedAt: '2026-11-01',
  feltLike: 'restrained',
  note: SAMPLE_NOTE,
  history: [
    {
      id: 'verify-history-1',
      title: 'Eternal Sunshine of the Spotless Mind',
      year: 2004,
      rating: 4.5,
      themes: ['memory', 'loss'],
      moods: ['wistful'],
    },
    {
      id: 'verify-history-2',
      title: 'Aftersun',
      year: 2022,
      rating: 4.5,
      themes: ['memory', 'family'],
      moods: ['melancholy'],
    },
  ],
  locale: 'zh-CN' as const,
}

const started = Date.now()
const noteSha256 = createHash('sha256').update(SAMPLE_NOTE).digest('hex')

const evidencePath = `${process.cwd()}/docs/ai-verification.json`

try {
  const { analysis, meta } = await analyzeFilm(request, { provider: createProvider(config) })
  const evidence = {
    generatedAt: new Date().toISOString(),
    ok: true,
    stub: config.provider === 'stub',
    validation: 'passed',
    schemaVersion: 1,
    provider: meta.provider,
    model: meta.model,
    promptVersion: meta.promptVersion,
    latencyMs: meta.latencyMs,
    wallClockMs: Date.now() - started,
    attempts: meta.attempts,
    inputChars: meta.inputChars,
    request: {
      film: request.film,
      rating: request.rating,
      feltLike: request.feltLike,
      noteSha256,
      sampleNote: SAMPLE_NOTE,
      historyIds: request.history.map((item) => item.id),
    },
    analysis,
  }
  mkdirSync(`${process.cwd()}/docs`, { recursive: true })
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')

  console.log(`[verify] OK · ${meta.provider} / ${meta.model} · ${meta.latencyMs}ms · attempts=${meta.attempts}`)
  console.log(`[verify] summary: ${analysis.summary}`)
  console.log(`[verify] emotions: ${analysis.observed_emotions.map((item) => item.mood).join(', ') || '—'}`)
  console.log(`[verify] themes: ${analysis.themes_identified.map((item) => item.theme).join(', ') || '—'}`)
  console.log(`[verify] evidence: ${analysis.preference_evidence.length} claims · confidence ${analysis.confidence}`)
  console.log(`[verify] evidence written to docs/ai-verification.json (note hash ${noteSha256.slice(0, 12)})`)
} catch (error) {
  const failure = {
    generatedAt: new Date().toISOString(),
    ok: false,
    stub: config.provider === 'stub',
    provider: `${config.provider}/${config.model}`,
    code: error instanceof AIError ? error.code : 'UNKNOWN',
    message: (error as Error).message,
    noteSha256,
  }
  mkdirSync(`${process.cwd()}/docs`, { recursive: true })
  writeFileSync(evidencePath, `${JSON.stringify(failure, null, 2)}\n`, 'utf8')
  console.error(`[verify] FAILED · ${failure.code}: ${failure.message}`)
  process.exit(1)
}
