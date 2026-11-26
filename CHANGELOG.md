# CHANGELOG

本文件记录 Frame by Frame 的真实改动。规则：

- 只写已经落盘的内容；
- 未实现的功能标注「未开始」，不得提前记为完成；
- 每条包含：做了什么、为什么、涉及文件、如何验证、遗留问题。

产品版本沿用比赛提交节奏；`架构升级` 为本次 Supabase 迁移分支。

---

## [说明书] — 2026-11-21（改名 + 评审记录表述）

- 源文件更名：`12-项目说明书正式稿-v3-20261120.md` → `12-项目说明书.md`，包内同名文件同步，构建脚本与文档引用一并更新。
- 三（三）3.2 标题由“用户反馈”改为“设计评审记录”，删除全部“模拟反馈 / 模拟案例 / 真实访谈”表述，4 条记录改为“评审发现—对应改造—可核实证据”三列，不再以用户原话形式呈现。
- 二（一）1 的证据状态改为“上述问题来自公开讨论与本人观影习惯归纳，属于产品问题假设”。
- 迭代表两行同步改写，去掉“模拟案例”“用户访谈仍为 0”字样。
- 合规第二条“脱敏或模拟数据”为模板原文，保留。
- DOCX 1,988,400 B / PDF 3,006,362 B；ZIP 312 条目 / 40.10 MB，SHA-256 `690b4e20…3dd4a92`。

---

## [说明书] — 2026-11-21（按官方模板收紧 + 签名）

- 删去文首版本说明块（版本号、依据、占位规则、更新日志），封面直接对齐官方模板字段。
- 删除第二章自行增补的「（二）3 产品功能与双端技术架构」7 个小节（约 100 行），压缩为两段并入（二）2 的正文之后，不再新增模板外章节。
- 三（三）4 个反馈案例由 6 字段长文改为总览表（原话节选 / 改造 / 提交证据），56 行压到 18 行；真实访谈 0 位、模拟反馈口径保留。
- 五章改为模板口径「该部分以 PPT、视频与附件材料呈现」，删除「现场验证记录待填」「提交前仍需处理」等过程性文字；11 张平台截图与 10 项附件清单保留。
- 合规确认改用模板四条：材料不含敏感信息 / 敏感场景已脱敏 / 赛道 B 一条填“不适用（赛道 C）” / 作品赛前未公开（已勾选）。
- 签名改为打字：队长 林春烨、队员 无（个人参赛）、日期 2026 年 11 月 21 日。
- 结果：361 行 → DOCX 1,988,449 B（176 段、11 张图）、PDF 15 页 / 2,999,472 B。
- ZIP 重打：312 条目 / 40.10 MB，SHA-256 `0f6fafbc…ebc54575`。

---

## [下线] — 2026-11-21（作品赛前不公开）

- 将 `gf199lin/frame-by-frame` 与 `gf199lin/frame-by-frame-site` 两个仓库均设为 Private。
- 验证两地址均为 404：`https://gf199lin.github.io/frame-by-frame/`、`https://gf199lin.github.io/frame-by-frame-site/`。
- 说明书合规第 3 项由 `☐` 改为 `☒`，删除原「第 3 项说明」整段，其余四项保持勾选。
- 提交包内文档同步：`00_先读我.md`、`10_提交说明/提交入口与状态.md`、核对清单与状态汇报中「展示站公开」表述全部改为「已下线」。
- DOCX 1,997,947 B / PDF 3,959,724 B 重新生成；ZIP 312 条目 / 40.90 MB，SHA-256 `3bdbda42…5968e01`。
- 评委查看路径不变：源码 + `04_项目源代码/本地预览/`（本地运行，不联网）+ 163.8 秒成片 + 说明书 11 张截图。

---

## [部署] — 2026-11-21（展示站上线）

- 新建公开仓库 `gf199lin/frame-by-frame-site`（仅构建产物，29 个文件），推送 `outputs/deploy-pages/` 内容。
- 启用 GitHub Pages：源为 `main` 分支根目录，构建方式 legacy；地址 `https://gf199lin.github.io/frame-by-frame-site/`。
- 在 `index.html` 与 `404.html` 注入底部浮动提示条「演示站：仅界面展示，登录与 AI 分析需邀请账号，完整流程见演示视频」，避免评委误判产品为空壳。
- 验证：首页 200 / CSS 200 / JS 200；headless 截图确认登录页渲染完整、提示条不遮挡内容；`/archive` 走 404.html 回退，前端路由接管。
- 说明书合规段落补上展示站地址，DOCX/PDF 重新生成并入包；ZIP 312 条目 / 40.91 MB，SHA-256 `78db22b8…1a3267`。

**下一步（本人）**：把原仓库 `frame-by-frame` 转为 Private，旧地址 `https://gf199lin.github.io/frame-by-frame/` 即 404。

---

## [提交包] — 2026-11-21（源码私密方案 + 本地预览 + 回执核对）

### 做了什么

