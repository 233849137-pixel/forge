# Forge Project Workbench Demo Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the `/projects` workbench demo-ready for next Saturday so one customer requirement can be shown flowing from project creation into staged AI delivery, key node results, and a believable final delivery handoff.

**Architecture:** Keep the existing workbench shell, page contract, and command APIs intact, but bias the experience toward deterministic demo reliability. The workbench should feel full-screen, node-driven, and fast; key node outputs should be pre-curated and immediately visible; risky live dependencies should be isolated behind short, stable interactions or pre-wired success states.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, local SQLite-backed Forge snapshot

---

## Demo Scope Freeze

This plan only covers the project workbench slice:

- Project entry into `/projects`
- Node switching and node-level result display
- AI conversation panel behavior
- Key handoff explanation inside the workbench
- Final `交付发布` action and demo-safe deploy result

Out of scope for this plan:

- Team page architecture changes
- Asset page IA changes
- Real external deployment pipelines
- Long-running live generation chains during the talk

Primary demo project for this plan:

- `零售客服副驾驶`

Primary demo nodes to make presentation-safe:

- `需求确认`
- `项目原型`
- `后端研发`
- `DEMO测试`
- `交付发布`

### Task 1: Lock the golden demo path with failing tests

**Files:**
- Modify: `../../tests/forge-projects-page.test.tsx`
- Modify: `../../tests/forge-projects-page-bridge.test.tsx`
- Modify: `../../tests/forge-page-data.test.ts`

**Step 1: Write the failing test for the demo-safe workbench shell**

Add assertions that the workbench:
- prefers the main demo project when no explicit project is selected
- keeps the main workbench visible in a full-screen shell
- exposes the key demo nodes and preloaded result tabs for `零售客服副驾驶`

**Step 2: Write the failing test for deterministic node storytelling**

Add assertions that:
- `需求确认` shows a PRD-style result
- `项目原型` shows prototype / task-pack style result
- `后端研发` shows patch / demo execution evidence
- `DEMO测试` shows test or gate evidence
- `交付发布` shows a final delivery action area

**Step 3: Run focused tests to verify they fail**

Run: `npm test -- tests/forge-projects-page.test.tsx tests/forge-projects-page-bridge.test.tsx tests/forge-page-data.test.ts`

Expected: FAIL because the current workbench is not yet explicitly curated around the demo path.

### Task 2: Make the workbench a true full-screen demo surface

**Files:**
- Modify: `../../src/components/forge-projects-page.tsx`
- Modify: `../../src/components/forge-projects-page.module.css`

**Step 1: Lock the page shell to viewport height**

Implement a workbench-only full-bleed layout so `/projects` occupies the screen and the browser page itself does not scroll during the demo.

**Step 2: Move scrolling into the inner panels**

Keep scrolling only inside:
- project selector / left navigation if needed
- AI conversation region
- result document region

This preserves the “operating console” feel on stage.

**Step 3: Keep the composer and result surface stable**

Ensure the input bar, send button, and current result tab stay visible without vertical page drift when switching nodes or receiving replies.

**Step 4: Run focused UI tests**

Run: `npm test -- tests/forge-projects-page.test.tsx tests/forge-projects-page-bridge.test.tsx`

Expected: PASS

### Task 3: Curate deterministic demo data for the key workbench chain

**Files:**
- Modify: `../../src/data/mock-data.ts`
- Modify: `../../src/server/forge-page-dtos.ts`
- Modify: `../../src/components/forge-projects-page.tsx`
- Create: `../../scripts/forge-demo-reset.mjs`

**Step 1: Expand the main demo project’s staged outputs**

Curate `零售客服副驾驶` so the snapshot has convincing staged evidence for:
- PRD
- TaskPack / 原型
- Patch / Demo build
- Test / Playwright result
- Delivery brief / deploy-ready state

**Step 2: Make the workbench prefer curated node tabs**

Ensure the workbench opens each key node with meaningful default tabs and not an empty or misleading blank state.

**Step 3: Add a deterministic demo reset script**

Create a local script that resets the demo project data to the known-good presentation state before rehearsal or the live talk.

**Step 4: Run snapshot-related tests**

