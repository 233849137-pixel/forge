# Forge Backend Foundation Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the Forge backend core and write-path contracts so frontend exploration can continue without forcing early page-level DTO decisions.

**Architecture:** Keep the existing `packages/db` and `packages/ai` domain backbone intact, and focus this phase on backend-only seams that remain valid even while the frontend keeps changing. Prioritize input validation, write-path consistency, command-handler extraction, and reusable read-model blocks over page-specific response shaping.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, better-sqlite3, Electron

---

## Decision Summary

Recommended approach: backend-first hardening, DTOs later.

Why:
- The frontend is still changing what each page shows, so page DTOs would churn.
- The backend already owns stable business facts and write flows.
- Tightening validation and orchestration now will reduce later frontend-backend integration risk instead of adding rework.

Do not do:
- Define final page DTOs before the frontend information architecture settles.
- Bind new backend APIs to temporary screen layouts.
- Let write routes keep silently accepting malformed payloads and surfacing 500s.

### Task 1: Harden write-input validation for list-shaped payloads

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`
- Test: `tests/forge-ai.test.ts`
- Test: `tests/forge-api-routes.test.ts`

**Step 1: Write the failing tests**

Add focused tests proving malformed list inputs return validation errors instead of internal errors:

- `updateAgentProfileForAI()` rejects non-array `knowledgeSources`
- `updateProjectWorkflowStateForAI()` rejects non-array `blockers`
- `POST /api/forge/team-registry` returns `400` with `FORGE_VALIDATION_ERROR` for malformed `knowledgeSources`
- `POST /api/forge/workflow` returns `400` with `FORGE_VALIDATION_ERROR` for malformed `blockers`

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: FAIL because the current implementation calls `.map()` on unchecked values and can surface runtime errors.

**Step 3: Write minimal implementation**

Add a shared list validator in `packages/ai/src/forge-ai.ts` that:
- accepts `unknown`
- requires an array
- requires every item to be a string
- trims and filters blank entries

Use it in:
- `updateAgentProfileForAI()`
- `updateProjectWorkflowStateForAI()`

The route layer can stay thin because these functions are also called directly by tests and internal callers.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/ai/src/forge-ai.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts
git commit -m "fix: validate forge write payload string lists"
```

### Task 2: Normalize write-route request parsing helpers

**Files:**
- Modify: `src/lib/forge-api-response.ts`
- Modify: `app/api/forge/projects/active/route.ts`
- Modify: `app/api/forge/runners/route.ts`
- Modify: `app/api/forge/runners/probe/route.ts`
- Modify: `app/api/forge/execution-backends/dispatch/route.ts`
- Modify: `app/api/forge/execution-backends/prepare/route.ts`
- Modify: `app/api/forge/execution-backends/execute/route.ts`
- Modify: `app/api/forge/execution-backends/bridge/route.ts`
- Modify: `app/api/forge/execution-backends/bridge/writeback/route.ts`
- Test: `tests/forge-api-routes.test.ts`

**Step 1: Write the failing tests**

Add route tests proving malformed bodies fail with explicit 400 errors instead of relying on implicit coercion:
- `projects/active` rejects missing `projectId`
- runner/execution-backend routes reject non-object JSON bodies
- routes that accept optional IDs still reject bodies that are not JSON objects

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-api-routes.test.ts`

Expected: FAIL because several routes currently cast or coerce body values without shape validation.

**Step 3: Write minimal implementation**

Add parsing helpers such as:
- `readJsonObjectBody()`
- `readOptionalString()`
- `readRequiredString()`

Use them only where needed. Do not over-generalize.

**Step 4: Run tests to verify it passes**

Run: `npm test -- tests/forge-api-routes.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/forge-api-response.ts app/api/forge tests/forge-api-routes.test.ts
git commit -m "refactor: normalize forge write route parsing"
```

### Task 3: Continue command-handler extraction for release/archive flows

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`
- Create: `packages/ai/src/command-handlers/release-prepare.ts`
- Create: `packages/ai/src/command-handlers/archive-capture.ts`
- Create: `packages/ai/src/command-handlers/execution-start.ts`
- Test: `tests/forge-ai.test.ts`
- Test: `tests/forge-api-routes.test.ts`

**Step 1: Write the failing test**

Add routing tests proving `executeCommandForAI()` delegates these high-churn command types through dedicated handlers via `getCommandHandler()`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-ai.test.ts`

Expected: FAIL because these handlers are not yet extracted.

**Step 3: Write minimal implementation**

Extract only:
- `release.prepare`
- `archive.capture`
- `execution.start`

Keep shared orchestration helpers in `forge-ai.ts` or `shared.ts` as needed.

**Step 4: Run tests to verify it passes**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/ai/src/forge-ai.ts packages/ai/src/command-handlers tests/forge-ai.test.ts tests/forge-api-routes.test.ts
git commit -m "refactor: extract forge release and execution handlers"
```

### Task 4: Introduce reusable backend information blocks for future DTO assembly

**Files:**
- Create: `src/server/forge-block-data.ts`
- Modify: `src/server/forge-page-data.ts`
- Test: `tests/forge-page-data.test.ts`

**Step 1: Write the failing test**

Add tests for block-level selectors rather than page DTOs:
- `getProjectOverviewBlock()`
- `getExecutionStatusBlock()`
- `getReadinessBlock()`
- `getArtifactsSummaryBlock()`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-page-data.test.ts`

Expected: FAIL because block selectors do not exist yet.

**Step 3: Write minimal implementation**

Create block-level helpers that adapt `snapshot` and `controlPlane` into reusable fragments. Do not define final page DTOs yet.

**Step 4: Run tests to verify it passes**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-home-page.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/forge-block-data.ts src/server/forge-page-data.ts tests/forge-page-data.test.ts
git commit -m "refactor: add forge backend information blocks"
```
