# DATA-MIGRATION-REPORT

> 版本：v1（阶段 1 盘点 + 阶段 2 迁移设计）
> 日期：2026-11-19
> 执行状态：**未执行**。当前没有任何用户的本地数据被读取、上传或删除。
> 本文分两部分：A. 迁移源的真实结构盘点；B. 迁移方案与验收标准。

---

## A. 迁移源盘点（真实代码）

### A.1 迁移源在哪里

| 项 | 值 |
|---|---|
| 存储位置 | 浏览器 `localStorage` |
| key | `fbf.state.v1`（`src/data/taxonomy.ts:250`） |
| schema 版本 | `STORAGE_VERSION = 3`（`src/data/taxonomy.ts:256`） |
| 二级 key | `fbf.tmdb.token`（可选，TMDB 个人 token） |
| 其他存储 | 无 sessionStorage、无 IndexedDB、无服务端副本 |
| 编码 | 单个 JSON 字符串，整份 `AppState` |

> 含义：迁移只能由**用户本人登录后的浏览器**发起。服务端没有旧数据可读。

### A.2 迁移源字段清单

`AppState` 顶层（`src/types.ts:494-519`）：

| 字段 | 类型 | 是否迁移 | 说明 |
|---|---|---|---|
| `records` | `WatchRecord[]` | 是 | 默认只导入 `source === 'user'` |
| `customFilms` | `Film[]` | 是 | 自建/外部导入电影 |
| `analyses` | `Record<string, AIFilmAnalysis>` | 是 | 键为 `recordId`；孤儿分析跳过 |
| `agentObservations` | `AgentObservationBundle[]` | 是 | 需对应笔记存在 |
| `profileHistory` | `ProfileChangeEvent[]` | 是 | 最多保留 80 条 |
| `tasteSnapshots` | `TasteSnapshotV2[]` | 是 | 最多保留 80 条 |
| `observationFeedback` | `ObservationFeedback[]` | 是 | 接受/部分接受/拒绝 |
| `feedback` | `Record<string, {verdict, correction?}>` | 是 | 六维反馈 |
| `timelineFeedback` | `Record<string, {verdict, correction?}>` | 是 | 时间线反馈 |
| `corrections` | `Correction[]` | 是 | 纠错文本 |
| `yearbookGenerations` | `Record<string, string>` | 是 | 年份 → 生成时间 |
| `settings` | `{ allowAiNotes: boolean }` | 是 | → `profiles.allow_ai_notes` |
| （派生）Taste Profile | 计算值 | 重新计算后写入 | 不迁移旧缓存值 |

### A.3 已确认的格式风险

| 风险 | 事实 | 迁移动作 |
|---|---|---|
| 演示数据混入 | `createInitialState()` 含 10 条 `source: 'seed'` 记录 | 默认跳过，导入报告中单列「跳过 N 条示例记录」 |
| 旧数据被截断 | 读取时快照与事件各只保留最新 80 条 | 只能迁移保留下来的部分；报告中如实写明上限 |
| 孤儿分析 | 笔记被删除后 `analyses` 可能残留 | 导入前做关联检查，跳过并计数 |
| 重复快照 | 同一 `signature` 可能出现多条 | 以 `(user_id, signature)` 去重，保留最早一条 |
| JSON 损坏 | 解析失败会回退到示例数据 | 导入前先 `JSON.parse` 校验；失败则中止，不写入半份数据 |
| 多标签页覆盖写 | 整包后写覆盖先写 | 导入以「当前页面读到的那一份」为准，并保留原始备份 key |
| 体积 | 单 key 可能接近配额 | 导入前显示字节数；超过 4 MB 提示先分年导出 |

---

## B. 迁移方案（设计，待实施）

### B.1 硬性规则

1. **先备份，后迁移。** 备份写入 `fbf.state.v1.backup.<ISO时间戳>`，原 key `fbf.state.v1` 继续保留。
2. **只增不删。** 导入过程不调用 `removeItem`；是否清理旧数据由用户在账号页二次确认，且只在云端校验通过后开放。
3. **可重放。** 所有写入使用固定主键 + `upsert`/`on conflict`，重复点击「导入」不会产生重复行。
4. **不静默跳过。** 每类数据的 `导入 / 跳过 / 冲突` 数量都显示给用户，并写入迁移报告。
5. **失败可回滚。** 导入在单次会话内按表顺序执行；任一步失败即停止，显示已写入条数，并提供「删除本次导入」按钮（按本次记录的 id 列表删除）。

### B.2 流程

```
检测 fbf.state.v1
  ├─ 不存在 → 不显示导入入口
  └─ 存在 → JSON.parse + 结构校验
        ├─ 失败 → 中止，提示「本地数据损坏」，提供原始字符串下载
        └─ 成功 → 预览页：记录数 / 自建电影数 / 快照数 / 分析数 / 示例记录数
              → 用户勾选「导入我的真实记录」（默认勾选）
              → 勾选「同时导入示例数据用于展示」（默认不勾，写入 is_demo = true）
              → 开始导入
                    → profiles（昵称、AI 授权）
                    → user_films
                    → watch_notes
                    → note_analyses（仅笔记存在的）
                    → agent_observations（仅笔记存在的）
                    → taste_snapshots（signature 去重）
                    → taste_events
                    → taste_observation_feedback
                    → taste_feedback（dimension + timeline）
                    → user_corrections
                    → yearbook_generations
                    → 本地重算 taste_profiles 并写入
                    → 写迁移摘要 + 备份 key
                    → 结果页：逐表条数 + 跳过原因
```

