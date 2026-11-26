# 会话内跨记录审美分析复跑报告

日期：2026-11-17
运行形态：DeepWorks 会话内 Agent（`film-curator`）独立复跑，手动按契约执行，**不是平台 Run**。

## 0. 材料与边界声明

- 输入笔记来自 `src/data/seed.ts`。该文件第 36–38 行自述：“笔记为原型撰写，并非真实观众调查数据。”因此本报告的一切结论只用于验证流程与契约，**不代表真实用户审美**。
- `provenance.kb_provider = "none"`，`provenance.kb_note = "本会话无 sass_search；平台知识库 NOT RUN，未使用本地库冒充"`。
- `provenance.run_id_kind = "session-rerun-not-platform"`；`run_id` 为 `session-rerun-20261117-a|b|c`，由本次会话人工指定，不是平台签发。
- 平台 Run、平台 run_id、平台截图、`sass_search` 检索、`run-record.json` 均 **NOT RUN / 未生成**。
- 三个案例全部证据引用逐字取自 seed 原文；校验使用 `workflow/validate-taste-evolution.mjs --records-file`。

## 1. 案例结果

| Case | 新记录 | observation_id | stage | confidence | 支持证据 | 反向证据 | validation ok |
|---|---|---|---|---|---|---|---|
| A 新倾向出现 | `rec_lalaland`（La La Land, 2016） | `obs_ending` | `emerging` | 0.31 | 1 | 0 | `true` |
| B 已有倾向验证 | `rec_manchester`（Manchester by the Sea, 2016） | `obs_ending`（复用，未新建） | `emerging` | 0.44 | 2 | 0 | `true` |
| C 反向证据 | `rec_shawshank`（The Shawshank Redemption, 1994） | `obs_ending`（复用） | `evolving` | 0.38 | 2 | 2 | `true` |

### Case A：新倾向出现

- 新记录 `rec_lalaland`；`history.records` 含 7 部其他 seed 电影（Inside Out / Interstellar / Good Will Hunting / The Grand Budapest Hotel / The Truman Show / Eternal Sunshine / Dead Poets Society），`observations`、`feedback`、`snapshots` 均为空。
- 形成 `obs_ending`（dimension `ending`，标题「结局不替你结清」），置信度 0.31（< 0.62），阶段 `emerging`。
- 引文：“它用五分钟让你活一遍「一切都成了」的版本，然后不带恶意地收回去。”
- `snapshot.changes[0].kind = "created"`，快照 `snap_session_rerun_a1`。

### Case B：已有倾向得到验证

- 新记录 `rec_manchester`；`history` 含 Case A 的观察对象与 `snap_session_rerun_a1`。
- 引文：“有些失去不会解决，它们只是变成了天气的一部分。”方向与 A 一致，归为 `supporting`。
- 必须复用 `obs_ending`：`observations[]` 只有 1 条，未新建重复观察。
- 只有 2 部独立电影，阶段保持 `emerging`；`snapshot.changes[0].kind = "updated"`，reason 明确写“未达 3 部门槛”，置信度 0.31 → 0.44。

### Case C：反向证据

- 新记录 `rec_shawshank`；`history` 含 Case B 的观察与 A/B 两份快照。
- 两条引文均标 `contradicting`，未归入 supporting：
  - “结果还是在雨中那场戏投降了。”
  - “这里的希望不是口号，而是一份需要每天维护的日程表。”
- 反向证据占比 2/4 = 0.5（≥ 0.3），阶段进入 `evolving`，置信度 0.38；`contradicting_evidence_ids` 保留两条反向证据，未删除。
- 加权方向 signed 合计约 -0.12（接近零），`dimensions[0].lean = -0.12`。

## 2. 平台运行验证（证明不能冒充平台）

命令：

```powershell
node workflow/verify-platform-run.mjs --dir outputs/p0-platform/rerun/case-c --out outputs/p0-platform/rerun/case-c/platform-verification.json
```

结果：

- `ok: false`
- 退出码：**1**
- `failures`：`missing run-record.json`、`missing kb.json`、`kb.json missing: record platform retrieval or the explicit unavailability reason`、`no platform screenshot larger than 20 KB (.png/.jpg)`
- `checks` 中包含 `evolution.json passes contract validator`（说明失败仅来自缺失的平台运行证据，而非契约不合法）。

**因此这不是平台运行。** 缺失的 `run-record.json`、平台知识库检索记录、平台截图没有补造，也不应补造。

补充说明：首次对 `case-c` 运行时，该目录只有 `note.txt`（肖申克单篇），verifier 走单笔记回退，把跨记录引文误判为不在肖申克笔记中。随后把第 2 步生成的真实 `records.json` 放入 `case-c`（verifier 明确支持该可选文件），复跑后失败项收敛为上述 3 类平台证据缺失。

## 3. 与 `outputs/taste-evolution/phase2` 的差异

phase2：A `emerging` 0.34 → B `emerging` 0.46（updated）→ C `evolving` 0.41，C 支持 2 / 反向 2。

本次复跑结论方向一致：同样是 `obs_ending` 从 `emerging` 经同向验证仍停 `emerging`，在肖申克处因反向证据进入 `evolving`。差异如下：

1. **置信度更保守**：A 0.31（phase2 0.34）、B 0.44（0.46）、C 0.38（0.41）。
2. **Case A 证据原句不同**：本次用“它用五分钟……收回去。”（直接描述结尾收回“一切都成了”）；phase2 用“野心和爱，并不总能放进同一个画框。”两条都逐字成立，但本次更贴近“结局是否被结清”。
3. **Case C 维度 lean 不同**：本次 `-0.12`，phase2 `-0.05`；两者都接近零，都支持“方向冲突”。
4. **provenance 不同**：本次 `source="session-rerun"`、`run_id_kind="session-rerun-not-platform"`、`kb_provider="none"`；phase2 为 `source="deepworks"`、`run_id_kind="derived-from-session-and-message-id"`、`kb_provider="file"`。
5. **快照命名独立**：`snap_session_rerun_a1/b2/c3`（phase2 为 `snap_dw_a1/b2/c3`）。

注：`records.json` 的 `note_sha256` 与 phase2 相同（0dd1e3…、1c6995…、c0eaf8…），因为两处都取 `src/data/seed.ts` 中对应 `reflection` 的完整原文。

## 4. 生成文件

- `outputs/p0-platform/rerun/records.json`（3 条待分析记录）
- `outputs/p0-platform/rerun/history-records.json`（Case A 的历史对照记录，7 部 seed 电影原文）
- `outputs/p0-platform/rerun/case-a/{note.txt,input.json,evolution.json,validation.json}`
- `outputs/p0-platform/rerun/case-b/{note.txt,input.json,evolution.json,validation.json}`
- `outputs/p0-platform/rerun/case-c/{note.txt,input.json,evolution.json,validation.json,records.json,platform-verification.json}`
- `_work/rerun/build-records.mjs`、`build-history.mjs`（一次性辅助脚本，已移出产物目录）
- `outputs/p0-platform/rerun/RERUN-REPORT.md`（本文件）

## 5. 最终声明

本次是**会话内复跑**，输入为 seed 原型笔记（非真实用户数据）；涉及平台的 Run、平台 `run_id`、`sass_search` 检索**全部 NOT RUN**，三份 `evolution.json` 均不含平台运行证据，verifier 已以 `ok:false`、退出码 1 证明其不能冒充平台运行。
