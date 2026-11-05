# Frame by Frame

**AI-Powered Personal Cinema Memory Museum**
*Every film leaves a frame. Every frame tells your story.*

Frame by Frame 是一个面向大学生的个人电影记忆博物馆。它不是电影推荐站，也不是豆瓣替代品，而是一个记录观影经历、理解个人审美、积累电影记忆的本地优先前端原型。

> 当前阶段：**Phase 1 — 前端 MVP，全部数据与"AI 分析"均在浏览器本地完成。**
> 没有接入真实后端、登录系统或大模型。界面对此有明确标注，不会把本地规则伪装成真实 AI 调用。

---

## 快速开始

环境要求：Node.js 20+（已在 Node 26 / npm 11 下验证）。

```bash
npm install
npm run dev
```

打开终端输出的地址（默认 `http://localhost:5173`）。

其他命令：

```bash
npm run build      # 类型检查 + 生产构建（输出到 dist/）
npm run preview    # 预览生产构建
npm run typecheck  # 仅类型检查
```

> 如果 PowerShell 因执行策略阻止 `npm.ps1`，请改用 `npm.cmd install` / `npm.cmd run dev`，或调整执行策略。这是本机环境问题，不是项目问题。

字体通过 Google Fonts 加载（Instrument Serif / Inter）。离线时会回退到 Palatino / Georgia 与系统无衬线字体，布局与功能不受影响。

---

## 已实现的页面与交互

| 页面 | 路由 | 关键内容 |
|---|---|---|
| **My Cinema** | `/` | 杂志式封面、累计电影数、最近观看、最新笔记、AI 观察、快速新增 |
| **My Archive** | `/archive` | 海报网格 / 索引视图、搜索、类型 / 年代 / 评分 / 状态筛选、排序、片目详情入口 |
| **Film Detail** | `/archive/:filmId` | 基本信息、个人笔记、评分、AI 主题与情绪、审美坐标、关联影片、编辑 / 删除 |
| **Memory Map** | `/map` | 40 节点交互图谱：电影外环、主题中环、情绪核心；拖拽、平移、缩放、节点选择与关系高亮 |
| **My Taste** | `/taste` | 六维审美雷达、维度解读、证据引文、置信度、逐维反馈、How AI Sees Me 时间线 |
| **Reflection** | `/reflection` | 纸质年鉴视觉、本月记录、年度统计、月度柱状图、年度最爱、主题 / 情绪、前后半程审美漂移 |
| **Add a Film** | 全局弹窗 | 搜索 → 确认 → 评分 / 日期 / 状态 / 笔记 → 五阶段模拟分析 → 结果并真实写回 |

### Add a Film 五步

1. **Find the film** — 从 16 部片目中搜索未归档电影；搜不到时可手工录入。
2. **Confirm** — 海报、年份、导演、片长、类型。
3. **Your memory** — 0.5 星粒度评分、观影日期、状态、个人笔记、可选情绪。
4. **Analysis** — 五个确定性阶段（识别影片 → 理解笔记 → 提取主题情绪 → 对比旧记忆 → 重算画像）。
5. **Result** — 新主题 / 情绪、与旧片的关联、审美维度变化、置信度变化、**before / after 雷达图**，并立即写入 localStorage。

提交后会真实更新：首页统计与最近记录、档案、详情、记忆地图节点、审美雷达、时间线阶段、Reflection 统计与年鉴。

---

## 本地数据与"AI"说明

### 持久化

- localStorage key：`fbf.state.v1`（版本 `1`）
- 首次打开自动注入 10 部示例电影；片目库共 16 部（另外 6 部只能通过 Add a Film 加入）。
- 新增、编辑、删除、反馈、纠错、年鉴生成记录都会持久化。
- 页脚 **Reset demo data** 可恢复 10 部示例数据。
- 多标签页之间通过 `storage` 事件同步。
- 若浏览器禁用 localStorage，导航下方会显示明确警告，记录只在当前会话内有效。

### "AI"到底是什么

本阶段的审美画像由 `src/lib/tasteEngine.ts` 中的**确定性本地引擎**计算，不调用模型、不需要 API Key：

