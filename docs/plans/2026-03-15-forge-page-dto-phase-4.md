# Forge Page DTO Phase 4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `execution` 页从“DTO 携带 snapshot 兼容层”推进到真正的 block DTO，由服务端预先产出区块数据，页面组件不再依赖整份 snapshot。

**Architecture:** 新增一个共享的 execution page data builder，把当前组件内部基于 `snapshot + runtime props` 的派生逻辑提取成纯函数，供 `src/server/forge-page-dtos.ts` 和组件旧 props 兼容入口共用。正式 `pages.execution` 将只输出 metrics、section items、run queue 数据和本地上下文块，不再暴露 `snapshot`。

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Task 1: 为 execution block DTO 建立 red test

**Files:**
- Modify: `tests/forge-page-data.test.ts`
- Modify: `tests/forge-page-dto-components.test.tsx`

**Step 1: Write the failing test**

新增断言:
- `context.pages.execution` 不再暴露 `snapshot`
- `context.pages.execution.metrics.totalRuns` 等 block 字段存在
- `ForgeExecutionPage` 能从不含 `snapshot` 的 `data` 渲染

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx`

Expected: FAIL because `pages.execution` 还是旧结构

### Task 2: 抽共享 execution page builder

**Files:**
- Create: `src/lib/forge-execution-page-data.ts`
- Modify: `src/server/forge-page-dtos.ts`

**Step 1: Write minimal implementation**

新增共享 builder:
- `buildForgeExecutionPageData({ snapshot, ...runtime overrides })`

输出:
- `metrics`
- `focus`
- `blockers`
- `taskQueue`
- `evidence`
- `remediation`
- `runnerRegistry`
- `runnerProbe`
- `failureAttribution`
- `timeline`
- `runQueue`
- `localContext`

并让 `getForgeExecutionPageData()` 调用这个 builder。

**Step 2: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx`

Expected: PASS

### Task 3: 切 execution 组件到 block DTO 渲染

**Files:**
- Modify: `src/components/forge-execution-page.tsx`

**Step 1: Write minimal implementation**

- `data` 入口直接消费 block DTO
- 旧 `snapshot + runtime props` 入口内部调用共享 builder 做兼容
- UI 结构保持不变，只替换数据来源

**Step 2: Run focused tests**

Run: `npm test -- tests/forge-page-dto-components.test.tsx tests/forge-os-pages.test.tsx`

Expected: PASS

### Task 4: 完整验证本批改动

**Files:**
- Verify only

**Step 1: Run verification**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/agent-team-page.test.tsx tests/forge-assets-page.test.tsx tests/forge-os-pages.test.tsx`

Expected: PASS with 0 failures
