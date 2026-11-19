# Taste Evolution Agent Contract (v1)

**状态**：已实现并可通过本地校验脚本。
**Schema**：`taste-evolution.v1`
**校验**：`workflow/validate-taste-evolution.mjs`
**样例**：`workflow/fixtures/taste-evolution.sample.json`

本契约定义 DeepWorks Film Curator 在**跨记录审美演化模式**下必须输出的结构。它建立在现有 `agent-run.v2` 与三个 Skill 之上，不替代单条笔记的 P0 输出。

---

## 1. 输入

```json
{
  "run_id": "run-...",
  "record_id": "r-...",
  "film_id": "f-...",
  "note": "用户原始笔记（只读）",
  "analysis": { "preference_evidence": [] },
  "history": {
    "records": [],
    "observations": [],
    "feedback": [],
    "snapshots": []
  }
}
```

`history` 是已确认的长期档案。没有 `history` 时，Agent 仍按 P0 单条流程运行，不生成观察。

## 2. 输出

```json
{
  "schema_version": "taste-evolution.v1",
  "run_id": "...",
  "record_id": "...",
  "film_id": "...",
  "analyzed_at": "<ISO 8601>",
  "inputs": { "note_sha256": "...", "prior_snapshot_id": "..." },
  "observations": [],
  "evidence": [],
  "feedback_applied": [],
  "snapshot": {},
  "quality_gates": {}
}
```

### 2.1 Observation

必填：

| 字段 | 类型 | 说明 |
|---|---|---|
| `observation_id` | string | 稳定 ID；网站约定 `obs_<dimension>` |
| `dimension` | enum | `narrative` / `emotion` / `thematic` / `visual` / `character` / `ending` |
| `title` | string | 编辑式短标题，不写结论口号 |
| `description` | string | 必须说明证据数量、方向、不确定性 |
| `current_stage` | enum | `emerging` / `developing` / `established` / `evolving` |
| `confidence` | 0..1 | 当前证据估计，不是模型自信度 |
| `first_observed_at` | ISO 8601 | 首次出现 |
| `last_updated_at` | ISO 8601 | 最近一次证据变化 |
| `supporting_record_ids` | string[] | 独立观影记录 |
| `supporting_evidence_ids` | string[] | 必须存在于 `evidence[]` 且 `polarity=supporting` |
| `contradicting_evidence_ids` | string[] | 必须存在于 `evidence[]` 且 `polarity=contradicting` |
| `accepted_feedback_count` | integer | 仅统计去重后的反馈 |
| `rejected_feedback_count` | integer | 同上 |
| `history` | array | 每次阶段/置信度变化的记录，不允许覆盖 |

### 2.2 Evidence

必填：

| 字段 | 类型 | 说明 |
|---|---|---|
| `evidence_id` | string | 稳定 ID；建议 `ev_<record_id>_<dimension>_<quote_hash>` |
| `observation_id` | string | 必须存在于 `observations[]` |
| `record_id` / `film_id` | string | 必须与真实记录一致 |
| `dimension` | enum | 六维之一 |
| `original_quote` | string | **逐字**来自用户笔记，至少 6 字 |
| `interpretation` | string | AI 的解读，不得写成用户原话 |
| `polarity` | enum | `supporting` / `contradicting` / `neutral` |
| `strength` | 0..1 | 笔记深度 × 评分确信度 × 模型置信度 × 用户确认权重 |
| `source` | string | 例如 `deepworks` |
| `created_at` | ISO 8601 | 证据产生时间 |
| `run_id` | string? | 产生它的 Agent run |

### 2.3 Feedback

`feedback_applied[]` 只记录本次实际参与计算的反馈：

```json
{
  "feedback_id": "fb_...",
  "observation_id": "obs_visual",
  "decision": "accepted",
  "user_comment": "可选",
  "created_at": "<ISO 8601>",
  "affected_snapshot_id": "snap_..."
}
```

规则：

- `accepted`：置信度 ×1.1，上限 0.93。
- `partially_accepted`：置信度 ×0.9，保留 `user_comment` 到 `snapshot.corrections_applied`。
- `rejected`：观察 `effective=false`，置信度降到 0.05，不再作为有效支持证据；历史保留。
- `unsure`：权重 ×1，不增加认可。
- 相同 `decision + user_comment` 只计算一次。

### 2.4 Snapshot

