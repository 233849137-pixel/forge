# Forge Project Admission Execution Path

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把项目页 `阶段准入与缺口` 面板补成可直接显示默认回放路径，让负责人在判断“当前能否继续推进”时，同时知道默认会落到 `执行后端` 还是 `本地 Runner`。

**Architecture:** 继续复用项目页已经派生好的 `projectExecutionPathHint`，不新增持久化状态，不新增 selector。页面只把这条提示转成结构化 summary item：label 固定为 `默认回放`，value 为 `执行后端 ...` 或 `本地 Runner`。

**Tech Stack:** TypeScript, React, Vitest

---

## Implemented

1. `ForgeProjectsPage` 现在会把 `projectExecutionPathHint` 派生为结构化的 `projectExecutionPathValue`
2. `阶段准入与缺口` 现在新增 `默认回放`
3. 项目页测试已补齐断言，确保负责人在准入判断里也能看到默认执行链

## Verified

- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，项目页里三个负责人关键位置已经共享执行路径：

- `当前上下文`
- `阶段准入与缺口`
- `项目任务清单`

项目页开始更像一个完整的交付判断入口，而不是只在任务列表里零散暴露执行链。
