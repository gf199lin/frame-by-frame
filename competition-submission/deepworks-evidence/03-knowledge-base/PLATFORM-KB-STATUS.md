# 平台知识库状态核验（P2-3）

> 读取方式：DeepWorks 知识中心 `@知识中心` 真实接口（knowledge.bases.get / knowledge.list）
> 读取时间：2026-11-16 11:05（+08:00）
> 项目空间：我的工作空间（23796）
> 本轮性质：只读。未上传、未删除、未重解析、未修改任何配置。

---

## 1. 知识库基本信息

| 项 | 实际值 |
|---|---|
| 名称 | Frame by Frame - Cinema Knowledge Base |
| 知识库 ID | `4c321650-6fd5-418f-a300-b4a6760727b4` |
| 创建时间 | 2026-11-12T17:11:07.872937+08:00 |
| 知识库 `updated_at` | 2026-11-12T18:12:02.677841+08:00（自 11-12 起未再变化） |
| `knowledge_count` | **12** |
| `chunk_count` | **0**（接口原始返回值，保留不改） |
| `is_processing` | false |
| `processing_count` | 0 |
| `capabilities` | keyword=true, vector=true, wiki=false, faq=false, graph=false |
| `vector_store_status` | available（opensearch） |
| `parse_model_id` / `summary_model_id` / `embedding_model_id` | 均非空 |

## 2. 12 个文档解析状态

| 文档名称 | 解析状态 | pending | 启用检索 | error | processed_at |
|---|---|---|---|---|---|
| KB-001-narrative.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:11 |
| KB-002-character.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:19 |
| KB-003-emotion.md | completed | 0 | enabled | 空 | 2026-11-12 18:07:08 |
| KB-004-ending.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:21 |
| KB-005-visual.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:16 |
| KB-006-visual.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:20 |
| KB-007-sound.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:27 |
| KB-008-narrative.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:17 |
| KB-009-character.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:24 |
| KB-010-thematic.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:27 |
| KB-011-narrative.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:27 |
| KB-012-thematic.md | completed | 0 | enabled | 空 | 2026-11-12 19:13:28 |

**结论**：12/12 文档解析完成，无失败、无超时、无错误信息。自 11-13 至 11-16 状态未再变化。

**配置差异（事实）**：KB-003 的 `process_overrides` 仅剩 `parser_engine_rules`，缺少 `chunking_config` 与 `question_generation_config`；其余 11 个文档配置完整（512/80/父子块）。成因是 18:07 的单独重解析，早于 18:12 的规则保存。

## 3. 已完成的真实检索命中（新增事实）

在知识中心「检索测试」界面，以「资源检索 / 整个知识库 / 关键词检索」方式执行，取得真实命中：

| 编号 | 查询词 | 命中片段数 | 返回文档 | 状态 |
|---|---|---:|---|---|
| T1 | 角色 | 2 | KB-002-character.md | ✅ 成功 |
| T2 | 克制 | 4 | KB-003-emotion.md | ✅ 成功 |
| T3 | 结局 | 3 | KB-004-ending.md | ✅ 成功 |

**这改变了一件重要的事**：知识库**确实可检索**，且关键词索引已生效。

但必须限定范围：**仅证明了 KB-002、KB-003、KB-004 三条知识可被检索命中。** 其余 9 条（KB-001、005–012）尚无任何检索证据，不得推断为“已完成索引”。

## 4. `chunk_count = 0` 与检索成功的并存

这是当前最需要解释的差异。

### 4.1 原始事实

- 接口 `chunk_count`：**0**，自 11-12 起未变；
- 知识库 `updated_at`：**18:12:02**，早于 11 个文档的 `processed_at`（19:13）；
- 检索实测：**有真实片段命中**。

### 4.2 三种可能（均为假设，未验证）

| 假设 | 支持点 | 反证/疑点 |
|---|---|---|
| A. 统计字段刷新延迟/未回填 | 库级 `updated_at` 停留在 18:12，未随 19:13 的处理刷新；统计通常由异步任务写入 | 三组检索命中说明数据层已有内容，字段却长期为 0，延迟达 3 天仍未刷新，不太像普通延迟 |
| B. 统计口径差异 | `chunk_count` 可能只统计某一类分块（如仅父块、仅某状态分块），而检索走的是另一路 | 无法从接口验证口径定义 |
| C. 字段本身未实现/未写入 | 该字段可能始终返回 0，与真实索引无关 | 无平台文档可证 |

**当前不能判定是哪一种。** 唯一确定的是：`chunk_count` 不能作为“索引是否存在”的可靠判据。

### 4.3 处置原则

- 保留接口原始返回值 0，不改写；
- 保留三组检索成功证据；
- 不为让数字“看起来正常”而修改任何知识库配置（本轮未做任何修改）；
- 后续只以“检索命中”作为索引可用性的直接证据。

## 5. 四态结论（严格区分）

| 状态 | 判定 | 依据 |
|---|---|---|
| 文件上传 | ✅ 已完成 | `knowledge_count=12`，`file_hash` 与本地一致 |
| 文档解析 | ✅ 已完成 | 12/12 completed，error 为空 |
| 索引生成 | 🟡 **部分验证** | KB-002/003/004 可检索命中；其余 9 条未验证 |
| 检索命中 | ✅ **已验证（3 组）** | T1–T3 真实命中；T4/T5 未执行 |

## 6. 未取得的信息

- 单文档分块数量（接口不返回）
- 知识库概览页的分块数量界面值（未采集截图）
- 索引完成时间（无该字段）
- 其余 9 条知识的检索证据
- T4 / T5 测试结果
