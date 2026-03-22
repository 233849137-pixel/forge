# Forge Remediation Backend Guidance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让整改和回放结果直接说明默认会落到哪个 execution backend 上，而不是只说明模型执行器。

**Architecture:** 复用共享的 execution backend coverage，根据 `retryCommandId -> command.type -> supportedCommandTypes` 解析默认 execution backend。只增强 `getRemediationsForAI()`、`retryTaskForAI()`、`retryRemediationForAI()` 的 `nextAction` 文案，不修改 selectors 级别的任务队列语义。

**Tech Stack:** Next.js, TypeScript, Vitest, AI remediation aggregates

---

### Task 1: Write failing tests

**Files:**
- Modify: `tests/forge-ai.test.ts`

**Step 1: Write the failing test**

断言在声明 OpenClaw 后端时：

- `getRemediationsForAI().items[].nextAction` 包含 `执行后端：OpenClaw`
- `retryTaskForAI().nextAction` 包含 `执行后端：OpenClaw`
- `retryRemediationForAI().nextAction` 包含 `执行后端：OpenClaw`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-ai.test.ts`

Expected: FAIL because nextAction only mentions model execution provider today.

### Task 2: Implement backend-aware nextAction guidance

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`

**Step 1: Add backend resolution helper**

根据：

- `retryCommandId`
- `snapshot.commands`
- `executionBackends.supportedCommandTypes`

找出默认 execution backend coverage。

**Step 2: Append backend guidance**

在以下返回里追加 `执行后端：...`：

- `getRemediationsForAI().items[].nextAction`
- `retryTaskForAI().nextAction`
- `retryRemediationForAI().nextAction`

**Step 3: Run targeted tests**

Run: `npm test -- tests/forge-ai.test.ts`

Expected: PASS

### Task 3: Docs and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-10-forge-execution-backend-contracts.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`

**Step 1: Document backend-aware remediation guidance**

说明整改与回放的 `nextAction` 现在会直接提示默认 execution backend。

**Step 2: Run full verification**

Run:

- `npm test`
- `npm run build`
- `npm run build:electron`

Expected: all pass.
