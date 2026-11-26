# Platform KB · 创建与接入报告（执行中）

> 日期：2026-11-10
> 分支 / HEAD：`p1.1-profile-v2` / `e27142a`
> 工作区状态：73 项未提交；`film-curator.md` 与三个 Skill 目录为 untracked（版本未固化，对应 B-09）
> 本轮性质：**只读核查 + 生成迁移素材 + 备份后改造检索层（已获授权）**。未创建平台知识库，未修改网站、Worker、函数、DeepSeek 调用，未提交 Git。

---

## 0. 执行状态总览（先看这张表）

| 步骤 | 状态 | 说明 |
|---|---|---|
| 核查本地 12 条知识 | ✅ 完成 | 数量、字段、重复、字数均已核对 |
| 生成平台可导入素材 | ✅ 完成 | 12 个单条文档 + 合并版 + manifest |
| 检索层双 provider 改造 | ✅ 完成（已授权） | 默认 file 行为不变；新增 platform 适配器与回退记录 |
| 平台知识库创建 | ⛔ **BLOCKED** | 本轮未获授权访问知识中心界面/接口，不得代替用户创建 |
| 平台内检索测试（≥5 组） | ⛔ **BLOCKED** | 依赖上一项，且禁止用本地脚本结果冒充平台结果 |
| Agent 与知识库绑定 | ⛔ **BLOCKED** | 平台侧绑定方式未知；且现有 Agent/Skill 硬编码本地库 |
| Agent 联动测试（≥3 组） | ⛔ **BLOCKED** | 依赖绑定完成 |
| 现场演示流程 | 🟡 已出草稿 | 见第 7 节，平台步骤待真实执行后补截图 |
| 截图证据 | ⛔ **未采集** | `outputs/p2/evidence/platform-kb/` 仅有占位说明，无真实截图 |

**结论：本任务不能标记为完成。** 已完成的是“可导入素材 + 差距定位 + 必改清单”，不是“平台知识中心已建成”。

---

## 1. 本地知识库核查

文件：`knowledge/entries.json`

| 项 | 实测值 |
|---|---|
| 版本 | `1.0.0` |
| 条目数 | **12**（KB-001 … KB-012，ID 连续无缺号） |
| 字段并集 | `id, title, domain, source, license, tags, text` |
| 必需字段缺失 | **0** |
| 正文重复 | **0** |
| 单条正文长度 | 145 – 172 字 |
| 正文总字数 | 1872 |
| 分类分布 | narrative 4、character 2、emotion 1、ending 1、visual 2、sound 1、thematic 2 |
| 授权 | `CC BY 4.0（本项目原创摘要）` |
| 内容哈希 `kb_version` | `1d5d037e321b423bb51fffe38f108d5785cefe3be0bada64c376b6d2a6a86f3f` |

`knowledge/index.json` 与 `knowledge/SOURCES.md` 与上述一致，无需修正。

**格式兼容性备注：** 单条正文 145–172 字，远小于常见切分窗口，天然适合“一条一文档”。若平台对整篇 `ALL-ENTRIES.md` 自动切分，可能出现“ID 与正文被切开”的情况，因此**优先上传 12 个单条文件**。

---

## 2. 原始知识与平台知识的对应关系

平台文档名已按 `ID-分类.md` 固定，导入后可直接回查。

