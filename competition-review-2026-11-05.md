# Frame by Frame · 赛事适配评审（D1）

> 评审日期：2026-11-05
> 依据：《首届"滴普杯" DeepWorks 校园黑客松 · 赛制说明》原文 + 当前工作区代码快照 + DeepWorks 本会话可验证能力
> 原则：只写可核对的事实；不预测分数；不把"设计过"写成"已实现"；不虚构平台能力。

---

## 0. 一句话结论

**前端已经够用了，问题不在页面，在"作品主体"四个字。**

当前仓库是一个完成度较高的 **Phase 1 纯前端原型**：所有"AI 分析"都由 `src/lib/` 的本地规则在浏览器里完成，没有任何 DeepWorks Agent、Skill 或知识库参与。按赛制 6.1，这正好落在否决项 1 的射程内：

> 作品主体功能未在 DeepWorks 内实现 → 取消参赛资格。

所以接下来 19 天的唯一主线不是"再加页面"，而是：**把证据抽取、画像计算、记忆检索、纠错回流这条智能链路，真实地搬进 DeepWorks，并让前端只展示 DeepWorks 的真实运行结果。**

---

## A. 赛事资格检查

| 检查项 | 结论 | 证据 / 说明 | 风险 |
|---|---|---|---|
| 是否符合 C 赛道 | **已满足** | 赛制第 46–52 行：C 赛道完全开放，个人兴趣/生活真实问题均可；本项目是个人电影记忆，题材合规 | 无 |
| DeepWorks 核心能力是否真正落地 | **未满足** | 全仓库无 Agent / Skill / 知识库调用；`README.md` 第 8–9 行自述"全部数据与 AI 分析均在浏览器本地完成" | **否决项 1 直接风险** |
| 是否存在外部框架作为主体 | **部分满足，高风险** | React 前端本身合规（赛制允许界面）；但当前 `src/lib/tasteEngine.ts`、`analyst.ts` 承担了全部"智能"，若原样提交，主体就是本地规则引擎 | 评委一问"AI 在哪"即暴露 |
| 能否在 DeepWorks 环境内实时演示 | **部分满足** | 本会话已实测：DeepWorks 引擎可运行 primary agent、调用 skill、执行本地 Python、读写工作区文件；但知识库检索、前端读取 Agent 结果两条链路尚未验证 | 现场可能只能演示前端 |
| 个人参赛是否符合要求 | **已满足（形式）** | 赛制第 13、57 行：1–4 人，个人独立成队合法；不得虚构队员 | **报名状态未知**，11/09 18:00 截止 |
| 提交材料能否按期完成 | **部分满足** | 前端已有；项目说明、背景三件套、演示视频、Skills/知识库说明、迭代记录均未开始 | 材料缺口大，但不是否决项 |

### 需要向组委会确认（不要自己假设）

1. "DeepWorks 使用证明"具体要什么：会话截图、运行日志、导出文件，还是现场操作即可？
2. 现场决赛是否允许本机演示、是否提供网络、单队路演时长与问答时长。
3. 比赛账号的知识库数量、文件大小、Agent 数量、模型额度限制。
4. 是否允许自定义 Skill 执行本地脚本、读写工作区文件（本机引擎可以，比赛账号策略需确认）。
5. "工作流编排"是否必须是平台内可视化工作流；若平台只有 Agent 编排，Agent 调用链是否被认可。
6. 提交物是仓库链接、可运行包，还是两者都要。

---

## B. 当前项目完成度

### B.1 React 前端（可演示，但不是作品主体）

| 功能 | 状态 | 证据 |
|---|---|---|
| 6 个页面 + 详情页 + 404 | **已实现并验证** | `src/pages/`；`npm run typecheck` 通过（2026-11-05 实测） |
| Add a Film 五步流程 | **已实现并验证** | `src/components/add/AddFilmFlow.tsx`；含搜索、确认、评分、笔记、分析、写回 |
| localStorage 持久化 / 跨标签同步 / 重置 | **已实现并验证** | `src/lib/storage.ts`；`fbf.state.v1` |
| 六维雷达、证据引文、置信度 UI | **已实现，计算未验证** | `src/lib/tasteEngine.ts`；无单元测试 |
| 纠错 UI | **已实现，但未真正生效** | 见 B.3 |
| 记忆图谱交互 | **已实现并验证** | `src/components/map/MemoryGraphView.tsx`；曾用 `.deepworks/tmp/map-test.mjs` 做过浏览器验证 |
| Reflection / 年鉴 | **已实现并验证** | `src/pages/Reflection.tsx` |
| 生成式 SVG 海报 | **已实现并验证** | `src/components/film/FilmPoster.tsx`，无第三方图片依赖 |
| 中文笔记理解 | **未实现** | `src/lib/analyst.ts` 中文字符数 = 0，关键词表全英文 |
| 真实用户测试 | **未实现** | 无测试记录；`seed.ts` 10 条记录为英文虚构示例 |

