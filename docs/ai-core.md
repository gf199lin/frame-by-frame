# AI Core V1 · 电影记忆分析

Frame by Frame 的 AI 分析不是装饰性的影评摘要。它读取**你自己写下的观影笔记**，输出带原文依据、置信度和不确定性的结构与六维偏好证据；在你确认之前，它不会进入长期画像。

- 模型：DeepSeek（`deepseek-chat`，实际响应模型名以服务端记录为准）
- 运行时：Cloudflare Workers（生产）/ Node（本地验证）
- 提示词版本：`fbf-ai-1.0.0`
- 数据版本：`schemaVersion: 1`，本地存储 `fbf.state.v1`（内部版本 2）
- 密钥：只存在服务端，浏览器只拿到公开的 API 地址

## 1. 设计原则

1. **你的原话优先。** 电影简介只用于消歧；主题和情绪必须来自你的笔记或评分。
2. **单部电影不等于稳定偏好。** 单次分析只描述"这一次"；样本不足时画像明确显示"证据不足"。
3. **不假装。** 没有授权或没有连接服务时，不生成任何解读，也不会把规则猜测伪装成模型输出。
4. **每条判断可追溯。** 证据必须带原文引文；引文必须逐字出现在笔记里，否则会被服务端丢弃。
5. **你拥有最终解释权。** 可以接受、修改、拒绝、逐条移除，也可以删除整次分析；原始笔记永远不被改写。

## 2. 架构

```
浏览器 (React SPA)
  │  VITE_AI_API_BASE（公开 URL，无密钥）
  ▼
POST /v1/analyze
  │  请求校验 → 速率限制 → 历史裁剪
  ▼
AIProvider（接口）
  ├── DeepSeekProvider（fetch，45s 超时，JSON 模式）
  └── StubProvider（仅本地，需 ALLOW_STUB_PROVIDER=1，结果标注 STUB）
  ▼
模型输出 → JSON 修复 → 严格校验 → 引文落地检查 → 返回
```

同一份 Fetch handler 同时运行在：

| 入口 | 用途 | 命令 |
| --- | --- | --- |
| `server/worker.ts` | Cloudflare Workers | `npm run worker:dev` / `worker:deploy` |
| `server/node.ts` | 本地 Node，读取 `.env` / `.dev.vars` | `npm run ai:dev` |

核心逻辑在 `server/core/`：`contract`（限制与枚举）、`prompt`、`validate`、`service`、`deepseek`、`stub`、`rateLimit`、`json`、`env`、`loadEnv`。

## 3. 接口

### `GET /health`

```json
{ "ok": true, "configured": true, "provider": "deepseek", "model": "deepseek-chat", "promptVersion": "fbf-ai-1.0.0" }
```

不返回密钥、不返回端点凭据。

### `POST /v1/analyze`

请求（摘要）：

```json
{
  "film": { "id": "dead-poets", "title": "Dead Poets Society", "year": 1989, "genres": ["Drama"] },
  "rating": 4.5,
  "watchedAt": "2026-11-04",
  "feltLike": "cathartic",
  "note": "你写下的完整笔记……",
  "history": [{ "id": "eternal-sunshine", "title": "...", "year": 2004, "rating": 4.5, "themes": ["memory"] }],
  "locale": "zh-CN"
}
```

约束：笔记 1–3200 字且必须含用户文字；历史最多 8 条（每条摘要 ≤160 字）；请求体 ≤64KB。

响应：

```json
{
  "analysis": {
    "schemaVersion": 1,
    "summary": "…",
    "observed_emotions": [{ "mood": "restrained", "evidence": "…" }],
    "themes_identified": [{ "theme": "grief", "evidence": "…" }],
    "preference_evidence": [
      { "dimension_id": "emotion", "direction": "low", "strength": 0.62, "confidence": 0.55, "evidence": "…", "quote": "…" }
    ],
    "uncertainties": ["…"],
    "related_films": [{ "film_id": "eternal-sunshine", "relationship": "same-mood", "explanation": "…" }],
    "confidence": 0.55,
    "model": { "provider": "deepseek", "model": "deepseek-chat", "promptVersion": "fbf-ai-1.0.0", "analyzedAt": "…" }
  },
  "meta": { "provider": "deepseek", "model": "…", "promptVersion": "fbf-ai-1.0.0", "latencyMs": 8780, "attempts": 1 }
}
```

### 错误码

| HTTP | code | 含义 |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | JSON/字段不合法、笔记过短 |
| 413 | `BAD_REQUEST` | 请求体过大 |
| 422 | `INVALID_MODEL_OUTPUT` | 两次尝试后仍不符合 schema |
| 429 | `RATE_LIMITED` | 12 次/分钟或 80 次/天 |
| 502 | `UPSTREAM_ERROR` | 模型服务错误 |
| 503 | `AI_NOT_CONFIGURED` | 缺少服务端密钥 |
| 504 | `UPSTREAM_TIMEOUT` | 模型超时 |

