# CHANGELOG

本文件记录 Frame by Frame 的真实改动。规则：

- 只写已经落盘的内容；
- 未实现的功能标注「未开始」，不得提前记为完成；
- 每条包含：做了什么、为什么、涉及文件、如何验证、遗留问题。

产品版本沿用比赛提交节奏；`架构升级` 为本次 Supabase 迁移分支。

---

## [架构升级] — 2026-11-19（阶段 1–2）

### 做了什么

**阶段 1：现状审查**

- 通读持久化、状态层、领域模型、AI 调用链、分析网关与部署配置。
- 输出 `docs/CURRENT-DATA-STORAGE-AUDIT.md`：
  - 确认全部业务数据存于 `localStorage['fbf.state.v1']`（schema v3），单 key 整包 JSON；
  - 确认无数据库、无用户体系、无跨设备同步；
  - 逐类列出 17 项数据的存储位置、持久化与丢失风险；
  - 给出来源可查的代码证据与 P0/P1/P2 风险清单。

**阶段 2：架构设计**

- `docs/SUPABASE-ARCHITECTURE.md`：目标架构、模块划分、读写/冲突/删除策略、部署与环境变量、阶段验收门槛。
- `docs/DATABASE-SCHEMA.md`：12 张表、关系、索引、RLS 摘要、旧字段映射、明确不建的表。
- `docs/AUTHENTICATION-AND-SECURITY.md`：认证流程、密钥边界、隐私设计、威胁模型、RLS 验证方法、注销口径。
- `docs/DATA-MIGRATION-REPORT.md`：迁移源字段盘点、备份策略、分表导入顺序、校验 SQL、回滚方案。
- `docs/SUPABASE-IMPLEMENTATION-PLAN.md`：阶段 3–6 的任务拆解、14 项测试计划、时间表与范围裁剪顺序。
- `docs/ARCHITECTURE-DECISIONS.md`：ADR-001 ~ ADR-010 与 4 项待决事项。
- `supabase/migrations/0001_schema.sql`：12 张表、约束、索引、触发器、`delete_my_data()`。
- `supabase/migrations/0002_rls.sql`：`revoke anon`、12 张表 RLS、48 条本人策略、Storage 头像策略、验证查询。

### 为什么

- 产品要从「单机网页」升级为「多用户云端电影记忆」，必须先证明现状究竟存在哪里，避免凭经验改造。
- Supabase 接入涉及权限与数据迁移，属于不可逆决策，需要先定 Schema 与 RLS 再写代码。
- 比赛截止 11-24，文档与 SQL 先行可以让控制台配置与前端开发并行。

### 涉及文件

新增：

- `docs/CURRENT-DATA-STORAGE-AUDIT.md`
- `docs/SUPABASE-ARCHITECTURE.md`
- `docs/DATABASE-SCHEMA.md`
- `docs/AUTHENTICATION-AND-SECURITY.md`
- `docs/DATA-MIGRATION-REPORT.md`
- `docs/SUPABASE-IMPLEMENTATION-PLAN.md`
- `docs/ARCHITECTURE-DECISIONS.md`
- `supabase/migrations/0001_schema.sql`
- `supabase/migrations/0002_rls.sql`
- `CHANGELOG.md`

修改：无。**本轮没有改动任何业务代码，没有读取或删除任何用户数据。**

### 数据库变化

- 仅新增迁移文件；**尚未在任何 Supabase 项目执行**。
- 表清单：`profiles`、`user_films`、`watch_notes`、`note_analyses`、`taste_profiles`、`taste_events`、`taste_snapshots`、`taste_observation_feedback`、`agent_observations`、`taste_feedback`、`user_corrections`、`yearbook_generations`。

### 如何验证（本轮已完成）

- 文档中的代码结论逐条对照源码行号核对。
- SQL 做静态检查：语句闭合、`$$` 成对、触发器函数先定义后引用、每表 4 条策略。
- 未执行真实数据库迁移，未做运行时测试。

### 测试结果

| 项目 | 结果 |
|---|---|
| 现状审查 | 完成（静态代码审查） |
| 架构与 Schema 设计 | 完成 |
| SQL 实际执行 | **未执行**（无 Supabase 项目） |
| RLS 越权测试 | **未执行** |
| 跨设备同步测试 | **未执行** |
| AI 链路回归 | **未执行**（本轮未改 AI 代码） |

### 未解决问题

1. 需要创建 Supabase 项目并在 SQL Editor 执行两份迁移。
2. 需要确认是否开启邮箱验证、是否启用头像上传。
3. 前端认证页、仓储层、缓存队列、迁移工具尚未开始（P4）。
4. 账号硬删除（`auth.users`）需要 Edge Function，未实现。
5. AI 网关是否接受真实 uid 替代 `anon-local`，待查契约。

