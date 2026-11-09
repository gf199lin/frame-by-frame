# Frame by Frame — 视觉改版说明（V5）

日期：2026-11-09
范围：仅美术风格与呈现层；不改变数据库、存储结构、AI 分析协议与既有交互。

---

## 1. 参考分析

主要参考：<https://gf199lin.github.io/personal-homepage/>
改版对象：<https://gf199lin.github.io/frame-by-frame/>

从个人主页实际页面与样式中提取到的视觉 DNA：

- **底色**：奶油米白 `#f4ead2`，卡片纸白 `#fdf6e2`。
- **主色**：深海蓝 `#1d2379`，文字深蓝 `#161c66`。
- **辅助**：暖沙色 `#b98b63`、低饱和灰蓝 `#5a5f85`。
- **字体**：英文大标题使用衬线体（个人主页为 Georgia 系），中文标题使用宋体气质字体；正文保持清晰的无衬线中文。
- **容器**：1–1.5px 深蓝细边框、12px 左右圆角、纸白填充、轻柔投影。
- **图片**：方形/肖像照片配偏置硬阴影，像贴在纸面上的照片，而不是卡片里的缩略图。
- **节奏**：米白与深蓝板块交替；深蓝只用于少量“章节封面”，不大面积压暗整站。
- **导航**：悬浮的描边圆角条，而不是通栏顶栏。

**没有照搬**的部分：个人主页的狗狗背景墙、聊天卡片、圆形头像构图与页面结构。Frame by Frame 保留自己的电影年刊结构与内容。

---

## 2. 设计系统

### 2.1 色彩变量

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--paper` | `#f4ead2` | 页面底色 |
| `--paper-2` | `#efe3c8` | 次级纸色 |
| `--paper-3` | `#e6d8b9` | 深一档纸色 / 占位 |
| `--sheet` | `#fdf6e2` | 卡片、导航、书页 |
| `--ink` | `#161c66` | 正文与标题 |
| `--ink-deep` | `#10154a` | 最深文字 / 阴影 |
| `--ocean` | `#1d2379` | 品牌主色、按钮、深色章节 |
| `--ocean-deep` | `#121750` | 深色章节渐变末端 |
| `--paper-muted` | `#5a5f85` | 辅助文字 |
| `--line` | `rgba(29,35,121,.14)` | 常规分隔线 |
| `--line-strong` | `rgba(29,35,121,.24)` | 强调分隔线 |
| `--sand` | `#b98b63` | 少量暖色点缀（仅在深色面板/标签） |

约束：

- 不使用紫色渐变、荧光色、高饱和装饰色。
- 深蓝章节只用于“片库记录”“页脚”“年度特刊弹层”等少量位置。
- 所有正文与背景对比度以可读为先，辅助文字不低于 `#5a5f85`。

### 2.2 字体

| 角色 | 字体栈 |
| --- | --- |
| 英文展示/标题 | `Instrument Serif` → Iowan Old Style → Georgia |
| 中文标题 | `Noto Serif SC` → Songti SC → STSong |
| 中文正文/UI | `Noto Sans SC` → PingFang SC → Microsoft YaHei |
| 数字/编号/时间 | `IBM Plex Mono` |

规则：

- 中文标题字重 500，字距 `0.01–0.02em`，行高 1.16–1.2；不使用超粗黑体。
- 大标题不加大号句号；`The archive`、`a reading in progress` 等副标题已去掉尾部句号。
- 英文小标签字距收紧到 `0.12–0.15em`，避免旧版的“科技面板”感。
- 正文中文 15–16.5px，行高 1.85–1.95。

### 2.3 间距、圆角、阴影

- 页面最大宽度：`1560px`；左右留白 `clamp(16px, 4vw, 56px)`。
- 卡片圆角：`12px`；大面板/页脚：`18px`；按钮/标签：`999px`（胶囊）。
- 卡片阴影：`0 18px 44px rgba(29,35,121,.10)`。
- 照片/海报装裱：纸白内边距 + `10px 12px 0 rgba(29,35,121,.06)` 偏置阴影。
- 移动端把偏置阴影降为 `6px 8px`，避免裁切。

