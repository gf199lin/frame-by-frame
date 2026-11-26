// Frame by Frame —— 本地预览服务器（零依赖，只需 Node.js 20+）
// 用法：双击同目录的“启动本地预览.cmd”，或在此目录执行 `node preview-server.mjs`
// 作用：以 http://localhost:8123 提供已构建的前端，并处理单页应用路由回退。

import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8123)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const server = http.createServer(async (req, res) => {
  const rawPath = decodeURIComponent((req.url || '/').split('?')[0])
  const target = path.normalize(path.join(ROOT, rawPath))

  if (!target.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  try {
    let filePath = target
    const info = await stat(filePath)
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html')
    const data = await readFile(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    })
    res.end(data)
  } catch {
    // 单页应用：未知路径回退到 index.html，交给前端路由
    try {
      const html = await readFile(path.join(ROOT, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      res.end(html)
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('index.html 缺失，请确认预览目录完整')
    }
  }
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 已被占用。请先关闭已打开的预览窗口，或设置环境变量 PORT 换端口。`)
  } else {
    console.error(err.message)
  }
  process.exit(1)
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}/`
  console.log('')
  console.log('  Frame by Frame —— 本地预览已启动')
  console.log(`  地址：${url}`)
  console.log('  说明：本预览展示界面与本地数据；AI 分析需服务端与密钥，不在本预览范围内。')
  console.log('  关闭本窗口即停止服务。')
  console.log('')
  if (!process.env.NO_OPEN) exec(`start "" "${url}"`)
})
