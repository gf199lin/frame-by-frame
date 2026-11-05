# Frame by Frame · 前端架构与接入说明

> 配套文档：`README.md`（运行与验收）、`agent-skill-spec.md`（下一阶段智能层契约）。
> 本文只描述**当前前端实现**与**下一阶段后端 / DeepWorks 接入点**，不把未完成的接口写成已实现。

---

## 1. 当前架构

```
Browser
├─ React Router (5 pages + film detail + 404)
├─ AppStore (Context + reducer)
│  ├─ state: records / feedback / corrections / customFilms / yearbookGenerations
│  ├─ persistence: localStorage  fbf.state.v1
│  └─ derived: taste snapshot / timeline / memory graph
├─ AddFilmFlow (global modal)
│  ├─ catalog search (src/data/films.ts)
│  ├─ manual film entry
│  ├─ local analyst (src/lib/analyst.ts)
│  └─ stage animation (UI timers, deterministic result already computed)
└─ Rendering
   ├─ generated SVG posters (no external image host)
   ├─ hand-built radar / timeline / yearbook
   └─ concentric memory graph (custom SVG, pan/zoom/drag)
```

没有后端调用、没有 API Key、没有模型 SDK。

### 关键文件

| 文件 | 职责 |
|---|---|
| `src/types.ts` | 领域模型、分析契约、聚合读模型 |
| `src/data/films.ts` | 16 部电影的元数据、审美签名、主题 / 情绪权重 |
| `src/data/seed.ts` | 10 条示例观影记录（虚构演示数据） |
| `src/data/taxonomy.ts` | 6 个审美维度、18 个主题、12 种情绪、状态、分析阶段 |
| `src/lib/tasteEngine.ts` | 确定性审美计算、置信度、证据、时间线、统计 |
| `src/lib/analyst.ts` | 主题 / 情绪关键词提取、关联影片、变化 findings |
| `src/lib/graph.ts` | 由记录派生图谱节点与边（含共享主题的 film–film 边） |
| `src/lib/storage.ts` | localStorage 读写、版本校验、跨标签页监听 |
| `src/store/AppStore.tsx` | 全局状态、派生数据、写操作 |
| `src/components/add/AddFilmFlow.tsx` | 五步交互、手动录入、分析动画、结果页 |
| `src/components/map/MemoryGraphView.tsx` | 环形星座布局、pan / zoom / drag / selection |
| `src/components/film/FilmPoster.tsx` | 生成式海报、`posterUrl` 加载失败回退 |
| `src/pages/Reflection.tsx` | 年度统计、漂移对比、年鉴生成 / HTML 下载 / 打印 |

---

## 2. 数据契约

### Film

```ts
type Film = {
  id: string
  title: string
  titleZh: string
  year: number
  director: string
  runtime: number
  genres: string[]
  country: string
  language: string
  tagline: string
  logline: string
  cast: string[]
  motif: PosterMotif          // 生成海报母题
  palette: FilmPalette        // base/deep/accent/soft/paper
  posterUrl?: string          // 预留真实海报
  signature: Record<DimensionKey, number>  // 0 = low pole, 1 = high pole
  themes: Partial<Record<ThemeId, number>>
  moods: Partial<Record<MoodId, number>>
  narrativeTags: string[]
  characterTags: string[]
  catalogOnly?: boolean
}
```

六个 `DimensionKey`：`narrative` / `emotion` / `thematic` / `visual` / `character` / `ending`。

### WatchRecord

```ts
type WatchRecord = {
  id: string
  filmId: string
  rating: number              // 0.5 – 5
  watchedAt: string           // YYYY-MM-DD
  status: 'watched' | 'rewatched' | 'abandoned'
  reflection: string
  feltLike?: string
  themes: ThemeId[]
  moods: MoodId[]
  createdAt: string
  updatedAt: string
  source: 'seed' | 'user'
  ai: {
    summary: string
    extractedFrom: 'seed' | 'local-engine' | 'backend'
    confidence: number
  }
}
```

`themes` / `moods` 在写入时由本地规则生成，是后续"每条结论可指回证据"的基础。

### AppState

```ts
type AppState = {
  version: 1
  records: WatchRecord[]
  feedback: Partial<Record<DimensionKey, {
    verdict: 'agree' | 'not-quite' | 'corrected'
    correction?: string
    updatedAt: string
  }>>
  timelineFeedback: Record<string, TimelineVerdict>
  customFilms: Film[]
  corrections: Array<{ id: string; scope: string; text: string; createdAt: string }>
  yearbookGenerations: string[]
}
```

### AnalysisResult（前后端最重要的边界）

```ts
type AnalysisResult = {
  themes: ThemeId[]
  moods: MoodId[]
  connections: FilmConnection[]     // 关联影片 + 理由 + 共享标签
  findings: TasteFinding[]          // 维度 before/after + 置信度
  summary: string
  beforeScores: Record<DimensionKey, number>
  afterScores: Record<DimensionKey, number>
  confidenceBefore: number
  confidenceAfter: number
}
```