### 对比赛材料的影响

- 现在可以在「技术方案」中描述 Supabase 架构与 RLS 设计，但必须标注「设计完成，待接入验证」。
- **不能**在说明书或 PPT 中写「已支持多用户登录」「已实现跨设备同步」——这些要等 P5 的真实测试结果。
- 已有本地数据未被触碰，演示用现有单机版本仍可正常运行。

---

## [架构升级] — 2026-11-19 晚（阶段 3 环境接入）

### 做了什么

- 将 Supabase 项目 URL 与 publishable key 写入本机 `.env.local`（已被 `.gitignore` 忽略，未提交、未进入聊天记录以外的任何文件）。
- 验证连通性：
  - `GET /auth/v1/health` → `200`，GoTrue `v2.198.0`；
  - `GET /rest/v1/watch_notes?select=id&limit=1` → `404 PGRST205`，说明**迁移尚未执行**。
- 安装 `@supabase/supabase-js@2.118.0`（exact）。原因：npm 镜像缺少 `2.119.2` 依赖的 `@supabase/auth-js@2.119.2`，无法解析最新版。
- 新增 `src/lib/supabase/client.ts`：单例客户端、URL 规范化、缺失配置时返回明确提示；启用 `persistSession` / `autoRefreshToken` / PKCE。
- 在 `src/vite-env.d.ts` 增加 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 类型。

### 为什么

- 先打通「能连上」再写页面，避免把配置问题误判成代码问题。
- 依赖必须固定在镜像可解析的版本，否则 `npm install` 失败会阻塞后续开发。

### 涉及文件

- `.env.local`（本机，不提交）
- `package.json`、`package-lock.json`（新增依赖）
- `src/lib/supabase/client.ts`（新增）
- `src/vite-env.d.ts`（类型补充）

### 数据库变化

无。迁移未执行，数据库中没有任何表。

### 如何验证

- 上述两个 HTTP 探测（已执行）。
- `npm run typecheck`：新增客户端代码通过；仍存在一处**改动前就有**的服务端类型错误 `server/worker.deepseek.ts(21,3): 'UNAUTHORIZED' does not exist in AIErrorCode`，与本轮无关。

### 测试结果

| 项目 | 结果 |
|---|---|
| Auth 服务可达 | PASS |
| 数据库表存在 | FAIL（未迁移，符合预期） |
| 客户端模块类型检查 | PASS |
| 登录/注册 | 未执行（页面未实现） |

### 未解决问题

1. `0001_schema.sql`、`0002_rls.sql` 仍需在 Supabase SQL Editor 执行。
2. Auth Email、Site URL、Redirect URLs 尚未配置。
3. 预存的服务端 typecheck 错误需要单独处理（不属于本轮改动）。

### 对比赛材料的影响

- 可以在材料中写「已完成 Supabase 项目创建与客户端连通性验证」，但**不能**写「数据库已就绪」「已支持注册登录」。

---

## [架构升级] — 2026-11-20 凌晨（阶段 4b 笔记上云）

### 做了什么

- 新增云端仓储层：`src/lib/db/{rows,map,remote}.ts`，把 `AppState` 与 11 张表互相映射，所有 domain 转换集中在一处。
- 新增写队列：`src/lib/sync/queue.ts`，localStorage 持久化、按 key 去重、串行上传、失败保留并记录尝试次数。
- 新增差异同步：`src/lib/sync/diff.ts`，只上传变化的笔记、分析、反馈、快照、事件，不整包覆盖。
- `AppStore` 接入：登录后先补传队列，再拉取云端；云端为空时把本机数据作为账号初始化上传；之后每次本地修改自动入队。
- 顶栏新增同步状态：`保存中 / 已同步 / 待同步 N / 同步失败 · 重试`。
- 文案修正：删除“都保存在这台设备上、不会上传”的旧表述，改为“保存在你的账号里，其他账号无法读取”。

### 关键设计

- **先传后拉**：队列未清空时绝不拉取云端，避免覆盖离线新增。
- **队列项带唯一 id**：上传过程中新增的写入不会被旧数组覆盖（已修掉一个真实的竞态）。
- **分析按 note_id 先删后插**：笔记 id 变更时不会留下孤儿分析。
- **示例数据**：随账号初始化上传，`is_demo = true`；示例分析仍是 `unreviewed`，不计入审美画像。正式历史迁移（P4c）仍只迁移 `source === 'user'`。

### 验证

| 项目 | 结果 |
|---|---|
| `tsc -b` | PASS |
| `vite build` | PASS（852 KB） |
| `vitest run` | 12 文件 / 97 用例 PASS |
| 浏览器刷新后自动上传 11 条示例 | **待用户实测** |
| 新写一条笔记后云端出现该行 | **待用户实测** |
| 跨设备看到同一笔记 | **待实测** |

