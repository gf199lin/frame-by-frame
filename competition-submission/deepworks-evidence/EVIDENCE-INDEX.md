# 证据索引

> 编号与文件一一对应；`原始` 表示平台/工具直接产出，`派生` 表示由原始文件计算或摘录，不能单独作为平台事实。

| 编号 | 证据 | 文件 | 类型 | 能证明 | 不能证明 |
|---|---|---|---|---|---|
| E01 | Agent 配置 | `01-agent-configuration/film-curator.agent.md` | 原始 | Agent 名称、`mode: primary`、`model: dth/DeepSeek-V4.1-Flash`、`temperature: 0.2`、完整指令 | 平台界面实际展示样式 |
| E02 | Agent 配置摘要 | `01-agent-configuration/agent-config-summary.json` | 派生 | 上述字段的结构化摘录与配置 SHA256 | 平台侧配置是否被改动 |
| E03 | 会话上下文 | `01-agent-configuration/session-context.json` | 原始（工具返回） | 本会话 `context.agent=film-curator`、session/message ID、模型 | 平台签发的 Run ID |
| E04 | Skill：知识检索 | `02-skills-configuration/cinema-knowledge-retrieval.SKILL.md` | 原始 | 该 Skill 存在，职责为平台/本地检索与引用校验 | 平台 Skill 列表页的展示状态 |
| E05 | Skill：笔记分析 | `02-skills-configuration/film-note-analysis.SKILL.md` | 原始 | 该 Skill 存在，职责为六维证据与逐字引用校验 | 平台调用遥测 |
| E06 | Skill：画像更新 | `02-skills-configuration/cinema-taste-profiling.SKILL.md` | 原始 | 该 Skill 存在，职责为收缩估计与样本不足标注 | 平台调用遥测 |
| E07 | Skill 索引 | `02-skills-configuration/skills-index.json` | 派生 | 3 个 Skill 的 name/description/SHA256 | 平台安装状态 |
| E08 | 平台知识库记录 | `03-knowledge-base/platform-kb.json` | 原始记录 | 知识库 ID `4c321650-6fd5-418f-a300-b4a6760727b4`、12 条、11-16 检索命中 | 界面截图、全量召回 |
| E09 | 12 条知识源 | `03-knowledge-base/entries.json` | 原始 | 12 条 kb_id、标题、正文、CC BY 4.0 | 10 条有平台正文哈希；KB-002、KB-011 未被检索转录捕获 |
| E10 | 12 条清单 | `03-knowledge-base/kb-entry-list.md` | 派生 | 12 条文档的可读清单与正文 SHA256 | 平台解析状态 |
| E11 | 12 文档解析状态 | `03-knowledge-base/PLATFORM-KB-STATUS.md` | 原始报告 | 12/12 `completed`、`pending=0`、`error` 为空；`chunk_count=0` 原始值保留 | 界面截图、其余 9 条可召回 |
| E12 | 检索转录 A | `04-knowledge-retrieval/fbf-p24-A-20261116-01.platform-search.json` | 原始转录 | `sass_search` 返回，top1 `KB-003-emotion.md`，score `0.8177763` | 本次会话可复现调用 |
| E13 | 检索转录 B | `04-knowledge-retrieval/fbf-p24-B-20261116-01.platform-search.json` | 原始转录 | 第二次真实返回，top score `0.7914144` | 同上 |
| E14 | 检索转录 C | `04-knowledge-retrieval/fbf-p24-C-20261116-01.platform-search.json` | 原始转录 | 第三次真实返回，top score `0.77090025` | 同上 |
| E15 | 检索摘要 | `04-knowledge-retrieval/retrieval-summary.json` | 派生 | 3 次查询、命中数与 top 命中；10 条正文哈希一致 | 平台界面状态 |
| E16 | 界面检索记录 | `04-knowledge-retrieval/PLATFORM-KB-RETRIEVAL-TEST.md` | 原始报告 | T1 角色→KB-002、T2 克制→KB-003、T3 结局→KB-004；T4/T5 未执行 | 截图未归档；原文片段未转录 |
| E17 | 会话内运行 | `05-agent-execution/run.json` | 原始 | 七步链路、5 条证据、5 个维度、3 条引用、`kb_provider=file`、显式 fallback | 平台独立 Run、平台 Run ID |
| E18 | 运行输入 | `05-agent-execution/input.json` | 原始 | 《花样年华》真实笔记、note SHA256 `78e701b2…` | 用户身份真实性 |
| E19 | 本地检索结果 | `05-agent-execution/retrieval.json` | 原始 | `provider=file`、top4 `KB-012/KB-003/KB-008/KB-009` | 平台检索结果 |
| E20 | 画像输出 | `05-agent-execution/profile.json` | 原始 | `independent_note_count=1`、`identity_missing_count=0`、画像为 provisional | 长期偏好 |
| E21 | 证据质量门 | `06-quality-gates/validate-evidence.json` | 原始校验输出 | `ok=true`、5 条 `exact`、5 个维度 | 分析质量本身 |
| E22 | 引用质量门 | `06-quality-gates/validate-citations.json` | 原始校验输出 | `ok=true`、3 条 excerpt 逐字一致 | 引用是否最贴切 |
| E23 | 运行质量门 | `06-quality-gates/validate-run.json` | 原始校验输出 | `ok=true`、schema/workflow 通过 | 平台界面可视化 |
| E24 | 笔记哈希 | `06-quality-gates/hash-note.json` | 原始校验输出 | 106 字符、SHA256 `78e701b2…` | 用户身份 |
| E24b | 第 4 项质量门检查 | `05-agent-execution/run.json` 的 `quality_gates.uncertainties_present` | 原始 | 不确定性已记录 | 独立验证器（不存在） |
| E25 | 界面截图 | **无** | — | — | — |

## 对应关系（结论 → 证据）

| 结论 | 直接证据 |
|---|---|
| 确实创建并配置了 film-curator | E01 + E03 |
| 3 个 Skill 真实存在且职责分开 | E04 + E05 + E06 + E07 |
| 12 条知识已进入平台知识库 | E08 + E11（接口记录） |
| Agent 能调用知识库 | E12 + E13 + E14（`sass_search` 转录） |
| 核心分析流程在 DeepWorks 内执行 | E03 + E17 + E21–E23 |
| 测试与质量门对应真实运行 | E17 + E21–E24 |
| 平台界面截图 | **E25 缺失** |
| 平台独立 Run ID | **未取得** |
