# SUPABASE-ARCHITECTURE

> 版本：v1（阶段 2 设计稿）
> 日期：2026-11-19
> 状态：**设计方案，尚未接入运行时**。代码实现与真实测试结果见后续 `SUPABASE-TEST-REPORT.md`。
> 前置事实依据：`docs/CURRENT-DATA-STORAGE-AUDIT.md`

---

## 1. 目标与非目标

### 目标

1. 邮箱注册 / 登录 / 退出 / 会话保持 / 忘记密码 / 重置密码 / 邮箱验证。
2. 每个用户拥有独立的电影记忆空间，数据库层强制隔离（RLS）。
3. 观影笔记、AI 分析、Taste Profile、Taste Evolution 快照与反馈全部云端持久化。
4. 电脑写入、手机读取；刷新、重开、退出再登录后数据仍在。
5. 现有 DeepSeek 分析链路（Cloudflare Worker / 阿里云函数）与 DeepWorks 侧 Agent + 三个 Skill 完全保留。
6. 历史本地数据可备份、可迁移、可校验，不覆盖、不丢失。

### 非目标（本阶段明确不做）

- 不做社交、关注、公开影评广场。私人影评默认仅本人可见。
- 不引入自建后端服务器；Supabase 承担 Auth + Postgres + Storage。
- 不重写现有领域模型与审美算法（`tasteEngine`、`taste/evolution`、`ai/*` 保持原样）。
- 不把 `service_role` key 放进前端、放进仓库或放进聊天。
- 不在 v1 引入 Realtime 订阅（见 §7 决策）。

---

## 2. 目标架构

```
┌──────────────────────────── 浏览器（GitHub Pages 静态站点） ────────────────────────────┐
│                                                                                        │
│  React SPA                                                                             │
│  ├─ AuthGate          未登录 → /welcome；已登录 → /（原有业务路由）                       │
│  ├─ SessionProvider   supabase.auth.getSession / onAuthStateChange                      │
│  ├─ AppStore          UI 聚合状态（沿用现有 reducer，改动最小）                          │
│  │   ├─ 读：先读本地缓存（秒开）→ 再从 Supabase 拉取 → 对齐                              │
│  │   └─ 写：乐观更新 → 入同步队列 → 后台 flush → 失败标记「待同步」                      │
│  ├─ repositories      notes / films / analyses / taste / profile（每表一个模块）          │
│  └─ sync              队列、重试、冲突检测、登出清理                                     │
│                                                                                        │
│  本地缓存（不再是唯一数据源）                                                            │
│  ├─ fbf.cache.v1.<uid>     最近一次云端快照（加速首屏，可随时重建）                      │
│  ├─ fbf.queue.v1.<uid>     未完成写操作（离线/弱网）                                     │
│  └─ fbf.state.v1           迁移前的旧数据，**只读保留**，不删除                          │
└───────────────┬───────────────────────────────────────────────┬────────────────────────┘
                │ supabase-js（anon key + 用户 JWT）             │ fetch（现有链路，不变）
                ▼                                               ▼
┌──────────────────────────────┐                  ┌──────────────────────────────────────┐
│ Supabase                     │                  │ DeepSeek 分析网关                     │
│ ├─ Auth（邮箱密码 + 验证邮件）│                  │ ├─ Cloudflare Worker（生产）          │
│ ├─ Postgres + RLS            │                  │ ├─ Node 本地开发服务                  │
│ └─ Storage（avatars，可选）   │                  │ └─ 契约 /v1/analyze，无状态            │
└──────────────────────────────┘                  └──────────────────────────────────────┘
```

关键点：**Supabase 是持久化与身份的唯一事实来源；浏览器缓存只是加速层；AI 网关仍是原来的无状态分析服务。**

---

## 3. 模块划分（计划新增/修改的文件）

