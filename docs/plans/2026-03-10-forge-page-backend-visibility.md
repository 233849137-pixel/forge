# Forge Page Backend Visibility

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把结构化执行后端信息前推到执行页和治理页，让页面直接展示 `runtimeExecutionBackendLabel`，不再依赖整改文案做隐式传达。

**Architecture:** 复用上一批已经打通的 `runtimeExecutionBackendLabel`，不新增持久化状态。执行页从 `remediationQueue` 和 `runtimeSummary` 直接展示执行后端；治理页从 `recentExecutions / followUpTasks / escalationActions` 直接展示执行后端，同时给升级动作补齐同名结构化字段。

**Tech Stack:** TypeScript, React, Vitest, Forge core selectors

---

## Implemented

1. `ForgeExecutionPage` 现在支持：
   - `executionBackendSummary`
   - `executionBackendDetails`
2. 执行页的以下位置开始显式显示 `执行后端`
   - `整改回放`
   - `本地运行上下文`
3. `ForgeEscalationAction` 新增 `runtimeExecutionBackendLabel`
4. `getReleaseGateEscalationActions(...)` 现在会把阻断任务上的结构化执行后端前推到升级动作
5. `ForgeGovernancePage` 的以下位置开始显式显示 `执行后端`
   - `最近命令执行`
   - `followUpTasks`
   - `自动升级动作`
6. `[view]/page.tsx` 已把 `executionBackendSummary / executionBackendDetails` 传给执行页

## Verified

- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，页面层已经不需要再靠“整改动作里碰巧包含了执行后端文案”来判断默认 backend。执行负责人和治理负责人都能直接在页面看到结构化执行后端信号。
