# Scripts 文件地图与说明

本目录用于维护构建、收尾、烟测、预检与文本处理脚本。

## 1. 发布与收尾

| 文件 | 类型 | 作用 | 常用命令 |
|---|---|---|---|
| `finish_task.ps1` | PowerShell | 一键收尾：版本写入、备份、构建、smoke、AG_STATE 自动块、stamp | `powershell -ExecutionPolicy Bypass -File scripts/finish_task.ps1 -Version 3.8.7 -Tag release_3_8_7` |
| `check_finish_task.ps1` | PowerShell | 校验 finish 产物与关键状态是否完整 | `powershell -ExecutionPolicy Bypass -File scripts/check_finish_task.ps1` |
| `copy-versioned-build.cjs` | Node.js | 将 `dist/index.html` 复制为版本化构建物，并阻断同版本静默覆盖 | `node scripts/copy-versioned-build.cjs` |

## 2. 质量与预检

| 文件 | 类型 | 作用 | 常用命令 |
|---|---|---|---|
| `preflight.ps1` | PowerShell | 执行发布前环境检查（依赖、路径、关键文件） | `powershell -ExecutionPolicy Bypass -File scripts/preflight.ps1` |
| `smoke_test.ps1` | PowerShell | 对构建物做快速烟测（含静态与运行态基础检查） | `powershell -ExecutionPolicy Bypass -File scripts/smoke_test.ps1 -HtmlPath dist/index.html` |

## 3. i18n 与文本批处理

| 文件 | 类型 | 作用 |
|---|---|---|
| `extract-chinese.cjs` | Node.js | 抽取中文文本资源 |
| `replace-with-t.cjs` | Node.js | 批量替换为 i18n `t()` 调用 |
| `scan-i18n-issues.cjs` | Node.js | 扫描 i18n 相关问题 |
| `dedupe-i18n.cjs` | Node.js | i18n 条目去重 |
| `fast-replace.cjs` | Node.js | 高速文本替换工具 |
| `targeted-replace.cjs` | Node.js | 定向替换工具 |

## 4. 备份脚本

| 文件 | 类型 | 作用 | 常用命令 |
|---|---|---|---|
| `backup_scripts.ps1` | PowerShell | 对 `scripts/` 生成 zip + manifest；若内容未变化则默认跳过新增包 | `powershell -ExecutionPolicy Bypass -File scripts/backup_scripts.ps1 -Tag release_3_8_7` |

说明：
- `backup_scripts.ps1` 默认只在脚本树发生变化时生成新的备份包。
- 若需要强制生成新包，可追加 `-Force`。
