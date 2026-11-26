# 核验结果

核验时间：2026-11-19 18:22（+08:00）
核验对象：`competition-submission/deepworks-evidence/`

## 逐项状态

| 核验项目 | 状态 | 依据 | 说明 |
|---|---|---|---|
| Agent 配置截图 | **PASS** | `S01-agent-mention.png`、`S02-agent-session.png` | @ 列表含 `film-curator` 与 `知识中心`；选中后显示 `@film-curator` 与会话模型 `DeepSeek-V4.1-Flash` |
| 三个 Skills 截图 | **PASS** | `S03-skills-list.png` | `/` 技能列表同时显示 3 个 Skill 名称与描述；平台无独立 Skill 详情页，关键配置由 3 个 `SKILL.md` 补充 |
| 知识库 12 文档截图 | **PASS** | `S06a`（001–009）、`S06b`（002–010）、`S06c`（011–012） | 三张合起来覆盖 001–012；状态列“编译成功”，共 12 条 |
| 知识库检索截图 | **PASS** | `S07-kb-retrieval-restraint.png` | 查询「克制」、关键词检索、命中 `KB-003-emotion.md`，BM25 `34.1992` |
| Agent 实际运行截图 | **PASS** | `S08-agent-run.png`、`S08b-run-output.png` | 输入 `@film-curator`、模型 `DeepSeek-V4.1-Flash`、五条证据、三条引用、画像与不确定性 |
| 平台 Run ID | **NOT AVAILABLE** | 无 Run API；`run.json` 的 run_id 为本地生成 | 不冒充平台签发 |
| 质量门证明 | **PASS** | E21–E23 三份 `ok:true`；`run.json` 4 项键均 `true` | 3 个验证器、4 项检查 |
| 原始证据归档 | **PASS** | 45 项文件、11 张截图 + `manifest.json`（SHA256） | 原始运行记录未改动 |

## 总判定

**6 项 PASS、0 项 FAIL、1 项 NOT AVAILABLE。**

实测：`manifest.json` 收录 **45 个文件、11 张截图**；`verification.json` 为 **`ok: true`**，8 组截图全部存在且大于 20 KB；3 份验证器输出均为 `ok: true`。

唯一未取得的是**平台独立 Run ID**，这是平台能力限制，不是材料缺失。

详见 [FINAL-EVIDENCE-AUDIT.md](FINAL-EVIDENCE-AUDIT.md)。

## 截图内容核验

| 文件 | 实际内容 | 结论 |
|---|---|---|
| `S01-agent-mention.png` | @ 列表：DeepSense、FastData、`film-curator 智能体`、对话列表；底部 `DeepSeek-V4.1-Flash` | 可用 |
| `S02-agent-session.png` | 输入框上方“企业知识库 / 我的工作空间/Frame by Frame…” + `@film-curator`；底部模型名 | 可用 |
| `S03-skills-list.png` | `/` 技能列表（42），含 `$cinema-knowledge-retrieval`、`$cinema-taste-profiling`、`$film-note-analysis` 及描述 | 可用；三项同屏，无详情页 |
| `S06a` | 知识库第 1 页，KB-001–009，状态“编译成功”，共 12 条 | 可用 |
| `S06b` | 同页滚动，KB-002–010，补上 KB-010 | 可用（与 S06a 重叠） |
| `S06c` | 第 2 页，KB-011、KB-012 | 可用 |
| `S07` | 检索「克制」→ #1 `KB-003-emotion.md`，BM25 34.1992；#2 `KB-009` | 可用 |
| `S07b` | 同次检索 #2–#4，KB-009 与 KB-003 summary | 补充 |
| `S08` | 会话输入 `[1] @film-curator`、分析结果、五条证据；底部模型名 | 可用，含“子代理不可用”的解释文字，图注需说明 |
| `S08b` | 五条证据、三条引用、画像更新、不确定性 | 可用 |
| `S08-input-note.png` | 输入气泡 `[1] @film-curator` + 笔记原文 | 补充 |

## 可选的补强

1. **S03–S05 特写**：在 `/` 列表分别输入 `cinema-knowledge`、`film-note`、`cinema-taste` 过滤，各截一张单 Skill 特写，可替换总览图；不做也不影响 PASS。
2. **T1–T3 旧截图**：有就复制到 `04-knowledge-retrieval/`；没有不影响当前 PASS。
3. **Run ID**：如果平台有运行详情页，截一张带 Run ID 与时间戳的图；没有就保持 NOT AVAILABLE。

## 一句话给评委

> Frame by Frame 的 `film-curator`、3 个 Skill、12 条知识库、检索命中与完整分析运行均已在 DeepWorks 界面留下截图；Skills 以 `/` 列表同屏证明，配置细节由 3 个 `SKILL.md` 补充，未使用任何模拟界面或网站页面替代。
