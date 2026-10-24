# product-explode 验收报告
时间：2026-10-24 22:15 (Asia/Shanghai)
对象：`/workspace/product-explode` 预览 `http://127.0.0.1:4173/`
方式：Puppeteer + Chrome（swiftshader），脚本 `qa_accept_v2.mjs`（在 Pi 验收流程中编写/执行）

## 1. 首屏可交互 ≤5s — PASS
- `t0 → window.__arm`：3189 ms
- `t0 → canvas+部件列表可交互`：3192 ms
- 页面错误：0

## 2. 拆解/复原各 10 次 — PASS
- 10 轮 `setProgress(1)` → `setProgress(0)`
- 复原最大位置误差：0
- 每轮至少 6 个部件发生位移：全部满足
- 无页面报错

## 3. 点选详情（名称+用途）— PASS
| id | 名称 | 用途 |
|----|------|------|
| base | 底座 | 有（地脚安装与整机承载…） |
| waist | 腰部转台 | 有 |
| upper | 大臂 | 有 |
| fore | 小臂 | 有 |
| wrist | 手腕 | 有 |
| grip | 末端夹爪 | 有 |

## 4. 包体 ≤15MB、无境外 CDN — PASS
- `dist`：632 KB（约 0.62 MB）≪ 15 MB
- `src`/`dist`/`index.html`：无 jsdelivr/unpkg/googleapis 等境外 CDN（仅 SVG 命名空间 `w3.org`）

## 5. 测试在 Pi 流程完成 — PASS
- 验收脚本与跑测在虚拟电脑 Pi/QA 流程下完成（`qa_accept_v2.mjs` / `qa_accept_result.log`）

结论：通过
