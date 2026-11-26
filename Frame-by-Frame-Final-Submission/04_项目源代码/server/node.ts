import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createApp } from './app.ts'
import { loadEnvFiles } from './core/loadEnv.ts'
import { readConfig } from './core/env.ts'

const env = loadEnvFiles()
const app = createApp({ env })
const port = Number(env.PORT ?? 8787)
const host = env.HOST ?? '127.0.0.1'

const readBody = async (request: IncomingMessage, limit: number): Promise<Buffer> => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw new Error('body_too_large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

const toRequest = async (request: IncomingMessage): Promise<Request> => {
  const method = request.method ?? 'GET'
  const url = `http://${request.headers.host ?? `${host}:${port}`}${request.url ?? '/'}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '))
    else if (value !== undefined) headers.set(key, value)
  }
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(request, 128 * 1024)
  return new Request(url, { method, headers, body })
}

const server = createServer(async (incoming: IncomingMessage, outgoing: ServerResponse) => {
  try {
    const request = await toRequest(incoming)
    const response = await app(request)
    const body = Buffer.from(await response.arrayBuffer())
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })
    outgoing.writeHead(response.status, headers)
    outgoing.end(body)
  } catch (error) {
    const message = (error as Error).message
    if (message === 'body_too_large') {
      outgoing.writeHead(413, { 'content-type': 'application/json; charset=utf-8' })
      outgoing.end(
        JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'body too large', retryable: false } }),
      )
      return
    }
    outgoing.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
    outgoing.end(
      JSON.stringify({ error: { code: 'INTERNAL', message: 'unexpected error', retryable: true } }),
    )
  }
})

const configResult = readConfig(env)

server.listen(port, host, () => {
  const state = configResult.configured
    ? `provider=${configResult.config.provider} model=${configResult.config.model}`
    : configResult.reason === 'missing_key'
      ? 'NOT CONFIGURED (DEEPSEEK_API_KEY is missing)'
      : 'NOT CONFIGURED (stub provider is disabled; set ALLOW_STUB_PROVIDER=1 to enable it locally)'
  console.log(`[fbf-ai] listening on http://${host}:${port} · ${state}`)
  console.log('[fbf-ai] routes: GET /health · POST /v1/analyze')
})

const shutdown = () => {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
