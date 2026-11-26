# P2-0 · DeepWorks 云端 Agent 接入能力审计

> 审计日期：2026-11-10
> 审计对象：`C:\Users\BayMax\Desktop\frame by frame`
> 分支 / HEAD：`p1.1-profile-v2` / `fb42c5f`
> 审计性质：**只读调查**。未修改网站代码、Agent、Skills、知识库，未部署，未提交 Git，未执行 `reset / clean / restore / stash`。
> 证据基线：`outputs/p2/_work/git-baseline.txt`

---

## 0. 结论速览

### 0.1 一句话

**目标 B（所有访客无需安装任何本地程序、由 DeepWorks 云端 Agent 完成核心分析）在本次可验证范围内无法成立**：能核对的只有 DeepWorks 桌面端本机 sidecar 的 `serve` 能力，没有任何可核对的官方公网 Agent API、鉴权方式、任务队列或多租户证据。因此 P2-0 对"目标 B 实施"的判定是 **BLOCKED**；对"调查与设计交付"的判定是 **完成**。

### 0.2 A–J 速答

| 编号 | 问题 | 结论 | 证据等级 |
|---|---|---|---|
| A | 当前 DeepWorks 是否具备外部云端 Agent 调用能力？ | **未验证具备**。仅验证到本机 `opencode serve`（默认 `127.0.0.1`），不等于云端托管 API | E3 |
| B | `film-curator` 是否能在云端运行？ | **未验证**。它是本地 workspace 的 Agent 定义文件，运行依赖本机 sidecar | E3 |
| C | 三个 Skills 是否能在云端真正执行？ | **未验证**。Skill 是文件 + Node 脚本；P0 记录的 `via` 无法证明原生 `skill` 工具调用 | E3 |
| D | 知识库能否被云端 Agent 读取？ | **未验证**。当前是仓库内 `knowledge/entries.json` 文件型库，非平台知识中心 | E1（文件型）/ E3（云端） |
| E | Cloudflare Worker 能否通过官方接口调用？ | **目前不能**。无可核对的官方端点、鉴权与请求格式 | E5 |
| F | 目标架构是否可以实现？ | **条件性可实现**：平台开放官方云端 Agent 执行接口后可实现；当前不可 | E4 |
| G | 真实 API 调用流程 | **暂无**。只能给出"待平台确认后的目标流程"，不得写成已可用 | — |
| H | 阻塞点与替代路径 | 见 `P2-0-PLATFORM-BLOCKERS.md` | — |
| I | 下一阶段改动文件 | 见 `P2-0-IMPLEMENTATION-ROADMAP.md` | — |
| J | P2-0 最终结论 | **BLOCKED**（目标 B 实施）；调查交付完成 | — |

### 0.3 证据分级定义

| 等级 | 含义 | 本报告中的使用 |
|---|---|---|
| **E1** | 本次通过真实命令输出或真实文件内容核对 | 可直接引用行号 |
| **E2** | 官方文档明确支持 | **本次 0 条**：未取得任何可核对的 DeepWorks 官方云端接入文档 |
| **E3** | 当前账号尚未验证 | 不能写成"支持"，也不能写成"不支持" |
| **E4** | 需平台工作人员确认 | 涉及商务、配额、授权、部署形态 |
| **E5** | 目前无法实现 | 在现有可验证能力下无法成立 |

> 本报告严格区分上述等级。**"没找到证据"不等于"平台永远不支持"**；它只意味着不能作为已具备能力写进架构前提。

---

## 1. 审查边界与方法

### 1.1 实际读取

- Agent / Skills：`.opencode/agents/film-curator.md`、三个 `SKILL.md` 与脚本、`workflow/*.mjs`、`knowledge/entries.json`。
- 网站调用链：`src/lib/ai/client.ts`、`src/lib/ai/types.ts`、`src/lib/ai/validate.ts`、`src/lib/storage.ts`、`src/types.ts`。
- 服务端：`server/app.ts`、`server/core/contract.ts`、`server/core/rateLimit.ts`、`wrangler.toml`、`.env.example`。
- 历史产物：`outputs/p0/runs/fbf-p0-20261109-0{1,2,3}.json` 及其校验记录、`outputs/p1/_work/v2-run.json`、`outputs/p1/_work/schema-v2-example.json`、`outputs/p1/P1.1.1-IMPLEMENTATION-REPORT.md`。

### 1.2 实际执行（只读）

