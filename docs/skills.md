# Frame by Frame · 三个产品 Skill

> 位置：`.opencode/skills/<name>/SKILL.md`
> 加载方式：DeepWorks 原生 Skill 目录；运行时由 `skill` 工具加载。
> 证明：三次运行的 `skills_used[].via` 均为 `skill`，事件流中含 `"tool":"skill"` 调用与返回内容。

## 1. Film Note Analysis

| 项 | 内容 |
|---|---|
| 名称 | `film-note-analysis` |
| 作用 | 从中文观影笔记中提取 3–6 条六维审美证据，每条必须带逐字引文 |
| 输入 | `input.json`（note / film / rating / felt_like） |
| 输出 | `analysis`、`preference_evidence`、`uncertainties` |
| 质量门 | `.opencode/skills/film-note-analysis/scripts/validate-evidence.mjs` |
| 关键规则 | 引文必须逐字出现；找不到就删除；不得编造偏好；至少 3 个维度；不确定必须标注 |

## 2. Cinema Knowledge Retrieval

| 项 | 内容 |
|---|---|
| 名称 | `cinema-knowledge-retrieval` |
| 作用 | 从 12 条电影审美知识条目中检索 0–3 条真正相关的解释，保留 `kb_id`、来源、原文片段 |
| 输入 | 笔记 + 影片信息，或直接 query |
| 输出 | `retrieval_log`、`kb_citations`、`kb_status` |
| 质量门 | `.opencode/skills/cinema-knowledge-retrieval/scripts/validate-citations.mjs` |
| 关键规则 | 只引用真实条目；`excerpt` 必须逐字；禁止强行套用；关系弱时允许 `no_relevant_entry` |

## 3. Cinema Taste Profiling

| 项 | 内容 |
|---|---|
| 名称 | `cinema-taste-profiling` |
| 作用 | 基于已接受证据更新六维画像；按证据条数收缩；标注样本不足；保留用户纠错 |
| 输入 | draft 的 `preference_evidence`，可选 prior / corrections |
| 输出 | `profile_delta`（六维 score / lean / confidence / sample_size / sufficient） |
| 质量门 | `.opencode/skills/cinema-taste-profiling/scripts/profile.mjs` |
| 关键规则 | 一条笔记不能断言长期偏好；`sample_size` 是证据条数；无证据维度保持 50；纠错优先 |

## 4. 三次运行的调用记录

| 运行 | Skill 1 | Skill 2 | Skill 3 | 会话 ID |
|---|---|---|---|---|
| `fbf-p0-20261109-01` | `skill` 已调用 | `skill` 已调用 | `skill` 已调用 | `ses_e41b72b79ffe2feeMt6rscf3V6` |
| `fbf-p0-20261109-02` | `skill` 已调用 | `skill` 已调用 | `skill` 已调用 | `ses_e41b50083ffe8XPC1aeJNg5Aw0` |
| `fbf-p0-20261109-03` | `skill` 已调用 | `skill` 已调用 | `skill` 已调用 | `ses_e41b37fafffeGEUxGjSRYIO2EO` |

> `skill` 是 DeepWorks 运行时的 Skill 加载工具；事件流中可见 `"tool":"skill"` 与对应 `<skill_content name="...">` 返回，不是“只写了 Markdown 文档”。

## 5. 每个 Skill 的实际脚本

| Skill | 脚本 | 作用 |
|---|---|---|
| `film-note-analysis` | `scripts/validate-evidence.mjs` | 引文逐字、维度覆盖、结构完整性 |
| `cinema-knowledge-retrieval` | `scripts/retrieve.mjs` | 关键词/二元组检索，返回真实条目 |
| `cinema-knowledge-retrieval` | `scripts/validate-citations.mjs` | `kb_id`、标题、来源、`excerpt` 逐字校验 |
| `cinema-taste-profiling` | `scripts/profile.mjs` | 证据加权 + 样本收缩 + 纠错过滤 |

## 6. 如何手动加载

在 DeepWorks 中选择 `film-curator` Agent，直接说：

```
加载 film-note-analysis，按它的规则分析 outputs/p0/inputs/run-01.json。
```

或运行：

```powershell
node .opencode/skills/film-note-analysis/scripts/validate-evidence.mjs --input <input.json> --analysis <draft.json>
```

## 7. 维护约定

- Skill 名称、目录名、frontmatter `name` 必须一致。
- 任何规则变更都要同步更新对应 `SKILL.md` 与脚本，并重跑三次验收。
- 不得把“设计说明”当作“已调用记录”；调用记录以 `skills_used` 与事件流为准。
