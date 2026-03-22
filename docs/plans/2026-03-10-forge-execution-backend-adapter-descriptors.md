# Forge Execution Backend Adapter Descriptors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 execution backend 不只暴露 env 键位，还能显式描述自己承载哪条 runner、支持哪些标准命令、预期产出哪些工件。

**Architecture:** 继续使用共享的 execution backend contract registry 作为输入，在 runtime adapter 层派生每个 backend 的能力描述。AI capability registry 直接透传这份派生结果，避免在控制面重复硬编码 engineer/reviewer 与 runner/command 的映射关系。

**Tech Stack:** Next.js, TypeScript, Vitest, JSON contract registry, runtime adapter registry

---

### Task 1: Write failing tests for backend capability descriptors

**Files:**
- Modify: `tests/forge-runtime-adapters.test.ts`
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-api-routes.test.ts`

**Step 1: Write the failing test**

断言每条 `executionBackends` 记录会返回：

- `runnerProfile`
- `supportedCommandTypes`
- `expectedArtifacts`

并且 runtime adapter helper 也能派生同样结果。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-runtime-adapters.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: FAIL because the backend registry only exposes env metadata today.

### Task 2: Implement derived backend descriptors

**Files:**
- Modify: `config/forge-execution-backend-contracts.json`
- Modify: `packages/ai/src/runtime-adapters.ts`
- Modify: `packages/ai/src/forge-ai.ts`

**Step 1: Extend contract metadata**

给共享 registry 增加 `runnerProfile`，避免再次在 AI 层手写 engineer/reviewer 映射。

**Step 2: Derive backend capability descriptors**

在 runtime adapter 层新增 helper，根据 `runnerProfile` 派生：

- `supportedCommandTypes`
- `expectedArtifacts`
- `adapterIds`

**Step 3: Expose descriptors through capability registry**

`getCapabilityRegistryForAI()` 的 `executionBackends` 直接透传这些字段。

**Step 4: Run targeted tests**

Run: `npm test -- tests/forge-runtime-adapters.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: PASS

### Task 3: Docs and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-10-forge-execution-backend-contracts.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`

**Step 1: Document backend capability descriptors**

说明 execution backend registry 现在能告诉控制面“这个后端承载哪条 runner、支持哪些标准命令、预期产出什么工件”。

**Step 2: Run full verification**

Run:

- `npm test`
- `npm run build`
- `npm run build:electron`

Expected: all pass.
