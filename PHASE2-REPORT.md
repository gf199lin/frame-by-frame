# Phase 2 报告：DeepWorks 跨记录接入

日期：2026-11-17
模型：`dth/DeepSeek-V4.1-Flash`
运行身份：DeepWorks 会话 `ses_e18029183ffeXI016lllwer0JD` 内的 `film-curator`
分支：`p1.1-profile-v2`（未提交，工作区原有改动保留）

---

## 结论摘要

| 项目 | 状态 |
|---|---|
| 跨记录分析（DeepWorks 会话内，3 次） | **PASS** |
| 平台 UI 发起的独立 Agent Run / 平台签发 run_id | **NOT RUN** |
| 平台知识库 `sass_search` | **NOT RUN** |
| 三份 evolution JSON 契约校验 | **PASS 3/3** |
| 网站真实导入 | **PASS** |
| 用户反馈进入下一次输入 | **PASS（机制）** / **NOT RUN（真实反馈数据）** |
| 真实用户笔记与已持久化反馈 | **NOT AVAILABLE** |

一句话：**分析和导入链路已经在 DeepWorks 会话内真实跑通，但没有平台侧独立 Run 记录、没有平台知识库检索、也没有真实用户数据，因此不能宣称“平台验收全部完成”。**

---

## 1. 是否真实完成 DeepWorks 跨记录 Agent 运行？

**部分是，不能算完整的平台验收通过。**

- 是：三次分析由本会话的 `film-curator` Agent、模型 `dth/DeepSeek-V4.1-Flash` 产生；读取了三个 Skill；输入来自仓库内的真实笔记原文；输出是新写的 JSON，不是 seed 或 legacy-deepseek 结果。
- 否：没有通过 DeepWorks 界面或平台 Run API 发起独立运行，没有平台签发的 Run ID，没有平台运行截图，也没有 Skill 调用遥测。

因此：**会话内运行 = PASS，平台独立 Run = NOT RUN。**

## 2. 本次真实 run_id 是什么？

本会话没有平台 Run ID 接口，以下 ID 由**真实会话 ID 与消息 ID 派生**，不是伪造的随机串，也不是平台签发：

- 会话：`ses_e18029183ffeXI016lllwer0JD`
- 消息：`msg_1e84428bb0014KS69NzBiqPvEv`
- 案例 A：`dw-ses_e18029183ffeXI016lllwer0JD-msg_1e84428bb0014KS69NzBiqPvEv-a`
- 案例 B：`dw-ses_e18029183ffeXI016lllwer0JD-msg_1e84428bb0014KS69NzBiqPvEv-b`
- 案例 C：`dw-ses_e18029183ffeXI016lllwer0JD-msg_1e84428bb0014KS69NzBiqPvEv-c`

每份 JSON 的 `provenance.run_id_kind` 都写明 `derived-from-session-and-message-id`，避免被读成平台签发的 ID。

## 3. 实际调用了哪些 Skills？

| Skill | 方式 | 实际用途 |
|---|---|---|
| `film-note-analysis` | 读取 `SKILL.md`（本会话无 `skill` 工具） | 判断原句是否可作证据、区分用户原话与推断 |
| `cinema-taste-profiling` | 读取 `SKILL.md` | 四阶段判定、支持/反向、快照只追加 |
| `cinema-knowledge-retrieval` | 读取 `SKILL.md` | 只在证据需要解释时检索，最多 1 条引用 |

`schema` 中记为 `skills_via: "read"`，没有伪称通过 `skill` 工具调用。

## 4. 是否成功检索平台知识库？

**NOT RUN。**

本会话没有暴露 `sass_search` 或任何平台知识库工具，因此：

- `kb_provider` 只能是 `file`。
- 使用项目本地库检索到 `KB-003`《情绪：克制、间离与延迟反应》，分数 17，引文逐字校验通过。
- 检索记录的 `fallback_used: true`、`fallback_reason` 写明平台检索不可用。
- 结果：`outputs/taste-evolution/phase2/case-b/kb-citations.json`，`validate-citations.mjs` 返回 `ok: true`。

**不能把这次本地引用写成“平台知识库已检索”。**

## 5. 三种案例分别是否通过？

输入来源：`src/data/seed.ts` 的 10 条原型笔记。该文件自述“笔记为原型撰写，并非真实观众调查数据”；本次**没有新增或改写任何用户笔记**，只使用已有原文。

| 案例 | 新记录 | 历史 | 结果 | 阶段 | 状态 |
|---|---|---|---|---|---|
| A 新倾向出现 | 《爱乐之城》 | 5 部历史记录，无既有观察 | 形成 `obs_ending`「未被结清的结局」，1 部电影 / 1 条证据 | emerging，34% | **PASS** |
| B 已有倾向得到验证 | 《海边的曼彻斯特》 | 含 A 的观察与快照 | 同一 `observation_id` 更新，2 部电影 / 2 条证据，未重复创建 | emerging，46% | **PASS** |
| C 出现反向证据 | 《肖申克的救赎》 | 含 B 的观察与快照 | 新增 2 条 `contradicting` 证据，方向冲突，进入 evolving，原结论未被强行维持 | evolving，41% | **PASS** |

要点：

- B 没有升级到 developing，因为独立电影只有 2 部，未达到 3 部门槛——这是按 Skill 规则刻意保留的限制。
- C 明确写入“你同样会被被兑现的结清打动”，反向证据保留在 `contradicting_evidence_ids`，没有归入支持证据。
- 三个阶段变化都写入 `history` 与 `snapshot.changes`。

## 6. JSON 是否通过校验？

**PASS 3/3。**

