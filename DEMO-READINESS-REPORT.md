# DeepWorks 演示环境验证报告

> 执行时间：2026-11-10 19:02–19:07（本地）
> 执行方式：全部为**当场实测**，不采信历史文档结论。
> 环境：Windows / Node v26.13.0 / npm 11.20.0 / DeepWorks 引擎 1.18.18
> 未做的事：未打开 DeepWorks 图形界面、未修改任何代码、未执行 git 写操作。

---

## 0. 五项检查结论

| # | 检查项 | 结论 | 一句话依据 |
|---|---|---|---|
| 1 | 项目能否正常打开 | **可以** | 构建成功；本地 HTTP 冒烟 200；类型检查通过 |
| 2 | Agent / Skills / 知识库 / 工作流能否运行 | **可以** | 现场完整重跑一次，7 步全部走完，4 道门全绿 |
| 3 | 是否有可复现的完整演示流程 | **有，且有 4 次成功记录** | 单命令可重跑，96.3 秒完成 |
| 4 | 是否有真实运行记录 / 测试结果 / 演示材料 | **记录与测试充分；演示材料不足** | 120 个测试通过；平台侧零截图、无视频 |
| 5 | 演示内容与实际功能是否一致 | **基本一致，但有 3 处需注意** | 见第 4 节 |

**总体判定：技术上可演示，材料上不足。** 缺口集中在"平台界面的可见证据"，而非功能本身。

---