## 4. 校验与防幻觉

服务端（`server/core/validate.ts`）和浏览器（`src/lib/ai/validate.ts`）使用同一套语义：

- 枚举必须来自 `src/data/taxonomy.ts` 的词表；未知维度/情绪/主题直接拒绝。
- 数值必须在 0–1；`preference_evidence` 不能为空。
- `quote` 去除标点与空白后必须能在笔记中找到，否则**丢弃引文、保留判断**。
- `related_films` 只能引用请求历史里的 id，其余全部丢弃。
- 未知字段不落库；超长字段截断。
- 模型输出先做一次 JSON 提取（容忍 Markdown 代码块），失败时带修复提示重试 1 次；两次失败返回 422，不写入任何结果。
- 日志只记录长度、耗时、错误码；不记录笔记正文。

## 5. 六维画像算法

维度：`narrative`、`emotion`、`thematic`、`visual`、`character`、`ending`。

- 只统计 `accepted` / `edited` 的分析；`rejected` 与逐条 `removed` 的贡献不参与。
- 每条贡献的权重 = 强度 × 置信度 × 笔记深度 × 评分确信度 × 分析整体置信度。
- 维度值 = `0.5 + lean / 2`，`lean ∈ [-1, 1]`；方向由贡献的 `direction` 决定。
- 一致性 = `1 - 标准差 / 1.15`。
- 置信度 = 样本因子 × 平均贡献置信度 × 一致性 × 用户反馈系数。
- **充分样本门槛**：`n ≥ 3` 且 `confidence ≥ 0.32` 且 `consistency ≥ 0.45`；不满足时卡片显示"样本不足"，不给出方向断言。
- 用户反馈系数：同意 1.06、不太像 0.6、纠正 0.32。
- 画像变化历史最多保留 80 条；每次接受/修改/拒绝/逐条移除都会记录变化前后。

## 6. 用户控制

- 首次分析前必须显式勾选授权；授权状态持久化在 `settings.allowAiNotes`。
- 分析默认 `unreviewed`：只有"接受并纳入画像"或"补充我的解释"才会进入画像。
- 可以逐条"这条不像我"，也可以整次拒绝或删除分析；原始记录不受影响。
- 重新分析失败时保留旧分析，不会用本地猜测覆盖。

## 7. 本地运行

```powershell
# 1) 写入服务端密钥（.env 已被 .gitignore 忽略）
#    DEEPSEEK_API_KEY=sk-...
# 2) 启动 API
npm run ai:dev            # http://127.0.0.1:8787
# 3) 另开终端启动前端
npm run dev               # http://localhost:5173
```

开发环境下前端默认请求 `http://127.0.0.1:8787`；也可用 `VITE_AI_API_BASE` 指定其他地址（只暴露 URL，不暴露密钥）。

生产构建必须显式提供 API 地址：

```powershell
$env:VITE_AI_API_BASE='https://<worker-name>.<account>.workers.dev'
npm run build
```

## 8. 部署（Cloudflare Workers）

```powershell
npx wrangler secret put DEEPSEEK_API_KEY   # 只存服务端
npx wrangler deploy
```

`wrangler.toml` 中的公开变量：`ALLOWED_ORIGINS`（逗号分隔，默认 `*`）、`AI_MODEL`、`PROMPT_VERSION`。不要把密钥写进 `wrangler.toml` 或任何 `VITE_*` 变量。

## 9. 验证

```powershell
npm run test:unit     # 21 个前端测试（画像、校验、迁移）
npm run test:server   # 30 个后端测试（契约、限流、错误映射、日志脱敏）
npm run ai:verify     # 真实模型调用，写入 docs/ai-verification.json
```

最近一次真实调用（见 `docs/ai-verification.json`）：`deepseek / deepseek-flash`，约 8.8 秒，4 条偏好证据，摘要 163 字，引文全部可回溯；未涉及的视觉维度被明确列入 `uncertainties`。

界面走查截图在 `outputs/ai-core-verification/`：待确认示例、真实分析、接受、品味页、维度反馈、拒绝。

## 10. 已知限制

- 限流器是**单 isolate 内存实现**；多实例部署需要 KV / Durable Object 才能全局生效。
- 接口目前没有用户鉴权与配额体系，公开部署前应加访问控制（例如 Cloudflare Access 或签名令牌）。
- 历史影片选择是启发式（同导演 / 共享主题 / 最近观看），不保证最优。
- DeepSeek 返回的 `model` 字段可能与请求模型名不同（例如 `deepseek-flash`），画像与证据以响应记录为准。
- 示例片库的解读由编辑撰写（`provider: seed`），界面明确标注"非模型输出"，需你确认后才计入画像。
