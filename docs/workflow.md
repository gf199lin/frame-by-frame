# Frame by Frame · P0 工作流（DeepWorks 内）

> 版本：2026-11-09
> 执行者：`film-curator`（DeepWorks 项目 Agent）
> 模型：`dth/DeepSeek-V4.1-Flash`（DeepWorks / DeepFoundry 平台模型）
> 原则：Agent 负责理解与决策；Skill 负责可复用的分析、检索与校验；知识库负责证据；脚本负责确定性质量门。

## 1. 工作流总览

```
用户电影笔记（input.json）
  ↓
[1] 读取输入 + 计算笔记哈希（note_sha256）
  ↓
[2] cinema-knowledge-retrieval：检索 1–3 条真正相关的知识库条目
  ↓
[3] film-note-analysis：产出 3–6 条带逐字引文的偏好证据
  ↓
[4] 质量门 A：引文逐字校验（validate-evidence.mjs）
  ↓
[5] 质量门 B：知识库引用校验（validate-citations.mjs）
  ↓
[6] cinema-taste-profiling：按证据条数收缩，产出 profile_delta
  ↓
[7] 组装最终 JSON + 质量门 C（validate-run.mjs）
  ↓
outputs/p0/runs/<run_id>.json
```

## 2. 每一步的输入、输出与质量门

| 步骤 | 执行者 | 输入 | 输出 | 质量门 |
|---|---|---|---|---|
| 1. 读取与哈希 | Agent | `outputs/p0/inputs/run-*.json` | `note_sha256`、`note_chars` | 哈希与输入一致；笔记不被修改 |
| 2. 知识库检索 | `cinema-knowledge-retrieval` | 笔记 + 影片信息 | `<run_id>.retrieval.json` | 返回真实 `kb_id`；最高分 ≥ 2；引用前阅读全文 |
| 3. 笔记分析 | `film-note-analysis` | 笔记 + 影片信息 | `<run_id>.draft.json` | 3–6 条证据；至少 3 个维度；每条有逐字引文 |
| 4. 证据校验 | `validate-evidence.mjs` | input + draft | `<run_id>.evidence-validation.json` | `ok=true`；否则删除/修正，不得伪造 |
| 5. 引用校验 | `validate-citations.mjs` | draft + `knowledge/entries.json` | `<run_id>.citation-validation.json` | `kb_id` 存在；`excerpt` 逐字来自条目 |
| 6. 画像更新 | `cinema-taste-profiling` | draft + 可选 prior/corrections | `<run_id>.profile.json` | 六维齐全；`sample_size`=证据条数；样本不足标注 |
| 7. 最终校验 | `validate-run.mjs` | final JSON + input | `<run_id>.validation.json` | 14 项字段、哈希、引用、证据、画像全部通过 |

## 3. 最终 JSON 的关键字段

```json
{
  "agent": "Frame by Frame Film Curator",
  "agent_id": "film-curator",
  "platform": "DeepWorks",
  "model": "dth/DeepSeek-V4.1-Flash",
  "run_id": "fbf-p0-20261109-01",
  "timestamp": "ISO-8601",
  "skills_used": [
    { "name": "cinema-knowledge-retrieval", "invoked": true, "via": "skill" },
    { "name": "film-note-analysis", "invoked": true, "via": "skill" },
    { "name": "cinema-taste-profiling", "invoked": true, "via": "skill" }
  ],
  "kb_status": "cited",
  "retrieval_log": { "query": "...", "top_ids": [], "selected_ids": [] },
  "kb_citations": [],
  "analysis": {},
  "preference_evidence": [],
  "profile_delta": {},
  "uncertainties": [],
  "input": { "note_sha256": "...", "note_chars": 114, "note_unchanged": true },
  "quality_gates": {
    "evidence_verbatim": true,
    "kb_citations_valid": true,
    "note_unchanged": true,
    "uncertainties_present": true
  }
}
```

## 4. 质量门的具体规则

### 4.1 引文逐字（硬门）

- 每条 `preference_evidence.quote` 必须出现在 `input.note` 中（精确或去引号/空白归一化后）。
- 引文至少 6 个汉字；重复引文拒绝。
- 找不到引文时，只能删除该条证据，不能改写原文。
- 至少覆盖 3 个不同维度；3–6 条证据为佳。

### 4.2 知识库引用（硬门）

- `kb_id` 必须存在于 `knowledge/entries.json`。
- `title` 与 `source` 必须与条目一致。
- `excerpt` 必须是条目 `text` 的逐字片段（允许去引号/空白归一化）。
- `why_relevant` 必须指向笔记中的具体词或选择，不能写“这条很相关”。
- P0 验收要求至少 1 条引用；如果笔记确实不涉及任何条目，允许 `kb_status=no_relevant_entry`，但该次不计入 P0 的“知识库已被检索”证据。

### 4.3 画像（硬门）

- 六个维度必须齐全：`narrative`、`emotion`、`thematic`、`visual`、`character`、`ending`。
- `sample_size` = 证据条数，不是独立笔记数。
- 证据少于 3 条时 `insufficient_samples=true`。
- 没有证据的维度保持 50（中性），不得用类型猜测填充。
- 用户纠错（`accepted=false`）必须排除，并记录在 `corrections_applied`。

### 4.4 笔记完整性（硬门）

- `note_sha256` 必须与输入笔记的计算值一致。
- `note_unchanged=true`。
- 输入文件只读，不得写入。

## 5. 如何运行

### 5.1 单次运行

```powershell
node workflow/run-p0.mjs --input outputs/p0/inputs/run-01.json
```

该命令会：

1. 用 DeepWorks 引擎 CLI 启动 `film-curator` Agent（模型 `dth/DeepSeek-V4.1-Flash`）；
2. 保存原始事件流 `<run_id>.events.jsonl`；
3. 等待 Agent 写出 `<run_id>.json`；
4. 运行 `workflow/validate-run.mjs`；
5. 写出 `<run_id>.run-summary.json`。

> `run-p0.mjs` 是验收运行器，不是 Agent 的替代品；它只负责调用平台引擎、保存日志、跑最终质量门。

### 5.2 手动运行（在 DeepWorks 内）

在 DeepWorks 中选择 `film-curator` Agent，发送：

```
读取 outputs/p0/inputs/run-01.json，按你的工作流执行，产出
outputs/p0/runs/fbf-p0-20261109-01.json，并运行最终校验。
```

### 5.3 知识库索引重建

```powershell
node knowledge/scripts/build-index.mjs
```

## 6. 失败处理

- 脚本报错：读错误信息，修正 draft 或引用，不修改校验脚本。
- 引文不匹配：删除该条证据，或换一个真实原句；不得改写原文。
- 引用不匹配：重新阅读条目，复制真实片段；不得编造 `excerpt`。
- 模型无法满足质量门：在 `uncertainties` 中说明，`quality_gates` 对应项设 `false`，并报告“未通过”。
- 平台/模型不可用：停止运行并说明，不使用外部 Worker 伪造结果。

## 7. 当前限制

- 工作流以 **Agent 指令 + Skill 调用 + 脚本质量门** 实现；尚未验证 DeepWorks 是否提供可视化工作流画布。如果赛制要求画布，需要在平台内再建一份同名流程。
- 知识库当前是**项目文件型**（`knowledge/entries.json` + 检索脚本），不是 DeepWorks 知识中心；上传知识中心需要账号授权，步骤见 `docs/knowledge-base.md`。
- 运行截图需要你在 DeepWorks 界面手动截取；本轮通过 CLI 事件流、会话导出和 JSON 校验保存证据，不伪造截图。
