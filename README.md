# Frame by Frame

**AI-Powered Personal Cinema Memory Museum**
*Every film leaves a frame. Every frame tells your story.*

Frame by Frame 是一个面向大学生的个人电影记忆博物馆。它不是电影推荐站，也不是豆瓣替代品，而是一个记录观影经历、理解个人审美、积累电影记忆的本地优先应用。

> 当前阶段：**AI Core V1 — 已接入真实大模型分析。**
> 笔记与片库仍保存在浏览器本地；只有你主动授权后，单次笔记才会发送到服务端，由服务端调用 DeepSeek。模型密钥只存在服务端，不会进入前端构建。
> 每条分析都带原文引文、置信度与不确定性；在你接受之前，不会计入六维画像。

---

## 快速开始

环境要求：Node.js 20+（已在 Node 26 / npm 11 下验证）。

```bash
npm install
npm run dev          # 前端 http://localhost:5173
```

要让 AI 分析真正工作，另开一个终端启动本地 API：

```bash
# .env（已被 .gitignore 忽略）
# DEEPSEEK_API_KEY=sk-...
npm run ai:dev       # http://127.0.0.1:8787
```

开发环境下前端默认请求 `http://127.0.0.1:8787`；也可用 `VITE_AI_API_BASE` 指向已部署的 Worker。

其他命令：

```bash
npm run build        # 类型检查 + 生产构建（dist/）
npm run preview      # 预览生产构建
npm run typecheck    # 仅类型检查
npm run test:unit    # 前端测试（21 个）
npm run test:server  # 后端测试（30 个）
npm run ai:verify    # 真实模型验证，写入 docs/ai-verification.json
npm run worker:dev   # Wrangler 本地 Worker
npm run worker:deploy
```

> 如果 PowerShell 因执行策略阻止 `npm.ps1`，请改用 `npm.cmd install` / `npm.cmd run dev`。这是本机环境问题，不是项目问题。

字体通过 Google Fonts 加载（Instrument Serif / Inter）。离线时会回退到 Palatino / Georgia 与系统无衬线字体，布局与功能不受影响。

---

## 页面与交互

| 页面 | 路由 | 关键内容 |
|---|---|---|
| **My Cinema** | `/` | 杂志式封面、累计电影数、最近观看、最新笔记、AI 观察、快速新增 |
| **My Archive** | `/archive` | 海报网格 / 索引视图、搜索、筛选、排序、片目详情入口 |
| **Film Detail** | `/archive/:filmId` | 基本信息、个人笔记、评分、AI 分析（接受 / 修改 / 拒绝 / 逐条移除 / 重新分析）、关联影片 |
| **Memory Map** | `/map` | 40 节点交互图谱：电影外环、主题中环、情绪核心 |
| **My Taste** | `/taste` | 六维画像、证据引文与置信度、样本不足提示、待确认队列、逐维反馈、画像变化历史 |
| **Reflection** | `/reflection` | 纸质年鉴视觉、月度记录、年度统计、主题 / 情绪、审美漂移 |
| **Add a Film** | 全局弹窗 | 搜索 → 确认 → 评分 / 日期 / 状态 / 笔记 → 授权 → 真实分析 → 逐条审阅并写回 |

### Add a Film 五步

1. **Find the film** — 搜索片目；搜不到时可手工录入。
2. **Confirm** — 海报、年份、导演、片长、类型。
3. **Your memory** — 0.5 星粒度评分、观影日期、状态、个人笔记、可选情绪。
4. **Analysis** — 授权后将本次记录发送给服务端；失败时不会伪造结果，可重试或先保存记录。
5. **Result** — 摘要、情绪、主题及证据、偏好证据与原句、不确定性、关联影片、模型来源；接受后才计入画像。

提交后会真实更新：首页统计与最近记录、档案、详情、记忆地图节点、审美画像与变化历史。

---

## AI 分析如何工作

完整设计、契约与部署说明见 **[docs/ai-core.md](docs/ai-core.md)**。

- **模型**：DeepSeek `deepseek-chat`，服务端调用；响应中的实际模型名会记录在 provenance 中。
- **服务端**：同一份 Fetch handler 运行在 Cloudflare Workers（生产）与 Node（本地），核心在 `server/core/`。
- **校验**：枚举必须来自词表；`quote` 必须逐字出现在笔记中，否则丢弃引文；`related_films` 只能引用随请求提供的有限历史；两次尝试仍不合规则返回 422，不写入结果。
- **隐私**：日志只记录长度、耗时与错误码，不记录笔记正文；请求体上限 64KB；限流 12 次/分钟、80 次/天（单 isolate 内存实现）。
- **画像**：只统计 `accepted` / `edited` 的分析；`n ≥ 3` 且置信度与一致性达标才给出方向，否则显示"样本不足"。
- **可撤销**：拒绝或删除分析不影响原始记录；"这条不像我"会立即从画像中移除该贡献。