### B.2 DeepWorks 内实际实现

| 能力 | 状态 | 说明 |
|---|---|---|
| Agent 定义与运行 | **平台机制已确认，项目内 0 个** | `.opencode/agents/deepworks.md` 当前生效，证明 Agent 由工作区文件定义并被执行；项目尚未定义 film/reflection/taste/memory |
| Skill 定义与调用 | **平台机制已确认，项目内 0 个** | 本会话 `available_skills` 已识别 4 个项目 Skill + 4 个全局 Skill；说明 `.opencode/skills/<name>/SKILL.md` 生效 |
| 本地脚本执行 | **已确认** | 本会话用 Python 提取 PDF、跑 Node 脚本均成功 |
| 知识库接入 | **未验证** | 平台有知识中心入口，但本会话无权也无法验证其文件接入/检索 API；**不得在材料中写成已接入** |
| 多 Agent 调用 | **机制存在，未在本项目验证** | `task` 工具可用，但当前只暴露 `explore` / `general`；自定义 subagent 需配置后新开会话验证 |
| 工作流编排 | **无可视化工作流证据** | 可验证的是 "primary agent → subagent → skill script" 调用链；不要声称有 workflow 画布 |
| 运行日志 / 导出 | **部分确认** | 会话消息与工具输出有记录；UI 导出能力待确认 |

### B.3 关键缺陷：纠错没有回流

这是实用性评分里最容易被现场戳破的一点。

- `src/components/taste/DimensionCard.tsx` 第 27–30 行：`adjustedConfidence = score.confidence * 0.84`，只在**展示层**打折。
- `src/pages/Taste.tsx` 第 82–89 行：只弹一句 "confidence is reduced"，没有重新计算。
- `src/lib/tasteEngine.ts` 第 113 行：`computeSnapshot(records, films)` 只接收观影记录和影片，**完全不读取 `feedback` / `corrections`**。

结论：用户纠错被保存了，但**不改变后续任何一次画像计算**。赛制要求"用户纠错是否真正生效"，当前答案是"没有"。

---

## C. 评分差距分析

> 不预测分数，只标风险与可操作提升点。

### C.1 项目背景（30 分）

| 子项 | 当前优势 | 失分风险 | 提升动作 |
|---|---|---|---|
| 竞品分析 10 | 产品定位清楚，不是豆瓣替代品 | 尚未成文；容易只列豆瓣/Letterboxd 名称 | 建 `docs/competition-background.md` 第 1 部分：豆瓣、Letterboxd（可选 Notion/纸质手账）四维表 + 一句差异结论 |
| 可行性 10 | 技术栈已跑通，单人排期可算 | 容易写"技术可行"空话；DeepWorks 额度/知识库能力未核实 | 技术项只写已实测能力；数据项写清公开元数据 + 私人笔记隔离；成本项写"待账号额度确认"，不编数字 |
| 创新性 10 | "证据可追溯到原话 + 纠错改变画像"是真差异 | 一句话创新点未定；易滑向"AI 理解你"空泛表述 | 用 ≤30 字定为"每条审美结论都能回到你的原话"；给 3 条差异 + 1 条验证方法 + 明确边界 |

### C.2 实用性（30 分）

| 观察点 | 现状 | 风险 |
|---|---|---|
| 能否完成真实任务 | 前端能记录，但"理解"是英文关键词规则 | **中文笔记基本抽不出东西**，目标用户却是中文用户 |
| 使用流程是否合理 | Add a Film 五步顺滑 | 第 4 步"五阶段分析"是模拟动画；`AddFilmFlow.tsx` 第 781 行明确写 "No model is being called" |
| 是否有样例/反馈 | 只有 10 条英文虚构示例 | **无真实用户测试**，此项接近 0 |

### C.3 迭代记录（10 分）