未来 FastAPI 的 `POST /records` 响应应直接返回该结构（或返回 job 后由 job 结果给出），前端结果页即可无需改动。

---

## 3. 审美引擎（当前实现）

位于 `src/lib/tasteEngine.ts`：

1. **记录权重**：`(0.35 + rating/5 × 0.9) × (0.65 + min(noteLength/520,1) × 0.55)`
   —— 高评分、长笔记权重更高。
2. **维度值**：所有记录在维度轴上的加权平均；主题偏好先按主题的内向 / 外向映射，再加权平均。
3. **置信度**：`sampleSize × noteDepth × consistency`，上限 0.94；记录少或彼此矛盾时显著降低。
4. **证据**：按"权重 × 偏离中性程度"选前 3 部作品，再用维度关键词从笔记中挑句子。
5. **时间线**：用前 N 条记录重新计算快照；N 取 `[1,3,5,8,10,13,16,20,25,30]`，并始终加入当前总数，因此每次新增都会出现一个新阶段。
6. **图谱**：电影→主题、电影→情绪；两部电影共享 ≥2 个主题时生成 film–film 边，最多保留每部电影最强的 3 条关联。

**重要**：这些是产品层的启发式估计，不是心理测量或模型判断。UI 与文档都如此标注。

---

## 4. 后端接入建议（FastAPI + PostgreSQL）

### 4.1 API 草案

```
GET    /api/v1/films?q=                 搜索片目（含未归档片目）
GET    /api/v1/films/{id}
POST   /api/v1/films                    手工录入片目
GET    /api/v1/records                  当前用户档案
POST   /api/v1/records                  创建记录 → { record, analysis_job_id }
PATCH  /api/v1/records/{id}             编辑记录 → 重新分析
DELETE /api/v1/records/{id}
GET    /api/v1/analysis/{job_id}        查询状态 / 结果
GET    /api/v1/analysis/{job_id}/stream SSE：五个阶段 + 最终结果
GET    /api/v1/taste                    当前六维快照 + 证据 + 置信度
POST   /api/v1/taste/feedback           维度 / 时间线反馈
GET    /api/v1/graph                    图谱节点与边（支持 theme/mood 过滤）
GET    /api/v1/reflection?year=2026     月度 / 年度聚合 + 漂移
POST   /api/v1/yearbooks                生成年鉴（返回 HTML / PDF 任务）
```

分析是异步的：前端保留现有五阶段 UI，只是把 `setTimeout` 换成 SSE 事件。

### 4.2 表结构建议

| 表 | 关键字段 |
|---|---|
| `users` | id, email, created_at（第二阶段） |
| `films` | id, title, title_zh, year, director, runtime, genres, signature JSONB, palette JSONB, poster_url |
| `watch_records` | id, user_id, film_id, rating, watched_at, status, reflection, felt_like, ai_summary, ai_confidence, source, created_at, updated_at |
| `record_themes` | record_id, theme_id, weight（或 `themes JSONB`） |
| `record_moods` | record_id, mood_id |
| `taste_snapshots` | id, user_id, film_count, scores JSONB, confidence, engine_version, created_at |
| `taste_evidence` | id, snapshot_id, dimension, record_id, sentence, weight |
| `feedback` | id, user_id, scope, target_id, verdict, correction, created_at |
| `yearbooks` | id, user_id, year, payload JSONB, generated_at |

`engine_version` 必须落库，保证半年后还能解释"当时为什么得出这个结论"。

### 4.3 迁移顺序

1. **只读接入**：把 `films` 与种子记录导入 Postgres；前端 `src/data/films.ts` / `seed.ts` 换成 API + 本地缓存。
2. **写入接入**：`POST /records` + 异步分析；`AppStore` 的 reducer 保留，只替换数据源。
3. **认证**：匿名 localStorage 数据在登录后合并到账户；localStorage 继续作为离线缓存。
4. **DeepWorks Agent**：替换 `analyseDraft` 的规则抽取，但保留确定性打分。
5. **推荐 / 社交**：在画像与主题向量稳定后再做。

前端建议新增 `src/lib/repository.ts`：

```ts
export interface CinemaRepository {
  listRecords(): Promise<WatchRecord[]>
  createRecord(input: AddFilmDraft): Promise<{ record: WatchRecord; analysis: AnalysisResult }>
  updateRecord(id: string, input: AddFilmDraft): Promise<{ record: WatchRecord; analysis: AnalysisResult }>
  deleteRecord(id: string): Promise<void>
  saveFeedback(input: FeedbackInput): Promise<void>
}
```

先实现 `LocalRepository`（当前逻辑），再接 `HttpRepository`，页面组件无需感知数据源。

---

## 5. DeepWorks Agent 接入点

沿用 `docs/agent-skill-spec.md` 的主张：**模型只负责抽取与叙述，权重 / 置信度 / 冲突 / diff 由确定性代码计算。**

建议的执行单元：

