# Frame by Frame — 项目交接与 GPT 评审报告

> 生成日期：2026-11-05  
> 项目路径：`C:\Users\BayMax\Desktop\frame by frame`  
> 当前阶段：**Phase 1 — 可演示的前端 MVP**  
> 关键前提：**没有后端、没有登录、没有真实大模型调用；所有数据与“AI 分析”都在浏览器本地完成。**

---

## 报告结构

0. 给 GPT 的任务指令（可直接复制）
1. 执行摘要
2. 产品定义与范围
3. 可运行性与技术栈
4. 架构与数据流
5. 页面与交互清单
6. 数据模型与持久化
7. 本地“AI”引擎
8. 设计系统与视觉
9. 已验证内容
10. 已知问题与技术债
11. Phase 2 建议
12. 关键文件地图
13. 复现与验收路径
14. 事实边界
15. 最短版任务提示

> 使用方式：优先把整份 Markdown 上传给 GPT。  
> 如果只能粘贴文本，至少粘贴第 0、1、4、6、7、10、11、14 节。

---

## 0. 给 GPT 的任务指令（可直接复制）

```text
你是一名资深全栈产品工程师，擅长 React/TypeScript、FastAPI/PostgreSQL、LLM 应用与产品架构评审。

我会给你一份 Frame by Frame 项目的交接报告。请先不要重写整个项目，也不要假设项目已经有后端、登录或真实模型。

请完成以下任务：

1. 事实核对
   - 指出报告中哪些说法需要进一步验证；
   - 区分「已实现」「仅设计」「未实现」。

2. 架构与代码评审
   - 评价当前前端架构、数据契约、状态管理、持久化方案；
   - 找出最可能导致数据丢失、错误结论或演示翻车的问题；
   - 特别检查：localStorage 迁移、中文笔记分析、纠错反馈是否真正影响画像、单影片多刷记录、模态框可访问性。

3. Phase 2 方案
   - 给出 FastAPI + PostgreSQL 的最小可行 API 与表结构；
   - 说明如何把本地确定性引擎迁移到服务端；
   - 说明 LLM/DeepWorks 应只负责什么、绝不能负责什么；
   - 给出匿名本地数据迁移到账户的安全方案。

4. 优先级
   - 按 P0/P1/P2 排序，说明每项的用户影响、实现成本、验证方式；
   - 给出 5 个可以独立提交的小 PR，而不是一个巨大重构。

5. 输出格式
   - 用 Markdown；
   - 先给 10 行以内的结论；
   - 再给「必须修」「应该修」「可以后置」三张表；
   - 最后给一个两周执行计划（假设只有一名开发者）。

约束：
- 不要把示例数据当成真实用户调查；
- 不要声称本地规则引擎是真实 AI；
- 不要引入不必要的依赖；
- 不要为了“看起来更 AI”而牺牲可解释性；
- 任何画像结论都必须能指回具体记录与句子。
```

**建议同时提供给 GPT 的文件（按优先级）：**

1. `src/types.ts`
2. `src/lib/tasteEngine.ts`
3. `src/lib/analyst.ts`
4. `src/store/AppStore.tsx`
5. `docs/frontend-architecture.md`
6. `src/components/add/AddFilmFlow.tsx`
7. `src/components/map/MemoryGraphView.tsx`
8. `src/pages/Reflection.tsx`
9. `src/styles/index.css`
10. `README.md`

---

## 1. 执行摘要

Frame by Frame 是一个“个人电影记忆博物馆”，不是电影推荐站，也不是豆瓣替代品。核心闭环是：

```text
记录一部电影 → 写下真实感受 → 本地引擎抽取主题/情绪 → 更新六维审美画像
→ 在记忆图谱中建立关联 → 在年度反思中回看这一年的变化
```

当前 Phase 1 已经完成：

- 5 个主页面 + 影片详情页 + 404；
- 完整的 Add a Film 五步流程；
- localStorage 持久化、跨标签页同步、重置演示数据；
- 六维审美画像、证据引文、置信度、逐维反馈；
- 交互式记忆图谱（拖拽、平移、缩放、节点选择）；
- 年度 Reflection 与可下载/打印的年鉴；
- 16 部片目、10 条示例记录、6 部待归档片目；
- 生成式 SVG 海报，无第三方图片依赖。

**一句话判断：**

> 这是一个完成度较高、可现场演示的前端原型；但它还不是生产系统，且在“数据迁移安全”“中文笔记分析”“纠错是否真正改变画像”这三件事上存在需要在 Phase 2 之前解决的问题。

---

## 2. 产品定义与范围

### 2.1 产品定位

| 维度 | 定义 |
|---|---|
| 目标用户 | 有观影习惯、愿意写感受的大学生 / 年轻影迷 |
| 核心价值 | 把散落的观影记忆变成可回看的个人审美档案 |
| 差异点 | 不追求“猜你喜欢”，而是解释“你为什么这样看” |
| 情绪基调 | 私人、安静、克制、编辑式博物馆，而不是效率工具 |
| 当前形态 | 本地优先的单用户 Web 原型 |

