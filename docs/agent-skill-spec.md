# Frame by Frame · Agent / Skill 规格书 v0.1

> 适用约束：**单人开发**，**2026-11-24 18:00 提交**，**11-28（周六）现场决赛**。
> 赛事：滴普杯 DeepWorks 校园黑客松 2026 · 赛道 C「自由开放 · 主题不限」。
> 赛题主标语：**「从提问到交付，让 AI 真正替你干活」**——这句话是评审的隐含评分轴，见 1.1 节。
> 本文档只定义"智能层"的契约，不涉及页面视觉稿。所有接口先按平台无关方式定义，第 9 节再映射到 DeepWorks。

---

## 0. 这份文档解决什么问题

GPT 给出的原方案是"4 周 / 6 Agent / 9 表 / 5 页面"，那是一个 3–4 人团队的排期。单人 19 天要跑完，必须做三件事：

1. **把"AI 判断"拆成"抽取"和"计算"两半**，让可复现的部分不交给模型。
2. **把 Agent 数量当成叙事资源，而不是工程量**：角色可以多，但真正独立的执行单元要少。
3. **先打通一条端到端链路**，再横向铺页面。任何"最后一周才接平台"的安排都是赌博。

本文档的核心主张只有一句：

> **模型只负责"从用户的话里抽出证据"和"把证据讲成人话"，权重、置信度、冲突检测、变化 diff 全部由确定性代码计算。**

这条主张同时解决三个问题：结果可复现（答辩能当场重跑）、可测试（能写单测）、可解释（每条结论都能指回原话）。

---

## 1. 范围裁剪：保留什么，砍掉什么

| 模块 | GPT 原方案 | 本规格 | 理由 |
|---|---|---|---|
| Agent 角色 | 1 Master + 5 专业 | **1 编排 + 5 角色**，其中 3 个为独立执行单元 | 角色保留用于叙事，执行单元收敛以控制调试成本 |
| Skill | 6 个 | **5 个**（`taste_report` 降级为前端聚合） | 报表可由快照表直接渲染，不需要 Agent |
| 数据表 | 9 张 | **6 张** | 合并 `reviews`/`extracted_traits`/`taste_evidence` 的冗余拆分 |
| 页面 | 5 个 | **4 个**（Reflection 后置为 My Taste 的子区块） | 单人无法维护 5 套页面状态 |
| 图谱 | P1 | **P1，但锁定 3 天上限** | 视觉锤值得做，但不能吞掉核心链路 |
| 推荐 | P0 | **P1**（先做"有理由的 3 条"，不做推荐系统） | 推荐是最容易被质疑"套壳"的部分，解释比数量重要 |
| 真实用户测试 | 5–10 人 | **5 人 + 录屏**，第 3 周做 | 单人时间不够做完整实验，但必须有真实反馈素材 |

被砍掉的部分不进代码，但**进答辩材料**（"我们验证过方向，受赛期限制先做核心闭环"），这是加分项而不是减分项。

### 1.1 与赛题口号的叙事对齐（重要）

海报主标语是"**从提问到交付，让 AI 真正替你干活**"。这句话隐含一个评分倾向：评委想看的是 **AI 完成了一件可交付的东西**，而不是"AI 陪你聊了聊你的感受"。

Frame by Frame 原始表述是"AI 逐渐理解我的审美"——这是**理解**，不是**交付**。如果不改写，现场很容易被问一句："所以它替你干了什么活？"

**改写方式（不推翻产品，只重新定义输入与输出）**

| 环节 | 原表述 | 对齐赛题后的表述 |
|---|---|---|
| 输入 | 用户记录观影感受 | 用户丢进一段**散乱的口述/笔记**（30 秒，不整理、不打标签） |
| 过程 | AI 分析偏好 | AI 自动完成：识别影片 → 抽取证据 → 更新画像 → 检索关联 → 生成解释 |
| **交付** | AI 给出洞察 | AI **交付 3 份成品**：① 一张可直接收藏的电影记忆卡 ② 更新后的《我的审美档案》（含变化说明） ③ 一份有理由的下一部片单 |

