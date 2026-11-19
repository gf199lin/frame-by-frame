# AUTHENTICATION-AND-SECURITY

> 版本：v1（阶段 2 设计稿）
> 日期：2026-11-19
> 状态：**设计 + 待执行清单**。以下所有「已验证」字样只应出现在真实测试之后；本文不预设测试结果。

---

## 1. 信任边界

```
用户浏览器 ──(anon key + 用户 JWT)──> Supabase Auth / PostgREST / Storage
     │
     └──(笔记正文，用户显式授权后)──> DeepSeek 分析网关（无状态，不落库）
```

- 浏览器是**不可信客户端**：任何人都能改前端代码、伪造请求。因此权限只能由 Postgres + RLS 执行。
- 前端密钥只有 anon/publishable key。它被设计为可公开，安全性来自 RLS，而不是「藏起来」。
- `service_role` key 能绕过 RLS，**任何情况下都不得进入前端 bundle、仓库、日志或聊天窗口**。
- DeepSeek 网关不接收邮箱、密码、JWT 或整库数据，只接收当前这一篇笔记与有限历史。

---

## 2. 认证流程

| 流程 | 实现 | 关键配置 |
|---|---|---|
| 邮箱注册 | `supabase.auth.signUp({ email, password, options: { data: { display_name } } })` | 控制台开启 Email Provider；建议开启 Confirm email |
| 邮箱登录 | `signInWithPassword` | 密码 ≥ 8 位（控制台设置） |
| 登录态保持 | `persistSession: true` + `autoRefreshToken: true` | supabase-js 存于浏览器 storage |
| 刷新恢复 | 启动时 `getSession()`；`onAuthStateChange` 同步 | 不在 React state 里「假装登录」 |
| 退出 | `signOut()` → 清当前 uid 缓存与队列 → `/welcome` | 不删除迁移备份 `fbf.state.v1` |
| 忘记密码 | `resetPasswordForEmail(email, { redirectTo })` | Redirect URL 白名单 |
| 重置密码 | 回调页 `updateUser({ password })` | 一次性链接，过期需重发 |
| 邮箱验证 | 注册后提示查收；验证回调落到 `/auth/callback` | 是否强制验证由控制台决定，需在测试报告写明 |
| 资料管理 | `profiles` 表 upsert（昵称、头像、AI 授权） | RLS 仅本人 |

### 2.1 注册后的第一屏（避免空白页）

按顾问建议，注册成功不直接丢进空片库：

1. 欢迎卡：一句话说明「这里保存的是你自己的电影记忆」。
2. 两个动作：`添加第一部电影`、`先导入我在这台设备上的旧记录`（仅当检测到 `fbf.state.v1` 且有 `source === 'user'` 记录时出现）。
3. 可跳过；跳过不阻塞，后续在账号页仍可导入。

### 2.2 页面路由

| 路径 | 访问条件 |
|---|---|
| `/welcome`、`/auth/sign-in`、`/auth/sign-up`、`/auth/forgot`、`/auth/reset` | 未登录可访问；已登录访问则跳回 `/` |
| `/`、`/film/:id`、`/add`、`/memory`、`/profile`、`/reflection`、`/settings` | 需登录（`AuthGate`） |
| `/account` | 需登录 |

> `AuthGate` 只负责体验；真正的数据安全仍由 RLS 保证。

---

## 3. 密钥与配置

### 3.1 前端环境变量（公开）

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable/anon key>
```

- 本地放 `.env.local`（已在 `.gitignore`）；CI 用 GitHub Actions secrets。
- 缺失时：启动页显示「未配置云端」并提供配置说明，**不伪造登录成功**。

### 3.2 绝不出现在前端的值

- `SUPABASE_SERVICE_ROLE_KEY`
- `DEEPSEEK_API_KEY`（仅 Cloudflare Worker / 阿里云函数环境变量）
- 数据库连接串、JWT secret

### 3.3 Supabase 控制台清单

1. **Authentication → Providers → Email**：启用；Confirm email 建议开启。
2. **Authentication → URL Configuration**：
   - Site URL：`https://<user>.github.io/frame-by-frame/`
   - Redirect URLs：`http://localhost:5173/**`、`https://<user>.github.io/frame-by-frame/**`
3. **Authentication → Policies**：密码最短 8 位；可开启「防止邮箱枚举」（统一返回提示）。
4. **Database → SQL Editor**：执行 `0001_schema.sql`、`0002_rls.sql`。
5. **Storage**：`avatars` bucket（可选），策略见 0002 第 15 节。
6. **Auth → Rate limits**：免费套餐有邮件发送频率限制，演示前先实测。

---

## 4. RLS：为什么这样就够

- 每条策略都写成 `auth.uid() = user_id`，不存在「前端传 user_id 就信」的路径。
- `insert` 用 `with check`：即使请求体伪造 `user_id` 为他人，也会被拒绝。
- `profiles.email` 额外加固：INSERT 时由触发器固定为 `auth.users.email`；客户端只有列级 `UPDATE` 权限，不含 `email`。
- `update` 同时有 `using` 与 `with check`：既不能改别人的行，也不能把自己的行改成别人的。
- `anon` 对所有表 `revoke all`：未登录请求即使绕过界面，也拿不到任何行。
- 前端不做「按 user_id 过滤后展示」这种假隔离；查询可以不带过滤，数据库只返回本人数据。

**已知边界**：RLS 防的是「跨用户越权」，不防「同一用户在自己的设备上导出自己的数据」——后者是产品功能，不是漏洞。

---

## 5. 隐私设计

