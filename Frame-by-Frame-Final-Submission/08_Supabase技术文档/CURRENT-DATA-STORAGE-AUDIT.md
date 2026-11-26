# CURRENT-DATA-STORAGE-AUDIT

> 审计对象：Frame by Frame 现有仓库（HEAD 及其工作区改动）
> 审计日期：2026-11-19
> 审计方式：静态代码审查（读取真实源码，未运行浏览器）
> 结论口径：本文只写代码能证明的事实。凡是推断，均标注「推断」。

---

## 0. 一句话结论

Frame by Frame 目前是**纯前端单用户应用**：全部业务数据（片库、观影笔记、AI 分析、审美画像、演化快照、反馈与设置）被打包成**一个 JSON**，写入**一个 localStorage key** `fbf.state.v1`。
没有数据库、没有后端持久化、没有用户体系、没有跨设备同步。
唯一的外部服务是 DeepSeek 分析网关（Cloudflare Worker / 本地 Node），它是**无状态**的，不保存任何笔记。

---

## 1. 审计范围与证据来源

| 层 | 实际文件 | 审查结论 |
|---|---|---|
| 持久化 | `src/lib/storage.ts`、`src/data/taxonomy.ts` | 单 key 整包 JSON，版本迁移，跨标签页监听 |
| 状态层 | `src/store/AppStore.tsx` | `useReducer` + `useEffect` 每次变更全量写回 |
| 领域模型 | `src/types.ts` | `AppState` 13 个顶层字段 |
| 内置数据 | `src/data/films.ts`、`src/data/seed.ts` | 16 部内置电影、10 条演示记录，随包发布 |
| 外部目录 | `src/lib/catalogue/*` | IMDb 免费搜索 + 可选 TMDB（token 另存 localStorage） |
| AI 调用 | `src/lib/ai/client.ts`、`src/lib/ai/analysisService.ts`、`src/lib/ai/history.ts` | 浏览器直连 Worker `/v1/analyze`，无鉴权头，无用户身份 |
| 分析网关 | `server/worker.deepseek.ts`、`server/app.ts`、`server/core/*` | 无状态；幂等与限流都是**进程内内存** |
| 部署 | `.github/workflows/deploy.yml`、`vite.config.ts` | GitHub Pages 静态托管，SPA 404 回退 |
| 认证 | 全仓库检索 `login / auth / session / user_id` | 无任何登录、会话或权限机制；`user_id` 硬编码为 `'anon-local'` |

---

## 2. 数据存储总表（逐类）

