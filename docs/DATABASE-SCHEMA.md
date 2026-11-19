# DATABASE-SCHEMA

> 版本：v1（阶段 2 设计稿）
> 日期：2026-11-19
> 对应迁移文件：`supabase/migrations/0001_schema.sql`、`supabase/migrations/0002_rls.sql`
> 状态：**SQL 已编写，尚未在真实 Supabase 项目执行**。执行与验证结果写入 `SUPABASE-TEST-REPORT.md`。

---

## 1. 设计原则

1. **复用现有模型，不另起一套。** 表字段直接对应 `src/types.ts` 中的 `WatchRecord` / `AgentRunV2` / `TasteSnapshotV2` / `EvolutionObservation`，迁移时只做「字段搬运」，不做语义重解释。
2. **沿用客户端字符串主键。** `rec_xxx`、`snap_xxx`、`fb_xxx` 原样作为主键，重复导入天然幂等（`on conflict`）。
3. **每张表只有一个所有者列**：`user_id`（`profiles` 用 `id`）。RLS 规则因此可以机械化，不存在「共享行」的特例。
4. **私人数据默认关死。** 所有表 `revoke all ... from anon`，`authenticated` 仅能命中 `auth.uid() = user_id`。
5. **示例数据不等于用户数据。** `watch_notes.source` + `is_demo` 区分，迁移默认跳过 `seed`。
6. **删除可跨设备。** 笔记软删除（`deleted_at`）；「删除我的全部数据」走 `delete_my_data()` 硬删除。
7. **不建没有写入口的表。** 推荐结果、关联影片、图谱边都是即时计算，不落库（见 §8）。

---

## 2. 关系图

```
auth.users (Supabase 托管)
   │ 1
   ├──< profiles                (1:1，id = auth.users.id)
   ├──< user_films              (1:N，自建/外部导入电影)
   ├──< watch_notes             (1:N，观影笔记)
   │        ├──< note_analyses  (1:1 每篇笔记，AI 分析全文)
   │        └──< agent_observations (1:N，DeepWorks 运行导入的观察)
   ├──< taste_profiles          (1:1，当前六维画像)
   ├──< taste_events            (1:N，画像变化日志)
   ├──< taste_snapshots         (1:N，演化快照，只追加)
   ├──< taste_observation_feedback (1:N，观察的接受/拒绝)
   ├──< taste_feedback          (1:N，六维与时间线反馈)
   ├──< user_corrections        (1:N，用户纠错文本)
   └──< yearbook_generations    (1:N，按年份唯一)
```

`watch_notes.film_key` 指向 `Film.id`；内置电影在客户端包内，用户新增电影在 `user_films`。**不建 `films` 全量表**：内置 16 部随包发布，建成表会引入两份事实来源。

---

## 3. 表结构

### 3.1 `profiles`（用户资料）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | uuid | PK，FK → `auth.users(id)` on delete cascade | 即 `auth.uid()` |
| `email` | text | not null default '' | 只读镜像，由触发器同步；**身份以 Auth 为准**；客户端无 UPDATE 权限 |
| `display_name` | text | ≤ 40 字 | 昵称 |
| `avatar_url` | text | 可空 | Storage 公共地址或外链 |
| `allow_ai_notes` | boolean | default false | AI 授权，对齐现有 `settings.allowAiNotes` |
| `ai_policy_version` | text | default '2026-11-01' | 授权版本，便于将来重新征得同意 |
| `locale` | text | default 'zh-CN' | 界面语言 |
| `created_at` / `updated_at` | timestamptz | default now() | `updated_at` 由触发器维护 |

触发器：`on_auth_user_created` 注册即建行；`on_auth_user_email_updated` 同步邮箱。

### 3.2 `user_films`（用户新增电影）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `user_id` | uuid | PK 之一，FK → auth.users | 所有者 |
| `film_key` | text | PK 之一，1–120 字 | 等于 `Film.id` |
| `payload` | jsonb | not null | 完整 `Film` 对象（调色板、母题、海报出处、外部 id） |
| `created_at` / `updated_at` | timestamptz | | |

主键 `(user_id, film_key)`：同一用户重复添加同一部片只会覆盖，不会重复。

### 3.3 `watch_notes`（观影笔记，核心表）

