# Taste Evolution 执行报告

**日期**：2026-11-17
**分支**：`p1.1-profile-v2`（工作区原本已有大量未提交改动；本次未提交，避免覆盖）
**模型**：`dth/DeepSeek-V4.1-Flash`
**结论一句话**：数据链路、反馈闭环、快照历史和前端展示已经真实跑通；**DeepWorks 跨记录 Agent 的端到端运行尚未执行**，因此不能宣称“Taste Evolution 全部完成”。

---

## 1. Phase 1：现状检查

检查到的事实：

- React + TypeScript + Vite，路由在 `src/App.tsx`；`/taste` 已有六维画像、待确认分析、主题、画像变化与本地片库时间线。
- `src/lib/ai/tasteProfile.ts` 已经从**用户确认过的分析证据**计算六维，不是随机数字或电影简介。
- `src/lib/ai/analysisService.ts` 与 `src/lib/ai/contractV2.ts` 区分 `legacy-deepseek`、`deepworks`、`local-engine`、`seed`；`DeepWorksAnalysisService` 在未配置时**显式失败**，不会伪造结果。
- localStorage 版本为 v2，已有 `analyses`、`profileHistory`、`corrections`；没有观察、观察反馈与演化快照。
- Memory Map 是 film / theme / mood 三层同心圆，`src/lib/graph.ts` 负责派生。
- 三个 Skill 与 Film Curator Agent 已存在，但只描述“单条笔记 + 六维画像”，没有跨记录观察契约。
- 未发现可用于“跨记录 history 输入”的已运行 DeepWorks 记录；`outputs/p0`、`outputs/demo-readiness` 是既有单条 P0 运行，不是本次 Taste Evolution 运行。

未改动：`.opencode/skills/**` 的既有校验脚本、`knowledge/**`、P0 运行记录。

---

## 2. 数据结构

新增在 `src/types.ts`：

- `TasteObservation`：`observation_id`、`dimension`、`title`、`description`、`current_stage`、`confidence`、`first_observed_at`、`last_updated_at`、支持/反向记录与证据 ID、四类反馈计数、`history`、`effective`、`unverified_evidence_count`。
- `TasteEvolutionEvidence`：`evidence_id`、`observation_id`、`record_id`、`film_id`、`original_quote`、`interpretation`、`polarity`、`strength`、`source`、`created_at`、`run_id`。
- `TasteObservationFeedback`：`feedback_id`、`observation_id`、`decision`、`user_comment`、`created_at`、`affected_snapshot_id`。
- `TasteEvolutionSnapshot`：`snapshot_id`、`created_at`、`run_id`、`observations`、`dimensions`、`overall_confidence`、`changes`、`corrections_applied`、`signature`。
- `AppState` 新增 `observationFeedback`、`tasteSnapshots`。
- `GraphNode.kind` 增加 `observation`；`GraphEdge.kind` 增加 `film-observation`。

存储迁移：

- `STORAGE_VERSION` 从 2 升到 3。
- v1/v2 档案迁移后自动得到空的 `observationFeedback` 与 `tasteSnapshots`，原始记录、笔记、分析、纠错不丢失。
- 快照按 `created_at` 降序保留最多 80 个；重复 `feedback_id` 被去重。
- 迁移测试：`src/lib/storage.test.ts` 新增 2 条，覆盖 v2 → v3 与 v3 重载。

---

## 3. 核心逻辑（`src/lib/taste/evolution.ts`）

1. **只接受可追溯证据**：
   - 分析必须是 `complete` 且 `accepted` / `edited`。
   - `record_id`、`film_id` 必须对得上，记录与电影必须存在。
   - `quote` 必须逐字出现在原始笔记中（去空白与弯引号后比较）。
   - 找不到原文的引文**排除**，并计入 `unverified_evidence_count`；用户移除的单条判断也排除。
   - 证据 ID 稳定：`ev_<record_id>_<dimension>_<quote_hash>`，重复分析不会重复计数。
2. **支持 / 反向**：按维度汇总 `signed = direction × strength`，主导方向决定 `supporting` / `contradicting` / `neutral`；反向证据保留，不删除。
3. **阶段**：
   - `emerging → developing → established` 逐级前进，`evolving` 可随时进入。
   - 综合独立记录数、有效证据数、置信度、一致性、反向证据比例与最新反馈。
   - 一条笔记不能推进到 `established`；出现方向冲突或 30% 以上反向权重进入 `evolving`。