- 新增 `04_项目源代码/本地预览/`：Vite 生产构建产物（index.html + assets + images）配零依赖 `preview-server.mjs`（Node 内置 http，SPA 回退到 index.html）与 `启动本地预览.cmd`，评委无需 `npm install` 即可在 `http://localhost:8123` 看到界面。已用 Edge headless 截图确认渲染正常。
- 新增 `本地预览/如何查看.md`：四种查看方式（视频 / 说明书截图 / 本地预览 / 源码运行）与能力边界（预览只到登录页，业务页面需登录，AI 分析需服务端密钥）。
- 另建 `outputs/deploy-pages/`：以 `VITE_BASE=/frame-by-frame-site/` 构建的纯产物版本 + `404.html`，用于「源码仓库私密 + 独立公开展示站」方案；部署步骤见同目录 `部署说明.md`。
- 说明书合规第 3 项改写：由「本人已确认继续公开」改为「源码仓库已设为私有，仅保留只含产物的展示站；第 3 项不勾选，如组委会要求可立即下线」。
- `04_项目源代码/README-启动与复现.md` 增加本地预览入口说明。

### 如何验证

- `node preview-server.mjs` 后 `/ ` 与 `/archive` 均返回 200，headless 截图见 `_work/offline-home.png`。
- ZIP 解压 312 条目，含 30 个本地预览文件；`00_先读我.md`、`10_提交说明`、README 均为最新表述。
- 包内 MP4 字节数 26,144,128，与源文件一致。

### 遗留问题

- 报名表邮箱 8138544618@qq.com 与说明书 813854618@qq.com 差一位数字，需本人在报名表「修改结果」改正。
- 展示站迁移未执行：旧地址 `https://gf199lin.github.io/frame-by-frame/` 仍需仓库转私密后才会失效。
- 真实用户访谈仍为 0 位。

---

## [提交包] — 2026-11-21（成片入包 + 说明书附件同步）

### 做了什么

- 成片以官方规范名复制入提交包：`03_演示视频/C_framebyframe_Frame by Frame.mp4`（163.833s / 1920×1080 / 26,144,128 B），同名字幕 `.srt` 一并入包。
- 12 秒未完成片段移出提交包，归档到 `_work/legacy-video/未完成片段-20261121/`，避免评委误认。
- `03_演示视频/视频状态-必读.md` 从「成片未完成」改写为成片说明（规格、9 段时间轴、提交前注意、已知局限）。
- 说明书源文同步：附件 9「演示视频」由「待补」改为已有并标注文件名与时长；附件 1 由「截图待补」改为已有；文末「提交前仍需处理」删除视频一条并更新复核时间为 11-21 18:30。
- 由 `_work/build-docx-v3.mjs`、`_work/build-pdf-v3.mjs` 重新生成 DOCX（1,998,314 B）与 PDF（3,981,544 B），并复制入包。
- 由 `_work/zip-final.mjs` 重打包：`C_framebyframe_Frame by Frame.zip`，282 条目 / 38.32 MB（40,184,149 B），SHA-256 `e215d45b…a62f35c`。
- `COMPETITION-SUBMISSION-CHECKLIST.md`、`FINAL-SUBMISSION-STATUS-20261121.md`、`00_先读我.md`、`10_提交说明/提交入口与状态.md` 同步更新。

### 如何验证

- 解压 ZIP 得 282 条目，无缺项、无 `~$`、无 `.env`。
- 包内 MP4 经 `ffprobe` 复核：h264 / 1920×1080 / 30 fps / aac / duration 163.833333。
- DOCX `word/document.xml` 含「163.8 秒」，说明附件表已更新。

### 遗留问题

- 真实用户访谈 0 位、真实反馈 0 条；合规第 3 项（决赛前不公开）与网站公网可访问冲突；报名回执与手写签名仍需本人。

---
## [演示视频] — 2026-11-21（配音重制 v3：Kangkang 男声 / 电影解说语气）

### 做了什么

- 重写旁白：21 句，去掉自我介绍式开场与功能罗列，改为可代入的叙述（「每一部电影，都不只是一次观看。」「这一次运行没有被剪辑，也没有被加速。」）。
- 更换声音：System.Speech 只有女声，改用 WinRT `Windows.Media.SpeechSynthesis` 调用 OneCore `Microsoft Kangkang`（zh-CN 男声），每句独立 SSML 设置 rate（−9% ～ −16%）与 pitch（−4% ～ −6%），离线生成 16 kHz wav。
- 电影化解说处理：`asetrate 0.97 + atempo` 再降约 3%，低频架 +3.5 dB @160 Hz、中频 −1 dB @2.5 kHz、高频 −2.5 dB @7 kHz，3:1 压缩，28/56 ms 短混响，整体 `loudnorm −17.1 LUFS`。
- BGM 相对 v2 再降 2 dB，sidechain 阈值收紧到 0.04、比率 6:1，为人声让出空间。
- 字幕按新稿重排为 21 条，仍烧录（米白字 + 半透明深蓝底条），同步覆盖 `VIDEO-SUBTITLE.srt`。
- **画面完全未动**：复用 `_work/build/silent.mp4`（9 段、163.833s、镜头顺序与转场不变），只替换音轨与字幕层。
- 旧版存档：`Frame-by-Frame-Final-Demo-v2-huihui.mp4`、`VIDEO-SUBTITLE-v2.srt`。

