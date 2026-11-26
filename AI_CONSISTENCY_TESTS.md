# AI_CONSISTENCY_TESTS.md

**Frame by Frame AI Core 一致性测试设计**
配套规范：`AI_CORE_SPEC.md` v1.0.0 ｜ 日期：2026-11-16

> **状态声明：本轮只建立测试设计，没有执行任何双端一致性测试。**
> 下表中标注 `partial` 的用例，只完成了单端（DeepWorks）的机制验证；标注 `designed` 的用例尚未运行。没有任何一条可以写成“已通过”。

---

## 1. 分层与状态

| 层 | 关注点 | 不关注 |
|---|---|---|
| Schema | 字段名、类型、必填、枚举 | 判断是否正确 |
| Semantic | 方向判断、neutral/ambivalent 区分、未知处理 | 字段拼写 |
| Evidence | 引文逐字、解释独立、来源真实 | 结论好坏 |
| Profile Evolution | 历史保留、纠正生效、单部片影响上限 | 分数是否好看 |
| Cross-platform | 同一输入在两端的行为差异 | 内部实现细节 |

状态取值：

- `designed`：用例已定义，未执行。
- `partial`：单端机制已验证，双端未比。
- `passed-local`：单端用例已实际跑通（仅 DeepWorks）。
- `blocked`：依赖尚未具备的能力（如网站端未改造）。

---

## 2. 用例

### T1 · 相同用户原文能否提取相同的审美信号

- **层**：Semantic / Cross-platform
- **目标**：同一段笔记在两端是否指向同一批维度与同一方向。
- **输入**：一段 80–150 字、覆盖 3 个以上维度的真实笔记（可用 P2-4 A 组输入）。
- **步骤**：① 网站端调用一次分析；② DeepWorks 端运行一次七步流程；③ 对齐 `dimension_id` 与 `direction`。
- **判据**：维度集合交集 ≥ 3；交集内方向一致率 ≥ 2/3；不一致项必须有可解释原因（如平台知识介入）。
- **失败信号**：同一句话在两端被判成相反方向，且无文本依据。
- **状态**：`blocked`（网站端调用未执行）

### T2 · 四值 Direction 是否得到一致解释

- **层**：Schema / Semantic
- **目标**：`low / high / neutral / ambivalent` 在两端含义相同。
- **输入**：四条构造笔记，分别只含一种方向信号（例：“我就想被狠狠击中” / “太满了，我想要留白” / “形式怎样都行” / “既被克制打动，又嫌它不够痛快”）。
- **步骤**：逐条运行，检查产出的 direction。
- **判据**：四条分别产出 `high / low / neutral / ambivalent`，且 `interpretation` 与语义定义吻合。
- **失败信号**：`neutral` 被用于“没看出来”；`ambivalent` 被降级为 `neutral`。
- **状态**：`partial` —— DeepWorks 已接受四值并正确区分 `neutral` 与 `unobserved`（smoke test）；`ambivalent` 未单独构造用例；网站端提示词尚无 `ambivalent`。

### T3 · quote 是否能够逐字追溯到用户原文

- **层**：Evidence
- **目标**：任何 `quote` 都能在输入笔记中被字符串命中。
- **输入**：任意历史运行记录。
- **判据**：`normalize(quote) ⊆ normalize(note)`，且 quote 非空、不重复。
- **失败信号**：同义改写、拼接两句、翻译后引用。
- **状态**：`passed-local` —— `validate-run.mjs` 已强制；A/B/C/D 四组全部通过；负向控制未专门构造“改写字”用例（建议补）。

### T4 · interpretation 是否与 quote 分离

- **层**：Evidence
- **目标**：模型解释不得冒充用户原话。
- **输入**：任意运行记录 + 展示层渲染结果。
- **判据**：`quote` 字段逐字命中；`interpretation` 字段不参与“用户说”的展示；两者在 UI 上视觉可分。
- **失败状态**：把 interpretation 拼进引号里展示。
- **状态**：`partial` —— 数据结构层已分离（DeepWorks）；展示层未审。

### T5 · 单部电影是否不会直接形成稳定长期偏好

- **层**：Semantic / Profile Evolution
- **目标**：一部电影的强证据不得让画像变 `sufficient`。
- **输入**：单条笔记 + 5 条高置信证据。
- **判据**：`independent_note_count = 1`；`sufficient = false`；`provisional = true`；`overall_confidence ≤ 0.3`。
- **失败信号**：单部片即输出“你的稳定偏好是……”。
- **状态**：`passed-local` —— `profile.mjs` 阈值与收缩机制已实现（`overallMinNotes: 3`）；历史运行均为 `provisional`。

### T6 · neutral 与 ambivalent 是否被正确区分

