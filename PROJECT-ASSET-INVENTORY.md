# Frame by Frame — 项目资料总盘点

> 盘点日期：2026-11-20 10:40（UTC+08:00）
> 盘点范围：当前工作区 `C:\Users\BayMax\Desktop\frame by frame`（含 Git 工作区、未提交文件、outputs、docs、knowledge、supabase、competition-submission、uploads 中的官方模板）
> 盘点方式：只读目录与文件内容核对；未修改任何原始资料
> 事实口径：只记录能在仓库或平台证据文件中核对的事实；规划项与未执行项单独标注

---

## 0. 一句话结论

项目已形成**可运行的前端、已接入的 Supabase 代码与 SQL、已跑通的 DeepWorks Agent/3 Skills/12 条知识库、真实运行与质量门证据**；但 **Supabase 的注册登录、跨设备同步、双账号隔离等 16 项端到端测试全部未执行**，真实用户访谈为 0，3 分钟演示视频未制作。材料层面可提交，但不能把待验能力写成已上线。

---

## 1. 盘点方法与边界

1. 目录级盘点覆盖：根目录、`docs/`、`outputs/`、`knowledge/`、`workflow/`、`supabase/`、`src/`、`server/`、`competition-submission/`、`legacy/`、`FrameByFrame-Launcher/`、`public/`、`uploads/`。
2. 文件内容核对：官方赛制、Supabase 架构/计划/测试报告、说明书正式稿 v2、PPT 实际文本、Git 提交记录。
3. 数字复核：2026-11-20 实际运行 `npm run test:unit`（97 通过）与 `npm run test:server`（53 通过），合计 **150 条**。材料中的 147 条为 11-17 旧口径。
4. 未做的事：未打开 DeepWorks 图形界面重新截图；未执行 Supabase 浏览器端到端测试；未修改网站业务代码。平台侧结论以 `competition-submission/deepworks-evidence/` 内已归档证据为准。

---

## 2. 关键事实速览

| 项 | 真实状态 | 证据位置 |
|---|---|---|
| 前端 | React 18 + TypeScript + Vite 6，7 条业务路由 + 4 个认证页 + 账号页，可构建 | `src/`、`package.json` |
| DeepWorks Agent | `film-curator`，primary，模型 `dth/DeepSeek-V4.1-Flash`，温度 0.2 | `.opencode/agents/film-curator.md`、`competition-submission/deepworks-evidence/01-agent-configuration/` |
| 三个 Skills | `cinema-knowledge-retrieval` / `film-note-analysis` / `cinema-taste-profiling`，均有配置与调用证据 | `.opencode/skills/*/SKILL.md`、`02-skills-configuration/` |
| 知识库 | 12 条原创条目（CC BY 4.0）；平台库 `4c321650-6fd5-418f-a300-b4a6760727b4`，12 文档解析完成 | `knowledge/`、`03-knowledge-base/` |
| 平台检索 | 2026-11-16 三次 `sass_search` 真实返回；KB-003 命中 score 0.8177763；界面 T1–T3 命中 | `04-knowledge-retrieval/` |
| 平台召回边界 | 12 条中 10 条出现在检索转录，3 条被主动验证，KB-002/KB-011 缺 `sass_search` 正文哈希 | `FINAL-EVIDENCE-AUDIT.md` |
| 平台独立 Run ID | **未取得**（运行环境无 Run API） | `FINAL-EVIDENCE-AUDIT.md` |
| 质量门 | **3 个验证器 + 4 项检查**，非“4 个验证器” | `06-quality-gates/` |
| 自动化测试 | **150 条通过**（97 前端 + 53 服务端），2026-11-20 实测 | 本轮命令输出 |
| Supabase 代码 | **在 `origin/main` 提交 `17f9e3d`（2026-11-20）**：客户端、会话、认证页、仓储、同步队列；本地工作副本 `main` 落后 16 个提交，需 `git pull` 后复验 | `origin/main:src/lib/supabase/`、`src/auth/`、`src/lib/db/`、`src/lib/sync/` |
| Supabase 数据库 | `0001_schema.sql`（12 表）+ `0002_rls.sql`（同在 `origin/main`）；Auth 健康检查 200；匿名访问被 RLS 拒绝 | `origin/main:supabase/migrations/`、`docs/SUPABASE-TEST-REPORT.md` §2 |
| Supabase 端到端 | **16 项功能测试全部未执行**（注册、登录、跨设备、双账号隔离、迁移、离线队列） | `docs/SUPABASE-TEST-REPORT.md` §3 |
| 真实用户 | 访谈 0 位、真实反馈 0 条；说明书三（三）3.2 的 4 条为模拟反馈，不计入 | 说明书 v3.1 §三（三） |
| 演示视频 | 未制作 | `outputs/submission/` 无 mp4 |

