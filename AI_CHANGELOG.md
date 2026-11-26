# AI_CHANGELOG.md

**Frame by Frame AI Core 版本记录**

记录粒度：核心规范、Agent、工作流、两端画像算法。
原则：**版本号描述规则，不描述实现细节。** 实现可以重写，规则变更必须留痕。

---

## 1. 版本表

| 组件 | 当前版本 | 维护位置 |
|---|---|---|
| AI Core Specification | **v1.0.0** | `AI_CORE_SPEC.md` |
| Website Prompt | `fbf-ai-1.0.0` | `server/core/contract.ts:7` |
| Website Schema | `1` | `server/core/contract.ts:8` |
| Website Agent Run Wire | `2` | `src/lib/ai/contractV2.ts:12` |
| Website Profile Algorithm | `website-state-aggregate-v1` | `workflow/core-version.mjs`（本规范首次赋值） |
| DeepWorks Agent | `film-curator/1.0.0` | `.opencode/agents/film-curator.md` |
| DeepWorks Workflow | `seven-step/1.0.0` | `workflow/` |
| DeepWorks Profile Algorithm | `weighted-evidence-shrinkage-v2` | `profile.mjs:196`（代码内自声明） |

说明：`website-state-aggregate-v1` 是**本规范新赋予的标识**，网站代码中原本不存在这个常量；它描述的是 `computeTasteProfile` 当前的实现形态，不代表代码已被修改。

---

## 2. v1.0.0 — 2026-11-16

### 2.1 创建原因

两端已各自运行一段时间，价值观一致但结构不一致：

- `direction` 枚举不同（网站四值、DeepWorks 三值）。
- 证据字段不同（`evidence` vs `quote + interpretation`）。
- 画像算法不同且从未被记录为“不同”。

在没有统一规范的情况下继续迭代，任何一次字段调整都可能被误读为“另一端坏了”。因此建立独立于模型与平台的产品级规范。

### 2.2 修改内容

**新增规范文件**

- `AI_CORE_SPEC.md`：产品身份、六维定义、18 theme / 12 mood、四值 direction、证据标准、画像结构、演化规则、四层一致性定义、七条不变量。
- `AI_ADAPTERS.md`：两端适配方案与字段对照。
- `AI_CHANGELOG.md`：本文件。
- `AI_CONSISTENCY_TESTS.md`：T1–T9 测试设计与状态。
- `AI_CORE_IMPLEMENTATION_REPORT.md`：实施报告与验收回答。

**产品决策固定**

1. `direction` 采用四值：`low / high / neutral / ambivalent`，`neutral` 不得删除、不得与 `ambivalent` 合并。
2. 证据对象统一为 `quote + interpretation + source_film_id + source_note_id`。
3. 画像语义统一、算法暂不统一：允许两端算法不同，但必须记录版本、不得互相替代。

**DeepWorks 侧最小适配（代码）**

| 文件 | 改动 | 影响 |
|---|---|---|
| `workflow/validate-run.mjs` | `DIRECTIONS` 增加 `neutral`；新增版本字段非空校验；新增 `source_*` 字段非空校验（存在时） | 旧运行不受影响，`neutral` 从“非法”变“合法” |
| `.opencode/skills/cinema-taste-profiling/scripts/profile.mjs` | `DIR` 增加 `neutral: 0`；输出新增 `neutral_evidence_count` / `ambivalent_evidence_count` | 画像结构扩展，阈值与聚合公式未变 |
| `workflow/core-version.mjs` | 新增版本常量 | 纯信息，不参与判定 |

**未改动**

- 网站全部代码（`server/**`、`src/**`）。
- Agent 正文、三个 `SKILL.md`、知识库 12 条正文。
- 七步工作流顺序、产物路径、P2-4/P2-5 证据文件。

### 2.3 影响范围

| 对象 | 影响 |
|---|---|
| 历史 P0 / P2-4 / P2-5 运行记录 | 无影响，全部仍通过校验 |
| 新产生的 DeepWorks 运行 | 可使用 `neutral`；建议写入版本字段 |
| 网站端 | 无代码影响；提示词与契约的枚举不一致仍存在，列为待办 |
| 画像对比 | 两端仍不可直接比较，`AI_ADAPTERS.md` §4 已声明 |

### 2.4 好友版本对照

| 端 | 适配版本 | 状态 |
|---|---|---|
| Website | `fbf-ai-1.0.0` / schema `1` / wire `2` | 契约已含四值；提示词未含 `ambivalent`（待改） |
| DeepWorks | `core 1.0.0` / `agent film-curator/1.0.0` / `workflow seven-step/1.0.0` | 已适配四值 |

---

## 3. 变更流程（自 v1.0.0 起生效）

1. **提出**：说明要改哪一层（规范 / 适配 / 算法）。
2. **判定影响层级**：语义 / 结构 / 算法 / 结果，四者不得混谈。
3. **写变更记录**：版本号、原因、内容、影响范围、两端适配版本。
4. **不破坏旧数据**：新增字段必须可选；删除字段必须走主版本号。
5. **测试先行**：语义或结构变更必须先在 `AI_CONSISTENCY_TESTS.md` 增加用例，再改实现。
6. **不伪造一致性**：任何“两端一致”的结论都必须附实际运行记录。

### 版本号规则

- **主版本（2.0.0）**：六维定义、direction 语义、证据必填项发生不兼容变更。
- **次版本（1.1.0）**：新增可选字段、新增测试用例、新增适配能力。
- **修订（1.0.1）**：措辞澄清、示例修正，不改变任何判定条件。

### 算法版本独立演进

画像算法有独立版本号，与规范版本解耦：

- 规范升级**不必**导致算法升级。
- 算法升级**必须**在本文登记，并说明是否影响历史画像可比性。
- 两端算法版本允许不同；**在 `AI_CONSISTENCY_TESTS.md` 的跨端用例通过之前，不得宣称算法一致。**

---

## 4. 待登记（未发生）

以下项目已识别但尚未实施，故不占用版本号：

| 项目 | 预期层级 | 状态 |
|---|---|---|
| 网站提示词补 `ambivalent` 与 `neutral` 限定 | 结构 | 待实施 |
| 网站输出映射到核心证据结构 | 结构 | 已设计，未编码 |
| DeepWorks 运行写入版本字段 | 结构 | 已设计，未强制 |
| 两端画像算法对比测试 | 算法 | 未执行 |
| 平台知识库文档级 `knowledge_id` 补齐 | 数据 | 阻塞于真实调用 |

上述任一项实施后，按 §3 流程登记，最小为 v1.1.0。