| # | 数据类别 | 真实存储位置 | 写入触发 | 刷新后 | 换设备/换浏览器 | 丢失风险 |
|---|---|---|---|---|---|---|
| 1 | 内置电影目录（16 部） | 打包进 JS（`src/data/films.ts`） | 构建时 | 在 | 在（随包） | 无 |
| 2 | 用户自建/外部导入电影（`customFilms`） | `fbf.state.v1` | `addCustomFilm` | 在 | **不在** | 清缓存即丢 |
| 3 | 观影笔记（`records`，含正文、评分、日期、主题、情绪、AI 摘要） | `fbf.state.v1` | `upsertRecord` | 在 | **不在** | 清缓存/换设备即丢 |
| 4 | AI 单条分析（`analyses`，含逐字引用证据） | `fbf.state.v1` | `saveAnalysis` / `reviewAnalysis` | 在 | **不在** | 同上 |
| 5 | Agent 观察 bundle（`agentObservations`，含 run 溯源与 note 哈希） | `fbf.state.v1` | `importEvolution` | 在 | **不在** | 同上 |
| 6 | Taste Profile（六维画像） | **不单独存储**；由 `computeTasteProfile` 每次从记录实时计算 | 读时派生 | 重新算出 | 无源数据就无画像 | 随笔记一起丢 |
| 7 | 画像变化事件（`profileHistory`） | `fbf.state.v1`（上限 80 条） | 记录增删改、纠错 | 在 | **不在** | 超限被截断；清缓存即丢 |
| 8 | Taste Evolution 快照（`tasteSnapshots`） | `fbf.state.v1`（上限 80 条） | `ensure-snapshot` / 导入 | 在 | **不在** | 超限被截断；清缓存即丢 |
| 9 | 观察反馈（`observationFeedback`，接受/部分接受/拒绝） | `fbf.state.v1` | `setObservationFeedback` | 在 | **不在** | 清缓存即丢 |
| 10 | 六维反馈（`feedback`）、时间线反馈（`timelineFeedback`） | `fbf.state.v1` | `setDimensionFeedback` 等 | 在 | **不在** | 清缓存即丢 |
| 11 | 用户纠错文本（`corrections`） | `fbf.state.v1` | `addCorrection` | 在 | **不在** | 清缓存即丢 |
| 12 | 年度年鉴生成标记（`yearbookGenerations`） | `fbf.state.v1` | `markYearbook` | 在 | **不在** | 清缓存即丢 |
| 13 | AI 授权设置（`settings.allowAiNotes`） | `fbf.state.v1` | `setAiConsent` | 在 | **不在** | 清缓存后回到「未授权」 |
| 14 | 个性化推荐 / 相关影片 | **不持久化**；`MemoryMap` 的 `relatedFilms`、`graph` 每次由记录派生 | 读时计算 | 重新算出 | — | 无记录 |
| 15 | 登录会话 | **不存在** | — | — | — | — |
| 16 | TMDB 个人 token（可选） | 另一个 localStorage key `fbf.tmdb.token`（`src/lib/catalogue/tmdb.ts`） | 用户手动填写 | 在 | **不在** | 明文存本机 |
| 17 | AI 请求幂等记录、限流计数 | 服务端进程内存（`server/core/idempotency.ts`、`server/core/rateLimit.ts`） | 每次请求 | 实例重启即丢 | **不共享** | 无法防跨设备重复提交 |

---

## 3. 对十个审查问题的直接回答

1. **电影收藏数据存在哪里？**
   内置 16 部在代码里（`src/data/films.ts`）；用户额外添加的电影在 `AppState.customFilms`，随整包写入 `fbf.state.v1`。
2. **观影笔记存在哪里？**
   `AppState.records`，同一个 localStorage key。没有数据库副本。
3. **添加 / 删除 / 编辑影评时数据如何保存？**
   全部经由 `AppStore` 的 reducer 修改内存状态，随后 `useEffect(() => persistState(state), [state])` 把**整份 state** 重新序列化写回 localStorage（`src/store/AppStore.tsx:452-454`）。没有增量写、没有服务端写、没有保存状态反馈。
4. **Taste Profile 存在哪里？**
   不存在独立存储。它由 `computeTasteProfile(state, films)` 在 `AppStore` 内 `useMemo` 实时计算（`src/store/AppStore.tsx:464`）。换设备后因为没有源笔记，画像即为空。
5. **Taste Evolution 历史快照存在哪里？**
   `AppState.tasteSnapshots`，localStorage；读取时按时间倒序并截断到 80 条（`src/lib/storage.ts:304-323`）。
6. **AI 分析结果是否持久化？**
   「本地持久化」有，「云端持久化」没有。结果写入 `AppState.analyses` 与 `agentObservations`，仍是同一个 localStorage key。
7. **个性化推荐记录存在哪里？**
   没有记录。相关影片、记忆图谱边、年度统计都是即时派生（如 `src/pages/MemoryMap.tsx:50-56`），刷新后重新计算，不产生可追溯的推荐历史。
8. **刷新、关闭浏览器、重新打开后哪些数据还在？**
   同一浏览器、同一 origin、未清理站点数据的前提下：上表 1–13 全部还在（单 key 整包）。
   一旦清理站点数据、进入隐私模式、换浏览器、换设备、换域名/路径（origin 变化），**除内置 16 部电影外全部消失**。
