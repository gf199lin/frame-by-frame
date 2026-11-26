# Frame by Frame — 最终项目交付报告

> 报告日期：2026-11-20 19:10（UTC+08:00）
> 执行范围：全项目资料盘点 → 官方赛制核对 → 归档建包 → 说明书更新 → PPT 更新 → 演示脚本 → 用户反馈章节重写 → 一致性检查
> 事实原则：只写已落盘、可核对的内容；规划与未执行项单独标注

---

## 0. 一页结论

| 问题 | 结论 |
|---|---|
| 资料归档完成了吗？ | 完成。861 个文件、55.21 MB，按 00–08 九类归档，含清单与 CSV |
| 官方材料齐了吗？ | 说明书、PPT、平台证据、代码、附件有；**3 分钟视频、真实用户访谈、真实反馈、报名回执缺** |
| 说明书更新了吗？ | 完成 v3.1，新增 3.1–3.7 产品与双端架构，修正“只存本地”，统一 150 条测试，用户反馈改为 4 个模拟案例（非访谈） |
| PPT 更新了吗？ | 完成。19 → 22 页，新增“账号、云端与记忆”“两条 AI 链路”“四条反馈，四次改版”，修正 147→150、数据表述 |
| Supabase 写成完成了吗？ | 没有。明确区分“代码与基础设施已接入”与“端到端未执行” |
| 文档同步机制有了吗？ | 有。`PROJECT-DOCUMENTATION-SYNC.md` 定义七步流程、材料矩阵与台账 |
| 演示脚本有了吗？ | 有。区分可现场演示 / 仅截图 / 不可演示，含故障预案与问答 |
| 能直接提交吗？ | 材料主体可以；但需先补视频、访谈、合规第 3 项决定 |

---

## 1. 项目资料归档完成情况

### 1.1 建包结果

- 根目录：`Frame-by-Frame-Competition-Package/`
- 文件数：**861**
- 总大小：**55.21 MB**
- 清单：`00_README/FILE-MANIFEST.md` + `FILE-MANIFEST.csv`（逐文件路径、字节数、修改时间）
- 压缩包：`Frame-by-Frame-Competition-Package.zip`（见第 9 节）

### 1.2 九类归档

| 目录 | 内容 | 文件数 | 状态 |
|---|---|---:|---|
| `00_README/` | README、项目概览、文件清单 | 4 | 完成 |
| `01_OFFICIAL-SUBMISSION/` | 说明书 DOCX/PDF、PPTX/PDF、官方模板、合规自查、口播稿 | 11 | 完成（视频缺） |
| `02_PROJECT-DOCUMENTATION/` | 架构、数据、AI、Supabase、安全、报告 | 45 | 完成 |
| `03_SOURCE-CODE/` | 网站、后端、迁移、工作流、配置 | 158 | 完成（已排除密钥） |
| `04_DEEPWORKS-PLATFORM/` | Agent、3 Skills、知识库、33 份平台证据 | 64 | 完成 |
| `05_TESTING-AND-EVIDENCE/` | P0/P1/P2、Taste Evolution、Supabase、安全 | 516 | 完成 |
| `06_DESIGN-ASSETS/` | 海报、最终 UI 截图、演化对比 | 31 | 完成（精选） |
| `07_DEMO-MATERIALS/` | 启动器、演示环境验证 | 7 | 完成 |
| `08_CHANGELOG-AND-HISTORY/` | CHANGELOG、ADR、v1/v2 历史版本 | 7 | 完成 |

### 1.3 归档原则执行

- 原始证据未被覆盖：包内是副本，仓库原文件保持原位。
- 历史版本保留：v1/v2/v3 说明书与 v1 PPT 放入 `08_CHANGELOG-AND-HISTORY/`，不删除。
- 重复文件未删除：`uploads/` 多副本不动，包内只取一份官方模板。
- 大体量素材精选：`outputs/v6-screens` 取 12 张、演化截图 6 张；原始仍在仓库。
- 敏感信息排除：`.env`、`.env.local`、`uploads/` 会话、`node_modules`、`.git`、启动器日志。
- 安全抽检：对 P0 证据、知识库、平台证据检索 `sk-*`、`eyJ*`、`service_role`、`DEEPSEEK_API_KEY`，命中 0。

