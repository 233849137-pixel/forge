# Forge Asset Feedback Writeback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 给组件注册表补上最小可用的使用反馈信号，让资产推荐开始基于真实运行结果而不是静态推荐。

**Architecture:** 第一版不新增持久化评分表，直接基于现有 `runs.linkedComponentIds`、`runEvents`、`projectAssetLinks` 和 `TaskPack` 装配结果派生反馈信号。反馈信号先挂到 `componentRegistry` 这条现有主链，覆盖 `core -> ai -> page -> tests -> docs`，避免引入新的一级对象或额外控制面。

**Tech Stack:** TypeScript、Next.js App Router、Vitest、SQLite 快照、Forge selectors / AI core

---

### Task 1: Define The Minimal Feedback Model

**Files:**
- Modify: `../../packages/core/src/types.ts`
- Modify: `../../packages/core/src/selectors.ts`
- Test: `../../tests/forge-selectors.test.ts`

**Step 1: Write the failing selector test**

- Add a selector test for `getComponentUsageSignals(...)`
- Assert that `component-payment-checkout` reports:
  - `usageCount = 1`
  - `blockedCount = 1`
  - `successCount = 0`
  - latest run title includes `主流程回归验证`
  - latest failure summary includes `登录态失效`
- Assert that `component-auth-email` reports:
  - `usageCount = 1`
  - `runningCount = 1`
  - `blockedCount = 0`

**Step 2: Run the selector test to verify RED**

Run: `npm test -- --run tests/forge-selectors.test.ts`
Expected: FAIL because `getComponentUsageSignals` does not exist yet.

**Step 3: Write the minimal selector implementation**

- Add `ForgeComponentUsageSignal` and supporting types
- Implement `getComponentUsageSignals(snapshot, projectId?)`
- Derive counts from existing runs, recent failure summary from `runEvents`
- Keep sorting stable: linked components first, then usage count desc, then title

**Step 4: Run the selector test to verify GREEN**

Run: `npm test -- --run tests/forge-selectors.test.ts`
Expected: PASS

### Task 2: Surface Feedback Through AI And Control Plane

**Files:**
- Modify: `../../packages/ai/src/forge-ai.ts`
- Test: `../../tests/forge-ai.test.ts`

**Step 1: Write the failing AI tests**

- Extend component registry test to expect `usageSignals`
- Extend control-plane snapshot test to expect `componentRegistry.usageSignals`
- Assert the first signal belongs to `component-payment-checkout` and includes `blockedCount`

**Step 2: Run the AI tests to verify RED**

Run: `npm test -- --run tests/forge-ai.test.ts`
Expected: FAIL because registry result does not include usage feedback yet.

**Step 3: Write the minimal AI implementation**

- Reuse `getComponentUsageSignals(...)` inside `buildComponentRegistryResult(...)`
- Include compact signal payload in:
  - `componentRegistry.usageSignals`
  - `componentRegistry.items` detail rows when useful
  - control-plane summary slice

**Step 4: Run the AI tests to verify GREEN**

Run: `npm test -- --run tests/forge-ai.test.ts`
Expected: PASS

### Task 3: Show Feedback On The Assets Page

**Files:**
- Modify: `../../src/components/forge-assets-page.tsx`
- Test: `../../tests/forge-os-pages.test.tsx`

**Step 1: Write the failing page test**

- Add expectation for a new section heading: `组件使用信号`
- Assert rendered text includes:
  - `最近阻塞`
  - `主流程回归验证`

**Step 2: Run the page test to verify RED**

Run: `npm test -- --run tests/forge-os-pages.test.tsx`
Expected: FAIL because the assets page does not render the feedback section yet.

**Step 3: Write the minimal page implementation**

- Add a focused section to assets page for component usage signals
- Show only the current project scope
- Keep copy short and operational:
  - usage count
  - success / blocked / running
  - latest run
  - latest failure summary if present

**Step 4: Run the page test to verify GREEN**

Run: `npm test -- --run tests/forge-os-pages.test.tsx`
Expected: PASS

### Task 4: Sync Docs And Revalidate The Batch

**Files:**
- Modify: `../../README.md`
- Modify: `../../docs/plans/2026-03-09-forge-global-program-plan.md`
- Modify: `../../docs/plans/2026-03-09-forge-takeover-next-phase.md`

**Step 1: Update docs to reflect derived feedback signals**

- Document that Task 3 first phase uses derived signals rather than a new feedback table
- Document where feedback now appears: component registry, control plane, assets page

**Step 2: Run the full verification set**

Run:
- `npm test`
- `npm run build`
- `npm run build:electron`

Expected: all green

**Step 3: Mark Task 3 progress**

- Update global plan and takeover doc with current status and next batch entry point

## Exit Criteria

- `getComponentUsageSignals(...)` exists and is covered by tests
- `getComponentRegistryForAI(...)` exposes compact usage feedback
- assets page shows current project component usage signals
- docs reflect the derived-feedback approach
- `npm test` / `npm run build` / `npm run build:electron` all pass