- 每条记录的权重来自评分与笔记长度。
- 六个维度是每条影片自身审美签名（0–1 轴位置）的加权平均。
- 主题偏好由主题在"内向 ↔ 外向"轴上的映射聚合。
- 置信度由样本量、笔记深度、记录间一致性共同决定，上限 94%。
- 主题 / 情绪由 `src/lib/analyst.ts` 的关键词规则 + 影片标签提取，并保留原始笔记作为证据。
- "Not quite" / "Let me correct you" 会降低该维度展示置信度，并保存用户原话。

所有相关页面都明确写出：**这是基于记录的偏好估计，不是客观审美水平，也不是真实大模型判断。**

示例片目、评分与笔记是为演示而写的虚构数据，界面标注为 *Sample archive* / *A personal record, not a published survey*。

### 海报

没有使用第三方图片接口。每部影片根据自身色板与视觉母题生成 editorial SVG 海报（`src/components/film/FilmPoster.tsx`），因此不会出现裂图。首页 Hero 使用本地 `public/images/hero-cinema.jpg`（AI 生成、已裁掉生成水印），不依赖外部图床。

`Film.posterUrl` 已预留真实图片来源；若图片加载失败，会自动回退到生成海报。接入 TMDB 等来源时只需补齐该字段并遵守其授权要求。

---

## 项目结构

```
.
├─ docs/
│  ├─ agent-skill-spec.md          # 既有智能层规格（下一阶段）
│  └─ frontend-architecture.md     # 前端数据契约与后端接入建议
├─ public/
│  ├─ favicon.svg
│  └─ images/hero-cinema.jpg      # AI-generated cinema still used on the Home cover
├─ src/
│  ├─ components/
│  │  ├─ add/       AddFilmFlow / AddFilmProvider
│  │  ├─ film/      FilmPoster / FilmCard / FilmIndexRow
│  │  ├─ layout/    Shell / ErrorBoundary
│  │  ├─ map/       MemoryGraphView / GraphLegend
│  │  ├─ taste/     TasteRadar / ShiftRadar / DimensionCard / HowAISeesMe
│  │  └─ ui/        Modal / Rating / Toast / Primitives
│  ├─ data/         films.ts（16 部片目）/ seed.ts（10 条记录）/ taxonomy.ts
│  ├─ lib/          analyst.ts / tasteEngine.ts / graph.ts / storage.ts / format.ts
│  ├─ pages/        Home / Archive / FilmDetail / MemoryMap / Taste / Reflection / NotFound
│  ├─ store/        AppStore.tsx（Context + reducer + 派生数据）
│  ├─ styles/       index.css（设计系统、纸张、颗粒、海报、图谱）
│  ├─ types.ts      领域模型与分析契约
│  ├─ App.tsx       路由与 Provider
│  └─ main.tsx
├─ index.html
├─ package.json
├─ tailwind.config.js
├─ postcss.config.js
├─ tsconfig.json
└─ vite.config.ts
```

技术栈：React 18 · TypeScript 5.7 · Vite 6 · Tailwind CSS 3.4 · React Router 6 · lucide-react。
图表与图谱均为手写 SVG / CSS，没有引入额外图表库。

---

## 演示脚本（验收路径）

1. 首页点击 **Add a Film**，搜索一部尚未归档的片目（例如 `Whiplash`、`Moonlight`、`Arrival`，或手工输入 `Aftersun`）。
2. 确认影片 → 给评分（建议与你平时的选择拉开差距以便观察变化）→ 写下真实感受 → **Analyse this memory**。
3. 观察五个分析阶段与结果页：主题、情绪、关联影片、before/after 雷达、置信度变化。
4. 点击 **See My Taste**：雷达、六维证据、时间线新增的 "After N films" 阶段都已更新。
5. 在任一维度点击 **Not quite** 或 **Let me correct you**，确认反馈被保存且置信度下降。
6. 返回 Archive 查看新卡片；打开 Memory Map，新节点与关系已出现；打开 Reflection 查看统计与年鉴。
7. 重新加载页面，确认记录仍在。

### 已实际验证（开发环境）

- 类型检查 `tsc --noEmit` 通过；生产构建通过（JS ≈ 404 kB / gzip ≈ 119 kB）。
- 浏览器控制台错误：0。
- 已跑通：新增 Moonlight（10 → 11 条）、手工新增 Aftersun、编辑既有记录（不产生重复）、删除入口、搜索无结果空状态、地图节点点击 / 平移 / 滚轮缩放 / 拖拽、审美反馈与纠错持久化、年鉴生成与 HTML 下载（已检查下载文件内容）、记录删除、390px 移动端无横向溢出。
- 移动端已检查首页、菜单、档案、审美、地图、详情、反思页。