### 2.2 当前阶段做与不做

| 做 | 不做 |
|---|---|
| 记录、编辑、删除观影记忆 | 真实注册 / 登录 / 多用户 |
| 本地规则引擎生成画像 | 真实 LLM 或 Agent 调用 |
| 六维雷达、证据、置信度 | 客观心理测量 |
| 记忆图谱与关联解释 | 社交 / 评论 / 关注 |
| 年度统计与年鉴 | 云同步 / 跨设备 |
| 生成式海报 | 官方海报 / TMDB 图片 |
| 本地持久化 | 后端数据库 |

### 2.3 重要的诚实声明

- 示例片目、评分、笔记是为演示而写的**虚构数据**，界面标注为 *Sample archive* / *A personal record, not a published survey*。
- “AI”是**确定性本地规则引擎**，不是模型。界面明确写出 “No model is being called”。
- 生成海报是抽象再设计，不是官方物料。
- 当前没有把任何笔记发送到服务器；除 Google Fonts 外没有外部请求。

---

## 3. 可运行性与技术栈

### 3.1 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| UI | React | 18.3.1 |
| 语言 | TypeScript | 5.7.2 |
| 构建 | Vite | 6.3.5 |
| 样式 | Tailwind CSS | 3.4.17 |
| 路由 | React Router | 6.30.0 |
| 图标 | lucide-react | 0.468.0 |
| 图表 / 图谱 | 手写 SVG / CSS | 无图表库 |
| 持久化 | localStorage | key `fbf.state.v1` |

### 3.2 运行方式

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc -b --pretty false
npm run build      # tsc -b && vite build
npm run preview    # 预览生产构建
```

环境要求：Node.js 20+。项目在 Windows + PowerShell 5.1 下完成开发与验证。

### 3.3 构建结果

最近一次生产构建：

| 产物 | 大小 | gzip |
|---|---|---|
| JS | 399.24 kB | 117.63 kB |
| CSS | 51.10 kB | 10.97 kB |
| HTML | 0.73 kB | 0.42 kB |

当前是单 JS chunk，没有按路由拆分。对演示足够，但后续页面增长时需要处理。

### 3.4 运行边界

- 需要浏览器支持 localStorage；禁用时会显示警告，但记录只在当前会话有效。
- 字体通过 Google Fonts 加载；离线时回退到 Palatino / Georgia 与系统无衬线字体，布局不受影响。
- 没有环境变量、API Key 或服务端依赖。
- 未部署到公网；验证仅限本地开发服务器与 `vite preview`。

---

## 4. 架构与数据流

### 4.1 当前架构

```text
Browser
├─ React Router
│  ├─ /                  Home
│  ├─ /archive           Archive
│  ├─ /archive/:filmId   Film Detail
│  ├─ /map               Memory Map
│  ├─ /taste             My Taste
│  ├─ /reflection        Reflection
│  └─ *                  NotFound
├─ AppStore (Context + useReducer)
│  ├─ state: records / feedback / corrections / customFilms / yearbookGenerations
│  ├─ persistence: localStorage `fbf.state.v1`
│  └─ derived: snapshot / timeline / graph
├─ AddFilmFlow (global modal)
│  ├─ catalog search + manual entry
│  ├─ local analyst (`analyseDraft`)
│  └─ five-stage UI animation
└─ Rendering
   ├─ generated SVG posters
   ├─ hand-built radar / timeline / yearbook
   └─ concentric memory graph (custom SVG)
