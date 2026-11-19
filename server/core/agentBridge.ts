import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Bridge to the locally installed DeepWorks engine.
 *
 * This module does NOT analyse anything and does NOT call a network model. It
 * only invokes the DeepWorks engine CLI in non-interactive mode with the
 * project's own `film-curator` agent, exactly like workflow/run-p0.mjs does.
 * All reasoning happens inside DeepWorks; this process just waits for the
 * artefacts the agent writes.
 */

export type AgentBridgeInput = {
  runId: string
  film: {
    id: string
    title: string
    titleZh?: string
    year: number
    director?: string
    genres?: string[]
    country?: string
    language?: string
    runtime?: number
    logline?: string
  }
  rating: number
  feltLike?: string
  note: string
  history?: Array<Record<string, unknown>>
  locale?: string
}

export type AgentBridgeOptions = {
  projectRoot: string
  enginePath?: string
  model?: string
  agent?: string
  timeoutMs?: number
}

export type AgentBridgeResult =
  | {
      ok: true
      runId: string
      durationMs: number
      enginePath: string
      agent: string
      model: string
      finalPath: string
      run: Record<string, unknown>
    }
  | {
      ok: false
      runId: string
      durationMs: number
      enginePath: string
      agent: string
      model: string
      reason:
        | 'ENGINE_NOT_FOUND'
        | 'BUSY'
        | 'TIMEOUT'
        | 'ENGINE_FAILED'
        | 'NO_RESULT'
      detail: string
      exitCode?: number | null
      finalPath?: string
    }

const DEFAULT_MODEL = 'dth/DeepSeek-V4.1-Flash'
const DEFAULT_AGENT = 'film-curator'

export const resolveEnginePath = (override?: string): string =>
  override && override.trim().length > 0
    ? override.trim()
    : process.env.DEEPWORKS_OPENCODE_EXE ??
      join(
        process.env.LOCALAPPDATA ?? '',
        'Programs',
        'DeepWorks',
        'resources',
        'sidecars',
        'opencode-x86_64-pc-windows-msvc.exe',
      )

/** One engine run at a time: concurrent spawns fight over the same project. */
let running = false

export const isAgentRunInProgress = (): boolean => running

export const runFilmCurator = async (
  input: AgentBridgeInput,
  options: AgentBridgeOptions,
): Promise<AgentBridgeResult> => {
  const startedAt = Date.now()
  const enginePath = resolveEnginePath(options.enginePath)
  const model = options.model ?? DEFAULT_MODEL
  const agent = options.agent ?? DEFAULT_AGENT
  const timeoutMs = options.timeoutMs ?? 240_000
  const projectRoot = resolve(options.projectRoot)

  if (!existsSync(enginePath)) {
    return {
      ok: false,
      runId: input.runId,
      durationMs: 0,
      enginePath,
      agent,
      model,
      reason: 'ENGINE_NOT_FOUND',
      detail: 'DeepWorks engine CLI was not found on this machine.',
    }
  }
  if (running) {
    return {
      ok: false,
      runId: input.runId,
      durationMs: 0,
      enginePath,
      agent,
      model,
      reason: 'BUSY',
      detail: 'another DeepWorks agent run is already in progress.',
    }
  }

  const inputsDir = join(projectRoot, 'outputs', 'p0', 'inputs')
  const runsDir = join(projectRoot, 'outputs', 'p0', 'runs')
  mkdirSync(inputsDir, { recursive: true })
  mkdirSync(runsDir, { recursive: true })

  const inputPath = join(inputsDir, `${input.runId}.json`)
  const finalPath = join(runsDir, `${input.runId}.json`)
  const eventsPath = join(runsDir, `${input.runId}.events.jsonl`)
  const engineErrPath = join(runsDir, `${input.runId}.engine.err.log`)

  const payload = {
    run_id: input.runId,
    user_id: 'web-local',
    film: input.film,
    rating: input.rating,
    ...(input.feltLike ? { felt_like: input.feltLike } : {}),
    note: input.note,
    history: input.history ?? [],
    locale: input.locale ?? 'zh-CN',
  }
  writeFileSync(inputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8')

  const prompt = [
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

  const outFd = await import('node:fs').then(({ openSync }) => openSync(eventsPath, 'w'))
  const errFd = await import('node:fs').then(({ openSync }) => openSync(engineErrPath, 'w'))

  running = true
  try {
    const child = spawn(
      enginePath,
      ['run', '--agent', agent, '--model', model, '--auto', '--format', 'json', '--title', `FBF web ${input.runId}`, prompt],
      { cwd: projectRoot, windowsHide: true, env: process.env, stdio: ['ignore', outFd, errFd] },
    )

    const exit = await new Promise<{ code: number | null; timedOut: boolean }>((done) => {
      const timer = setTimeout(() => {
        try {
          child.kill()
        } catch {
          /* ignore */
        }
        done({ code: null, timedOut: true })
      }, timeoutMs)
      child.on('exit', (code) => {
        clearTimeout(timer)
        done({ code, timedOut: false })
      })
      child.on('error', () => {
        clearTimeout(timer)
        done({ code: null, timedOut: false })
      })
    })

    const durationMs = Date.now() - startedAt

    if (exit.timedOut) {
      return {
        ok: false,
        runId: input.runId,
        durationMs,
        enginePath,
        agent,
        model,
        reason: 'TIMEOUT',
        detail: `agent did not finish within ${timeoutMs} ms`,
        finalPath,
      }
    }

    if (!existsSync(finalPath)) {
      return {
        ok: false,
        runId: input.runId,
        durationMs,
        enginePath,
        agent,
        model,
        reason: exit.code === 0 ? 'NO_RESULT' : 'ENGINE_FAILED',
        detail: 'the agent did not write the final JSON file',
        exitCode: exit.code,
        finalPath,
      }
    }

    const run = JSON.parse(readFileSync(finalPath, 'utf8')) as Record<string, unknown>
    return {
      ok: true,
      runId: input.runId,
      durationMs,
      enginePath,
      agent,
      model,
      finalPath,
      run,
    }
  } finally {
    running = false
  }
}