| 列 | 类型 | 约束 | 对应 `WatchRecord` 字段 |
|---|---|---|---|
| `id` | text | PK，`^rec_[A-Za-z0-9_-]{2,80}$` | `id` |
| `user_id` | uuid | not null，FK → auth.users | 新增（替代硬编码 `anon-local`） |
| `film_key` | text | not null，1–120 字 | `filmId` |
| `film_snapshot` | jsonb | default '{}' | 新增：标题/年份/海报快照，保证目录变动后仍可渲染 |
| `rating` | numeric(2,1) | 0.5–5 | `rating` |
| `watched_at` | date | not null | `watchedAt` |
| `status` | text | `watched`/`rewatched`/`abandoned` | `status` |
| `reflection` | text | ≤ 20000 字 | `reflection`（用户正文） |
| `felt_like_tags` | text[] | default '{}' | `feltLikeTags` |
| `themes` | text[] | default '{}' | `themes` |
| `moods` | text[] | default '{}' | `moods` |
| `ai_summary` | text | default '' | `aiSummary` |
| `ai_extracted_from` | text | default 'local-engine' | `aiExtractedFrom` |
| `ai_confidence` | numeric(3,2) | 0–1 | `aiConfidence` |
| `source` | text | `seed`/`user` | `source` |
| `is_demo` | boolean | default false | 仅显式导入演示数据时为 true |
| `revision` | integer | default 1 | 乐观并发版本，触发器自增 |
| `created_at` / `updated_at` | timestamptz | | `createdAt` / `updatedAt` |
| `deleted_at` | timestamptz | 可空 | 软删除墓碑 |

触发器 `watch_notes_revision`：任何 UPDATE 都会 `revision + 1`、刷新 `updated_at`。

### 3.4 `note_analyses`（AI 分析结果）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | text PK | 现有 `recordId` 或 run id |
| `user_id` | uuid | 所有者 |
| `note_id` | text FK → `watch_notes(id)` on delete cascade | 关联笔记 |
| `schema_version` | text | 默认 `agent-run.v2` |
| `status` | text | `succeeded` / `failed` / `pending` |
| `provider` | text | 现有 provider 标识 |
| `agent_id` | text | 现有 agent 标识 |
| `run` | jsonb | 完整 `AgentRunV2`（analysis、evidence、kb_citations） |
| `note_sha256` | text | 分析时笔记哈希，用于判断笔记是否已改 |
| `created_at` / `updated_at` | timestamptz | |

唯一索引 `(user_id, note_id)`：一篇笔记只保留最新一次分析（与现有「重跑覆盖」行为一致）。

### 3.5 `taste_profiles`（当前画像）

| 列 | 类型 | 说明 |
|---|---|---|
| `user_id` | uuid PK | 所有者 |
| `profile` | jsonb | 完整画像（整体置信度、样本量、摘要） |
| `dimensions` | jsonb | 六维数组（每维方向、强度、置信度、证据） |
| `evidence_count` | integer | 有效证据条数（不是笔记条数） |
| `version` | integer | 每次写入 +1 |
| `computed_at` | timestamptz | 计算时间 |
| `updated_at` | timestamptz | 写入时间 |

> 画像仍由客户端 `computeTasteProfile` 计算，写库只是「跨设备一致 + 可审计」。不把算法搬到数据库。

### 3.6 `taste_events`（画像变化日志）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | text PK | `ProfileChangeEvent.id` |
| `user_id` | uuid | 所有者 |
| `kind` | text | `accept`/`edit`/`reject`/`delete`/`correction` |
| `note_id` | text | 可空，关联笔记 |
| `film_title` | text | 便于日志展示 |
| `film_count` / `accepted_count` | integer | 事件发生时的样本量 |
| `changes` | jsonb | 变化明细 |
| `reason` | text | 变化原因 |
| `occurred_at` | timestamptz | 事件时间 |
| `created_at` | timestamptz | 入库时间 |

只追加，不更新、不删除单条（删除账号时整体清除）。

### 3.7 `taste_snapshots`（Taste Evolution 快照）

| 列 | 类型 | 说明 |
|---|---|---|
| `snapshot_id` | text PK | `snapshot_xxx` |
| `user_id` | uuid | 所有者 |
| `signature` | text | 输入指纹 |
| `run_id` | text | 来源运行 |
| `record_count` | integer | 快照基于的记录数 |
| `overall_confidence` | numeric(3,2) | 0–1 |
| `observations` | jsonb | 观察数组（含状态与证据） |
| `dimensions` | jsonb | 六维摘要 |
| `changes` | jsonb | 相对上一快照的变化 |
| `corrections_applied` | text[] | 已应用的纠错 id |
| `created_at` | timestamptz | 快照时间 |
| `imported_at` | timestamptz | 入库时间 |

