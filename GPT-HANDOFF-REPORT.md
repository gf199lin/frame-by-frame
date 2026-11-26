# Frame by Frame · P0 工作汇报（给 GPT 评审）

> 生成日期：2026-11-09
> 项目：Frame by Frame（AI 个人电影记忆博物馆）
> 赛事：首届“滴普杯” DeepWorks 校园黑客松 · 赛道 C（自由开放，即“第三赛道”）
> 本文用途：把本次会话的真实工作、证据、边界与待评审问题一次性交给 GPT，不需要它读取聊天记录。
> 评审口径：**请按“P0 技术闭环完成、平台知识中心与截图未完成”来评审，不要按“全部完成”来评审。**

---

## 0. 一句话结论

**核心智能链路已经真实迁入 DeepWorks 并跑通 3 次：**
`film-curator` Agent（平台模型 `dth/DeepSeek-V4.1-Flash`）+ 3 个产品 Skill + 12 条项目知识库 + 7 步工作流 + 统一 JSON + 三道确定性质量门。

**但严格按赛制/任务完成标准，还有两项没有完成：**

1. **DeepWorks 知识中心知识库未创建**（本轮没有知识中心访问授权；当前是项目文件型知识库，已真实检索）。
2. **DeepWorks 界面运行截图未完成**（本轮没有 UI 截图工具，且未操作受保护的主界面；已保存事件流、会话导出、JSON 校验）。

因此：**Agent / Skills / 工作流 / 3 次运行 = 已完成；知识库 = 功能完成但平台知识中心待授权；截图 = 未完成。**

---

## 1. 项目与赛制背景（给 GPT 的最少上下文）

Frame by Frame 是一个面向大学生的个人电影记忆博物馆：用户记录观影笔记，系统提取可回溯的审美证据，更新六维电影审美画像（叙事、情绪、主题、视觉、人物、结局），并展示电影记忆。

赛制对“第三赛道/赛道 C”的关键要求：

- **知识库接入、技能与工作流编排、Agent 运行必须在 DeepWorks 平台内实现。**
- **禁止以外部框架或自建后端为主体、仅做界面包装的“壳工程”。**
- **决赛现场须在 DeepWorks 环境内实时演示，不满足者资格检查不通过。**
- 否决项 1：**作品主体功能未在 DeepWorks 内实现。**
- 作品在决赛前不对外公开；提交材料包括 2–4 页项目说明（第 2 页为“项目背景三件套”）、≤3 分钟视频、代码/Skills/知识库说明、团队说明。
- 评分：项目背景 30 / 实用性 30 / 迭代记录 10 / 最终成品 30。

**改造前的真实状态（本次会话审查结论）：**

- 前端 React 可运行；Cloudflare Worker + DeepSeek 的真实模型分析链路已验证可用。
- 但系统提示词、结构化校验、重试、模型调用都在外部 Worker（`server/core/`），前端只负责展示。
- DeepWorks 内没有产品 Agent、没有产品 Skill、没有知识库检索、没有工作流。
- 结论：按现状提交，**主体不在 DeepWorks，直接落在否决项 1 射程内**。

本次 P0 的目标就是修复这一点，而不是继续加固外部 Worker。

---

## 2. 本次实际完成的 P0

### 2.1 一个产品 Agent

| 项 | 内容 |
|---|---|
| 显示名 | Frame by Frame Film Curator |
| Agent ID | `film-curator` |
| 定义文件 | `.opencode/agents/film-curator.md` |
| 模式 | `primary` |
| 模型 | `dth/DeepSeek-V4.1-Flash`（DeepWorks / DeepFoundry 平台模型） |
| 引擎 | DeepWorks 内置 `opencode` 1.18.18 |
| 实际加载证据 | `opencode agent list` 输出：`deepworks (primary)`、`film-curator (primary)` |
| 手动入口 | 在 DeepWorks 中选择 `film-curator`，发送“读取 `outputs/p0/inputs/run-01.json`，按工作流执行” |
| 自动入口 | `node workflow/run-p0.mjs --input outputs/p0/inputs/run-01.json` |

