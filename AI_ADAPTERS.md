# AI_ADAPTERS.md

**Frame by Frame AI Core 适配层说明**
配套规范：`AI_CORE_SPEC.md` v1.0.0 ｜ 日期：2026-11-16

本文件回答一个问题：**两端各自的代码，如何对上同一套核心规范。**

原则：Adapter 只做映射，不改语义。任何一端都不能因为“实现方便”而重新定义维度、方向或证据规则。

---

## 1. 字段总对照

| 核心概念 | 网站端 | DeepWorks 端 | 映射关系 |
|---|---|---|---|
| 六维 ID | `DIMENSION_IDS`（`server/core/contract.ts:10`） | `DIMENSIONS`（`workflow/validate-run.mjs:43`） | 完全同名，直通 |
| 六维定义 | `DIMENSION_GUIDE`（`contract.ts:26-78`） | 无独立定义，引用本规范 §2 | 网站为唯一代码来源 |
| theme / mood | `THEME_IDS` / `MOOD_IDS`（`contract.ts:80-116`） | `THEMES` / `MOODS`（`validate-run.mjs:49-53`） | 完全同名，直通 |
| direction | `AgentDirection` 四值（`src/lib/ai/contractV2.ts:82`）；提示词只列三值 | `DIRECTIONS` 四值（`validate-run.mjs:54`，本轮已补 `neutral`） | 四值对齐，提示词待补 |
| 证据引文 | `quote`（可选，`contractV2.ts:94`） | `quote`（必填、逐字校验） | 核心要求必填 |
| 证据解释 | `evidence`（必填，`contractV2.ts:91`） | `interpretation`（必填） | `evidence` → `interpretation` |
| 来源电影 | 由 `film_id` 在调用侧持有，未进入证据对象 | `source_film_id`（可选，本轮新增校验） | 需在写入侧注入 |
| 来源笔记 | 由 `recordId` 关联，无独立 note id | `source_note_id`（可选，本轮新增校验） | 见 §2.4 说明，缺则 `unknown_compat` |
| 画像 | `TasteProfile`（`tasteProfile.ts:262`） | `profile_delta`（`profile.mjs`） | 结构映射见 §4 |
| 画像版本 | `website-state-aggregate-v1`（本规范首次赋值） | `weighted-evidence-shrinkage-v2`（代码自声明） | 允许不同 |

---

## 2. Website Adapter（只读审计 + 映射方案，未改代码）

### 2.1 调用链

`server` 侧组织 prompt → 调用 DeepSeek API → `server/core/validate.ts` 做结构校验 → 归一化为 `AgentRunV2`（`src/lib/ai/contractV2.ts`）→ 前端 `src/lib/ai/adapter.ts` 转成界面模型 → `computeTasteProfile` 计算画像。

本轮**没有执行**任何一次 DeepSeek 调用，因此该链路的运行时行为未验证。

### 2.2 Prompt 组织

- `SYSTEM_PROMPT`（`prompt.ts:20-80`）：12 条分析原则 + 六维表（由 `DIMENSION_GUIDE` 渲染）+ 词表白名单 + JSON 输出结构 + 数值规则。
- `buildUserPrompt`（`prompt.ts:100-135`）：电影元信息、评分、用户主动标注感受、`<<<NOTE … NOTE>>>` 包裹的笔记、历史记录（明确标注“不能当作当前电影的证据”）。
- `buildRepairPrompt`（`prompt.ts:137-141`）：结构校验失败后重试，重申所有必填字段与“quote 必须逐字”。

与核心规范的一致性：12 条原则里的 1–12 与 `AI_CORE_SPEC.md` §1、§5、§6.3 基本一一对应；差异集中在 `direction` 与证据字段（见 §2.3）。

### 2.3 `direction` 适配方案（待实施，本轮未改）

| 现状 | 问题 | 建议改动 |
|---|---|---|
| 输出 schema 只列 `low \| high \| neutral`（`prompt.ts:61`） | 缺 `ambivalent`，但 `AgentDirection` 已含四值 | 在 schema 与输出要求中补 `ambivalent` 及其定义 |
| 原则写着“读不到就省略，不要用 neutral 凑数”（`prompt.ts:37`） | 语义正确，但未说明 `neutral` 的成立条件 | 增加一句：**只有当笔记明确表示该轴没有取舍时才用 `neutral`；完全没有相关表述就省略** |
| `contractV2.ts:82` 已定义四值 | 与提示词不同步，模型永远不会产出 `ambivalent` | 提示词与契约同步后，历史数据无需迁移 |

