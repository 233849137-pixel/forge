# Forge Page API Contract Phase 5 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 `artifacts` 和 `assets` 两张稳定页面也通过 `/api/forge/pages` 完成真实前端合同刷新。

**Architecture:** 沿用现有 `projects / governance` 的保守桥接策略，为 `artifacts` 和 `assets` 分别新增客户端 bridge，继续保留 SSR 首屏，再在挂载后执行一次页面合同刷新。`artifacts` 是纯展示页，`assets` 属于轻交互页，本阶段都不引入轮询。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: 为 artifacts 和 assets bridge 建立 red test

**Files:**
- Create: `tests/forge-artifacts-page-bridge.test.tsx`
- Create: `tests/forge-assets-page-bridge.test.tsx`

**Step 1: Write the failing test**

新增断言:
- `ForgeArtifactsPageBridge` 在启用 live sync 时会请求 `/api/forge/pages?view=artifacts`
- bridge 会用刷新后的 `artifacts` 合同数据覆盖初始展示
- `ForgeAssetsPageBridge` 在启用 live sync 时会请求 `/api/forge/pages?view=assets`
- bridge 会用刷新后的 `assets` 合同数据覆盖初始展示

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-artifacts-page-bridge.test.tsx tests/forge-assets-page-bridge.test.tsx`

Expected: FAIL because bridge 还不存在

### Task 2: 实现 artifacts 和 assets bridge

**Files:**
- Create: `src/components/forge-artifacts-page-bridge.tsx`
- Create: `src/components/forge-assets-page-bridge.tsx`
- Modify: `app/[view]/page.tsx`

**Step 1: Write minimal implementation**

- 两个 bridge 都用 `initialData` 首屏渲染
- bridge 在客户端仅做一次对应页面合同刷新
- 拉取失败时保留旧数据
- `artifacts` 和 `assets` 路由改为渲染 bridge

**Step 2: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-artifacts-page-bridge.test.tsx tests/forge-assets-page-bridge.test.tsx`

Expected: PASS

### Task 3: 做一轮回归验证

**Files:**
- Verify only

**Step 1: Run verification**

Run: `npm test -- tests/forge-artifacts-page-bridge.test.tsx tests/forge-assets-page-bridge.test.tsx tests/forge-page-api.test.ts tests/forge-page-dto-components.test.tsx tests/forge-assets-page.test.tsx tests/forge-os-pages.test.tsx tests/forge-api-routes.test.ts`

Expected: PASS with 0 failures
