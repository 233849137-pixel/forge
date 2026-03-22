# Demo-Safe Delivery Chain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Forge demo-safe for Saturday so one customer requirement can be turned into a real project, shown as a multi-stage AI delivery chain, and ended with a stable delivery/deploy result.

**Architecture:** Reuse the existing home, projects, team, and assets surfaces, but add a deterministic intake-and-delivery lane. Real project creation and API persistence should stay true; stage outputs, handoff copy, and deploy success should be seeded and replayable from local data so the demo never depends on a long live chain.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, local SQLite-backed Forge snapshot

---

### Task 1: Add failing tests for one-sentence intake and project jump

**Files:**
- Modify: `../../tests/forge-home-page.test.tsx`
- Modify: `../../tests/forge-api-routes.test.ts`
- Modify: `../../tests/forge-project-api.test.ts`

**Step 1: Write the failing UI test**

Cover a home-page intake entry that:
- accepts one natural-language requirement
- triggers a real intake callback
- routes into `/projects?projectId=...&node=需求确认`

**Step 2: Write the failing API test**

Cover a new intake route that:
- accepts a requirement sentence
- creates and activates a project
- seeds demo-safe workbench artifacts and workflow state

**Step 3: Run focused tests to verify they fail**

Run: `npm test -- tests/forge-home-page.test.tsx tests/forge-api-routes.test.ts tests/forge-project-api.test.ts`

Expected: FAIL because there is no one-sentence intake flow yet.

### Task 2: Implement requirement intake and demo seeding

**Files:**
- Create: `../../app/api/forge/projects/intake/route.ts`
- Modify: `../../src/lib/forge-project-api.ts`
- Modify: `../../packages/ai/src/forge-ai.ts`
- Modify: `../../packages/db/src/forge-db.ts`

**Step 1: Add a requirement parser**

Implement a deterministic parser that maps one sentence into:
- project name
- sector
- template id
- default owner
- recommended components and demo copy

Bias the supplied example toward the smart-service template.

**Step 2: Add a seeded intake path**

Create a single entry point that:
- creates the project
- generates a PRD
- seeds architecture, UI, task-pack, patch, demo-build, test, and release artifacts
- marks the workflow at a believable late-demo stage
- keeps the project editable after creation

**Step 3: Add a thin client API helper**

Expose a frontend helper that calls the intake route and returns the activated project id.

**Step 4: Run focused tests**

Run: `npm test -- tests/forge-api-routes.test.ts tests/forge-project-api.test.ts`

Expected: PASS

### Task 3: Surface the intake entry on the home page

**Files:**
- Modify: `../../src/components/forge-home-page.tsx`
- Modify: `../../src/components/forge-home-page-bridge.tsx`

**Step 1: Add a compact intake panel**

Add a stage-friendly input that says, in effect, “客户只给一句需求”.

The panel should:
- accept a single requirement sentence
- show a primary CTA
- keep the existing project desk intact

**Step 2: Wire navigation**

On success:
- dispatch Forge page refresh events
- navigate into the new project at `需求确认`
- show a short success status

**Step 3: Run focused tests**

Run: `npm test -- tests/forge-home-page.test.tsx`

Expected: PASS

### Task 4: Make the project workbench tell a full stage story

**Files:**
- Create: `../../src/lib/forge-project-workbench.ts`
- Modify: `../../src/components/forge-projects-page.tsx`
- Modify: `../../tests/forge-projects-page.test.tsx`

**Step 1: Write the failing workbench tests**

Cover a selected project showing prepared content for:
- `需求确认`
- `项目原型`
- `UI设计`
- `后端研发`
- `DEMO测试`
- `交付发布`

Also cover a compact handoff block with:
- 当前负责人
- 接棒说明
- 下一步动作
- 关键产物 / 阻塞

**Step 2: Build deterministic node seeds**

Create a pure helper that reads snapshot data and returns stage-ready conversation/document content per node.

Use real persisted artifacts, tasks, reviews, gates, and PRD documents as input.

**Step 3: Render the handoff summary and seeded tabs**

Initialize the workbench from the helper instead of empty per-node defaults, while preserving the existing local editing behavior.

**Step 4: Run focused tests**

Run: `npm test -- tests/forge-projects-page.test.tsx tests/forge-page-data.test.ts`

Expected: PASS

### Task 5: Add a demo-safe delivery action and success surface

**Files:**
- Create: `../../app/api/forge/projects/deploy-demo/route.ts`
- Modify: `../../src/lib/forge-project-api.ts`
- Modify: `../../packages/ai/src/forge-ai.ts`
- Modify: `../../packages/db/src/forge-db.ts`
- Modify: `../../src/components/forge-projects-page.tsx`
- Modify: `../../tests/forge-api-routes.test.ts`
- Modify: `../../tests/forge-projects-page.test.tsx`

**Step 1: Write the failing deploy tests**

Cover:
- a real CTA in `交付发布`
- a demo deploy API call
- a persisted delivery-ready result
- a stable preview/result address shown in the workbench

**Step 2: Implement deploy persistence**

Record a local deploy-complete state by updating the project summary and writing a delivery artifact that the workbench can read back.

**Step 3: Render the final success surface**

Show:
- deployment complete state
- preview/result address
- timestamp
- final delivery summary

**Step 4: Run focused tests**

Run: `npm test -- tests/forge-api-routes.test.ts tests/forge-projects-page.test.tsx`

Expected: PASS

### Task 6: Add reset and rehearsal support

**Files:**
- Create: `../../scripts/forge-demo-reset.mjs`
- Create: `../../docs/plans/2026-03-15-forge-demo-runbook.md`

**Step 1: Add a reset script**

Provide one command that restores the local DB to the seeded demo state.

**Step 2: Write the runbook**

Document:
- where to start
- exact click order
- the customer requirement sentence to paste
- the stage sequence to narrate
- the fallback path if a live model is slow

**Step 3: Run final verification**

Run: `npm test -- tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/forge-project-api.test.ts tests/forge-api-routes.test.ts tests/agent-team-page.test.tsx tests/forge-assets-page.test.tsx`

Expected: PASS for the touched demo path tests.
