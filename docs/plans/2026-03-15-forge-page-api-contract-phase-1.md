# Forge Page API Contract Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为已稳定的页面 DTO 建立正式读接口，让前端可以通过统一 API 获取 `home/projects/team/artifacts/assets/execution` 页面合同数据。

**Architecture:** 新增 `src/lib/forge-page-contract.ts` 维护稳定页面视图集合、别名解析和合同版本，再新增 `app/api/forge/pages/route.ts` 通过 `view` 查询参数返回对应页面 DTO。接口仅暴露当前已稳定页面，不把 `governance` 提前锁进正式合同。

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest

---

### Task 1: 为页面合同 API 建立 red test

**Files:**
- Modify: `tests/forge-api-routes.test.ts`

**Step 1: Write the failing test**

新增断言:
- `GET /api/forge/pages?view=execution` 返回 `view + contractVersion + page`
- `execution` 页面合同不暴露 `snapshot`
- `GET /api/forge/pages?view=intake` 能解析到 `projects`
- 缺少 `view` 时返回标准 400
- 请求 `governance` 时返回“不支持的稳定页面合同”错误

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-api-routes.test.ts`

Expected: FAIL because新路由和合同 helper 还不存在

### Task 2: 实现稳定页面合同与读接口

**Files:**
- Create: `src/lib/forge-page-contract.ts`
- Create: `app/api/forge/pages/route.ts`

**Step 1: Write minimal implementation**

新增:
- `forgeStablePageViews`
- `ForgeStablePageView`
- `resolveForgeStablePageView()`
- `FORGE_PAGE_CONTRACT_VERSION`

接口行为:
- `view` 必填
- 支持别名解析到稳定页面
- 返回 `{ view, contractVersion, page }`
- 对未稳定页面返回显式错误

**Step 2: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-api-routes.test.ts`

Expected: PASS

### Task 3: 做一轮回归验证

**Files:**
- Verify only

**Step 1: Run verification**

Run: `npm test -- tests/forge-api-routes.test.ts tests/forge-page-data.test.ts tests/forge-page-dto-components.test.tsx tests/forge-os-pages.test.tsx`

Expected: PASS with 0 failures