| 观察点 | 现状 | 风险 |
|---|---|---|
| 是否说明赛前基础 | 有前端 MVP，可讲 | 但 `git log` 只有 1 个 commit，其余 17 个文件未跟踪 |
| 是否有真实改进证据 | 无 | 没有日期化记录，赛后补写即造假 |
| 是否根据测试反馈修改 | 无 | 未做测试 |

**立即动作**：今天把现有工作提交一次 git，并从今天起每条实质改动写一条迭代日志。否则这 10 分无法证明。

### C.4 最终成品（30 分）

| 观察点 | 现状 | 风险 |
|---|---|---|
| 现场演示完整稳定 | 前端稳定 | 演示里没有 DeepWorks 核心运行 → 资格风险 |
| 核心功能可复现 | 本地引擎可复现 | 复现的不是 DeepWorks 链路 |
| 材料与使用证明 | 几乎为空 | 无 Skills/知识库说明、无运行记录 |

---

## D. DeepWorks 实施架构

### D.1 设计约束（先于架构）

1. **已验证**：DeepWorks 可运行 primary agent、加载项目 Skill、执行本地 Python/Node、读写工作区。
2. **未验证**：知识库文件接入与检索 API、前端实时读取 Agent 结果、自定义 subagent 在比赛账号可用。
3. **因此**：架构必须有一条"知识库不可用也能跑"的 Plan B，且 Plan B 仍把智能放在 Agent + Skill，不退回本地前端规则。

### D.2 Agent 结构：6 个角色，4 个真实执行单元

| 角色 | 执行形态 | 职责 | 不做什么 |
|---|---|---|---|
| Master | primary agent（DeepWorks 会话入口） | 判任务类型、调度、合成、校验证据完整性 | 不自己编审美结论、不算分 |
| Film | Skill `film-lookup`（必要时 subagent 包装） | 片名标准化、消歧、返回候选 | 不生成不存在的元数据 |
| Reflection | **独立 subagent** | 从中文/英文笔记抽取句子级证据、主题/情绪候选 | 不把推测写成用户原话 |
| Memory | **独立 subagent** | 检索历史记录、建立关联、解释关联理由 | 不做无来源的相似判断 |
| Taste | **独立 subagent** | 解释画像、组织 diff、生成追问 | 不自己定分数/置信度 |
| Discovery | 并入 Memory 调用链（P1） | 基于画像给出 3 条有理由的推荐 | 不按热门榜单推荐、不编电影信息 |

保留 6 个角色是为了叙事完整；真实独立调试面收敛到 4 个，是单人可完成的边界。**答辩时如实说"6 个角色、4 个独立执行单元"**，不要把它包装成 6 个独立服务。

### D.3 Skills 清单

| Skill | 输入 | 输出 | 实现方式 | 调用条件 | 异常处理 |
|---|---|---|---|---|---|
| `film-lookup` | `{title, year?, director?}` | `{status:"matched"\|"ambiguous"\|"not_found", film_id?, candidates[]}` | 确定性查 `data/films.json`，标题归一化 + 年份/导演消歧 | 每次新增电影第一步 | 不猜；多候选直接返回列表 |
| `review-extract` | `{record_id, text, taxonomy}` | `{evidence:[{quote, dimension, tag, polarity, strength}], themes[], moods[]}` | Agent 抽取 + JSON Schema 校验；`quote` 必须是原文子串 | 有笔记文本时 | 校验失败丢弃该条，不"修复"；无证据返回空并说明 |
| `taste-update` | `{records[], corrections[], taxonomy}` | `{snapshot, diff, conflicts, confidence}` | **纯 Python 确定性计算**，不调模型 | 每次新增/纠错后 | 样本 <3 时 `thin=true`，不出强结论 |
| `memory-retrieve` | `{snapshot, records[], films[]}` | `{relations:[{from,to,reason,shared[]}]}` | 确定性：共享主题/情绪/导演 + 可选文本相似度 | 画像更新后 | 无关联返回空，不硬造 |
| `film-recommend` | `{snapshot, seen_ids, films[]}` | `{items:[{film_id, why, risk}]}` | 规则打分召回 + Agent 写解释 | 用户主动要推荐 | 候选不足时少给，不凑数 |
| `taste-report` | `{snapshots[]}` | `{summary, changes[]}` | 前端聚合，不单独建 Agent | 用户打开 My Taste | — |

**关键红线**：`review-extract` 只负责"抽"，`taste-update` 只负责"算"。模型不得自报置信度，不得输出 taxonomy 之外的标签。