一句话版本：

> **你只说 30 秒，AI 交付三份东西，而且每一句结论都能点回你的原话。**

这样既不丢"逐渐理解"的创新点，又正面命中"从提问到交付"。**答辩第一页就应该放这个对比**。

补充两点判断：

- 赛道 C 主题不限，但 A/B 是企业命题，评委对"企业场景"更熟。自由赛道要赢，靠的是**完成度 + 一个记得住的瞬间**，不是技术堆料。
- "一个人也能参赛"是海报明确写的。单人不是劣势，评审不会按团队规模折算工作量，**但会用完成度检验你**——所以宁可少一个页面，不可少一次能跑通的演示。

---

## 2. 架构总览

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (React + TS + Tailwind)                        │
│  Home / Archive / Memory Map / My Taste                  │
└───────────────────────────┬──────────────────────────────┘
                            │ REST (JSON)
┌───────────────────────────▼──────────────────────────────┐
│  API (FastAPI)                                           │
│  /records  /taste  /memory  /recommend  /agents/runs     │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│  Orchestrator (Master Agent)                             │
│  任务分类 → 角色调度 → 结果合成 → 失败降级                │
└───┬───────────┬───────────┬───────────┬──────────────────┘
    │           │           │           │
┌───▼───┐  ┌────▼────┐  ┌───▼────┐  ┌───▼─────┐
│ Film  │  │Reflection│  │ Taste  │  │ Memory  │
│ Agent │  │  Agent   │  │ Agent  │  │ Agent   │
└───┬───┘  └────┬────┘  └───┬────┘  └───┬─────┘
    │           │           │           │