Run: `npm test -- tests/forge-page-data.test.ts tests/forge-projects-page.test.tsx`

Expected: PASS

### Task 4: Surface AI handoff logic inside the workbench itself

**Files:**
- Modify: `../../src/components/forge-projects-page.tsx`
- Modify: `../../src/server/forge-page-dtos.ts`
- Modify: `../../packages/core/src/selectors.ts`
- Test: `../../tests/forge-projects-page.test.tsx`

**Step 1: Add a compact handoff summary block**

Show, per current node:
- 当前节点负责人
- 当前接棒来源
- 下一步动作
- 关键产物 / 阻塞

This should be stage-readable in 3 seconds during the demo.

**Step 2: Align node wording with the actual demo narrative**

Reduce the mismatch between UI node names and backend command semantics so the presenter can say:
- “这一站是谁在接”
- “接到什么工件”
- “下一站是谁”

without manually explaining implementation quirks.

**Step 3: Verify handoff text in tests**

Run: `npm test -- tests/forge-projects-page.test.tsx`

Expected: PASS with assertions for current owner, next action, and handoff copy.

### Task 5: Add a demo-safe delivery CTA and success surface

**Files:**
- Modify: `../../src/components/forge-projects-page.tsx`
- Modify: `../../src/lib/forge-project-api.ts`
- Create: `../../app/api/forge/projects/deploy-demo/route.ts`
- Modify: `../../packages/ai/src/forge-ai.ts`
- Test: `../../tests/forge-projects-page.test.tsx`
- Test: `../../tests/forge-api-routes.test.ts`

**Step 1: Add a lightweight deploy-demo API**

Implement a demo-safe endpoint that records a local “deployment complete” result for the active project without depending on a real external platform.

**Step 2: Wire the `交付发布` node button**

Expose a real `一键部署` CTA in the final node and route it through the API instead of a fake local-only button.

**Step 3: Show a pre-wired success result**

After success, update the workbench result panel with:
- deployment complete state
- pre-configured preview or result URL
- timestamp / operator / project summary

**Step 4: Run focused tests**

Run: `npm test -- tests/forge-projects-page.test.tsx tests/forge-api-routes.test.ts`

Expected: PASS

### Task 6: Build the rehearsal checklist and fallback path

**Files:**
- Create: `../../docs/plans/2026-03-15-forge-project-workbench-demo-runbook.md`
- Verify: `../../src/components/forge-projects-page.tsx`
- Verify: `../../scripts/forge-demo-reset.mjs`

**Step 1: Write the runbook**

Document:
- exact route to open
- exact project to select
- exact node order to click
- when to use preloaded content instead of live generation
- how to reset before the demo

**Step 2: Add a fallback presentation path**

Define a no-network / low-latency sequence:
- open `零售客服副驾驶`
- click key nodes in fixed order
- trigger final deploy-demo button
- show pre-wired final result

**Step 3: Run final verification set**

Run: `npm test -- tests/forge-projects-page.test.tsx tests/forge-projects-page-bridge.test.tsx tests/forge-page-data.test.ts tests/forge-api-routes.test.ts tests/forge-os-pages.test.tsx`

Expected: PASS

**Step 4: Rehearse locally**

Run:
- `node scripts/forge-demo-reset.mjs`
- `npm run dev`

Manual check:
- `http://127.0.0.1:3322/`
- `http://127.0.0.1:3322/projects`

Confirm:
- the demo project is easy to enter
- the workbench does not page-scroll
- the main nodes are presentation-ready
- the final delivery CTA succeeds in one click

## Recommended Execution Order This Week

1. Task 2
2. Task 3
3. Task 4
4. Task 5
5. Task 6
6. Task 1 can be written first in TDD order, but the actual demo value is delivered by 2-5

## Success Bar

The workbench is demo-ready when all of the following are true:

- The presenter can enter the main demo project in under 10 seconds
- The project workbench fits in one screen with no page scroll
- At least five nodes have believable prepared content
- Sending one short chat message gives immediate visible feedback
- The `交付发布` node has a real button and a stable final success surface
- There is a one-command reset path before rehearsal and before the live demo