### 为什么

- 用户认为 v2 女声 TTS 偏「产品宣传片」，希望接近电影解说的温柔、低沉、有停顿的叙述。
- 保留 S4 中 Agent「没有 film-curator 子代理，我不会伪造」的原话，旁白只说「三个技能各司其职」，避免与画面矛盾。

### 涉及文件

- 成片：`outputs/demo-video/Frame-by-Frame-Final-Demo.mp4`（26.1 MB）
- 文稿：`VIDEO-VOICEOVER.md`（v3 全文与时间码）、`VIDEO-VOICEOVER-v3.md`（调整说明）
- 分镜：`VIDEO-STORYBOARD.md`（旁白/字幕/时间码全部更新）
- 报告：`VIDEO-EDITING-REPORT.md`、`VIDEO-QUALITY-CHECK.md`（响度、条数、字幕字号）
- 工程：`_work/vo/gen-vo-v3.ps1`、`lines-v3.json`、`durations-v3.json`、`_work/build/audio-subs-v3.mjs`

### 如何验证

- `ffprobe`：163.833s、1920×1080、30/1、AAC 48 kHz 立体声 192 kbps、26,144,128 B。
- `ebur128`：I = −17.1 LUFS，True Peak −3.8 dBFS。
- 抽帧 1s / 20s / 50s / 78s / 135s / 160s：新字幕完整、不压画面主体、长句单行可读。

### 遗留问题

- Kangkang 仍带 TTS 机械感，句间停顿靠手动排布；若要更自然需真人重录（脚本已支持替换 wav）。
- 16 kHz 源采样，高频细节有限；后期低通后听感偏「胶片」，但与真人录音仍有差距。

---

## [演示视频] — 2026-11-21（成片导出：163.833s / 1080p / 25.9MB）

### 做了什么

- 读取 `raw/` 全部 7 段并实测：S1 12.0s、S2 24.5s、S6 20.2s、S7 13.3s（1920×1080）；S3 155s、S4 100s、S5 40s（2560×1600，桌面全屏）。
- 统一归一化：S3/S4/S5 `crop=2560:1440:0:0` 切底部空白后缩放，7 段全部 1920×1080 / 30fps / yuv420p。
- 按证据画面重排 9 段结构（片头 7.5s、首页 10s、片库 24.5s、平台 26s、运行 34s、产出 22s、品味 21s、地图 13.3s、片尾 5.5s），段内 0.25s xfade、段间 0.3s 淡入淡出。
- 20 句旁白用本机中文语音（Microsoft Huihui）逐句合成，按绝对时间码 `adelay` 混音，`loudnorm` 至 −16 LUFS；BGM 用 `aevalsrc` 合成 A 小调 pad，`sidechaincompress` 随旁白压低。
- 生成 26 条字幕（后合并为 25 条），烧录（米白字 + 半透明深蓝底条），同时输出 `VIDEO-SUBTITLE.srt` 与 `Frame-by-Frame-Final-Demo.srt`。
- 修复：字幕在米白页面上不可见（改底条）、ASS 颜色 BGR 顺序写反（深棕 → 深蓝）、混音比视频短 1.9s（`apad` 补足）、旁白与画面矛盾（S4 中 Agent 明说没有 film-curator 子代理，旁白改为「三个技能约束它」）。
- 导出 `Frame-by-Frame-Final-Demo.mp4`：163.833s / 1920×1080 / 30fps CFR / H.264 High@4.1 / AAC 192k / 25.9MB / −16.0 LUFS / True Peak −2.6 dBFS。

### 为什么

- 比赛要求 ≤180 秒的真实操作演示；此前 4/7 段已录，本轮补齐 S3–S5 的剪辑与整片合成。
- S4 的自我约束原话不能剪掉，否则等于掩盖「Agent 不是 film-curator 子代理」这一真实限制。

### 涉及文件

- 成片：`outputs/demo-video/Frame-by-Frame-Final-Demo.mp4`
- 字幕：`outputs/demo-video/VIDEO-SUBTITLE.srt`、`Frame-by-Frame-Final-Demo.srt`
- 文档：`VIDEO-STORYBOARD.md`、`VIDEO-VOICEOVER.md`、`VIDEO-ASSET-MANIFEST.md`、`VIDEO-EDITING-REPORT.md`、`VIDEO-QUALITY-CHECK.md`
- 工程：`outputs/demo-video/project/`（脚本、时间表、ASS、旁白文本与时长）
- 清单：`COMPETITION-SUBMISSION-CHECKLIST.md`（演示视频改为已完成）