| 平台文档 | 原始 ID | 标题 | 分类 | 字数 |
|---|---|---|---|---|
| `KB-001-narrative.md` | KB-001 | 叙事：因果链、省略与留白 | narrative | 见 manifest |
| `KB-002-character.md` | KB-002 | 人物：欲望、缺陷与转变 | character | 见 manifest |
| `KB-003-emotion.md` | KB-003 | 情绪：克制、间离与延迟反应 | emotion | 见 manifest |
| `KB-004-ending.md` | KB-004 | 结局：闭合、开放与苦涩的未解 | ending | 见 manifest |
| `KB-005-visual.md` | KB-005 | 视觉：景别、视角与代入距离 | visual | 见 manifest |
| `KB-006-visual.md` | KB-006 | 光线与色彩：情绪的第二套语法 | visual | 见 manifest |
| `KB-007-sound.md` | KB-007 | 声音：静默、环境声与声画对位 | sound | 见 manifest |
| `KB-008-narrative.md` | KB-008 | 剪辑：节奏、省略与动作连续性 | narrative | 见 manifest |
| `KB-009-character.md` | KB-009 | 表演：微表情、身体与留白 | character | 见 manifest |
| `KB-010-thematic.md` | KB-010 | 主题：作者表达、语境与多义性 | thematic | 见 manifest |
| `KB-011-narrative.md` | KB-011 | 类型：期待、契约与违背 | narrative | 见 manifest |
| `KB-012-thematic.md` | KB-012 | 记忆：重看、互文与个人经验 | thematic | 见 manifest |

逐条 `text_sha256` 与字数见 `outputs/p2/platform-kb-import/manifest.json`，用于导入后核对“平台正文是否被改写”。

---

## 3. 迁移素材（已生成）

目录：`outputs/p2/platform-kb-import/`

| 文件 | 用途 |
|---|---|
| `KB-001…KB-012-*.md` ×12 | **推荐上传单元**，每条保留 ID / 标题 / 分类 / 来源 / 授权 / 标签 / 正文 |
| `ALL-ENTRIES.md` | 备选合并版，仅当平台只支持单文件上传时使用 |
| `manifest.json` | 导入对照表：kb_name、kb_description、kb_version、每条 ID 与 `text_sha256` |

单条文档结构（示例为 KB-003 开头）：

```
<!-- kb_id: KB-003 -->
# KB-003 · 情绪：克制、间离与延迟反应

- 知识 ID：KB-003
- 分类：emotion
- 来源：原创整理（基于公开电影理论概念，未复制原文）
- 授权：CC BY 4.0（本项目原创摘要）
- 标签：情绪、克制、含蓄、间离、延迟、悲伤、宣泄、屏息、压抑、哭

## 正文

<原文逐字，未改写>
```

元数据用纯文本而非 YAML frontmatter，避免平台把 frontmatter 当正文或解析失败时丢字段。

---

## 4. 平台知识库创建：为什么是 BLOCKED

本轮运行的平台访问边界规定：未显式选择知识中心时，不得打开或操作知识中心界面/接口。因此**我没有执行创建，也不会声称已创建**。

同时，平台当前会话暴露的知识类扩展动作只有三个本体抽取动作（`knowledge_plan_ontology_batches` / `knowledge_read_ontology_batch` / `knowledge_submit_ontology_records`），参数围绕 `wiki/`、`project_path`、`ontology.sqlite`，**没有“创建知识库”“检索知识库”动作**。这与知识中心 UI 不是同一层能力，不能互相替代。

### 建议的平台配置（界面若无对应项，以实际项为准并记录）

| 配置项 | 建议值 | 理由 |
|---|---|---|
| 知识库名称 | `Frame by Frame - Cinema Knowledge Base` | 与 manifest 一致 |
| 描述 | 见 manifest `kb_description` | 与项目定位一致 |
| 上传单元 | 12 个单条 md | 保留 ID 边界，避免切分错位 |
| 切分方式 | 按文档整篇 / 标题切分 | 单条已足够短，不需要再切 |
| 元数据 | 文档名含 ID；正文首行含 ID | 双保险，便于追溯 |
| 检索 TopK | 4 | 与 `retrieve.mjs --top 4` 一致 |
| 相关性阈值 | 先用平台默认 | 未知平台分值尺度，不臆造阈值 |
| 引用要求 | 必须返回文档名与片段 | 支撑逐字校验 |
| 可见范围 | 项目内可见 | 比赛演示用，不公开 |

### 需要你执行的两步

1. 在知识中心新建上述知识库，上传 `outputs/p2/platform-kb-import/` 下 12 个 md。
2. 回传：知识库 ID、条目总数、一张条目列表截图。

拿到这两项，我才能继续做检索测试与 Agent 联动，并把本报告状态从 BLOCKED 改为完成。