```powershell
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git log --oneline -10
git status --porcelain=v1
& "$env:LOCALAPPDATA\Programs\DeepWorks\resources\sidecars\opencode-x86_64-pc-windows-msvc.exe" --help
& "...\opencode-x86_64-pc-windows-msvc.exe" serve --help
node -e "<读取 P0 运行 JSON 顶层字段>"
```

### 1.3 明确没有做

- **没有**访问 DeepWorks 知识中心、主界面或任何平台管理页。
- **没有**探测任何未公开端点，**没有**猜测 API 地址、参数名或鉴权头。
- **没有**启动 `opencode serve` 常驻实例，因此未验证其 HTTP 路由、鉴权、CORS 实际行为。
- **没有**调用 Cloudflare、阿里云或 DeepSeek 的生产接口。
- **没有**在本轮重跑 `film-curator` 会话，因此不能新增"原生 skill 工具调用"的证据。

---

## 2. 工作区基线（只读记录）

| 项 | 值 |
|---|---|
| 分支 | `p1.1-profile-v2` |
| HEAD | `fb42c5fe18e81ffa0e0c640732b2571a12197d09`（`style(add-flow): strengthen the custom feeling input affordance`） |
| 已跟踪修改 | 7 个：`.opencode/agents/deepworks.md`、`.opencode/deepworks.json`、`README.md`、`opencode.jsonc`、`opencode.jsonc.last-good`、`package-lock.json`、`package.json` |
| 未跟踪（与本任务相关的关键项） | `.opencode/agents/film-curator.md`、`.opencode/lib/`、三个项目 Skill 目录、`knowledge/`、`workflow/`、`server/cloudfn*.ts`、`scripts/*cloudfn*` |
| 删除 | 无 |
| 结论 | 工作区**不干净**，存在 P1.1.1 与并行前端改动；本轮全部原样保留 |

完整快照见 `outputs/p2/_work/git-baseline.txt`。

> 重要：`film-curator` 与三个 Skill **尚未提交**。这意味着任何"云端部署"都不能假设仓库里已有可部署版本，P2 必须先解决版本固化问题。

---

## 3. 3.1 云端 Agent 部署逐项核查

### 3.1.1 当前账号是否支持 Agent 发布、部署或远程运行？

**结论：未验证（E3）。**

可核对的只有本机 sidecar 的 CLI 命令表。`opencode --help` 输出包含：

```
opencode serve    starts a headless opencode server
opencode attach <url>  attach to a running opencode server
opencode web      start opencode server and open web interface
```

这些命令证明**本机可以启动一个无头服务并被本机客户端连接**，但它们由本地可执行文件提供，不能证明平台存在"发布 Agent 到云端并对外提供地址"的产品能力。

**不能由此推出的结论**（明确禁止写入方案）：

- 不能推出存在 `https://api.deepworks.example/...` 之类的公网端点；
- 不能推出 `serve` 具备鉴权、计量、多租户隔离；
- 不能推出 `attach <url>` 可跨公网使用。

### 3.1.2 `film-curator` 是否可以部署到云端？

**结论：未验证（E3）；当前形态是本地 workspace Agent（E1）。**

证据：`.opencode/agents/film-curator.md` 第 1–8 行：

```yaml
description: Frame by Frame Film Curator — ...
mode: primary
model: dth/DeepSeek-V4.1-Flash
temperature: 0.2
permission:
  question: allow
```

- `mode: primary` 表示它是**交互式主 Agent**，不是可被远程调用的服务型 Agent。
- 文件内工作流要求执行本地 Node 脚本（`workflow/hash-note.mjs`、`.opencode/skills/**/scripts/*.mjs`），这依赖能访问该仓库工作目录的执行环境。
- Agent 文件未跟踪（untracked），没有版本化发布记录。

因此：**即使平台提供云端执行环境，"能否运行"也取决于该环境是否挂载本仓库文件与 Node 运行时**。这两点均未验证（E4）。

### 3.1.3 是否存在供第三方网站调用的官方 Agent API？

**结论：未找到可核对的官方文档或端点（E3 → 按 E5 处理实施）。**

本次审查在仓库内未发现任何指向 DeepWorks 官方 API 的配置、SDK 或文档引用。`wrangler.toml` 中的上游只有 `DEEPSEEK_BASE_URL = "https://api.deepseek.com"`（第 12 行），这与 DeepWorks 无关。

**待平台确认的具体问题**（应原样提交给平台）：

