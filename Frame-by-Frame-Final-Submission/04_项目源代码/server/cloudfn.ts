/**
 * 国内云函数入口（阿里云函数计算 FC / 腾讯云 SCF）。
 *
 * 两家平台的 HTTP 触发器事件格式几乎一致：
 *   { httpMethod, path, headers, body, isBase64Encoded, queryStringParameters, requestContext }
 * 这里把它翻译成标准 Fetch Request，复用 server/app.ts 的同一份业务逻辑，
 * 再把 Response 翻译回 { statusCode, headers, body, isBase64Encoded }。
 *
 * 部署时请使用「事件函数 + HTTP 触发器」（不要选原始 HTTP 透传函数），
 * 并开启 API 网关的「集成响应」，否则 204/自定义状态码会被网关改写。
 */
import { createApp } from './app.ts'
import type { Env } from './core/env.ts'

type CloudHeaders = Record<string, string | undefined>

export type CloudHttpEvent = {
  httpMethod?: string
  method?: string
  path?: string
  rawPath?: string
  headers?: CloudHeaders
  queryString?: string
  queryStringParameters?: Record<string, string | null> | null
  queryParameters?: Record<string, string | null> | null
  body?: string | null
  isBase64Encoded?: boolean
  requestContext?: {
    httpMethod?: string
    path?: string
    domainName?: string
    http?: { method?: string; path?: string; protocol?: string; sourceIp?: string }
  }
}

export type CloudHttpResult = {
  statusCode: number
  headers: Record<string, string>
  body: string
  isBase64Encoded: boolean
}

const failure = (statusCode: number, code: string, message: string): CloudHttpResult => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: Buffer.from(
    JSON.stringify({ error: { code, message, retryable: statusCode >= 500 } }),
    'utf8',
  ).toString('base64'),
  isBase64Encoded: true,
})

let cached: { key: string; handle: (request: Request) => Promise<Response> } | null = null

const envKey = (env: Env): string =>
  [
    env.AI_PROVIDER ?? 'deepseek',
    env.AI_MODEL ?? '',
    env.DEEPSEEK_BASE_URL ?? '',
    env.DEEPSEEK_API_KEY ? `k${env.DEEPSEEK_API_KEY.length}` : 'nokey',
    env.ALLOWED_ORIGINS ?? '',
    env.ALLOW_STUB_PROVIDER ?? '',
    env.AI_DEBUG ?? '',
  ].join('|')

/** 每个实例只初始化一次；平台注入的环境变量在实例生命周期内不变。 */
const appFor = (env: Env): ((request: Request) => Promise<Response>) => {
  const key = envKey(env)
  if (!cached || cached.key !== key) {
    cached = { key, handle: createApp({ env }) }
  }
  return cached.handle
}

const headerValue = (headers: CloudHeaders | undefined, name: string): string | undefined => {
  if (!headers) return undefined
  const target = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && typeof value === 'string' && value) return value
  }
  return undefined
}

const resolveMethod = (event: CloudHttpEvent): string =>
  (
    event.httpMethod ??
    event.method ??
    event.requestContext?.http?.method ??
    event.requestContext?.httpMethod ??
    'GET'
  ).toUpperCase()

const resolvePath = (event: CloudHttpEvent): string => {
  const raw =
    event.path ?? event.rawPath ?? event.requestContext?.http?.path ?? event.requestContext?.path ?? '/'
  const prefix = (process.env.PATH_PREFIX ?? '').trim().replace(/\/+$/, '')
  let path = raw || '/'
  if (prefix && (path === prefix || path.startsWith(`${prefix}/`))) {
    path = path.slice(prefix.length) || '/'
  }
  return path.startsWith('/') ? path : `/${path}`
}

const resolveQuery = (event: CloudHttpEvent): string => {
  if (event.queryString) return event.queryString.replace(/^\?/, '')
  const params = event.queryStringParameters ?? event.queryParameters
  if (!params || typeof params !== 'object') return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) search.append(key, String(value))
  }
  return search.toString()
}

const resolveProto = (event: CloudHttpEvent): string => {
  const raw = headerValue(event.headers, 'x-forwarded-proto') ?? event.requestContext?.http?.protocol
  if (!raw) return 'https'
  const value = raw.toLowerCase()
  if (value.startsWith('http://') || value.startsWith('http/1') ) return 'http'
  return 'https'
}

const resolveBody = (event: CloudHttpEvent, method: string): Buffer | undefined => {
  if (method === 'GET' || method === 'HEAD') return undefined
  const raw = event.body
  if (raw === null || raw === undefined || raw === '') return undefined
  return event.isBase64Encoded ? Buffer.from(raw, 'base64') : Buffer.from(raw, 'utf8')
}

export const toRequest = (event: CloudHttpEvent): Request => {
  const method = resolveMethod(event)
  const headers = new Headers()
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (typeof value === 'string' && value) headers.set(key, value)
  }
  const host =
    headerValue(event.headers, 'host') ?? event.requestContext?.domainName ?? 'cloudfunction.local'
  const query = resolveQuery(event)
  const url = `${resolveProto(event)}://${host}${resolvePath(event)}${query ? `?${query}` : ''}`
  return new Request(url, { method, headers, body: resolveBody(event, method) })
}

const collectHeaders = (headers: Headers): Record<string, string> => {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    out[key] = value
  })
  return out
}

export const handler = async (
  event: CloudHttpEvent | Buffer | string,
): Promise<CloudHttpResult> => {
  // 原始 HTTP 透传函数会传 Buffer，本入口只接受事件函数格式。
  if (typeof event === 'string' || Buffer.isBuffer(event)) {
    return failure(
      500,
      'INTERNAL',
      'This entrypoint expects an event function behind an HTTP trigger, not a raw HTTP passthrough function.',
    )
  }

  try {
    const response = await appFor(process.env as Env)(toRequest(event))
    const body = Buffer.from(await response.arrayBuffer())
    return {
      statusCode: response.status,
      headers: collectHeaders(response.headers),
      body: body.toString('base64'),
      isBase64Encoded: true,
    }
  } catch (error) {
    console.error(
      JSON.stringify({ event: 'cloudfn_error', message: (error as Error)?.message ?? 'unknown' }),
    )
    return failure(500, 'INTERNAL', 'unexpected cloud function error')
  }
}

// 阿里云 FC 用 handler，腾讯云 SCF 默认 main_handler。
export const main_handler = handler
export const main = handler
export default handler
