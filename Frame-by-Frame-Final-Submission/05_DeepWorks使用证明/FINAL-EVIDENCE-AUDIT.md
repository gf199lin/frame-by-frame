# 最终证据链一致性审查

审查时间：2026-11-19 17:26（+08:00）
审查方式：只读。未修改网站、Agent、Skills、知识库与原始运行记录。
审查对象：`competition-submission/deepworks-evidence/`

## 总结论

| 层次 | 结论 |
|---|---|
| 文件完整性 | **PASS**：33/33 文件存在，SHA256 与 `manifest.json` 全部一致，无重复文件 |
| 检索来源区分 | **PASS**：平台历史检索与本次本地检索已分开归档 |
| 知识库一致性 | **PASS（有边界）**：12 条上传/解析；10 条有正文哈希；缺 KB-002、KB-011 |
| 质量门 | **PASS（需改表述）**：3 个验证器、4 项检查，不存在第 4 个验证器 |
| 平台界面截图 | **PASS**：11 张（Skills 为 `/` 列表总览） |
| 平台独立 Run ID | **NOT AVAILABLE** |
| 本地记录误称平台 | **未发现**，但 `retrieval-summary.json` 需补“缺 2 条”说明 |

## 一、检索来源核查

| 编号 | 检索 | 执行环境 | 数据来源 | 调用记录 | 能证明 | 不能证明 |
|---|---|---|---|---|---|---|
| R1 | `sass_search` A | DeepWorks 会话内平台工具（2026-11-16） | 平台知识库 `4c321650-…` | `04-knowledge-retrieval/fbf-p24-A-…platform-search.json` | 平台知识库可被 Agent 检索；KB-003 命中，score `0.8177763` | 本次运行调用平台库 |
| R2 | `sass_search` B | 同上 | 同上 | `…B-…platform-search.json` | 第二次真实返回，top `0.7914144` | 全量召回 |
| R3 | `sass_search` C | 同上 | 同上 | `…C-…platform-search.json` | 第三次真实返回，top `0.77090025` | 全量召回 |
| R4 | `retrieve.mjs`（本次） | 本机 Node 脚本 | `knowledge/entries.json` 本地库 | `05-agent-execution/retrieval.json` | 本次分析使用 `provider=file`，top4 `KB-012/003/008/009` | 平台知识库调用 |
| R5 | 本地文件检索 | 同 R4 | 本地文件 | 同 R4 | 工作流可离线复现 | 平台能力 |
| R6 | 知识中心界面检索 T1–T3 | DeepWorks 知识中心界面 | 平台知识库 | `04-knowledge-retrieval/PLATFORM-KB-RETRIEVAL-TEST.md` | 界面检索可用；T1 角色、T2 克制、T3 结局 | 截图未归档；原文片段未转录 |

**明确结论**：`05-agent-execution/run.json` 的 3 条引用来自本地库（`kb_provider=file`、`fallback_used=true`），**不是**平台知识库调用。平台调用证据只有 R1–R3 与 R6。

## 二、知识库一致性

### 为什么只有 10 条正文哈希一致

不是“2 条哈希不一致”，而是 **KB-002、KB-011 从未出现在三次 `sass_search` 的返回结果中**，因此没有平台正文可供计算哈希。

`knowledge/platform-id-map.json` 实际只包含 10 条：

- 已映射：KB-001、KB-003、KB-004、KB-005、KB-006、KB-007、KB-008、KB-009、KB-010、KB-012
- 未映射：**KB-002（人物）**、**KB-011（类型契约）**

这 10 条的 `platform_body_sha256` 与 `local_text_sha256` 全部相等，属于“正文一致”，不是“相似”。

### 另外两条是否影响内容

- **KB-002**：有 T1 界面检索「角色」命中记录，说明文档可被检索；但没有 `sass_search` 转录与正文哈希。
- **KB-011**：没有任何召回记录，只有上传与解析状态。

因此不能写“12 条全部召回验证通过”；准确说法是“12 条上传并完成解析，10 条在检索转录中出现，3 条被主动查询验证召回（KB-002/003/004）”。

### 三层状态必须分开

| 状态 | 数量 | 证据 |
|---|---|---|
| 上传成功 | 12 | `PLATFORM-KB-STATUS.md` 的文档计数 |
| 解析完成 | 12 | 12/12 `completed`，`pending=0`，`error` 为空 |
| 出现在 `sass_search` 返回 | 10 | 三份转录合并去重 |
| 主动查询并命中 | 3 | T1→KB-002、T2→KB-003、T3→KB-004 |
| 完全无召回证据 | 1 | KB-011 |

> `chunk_count=0` 是平台原始返回值，已保留，未改写；它说明解析完成但分块计数未回填，不影响“文档已入库”的判断，但削弱“可稳定召回”的强度。

## 三、质量门核查

### 实际结构