**重要说明（不要夸大）：**

- 本轮**没有操作 DeepWorks 主界面**（受保护）；Agent 是通过 DeepWorks 原生项目级 Agent 机制落盘，并由平台引擎实际加载、实际运行 3 次。
- 它不是“只写在 Markdown 里的设计文档”：`agent list` 可见、会话可导出、工具调用可核对。
- 如果你要求的是“在 UI 里点击创建并截图”的 Agent，需要本人在 UI 中确认/导入同名 Agent；这属于待办，不是已完成。

### 2.2 三个产品 Skill

| Skill | 作用 | 关键脚本 | 实际调用 |
|---|---|---|---|
| `cinema-knowledge-retrieval` | 检索 12 条电影审美知识，返回真实 `kb_id`、来源、原文片段 | `retrieve.mjs`、`validate-citations.mjs` | 3/3 次通过 `skill` 工具加载 |
| `film-note-analysis` | 从中文笔记提取 3–6 条带逐字引文的六维证据 | `validate-evidence.mjs` | 3/3 次通过 `skill` 工具加载 |
| `cinema-taste-profiling` | 证据加权 + 样本收缩 + 纠错过滤，产出六维 `profile_delta` | `profile.mjs` | 3/3 次通过 `skill` 工具加载 |

**调用证明：**

- 每份最终 JSON 的 `skills_used` 均为 `invoked: true`、`via: "skill"`。
- 每份运行事件流都含 `{"type":"tool_use","part":{"tool":"skill",...}}`。
- 会话导出包含完整的 `<skill_content name="...">` 返回。
- 每次运行都真实执行了：`hash-note` → `retrieve` → `validate-evidence` → `validate-citations` → `profile` → `validate-run`。

**边界：** Skill 是 DeepWorks 原生项目 Skill（`.opencode/skills/<name>/SKILL.md` + 可执行脚本），不是“只写说明文档”。但本轮同样没有通过 UI 的 Skill 管理页创建；如果赛制要求 UI 内可见的 Skill 卡片，需要本人在平台内确认。

### 2.3 一个知识库

| 项 | 内容 |
|---|---|
| 名称 | Frame by Frame 电影审美知识库 |
| 条目数 | **12** |
| 文件 | `knowledge/entries.json`、`knowledge/index.json`、`knowledge/SOURCES.md` |
| 覆盖 | 叙事、人物、情绪、结局、视觉、光线色彩、声音、剪辑、表演、主题、类型、观影记忆 |
| 来源 | 全部为**项目原创摘要**，基于公开电影理论概念重新表述；未复制长篇影评/书籍 |
| 授权 | CC BY 4.0（本项目原创摘要） |
| 检索方式 | 确定性关键词/二元组匹配，不是向量检索 |
| 三次运行引用 | 共 9 条：KB-004/003/009、KB-007/008/006、KB-001/003/004 |
| 平台知识中心 | **未创建**（需账号授权） |

**重要边界：** 当前是**项目文件型知识库**，由 Skill 脚本真实检索并引用；**不是 DeepWorks 知识中心知识库**。本轮没有知识中心访问授权，因此不声称已创建平台知识库。上传步骤见第 7 节。

### 2.4 一条完整工作流

```
用户电影笔记（input.json）
  → [1] 读取输入 + 计算 note_sha256
  → [2] cinema-knowledge-retrieval：检索 1–3 条真实知识
  → [3] film-note-analysis：产出 3–6 条逐字引文证据
  → [4] validate-evidence.mjs：引文逐字硬门
  → [5] validate-citations.mjs：KB 引用硬门
  → [6] cinema-taste-profiling：六维 profile_delta
  → [7] validate-run.mjs：14 项最终硬门
  → outputs/p0/runs/<run_id>.json
```

**边界：** 当前工作流是“Agent 指令 + Skill 调用 + 确定性脚本质量门”，**不是可视化工作流画布**。如果赛制要求平台内的画布，需要在 DeepWorks 里再建一份同名流程；本轮未验证该功能，不冒充已完成。

### 2.5 统一 JSON

每份最终 JSON 至少包含：