另外用 `vite preview` 验证了生产构建的深层路由（如 `/archive/manchester`）。
这些验证以本地脚本与人工检查完成，未作为自动化测试套件提交。

---

## Phase 2 视觉改版（2026-11）

- 方向：Cinematheque / 私人电影资料馆，辅助现代电影品牌；黑白灰为主、低饱和红 #C83B35 点缀。
- 首页：本地 AI-generated cinema still 作为全屏 Hero，海报叠放、品牌大字、统计条；下方切换暖白编辑式版面。
- Archive：海报优先的 5 列资料馆墙，悬停显示笔记/评分/状态；新增 “The waiting room” 展示 6 部未归档片目。
- Film Detail：深色 feature spread + 暖白 “The note / Archive reading” 跨页 + 深色六维坐标 + 暖白关联与证据。
- Taste / Reflection / Map / Add Film：统一到同一套字体、发丝线、红色选中态与纸面变量。
- 官方海报不可用；当前使用原创 poster studies 与一张 AI-generated Hero still（已裁掉生成水印），不是官方物料。

---

## 已完成 / 未完成

### 已完成

- 五个主页面 + 影片详情 + 404。
- 统一设计系统：炭黑 #111 / 暖白 #F2F0EB / 低饱和红 #C83B35、Serif 展示字、Monospace 数字、胶片颗粒、细分割线、深浅交替页面。
- 10 部互相有关联的示例电影、完整笔记、主题 / 情绪 / 叙事 / 人物标签；另有 6 部待归档片目，Archive 新增 “The waiting room” 区块。
- 每部影片的专属生成海报 + 图片失败回退；首页使用本地 AI-generated cinema still 作为品牌 Hero。
- Add a Film 全流程真实写回；分析结果由输入内容与历史记录计算。
- 六维审美画像、证据引文、置信度、逐维反馈与纠错时间线。
- 可拖拽 / 缩放 / 选择节点的记忆图谱，节点与边均由记录派生。
- Reflection 年度统计、月度图表、审美漂移、年鉴生成 / 下载 / 打印。
- localStorage 持久化、跨标签页同步、重置演示数据、存储不可用提示。
- 加载态（启动 / 分析 / 年鉴）、空状态（档案 / 筛选 / 图谱 / 画像 / 年鉴）、错误边界。

### 本阶段明确未做

- 真实注册 / 登录、多用户、云端同步。
- PostgreSQL / FastAPI 后端。
- 真实 AI 模型或 DeepWorks Agent 工作流调用。
- 个性化推荐 feed、社交 / 社区功能。
- 真实票房 / 影评 / 用户调查数据；示例笔记均为演示而写。
- 官方电影海报或 TMDB 图片（已预留 `posterUrl`；当前使用原创 poster studies 与一张 AI-generated Hero still，不是官方物料）。
- 自动化测试套件与 CI。

---

## 下一阶段建议

1. **先接后端，再接模型**：用 FastAPI + PostgreSQL 复刻 `src/types.ts` 的数据契约；把 `analyseDraft` 的同步规则替换为服务端异步分析任务（`POST /records` → `job_id` → SSE 推送五阶段）。
2. **保留确定性计算**：主题权重、六维分数、置信度、时间线 diff 继续由服务端代码计算；LLM 只负责"从笔记抽取证据"和"把证据讲成人话"，每条结论必须能指回原句（参见 `docs/agent-skill-spec.md`）。
3. **认证与迁移**：匿名本地数据 → 登录后合并到账户；localStorage 作为离线缓存。
4. **推荐**：基于已有主题 / 情绪向量做"有理由的 3 条"推荐，而不是黑盒排序。
5. **真实海报**：接入 TMDB 图片时补 `posterUrl`，保留生成海报作为 fallback，并补齐版权署名。
6. **质量**：为 `tasteEngine` / `analyst` / `graph` 增加单元测试；用 Playwright 固化当前演示路径。

更细的接口、表结构与迁移建议见 [docs/frontend-architecture.md](docs/frontend-architecture.md)。