1. 是否有面向第三方的 Agent 调用 API（HTTP/WebSocket/gRPC）？
2. 是否公开发布 OpenAPI / JSON Schema？
3. 是否支持按 `agent_id` 指定 Agent？
4. 是否支持指定模型或由平台托管模型？
5. 是否支持传入文件（Skill 目录、知识库）或仅支持纯文本 prompt？

### 3.1.4 是否支持 Webhook、远程任务或其他官方调用机制？

**结论：未验证（E3）。**

本机 CLI 有 `opencode run [message..]`（单次执行）与 `serve`（无头服务），但：

- `run` 是**本机进程**执行，不是远程任务；
- 没有观察到任务 ID、状态查询、回调注册相关命令；
- `session` 子命令存在（`opencode session manage sessions`），但属于本地会话管理，不等于对外任务 API。

### 3.1.5 能否通过官方授权机制让 Cloudflare Worker 调用 Agent？

**结论：目前不能（E5），需平台开放（E4）。**

Worker 运行在 Cloudflare 边缘，没有本机文件系统、没有 DeepWorks 安装、没有 `opencode` 二进制。要让它调用 DeepWorks，必须存在一个**公网可达、带服务端鉴权**的官方端点。本次未取得该端点的任何证据。

**明确排除的错误做法**（本轮及后续都禁止）：

- 在 Worker 中内置或转发 DeepWorks 用户令牌；
- 把本机 `opencode serve` 通过隧道暴露到公网；
- 用脚本模拟"云端 API"并对外宣称是 DeepWorks 官方接口。

### 3.1.6 是否支持异步任务、任务 ID、状态查询和结果回调？

**结论：未验证（E3）。**

现有 P0 产物有 `run_id` 与 `timestamp`，但那是**本地脚本生成的业务标识**，不是平台任务 ID。P0 运行是同步的：Agent 在一个会话内顺序执行 7 步，最后写文件。没有排队、状态机、重试或回调。

目标架构需要的异步语义（`queued/running/succeeded/failed`、幂等、超时、重试）**必须由平台提供或由网关自建**。当前两者都没有可核对实现。

### 3.1.7 是否支持并发调用和多用户场景？

**结论：未验证（E3）；现有设计是单用户本地工具（E1）。**

证据：

- `knowledge/entries.json` 是单文件库，无租户字段；
- `outputs/p0/runs/` 是本地目录，靠文件名区分 run；
- Agent 工作流直接读写工作区文件（`--out outputs/p0/runs/<RUN_ID>.json`），多用户并发会互相覆盖同名文件；
- 没有用户身份、配额、隔离层。

因此即使平台能执行，**当前 Agent 形态也不具备多租户安全性**，必须先改造成"无共享可变文件 + 每次运行独立沙箱/独立输出"。

### 3.1.8 是否有 API 配额、调用费用、限流和权限限制？

**结论：需平台确认（E4）。**

仓库内能核对的限流只有网站自己的 Worker：

- `server/core/contract.ts` L154–L159：`12 次/分钟`、`80 次/天`；
- `server/core/rateLimit.ts` L9–L15：注释明确说明这是**内存滑动窗口**，"生产多区域部署应改用 KV 或 Durable Object"。

这两个限制**只约束网站 Worker**，与 DeepWorks 平台配额无关。平台的并发上限、单次 token 上限、计费方式、是否允许商用/对外提供服务，全部需要书面确认。

---

## 4. 3.2 Skills 与知识库逐项核查

### 4.1 三个项目 Skills 能否在云端 Agent 环境中使用？

**结论：未验证（E3）；本地可执行（E1）。**

三个 Skill 的形态是"`SKILL.md` + `scripts/*.mjs`"：

| Skill | 入口 | 依赖 |
|---|---|---|
| `cinema-knowledge-retrieval` | `.opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs` | Node、`knowledge/entries.json` |
| `film-note-analysis` | `.opencode/skills/film-note-analysis/scripts/validate-evidence.mjs` | Node、输入 JSON |
| `cinema-taste-profiling` | `.opencode/skills/cinema-taste-profiling/scripts/profile.mjs` | Node、证据 JSON |

它们不是平台内置能力，而是**仓库内的可执行脚本**。云端环境若不能挂载仓库与 Node，就无法运行。

### 4.2 如何证明运行时真正执行了这些 Skills？

**结论：当前证据不足以证明原生 Skill 工具调用（E1 反证）。**