### 2.4 组件

- **按钮**：胶囊；主按钮深海蓝底纸白字；次按钮 1.5px 描边；hover 上浮 1px。
- **输入**：搜索保留 editorial 下划线；表单使用 8px 圆角浅纸底。
- **标签/筛选**：胶囊描边；选中态深海蓝填充。
- **导航**：悬浮描边卡片；当前页为深海蓝胶囊；移动端为纸白卡片列表。
- **海报装裱**：`.mount`，纸白边框 + 偏置阴影；片库、详情页相关电影、年度封面统一使用。
- **深色面板**：`.ink-panel`，圆角 18px，内部自动切换奶油色文字变量。

### 2.5 图片规则

- 海报继续使用 `FilmPoster` 的真实来源：用户提供、已核验 TMDB 海报或本地官方海报副本。
- 剧照继续使用 `FilmStill` 的真实来源：TMDB backdrop / 已核验 still，失败时回退到该片官方海报。
- 本次新增：`FilmStill` 在海报层先铺一张真实官方海报作为底层；远程剧照加载失败时不会出现纯色空块，也不会用 AI 生成图替代。
- 没有替换任何已有的正确电影图片资源。

---

## 3. 页面改造

### 首页 `/`

- Hero 改为纸白大卡片：左侧大标题 + 个人刊物题签 + 观影统计；右侧是“海报 + 小剧照”错落装裱。
- 保留 `Every Film Leaves a Frame` 与最近观影记录。
- 章节目录改为四格纸白索引条。
- “片库记录”从通栏黑底改为圆角深海蓝面板。
- 结尾“昨晚看了哪一部”改为圆角深蓝卡片，保留剧照背景与 marquee。

### 我的片库 `/archive`

- 精选电影从深色通栏改为纸白“封面故事”卡片：左侧大海报，右侧标题、笔记与评分。
- 海报墙使用 2/3/4/5 列响应式网格，海报是主角；标题、导演、年份、评分、日期在下方，不再套 Dashboard 卡片。
- 海报卡标题支持两行，移动端评分/日期移到标题下方，避免挤压片名。
- 搜索、排序、筛选保留原有功能，仅调整视觉。
- 候场室同样改为真实海报墙。

### 记忆地图 `/map`

- 画布从近黑星图改为奶油纸面星座；线、节点、标签改为深蓝/灰蓝。
- 电影节点保留真实海报小图，主题为菱形，情绪为虚线圆点。
- 选中详情面板改为纸白卡片；移动端隐藏未选中的电影文字标签，减少拥挤。
- 地图下方新增“最近的三段记忆”索引：海报 + 日期 + 笔记摘录。

### 观影品味 `/taste`

- 雷达图放进“Taste fingerprint”纸白图版，不再悬浮在空白中。
- 六个维度仍按杂志式横线排列；反馈按钮改为胶囊。
- 主题复现区新增每主题最多 3 张真实海报，作为审美判断的视觉依据；原进度条保留为细线。
- 未确认证据时仍明确显示“没有可以画出的形状”，不虚构雷达数据。

### 年度回顾 `/reflection`

- 清除旧的棕色纸色板（`#171512/#7a7264/#29251f`），统一到深海蓝 + 奶油纸。
- 顶部改为年度特刊封面卡片：大年份标题 + 偏置装裱的年度海报。
- 月度柱状图、主题、情绪、漂移、AI 总结保留。
- 年度特刊弹层、下载 HTML、打印样式同步换色；弹层仍是可截图/可打印的“特刊书页”。

### 电影详情 `/archive/:id`

- Hero 继续使用真实剧照 + 深蓝渐变；标题、帧号、元信息改为奶油色。
- 相关电影从横向剧照改为真实海报装裱。
- “与观影品味的关联”保持原有六轴对照。

