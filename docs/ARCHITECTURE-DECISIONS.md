# ARCHITECTURE-DECISIONS

> 记录 Frame by Frame 从「单机网页」升级为「多用户云端产品」过程中的不可逆决策。
> 只写已经做出、且会影响后续代码与材料的决定；未执行的实现不在此声称完成。
> 格式：Context / Decision / Consequences / Alternatives rejected / Status。

---

## ADR-001：Supabase 作为唯一持久化事实来源

**Context**
现状是单个 localStorage key 承载全部数据（见 `CURRENT-DATA-STORAGE-AUDIT.md`）。产品目标要求多用户、数据隔离、跨设备同步。自建后端意味着服务器、数据库、备份、鉴权全部自己维护，比赛周期内不现实。

**Decision**
Supabase 承担 Postgres、Auth、Storage；所有核心业务数据以云端为准，浏览器只做缓存。

**Consequences**
- 正向：无需运维服务器；RLS 提供数据库级隔离；SQL 可版本化。
- 负向：依赖第三方可用性与免费额度；国内访问速度需实测；邮箱发送有速率限制。
- 约束：前端只允许 anon key；任何绕过 RLS 的需求都必须重新评审。

**Alternatives rejected**
- Firebase：文档型模型不适合「关系 + 唯一约束 + RLS」这类需求，且迁移现有 ID 更麻烦。
- 自建 Node + Postgres：开发与运维成本超出剩余时间。
- 仅用 Cloudflare KV/D1：鉴权与 RLS 需自建，风险更高。

**Status** Accepted（设计层）。运行时接入待阶段 3。

---

## ADR-002：保留 GitHub Pages 静态托管与纯前端 supabase-js

**Context**
现有部署是 GitHub Pages + SPA 404 回退（`.github/workflows/deploy.yml`），比赛演示链接已对外。

**Decision**
不引入 SSR / 自建服务，前端直接调用 Supabase（anon key + 用户 JWT）。

**Consequences**
- 演示地址不变，构建流程不变（只多两个环境变量）。
- 无法在服务端做「隐藏逻辑」；所有权限必须写在 RLS。
- SEO 不在目标内，可接受。

**Alternatives rejected**
- Next.js + Supabase SSR：需要新的托管平台与构建链，5 天内风险过高。
- 加一层 BFF：多一个可失败组件，且没有必须服务端处理的业务。

**Status** Accepted。

---

## ADR-003：v1 不自建 API 层

**Context**
单人数据、表级权限可以完整表达业务规则；现有唯一的服务端是 AI 网关。

**Decision**
前端通过 supabase-js 直连 PostgREST；除 AI 分析外不自建业务 API。

**Consequences**
- 表结构即接口，改字段需同步改前端与迁移。
- 复杂聚合在客户端完成（与现状一致）。
- 将来若出现「跨用户只读」需求，再引入 Edge Function。

**Status** Accepted。

---

## ADR-004：本地缓存 + 写队列，而非纯在线

**Context**
现状首屏依赖本地读取；直接改成「每次打开都等网络」会明显退化体验，弱网下不可用。

**Decision**
`fbf.cache.v1.<uid>` 保存最近一次云端快照用于首屏；写操作乐观更新 + 入队 + 后台重试。

**Consequences**
- 缓存必须可随时丢弃重建，不能成为第二事实来源。
- 队列需要处理重复提交（固定主键 + upsert）与失败可见性。
- 退出登录必须清该 uid 的缓存与队列。

**Alternatives rejected**
- 纯在线读写：弱网体验差，演示现场网络不可控。
- 继续以 localStorage 为主、云端异步备份：无法保证多设备一致，违背产品目标。

**Status** Accepted。

---

## ADR-005：笔记软删除 + revision 乐观并发

**Context**
跨设备场景下，「删除」需要能被另一台设备感知；两端同时编辑需要避免静默覆盖。

**Decision**
`watch_notes.deleted_at` 作墓碑；`revision` 每次更新自增，客户端带 `baseRevision` 更新，影响 0 行即判定冲突并保留本地副本。

**Consequences**
- 查询需过滤 `deleted_at is null`。
- 墓碑需要定期清理（30 天）。
- 冲突不自动合并，用户会看到副本；这是有意的保守选择。

**Alternatives rejected**
- 物理删除：另一台设备无法区分「被删」与「从未存在」。
- 字段级 CRDT：实现成本远高于收益。
- 时间戳 last-write-wins：会静默丢编辑。

