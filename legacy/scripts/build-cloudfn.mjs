/**
 * 构建国内云函数包。
 * 产出 dist-cloudfn/index.js（CJS 单文件）+ package.json 声明 commonjs，
 * 这样本地可以 require 冒烟测试，上传到 FC/SCF 时同样按 CJS 解析。
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'dist-cloudfn')
const outfile = join(outDir, 'index.js')

mkdirSync(outDir, { recursive: true })

const result = await build({
  entryPoints: [join(root, 'server', 'cloudfn.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
})

writeFileSync(join(outDir, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`)

if (result.errors?.length) process.exit(1)
console.log('[build] dist-cloudfn/index.js ready')