---

## 2. 官方比赛材料完成情况

依据：`docs/competition-rules-2026.md`（官方赛制 PPT / 说明书模板 / 路演模板逐页整理）。

| 官方材料 | 要求 | 现状 | 状态 |
|---|---|---|---|
| 项目说明书 | 官方五部分、顺序不变 | v3.1，五部分齐全；反馈为 4 个模拟案例 | 部分完成（真实访谈/反馈缺） |
| 路演 PPT | 8 页核心结构、≤7 分钟 | 22 页，三 PART 与致谢齐全 | 部分完成（需排练） |
| 演示视频 | ≤3 分钟 | 无 mp4 | **未完成** |
| 交付附件 | 代码、技能、知识库、启动、来源、依赖 | 已归档 | 完成 |
| DeepWorks 使用证明 | Agent/Skills/知识库/运行 | 33 份证据，11 张截图 | 基本完成（Run ID 缺） |
| 命名与打包 | 赛道_队名_项目名称 | 已按 `C_framebyframe_...` | 完成 |
| 报名回执 | 资格检查 | 仓库无 | **需本人** |
| 合规公开 | 决赛前不公开 | 网站公开 HTTP 200 | **冲突，需决定** |

### 2.1 得分风险提示

- 二（一）竞品分析 10 分：竞品对比完整，但“问题证据”是假设，未做 3–5 位访谈；
- 三（三）样例与反馈 10 分：样例 6 条；模拟反馈 4 条已写入，但真实用户反馈原话仍为 0 条；
- 四 迭代记录 10 分：3 条详录，但效果缺用户数据、部分时间无时分；
- 五 最终成品 30 分：现场演示与可复现材料有，视频缺。

**结论**：不补访谈与反馈，20 分无法拿满；不录视频，最终成品项有硬缺口。

---

## 3. 项目说明书更新情况

### 3.1 产物

| 文件 | 说明 |
|---|---|
| `01_OFFICIAL-SUBMISSION/C_framebyframe_Frame by Frame_项目说明书.docx` | 可编辑，13 个表格 + 11 张平台截图 |
| `01_OFFICIAL-SUBMISSION/C_framebyframe_Frame by Frame_项目说明书.pdf` | 20 页（v3.1） |
| `01_OFFICIAL-SUBMISSION/12-项目说明书.md` | 源文，便于继续修改 |

### 3.2 相对 v2 的具体修改

| # | 位置 | 修改 |
|---|---|---|
| 1 | 标题/版本 | v2 → v3 → v3.1；注明 2026-11-20 更新范围与反馈章节口径 |
| 2 | 一（二）关键节点 | 新增 11-19 Supabase 审计与架构、11-20 认证与同步接入 |
| 3 | 一（三）赛前基础 | 平台知识库表述更新：12 文档解析 + `sass_search`/T1–T3 验证；补 KB-002/011 边界 |
| 4 | 二（二）数据行 | “只存 localStorage，不上传云端” → “本地优先 + Supabase 云端持久化” |
| 5 | 二（二）新增 3.1–3.7 | 产品定位、9 项核心功能、双端架构图、两条 AI 链路、Supabase 职责与真实状态、认证与安全、AI 如何逐渐理解用户、成果与验证边界 |
| 6 | 三（一）任务 6 | 明确“代码与数据库已接入；浏览器端到端未执行” |
| 7 | 四 版本记录 | 147 → 150 条（97 + 53，2026-11-20 实测） |
| 8 | 五（四）附件 | 第三方依赖、隐私说明、源代码状态更新 |
| 9 | 文末清单 | 删除已完成的学号/授权/截图项；保留访谈、反馈、视频、合规、回执、Supabase 测试 |
| 10 | 三（三）3.2 | 由“待补占位”改为 4 个模拟反馈案例（视觉/排版/数据/证据），每条含问题、决策、改进、证据与时间口径；显式声明真实访谈 0 位 |

