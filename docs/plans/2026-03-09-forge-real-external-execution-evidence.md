# Forge Real External Execution Evidence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 Engineer / Reviewer / QA 的运行结果从“只有 mode 字符串”推进到“有统一证据状态、可被控制面稳定解释”的结构化证据。

**Architecture:** 第一版不新增数据库表，继续复用 `runs.outputMode + outputChecks` 作为事实源，但补一层统一证据状态模型，把现有 runner 返回的 `contract-* / *-ready / *-executed` 归一成 `contract / tool-ready / executed`。证据状态先贯通 `runner scripts -> runner shell bridge -> ai/control-plane -> tests`，不改动命令中心信息架构。

**Tech Stack:** TypeScript、Node runner scripts、Vitest、Forge AI core、Runtime Adapter、Next.js control plane

---

### Task 1: Standardize Evidence States In Runner Outputs

**Files:**
- Modify: `../../scripts/lib/forge-engineer-runner.mjs`
- Modify: `../../scripts/lib/forge-review-runner.mjs`
- Test: `../../tests/forge-engineer-runner.test.ts`
- Test: `../../tests/forge-review-runner.test.ts`

**Step 1: Write failing runner tests**

- Assert contract mode returns explicit evidence state `contract`
- Assert ready mode returns explicit evidence state `tool-ready`
- Assert executed mode returns explicit evidence state `executed`
- Assert checks include a normalized evidence check entry

**Step 2: Run runner tests to verify RED**

Run:
- `npm test -- --run tests/forge-engineer-runner.test.ts`
- `npm test -- --run tests/forge-review-runner.test.ts`

Expected: FAIL because runner JSON currently lacks normalized evidence state.

**Step 3: Write minimal runner implementation**

- Add normalized fields such as:
  - `evidenceStatus`
  - `evidenceLabel`
  - `executedCommand` when real execution happened
- Add one stable `checks` entry for evidence status

**Step 4: Run runner tests to verify GREEN**

Run:
- `npm test -- --run tests/forge-engineer-runner.test.ts`
- `npm test -- --run tests/forge-review-runner.test.ts`

Expected: PASS

**Status**
- 已完成：Engineer / Reviewer Runner 已统一输出 `evidenceStatus / evidenceLabel / executedCommand`
- 已完成：runner tests 已覆盖 `contract / tool-ready / executed`

### Task 2: Preserve Evidence Status Through Runner Shell Bridge

**Files:**
- Modify: `../../scripts/lib/forge-runner.mjs`
- Test: `../../tests/forge-runner.test.ts`

**Step 1: Write failing runner bridge tests**

- Assert parsed external runner result carries the normalized evidence status into run output
- Assert blocked external execution still preserves the last known evidence mode

**Step 2: Run the bridge test to verify RED**

Run: `npm test -- --run tests/forge-runner.test.ts`
Expected: FAIL because normalized evidence data is not preserved end-to-end yet.

**Step 3: Write minimal bridge implementation**

- Read normalized evidence state from runner JSON
- Ensure it is preserved inside `outputChecks`
- Keep `outputMode` backward compatible

**Step 4: Run the bridge test to verify GREEN**

Run: `npm test -- --run tests/forge-runner.test.ts`
Expected: PASS

**Status**
- 已完成：Runner bridge 会把统一证据状态保留到 `planExecution`
- 已完成：外部执行失败时，blocked run 也会保留 `outputMode / outputChecks`

### Task 3: Expose Unified Evidence In AI And Control Plane

**Files:**
- Modify: `../../packages/ai/src/forge-ai.ts`
- Test: `../../tests/forge-ai.test.ts`

**Step 1: Write failing AI tests**

- Assert control-plane runtime summary can expose normalized evidence labels
- Assert run timeline items include normalized evidence status where available

**Step 2: Run AI tests to verify RED**

Run: `npm test -- --run tests/forge-ai.test.ts`
Expected: FAIL because AI only echoes raw mode strings today.

**Step 3: Write minimal AI implementation**

- Add a helper that maps raw runner output to:
  - `contract`
  - `tool-ready`
  - `executed`
- Surface it in runtime summary and run timeline without changing existing fields

**Step 4: Run AI tests to verify GREEN**

Run: `npm test -- --run tests/forge-ai.test.ts`
Expected: PASS

**Status**
- 已完成：`runtimeSummary` 已返回 `evidenceStates / evidenceLabels`
- 已完成：`getRunTimelineForAI(...)` 已返回 `evidenceStatus / evidenceLabel`
- 已完成：执行页运行卡片已显式展示 `Evidence`

### Task 4: Sync Docs And Revalidate

**Files:**
- Modify: `../../README.md`
- Modify: `../../docs/plans/2026-03-09-forge-global-program-plan.md`
- Modify: `../../docs/plans/2026-03-09-forge-takeover-next-phase.md`

**Step 1: Update docs**

- Document normalized evidence states
- Clarify that `outputMode` remains backward compatible while control plane now reads a unified status

**Step 2: Run full verification**

Run:
- `npm test`
- `npm run build`
- `npm run build:electron`

Expected: all green

**Status**
- 已完成：`npm test` 22 个测试文件、182 个测试全部通过
- 已完成：`npm run build`、`npm run build:electron` 全绿
- 已完成：`node --check scripts/lib/forge-qa-runner.mjs` 通过

## Exit Criteria

- Engineer / Reviewer / QA runner outputs include normalized evidence state
- Runner shell bridge preserves the normalized state into run evidence
- AI / control-plane can distinguish `contract / tool-ready / executed`
- Existing `outputMode` consumers remain compatible
- Full verification stays green