- **层**：Semantic
- **目标**：两者净拉力都为 0，但语义相反，必须可区分。
- **输入**：两份笔记，一份“我不在意形式”，一份“既爱它的克制又嫌它不够痛快”。
- **判据**：画像层 `neutral_evidence_count` 与 `ambivalent_evidence_count` 分别 > 0；`lean` 均为 `balanced`；报告文案能区分“无倾向”与“两难”。
- **失败信号**：两者都只显示“中性”，或合并计数。
- **状态**：`partial` —— `neutral` 计数已验证（smoke test 得 `neutral=1, amb=0`）；`ambivalent` 计数未实测。

### T7 · 未知维度是否不会被误判为 neutral

- **层**：Semantic
- **目标**：没有证据的维度必须是 `unobserved`。
- **输入**：只谈视觉、完全不涉及人物关系的笔记。
- **判据**：`character.status = unobserved`、`score = null`、`lean = "unknown"`、`neutral_default = false`；不得出现在 `observed` 列表中。
- **失败信号**：任何形式的“默认 50 分”。
- **状态**：`passed-local` —— smoke test 中 `character` 保持 `unobserved`；`validate-run.mjs` 强制 `neutral_default === false`。

### T8 · 多条矛盾证据是否得到合理处理

- **层**：Semantic / Profile Evolution
- **目标**：矛盾不应该被平均成“没意见”。
- **输入**：同一维度两条方向相反、强度均 ≥ 0.6 的证据。
- **判据**：该维度仍为 `observed`；`lean` 接近 `balanced`；`ambivalent_evidence_count ≥ 1`；不因矛盾而丢弃任何一条（除非重复）。
- **失败信号**：互相抵消后变成 `unobserved`，或只保留更强的一条。
- **状态**：`designed`

### T9 · 画像更新是否保留历史证据

- **层**：Profile Evolution
- **目标**：新笔记不得覆盖旧证据；用户纠正必须生效且不可复活。
- **输入**：笔记 1 → 生成画像 → 加入笔记 2 → 再生成；再将笔记 1 的某条证据标 `accepted: false` 重跑。
- **判据**：`notes_used` 累加；`corrections_applied` 含被排除项；`delta_vs_prior` 可算；被排除的证据不参与聚合。
- **失败信号**：重跑后只剩最新笔记；被拒绝的证据在下一轮复活。
- **状态**：`partial` —— 机制已在 `profile.mjs` 实现（`notes_used`、`corrections_applied`、`--prior`），未做连续三轮实测。

---

## 3. Cross-platform 专项

| ID | 目标 | 判据 | 状态 |
|---|---|---|---|
| X1 | 网站输出 → 核心结构无损转换 | 字段映射后信息不丢；缺失来源标 `unknown_compat` | `blocked` |
| X2 | DeepWorks 输出 → 网站渲染可读 | 六维、四值、证据可分；未知不显示为中性 | `blocked` |
| X3 | 同输入画像差异可解释 | 差异能用“算法不同”解释，且不是字段错位导致 | `blocked` |
| X4 | 换模型后七条不变量不变 | `AI_CORE_SPEC.md` §8.2 全部保持 | `designed` |

X1–X3 全部依赖网站端实际调用与改造，本轮明确不执行。**在 X1–X3 跑通之前，任何“两端一致”的表述都不成立。**

---

## 4. 状态矩阵

| 用例 | 层 | 状态 |
|---|---|---|
| T1 | Semantic / Cross | blocked |
| T2 | Schema / Semantic | partial |
| T3 | Evidence | passed-local |
| T4 | Evidence | partial |
| T5 | Profile Evolution | passed-local |
| T6 | Semantic | partial |
| T7 | Semantic | passed-local |
| T8 | Profile Evolution | designed |
| T9 | Profile Evolution | partial |
| X1 | Cross | blocked |
| X2 | Cross | blocked |
| X3 | Cross | blocked |
| X4 | Invariants | designed |

通过率不可计算——`passed-local` 不等于“通过”，只表示单端机制存在。

---

## 5. 执行方式（设计）

单端（DeepWorks）用例可复用现有脚本：

```powershell
node workflow/validate-run.mjs --run <run.json> --input <input.json>
node .opencode/skills/film-note-analysis/scripts/validate-evidence.mjs --input <input.json> --analysis <draft.json>
node .opencode/skills/cinema-taste-profiling/scripts/profile.mjs --evidence <draft.json> --out <profile.json>
node workflow/test-validate-run-negative.mjs
```

跨端用例需要：

1. 一个可重复的网站端调用入口（现有 DeepSeek API，**不得为了让测试通过而修改它**）。
2. 一份固定的输入集（建议直接复用 `outputs/p2/agent-integration/inputs/`）。
3. 一个字段对齐脚本（尚未编写）。

---

## 6. 红线

1. 不得为了“两端一致”而修改任一端输出或测试结果。
2. 不得把 `passed-local` 写进对外材料当成“一致性通过”。
3. 不得在网站端未改造的情况下宣称 `ambivalent` 链路已通。
4. 测试记录必须包含：命令、输入哈希、原始输出路径。