┌───▼───────────▼───────────▼───────────▼──────────────────┐
│  Skills (确定性代码，可单测)                              │
│  film_lookup / review_extract / taste_update /            │
│  memory_retrieve / film_recommend                         │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│  PostgreSQL: users / films / watch_records / traits /     │
│              film_relations / taste_snapshots             │
│              (+ agent_runs 观测表)                        │
└──────────────────────────────────────────────────────────┘
```

**职责红线**

- Agent **不得**直接写数据库、不得自己算分数、不得编造影片信息。
- Skill **不得**调用大模型做判断（可以调用 embedding，但必须是可选路径）。
- 前端**不得**自己拼装 AI 结论，所有"AI 说的话"必须来自 `agent_runs` 的一条记录。

---

## 3. 数据契约

### 3.1 核心对象

```json
// Film
{
  "id": "film_0001",
  "title_cn": "海边的曼彻斯特",
  "title_en": "Manchester by the Sea",
  "year": 2016,
  "director": "Kenneth Lonergan",
  "genres": ["剧情", "家庭"],
  "runtime_min": 137,
  "poster_url": "/static/posters/0001.jpg",
  "source": "seed",
  "tmdb_id": null
}
```

```json
// WatchRecord
{
  "id": "rec_0007",
  "user_id": "u_001",
  "film_id": "film_0001",
  "watched_at": "2026-11-08",
  "rating": 4.5,
  "review_raw": "整部片子最打动我的是那种说不出口的愧疚……",
  "mood": "低落但平静",
  "context": "深夜一个人看的",
  "evidence": ["ev_001", "ev_002", "ev_003"],
  "created_at": "2026-11-08T23:41:00+08:00"
}
```

```json
// Evidence（最小单元，一切结论的根）
{
  "id": "ev_001",
  "record_id": "rec_0007",
  "film_id": "film_0001",
  "dimension": "character",
  "tag": "人物心理刻画",
  "polarity": 1,
  "strength": 0.8,
  "quote": "那种说不出口的愧疚",
  "source": "review",
  "created_at": "2026-11-08T23:41:00+08:00"
}
```

- `polarity`：`1` 支持 / `-1` 反对
- `strength`：`0.3` 弱 / `0.6` 中 / `0.9` 强（由抽取阶段给出，只允许这三档，避免模型给无意义小数）
- `source`：`review` / `rating` / `correction`（用户纠错）/ `inferred`
- **`quote` 为空或无法在 `review_raw` 中定位的证据，直接丢弃。** 这是防幻觉的硬门禁。

```json
// TraitState（画像中的一行）
{
  "user_id": "u_001",
  "dimension": "character",
  "tag": "人物心理刻画",
  "pos_sum": 1.5,
  "neg_sum": 0.6,
  "score": 0.25,
  "confidence": 0.57,
  "evidence_count": 3,
  "last_evidence_at": "2026-11-14",
  "conflict": false
}
```

```json
// TasteSnapshot（"AI 眼中的我"的时间线节点）
{
  "id": "snap_0004",
  "user_id": "u_001",
  "after_record_id": "rec_0004",
  "profile": {
    "top_traits": [
      { "dimension": "emotion", "tag": "克制的悲伤", "score": 0.62, "confidence": 0.58 }
    ]
  },
  "diff": {
    "added": [{ "tag": "克制的悲伤", "score": 0.31, "confidence": 0.34 }],
    "strengthened": [{ "tag": "人物心理刻画", "from": 0.50, "to": 0.62 }],
    "weakened": [{ "tag": "强情节反转", "from": 0.22, "to": 0.08 }],
    "conflicts": []
  },
  "created_at": "2026-11-14T21:10:00+08:00"
}
```

### 3.2 数据库表（6 + 1）

| 表 | 关键字段 | 说明 |
|---|---|---|
| `users` | id, nickname, created_at | 单人演示也需要 |
| `films` | id, title_cn, title_en, year, director, genres, poster_url, source | 本地种子库优先 |
| `watch_records` | id, user_id, film_id, watched_at, rating, review_raw, mood, context, evidence_json | `evidence_json` 存轻量证据，便于一次查询 |
| `traits` | user_id, dimension, tag, pos_sum, neg_sum, score, confidence, evidence_count, last_evidence_at, conflict | 主键 `(user_id, dimension, tag)` |
| `film_relations` | id, user_id, from_film_id, to_film_id, relation_type, reason, weight | 图谱数据，P1 |
| `taste_snapshots` | id, user_id, after_record_id, profile_json, diff_json, created_at | 驱动时间线 |
| `agent_runs` | id, user_id, workflow, status, input_json, output_json, latency_ms, error | 观测与答辩证据 |

> 为什么保留 `agent_runs`：答辩时可以现场调出一条真实运行记录，证明 Agent 是真跑的，而不是前端硬编码。这比 PPT 上的架构图有说服力。

---

## 4. 标签体系（Taxonomy）

自由标签会让"画像"无法聚合，也会让模型每次产出不同的词。**必须预置封闭词表**，模型只能从词表里选，选不出就返回 `null`。

| 维度 `dimension` | 中文名 | 标签示例（每维 8–12 个） |
|---|---|---|
| `emotion` | 情绪基调 | 克制的悲伤 / 明亮治愈 / 压迫窒息 / 荒诞幽默 / 温柔怀旧 / 愤怒 / 孤独 / 平静 |
| `character` | 人物 | 人物心理刻画 / 群像 / 表演驱动 / 角色弧光 / 反英雄 / 关系张力 |
| `narrative` | 叙事 | 非线性 / 强情节反转 / 慢节奏 / 留白 / 日常流 / 多线交织 / 开放式结局 |
| `visual` | 视听 | 长镜头 / 自然光 / 高饱和色彩 / 冷色调 / 手持摄影 / 对称构图 / 配乐驱动 |
| `theme` | 主题 | 家庭 / 成长 / 阶层 / 记忆 / 死亡 / 身份认同 / 孤独 / 时间 |
| `attitude` | 观影取向 | 作者表达 / 类型爽感 / 现实关怀 / 形式实验 / 情绪价值 / 思想密度 |

**规则**

- 一条证据只能属于一个 `(dimension, tag)`。
- `attitude` 维度是"元偏好"，用于解释"你为什么喜欢"，不直接参与推荐排序。
- 词表存在 `taxonomy.json`，前后端共用；模型 prompt 里以 JSON 注入。

---

## 5. Agent 规格

所有 Agent 统一输入输出信封：

```json
// 输入
{ "run_id": "run_01H...", "workflow": "record_movie", "payload": { }, "context": { } }

