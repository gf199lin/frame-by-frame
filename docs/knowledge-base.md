# Frame by Frame · 电影审美知识库

> 文件：`knowledge/entries.json`（12 条）、`knowledge/index.json`（索引）、`knowledge/SOURCES.md`（来源）
> 检索：`.opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs`
> 状态：**项目文件型知识库已建立并被真实检索**；**DeepWorks 知识中心尚未创建**（需账号授权，见第 5 节）。

## 1. 条目清单

| ID | 标题 | 领域 | 主要用途 |
|---|---|---|---|
| KB-001 | 叙事：因果链、省略与留白 | narrative | 慢热/强情节、留白与参与 |
| KB-002 | 人物：欲望、缺陷与转变 | character | 人物驱动 vs 群像 |
| KB-003 | 情绪：克制、间离与延迟反应 | emotion | 克制/含蓄 vs 浓烈 |
| KB-004 | 结局：闭合、开放与苦涩的未解 | ending | 闭合/开放/未解 |
| KB-005 | 视觉：景别、视角与代入距离 | visual | 景别、视角、自然/风格化 |
| KB-006 | 光线与色彩：情绪的第二套语法 | visual | 光线、色彩、冷暖 |
| KB-007 | 声音：静默、环境声与声画对位 | sound | 静默、环境声、配乐 |
| KB-008 | 剪辑：节奏、省略与动作连续性 | narrative | 节奏、省略、长镜头 |
| KB-009 | 表演：微表情、身体与留白 | character | 微表情、身体、停顿 |
| KB-010 | 主题：作者表达、语境与多义性 | thematic | 主题、语境、多义 |
| KB-011 | 类型：期待、契约与违背 | narrative | 类型惯例与打破 |
| KB-012 | 观影记忆：重看、互文与个人经验 | thematic | 重看、互文、记忆 |

## 2. 来源与授权

- 全部为**项目原创摘要**，基于公开电影理论概念重新表述；未复制长篇影评、书籍章节或付费内容。
- 每条条目的 `source` 字段统一为“原创整理（基于公开电影理论概念，未复制原文）”。
- 授权：`CC BY 4.0（本项目原创摘要）`。
- 如后续引入外部语料，必须在 `entries.json` 中逐条登记来源与授权，并单独审查；不得直接粘贴受版权保护的长文。

## 3. 检索方式

```powershell
node knowledge/scripts/build-index.mjs
node .opencode/skills/cinema-knowledge-retrieval/scripts/retrieve.mjs --input outputs/p0/inputs/run-01.json --top 4
```

- 当前使用**确定性关键词/二元组匹配**，不是向量检索。
- 分数只表示关键词重合度；引用前必须阅读完整条目。
- 返回 `kb_id`、标题、来源、授权、分数、命中词、摘要片段。
- 最高分 < 2 时视为无相关条目，允许 `kb_status=no_relevant_entry`，不强行引用。

### 三次运行的实际引用

| 运行 | 检索 top | 实际引用 |
|---|---|---|
| `fbf-p0-20261109-01` | KB-004, KB-012, KB-003, KB-009 | KB-004（结局）、KB-003（情绪克制）、KB-009（表演/身体） |
| `fbf-p0-20261109-02` | KB-008, KB-007, KB-009, KB-006 | KB-007（声音）、KB-008（剪辑节奏）、KB-006（色彩） |
| `fbf-p0-20261109-03` | KB-012, KB-001, KB-003, KB-004 | KB-001（叙事留白）、KB-003（情绪细节）、KB-004（开放结局） |

## 4. 引用规范

最终 JSON 的每条 `kb_citations` 必须包含：

```json
{
  "kb_id": "KB-003",
  "title": "情绪：克制、间离与延迟反应",
  "source": "原创整理（基于公开电影理论概念，未复制原文）",
  "excerpt": "必须逐字来自该条目 text",
  "why_relevant": "必须指向笔记里的具体词或选择"
}
```

`validate-citations.mjs` 会拒绝不存在的 `kb_id`、标题/来源不一致、`excerpt` 不逐字、`why_relevant` 为空。

## 5. DeepWorks 知识中心（待授权）

当前知识库是项目文件型，已由 Skill 脚本真实检索；**不是 DeepWorks 知识中心知识库**。本轮没有知识中心访问授权，因此不声称已创建平台知识库。

需要你本人操作：

1. 打开 DeepWorks → 知识中心 → 新建知识库，名称：`Frame by Frame 电影审美`。
2. 上传 `knowledge/entries.json` 中的 12 条内容（或逐条粘贴为 Markdown）。
3. 等待索引完成，记录知识库 ID、条目数、索引时间。
4. 创建 `knowledge/platform-kb.json`：

```json
{
  "provider": "deepworks-knowledge-center",
  "knowledge_base_id": "<填写>",
  "name": "Frame by Frame 电影审美",
  "entry_count": 12,
  "indexed_at": "<填写>"
}
```

5. 在知识中心检索“克制”“结局”“类型”，确认能返回对应条目。
6. 把知识库 ID 告知我，我把检索 Skill 的平台知识库适配层接上。

**预期结果：** 知识中心显示 12 条；检索“克制”返回 KB-003，“结局”返回 KB-004，“类型”返回 KB-011。完成前，比赛材料中只能写“项目知识库”，不能写“DeepWorks 知识中心知识库”。

## 6. 维护

- 新增条目：在 `entries.json` 增加对象 → 运行 `build-index.mjs` → 重跑一次检索测试。
- 修改条目：保留 `id` 不变；若删除，必须同步清理引用与历史运行记录中的引用说明。
- 每季度复核一次来源与授权。