```

### 4.2 关键数据流

#### 新增一部电影

```text
AddFilmFlow
→ analyseDraft(film, draft, previousRecords, films)
→ computeSnapshot(before) + computeSnapshot(after)
→ createRecordFromDraft(...)
→ AppStore.upsertRecord(...)
→ reducer 更新 records
→ useEffect 写入 localStorage
→ 所有页面从同一 state 派生新 snapshot / timeline / graph
```

#### 编辑一部电影

```text
FilmDetail: openEdit(record)
→ AddFilmFlow 预填 draft
→ previousRecords = records.filter(r => r.id !== editRecord.id)
→ 重新分析，避免把被编辑记录同时当作“历史证据”
→ 保留原 record.id / createdAt
→ upsertRecord(record, editingId)
```

#### 删除一部电影

```text
FilmDetail 二次确认
→ AppStore.deleteRecord(id)
→ 从 records 移除
→ 首页、档案、图谱、审美、时间线、年鉴全部重新派生
```

### 4.3 设计取舍

- **没有引入图表库**：雷达图、时间线、图谱、柱状图全部手写 SVG / CSS，减少依赖，也方便做独特视觉。
- **没有引入状态库**：单用户本地应用，Context + reducer 足够；但未来接后端时应抽 repository 层。
- **没有 force simulation**：当前采用同心圆星座布局（电影外环、主题中环、情绪核心），避免力导向布局常见的节点重叠与不可读。
- **没有真实图片**：全部使用生成式 SVG 海报，避免裂图与版权问题；`Film.posterUrl` 已预留真实图片来源。

---

## 5. 页面与交互清单

| 路由 | 页面 | 关键内容 | 状态处理 |
|---|---|---|---|
| `/` | My Cinema | 杂志式封面、影片数、观看小时、主题数、AI 置信度、最近观看、最新笔记、审美观察、快速新增 | 空档案状态 |
| `/archive` | My Archive | 海报网格 / 索引视图、搜索、类型 / 年代 / 评分 / 状态筛选、排序、清除筛选、新增入口 | 空状态、筛选无结果 |
| `/archive/:filmId` | Film Detail | 海报、元数据、个人笔记、AI 阅读、六维位置、共享主题影片、证据、编辑 / 删除 | 影片不存在、仅目录未归档 |
| `/map` | Memory Map | 约 40 个节点（10 电影 + 18 主题 + 12 情绪）、三层同心布局、拖拽 / 平移 / 缩放 / 选择、图层开关、侧栏解释 | 空图谱、图层全关 |
| `/taste` | My Taste | 六维雷达、维度卡片、证据引文、置信度、逐维反馈、纠错记录、How AI Sees Me 时间线 | 空档案、维度数据不足 |
| `/reflection` | Reflection | 年份选择、年度统计、月度柱状图、年度最爱、主题 / 情绪、前后半程漂移、年鉴生成 / 下载 / 打印 | 空年份、无记录 |
| 全局 | Add a Film | 搜索 → 确认 → 评分 / 日期 / 状态 / 笔记 → 五阶段分析 → 结果并写回 | 搜索无结果、手动录入、编辑模式 |
| `*` | NotFound | 返回首页 / 档案 | — |

### 5.1 Add a Film 五步

1. **Find the film**  
   从 16 部片目中搜索未归档电影；支持中文片名、导演、年份、类型。搜不到时可手动输入片名、年份、导演、片长、主类型。

2. **Confirm**  
   展示海报、年份、导演、片长、类型、国家 / 语言；可返回修改。

3. **Your memory**  
   0.5 星粒度评分、观影日期、状态（watched / rewatched / abandoned）、个人笔记、可选“felt like”情绪。

4. **Analysis**  
   五个确定性阶段：识别影片 → 理解笔记 → 提取主题 / 情绪 → 对比旧记忆 → 重算画像。  
   **注意：结果是同步计算好的，五阶段只是 UI 动画，不是真实流式分析。**

5. **Result**  
   展示主题、情绪、关联影片、维度变化、置信度变化、before / after 雷达图；分析动画结束后才真正写入 state 和 localStorage。

### 5.2 校验规则

- 评分必须 > 0；
- 笔记至少 18 个字符；
- 手动录入必须有片名与合理年份（1888–2100）；
- 片长限制在 20–400 分钟；
- 已归档影片不能重复新增；
- 编辑时排除当前记录，避免自我引用。

### 5.3 反馈与纠错

- 每个维度支持 `I agree` / `Not quite` / `Let me correct you`；
- `Not quite` / `corrected` 会让展示置信度乘以 0.84；
- 纠错原文保存进 `state.corrections`，并在 My Taste 页展示；
- **但反馈目前不会改变底层六维分数，也不会重新计算画像。** 这是当前实现的一个明确限制。

---

## 6. 数据模型与持久化

### 6.1 领域模型

```ts
type DimensionKey =
  | 'narrative'
  | 'emotion'
  | 'thematic'
  | 'visual'
  | 'character'
  | 'ending'

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
  motif: PosterMotif
  palette: FilmPalette
  posterUrl?: string
  signature: Record<DimensionKey, number> // 0 = low pole, 1 = high pole
  themes: Partial<Record<ThemeId, number>>
  moods: Partial<Record<MoodId, number>>
  narrativeTags: string[]
  characterTags: string[]
  catalogOnly?: boolean
}

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

### 6.2 分析契约

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

这个结构是**前后端最重要的边界**。未来 FastAPI 的 `POST /records` 应直接返回同一结构，或返回 job 后由 job 结果给出，前端结果页可以不改。

### 6.3 聚合读模型

- `TasteSnapshot`：filmCount、六维分数、总体置信度、Top 主题、Top 情绪、平均评分、总分钟数。
- `TimelineStage`：阶段 id、影片数、日期、标题、正文、Top 主题、置信度、包含的 filmIds。
- `MemoryGraph`：nodes / edges；节点类型为 film / theme / mood，边类型为 film-theme / film-mood / film-film。
- `EvidenceQuote`：影片、年份、引文、评分、观看日期。

### 6.4 数据规模

