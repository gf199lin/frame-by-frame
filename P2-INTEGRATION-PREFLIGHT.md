# Frame by Frame · P2 集成前架构审查与实施方案

> 审查日期：2026-11-09
> 审查对象：`C:\Users\BayMax\Desktop\frame by frame`
> 分支 / HEAD：`p1.1-profile-v2` / `9212dba`
> 工作区状态：**不干净**。`git status --porcelain` 显示 29 个已跟踪修改、21 个未跟踪项（合计 50）。存在并行前端任务（`_work/patch-*.mjs`）与历史未提交改动，本轮未触碰。
> 本轮边界：**只审查、只写本报告；未修改任何业务代码，未部署，未提交 Git，未 stash / reset / clean / restore。**
> 事实口径：只写本次可核对的文件、命令输出与运行记录；“设计过”不等于“已实现”，“命令存在”不等于“集成可用”。

---

## 0. 结论（先看这一页）

### 0.1 三句话

1. **DeepWorks 侧的“大脑”已经真实存在**：`film-curator` + 3 个 Skill + 12 条项目知识库 + 七步工作流，已有 3 次通过质量门的运行记录。
2. **网站侧的“大脑”仍然是外部 Worker**：`AddFilmFlow` 与 `FilmAnalysisPanel` 都调用 `${VITE_AI_API_BASE}/v1/analyze`，由 `server/` 调用 DeepSeek；网站从未读取过 Agent 的输出。
3. **两条链路目前没有交点**。P2 的本质不是“再接一个 API”，而是**建立一份双方都认的契约，把 Agent 的输出变成网站唯一的分析来源，并把 Worker 降级为显式备用**。

### 0.2 关键判断

| 问题 | 事实判断 | 依据 |
|---|---|---|
| 网站是否已经在用 DeepWorks Agent？ | **没有** | `src/lib/ai/client.ts` 只请求 `/v1/analyze`；`src/` 内无 `latest.json` / Agent 端点 |
| Agent 是否能产出结构化 JSON？ | **能，已实测** | 3 份 `outputs/p0/runs/*.json` + 对应 `*.validation.json`，均为 `ok=true` |
| 网站能否直接消费 Agent JSON？ | **不能，字段不兼容** | 网站 `schemaVersion: 1`、`direction: neutral`、`evidence` 必填；Agent 用 `quote`/`interpretation`/`ambivalent` |
| 网站是否消费了 `profile_delta`？ | **没有** | 画像在浏览器里用 `computeTasteProfile()` 重算，只读 `state.analyses` |
| 是否有官方网页→Agent 实时 API？ | **未验证，不假设存在** | 未找到已核对的端点/鉴权文档；只验证了本地 CLI 与 `serve` 命令存在 |
| 平台知识中心是否已接入？ | **没有** | 当前是 `knowledge/entries.json` 文件型检索 |
| 七步工作流是否是可视化画布？ | **不是** | 是 Agent 指令 + Skill + 确定性脚本质量门 |
| 当前能否现场演示“网站→DeepWorks”？ | **不能，只能演示两条独立链路** | 无数据交接文件、无导入入口、无 provenance 展示 |