---

## 3. 资产清单

### 3.1 官方赛制与模板（最高依据）

| 资料名称 | 路径 / 位置 | 类型 | 阶段 | 比赛重要 | 已归档 | 需补充 | 重复/过时 |
|---|---|---|---|---|---|---|---|
| 赛制规则整理（含 slide 编号与逐章要求） | `docs/competition-rules-2026.md` | Markdown 规则 | 全程 | 是 | 是 | 无需 | 唯一权威整理版；`competition-review-2026-11-05.md` 为历史评审，结论已被前者取代 |
| 滴普杯赛制说明 PPT | `uploads/ses_e3ac3dce2ffeNZcCVXc52bf7JR/滴普杯-赛制说明(1).pptx` | 官方 PPT | 全程 | 是 | 待复制入包 | 无需 | 多个 uploads 副本内容相同 |
| 路演 PPT 模板 | `uploads/ses_e3ac3dce2ffeNZcCVXc52bf7JR/滴普杯黑客松-路演PPT模板(1).pptx` | 官方 PPT | 材料 | 是 | 待复制入包 | 无需 | 多副本 |
| 项目说明书模板 | `uploads/ses_e3ac3dce2ffeNZcCVXc52bf7JR/项目说明书_模板(1).docx` | 官方 DOCX | 材料 | 是 | 待复制入包 | 无需 | 多副本 |

> 注：控制台曾把中文文件名显示为乱码，实际文件名以 UTF-8 为准，归档脚本按通配符匹配。

### 3.2 产品与设计文档

| 资料名称 | 路径 | 类型 | 阶段 | 比赛重要 | 已归档 | 需补充 | 备注 |
|---|---|---|---|---|---|---|---|
| 产品定位与前端架构 | `docs/frontend-architecture.md` | Markdown | P0 | 是 | 是 | 无需 | 与最新认证路由可能有轻微漂移 |
| 视觉重设计 v5 | `docs/visual-redesign-v5.md` | Markdown | P1 | 是 | 是 | 无需 | 奶油米白 + 深海蓝来源 |
| 前端页面与交互说明 | `README.md` | Markdown | 持续 | 是 | 是 | 需更新 | 仍写“本地存储”，与 Supabase 现状不一致 |
| 视觉截图（v3–v6、重设计） | `outputs/v3-screens/` … `outputs/v6-screens/`、`outputs/redesign-screenshots/` | PNG | P1–P2 | 是 | 待归档精选 | 无需 | 版本多，需按“最终版”标注 |
| 海报与剧照 | `public/images/artwork/` | JPG | 全程 | 是 | 待归档 | 需来源记录 | 7 部电影海报 + backdrop；来源见 `knowledge/SOURCES.md` 与 `scripts/sync-tmdb-artwork.mjs` |

### 3.3 技术架构与数据设计

| 资料名称 | 路径 | 类型 | 阶段 | 比赛重要 | 已归档 | 需补充 | 备注 |
|---|---|---|---|---|---|---|---|
| 数据存储现状审计 | `docs/CURRENT-DATA-STORAGE-AUDIT.md` | Markdown | Supabase 阶段 1 | 是 | 是 | 无需 | 17 类数据逐项定位，迁移依据 |
| Supabase 架构设计 | `docs/SUPABASE-ARCHITECTURE.md` | Markdown | 阶段 2 | 是 | 是 | 无需 | 目标架构与验收门槛 |
| 数据库 Schema | `docs/DATABASE-SCHEMA.md` | Markdown | 阶段 2 | 是 | 是 | 无需 | 12 表说明 |
| SQL 迁移 | `supabase/migrations/0001_schema.sql`、`0002_rls.sql` | SQL | 阶段 2/3 | 是 | 是 | 无需 | 已在真实项目执行（表存在、anon 被拒） |
| 认证与安全 | `docs/AUTHENTICATION-AND-SECURITY.md` | Markdown | 阶段 2 | 是 | 是 | 无需 | 含 RLS 越权 SQL 模板 |
| 数据迁移报告 | `docs/DATA-MIGRATION-REPORT.md` | Markdown | 阶段 4c | 是 | 是 | 需真实结果 | 当前为方案/空结果，不能当已完成 |
| 实施计划 | `docs/SUPABASE-IMPLEMENTATION-PLAN.md` | Markdown | 阶段 2 | 是 | 是 | 需按实际进度更新 | 文中“阶段 4 未开始”已落后于代码现状 |
| 架构决策记录 | `docs/ARCHITECTURE-DECISIONS.md` | Markdown | 阶段 2 | 是 | 是 | 无需 | ADR-001～010，含待决事项 |
| AI Core 设计 | `docs/ai-core.md`、`AI_CORE_SPEC.md`、`AI_ADAPTERS.md` | Markdown | P0 | 是 | 是 | 无需 | 网站端 DeepSeek 契约 |

