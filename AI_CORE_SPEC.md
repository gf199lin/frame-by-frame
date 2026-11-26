# AI_CORE_SPEC.md

**Frame by Frame AI Core Specification**
版本：**v1.0.0** ｜ 生效日期：2026-11-16 ｜ 状态：已发布（规范层），双端已在用
上位文件：本文件。下位文件：`AI_ADAPTERS.md`、`AI_CHANGELOG.md`、`AI_CONSISTENCY_TESTS.md`、`AI_CORE_IMPLEMENTATION_REPORT.md`

本规范定义“产品规则”，不定义“怎么实现”。任何具体代码、模型或平台都可以替换，本文件里的规则不随之改变。

---

## 1. Product Identity

Frame by Frame 是一个**个人电影记忆博物馆**。

它不是推荐引擎，不是影评生成器，不是评分聚合器。它做的事只有一件：

> 从用户真实写下的观影笔记、情绪反馈和电影记录中，逐渐理解这个人的电影审美。

三条不可让渡的前提：

1. **笔记优先于百科。** 用户写了什么，永远比电影简介、类型标签、主流解读更有证据力。
2. **不急于定义用户。** 一部电影只能提供“这一次的证据”。画像的可靠性来自多条独立笔记的累积，而不是单次洞察的强度。
3. **宁可说不知道。** 证据不足时输出“未观察到”，不输出“大概是这样”。

---

## 2. 六个审美维度

六个维度 ID 固定，不得改名、不得增删。每条轴是一条双极线，判断必须说明方向。

来源：`server/core/contract.ts:26-78`（定义与证据信号）、`src/data/taxonomy.ts:14-87`（界面文案）。

| ID | 名称 | 低端（low） | 高端（high） |
|---|---|---|---|
| `narrative` | 叙事偏好 | 慢热、内向、由氛围与留白推进 | 强情节、推进感强、由事件与因果驱动 |
| `emotion` | 情绪表达 | 克制、含蓄、不外露 | 浓烈、宣泄、直接击中 |
| `thematic` | 主题偏好 | 向内：记忆、哀悼、自我、家庭 | 向外：自由、正义、野心、世界 |
| `visual` | 视觉风格 | 自然、触感、纪录式的影像 | 风格化、构图明确、形式感强 |
| `character` | 人物塑造 | 人物驱动、强调个人转变与动机 | 群像、处境式、关系网络 |
| `ending` | 结局偏好 | 苦涩、未解、拒绝闭合 | 闭合、和解、留有希望 |

### 2.1 计算语义（原文照录，不得改写）

- **narrative**：用户如何被一个故事带进去：他更享受缓慢进入、允许停顿和省略的结构，还是更享受目标明确、节奏推进、事件密集的结构。
  证据信号：对节奏、剪辑、时间线、结构、冗长/紧凑的具体评价；被哪一场戏留下。
- **emotion**：用户偏好哪种情绪被呈现和传递的方式：收着的、需要自己靠近的情绪，还是外放的、允许哭出来的情绪。
  证据信号：“哭/没有哭”“克制/用力”“被按住/被击中”等对情绪强度的具体反应。
- **thematic**：用户反复被哪些主题吸引。注意：电影的主题本身不等于用户的偏好，只有用户明确回应过的主题才算证据。
  证据信号：用户主动谈论、反复引用、与自己生活建立联系的主题。
- **visual**：用户对画面、摄影、色彩、镜头语言和声音设计的敏感度与偏好方向。
  证据信号：主动提到镜头、光线、颜色、构图、配乐、声音；或明确表示不在意形式。
- **character**：用户更被单个复杂人物的内在转变吸引，还是更被一群人之间的关系与处境吸引。
  证据信号：谈论角色动机、表演、人物成长，或谈论群像、关系、社会处境。
- **ending**：用户希望电影结束时被留下什么：一个不急着被解决的伤口，还是一个可以带走的答案。
  证据信号：对结尾、最后一场戏、字幕升起时感受的具体描述。

### 2.2 一条硬规则