| 项 | 实际名称 | 类型 | 结果 |
|---|---|---|---|
| 验证器 1 | `validate-evidence.mjs` | 独立脚本 | `ok: true` |
| 验证器 2 | `validate-citations.mjs` | 独立脚本 | `ok: true` |
| 验证器 3 | `validate-run.mjs` | 独立脚本 | `ok: true` |
| 检查 1 | `quality_gates.evidence_verbatim` | `validate-run` 内检查 | `true` |
| 检查 2 | `quality_gates.kb_citations_valid` | `validate-run` 内检查 | `true` |
| 检查 3 | `quality_gates.note_unchanged` | `validate-run` 内检查（重算 note hash） | `true` |
| 检查 4 | `quality_gates.uncertainties_present` | `validate-run` 内检查（`uncertainties` 非空） | `true` |

### 结论

**只有 3 个验证器，不是 4 个。** 所谓“四道质量门”是 4 项检查，其中第 4 项 `uncertainties_present` 没有独立脚本，由 `validate-run.mjs` 第 297 行统一校验。

报告统一改为：**“3 个验证器、4 项质量门检查”**。不得写“四道质量门验证器全部通过”。

## 四、证据目录核查

| 检查 | 结果 |
|---|---|
| 文件是否存在 | 33/33 存在 |
| SHA256 是否一致 | 33/33 与 `manifest.json` 一致，无漂移 |
| 是否有重复 | 无（按 SHA256 分组无重复） |
| 是否有过期材料 | 无；平台记录均为 2026-11-16，运行记录为 2026-11-19 |
| 本地记录误称平台 | 未发现；`run.json` 已写 `execution_scope` 与 `kb_provider=file` |
| 未验证结论 | 3 处：12 条全召回、平台独立 Run、平台界面截图 |

## 五、逐项核验

| 核验项目 | 状态 | 说明 |
|---|---|---|
| Agent 配置截图 | **PASS** | S01 @ 列表含 `film-curator`；S02 会话含 `@film-curator` 与模型名 |
| 三个 Skills 截图 | **PASS** | `S03-skills-list.png`：`/` 列表同屏三个 Skill 与描述；平台无独立详情页 |
| 知识库 12 文档截图 | **PASS** | S06a–c 覆盖 KB-001–012，状态“编译成功” |
| 知识库检索截图 | **PASS** | S07 查询「克制」→ KB-003，BM25 34.1992 |
| Agent 实际运行截图 | **PASS** | S08/S08b 含五条证据、三条引用、画像与不确定性 |
| 平台 Run ID | **NOT AVAILABLE** | 无 Run API |
| 四道质量门证明 | **PASS（改称 3 验证器 + 4 检查）** | 3 份 `ok:true`，4 项键均为 `true` |
| 原始证据归档 | **PASS** | 33 文件，SHA256 一致 |

## 六、截图再次尝试的结果

复查 `deepworks_extension_list_actions`：动作仍只有 `openwork-browser/open_url`、自动化任务、SkillHub、Google Workspace、`deepworks-knowledge` 本体抽取、CLI 状态等，**没有 screenshot / 屏幕捕获 / 浏览器截图动作**。

因此 Agent 侧仍未生成截图。2026-11-19 18:02–18:20，用户手动补齐 11 张：S01/S02、S03、S06a–c、S07、S08/S08b。Skills 用 `/` 列表总览，平台无独立详情页。没有用 `open_url` 打开平台后假装截过图。

## 七、S09 的定义

原报告在插入建议里出现 S09，但截图清单只定义到 S08，属于编号不一致。

现正式定义：

> **S09：四项质量门检查结果。**
> 内容为三份校验输出（`validate-evidence`、`validate-citations`、`validate-run`）中 `ok: true` 的界面或终端截图。
> 注意：这是本机校验输出，**不是 DeepWorks 平台界面截图**，图注必须写明。

如果不想引入“本地终端截图”，也可以直接删除 S09，不影响 S01–S08 的证据链。

## 八、需要同步修正的文档

| 文档 | 修正点 |
|---|---|
| `README.md` | “4 道质量门”改为“3 个验证器、4 项检查”；补“KB-002/011 未捕获” |
| `EVIDENCE-INDEX.md` | E09 写明缺 KB-002/KB-011；E21–E23 标注“验证器”，第 4 项归入 E17 |
| `VERIFICATION.md` | 质量门行改为“3 验证器 + 4 检查”；知识库行补“仅 3 条主动验证召回” |
| `retrieval-summary.json` | `identity_check` 补 `missing_ids: ["KB-002","KB-011"]`（派生说明，不改原始转录） |

## 九、最终判定

**证据链在“文件与运行”层面可复核；在“平台界面”层面仍不完整。**

- 可以说：Agent、3 个 Skill、12 条知识库、3 次平台检索、1 次会话内完整运行、4 项质量门检查，均有真实文件。
- 不能说：平台界面截图已归档、平台独立 Run ID 已取得、12 条全部召回验证通过。
