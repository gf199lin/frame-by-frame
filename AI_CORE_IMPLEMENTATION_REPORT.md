# AI_CORE_IMPLEMENTATION_REPORT.md

**Frame by Frame P2-6 实施报告**
日期：2026-11-16 ｜ 核心规范版本：v1.0.0
性质：**规范建立 + DeepWorks 侧最小适配**。网站端只做只读审计，未改一行。

---

## 1. 交付清单

### 1.1 规范文件（5 份，均在仓库根目录）

| 文件 | 内容 | 状态 |
|---|---|---|
| `AI_CORE_SPEC.md` | 产品身份、六维、词表、四值 direction、证据标准、画像结构与演化、四层一致性、七条不变量 | ✅ |
| `AI_ADAPTERS.md` | 两端字段对照、网站映射方案、DeepWorks 适配实现、画像结构差异 | ✅ |
| `AI_CHANGELOG.md` | v1.0.0 记录、版本规则、算法版本登记、待登记项 | ✅ |
| `AI_CONSISTENCY_TESTS.md` | T1–T9 + X1–X4，分层与状态矩阵 | ✅ |
| `AI_CORE_IMPLEMENTATION_REPORT.md` | 本文件 | ✅ |

### 1.2 代码改动（仅 DeepWorks 侧，3 个文件）

| 文件 | 改动 | 行数 |
|---|---|---|
| `workflow/validate-run.mjs` | `DIRECTIONS` 增加 `neutral`；版本字段非空校验；`source_*` 字段非空校验（仅当存在） | 约 +14 行 |
| `.opencode/skills/cinema-taste-profiling/scripts/profile.mjs` | `DIR` 增加 `neutral: 0`；维度输出增加 `neutral_evidence_count` / `ambivalent_evidence_count` | 约 +18 行 |
| `workflow/core-version.mjs` | 新增版本常量（新建文件） | 24 行 |

**未改**：网站全部代码、Agent 正文、三个 `SKILL.md`、知识库正文、七步顺序、历史证据文件。

### 1.3 验证产物

| 产物 | 路径 | 说明 |
|---|---|---|
| neutral smoke 记录 | `outputs/p2/_work/ai-core-smoke/A-neutral.json` | A 组副本，首条证据改 `neutral` |
| neutral 画像 | `outputs/p2/_work/ai-core-smoke/A-neutral.profile.json` | 验证 `observed / 50 / balanced` |
| 负向控制 | `outputs/p2/p2-5/runs/negative-controls.json` | 6/6（重跑） |

---

## 2. 已解决的差异

| 差异 | 处理 | 是否已验证 |
|---|---|---|
| DeepWorks 不认 `neutral` | `DIRECTIONS` 补四值 | ✅ 含 `neutral` 的运行 `ok: true` |
| `neutral` 证据被画像静默丢弃 | `DIR.neutral = 0` | ✅ 维度变 `observed`、分数 50、`lean: balanced` |
| `neutral` 与 `ambivalent` 无法区分 | 新增两个计数字段 | ⚠️ `neutral` 已验证；`ambivalent` 仅代码实现，未实测 |
| 运行记录无版本标识 | 新增 `core-version.mjs` + 可选字段校验 | ✅ 非破坏性（只查非空，不参与判定） |
| 证据缺少来源字段 | 新增 `source_film_id` / `source_note_id` 可选校验 | ⚠️ 仅结构校验，Agent 尚未产出这两个字段 |

---

## 3. 未解决的差异

| 差异 | 原因 | 影响 | 后续动作 |
|---|---|---|---|
| 网站提示词缺 `ambivalent` | 需改 `server/core/prompt.ts`，本轮禁止改网站 | 网站端永远产不出第四值 | 列入 §5 第 1 项 |
| 网站提示词对 `neutral` 无成立条件 | 只写“不要凑数”，未写“何时可用” | 可能被误用 | 同上 |
| 网站证据字段是 `evidence` | 旧契约 | 需 Adapter 改名 | 已设计，未编码 |
| 网站无独立 note id | 只有 `recordId` | `source_note_id` 只能代位 | 标注 `unknown_compat` |
| 两端画像算法不同 | 产品决策三：暂不统一 | 分数不可直接比较 | 靠 X3 测试决定是否收敛 |
| 网站 `direction` 契约四值但提示词三值 | 内部不同步 | 模型与校验器可能不一致 | 与第 1 项一并修 |

---

## 4. 两端适配方案（摘要）

**Website**：提示词补 `ambivalent` 与 `neutral` 限定 → 输出经 `toCoreEvidence` 改名（`evidence` → `interpretation`）并注入 `ctx.filmId` / `ctx.recordId` → 缺失来源标 `unknown_compat`。画像保持 `computeTasteProfile` 不动，版本记 `website-state-aggregate-v1`。

**DeepWorks**：`validate-run.mjs` 接受四值并强制 `quote` 逐字、`interpretation` 独立；`profile.mjs` 把 `neutral` 记为净零拉力并单独计数；运行记录建议写 `core_spec_version / agent_version / workflow_version / profile_algorithm_version`。Agent 与 Skill 一字未改。

字段级对照见 `AI_ADAPTERS.md` §1、§4。

---

## 5. 后续真正需要修改代码的事项

按优先级：