### 3.4 DeepWorks 平台资产

| 资料名称 | 路径 / 平台 | 类型 | 阶段 | 比赛重要 | 已归档 | 需补充 | 备注 |
|---|---|---|---|---|---|---|---|
| Film Curator Agent 配置 | `.opencode/agents/film-curator.md`；平台 Agent 列表 | Markdown + 平台 | P0 | 是 | 是 | 平台截图已归档 | S01/S02 |
| 三个 Skills | `.opencode/skills/cinema-*/SKILL.md`、`.opencode/skills/film-note-analysis/SKILL.md` | Markdown + 脚本 | P0 | 是 | 是 | 无需 | S03 为 `/` 列表总览 |
| 12 条知识库条目 | `knowledge/entries.json`、`knowledge/index.json` | JSON | P0–P2 | 是 | 是 | 无需 | CC BY 4.0 |
| 平台知识库 ID 映射 | `knowledge/platform-kb.json`、`platform-id-map.json` | JSON | P2 | 是 | 是 | 缺 2 条映射 | KB-002/KB-011 无 sass_search 正文 |
| 平台检索转录 | `competition-submission/deepworks-evidence/04-knowledge-retrieval/*.platform-search.json` | JSON | P2 | 是 | 是 | 无需 | 三次真实返回 |
| 平台运行记录 | `competition-submission/deepworks-evidence/05-agent-execution/run.json` | JSON | P2 | 是 | 是 | 平台独立 Run ID 缺失 | `kb_provider=file`，已如实标注 |
| 平台截图 | `01`–`05` 各目录 S01–S08c | PNG | P2 | 是 | 是 | 无需 | 11 张，用户 11-19 手动补齐 |
| 证据索引与校验 | `EVIDENCE-INDEX.md`、`manifest.json`、`verification.json` | Markdown/JSON | P2 | 是 | 是 | 无需 | 33 文件 SHA256 一致 |
| 工作流脚本 | `workflow/run-p0.mjs`、`validate-*.mjs`、`hash-note.mjs` | Node 脚本 | P0 | 是 | 是 | 无需 | 单命令可重跑 |

### 3.5 测试与运行证据

| 资料名称 | 路径 | 类型 | 阶段 | 比赛重要 | 已归档 | 需补充 | 备注 |
|---|---|---|---|---|---|---|---|
| P0 三次运行 | `outputs/p0/runs/`、`outputs/p0/inputs/` | JSON | P0 | 是 | 待归档 | 无需 | 95 个文件，需按 run 归组 |
| P0 会话证据 | `outputs/p0/evidence/session-01..03.json` | JSON | P0 | 是 | 待归档 | 无需 | 单文件 180–278 KB |
| P1 测试 | `outputs/p1/` | JSON/日志 | P1 | 是 | 待归档 | 无需 | 含 tmp 中间产物，只归档结论 |
| P2 集成 | `outputs/p2/` | JSON/报告 | P2 | 是 | 待归档 | 无需 | 含平台库导入与验证 |
| Taste Evolution 三案例 | `outputs/taste-evolution/phase2/case-a|b|c/` | JSON | P2 | 是 | 是 | 无需 | 契约校验 3/3 |
| Taste Evolution 截图 | `outputs/taste-evolution/screenshots/` | PNG | P2 | 是 | 待归档 | 无需 | 6 张，含前后对比 |
| 演示环境验证 | `DEMO-READINESS-REPORT.md` | Markdown | P0 | 是 | 是 | 测试数字需更新 | 120 条为 11-10 口径 |
| 平台运行报告 | `PLATFORM-RUN-REPORT.md`、`PHASE2-REPORT.md` | Markdown | P2 | 是 | 是 | 与 11-16 证据有时序差异 | 需注明“平台独立 Run 未发生” |
| 自动化测试结果 | 本轮命令输出 | 终端 | 2026-11-20 | 是 | 需落盘 | 建议保存文本 | 150 条 |