| 阶段 | 角色 | 输入 | 输出约束 |
|---|---|---|---|
| 1. Identify | 编排 Agent | 标题 / 年份 / 导演 | 只确认影片，不推断审美 |
| 2. Read | 抽取 Agent | 用户笔记 | 返回句子级证据 + 主题 / 情绪候选 |
| 3. Extract | 抽取 Agent | 候选 + taxonomy | 只能使用固定 taxonomy id |
| 4. Compare | 编排 + 图服务 | 历史记录 | 共享主题 / 情绪 / 导演；理由必须引用标签 |
| 5. Update | 确定性服务 | 全量记录 | 六维分数、置信度、diff，不经过 LLM |

约束：

- 任何主题 / 情绪必须命中 `src/data/taxonomy.ts` 的固定词表；模型输出越界即丢弃。
- 每条 insight 必须携带 `record_id` 与句子引用；前端"Evidence from your notes"直接渲染。
- 置信度不能由模型自报，必须由样本量 / 一致性公式计算。
- 用户点击 "Let me correct you" 后，纠错文本进入 `feedback.correction`，优先级高于模型结论。
- 未经用户明确同意，不把笔记发送到外部服务；界面需有 opt-in 与延迟提示。

对应地，把 `AddFilmFlow` 里的 `analyseDraft(...)` 调用替换为：

```ts
const { record, analysis } = await repository.createRecord(draft)
```

五阶段动画改为监听 SSE；其余结果 UI 不变。

---

## 6. 扩展与维护

### 增加一部片目

在 `src/data/films.ts` 增加一个 `Film`：

- `palette` 决定生成海报色板；
- `motif` 必须是 `PosterMotif` 中的值；
- `signature` 六个维度取 0–1；
- `themes` / `moods` 使用固定 taxonomy id；
- 若希望它默认出现在档案中，另在 `src/data/seed.ts` 增加记录；否则保持 `catalogOnly: true`。

### 调整视觉

- 颜色、字体、颗粒、纸张、控件：`src/styles/index.css` + `tailwind.config.js`。
- 海报母题：`src/components/film/FilmPoster.tsx` 的 `switch (film.motif)`。
- 图谱布局：`src/components/map/MemoryGraphView.tsx` 的 `layout`（三圈半径 / 排序）。

### 调整引擎

- 权重与置信度：`recordWeight` / `confidenceFor`；
- 主题轴向：`THEME_AXIS`；
- 关键词：`KEYWORDS`（证据）与 `src/lib/analyst.ts` 的 `THEME_KEYWORDS` / `MOOD_KEYWORDS`；
- 时间线文案：`buildTimeline`。

### 本地数据迁移

`loadState()` 会校验 `version`。未来增加字段时：

1. 提升 `STORAGE_VERSION`；
2. 在 `loadState` 中写迁移函数（不要直接丢弃用户记录）；
3. 迁移前保留原始 JSON 备份到 `fbf.state.backup.<version>`。

---

## 7. 已知限制

- 示例记录与评分为演示而写，不代表真实用户调查。
- 生成海报是抽象再设计，不是官方物料；接入真实图片需处理版权与署名。
- 移动端图谱节点较多，默认隐藏部分标签，需要双指 / 按钮缩放查看细节。
- 分析为同步本地计算 + UI 定时器模拟；不是流式后端。
- 无并发编辑冲突处理（单浏览器单用户）。
- 无自动化测试套件；当前验证为类型检查、构建、脚本化浏览器冒烟与人工视觉检查。
- Google Fonts 为外部网络依赖，离线时回退字体。

---

## 8. 验证命令

```bash
npm run typecheck
npm run build
npm run dev
```

验收路径见 README 的"演示脚本"。


---

## 9. 视觉系统（Phase 2 redesign）

Direction: **Cinematheque / independent film archive**, with a restrained modern cinema-platform layer.

### Tokens

| Token | Value | Use |
|---|---|---|
| `--ink` | `#111111` | primary background |
| `--ink-raised` | `#181818` | raised dark sections |
| `--paper` | `#F2F0EB` | warm paper sections |
| `--paper-muted` | `#929292` | secondary text |
| `--brass` | `#C83B35` | accent alias; now cinema red |
| `--line` | `rgba(242,240,235,.15)` | dark hairline |

The legacy `brass` Tailwind class is intentionally kept as an alias for the new accent so existing components inherit the redesign without a risky global rename.

### Typography

- English display: Instrument Serif (local/system fallback).
- Chinese display/body: PingFang SC / Hiragino Sans GB / Microsoft YaHei fallback.
- Numbers, dates, frame numbers: IBM Plex Mono / system monospace.
- Micro labels: uppercase, wide tracking, 9–10px.

### Layout rules

- No rounded cards by default; use 1px hairlines and poster edges.
- Alternate dark gallery sections with warm-paper editorial sections (Home, Film Detail, Reflection).
- Poster-first Archive: 5-column desktop wall, 2-column mobile, hover reveals note/rating/status.
- "The waiting room" exposes `catalogOnly` films as a distinct not-yet-archived state.
- Hero uses a local AI-generated cinema still at `public/images/hero-cinema.jpg`; official posters are not bundled.
- Motion: page fade, 1.03 poster zoom, red underline on active nav; reduced-motion respected.
