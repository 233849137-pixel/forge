# Forge Control Plane Backend Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 execution backend 的覆盖能力前推到 control-plane 与命令中心，让外部 Agent 不用额外查 capabilities 也能知道当前后端承载哪些标准命令链。

**Architecture:** 复用现有的 execution backend capability 派生结果，抽成共享 helper，然后让 `buildControlPlaneSnapshot()` 和 `getCommandCenterForAI()` 直接返回同一份 `executionBackends` 数组，避免在不同聚合口重复拼 coverage 逻辑。

**Tech Stack:** Next.js, TypeScript, Vitest, AI control-plane selectors

---

### Task 1: Write failing tests for backend coverage exposure

**Files:**
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-api-routes.test.ts`

**Step 1: Write the failing test**

断言：

- `controlPlane.executionBackends` 存在并带 `supportedCommandTypes`
- `getCommandCenterForAI()` / `/api/forge/commands` 也直接返回 `executionBackends`

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: FAIL because these aggregations do not expose backend coverage yet.

### Task 2: Implement shared coverage helper

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`

**Step 1: Extract shared backend capability helper**

从 `getCapabilityRegistryForAI()` 中抽出 execution backend capability 生成逻辑，改成可复用 helper。

**Step 2: Expose through control-plane and command center**

让以下返回都直接带 `executionBackends`：

- `buildControlPlaneSnapshot()`
- `getCommandCenterForAI()`

**Step 3: Run targeted tests**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: PASS

### Task 3: Docs and full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`
- Modify: `docs/plans/2026-03-10-forge-execution-backend-contracts.md`

**Step 1: Document control-plane exposure**

写明 control-plane / commands 已可直接返回 execution backend coverage。

**Step 2: Run full verification**

Run:

- `npm test`
- `npm run build`
- `npm run build:electron`

Expected: all pass.