| 项 | 现状/设计 |
|---|---|
| 影评可见性 | 默认仅本人；无公开页、无分享链接 |
| 用户间隔离 | RLS + 无跨用户查询入口 |
| 收集范围 | 仅邮箱（Auth）、昵称、头像、电影记录、笔记、画像与反馈 |
| 不收集 | 真实姓名、学号、手机号、定位、通讯录、设备指纹 |
| 日志 | 不打印密码、token、邮箱、笔记正文；错误只记录表名与错误码 |
| AI 数据范围 | 当前笔记（≤ 3200 字）+ ≤ 8 条相关历史（片名/年份/评分/主题/情绪/≤160 字摘要）+ 影片元数据；**不含邮箱、不含其他记录全文** |
| 第三方说明 | 产品内明示「笔记正文会在你授权后发送给第三方 AI 服务进行分析」 |
| 删除权 | 账号页「删除我的全部数据」→ `delete_my_data()`；Auth 账号注销见 §8 |
| 导出权 | 账号页可导出 JSON（含笔记、画像、快照） |

### 5.1 AI 授权的产品语义

- 默认 `allowAiNotes = false`。
- 未授权时：笔记照常本地保存，分析按钮不可用；不静默发送。
- 授权可随时撤回；撤回后不再发送新请求，已生成的分析仍属用户数据，可单独删除。
- 授权文案必须写清：发送给谁（第三方模型服务）、发送什么（本篇笔记 + 有限历史）、用于什么（生成审美分析）。

---

## 6. 威胁模型（STRIDE 简表）

| 威胁 | 场景 | 缓解 |
|---|---|---|
| 越权读取 | 用户 B 直接调 API 读 A 的笔记 | RLS `auth.uid() = user_id`；anon 无权限 |
| 越权写入 | 伪造 `user_id` 插入他人数据 | `with check` 校验；主键冲突不泄露内容 |
| 会话劫持 | XSS 窃取 JWT | 不开 `dangerouslySetInnerHTML` 渲染用户内容；依赖 Supabase 短期 JWT + 刷新令牌轮换 |
| 密钥泄露 | 误把 service_role 打进前端 | 只允许 `VITE_` 公开值；CI 检查 bundle 中不含 `service_role` |
| 暴力破解 | 撞库登录 | Supabase Auth 速率限制；密码 ≥ 8 位；可选 CAPTCHA |
| 邮箱枚举 | 通过注册/重置探测账号 | 开启统一响应；错误文案不区分「邮箱不存在」 |
| 数据残留 | 共用设备切换账号看到上一个用户 | 退出时清 `fbf.cache.v1.<uid>` 与队列；不缓存明文到其他 key |
| 第三方泄露 | AI 服务记录请求 | 最小化数据范围；产品说明如实披露 |

---

## 7. RLS 验证方法（必须实际执行）

### 7.1 双账号 UI/SDK 测试（主证据）

1. 账号 A 登录，创建 1 条笔记，记下 `id`。
2. 账号 B 登录，在控制台执行：

```js
// 期望：[]（RLS 过滤，不报错也不返回 A 的数据）
await supabase.from('watch_notes').select('*')
```

3. B 尝试插入 `user_id = A.id`：

```js
// 期望：42501 row-level security policy violation
await supabase.from('watch_notes').insert({ ...payload, user_id: A_ID })
```

4. B 尝试更新 A 的笔记：

```js
// 期望：影响 0 行；A 的数据不变
await supabase.from('watch_notes').update({ reflection: 'hacked' }).eq('id', A_NOTE_ID)
```

5. 未登录（`anon`）直接查询：期望 `permission denied` 或空结果。

### 7.2 SQL 层验证（辅助证据）

```sql
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '<user-a-uuid>', 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select count(*) as visible_rows from public.watch_notes;              -- 应等于 A 的行数
select count(*) as foreign_rows from public.watch_notes
 where user_id <> auth.uid();                                          -- 必须为 0
rollback;
```

### 7.3 记录方式

每条测试写：时间、账号、SQL/JS、实际输出、结论。截图存 `docs/assets/supabase-tests/`（阶段 5）。**没有输出就不算通过。**

---

## 8. 账号注销

| 层级 | 行为 | 状态 |
|---|---|---|
| 数据删除 | `delete_my_data()` 删除全部业务行，清空资料 | 设计完成，待执行验证 |
| 账号注销（Auth 用户） | Edge Function + `service_role` → `auth.admin.deleteUser()` | **未实现**，不得在材料中宣称 |
| 本地残留 | 清当前 uid 缓存/队列；保留迁移备份由用户自行删除 | 设计完成 |

在 Edge Function 落地前，账号页文案必须是「删除我的全部数据并退出登录」，而不是「注销账号」。

---

## 9. 安全验收清单

- [ ] 前端 bundle 中检索 `service_role`、`SUPABASE_SERVICE`、`sk-`，结果为空
- [ ] `anon` 对 12 张表全部 `revoke`，且 RLS 已启用
- [ ] 双账号读/写/改/删四类越权尝试全部被拒
- [ ] 退出后重新打开页面，不显示上一个账号的任何数据
- [ ] 密码错误提示不区分「账号不存在」
- [ ] 控制台 Network 中，AI 请求体不含邮箱、token、其他用户数据
- [ ] `delete_my_data()` 执行后，该账号所有表计数为 0
- [ ] 生产构建的 sourcemap 不包含环境变量值

> 以上勾选只能在真实执行后打勾，并同步到 `SUPABASE-TEST-REPORT.md`。
