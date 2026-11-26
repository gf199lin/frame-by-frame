# Frame by Frame · Windows 一键启动器

双击桌面上的 **Frame by Frame** 图标，自动检查服务、按需启动、用 Edge 独立窗口打开面板；关闭窗口后只清理本次启动器拉起的进程。

- 面板地址：`http://127.0.0.1:5173/`（本地开发版）
- 窗口：Edge App Mode，`1400 × 900`
- 无托盘、无全局快捷键（按第一版约定保持轻量）

---

## 一、怎么用

1. 双击桌面图标 `Frame by Frame`（或直接双击 `FrameByFrame-Launcher.bat`）。
2. 首次启动约 5–10 秒：启动 `vite` → 打开 Edge 独立窗口。
3. 再次双击：把已有窗口切到前台，**不会**再开第二个窗口，也不会重复启动服务。
4. 关闭窗口：启动器自动停止**它自己启动的** `vite`；如果本机已有 AI 服务、或 `vite` 是你自己开的，一律不动。

> `.bat` 双击时会闪一下命令窗口（约 0.1 秒），这是 Windows 启动批处理的正常现象，不影响使用。

---

## 二、文件说明

| 文件 | 作用 |
|---|---|
| `FrameByFrame-Launcher.bat` | 唯一需要双击的入口，只负责以隐藏窗口转交 `launcher.ps1` |
| `launcher.ps1` | 全部逻辑：单实例、服务检查/启动、窗口管理、退出清理 |
| `config.json` | 面板地址、端口、启动命令、窗口尺寸等可调参数 |
| `Create-DesktopShortcut.ps1` | 创建/刷新桌面快捷方式（绑定 `icons\FrameByFrame.ico`） |
| `icons\FrameByFrame.ico` | 快捷方式与窗口图标 |
| `logs\` | 启动器日志与服务输出（`launcher-*.log`、`vite.*.log`、`ai.*.log`） |
| `state.json` | 运行时记录（仅记录本次启动器拉起的进程），正常退出后自动删除 |

---

## 三、配置说明（`config.json`）

最常改的几项：

| 字段 | 当前值 | 说明 |
|---|---|---|
| `panelUrl` | `http://127.0.0.1:5173/` | 启动器打开的地址，必须与下面的 `--host` 一致 |
| `web.port` | `5173` | `vite` 端口 |
| `web.startArgs` | `npm run dev -- --port 5173 --strictPort --host 127.0.0.1` | `--strictPort` 保证端口不漂移 |
| `web.startMatch` | `--port 5173` | 校验进程归属用，改端口时同步改 |
| `ai.enabled` / `ai.port` | `true` / `8787` | 本地 AI 代理，未运行时会尝试 `npm run ai:dev` |
| `ai.required` | `false` | `false` 时 AI 起不来也不阻塞面板打开 |
| `window.width/height` | `1400 × 900` | Edge 窗口初始尺寸（Edge 会记住上次位置/大小） |
| `window.titleNeedles` | `["Frame by Frame"]` | 识别「这是我们的窗口」的标题关键字 |
| `singleInstance.mutexName` | `Local\FrameByFrameLauncher.Gate` | 单实例命名互斥体 |
| `lifecycle.windowWarmupSeconds` | `10` | 窗口刚出现时的抖动保护期 |
| `lifecycle.windowAbsentChecks` | `3` | 连续 3 次查不到窗口才判定为关闭 |

**改端口时三处要一起改**：`panelUrl`、`web.port`、`web.startArgs` 里的 `--port` 与 `--host`，以及 `web.startMatch`。

---

## 四、它是怎么工作的