### 3.3 新增内容的核心事实

- **产品功能 9 项**：档案、笔记、AI 分析、纠错、六维画像、Taste Evolution、记忆图谱/年鉴、账号与云端、Agent 导入；每项标“已实现/待验证”。
- **架构图**：用户 → Web → Supabase（Auth + PostgreSQL + RLS）→ 个人记忆空间；Web → DeepSeek 网关；DeepWorks 侧 Agent + 3 Skills + 12 条知识库。
- **Supabase 组件表**：Auth、PostgreSQL、RLS、缓存队列、Realtime、Storage、迁移，逐项写真实状态。
- **边界声明**：网站不实时调用 Agent；Agent 不驱动网站；Supabase 不取代 DeepSeek 或 DeepWorks。

### 3.4 格式

- A4；正文仿宋 + Times New Roman；小四 12pt；1.5 倍行距；标题黑体；
- 表格宋体 9.5pt；代码块等宽 9pt；
- 已删除模板红色示例（v2 起即无）。

---

### 3.5 截图证据恢复（2026-11-20 修正）

v1 说明书（`C_framebyframe_材料说明.docx`）内含 11 张 DeepWorks 平台截图；v2 重写时未带入，导致 v2/v3 首版只有文字、没有图。本轮已恢复：

- 从 v1 DOCX 提取 image1–11，存为 `assets/platform-evidence/fig01–11.png`；
- 在 v3 新增“（四）平台使用证明截图（附件 6）”，含 11 图与逐条图注；
- DOCX 生成器支持图片与图注，PDF 同步渲染；
- 说明书 PDF 由 13 页增至 **18 页**，DOCX 由 31 KB 增至 **1.9 MB**。

同时核对：**“个人主页美术风格复用”段落并未删除**，仍在 v3 一（三）中，含配色 `#f4ead2 / #1d2379 / #161c66`、Instrument Serif + Noto Serif SC、版式语言与“改造部分”边界。

另补回两处被压缩的边界披露：任务 1–3 由开发者本人作为第 0 号用户完成；证据条数 4–5 浮动、单次 96–135 秒、三种检索不混写。

### 3.6 示例片库显式标注（2026-11-20 新增）

问题：首次进入（本地与云端新账号）默认出现 10 部电影，笔记为原型撰写，但页面没有明显标识，容易与“真实用户 0 位”的材料表述冲突。

处理（保留演示效果，同时消除误解）：

- **首屏横幅**：有示例记录时显示“当前片库为 10 部示例电影”，说明笔记为原型撰写、不是真实用户记录，并提供“添加我的电影 / 清空示例”两个动作。
- **封面角标**：最新一帧的标题上方标注“示例记录 · 非真实用户数据”。
- **一键清空**：新增 `clearSeed()`，只删除 `source === 'seed'` 的记录及其分析、导入观察与观察反馈；用户自己添加的记录和自定义电影不受影响。清空前需二次确认。
- **云端一致**：清空经现有 diff → `note.delete` 软删除链路同步，不会留下孤立行。
- **说明书同步**：3.2 功能表新增“示例片库”一行；任务表下补充“示例不计入任何任务记录”。

验证：`tsc -b` 通过、`vite build` 通过、前端 97 条与后端 53 条测试全过（150/150）。包内 DOCX 因 WPS 占用暂以 `_最终版` 提供；ZIP 内已用最新版覆盖正式文件名。

## 4. 路演 PPT 更新情况

### 4.1 产物

| 文件 | 页数 | 说明 |
|---|---:|---|
| `C_framebyframe_Frame by Frame.pptx` | 21 | 可编辑，保留原视觉 |
| `C_framebyframe_Frame by Frame.pdf` | 21 | LibreOffice 导出，放映兜底 |

