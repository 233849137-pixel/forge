# Forge Page API Contract Phase 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 `projects` 页也通过正式页面合同接口完成一次真实前端拉取，同时避免刷新流程破坏当前页面的本地交互状态。

**Architecture:** 新增 `src/components/forge-projects-page-bridge.tsx`，先用 SSR 输出的 `projects` DTO 首屏渲染，再在挂载后调用 `/api/forge/pages?view=projects` 做一次合同刷新。路由层只切 `projects`，页面本体仍保持现有客户端交互与状态管理，不引入轮询。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: 为 projects 桥接建立 red test

**Files:**
- Create: `tests/forge-projects-page-bridge.test.tsx`

**Step 1: Write the failing test**

新增断言:
- `ForgeProjectsPageBridge` 在启用 live sync 时会请求 `/api/forge/pages?view=projects`
- bridge 会用刷新后的合同数据覆盖初始 `projects` 页面数据

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-projects-page-bridge.test.tsx`

Expected: FAIL because bridge 还不存在

### Task 2: 实现 projects 桥接

**Files:**
- Create: `src/components/forge-projects-page-bridge.tsx`
- Modify: `app/[view]/page.tsx`

**Step 1: Write minimal implementation**

- `ForgeProjectsPageBridge` 用 `initialData` 首屏渲染
- bridge 在客户端仅做一次 `/api/forge/pages?view=projects` 刷新
- 拉取失败时保留旧数据
- `projects` 路由改为渲染 bridge

**Step 2: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-projects-page-bridge.test.tsx tests/forge-projects-page.test.tsx`

Expected: PASS

### Task 3: 做一轮回归验证

**Files:**
- Verify only

**Step 1: Run verification**

Run: `npm test -- tests/forge-projects-page-bridge.test.tsx tests/forge-page-api.test.ts tests/forge-projects-page.test.tsx tests/forge-page-dto-components.test.tsx tests/forge-api-routes.test.ts tests/forge-os-pages.test.tsx`

Expected: PASS with 0 failures