**电影的主题 ≠ 用户的偏好。** 用户看了一部关于悲伤的电影，不构成“偏爱悲伤”的证据；只有他明确回应了悲伤的**表达方式**，才算证据。

---

## 3. Theme 与 Mood

### 3.1 Theme（18 个，ID 与中文名固定）

来源：`server/core/contract.ts:80-99`、`src/data/taxonomy.ts:95-119`。

| ID | 中文 | 说明 |
|---|---|---|
| `memory` | 记忆 | 我们留下、删改和失去的东西。 |
| `loss` | 失去 | 缺席之后留下的形状。 |
| `grief` | 哀悼 | 不会按时刻表结束的悲伤。 |
| `identity` | 身份 | 没有人替你书写时，你是谁。 |
| `love` | 爱 | 依恋、时机，以及它的代价。 |
| `ambition` | 野心 | 极度渴望一件事所要付出的价格。 |
| `freedom` | 自由 | 离开那个被安排好的世界。 |
| `family` | 家庭 | 我们无法选择的第一个故事。 |
| `hope` | 希望 | 不是乐观，而是日复一日的维护。 |
| `loneliness` | 孤独 | 被人群包围，却仍然没有被听见。 |
| `art` | 艺术 | 创造比创作者活得更久的东西。 |
| `time` | 时间 | 唯一无法剪掉的那一维。 |
| `reality` | 真实 | 别人替我们写好的故事。 |
| `friendship` | 友谊 | 在黑暗里主动选择的同伴。 |
| `coming-of-age` | 成长 | 童年忽然不再合身的那一刻。 |
| `forgiveness` | 宽恕 | 慢慢放下的一段功课。 |
| `sacrifice` | 牺牲 | 为了留下什么，交出了什么。 |
| `justice` | 正义 | 法律与正确之间的距离。 |

### 3.2 Mood（12 个，ID 与中文名固定）

来源：`server/core/contract.ts:103-116`、`src/data/taxonomy.ts:121-134`。

| ID | 中文 | | ID | 中文 |
|---|---|---|---|---|
| `melancholy` | 忧郁 | | `warmth` | 暖意 |
| `tender` | 温柔 | | `longing` | 眷恋 |
| `wistful` | 怅惘 | | `playful` | 轻盈 |
| `hopeful` | 希望 | | `quiet` | 静默 |
| `restrained` | 克制 | | `uneasy` | 不安 |
| `cathartic` | 宣泄 | | `awe` | 敬畏 |

### 3.3 边界

- `theme` 描述**电影涉及什么**且**用户回应过**；`mood` 描述**用户被留在什么情绪里**。
- 二者都只能取自上述词表，不接受近义词、同义词、自造词。
- 同一段笔记可以同时命中 theme 与 mood，但必须给出各自独立的证据说明。

---

## 4. Direction（四值枚举）

### 4.1 取值与语义

| 值 | 定义 | 判断条件 |
|---|---|---|
| `high` | 有明确的正向偏好证据，指向该轴高端 | 笔记里有具体表述表明用户偏好高端体验（例：喜欢快节奏、被强烈情绪击中、要一个闭合结局） |
| `low` | 有明确的低偏好证据，指向该轴低端 | 笔记里有具体表述表明用户偏好低端体验（例：嫌太满、喜欢留白、接受未解的结尾） |
| `neutral` | **明确观察到没有倾向** | 笔记里有具体表述表明该轴对用户此次不构成取舍（例：“形式怎样都行”“不在意结局怎么收”） |
| `ambivalent` | 存在真实的双向或矛盾证据 | 同一轴同时出现两种相反表述，且都能成立（例：既被克制打动，又嫌它不够痛快） |

### 4.2 五条不可违反的边界

