# Forge Page DTO Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `artifacts`、`assets` 两页从直接依赖原始 snapshot 收口为正式 page DTO，并让正式路由改为传递 `pages.artifacts/pages.assets`。

**Architecture:** `src/server/forge-page-dtos.ts` 扩展 `artifacts/assets` 两个 page DTO builder。`assets` 使用页面直接消费的 snapshot 子集。`artifacts` 先采用“可支撑现有 selector 的 snapshot 子集 DTO”，在组件内保持最小兼容层，不重写页面计算逻辑。正式路由切到 `data`，旧 `snapshot` props 继续保留兼容口子。

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Task 1: 为 artifacts/assets page DTO 建立 red test

**Files:**
- Modify: `tests/forge-page-data.test.ts`
- Modify: `tests/forge-page-dto-components.test.tsx`

**Step 1: Write the failing test**

新增断言:
- `context.pages.artifacts`
- `context.pages.assets`
- `ForgeArtifactsPage` 能吃 `data`
- `ForgeAssetsPage` 能吃 `data`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx`

Expected: FAIL because `pages.artifacts/assets` 还不存在

### Task 2: 实现 artifacts/assets DTO builders

**Files:**
- Modify: `src/server/forge-page-dtos.ts`
- Modify: `src/server/forge-page-data.ts`

**Step 1: Write minimal implementation**

新增:
- `getForgeArtifactsPageData(snapshot)`
- `getForgeAssetsPageData(snapshot)`

并挂到 `getForgePages(snapshot)`。

**Step 2: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx`

Expected: PASS

### Task 3: 切换两个组件和路由入口

**Files:**
- Modify: `src/components/forge-artifacts-page.tsx`
- Modify: `src/components/forge-assets-page.tsx`
- Modify: `app/[view]/page.tsx`

**Step 1: Write minimal implementation**

- 两个组件支持 `data`
- `artifacts/assets` 路由改传 `pages.artifacts/pages.assets`
- 旧 `snapshot` 测试入口继续兼容

**Step 2: Run focused tests**

Run: `npm test -- tests/forge-assets-page.test.tsx tests/forge-os-pages.test.tsx tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx`

Expected: PASS

### Task 4: 完整验证本批改动

**Files:**
- Verify only

**Step 1: Run verification**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx tests/forge-assets-page.test.tsx tests/forge-os-pages.test.tsx`

Expected: PASS with 0 failures