| 项目 | 数量 |
|---|---|
| 片目库 | 16 部 |
| 默认档案 | 10 条记录 |
| 仅目录、待归档 | 6 部（Moonlight / Arrival / Her / Whiplash / Past Lives / Portrait of a Lady on Fire） |
| 审美维度 | 6 |
| 主题词表 | 18 |
| 情绪词表 | 12 |
| 分析阶段 | 5 |
| 时间线里程碑 | `[1, 3, 5, 8, 10, 13, 16, 20, 25, 30]` + 当前总数 |
| 种子记录年份 | 全部为 2026 |

### 6.5 持久化

- key：`fbf.state.v1`
- 版本：`1`
- 每次 state 变化自动写入 localStorage；
- 监听 `storage` 事件实现多标签页同步；
- 页脚 `Reset demo data` 二次确认后恢复 10 条示例；
- localStorage 不可用时显示警告；
- 版本不匹配或 JSON 损坏时，当前实现会**回退到种子数据**。

### 6.6 数据诚实性

- 10 条种子记录是演示数据，不是真实用户调查；
- 评分与笔记由项目作者编写；
- 界面在关键位置标注 *Sample archive* / *Not a published survey*；
- `Film.signature` 与 `Film.themes` 是编辑估计，不是观众测量。

---

## 7. 本地“AI”引擎

### 7.1 定位

`src/lib/tasteEngine.ts` + `src/lib/analyst.ts` 是一个**确定性、可复现、可解释的本地规则引擎**。

它不做：

- 语义理解；
- 向量检索；
- 生成式文本；
- 模型调用；
- 心理测量。

它做：

- 关键词匹配；
- 加权平均；
- 主题轴映射；
- 置信度公式；
- 关联评分；
- 句子级证据抽取。

### 7.2 记录权重

```ts
weight = (0.35 + rating / 5 * 0.9)
       * (0.65 + min(noteLength / 520, 1) * 0.55)
```

高评分、长笔记权重更高。目的是让“认真写下的电影”比“随手打分”更有影响。

### 7.3 六维分数

六个维度：

1. Narrative Preference（叙事偏好）
2. Emotional Expression（情绪表达）
3. Thematic Preference（主题偏好）
4. Visual Style（视觉风格）
5. Character Development（人物塑造）
6. Ending Preference（结局偏好）

每个维度是一条 0–1 轴：

```text
0 = 低极（如 slow-burn / restrained / inward / naturalistic / character-led / unresolved）
1 = 高极（如 propulsive / cathartic / outward / stylized / ensemble / resolved）
```

维度值 = 所有记录在对应轴上的加权平均：

```ts
value = Σ(filmValue_i * weight_i) / Σ(weight_i)
```

其中：

- `narrative` / `emotion` / `visual` / `character` / `ending` 直接取 `film.signature[key]`；
- `thematic` 不是直接取签名，而是把记录的主题按“内向 ↔ 外向”轴映射后加权平均。

主题轴示例：

| 主题 | 轴向 |
|---|---|
| memory / grief / loss | 接近 0（内向） |
| identity / love / family | 0.2 左右 |
| art / time / hope | 0.4 左右 |
| reality / freedom / ambition / justice | 0.7–0.9（外向） |

### 7.4 置信度

```ts
sample = 1 - exp(-n / 4.2)
depth = average(min(noteLength / 420, 1))
consistency = 1 - min(stdev(values) * 1.5, 0.5)

confidence = clamp(
  sample * (0.6 + 0.4 * depth) * consistency,
  0.04,
  0.94
)
```

含义：

- 记录越少，置信度越低；
- 笔记越短，置信度越低；
- 记录之间越矛盾（标准差越大），置信度越低；
- 上限 94%，永远不宣称“完全确定”。

总体置信度 = 六个维度置信度的平均。

### 7.5 证据引文

- 每个维度取“权重 × 偏离中性程度”最高的前 3 部影片；
- 从笔记中按维度关键词挑一句；
- 关键词命中越多、句子越长，分数越高；
- 没有命中时回退到第一句；
- 引文最长 230 字符。

关键词示例：

| 维度 | 关键词（部分） |
|---|---|
| narrative | structure, pace, slow, editing, timeline, scene |
| emotion | cry, feel, grief, moved, tender, restrained |
| thematic | memory, loss, identity, freedom, love, time |
| visual | image, shot, frame, light, colour, composition |
| character | character, performance, actor, protagonist |
| ending | ending, last, final, credits, resolution |

### 7.6 主题与情绪提取

`src/lib/analyst.ts`：

```text
readThemes(film, reflection)
= 影片自身主题权重（+0.1 基础）
+ 笔记关键词命中加成（0.24 + 0.16 × hits，最高 0.6）
→ 取前 6 个
```

```text
readMoods(film, reflection, rating)
= 影片自身情绪权重
+ 笔记关键词命中加成（0.3 + 0.18 × hits，最高 0.75）
+ 如果评分 ≤ 2.5，追加 uneasy +0.4
→ 取前 4 个
```

