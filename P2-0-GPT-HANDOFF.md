# Frame by Frame · P2-0 汇报（交给 GPT 评审用）

> 生成日期：2026-11-10
> 项目：Frame by Frame（个人电影记忆博物馆）
> 分支 / HEAD：`p1.1-profile-v2` / `fb42c5f`
> 性质：只读审计 + 架构设计，**未修改代码、未部署、未提交**

---

## 1. 一句话结论

**目标 B（所有访客无需安装任何本地程序、由 DeepWorks 云端 Agent 完成核心分析）在本次可验证范围内不成立。**
唯一可核对的"服务化"能力是 DeepWorks 桌面端本机 sidecar 的 `opencode serve`，它默认只监听 `127.0.0.1`、无鉴权参数，属于本机回环服务，不是公网多租户 API。

**P2-0 判定：BLOCKED（针对目标 B 实施）；调查与设计交付已完成。**

---

## 2. A–J 速答

| 编号 | 问题 | 结论 | 证据等级 |
|---|---|---|---|
| A | DeepWorks 是否具备外部云端 Agent 调用能力 | 未验证具备；仅本机 serve | 未验证 |
| B | film-curator 能否云端运行 | 未验证；当前是本地 `mode: primary` 交互 Agent | 未验证 |
| C | 三个 Skills 能否云端真执行 | 无法证明；`via` 是 Agent 自报 | 未验证 |
| D | 知识库能否被云端读取 | 未验证；当前是仓库内文件型 | 本地已证 / 云端未证 |
| E | Worker 能否官方调用 | 目前不能；无端点、无鉴权规范 | 无法实现 |
| F | 目标架构能否实现 | 条件性可实现，取决于平台开放接口 | 需平台确认 |
| G | 真实 API 流程 | 暂无，不得写成已可用 | — |
| H | 阻塞与替代路径 | 10 项阻塞，4 条路径 | — |
| I | 下一阶段改动 | 见实施路线图 P2-A / P2-B | — |
| J | 最终结论 | **BLOCKED** | — |

证据分级说明：本次**没有取得任何一条官方文档级证据**。因此所有"云端"能力只能标为"未验证"或"需平台确认"，不能写成"支持"，也不能写成"永远不支持"。

---

## 3. 五条硬证据（可核对）

### 3.1 本机 serve 无鉴权

`opencode serve --help` 输出只有 `--port`、`--hostname`（默认 `127.0.0.1`）、`--cors`，**没有任何 token / api-key / auth 参数**。它是本地无头服务，适合桌面内集成，不适合面向公网多用户。

### 3.2 Agent 是本地交互形态

`.opencode/agents/film-curator.md` 第 1–8 行：`mode: primary`、`model: dth/DeepSeek-V4.1-Flash`，工作流直接执行本地 Node 脚本并写 `outputs/p0/runs/<RUN_ID>.json`（第 37 行）。依赖仓库文件系统与 Node 运行时。

### 3.3 网站当前完全没有调用 DeepWorks

- `src/lib/ai/client.ts` L92：`POST ${VITE_AI_API_BASE}/v1/analyze`
- `wrangler.toml` L11–L12：`AI_MODEL = "deepseek-chat"`、`DEEPSEEK_BASE_URL = "https://api.deepseek.com"`

两条链路没有任何交点。

### 3.4 v2 产物会被网站整体丢弃（不是降级）

`src/lib/storage.ts` L92 要求顶层同时存在 `recordId` 与 `filmId`，否则 `return null`。而 P0 产物顶层没有这两个字段（只有 `input.film`）。

即使补齐，仍会丢：

- `direction: ambivalent`（Agent 侧）vs 网站只接受 `low/high/neutral`（`src/types.ts` L222）；
- `interpretation`（Agent 侧）vs 网站必填 `evidence`；
- `analysis.focus.*` 三段观察；
- 真实 `analyzedAt`（L160 会用当前时间兜底）。