`agent`、`agent_id`、`platform`、`model`、`run_id`、`timestamp`、`skills_used`、`kb_status`、`retrieval_log`、`kb_citations`、`analysis`、`preference_evidence`、`profile_delta`、`uncertainties`、`input`（含 `note_sha256` / `note_unchanged`）、`quality_gates`。

---

## 3. 三次真实运行结果

| 运行 | 影片 | 输入 | 耗时 | 证据 | 维度 | KB 引用 | 校验 |
|---|---|---|---|---|---|---|---|
| `fbf-p0-20261109-01` | 海边的曼彻斯特 | `outputs/p0/inputs/run-01.json` | 130.0 s | 5 | 4（character/thematic/emotion/ending） | KB-004/003/009 | **PASS** |
| `fbf-p0-20261109-02` | 疯狂的麦克斯4 | `outputs/p0/inputs/run-02.json` | 98.3 s | 5 | 4（visual/emotion/narrative/ending） | KB-007/008/006 | **PASS** |
| `fbf-p0-20261109-03` | 爱在黎明破晓前 | `outputs/p0/inputs/run-03.json` | 134.7 s | 5 | 5（narrative/character/emotion/ending/thematic） | KB-001/003/004 | **PASS** |

共同点：

- 平台：`DeepWorks`
- 模型：`dth/DeepSeek-V4.1-Flash`
- 三个 Skill 均通过 `skill` 工具加载
- 每条证据的 `quote` 均逐字出现在输入笔记中
- 每个 `kb_id` 均真实存在，`excerpt` 均逐字来自条目
- `note_sha256` 与输入一致，`note_unchanged=true`
- `uncertainties` 均 ≥ 4 条
- `validate-run.mjs` 三次均 `ok=true`，退出码 0

会话 ID：

- run-01：`ses_e41b72b79ffe2feeMt6rscf3V6`
- run-02：`ses_e41b50083ffe8XPC1aeJNg5Aw0`
- run-03：`ses_e41b37fafffeGEUxGjSRYIO2EO`

---

## 4. 质量门与验证方法

### 4.1 引文逐字（`validate-evidence.mjs`）

- 每条 `preference_evidence.quote` 必须出现在 `input.note` 中（精确或去引号/空白归一化后）。
- 引文至少 6 个汉字；重复引文拒绝。
- 至少覆盖 3 个维度；3–6 条证据为佳。
- 找不到引文时只能删除该条证据，不能改写原文。

### 4.2 KB 引用（`validate-citations.mjs`）

- `kb_id` 必须存在于 `knowledge/entries.json`。
- `title` / `source` 必须与条目一致。
- `excerpt` 必须是条目 `text` 的逐字片段。
- `why_relevant` 必须指向笔记中的具体词或选择。
- P0 验收要求至少 1 条引用；如果确实不相关，允许 `no_relevant_entry`，但该次不计入“知识库已被检索”的证据。

### 4.3 画像（`profile.mjs`）

- 六维齐全：`narrative`、`emotion`、`thematic`、`visual`、`character`、`ending`。
- `sample_size` = **证据条数**，不是独立笔记数。
- 证据少于 3 条时 `insufficient_samples=true`。
- 没有证据的维度保持 50（中性），不得用类型猜测填充。
- 用户纠错（`accepted=false`）必须排除，并记录在 `corrections_applied`。

### 4.4 最终完整性（`validate-run.mjs`）

检查 16 个顶层字段、平台/模型、run_id、时间戳、3 个 Skill、KB 引用、证据逐字、维度覆盖、画像形状、笔记哈希、`quality_gates` 全为 true。

---

## 5. 证据清单（GPT 可核对）