4. **反馈**：
   - `accepted` 置信度 ×1.1；`partially_accepted` ×0.9 并保留说明；`rejected` 置信度 0.05、`effective=false`；`unsure` 不加权。
   - 相同 `decision + user_comment` 重复提交返回原 state，不重复计算。
   - 观察反馈同时进入 `computeTasteProfile()`：同一维度最新反馈会乘到六维置信度上（rejected ×0.05），所以雷达也会变化，不是只改按钮。
5. **快照**：`appendSnapshot()` 只在证据指纹变化时追加快照；旧快照永不覆盖。`compareSnapshots()` 输出 Before / After 与原因。
6. **笔记修改**：`upsert-record` 检测 `reflection` 变化后，把旧分析置回 `unreviewed`，旧证据停止计入，旧快照保留，并写入画像变化原因。
7. **删除**：删除记录会同时删除分析，观察重新计算；旧快照保留，新快照记录 `withdrawn`。
8. **失败**：失败运行不会写入分析，因此 `appendSnapshot()` 指纹不变并返回原 state，最后一次有效快照不被覆盖。

---

## 4. 前端

- **My Taste**（`src/pages/Taste.tsx` + `src/components/taste/ObservationSection.tsx`）
  - 新增“02 正在形成的审美观察”：标题、阶段中英文标签、置信度、独立电影数/证据数、支持/反向数量、最近更新、相关电影海报。
  - 每条观察展示最多 2 条原句；引用与“AI 的解读”分开；来源标注 `演示分析（seed）` / `DeepWorks Agent`。
  - 四类反馈按钮 + “补充说明”文本域；收藏/否决会立即写回 store。
  - 底部快照时间线：日期、整体置信度、变化原因、run_id。
- **Observation Detail**（`src/pages/ObservationDetail.tsx`，路由 `/taste/observations/:observationId`）
  - 观察标题与解释、阶段、置信度、首次/最近日期。
  - 支持证据、反向与未定向证据；每条含电影链接、逐字原句、AI 解读、来源、run_id、强度。
  - 未逐字匹配的引文数量提示。
  - 用户反馈历史与 `affected_snapshot_id`。
  - Before / After：最近两个快照的标题、阶段、置信度与变化原因，以及 `corrections_applied`。
  - 观察时间线：阶段、置信度、支持/反向数量、原因、`snapshot_id`。
- **Memory Map**（`src/lib/graph.ts`、`src/components/map/MemoryGraphView.tsx`、`src/pages/MemoryMap.tsx`）
  - 新增第四层 `observation` 节点与 `film-observation` 连线，复用原布局；增加“观察”图层开关、图例、统计与侧栏（阶段、置信度、关联电影、跳转详情）。

视觉：沿用奶油米白、靛蓝、低对比暖灰、衬线标题与细线分隔；未改 Hero、未引入海报式蓝底黄字、未用红色强调。

---

## 5. DeepWorks 侧

- `.opencode/skills/cinema-taste-profiling/SKILL.md`
  - 新增「审美演化模式」：四阶段、支持/反向、反馈权重、观察与快照 JSON、阶段逐级前进与不覆盖旧快照。
- `.opencode/skills/film-note-analysis/SKILL.md`
  - 新增跨记录字段：稳定 `evidence_id`、`record_id`/`film_id`、`source`；明确 polarity 不在单条笔记阶段判定。
- `.opencode/skills/cinema-knowledge-retrieval/SKILL.md`
  - 新增“为观察检索”约束：query 用具体手法词、引用只解释手法、最多 2 条、不得进入 supporting evidence。
- `.opencode/agents/film-curator.md`
  - 新增「第 5.5 步：审美观察与快照（仅 Taste Evolution 模式）」，并在最终 JSON 增加可选 `evolution` 字段。
- 新增契约与校验：
  - `docs/taste-evolution-agent-contract.md`
  - `workflow/validate-taste-evolution.mjs`
  - `workflow/fixtures/taste-evolution.sample.json` + `.note.txt`
  - 校验结果：`outputs/taste-evolution/taste-evolution-sample.validation.json`（`ok: true`，1 观察、3 证据、1 反馈、1 变化）。

---

## 6. 测试结果

### 6.1 自动化逻辑测试（真实执行）

命令：`node node_modules/vitest/vitest.mjs run`
结果：**9 个测试文件、85 条测试全部通过**。
服务端：`node --test server` → **53 通过、0 失败**。

`src/lib/taste/evolution.test.ts` 16 条，对应需求表：

