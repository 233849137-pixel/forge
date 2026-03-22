# Forge Backend Evolution Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve the existing Forge control-plane backend, but strip out demo-era coupling so the rebuilt frontend can continue on top of a stable, production-oriented backend surface.

**Architecture:** Keep `packages/db`, `packages/ai`, and `packages/core` as the domain backbone. Refactor by separating seed/demo bootstrapping from runtime persistence, splitting monolithic command orchestration into dedicated handlers, and introducing a cleaner page-data boundary between server-rendered UI and control-plane facts.

**Tech Stack:** Next.js App Router, React 19, TypeScript, better-sqlite3, Vitest, Electron

---

## Decision Summary

Recommended approach: evolve the backend in place.

Why:
- The new frontend still depends directly on the current backend read models and control-plane summaries.
- The backend already contains real persistence, orchestration, and API routes, not just throwaway mocks.
- The highest-risk problem is not missing backend capability; it is seed/demo data and orchestration logic being mixed into the same runtime path.

Do not do:
- A full backend rewrite before the new frontend stabilizes.
- Continued feature work on top of `syncSeedData()`-driven runtime behavior.

## Keep / Split / Remove

Keep:
- `packages/core/src/selectors.ts`
- `packages/ai/src/forge-ai.ts` read-model builders such as control-plane and readiness summaries
- `packages/db/src/forge-db.ts` schema, persistence helpers, workspace scaffolding
- `app/api/forge/*` route surface

Split:
- Seed/demo bootstrap from normal database initialization
- `executeCommandForAI()` command branches into per-command handlers
- Page-facing data assembly from raw snapshot loading

Remove or retire:
- Automatic seed sync on every `ensureForgeDatabase()` call
- UI assumptions that server components must read DB and control-plane state inline
- Stale tests that still assert pre-redesign asset page headings

### Task 1: Stop runtime seed resync from mutating normal app state

**Files:**
- Modify: `packages/db/src/forge-db.ts`
- Test: `tests/forge-db.test.ts`
- Test: `tests/forge-api-routes.test.ts`

**Step 1: Write the failing test**

Add a database test proving that user-modified project/task/artifact state is preserved after a second `ensureForgeDatabase()` call when seed sync is disabled for normal runtime paths.

```ts
it("does not overwrite runtime state after initialization", () => {
  const dbPath = createTempDbPath();
  ensureForgeDatabase(dbPath);
  updateProjectTasks(
    {
      projectId: "retail-support",
      taskId: "task-retail-playwright",
      status: "done",
      summary: "manually completed"
    },
    dbPath
  );

  ensureForgeDatabase(dbPath);
  const snapshot = loadDashboardSnapshot(dbPath);

  expect(snapshot.tasks.find((task) => task.id === "task-retail-playwright")?.status).toBe("done");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-db.test.ts`
Expected: FAIL because `ensureForgeDatabase()` currently re-applies seed data and can restore seeded state.

**Step 3: Write minimal implementation**

Add an explicit seed mode to `ensureForgeDatabase()`:
- Initialize schema every time
- Run `seedIfEmpty()` only when the DB is empty
- Run `syncSeedData()` only in explicit dev/demo mode, not on every runtime call

Suggested shape:

```ts
type ForgeSeedMode = "if-empty" | "sync-demo";

export function ensureForgeDatabase(dbPath?: string, seedMode: ForgeSeedMode = "if-empty") {
  const db = openDatabase(dbPath);
  db.exec(schema);
  ensureOptionalColumns(db);
  seedIfEmpty(db, dbPath);

  if (seedMode === "sync-demo") {
    syncSeedData(db, dbPath);
  }

  db.close();
}
```

Update normal runtime call sites to use the default mode only.

**Step 4: Run tests to verify it passes**

Run: `npm test -- tests/forge-db.test.ts tests/forge-api-routes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/db/src/forge-db.ts tests/forge-db.test.ts tests/forge-api-routes.test.ts
git commit -m "refactor: isolate demo seed sync from runtime db init"
```

### Task 2: Extract command execution branches into dedicated handlers

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`
- Create: `packages/ai/src/command-handlers/prd-generate.ts`
- Create: `packages/ai/src/command-handlers/review-run.ts`
- Create: `packages/ai/src/command-handlers/gate-run.ts`
- Create: `packages/ai/src/command-handlers/shared.ts`
- Test: `tests/forge-ai.test.ts`

**Step 1: Write the failing test**

Add focused tests around a handler boundary rather than only the monolithic dispatcher:

```ts
it("routes review.run through the dedicated review handler", () => {
  const result = executeCommandForAI({
    commandId: "command-review-run",
    projectId: "retail-support",
    triggeredBy: "test"
  }, dbPath);

  expect(result.execution.commandId).toBe("command-review-run");
  expect(result.artifact?.type).toBe("review-report");
});
```

Add a spyable seam if needed in `forge-ai.ts` so the test proves dispatch delegation instead of only final output.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-ai.test.ts`
Expected: FAIL because no dedicated handler boundary exists yet.

**Step 3: Write minimal implementation**

Move command-specific logic out of `executeCommandForAI()`:
- Keep routing in `forge-ai.ts`
- Move each command branch into a dedicated handler function
- Share repeated helper code through `shared.ts`

Target pattern:

```ts
const handlers = {
  "prd.generate": handlePrdGenerate,
  "review.run": handleReviewRun,
  "gate.run": handleGateRun
};

return handlers[command.type](context);
```