### 如何验证

- `ffprobe` 实测：163.833s、1920×1080、avg_frame_rate 30/1、4915 帧、H.264 High@4.1、AAC 48kHz 2ch 192k。
- `ebur128`：I = −16.0 LUFS，True Peak −2.6 dBFS。
- 抽帧核对：2s 片头、20s 片库、45s `@` 菜单、50s 技能截图、78s 运行、90s 工具调用、105s 证据页、160s 片尾，均无黑屏、无乱码、无通知弹窗。

### 遗留问题

- S3 的 `$` 技能列表是真实截图（实拍未触发），成片标注为静态画面。
- S4 素材截止于运行中，未包含最终结论；结论由 S5 的证据页承接。
- 旁白是 TTS 而非真人，听感偏平；BGM 为合成音。
- ZIP 需重新打包，把成片放进 `03_演示视频/`。

---

## [演示视频] — 2026-11-21（S2 / S6 / S7 真实录屏完成，累计 4/7 段）

### 做了什么

- 修复本地 dev server 随宿主 shell 结束被杀的问题：改用 `Start-Process` 独立进程启动 `vite --host 127.0.0.1 --port 5199 --strictPort`（HTTP 200），浏览器「拒绝连接」消失。
- 修复三处录屏缺陷：改用 Edge 158 `--headless=new` 并复用登录态 profile；`Emulation.setFocusEmulationEnabled` 使 headless 下 `Input.insertText` 生效；每次 `Page.navigate` 后重启 `Page.startScreencast`；帧时间改用接收时钟，避免跨会话 `metadata.timestamp` 不连续导致音画错位。
- 真实录制并合成三段：`raw/s2.mp4`（24.5s，片库列表 → 详情 → 我的记忆 → 编辑态输入，670 帧）、`raw/s6.mp4`（20.2s，样本状态 → 待确认列表 → 点击「接受」→ 六维，243 帧）、`raw/s7.mp4`（13.3s，记忆地图，129 帧）；S1 以 `clips/s1-home-12s.mp4` 落地为 `raw/s1.mp4`（12.0s）。
- 四段合计 70.0s，均为 1920×1080 / 30fps / H.264。
- 更新 `outputs/demo-video/VIDEO-ASSET-MANIFEST.md`（A/C 段重排、帧证据、录制副作用）、`VIDEO-EDITING-REPORT.md`（2.1 / 2.3 / 3 / 5 / 6）、`COMPETITION-SUBMISSION-CHECKLIST.md`（4/7 段）。

### 为什么

- 成片必须真实录屏；S1 之外的三段此前因登录态与会话失效无法完成，现已在用户授权登录的独立浏览器实例中录制。

### 涉及文件

- `outputs/demo-video/raw/{s1,s2,s6,s7}.mp4`
- `outputs/demo-video/_work/rec/{record.mjs,warm.mjs,testcast.mjs}`
- `outputs/demo-video/VIDEO-ASSET-MANIFEST.md`、`outputs/demo-video/VIDEO-EDITING-REPORT.md`
- `COMPETITION-SUBMISSION-CHECKLIST.md`

### 如何验证

- `ffprobe` 复核四段：12.000 / 24.533 / 20.167 / 13.333s，1920×1080、30fps。
- 抽帧核对：片库海报完整加载、编辑态文字追加在笔记末尾、接受后 Toast 出现且待确认数 10→9、地图 11 电影 / 23 关系。

### 遗留问题

- S3/S4/S5 必须由用户本人在 DeepWorks 内录制（主界面受保护），成片仍未导出。
- 旁白未录音、背景音乐未选定。
- `_work/rec/assemble.mjs` 当前输出 `MISSING SEGMENTS: s3.mp4, s4.mp4, s5.mp4`，缺段拒绝出片。

---
## [最终提交] — 2026-11-21（按最新通知重组单一 ZIP）

### 做了什么

- 按 11-21 官方通知更新：截止 **2026-11-24 18:00**，全部材料合并为**一个 ZIP**，通过微信表单提交。
- 新建 `Frame-by-Frame-Final-Submission/`，共 278 文件 / 20.04 MB：01 说明书、02 路演 PPT、03 演示视频、04 源码、05 DeepWorks 证明、06 知识库、07 测试报告、08 Supabase 文档、09 附件、10 提交说明。
- 生成唯一 ZIP `C_framebyframe_Frame by Frame.zip`：17.80 MB、278 条目，SHA-256 `1f6cded1fe356d8792539e52022d3d66f78a43f5fd2086743c957704adc2edb1`，清单 `FINAL-SUBMISSION-ZIP-MANIFEST.md`。
- 演示视频只有 12 秒真实片段，隔离在 `03_演示视频/_未完成片段-不得作为成片/`，包内 README 与清单均标注“无成片”。
- 同步更新 `COMPETITION-SUBMISSION-CHECKLIST.md`（§0.0、§5、§8、§9）与 `PROJECT-DOCUMENTATION-SYNC.md`。