| 编号 | 场景 | 结果 | 证据 |
|---|---|---|---|
| T1 | 首次添加电影 | **PASS** | 形成 `emerging`，置信度 < 0.4，描述明确“不足以称为稳定偏好” |
| T2 | 第二部相似电影 | **PASS** | `evidence_count=2`、`record_count=2`，识别重复证据 |
| T3 | 第三部反向证据 | **PASS** | 1 条 `contradicting`，阶段进入 `evolving` |
| T4 | 用户接受 | **PASS** | 反馈写入、置信度上升、追加快照 |
| T5 | 用户部分接受 | **PASS** | 置信度低于 accepted，`user_comment` 进入 `corrections_applied` |
| T6 | 用户拒绝 | **PASS** | `effective=false`、置信度 0.05，六维雷达置信度下降 > 50% |
| T7 | 用户不确定 | **PASS** | 置信度不变、`unsure_feedback_count=1`、认可计数 0 |
| T8 | 编辑原始笔记 | **PASS** | 旧分析回到 `unreviewed`，证据退出，旧快照保留，画像事件写入 |
| T9 | 删除电影 | **PASS** | 观察重新计算，旧快照保留，新快照记录 `withdrawn` |
| T10 | 重复提交 | **PASS** | 相同分析不新增证据/快照；证据 ID 稳定 |
| T11 | Agent 运行失败 | **PASS** | 相同指纹不追加快照，最后有效快照不被覆盖 |
| T12 | 查看历史快照 | **PASS** | `compareSnapshots()` 给出 before/after 置信度与“新增 1 条支持证据”的原因 |

> 说明：上表是**引擎与 reducer 的真实自动化测试**，不是浏览器端逐条手动验收。

### 6.2 真实浏览器冒烟（Chrome Headless + CDP）

脚本：`_work/ui-smoke.mjs`（过程文件，不作为交付物）
报告：`outputs/taste-evolution/ui-smoke-report.json`

| 步骤 | 结果 | 详情 |
|---|---|---|
| 打开 `/taste` | PASS | 页面正常渲染 |
| 通过 UI 接受待确认分析 | PASS | 10 条 |
| 观察区出现 | PASS | 含“正在形成的审美观察” |
| 阶段标签 | PASS | `持续变化`、`逐渐形成` 等 |
| 打开观察详情 | PASS | `/taste/observations/obs_visual` |
| 详情含支持证据与 Before/After | PASS | — |
| 可跳转电影 | PASS | “查看这部电影” |
| 反馈写入 localStorage | PASS | 1 条 `accepted` |
| 快照持久化 | PASS | 12 个快照 |
| 控制台错误 | PASS | 0 条 |

截图：

- `outputs/taste-evolution/screenshots/01-taste-observations.png`
- `outputs/taste-evolution/screenshots/02-observation-detail.png`
- `outputs/taste-evolution/screenshots/03-feedback-recorded.png`
- `outputs/taste-evolution/screenshots/04-taste-observation-section.png`
- `outputs/taste-evolution/screenshots/05-before-after.png`
- `outputs/taste-evolution/screenshots/06-memory-map-observations.png`

---

## 7. 演示流程（可复现）

1. `npm run build`
2. `node node_modules/vite/bin/vite.js preview --port 4173`
3. 打开 `http://localhost:4173/taste`。
4. 在“待你确认”逐条点“接受”。每次接受都会立即追加一个快照。
5. 滚动到“正在形成的审美观察”，查看阶段、置信度、支持/反向证据与来源标注。
6. 点“查看证据与历史”，查看逐字原句、AI 解读、用户反馈历史、Before/After 与观察时间线。
7. 点“我认可 / 部分认可 / 不认可 / 暂时不确定”；刷新页面确认反馈与快照仍在。
8. 修改某部电影的原始笔记并保存，回到 My Taste：该分析回到待确认，旧快照仍在，新快照说明原因。
9. 打开 `/map`，用“观察”图层查看观察节点与电影连线。

---

## 8. 最终验收（逐条回答）

1. **Taste Evolution 是否已经完成？**
   **没有全部完成。** 数据模型、观察派生、反馈闭环、快照历史、My Taste / 详情 / Memory Map 已实现并通过自动化与浏览器冒烟；但真实 DeepWorks 跨记录 Agent 的端到端运行没有执行。

2. **DeepWorks Agent 是否真实参与分析？**
   **本轮没有。** 页面当前展示的证据来自已保存的分析：内置 `seed` 演示分析与既有 `legacy-deepseek` 结果。UI 已明确标注 `seed`，没有把它写成 DeepWorks 结果。

