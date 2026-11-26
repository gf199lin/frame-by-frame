# SUPABASE-IMPLEMENTATION-PLAN

> 版本：v1（阶段 2 实施计划）
> 日期：2026-11-19
> 约束：比赛截止 **2026-11-24 18:00**（见 `docs/competition-rules-2026.md`），剩余约 5 天。
> 当前进度：阶段 1（审计）、阶段 2（设计 + SQL）已完成；阶段 3 起需要你的 Supabase 项目。

---

## 1. 阶段总览

| 阶段 | 产出 | 状态 | 阻塞项 |
|---|---|---|---|
| 1 现状审查 | `CURRENT-DATA-STORAGE-AUDIT.md` | ✅ 完成 | — |
| 2 架构设计 | 架构 / Schema / 认证安全 / 迁移 / 两份 SQL | ✅ 完成 | — |
| 3 环境配置 | Supabase 项目、回调地址、`.env.local` | ⏳ 待你操作 | 需要项目 URL 与 anon key |
| 4 功能开发 | 认证、仓储层、缓存队列、迁移、账号页 | ⏸ 未开始 | 阶段 3 |
| 5 测试验收 | 14 项测试 + RLS 越权 + 跨设备 | ⏸ 未开始 | 阶段 4 |
| 6 材料更新 | 说明书、PPT、演示脚本、截图 | ⏸ 未开始 | 阶段 5 的真实结果 |

---

## 2. 阶段 3：环境配置（需要你完成）

> 不要把这些值发到聊天里。填写到本机 `.env.local` 即可。

### 2.1 创建项目

1. 打开 <https://supabase.com/dashboard>，登录。
2. `New project`：名称 `frame-by-frame`，区域选离你最近的（如 `ap-southeast-1` / `ap-northeast-1`）。
3. 设置数据库密码并**自己保存到密码管理器**（不要贴到聊天）。
4. 等待项目初始化完成（约 2 分钟）。

### 2.2 执行 SQL

1. 左侧 `SQL Editor` → `New query`。
2. 粘贴 `supabase/migrations/0001_schema.sql` 全文 → Run。
3. 新建查询，粘贴 `supabase/migrations/0002_rls.sql` 全文 → Run。
4. 若 Storage 段报权限错误：先在 `Storage` 里手动创建公开 bucket `avatars`，再只执行该段的 4 条 policy。

### 2.3 认证配置

1. `Authentication → Providers → Email`：启用。
2. `Authentication → URL Configuration`：
   - Site URL：你的 GitHub Pages 地址（含仓库路径）
   - Redirect URLs：`http://localhost:5173/**` 与 `https://<你的域名>/<base>/**`
3. `Authentication → Policies`：密码最短 8 位。
4. `Authentication → Emails`：确认验证邮件模板可用（免费额度有限，先给自己发一封测试）。

### 2.4 前端变量