### 未解决问题

1. 冲突处理（T16）尚未实现：同一笔记在两个标签页同时编辑时，后者会覆盖前者，没有冲突提示。
2. `taste_profiles` 表暂未写入（画像仍由客户端从已接受分析实时计算）。
3. 删除笔记是软删，但 `resetDemo` 仍会重建示例并把旧记录软删，语义需要在 P4c 理清。

---

## [架构升级] — 2026-11-19 深夜（阶段 4a 认证）

### 做了什么

- 确认 Supabase 迁移已执行：三张抽样表（`watch_notes` / `profiles` / `taste_snapshots`）对 `anon` 均返回 `42501 permission denied`，说明表已创建且匿名角色被正确拒绝。
- 实现认证闭环：
  - `SessionProvider`：`getSession` + `onAuthStateChange`，刷新后恢复登录态；
  - `PublicOnly` / `ProtectedLayout`：未登录访问业务路由会跳转 `/welcome`，登录后回到原路径；
  - 登录、注册、忘记密码、重置密码、邮件确认五个页面；
  - `/account` 账号页：邮箱展示、昵称保存、退出登录；
  - Shell 顶栏与移动端菜单加入账号入口。
- 视觉：沿用米白 `paper` + 深蓝 `ink`、衬线大标题、细线框与「电影年刊」版式；无红色、无紫色渐变、非 Dashboard 布局；正文不小于 14px。
- 本地数据按账号隔离：
  - 新 key `fbf.state.v1.u.<userId>`；
  - 旧 `fbf.state.v1` 保留不动，首次登录时由第一个账号一次性「认领」复制（标记 `fbf.state.v1.claimedBy`），后续账号不会读到；
  - `resetDemo` 只清理当前账号的 key，不动旧数据。
- 明确暂缓「删除我的全部数据」入口：云端删除函数已存在，但笔记尚未上云，现在开放会造成「删了但本机还有」的假象。

### 为什么

- 先让身份与会话可靠，再迁移数据；否则无法判断写入失败是权限、网络还是数据模型问题。
- 同一台电脑换账号必须看不到上一个人的记录，这是隐私底线，不能等数据上云后再补。

### 涉及文件

新增：`src/auth/session.tsx`、`src/lib/supabase/auth.ts`、`src/pages/auth/{AuthShell,SignIn,SignUp,ForgotPassword,ResetPassword,AuthCallback}.tsx`、`src/pages/Account.tsx`
修改：`src/App.tsx`（路由与守卫）、`src/components/layout/Shell.tsx`（账号入口）、`src/lib/storage.ts`（按账号作用域 + 旧数据认领）、`src/vite-env.d.ts`、`package.json` / `package-lock.json`

### 数据库变化

无新增表。已确认 `0001` / `0002` 在真实项目执行，`anon` 无表权限。

### 如何验证（真实执行）

| 项目 | 结果 |
|---|---|
| `tsc -b` | PASS |
| `vite build` | PASS（产物 834 KB，主要来自 supabase-js） |
| `vitest run`（12 文件 / 97 用例） | 全部 PASS |
| Auth 健康检查 | PASS（200，GoTrue v2.198.0） |
| 匿名读取业务表 | PASS（401 / 42501，符合预期） |
| 错误密码登录探测（SDK） | PASS（400 `invalid_credentials`，与预期一致） |
| 浏览器内注册 / 登录 / 刷新 / 退出 | **未执行**（需人工在 `npm run dev` 中验证） |

### 未解决问题

1. 笔记仍写在本机作用域 key，尚未写入 `watch_notes`；跨设备同步尚不成立。
2. 邮箱确认与重置链接依赖 Supabase Redirect URLs 配置，需在控制台加入 `http://localhost:5173/**` 与 Pages 地址。
3. `npm run typecheck` 仍有一处改动前就存在的服务端类型错误（`server/worker.deepseek.ts:21`，`UNAUTHORIZED` 不在 `AIErrorCode` 中）。
4. 新账号仍会看到 10 条示例电影（种子数据），需在 P4b 用云端数据替换。

### 对比赛材料的影响

- 可以写「已实现邮箱注册 / 登录 / 会话保持 / 密码重置界面，并通过构建与单元测试」。
- **不能**写「已实现跨设备同步」「多用户数据已隔离」——笔记尚未上云，RLS 双账号实测也还没做。

---

## 模板（后续阶段使用）

```
## [架构升级] — YYYY-MM-DD（阶段 n）

### 做了什么
### 为什么
### 涉及文件
### 数据库变化
### 如何测试
### 测试结果（PASS / FAIL / 未执行）
### 未解决问题
### 对比赛材料的影响
```
