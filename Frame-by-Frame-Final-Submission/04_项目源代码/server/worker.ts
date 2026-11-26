import { createApp } from './app.ts'

type WorkerEnv = Record<string, string | undefined>

const handlers = new Map<string, (request: Request) => Promise<Response>>()

const handlerFor = (env: WorkerEnv) => {
  const key = [
    env.AI_PROVIDER ?? 'deepseek',
    env.AI_MODEL ?? '',
    env.DEEPSEEK_API_KEY ? `k${env.DEEPSEEK_API_KEY.length}` : 'nokey',
    env.ALLOWED_ORIGINS ?? '',
  ].join('|')
  let handler = handlers.get(key)
  if (!handler) {
    handler = createApp({ env })
    handlers.set(key, handler)
  }
  return handler
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handlerFor(env)(request)
  },
}
