# PROFILE_CONFIDENCE_MODEL.md

**Frame by Frame 画像可信程度与证据评估方案**
提案版本：v1.0.0-draft ｜ 日期：2026-11-16 ｜ 状态：**待确认，未实施**

> 本文区分三类内容，不得混读：
> `[现状]` 已核实代码行为；`[提案]` 设计建议、未校准；`[未验证]` 必须跑过才算数。

---

## 1. 问题

当前两端的「可信度」都由**记录条数**主导：

- `[现状]` 网站：`sampleFactor = 1 - e^(-n/3.2)`，`n = rows.length`（证据行数，不是笔记数）。
- `[现状]` DeepWorks：维度 `confidence = min(0.9, 0.15 × noteCount)`，整体 `overall = 平均观测置信度 × min(1, N/3)`。

这带来三个具体问题：

1. **条数 ≠ 质量。** 三条「好看」与三条有细节的笔记，得到同一个置信度。
2. **证据行 ≠ 独立样本。** 同一部片拆出 5 条证据，网站的 `n` 就变成 5，置信度显著上升——但用户只看了 1 部片。
3. **置信度是机器的数，不是用户的解释。** `0.45` 对用户没有任何意义，无法解释「为什么你觉得了解我了」。

---

## 2. 三层模型

可信度不是单一数字，而是三层证据的合成。

```
证据层 (evidence)  →  维度层 (dimension)  →  整体层 (overall)
  q_i                 conf_d                 stage + conf_overall
```

### 2.1 证据层：单条证据是否可信

| 因子 | 含义 | 取值 `[提案]` |
|---|---|---|
| `verbatim` | quote 是否能逐字命中笔记 | 命中 1.0；未命中 → 该证据直接排除 |
| `attribution` | 来源是否完整 | 双 ID 齐全 1.0；缺一项 0.6；`unknown_compat` 0.4 |
| `separation` | interpretation 是否独立于 quote | 通过 1.0；混写 → 排除 |
| `user_verdict` | 用户是否确认 | accepted 1.0；edited 0.9；unreviewed 不计入 |
| `model_confidence` | 模型自评 | 直接用，但上限 0.9 |

单条权重：`q_i = attribution × user_verdict × (0.3 + 0.7 × model_confidence) × strength`

与 `[现状]` 网站 `tasteProfile.ts:78-82` 的乘式结构一致（`depth × conviction × confidence × strength`），差别在于本文把 `attribution` 显式化、把 `depth` 移到笔记级 `q`。

### 2.2 维度层：这条轴是否可以被判断

```
conf_d = saturation(N_eff) × base_quality(q̄) × consistency × feedback
```

| 分量 | 公式 `[提案]` | 说明 |
|---|---|---|
| `saturation` | `1 - e^(-N_eff / 2.5)` | 边际收益递减。`N_eff = 3` → 0.70；`6` → 0.91；`12` → 0.99 |
| `base_quality` | `0.55 + 0.45 × q̄` | 质量差的样本无法撑起高置信度，最低 0.55 |
| `consistency` | `1 - clamp(stdev(direction×strength) / 1.15, 0, 0.5)` | 方向越一致越可信；与网站现有实现同构 |
| `feedback` | agree 1.06 / not-quite 0.6 / corrected 0.32 / 无 1.0 | 沿用网站 `tasteProfile.ts:45-51` |
| 上限 | `min(0.9, …)` | 不允许任何维度达到「确定」 |

为什么用 `2.5` 做尺度：现有网站用 `3.2`、DeepWorks 用 `0.15/条`（等价于 6 条满 0.9）。`2.5` 使 3 条有效笔记约达 0.70、6 条约 0.91，介于两者之间。**这是设计选择，不是拟合结果。** `[提案]`

### 2.3 整体层：是否进入下一阶段

整体可信度不取平均，而取**最弱环节**：

```
conf_overall = min(conf_d over observed dimensions) × coverage_factor
coverage_factor = min(1, D_obs / 4)
```

理由：一个维度很强、其余全空，不能说明「理解了这个用户」，只能说明「了解了他的一个侧面」。

阶段判定使用 `PROGRESSIVE_UNDERSTANDING_SPEC.md` §4 的 `N / N_eff / D_obs / D_suf / F`，**不直接使用 `conf_overall` 的门槛值**，避免又退回「单一数字决定一切」。

---

## 3. 与两端现有实现的对照

### 3.1 网站 `computeTasteProfile`

| 现状 | 位置 | 与本文的差异 |
|---|---|---|
| `n = rows.length`（证据行） | `tasteProfile.ts:121` 附近 | 应为独立笔记/电影数；当前会放大单片影响 |
| `sampleFactor = 1 - e^(-n/3.2)` | 同上 | 与 `saturation` 同构，尺度 3.2 vs 2.5 |
| `consistency = 1 - clamp(stdev/1.15, 0, 0.55)` | 同上 | 基本一致 |
| `sufficient = n ≥ 3 && conf ≥ 0.32 && consistency ≥ 0.45` | 同上 | 门槛明显低于本文提案 |
| `thin = !sufficient` | `tasteProfile.ts:158` | 语义正确，保留 |
| `value = 0.5 + lean/2`，恒有数值 | `tasteProfile.ts` 约 160 | 即使 `thin` 也有分数，展示层需压制 |