9. **手机端和电脑端是否有同步机制？**
   没有。唯一的跨端机制是 `storage` 事件监听（`src/lib/storage.ts:447-461`），它只在**同一浏览器的多个标签页**之间生效。
10. **是否已有数据库、后端 API 或用户认证？**
   数据库：无。
   后端 API：有且仅有一个 DeepSeek 分析网关（`/v1/analyze`、`/v1/health`），无状态、无用户表。
   用户认证：无。`AddFilmFlow` 甚至在请求体里硬编码 `user_id: 'anon-local'`（`src/components/add/AddFilmFlow.tsx:498`）。

---

## 4. 关键代码证据

| 事实 | 证据位置 |
|---|---|
| 存储 key 与 schema 版本 | `src/data/taxonomy.ts:250`（`fbf.state.v1`）、`src/data/taxonomy.ts:256`（`STORAGE_VERSION = 3`） |
| 读取：解析失败/无数据时回退到 `createInitialState()`（含 10 条演示记录） | `src/lib/storage.ts:399-406`、`src/lib/storage.ts:415-421` |
| 写入：整包 `JSON.stringify(state)`，异常仅返回 `false` | `src/lib/storage.ts:430-437` |
| 清空：`removeItem(STORAGE_KEY)` | `src/lib/storage.ts:439-445` |
| 跨标签页监听（仅同浏览器） | `src/lib/storage.ts:447-461` |
| 每次状态变化全量落盘 | `src/store/AppStore.tsx:452-454` |
| 启动时读取 | `src/store/AppStore.tsx:443-444` |
| 「恢复示例」按钮：清空 + 重置 | `src/components/layout/Shell.tsx:37,237`、`src/store/AppStore.tsx:644-647` |
| 快照/事件上限 80 | `src/lib/storage.ts:262`、`src/lib/storage.ts:322` |
| 启动页明确写着「读取保存在这台设备上的片库，不会向服务器发送任何内容」 | `src/App.tsx:16-33` |
| 无路由级鉴权，7 条业务路由全部直接可访问 | `src/App.tsx:50-57` |
| AI 端点来自构建期环境变量 | `src/lib/ai/client.ts:10-24`、`.github/workflows/deploy.yml`（`VITE_AI_API_BASE`） |
| AI 只发送有限上下文：当前笔记（≤3200 字）+ 最多 8 条相关历史 | `server/core/contract.ts:131-135`、`src/lib/ai/history.ts:12-51` |
| 幂等与限流是进程内内存，实例重启即失效 | `server/core/idempotency.ts:35-36`、`server/core/rateLimit.ts:16` |
| AI 授权默认关闭，未勾选不会发笔记 | `src/data/seed.ts:185`、`src/components/add/AddFilmFlow.tsx:467-470` |
| 部署为 GitHub Pages 静态站点 + 404 回退 | `.github/workflows/deploy.yml`、`vite.config.ts` |

---

## 5. 容量与写入行为

- **单 key 整包**：`persistState` 每次状态变化都会序列化整个 `AppState`（包含全部笔记正文、全部分析 JSON、最多 80 条快照）。记录越多，单次写入越慢，主线程卡顿风险越高（推断，未实测）。
- **配额**：浏览器 localStorage 通常约 5 MB/origin。`persistState` 捕获异常后返回 `false`，但 `AppStore` 的 `useEffect` **没有检查返回值**，因此配额写满时表现为「界面正常、刷新后回退到上一次成功写入的版本」，用户不会收到提示。
- **损坏回退**：JSON 解析失败会直接落到 `createInitialState()`，用户看到的是 10 条示例记录，而不是错误页。这会掩盖数据损坏。
- **多标签页并发**：两个标签页同时编辑时，各写整包，后写覆盖先写（last-write-wins，无版本号、无合并）。

---

## 6. 数据丢失与隐私风险清单