Do not rewrite all commands in one pass. Start with the highest-churn commands used by the rebuilt frontend and tests.

**Step 4: Run tests to verify it passes**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/ai/src/forge-ai.ts packages/ai/src/command-handlers tests/forge-ai.test.ts
git commit -m "refactor: split forge command execution into dedicated handlers"
```

### Task 3: Introduce a page-data boundary for server-rendered views

**Files:**
- Create: `src/server/forge-page-data.ts`
- Modify: `app/page.tsx`
- Modify: `app/[view]/page.tsx`
- Test: `tests/forge-home-page.test.tsx`
- Test: `tests/forge-os-pages.test.tsx`

**Step 1: Write the failing test**

Add a test around page-data assembly so UI pages no longer need to know how to combine `loadDashboardSnapshot()` with `getControlPlaneSnapshotForAI()`.

```ts
it("builds home page data from a single server-side page-data helper", () => {
  const data = getForgeHomePageData(dbPath);

  expect(data.snapshot.activeProjectId).toBeTruthy();
  expect(data.controlPlane.runtimeSummary).toBeDefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-home-page.test.tsx tests/forge-os-pages.test.tsx`
Expected: FAIL because `src/server/forge-page-data.ts` does not exist.

**Step 3: Write minimal implementation**

Create a small server-only boundary:

```ts
export function getForgePageContext(dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const projectId = snapshot.activeProjectId ?? snapshot.projects[0]?.id;
  const controlPlane = getControlPlaneSnapshotForAI({ projectId }, dbPath);
  return { snapshot, controlPlane };
}
```

Then update:
- `app/page.tsx`
- `app/[view]/page.tsx`

to read from this helper instead of duplicating assembly inline.

This is not about forcing HTTP. It is about giving the frontend one stable server-side data contract.

**Step 4: Run tests to verify it passes**

Run: `npm test -- tests/forge-home-page.test.tsx tests/forge-os-pages.test.tsx`
Expected: PASS except for any intentional redesign assertion drift

**Step 5: Commit**

```bash
git add src/server/forge-page-data.ts app/page.tsx app/[view]/page.tsx tests/forge-home-page.test.tsx tests/forge-os-pages.test.tsx
git commit -m "refactor: centralize server page data assembly"
```

### Task 4: Align asset-page tests with the redesigned frontend contract

**Files:**
- Modify: `src/components/forge-assets-page.tsx`
- Modify: `tests/forge-os-pages.test.tsx`

**Step 1: Write the failing test**

The test already fails today:

```ts
expect(screen.getByRole("heading", { name: /资产总览/i })).toBeInTheDocument();
```

This currently fails because the redesigned asset page now shows template-layer headings like `项目模板`, `Prompt 与计划基线`, and `门禁与交付模板`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-os-pages.test.tsx`
Expected: FAIL on the missing `资产总览` heading

**Step 3: Write minimal implementation**

Choose one of these and stick to it:
- If the redesign is correct, update the test to assert the new information architecture.
- If the redesign accidentally dropped a top-level heading required by product intent, restore it in `ForgeAssetsPage`.

Recommended option: update the test, because the current page structure already reflects the new IA.

**Step 4: Run tests to verify it passes**

Run: `npm test -- tests/forge-os-pages.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/forge-assets-page.tsx tests/forge-os-pages.test.tsx
git commit -m "test: align asset page expectations with redesigned information architecture"
```

### Task 5: Add an explicit demo/bootstrap entry instead of hidden seed behavior

**Files:**
- Modify: `packages/db/src/forge-db.ts`
- Create: `scripts/forge-bootstrap-demo.mjs`
- Modify: `package.json`
- Test: `tests/forge-db.test.ts`

**Step 1: Write the failing test**

Add a test proving demo sync can still be invoked explicitly after runtime seed isolation.

```ts
it("can explicitly sync demo data when requested", () => {
  const dbPath = createTempDbPath();
  ensureForgeDatabase(dbPath, "if-empty");
  syncForgeDemoData(dbPath);
  const snapshot = loadDashboardSnapshot(dbPath);
  expect(snapshot.projects.length).toBeGreaterThan(0);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-db.test.ts`
Expected: FAIL because no explicit demo bootstrap API exists yet.

**Step 3: Write minimal implementation**

Expose an explicit entry point:

```ts
export function syncForgeDemoData(dbPath?: string) {
  const db = openDatabase(dbPath);
  syncSeedData(db, dbPath);
  db.close();
}
```

Add a script:

```json
{
  "scripts": {
    "bootstrap:demo": "node scripts/forge-bootstrap-demo.mjs"
  }
}
```

**Step 4: Run tests to verify it passes**

Run: `npm test -- tests/forge-db.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/db/src/forge-db.ts scripts/forge-bootstrap-demo.mjs package.json tests/forge-db.test.ts
git commit -m "feat: add explicit forge demo bootstrap flow"
```

## Verification Checklist

Run after all tasks:

```bash
npm test
```

Expected:
- All Vitest suites pass
- No page relies on implicit seed mutation during request handling
- No command route regresses for `review.run`, `gate.run`, or bridge writeback flows

Manual verification:
- Open `http://127.0.0.1:3322/`
- Confirm home/projects/execution/governance still load
- Confirm creating or editing project state survives app restart without being reset by demo sync

## Outcome

If this plan succeeds:
- The backend remains reusable and cheaper than a rewrite
- The frontend gets a stable contract instead of a shifting demo substrate
- Future backend replacement, if ever needed, becomes incremental because the runtime boundary is cleaner