- P0 产物 `skills_used[].via` 写的是 `"skill"`（见 `outputs/p0/runs/fbf-p0-20261109-01.json`）。
- 但 `film-curator.md` L29 自己写明：「优先用 `skill` 工具加载；如果当前运行没有 `skill` 工具，就读取对应的 `SKILL.md`，并在 `skills_used[].via` 中如实写 `read`」。
- 既有审查已指出：**无法从记录反推当时是否真的存在原生 `skill` 工具**。`via` 是 Agent 自报字段，不是平台签名日志。

**可接受的证明标准（P2 必须建立）**：

1. 平台侧执行日志含 `tool_call` 事件，且 `tool_name = skill`、`arguments.name = <skill>`；
2. 每次运行记录 `skill_version`（文件内容哈希）；
3. 脚本自身输出可核对的 `run_id` 与 `input_hash`，与最终产物一致；
4. 三者能对上，才算"真正执行"，否则只能写"读取了 SKILL.md 并执行了脚本"。

### 4.3 当前本地项目知识库能否被云端 Agent 读取？

**结论：未验证（E3）；当前是文件型（E1）。**

`knowledge/` 目录只有 `entries.json`、`index.json`、`SOURCES.md`、`build-index.mjs`。检索脚本读本地文件，没有网络请求、没有平台知识库 ID。

### 4.4 是否必须将知识库迁移到 DeepWorks 平台知识中心？

**结论：取决于平台执行环境（E4）。分两种情况：**

| 平台能力 | 是否需要迁移 |
|---|---|
| 云端 Agent 可挂载仓库文件系统 | 不必迁移，但必须固定 `knowledge/` 版本并做哈希 |
| 云端 Agent 只能读平台知识中心 | **必须迁移**，且需要平台提供条目 ID 映射（`KB-001` ↔ 平台 ID） |
| 平台两者都不支持 | 目标 B 不成立 |

### 4.5 云端 Agent 能否读取并使用项目级知识库？

**结论：未验证（E3）。**

「项目级知识库」是仓库概念，不是平台概念。平台是否识别 `.opencode/skills/**` 与 `knowledge/**` 作为"项目级"资源，需要平台确认。**不能把本地目录结构当成平台已支持的项目知识库。**

### 4.6 如何获得知识引用和执行日志？

**结论：目前只能拿到本地脚本产物（E1），拿不到平台级日志（E3）。**

现有可得：

- `*.retrieval.json`：检索候选与分数；
- `kb_citations[]`：`kb_id / title / source / excerpt / why_relevant`；
- `*.events.jsonl`、`*.engine.err.log`：本地引擎事件与错误日志（P0 目录中存在）。

这些是**本地文件证据**，不是平台审计日志。对外提供服务时，需要平台提供可导出的运行记录，否则无法向用户证明"引用真实、过程可追踪"。

---

## 5. 3.3 官方接口证据台账

> 规则：**没有核对到，就写"尚未验证"，不补全。**

| 候选接入方式 | 官方文档名称/链接 | 真实接口地址 | 认证方式 | 请求/响应格式 | 支持 Agent 类型 | 外部网站可调用 | 本账号权限 | 需额外申请 |
|---|---|---|---|---|---|---|---|---|
| DeepWorks 官方云端 Agent API | **未取得** | **未取得** | **未取得** | **未取得** | **未取得** | **未验证** | **未验证** | **需平台确认** |
| Webhook / 回调 | **未取得** | **未取得** | **未取得** | **未取得** | **未取得** | **未验证** | **未验证** | **需平台确认** |
| 异步任务 + 状态查询 | **未取得** | **未取得** | **未取得** | **未取得** | **未取得** | **未验证** | **未验证** | **需平台确认** |
| 本机 `opencode serve` | 本地 CLI `--help` 输出（E1） | 本地地址，默认 `127.0.0.1:<随机端口>` | **无内置鉴权参数** | 未验证 | 本地 Agent | **否**（本机回环） | 本机可用 | 不适用 |
| 本机 `opencode run` | 本地 CLI `--help` 输出（E1） | 无网络端点 | 不适用 | CLI 参数 | 本地 Agent | **否** | 本机可用 | 不适用 |

### 5.1 关于 `opencode serve` 的准确表述

`serve --help` 输出（E1）：

```
starts a headless opencode server
Options:
  --port        port to listen on                        [default: 0]
  --hostname    hostname to listen on      [default: "127.0.0.1"]
  --cors        additional domains to allow for CORS     [default: []]
```

可以确认的事实：

- 默认只监听回环地址；
- 有 `--cors` 参数，说明它能被浏览器跨域访问（在本机范围内）；
- **没有任何 token / api-key / auth 参数**。

