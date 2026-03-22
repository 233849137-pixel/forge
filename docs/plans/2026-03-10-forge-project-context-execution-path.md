# Forge Project Context Execution Path

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把项目页 `当前上下文` 面板补成可直接显示默认回放路径，让负责人不需要先看任务列表，打开项目页就能知道下一步默认走 `执行后端` 还是 `本地 Runner`。

**Architecture:** 继续复用项目任务队列，不新增持久化字段。项目页只读取当前项目最高优先级任务：如果已有 `runtimeExecutionBackendLabel`，就显示 `默认回放：执行后端 ...`；否则在存在任务回放命令时显示 `默认回放：本地 Runner`。`ProjectContext` 只新增一个可选提示字段，不扩别的判断逻辑。

**Tech Stack:** TypeScript, React, Vitest

---

## Implemented

1. `ProjectContext` 新增可选字段 `executionPathHint`
2. `ForgeProjectsPage` 现在会基于当前项目最高优先级任务派生默认回放路径
3. `当前上下文` 的 `当前阶段` 卡片现在会显式显示：
   - `默认回放：执行后端 ...`
   - 或 `默认回放：本地 Runner`
4. 项目页测试已补齐断言，确保负责人视角打开页面就能看到默认执行链

## Verified

- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，项目页负责人的关键判断又少了一跳：

- 不需要先看任务列表
- 不需要先点命令中心

打开 `当前上下文` 就能直接知道下一步默认落到哪条回放链。
