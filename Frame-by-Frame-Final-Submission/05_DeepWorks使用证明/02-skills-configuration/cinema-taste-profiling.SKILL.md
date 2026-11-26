---
name: cinema-taste-profiling
description: 基于用户已接受的六维审美证据更新电影审美画像，按样本量收缩、标注样本不足，并保留用户纠错信息，避免用一条笔记武断判断长期偏好。
metadata:
  author: "BayMax"
---

# Cinema Taste Profiling

## 何时使用

在 `film-note-analysis` 产出证据、且证据已通过校验之后使用。它把“这一次笔记里的证据”换算成一次 `profile_delta`，不是对用户人格的判断，也不替代产品里跨记录聚合的完整画像。

## 不可违反的规则

1. 只使用已接受的证据：`accepted === false` 的条目必须排除；用户纠错优先于模型推断。
2. **一条笔记不能证明长期偏好。** 必须输出 `sample_size` 与 `insufficient_samples`；样本少于 3 条时明确标注。
   - `sample_size` 指**证据条数**，不是独立影片数或独立笔记数。
   - 在 `uncertainties` 中必须写清“本次独立笔记 1 条、证据 N 条”，不要把 `sample_size` 说成笔记数。
3. 分数是估计值，不是事实；必须同时给出 `confidence`。
4. 不得写人格诊断、心理疾病判断或“你就是这种人”一类结论。
5. 用户纠错必须原样保留在 `corrections_applied` 中，不能被模型覆盖。
6. 六个维度必须全部出现；没有证据的维度给 50（中性）并标 `sufficient: false`，不要省略。

## 六维与方向

| dimension_id | low | high |
|---|---|---|
| `narrative` | 慢热 · 向内 | 强情节 · 推进 |
| `emotion` | 克制 · 含蓄 | 浓烈 · 宣泄 |
| `thematic` | 向内 · 记忆与自我 | 向外 · 自由与世界 |
| `visual` | 自然 · 触感 | 风格化 · 构图 |
| `character` | 人物驱动 · 转变 | 群像 · 处境 |
| `ending` | 苦涩 · 未解 | 闭合 · 希望 |

`direction` 映射：`high` = +1，`low` = -1，`ambivalent` = 0；权重为 `strength × confidence`。

## 执行步骤

1. 读取 analysis draft（包含 `preference_evidence`）。
2. 如果存在 `corrections.json`，读取用户纠错；把 `accepted: false` 的证据排除。
3. 运行：

```powershell
node .opencode/skills/cinema-taste-profiling/scripts/profile.mjs --evidence <draft.json> --prior <prior-profile.json> --corrections <corrections.json> --out <profile.json>
```

`--prior` 与 `--corrections` 可省略。

4. 阅读输出的 `dimensions`、`sample_size`、`insufficient_samples`、`overall_confidence`。
5. 把整个输出放进最终 JSON 的 `profile_delta`，不要改写数值。

## 输出结构

```json
{
  "method": "weighted-evidence-shrinkage",
  "sample_size": 4,
  "sufficient": true,
  "insufficient_samples": false,
  "overall_confidence": 0.42,
  "dimensions": {
    "narrative": { "score": 44.2, "lean": "low", "confidence": 0.35, "sample_size": 1, "sufficient": false },
    "emotion": { "score": 38.1, "lean": "low", "confidence": 0.5, "sample_size": 2, "sufficient": false },
    "thematic": { "score": 50, "lean": "balanced", "confidence": 0, "sample_size": 0, "sufficient": false },
    "visual": { "score": 50, "lean": "balanced", "confidence": 0, "sample_size": 0, "sufficient": false },
    "character": { "score": 46.8, "lean": "balanced", "confidence": 0.3, "sample_size": 1, "sufficient": false },
    "ending": { "score": 40.5, "lean": "low", "confidence": 0.4, "sample_size": 1, "sufficient": false }
  },
  "corrections_applied": [],
  "warnings": ["sample_size < 3: treat as a run-level hint, not a stable profile"]
}
```

## 审美演化模式（Taste Evolution）