### 4.2 变更明细

| 页 | 变更 | 原因 |
|---|---|---|
| 第 7 页（可行性） | “数据：笔记本地存储” → “数据：Supabase 云端持久化” | 原表述已过时 |
| 第 15 页（结果总览） | 147 → 150 条测试 | 2026-11-20 实测 |
| 第 17 页（结果数据） | 147 → 150；94 单元 → 97 前端 | 同上 |
| 第 18 页（迭代） | 147 → 150 | 同上 |
| 新增第 14 页 | `02 · PRODUCT`《账号、云端与记忆》 | 产品功能页体现 Supabase |
| 新增第 15 页 | `02 · ARCHITECTURE`《两条 AI 链路》 | 技术架构页体现 Supabase/DeepSeek/DeepWorks |

### 4.3 新增页内容

**产品能力页**（5 条）：
1. 多用户注册登录：邮箱 + 密码，各自独立空间；
2. 云端持久化：笔记、分析、画像、快照写入 Supabase；
3. 跨设备同步：手机与电脑登录同一账号，看到同一份记忆；
4. 权限隔离：RLS，只能读写自己的数据；
5. 真实状态：代码与 12 表已接入；端到端测试待执行。

**架构页**（5 条）：
1. 用户（电脑 / 手机）→ Frame by Frame Web；
2. Supabase：Auth + PostgreSQL + RLS，存账号与记忆；
3. DeepSeek 网关：只分析当前笔记，不保存数据；
4. DeepWorks：film-curator + 3 Skills + 12 条知识库；
5. 边界：网站不调用 Agent；平台不驱动网站。

### 4.4 视觉

- 新页复制自同套 `02 · AGENT` 版式：背景、右上装饰、字体、#333333 文字、15pt、• 项目符号均一致；
- 保留奶油米白 + 深海蓝；无红色、无紫色渐变、无 Dashboard 风格；
- 使用真实截图与真实运行数据，未生成假界面；
- 原文“一条笔记走完七步与四道质量门”等表述保留，但质量门口径以证据审计为准（3 验证器 + 4 检查）。

### 4.5 官方结构对照

| 官方页 | 本 deck |
|---|---|
| 封面 | 第 1 页 |
| PART 01 项目介绍 | 第 2–7 页 |
| PART 01 章节页 | 第 3 页 |
| PART 02 实现方法 | 第 8–13 页 + 新增 14–15 页 |
| PART 02 章节页 | 第 9 页 |
| PART 03 结果展示 | 第 16–21 页（含第 20 页用户反馈、第 21 页迭代） |
| PART 03 章节页 | 第 16 页 |
| 致谢 | 第 22 页 |

结构覆盖官方三段；新增页不挤掉必答内容。

---

## 5. Supabase 架构更新情况

### 5.1 逐项核实

| 检查项 | 结论 | 证据 |
|---|---|---|
| Supabase 项目是否已创建 | **是**（真实项目已可访问） | `docs/SUPABASE-TEST-REPORT.md` §2：Auth health 200；REST 返回 401/42501 而非域名错误 |
| 数据库是否已建立 | **是**，12 张表 | `0001_schema.sql`；`profiles`/`watch_notes`/`taste_snapshots` 匿名查询被拒，说明表存在 |
| Auth 是否已配置 | **部分**：Email 服务可达，SDK 可用 | `signInWithPassword` 对不存在账号返回 `400 invalid_credentials`（非 invalid api key） |
| RLS 是否已启用并测试 | **已启用，未做双账号测试** | `0002_rls.sql`；anon 被拒；T10/T14 未执行 |
| 历史数据是否已迁移 | **否** | `DATA-MIGRATION-REPORT.md` 为空结果；T05 迁移未执行 |
| 手机与电脑是否同步测试 | **否** | T09 未执行 |
| 注册、登录是否真实运行 | **否**（UI 未端到端） | T01–T04 未执行；只有 SDK/服务层检查 |

### 5.2 代码接入状态

