# Forge Page API Contract Phase 4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `governance` 页纳入正式页面合同，并让前端通过 `/api/forge/pages?view=governance` 完成一次真实合同刷新。

**Architecture:** 复用现有 `ForgeGovernancePageData` 作为稳定页面合同，不先重写其内部摘要生成逻辑。新增 `ForgeGovernancePageBridge`，保持 SSR 首屏渲染，再在客户端做一次挂载后刷新。页面合同路由把 `governance` 纳入稳定集合，前端入口改为使用 bridge。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: 为 governance 稳定合同与 bridge 建立 red test

**Files:**
- Modify: `tests/forge-api-routes.test.ts`
- Create: `tests/forge-governance-page-bridge.test.tsx`

**Step 1: Write the failing test**

新增断言:
- `/api/forge/pages?view=governance` 返回 200 和 `governance` 页面合同
- `ForgeGovernancePageBridge` 在启用 live sync 时会请求 `/api/forge/pages?view=governance`
- bridge 会用刷新后的 `governance` 合同数据覆盖初始摘要

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-api-routes.test.ts tests/forge-governance-page-bridge.test.tsx`

Expected: FAIL because governance 还不在稳定合同集合，bridge 也不存在

### Task 2: 实现 governance 稳定合同与 bridge

**Files:**
- Modify: `src/lib/forge-page-contract.ts`
- Modify: `app/api/forge/pages/route.ts`
- Create: `src/components/forge-governance-page-bridge.tsx`
- Modify: `app/[view]/page.tsx`

**Step 1: Write minimal implementation**

- 将 `governance` 加入 `forgeStablePageViews` 和 `ForgeStablePageMap`
- `getStablePageContract()` 支持返回 `pages.governance`
- `ForgeGovernancePageBridge` 用 `initialData` 首屏渲染
- bridge 在客户端仅做一次 `/api/forge/pages?view=governance` 刷新
- `governance` 路由改为渲染 bridge

**Step 2: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-api-routes.test.ts tests/forge-governance-page-bridge.test.tsx`

Expected: PASS

### Task 3: 做一轮回归验证

**Files:**
- Verify only

**Step 1: Run verification**

Run: `npm test -- tests/forge-governance-page-bridge.test.tsx tests/forge-api-routes.test.ts tests/forge-page-api.test.ts tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx tests/forge-os-pages.test.tsx`

Expected: PASS with 0 failures