### 3.2 DeepWorks `profile.mjs`

| 现状 | 位置 | 与本文的差异 |
|---|---|---|
| `confidence = min(0.9, 0.15 × noteCount)` | `profile.mjs:157` | 纯条数，无质量项 |
| `sufficient = noteCount ≥ 2` | `:160` | 与阈值文件一致，但未看质量 |
| `overall = 平均观测置信度 × min(1, N/3)` | `:185-188` | 平均而非最弱环节 |
| `provisional` + `provisional_reasons` | `:173-183` | ✅ 做得好，建议保留为跨端标准字段 |
| `notes_used` / `corrections_applied` | `:228-230` | ✅ 可追溯，建议两端统一 |
| `delta_vs_prior` 仅在传 `--prior` 时存在 | `:242` | 变化可见性依赖调用方 |

### 3.3 第二套网站逻辑（需注意）

`[现状]` `src/lib/ai/tasteEngine.ts:162` 另有一套 `thin: usable.length < 3 || confidence < 0.3`。

这意味着网站内部已存在两个「可信度」定义。本规范不裁定哪个正确，但要求：**任何对外文案只能引用一处判定**，否则会出现「画像页说稳定、签名页说样本不足」。

---

## 4. 阈值登记

**现有阈值（代码中真实存在，不得私自复制）**

| 常量 | 值 | 位置 |
|---|---|---|
| `overallMinNotes` | 3 | `profile-thresholds.mjs` |
| `overallMinDimensions` | 3 | 同上 |
| `overallMinSufficientDimensions` | 2 | 同上 |
| `dimensionMinNotes` | 2 | 同上 |
| 网站 `sufficient` | n≥3 / conf≥0.32 / consistency≥0.45 | `tasteProfile.ts` |
| 置信度上限 | 0.9 | 两端一致 |

**提案阈值（未生效，待校准）**

| 常量 | 建议值 | 依据 |
|---|---|---|
| `stage2MinEffectiveNotes` | 3 | 与现有 `overallMinNotes` 对齐 |
| `stage2MinEffectiveSample` | 2.0 | 允许「少而精」：两条 q=1.0 的笔记可进入阶段 2 |
| `stage3MinEffectiveNotes` | 6 | 约两倍于现有关卡，避免过早「稳定」 |
| `stage3MinFilms` | 4 | 跨片重复才算倾向 |
| `stage3MinObservedDims` | 4 | 至少覆盖 2/3 维度 |
| `saturationScale` | 2.5 | 见 §2.2 |

这些数字**没有经过任何真实数据验证**。校准方法见 §6。

---

## 5. 不确定性的表达映射

机器字段 → 用户语言，必须一一对应，不允许出现「字段说 provisional、文案说稳定」。

| 机器状态 | 用户可见表述 | 禁止表述 |
|---|---|---|
| `unobserved` | 「这方面还没有足够的记录」 | 「你不喜欢 X」「中性」 |
| `observed` + `provisional` | 「目前的一个观察」 | 「你的偏好」 |
| `observed` + `sufficient` + 阶段 2 | 「可能是比较稳定的倾向」 | 「你就是」 |
| 阶段 3 | 「随着记录增加，逐渐发现」 | 「最终结论」 |
| `ambivalent_evidence_count > 0` | 「你在这一点上有过两种相反的感受」 | 「你其实没感觉」 |
| `neutral_evidence_count > 0` | 「你明确表示过这方面不太在意」 | 「中性偏好」 |

---

## 6. 校准方法（未执行）

1. 收集至少 30 条真实笔记（覆盖 ≥ 10 部电影、≥ 3 个用户）。
2. 对每条笔记人工标注：是否含该维度证据、方向、质量档位。
3. 计算提案公式与人工标注的一致性（建议 Cohen's κ）。
4. 只在 κ ≥ 0.6 后才把提案阈值写入代码。

**在此之前，任何「阈值已优化」的说法都是假的。** `[未验证]`

---

## 7. 反模式清单

| 反模式 | 后果 | 防线 |
|---|---|---|
| 用 `rows.length` 当样本量 | 单片多证据 → 假稳定 | 按电影去重后再计数 |
| 用 `noteCount` 单独决定置信度 | 三条废话 = 三条洞见 | 引入 `q` |
| 平均值代替最弱环节 | 一维极强掩盖五维空白 | `min()` + 覆盖因子 |
| 置信度取整到 0.9 以上 | 暗示确定性 | 硬上限 0.9 |
| 把 `thin` 只用于 UI 灰度 | 数据层仍输出确定值 | 阶段判定与展示同源 |
| 丢弃 `ambivalent` 证据 | 有证据却显示「无数据」 | 见报告 §2 第 2 条 |