### D.4 知识库结构

| 知识库 | 内容 | 可见性 | 数据来源 / 授权 | Plan B |
|---|---|---|---|---|
| Film KB | 50 部左右影片：标题、年份、导演、类型、主题、情绪 | 公共 | 公开元数据人工整理；标注来源；不抓取受限内容 | `data/films.json` + `film-lookup` |
| Taste Taxonomy KB | 六维定义、中英主题/情绪词表、维度边界、打分规则 | 公共 | 自建，可随作品开源 | `data/taxonomy.json`，Skill 直接读 |
| User Cinema Memory | 用户真实记录、笔记、证据、画像快照、纠错 | **私有** | 用户本人提供；不进公共库、不外传、不提交 git | `data/user-memory/`（gitignore）+ 本地 JSON |

**隔离要求**：私人笔记与公共电影资料物理分目录；`data/user-memory/` 写入 `.gitignore`；演示用真实记录需用户本人同意；提交材料中脱敏。

**诚实说明**：如果比赛账号的知识库无法被 Skill 通过 API 检索，就在材料中写"知识库以工作区结构化文件 + 确定性检索实现，平台知识中心用于资料沉淀"，并把知识中心截图作为使用证明。**不要声称"已接入平台知识库检索"而未验证。**

### D.5 工作流（Agent 编排，不是可视化画布）

```text
用户在 DeepWorks 会话输入：
  "我昨天看了《美丽心灵的永恒阳光》，写了一段感受：……"

Master（primary）
 ├─① film-lookup        → 确认影片，歧义则返回候选
 ├─② review-extract     → 句子级证据（quote 必须是原文子串）
 ├─③ taste-update       → 确定性重算六维 + diff + confidence
 ├─④ memory-retrieve    → 历史关联 + 理由
 ├─⑤ taste 解释          → 把 diff 讲成人话（只引用已算出的数字）
 └─⑥ 写入 run 文件        → public/agent-runs/<run_id>.json + latest.json
```

纠错回流：

```text
用户点"不准确" → 生成 correction 证据（source=correction, polarity=-1）
→ taste-update 重算 → 新 snapshot + 新 diff
→ 前端必须能看到"分数变化 + 置信度变化 + 你的原话"
```

验收：纠错前后两次 `snapshot` 必须不同，且差异可定位到该条 correction。否则这个功能不算实现。

### D.6 输入输出数据格式（最小契约）

```json
// WatchRecord
{
  "record_id": "rec_001",
  "film_id": "film_001",
  "watched_at": "2026-11-08",
  "rating": 4.5,
  "note_raw": "整部片子最打动我的是那种说不出口的愧疚……",
  "language": "zh"
}
```

```json
// Evidence（一切结论的根）
{
  "evidence_id": "ev_001",
  "record_id": "rec_001",
  "film_id": "film_001",
  "dimension": "character",
  "tag": "人物心理刻画",
  "polarity": 1,
  "strength": 0.8,
  "quote": "那种说不出口的愧疚",
  "source": "review"
}
```

```json
// TasteSnapshot
{
  "snapshot_id": "snap_003",
  "created_at": "2026-11-08T23:41:00+08:00",
  "dimensions": {
    "narrative": { "score": 0.62, "confidence": 0.48, "evidence_count": 4, "updated_at": "..." }
  },
  "overall_confidence": 0.51,
  "thin": false
}
```

```json
// AgentRun（前端只读这个，保证"AI 说的话"有出处）
{
  "run_id": "run_20261108_2341",
  "agent": "master",
  "started_at": "...",
  "finished_at": "...",
  "input_ref": "rec_001",
  "steps": ["film_lookup", "review_extract", "taste_update", "memory_retrieve"],
  "output": { "snapshot": {}, "diff": [], "relations": [], "quotes": [] },
  "warnings": []
}
```

### D.7 前端接入方式

**推荐：文件交接，不建后端。**

```text
DeepWorks Skill 写文件 → public/agent-runs/latest.json
前端 "Load latest DeepWorks run" → fetch('/agent-runs/latest.json')
页面显示 run_id / 运行时间 / 步骤 / 证据 / diff
```

- 合规：前端只展示 Agent 结果，智能在 DeepWorks；没有自建后端主体。
- 演示：DeepWorks 会话跑完 → 浏览器点一次刷新/按钮 → 画像变化可见。
- 离线兜底：保留最近一次预跑 `latest.json`，断网也能展示"已运行结果"，但要标注运行时间。
- 可选 P2：Vite middleware 做只读写 JSON 的薄桥，实现自动刷新。薄桥只传文件，不做任何推理；材料中必须说明。