1. **先找窗口**：枚举所有 `Chrome_WidgetWin_1` 顶层窗口，标题包含 `Frame by Frame` 且不含浏览器后缀（`Microsoft` / `和另外`）的，认定为 Frame by Frame 的 App 窗口。
2. **找到就激活**：`ShowWindow(SW_RESTORE)` + `AttachThreadInput` + `SetForegroundWindow`，直接退出，不碰任何服务。
3. **找不到才拿门锁**：命名互斥体 `Local\FrameByFrameLauncher.Gate` **从启动一直持有到退出**。拿不到说明已有实例在运行，于是轮询等它的窗口出现并激活，绝不再起第二套服务。
4. **拿锁后先清残留**：只有确认没有存活实例时，才按 `state.json` 清理上次崩溃遗留的进程（并校验 PID 创建时间与命令行特征，防止 PID 复用误杀）。
5. **检查/启动服务**：端口空闲 → 启动并等待 HTTP 就绪；端口已被占用且返回的是 Frame by Frame 页面 → 直接复用，且**不纳入本次清理范围**；端口被别的程序占用 → 明确报错。
6. **打开 Edge**：`msedge --app=http://127.0.0.1:5173/ --window-size=1400,900`，Edge 路径依次尝试注册表 → `Program Files (x86)` → `Program Files` → `LOCALAPPDATA`。
7. **常驻监控**：每 1.5 秒检查一次窗口；连续 3 次（约 4.5 秒）找不到才判定关闭，避免页面重载抖动误判。
8. **清理**：只对 `state.json` 里记录的、由本次启动器拉起的 PID 执行 `taskkill /PID <pid> /T /F`。**从不使用 `/IM node.exe`**，从不按进程名批量杀。

---

## 五、常见问题

**Q：双击后没反应？**
看 `logs\launcher-YYYYMMDD.log` 最后几行。常见原因：5173 被别的程序占用、`node_modules` 未安装、Edge 被策略拦截。

**Q：提示「端口 5173 已被其他程序占用，且不是 Frame by Frame 面板」？**
说明 5173 上跑着别的东西。先关掉它，或把 `config.json` 里端口三处一起改掉。

**Q：提示「AI 分析服务未能启动，面板仍会打开」？**
面板可用、笔记可保存，只是 AI 分析不可用。检查项目根 `.env` 里是否有 `DEEPSEEK_API_KEY`，然后看 `logs\ai.err.log`。

**Q：打开后片库是空的？**
本项目数据存在浏览器本地存储，按站点隔离。`127.0.0.1:5173`、`localhost:5173`、`gf199lin.github.io` 是**三个互不相通的库**。启动器固定用 `127.0.0.1:5173`；如果你之前的记录是在 `localhost:5173` 或线上站点写的，那些数据不会出现在这里（也没有迁移，因为不改动网站逻辑）。如需切换，改 `config.json` 的 `panelUrl` 与 `web.startArgs` 里的 `--host`。

**Q：怎么彻底退出后台？**
关闭 App 窗口即可，启动器会在几秒内自行退出并清理。若想强制结束，在任务管理器结束那个 `powershell.exe`（命令行含 `launcher.ps1`）；残留的 `vite` 会在下次启动时被 `state.json` 校验并清理。

**Q：项目目录搬走了怎么办？**
重新运行 `Create-DesktopShortcut.ps1` 刷新快捷方式路径；`config.json` 用相对路径 `..`，无需改动。

---

## 六、已知限制

1. **窗口归属靠标题启发式**：页面标题必须包含 `Frame by Frame`（当前所有页面都是 `xxx · Frame by Frame`）。若以后改标题文案，需同步 `window.titleNeedles`。
2. **没有使用 Windows Job Object**：启动器若被强制结束（任务管理器/崩溃），`vite` 可能短暂残留；下次启动会通过 `state.json` + PID/命令行校验清理，不会误杀别人的进程。
3. **启动器进程常驻**：因为要监控窗口关闭，任务管理器里会有一个隐藏的 `powershell.exe`（无托盘图标，符合第一版约定）。
4. **窗口尺寸只在首次生效**：Edge 会记住 App 窗口的位置与大小，之后调整尺寸属正常行为。
5. **仅支持 Windows + Microsoft Edge**：未适配 Chrome/Firefox，也未适配 macOS/Linux。
6. **不会修改网站**：启动器不注入 CSS、不改路由、不改 AI 调用链路；面板里看到的就是网站本身。

---

## 七、卸载

1. 删除桌面快捷方式。
2. 删除 `FrameByFrame-Launcher` 目录（含 `logs`、`icons`）。
3. 网站、DeepWorks Agent、Cloudflare Worker 均未改动，无需回滚。