```text
node workflow/validate-taste-evolution.mjs --input .../case-a/evolution.json --records-file .../records.json
→ ok: true (1 observation, 1 evidence, 1 change, 3 records checked)

case-b → ok: true (1 observation, 2 evidence, 1 change)
case-c → ok: true (1 observation, 4 evidence, 1 change)
```

为此给校验器增加了 `--records-file`：跨记录文档的证据可以引用多部电影，每条按自己的 `record_id` 取原文校验；原来的 `--note-file` 单条模式保持不变。

结果文件：`case-a/validation.json`、`case-b/validation.json`、`case-c/validation.json`。

## 7. 是否成功导入网站？

**PASS（真实浏览器，非单元测试）。**

脚本：`_work/import-smoke.mjs`（Chrome Headless + CDP，1440×1100）
报告：`outputs/taste-evolution/phase2/import-report.json`
截图：`outputs/taste-evolution/phase2/imported-taste.png`

实测：

- 三次点击“校验并导入”，三次都出现 `已导入 run ...`。
- localStorage 中 `agentObservations` 为 1 条 `obs_ending`，`run_id` 是案例 C。
- `tasteSnapshots` 共 4 个：1 个基线 + A/B/C 三个 Agent 快照。
- 页面出现「未被结清的结局」「持续变化」与案例 C 的 run_id。
- 证据 4 条，其中 `contradicting` 2 条。

导入按钮在 My Taste 的「Agent 跨记录交接」区域：可导出当前输入、选择 JSON、校验并导入；失败时只显示错误，不写 state。

## 8. 网站展示的数据是否确实来自本次运行？

**目标观察是。其余观察不是。**

- `obs_ending` 的标题、描述、置信度、阶段、4 条证据与 3 个快照，全部来自本次三份 JSON；`run_id` 与 `source: deepworks` 在 UI 中可见。
- 其它维度的观察仍由已确认分析本地派生，来源标注为 `seed` / `legacy-deepseek`，没有冒充 DeepWorks。
- 时间线同时保留基线快照与 Agent 快照，旧快照未被覆盖。

## 9. 用户反馈是否能进入下一次 Agent 分析？

**机制 PASS；真实数据 NOT RUN。**

- `buildAgentInput()` 会把 `state.observationFeedback` 全量写入 `history.feedback`，包括 `decision: rejected` 与 `user_comment`。
- 单元测试 `evolutionInput.test.ts` 验证：拒绝反馈及其原话确实出现在下一次输入中。
- 但仓库与本次运行环境中没有已持久化的用户反馈（三份输入的 `feedback` 均为空），因此**没有用真实反馈跑过一次 Agent**。不能标 PASS。

## 10. 剩余问题逐项状态

| 要求 | 状态 | 说明 |
|---|---|---|
| Agent 失败时前端明确错误状态 | **PASS（代码路径）** | `FilmAnalysisPanel` 在 `status === 'failed'` 时显示错误并保留旧分析；本次未新增 UI 测试 |
| 区分 DeepWorks / seed / legacy-deepseek | **PASS** | 观察证据显示来源；分析面板保留原有来源标识 |
| 防止旧分析冒充最新 Agent 结果 | **PASS** | 导入器拒绝早于最新已导入运行的文档；UI 显示 `run_id` 与 `analyzed_at` |
| 真实输出更新已有 Taste Evolution 数据 | **PASS** | 同一 `observation_id` 覆盖为 Agent 版本，证据累积 |
| 用户反馈进入下一次运行 | **PASS（机制）/ NOT RUN（真实数据）** | 见第 9 节 |

## 11. 测试与回归

- `vitest run`：**11 个文件 / 94 条通过**（新增 7 条导入测试 + 2 条输入构造测试）。
- `tsc -p tsconfig.json --noEmit`：通过。
- `tsc -p tsconfig.server.json --noEmit`：通过（本次未改 server）。
- `vite build`：成功。
- 服务端 `node --test server`：本次未重跑；改动不涉及 `server/`。

## 12. 本次改动文件

新增：

- `src/lib/taste/evolutionImport.ts` — 校验 note_sha256 / 逐字引文 / 记录归属，生成导入包，拒绝旧运行。
- `src/lib/taste/evolutionInput.ts` — 构造含历史记录、观察、反馈、快照的 Agent 输入。
- `src/components/taste/EvolutionTransfer.tsx` — 导出输入、选择/粘贴 JSON、校验并导入。
- `src/lib/taste/evolutionImport.test.ts` — 7 条。
- `src/lib/taste/evolutionInput.test.ts` — 2 条。
- `_work/phase2-build.mjs`、`_work/import-smoke.mjs`（过程文件）。
- `outputs/taste-evolution/phase2/**`（三案例、校验、导入报告、截图）。

修改：

- `src/types.ts` — `AgentObservationBundle`、`AppState.agentObservations`。
- `src/lib/storage.ts` — 读取时规范化导入观察。
- `src/data/seed.ts` — 初始空数组。
- `src/lib/taste/evolution.ts` — 合并导入观察、签名纳入 run_id、`latestRunId`。
- `src/store/AppStore.tsx` — `import-evolution` action 与异步导入方法。
- `src/pages/Taste.tsx` — 接入交接区。
- `workflow/validate-taste-evolution.mjs` — `--records-file`。
- `docs/taste-evolution-agent-contract.md` — 跨记录校验与真实验证状态。

## 13. 仍不能声称的部分

1. 平台独立 Run、平台签发的 run_id、平台截图。
2. 平台知识库检索（`sass_search`）。
3. 真实用户笔记与已持久化反馈驱动的运行。
4. 平台侧 Skill 调用遥测。
5. 移动端视觉复核。

下一步只有在 DeepWorks 界面中实际发起一次带 `history` 的 Film Curator 运行，并把平台 Run 记录、截图、`sass_search` 结果与本报告的证据合并，才能把 Phase 2 标为完整通过。