**禁止**：前端直接调用外部大模型 API 充当主体；把本地规则结果标成 "DeepWorks run"。

### D.8 现场演示方案

| 时间 | 画面 | 说什么 |
|---|---|---|
| 0:00–0:20 | 前端首页 | "我看过很多电影，但只剩评分，感受没了" |
| 0:20–0:50 | DeepWorks 会话，输入中文笔记 | "这是真实记录，不是模板" |
| 0:50–1:40 | Agent 工具调用逐条出现 | "Film 确认影片；Reflection 抽证据；注意它引用的是原话" |
| 1:40–2:10 | 前端 My Taste | "画像从 A 变到 B；置信度变化；每条能点回原话" |
| 2:10–2:35 | 前端纠错，再跑一次 taste-update | "我说它错了，它真的改了，而且保留了我说的话" |
| 2:35–3:00 | 推荐/边界 | "只推荐有依据的；证据不足它会说不知道" |

**兜底**：预跑 run 文件 + 3 分钟录屏 + 本地前端；现场不依赖外网。

---

## E. 最小可行参赛版本（MVP）

### E.1 必须保住（按赛制实用性 + 否决项）

| # | 能力 | 验收标准 |
|---|---|---|
| 1 | 真实中文观影笔记输入 | 用户本人写的一段中文，能原样进入链路 |
| 2 | 中文理解 | 抽取出的 `quote` 是原文子串，且至少 2 条有意义的证据 |
| 3 | 历史记忆检索 | 至少返回 2 条关联，每条有共享标签或原文理由 |
| 4 | 六维画像更新 | 前后两次 snapshot 数值不同，且能显示 diff |
| 5 | 证据可追溯 | 每个结论可展开到 record + 原句 |
| 6 | 用户纠错 | 纠错后重算，分数/置信度发生可观察变化 |
| 7 | DeepWorks 内完整运行 | 全程在 DeepWorks 会话中完成，前端只展示结果 |

### E.2 保留但不投入

- 前端 6 页、Memory Map、Reflection 年鉴：保留现有，作为展示层，不再加新功能。
- Discovery 推荐：只做 3 条"有理由 + 有风险提示"，不做推荐系统。
- `taste-report`：前端聚合，不做独立 Agent。

### E.3 明确砍掉

- 登录 / 多用户 / 云同步 / 社交。
- 真实海报 API、TMDB 大规模抓取。
- 子标签体系（`人物心理刻画@剧情片`）。
- 可视化工作流画布（平台若无）。
- 任何"为了看起来完整"的新页面。

### E.4 时间安排（今天 11/05 起）

| 阶段 | 日期 | 目标 | 硬验收 |
|---|---|---|---|
| D1 能力落地 | 11/05–11/07 | 报名确认；三连能力实测；真实中文语料；git 提交 | 一段中文笔记 → 证据 JSON → 前端读到 |
| D2 核心链路 | 11/08–11/12 | reflection + taste-update + 中文 taxnomy | 连续 3 条记录，画像有 diff |
| D3 记忆与纠错 | 11/13–11/17 | memory-retrieve + 纠错回流 + 前端接入 | 纠错后 snapshot 真的变；中期答疑可演示 |
| D4 测试与材料 | 11/18–11/21 | 3–5 人真实测试；修最痛 3 个问题；背景三件套 | 有测试记录与修改前后对比 |
| D5 提交 | 11/22–11/24 | 项目说明 2–4 页、3 分钟视频、Skills/知识库说明、启动步骤 | 11/24 18:00 前全部可核对 |
| 决赛准备 | 11/25–11/27 | 现场脚本、Q&A、备用机、离线包 | 全流程连续 3 遍不卡 |

---

## F. 下一步执行清单（只做 3 项）

### 任务 1：确认报名（今天，10 分钟）

- 具体任务：确认 11/09 18:00 前已完成报名；保存回执/群内确认。
- 预计耗时：10 分钟。
- 需要的 DeepWorks 功能：无。
- 你要亲自做：填表/确认。
- 验收：有报名成功证据。**没报名，后面全部归零。**

### 任务 2：DeepWorks 能力三连测（今天–11/06，2–3 小时）