1. **没有相关表述 → 不输出该轴。** 省略 ≠ `neutral`。整条 `preference_evidence` 不出现，才是正确的“无证据”。
2. **`neutral` 必须有原文支撑。** 它不是“懒得判断”的默认值，而是一次被记录下来的观察。没有 quote 的 `neutral` 是伪造。
3. **`neutral` 不得与 `ambivalent` 合并。** 前者是“两边都不拉”，后者是“两边都在拉”。二者方向权重都为 0，但语义相反，必须在画像里分别计数。
4. **`ambivalent` 需要两个方向的证据。** 只有一句含糊的话不足以判 `ambivalent`；它本质上是两条证据合并在一条上，`interpretation` 必须写明冲突在哪里。
5. **`neutral` 不等于分数 50 的“平庸”。** 分数只在维度 `observed` 时存在；`neutral` 产生 50 分是因为“净拉力为零”，不是因为它“中等偏好”。

### 4.3 与网站端提示词的差异（已知，待适配）

网站 `server/core/prompt.ts:37` 当前写的是“读不到就省略，不要用 neutral 凑数”，输出 schema 又只列了 `low | high | neutral`，缺 `ambivalent`。这与本规范**语义一致但枚举不全**：

- “读不到就省略”与本规范 §4.2 第 1 条完全一致，保留。
- `neutral` 需要补上“必须有明确无倾向表述”的限定，否则会被误读为可以凑数。
- `ambivalent` 需要补进枚举与提示词。

这是网站端**待适配项**，本轮未改代码，记录在 `AI_ADAPTERS.md` 的差异表中。

---

## 5. Evidence Standard

### 5.1 统一证据对象

```json
{
  "quote": "用户笔记原文",
  "interpretation": "基于原文形成的解释",
  "source_film_id": "film-id",
  "source_note_id": "note-id"
}
```

| 字段 | 必填 | 约束 |
|---|---|---|
| `quote` | 是 | 必须逐字出现在用户笔记中；不得改标点、不得拼接、不得翻译 |
| `interpretation` | 是 | 说明“这段原文为什么支持当前判断”；允许是 AI 的推断，但必须能被 quote 支撑 |
| `source_film_id` | 是 | 来源电影 ID，必须真实存在，不得伪造 |
| `source_note_id` | 是 | 来源笔记 ID，必须真实存在，不得伪造 |

### 5.2 五条硬规则

1. **原文可追溯**：`quote` 必须能在原始笔记里被字符串检索到。
2. **逐字引用**：比较时仅忽略空白与引号差异，不允许同义改写。
3. **解释独立**：`interpretation` 是模型的话，不是用户的话。禁止把推断写进 `quote`，也禁止在展示层把二者混排成一段“用户说”。
4. **来源明确**：每条证据都必须指向具体的电影与笔记。跨笔记合并的证据，必须拆成多条，各自带来源。
5. **不得编造**：找不到原文就不输出该条；找不到 ID 就标记缺失，不许生成一个看起来合理的 ID。

### 5.3 兼容状态

旧记录可能缺少 `source_film_id` / `source_note_id`（网站端历史上只有 `evidence` 与可选 `quote`）。此时：

- **不得伪造 ID。**
- 必须标记 `source_status: "unknown_compat"`，并在聚合时排除或降权，取决于用途。
- 展示层必须显示“来源不完整”，不能显示成完整证据。

网站字段映射（`evidence` → `interpretation` 等）见 `AI_ADAPTERS.md`。

---

## 6. User Taste Profile

### 6.1 统一画像结构

```json
{
  "schema_version": 2,
  "core_spec_version": "1.0.0",
  "method": "weighted-evidence-shrinkage-v2",
  "algorithm_version": "weighted-evidence-shrinkage-v2",
  "evidence_count": 4,
  "independent_note_count": 1,
  "sufficient": false,
  "provisional": true,
  "overall_confidence": 0.15,
  "dimensions": {
    "emotion": {
      "status": "observed",
      "score": 50,
      "lean": "balanced",
      "confidence": 0.15,
      "evidence_count": 1,
      "note_count": 1,
      "sufficient": false,
      "neutral_default": false,
      "neutral_evidence_count": 1,
      "ambivalent_evidence_count": 0
    }
  }
}
```

字段语义：