这是明显的关键词规则，不是语义模型。它对英文笔记有效，对中文笔记基本无效。

### 7.7 关联影片

对每条历史记录打分：

```text
sharedThemes × 2
+ sharedMoods × 1
+ sameDirector × 1.5
+ record.rating / 5
```

条件：至少共享 1 个主题，或同一导演。  
按分数取前 3 条，生成理由：

- `Shared ground: Memory, Loss.`
- `Both leave you melancholy and wistful.`
- 同导演时：`Same director: ...`

### 7.8 维度变化 findings

- 比较新增记录前后的六维分数；
- 取绝对变化最大的 3 个维度；
- 变化 < 0.022 时写 “holds / steady”；
- 变化 < 0.06 时写 “a slight pull”；
- 否则写 “a clearer pull”；
- 详情包含 before → after 的百分比与置信度。

### 7.9 时间线

- 按 `watchedAt` 升序排序；
- 里程碑 `[1, 3, 5, 8, 10, 13, 16, 20, 25, 30]`；
- 始终加入当前记录总数；
- 对每个前缀重新计算 snapshot；
- 生成 “The first frame” / “A shape worth testing” / “A recognisable sensibility” 等阶段；
- 最新阶段在前。

因此每次新增一部电影，时间线都会多一个 “After N films” 阶段。

### 7.10 记忆图谱

- 电影节点：外环；
- 主题节点：中环；
- 情绪节点：核心；
- 电影 → 主题、电影 → 情绪：每条记录的主题 / 情绪；
- 电影 ↔ 电影：只有共享 ≥ 2 个主题才连边；
- 每部电影最多保留最强的 3 条 film–film 边；
- 布局是同心圆，不是力导向模拟；
- 支持拖拽、平移、缩放、选择、图层开关。

### 7.11 这套引擎的真实边界

| 能做到 | 不能做到 |
|---|---|
| 结果可复现 | 理解反讽、隐喻、语境 |
| 能写单元测试 | 处理中文 / 多语言 |
| 每条结论可指回句子 | 判断“演技好坏”或“影史地位” |
| 置信度随样本变化 | 替代真实用户研究 |
| 关联理由可解释 | 做语义相似度检索 |

**因此：这套引擎适合做“透明的第一版”，不适合包装成“真实 AI”。**

---

## 8. 设计系统与视觉

### 8.1 视觉方向

- 关键词：私人博物馆、编辑式杂志、胶片、纸张、低饱和黄铜。
- 主色：`#0A0A0B` / 深灰 / 米白 `#EDE7DC`。
- 强调色：黄铜 `#C3A064`。
- 字体：Instrument Serif（展示）+ Inter（正文）；离线回退 Palatino / Georgia。
- 质感：CSS 胶片颗粒、细分割线、纸张纹理、印刷式页码。
- 动效：淡入、扫描线、雷达缓动、图谱过渡；`prefers-reduced-motion` 有降级。

### 8.2 生成式海报

`src/components/film/FilmPoster.tsx`：

- 16 种视觉母题：shore / orbit / stage / dome / hotel / bench / space / wall / mind / forest / moon / arrival / signal / drum / city / fire；
- 每部影片有独立色板；
- 用 SVG 生成抽象海报；
- `posterUrl` 存在时优先加载真实图片，失败自动回退；
- 不依赖外部图片服务。

### 8.3 响应式与可访问性

已做：

- 390px 移动端无横向溢出；
- 移动端导航抽屉；
- 图谱移动端隐藏部分标签，支持缩放查看；
- 跳过导航链接；
- 按钮 / 输入框有 `aria-label`；
- 模态框有 `role="dialog"`、`aria-modal`、`aria-labelledby`；
- 减少动效偏好。

仍需补：

- 模态框没有完整 focus trap，也没有关闭后恢复焦点；
- 图谱拖拽主要是鼠标 / 触摸手势，键盘操作有限；
- 颜色对比度未做正式 WCAG 审计；
- 图表有 `aria-label`，但缺少数据表替代。

---

## 9. 已验证内容

### 9.1 静态检查

- `npm run typecheck`：通过；
- `npm run build`：通过；
- 生产构建 JS 399.24 kB / gzip 117.63 kB；
- 浏览器控制台错误：0。

### 9.2 浏览器端到端验证

使用本地 Chrome 做过脚本化冒烟与人工检查：

