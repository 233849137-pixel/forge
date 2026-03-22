# Forge Page DTO Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `home`、`projects`、`team` 三页从直接依赖全量 `ForgeDashboardSnapshot` 收口为正式 page DTO，并让服务端路由改为传递 DTO。

**Architecture:** 在服务端新增 page DTO builder，`getForgePageContext()` 继续保留 `snapshot/controlPlane/blocks`，同时新增 `pages` 结果。页面入口改为读取 `pages.home/pages.projects/pages.team`，组件 props 切换到 DTO。为避免大面积改 helper，实现时同步收窄 `forge-console-utils` 的输入类型，只保留页面实际需要的字段。

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Task 1: 为三页 DTO 建立 red test

**Files:**
- Modify: `tests/forge-page-data.test.ts`

**Step 1: Write the failing test**

新增测试，断言 `getForgePageContext()` 返回:
- `pages.home`
- `pages.projects`
- `pages.team`

并验证:
- `pages.home` 不包含 `artifacts`
- `pages.projects` 包含 `runEvents` 和 `deliveryGate`
- `pages.team` 包含 `runners` 和 `teamTemplates`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-page-data.test.ts`

Expected: FAIL because `pages` 尚不存在

### Task 2: 实现 page DTO builders

**Files:**
- Create: `src/server/forge-page-dtos.ts`
- Modify: `src/server/forge-page-data.ts`

**Step 1: Write minimal implementation**

新增:
- `getForgeHomePageData(snapshot)`
- `getForgeProjectsPageData(snapshot)`
- `getForgeTeamPageData(snapshot)`

只返回页面当前实际需要的 snapshot 子集。

**Step 2: Run test to verify it passes**

Run: `npm test -- tests/forge-page-data.test.ts`

Expected: PASS

### Task 3: 让组件切换到 DTO

**Files:**
- Modify: `src/components/forge-home-page.tsx`
- Modify: `src/components/forge-projects-page.tsx`
- Modify: `src/components/agent-team-page.tsx`
- Modify: `src/components/forge-console-utils.ts`
- Modify: `app/page.tsx`
- Modify: `app/[view]/page.tsx`

**Step 1: Write the failing test**

更新三页现有组件测试，让它们传 `data` 而不是 `snapshot`。

**Step 2: Run focused tests to verify they fail**

Run: `npm test -- tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/agent-team-page.test.tsx`

Expected: FAIL because 组件 props 仍是 `snapshot`

**Step 3: Write minimal implementation**

- 三个组件 props 改为 `data`
- 内部把 `snapshot` 引用替换为 `data`
- `forge-console-utils.ts` 输入类型收窄为页面 DTO 所需字段子集
- 路由改传 `pages.home/pages.projects/pages.team`
- 删除三页无效 action / control-plane 传参

**Step 4: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/agent-team-page.test.tsx`

Expected: PASS

### Task 4: 全量验证本批改动

**Files:**
- Verify only

**Step 1: Run verification**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/agent-team-page.test.tsx`

Expected: PASS with 0 failures
