# Forge Readiness And Remediation Backend Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 readiness 和 remediations 顶层直接返回 execution backend coverage，整改与放行调用方不需要再从 controlPlane 嵌套对象里反查。

**Architecture:** 继续复用共享的 execution backend coverage helper，只在 `getDeliveryReadinessForAI()` 和 `getRemediationsForAI()` 顶层透传 `executionBackends`。不引入新对象，不修改页面层语义。

**Tech Stack:** Next.js, TypeScript, Vitest, AI aggregate responses

---

### Task 1: Write failing tests

**Files:**
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-api-routes.test.ts`

**Step 1: Write the failing test**

断言：

- `getDeliveryReadinessForAI()` 在声明外部执行后端时，顶层返回 `executionBackends`
- `getRemediationsForAI()` 与 `/api/forge/remediations` 也返回同一份 coverage

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: FAIL because readiness/remediations do not expose top-level backend coverage yet.

### Task 2: Implement top-level passthrough

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`

**Step 1: Wire readiness**

给 `getDeliveryReadinessForAI()` 顶层增加 `executionBackends`。

**Step 2: Wire remediations**

给 `getRemediationsForAI()` 顶层增加 `executionBackends`。

**Step 3: Run targeted tests**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: PASS

### Task 3: Docs and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`
- Modify: `docs/plans/2026-03-10-forge-execution-backend-contracts.md`

**Step 1: Document top-level coverage exposure**

说明 readiness / remediations 顶层也会返回 execution backend coverage。

**Step 2: Run full verification**

Run:

- `npm test`
- `npm run build`
- `npm run build:electron`

Expected: all pass.