- 具体任务：
  1. 在 DeepWorks 主界面确认：知识库能否创建、上传文件、被 Agent 检索；记录入口与限制。
  2. 在本工作区创建 1 个 subagent（`reflection`）+ 1 个 Skill（`review-extract`），新开会话验证能否被调用。
  3. 用一段真实中文笔记跑通：抽取 → 校验 → 写 `public/agent-runs/latest.json` → 前端读取。
- 预计耗时：2–3 小时。
- 需要平台功能：Agent 定义、Skill 加载、本地脚本、文件读写。
- 你要亲自做：在主界面点一遍知识库；提供一段真实中文笔记（不要示例数据）。
- 验收：产出 `docs/d1-capability.md`，逐项写"可用/不可用/受限"，并附一次真实运行的 JSON。

### 任务 3：止损与留痕（今天，30 分钟）

- 具体任务：把当前 17 个未跟踪文件提交到 git；建立 `docs/iteration-log.md`，补写今天这一条（之前问题 → 本次修改 → 使用平台功能 → 测试结果 → 下一步）。
- 预计耗时：30 分钟。
- 需要平台功能：无。
- 你要亲自做：确认提交信息与是否公开仓库。
- 验收：`git status` 干净；迭代日志有 2026-11-05 一条真实记录。

---

## 现在你应该在 DeepWorks 中先创建什么、配置什么、测试什么

### 先创建（只建骨架，不写业务）

```text
data/
  films.json                 # 先放 10 部你真正看过的电影，人工核对
  taxonomy.json              # 六维 + 中英主题/情绪词表
  user-memory/               # 私有，加入 .gitignore
    records.json
    corrections.json
    snapshots.json
public/agent-runs/           # Agent 输出，前端读取
.opencode/agents/
  reflection.md              # 先只建这一个 subagent
.opencode/skills/
  review-extract/SKILL.md
  review-extract/scripts/extract.py
```

### 先配置

1. `.gitignore` 加入 `data/user-memory/`、`.deepworks/tmp/`、`uploads/`。
2. 前端增加一个只读入口：`Load latest DeepWorks run`，读 `public/agent-runs/latest.json`；没有文件时明确显示 "No DeepWorks run yet"，不回退到本地规则冒充。
3. 给现有本地规则结果统一加 `Prototype · local rules` 标签；DeepWorks 结果加 `DeepWorks run · <run_id>`。
4. Agent 的 system prompt 里写死：只能输出 JSON；`quote` 必须是原文子串；不得输出 taxonomy 外标签；不得自报置信度。

### 先测试（按顺序，别跳）

1. **中文抽取**：输入 100–200 字中文笔记，输出 ≥2 条证据，`quote` 全部能在原文中 `includes` 命中。
2. **确定性计算**：同一组记录跑两次 `taste-update`，输出必须完全一致（可复现）。
3. **纠错回流**：加一条 correction 后重跑，snapshot 必须变化，且 diff 指向该 correction。
4. **样本不足**：只有 1–2 条记录时，必须返回 `thin=true`，不生成强结论。
5. **端到端**：DeepWorks 跑完 → 前端刷新 → 画像变化可见；断网时仍能展示预跑结果。

---

## 附：本评审的证据与局限

**已实测**
- `npm run typecheck` 通过（2026-11-05）。
- DeepWorks 会话可执行本地 Python/Node、读写工作区。
- `.opencode/agents/deepworks.md` 定义当前生效，证明 Agent 由工作区文件驱动。
- 项目 Skill 与全局 Skill 均被会话识别，证明 `.opencode/skills/<name>/SKILL.md` 生效。
- `analyst.ts` 中文字符数 = 0。
- `DimensionCard.tsx` 第 27–30 行只做展示层 ×0.84；`tasteEngine.computeSnapshot` 不读 feedback。

**未验证（不得写成已实现）**
- 平台知识库的文件接入与检索 API。
- 比赛账号的自定义 subagent / Skill 脚本执行权限。
- 前端实时读取 Agent 结果的官方通道（当前设计为文件交接）。
- 平台是否有可视化工作流编排。
- 账号额度与单次运行成本。

**材料冲突**
- 任务书提到的《Frame by Frame 项目交接与 GPT 评审报告.md》实际位于 `outputs/frame-by-frame-gpt-report.md`；`docs/agent-skill-spec.md` 是更早的 v0.1 规格，两份在 Agent 数量/数据表数量上不一致。本评审以**赛制 + 当前代码事实**为准，规格书仅作设计参考。
