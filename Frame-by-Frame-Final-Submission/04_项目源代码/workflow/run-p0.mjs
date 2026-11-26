#!/usr/bin/env node
/**
 * P0 acceptance runner.
 * This does NOT replace the agent. It invokes the DeepWorks engine CLI with the
 * project agent `film-curator`, saves the raw event stream, and runs the final
 * quality gate against the JSON the agent wrote.
 *
 * Note: stdio is redirected to files, not pipes, because the CLI may keep a
 * grandchild server alive; `close` would then never fire. We wait on `exit`.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback = undefined) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}

const projectRoot = process.cwd()
const inputPath = option('--input')
if (!inputPath) {
  console.error('Usage: node workflow/run-p0.mjs --input outputs/p0/inputs/run-01.json')
  process.exit(2)
}

const input = JSON.parse(readFileSync(resolve(projectRoot, inputPath), 'utf8'))
const runId = String(input.run_id ?? '').trim()
if (!runId) {
  console.error('input.run_id is required')
  process.exit(2)
}

const model = option('--model', 'dth/DeepSeek-V4.1-Flash')
const agent = option('--agent', 'film-curator')
const timeoutMs = Number(option('--timeout-ms', '600000'))
const exe =
  option('--exe') ??
  process.env.DEEPWORKS_OPENCODE_EXE ??
  join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DeepWorks', 'resources', 'sidecars', 'opencode-x86_64-pc-windows-msvc.exe')

if (!existsSync(exe)) {
  console.error(JSON.stringify({ ok: false, error: 'DeepWorks engine CLI not found', exe }, null, 2))
  process.exit(2)
}

const runsDir = resolve(projectRoot, 'outputs', 'p0', 'runs')
mkdirSync(runsDir, { recursive: true })
const eventsPath = join(runsDir, `${runId}.events.jsonl`)
const stderrPath = join(runsDir, `${runId}.engine.err.log`)
const finalPath = join(runsDir, `${runId}.json`)
const validationPath = join(runsDir, `${runId}.validation.json`)
const summaryPath = join(runsDir, `${runId}.run-summary.json`)

const promptOverride = option('--prompt')
const prompt = promptOverride ?? [
  `读取 ${inputPath}。`,
  '你是 Frame by Frame Film Curator，运行在 DeepWorks 内。',
  '严格按 .opencode/agents/film-curator.md 的工作流执行，不要跳步：',
  '1) 读取输入并运行 workflow/hash-note.mjs；',
  '2) 加载 cinema-knowledge-retrieval、film-note-analysis、cinema-taste-profiling 三个 Skill；',
  '3) 运行知识库检索并选择真正相关的条目；',
  '4) 写 draft，运行 validate-evidence.mjs；',
  '5) 写 kb_citations，运行 validate-citations.mjs；',
  '6) 运行 profile.mjs；',
  `7) 写 ${finalPath}，运行 workflow/validate-run.mjs；`,
  '8) 只返回不超过 120 字的摘要和文件路径。',
  '禁止调用外部网络、Cloudflare Worker 或任何自建后端；禁止修改输入文件；禁止伪造校验通过。',
].join('\n')

const started = Date.now()
const outFd = openSync(eventsPath, 'w')
const errFd = openSync(stderrPath, 'w')
const child = spawn(
  exe,
  [
    'run',
    '--agent', agent,
    '--model', model,
    '--auto',
    '--format', 'json',
    '--title', `FBF P0 ${runId}`,
    prompt,
  ],
  { cwd: projectRoot, windowsHide: true, env: process.env, stdio: ['ignore', outFd, errFd] },
)
console.error(`spawned ${exe} pid=${child.pid} agent=${agent} model=${model}`)

let finalized = false
const finalize = (code, reason = 'exit') => {
  if (finalized) return
  finalized = true
  clearTimeout(timer)
  setTimeout(() => {
    try { closeSync(outFd) } catch {}
    try { closeSync(errFd) } catch {}

    const durationMs = Date.now() - started
    const stdout = existsSync(eventsPath) ? readFileSync(eventsPath, 'utf8') : ''
    const stderr = existsSync(stderrPath) ? readFileSync(stderrPath, 'utf8') : ''

    const summary = {
      ok: false,
      run_id: runId,
      input: inputPath,
      agent,
      model,
      exe,
      started_at: new Date(started).toISOString(),
      duration_ms: durationMs,
      exit_code: code,
      exit_reason: reason,
      final_json: finalPath,
      events: eventsPath,
      engine_stderr: stderrPath,
      validation: validationPath,
      events_bytes: stdout.length,
      stderr_bytes: stderr.length,
    }

    if (!existsSync(finalPath)) {
      summary.error = 'agent did not write the final JSON'
      writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf8')
      console.error(JSON.stringify(summary, null, 2))
      process.exit(1)
    }

    const validation = spawnSync(
      process.execPath,
      [resolve(projectRoot, 'workflow', 'validate-run.mjs'), '--run', finalPath, '--input', inputPath],
      { cwd: projectRoot, encoding: 'utf8' },
    )
    writeFileSync(validationPath, validation.stdout || validation.stderr || '', 'utf8')
    let report = null
    try {
      report = JSON.parse(validation.stdout)
    } catch {
      report = { ok: false, parse_error: true, raw: validation.stdout, stderr: validation.stderr }
    }

    summary.ok = code === 0 && report?.ok === true
    summary.validation_ok = report?.ok === true
    summary.validation_summary = report?.checks ?? null
    summary.validation_failures = report?.failures ?? []
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n', 'utf8')

    console.log(JSON.stringify(summary, null, 2))
    if (!summary.ok) process.exit(1)
  }, 600)
}

const timer = setTimeout(() => {
  try { child.kill() } catch {}
  finalize(null, 'timeout')
}, timeoutMs)

child.on('error', (error) => {
  writeFileSync(stderrPath, String(error?.stack ?? error), 'utf8')
  console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) }, null, 2))
  finalize(1, 'spawn-error')
})

child.on('exit', (code, signal) => finalize(code, signal ? `signal:${signal}` : 'exit'))