这三处都属于提示词/契约文本改动，**不在本轮执行范围**。

### 2.4 证据映射方案

```ts
// 伪代码：只做字段改名与来源注入，不改语义
const toCoreEvidence = (item, ctx) => ({
  quote: item.quote ?? '',
  interpretation: item.evidence,          // 网站字段名 → 核心字段名
  source_film_id: ctx.filmId,
  source_note_id: ctx.recordId ?? null,   // 网站无独立 note id
  source_status: ctx.recordId ? 'resolved' : 'unknown_compat',
})
```

约束：

- `interpretation` 直接取 `evidence` 原文，**不得二次改写**，否则等于制造新证据。
- `source_note_id` 目前只能填 `recordId`。它是一个“包含该笔记的记录 ID”，不是独立笔记 ID，必须在字段说明里标注，不能假装等价。
- 缺来源时写 `unknown_compat`，**不得生成占位 ID**。
- `quote` 为空的历史记录：保留，但标记 `quote_status: "missing"`，不得补写。

### 2.5 画像计算（现状描述，不改）

`computeTasteProfile(state, films)`（`tasteProfile.ts:262`）的逻辑：

1. 以“已确认（accepted）”的分析为输入，未确认的 `unreviewed` 不计入。
2. 维度级 `buildDimension`：按电影聚合成行，行权重来自笔记深度 × 评分确信度 × 分析置信度；`lean` 为加权有符号均值；一致性用标准差惩罚（`1 - stdev/1.15`，下限 0.55 偏移）。
3. 置信度：`sampleFactor(1 - e^(-n/3.2)) × (0.55 + 0.45 × 平均置信度) × 一致性 × 用户反馈因子`，封顶 0.9。
4. 达标条件：`n ≥ 3 且 confidence ≥ 0.32 且 consistency ≥ 0.45`。
5. 百分比：`value = 0.5 + lean / 2`，限制在 `[0.02, 0.98]`。
6. 输出还包含 `topThemes` / `topMoods` 汇总、`sampleState`（empty / insufficient / forming / stable）。

与 DeepWorks 的关键差别：**网站以“电影”为聚合单位并引入评分确信度与用户反馈因子；DeepWorks 以“笔记”为聚合单位、不做评分加权，但做跨笔记收缩与重复证据去重。** 二者不可互换，也不应为了让数字接近而调参。

---

## 3. DeepWorks Adapter

### 3.1 组成

| 层 | 资产 | 与核心规范的关系 |
|---|---|---|
| Agent | `.opencode/agents/film-curator.md` | 七步工作流 + 8 条绝对规则，规则 1–3、5 对应规范 §1、§5、§6.3 |
| Skills | `cinema-knowledge-retrieval`、`film-note-analysis`、`cinema-taste-profiling` | 分别对应知识引用、证据抽取、画像更新 |
| Workflow | `workflow/hash-note.mjs` → `validate-run.mjs` 等 | 七步，含笔记哈希、三态检索、证据门、引用门、画像、终检 |
| KB | 平台知识库 `4c321650-…`（12 篇） | 只提供解释性知识，不参与偏好判定 |
| 画像 | `.opencode/skills/cinema-taste-profiling/scripts/profile.mjs` | `weighted-evidence-shrinkage-v2` |
| 终检 | `workflow/validate-run.mjs` | 结构 + 证据 + 引用 + 画像一致性 |

### 3.2 四值枚举适配（本轮已实施）

两处代码改动，均已验证：

| 文件 | 改动 | 理由 |
|---|---|---|
| `workflow/validate-run.mjs:54` | `DIRECTIONS` 增加 `neutral` | 决策一要求 DeepWorks 适配四值；原集合只有三值，`neutral` 会被直接判非法 |
| `profile.mjs:44` | `DIR` 增加 `neutral: 0` | 若不补，`neutral` 证据会在聚合时被 `dir === undefined` 静默丢弃，导致“明明观察过却显示 unobserved”——这正好违反“不得把未知当作 neutral”的反向要求 |

`profile.mjs` 同时新增两个字段，用于区分“明确无倾向”与“双向矛盾”：

- `neutral_evidence_count`
- `ambivalent_evidence_count`

