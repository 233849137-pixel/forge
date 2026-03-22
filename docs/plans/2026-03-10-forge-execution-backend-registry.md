# Forge Execution Backend Registry Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 execution backend 从分散的 env 分支收成共享注册表，让 runner 与 capabilities 读取同一套后端契约。

**Architecture:** 新增一份共享的 execution backend contract registry，统一描述 engineer/reviewer 的 provider command、backend label、backend command 键位。脚本层通过 registry 解析单个后端契约，AI 层通过同一 registry 生成 capability/cross-run 摘要，避免三处硬编码继续漂移。

**Tech Stack:** Next.js, TypeScript, Vitest, Node.js ESM scripts, JSON contract registry

---

### Task 1: Red tests for registry-backed contracts

**Files:**
- Modify: `tests/runtime-capability-detect.test.ts`
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-api-routes.test.ts`

**Step 1: Write the failing test**

断言新的 execution backend contract 会暴露：

- `id`
- `kind`
- `commandKey`

并且 capability registry / API route 透传这些字段。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-capability-detect.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: FAIL because registry fields are not returned yet.

### Task 2: Implement shared registry

**Files:**
- Create: `config/forge-execution-backend-contracts.json`
- Modify: `scripts/lib/runtime-capability-detect.mjs`
- Modify: `packages/ai/src/forge-ai.ts`

**Step 1: Add a shared registry source**

新增 JSON registry，描述 engineer/reviewer 的：

- `id`
- `kind`
- `label`
- `source`
- `providerKey`
- `backendKey`
- `commandKey`

**Step 2: Update script-side contract resolution**

让 `detectExternalExecutionCapability()` 通过 registry 查找单个 contract，并返回 registry 字段。

**Step 3: Update AI capability registry**

让 `getExternalExecutionContracts()` 和 `getCapabilityRegistryForAI()` 使用相同 registry source，并把 `id / kind / commandKey` 透传出来。

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/runtime-capability-detect.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: PASS

### Task 3: Docs and full verification

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/2026-03-10-forge-execution-backend-contracts.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`
- Modify: `docs/plans/2026-03-09-forge-global-program-plan.md`

**Step 1: Document the registry**

补充 execution backend registry 的单一来源、返回字段和用途。

**Step 2: Run full verification**

Run:

- `npm test`
- `npm run build`
- `npm run build:electron`

Expected: all pass.