| 文件 | 职责 | 改动性质 |
|---|---|---|
| `src/lib/supabase/client.ts` | 创建单例 client，读取 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，`persistSession: true`、`autoRefreshToken: true`、`detectSessionInUrl: true` | 新增 |
| `src/lib/supabase/errors.ts` | 把 Supabase 错误映射为中文可读提示 | 新增 |
| `src/auth/SessionProvider.tsx` | 暴露 `session / user / loading / signOut`，监听 `onAuthStateChange` | 新增 |
| `src/auth/AuthGate.tsx` | 未登录重定向，登录后放行原有路由 | 新增 |
| `src/pages/auth/SignIn.tsx` / `SignUp.tsx` / `ForgotPassword.tsx` / `ResetPassword.tsx` | 四个认证页面，沿用米白 + 蓝色杂志语言 | 新增 |
| `src/pages/Account.tsx` | 个人资料、AI 授权、数据导出、注销 | 新增 |
| `src/lib/db/notes.ts` | `watch_notes` 读写、软删除、revision 校验 | 新增 |
| `src/lib/db/films.ts` | `user_films` 读写 | 新增 |
| `src/lib/db/analyses.ts` | `note_analyses` 读写 | 新增 |
| `src/lib/db/taste.ts` | `taste_profiles` / `taste_snapshots` / `taste_events` / 反馈 | 新增 |
| `src/lib/db/profile.ts` | `profiles` 读写、设置 | 新增 |
| `src/lib/sync/queue.ts` | 写入队列、指数退避、失败状态 | 新增 |
| `src/lib/sync/hydrate.ts` | 云端 → `AppState` 映射；缓存读写 | 新增 |
| `src/lib/sync/migrateLocal.ts` | 首次登录后的本机数据导入 | 新增 |
| `src/store/AppStore.tsx` | 保留 reducer；读/写路径改为「缓存 + repo + 队列」 | 修改（受控） |
| `src/lib/storage.ts` | 保留旧 key 读写，标记为 legacy + 备份；新增 cache key 读写 | 修改（受控） |
| `src/App.tsx` | 增加 `/welcome`、`/auth/*`、`/account` 路由与 AuthGate | 修改 |
| `src/components/layout/Shell.tsx` | 增加账号入口与退出；调整「恢复示例」对真实账号的影响 | 修改 |
| `src/lib/ai/analysisService.ts` | 仅把 `user_id: 'anon-local'` 换成真实 uid（若网关契约允许） | 小改，需回归 |

原则：**领域计算（`tasteEngine`、`taste/evolution`、`ai/tasteProfile`、`graph`）不动**，只替换「数据从哪里来、写到哪里去」。

---

## 4. 数据流

### 4.1 启动（已登录）

1. `getSession()` 恢复会话（supabase-js 自行持久化，PKCE）。
2. 立即读取 `fbf.cache.v1.<uid>` 渲染（接近原来的秒开体验）。
3. 并行拉取 6 类数据：`watch_notes`（未删除 + 墓碑）、`user_films`、`note_analyses`、`taste_profiles`、`taste_snapshots`、`taste_events` + 反馈。
4. 用全量结果覆盖缓存；`AppStore` 收到 `hydrate` 动作（已有 reducer 分支可复用）。
5. 若 `taste_profiles` 为空而笔记非空：本地重算并写回（写入失败不阻塞界面）。

### 4.2 写入（新增/编辑/删除）

```
用户操作
  → reducer 乐观更新（界面立即响应）
  → 写本地缓存（同步，失败不阻塞）
  → 入队 mutation {table, op, payload, baseRevision, deviceId, enqueuedAt}
  → flush：
       成功 → 记录 server revision / updated_at，移出队列
       网络失败 → 保留队列，指数退避（1s, 2s, 4s…，上限 60s），界面标记「待同步」
       校验失败（RLS/约束）→ 移出队列，提示用户，保留本地副本
```

界面必须展示三种状态：`已保存`（云端确认）、`保存中`、`待同步（网络恢复后重试）`。这不是装饰：审计指出当前实现完全没有保存反馈。

### 4.3 冲突

- 笔记表带 `revision int`，更新时 `.eq('revision', baseRevision)`。
- 影响 0 行且记录仍存在 → 说明另一台设备已更新：
  - 以服务端为准刷新；
  - 把本次本地编辑另存为 `conflict_copy`（同一条笔记的副本，标题后缀「（冲突副本）」）并提示；
  - 不静默覆盖任何一方。