唯一索引 `(user_id, signature)`：同一输入不会在同一账号下产生两条快照；旧快照只增不改。

### 3.8 `taste_observation_feedback`

| 列 | 类型 | 说明 |
|---|---|---|
| `feedback_id` | text PK | `fb_xxx` |
| `user_id` | uuid | 所有者 |
| `observation_id` | text | 被评价的观察 |
| `decision` | text | `accepted`/`partially_accepted`/`rejected`/`unsure` |
| `user_comment` | text | 可空 |
| `affected_snapshot_id` | text | 归属快照 |
| `created_at` | timestamptz | |

> 语义约束：`rejected` 的观察在画像计算中 `effective = false`（现有 `evolution.ts` 已实现，迁移后保持不变）。

### 3.9 `agent_observations`（DeepWorks 观察 bundle）

| 列 | 类型 | 说明 |
|---|---|---|
| `observation_id` | text PK | bundle 主键 |
| `user_id` | uuid | 所有者 |
| `run_id` / `note_id` / `film_id` | text | 溯源 |
| `note_sha256` | text | 笔记哈希（不存笔记正文副本） |
| `analyzed_at` | timestamptz | 分析时间 |
| `observation` | jsonb | 观察正文 |
| `evidence` | jsonb | 证据数组（逐字引用） |
| `imported_at` | timestamptz | 入库时间 |

`note_id` 外键 `on delete cascade`：用户删除笔记后，依附其上的观察一并消失。

### 3.10 `taste_feedback`（六维 + 时间线反馈）

| 列 | 类型 | 说明 |
|---|---|---|
| `user_id` | uuid | 所有者 |
| `scope` | text | `dimension` / `timeline` |
| `key` | text | 维度 id 或时间线事件 id |
| `verdict` | text | `agree` / `not-quite` / `corrected` |
| `correction` | text | 可空，用户改写 |
| `updated_at` | timestamptz | |

主键 `(user_id, scope, key)`，直接支持 `upsert`。

### 3.11 `user_corrections`

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | text PK | 纠错 id |
| `user_id` | uuid | 所有者 |
| `scope` | text | 纠错范围 |
| `body` | text | ≤ 4000 字 |
| `created_at` | timestamptz | |

### 3.12 `yearbook_generations`

| 列 | 类型 | 说明 |
|---|---|---|
| `user_id` | uuid | 所有者 |
| `year` | integer | 1900–2100 |
| `generated_at` | timestamptz | |

主键 `(user_id, year)`：跨设备也不会重复生成同一年年鉴。

---

## 4. 索引

| 索引 | 目标 | 用途 |
|---|---|---|
| `watch_notes_user_watched_idx` | `(user_id, watched_at desc) where deleted_at is null` | 片库主列表、年度视图 |
| `watch_notes_user_updated_idx` | `(user_id, updated_at desc)` | 增量同步、最近编辑 |
| `watch_notes_user_film_idx` | `(user_id, film_key)` | 同一部片的多条记录 |
| `note_analyses_one_per_note` | unique `(user_id, note_id)` | 一篇笔记一次分析 |
| `taste_events_user_time_idx` | `(user_id, occurred_at desc)` | 变化时间线 |
| `taste_snapshots_user_signature` | unique `(user_id, signature)` | 快照去重 |
| `taste_snapshots_user_time_idx` | `(user_id, created_at desc)` | 演化史 |
| `taste_observation_feedback_user_idx` | `(user_id, created_at desc)` | 反馈列表 |
| `agent_observations_user_idx` | `(user_id, analyzed_at desc)` | 观察列表 |

不建全文索引：当前搜索在客户端对已加载记录做匹配；数据量到万级再评估 `pg_trgm`。

---

## 5. RLS 摘要

| 表 | 所有者列 | select | insert | update | delete |
|---|---|---|---|---|---|
| `profiles` | `id` | own | own | own | own |
| `user_films` | `user_id` | own | own | own | own |
| `watch_notes` | `user_id` | own | own | own | own |
| `note_analyses` | `user_id` | own | own | own | own |
| `taste_profiles` | `user_id` | own | own | own | own |
| `taste_events` | `user_id` | own | own | own | own |
| `taste_snapshots` | `user_id` | own | own | own | own |
| `taste_observation_feedback` | `user_id` | own | own | own | own |
| `agent_observations` | `user_id` | own | own | own | own |
| `taste_feedback` | `user_id` | own | own | own | own |
| `user_corrections` | `user_id` | own | own | own | own |
| `yearbook_generations` | `user_id` | own | own | own | own |