// 输出
{
  "run_id": "run_01H...",
  "agent": "reflection",
  "status": "ok",
  "data": { },
  "confidence": 0.72,
  "notes": "用户未提视听维度，该维度不产出证据",
  "needs_user_input": null
}
```

`status` 枚举：`ok` / `partial` / `needs_user_input` / `failed`。

### 5.1 Master（编排 Agent）

- **职责**：判断任务类型（新记录 / 问审美 / 要推荐 / 纠错），按固定 DAG 调度角色，合成最终展示卡片，处理降级。
- **不做**：不生成任何审美结论，不改写用户原话。
- **输入**：`{ user_id, intent_hint?, text?, film_hint? }`
- **输出**：`{ workflow, steps[], result_card, degraded }`
- **任务分类**：优先用规则（有没有电影名 / 有没有"推荐" / 有没有"我是什么样"），规则命中不了才走 LLM 二分类。**不要让 Master 每轮都调模型**，延迟会崩。
- **失败策略**：任一子步骤失败 → 返回已完成部分 + 明确缺失项（`partial`），绝不返回空卡片。

### 5.2 Film Agent

- **职责**：把用户给的名字/描述定位到唯一影片；补齐元数据；判断歧义。
- **输入**：`{ query: string, year?: number }`
- **输出**：`{ film?: Film, candidates?: Film[], match_confidence: number }`
- **关键规则**：`match_confidence < 0.6` 或候选 ≥ 2 时必须返回 `needs_user_input`，让用户点选。**不允许猜**。
- **Prompt 要点**：只做归一化（去掉"那部""的电影"等口语），不做联想；输出必须是词表内的影片 id。
- **降级**：查不到就返回 `NOT_FOUND`，前端提供"手动添加影片"入口（title/year/自定义标签），保证演示不中断。

### 5.3 Reflection Agent（核心之一）

- **职责**：从用户自然语言笔记中抽取情绪、主题、人物、叙事、视听证据，并给出极性、强度、原话引用。
- **输入**：`{ review_raw, rating?, mood?, film }`
- **输出**：`{ evidence: Evidence[], summary_one_line, unanswered_dimensions: string[] }`
- **Prompt 要点**：
  1. 只抽"用户明确表达"的内容，不推断；
  2. 每条必须带 `quote`，且 `quote` 必须是原文的连续子串；
  3. 维度没提到就留空，并在 `unanswered_dimensions` 里列出；
  4. 最多 6 条，宁可少不可凑。
- **后处理（代码层）**：校验 `quote in review_raw`，不通过即丢弃；`strength` 只允许 0.3/0.6/0.9。
- **验收**：给 10 条真实影评，抽取准确率 ≥ 70%，无引用证据为 0 条。

### 5.4 Taste Agent（核心之二）

- **职责**：把证据翻译成"画像变化"的人话；解释某条偏好为什么成立；在冲突时生成追问。
- **输入**：`{ user_id, diff, current_profile, trigger_record }`
- **输出**：`{ headline, changes: [{tag, direction, why, evidence_refs[]}], question?: string }`
- **不做**：不计算 score，不排序候选，不新增标签。
- **Prompt 要点**：所有句子必须能指向 `evidence_refs`；禁止出现"你是一个……的人"这类人格断言，只描述"你在 N 部电影里反复被 X 打动"。
- **降级**：LLM 超时则用模板句（"这次记录强化了你对「人物心理刻画」的偏好，依据是《X》里的原话……"）。

### 5.5 Memory Agent

- **职责**：检索历史记录、找电影之间的主题关联、回答"我以前是不是也这样"。
- **输入**：`{ user_id, query?, film_id?, limit }`
- **输出**：`{ records[], related_films[{film, relation_type, reason, shared_tags}], traits_summary }`
- **关键规则**：关联必须基于共享标签或共享证据，不能靠语义相似度硬凑；每条关联给出 `reason`。
- **降级**：图谱未就绪时只返回"同标签影片列表"，前端降级为标签云。

### 5.6 Discovery Agent

- **职责**：基于画像生成 3 条推荐，并解释"匹配了哪几条偏好、哪条证据支撑"。
- **输入**：`{ user_id, limit: 3, exclude_seen: true }`
- **输出**：`{ items: [{ film, matched_traits[], reason, confidence }] }`
- **关键规则**：候选来自本地种子库（可控），排序 = 标签匹配度 × 画像置信度；**明确排除已看**；每条必须写"不推荐理由"以外的反向说明（"它可能不合你口味的地方"），这条最能体现诚实感。
- **降级**：画像证据 < 3 条时返回"我还不够了解你"，并引导再记录 2 部。

---

## 6. Skill 规格

统一约定：同步调用、超时 8s、幂等、返回 `{ok, data, error}`。

| Skill | 签名 | 返回 | 失败码 |
|---|---|---|---|
| `film_lookup` | `(query, year?)` | `{film, candidates[], confidence, source}` | `NOT_FOUND` / `AMBIGUOUS` / `UPSTREAM_TIMEOUT` |
| `review_extract` | `(review_raw, film, taxonomy)` | `{evidence[], summary, unanswered[]}` | `NO_EVIDENCE` / `LLM_TIMEOUT` |
| `taste_update` | `(user_id, evidence[], record_id)` | `{updated[], diff, conflicts[], snapshot_id}` | `INSUFFICIENT_EVIDENCE` |
| `memory_retrieve` | `(user_id, query?, film_id?, limit)` | `{records[], related[], traits_summary}` | `EMPTY` |
| `film_recommend` | `(user_id, limit, exclude_seen)` | `{items[]}` | `COLD_START` |

### 6.1 `film_lookup`

1. 精确匹配 `title_cn` / `title_en`（去空格、去标点、去"电影/那部"）。
2. 未命中 → 模糊匹配（编辑距离 ≤ 2）+ 年份过滤。
3. 仍未命中 → TMDB 搜索（可选，超时 3s）。
4. 返回候选时按 `year` 和 `genres` 相关性排序，最多 5 个。

### 6.2 `review_extract`

1. 组装 prompt：taxonomy + film 元数据 + 用户笔记 + 输出 JSON schema。
2. 调模型，`temperature=0.2`，强制 JSON。
3. 代码校验：JSON 合法 → `quote` 子串校验 → 枚举校验 → 去重。
4. 至少 1 条有效证据，否则 `NO_EVIDENCE`（前端提示"再多说两句你的感受"）。

### 6.3 `taste_update`（纯计算，无模型）

```
for each evidence e:
    if e.polarity > 0: pos_sum += e.strength
    else:              neg_sum += e.strength
    evidence_count += 1
    last_evidence_at = max(last_evidence_at, e.created_at)