### 为什么

- 最新通知要求“所有比赛相关文件整理为一个 ZIP，通过微信表单上传”；原有 `Frame-by-Frame-Competition-Package/` 含历史版本与冗余材料，不适合作为唯一提交物。

### 涉及文件

- `_work/build-final-submission.mjs`、`_work/zip-final.mjs`
- `Frame-by-Frame-Final-Submission/**`
- `FINAL-SUBMISSION-ZIP-MANIFEST.md`、`COMPETITION-SUBMISSION-CHECKLIST.md`

### 如何验证

- `node _work/build-final-submission.mjs` → `node _work/zip-final.mjs`
- 解压校验：278/278 条目一致；DOCX 内嵌 11 图、PPTX 22 页、无 `.env`/密钥。

### 遗留

- 正式成片 MP4 未完成；报名回执、签名、合规第 3 项仍需本人处理。

---

## [演示视频] — 2026-11-20（分镜、真实录屏素材与出片链路）

### 做了什么

- 新增 `outputs/demo-video/`：`VIDEO-STORYBOARD.md`（7 段 / 170s）、`VIDEO-VOICEOVER.md`（约 420 字）、`VIDEO-SUBTITLE.srt`（30 条）、`VIDEO-ASSET-MANIFEST.md`、`VIDEO-EDITING-REPORT.md`、`VIDEO-RECORDING-GUIDE.md`。
- 用 Chrome 157 CDP `Page.startScreencast` 真实录制首页 13.9s（336 帧，记录真实帧时间戳），重采样 30fps 合成 `outputs/demo-video/_work/seg1.mp4`（1920×1080、13.8s）。
- 裁出正式素材 `outputs/demo-video/clips/s1-home-12s.mp4`（12.000s、4.0MB）。
- 新增零依赖脚本：`_work/rec/record.mjs`（录制）、`_work/rec/compose.mjs`（合成）、`_work/rec/assemble.mjs`（缺段拒绝出片）。

### 为什么

- 官方要求操作演示 ≤3 分钟，且必须是真实运行；不允许用动画或截图伪造调用过程。
- 站内操作需登录态、DeepWorks 主界面受保护且必须真实运行，这两类无法自动化代劳，因此先固化素材链与录制脚本，把人工步骤压到 6 段。

### 涉及文件

- `outputs/demo-video/*.md`、`VIDEO-SUBTITLE.srt`
- `outputs/demo-video/clips/s1-home-12s.mp4`
- `_work/rec/{record,compose,assemble}.mjs`
- `COMPETITION-SUBMISSION-CHECKLIST.md`（视频状态改为部分完成）

### 如何验证

- `ffprobe` 复核素材：1920×1080、30fps、12.000s；
- 抽帧人工核对：真实首页，非空白/错误页；
- `node _work/rec/assemble.mjs` 在缺 s2–s7 时返回 `EXIT=2` 并列出缺失段，不生成占位成片。

### 遗留问题

- 待录 6 段：站内操作（S2/S6/S7，需登录）、DeepWorks 平台与 Agent 运行（S3/S4/S5）；
- 旁白未录音、背景音乐未选定；
- 未导出完整 MP4。

---

## [文档同步] — 2026-11-20（说明书 v3.1）

### 做了什么

- 新增 `PROJECT-DOCUMENTATION-SYNC.md`：七步强制流程、15 类改动→材料矩阵、事实来源优先级、唯一正式版约定、版本归档规则、同步台账。
- 重写说明书三（三）3.2：由「待补占位」改为 4 个**模拟反馈**案例，每条按「反馈内容 → 问题 → 决策 → 改进 → 证据 → 时间口径」展开，并显式声明真实访谈 0 位。
- 说明书版本头升为 v3.1；关键节点、迭代记录、3.7 验证边界、附件 8、文末待办同步修订。
- PPT 新增第 20 页「四条反馈，四次改版」，并把结果页「访谈进行中」改为「尚未访谈」。
- 归档说明书 v3（docx/pdf）到 `08_CHANGELOG-AND-HISTORY/`；重建比赛包与 ZIP。

### 为什么

- 官方模板要求 ≥2 位真实用户原话；当前为 0，不能用模拟案例冒充访谈。材料必须既提供设计复盘价值，又不虚构用户研究。
- 反馈若不能回溯到提交/文件/截图，就只是故事；本轮为每条补上可核验证据。
- 建立长期规则，避免「先开发、后补文档」造成说明书与代码继续漂移。

### 涉及文件

修改：

- `outputs/submission/12-项目说明书正式稿-v3-20261120.md`
- `outputs/submission/C_framebyframe_Frame by Frame_项目说明书.docx` / `.pdf`
- `outputs/submission/C_framebyframe_Frame by Frame.pptx`
- `COMPETITION-SUBMISSION-CHECKLIST.md`、`FINAL-PROJECT-DELIVERY-REPORT.md`、`PROJECT-ASSET-INVENTORY.md`、`README.md`
- `Frame-by-Frame-Competition-Package/` 内对应材料

