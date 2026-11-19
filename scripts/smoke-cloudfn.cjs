/**
 * 云函数产物冒烟测试：直接调用 dist-cloudfn/index.js 的 handler，
 * 走一遍「事件 → 请求 → 真实模型 → 响应」的完整链路。
 *
 *   npm run cloudfn:build
 *   node scripts/smoke-cloudfn.cjs            # 读取 .env 里的 DEEPSEEK_API_KEY
 *   AI_MODEL=deepseek-chat node scripts/smoke-cloudfn.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const envFile = path.join(root, '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^"|"$/g, '')
    }
  }
}

const bundle = path.join(root, 'dist-cloudfn', 'index.js')
if (!fs.existsSync(bundle)) {
  console.error('[smoke] dist-cloudfn/index.js not found — run `npm run cloudfn:build` first.')
  process.exit(1)
}

const mod = require(bundle)

const payload = {
  film: {
    id: 'whiplash-2014',
    title: 'Whiplash',
    titleZh: '爆裂鼓手',
    year: 2014,
    director: 'Damien Chazelle',
  },
  rating: 5,
  note: '最后那段鼓SOLO让我屏住呼吸，剪辑的节奏像鞭子一样抽过来。看完很久没说话，不是感动，是被那种偏执震住了。',
  history: [],
}

const event = {
  httpMethod: 'POST',
  path: '/v1/analyze',
  headers: {
    host: 'cloudfn.local',
    'content-type': 'application/json',
    origin: process.env.SMOKE_ORIGIN || 'http://localhost:5173',
  },
  body: JSON.stringify(payload),
  isBase64Encoded: false,
}

const started = Date.now()
mod
  .handler(event)
  .then((result) => {
    const body = JSON.parse(Buffer.from(result.body, 'base64').toString('utf8'))
    console.log(`[smoke] status=${result.statusCode} elapsed=${Date.now() - started}ms`)
    console.log(`[smoke] cors=${result.headers['access-control-allow-origin'] || '(none)'}`)
    if (body.error) {
      console.error(`[smoke] error=${JSON.stringify(body.error)}`)
      process.exit(1)
    }
    console.log(`[smoke] provider=${body.meta.provider} model=${body.meta.model}`)
    console.log(
      `[smoke] evidence=${body.analysis.preference_evidence.length} confidence=${body.analysis.confidence}`,
    )
    console.log(`[smoke] summary=${body.analysis.summary.slice(0, 80)}`)
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