在项目根目录创建 `.env.local`：

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon/publishable key>
```

- `anon key` 在 `Project Settings → API` 里；它本来就是公开值，但仍不要提交到 Git。
- **不要**把 `service_role` 填进任何 `VITE_` 变量。
- GitHub Actions 里把同名变量加到 repository secrets，构建时注入。

### 2.5 交付给开发的确认信息（只需回答「是/否」）

- 项目是否创建成功、SQL 是否无报错
- 是否开启邮箱验证
- 最终 Site URL / Redirect URL
- 是否需要头像上传（决定是否启用 Storage 段）

---

## 3. 阶段 4：开发任务拆解

### P4a 认证（预计 0.5 天）

| 任务 | 文件 | 验收 |
|---|---|---|
| Supabase client 单例 | `src/lib/supabase/client.ts` | 缺失变量时给出明确提示 |
| 会话 Provider + AuthGate | `src/auth/SessionProvider.tsx`、`src/auth/AuthGate.tsx` | 刷新后仍登录；未登录跳 `/welcome` |
| 登录 / 注册 / 忘记 / 重置四页 | `src/pages/auth/*` | 四个流程全部走通 |
| 路由接入 | `src/App.tsx` | 原有 7 条路由登录后行为不变 |
| 退出 | `src/components/layout/Shell.tsx` | 清缓存、回 `/welcome` |

视觉约束：米白 + 蓝色、杂志排版、无红色、无紫色渐变、非 Dashboard 风格、正文字号不小于 15px。

### P4b 数据层（预计 1 天）

| 任务 | 文件 | 验收 |
|---|---|---|
| 仓储模块 | `src/lib/db/{profile,films,notes,analyses,taste}.ts` | 每表 CRUD 可跑 |
| 云端 → AppState 映射 | `src/lib/sync/hydrate.ts` | 刷新后片库/画像/快照完整 |
| 本地缓存 | `src/lib/storage.ts`（新增 cache key） | 断网时仍能打开上次数据 |
| 写队列 | `src/lib/sync/queue.ts` | 断网写入 → 恢复后自动补传 |
| 保存状态 UI | 添加/编辑页、Shell | 「保存中 / 已保存 / 待同步」可见 |
| 乐观并发 | `src/lib/db/notes.ts` | 旧 revision 更新被拒 → 生成冲突副本 |
| 账号页 | `src/pages/Account.tsx` | 昵称、头像、AI 授权、导出、删除 |

### P4c 历史迁移（预计 0.5 天）

| 任务 | 文件 | 验收 |
|---|---|---|
| 结构校验 + 预览 | `src/lib/sync/migrateLocal.ts` | 显示各类条数与跳过原因 |
| 备份 key | 同上 | 生成 `fbf.state.v1.backup.<ts>` |
| 分表导入 | 同上 | 重放两次条数不变 |
| 结果报告 | 页面 + `DATA-MIGRATION-REPORT.md` | 逐表条数可核对 |
| 旧 key 保留 | 同上 | 迁移后 `fbf.state.v1` 仍存在 |

### P4d 双账号隔离（预计 0.5 天）

- 两个测试账号 A/B，覆盖读、写、改、删四类越权。
- SQL 层与 SDK 层双重验证。
- 结果进入测试报告，并附截图。

### P4e 回归（预计 0.5 天）

- 单条笔记分析（DeepSeek 链路）不变。
- 画像、演化、快照、记忆图谱、年鉴不因数据源切换而失效。
- `user_id` 从 `'anon-local'` 换成真实 uid（**先确认网关契约允许**，不允许就保持原值并记录）。

---

## 4. 阶段 5：测试计划（14 项）

| # | 用例 | 预期 | 证据 |
|---|---|---|---|
| 1 | 邮箱注册 | 创建账号 + 收到验证邮件 | 截图 + Auth 用户列表 |
| 2 | 邮箱登录 | 进入个人空间 | 截图 |
| 3 | 错误密码 | 拒绝且提示不泄露账号是否存在 | 截图 |
| 4 | 退出登录 | 会话结束、缓存清理 | 截图 + storage 检查 |
| 5 | 刷新网页 | 登录态恢复 | 截图 |
| 6 | 创建笔记 | 云端出现该行 | 表格查询截图 |
| 7 | 修改笔记 | `revision` +1、内容更新 | 前后查询对比 |
| 8 | 删除笔记 | `deleted_at` 非空、列表消失 | 查询截图 |
| 9 | 电脑创建 / 手机查看 | 手机登录后可见 | 双设备截图 |
| 10 | 两个用户 | 互相不可见（读/写/改/删） | 4 组越权结果 |
| 11 | 退出后重登 | 历史数据仍在 | 截图 |
| 12 | Taste Evolution | 快照与反馈正常 | 页面截图 |
| 13 | AI 分析 | 原有链路成功返回 | 请求/响应截图（隐去密钥） |
| 14 | RLS | 越权全部失败 | SQL + SDK 输出 |

补充：断网写入 → 恢复网络 → 自动补传；同一账号两标签页并发编辑 → 冲突副本而非静默覆盖。

**规则：没有实际输出/截图的项目，状态写 `未执行`，不得写 PASS。**

---

## 5. 时间表（现实版）

| 日期 | 计划 |
|---|---|
| 11-19 晚 | 阶段 1–2 文档与 SQL（已完成） |
| 11-20 | 你创建项目并执行 SQL；我接认证四页 + 路由守卫 |
| 11-21 | 仓储层、缓存、队列、账号页 |
| 11-22 | 历史迁移 + 双账号隔离 + 跨设备测试 |
| 11-23 | AI/演化回归；说明书与 PPT 更新；演示脚本与截图 |
| 11-24 上午 | 补测、修缺陷、冻结材料；18:00 前提交 |

风险：若 11-20 中午前拿不到 Supabase 环境，则必须砍范围——优先保「认证 + 笔记上云 + 双账号隔离」，迁移与头像上传后置。

---

## 6. 范围裁剪顺序（若时间不足）

1. 头像上传（Storage）→ 改为外链或纯色首字母。
2. 账号硬删除 Edge Function → 只做「删除全部数据」。
3. 冲突副本 UI → 保留机制，简化为提示 + 保留本地副本。
4. 离线队列 → 降级为「失败提示 + 手动重试」，但不得静默丢数据。
5. 迁移的示例数据选项 → 移除，只导入真实记录。

**不能砍**：RLS、双账号隔离、跨设备可见、旧数据备份、AI 链路回归。

---

## 7. 每阶段汇报模板（写入 CHANGELOG）

```
### <日期> 阶段 <n> — <标题>
做了什么：
为什么：
改动文件：
数据库变化：
如何测试：
测试结果（PASS / FAIL / 未执行）：
未解决问题：
对比赛材料的影响：
```

---

## 8. 需要你确认的三件事

1. Supabase 项目是否已创建、两份 SQL 是否执行成功。
2. 是否开启邮箱验证（会影响现场演示流程）。
3. 是否保留头像上传（会多一个 Storage 配置与测试项）。

确认后我从 P4a 开始写代码；在此之前不改动任何业务代码与数据。