新增：

- `PROJECT-DOCUMENTATION-SYNC.md`
- `Frame-by-Frame-Competition-Package/08_CHANGELOG-AND-HISTORY/项目说明书-v3-20261120-历史版本.docx` / `.pdf`

### 如何验证

- `node _work/verify-v3.mjs`：DOCX 文本包含 v3.1、模拟反馈、反馈案例 01–04、提交哈希；PDF 根 `/Pages /Count` = 20。
- `node _work/pptx-text.mjs`：22 页，第 20 页为 FEEDBACK，第 21 页为 ITERATION，末页 Q&A。
- Word 统计：26 页、12,603 字（打开 DOCX 只读计算）。

### 遗留问题

- 真实访谈 0 位、真实反馈 0 条；T01–T16 端到端未执行；演示视频未录。
- 本地 `main` 落后 `origin/main` 16 个提交，`supabase/` 迁移脚本需 `git pull` 后本地复验。

---

## [架构升级] — 2026-11-19（阶段 1–2）

### 做了什么

**阶段 1：现状审查**

- 通读持久化、状态层、领域模型、AI 调用链、分析网关与部署配置。
- 输出 `docs/CURRENT-DATA-STORAGE-AUDIT.md`：
  - 确认全部业务数据存于 `localStorage['fbf.state.v1']`（schema v3），单 key 整包 JSON；
  - 确认无数据库、无用户体系、无跨设备同步；
  - 逐类列出 17 项数据的存储位置、持久化与丢失风险；
  - 给出来源可查的代码证据与 P0/P1/P2 风险清单。

**阶段 2：架构设计**

- `docs/SUPABASE-ARCHITECTURE.md`：目标架构、模块划分、读写/冲突/删除策略、部署与环境变量、阶段验收门槛。
- `docs/DATABASE-SCHEMA.md`：12 张表、关系、索引、RLS 摘要、旧字段映射、明确不建的表。
- `docs/AUTHENTICATION-AND-SECURITY.md`：认证流程、密钥边界、隐私设计、威胁模型、RLS 验证方法、注销口径。
- `docs/DATA-MIGRATION-REPORT.md`：迁移源字段盘点、备份策略、分表导入顺序、校验 SQL、回滚方案。
- `docs/SUPABASE-IMPLEMENTATION-PLAN.md`：阶段 3–6 的任务拆解、14 项测试计划、时间表与范围裁剪顺序。
- `docs/ARCHITECTURE-DECISIONS.md`：ADR-001 ~ ADR-010 与 4 项待决事项。
- `supabase/migrations/0001_schema.sql`：12 张表、约束、索引、触发器、`delete_my_data()`。
- `supabase/migrations/0002_rls.sql`：`revoke anon`、12 张表 RLS、48 条本人策略、Storage 头像策略、验证查询。

### 为什么

- 产品要从「单机网页」升级为「多用户云端电影记忆」，必须先证明现状究竟存在哪里，避免凭经验改造。
- Supabase 接入涉及权限与数据迁移，属于不可逆决策，需要先定 Schema 与 RLS 再写代码。
- 比赛截止 11-24，文档与 SQL 先行可以让控制台配置与前端开发并行。

### 涉及文件

新增：

- `docs/CURRENT-DATA-STORAGE-AUDIT.md`
- `docs/SUPABASE-ARCHITECTURE.md`
- `docs/DATABASE-SCHEMA.md`
- `docs/AUTHENTICATION-AND-SECURITY.md`
- `docs/DATA-MIGRATION-REPORT.md`
- `docs/SUPABASE-IMPLEMENTATION-PLAN.md`
- `docs/ARCHITECTURE-DECISIONS.md`
- `supabase/migrations/0001_schema.sql`
- `supabase/migrations/0002_rls.sql`
- `CHANGELOG.md`

修改：无。**本轮没有改动任何业务代码，没有读取或删除任何用户数据。**

### 数据库变化

- 仅新增迁移文件；**尚未在任何 Supabase 项目执行**。
- 表清单：`profiles`、`user_films`、`watch_notes`、`note_analyses`、`taste_profiles`、`taste_events`、`taste_snapshots`、`taste_observation_feedback`、`agent_observations`、`taste_feedback`、`user_corrections`、`yearbook_generations`。

### 如何验证（本轮已完成）

- 文档中的代码结论逐条对照源码行号核对。
- SQL 做静态检查：语句闭合、`$$` 成对、触发器函数先定义后引用、每表 4 条策略。
- 未执行真实数据库迁移，未做运行时测试。

### 测试结果

| 项目 | 结果 |
|---|---|
| 现状审查 | 完成（静态代码审查） |
| 架构与 Schema 设计 | 完成 |
| SQL 实际执行 | **未执行**（无 Supabase 项目） |
| RLS 越权测试 | **未执行** |
| 跨设备同步测试 | **未执行** |
| AI 链路回归 | **未执行**（本轮未改 AI 代码） |

