# Frame by Frame · P2-A 汇报（交给 GPT 评审用）

> 日期：2026-11-10
> 分支 / HEAD：`p1.1-profile-v2` / `fb42c5f`（实施前后一致）
> 性质：源码已修改、测试已跑通；**未提交、未部署**
> 结论：**CONDITIONAL PASS**

---

## 1. 一句话结论

平台无关的数据契约、Provider 适配层与 v2 持久化兼容已落地，103 个自动化用例全绿；但 UI 主路径尚未切换、Worker 尚未输出 v2、P0 迁移脚本未写，因此是**条件通过**。**DeepWorks 云端接入仍未发生，代码中没有任何路径会假装它已发生。**

---

## 2. 七项验收

| # | 验收项 | 判定 | 依据 |
|---|---|---|---|
| 1 | 请求不再依赖 DeepSeek 专有返回格式 | **部分** | 新增 `analysisService` + `AgentRunV2`；但 `AddFilmFlow` 仍调 `analyzeFilmMemory` |
| 2 | DeepSeek 路径仍能运行 | ✅ | server 48/48，含 `/v1/analyze` 全链路 |
| 3 | Provider 来源可追踪 | ✅ | `meta.providerId` → `run.provider` → `analysis.agent.provider` 三处一致 |
| 4 | v2 不被 storage 整体丢弃 | ✅ | 7 个 v2 持久化用例 |
| 5 | 原始证据不静默丢失 | ✅ | evidence 回退 / raw_direction / focus / agent.raw 均有测试 |
| 6 | P0/P1 测试全通过 | ✅ | 55 + 48，类型检查 exit 0 |
| 7 | 未接通不伪装 DeepWorks | ✅ | 占位实现只抛 `PROVIDER_NOT_CONFIGURED` |

---

## 3. 改动清单

### 新增（5 源码 + 4 测试）

| 文件 | 作用 |
|---|---|
| `src/lib/ai/contractV2.ts` | `PendingNoteV1`、`AgentRunV2`、provider 归一化 |
| `src/lib/ai/normaliseRunV2.ts` | P0/P1/v2 任意产物 → v2 → 网站结构 |
| `src/lib/ai/analysisService.ts` | 统一 `submitAnalysis / getAnalysisStatus / getAnalysisResult` |
| `server/core/providerAdapter.ts` | 服务端 provider 选择与身份标注 |
| `server/core/idempotency.ts` | `idempotency_key` + `request_id` 双索引去重 |

### 修改（5）

| 文件 | 改动 |
|---|---|
| `src/types.ts` | `raw_direction?`、`agent?`、`AIAgentProvenance`（全部可选） |
| `src/lib/storage.ts` | `normaliseAnalysis` 支持 v2 与字段回退 |
| `src/lib/storage.test.ts` | +7 个 v2 用例 |
| `server/core/types.ts` | `AnalysisMeta.providerId?` |
| `server/core/service.ts` | `providerIdFor()`：`deepseek` → `legacy-deepseek` |

**未改**：UI 组件、`client.ts`、`server/app.ts` 路由、Agent、Skills、知识库、P0/P1 产物、`public/`、`package.json`。

---

## 4. 六项持久化修复

| 问题 | 修复前 | 修复后 |
|---|---|---|
| 缺 `recordId`/`filmId` | 整条分析丢弃 | 三级来源解析；仅真正无关联键才拒绝，记录与笔记保留 |
| P0 结构不一致 | 无法识别 | `isAgentRunV2()` 识别后归一化 |
| `ambivalent` | 条目被删 | 映射 `neutral`，原值存 `raw_direction`，刷新后仍在 |
| `interpretation` vs `evidence` | 存空字符串 | 缺 `evidence` 时回退 `interpretation` |
| `analysis.focus` | 丢失 | 映射到三个观察数组 |
| `analyzedAt` | 被 `new Date()` 覆盖 | 优先真实时间戳，全部缺失才用当前时间 |

原始结果保留在 `analysis.agent.raw`，且已剔除 `input`（不含笔记原文）。

---

## 5. 测试结果（真实执行）

| 套件 | 命令 | 结果 |
|---|---|---|
| 前端 | `node node_modules/vitest/vitest.mjs run` | 7 文件 / **55 passed** |
| 服务端 | `node --test server` | 12 文件 / **48 passed** |
| 客户端类型 | `tsc -b --pretty false` | exit 0 |
| 服务端类型 | `tsc -p tsconfig.server.json` | exit 0 |

14 项要求均有对应用例，包括：P0 三组、P1.1.1、v1/v2、缺 recordId、缺 filmId、未知 direction、缺 evidence、重复 request_id、重复 idempotency_key、分析失败、刷新恢复、DeepWorks 未配置、Legacy 正常。

> 注：PowerShell 禁止 `npx.ps1`，故用 `node` 直调可执行文件，非测试失败。

---

## 6. 为什么不是 PASS

1. **UI 未切换**：`AddFilmFlow` 仍直接调用 `analyzeFilmMemory`，新服务尚未成为主路径。
2. **Worker 未输出 v2**：`server/app.ts` 仍返回 `AnalyzeResponse`，`AgentRunV2` 只在客户端包装层产生。
3. **P0 迁移脚本未写**：P0 产物缺 `record_id`，目前需调用方手工补齐。

对应下一轮 P2-A5：UI 灰度切换、Worker 输出 v2、P0→v2 批处理、枚举校验下沉、Playwright 端到端。

---

## 7. 已知限制

| 限制 | 影响 |
|---|---|
| `agent.raw` 存整份 run | localStorage 体积增长，超过 5 MB 需改引用式 |
| 未校验 `observed_emotions` / `themes_identified` 枚举 | 脏数据可能进入雷达 |
| `related_films` 未与 history 交叉校验 | 可能引用不存在影片 |
| 幂等仅在内存 | Worker 多 isolate 不共享，需 Durable Object |
| 无多租户 | P2-B 范围 |

---

## 8. 请 GPT 评审的重点

1. `CONDITIONAL PASS` 是否合理？会不会过于保守，或反过来掩盖了主路径未切换的风险？
2. `agent.raw` 保留整份 run 是否值得？是否有更好的"可追溯但不膨胀"方案？
3. 缺 `record_id` 时拒绝关联、但保留记录与笔记——这个取舍是否正确？
4. `ambivalent → neutral + raw_direction` 是否会污染画像计算？应该完全不参与，还是保留？
5. P2-A5 应该先切 UI，还是先让 Worker 输出 v2？顺序是否有依赖风险？

---

## 9. 完整文档索引

| 文档 | 内容 | 字符数 |
|---|---|---|
| `P2-A1-DATA-CONTRACT.md` | 契约字段、映射、冲突、迁移 | 6,595 |
| `P2-A2-PROVIDER-ADAPTER.md` | 前端/服务端接口、provider 规则 | 5,027 |
| `P2-A3-PERSISTENCE-MIGRATION.md` | 六项修复逐条、版本矩阵 | 5,424 |
| `P2-A4-TEST-REPORT.md` | 14 项映射、断言细节、未覆盖项 | 5,500 |
| `P2-A-IMPLEMENTATION-REPORT.md` | 文件清单、验收、结论 | 5,694 |

合计约 28,000 字符。若 GPT 上下文有限，**本文 + `P2-A4-TEST-REPORT.md` 即可**。