| 模块 | 文件 | 状态 |
|---|---|---|
| Supabase 客户端 | `src/lib/supabase/client.ts`、`auth.ts` | 已接入 |
| 会话 Provider | `src/auth/session.tsx` | 已接入 `App.tsx` |
| 认证四页 | `src/pages/auth/SignIn/SignUp/Forgot/Reset` | 已实现 |
| 路由守卫 | `src/App.tsx` | 未登录跳转；未配置时提示 |
| 仓储层 | `src/lib/db/{map,remote,rows}.ts` | 已实现 |
| 同步队列 | `src/lib/sync/{diff,queue}.ts` | 已实现 |
| 账号页 | `src/pages/Account.tsx` | 已实现 |
| AppStore 接入 | `src/store/AppStore.tsx` | 云端 hydrate + 后台写入 |
| SQL 迁移 | `0001_schema.sql`（12 表）、`0002_rls.sql` | 已执行 |
| 单元测试 | 97 前端 + 53 服务端 | 通过 |

### 5.3 材料中的表述

- 说明书 3.4 用“组件—用途—真实状态”三列表，逐项标注“未执行/未启用”；
- PPT 新增页第 5 条直接写“端到端测试待执行”；
- README 的事实口径表明确“不得写成已上线”；
- 交付报告不把“基础设施 PASS”等同于“多用户完成”。

---

## 6. 演示资料准备情况

| 交付 | 状态 | 说明 |
|---|---|---|
| `FINAL-DEMO-SCRIPT.md` | 完成 | 7 分钟时间轴、3 分钟分镜、可演示/仅截图/不可演示三张表、问答、故障预案 |
| PPT 放映版 | 完成 | 22 页 PPTX（PDF 可现场导出） |
| 平台证据截图 | 已有 | S01–S08c，11 张 |
| 已跑运行产物 | 已有 | `run.json`、P0 三次、Phase2 三案例 |
| 网站演示入口 | 已有 | 公网 Pages + 本地 dev |
| 演示视频 | **未完成** | 需本人录制 |
| 现场排练 | **未执行** | 建议 11-23 前至少 2 次 |

---

## 7. 尚未完成的事项

### 7.1 产品与技术

| # | 事项 | 状态 | 影响 |
|---|---|---|---|
| 1 | Supabase T01–T16 端到端测试 | 未执行 | 不能宣称多用户完成 |
| 2 | 双账号 RLS 越权测试（T10/T14） | 未执行 | 数据隔离只有策略，无行为证据 |
| 3 | 跨设备同步（T09） | 未执行 | 核心卖点缺现场证据 |
| 4 | 历史 localStorage 迁移 | 未执行 | 老用户数据无法上云 |
| 5 | 断网队列与并发冲突（T15/T16） | 未执行 | 弱网体验未验证 |
| 6 | 平台独立 Run ID | 不可得 | 运行环境无 Run API |
| 7 | 12 条知识库全量召回 | 未验证 | KB-002/011 缺正文哈希 |
| 8 | Realtime / Storage | 未启用 | 已在 ADR 中说明非本期范围 |

### 7.2 材料

| # | 事项 | 状态 |
|---|---|---|
| 1 | 3 分钟演示视频 | 未制作 |
| 2 | 3–5 位用户访谈 | 0 位（模拟反馈 4 条已单列，不计入） |
| 3 | ≥2 条用户反馈原话 | 0 条 |
| 4 | 报名回执 | 仓库无 |
| 5 | 合规第 3 项决定 | 未决 |
| 6 | 7 分钟现场排练 | 未执行 |
| 7 | 第三方依赖清单 | 本轮已用 package.json + 文档整理，仍需本人确认无遗漏 |

---

## 8. 需要本人处理的事项

按优先级：

1. **报名回执**：确认已报名、队名 `framebyframe`、C 赛道、个人参赛信息一致。
2. **合规第 3 项**：网站当前公开（`https://gf199lin.github.io/frame-by-frame/`），与“决赛前未公开”冲突。二选一：
   - 赛前将站点设为不可公开访问；或
   - 取得组委会对“展示页公开”的书面认可。
   不要在未处理的情况下勾选“未公开”。