### 3.6 比赛提交材料

| 资料名称 | 路径 | 类型 | 阶段 | 比赛重要 | 已归档 | 需补充 | 备注 |
|---|---|---|---|---|---|---|---|
| 说明书正式稿 v3.1 | `outputs/submission/12-项目说明书.md` | Markdown | 11-20 | 是 | 是 | 真实访谈/反馈 | 唯一源文；4 个模拟反馈案例（非访谈） |
| 说明书 DOCX/PDF | `outputs/submission/C_framebyframe_Frame by Frame_项目说明书.docx/pdf` | DOCX/PDF | 11-20 | 是 | 是 | 无需 | v3.1；Word 26 页 / PDF 20 页 |
| 路演 PPTX | `outputs/submission/C_framebyframe_Frame by Frame.pptx` | PPTX | 11-20 | 是 | 是 | 真实用户证据 | 22 页；含 Supabase 产品/架构页与反馈页 |
| 文档同步规范 | `PROJECT-DOCUMENTATION-SYNC.md` | Markdown | 11-20 | 是 | 是 | 逐次追加台账 | 七步流程与材料矩阵 |
| 路演文案与口播 | `08-路演PPT逐页文案`、`09-路演口播稿-7min` | Markdown | 11-18/19 | 是 | 是 | 需补 Supabase | 7 分钟口径 |
| 合规自查 | `outputs/submission/01-合规自查.md` | Markdown | 11-17 | 是 | 是 | 无需 | 授权与公开冲突已记录 |
| 待补清单 | `06-待补清单.md`、`11-待本人确认事项清单-20261119.md` | Markdown | 11-19 | 是 | 是 | 无需 | 用户需处理事项 |
| 证据包 | `competition-submission/deepworks-evidence/` | 目录 | 11-19 | 是 | 是 | 无需 | 33 文件，已校验 |

### 3.7 源代码与部署

| 资料名称 | 路径 | 类型 | 阶段 | 比赛重要 | 已归档 | 需补充 | 备注 |
|---|---|---|---|---|---|---|---|
| 前端源码 | `src/` | TS/TSX | 全程 | 是 | 待复制 | 无需 | 含认证、仓储、同步 |
| AI 网关 | `server/` | TS | P0 | 是 | 待复制 | 无需 | 无状态 DeepSeek 网关 |
| Worker 入口 | `server/worker.deepseek.ts` | TS | P0 | 是 | 待复制 | 无需 | 部署链路 |
| 构建配置 | `vite.config.ts`、`tailwind.config.js`、`tsconfig*.json` | 配置 | 全程 | 是 | 待复制 | 无需 | — |
| GitHub Actions | `.github/workflows/deploy.yml` | YAML | 全程 | 是 | 待复制 | 需核对 Supabase 变量 | Pages 部署 |
| 历史链路归档 | `legacy/` | 配置/文档 | P0 | 否 | 待复制 | 无需 | Cloudflare/云函数旧方案，仅供追溯 |
| 桌面启动器 | `FrameByFrame-Launcher/` | PS1/BAT | 演示 | 是 | 待复制 | 无需 | 本地演示启动与自检 |

### 3.8 官方模板与素材来源

| 资料 | 位置 | 说明 |
|---|---|---|
| 赛制 PPT | `uploads/.../滴普杯-赛制说明(1).pptx` | slide 3–10 被逐条引用 |
| 路演模板 | `uploads/.../滴普杯黑客松-路演PPT模板(1).pptx` | 8 页结构 |
| 说明书模板 | `uploads/.../项目说明书_模板(1).docx` | 五部分固定结构 |
| 知识库来源 | `knowledge/SOURCES.md` | 12 条条目的作品、年份、许可 |
| 海报来源 | `scripts/sync-tmdb-artwork.mjs`、`knowledge/SOURCES.md` | TMDB 图片，仅取图 |

---

## 4. 重复与过时版本