### 0.3 本轮实测基线

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm.cmd run typecheck` | **通过**，退出码 0 |
| 单元测试 | `vitest run` | **21 passed / 3 files** |
| 服务端测试 | `node --test server` | **38 passed / 0 failed** |
| 合计 | `npm.cmd run test` | **59 passed** |

> 备注：PowerShell 执行策略禁止 `npm.ps1`，本轮用 `npm.cmd` 复核。这是环境差异，不是项目缺陷。

---

## 1. 审查范围、方法与限制

### 1.1 已实际读取

- 网站：`src/App.tsx`、`src/pages/*`、`src/components/add/AddFilmFlow.tsx`、`src/components/film/FilmAnalysisPanel.tsx`、`src/store/AppStore.tsx`、`src/lib/storage.ts`、`src/lib/ai/*`、`src/types.ts`、`src/data/taxonomy.ts`、`src/data/filmArtwork.ts`。
- 服务端：`server/app.ts`、`server/worker.ts`、`server/cloudfn.ts`、`server/core/*`、`wrangler.toml`、`s.yaml`、`.env.example`。
- DeepWorks 侧：`.opencode/agents/film-curator.md`、3 个 `SKILL.md` 与脚本、`workflow/*.mjs`、`knowledge/*`、`opencode.jsonc`。
- 运行记录：`outputs/p0/P0-REPORT.md`、3 份 P0 运行 JSON、`outputs/p1/P1.1.1-IMPLEMENTATION-REPORT.md`、`outputs/p1/_work/schema-v2-example.json`。
- 历史审查：`outputs/competition-readiness-audit-2026-11-09.md`、`competition-review-2026-11-05.md`、`docs/*.md`。

### 1.2 已实际执行

```powershell
git status --porcelain=v1
npm.cmd run typecheck
npm.cmd run test
& "$env:LOCALAPPDATA\Programs\DeepWorks\resources\sidecars\opencode-x86_64-pc-windows-msvc.exe" --help
& "...\opencode-x86_64-pc-windows-msvc.exe" serve --help
& "...\opencode-x86_64-pc-windows-msvc.exe" run --help
```

### 1.3 明确没有做（不得写成已完成）

- 没有启动新的 `opencode serve` 实例，因此**未验证** HTTP 路由、鉴权、跨域、会话 API 契约。
- 没有访问 DeepWorks 知识中心，**未验证**平台知识库的创建、上传、检索。
- 没有操作 DeepWorks 主界面，**未验证** UI 中的 Agent 选择器与截图。
- 没有运行新的 `film-curator` 会话；本次审查会话不是 `film-curator`，也没有原生 `skill` 工具（用户已明确此事实）。
- 没有验证比赛账号额度、现场网络、评委环境。
- 没有修改任何业务代码、Skill、知识库或部署配置。

---

## 2. A. 网站现状

### 2.1 页面与功能

路由定义在 [App.tsx](src/App.tsx#L48-L55)。

| 路由 | 页面 | 主要功能 | 数据来源 |
|---|---|---|---|
| `/` | `Home` | 首屏、最近观影、笔记摘录、画像摘要 | `useAppStore()` |
| `/archive` | `Archive` | 片库列表、筛选、搜索、进入详情 | `records + films` |
| `/archive/:filmId` | `FilmDetail` | 影片信息、海报、笔记、AI 分析面板、评分、接受/拒绝/纠错 | `records + films + analyses` |
| `/map` | `MemoryMapPage` | 记忆图谱、影片关联 | `buildMemoryGraph()` |
| `/taste` | `Taste` | 六维雷达、维度卡、证据引文、待确认分析 | `computeTasteProfile()` |
| `/reflection` | `Reflection` | 年度回顾、统计、年鉴 HTML 下载 | `records + profile + timeline` |
| `*` | `NotFound` | 404 | — |

Shell 提供导航；`AddFilmProvider` 提供全局“新增电影”入口；`ToastProvider` 提供提示；`ErrorBoundary` 兜底。

### 2.2 新增电影的完整调用链

入口：`AddFilmFlow`（五步：`search → confirm → form → analyzing → result`）。

```
用户点击“新增电影”
  → AddFilmFlow 打开
  → [1] 搜索
      src/lib/catalogue/index.ts
        ├─ 本地目录（src/data/films.ts）
        ├─ TMDB（token 存 localStorage，src/lib/catalogue/tmdb.ts）
        └─ IMDb 备用（src/lib/catalogue/imdb.ts）
  → [2] 选中影片
      - 目录内：直接使用
      - 目录外：addCustomFilm(film)（AddFilmFlow L294/L307/L367）
  → [3] 填写评分 / 观看日期 / 状态 / 笔记 / feltLike
  → [4] runAnalysis()（AddFilmFlow L396-L461）
      - 校验 rating > 0、note ≥ 18 字（L398-L405）
      - 校验 isAiConfigured()（L409-L412）
      - 校验 consent（L413-L416）
      - analyzeFilmMemory(payload)（L426-L437）
          → POST ${VITE_AI_API_BASE}/v1/analyze（src/lib/ai/client.ts L92）
          → 前端 validateAnalyzeResponse()（client.ts L113-L123）
      - toFilmAnalysis(response, recordId, filmId, now)（L440）
      - createRecordFromAnalysis(...)（L441）
      - commitRecord(...) → upsertRecord(...)（L442-L445）
      - saveAnalysis(analysis)（L446）
  → [5] result：显示分析，等待用户确认
```

**失败 / 跳过分支**（AddFilmFlow L378-L394）：

- `createRecordWithoutAnalysis()`（`src/lib/ai/adapter.ts` L86-L113）：
  - `themes: []`
  - `moods` 只保留用户自己选的 `feltLike`
  - `ai.status = 'failed' | 'skipped'`
  - **不伪造标签，不伪造置信度**。
- 编辑已有记录时，会 `deleteAnalysis(editRecord.id)`，避免旧分析挂在新记录上。

**结论：新增电影的主链路是“浏览器 → 外部 AI API → 浏览器”，没有任何 DeepWorks 调用。**

### 2.3 观影笔记如何保存 / localStorage 如何工作

| 项 | 事实 |
|---|---|
| 存储位置 | `window.localStorage` |
| Key | `fbf.state.v1`（[taxonomy.ts](src/data/taxonomy.ts#L250)） |
| 版本 | `STORAGE_VERSION = 2`（taxonomy.ts L256） |
| 笔记字段 | `WatchRecord.reflection`（纯文本，用户原文） |
| 写入时机 | `AppStoreProvider` 的 `useEffect(() => persistState(state), [state])`（[AppStore.tsx](src/store/AppStore.tsx#L303-L305)） |
| 读取时机 | `loadState()`（[storage.ts](src/lib/storage.ts#L245-L271)） |
| 迁移 | `migrate()`（storage.ts L197-L243）：保留记录、笔记、评分；补全缺失字段；不凭空造分析 |
| 跨标签 | `relisten()` 监听 `storage` 事件（storage.ts L293-L306） |
| 失败处理 | `persistState()` 返回 `false`；`clearState()` 只在 reset 时调用 |
| 备份/恢复 | **没有**。只有年鉴 HTML 下载（`Reflection.tsx` L321-L330），不是完整数据备份 |

**重要事实**：笔记没有独立表，也没有加密；它就是 `records[].reflection`。导出/导入整个 `AppState` 的能力尚不存在。

### 2.4 六维画像从哪里读取

```
Taste / Home / FilmDetail
  → useAppStore().profile
  → computeTasteProfile(state, films)（src/lib/ai/tasteProfile.ts L259-L315）
      - 只使用 status='complete' 且 review.verdict ∈ {accepted, edited} 的分析（L53-L56）
      - 只使用 preference_evidence（L69-L93）
      - 用户移除的单条证据（userStatus='removed'）被排除（L71）
      - 维度置信度 = 样本因子 × 平均置信度 × 一致性 × 反馈因子（L125-L130）
      - 证据 < 3 部时 sampleState='insufficient'（L265-L272）
```

**画像完全在浏览器里计算，不读取 `profile_delta`，不读取任何 Agent 文件。**

### 2.5 哪些 AI 分析仍由 Cloudflare Worker 执行

| 能力 | 位置 | 是否仍在外部 |
|---|---|---|
| 系统提示词 | `server/core/prompt.ts` | 是 |
| 模型调用 | `server/core/service.ts` → `server/core/deepseek.ts` | 是 |
| 结构化校验 / 修复重试 | `server/core/validate.ts`、`service.ts` | 是 |
| 证据逐字校验 | `server/core/validate.ts` | 是（前端还有一份镜像：`src/lib/ai/validate.ts`） |
| 限流 | `server/core/rateLimit.ts` | 是（单实例内存） |
| Cloudflare Worker 入口 | `server/worker.ts` + `wrangler.toml` | 是 |
| 阿里云函数入口 | `server/cloudfn.ts` + `s.yaml` | 是（第二套外部后端） |
| 前端调用 | `src/lib/ai/client.ts` L92 | 是 |

> 也就是说：**当前有两套可部署的外部 AI 后端（Cloudflare Worker、阿里云 FC），共用 `server/app.ts` 的业务逻辑。** 这不是“一个可选的本地 fallback”，而是当前唯一的主分析链路。

### 2.6 哪些功能已经可以独立运行

**不依赖外部服务即可运行：**

- 6 个页面 + 详情页 + 404。
- 本地片库搜索（`src/data/films.ts`）。
- 手动添加电影、评分、笔记、feltLike。
- localStorage 持久化、迁移、跨标签同步。
- 六维画像计算（基于已有 analyses）。
- 记忆图谱、年度回顾、年鉴 HTML 下载。
- 保存“未分析”的记录（`failed/skipped` 状态）。
- 59 项测试与类型检查。

**依赖外部服务：**

- AI 分析：需要 `VITE_AI_API_BASE` 指向 Worker / 云函数 / 本地 `npm run ai:dev`。
- TMDB 搜索：需要用户自己的 TMDB token（浏览器本地）。
- 真实海报：`src/data/filmArtwork.ts` 使用 TMDB CDN 或本地官方发行海报副本。

### 2.7 关键差距：网站 v1 契约 vs Agent v2 契约

| 字段 | 网站（`src/types.ts`） | Agent（`outputs/p0/runs/*.json`） | 兼容性 |
|---|---|---|---|
| 顶层版本 | `AI FilmAnalysis.schemaVersion: 1`（L258-L259） | 无 `schemaVersion`；v2 用 `profile_delta.schema_version: 2` | **不兼容** |
| 证据措辞 | `evidence: string` 必填（L242） | `interpretation: string`，无 `evidence` | **不兼容** |
| 引文 | `quote?: string` 可选（L244） | `quote: string` 必填 | 部分兼容 |
| 方向 | `low \| high \| neutral`（L235） | `low \| high \| ambivalent` | **不兼容**（`validate.ts` L110-L114 会拒绝 `ambivalent`） |
| 记录绑定 | `recordId`、`filmId` 必填 | 只有 `input.film`，无 `recordId` | **不兼容** |
| 模型元数据 | `model.provider/model/promptVersion/analyzedAt` | `platform/model/timestamp` | **不兼容** |
| 画像 | 浏览器 `computeTasteProfile()` 全量重算 | `profile_delta` 单次增量（0–100 分） | **未消费** |
| 观察状态 | `DimensionProfile.value` 0–1，无 `status` | `dimensions[].status: observed \| unobserved` | **不兼容** |
| 临时性 | `sampleState: empty/insufficient/forming/stable` | `provisional`、`sufficient`、`independent_note_count` | **需映射** |

**这是 P2 最核心的工程工作：不是“接 API”，而是“做适配层 + 契约版本化”。**

---

## 3. B. DeepWorks 现状

### 3.1 `film-curator` 如何被加载和调用

| 项 | 事实 |
|---|---|
| 定义文件 | `.opencode/agents/film-curator.md` |
| 模式 | `mode: primary`（frontmatter） |
| 模型 | `dth/DeepSeek-V4.1-Flash` |
| 默认 Agent | `opencode.jsonc`：`"default_agent": "film-curator"` |
| UI 入口 | 在 DeepWorks 中选择 `Frame by Frame Film Curator`，发送“读取 input，按工作流执行” |
| CLI 入口 | `workflow/run-p0.mjs` |
| 引擎路径 | `%LOCALAPPDATA%\Programs\DeepWorks\resources\sidecars\opencode-x86_64-pc-windows-msvc.exe`（存在，文件版本 1.3.14） |
| CLI 参数 | `run --agent film-curator --model dth/DeepSeek-V4.1-Flash --auto --format json --title ...`（`run-p0.mjs` L35-L87） |
| 已验证运行 | P0 三次，均通过 `validate-run.mjs`，有事件流与最终 JSON |

**真实调用方式（本次核实）：**

- `opencode run` 支持 `--agent`、`--model`、`--format json`、`--attach`、`--password`、`--auto`（`run --help` 输出）。
- `opencode serve` 支持 `--port`、`--hostname`、`--cors`（`serve --help` 输出）。
- 但 **`serve` 的 HTTP 路由、鉴权、会话 API、是否允许浏览器跨域调用，本次未验证**。

> 当前审查会话使用的是默认 Agent，不是 `film-curator`；也没有原生 `skill` 工具。因此本轮对 Skill 的处理是“读取 SKILL.md + 阅读脚本”，不能描述为“本次原生 skill 调用成功”。

### 3.2 三个 Skill 的实际执行路径

| Skill | 触发时机 | 加载方式（P0 证据） | 实际脚本 | 质量门 |
|---|---|---|---|---|
| `cinema-knowledge-retrieval` | 分析前 | `skill` 工具，`via: "skill"` | `retrieve.mjs`、`validate-citations.mjs` | 引用逐字、`kb_id` 存在、分数阈值 |
| `film-note-analysis` | 检索后 | `skill` 工具，`via: "skill"` | `validate-evidence.mjs` | 3–6 条、≥3 维度、引文逐字 |
| `cinema-taste-profiling` | 证据校验后 | `skill` 工具，`via: "skill"` | `profile.mjs`、`profile-thresholds.mjs` | 六维齐全、v2 充分性、纠错过滤 |

**两套事实必须分开写：**

- **P0 运行**：`skills_used[].via = "skill"`，事件流含 `"tool":"skill"`，会话导出含 `<skill_content>`。这是历史事实。
- **本次审查会话**：没有 `skill` 工具，只有文件读取与 `bash`。因此本报告不把本次审查描述为“Skill 原生调用成功”。

### 3.3 知识库：本地文件，不是平台知识中心

| 项 | 事实 |
|---|---|
| 文件 | `knowledge/entries.json`（12 条）、`knowledge/index.json`、`knowledge/SOURCES.md` |
| 检索 | `.opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs` |
| 方法 | 确定性关键词 / 二元组匹配，**不是向量检索** |
| 阈值 | 最高分 < 2 或缺乏有效双字 → `no_relevant_entry`（P1.1.1 修复） |
| 引用 | `kb_id`、`title`、`source`、`excerpt`、`why_relevant`；`excerpt` 必须逐字 |
| 平台知识中心 | **未创建、未接入、未验证** |
| 差距 | 平台侧的权限、索引、检索 API、可见性、版本管理均为未知 |

### 3.4 七步工作流的真实执行顺序

来源：`.opencode/agents/film-curator.md` L37-L163，`docs/workflow.md`。

```
[1] 读取 input + hash-note.mjs（note_sha256 / note_chars）
      ↓
[2] cinema-knowledge-retrieval → retrieve.mjs（top 4）
      ↓
[3] film-note-analysis → 写 draft（3–6 条证据，≥3 维度）
      ↓
[4] validate-evidence.mjs（引文逐字硬门）
      ↓
[5] 写 kb_citations → validate-citations.mjs（引用逐字硬门）
      ↓
[6] cinema-taste-profiling → profile.mjs（profile_delta）
      ↓
[7] 组装 final JSON → validate-run.mjs（最终硬门）
      ↓
outputs/p0/runs/<run_id>.json
```

**形态说明：** 这是“Agent 指令 + Skill 调用 + 确定性脚本质量门”，**不是可视化画布**。每一步都有可执行脚本，但顺序由 Agent 指令与运行器共同保证，不由平台画布保证。

### 3.5 最终 JSON 结构（以 `fbf-p0-20261109-01.json` 为例）

```json
{
  "agent": "Frame by Frame Film Curator",
  "agent_id": "film-curator",
  "platform": "DeepWorks",
  "model": "dth/DeepSeek-V4.1-Flash",
  "run_id": "fbf-p0-20261109-01",
  "timestamp": "2026-11-09T03:11:35.099Z",
  "skills_used": [{ "name": "...", "invoked": true, "via": "skill", "script": "..." }],
  "kb_status": "cited",
  "retrieval_log": { "query": "...", "top_ids": [], "selected_ids": [] },
  "kb_citations": [{ "kb_id": "KB-004", "title": "...", "source": "...", "excerpt": "...", "why_relevant": "..." }],
  "analysis": {
    "summary": "...",
    "observed_emotions": [{ "mood": "restrained", "evidence": "..." }],
    "themes_identified": [{ "theme": "grief", "evidence": "..." }],
    "confidence": 0.72
  },
  "preference_evidence": [{
    "dimension_id": "emotion",
    "direction": "low",
    "strength": 0.9,
    "confidence": 0.8,
    "quote": "整部电影几乎没有让人哭出来的场面，可我一直屏着呼吸",
    "interpretation": "...",
    "evidence_type": "user_quote"
  }],
  "profile_delta": { "method": "weighted-evidence-shrinkage", "sample_size": 5, "dimensions": {} },
  "uncertainties": ["..."],
  "input": {
    "film": { "title": "...", "titleZh": "...", "year": 2016 },
    "note_sha256": "...",
    "note_chars": 114,
    "note_unchanged": true
  },
  "quality_gates": {
    "evidence_verbatim": true,
    "kb_citations_valid": true,
    "note_unchanged": true,
    "uncertainties_present": true
  }
}
```

Schema v2 额外字段（`outputs/p1/_work/schema-v2-example.json`）：

- `schema_version: 2`
- `evidence_count`、`independent_note_count`
- `duplicate_evidence_count`、`duplicate_note_count`
- `sufficient`、`provisional`、`provisional_reasons`
- `dimensions[].status: observed | unobserved`
- `dimensions[].score`（0–100，或 `null`）
- `dimensions[].note_count`、`evidence_count`、`neutral_default`
- `corrections_applied`、`warnings`

### 3.6 Schema v2 如何被网站消费

**答案：目前完全没有消费。**

证据：

- `src/types.ts` 的 `AIFilmAnalysis` 固定 `schemaVersion: 1`（L258-L259）。
- `src/lib/storage.ts` 的 `normaliseAnalysis()` 固定写回 `schemaVersion: 1`（L118）。
- `src/lib/ai/tasteProfile.ts` 只读 `analysis.preference_evidence`、`analysis.confidence`、`analysis.model.analyzedAt`，不读 `profile_delta`。
- `src/` 内没有 `profile_delta`、`provisional`、`unobserved`、`latest.json` 的引用。
- 前端 `validate.ts` 会拒绝 `direction: "ambivalent"`（L110-L114），而 Agent v2 使用 `ambivalent`。

**结论：Schema v2 目前只是 DeepWorks 侧的质量门与画像输出格式，尚未成为网站的数据契约。**

---

## 4. C. 网站与 DeepWorks 的集成方案

### 4.1 官方能力盘点（严格区分）

| 能力 | 状态 | 证据 / 说明 |
|---|---|---|
| 本地 CLI 运行 Agent | **已验证** | `workflow/run-p0.mjs` 三次运行；`opencode run --agent ... --format json` |
| Agent 读写工作区文件 | **已验证** | P0 写出 `outputs/p0/runs/*.json`、draft、retrieval、profile |
| 本地 headless server 命令 | **命令存在，未验证契约** | `opencode serve --port --hostname --cors`；未启动、未请求、未验证路由 |
| 浏览器直接调用 DeepWorks | **未验证** | 没有已核对的公网端点、鉴权方式、CORS 策略 |
| 平台知识库检索 API | **未验证** | 未访问知识中心 |
| 平台 Webhook / MCP 暴露 | **未验证，不假设存在** | 仓库与帮助文本中无对应配置 |
| 可视化工作流画布 | **未验证** | 当前工作流不是画布 |
| 平台账号额度 / Skill 权限 | **未验证** | 需本人登录比赛账号确认 |

### 4.2 三个候选集成方案

#### 方案 A：文件交接（推荐作为 P2 第一刀）

```
网站导出 pending note JSON
  → 用户/演示者把文件放入工作区（或 Agent 直接读取）
  → film-curator 运行，写出 outputs/p2/runs/<run_id>.json
  → 同时写出 public/agent/latest.json（网站可 fetch 的投影）
  → 网站“导入 DeepWorks 结果”按钮读取并校验
  → 写入 localStorage，展示 provenance
```

- **优点**：零密钥、零新后端、完全可复现、断网可用、合规叙事最干净（智能确实在 DeepWorks）。
- **缺点**：不是“提交即自动分析”，需要一次人工/脚本触发；现场演示必须排练。
- **适用**：P2 最小闭环、决赛现场主路径、离线兜底。

#### 方案 B：本地 CLI 桥（可选增强）

```
网站 POST 127.0.0.1:<port>/analyze
  → 本地桥（只做文件写入 + spawn CLI + 读取输出）
  → opencode run --agent film-curator ...
  → 桥返回 JSON
```

- **优点**：接近“提交即分析”；仍然由 DeepWorks Agent 做全部推理。
- **缺点**：需要本地进程；桥本身是新的外部组件，必须严格限制为“传输层”；跨域、鉴权、超时、并发、路径白名单都要做；静态部署不可用。
- **合规边界**：桥不得包含提示词、模型调用、证据判断、画像计算；一旦包含，就重新变成“外部后端为主体”。
- **适用**：P2.1 可选，不作为比赛主路径。

#### 方案 C：平台 HTTP API / 知识中心 API

- **现状**：未验证，不能写进方案基线。
- **若平台确实提供**：优先用官方鉴权与配额；网站只做展示；仍需契约适配层。
- **在验证前**：不得在材料、代码或演示中声称“已接入平台 API”。

### 4.3 推荐方案：A 为主，B 为可选，C 待验证

**P2 目标链路（最小可行）：**

```
[1] 用户在网站写笔记并保存（本地，已有）
      ↓
[2] 点击“交给 DeepWorks 分析”
      → 导出 outputs/p2/pending/<record_id>.json
        { contract_version, record_id, film, rating, watched_at, felt_like, note, note_sha256, locale }
      ↓
[3] 在 DeepWorks 中运行 film-curator（UI 或 CLI）
      → 读取 pending JSON
      → 七步工作流
      → 写 outputs/p2/runs/<run_id>.json
      → 写 public/agent/latest.json（只含网站需要的字段）
      ↓
[4] 网站“导入 DeepWorks 结果”
      → fetch('/agent/latest.json') 或用户选择文件
      → 校验契约（platform/agent_id/run_id/note_sha256/quote/profile_delta）
      → 映射为 AIFilmAnalysis v2
      → 预览 evidence / KB / provisional
      ↓
[5] 用户确认
      → 写入 localStorage（保留旧分析到 history）
      → Taste / Archive / FilmDetail 展示
      → 页面标注 provenance：DeepWorks · model · run_id · skills · KB
```

### 4.4 安全设计

| 风险 | 设计 |
|---|---|
| 密钥泄露 | `DEEPSEEK_API_KEY` 只允许在 `server/.env` 或平台环境；**绝不**加 `VITE_` 前缀；前端 bundle 不含密钥 |
| 笔记外传 | 方案 A 不经过网络；方案 B 只走 `127.0.0.1`；默认不上传全库，只传当前笔记 + 最多 8 条历史摘要（已有 `buildAnalysisHistory`） |
| 本地桥被滥用 | 仅绑定 `127.0.0.1`；随机端口 + 每次启动 token；CORS 白名单；请求体上限；路径白名单；不记录笔记正文 |
| Agent 输出被篡改 | 网站校验 `note_sha256`、`run_id` 唯一性、`quote` 逐字、`profile_delta` 完整性；失败不写入 |
| 重放 | `run_id` + `record_id` + `note_sha256` 三元组去重；同一 run 不可重复导入 |
| 数据覆盖 | 导入前自动备份当前 `AppState` 到 `fbf.backup.<timestamp>`；冲突时逐条确认 |
| 隐私文案 | 明确写出“本次笔记将交给 DeepWorks Agent 分析；是否发送历史摘要可关闭” |

### 4.5 JSON Schema 与错误处理

**新增契约文件（建议）：**

- `contracts/agent-run.v2.schema.json`：JSON Schema Draft 2020-12，描述 P2 最终输出。
- `contracts/pending-note.v1.schema.json`：描述网站导出的输入。
- `src/lib/agent/contract.ts`：手写校验器（项目未引入 zod/ajv，避免新增依赖）。
- `workflow/validate-run.mjs`：继续作为 DeepWorks 侧硬门；新增 `--schema-version 2` 时强制 v2 字段。

**错误码（前端）：**

| 错误码 | 含义 | 处理 |
|---|---|---|
| `AGENT_RESULT_MISSING` | 找不到 `latest.json` | 提示“还没有 DeepWorks 运行结果”，不回退到 Worker |
| `AGENT_RESULT_INVALID` | 结构校验失败 | 拒绝导入，显示前 2 条错误 |
| `NOTE_HASH_MISMATCH` | 结果对应的笔记与当前记录不一致 | 拒绝导入，提示重新运行 |
| `RUN_ID_DUPLICATE` | 同一 run 已导入 | 拒绝重复写入 |
| `RECORD_MISMATCH` | `record_id` / `film_id` 不匹配 | 拒绝导入 |
| `PROFILE_INCOMPLETE` | 六维缺失或 v2 字段不完整 | 拒绝导入 |
| `UNSUPPORTED_SCHEMA_VERSION` | 版本不支持 | 拒绝导入，提示升级 |

**原则：校验失败绝不写入，绝不把不完整结果标成“已分析”。**

---

## 5. D. 比赛合规风险清单

> 依据：赛制要求“知识库接入、技能与工作流编排、Agent 运行必须在 DeepWorks 平台内实现”；禁止“以外部框架或自建后端为主体、仅做界面包装的壳工程”；决赛现场须在 DeepWorks 环境内实时演示。以下为项目当前事实与风险的对应关系。

| # | 风险 | 等级 | 当前事实 | 后果 | 处置 |
|---|---|---|---|---|---|
| R1 | 作品主体仍在外部 Worker | **致命** | 前端唯一分析入口是 `/v1/analyze`；提示词、模型调用、校验都在 `server/` | 落在“主体功能未在 DeepWorks 内实现”的否决项射程 | P2 把 Agent 设为唯一主分析源；Worker 降级为显式备用 |
| R2 | 网站与 Agent 无数据交互 | **致命** | 两条链路无交点；网站不读 Agent JSON | 现场无法演示“网站→DeepWorks”闭环 | 建立 `latest.json` 契约 + 导入入口 + provenance |
| R3 | 实时性不足 | **高** | 方案 A 是“运行后导入”，不是提交即分析 | 评委可能质疑“这是预置结果吗” | 演示脚本明确展示 run_id / timestamp / 事件流；准备 3 条现场新笔记 |
| R4 | Skill 表述风险 | **高** | P0 用 `skill` 工具；本次审查会话没有该工具 | 材料若笼统写“Skill 调用成功”，与本次事实冲突 | 材料按运行分别写：P0 `via: skill`；审查 `via: read`；不混写 |
| R5 | 知识库不是平台知识中心 | **高** | 12 条文件型条目 + 关键词检索 | 可能被认定为“未接入平台知识库” | 本人授权后创建平台知识库；在此之前材料只写“项目知识库” |
| R6 | 工作流不是可视化画布 | **中高** | Agent 指令 + Skill + 脚本质量门 | 若赛制硬性要求画布，可能不满足 | 向组委会确认；若要求，在平台内补建同名流程 |
| R7 | 公开仓库 / 公开站点 | **高** | GitHub 公开、Pages 公开 | 违反“决赛前不对外公开” | 提交前转私有或停止公开传播；准备评委受控访问方式 |
| R8 | 交付材料缺口 | **高** | 项目说明、三件套、视频、测试记录、团队说明缺失 | 初评失分；补正只有一次、24 小时 | 按第 9 节清单补齐 |
| R9 | 真实用户测试为 0 | **中高** | 无测试记录；seed 是英文虚构示例 | 实用性 30 分中“样例/反馈”与迭代记录失分 | 3–5 人测试，记录完成率、卡点、原话、修复前后 |
| R10 | 隐私与数据流说明不足 | **中** | 笔记会发往 Worker/DeepSeek；前端有 consent，但无项目级说明 | 材料合规风险 | 增加“数据流与授权”一节；测试记录匿名化 |
| R11 | AI 生成影像留在公开仓库 | **中高** | `outputs/imagegen/*.jpg` 是按片名命名的 AI 生成“剧照风格图”；**未被网站引用**（`public/images/artwork` 与 AI 图哈希不同；`src/data/filmArtwork.ts` 代码声明为 TMDB/Letterboxd 官方发行海报，未逐张核验授权链） | 与“不使用 AI 生成海报/剧照”的红线冲突，易被误认 | 不删除历史产物；移出公开分发范围（`_archive/` 或 `.gitignore`），并在 README 标注“历史实验，不参与运行” |
| R12 | 文档 / 部署漂移 | **中** | `competition-review-2026-11-05.md` 仍称“AI 全在本地”；`dist` 与线上 bundle 可能不同 | 评委无法判断事实 | 归档过期文档；README 顶部写“当前实现状态”；部署前重建 `dist` |
| R13 | 外部后端双份 | **中** | Cloudflare Worker + 阿里云 FC 共用 `server/app.ts` | 维护面扩大，合规叙事更复杂 | P2 明确只保留一个“legacy fallback”，另一个停止部署 |
| R14 | 现场单点依赖 | **中** | 模型额度、网络、Worker 冷启动 | 演示中断 | 预跑 JSON + 录屏 + 本地静态站兜底；明确标注“预跑结果” |

---

## 6. P2 目标架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                          Browser (React)                          │
│                                                                  │
│  AddFilmFlow / FilmDetail                                        │
│    ├─ 写笔记 → localStorage (fbf.state.v1)                        │
│    ├─ “交给 DeepWorks 分析” → 导出 pending-note.v1.json           │
│    └─ “导入 DeepWorks 结果” → 校验 → 写入 → 展示 provenance       │
│                                                                  │
│  Taste / Archive / Home                                          │
│    └─ 读 AIFilmAnalysis v2 + profile_delta                       │
└───────────────┬──────────────────────────────────────────────────┘
                │ 文件交接（方案 A，主路径）
                │ 或 127.0.0.1 本地桥（方案 B，可选）
                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     DeepWorks（智能主体）                          │
│                                                                  │
│  film-curator (primary, dth/DeepSeek-V4.1-Flash)                 │
│    ├─ cinema-knowledge-retrieval → knowledge/entries.json        │
│    ├─ film-note-analysis → validate-evidence.mjs                 │
│    ├─ cinema-taste-profiling → profile.mjs                       │
│    ├─ hash-note.mjs / validate-citations.mjs                     │
│    └─ validate-run.mjs（最终硬门）                                │
│                                                                  │
│  输出：                                                           │
│    outputs/p2/runs/<run_id>.json        （完整审计记录）           │
│    public/agent/latest.json             （网站投影）               │
└───────────────┬──────────────────────────────────────────────────┘
                │ 只读投影
                ▼
┌──────────────────────────────────────────────────────────────────┐
│              Legacy（显式备用，不得默认启用）                       │
│  Cloudflare Worker / 阿里云 FC → /v1/analyze                     │
│  UI 必须标注：“在线备用分析，不是 DeepWorks 运行”                  │
└──────────────────────────────────────────────────────────────────┘
```

**架构原则：**

1. **DeepWorks 是唯一默认分析源**；Worker 只能由用户显式选择。
2. **网站不做推理**；只做输入导出、结果校验、展示、存储。
3. **每次分析都有 `run_id`、`timestamp`、`model`、`skills_used`、`kb_citations`**。
4. **契约先行**：先固定 JSON Schema，再改 UI。
5. **失败不降级成假结果**：没有 Agent 结果就显示“还没有运行”，不回退到本地规则或预置分析。

---

## 7. 逐项实施清单与验收标准

> 原则：先契约、后适配、再 UI；每一步都能单独回滚；每一步都有可执行验收。

### P2-01 冻结并版本化 Agent 输出契约

| 项 | 内容 |
|---|---|
| 目标 | 让网站与 Agent 对同一份 JSON 达成一致 |
| 改动 | 新增 `contracts/agent-run.v2.schema.json`、`contracts/pending-note.v1.schema.json`；在 `docs/workflow.md` 增加契约章节 |
| 不改 | 现有 `validate-run.mjs` 的 v1 逻辑 |
| 验收 | 用 `outputs/p0/runs/fbf-p0-20261109-01.json` 与 `outputs/p1/_work/schema-v2-example.json` 分别通过/失败符合预期；Schema 能被至少一个标准校验器解析 |
| 风险 | 过度设计；先只覆盖 P2 必需字段 |

### P2-02 新增网站侧契约适配层

| 项 | 内容 |
|---|---|
| 目标 | 把 Agent JSON 映射为网站可持久化的 `AIFilmAnalysis v2` |
| 改动 | 新增 `src/lib/agent/contract.ts`（校验）、`src/lib/agent/mapRun.ts`（映射）；扩展 `src/types.ts` 的 `AIFilmAnalysis` 为 `schemaVersion: 1 \| 2`，新增 `provenance`、`profileDelta?` |
| 映射规则 | `interpretation → evidence`；`ambivalent → neutral`（保留原值到 `rawDirection`）；`platform/model/timestamp → provenance`；`record_id` 由导入时绑定 |
| 验收 | 单元测试：合法 run 通过；`quote` 被篡改 → 失败；`direction: ambivalent` → 映射为 `neutral` 且保留原值；缺六维 → 失败 |
| 风险 | 不要静默改写 Agent 结论；所有转换都要可追溯 |

### P2-03 新增“导入 DeepWorks 结果”入口

| 项 | 内容 |
|---|---|
| 目标 | 用户可以把 `latest.json` 或 run 文件导入网站 |
| 改动 | `src/lib/agent/importRun.ts`；`FilmDetail` 增加按钮与预览弹层；`Archive` 增加空状态入口 |
| 交互 | 选择文件 / 读取 `/agent/latest.json` → 预览 run_id、时间、模型、证据数、KB → 用户确认 → 写入 |
| 验收 | 导入 P0 run-01 成功；页面显示 5 条证据与 3 条 KB；重复导入被拒绝；校验失败不写入 |
| 风险 | 不要让导入覆盖已接受的分析；冲突必须确认 |

### P2-04 增加 provenance 展示

| 项 | 内容 |
|---|---|
| 目标 | 每个结论都能看出“谁、何时、用什么模型、调了哪些 Skill、引了哪条 KB” |
| 改动 | `FilmAnalysisPanel`、`Taste`、`Archive` 的卡片/详情增加 `DeepWorksRunBadge` |
| 展示 | `DeepWorks · dth/DeepSeek-V4.1-Flash · run_id · 2026-11-09 11:11 · 3 Skills · KB-004/003/009` |
| 验收 | 截图可见；无 provenance 的旧分析显示“早期在线分析”，不冒充 DeepWorks |
| 风险 | 不要让 badge 变成装饰；必须来自真实字段 |

### P2-05 消费 Schema v2 的 `profile_delta`

| 项 | 内容 |
|---|---|
| 目标 | 网站展示 Agent 计算的画像增量，而不是只靠浏览器重算 |
| 改动 | `src/lib/ai/tasteProfile.ts` 增加 `applyProfileDelta()`；`Taste` 展示“本次运行带来的变化” |
| 规则 | `score` 0–100 → 0–1；`unobserved` 不画 50 分；`provisional` 明确标注；浏览器全量画像仍保留作为跨记录聚合 |
| 验收 | 导入 run-01 后，Taste 显示 4 个 observed 维度与 2 个 unobserved；不把 unobserved 画成中性偏好 |
| 风险 | 两套画像口径不一致；必须在 UI 写清“本次运行增量 vs 跨记录聚合” |

### P2-06 provisional 状态展示

| 项 | 内容 |
|---|---|
| 目标 | 样本不足时明确说“这只是临时画像” |
| 改动 | `DimensionCard`、`TasteRadar`、`Taste` 文案；新增 `ProvisionalNotice` |
| 规则 | `provisional=true` 或 `independent_note_count < 3` → 显示“临时画像（独立笔记 N 条 / 证据 M 条）” |
| 验收 | 导入 1 条笔记的 run，页面明确显示临时状态；导入 3 条独立笔记后，状态变为“成形中/稳定” |
| 风险 | 不要用“置信度低”代替“样本不足”；两者是不同概念 |

### P2-07 用户纠错回传

| 项 | 内容 |
|---|---|
| 目标 | 用户拒绝/移除的证据，下一次 Agent 运行真的会排除 |
| 改动 | 新增 `src/lib/agent/exportCorrections.ts`；导出 `corrections.json`（recordId、维度、quote、status、时间）；Agent 运行时 `profile.mjs --prior --corrections` |
| 验收 | 用户移除一条证据 → 导出 corrections → 重跑 → `corrections_applied` 含该条 → 画像变化可定位 |
| 风险 | 纠错不能只影响展示；必须进入下一次计算 |

### P2-08 数据备份与恢复

| 项 | 内容 |
|---|---|
| 目标 | 用户可完整导出/导入 `AppState`，导入前自动备份 |
| 改动 | 新增 `src/lib/backup.ts`；`Reflection` 或设置区增加“导出全部数据 / 恢复备份” |
| 规则 | 导出 JSON 含 `version`、`exportedAt`、`state`；导入先校验、再预览、再确认；自动备份保留 3 份 |
| 验收 | 导出 → 清空 → 导入 → 记录/笔记/分析/画像历史完整恢复；损坏文件被拒绝 |
| 风险 | 不要覆盖现有用户数据；必须先备份 |

### P2-09  Worker 降级为显式备用

| 项 | 内容 |
|---|---|
| 目标 | 默认链路不再依赖外部后端 |
| 改动 | `isAiConfigured()` 改为“仅显式开启”；`AddFilmFlow` / `FilmAnalysisPanel` 默认走“导出给 DeepWorks”；新增“使用在线备用分析”开关与提示 |
| 保留 | `/health`；`server/` 代码与测试；`cloudfn` 不删除 |
| 验收 | 默认路径下，关闭 Worker 仍可完成“写笔记 → 导出 → 导入”；只有用户明确选择时才请求 `/v1/analyze` |
| 风险 | 不要让备用路径看起来像主路径；UI 必须标注来源 |

### P2-10 错误处理与空状态

| 项 | 内容 |
|---|---|
| 目标 | 失败时说清“为什么没保存”，不误导 |
| 改动 | `src/lib/agent/errors.ts`；`FilmDetail` / `Taste` 空状态 |
| 验收 | 7 个错误码各有对应文案；校验失败不写入；旧分析保留 |
| 风险 | 不要用“网络错误”掩盖契约错误 |

### P2-11 真实运行记录与演示脚本

| 项 | 内容 |
|---|---|
| 目标 | 证明“网站展示的确实是 DeepWorks 本次运行” |
| 改动 | 新增 `outputs/p2/runs/<run_id>.json` + `.events.jsonl` + `.validation.json`；`docs/demo-script.md` |
| 验收 | 3 条新笔记（不同影片、不同长度）各跑一次；页面导入后显示对应 run_id；断网仍可展示最近一次结果 |
| 风险 | 不得用 P0 的旧结果冒充 P2 新运行 |

### P2-12 合规与交付材料补齐

| 项 | 内容 |
|---|---|
| 目标 | 把“能跑”变成“能提交” |
| 改动 | `docs/project-brief.md`（2–4 页）、`docs/background-triptych.md`（三件套）、`docs/user-testing.md`、`docs/iteration-log.md`、`docs/team.md`、`docs/third-party.md`、`docs/data-flow-privacy.md`、`docs/demo-video-script.md` |
| 验收 | 按第 9 节清单逐项勾选；每份文档有日期、事实来源、未验证项 |
| 风险 | 不要把设计写成已实现；不要编造测试数据 |

### P2-13 清理 AI 生成影像的公开暴露

| 项 | 内容 |
|---|---|
| 目标 | 消除“使用 AI 生成海报/剧照”的误判 |
| 改动 | 把 `outputs/imagegen/*.jpg|meta.json` 移入 `_archive/imagegen/`（不删除）或加入 `.gitignore`；README 标注“历史实验，不参与运行”；确认 `public/images/artwork` 来源为官方发行海报 |
| 验收 | 网站构建产物不含 `outputs/imagegen`；README 说明清楚；`public/images/artwork` 的 `sourceUrl`/`credit` 可核对 |
| 风险 | 保护历史产物的要求与公开合规冲突；用“移出公开分发”而不是“删除”解决 |

### P2-14 文档口径统一

| 项 | 内容 |
|---|---|
| 目标 | 评委看到的每份文档说的是同一件事 |
| 改动 | 归档 `competition-review-2026-11-05.md`；`README.md` 顶部写“当前实现状态（2026-11-09）”；统一 `deepseek-chat` / `deepseek-flash` 口径 |
| 验收 | 全文搜索“全部 AI 在本地”只剩历史归档；README 的状态表与 P0/P1 报告一致 |
| 风险 | 不要删除历史文档；移到 `_archive/` 并标注 |

---

## 8. 需要本人操作或授权的事项

| # | 事项 | 为什么必须你本人做 | 你需要提供 / 确认 |
|---|---|---|---|
| 1 | 比赛账号权限 | 我无法登录你的账号 | 模型额度、知识库数量/大小、Skill 脚本执行权限、是否允许外部 HTTP |
| 2 | 平台知识中心 | 涉及账号与语料授权 | 创建 `Frame by Frame 电影审美`，上传 12 条，记录知识库 ID / 条目数 / 索引时间 |
| 3 | 是否允许浏览器调用本地 sidecar | 涉及安全策略与比赛合规 | 确认 `opencode serve` 是否可用于演示；若不允许，只用方案 A |
| 4 | 现场演示形态 | 只有你能确认场地 | 是否有网、是否本机、投影分辨率、是否允许本地进程 |
| 5 | 公开策略 | 涉及账号与合规责任 | 仓库转私有 / 停止公开传播 / 评委受控访问方式 |
| 6 | 真实测试用户 | 需要真人参与与授权 | 3–5 位同学 + 时间（建议 11/17–11/18） |
| 7 | 演示视频 | 需要本人操作与出镜授权 | 是否出镜；我提供分镜、旁白、录制清单 |
| 8 | 组委会书面确认 | 涉及规则解释 | 工作流是否必须可视化；知识库是否必须平台侧；外部模型是否允许作为备用 |
| 9 | 部署决策 | 涉及线上环境 | P2 完成后是否重新部署；部署前先重建 `dist` |
| 10 | AI 生成影像处置 | 涉及历史产物与公开范围 | 同意“移入 `_archive/` 并停止公开分发”，不删除 |

---

## 9. 比赛交付物缺口与补全清单

> 这一节回答“按照比赛要求，还缺什么”。状态口径：**已有 / 部分 / 缺失**。

### 9.1 交付物总表

| # | 交付物 | 当前状态 | 现有文件 | 还缺什么 |
|---|---|---|---|---|
| 1 | 可运行的 DeepWorks 作品 | **部分** | `film-curator` + 3 Skills + 12 KB + 七步工作流 + P0 运行 | 网站与 Agent 的交接闭环（P2-01～P2-11） |
| 2 | 2–4 页项目说明 | **缺失** | 只有审查报告与架构文档 | 面向评委的 2–4 页；第 2 页固定三件套 |
| 3 | 项目背景三件套 | **缺失** | `docs/agent-skill-spec.md` 是设计，不是三件套 | 竞品四维表（≥2 个）+ 可行性四项 + 创新性一句话/3 差异/1 验证/边界 |
| 4 | ≤3 分钟演示视频 | **缺失** | 无视频文件 | 分镜、旁白、录屏、字幕 |
| 5 | 代码说明 | **部分** | `README.md`、`docs/frontend-architecture.md`、`docs/ai-core.md` | DeepWorks 侧启动方式、Agent/Skill/KB/Workflow 的文件索引 |
| 6 | Skills 说明 | **部分** | `docs/skills.md` | 面向评委的“输入→输出→质量门→调用证据”；区分 `skill` 与 `read` |
| 7 | 知识库说明 | **部分** | `docs/knowledge-base.md` | 平台知识中心状态；语料来源/授权；检索局限 |
| 8 | 工作流说明 | **部分** | `docs/workflow.md` | 契约版本、错误处理、与网站的交接；是否画布的官方答复 |
| 9 | 真实用户测试记录 | **缺失** | 无 | 3–5 人、任务脚本、完成率、卡点、原话、修复前后 |
| 10 | 迭代记录 | **部分** | `outputs/p0/P0-REPORT.md`、`outputs/p1/P1.1.1-IMPLEMENTATION-REPORT.md`、git log | 日期化迭代日志；把 P0/P1 串成“问题→修改→验证” |
| 11 | 团队说明 | **缺失** | 无 | 成员、分工、赛前基础、使用的其他 AI 工具及用途 |
| 12 | 第三方依赖 / 素材来源 | **部分** | `package.json`、`docs/knowledge-base.md` | TMDB / Letterboxd / DeepSeek / DeepWorks / 字体 / 图片的完整清单与授权 |
| 13 | 运行方式与访问入口 | **部分** | README、`docs/deploy-cloud-function.md` | DeepWorks 内启动步骤、Agent 选择、演示步骤、离线兜底 |
| 14 | 数据流与隐私说明 | **缺失** | 前端 consent 文案 | 笔记去哪、存多久、谁能看、如何删除、第三方处理 |
| 15 | 作品非公开证明 | **缺失** | 当前公开 | 私有仓库/受控访问方案 |
| 16 | 演示兜底包 | **缺失** | P0 三份 JSON | P2 预跑 JSON + 录屏 + 本地静态站 + 明确标注 |

### 9.2 第 2 页“项目背景三件套”必须写什么

按赛制版式，缺一不可：

1. **竞品分析**：≥2 个竞品（豆瓣、Letterboxd，可加 Notion/纸质手账），四维对比表（记录深度、审美解释、证据可追溯、纠错回流），一句差异结论。
2. **可行性**：技术、数据、时间、成本各一句结论 + 依据；只写已实测能力，未验证项明确标注。
3. **创新性**：≤30 字一句话 + 3 条差异 + 1 条验证方式 + 明确边界。

> 建议的创新性一句话（可直接用，但需你确认）：
> **“每条审美结论都能回到你的原话，并且你纠正一次，画像就真的改一次。”**

### 9.3 建议的补全顺序（按“资格风险 → 分数”排序）

1. **P2-01～P2-06**：先让网站真的展示 DeepWorks 结果（资格线）。
2. **P2-09、P2-11**：把 Worker 降级、留下 P2 新运行记录（使用证明）。
3. **P2-12 的三件套 + 项目说明**：项目背景 30 分。
4. **真实用户测试**：实用性 30 分中的样例/反馈。
5. **视频 + 团队说明 + 第三方清单**：成品 30 分与材料完整性。
6. **P2-13、P2-14**：合规与口径，提交前最后一遍。

---

## 10. 推荐的下一步最小实施任务

> 只做一件，做完再评审。不要同时改前端主链路、Worker、知识库和文档。

### 任务：P2-MVP-1「Agent 结果契约 + 只读导入」

**目标：** 在不改变现有分析主链路的前提下，让网站能够导入一份真实的 `film-curator` 运行结果，并在详情页显示证据与 provenance。

**范围（只碰这 6 个文件）：**

| 文件 | 动作 |
|---|---|
| `contracts/agent-run.v2.schema.json` | 新增：P2 输出契约 |
| `src/lib/agent/contract.ts` | 新增：手写校验器（不引新依赖） |
| `src/lib/agent/mapRun.ts` | 新增：Agent JSON → `AIFilmAnalysis v2` 映射 |
| `src/types.ts` | 小改：`schemaVersion: 1 \| 2`，新增 `provenance?`、`profileDelta?` |
| `src/components/film/FilmAnalysisPanel.tsx` | 小改：增加“导入 DeepWorks 结果”按钮与预览 |
| `src/lib/agent/mapRun.test.ts` | 新增：3 个单测（合法、篡改 quote、缺维度） |

**明确不做：**

- 不改 `AddFilmFlow` 的默认分析路径。
- 不删 Worker、不改 `server/`。
- 不改画像算法。
- 不做自动文件监听。
- 不部署。

**验收标准：**

1. 用 `outputs/p0/runs/fbf-p0-20261109-01.json` 导入成功，详情页显示：
   - 5 条证据、每条带逐字 quote；
   - 3 条 KB 引用；
   - `DeepWorks · dth/DeepSeek-V4.1-Flash · run_id · 2026-11-09T03:11:35.099Z`。
2. 把任意一条 `quote` 改一个字后再导入 → **失败**，页面显示“引文与笔记不一致”，localStorage 不变。
3. 把 `profile_delta.dimensions.emotion` 删掉 → **失败**，提示“六维不完整”。
4. 重复导入同一 `run_id` → **失败**，提示“这次运行已经导入过”。
5. `npm.cmd run test` 仍为 **59 passed**（新增 3 个测试后为 62 passed），`npm.cmd run typecheck` 通过。
6. 页面明确标注“这是导入的 DeepWorks 运行结果，不是在线实时分析”。

**为什么先做这个：**

- 它是“网站→DeepWorks”闭环的最小可见证据，直接降低 R1/R2。
- 它不触碰现有主链路，回滚成本低。
- 它把最难的部分（契约与字段映射）先解决，后续 UI/画像/纠错都建立在这上面。

---

## 11. 附录

### 11.1 关键证据索引

| 事实 | 文件 / 位置 |
|---|---|
| 路由 | `src/App.tsx` L48-L55 |
| 新增电影五步 + 分析 | `src/components/add/AddFilmFlow.tsx` L396-L461 |
| 前端请求 `/v1/analyze` | `src/lib/ai/client.ts` L92 |
| 前端校验 | `src/lib/ai/validate.ts` L110-L134 |
| Agent JSON → 网站分析 | `src/lib/ai/adapter.ts` L16-L51 |
| localStorage 读写 | `src/lib/storage.ts` L245-L283 |
| 画像计算 | `src/lib/ai/tasteProfile.ts` L259-L315 |
| 网站 v1 类型 | `src/types.ts` L258-L282 |
| Worker 入口 | `server/app.ts` L99-L113、L149-L196 |
| Cloudflare 配置 | `wrangler.toml` L1-L13 |
| 阿里云函数配置 | `s.yaml` L1-L35 |
| Agent 定义 | `.opencode/agents/film-curator.md` L37-L163 |
| CLI 运行器 | `workflow/run-p0.mjs` L35-L87 |
| 最终质量门 | `workflow/validate-run.mjs` L166-L234 |
| Schema v2 示例 | `outputs/p1/_work/schema-v2-example.json` |
| P0 三次运行 | `outputs/p0/P0-REPORT.md`、`outputs/p0/runs/*.json` |
| P1.1.1 修复 | `outputs/p1/P1.1.1-IMPLEMENTATION-REPORT.md` |
| 知识库 | `knowledge/entries.json`、`knowledge/index.json`、`knowledge/SOURCES.md` |
| 官方海报来源声明 | `src/data/filmArtwork.ts` L4-L25 |
| AI 生成影像（未引用） | `outputs/imagegen/*.jpg`、`*.meta.json` |

### 11.2 复核命令

```powershell
# 1) 类型与测试
& npm.cmd run typecheck
& npm.cmd run test

# 2) Git 状态（只读）
git status --porcelain=v1
git branch --show-current
git log --oneline -10

# 3) DeepWorks 引擎能力（只读 help）
$exe = "$env:LOCALAPPDATA\Programs\DeepWorks\resources\sidecars\opencode-x86_64-pc-windows-msvc.exe"
& $exe run --help
& $exe serve --help

# 4) 现有 Agent 结果复核
node workflow/validate-run.mjs --run outputs/p0/runs/fbf-p0-20261109-01.json --input outputs/p0/inputs/run-01.json

# 5) 知识库检索复核
node .opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs --input outputs/p0/inputs/run-01.json --top 4
```

### 11.3 审查限制（必须随报告一起读）

1. **未验证平台知识中心**：没有访问、没有创建、没有检索；所有“平台知识库”相关表述均为待办。
2. **未验证网页→Agent 实时 API**：`opencode serve` 命令存在，但未启动、未请求、未验证路由与鉴权；不能据此写“已支持”。
3. **未验证比赛账号权限**：额度、Skill 脚本执行、知识库上传、外部 HTTP 均未知。
4. **未验证现场网络与设备**：演示稳定性无法保证。
5. **未运行新的 `film-curator` 会话**：本次审查会话不是 `film-curator`，也没有原生 `skill` 工具。
6. **未做真实用户测试**：所有“用户会怎么用”的判断都是设计推断，不是观察结果。
7. **工作区不干净**：存在并行修改与历史未提交项；本报告只对“当前文件内容”负责，不对未提交改动的归属做判断。
8. **未做版权尽调**：只核对了 `public/images/artwork` 的来源声明与哈希差异，未逐张验证授权链。

---

## 12. 一句话收尾

**P0/P1 已经证明“DeepWorks 内能产出可信的分析”；P2 要证明的是“网站展示的正是这次 DeepWorks 运行”。在这件事完成之前，项目仍然是一个“有 DeepWorks 组件的网站”，而不是“在 DeepWorks 内运行的作品”。**