### B.3 字段映射细则

**`WatchRecord` → `watch_notes`**

| 旧字段 | 新列 | 转换 |
|---|---|---|
| `id` | `id` | 原样（必须匹配 `rec_` 前缀约束） |
| `filmId` | `film_key` | 原样 |
| 影片标题/年份/海报 | `film_snapshot` | `{ title, titleZh, year, posterUrl, director }` |
| `rating` | `rating` | 原样，校验 0.5–5 |
| `watchedAt` | `watched_at` | `YYYY-MM-DD` |
| `status` | `status` | 原样，非法值回退 `watched` 并计数 |
| `reflection` | `reflection` | 原样，> 20000 字截断并警告（当前 UI 限制更小） |
| `feltLikeTags` | `felt_like_tags` | 数组 |
| `themes` / `moods` | 同名列 | 数组 |
| `aiSummary` / `aiExtractedFrom` / `aiConfidence` | 同名列 | 原样 |
| `source` | `source` | 原样 |
| `createdAt` / `updatedAt` | 同名列 | ISO → timestamptz |
| — | `is_demo` | 仅「勾选导入示例」时为 `source === 'seed'` |
| — | `revision` | 默认 1 |

**`analyses` → `note_analyses`**：`id = recordId`（现有行为是一篇笔记一份分析），`run` 存完整对象，`note_sha256` 在导入时用 `crypto.subtle.digest` 现算。

**`tasteSnapshots` → `taste_snapshots`**：`snapshot_id`、`signature`、`observations`、`dimensions`、`changes`、`correctionsApplied` 原样；`created_at` 取快照时间，`imported_at` 取当前时间。

**`feedback` / `timelineFeedback` → `taste_feedback`**：`verdict` 原样；`not-quite` / `corrected` 必须保留 `correction`，否则降级为 `agree` 并警告（避免空纠错污染画像）。

### B.4 备份与导出

| 动作 | 内容 | 保留策略 |
|---|---|---|
| 自动备份 | `fbf.state.v1.backup.<ts>` 存原始字符串 | 不自动删除 |
| 手动导出 | `frame-by-frame-backup-<date>.json`，含 `schemaVersion`、`exportedAt`、`state` | 用户自行保存 |
| 导入前提示 | 显示备份已写入的 key 名 | 用户可见 |

### B.5 迁移校验

迁移完成后必须逐项核对：

```sql
-- 1) 笔记条数（与预览页「导入条数」一致）
select count(*) from public.watch_notes where user_id = auth.uid();

-- 2) 每条笔记都有对应电影（内置目录或 user_films）
select count(*) from public.watch_notes n
 where n.user_id = auth.uid()
   and not exists (select 1 from public.user_films f
                    where f.user_id = n.user_id and f.film_key = n.film_key)
   and n.film_key not in ('inside-out','arrival', /* …内置 16 部 slug… */);

-- 3) 分析没有孤儿
select count(*) from public.note_analyses a
 where a.user_id = auth.uid()
   and not exists (select 1 from public.watch_notes n where n.id = a.note_id);

-- 4) 快照去重后的条数
select count(distinct signature) from public.taste_snapshots where user_id = auth.uid();

-- 5) 示例记录占比（若导入）
select source, is_demo, count(*) from public.watch_notes
 where user_id = auth.uid() group by 1, 2;
```

> 第 2 步的内置 slug 列表由 `src/data/films.ts` 生成，不手抄。

### B.6 回滚

| 场景 | 手段 |
|---|---|
| 导入中断 | 按本次导入的 id 列表 `delete`；备份 key 不受影响 |
| 导入结果不对 | 账号页「删除我的全部数据」→ 从备份 key 重新导入 |
| 本地数据仍在 | 原 key 从未被删除，随时可再次导入 |

### B.7 跨设备说明（必须对用户讲清楚）

本地 `fbf.state.v1` **只存在于写入它的那台设备、那个浏览器**。在手机上登录同一账号，不会自动看到电脑浏览器里的旧数据；必须先在电脑上完成一次「导入到云端」。这一点必须写进迁移预览页与比赛说明，不能含糊。

---

## C. 执行状态

| 步骤 | 状态 | 证据 |
|---|---|---|
| 迁移源结构盘点 | 已完成 | 本文 A 节 + 审计报告 |
| 备份策略设计 | 已完成 | 本文 B.4 |
| 映射规则设计 | 已完成 | 本文 B.3 + `DATABASE-SCHEMA.md` §7 |
| 导入脚本 | **未实现** | P4c |
| 真实数据导入 | **未执行** | 无数据被触碰 |
| 条数/关联校验 | **未执行** | P4c/P5 |
| 旧数据清理 | **未执行**（默认不清理） | 需用户二次确认 |

> 结论：目前可以承诺「不会删除任何本地数据」，但不能承诺「迁移已成功」。后者要等 P4c 的真实运行记录。
