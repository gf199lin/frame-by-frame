# Frame by Frame 启动器 · 测试报告

- 测试时间：2026-11-19 20:33 – 21:05（UTC+08:00）
- 测试机器：Windows（win32），Node v26.13.0，npm 11.20.0
- Edge：`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
- 被测对象：`FrameByFrame-Launcher\`（`launcher.ps1` + `config.json` + `.bat`）
- 测试方式：真实启动进程、真实打开 Edge 窗口、真实关闭窗口并观察端口/进程，**不是仅读代码推断**
- 自动化脚本：`_work\launcher-test\run-tests.ps1`（过程文件，非交付物）
- 原始结果：`_work\launcher-test\results.txt`

---

## 一、结果总览

**10 个用例全部通过（10 passed / 0 failed）。**

| 用户场景 | 用例 | 结果 | 实测证据 |
|---|---|---|---|
| 第一次双击 | T1 | ✅ PASS | 窗口出现耗时 6.4s；`5173` 监听；`vite` 进程 2 个（npm 包装 + vite 本体） |
| 再次双击 | T2 | ✅ PASS | `vite` PID 集合 `24172,35720` 前后完全一致；窗口数 `1 → 1` |
| 本地服务未启动 | T3 | ✅ PASS | T1 前置条件为 `5173=free`，启动日志出现 `started vite` 与 `vite is ready` |
| 本地服务已经运行 | T4 | ✅ PASS | 手工先起 `vite`（PID `36556,31440`），启动器复用后 PID 集合不变 |
| 网络不可用 | T5 | ✅ PASS | 指向不可达地址，退出码 `1`，日志命中 `did not produce a Frame by Frame app window` |
| 本地服务启动失败 | T6 | ✅ PASS | 启动命令改为 `exit 3`，退出码 `1`，生成 `logs\vite.err.log` |
| 关闭窗口 | T7 | ✅ PASS | 窗口消失后 `5173` 释放、`state.json` 删除、`8787` PID 不变 |
| 其他 Node 服务运行 | T8 | ✅ PASS | 8787 服务 PID `36548 → 36548`，全程未被触碰 |
| 其他 Edge 窗口运行 | T9 | ✅ PASS | 非 App 的 Edge 窗口数 `6 → 6`，未误关 |
| 重复启动和关闭 | T10 | ✅ PASS | 连续 3 轮全部 `open/port/gone/free/state` 通过；结束时 `orphans_vite=0`、`state=none` |

附加验证：

| 用例 | 结果 | 证据 |
|---|---|---|
| T4b 已存在的 `vite` 在关闭窗口后仍在 | ✅ PASS | 关闭后 `5173` 仍监听（启动器未将其纳入清理范围） |

---

## 二、测试过程中发现并已修复的真实缺陷

这些不是推演出来的，都是实测失败后定位修复的：

### 1. `vite` 默认只绑 IPv6，`127.0.0.1` 探测超时
- 现象：启动器等 120 秒后报「开发服务器启动失败」，但 `vite.out.log` 显示 1 秒内就已就绪。
- 根因：`vite` 默认 `host=localhost`，实测监听 `[::1]:5173`，`http://127.0.0.1:5173/` 连不上。
- 修复：启动参数显式加 `--host 127.0.0.1`，与 `panelUrl` 保持一致。

### 2. SPA 挂载后改写标题，窗口被判成「已关闭」
- 现象：窗口打开约 6 秒后启动器就清理服务退出，但窗口其实还在。
- 根因：`index.html` 标题是「Frame by Frame — 私人电影记忆博物馆」，React 挂载后 `document.title` 变为「我的电影 · Frame by Frame」；原规则按**前缀**匹配，于是找不到。
- 修复：改为标题**包含** `Frame by Frame`；并加「连续 3 次缺失 + 10 秒预热期」防抖动。

### 3. 并发双击各起一套服务
- 现象：两个实例几乎同时启动时，各自判定「无窗口」，启动了两套 `vite`。
- 根因：互斥体在「窗口出现后」就被释放，第二个实例正好在窗口标题加载前进入启动流程。
- 修复：互斥体**从启动持有到退出**；再次双击仍走「先找窗口 → 激活」的快速路径，不依赖门锁。

### 4. 残留清理误杀存活实例的服务
- 现象：第二个实例把第一个**仍在运行**的实例的 `vite` 当成「上次崩溃残留」杀掉。
- 根因：`state.json` 清理发生在抢锁之前，且未校验归属实例是否存活。
- 修复：先抢锁、抢到才允许清理；并校验 `state.json` 里的 `launcherPid` 是否仍是存活的 `launcher.ps1` 进程。

### 5. 普通 Edge 窗口标题含零宽字符
- 现象：`*Microsoft Edge*` 匹配不到实际标题「… - 学校 - Microsoft​ Edge」（中间有 U+200B）。
- 修复：排除规则只匹配 `Microsoft` 这一品牌词，避免零宽字符导致漏判。

---

## 三、测试环境说明（需要你知道）

1. **8787 AI 服务被重启过一次。** 测试期间一条命令超时，shell 终止了进程树，把你原本的 `node server/node.ts`（PID 28660）一并带走了。已通过 `npm run ai:dev` 恢复，当前 PID 36548，`/health` 返回 `{"ok":true,"configured":true,...}`。功能等价，但父进程结构与你原先手动启动的不同。
2. **测试期间在桌面上留下了一个 App 窗口**，已全部关闭；当前 `APP_WINDOWS=0`、`5173=free`、`state.json` 已清理。
3. **所有测试进程均按 PID 精确清理**，未使用 `taskkill /IM`。

---

## 四、未覆盖 / 未验证项

1. **弹窗外观**：T5/T6 以 `-NoDialog` 运行，验证的是退出码与日志；生产模式下会弹出中文错误框，但未做人工截图确认。
2. **物理鼠标双击**：测试用 `Start-Process` 调用同一个 `.bat`，行为等价，但不是真实双击动作。
3. **长时间挂机**：未验证数小时连续监控的内存/句柄增长。
4. **多显示器 / DPI 缩放**：窗口位置与缩放手感未逐项验证，交由 Edge 自身记忆。
5. **Edge 未安装场景**：代码有明确报错与多路径探测，但本机已安装 Edge，未做卸载后的实机验证。

---

## 五、复现方式

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "_work\launcher-test\run-tests.ps1"
```

脚本会依次执行 T1 → T2 → T7 → T8 → T9 → T4 → T4b → T5 → T6 → T10，并把结果写入 `_work\launcher-test\results.txt`。

> 前置要求：`8787` 上已有 AI 服务（用于验证「不动别人的进程」）；若没有，T8 会失去对照意义。
