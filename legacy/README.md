# legacy/ · 历史部署方案（未用于本次参赛）

## 为什么在这里

本项目最初实现网站侧 AI 分析时，评估过三种部署形态：

1. **Cloudflare Worker**（`wrangler.toml`）
2. **国内云函数 SCF/FC**（`s.yaml`，阿里云函数计算 fc3）
3. **本地 Node 服务**（`server/`，`npm run ai:dev`）——**当前唯一在用的形态**

2026-11 起，项目确认参赛要求核心链路必须落在 DeepWorks 内，且明确排除 Cloudflare Worker 与任何自建后端作为主体。因此前两种方案**整体归档到此目录，不再部署、不写入任何参赛材料**。

代码保留是为了让审计可回溯（有据可查，而不是抹掉历史）。

## 内容清单

| 文件 | 原位置 | 说明 |
|---|---|---|
| `wrangler.toml` | 仓库根目录 | Cloudflare Worker 配置，`name = frame-by-frame-ai` |
| `s.yaml` | 仓库根目录 | 阿里云 fc3 部署配置，`cn-hangzhou`，runtime nodejs20 |
| `docs/deploy-cloud-function.md` | `docs/` | 云函数部署指南（含 `npm run cloudfn:*` 用法） |
| `scripts/build-cloudfn.mjs` | `scripts/` | 云函数单文件构建 |
| `scripts/pack-cloudfn.mjs` | `scripts/` | 云函数 zip 打包 |
| `deploy.yml.snapshot` | `.github/workflows/deploy.yml` | 归档前快照，含 `VITE_AI_API_BASE` 指向 `*.workers.dev` 的原始行 |
| `docs/ai-core.md.snapshot` | `docs/ai-core.md` | 归档前快照，保留原 Worker 部署章节原文 |

## 已同步移除的引用

| 位置 | 处理 |
|---|---|
| `.github/workflows/deploy.yml` | 移除 `VITE_AI_API_BASE: https://*.workers.dev` 注入；Pages 仅部署静态站点 |
| `package.json` scripts | 移除 `worker:dev`、`worker:deploy`、`cloudfn:build`、`cloudfn:pack` |
| `README.md` | 移除云函数命令与目录树条目；部署说明改为本地 `npm run ai:dev` |
| `docs/ai-core.md` | 部署章节改为指向本目录 |

## 原命令（如需复原）

```powershell
# Cloudflare Worker
copy legacy\wrangler.toml .\wrangler.toml
npm run worker:dev        # 原 scripts 已移除，需从 legacy 恢复

# 阿里云函数计算
copy legacy\s.yaml .\s.yaml
copy legacy\scripts\*.mjs .\scripts\
npm run cloudfn:pack
```

## 边界说明

- 归档不影响网站运行：前端仍通过 `VITE_AI_API_BASE` 指向本地 `server/`（`http://127.0.0.1:8787`）或留空时提示「未连接」。
- `devDependencies` 中的 `wrangler`、`@serverless-devs/s` 暂未移除，避免改动 `package-lock.json` 引发安装差异；它们不参与构建与演示。
- 本次参赛的 AI 分析主体是 DeepWorks 内的 `film-curator` Agent、三个 Skill 与平台知识库；网站侧 DeepSeek 链路与平台链路在材料中分开标注来源。