### 未解决问题

1. 需要创建 Supabase 项目并在 SQL Editor 执行两份迁移。
2. 需要确认是否开启邮箱验证、是否启用头像上传。
3. 前端认证页、仓储层、缓存队列、迁移工具尚未开始（P4）。
4. 账号硬删除（`auth.users`）需要 Edge Function，未实现。
5. AI 网关是否接受真实 uid 替代 `anon-local`，待查契约。

### 对比赛材料的影响

- 现在可以在「技术方案」中描述 Supabase 架构与 RLS 设计，但必须标注「设计完成，待接入验证」。
- **不能**在说明书或 PPT 中写「已支持多用户登录」「已实现跨设备同步」——这些要等 P5 的真实测试结果。
- 已有本地数据未被触碰，演示用现有单机版本仍可正常运行。

---

## [架构升级] — 2026-11-19 晚（阶段 3 环境接入）

### 做了什么

- 将 Supabase 项目 URL 与 publishable key 写入本机 `.env.local`（已被 `.gitignore` 忽略，未提交、未进入聊天记录以外的任何文件）。
- 验证连通性：
  - `GET /auth/v1/health` → `200`，GoTrue `v2.198.0`；
  - `GET /rest/v1/watch_notes?select=id&limit=1` → `404 PGRST205`，说明**迁移尚未执行**。
- 安装 `@supabase/supabase-js@2.118.0`（exact）。原因：npm 镜像缺少 `2.119.2` 依赖的 `@supabase/auth-js@2.119.2`，无法解析最新版。
- 新增 `src/lib/supabase/client.ts`：单例客户端、URL 规范化、缺失配置时返回明确提示；启用 `persistSession` / `autoRefreshToken` / PKCE。
- 在 `src/vite-env.d.ts` 增加 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 类型。

### 为什么

- 先打通「能连上」再写页面，避免把配置问题误判成代码问题。
- 依赖必须固定在镜像可解析的版本，否则 `npm install` 失败会阻塞后续开发。

### 涉及文件

- `.env.local`（本机，不提交）
- `package.json`、`package-lock.json`（新增依赖）
- `src/lib/supabase/client.ts`（新增）
- `src/vite-env.d.ts`（类型补充）

### 数据库变化

无。迁移未执行，数据库中没有任何表。

### 如何验证

- 上述两个 HTTP 探测（已执行）。
- `npm run typecheck`：新增客户端代码通过；仍存在一处**改动前就有**的服务端类型错误 `server/worker.deepseek.ts(21,3): 'UNAUTHORIZED' does not exist in AIErrorCode`，与本轮无关。

### 测试结果

| 项目 | 结果 |
|---|---|
| Auth 服务可达 | PASS |
| 数据库表存在 | FAIL（未迁移，符合预期） |
| 客户端模块类型检查 | PASS |
| 登录/注册 | 未执行（页面未实现） |

### 未解决问题

1. `0001_schema.sql`、`0002_rls.sql` 仍需在 Supabase SQL Editor 执行。
2. Auth Email、Site URL、Redirect URLs 尚未配置。
3. 预存的服务端 typecheck 错误需要单独处理（不属于本轮改动）。

### 对比赛材料的影响

- 可以在材料中写「已完成 Supabase 项目创建与客户端连通性验证」，但**不能**写「数据库已就绪」「已支持注册登录」。

---

## [架构升级] — 2026-11-20 凌晨（阶段 4b 笔记上云）

### 做了什么

- 新增云端仓储层：`src/lib/db/{rows,map,remote}.ts`，把 `AppState` 与 11 张表互相映射，所有 domain 转换集中在一处。
- 新增写队列：`src/lib/sync/queue.ts`，localStorage 持久化、按 key 去重、串行上传、失败保留并记录尝试次数。
- 新增差异同步：`src/lib/sync/diff.ts`，只上传变化的笔记、分析、反馈、快照、事件，不整包覆盖。
- `AppStore` 接入：登录后先补传队列，再拉取云端；云端为空时把本机数据作为账号初始化上传；之后每次本地修改自动入队。
- 顶栏新增同步状态：`保存中 / 已同步 / 待同步 N / 同步失败 · 重试`。
- 文案修正：删除“都保存在这台设备上、不会上传”的旧表述，改为“保存在你的账号里，其他账号无法读取”。

### 关键设计

- **先传后拉**：队列未清空时绝不拉取云端，避免覆盖离线新增。
- **队列项带唯一 id**：上传过程中新增的写入不会被旧数组覆盖（已修掉一个真实的竞态）。
- **分析按 note_id 先删后插**：笔记 id 变更时不会留下孤儿分析。
- **示例数据**：随账号初始化上传，`is_demo = true`；示例分析仍是 `unreviewed`，不计入审美画像。正式历史迁移（P4c）仍只迁移 `source === 'user'`。

### 验证