- `status`：`observed`（有证据）｜`unobserved`（无证据）。
- `lean`：`high`｜`low`｜`balanced`｜`unknown`。`balanced` 只可能来自 `observed`，`unknown` 只可能来自 `unobserved`。
- `neutral_default`：**恒为 `false`**。这是一个防退化字段，用来证明“没数据”不会被悄悄填成“中性”。
- `sufficient`：独立笔记数达到阈值（维度级 2 条、整体 3 条）。
- `provisional`：`sufficient === false` 时必须为 `true`。

### 6.2 每个维度的四种认知状态

| 状态 | 含义 | 数据表现 |
|---|---|---|
| **用户明确表达的偏好** | 用户直接说了喜欢/不喜欢 | `observed`，有 `quote`，`confidence` 较高 |
| **AI 推断的倾向** | 从多条证据归纳出来，用户没直接说 | `observed`，`note_count ≥ 2`，`confidence` 随条数增长但封顶 0.9 |
| **未知** | 没有任何相关证据 | `unobserved`，`score: null`，`lean: "unknown"`，`neutral_default: false` |
| **存在矛盾** | 两个方向都有证据且都成立 | `observed`，`ambivalent_evidence_count > 0`，净拉力接近 0 |

### 6.3 两条禁令

1. **不得把未知当作 neutral。** 没有数据就是 `unobserved`，不是“中间”。
2. **不得把证据不足当作没有偏好。** `provisional: true` 的含义是“还不能下结论”，不是“这个人没有偏好”。

---

## 7. Profile Evolution

### 7.1 更新原则

1. **历史证据保留。** 新笔记进来只做增量，不覆盖旧证据；`corrections_applied` 与 `excluded` 记录必须留存。
2. **允许用户纠正。** 用户说“这条不对”，该条 `accepted: false`，进入 `corrections_applied`，且不得在后续聚合中复活。
3. **区分短期情绪与长期倾向。** 单次情绪强度（`strength`）不等于稳定偏好（`lean`）；前者是输入，后者是多条笔记收敛后的结果。
4. **单部电影不得决定长期画像。** 聚合以“笔记”为单位而非“证据条数”，同一部片的多条证据先在同一笔记内合并，再跨笔记平均。
5. **样本不足必须标注。** 独立笔记少于 3 条、或观测维度少于 3 个、或达标维度少于 2 个时，画像整体标 `provisional`。

### 7.2 收缩规则

- 维度置信度：`min(0.9, 0.15 × 独立笔记数)`。
- 整体置信度：观测维度平均置信度 × `min(1, 独立笔记数 / 3)`。
- 阈值集中在一处：`.opencode/skills/cinema-taste-profiling/scripts/profile-thresholds.mjs`（`overallMinNotes: 3`、`overallMinDimensions: 3`、`overallMinSufficientDimensions: 2`、`dimensionMinNotes: 2`）。任何实现不得私自复制这些数字。

---

## 8. 一致性层级与不变量

### 8.1 四个层级（不得混为一谈）

| 层级 | 定义 | 本轮状态 |
|---|---|---|
| **语义一致性** | 两端对六个维度、四个 direction、证据规则的理解相同 | ✅ 已达成本规范 |
| **数据结构一致性** | 两端字段名、枚举、必填项可无损互转 | ✅ 规范已定义，Adapter 已设计；运行时映射未执行 |
| **计算算法一致性** | 两端用同一公式从证据算出画像 | ❌ 明确暂不追求（产品决策三） |
| **最终结果一致性** | 同一批笔记在两端得出相同分数 | ❌ 未测试、不宣称 |

### 8.2 换模型不应改变的七条

1. 六个维度及其定义。
2. 18 个 theme、12 个 mood 词表。
3. `direction` 四值与 `neutral ≠ ambivalent`。
4. `quote` 必须逐字、`interpretation` 必须独立。
5. 单部电影不得断言稳定偏好。
6. 未知不得写成 neutral。
7. 样本不足必须显式标注。

这七条是本规范的全部价值所在：它们与 DeepSeek、DeepWorks、任何具体代码无关。
