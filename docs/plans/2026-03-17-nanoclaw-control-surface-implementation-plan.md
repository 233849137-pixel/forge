# NanoClaw Control Surface Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make NanoClaw visible as the single CEO control runtime across Forge control-plane surfaces, not just inside backend payloads.

**Architecture:** Extend the current handoff summary with stable controller and routed-owner labels derived from the execution backend invocation payload. Thread those labels through page DTOs into governance and execution views so the UI can show who is orchestrating the platform and who currently owns the active handoff.

**Tech Stack:** TypeScript, React, Next.js page DTOs, Vitest, Testing Library

---

### Task 1: Lock the UI contract with failing tests

**Files:**
- Modify: `tests/forge-os-pages.test.tsx`
- Modify: `tests/forge-api-routes.test.ts`

**Step 1: Write the failing tests**

- Add a governance page assertion for `总控角色` and `当前接棒负责人`.
- Add an execution page assertion for the same pair.
- Add a pages route assertion proving governance/execution DTOs surface the controller and owner labels.

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/forge-os-pages.test.tsx tests/forge-api-routes.test.ts -t "NanoClaw|总控角色|当前接棒负责人"`

Expected: FAIL because the page data and rendered UI do not yet expose those fields.

### Task 2: Extend the current handoff summary

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/ai/src/forge-ai.ts`

**Step 1: Write the minimal implementation**

- Extend `ForgeCurrentHandoffSummary` with controller and routed-owner labels.
- Populate those labels from `runtimeExecutionBackendInvocation.payload.controllerAgent` and `payload.agent`.

**Step 2: Run the targeted tests**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts -t "controller|handoff"`

Expected: PASS for the new summary fields.

### Task 3: Thread the labels into governance and execution pages

**Files:**
- Modify: `src/server/forge-page-dtos.ts`
- Modify: `src/lib/forge-execution-page-data.ts`
- Modify: `src/components/forge-governance-page.tsx`
- Modify: `src/components/forge-execution-page.tsx`

**Step 1: Write the minimal implementation**

- Add DTO fields for controller and routed-owner labels.
- Show `总控角色` and `当前接棒负责人` in governance summary and execution local context/focus context.

**Step 2: Run the focused page tests**

Run: `npm test -- tests/forge-os-pages.test.tsx tests/forge-api-routes.test.ts -t "NanoClaw|总控角色|当前接棒负责人"`

Expected: PASS.

### Task 4: Run Nano regression coverage

**Files:**
- No new files

**Step 1: Run the broader regression set**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts tests/forge-os-pages.test.tsx tests/forge-page-dto-components.test.tsx`

Expected: PASS.
