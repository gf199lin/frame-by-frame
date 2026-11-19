# 部署到国内云函数（阿里云 FC / 腾讯云 SCF）

Cloudflare Worker 版本在海外节点正常，但 `*.workers.dev` 在中国大陆会被 DNS 污染与 TLS 阻断。
本仓库因此提供第二种部署形态：**同一份业务代码**打包成单文件，跑在阿里云函数计算或腾讯云云函数上，
再由 API 网关暴露一个国内可直连的 HTTPS 地址。

```
前端 (GitHub Pages)
   │  POST /v1/analyze
   ▼
API 网关 / HTTP 触发器
   ▼
server/cloudfn.ts   ← 事件 ↔ Request 适配
   ▼
server/app.ts       ← 与 Worker / Node 完全相同的路由、校验、限流、日志
   ▼
DeepSeek API
```

## 1. 构建与打包

```bash
npm run cloudfn:build   # 产出 dist-cloudfn/index.js（CJS 单文件，约 56 KB）
npm run cloudfn:pack    # 再压成 dist-cloudfn/frame-by-frame-ai.zip（约 16 KB）
```

压缩包内只有根目录的 `index.js`，两家平台都要求入口位于包根。

## 2. 环境变量

在函数配置里设置（不要写进代码仓库）：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | 是 | 建议用平台的「密钥 / 环境变量加密」功能保存 |
| `AI_MODEL` | 否 | 默认 `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | 否 | 默认 `https://api.deepseek.com`，可换成兼容网关 |
| `ALLOWED_ORIGINS` | 是（生产） | 逗号分隔，例如 `https://gf199lin.github.io`；留空等于允许所有来源 |
| `AI_TIMEOUT_MS` | 否 | 默认 45000，范围 5000–90000 |
| `PATH_PREFIX` | 否 | 网关带 stage 前缀时使用，例如 `/release` |
| `AI_DEBUG` | 否 | `1` 时在错误响应里附带校验细节，生产不要开 |

## 3. 阿里云函数计算 FC 3.0

1. 创建函数 → **事件函数**（不要选「HTTP 函数 / 原生 HTTP 透传」，本入口接收的是 JSON 事件）。
2. 运行环境 Node.js 20，代码上传 `frame-by-frame-ai.zip`，**请求处理程序**填 `index.handler`。
3. 规格：内存 256 MB 起，**执行超时 60 秒**（模型单次调用约 5–20 秒）。
4. 配置环境变量（见上表）。
5. 创建 **HTTP 触发器**：认证方式「无需认证」，请求方法勾选 `GET, POST, OPTIONS`，路径 `/*`。
6. 触发器给出的公网地址即为 API 根地址，例如 `https://xxxx.cn-hangzhou.fcapp.run`。

## 4. 腾讯云云函数 SCF

1. 创建函数 → 模板「从头开始」，运行环境 Node.js 18/20，上传 zip。
2. **执行方法**填 `index.main_handler`（与阿里云不同，注意大小写）。
3. 超时时间改为 **60 秒**（默认 3 秒，必然超时），内存 256 MB 起。
4. 配置环境变量（见上表）。
5. 创建 **API 网关触发器**，并在网关处开启 **集成响应**（否则 204 / 自定义状态码会被改写）。
   路径建议 `/` + `/{proxy+}` 或直接把函数挂到根路径。
6. 若网关自动加了 stage 前缀（如 `/release`），设置 `PATH_PREFIX=/release`。

> 两家平台都必须使用「事件函数 + HTTP 触发器 + 集成响应」这一组合，原因见 `server/cloudfn.ts` 顶部注释。

## 5. 上线前自检

```bash
# 健康检查：configured 必须为 true
curl https://<你的函数地址>/health

# 预检：应返回 204 与正确的 allow-origin
curl -i -X OPTIONS https://<你的函数地址>/v1/analyze \
  -H "Origin: https://gf199lin.github.io" \
  -H "Access-Control-Request-Method: POST"

# 真实分析
curl -s https://<你的函数地址>/v1/analyze \
  -H "content-type: application/json" \
  -H "Origin: https://gf199lin.github.io" \
  -d '{"film":{"id":"f1","title":"测试","year":2020},"rating":4,"note":"这是一段足够长的个人观影笔记，用来验证线上链路。"}'
```

本地等价验证（不经过网关，直接调用打包产物）：

```bash
npm run cloudfn:build
node scripts/smoke-cloudfn.cjs   # 读取 .env，真实调用一次模型
```

## 6. 接入前端

把前端构建变量指向函数地址，然后重新构建/部署：

```bash
VITE_AI_API_BASE=https://<你的函数地址> npm run build
```

GitHub Pages 的构建在 [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)，
把 `VITE_AI_API_BASE` 改成新地址后 push 即可。

## 7. 已知限制

- **限流是进程内的**：`RateLimiter` 只在单个函数实例里生效，多实例并发时上限会放大。
  正式对外时请在 API 网关配置限流（例如每 IP 每分钟 12 次、每天 80 次），与本项目默认值保持一致。
- **冷启动**：首次调用约 1–2 秒；模型调用本身 5–20 秒，超时务必设到 60 秒。
- **响应体积**：结果通常 3–8 KB，未超过网关默认限制。
- **日志**：`app.ts` 输出 JSON 结构化日志（`analysis_ok` / `analysis_error` / `rate_limited`），
  可在平台的日志检索里按 `event` 过滤；不会记录笔记原文与 API Key。
- **计费**：按调用次数与 GB·秒计费，个人站点的量级通常落在免费额度或每月几元。

## 8. 与 Worker 版本的关系

三个入口共享同一份 `server/app.ts`，差异只在传输层：

| 入口 | 文件 | 适用 |
|---|---|---|
| Cloudflare Workers | `server/worker.ts` | 海外访问、零运维 |
| Node HTTP 服务 | `server/node.ts` | 本地开发、自建服务器 |
| 国内云函数 | `server/cloudfn.ts` | 大陆可直连（本文） |