**准确结论**：这是"本机无头服务"，适合本地开发与桌面内集成；**不能**作为面向公网多用户的服务端，因为缺少鉴权、租户隔离、配额与 TLS 终止。

### 5.2 需要官方书面确认的事项清单

1. 是否存在面向第三方的 Agent 执行 API；若有，给出正式文档链接与版本号。
2. 认证方式（API Key / OAuth / 签名 / mTLS）与密钥轮换策略。
3. 是否允许将 Agent 能力嵌入第三方商业网站，服务不特定公众用户。
4. 单账号并发上限、QPS、单次输入/输出 token 上限、超时上限。
5. 计费模型（按调用 / 按 token / 包月）与超额行为。
6. 数据留存与隐私条款：用户笔记是否被用于训练、留存多久、能否关闭。
7. 是否支持指定 `agent_id`、是否支持传入 Skill 包与知识库。
8. 是否提供运行日志导出与 `request_id` 追踪。
9. 是否支持回调（webhook）或必须轮询。
10. SLA 与故障响应流程。

---

## 6. 当前真实运行链路（与目标链路对照）

### 6.1 网站侧真实链路（E1）

```
AddFilmFlow / FilmAnalysisPanel
  → POST ${VITE_AI_API_BASE}/v1/analyze        (src/lib/ai/client.ts L92)
  → Cloudflare Worker: server/worker.ts → server/app.ts
  → server/core/service.ts → provider → DeepSeek
  → 返回 { analysis, meta }
  → 前端 validateAnalyzeResponse()              (client.ts L113)
  → toFilmAnalysis() → 存入 localStorage        (src/lib/storage.ts)
```

关键点：

- `wrangler.toml` L11–L12：`AI_MODEL = "deepseek-chat"`、`DEEPSEEK_BASE_URL = "https://api.deepseek.com"`；
- `.env.example` L5–L7：`DEEPSEEK_API_KEY`、同一 base URL；
- **整条链路没有任何 DeepWorks 调用**。

### 6.2 DeepWorks 侧真实链路（E1）

```
film-curator（本地 Agent 会话）
  → workflow/hash-note.mjs
  → .opencode/skills/**/scripts/*.mjs
  → 读写 knowledge/entries.json
  → 写 outputs/p0/runs/<RUN_ID>.json
```

两条链路**没有交点**：没有共享数据库、没有 HTTP 调用、没有产物导入入口。

### 6.3 结论

P2 的真实工作量不是"加一个 endpoint"，而是：

1. 先拿到平台的官方执行入口（当前阻塞）；
2. 再把 Agent 改造成**无共享可变文件、可并发、可幂等**的服务形态；
3. 再定义 `pending-note.v1 → agent-run.v2` 契约；
4. 最后才改前端与 Worker。

---

## 7. 能做 / 不能做清单

### 7.1 现在就能做（不依赖平台新能力）

- 固化 Agent 与 Skill 版本（提交 + 内容哈希）；
- 定义并冻结 `pending-note.v1` / `agent-run.v2` JSON Schema；
- 写 v2 → 网站 `AIFilmAnalysis` 的适配层与单元测试；
- 用本地回放（离线 fixture）验证契约，不对外提供服务；
- 把 Worker 的限流改为 Durable Object / KV（工程改造，不涉及平台授权）。

### 7.2 必须等平台确认才能做

- 云端 Agent 执行入口、鉴权、配额；
- Skills 在云端的加载方式；
- 知识库是否需要迁移；
- 平台级运行日志与 `request_id`。

### 7.3 现在不能做（E5）

- 让 Cloudflare Worker 直接调用 "DeepWorks 官方 API"；
- 对外宣称"分析由 DeepWorks 云端执行"；
- 把本机 `opencode serve` 作为公网后端；
- 多用户共享同一 Agent 工作区。

---

## 8. 审计结论

1. **能力层面**：本次没有取得任何 E2 级证据。所有"云端"能力均为 E3（未验证）或 E4（需平台确认）。
2. **形态层面**：`film-curator` + 3 Skills + 文件型知识库是**可运行的本地产品原型**，不是可对外托管的服务。
3. **目标层面**：目标 B 的可行性**完全取决于平台是否开放官方云端 Agent 接口**；在拿到书面确认前，任何"已打通"的表述都是不成立的。
4. **建议**：P2-0 判定 **BLOCKED**；并行推进不依赖平台的契约与适配层工作（见路线图 P2-A），同时向平台发起接口开放申请（见阻塞清单）。