## 1. 项目可运行性

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck` | **通过**，零输出 |
| 生产构建 | `npm run build` | **成功**，5.88s，1636 模块 |
| 构建产物 | `dist/` | `index.html` 757 B；`index-DxaS6vzV.js` 501.97 kB（gzip 155.76 kB）；CSS 82.30 kB |
| HTTP 冒烟 | `vite preview --host 127.0.0.1 --port 4319` | `GET /` → **200**，757 B；`GET /assets/index-DxaS6vzV.js` → **200**，501,974 B |

**唯一警告**：单 chunk 超过 500 kB（Vite 提示）。不影响功能，演示前若要优化可做代码分割，非必需。

> 说明：`vite preview` 默认只绑 IPv6 `localhost`，首次用 `127.0.0.1` 访问会失败。演示脚本里必须写 `--host 127.0.0.1`，否则现场会误判"服务没起来"。

---

## 2. 平台能力可运行性

### 2.1 引擎与注册项

| 项 | 实测值 | 来源 |
|---|---|---|
| 引擎版本 | **1.18.18** | `outputs/p0/evidence/agent-list.txt` |
| 引擎可执行文件 | `%LOCALAPPDATA%\Programs\DeepWorks\resources\sidecars\opencode-x86_64-pc-windows-msvc.exe`（存在，178 MB） | `Test-Path` 实测 |
| 已注册 Agent | `deepworks (primary)`、**`film-curator (primary)`** | 同上 |
| 可用模型 | 10 个，含 **`dth/DeepSeek-V4.1-Flash`**（本次使用） | `outputs/p0/evidence/models.txt` |
| 项目默认 Agent | `film-curator` | `opencode.jsonc` |

### 2.2 现场完整重跑（本次核心证据）

```
node workflow/run-p0.mjs --input outputs/p2/_work/demo-verify/run-demo.json --timeout-ms 600000
```

| 指标 | 结果 |
|---|---|
| 退出码 | **0** |
| 总耗时 | **96.3 秒** |
| `ok` | **true** |
| `validation_ok` | **true** |
| `validation_failures` | **[]**（空） |
| 事件流 | 166,224（摘要口径）/ 189,025 B（磁盘实际） |
| 引擎 stderr | 32,939 B |
| 三个 Skill | `cinema-knowledge-retrieval` / `film-note-analysis` / `cinema-taste-profiling` 全部 `invoked:skill` |
| KB 引用 | KB-003、KB-004、KB-009 |
| 证据条数 / 维度数 | 4 / 4（emotion、ending、character、thematic） |
| `note_sha256` | `e348256a…67c7`，与输入**逐字一致** |
| 模型 | `dth/DeepSeek-V4.1-Flash`，平台标注 `DeepWorks` |

**归档位置**：`outputs/p0/runs/fbf-p2-demoverify-01.*`（新 run_id，**未覆盖** 11-09 的三次归档）

> 小口径差异：`run-summary.json` 的 `events_bytes` 实际是**字符数**（UTF-8 解码后的 `string.length`），磁盘字节数为 189,025。引用数据时以磁盘为准。

> 这是本次最重要的证据：**不是读旧文件，是刚刚真的跑出来的。**

### 2.3 三个 Skill 单独可执行性

| Skill 脚本 | 命令 | 结果 |
|---|---|---|
| `retrieve.mjs` | `--input run-01 --top 4` | `ok=true`，返回 KB-004(36) / KB-012(25) / KB-003(24) / KB-009(14) |
| `validate-evidence.mjs` | `--input run-01 --analysis run-01.draft` | `ok=true`，5 条引文全部 `match_type: exact` |
| `validate-citations.mjs` | `--citations run-01.draft` | `ok=true`，3 条 `excerpt_verbatim: true`，12 条知识在库 |
| `profile.mjs` | `--evidence run-01.draft` | 成功；warnings 为预期项（样本不足、维度未观测） |

四个脚本**均可独立运行**，不依赖 Agent 会话。

### 2.4 知识库

- 条目数：**12**（`knowledge/entries.json`）
- 检索方式：确定性 bigram 关键词（`deterministic-bigram-keyword-v2`）
- 实际命中：4 条相关，分数 14–36，非随机
- **未上平台知识中心**（见 4.2）

### 2.5 历史运行记录

| run | 耗时 | 验证 | 证据/维度 |
|---|---|---|---|
| `fbf-p0-20261109-01` | 130.0 s | ok | 5 / 4 |
| `fbf-p0-20261109-02` | 98.3 s | ok | 5 / 4 |
| `fbf-p0-20261109-03` | 134.7 s | ok | 5 / 5 |
| `fbf-p0-20261109-03-ui` | 36.3 s | 结构不同，见 4.3 | 4 |
| **`fbf-p2-demoverify-01`** | **96.3 s** | **ok** | **4 / 4** |

三条 P0 归档我**重新独立执行了 `validate-run.mjs`**，全部 `ok: true`、`failures: []`，未采信存档里的旧结论。

---

## 3. 可复现的完整演示流程

### 3.1 单命令复现

```powershell
# 准备输入（run_id 唯一，note 不改）
node workflow/run-p0.mjs --input outputs/p2/_work/demo-verify/run-demo.json --timeout-ms 600000
```

产出 7 类文件：

```
outputs/p0/runs/<run_id>.json            最终结构化结果
outputs/p0/runs/<run_id>.draft.json      分析草稿 + 证据
outputs/p0/runs/<run_id>.retrieval.json  知识库检索记录
outputs/p0/runs/<run_id>.profile.json    画像增量
outputs/p0/runs/<run_id>.events.jsonl    完整事件流
outputs/p0/runs/<run_id>.validation.json 质量门结果
outputs/p0/runs/<run_id>.run-summary.json 运行摘要
```

### 3.2 演示时长的现实约束

- 单次运行 **96–135 秒**。
- **不适合现场等**。演示应使用已跑好的产物 + 现场只展示"命令已跑过一次"的录像或截图。

### 3.3 复现性边界（必须知道）

同一输入重跑，**结果不完全相同**：

| 项 | 11-09 归档 | 11-10 重跑 |
|---|---|---|
| 证据条数 | 5 | 4 |
| 画像 schema | v1（无 `schema_version` 字段） | **v2** |
| `independent_note_count` | 无此字段 | 1 |
| 质量门 | 全绿 | 全绿 |

结论：**门禁可复现，文本可复现，条数不保证。** 材料里不要写"结果完全一致"。

---

## 4. 演示内容与实际功能的一致性

### 4.1 必须注意的三处差异

| # | 问题 | 影响 | 处理 |
|---|---|---|---|
| **C1** | 归档画像为 **v1**，当前脚本产出 **v2**，字段结构不同 | 若一边展示 11/09 的 JSON、一边现场重跑，观众会看到两套结构 | 演示只用一套；建议演示前用 v2 重跑 3 条 |
| **C2** | `03-ui` 的 `run-summary.json` **无 `ok`/`validation_ok` 字段**，`skills_called` 为空 | 与其他三次**不可并列比较**，且易被误读为"Skill 没调用" | 演示材料中标注"UI 触发的一次，结构不同"，或不列它 |
| **C3** | 网站 v2 run 的 `skills_used: []`、`kb_citations: []`、`profile_delta: null` | 若把网站结果说成"Agent 产出"即为虚构 | 必须分开讲：网站 = DeepSeek；平台 = film-curator |

### 4.2 演示材料盘点

| 材料 | 状态 |
|---|---|
| 网站界面截图 | **充足**（`outputs/v5-screens/`、`v6-screens/`、`ai-core-verification/` 等 60+ 张） |
| 平台运行事件流 | **有**（4 份 `*.events.jsonl`，125–228 KB） |
| 会话导出 | **有**（`session-01/02/03.json`，188–284 KB） |
| Agent / 模型清单 | **有**（`agent-list.txt`、`models.txt`） |
| 工具调用记录 | **有**（`tool-calls.txt`，3 次运行 × 9 条） |
| **平台界面截图**（Agent 选择器 / Skill 调用 / 知识库页面） | **缺失** |
| **演示视频** | **缺失**（全仓库无 mp4/mov） |
| **PPT / 项目说明** | **缺失**（无 pptx/key） |
| 网站内置的 Agent 结果回放 | **缺失**（无 `public/agent/`） |

### 4.3 一致性判定

| 声明 | 是否与实际一致 |
|---|---|
| "Agent 在平台内真实执行过" | **一致**（4 次运行 + 事件流 + 会话） |
| "三个 Skill 被真实调用" | **一致**（`SKILL` 工具记录 + BASH 记录） |
| "知识库被真实引用" | **一致**（KB 引用逐字校验通过） |
| "工作流可重复" | **一致**（今天现场重跑成功） |
| "网站分析由 DeepWorks 执行" | **不一致，禁止这样说** |
| "已接入平台知识库" | **不一致，禁止这样说** |
| "结果完全可复现" | **不严谨**（条数会变，见 3.3） |

---

## 5. 演示时不能说的话

| 禁止表述 | 事实 |
|---|---|
| "网站背后是 DeepWorks Agent" | 网站调 DeepSeek API |
| "已接入平台知识库检索" | 知识库仍是本地 12 条文件 |
| "多 Agent 协同" | 1 个 primary + 3 个 Skill |
| "工作流是可视化画布" | 是 Agent 指令 + 脚本质量门 |
| "每次结果完全一致" | 门禁一致，条数会变 |
| "现场 10 秒出结果" | 实际 96–135 秒 |

---

## 6. 建议的 3 分钟演示脚本

| 时间 | 画面 | 说什么 | 不要说什么 |
|---|---|---|---|
| 0:00–0:30 | 网站首页 | 产品定位：个人电影记忆博物馆 | 别提平台 |
| 0:30–1:10 | 录入一篇笔记 | 记录 → 分析 → 证据带原话 | 别说"Agent 在跑" |
| 1:10–1:40 | 分析结果页 | 每条结论可回溯到原文；置信度与不确定性 | 别把 DeepSeek 说成 DeepWorks |
| 1:40–2:20 | 切换终端，展示 `run-p0.mjs` 已跑完的产物 | 平台侧：film-curator + 3 Skills + 12 条知识库，7 步、4 道门 | 别现场等 96 秒 |
| 2:20–2:45 | 打开 `fbf-p2-demoverify-01.validation.json` | "这是今天 19:05 刚跑的一次，全绿" | 别说"完全自动化" |
| 2:45–3:00 | 画像页 | 单条笔记不下长期结论，样本不足会标注 | 别夸大成"AI 懂你" |

---

## 7. 结论与唯一推荐动作

### 7.1 结论

- **功能层面：可以演示。** Agent、3 个 Skill、知识库、工作流全部实测通过；网站可构建、可启动、120 个测试全绿。
- **材料层面：不够。** 平台侧缺界面截图，缺视频，缺 PPT。
- **一致性层面：可控。** 三处差异都有明确处理方式，只要不跨界表述即可。

### 7.2 唯一推荐动作

> **用 v2 脚本把 3 条 P0 输入重新跑一遍，覆盖为统一的 v2 产物，并在同一次运行中截图留存。**

理由：

1. 一次动作同时解决 C1（schema 分裂）、C2（`03-ui` 结构不一致）和"平台截图缺失"。
2. 重跑不改代码、不改变结论，只是让证据自洽。
3. 截图必须在运行当下做，事后补不出来。

**不要同时开工其他事项。** 先让"可展示的一套证据"成立，再谈材料包装。