**Status** Accepted。

---

## ADR-006：v1 不接 Realtime

**Context**
验收要求是「手机改完，电脑重新加载能看到」，并未要求同屏实时刷新。

**Decision**
不订阅 `postgres_changes`；在窗口重新获得焦点、路由切换、手动刷新时拉取最新数据。

**Consequences**
- 少一个长连接与断线重连逻辑。
- 若未来需要「两台设备同屏协作」，再按需增加，且不影响现有表结构。

**Alternatives rejected**
- 直接上 Realtime：增加复杂度与演示不确定性，收益不匹配当前需求。

**Status** Accepted，可在 P5 后重新评估。

---

## ADR-007：示例数据默认不迁移

**Context**
`createInitialState()` 含 10 条 `source: 'seed'` 的演示记录，用于首次打开时展示效果。

**Decision**
迁移默认只导入 `source === 'user'`；示例数据需用户显式勾选，并以 `is_demo = true` 标记。

**Consequences**
- 新账号的真实画像是干净的，不被演示数据污染。
- 若用户勾选导入，UI 需要能区分演示记录（后续任务）。
- 迁移报告必须列出「跳过 N 条示例记录」。

**Alternatives rejected**
- 全量导入：画像与统计会被演示数据扭曲。
- 静默丢弃：用户会以为数据丢失。

**Status** Accepted。

---

## ADR-008：AI 网关与 DeepWorks 链路保持不变

**Context**
现有 `/v1/analyze` 已有契约校验、逐字引用校验、幂等与限流；DeepWorks 侧 Agent 与 `cinema-knowledge-retrieval`、`film-note-analysis`、`cinema-taste-profiling` 已跑通。

**Decision**
Supabase 只负责身份与持久化；不替换模型、不替换网关、不改分析契约（除非仅为传递真实 uid 且经回归验证）。

**Consequences**
- `analyses` 表按现有 `AgentRunV2` 结构存储，不重新定义字段。
- 任何 AI 侧改动必须单独回归 14 项测试中的第 12、13 项。
- 服务端不保存笔记，隐私边界清晰。

**Alternatives rejected**
- 把 AI 调用搬到 Edge Function：需要迁移密钥与重写校验，风险高、收益低。

**Status** Accepted。

---

## ADR-009：沿用客户端字符串主键

**Context**
现有 id 形如 `rec_m1a2b3c4d5`、`snap_...`、`fb_...`，由 `uid()` 生成；迁移需要幂等。

**Decision**
云端主键直接使用这些字符串；`watch_notes.id` 加格式约束 `^rec_[A-Za-z0-9_-]{2,80}$`。

**Consequences**
- 重复导入 `on conflict` 即幂等，不需要维护映射表。
- 理论上存在跨用户主键碰撞的极端可能（仅导致该用户插入失败，不泄露数据）；格式约束降低了概率。
- 将来若要改 UUID，需要一次数据迁移，成本可控。

**Alternatives rejected**
- 全部改 UUID + `legacy_id` 映射：多一列、多一层转换，收益不足。
- 复合主键 `(user_id, id)`：子表外键变复杂，且现有 id 已足够唯一。

**Status** Accepted。

---

## ADR-010：邮箱只作为身份，不进入业务表和 AI 请求

**Context**
隐私要求：不收集无关信息、不把私人数据发给第三方。

**Decision**
邮箱只以 `profiles.email` 这一列作为 Auth 的只读镜像存在；笔记、分析、快照、反馈均不存邮箱；AI 请求体不含邮箱、token、其他用户数据。

**Consequences**
- 邮箱只有一处副本，且有触发器与 `auth.users.email` 对齐。
- 导出数据时，业务内容不含邮箱，账号信息从会话读取。
- 若将来做邮件通知，需单独评审并更新隐私说明。

**Status** Accepted。

---

## 待决事项

| 编号 | 问题 | 需要的输入 |
|---|---|---|
| OPEN-1 | 是否开启邮箱验证（影响现场演示） | 你的决定 |
| OPEN-2 | 是否启用头像上传（Storage） | 你的决定 |
| OPEN-3 | 账号硬删除是否做 Edge Function | 时间允许时决定 |
| OPEN-4 | AI 网关是否接受真实 uid 替代 `anon-local` | 需查网关契约 + 回归 |