- v1 不实现字段级合并。理由：单人双端同时编辑同一篇笔记的概率低，字段级 CRDT 成本远高于收益。

### 4.4 删除

- 笔记删除写 `deleted_at = now()`（墓碑），并在列表查询中排除。
- 其他设备拉到墓碑后本地移除。
- 墓碑保留 30 天，由后续定时任务（Supabase Cron / 手动 SQL）清理。
- 「删除我的全部数据」是硬删除（见 §6.4）。

---

## 5. 认证设计（摘要）

完整说明见 `docs/AUTHENTICATION-AND-SECURITY.md`。

- Supabase Auth 邮箱 + 密码；密码永不出现在我们的代码、日志或数据库表里。
- 邮箱验证：Supabase 控制台开启，注册后提示查收；未验证账号的写入限制由 Auth 配置决定，实际行为必须写进测试报告。
- 会话：`persistSession` + `autoRefreshToken`；刷新页面由 `getSession()` 恢复。
- 回调地址白名单：`https://<user>.github.io/frame-by-frame/**`、`http://localhost:5173/**`。
- 忘记密码：`resetPasswordForEmail(email, { redirectTo })`；重置页用 `updateUser({ password })`。
- 退出：`signOut()` → 清理该 uid 的缓存与队列 → 回到 `/welcome`；**不删除** `fbf.state.v1` 迁移备份。

---

## 6. 安全边界

1. **前端只有 anon/publishable key**：本来就可公开；权限由 RLS 决定。
2. **service_role 只出现在**：Supabase 控制台、需要时的一次性脚本（本机 `.env.local`，gitignore）、后续 Edge Function 环境变量。永不进前端 bundle、永不进聊天。
3. **RLS 默认拒绝**：`revoke all on ... from anon`；`authenticated` 也只能命中 `auth.uid() = user_id`。
4. **不加「便利后门」**：不做 `using (true)`，不做「前端过滤代替 RLS」。
5. **邮箱列只读**：`profiles.email` 由触发器固定，客户端无该列的 UPDATE 权限。
6. **日志**：前端不 `console.log` 笔记正文、token、邮箱；错误上报只带错误码与表名。
7. **AI 数据范围不变**：当前笔记（≤3200 字）+ ≤8 条相关历史摘要；不发送邮箱、不发送全库、不发送其他用户数据。

---

## 7. 关键决策（详见 `docs/ARCHITECTURE-DECISIONS.md`）

| 编号 | 决策 | 理由 |
|---|---|---|
| ADR-001 | Supabase 作为唯一持久化事实来源 | 静态托管下最少运维、自带 Auth/RLS/Postgres |
| ADR-002 | 保留 GitHub Pages + 纯前端 supabase-js | 现有部署不变，比赛演示链接不变 |
| ADR-003 | 不做自建 API 层（v1） | 单人数据、表级权限可覆盖；减少一层可失败组件 |
| ADR-004 | 本地缓存 + 写队列，而非直连全量读写 | 弱网可用、首屏快；缓存可随时重建 |
| ADR-005 | 笔记软删除 + revision 乐观并发 | 跨设备删除可见、冲突不静默丢失 |
| ADR-006 | v1 不接 Realtime | 需求是「重新加载能看到」，重新拉取足够；避免多余复杂度 |
| ADR-007 | 示例数据默认不迁移 | 防止演示记录污染真实画像 |
| ADR-008 | AI 网关保持不变 | 已通过校验与测试，替换风险高、收益低 |

---

## 8. 失败模式与处理