| 项目 | 结果 |
|---|---|
| `tsc -b` | PASS |
| `vite build` | PASS（852 KB） |
| `vitest run` | 12 文件 / 97 用例 PASS |
| 浏览器刷新后自动上传 11 条示例 | **待用户实测** |
| 新写一条笔记后云端出现该行 | **待用户实测** |
| 跨设备看到同一笔记 | **待实测** |

### 未解决问题

1. 冲突处理（T16）尚未实现：同一笔记在两个标签页同时编辑时，后者会覆盖前者，没有冲突提示。
2. `taste_profiles` 表暂未写入（画像仍由客户端从已接受分析实时计算）。
3. 删除笔记是软删，但 `resetDemo` 仍会重建示例并把旧记录软删，语义需要在 P4c 理清。

---

## [架构升级] — 2026-11-19 深夜（阶段 4a 认证）

### 做了什么

- 确认 Supabase 迁移已执行：三张抽样表（`watch_notes` / `profiles` / `taste_snapshots`）对 `anon` 均返回 `42501 permission denied`，说明表已创建且匿名角色被正确拒绝。
- 实现认证闭环：
  - `SessionProvider`：`getSession` + `onAuthStateChange`，刷新后恢复登录态；
  - `PublicOnly` / `ProtectedLayout`：未登录访问业务路由会跳转 `/welcome`，登录后回到原路径；
  - 登录、注册、忘记密码、重置密码、邮件确认五个页面；
  - `/account` 账号页：邮箱展示、昵称保存、退出登录；
  - Shell 顶栏与移动端菜单加入账号入口。
- 视觉：沿用米白 `paper` + 深蓝 `ink`、衬线大标题、细线框与「电影年刊」版式；无红色、无紫色渐变、非 Dashboard 布局；正文不小于 14px。
- 本地数据按账号隔离：
  - 新 key `fbf.state.v1.u.<userId>`；
  - 旧 `fbf.state.v1` 保留不动，首次登录时由第一个账号一次性「认领」复制（标记 `fbf.state.v1.claimedBy`），后续账号不会读到；
  - `resetDemo` 只清理当前账号的 key，不动旧数据。
- 明确暂缓「删除我的全部数据」入口：云端删除函数已存在，但笔记尚未上云，现在开放会造成「删了但本机还有」的假象。

### 为什么

- 先让身份与会话可靠，再迁移数据；否则无法判断写入失败是权限、网络还是数据模型问题。
- 同一台电脑换账号必须看不到上一个人的记录，这是隐私底线，不能等数据上云后再补。

### 涉及文件

新增：`src/auth/session.tsx`、`src/lib/supabase/auth.ts`、`src/pages/auth/{AuthShell,SignIn,SignUp,ForgotPassword,ResetPassword,AuthCallback}.tsx`、`src/pages/Account.tsx`
修改：`src/App.tsx`（路由与守卫）、`src/components/layout/Shell.tsx`（账号入口）、`src/lib/storage.ts`（按账号作用域 + 旧数据认领）、`src/vite-env.d.ts`、`package.json` / `package-lock.json`

### 数据库变化

无新增表。已确认 `0001` / `0002` 在真实项目执行，`anon` 无表权限。

### 如何验证（真实执行）

| 项目 | 结果 |
|---|---|
| `tsc -b` | PASS |
| `vite build` | PASS（产物 834 KB，主要来自 supabase-js） |
| `vitest run`（12 文件 / 97 用例） | 全部 PASS |
| Auth 健康检查 | PASS（200，GoTrue v2.198.0） |
| 匿名读取业务表 | PASS（401 / 42501，符合预期） |
| 错误密码登录探测（SDK） | PASS（400 `invalid_credentials`，与预期一致） |
| 浏览器内注册 / 登录 / 刷新 / 退出 | **未执行**（需人工在 `npm run dev` 中验证） |

### 未解决问题

1. 笔记仍写在本机作用域 key，尚未写入 `watch_notes`；跨设备同步尚不成立。
2. 邮箱确认与重置链接依赖 Supabase Redirect URLs 配置，需在控制台加入 `http://localhost:5173/**` 与 Pages 地址。
3. `npm run typecheck` 仍有一处改动前就存在的服务端类型错误（`server/worker.deepseek.ts:21`，`UNAUTHORIZED` 不在 `AIErrorCode` 中）。
4. 新账号仍会看到 10 条示例电影（种子数据），需在 P4b 用云端数据替换。

### 对比赛材料的影响

- 可以写「已实现邮箱注册 / 登录 / 会话保持 / 密码重置界面，并通过构建与单元测试」。
- **不能**写「已实现跨设备同步」「多用户数据已隔离」——笔记尚未上云，RLS 双账号实测也还没做。

---

## 模板（后续阶段使用）

```
## [架构升级] — YYYY-MM-DD（阶段 n）

### 做了什么
### 为什么
### 涉及文件
### 数据库变化
### 如何测试
### 测试结果（PASS / FAIL / 未执行）
### 未解决问题
### 对比赛材料的影响
```