| 类别 | 重复/过时 | 处理建议 |
|---|---|---|
| 说明书 | `02-项目说明书初稿.md`、`04-项目说明书正式版.md`、`07-...v2...md` | 以 v2 为基线生成 v3（本轮），旧稿标注“历史版本”保留 |
| PPT | `_work/build/deck-fix.pptx`、`uploads/.../C_framebyframe_Frame by Frame.pptx` | 以 `outputs/submission/` 最新 19 页版为基线 |
| 测试数字 | 51（README 旧）、120（11-10）、147（11-17）、97（Supabase）、150（11-20 实测） | 统一为“150 条（97 前端 + 53 服务端），2026-11-20 实测”；历史数字注明日期 |
| 知识库表述 | “文件型知识库，未接平台” | 更新为“平台知识库已建并验证检索；全量召回未验证” |
| 数据存储表述 | “只存 localStorage” | 更新为“本地优先 + Supabase 云端持久化；端到端待验” |
| 平台 Run | “已取得平台 Run” | 事实为“会话内运行有证据，平台独立 Run ID 未取得” |
| 质量门 | “四道质量门验证器” | 统一为“3 个验证器 + 4 项检查” |
| uploads 副本 | 多个 recovery 目录含同一模板 | 不删除，归档时只取一份并记录来源 |

---

## 5. 缺失与需要补充

### 5.1 可由我继续补的

- 归档目录与清单、ZIP、说明书 v3、PPT 更新、演示脚本、交付报告。
- 测试结果文本落盘（150 条）。
- 素材来源与第三方依赖清单。

### 5.2 必须由本人提供的

| # | 事项 | 原因 |
|---|---|---|
| 1 | 报名回执、队名/赛道确认 | 资格检查，仓库内无回执 |
| 2 | 3–5 位目标用户访谈记录（人数/日期/时长/原话） | 官方 30 分项硬要求，当前为 0 |
| 3 | ≥2 位用户反馈原话 + 日期 + 改进动作 | 官方 30 分项硬要求 |
| 4 | 3 分钟以内演示视频 | 官方必交材料，仓库内无 mp4 |
| 5 | 合规第 3 项“决赛前未公开”的处理决定 | 网站当前公开，与规则冲突 |
| 6 | Supabase 项目最终 Site URL / Redirect URL、是否开启邮箱验证 | 影响现场演示流程 |
| 7 | 是否执行 Supabase 端到端测试并提供截图 | 决定能否写“多用户已完成” |

---

## 6. 平台侧与仓库侧的边界

| 能力 | DeepWorks 平台侧 | 网站侧 |
|---|---|---|
| Agent 运行 | `film-curator` 真实运行，有会话与截图 | 不调用 Agent |
| Skills | 三个 Skill 真实调用 | 无 |
| 知识库 | 平台库 12 文档，检索已验证 | 本地文件库作离线副本 |
| 笔记分析 | Agent 产出结构化 JSON | 网站调用 DeepSeek 网关，独立链路 |
| 用户与持久化 | 不承担 | Supabase（Auth + Postgres + RLS） |

**红线**：不得写“网站背后是 DeepWorks Agent”；不得写“平台 Run ID 已取得”；不得写“12 条全部召回验证通过”。

---

## 7. 敏感信息（禁止进入提交包）

| 文件 | 内容 | 处理 |
|---|---|---|
| `.env`、`.env.local`、`.dev.vars.example` | API Key、Supabase URL/Key | 排除，仅保留 `.env.example` 的变量名 |
| `uploads/**` | 含个人信息、历史会话 | 只取官方模板，不整目录复制 |
| `FrameByFrame-Launcher/logs/**` | 本机路径与运行日志 | 排除日志 |
| `node_modules/`、`dist/`、`.git/` | 体积与构建产物 | 排除 |
| `outputs/**/session-*.json` | 可能含会话上下文 | 归档前做敏感字段检查，必要时只保留摘要 |

---

## 8. 盘点结论

1. **可归档的成果充足**：代码、SQL、Agent/Skills/知识库、运行 JSON、11 张平台截图、三案例演化证据、150 条测试。
2. **最大事实风险**：Supabase 已写代码但未做浏览器端到端；材料必须写“已实现/待验证”，不能写“已上线”。
3. **最大材料缺口**：用户访谈、用户反馈、3 分钟视频、报名回执——只能由本人补。
4. **最大口径风险**：网站与平台两条 AI 链路必须分开表述；测试数字必须统一为 150 条。
