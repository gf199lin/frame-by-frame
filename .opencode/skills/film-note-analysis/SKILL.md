---
name: film-note-analysis
description: 从用户的中文观影笔记中提取可回溯的六维审美证据，强制每条证据带原文逐字引用，并区分用户原话、模型推断与不确定结论。
metadata:
  author: "BayMax"
---

# Film Note Analysis

## 何时使用

当 Agent 需要把一段用户观影笔记转成结构化审美证据时使用。输入必须包含 `note`（用户原文）与 `film` 基本信息；输出是 `preference_evidence`、`analysis` 与 `uncertainties`。

## 不可违反的规则

1. **每条证据必须有 `quote`，且 `quote` 必须逐字出现在用户笔记中。** 找不到就删除该条证据，不要改写原文来迁就结论。
2. `quote` 至少 6 个汉字；不要用“我”“好看”“一般”这类无信息片段。
3. `evidence_type` 只能是 `user_quote` 或 `inference`：
   - `user_quote`：用户明确说出的感受或判断；
   - `inference`：从原句可以合理推出，但用户没有直接说出的倾向。
   两者都必须有原文引用，`inference` 的 `interpretation` 必须说明推断依据。
4. **不得编造用户没有表达过的偏好。** 不要用电影类型、导演、评分、简介替代笔记证据。
5. **一条笔记只能说明本次样本，不得据此断言长期偏好。** 长期结论交给 `cinema-taste-profiling`，并标注样本量。
6. 不确定、矛盾、信息不足的结论必须写入 `uncertainties`，至少 1 条。
7. 不要复述剧情简介；`summary` 只总结“这段笔记暴露了什么样的审美反应”。

## 六维定义（必须与产品一致）

| dimension_id | 低端（low） | 高端（high） |
|---|---|---|
| `narrative` | 慢热 · 向内 | 强情节 · 推进 |
| `emotion` | 克制 · 含蓄 | 浓烈 · 宣泄 |
| `thematic` | 向内 · 记忆与自我 | 向外 · 自由与世界 |
| `visual` | 自然 · 触感 | 风格化 · 构图 |
| `character` | 人物驱动 · 转变 | 群像 · 处境 |
| `ending` | 苦涩 · 未解 | 闭合 · 希望 |

`direction` 只能是 `high`、`low` 或 `ambivalent`；`strength` 与 `confidence` 都是 0–1。

## 可用 ID

- `mood`：melancholy, tender, wistful, hopeful, restrained, cathartic, uneasy, awe, warmth, longing, playful, quiet
- `theme`：memory, loss, grief, identity, love, ambition, freedom, family, hope, loneliness, art, time, reality, friendship, coming-of-age, forgiveness, sacrifice, justice

只使用以上 ID。无法归类时放进 `uncertainties`，不要自造 ID。

## 执行步骤

1. 读取 Agent 传入的 input JSON，确认 `note` 与 `film`。
2. 在笔记中找 3–6 个候选原句。优先选择能说明“为什么喜欢/不喜欢”“被什么打动/拒绝”的句子。
3. 为每个原句写一条 evidence：维度、方向、强度、置信度、解释。
4. 把结果写成 draft JSON（结构见下）。
5. 运行校验脚本：

```powershell
node .opencode/skills/film-note-analysis/scripts/validate-evidence.mjs --input <input.json> --analysis <draft.json>
```

6. 如果 `ok` 不是 `true`，根据 `failures` 修正 draft，再跑一次；最多修正 3 轮。仍失败时，在最终 JSON 的 `uncertainties` 中说明，并不要伪造通过。
7. 把 draft 路径与一句摘要返回给 Agent。

## Draft 结构

```json
{
  "analysis": {
    "summary": "一句话总结这段笔记暴露的审美反应，不超过 120 字",
    "observed_emotions": [{ "mood": "restrained", "evidence": "对应的原文片段" }],
    "themes_identified": [{ "theme": "grief", "evidence": "对应的原文片段" }],
    "confidence": 0.6
  },
  "preference_evidence": [
    {
      "dimension_id": "emotion",
      "direction": "low",
      "strength": 0.8,
      "confidence": 0.7,
      "quote": "必须逐字出现在 note 中的原句",
      "interpretation": "这句话说明了什么，不要扩写剧情",
      "evidence_type": "user_quote"
    }
  ],
  "uncertainties": ["这条笔记不足以判断的方面"]
}
```

## 跨记录字段（Taste Evolution）

当这次分析会被写入长期审美档案时，在每条 evidence 中额外输出：

| 字段 | 要求 |
|---|---|
| `evidence_id` | 稳定 ID，建议 `ev_<record_id>_<dimension>_<quote_hash>`；同一记录、同一维度、同一原句必须得到同一个 ID |
| `record_id` / `film_id` | 必须与输入一致，不得用片名或猜测的 ID 代替 |
| `source` | 产生这条证据的 Agent / 模型标识，例如 `deepworks` |
| `interpretation` | 明确是 AI 的解读，不得写成用户原话 |

不要在单条笔记阶段自行判定 `polarity`。**支持 / 反向证据是跨记录比较的结果**，由 `cinema-taste-profiling` 在已有观察的上下文中判定；单条笔记只能给出 `direction`。

如果输入里已经有同维度的既有观察，可以在 `uncertainties` 中写一句“这条证据可能与既有观察方向不同，需在画像阶段比较”，但不要提前改写观察。

## 质量判断

- 好证据：引文具体、解释克制、方向和强度匹配原文语气；ID 可重复生成且不漂移。
- 坏证据：引文是常识、解释比原文多、用类型推断替代原话、把一次反应说成长期偏好、把 AI 解读写成用户引文。
