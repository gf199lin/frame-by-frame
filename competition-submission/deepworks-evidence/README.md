# DeepWorks 平台使用证明

采集日期：2026-11-19
会话：`ses_e126800a7ffeDFT2OFUySxUbkB`
消息：`msg_1f3059e64001zntzH7M7H1owrP`
Agent：`film-curator`
模型：`dth/DeepSeek-V4.1-Flash`

本目录用于回答一个问题：**Frame by Frame 是否真的在 DeepWorks 内配置了 Agent、Skills、知识库与分析流程，并有真实运行结果。**

答案分两层：

1. **配置与运行有真实文件证据**：Agent 配置、3 个 Skill、12 条知识、3 次 `sass_search` 原始返回、1 次会话内完整运行、3 个验证器与 4 项质量门检查，全部可逐字复核。
2. **平台界面截图已归档 11 张**：S01/S02（@ 列表与会话模型）、S03（`/` 技能列表）、S06a–c（12 条文档）、S07（检索「克制」→ KB-003）、S08/S08b（运行与输出）。清单见 [SCREENSHOT-CHECKLIST.md](SCREENSHOT-CHECKLIST.md)。

本目录**不含**任何模拟界面、设计稿或网站截图。

## 目录

```text
deepworks-evidence/
├── 01-agent-configuration/   Agent 文件、配置摘要、会话上下文
├── 02-skills-configuration/  3 个 SKILL.md、索引与 SHA256
├── 03-knowledge-base/        平台知识库记录、12 条清单、解析状态
├── 04-knowledge-retrieval/   3 份 sass_search 原始转录、检索摘要
├── 05-agent-execution/       本次会话内运行的输入、检索、画像、run.json
├── 06-quality-gates/         3 个验证器的校验输出
├── README.md
├── EVIDENCE-INDEX.md
├── FINAL-EVIDENCE-AUDIT.md   最终一致性审查
├── SCREENSHOT-CHECKLIST.md
├── VERIFICATION.md
├── manifest.json             全部文件 SHA256 清单
└── verification.json         截图完整性检查（当前 ok=false）
```

## 四条必须保留的边界

1. `05-agent-execution/run.json` 是 **DeepWorks 会话内运行**（`context.agent=film-curator`），不是平台签发的独立 Run，**没有平台 Run ID**。
2. `04-knowledge-retrieval/*.platform-search.json` 是 **2026-11-16** 在 film-curator 会话内调用 `sass_search` 的真实返回转录，不是本次重跑，也不是本地 `retrieve.mjs` 结果。
3. `03-knowledge-base/PLATFORM-KB-STATUS.md` 的 12/12 completed 来自 **平台知识中心接口记录**（2026-11-16 11:05），不是界面截图；`chunk_count=0` 的原始返回值被保留，未改写。
4. 12 条中只有 **10 条**在三次 `sass_search` 返回中出现；**KB-002、KB-011 未被转录捕获**（KB-002 另有 T1 界面命中）。不能写成“12 条全部召回验证”。

## 证据能证明 / 不能证明

| 能证明 | 不能证明 |
|---|---|
| Agent `film-curator` 的模型、模式、温度与完整指令 | 平台界面上一定显示成什么样（需截图） |
| 3 个 Skill 真实存在且有独立职责 | 平台 Skill 市场/安装页的展示状态（需截图） |
| 平台知识库已创建，12 条文档上传并解析完成 | 12 条全部可召回（仅 3 条主动验证，KB-011 无召回证据） |
| `sass_search` 曾真实命中 KB-003，score 0.8177763 | 本次会话能再次调用 `sass_search`（工具未暴露） |
| 会话内完整跑通七步与质量门检查 | 平台独立 Run ID、平台运行日志面板 |
| 3 个验证器、4 项检查均为 `ok: true` | 平台界面上的质量门可视化（需截图） |

## 建议阅读顺序

1. [VERIFICATION.md](VERIFICATION.md)：先看 8 项核验的真实状态。
2. [FINAL-EVIDENCE-AUDIT.md](FINAL-EVIDENCE-AUDIT.md)：看检索来源、知识库缺口的最终审查。
3. [SCREENSHOT-CHECKLIST.md](SCREENSHOT-CHECKLIST.md)：按清单补 8 组截图。
4. [EVIDENCE-INDEX.md](EVIDENCE-INDEX.md)：每份文件对应哪条结论。
