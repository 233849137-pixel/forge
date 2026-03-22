# Forge Page DTO Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `execution`、`governance` 两页从散传 `snapshot + controlPlane` props 收口为正式 page DTO，同时保留组件旧 props 兼容口。

**Architecture:** `src/server/forge-page-dtos.ts` 新增 `execution/governance` 两个 page DTO builder，直接把当前路由层手工展开的 runtime/governance props 收进 DTO。组件层新增 `data` 入口，并通过 `data ?? legacy props` 的方式保持现有测试和调用兼容。正式路由切到 `pages.execution/pages.governance`，不重写现有 selector 和页面内部派生逻辑。

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Task 1: 为 execution/governance page DTO 建立 red test

**Files:**
- Modify: `tests/forge-page-data.test.ts`
- Modify: `tests/forge-page-dto-components.test.tsx`

**Step 1: Write the failing test**

新增断言:
- `context.pages.execution`
- `context.pages.governance`
- `ForgeExecutionPage` 能吃 `data`
- `ForgeGovernancePage` 能吃 `data`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx`

Expected: FAIL because `pages.execution/governance` 和对应 `data` 支持还不存在

### Task 2: 实现 execution/governance DTO builders

**Files:**
- Modify: `src/server/forge-page-dtos.ts`
- Modify: `src/server/forge-page-data.ts`

**Step 1: Write minimal implementation**

新增:
- `getForgeExecutionPageData(snapshot, controlPlane)`
- `getForgeGovernancePageData(snapshot, controlPlane)`

并把 `getForgePages` 扩展为接收 `snapshot + controlPlane`。

**Step 2: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx`

Expected: PASS

### Task 3: 切换两个组件和路由入口

**Files:**
- Modify: `src/components/forge-execution-page.tsx`
- Modify: `src/components/forge-governance-page.tsx`
- Modify: `app/[view]/page.tsx`

**Step 1: Write minimal implementation**

- 两个组件支持 `data`
- `execution/governance` 路由改传 `pages.execution/pages.governance`
- 旧 `snapshot + runtime props` 测试入口继续兼容

**Step 2: Run focused tests**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx tests/forge-os-pages.test.tsx`

Expected: PASS

### Task 4: 完整验证本批改动

**Files:**
- Verify only

**Step 1: Run verification**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/agent-team-page.test.tsx tests/forge-assets-page.test.tsx tests/forge-os-pages.test.tsx`

Expected: PASS with 0 failures