score      = (pos_sum - neg_sum) / (pos_sum + neg_sum + K)      # K = 1.5
confidence = 1 - exp(-(pos_sum + neg_sum) / 2.5)

conflict = (pos_sum >= 0.6 and neg_sum >= 0.6 and |pos_sum - neg_sum| < 0.6)
```

- 写 `traits` → 生成 `diff`（新增 / 增强 / 减弱 / 冲突）→ 写 `taste_snapshots`。
- **整个函数必须能在无网络环境下单测通过**。

### 6.4 `memory_retrieve`

1. 按标签重叠度召回（Jaccard）。
2. 按时间衰减加权：`w = overlap * exp(-days/180)`。
3. 取 top 6 关联影片，每条附 `shared_tags` 与一句 `reason`（模板生成，不调模型）。

### 6.5 `film_recommend`

1. 取 `confidence >= 0.35` 且 `score > 0` 的 top 8 标签。
2. 对种子库每部未看影片计算匹配分：`Σ(tag_score * trait_score * confidence)`。
3. 取 top 3，若最高分 < 阈值则返回 `COLD_START`。

---

## 7. 编排时序

### 7.1 Workflow A：记录一部电影（主链路，必须最先跑通）

```
用户输入（片名 + 感受）
   │
   ├─① Master.classify ──→ workflow=record_movie
   │
   ├─② Film.lookup ──→ 唯一影片?
   │        └─ 否 → 返回候选，等用户点选（needs_user_input）
   │
   ├─③ Reflection.extract ──→ evidence[]（0 条则提示补充）
   │
   ├─④ taste_update ──→ diff + conflicts + snapshot
   │
   ├─⑤ Taste.explain ──→ 变化说明（1 句 headline + ≤3 条 changes）
   │
   ├─⑥ memory_retrieve ──→ 关联影片（可异步，不阻塞卡片）
   │
   └─⑦ Master.compose ──→ 结果卡：
        · 本片档案（海报/元数据/你的原话）
        · 这次新增的 2–3 条证据（带引用）
        · 画像变化（新增/增强/减弱，各一条）
        · 1 个追问（冲突或缺失维度，可选）