| 场景 | 结果 |
|---|---|
| 首次打开注入 10 条示例 | 通过 |
| 新增 Moonlight（10 → 11） | 通过 |
| 新增 Whiplash，观察结果页 | 通过；结局 -3、叙事 +3、情绪 +2，置信度 52 → 54% |
| 手工新增 Aftersun | 通过 |
| 编辑既有记录 | 通过；不产生重复 |
| 删除记录（10 → 9） | 通过 |
| 搜索无结果空状态 | 通过 |
| 档案筛选 / 排序 / 网格 / 索引 | 通过 |
| 图谱节点点击 / 平移 / 滚轮缩放 / 拖拽 | 通过 |
| 审美反馈与纠错持久化 | 通过 |
| 时间线新增 “After N films” 阶段 | 通过 |
| 年鉴生成 | 通过 |
| 年鉴 HTML 下载 | 通过；检查了下载文件内容 |
| 年鉴打印入口 | 通过入口检查；未做跨浏览器打印断言 |
| 390px 移动端页面 | 通过；无横向溢出 |
| 生产构建深层路由 `/archive/manchester` | 通过 |
| 刷新后数据仍在 | 通过 |

### 9.3 尚未验证

- Safari / Firefox；
- 真实移动设备（仅 DevTools 390px 视口）；
- 大规模数据（100+ 记录）下的图谱与时间线性能；
- localStorage 配额耗尽；
- 多标签页同时写入冲突；
- 屏幕阅读器完整流程；
- 自动化测试套件 / CI；
- 公网部署、HTTPS、CSP。

---

## 10. 已知问题与技术债

### P0 — 会影响数据安全或产品可信度，进入 Phase 2 前必须处理

| 问题 | 现状 | 影响 | 建议 |
|---|---|---|---|
| 版本不匹配会重置为种子数据 | `loadState()` 发现 `version !== 1` 时直接 `createInitialState()` | **用户数据可能被静默覆盖** | 迁移前备份原始 JSON 到 `fbf.state.backup.<version>`；按版本迁移；无法迁移时只读展示并提示 |
| 中文笔记无法被关键词引擎识别 | `THEME_KEYWORDS` / `MOOD_KEYWORDS` 全是英文 | 目标用户写中文时，主题/情绪退化为影片标签，画像变钝 | 增加中文词典与分词；或明确要求英文笔记；或接多语言 embedding 作为可选路径 |
| 纠错不会改变分数 | `feedback` 只影响展示置信度（×0.84） | 用户以为“纠正了 AI”，实际画像没变 | 将纠错作为先验 / 约束参与重算；至少在 UI 说明“只降低置信度，不改分数” |

### P1 — 应该在 Phase 2 早期处理

| 问题 | 现状 | 影响 | 建议 |
|---|---|---|---|
| 手动录入影片的六维签名是中性值 | `signature` 全部 0.5 / 0.4 | 手动影片对画像几乎不产生方向性影响 | 从笔记 / 类型 / 主题推断，或接入元数据服务；UI 说明“手动影片只参与主题推断” |
| 一部电影只能有一条记录 | `upsert-record` 按 `filmId` 去重 | 无法记录同一部电影的多刷、不同人生阶段 | 改为“一片多记”，用 `record.id` 去重；时间线按观看日期 |
| `persistState` 失败被忽略 | 返回 boolean，但调用方未处理 | 配额满后用户以为已保存，刷新丢失 | 监听写入失败，显示持续警告，提供导出 JSON |
| 没有自动化测试 | 仅类型检查 + 脚本化冒烟 | 改引擎/算法容易回归 | 先给 `tasteEngine` / `analyst` / `graph` 加 Vitest，再给主流程加 Playwright |
| 模态框焦点管理不完整 | 无 focus trap / 焦点恢复 | 键盘与屏幕阅读器体验差 | 使用成熟 dialog primitive，或补 focus trap + restore |
| 单 JS chunk | 399 kB 未拆分 | 首屏加载偏重 | 路由级 `lazy` + 手动 chunk |
| 年鉴历史只有 id | `yearbookGenerations` 只存时间戳式 id | 无法回看“当时生成了什么” | 存 payload / 年份 / 版本，或明确只做“生成次数” |

### P2 — 可以后置

| 问题 | 说明 |
|---|---|
| 手动录入取消后留下 custom film | `createManual` 先写 `customFilms`，用户取消会留下无记录影片 |
| 硬编码双语文案 | 没有 i18n 框架，后续多语言成本高 |
| Google Fonts 外部依赖 | 离线回退可用，但首屏字体受网络影响 |
| 图谱标签密集 | 移动端默认隐藏部分标签，需要缩放查看 |
| 无并发编辑冲突处理 | 单浏览器单用户，暂时可接受 |
| 没有真实海报 | 生成海报有风格，但不是官方物料 |

---

## 11. Phase 2 建议

### 11.1 先抽 Repository，不要先重写页面

建议新增：

```ts
// src/lib/repository.ts
export interface CinemaRepository {
  listRecords(): Promise<WatchRecord[]>
  createRecord(input: AddFilmDraft): Promise<{ record: WatchRecord; analysis: AnalysisResult }>
  updateRecord(id: string, input: AddFilmDraft): Promise<{ record: WatchRecord; analysis: AnalysisResult }>
  deleteRecord(id: string): Promise<void>
  saveFeedback(input: FeedbackInput): Promise<void>
}
```