### 3.5 现有 "skill 已执行" 的证据不成立

`film-curator.md` L29 自己写明：没有 `skill` 工具时读 `SKILL.md` 并如实写 `via: "read"`。但 P0 产物写的是 `via: "skill"`，而这是 Agent 自报字段，不是平台签名日志。**不能据此证明原生 Skill 工具调用。**

---

## 4. 需要平台书面答复的 10 个问题

1. 是否有面向第三方的 Agent 调用 API？文档链接与版本？
2. 认证方式（API Key / OAuth / 签名 / mTLS）与凭证申请流程？
3. 同步还是异步？是否支持 webhook？超时上限？能否取消？
4. 能否指定 `agent_id = film-curator`？Agent 需以何种形式存在？
5. 云端能否加载项目内 Skills（`SKILL.md` + Node 脚本）？有无 Node 运行时与文件系统？
6. 知识库是否必须迁移到平台知识中心？是否返回稳定引用 ID？
7. 并发、QPS、日调用上限、token 上限？超限行为？
8. 计费维度与价格？免费额度？能否预算告警？
9. 用户笔记是否留存、是否用于训练？是否有 DPA？是否允许嵌入公开网站？
10. 是否返回 `request_id`？能否导出调用日志与用量报表？

---

## 5. 替代路径

| 路径 | 形态 | 能否满足目标 B | 当前可实施 |
|---|---|---|---|
| A 官方云端 API | Worker → 官方 Agent API | ✅ | ❌ 待平台 |
| B 平台托管入口 | Worker → 平台生成入口 | ⚠️ 取决于入口形态 | ❓ |
| C 专有实例 | Worker → 专属网关 | ✅ | ❓ 成本高 |
| D 维持现状 | Worker → DeepSeek | ❌ | ✅ 但必须诚实标注 |

### 明确禁止的"假打通"

- 把本机 `opencode serve` 用隧道暴露公网；
- 用 GitHub Actions 跑 Agent 充当云端；
- Worker 继续调 DeepSeek 但字段写 `platform: "DeepWorks"`；
- 用脚本返回预置结果做演示；
- 让用户自填 DeepWorks Token；
- 前端直连平台。

---

## 6. 建议的对外表述（平台答复前）

> "AI 分析由通用大模型提供。DeepWorks Agent 接入正在评估中，尚未上线。"

不得表述为"由 DeepWorks 云端 Agent 驱动"。

---

## 7. 请 GPT 评审的重点

1. 这个"BLOCKED"判定是否过严？有没有被忽略的官方接入形态（如平台内应用、Marketplace、私有部署）？
2. 如果平台只提供"人机交互页面"而无 API，路径 B 是否值得做？
3. 数据契约中 `pending-note.v1` / `agent-run.v2` 是否遗漏字段？
4. P2-A（不依赖平台的契约与适配层）是否应该先做，还是等平台答复？
5. 多租户隔离方案是否有更简单的落地方式？

---

## 8. 完整文档索引

| 文档 | 内容 | 字符数 |
|---|---|---|
| `P2-0-DEEPWORKS-CLOUD-CAPABILITY-AUDIT.md` | 能力逐项核查 + 证据台账 | 12,015 |
| `P2-0-TARGET-ARCHITECTURE.md` | 目标拓扑、分层、并发、存储、安全 | 8,117 |
| `P2-0-API-CONTRACT-DRAFT.md` | 字段对照、类型冲突、降级分析、迁移 | 13,961 |
| `P2-0-IMPLEMENTATION-ROADMAP.md` | P2-A/B/C 文件级改动与测试 | 7,862 |
| `P2-0-PLATFORM-BLOCKERS.md` | 阻塞点、10 问、授权、判定 | 5,278 |

五份合计约 47,000 字符。若 GPT 上下文有限，**发本文 + `P2-0-PLATFORM-BLOCKERS.md` 即可**。