### P0（上线多用户前必须解决）

| 风险 | 触发条件 | 影响 |
|---|---|---|
| 清除站点数据 / 隐私模式 | 浏览器设置、清理工具、系统清理 | 全部个人数据永久丢失 |
| 换设备 / 换浏览器 / 换域名 | 手机、另一台电脑、GitHub Pages 域名或 base 变化 | 「记忆」不跟随用户 |
| 配额写满静默失败 | 长期积累笔记与快照 | 最近的编辑丢失且无提示 |
| 数据损坏被当成示例数据 | JSON 损坏、写入中断 | 用户误以为数据被重置 |
| 「恢复示例」一键清空 | 误触确认弹窗 | 真实记录、画像、快照全部删除，无备份 |
| 多标签页覆盖写 | 两个标签页同时编辑 | 其中一方的修改丢失 |

### P1（隐私与合规）

| 风险 | 说明 |
|---|---|
| 笔记明文存储 | localStorage 中任何同源脚本（含第三方脚本、XSS）都可读取；同设备其他使用者也可通过开发者工具读取 |
| 无用户隔离 | 所有使用者共享同一份数据；不存在「用户 A/B」概念 |
| AI 数据范围需如实说明 | 当前只发当前笔记 + ≤8 条相关历史，不发邮箱、不发全库；但需要产品层明示第三方处理 |
| 无删除权实现 | 只有「恢复示例」，没有「删除我的账号与全部数据」 |
| TMDB token 明文 | 可选功能，token 存在 `fbf.tmdb.token`，属本机凭据 |

### P2（可维护性）

- 单文件 461 行同时承担读写、迁移、校验、跨标签页同步，后续接入云端会形成「双写分叉」。
- `AppState` 是 UI 聚合模型，不是数据库模型；直接把它塞进一张 JSON 表会丧失 RLS 的粒度。

---

## 7. 这些事实对 Supabase 迁移的直接含义

1. **不需要「导出旧数据库」**：没有数据库。迁移源就是浏览器里的 `fbf.state.v1`。
2. **迁移必须在登录后的客户端完成**，因为数据只存在于用户设备；服务端无法主动读取。
3. **必须保留原 key 作为备份**：迁移成功后也不删除 `fbf.state.v1`，改为写入带时间戳的备份 key，并由用户手动确认后再清理。
4. **示例数据与真实数据必须分开**：`records[].source` 已区分 `'seed' | 'user'`（`src/types.ts:198`）。默认只导入 `source === 'user'`，避免把演示记录写进真实账号并污染审美画像。
5. **ID 可以原样保留**：`record.id`（如 `rec_xxx`）、`snapshot_id`、`feedback_id` 都是字符串主键，可直接作为云端主键，天然支持幂等重放。
6. **需要为「删除」设计墓碑**：云端删除必须能被其他设备感知，因此笔记使用 `deleted_at` 软删除，而不是物理删除。
7. **画像与快照必须上云**：`taste_profiles` / `taste_snapshots` 是「AI 如何逐渐理解用户」的证据链，比笔记本身更不能丢。
8. **AI 链路不要动**：现有 `/v1/analyze` 契约、幂等、限流、逐字引用校验都保留；Supabase 只负责持久化与身份，不接管模型调用。

---

## 8. 本次审计未覆盖的部分（不做虚假声明）

- 未在真实浏览器中读取 localStorage 的实际字节数、记录条数与写入耗时。
- 未验证 Safari / iOS 对 localStorage 的回收策略，仅按通用风险记录。
- 未审计第三方资源（Google Fonts、TMDB 图片、IMDb 页面）的请求范围与隐私影响。
- 未验证 GitHub Pages 的 origin 变更历史，仅指出 origin 变化会导致数据不可见。

以上四项属于阶段 4 的实测任务，结果将写入 `SUPABASE-TEST-REPORT.md`，在此之前不标记为已验证。