| 证据 | 路径 |
|---|---|
| Agent 注册 | `outputs/p0/evidence/agent-list.txt` |
| 模型列表 | `outputs/p0/evidence/models.txt` |
| 运行 1/2/3 最终 JSON | `outputs/p0/runs/fbf-p0-20261109-0*.json` |
| 运行事件流（含 skill/bash 调用） | `outputs/p0/runs/fbf-p0-20261109-0*.events.jsonl` |
| 最终校验 | `outputs/p0/runs/fbf-p0-20261109-0*.validation.json` |
| 运行摘要 | `outputs/p0/runs/fbf-p0-20261109-0*.run-summary.json` |
| 会话导出 | `outputs/p0/evidence/session-01.json` / `session-02.json` / `session-03.json` |
| 输入笔记 | `outputs/p0/inputs/run-01.json` / `run-02.json` / `run-03.json` |
| 知识库 | `knowledge/entries.json`、`knowledge/index.json`、`knowledge/SOURCES.md` |
| 工作流文档 | `docs/workflow.md` |
| Skills 文档 | `docs/skills.md` |
| 知识库文档 | `docs/knowledge-base.md` |
| 详细实施报告 | `outputs/p0/P0-REPORT.md` |

---

## 6. 必须让 GPT 知道的未完成/边界

1. **DeepWorks 知识中心知识库未创建。** 当前是项目文件型知识库；12 条、3 次检索、9 条引用都是真实的，但不是平台知识中心。
2. **没有 DeepWorks UI 运行截图。** 本轮没有操作受保护的主界面，也没有 UI 截图工具；已保存事件流、会话导出、JSON 校验。截图需要本人补。
3. **Agent/Skill 不是通过 UI 点击创建。** 是 DeepWorks 原生项目级文件 + 平台引擎实际加载运行。`agent list` 可见、3 次会话可导出；但如果赛制严格要求 UI 内创建，需要本人确认。
4. **工作流不是可视化画布。** 是 Agent 指令 + Skill 调用 + 脚本质量门；如果赛制要求画布，需要另建。
5. **网站与 Agent 的集成（P2）未做。** 按任务要求没有改前端、没有扩展 Worker；当前网站仍走原来的 Worker。
6. **只跑了 3 条笔记。** 还未做 10 条边界案例、真实用户测试、视频、2–4 页项目说明。
7. **run-02 有一处文案瑕疵。** 其 `uncertainties` 把 `sample_size=1` 说成笔记数；实际 `profile_delta.sample_size=5` 是证据条数。已更新 Skill/Agent 指令防止复现，当前 run-02 保留为修复记录。
8. **首次验收运行器曾超时。** 原因是 CLI 孙进程继承 stdout/stderr 导致 `close` 不触发；已改为文件重定向 + `exit` + 超时，3 次运行正常退出。没有用固定 JSON 或外部 Worker 伪造结果。

---

## 7. 需要本人操作/授权的事项

### 7.1 在 DeepWorks UI 确认 Agent 并截图

1. 打开 DeepWorks，新建/进入本项目会话。
2. 在 Agent 选择器中查找 `Frame by Frame Film Curator`（`film-curator`）。
3. 选择它，发送：
   ```
   读取 outputs/p0/inputs/run-01.json，按你的工作流执行，产出 outputs/p0/runs/fbf-p0-20261109-01-ui.json。
   ```
4. 预期：Agent 调用 3 个 Skill、检索知识库、写出 JSON；界面显示工具调用过程。
5. 截图 2–3 张：Agent 选择器、Skill 调用、最终 JSON/摘要。

> 如果 UI 中看不到 `film-curator`，重启 DeepWorks 或在该项目的 Agent 管理页导入 `.opencode/agents/film-curator.md`。

### 7.2 创建 DeepWorks 知识中心知识库

1. 进入知识中心 → 新建知识库，名称 `Frame by Frame 电影审美`。
2. 上传 `knowledge/entries.json` 的 12 条内容（或逐条 Markdown）。
3. 等待索引，记录：知识库 ID、条目数、索引时间。
4. 创建 `knowledge/platform-kb.json`：
   ```json
   {
     "provider": "deepworks-knowledge-center",
     "knowledge_base_id": "<填写>",
     "name": "Frame by Frame 电影审美",
     "entry_count": 12,
     "indexed_at": "<填写>"
   }
   ```
5. 在知识中心检索“克制”“结局”“类型”，预期分别返回 KB-003、KB-004、KB-011。
6. 把知识库 ID 发回，接平台知识库适配层。