```

**验收标准**：连续录入 5 部电影，第 5 次的结果卡必须能显示"相比第 1 次，AI 对你的理解变了什么"，且每条变化可点开看原话。

### 7.2 Workflow B：问"我到底喜欢什么"

```
问题 → memory_retrieve(top traits + records) → Taste.explain
     → 回答 = 结论 + 3 条依据（影片 + 原话）+ 置信度 + "哪里不准"入口
```

规则：证据 < 3 条时回答"我才看了你 2 部电影，还不能下结论"，**不允许硬编**。

### 7.3 Workflow C：推荐下一部

```
traits(top) → film_recommend(3) → Discovery.explain
     → 每条 = 片名 + 匹配偏好 + 一句理由 + 一句"可能不合你口味的地方"
```

### 7.4 纠错回流

用户在任意卡片点"不太准确" → 生成 `Evidence{source: correction, polarity: -1, strength: 0.9, quote: 用户填写的理由}` → 重新 `taste_update` → 新 diff。**纠错必须触发一次可观察的画像变化**，否则这个功能等于没有。

---

## 8. 审美模型算例（答辩可直接讲）

假设用户依次记录三部电影：

| 次序 | 影片 | 证据 | 极性 | 强度 |
|---|---|---|---|---|
| 1 | 海边的曼彻斯特 | 人物心理刻画 | +1 | 0.9 |
| 2 | 燃烧 | 人物心理刻画 | +1 | 0.6 |
| 3 | 信条 | 人物心理刻画 | −1 | 0.6 |

计算 `人物心理刻画`：

| 时点 | pos | neg | score = (p−n)/(p+n+1.5) | confidence = 1−e^−(p+n)/2.5 |
|---|---|---|---|---|
| 第 1 部后 | 0.9 | 0 | 0.9/2.4 = **0.375** | 1−e^−0.36 = **0.30** |
| 第 2 部后 | 1.5 | 0 | 1.5/3.0 = **0.50** | 1−e^−0.60 = **0.45** |
| 第 3 部后 | 1.5 | 0.6 | 0.9/3.6 = **0.25** | 1−e^−0.84 = **0.57** |

解读（这段就是产品要展示的话）：

> 第 1 部之后，我只是"初步觉得"你在意人物心理；第 2 部让我更确定；第 3 部你明确说人物动机没立住，所以我把它下调了——但**置信度反而上升了，因为我现在有三条证据，而不是一条**。

这个"分数下降、置信度上升"的组合，是整套模型最能体现"AI 在逐渐理解你"的地方：**它不是越来越自信地夸你，而是越来越清楚边界在哪。**

冲突示例：若 `pos=0.9, neg=0.9`，则 `conflict=true`，生成追问：

> 你在《海边的曼彻斯特》里很认可人物刻画，但在《信条》里觉得人物是工具。这是"类型不同要求不同"，还是你最近的标准变了？

用户回答会作为新证据回流，并可能分裂出子标签（`人物心理刻画@剧情片`）。**子标签是 P2，不要在第一版实现。**

---

## 9. DeepWorks 落地映射

### 9.1 两种用法要分清

| 用法 | 说明 | 优先级 |
|---|---|---|
| **A. 产品运行时** | 产品的智能层由 DeepWorks 的 Agent Team 承担，评委看到的是真实编排 | 必须 |
| **B. 开发辅助** | 用 DeepWorks 生成代码、调试、写文档 | 顺带 |

答辩只讲 A。B 不用提。

### 9.2 Agent Team 配置

| DeepWorks Agent | 对应角色 | 独立执行单元 | 说明 |
|---|---|---|---|
| `master` | 编排 | ✅ | 唯一入口，负责分类与合成 |
| `film` | 影片识别 | ✅ | 可只做 Skill 包装 |
| `reflection` | 证据抽取 | ✅ | 核心，必须独立 |
| `taste` | 画像解释 | ✅ | 核心，必须独立 |
| `memory` | 检索与关联 | ⭕ | 可并入 taste 的调用链 |
| `discovery` | 推荐解释 | ⭕ | 可与 memory 共用一个 Agent |

真实独立执行单元 = **4 个**（master / reflection / taste / memory+discovery）。这样既保住"多 Agent 协作"的叙事，又把调试面收敛到 4 份 prompt。

### 9.3 Skill 目录

```
.opencode/skills/
├── film-lookup/SKILL.md      + scripts/lookup.py
├── review-extract/SKILL.md   + scripts/extract.py
├── taste-update/SKILL.md     + scripts/update.py
├── memory-retrieve/SKILL.md  + scripts/retrieve.py
└── film-recommend/SKILL.md   + scripts/recommend.py
```

`SKILL.md` 只写：何时调用、参数、返回、错误、示例。**不要把 prompt 塞进 SKILL.md**，prompt 归 Agent。

### 9.4 必须提前验证的三件事（D1–D2 完成）

1. 比赛账号能否创建 **多个 Agent** 并让它们互相调用。
2. 自定义 Skill 能否执行 **本地 Python 脚本** 并访问项目数据库/文件。
3. Agent 的输出能否被 **HTTP 接口** 取到（前端要展示真实运行结果）。

> 如果第 1 条不成立：退化为"单 Agent + 多角色 prompt"，在后端做编排，DeepWorks 负责 reflection/taste 两个核心角色。叙事改成"Agent 内多角色协作"，仍然真实。
> 如果第 3 条不成立：前端改为读 `agent_runs` 表回放，演示时用录屏兜底。

**Plan B 必须在 D2 之前确定，不能拖到第 3 周。**

---

## 10. 19 天排期（单人）

| 日期 | 任务 | 交付物 | 验收 |
|---|---|---|---|
| 11/05（D1） | 冻结范围；**确认报名（11/09 18:00 截止）**；跑通 DeepWorks 最小调用 | 能力验证记录 + 报名回执 | 能拿到一次 Agent 输出 |
| 11/06–11/07 | 数据层 + 50 部种子电影 + taxonomy | 建表脚本、`seed.json` | 能按片名查到唯一影片 |
| 11/08–11/10 | 记录链路：表单 → 抽取 → 更新 → 结果卡 | Workflow A 端到端 | 连续录 5 部，画像有 diff |
| 11/11–11/13 | My Taste 页 + How AI Sees Me 时间线 | 画像页 | 能回看第 1/3/5 部后的变化 |
| 11/14–11/15 | Home + Archive | 两个页面 | 列表、详情、空状态可用 |
| 11/16–11/17 | Memory Map + 3 条推荐 | 图谱页、推荐卡 | 关联有理由，推荐可解释 |
| 11/18–11/19 | 造演示数据（12 部电影）+ 稳定性 | 演示账号数据 | 冷启动到第 12 部全流程无报错 |
| 11/20–11/21 | 5 人真实测试 + 修最痛的 3 个问题 | 反馈记录 | 完成一轮可用性修正 |
| 11/22 | 提交材料 + 3 分钟演示录屏 | 视频、讲稿、作品说明 | 断网也能放 |
| 11/23 | 缓冲 + 提交 | 提交包 | 按赛制清单逐项核对 |
| **11/24 18:00** | **提交硬截止** | — | — |
| 11/25–11/27 | **决赛答辩排练**（现场演示脚本、Q&A 预案、备用机） | 现场包 | 全流程连续走 3 遍不卡壳 |
| **11/28** | **现场决赛与颁奖** | — | — |

**时间分配原则**：智能层 40%，页面 30%，演示与材料 30%。单人项目最常见的死法是"页面做得很漂亮，但演示时画像不变"。

**注意**：11/24 不是终点。11/28 现场决赛，中间只有 3 个工作日。**11/22 之前必须完成"可离线播放的演示视频"**，否则现场一旦断网或接口限流，整场比赛就结束了。

---

## 11. 验收清单

- [ ] 录入一部新电影，8 秒内返回结果卡
- [ ] 每条 AI 结论都能点开看到原话引用
- [ ] 连续录入 5 部，第 5 部的结果卡显示与第 1 部的差异
- [ ] 点"不太准确"后，画像在 3 秒内发生变化
- [ ] 证据不足 3 条时，AI 明确说"还不能下结论"
- [ ] 片名歧义时返回候选而不是猜
- [ ] 断网时前端有可演示的缓存数据
- [ ] `agent_runs` 里能查到每次运行的输入输出与耗时
- [ ] `taste_update` 有单测，覆盖新增/增强/减弱/冲突四种情况
- [ ] 全流程演示能在 3 分钟内讲完

---

## 12. 待确认（阻塞项）

海报已确认的硬信息：赛道 C、报名 11/09 18:00 截止、提交 11/24 18:00、决赛 11/28 现场。

仍缺、且会影响方案的四项：

1. **报名是否已完成**（11/09 18:00 截止，今天 11/05）。没报名一切归零，今天必须确认。
2. **提交物清单**：海报只写了时间，没写要交什么（代码仓库 / 部署链接 / 演示视频 / 作品说明 / PPT？）。需要进群或看赛事手册拿到，这决定 11/22–11/24 三天的全部安排。
3. **比赛账号的 DeepWorks 权限**：Agent 数量、Skill 执行、外部 HTTP 调用、积分额度是否够跑完整演示。
4. **现场决赛形式**：是否有固定路演时长、是否允许本机演示、评委是否上手操作。这决定离线兜底做到什么程度。

评分维度仍然未知。如果拿到，优先级会这样调整：技术创新权重高 → 加大审美模型与 Agent 编排篇幅，图谱降为截图；完成度权重高 → 压缩图谱，把 5 人测试和稳定性做扎实。

---

*文档版本 v0.2 · 下一步：确认第 12 节第 1、2 项后，进入 D2 的数据层与种子库。*