---

## 5. Agent 接入：现状与三个必改点

### 现状

`film-curator` 第 2 步固定执行本地脚本：

```powershell
node .opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs --input <input.json> --top 4 --out ...
```

`retrieve.mjs` 第 26–27 行硬编码读取 `knowledge/entries.json`，全文件无任何平台调用分支。

### 三个必改点（本轮未改，仅记录）

| 位置 | 现状 | 接入平台后必须改成 |
|---|---|---|
| [retrieve.mjs L26-L27](.opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs#L26-L27) | 硬编码本地文件 | 增加 `kb_provider: platform \| file`，平台失败显式回退并记录 |
| [film-curator.md L21](.opencode/agents/film-curator.md#L21) | “只引用 `knowledge/entries.json` 中存在的 `kb_id`” | 扩展为“平台知识库或项目知识库”，并记录引用来源 |
| [film-curator.md L31](.opencode/agents/film-curator.md#L31) | “不得声称已接入平台知识中心” | **仅在真实接入并验证通过后**才可修改 |
| [validate-citations.mjs L17](.opencode/skills/cinema-knowledge-retrieval/scripts/validate-citations.mjs#L17) | 默认以本地 entries.json 为校验基座 | 保持本地基座 + 记录 `kb_provider`，用作平台内容漂移检测 |

**重要判断：** 引用校验以本地文件做逐字比对（[L84](.opencode/skills/cinema-knowledge-retrieval/scripts/validate-citations.mjs#L84)），这恰好可以证明“平台返回的片段没有被改写”。若平台切分改写了正文导致校验失败，应视为**知识迁移失真**，而不是放宽校验。

### 三个 Skill 与知识库的关系

| Skill | 与知识库的真实关系 | 现状 |
|---|---|---|
| `cinema-knowledge-retrieval` | 唯一直接读库的 Skill | 读本地文件，无平台分支 |
| `film-note-analysis` | 不直接读库，只消费检索结果 | 可用，无需绑定 |
| `cinema-taste-profiling` | 完全不读库，只用笔记证据 | 设计正确，不应接知识库 |

因此“三个 Skill 都要连知识库”是不成立的：**只有第一个需要改，后两个应保持与知识库隔离**，否则会污染“用户原话 vs 外部知识”的边界。

### 5.4 本轮已完成的改造（已授权）

备份目录：`outputs/p2/_work/backup-2026-11-10/`

| 文件 | 备份 SHA256（前 16 位） |
|---|---|
| `retrieve.mjs.bak` | `58DBE33180B905DC` |
| `film-curator.md.bak` | `27D40918E09D7B53` |

改动范围（仅 2 个文件）：

1. `retrieve.mjs`
   - 新增 `--provider file|platform|auto`、`--platform-results <path>`、`--no-fallback`。
   - **默认仍是 file，评分逻辑一行未改**，只新增 `provider / kb_provider / kb_source / kb_version` 字段。
   - platform 模式不调用任何端点，只读平台导出的 JSON，并逐条校验 `kb_id` 存在性与 `excerpt` 逐字性；不通过则进 `rejected`。
   - 导出文件缺失或解析失败时回退 file，并写入 `kb_fallback.reason`。
2. `film-curator.md`
   - 引用规则从“只引用 knowledge/entries.json”改为“项目库或平台库，且必须记录 `kb_provider` / `kb_version`”。
   - 第 2 步补充 platform 模式命令与“被 reject 的条目不得引用”。
   - 赛事口径改为“以本报告实际执行状态为准”，不再写死“不得声称”。

### 5.5 验证结果（真实执行）

| 验证 | 命令 | 结果 |
|---|---|---|
| 回归一致性 | 新旧脚本跑同一 `run-01.json` | `identical: true`，top 均为 `KB-004,KB-012,KB-003,KB-009` |
| 新字段 | 同上 | `provider=file`，`kb_version=1d5d037e321b` |
| 引用门 | `validate-citations.mjs` 跑既有 draft | `ok: true`，3 条 excerpt 逐字通过 |
| 运行门 | `validate-run.mjs` 跑 `fbf-p0-20261109-01` | `ok: true`，0 failures |
| 平台适配器 | 1 条合法 + 1 条不存在 ID + 1 条改写片段 | 仅合法条目通过；另两条进 `rejected`，`kb_integrity_warning: true` |
| 回退 | platform 模式不给导出文件 | `provider=file`，记录 `fallback_reason` |

**注意：** 平台适配器测试用的是自造样本，只证明“适配器能拒绝漂移”，**不等于平台检索测试**。真正的 5 组平台检索测试必须在知识库创建后执行。

---

## 6. 平台能力差异与合规风险

| 差异 | 影响 | 处理 |
|---|---|---|
| 无证据表明知识中心提供脚本检索接口 | Skill 无法编程调用，只能依赖平台内置召回 | 先确认平台实际调用方式；不确认就维持 file provider 并如实标注 |
| 平台无“创建知识库”扩展动作 | 只能由人通过界面创建 | 按第 4 节手动执行 |
| 知识库仅 12 条、总 1872 字 | 只能做关键词/短语级召回，不宜宣称语义检索 | 材料表述为“项目原创知识库（12 条）” |
| Agent/Skills 未纳入 Git | 无版本可复现（B-09） | 完成接入后一并提交并打 tag |

---

## 7. 现场演示流程草稿（平台步骤待真实执行后补图）

| # | 操作 | 预期展示 | 证据位置 |
|---|---|---|---|
| 1 | 打开 DeepWorks 项目 | 项目与 Agent 列表 | 待截图 |
| 2 | 进入知识中心 | 知识库卡片与条目数 12 | 待截图 |
| 3 | 打开条目列表 | KB-001…KB-012 可见 | 待截图 |
| 4 | 检索“克制” | 命中 KB-003 | 待截图 |
| 5 | 在 `film-curator` 中触发分析 | 展示检索调用过程 | 待截图 + run JSON |
| 6 | 输入观影笔记 | 原始笔记全文 | 待截图 |
| 7 | 展示分析结果 | 引用 KB 片段与来源 | 待截图 |
| 8 | 打开运行记录 | run_id、时间戳、skills_used | 待截图 |

---

## 8. 下一步（按依赖排序）

1. **你**：创建知识库并上传 12 个 md，回传知识库 ID 与截图。
2. **我**：核对平台条目与 `manifest.json` 的 `text_sha256`，出一致性结论。
3. **我**：在平台内执行 5 组检索测试（含无结果测试），写 `PLATFORM-KB-RETRIEVAL-TEST.md`。
4. ✅ **已完成**：备份后改造 `retrieve.mjs` 的 provider 层与 Agent 引用规则（见 5.4–5.5）。
5. **我**：执行 3 组 Agent 联动测试，写 `PLATFORM-KB-AGENT-INTEGRATION.md`。
6. **我**：补 `PLATFORM-KB-DEMO-GUIDE.md` 与真实截图。
7. **最后**：提交并打 tag，消除 B-09。

---

## 9. 证据可提交性风险（必须处理）

`.gitignore` 第 28 行忽略了 `outputs/`，因此：

- 本报告、迁移包、`evidence/platform-kb/` 下的截图**都不会进入 Git**；
- 比赛要求的“运行 JSON、事件流、平台截图、时间戳”若只放在 `outputs/`，提交物会缺失。

处理方式（需你确认，本轮未改）：

1. 打包提交时单独收集 `outputs/p2/`，做成 zip 或 PDF 附件；
2. 或在 `.gitignore` 增加白名单：
   ```
   !outputs/p2/PLATFORM-KB-*.md
   !outputs/p2/evidence/platform-kb/
   !outputs/p2/platform-kb-import/
   ```
   注意 Git 对目录忽略的规则：父目录被忽略时，子项白名单需先放开父目录，不能只写 `!outputs/p2/xxx`。

**在打包前必须二选一并验证 `git status` 能看到文件**，否则“完整证据”只是本地存在。