1. **网站提示词同步四值**（`server/core/prompt.ts:37,61`）：补 `ambivalent`，补 `neutral` 成立条件。低风险、纯文本。
2. **网站证据映射函数**（新增，位置待定，建议 `src/lib/ai/coreEvidence.ts`）：`evidence → interpretation`，注入来源 ID，缺则 `unknown_compat`。
3. **DeepWorks 运行写入版本字段**：在各运行产物生成处注入 `core-version.mjs` 常量；校验已支持，无需再改校验器。
4. **DeepWorks Agent 产出 `source_*`**：需改 `film-curator.md` 第 6 步的输出模板。**本轮禁止改 Agent**，故列为待批准项。
5. **跨端对比脚本**：读取两端输出，按 `dimension_id + direction` 对齐，输出差异表。属测试基建。
6. **`ambivalent` 实测用例**：构造一条真实双向笔记，跑通 T8。

以上 1–3 不改变任何既有语义；4 需要明确授权；5–6 属测试层。

---

## 6. 当前无法验证的内容

| 项 | 原因 | 标记 |
|---|---|---|
| 网站端实际输出是否符合四值 | 未调用 DeepSeek API | `pending` |
| 跨端维度/方向一致性（T1、X1–X3） | 同上 | `blocked` |
| `ambivalent` 在画像中的实际表现 | 无实测样本 | `pending` |
| 平台知识库文档级 `knowledge_id` | 历史转录未保留该字段 | `unknown` |
| 换模型后七条不变量是否保持（X4） | 未做多模型对照 | `designed` |

---

## 7. 验收问题回答

**1. 六维审美画像究竟如何定义？**
六条双极轴：`narrative`（叙事节奏与结构）、`emotion`（情绪表达强度）、`thematic`（主题向内/向外）、`visual`（影像自然/风格化）、`character`（个人转变/群像处境）、`ending`（未解/闭合）。定义原文见 `AI_CORE_SPEC.md` §2.1，唯一代码来源是 `server/core/contract.ts:26-78`。

**2. `neutral` 与 `ambivalent` 有什么区别？**
`neutral` = 明确观察到该轴对用户不构成取舍（“形式怎样都行”），是**一次无倾向的观察**。`ambivalent` = 同一轴上两个方向都有真实证据（“既被克制打动，又嫌不够痛快”），是**一次矛盾的观察**。两者净拉力都是 0，但语义相反，分别计数，不得合并。没有相关表述时两者都不该出现——那时是 `unobserved`。

**3. 如何确保每项画像判断都有真实证据？**
三道门：`quote` 必须逐字命中输入笔记（`validate-run.mjs` 强制）；`interpretation` 必须独立于引文；每条证据必须带 `source_film_id` / `source_note_id`（新标准）。找不到原文就不输出该条，找不到来源就标 `unknown_compat`，不生成占位 ID。

**4. 两端如何遵循同一套核心规范？**
通过语义层统一 + Adapter 映射。六维 ID、18 theme、12 mood、四值 direction、证据四字段在两端同名同义；字段名差异（`evidence` vs `interpretation`）由适配层改名解决，不改语义。规范是上位文件，两端实现是下位。

**5. 为什么允许两端使用不同画像算法？**
因为两端输入结构不同：网站以“已确认分析 + 评分确信度 + 用户反馈”聚合到电影级，DeepWorks 以“笔记级证据 + 跨笔记收缩”聚合。强行统一会牺牲各自已有的能力。产品决策三明确：先统一语义与结构，算法暂不统一，且任何一方不得替代另一方。

**6. 未来如何通过测试逐步实现算法一致？**
先跑 X1–X3（同输入、字段对齐、差异可解释），再判断差异是“算法选择”还是“实现错误”。只有当差异无法用设计解释时，才讨论收敛算法；收敛必须走 `AI_CHANGELOG.md` 的版本流程，且不得为了让数字接近而调参。

**7. 更换底层模型后，哪些规则不应变化？**
`AI_CORE_SPEC.md` §8.2 的七条：六维定义、18+12 词表、四值 direction 与 `neutral ≠ ambivalent`、逐字引文与独立解释、单部片不得断言稳定偏好、未知不得写成 neutral、样本不足必须标注。这七条与模型、平台、代码实现均无关。

---

## 8. 验证记录

| 命令 | 结果 |
|---|---|
| `node workflow/validate-run.mjs --run …fbf-p24-A… --input …run-p24-A.json` | `ok: true`、`schema_valid: true` |
| `node workflow/validate-run.mjs --run …fbf-p24-C… --input …run-p24-C.json` | `ok: true`、`analysis_completed_without_kb_support` |
| `node workflow/validate-run.mjs --run …A-neutral.json --input …run-p24-A.json` | `ok: true`（四值生效） |
| `node profile.mjs --evidence …A-neutral.json` | `emotion: observed 50 balanced neutral=1`；`character: unobserved` |
| `node workflow/test-validate-run-negative.mjs` | 6/6 |
| 历史 P0 三组 | 全绿（前一轮已验） |

未执行：任何网站端调用、任何跨端对比、任何多模型对照。

---

## 9. 一句话结论

规范已独立成形，DeepWorks 侧以最小改动对齐了四值枚举并保持了全部历史运行；网站端差异已被精确记录成待办，**没有被说成已完成**。
