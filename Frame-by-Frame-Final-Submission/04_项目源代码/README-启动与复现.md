# 启动与复现说明

## 最省事的查看方式

`本地预览/` 目录内是已构建好的前端，**无需 npm install**：双击 `本地预览/启动本地预览.cmd`，浏览器打开 `http://localhost:8123` 即可（需要 Node.js 20+）。详见 `本地预览/如何查看.md`。

## 环境

- Node.js 20+
- npm 10+
- Windows / macOS / Linux 均可

## 安装与本地运行

```bash
npm ci
cp .env.example .env.local   # 按需填写，见下
npm run dev                  # 前端 http://localhost:5173
npm run api                  # 本地 API 网关 http://localhost:8787（可选）
```

## 环境变量（只用示例占位，不含真实密钥）

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`：客户端公开配置；不填时自动退回纯本地模式。
- `DEEPSEEK_API_KEY`：**仅服务端**，不得加 `VITE_` 前缀。
- 真实密钥、`.env`、`.env.local` 均未放入本包，提交包中只有 `.env.example`。

## 构建与测试

```bash
npm run build                # tsc -b + vite build
node --test server           # 服务端 53 条
npx vitest run               # 前端 97 条
```

## 数据库

`supabase/migrations/0001_schema.sql`、`0002_rls.sql` 为建表与 RLS 策略；需在 Supabase 项目 SQL Editor 中按顺序执行。详细说明见 `08_Supabase技术文档/`。