3. **用户访谈**：3–5 位目标用户，记录人数、日期、时长、频次、原话与归纳，补入说明书二（一）。
4. **用户反馈**：≥2 条真实原话 + 日期 + 具体改进动作，补入三（三）；当前 4 条为模拟反馈，已在材料中标注，不可计入真实用户研究。
5. **演示视频**：≤3 分钟，按 `FINAL-DEMO-SCRIPT.md` 分镜录制，命名 `C_framebyframe_Frame by Frame.mp4`。
6. **Supabase 决定**：
   - 是否在 11-23 前执行 T01–T16？若执行，至少完成注册、登录、刷新、跨设备、双账号隔离，并截图；
   - 是否开启邮箱验证（影响现场演示）；
   - 是否启用头像 Storage。
7. **现场排练**：按 7 分钟时间轴至少 2 次，确认 Agent 超时切兜底。
8. **最终目检**：DOCX 字体/行距、PPT 新增页在投影上的可读性、PDF 页码。

---

## 9. 最终交付文件路径

### 9.1 根目录（仓库工作区）

| 文件 | 用途 |
|---|---|
| `PROJECT-ASSET-INVENTORY.md` | 全项目资料盘点 |
| `COMPETITION-SUBMISSION-CHECKLIST.md` | 官方赛制逐项核对 |
| `PROJECT-DOCUMENTATION-SYNC.md` | 长期文档同步规范与台账 |
| `FINAL-DEMO-SCRIPT.md` | 演示脚本 |
| `FINAL-PROJECT-DELIVERY-REPORT.md` | 本报告 |
| `Frame-by-Frame-Competition-Package/` | 完整资料包 |
| `Frame-by-Frame-Competition-Package.zip` | 压缩包 |

### 9.2 包内最终提交物

| 文件 | 路径 |
|---|---|
| 项目说明书 DOCX | `Frame-by-Frame-Competition-Package/01_OFFICIAL-SUBMISSION/C_framebyframe_Frame by Frame_项目说明书.docx` |
| 项目说明书 PDF | `Frame-by-Frame-Competition-Package/01_OFFICIAL-SUBMISSION/C_framebyframe_Frame by Frame_项目说明书.pdf` |
| 路演 PPTX | `Frame-by-Frame-Competition-Package/01_OFFICIAL-SUBMISSION/C_framebyframe_Frame by Frame.pptx` |
| 路演 PDF | `Frame-by-Frame-Competition-Package/01_OFFICIAL-SUBMISSION/C_framebyframe_Frame by Frame.pdf` |
| 说明书源文 | `Frame-by-Frame-Competition-Package/01_OFFICIAL-SUBMISSION/12-项目说明书.md` |
| 文件清单 | `Frame-by-Frame-Competition-Package/00_README/FILE-MANIFEST.md` |
| 逐文件 CSV | `Frame-by-Frame-Competition-Package/00_README/FILE-MANIFEST.csv` |

### 9.3 关键证据入口

| 内容 | 路径 |
|---|---|
| 平台证据索引 | `04_DEEPWORKS-PLATFORM/Platform-Evidence/EVIDENCE-INDEX.md` |
| 证据边界审计 | `04_DEEPWORKS-PLATFORM/Platform-Evidence/FINAL-EVIDENCE-AUDIT.md` |
| 质量门结果 | `04_DEEPWORKS-PLATFORM/Platform-Evidence/06-quality-gates/` |
| 一次完整运行 | `04_DEEPWORKS-PLATFORM/Platform-Evidence/05-agent-execution/run.json` |
| Supabase 测试报告 | `05_TESTING-AND-EVIDENCE/Supabase/SUPABASE-TEST-REPORT.md` |
| 数据现状审计 | `02_PROJECT-DOCUMENTATION/01_Architecture-and-Design/CURRENT-DATA-STORAGE-AUDIT.md` |
| 架构决策 | `02_PROJECT-DOCUMENTATION/01_Architecture-and-Design/ARCHITECTURE-DECISIONS.md` |
| 三案例演化 | `05_TESTING-AND-EVIDENCE/Taste-Evolution/phase2/` |