`docs/ai-verification.json` 保存最近一次真实调用的证据（模型、耗时、结构校验结果、4 条偏好证据、不确定性），可直接复现核查。

---

## 本地数据与持久化

- localStorage key：`fbf.state.v1`（内部 `version: 2`；v1 数据会在读取时无损迁移，key 保持不变以免丢失旧档案）。
- 首次打开自动注入 10 部示例电影；示例解读由编辑撰写（`provider: seed`），界面标注"非模型输出"，需要你确认后才计入画像。
- 新增、编辑、删除、反馈、纠错、画像变化历史都会持久化。
- 页脚 **Reset demo data** 可恢复示例数据。
- 多标签页之间通过 `storage` 事件同步；存储不可用时导航下方会显示明确警告。

### 海报

海报来自 TMDB 官方影片图片或经过核验的本地副本；加载失败时回退到原创 poster study，避免裂图。首页 Hero 使用本地 `public/images/hero-cinema.jpg`。

---

## 项目结构

```
.
├─ docs/
│  ├─ ai-core.md                  # AI Core V1：架构、契约、部署、限制
│  ├─ ai-verification.json        # 真实模型调用证据
│  ├─ agent-skill-spec.md
│  └─ frontend-architecture.md
├─ server/
│  ├─ app.ts                      # 路由、CORS、限流、错误映射
│  ├─ worker.ts                   # Cloudflare Workers 入口
│  ├─ node.ts                     # 本地 Node 入口
│  └─ core/                       # contract / prompt / validate / service / provider …
├─ scripts/
│  └─ verify-ai.ts                # 真实模型验证脚本
├─ src/
│  ├─ components/                 # add / film / layout / map / taste / ui
│  ├─ data/                       # films / seed / seedAnalyses / taxonomy
│  ├─ lib/ai/                     # client / validate / history / tasteProfile / adapter
│  ├─ lib/                        # tasteEngine / graph / storage / format
│  ├─ pages/                      # Home / Archive / FilmDetail / MemoryMap / Taste / Reflection
│  ├─ store/AppStore.tsx
│  ├─ types.ts
│  └─ App.tsx
├─ outputs/ai-core-verification/  # 界面走查截图
├─ wrangler.toml
├─ tsconfig.server.json
├─ vitest.config.ts
└─ package.json
```

技术栈：React 18 · TypeScript 5.7 · Vite 6 · Tailwind CSS 3.4 · React Router 6 · lucide-react · Vitest · Cloudflare Workers。

---

## 验收路径

1. 启动 `npm run ai:dev` 与 `npm run dev`，打开 `http://localhost:5173`。
2. 进入任意影片详情，勾选授权，点击 **重新分析**；等待真实模型返回（约 10–30 秒）。
3. 检查摘要、情绪、主题、偏好证据、原文引文、不确定性与来源是否为 `deepseek`。
4. 点击 **接受并纳入画像**；刷新页面确认仍然生效。
5. 打开 **My Taste**：待确认数量减少，维度卡片显示证据与置信度；点击 **不太像** 观察置信度变化。
6. 回到详情页点击 **拒绝这次分析**，确认它不再影响画像。

### 已实际验证

- `tsc -b` 与 `tsc -p tsconfig.server.json`：0 错误。
- 生产构建通过：JS 482 kB / gzip 149 kB。
- 自动化测试：**51 个全部通过**（前端 21、后端 30）。
- 真实模型调用：`deepseek / deepseek-flash`，约 8.8 秒，4 条偏好证据，引文全部可回溯；未涉及维度进入 uncertainties。
- 浏览器走查：真实分析 → 待确认 → 接受 → 刷新持久化 → 品味页待确认减少 → 维度反馈 → 拒绝；页面控制台 0 错误。截图见 `outputs/ai-core-verification/`。

---

## Phase 2 视觉改版（2026-11）

- 方向：Cinematheque / 私人电影资料馆；黑白灰为主、低饱和红 #C83B35 点缀。
- 首页：本地 cinema still 作为全屏 Hero；下方切换暖白编辑式版面。
- Archive：海报优先的资料馆墙，悬停显示笔记 / 评分 / 状态。
- Film Detail：深色 feature spread + 暖白 "The note" 跨页 + 深色六维坐标。
- Taste / Reflection / Map / Add Film：统一字体、发丝线、红色选中态与纸面变量。

---

## 尚未完成

- 真实注册 / 登录、多用户、云端同步。
- 全局限流（当前为单 isolate 内存实现，多实例需 KV / Durable Object）。
- 公开部署前的访问控制与配额体系。
- 个性化推荐 feed、社交 / 社区功能。
- 把浏览器走查固化为 CI 中的端到端测试。
