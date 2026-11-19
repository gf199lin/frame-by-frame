/**
 * 把云函数打包产物压成可直接上传的 zip。
 * 阿里云 FC / 腾讯云 SCF 都要求入口文件位于压缩包根目录。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entry = join(root, 'dist-cloudfn', 'index.js')
const out = join(root, 'dist-cloudfn', 'frame-by-frame-ai.zip')

if (!existsSync(entry)) {
  console.error('[pack] dist-cloudfn/index.js not found — run `npm run cloudfn:build` first.')
  process.exit(1)
}

if (existsSync(out)) rmSync(out)

const command =
  process.platform === 'win32'
    ? ['powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `Compress-Archive -LiteralPath '${entry}' -DestinationPath '${out}' -Force`]]
    : ['zip', ['-j', out, entry]]

const result = spawnSync(command[0], command[1], { stdio: 'inherit' })
if (result.status !== 0) {
  console.error('[pack] failed to create archive.')
  process.exit(result.status ?? 1)
}

const size = statSync(out).size
console.log(`[pack] ${out} (${(size / 1024).toFixed(1)} KiB)`)
console.log('[pack] upload this zip as the function code, entry `index.handler`.')