先实现 `LocalRepository`（包装当前逻辑），再实现 `HttpRepository`。页面组件只依赖接口，不关心数据源。

### 11.2 后端最小 API

```text
GET    /api/v1/films?q=
GET    /api/v1/films/{id}
POST   /api/v1/films
GET    /api/v1/records
POST   /api/v1/records                  → { record, analysis_job_id }
PATCH  /api/v1/records/{id}             → 重新分析
DELETE /api/v1/records/{id}
GET    /api/v1/analysis/{job_id}
GET    /api/v1/analysis/{job_id}/stream SSE：五阶段 + 最终结果
GET    /api/v1/taste
POST   /api/v1/taste/feedback
GET    /api/v1/graph
GET    /api/v1/reflection?year=2026
POST   /api/v1/yearbooks
```

分析异步化：

```text
POST /records
→ 返回 record + job_id
→ 前端保留五阶段 UI
→ 用 SSE 接收 stage 事件
→ 最终返回 AnalysisResult
→ 前端结果页结构不变
```

### 11.3 数据库建议

| 表 | 关键字段 |
|---|---|
| `users` | id, email, created_at |
| `films` | id, title, title_zh, year, director, runtime, genres, signature JSONB, palette JSONB, poster_url |
| `watch_records` | id, user_id, film_id, rating, watched_at, status, reflection, felt_like, ai_summary, ai_confidence, source, created_at, updated_at |
| `record_themes` | record_id, theme_id, weight |
| `record_moods` | record_id, mood_id |
| `taste_snapshots` | id, user_id, film_count, scores JSONB, confidence, engine_version, created_at |
| `taste_evidence` | id, snapshot_id, dimension, record_id, sentence, weight |
| `feedback` | id, user_id, scope, target_id, verdict, correction, created_at |
| `yearbooks` | id, user_id, year, payload JSONB, generated_at |

`engine_version` 必须落库。半年后要能解释“当时为什么得出这个结论”。

### 11.4 LLM / DeepWorks 的正确位置

**原则：模型只负责“从用户的话里抽取证据”和“把证据讲成人话”；权重、置信度、冲突检测、diff 全部由确定性代码计算。**

| 阶段 | 角色 | 输入 | 输出约束 |
|---|---|---|---|
| 1. Identify | 编排 Agent | 标题 / 年份 / 导演 | 只确认影片，不推断审美 |
| 2. Read | 抽取 Agent | 用户笔记 | 返回句子级证据 + 主题 / 情绪候选 |
| 3. Extract | 抽取 Agent | 候选 + taxonomy | 只能使用固定 taxonomy id |
| 4. Compare | 编排 + 图服务 | 历史记录 | 共享主题 / 情绪 / 导演；理由必须引用标签 |
| 5. Update | 确定性服务 | 全量记录 | 六维分数、置信度、diff，不经过 LLM |

约束：

- 任何主题 / 情绪必须命中 `src/data/taxonomy.ts` 的固定词表；
- 每条 insight 必须携带 `record_id` 与句子引用；
- 置信度不能由模型自报；
- 用户纠错优先级高于模型结论；
- 未经明确同意，不把笔记发送到外部服务；
- 模型输出越界直接丢弃，不做“猜测性修复”。

### 11.5 中文支持是产品问题，不只是技术问题

当前 UI 是英文为主、中文辅助，但目标用户很可能用中文写笔记。建议二选一：

**方案 A：明确英文笔记要求（成本最低）**

- 在输入框提示 “Write in English for the local engine”；
- 不适合中文用户，但演示可控。

**方案 B：真正支持中文（推荐）**

- 增加中文主题 / 情绪词典与简单分词；
- 保留英文关键词；
- 对无法识别的笔记，明确显示 “No clear theme yet”，不要硬猜；
- 后续用多语言 embedding 做候选召回，但仍由固定 taxonomy 收口。

### 11.6 推荐路线

| 阶段 | 目标 | 关键交付 |
|---|---|---|
| A. 稳定 | 不丢数据、不误导用户 | 存储迁移 + 备份、纠错语义说明、中文词典、Vitest |
| B. 接后端 | 数据离开浏览器 | FastAPI + PostgreSQL、Repository、只读接口、匿名数据迁移 |
| C. 接智能 | 真实抽取与叙述 | 异步 job + SSE、LLM 证据抽取、taxonomy 校验、engine_version |
| D. 产品化 | 可分享、可回看 | 年鉴 PDF、推荐 3 条、分享卡片、可访问性审计 |

---

## 12. 关键文件地图