| 场景 | 表现 | 处理 |
|---|---|---|
| 未配置 Supabase 环境变量 | 构建可通过，运行时无 client | 显示明确配置提示；不静默回退到「假登录」 |
| 登录后拉取失败 | 有缓存则用缓存 + 顶部提示；无缓存则错误页 + 重试 | 不让用户误以为数据为空 |
| 写队列长期失败 | 记录标记「待同步」 | 账号页显示待同步数量，提供「立即重试」与「导出本地副本」 |
| 令牌过期 | supabase-js 自动刷新；刷新失败要求重新登录 | 未保存的队列保留在本地，重新登录后继续 flush |
| 多人共用一台设备 | 退出后缓存被清理 | 切换账号不会看到上一个账号的数据 |
| 用户清理浏览器数据 | 云端数据仍在 | 重新登录即恢复；这正是本次升级的核心价值 |

---

## 9. 部署与环境

### 前端环境变量（构建期，公开值）

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable / anon key>
VITE_AI_API_BASE=https://frame-by-frame-ai.<account>.workers.dev
```

- 本地：`.env.local`（已在 `.gitignore` 的 `.env.*` 覆盖范围内）。
- CI：GitHub Actions repository secrets / variables，构建时注入。
- **禁止**任何 `SUPABASE_SERVICE_ROLE_KEY`、`DEEPSEEK_API_KEY` 以 `VITE_` 前缀出现。

### Supabase 控制台配置

1. Authentication → Providers → Email：开启；建议开启「Confirm email」。
2. Authentication → URL Configuration：Site URL + Redirect URLs 允许 GitHub Pages 与 localhost。
3. Authentication → Policies：密码最小长度 ≥ 8。
4. Database → 执行 `supabase/migrations/0001_schema.sql`、`0002_rls.sql`。
5. Storage（可选）：创建 `avatars` bucket 并执行 bucket 策略（含在 0002）。

---

## 10. 实施阶段与验收门槛

| 阶段 | 内容 | 通过标准 |
|---|---|---|
| P3 环境 | 创建项目、执行 SQL、配置回调、写 `.env.local` | `pg_policies` 能看到 52 条策略；注册能收到邮件 |
| P4a 认证 | 四个认证页 + 会话 + 退出 + 路由守卫 | 注册/登录/错误密码/刷新恢复/退出全部实测 |
| P4b 数据 | repositories + 缓存 + 队列 + 账号页 | 新建/编辑/删除笔记云端可见；断网重试成功 |
| P4c 迁移 | 本机 `fbf.state.v1` 导入 + 备份 + 去重 | 导入前后条数/字段/关联一致；旧 key 保留 |
| P4d 隔离 | 双账号 RLS 实测 | A 无法读/写/改/删 B 的任何行（SQL 与 UI 双重验证） |
| P5 验收 | 跨设备、断网、并发、AI 回归 | `SUPABASE-TEST-REPORT.md` 全部 PASS 或列出失败原因 |
| P6 材料 | 说明书 / PPT / 演示脚本 | 只写已实测的能力 |

> 当前进度：P1（审计）与 P2（设计）完成；P3 需要你在 Supabase 控制台创建项目，并把 URL 与 anon key 写入本机 `.env.local`（不需要发到聊天）。

---

## 11. 对比赛材料的直接影响（待 P5 后落笔）

可写入说明书与 PPT 的**已实现**内容，必须等对应测试通过后再写：

- 架构图：浏览器（React）→ Supabase（Auth/Postgres/RLS）→ AI 网关（DeepSeek）。
- 多用户场景：两名同学各自注册，片库与画像互不可见。
- 跨设备演示：电脑写一条笔记 → 手机登录 → 重新加载可见。
- 隐私设计：RLS + 前端只用 anon key + 私人影评默认不可见。
- 不能写：Realtime、离线冲突自动合并、账号硬删除（若未实现 Edge Function）。

---

## 12. 未解决 / 待确认

1. Supabase 项目的实际区域、套餐与邮箱发送额度（免费额度有速率限制，需实测）。
2. 邮箱验证开启后，比赛现场演示是否需要临时关闭（建议保留，演示用已注册账号）。
3. GitHub Pages 的 origin 是否固定；若更换仓库名/base，回调地址需同步更新。
4. 账号硬删除（`auth.users`）需要 service_role 的 Edge Function，属于 P4 可选项，未完成前不得在材料中宣称。