行为验证（smoke test，见 §5）：把 A 组 `emotion` 维度的一条证据改为 `neutral` 后：

```
emotion  observed  50  balanced  neutral=1  amb=0
character unobserved null unknown neutral=0 amb=0
```

即：`neutral` 让维度变 `observed` 且净拉力为零；未观测维度仍为 `unobserved`，`neutral_default: false` 未被破坏。

### 3.3 证据结构适配

`validate-run.mjs` 已经强制：`quote` 非空且逐字存在于输入笔记、`interpretation` 非空、`evidence_type ∈ {user_quote, inference}`、`strength/confidence ∈ [0,1]`。

本轮补充：`source_film_id` / `source_note_id` 若出现则必须为非空字符串；**未出现不报错**，以兼容 AI Core v1.0.0 之前产生的 A/B/C/D 运行记录。

推荐的运行级标记（设计，未强制）：

```json
"evidence_schema": "core-v1"
```

旧运行视为 `legacy-v0`，在报告层展示兼容状态，不回溯改写。

### 3.4 版本字段映射（设计，未强制）

来源：`workflow/core-version.mjs`。

| 字段 | 值 |
|---|---|
| `core_spec_version` | `1.0.0` |
| `agent_version` | `film-curator/1.0.0` |
| `workflow_version` | `seven-step/1.0.0` |
| `profile_algorithm_version` | `weighted-evidence-shrinkage-v2` |

`validate-run.mjs` 只检查“若存在则非空字符串”，不参与通过判定，因此**新增这些字段不会让任何历史运行失效**。

### 3.5 明确未改动

- 未改 Agent 正文（System Prompt 一字未动）。
- 未改三个 Skill 的 `SKILL.md`。
- 未重建知识库、未重传文档、未改任何 `entries.json` 正文。
- 未改七步工作流的顺序与产物路径。

---

## 4. 画像结构映射

| 核心字段 | Website（`TasteProfile`） | DeepWorks（`profile_delta`） |
|---|---|---|
| `status` | `thin: boolean` + `sufficient` | `status: observed / unobserved` |
| `score` | `value ∈ [0.02, 0.98]`（再 ×100 展示） | `score ∈ [0,100]` |
| `lean` | `lean ∈ [-1, 1]` 连续值 | `high / low / balanced / unknown` 离散 |
| `confidence` | `confidence ∈ [0, 0.9]` | 同区间，公式不同 |
| `note_count` | `sampleCount`（电影数，非笔记数） | `note_count`（独立笔记数） |
| `evidence_count` | `evidenceFilmIds.length` | `evidence_count`（证据条数） |
| 未知标记 | `thin: true` | `unobserved` + `neutral_default: false` |
| 整体是否可信 | `sampleState`（四态） | `sufficient` + `provisional` |

**这张表不是等价映射。** `value=0.5` 与 `score=50` 都可能出现，但前者是“lean 为零时的中点”，后者是“净拉力为零”。展示层不得把二者当作同一个数直接对齐。

---

## 5. 适配验证记录

| 项 | 命令 | 结果 |
|---|---|---|
| 四值枚举 | `validate-run.mjs`（A 组含 `neutral` 的 smoke 记录） | `ok: true`、`schema_valid: true` |
| 画像 `neutral` 行为 | `profile.mjs --evidence A-neutral.json` | `observed / 50 / balanced / neutral=1` |
| 未观测维度不受影响 | 同上 | `character: unobserved / null / unknown` |
| 历史运行不回归 | A、C 组重跑 | 均 `ok: true` |
| 负向控制 | `test-validate-run-negative.mjs` | 6/6 |
| 版本字段非破坏性 | 代码审阅 `requiredTop` 逻辑 | 只校验必需字段存在，不拒绝额外字段 |

smoke 产物在 `outputs/p2/_work/ai-core-smoke/`（工作文件，非交付证据）。

---

## 6. 尚未覆盖

1. **网站端未做任何修改**，`ambivalent` 仍无法从提示词产出。
2. **跨端映射未实跑**：没有把一条网站输出真正喂给 DeepWorks Adapter，反之亦然。
3. **`source_note_id` 语义不完整**：网站没有独立 note id，只能用 `recordId` 代位，已在 §2.4 标注。
4. **画像数字不可比**：两套算法并存是产品决策，任何“分数接近”都不构成一致性证明。
