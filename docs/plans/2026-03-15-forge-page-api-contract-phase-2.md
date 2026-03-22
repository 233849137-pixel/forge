# Forge Page API Contract Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为前端提供可复用的页面 API 客户端，并让 `execution` 页通过正式页面合同接口进行一次真实前端拉取。

**Architecture:** 新增 `src/lib/forge-page-api.ts` 封装 `/api/forge/pages` 的读取和错误处理，再新增 `src/components/forge-execution-page-bridge.tsx`，使用初始 SSR DTO 首屏渲染，并在客户端通过页面 API 合同刷新 `execution` 数据。路由层只切 `execution`，其他页保持不动。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: 为页面 API 客户端与 execution 桥接建立 red test

**Files:**
- Create: `tests/forge-page-api.test.ts`
- Create: `tests/forge-execution-page-bridge.test.tsx`

**Step 1: Write the failing test**

新增断言:
- `fetchForgePageContract("execution")` 能解析成功 payload
- API 返回错误 envelope 时抛出 message
- `ForgeExecutionPageBridge` 在启用 live sync 时会请求 `/api/forge/pages?view=execution`
- bridge 会用刷新后的合同数据覆盖初始 execution 数据

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-page-api.test.ts tests/forge-execution-page-bridge.test.tsx`

Expected: FAIL because helper 和 bridge 还不存在

### Task 2: 实现页面 API 客户端与 execution 桥接

**Files:**
- Create: `src/lib/forge-page-api.ts`
- Create: `src/components/forge-execution-page-bridge.tsx`
- Modify: `app/[view]/page.tsx`

**Step 1: Write minimal implementation**

- `fetchForgePageContract(view)` 封装统一读取逻辑
- `ForgeExecutionPageBridge` 用 `initialData` 首屏渲染
- bridge 在客户端拉取 `/api/forge/pages?view=execution`
- 拉取成功后刷新页面数据，失败时保留旧数据
- `execution` 路由改为先渲染 bridge

**Step 2: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-page-api.test.ts tests/forge-execution-page-bridge.test.tsx`

Expected: PASS

### Task 3: 做一轮回归验证

**Files:**
- Verify only

**Step 1: Run verification**

Run: `npm test -- tests/forge-page-api.test.ts tests/forge-execution-page-bridge.test.tsx tests/forge-api-routes.test.ts tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx tests/forge-os-pages.test.tsx`

Expected: PASS with 0 failures