当输入包含 `history`（已确认记录、既有 `observations`、`feedback`、`snapshots`）时，本 Skill 还要维护跨记录的审美观察，而不只是单次 `profile_delta`。观察是**当前证据的方向**，不是用户的永久标签。

### 四个阶段

| stage | 含义 | 进入条件（同时看，不只看部数） |
|---|---|---|
| `emerging` | 初步显现 | 独立记录少、证据少或置信度低；必须写明不确定性 |
| `developing` | 逐渐形成 | 至少 3 部独立电影、至少 3 条有效证据、置信度 ≥ 0.4、方向较一致 |
| `established` | 相对稳定 | 至少 5 部独立电影、至少 5 条有效证据、置信度 ≥ 0.62、一致性 ≥ 0.7，并已考虑反向证据与用户反馈 |
| `evolving` | 持续变化 | 出现方向相反的证据、用户拒绝/部分接受，或新判断与旧快照方向不同 |

规则：

1. **禁止按“看过几部电影”单一升级。** 还要看证据质量、跨片一致性、反向证据、用户反馈和当前置信度。
2. **禁止跳级。** 阶段只能 `emerging → developing → established` 逐级前进；`evolving` 可以随时进入，重新评估后从 `developing` 继续。
3. 阶段可以由 `established` 退回 `evolving`，但必须解释是哪条新证据或哪次反馈导致的。
4. 一条笔记永远不能把观察推进到 `established`。

### 支持证据与反向证据

1. 对每条已接受的证据，计算其方向 `signed = {high: +1, low: -1, neutral: 0} × strength`。
2. 观察的主导方向 = 该维度全部 signed 之和的方向；绝对值过小视为 `neutral`。
3. `polarity`：
   - `supporting`：与主导方向一致；
   - `contradicting`：与主导方向相反；
   - `neutral`：方向本身中性，或观察尚未定向。
4. **反向证据不得删除。** 它必须进入 `contradicting_evidence_ids`，并参与阶段与置信度判定。
5. 引用必须逐字来自用户笔记；找不到原文的引文一律排除，并计入 `unverified_evidence_count`。

### 用户反馈如何参与计算

| decision | 效果 |
|---|---|
| `accepted` | 置信度 ×1.1（上限 0.93），作为额外认可信号 |
| `partially_accepted` | 置信度 ×0.9，保留认可部分，`user_comment` 原样写入 `corrections_applied` |
| `rejected` | `effective: false`，置信度降到 0.05，不再作为有效支持证据；历史与原因保留 |
| `unsure` | 权重 ×1，不增加任何认可 |

同一条观察的相同 `decision + user_comment` 只能计算一次；更新判断时追加新反馈，不覆盖旧反馈。

### 输出片段

```json
{
  "evolution": {
    "observation_updates": [
      {
        "observation_id": "obs_visual",
        "dimension": "visual",
        "title": "视觉 · 构图与光线",
        "description": "从你确认过的 3 部电影里，有 3 条原句指向构图与光线……",
        "current_stage": "developing",
        "previous_stage": "emerging",
        "confidence": 0.51,
        "supporting_evidence_ids": ["ev_r1_visual_a1b2c3"],
        "contradicting_evidence_ids": [],
        "accepted_feedback_count": 1,
        "rejected_feedback_count": 0,
        "change_kind": "updated",
        "change_reason": "新增 2 条支持证据，置信度从 22% 变为 51%。"
      }
    ],
    "snapshot": {
      "snapshot_id": "snap_<stable-input-hash>",
      "created_at": "<ISO 8601>",
      "run_id": "<run id>",
      "overall_confidence": 0.44,
      "changes": [],
      "corrections_applied": []
    }
  }
}
```

`change_kind` 只能是 `created`、`updated`、`unchanged`、`withdrawn`。快照只能追加，不能覆盖旧快照。

## 质量判断

- 好输出：样本不足就直说；分数变化有证据支撑；纠错被保留；阶段变化有具体原因。
- 坏输出：用一条笔记断言“你偏爱慢热”；把中性维度写成 0；把模型推断当作用户长期偏好；把被拒绝的观察继续当作支持证据。