### 7.3 其他确认

- 比赛账号的模型额度是否足够（3 次运行各约 25k–35k 输入 token/步）。
- 赛制是否要求“可视化工作流画布”。
- 是否允许“Agent 在 DeepWorks 运行 + 网站展示导出 JSON”的集成形态（P2）。
- 运行截图与 3 分钟视频由本人录制；可提供分镜、旁白与演示脚本。

---

## 8. 请 GPT 重点评审的 8 个问题

1. **合规判断：** 以“项目级 Agent 文件 + 平台引擎实际运行 + 3 次会话导出”作为“在 DeepWorks 内实现 Agent”，是否足以满足赛道 C 的资格检查？还缺什么证据？
2. **知识库认定：** 项目文件型知识库（真实检索、真实引用）与 DeepWorks 知识中心知识库，评委会如何区分？是否必须上传知识中心才算达标？
3. **工作流认定：** “Agent 指令 + Skill 调用 + 脚本质量门”是否算“工作流编排”？如果赛制要求可视化画布，最小补救是什么？
4. **壳工程边界：** 网站继续作为展示层、Agent 写 JSON、网站读取，是否会被认定为“外部后端为主体/壳工程”？如何证明网站不是主体？
5. **质量门漏洞：** 现有引文校验、KB 引用校验、画像收缩是否有可被钻空子的地方？还需要哪些反作弊/一致性检查？
6. **材料表述：** “DeepWorks 使用证明”应该怎么写，才能既证明真实使用、又不夸大成“平台知识中心已建”？
7. **公开合规：** 公开 GitHub 仓库/Pages 与“决赛前不对外公开”冲突，最优处理是什么（转私有、受控链接、还是仅提交可复现包）？
8. **演示叙事：** 3 分钟视频如何安排“问题 → 真实场景 → Agent 运行 → Skills/KB → 网站 → 限制”，才能让评委在短时间内看懂“核心在 DeepWorks”？

---

## 9. 复现命令

```powershell
# 1) 重建知识库索引
node knowledge/scripts/build-index.mjs

# 2) 单次检索
node .opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs --input outputs/p0/inputs/run-01.json --top 4

# 3) 单次真实运行（调用 DeepWorks 引擎，模型 dth/DeepSeek-V4.1-Flash）
node workflow/run-p0.mjs --input outputs/p0/inputs/run-01.json

# 4) 手动最终校验
node workflow/validate-run.mjs --run outputs/p0/runs/fbf-p0-20261109-01.json --input outputs/p0/inputs/run-01.json
```

---

## 10. 关键文件索引

```
.opencode/agents/film-curator.md
.opencode/skills/film-note-analysis/SKILL.md
.opencode/skills/film-note-analysis/scripts/validate-evidence.mjs
.opencode/skills/cinema-knowledge-retrieval/SKILL.md
.opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs
.opencode/skills/cinema-knowledge-retrieval/scripts/validate-citations.mjs
.opencode/skills/cinema-taste-profiling/SKILL.md
.opencode/skills/cinema-taste-profiling/scripts/profile.mjs
knowledge/entries.json
knowledge/index.json
knowledge/SOURCES.md
workflow/hash-note.mjs
workflow/run-p0.mjs
workflow/validate-run.mjs
docs/workflow.md
docs/skills.md
docs/knowledge-base.md
outputs/p0/P0-REPORT.md
```

---

## 11. 给 GPT 的评审提示（可直接粘贴）

> 请基于以上事实，重点判断：
> 1）这套 P0 是否足以通过“核心链路必须在 DeepWorks 内”的资格检查；
> 2）项目文件型知识库与平台知识中心知识库的差距是否致命；
> 3）工作流形态是否会被认定为“只是 Agent 指令、不是编排”；
> 4）网站展示层 + Agent 导出 JSON 是否会被认定为“壳工程”；
> 5）质量门还有哪些漏洞；
> 6）下一步 3 天内最值得做的 5 件事。
>
> 请不要把“已跑通 3 次”当成“全部完成”；平台知识中心与截图仍未完成。