### 全局

- 导航、移动菜单、页脚、Toast、Modal、添加电影流程统一到新色板与圆角。
- `Rating` 默认改为浅色背景（深蓝星），深色弹层内显式使用 `tone="dark"`，修复奶油底上星星不可见的问题。
- `index.html` 的 `theme-color` 更新为 `#F4EAD2`。

---

## 4. 修改文件

样式与配置：

- `src/styles/index.css`
- `tailwind.config.js`
- `index.html`
- `.gitignore`（忽略本地 `_work/` 验收文件）

布局与基础组件：

- `src/components/layout/Shell.tsx`
- `src/components/ui/Modal.tsx`
- `src/components/ui/Toast.tsx`
- `src/components/ui/Rating.tsx`

电影与地图组件：

- `src/components/film/FilmCard.tsx`
- `src/components/film/FilmStill.tsx`
- `src/components/film/FilmPoster.tsx`
- `src/components/map/MemoryGraphView.tsx`

品味组件：

- `src/components/taste/TasteRadar.tsx`
- `src/components/taste/DimensionCard.tsx`
- `src/components/taste/HowAISeesMe.tsx`

页面：

- `src/pages/Home.tsx`
- `src/pages/Archive.tsx`
- `src/pages/MemoryMap.tsx`
- `src/pages/Taste.tsx`
- `src/pages/Reflection.tsx`
- `src/pages/FilmDetail.tsx`
- `src/components/add/AddFilmFlow.tsx`（深色流程头部与评分色）

---

## 5. 回归与验收

执行命令：

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

结果：

- TypeScript：通过（client + server）。
- 单元测试：3 个文件、21 项全部通过。
- 服务端测试：38 项全部通过。
- 生产构建：通过；`dist/` 生成成功（Vite 6.3.5）。

浏览器验收（Chrome headless，滚动加载 + 真实图片）：

- 桌面 `1440px`：首页、片库、记忆地图、观影品味、年度回顾、电影详情、添加电影弹层、年度特刊弹层。
- 移动 `390px`：首页、片库、记忆地图、观影品味、年度回顾、移动菜单。
- 检查项：导航/页脚一致性、海报与剧照来源、海报比例与裁切、标题换行、筛选区换行、图表标签、弹层滚动、无横向溢出（`document.scrollWidth === 390`）。
- 修复项：奶油底星级不可见、移动端片名被评分挤压、地图移动端标签重叠、深蓝面板标题不可见、片库底部与页脚双深色块堆叠。

已知限制：

- 远程 TMDB 剧照需要网络；离线时现在会回退到该片官方海报，不再出现纯色空块。
- 没有引入像素级视觉回归工具；本轮以真实浏览器截图逐页检查为准。
- `Taste` 页在演示数据下只有 1 条可确认分析，雷达图按设计保持“证据不足”状态。

---

## 6. 部署情况

- 本地生产构建已完成：`dist/`。
- 已使用 `VITE_BASE=/frame-by-frame/` 执行 Pages 变体构建验证，`dist/index.html` 中的 JS/CSS 路径正确带上了 `/frame-by-frame/` 前缀。
- 本地预览：`vite preview`，端口 `4173`。
- GitHub Pages 工作流：`.github/workflows/deploy.yml`，在 `push` 到 `main` 或手动 `workflow_dispatch` 时构建并发布，构建时注入 `VITE_BASE=/frame-by-frame/`。
- **已部署**：提交 `0ba399f` 已推送到 `main`，GitHub Actions run `42626030103` 的 build 与 deploy 均成功（2026-11-09）。
- 线上验证：<https://gf199lin.github.io/frame-by-frame/> 已返回 `theme-color=#F4EAD2` 与新构建资源；桌面 1440px 与真实 390px 视口均完成线上截图检查。
- 线上深层链接（如 `/archive`）由工作流生成的 `404.html` 回退到 SPA，浏览器内路由正常。
