# Forge Project Task Execution Paths

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把项目页 `项目任务清单` 里的任务执行路径显式展示出来，让负责人不用再从任务摘要或整改文案里猜这条任务默认走 `执行后端` 还是 `本地 Runner`。

**Architecture:** 保持现有 snapshot-first 结构，不新增持久化字段。项目页直接复用任务队列里已有的 `runtimeExecutionBackendLabel / retryRunnerCommand / unifiedRetryRunnerCommand`：有结构化 backend 时显示 `执行后端：...`，否则在存在回放命令时显示 `执行链：本地 Runner`。

**Tech Stack:** TypeScript, React, Vitest

---

## Implemented

1. `ForgeProjectsPage` 的 `项目任务清单` 条目现在会显式显示任务执行路径
2. 优先级顺序如下：
   - 有 `runtimeExecutionBackendLabel` 时显示 `执行后端：...`
   - 无 backend 但存在任务回放命令时显示 `执行链：本地 Runner`
3. 项目页测试已补齐对应断言，确保负责人视角不再依赖摘要文案猜执行路径

## Verified

- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，项目页负责人可以更快判断：

- 这条任务会落到哪条执行链上
- 当前是外部 backend 接管，还是继续走本地 Runner 回放

这样项目级责任链开始从“交付就绪度卡片”延伸到“具体任务条目”。