---

## 10. 已执行的动作（可复核）

### 10.0 第一轮：归档与 v3

1. 目录与文件盘点：根目录、docs、outputs、knowledge、workflow、supabase、src、server、competition-submission、legacy、Launcher、public、uploads。
2. 读取官方规则 `docs/competition-rules-2026.md`（263 行）并逐项映射。
3. 读取 Supabase 审计/架构/计划/测试报告、数据现状审计、ADR、证据审计、说明书 v2。
4. 实际运行 `npm run test:unit`（97 通过）与 `npm run test:server`（53 通过），确认 150 条。
5. 生成说明书 v3（Markdown），用 docx 库生成 DOCX（13 表 + 11 图），用 Edge 打印 PDF。
6. 解包现有 PPTX，修改 4 页文本，复制同版式新增 2 页，重打包为 21 页；导出 PDF。
7. 建立 00–08 归档目录，复制并精选资料；排除敏感文件；抽检密钥命中 0。
8. 生成 README、项目概览、文件清单（MD + CSV）。
9. 生成演示脚本与交付报告。
10. 打包 ZIP。

### 10.3 第二轮：v3.1 反馈章节与同步机制

1. 新增 `PROJECT-DOCUMENTATION-SYNC.md`（七步流程、改动矩阵、事实来源、版本规则、台账）。
2. 重写说明书三（三）3.2：4 个模拟反馈案例，六段式结构，逐条落到提交/文件/截图。
3. 更新版本头、关键节点、3.7 边界、迭代记录、附件 8、文末待办。
4. 重新生成 DOCX（613 段）与 PDF（20 页）；归档 v3 至 `08_CHANGELOG-AND-HISTORY/`。
5. PPT 复制迭代页版式新增第 20 页「四条反馈，四次改版」，结果页「访谈进行中」改为「尚未访谈」。
6. 更新 CHANGELOG、提交清单、交付报告、资产清单、README、比赛包与 ZIP。

### 10.1 质量门

| 检查 | 结果 |
|---|---|
| DOCX 可解压、含 Supabase/150/架构章节 | 通过 |
| PDF 页数 | 20 页（说明书 v3.1）、PPT 22 页 |
| PPTX 解压后 22 个 slide、22 个 sldId、22 条 rels | 通过 |
| 新增页文本与设计 | 通过（XML 文本核对） |
| 说明书关键文本 | 通过（v3.1 / 模拟反馈 / 反馈案例 01–04 / 提交哈希全部命中） |
| 证据密钥抽检 | 0 命中 |
| 数字一致性 | 说明书、PPT 均为 150 条 |
| Supabase 表述 | 全文无“多用户已上线/已完成” |

### 10.2 已知限制

- 未在真实投影上目检新增 PPT 页；建议本人打开 PPTX 检查字距与换行。
- LibreOffice 导出的 PDF 与 PowerPoint 渲染可能有细微差异；正式放映优先用 PPTX。
- 说明书 PDF 由 Edge 打印，字体嵌入正常，但不同机器打开可能有分页差异。
- 未重新执行平台 Agent 运行；平台证据沿用 11-19 归档。
- 未执行 Supabase 端到端；所有相关表述保持“待验证”。

---

## 11. 结论

本轮（v3.1）完成了用户反馈章节的可回溯重写与同步机制建立：说明书 20 页、PPT 22 页，4 个模拟案例均标注非真实访谈，并逐条落到提交与文件；真实访谈仍为 0。

距离可提交还差三件硬事：**真实用户访谈/反馈、3 分钟视频、合规公开决定**；若要把“多用户”写成已完成，还需先跑 Supabase 端到端。