| 文件 | 职责 | GPT 阅读优先级 |
|---|---|---|
| `README.md` | 运行、验收、已完成 / 未完成 | 高 |
| `docs/frontend-architecture.md` | 数据契约、API 草案、表结构、DeepWorks 接入 | 高 |
| `docs/agent-skill-spec.md` | 既有智能层规格与赛事约束 | 中 |
| `src/types.ts` | 领域模型与分析契约 | 高 |
| `src/lib/tasteEngine.ts` | 六维计算、置信度、证据、时间线、统计 | 高 |
| `src/lib/analyst.ts` | 主题 / 情绪提取、关联、findings、summary | 高 |
| `src/store/AppStore.tsx` | 全局状态、派生数据、写操作 | 高 |
| `src/components/add/AddFilmFlow.tsx` | 五步流程、手动录入、编辑、分析动画、结果页 | 高 |
| `src/lib/graph.ts` | 图谱节点 / 边派生 | 中 |
| `src/components/map/MemoryGraphView.tsx` | 同心布局、pan / zoom / drag / selection | 中 |
| `src/pages/Reflection.tsx` | 年度统计、年鉴 HTML / 下载 / 打印 | 中 |
| `src/components/film/FilmPoster.tsx` | 生成式海报与回退 | 中 |
| `src/styles/index.css` | 设计系统、颗粒、纸张、海报、图谱 | 中 |
| `src/data/films.ts` | 16 部片目与审美签名 | 中 |
| `src/data/seed.ts` | 10 条示例记录 | 中 |
| `src/data/taxonomy.ts` | 六维、18 主题、12 情绪、阶段、存储版本 | 高 |
| `src/lib/storage.ts` | localStorage 读写、版本校验、跨标签页 | 高 |

---

## 13. 复现与验收路径

```bash
npm install
npm run dev
```

打开 `http://localhost:5173`。

### 演示脚本

1. 首页点击 **Add a Film**；
2. 搜索 `Whiplash`（或 `Moonlight` / `Arrival`；也可手动输入 `Aftersun`）；
3. 确认影片；
4. 给一个与平时不同的评分，写一段真实感受；
5. 点击 **Analyse this memory**；
6. 观察五阶段与结果页：
   - 主题 / 情绪；
   - 关联影片与理由；
   - 维度变化；
   - 置信度变化；
   - before / after 雷达图；
7. 点击 **See My Taste**：雷达、证据、时间线新阶段已更新；
8. 在任一维度点击 **Not quite** 或 **Let me correct you**；
9. 返回 Archive 查看新卡片；
10. 打开 Memory Map 查看新节点；
11. 打开 Reflection 生成年鉴并下载 HTML；
12. 刷新页面，确认记录仍在；
13. 页脚 **Reset demo data** 可恢复 10 条示例。

### 预期变化

- 10 条 → 11 条；
- 置信度会小幅变化（例如 52% → 54%）；
- 时间线多出 `After 11 films`；
- 新影片出现在档案、图谱、年度统计；
- 结果页的 before / after 雷达图反映增量。

---

## 14. 事实边界

请任何评审者 / GPT 明确区分：

| 类别 | 状态 |
|---|---|
| 前端页面与交互 | 已实现并验证 |
| 本地持久化 | 已实现并验证 |
| 生成式海报 | 已实现 |
| 规则引擎画像 | 已实现，但不是真实 AI |
| 示例数据 | 虚构演示数据 |
| 后端 API | 仅设计，未实现 |
| PostgreSQL | 仅设计，未实现 |
| 登录 / 多用户 | 未实现 |
| 真实 LLM | 未实现 |
| 推荐 / 社交 | 未实现 |
| 自动化测试 / CI | 未实现 |
| 公网部署 | 未实现 |

**不要把这个项目描述为“已完成生产系统”或“真实 AI 产品”。**  
它目前最准确的描述是：

> 一个可运行、可演示、数据本地优先的个人电影记忆博物馆前端 MVP；它的“AI”是透明、可解释、可复现的本地规则引擎，下一步才是接后端与真实模型。

---

## 15. 最短版任务提示（如果只想给 GPT 一小段）

```text
请阅读我附上的 Frame by Frame 项目报告。

这是一个 React + TypeScript + Vite + Tailwind 的本地优先电影记忆博物馆前端 MVP：
- 5 个主页面 + 详情页 + Add a Film 五步流程；
- localStorage 持久化；
- “AI”是确定性本地规则引擎，不是真实模型；
- 没有后端、登录、推荐或社交。

请先做架构与风险评审，不要直接重写代码。重点看：
1. localStorage 版本迁移的数据丢失风险；
2. 中文笔记无法被英文关键词引擎识别；
3. 用户纠错只降低置信度、不改变分数；
4. 一部电影只能有一条记录；
5. 缺少自动化测试。

然后给出：
- P0 / P1 / P2 问题清单；
- FastAPI + PostgreSQL 最小 API 与表结构；
- LLM 只做证据抽取与叙述、确定性代码负责分数的边界方案；
- 5 个可独立提交的小 PR；
- 两周执行计划。

不要假设已有后端，不要把示例数据当成真实用户调查，也不要把本地规则引擎说成真实 AI。
```
