---
name: cinema-knowledge-retrieval
description: 从 Frame by Frame 电影审美知识库中检索叙事、情绪、人物、视觉、声音与结局相关条目，返回真实 kb_id、来源与原文片段，并拒绝为了丰富分析而强行套用知识。
metadata:
  author: "BayMax"
---

# Cinema Knowledge Retrieval

## 何时使用

在分析用户笔记之前，或分析过程中需要解释某个具体手法时使用。知识库是“解释工具”，不是“结论来源”；它不能替代用户原话。

## 不可违反的规则

1. 只引用真实存在的 `kb_id`；不得编造条目、来源或原文。
2. `excerpt` 必须逐字来自该条目的 `text`；不能用自己的话冒充原文。
3. **不要为了显得丰富而强行检索或套用。** 如果笔记没有涉及某个概念，不要引用它。
4. 如果检索结果与笔记关系很弱（最高分 < 2，或你无法用一句话说明“为什么相关”），把 `kb_status` 设为 `no_relevant_entry`，`kb_citations` 留空。
5. 引用数量控制在 0–3 条；优先选择最能解释“用户为什么这样反应”的条目。
6. 知识库条目不构成对用户的判断；不要写“知识库证明你喜欢 X”。

## 检索步骤

1. 构造 query：优先使用笔记里的具体词（如“克制、结局、和解、静默、群像”），再加入 `felt_like` 与电影类型；不要只用片名。
2. 运行检索脚本：

```powershell
node .opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs --input <input.json> --top 4 --out <retrieval.json>
```

3. 阅读返回的 `results`。`score` 只是关键词重合度，不是语义相似度；必须打开条目阅读完整 `text`。
4. 选择 0–3 条真正相关的条目，写成 `kb_citations`。
5. 运行引用校验：

```powershell
node .opencode/skills/cinema-knowledge-retrieval/scripts/validate-citations.mjs --citations <draft.json>
```

6. 如果 `ok` 不是 `true`，修正后重跑；最多 3 轮。仍失败时在 `uncertainties` 中说明，不要伪造引用。

## 引用结构

```json
{
  "kb_status": "cited",
  "retrieval_log": {
    "query": "克制 结局 和解",
    "top_ids": ["KB-004", "KB-003", "KB-009"],
    "selected_ids": ["KB-004", "KB-003"]
  },
  "kb_citations": [
    {
      "kb_id": "KB-004",
      "title": "结局：闭合、开放与苦涩的未解",
      "source": "原创整理（基于公开电影理论概念，未复制原文）",
      "excerpt": "开放结局不提供答案，但通常提供一个明确的情绪位置",
      "why_relevant": "用户明确说喜欢没有和解的结尾，这条解释了该选择的情绪功能"
    }
  ]
}
```

`kb_status` 只能是 `cited` 或 `no_relevant_entry`。

## 为审美观察检索时

当检索结果要支撑一条跨记录观察时：

1. Query 必须来自用户原句里的具体手法词（例如“构图、镜头移动、光线、留白、静默、群像”），不要用“我的审美”“长期偏好”这类结论词检索。
2. 引用只能解释**电影手法或情绪机制**，不能证明“用户喜欢什么”。`why_relevant` 必须同时指向原句和手法，例如“用户提到镜头移动，这条解释运动镜头如何改变注意力的落点”。
3. 同一条观察最多引用 2 条知识；如果两条讲的是同一件事，只保留更具体的一条。
4. 没有真实 `kb_id` 时不引用。知识库为空不影响观察成立，只影响解释的丰富度。
5. 知识库引用不得进入 `supporting_evidence_ids`。证据 ID 只能来自用户笔记。

## 质量判断

- 好引用：能解释用户原话里的一个具体选择，且 `why_relevant` 指向笔记中的词与具体手法。
- 坏引用：条目只是听起来高级；把“叙事”这类大词硬套到任何笔记上；用知识库条目替代用户证据；引用长度超过 120 字。
