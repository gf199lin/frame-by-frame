# 平台界面截图清单（需本人手动完成）

## 为什么必须由你截

当前 Agent 的工具面只有 `openwork-browser/open_url` 等动作，**没有截图或屏幕捕获**；DeepWorks 主界面受保护，Agent 不能驱动，也不能抓取。知识中心本轮未 `@知识中心`，按访问边界不能打开。

因此本目录不会出现任何“模拟界面”。下面 8 张需要你在 DeepWorks 里手动截，截完放回对应目录即可。

## 通用要求

- 直接截 DeepWorks 窗口，不裁剪掉平台名称、页面标题、Agent 名称、状态。
- 保留原始 PNG，不压缩、不二次编辑；需要遮挡账号/Token 时用纯色块，并在文件名后加 `-redacted`。
- 每张截图右下角或文件名带日期，例如 `S02-agent-config-20261119.png`。
- 不使用网站页面、设计稿、JSON 渲染图代替。

## 01-agent-configuration/

| 文件名 | 页面 | 必须可见 | 优先级 |
|---|---|---|---|
| `S01-agent-mention.png` | 新建会话 → 输入框输入 `@` | `@` 列表中的 `film-curator` 与 `知识中心`、顶部模型名 | 高 |
| `S02-agent-session.png` | 选中 `@film-curator` 后 | 输入框里的 `@film-curator` 标签、顶部 `DeepSeek-V4.1-Flash` | 高 |

> 当前 DeepWorks 没有独立的 Agent 管理页，`film-curator` 以 `@` 提及方式调用。不要再找“智能体列表/配置详情”页面；用上面两张证明“平台可识别并调用该 Agent”。

## 02-skills-configuration/

| 文件名 | 页面 | 必须可见 | 优先级 |
|---|---|---|---|
| `S03-skill-knowledge-retrieval.png` | 项目 Skills → `cinema-knowledge-retrieval` | Skill 名称、功能描述、关键脚本/配置 | 高 |
| `S04-skill-note-analysis.png` | 项目 Skills → `film-note-analysis` | 名称、描述、六维证据/逐字引用要求 | 高 |
| `S05-skill-taste-profiling.png` | 项目 Skills → `cinema-taste-profiling` | 名称、描述、收缩/样本不足规则 | 高 |

## 03-knowledge-base/

| 文件名 | 页面 | 必须可见 | 优先级 |
|---|---|---|---|
| `S06-kb-entries.png` | `@知识中心` → `Frame by Frame - Cinema Knowledge Base` → 文档列表 | 知识库名称、12 条文档（至少同时看到 KB-001 与 KB-012）、解析状态 `completed` | 高 |

> 若列表一屏放不下 12 条，截两张：`S06a-kb-entries-01-06.png`、`S06b-kb-entries-07-12.png`。

## 04-knowledge-retrieval/

| 文件名 | 页面 | 必须可见 | 优先级 |
|---|---|---|---|
| `S07-kb-retrieval-restraint.png` | 知识中心 → 索引与解析 → 检索测试 | 查询词「克制」、范围「整个知识库」、方法「关键词检索」、命中片段、返回 `KB-003-emotion.md` | 高 |

> 已有 T1–T3 截图请一并放入：`T1-role-keyword.png`、`T2-restraint-keyword.png`、`T3-ending-keyword.png`。这三张此前由你执行并持有，但未归档。

## 05-agent-execution/

| 文件名 | 页面 | 必须可见 | 优先级 |
|---|---|---|---|
| `S08-agent-run.png` | DeepWorks 会话内，`film-curator` 运行 | Agent 名、模型、输入笔记、工具/技能调用、最终 JSON 或结果摘要 | 最高 |
| `S08b-run-output.png` | 同上，输出区域 | `run_id`、`kb_status`、3 条引用、`profile_delta` 摘要 | 最高 |

> 可直接打开本会话（`ses_e126800a7ffeDFT2OFUySxUbkB`）截图。不要把网站 `/taste` 页面截进来。

## 06-quality-gates/

| 文件名 | 来源 | 必须可见 | 优先级 |
|---|---|---|---|
| `S09-quality-gates.png` | 本机终端或 JSON 查看器 | `validate-evidence`、`validate-citations`、`validate-run` 三处 `"ok": true` | 中 |

> 这张不是平台界面，属于本地校验输出；文件名与 README 中要注明，避免被误认为平台截图。

## 截完后的自检

- [ ] 8 组截图都存在，且能看清 Agent 名、模型、知识库名、查询词。
- [ ] `S06` 能证明 12 条文档，不是只看到 1–2 条。
- [ ] `S07` 的查询词与命中文档同框。
- [ ] `S08` 没有把网站页面截进来。
- [ ] 所有遮挡都只遮账号/Token，没有遮掉结论字段。

## 插入位置建议

### 项目说明书

| 截图 | 章节 | 用法 |
|---|---|---|
| S01 + S02 | 二、项目说明 → 实现方法（Agent 配置） | 证明 Agent 真实存在、模型与温度可核 |
| S03–S05 | 二、项目说明 → 技能与工具 | 证明 3 个 Skill 职责分开 |
| S06 | 二、项目说明 → 知识与数据 | 证明 12 条文档进入平台库 |
| S07 | 五、交付附件 → 平台使用证明 | 证明知识库可检索 |
| S08 | 二、项目说明 → 核心流程 / 五、附件 | 证明分析在 DeepWorks 内执行 |
| S09 | 五、交付附件 | 证明四道质量门实际通过 |

### 路演 PPT

| 截图 | 页码 | 用法 |
|---|---|---|
| S02 | PART 02「智能体配置」（约 S13） | 右侧半版，左侧保留文字要点 |
| S03–S05 | PART 02「技能与工具」（约 S11） | 三张小图并排，各配一句职责 |
| S06 + S07 | PART 02「知识与数据」（约 S12） | 左文档列表、右检索命中 |
| S08 | PART 03「结果展示」（约 S16） | 运行界面 + 一行结论，不放大段 JSON |
| S09 | PART 03「质量门」（约 S17） | 只截三处 `ok: true`，作为角标 |

> 页码以最终 19 页版本为准；插入时优先保证“一页一个结论”，不要把截图缩到看不清。