`anon` 对所有表 `revoke all`。没有 `using (true)`，没有服务端「管理员」策略。

**为什么 `update` 同时写 `using` 与 `with check`**：前者限制「能改哪些行」，后者限制「改完之后行仍属于谁」，防止把 `user_id` 改成别人。

---

## 6. 账号注销

`public.delete_my_data()`（`security definer`，仅 `authenticated` 可执行）：

- 删除 `watch_notes`（级联 `note_analyses`、`agent_observations`）；
- 删除 `user_films`、`taste_*`、`user_corrections`、`yearbook_generations`；
- 清空 `profiles.display_name`、`avatar_url`，取消 AI 授权；
- **不删除** `auth.users` 行。

原因：删除 Auth 用户需要 `service_role`，前端不可持有。真正「账号与邮箱注销」放在 Edge Function（服务端函数）中，使用 `service_role` 调用 `auth.admin.deleteUser()`。该函数属于 P4 可选项；**在实现并测试前，比赛材料只能写「一键删除全部个人数据」**，不能写「账号彻底注销」。

---

## 7. 从本地 `fbf.state.v1` 到表的映射

| `AppState` 字段 | 目标表 | 关键处理 |
|---|---|---|
| `records[]` | `watch_notes` | `source === 'seed'` 默认跳过；保留 id；写 `film_snapshot` |
| `customFilms[]` | `user_films` | `film_key = id`，整对象进 `payload` |
| `analyses`（Record<string, AIFilmAnalysis>） | `note_analyses` | 键为 `recordId`；只导入对应笔记存在的分析 |
| `agentObservations` | `agent_observations` | 需 `note_id` 存在；证据原样保留 |
| `profileHistory` | `taste_events` | 保留 `occurredAt` |
| `tasteSnapshots` | `taste_snapshots` | `signature` 冲突时跳过并计数 |
| `observationFeedback` | `taste_observation_feedback` | 保留 decision 原文 |
| `feedback` | `taste_feedback` | scope=`dimension` |
| `timelineFeedback` | `taste_feedback` | scope=`timeline` |
| `corrections` | `user_corrections` | 原样 |
| `yearbookGenerations` | `yearbook_generations` | 原样 |
| `settings` | `profiles` | `allowAiNotes` → `allow_ai_notes` |
| 当前画像（派生） | `taste_profiles` | 导入后本地重算一次再写回 |
| 推荐/关联（派生） | 不落库 | 每次计算 |

导入顺序固定：`profiles` → `user_films` → `watch_notes` → `note_analyses` → `agent_observations` → `taste_snapshots` → `taste_events` → 反馈 → 纠错 → 年鉴 → 画像。前置表先写，避免外键失败。

---

## 8. 明确不建的表

| 候选 | 为什么不建 |
|---|---|
| 全局 `films` 表 | 内置 16 部随包发布；建表会产生两套目录、两处修改 |
| `recommendations` | 当前推荐是即时派生（`MemoryMap` 的 `relatedFilms`），没有写入口，建表只会产生空表 |
| `film_relations` | 关联权重由 `graph` 计算，属纯函数输出 |
| `sessions` | Supabase Auth 管理，重复建表有泄密风险 |
| `passwords` | **永远不建**。密码只在 Auth 内部以哈希形式存在 |
| `ai_requests` | 网关已有内存幂等与限流；若要计费审计再做，当前无需求 |

---

## 9. 落地与校验步骤

1. Supabase → SQL Editor：执行 `0001_schema.sql`，再执行 `0002_rls.sql`。
2. 校验表与策略：

```sql
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
select tablename, cmd, policyname from pg_policies where schemaname = 'public' order by 1, 2;
select proname from pg_proc where proname in ('handle_new_user','bump_note_revision','delete_my_data');
```

3. 注册一个测试账号，确认 `profiles` 自动出现一行。
4. 用两个账号做越权测试（详见 `AUTHENTICATION-AND-SECURITY.md` §7）。

> 只有第 2–4 步真实跑过并把输出贴进 `SUPABASE-TEST-REPORT.md`，才能把「数据库已就绪」写成已完成。
