# 交付验证记录

> 验证时间：2026-11-20 10:50（UTC+08:00）
> 验证对象：`Frame-by-Frame-Competition-Package/` 与本轮生成的 DOCX / PDF / PPTX / ZIP
> 原则：只记录实际执行过的命令与输出；未执行项明确标注

---

## 1. 验证环境

| 项 | 值 |
|---|---|
| 操作系统 | Windows（win32） |
| Shell | PowerShell 5.1 |
| Node | v26.13.0 |
| 浏览器（PDF 打印） | Microsoft Edge（headless） |
| 办公套件（PPT→PDF） | LibreOffice（soffice） |
| DOCX 生成 | docx（Node 库） |
| PPTX 读写 | fflate + OOXML 直接编辑 |

---

## 2. 检查结果

| # | 检查 | 方法 | 结果 |
|---|---|---|---|
| 1 | 自动化测试 | `npm run test:unit` / `npm run test:server` | **97 + 53 = 150 通过** |
| 2 | 说明书 DOCX 可解压 | 解压 `word/document.xml` | 通过 |
| 3 | DOCX 含 Supabase | 文本计数 | 14 处 |
| 4 | DOCX 含 150 条 | 文本计数 | 4 处 |
| 5 | DOCX 含“3.3 双端架构” | 文本计数 | 1 处 |
| 6 | DOCX 表格数 | `<w:tbl>` 计数 | 13 |
| 7 | 说明书 PDF 页数 | `/Type /Page` 计数 | 13 |
| 8 | PPTX 可解压 | OOXML 解包 | 通过 |
| 9 | PPTX 幻灯片数 | `ppt/slides/slide*.xml` | 21 |
| 10 | PPTX `sldId` 数 | `presentation.xml` | 21 |
| 11 | PPTX slide 关系数 | `presentation.xml.rels` | 21 |
| 12 | 新增页文本 | `slide20.xml` / `slide21.xml` | 产品能力 / 双链路，均含 Supabase |
| 13 | 旧口径 147（正文） | 全部 `a:t` 扫描 | 0 处 |
| 14 | PPT PDF 页数 | `/Type /Page` 计数 | 21 |
| 15 | 包内 `.env` / 密钥 | 文件名与内容抽检 | 0 |
| 16 | 证据密钥抽检 | `sk-*` / `eyJ*` / `service_role` | 0 命中 |
| 17 | ZIP 条目数 | fflate / .NET 读取 | 861 |
| 18 | ZIP 中文文件名 | fflate + .NET round-trip | 正常，无乱码 |
| 19 | ZIP 关键文件 | 条目匹配 | 说明书、PPT、清单、run.json 均在 |

---

## 3. 关键命令

```powershell
npm run test:unit        # 12 files / 97 tests passed
npm run test:server      # tests 53 / pass 53

node _work/build-docx-v3.mjs
node _work/build-pdf-v3.mjs
node _work/build-pptx-v2.mjs
node _work/build-manifest.mjs
node _work/zip-package.mjs
```

PPTX → PDF：

```powershell
& "C:\Program Files\LibreOffice\program\soffice.exe" --headless --norestore `
  --convert-to pdf --outdir outputs\submission `
  "outputs\submission\C_framebyframe_Frame by Frame.pptx"
```

---

## 4. 已知限制

1. 未在真实投影上目检新增 PPT 页；字距与换行以 PowerPoint 打开为准。
2. LibreOffice 导出的 PPT PDF 与 PowerPoint 渲染可能有细微差异；放映优先用 PPTX。
3. 说明书 PDF 由 Edge 打印，不同机器打开可能分页略有差异。
4. 未重新执行 DeepWorks Agent 运行；平台证据沿用 2026-11-19 归档。
5. 未执行 Supabase T01–T16 端到端测试。
6. 未制作 3 分钟演示视频。

---

## 5. 结论

- 文件完整性：通过。
- 格式可打开性：通过（DOCX / PPTX / PDF / ZIP）。
- 口径一致性：通过（150 条、Supabase 待验、3 验证器 + 4 检查）。
- 敏感信息：未发现。
- 可提交性：材料主体可提交；视频、访谈、合规决定仍需本人处理。