3. **用户反馈是否真正影响后续审美画像？**
   **是。** 观察层：accepted 加权、partial 下调、rejected 失效、unsure 不加权；六维层：最新观察反馈会乘到该维度置信度（rejected ×0.05）。T4–T7 与 T6 的雷达下降均通过测试。

4. **历史快照是否可以正常保存和比较？**
   **是。** 快照只追加不覆盖；重复指纹不新增；`compareSnapshots()` 与详情页 Before/After 已展示真实差异；浏览器中生成 12 个快照。

5. **网站是否成功展示真实 Agent 分析结果？**
   **没有展示本轮真实 Agent 结果。** 网站展示的是已保存分析证据的确定性派生，并在来源处区分 `seed` 与 `deepworks`；没有把本地聚合冒充平台运行。

6. **是否仍存在外部模拟分析链路？**
   **是。** `seed` 演示分析、`legacy-deepseek` Worker/Node 路径仍然存在，未被删除；本次只标注来源，没有移除。

7. **是否满足比赛“DeepWorks 核心能力必须在平台内实现”的要求？**
   **尚不能声称满足。** 契约、三个 Skill 与校验器已在项目/DeepWorks 配置内定义，但跨记录 Agent 运行、平台知识库联合调用与平台侧截图尚未在本次执行中验证。

8. **还有哪些功能没有完成？**
   - 真实 DeepWorks 跨记录运行：输入 `history`、输出 `evolution.json`、记录 `run_id`。
   - 平台知识库与观察的联合引用及全量召回验证。
   - 逐条 T1–T12 的浏览器端真实操作录像/截图（目前是引擎测试 + 一次 UI 冒烟）。
   - Agent 运行失败时的前端明确错误态与“未完成分析”提示，仍沿用旧分析面板。
   - 移动端专项截图复核（现有布局使用响应式类，但本次只截了桌面）。
   - 多观察同时冲突时的跨维度叙事摘要，目前是逐条观察，不做整体故事化总结。

---

## 9. 本次文件清单

新增：

- `src/lib/taste/evolution.ts`
- `src/lib/taste/evolution.test.ts`
- `src/components/taste/ObservationSection.tsx`
- `src/pages/ObservationDetail.tsx`
- `docs/taste-evolution-agent-contract.md`
- `workflow/validate-taste-evolution.mjs`
- `workflow/fixtures/taste-evolution.sample.json`
- `workflow/fixtures/taste-evolution.note.txt`
- `outputs/taste-evolution/EXECUTION-REPORT.md`
- `outputs/taste-evolution/ui-smoke-report.json`
- `outputs/taste-evolution/taste-evolution-sample.validation.json`
- `outputs/taste-evolution/screenshots/01–06*.png`

修改：

- `src/types.ts`
- `src/lib/storage.ts`
- `src/lib/storage.test.ts`
- `src/store/AppStore.tsx`
- `src/lib/ai/tasteProfile.ts`
- `src/lib/graph.ts`
- `src/components/map/MemoryGraphView.tsx`
- `src/pages/Taste.tsx`
- `src/pages/MemoryMap.tsx`
- `src/pages/ObservationDetail.tsx`（新增）
- `src/App.tsx`
- `src/data/taxonomy.ts`
- `src/data/seed.ts`
- `.opencode/skills/cinema-taste-profiling/SKILL.md`
- `.opencode/skills/film-note-analysis/SKILL.md`
- `.opencode/skills/cinema-knowledge-retrieval/SKILL.md`
- `.opencode/agents/film-curator.md`
- `package.json`（新增 `test:taste`、`validate:evolution`）

Git：当前分支 `p1.1-profile-v2`，**未提交**。工作区在本次开始前已存在大量未提交修改；为避免把他人/既有工作混入提交，本次只落盘，不执行 `git add` / `commit`。

---

## 10. 下一次必须补的真实运行

```powershell
# 1. 在 DeepWorks 中用包含 history 的输入运行 Film Curator（Taste Evolution 模式）
# 2. 产出 outputs/p0/runs/<RUN_ID>.evolution.json
# 3. 校验
node workflow/validate-taste-evolution.mjs --input outputs/p0/runs/<RUN_ID>.evolution.json --note-file <note.txt> --out outputs/p0/runs/<RUN_ID>.evolution-validation.json
# 4. 保存平台会话截图与 run_id
```

在该步骤完成前，本报告不会把“DeepWorks 真实参与”标为通过。