```json
{
  "snapshot_id": "snap_<stable-input-hash>",
  "created_at": "<ISO 8601>",
  "run_id": "...",
  "observations": [],
  "dimensions": [{ "key": "visual", "lean": 0.4, "confidence": 0.51, "sampleCount": 3 }],
  "overall_confidence": 0.51,
  "changes": [
    {
      "observation_id": "obs_visual",
      "kind": "updated",
      "reason": "新增 1 条支持证据，置信度从 22% 变为 51%。",
      "before_confidence": 0.22,
      "after_confidence": 0.51,
      "before_stage": "emerging",
      "after_stage": "developing"
    }
  ],
  "corrections_applied": []
}
```

`kind` 只能是 `created` / `updated` / `unchanged` / `withdrawn`。快照只能追加；`snapshot_id` 相同视为同一次分析，不重复写入。

## 3. 阶段判定

| 阶段 | 必要条件（同时满足） |
|---|---|
| `emerging` | 默认；独立记录/证据不足，或置信度 < 0.4 |
| `developing` | 独立电影 ≥ 3、有效证据 ≥ 3、置信度 ≥ 0.4、一致性 ≥ 0.55 |
| `established` | 独立电影 ≥ 5、有效证据 ≥ 5、置信度 ≥ 0.62、一致性 ≥ 0.7、已考虑反向证据与反馈 |
| `evolving` | 反向证据占比 ≥ 0.3，或用户拒绝/部分接受，或与上一快照方向不同 |

禁止：

- 按电影数量单一升级。
- 从 `emerging` 直接跳到 `established`。
- 把 `established` 写成永久标签。

## 4. 网站如何消费

网站不硬编码观察结论：

1. `computeEvolution()` 从已确认分析的真实 `preference_evidence.quote` 派生观察。
2. `observation_id` 与 Agent 输出保持一致（`obs_<dimension>`）。
3. `evidence.original_quote` 在进入观察前会再次与 `record.reflection` 逐字比对；不匹配的引文被排除并在 UI 说明。
4. 用户反馈写入 `observationFeedback`，下一次 `computeEvolution()` 立即应用，并追加快照。
5. 笔记被修改时，旧分析回到 `unreviewed`，旧快照保留但不再作为当前证据。

网站当前使用**本地确定性聚合**来展示已写入的分析证据；真实 DeepWorks Agent 的跨记录运行必须经 `EvolutionTransfer` 导入，导入的观察按 `observation_id` 覆盖本地派生观察。导入器会校验 `record_id`、`film_id`、`note_sha256`、每条 `original_quote` 是否逐字存在于对应记录，并拒绝比已导入运行更旧的文档。

## 5. 运行与校验

单条记录（P0）：

```powershell
node workflow/validate-taste-evolution.mjs --input outputs/.../evolution.json --note-file <note.txt> --out outputs/.../evolution-validation.json
```

跨记录（证据可引用多部历史电影）：

```powershell
node workflow/validate-taste-evolution.mjs --input outputs/.../evolution.json --records-file <records.json> --out outputs/.../evolution-validation.json
```

`records.json` 是 `[{ record_id, film_id, title, year, note, note_sha256 }]`；每条证据按自己的 `record_id` 取笔记做逐字校验。未提供 `--records-file` 时仍按 `--note-file` 单条校验，旧行为不变。

校验失败时：

- 不得删除失败项来“通过”。
- 在 `quality_gates` 对应项写 `false`，并在 `uncertainties` 说明。
- Agent 运行失败时不得覆盖最后一次有效快照；导入器在写入前完成全部校验，失败时不 dispatch。

## 6. 验证状态（2026-11-17）

已通过：

- DeepWorks 会话内 `film-curator` 三次跨记录分析（A 新倾向 / B 验证 / C 反向证据），产出 `outputs/taste-evolution/phase2/case-*/evolution.json`。
- 三份 JSON 均通过 `--records-file` 校验；网站通过真实浏览器导入，形成 3 个 Agent 快照并把 `obs_ending` 推进到 `evolving`。
- 用户拒绝反馈进入下一次运行输入的机制（`buildAgentInput`）有单元测试。

仍未验证：

- 平台侧独立 Run 记录与截图：本会话没有平台 Run API，也没有对 DeepWorks 主界面截图；`run_id` 由会话/消息 ID 派生，不是平台签发的 Run ID。
- 平台知识库检索：本会话未暴露 `sass_search`，`kb_provider` 只能记为 `file`（KB-003 已逐字校验）。
- 真实用户数据：仓库内只有 seed 原型笔记（`src/data/seed.ts` 自述非真实观众调查数据），没有可用的真实用户记录与已持久化反馈。
