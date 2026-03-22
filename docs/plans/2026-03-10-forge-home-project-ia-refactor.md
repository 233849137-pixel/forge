# Forge Home/Project IA Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the Home and Projects pages around a tighter operator-facing information architecture without changing backend facts or adding new workflow concepts.

**Architecture:** Keep the existing selector and AI aggregates frozen, then reshape the UI into three stable layers: current status, responsibility/handoff, and evidence/risks. Reuse shared helper functions so Home and Projects read from the same summary model instead of manually assembling overlapping field lists.

**Tech Stack:** Next.js, React, TypeScript, existing Forge shared UI helpers, Vitest, Testing Library.

---

### Task 1: Lock the new page contract in tests

**Files:**
- Modify: `../../tests/forge-home-page.test.tsx`
- Modify: `../../tests/forge-projects-page.test.tsx`

**Step 1: Write failing tests**

Add assertions that the Home page is organized around:
- `当前态势`
- `责任链`
- `证据与风险`

Add assertions that the Projects page is organized around:
- `项目总览`
- `推进与接棒`
- `放行与缺口`

Also assert that old headings such as `推进判断`, `当前上下文`, `阶段准入与缺口`, and `交付就绪度` no longer appear.

**Step 2: Run targeted tests to verify they fail**

Run:

```bash
npm test -- forge-home-page.test.tsx forge-projects-page.test.tsx
```

Expected: FAIL because the new headings and grouping are not implemented yet.

### Task 2: Add shared page summary helpers

**Files:**
- Modify: `../../src/components/forge-os-shared.tsx`

**Step 1: Write minimal shared summary helpers**

Add helper functions that normalize Home/Projects content into small grouped summaries, for example:
- status summary
- responsibility summary
- evidence/risk summary

Keep them read-only and derived from existing helpers such as:
- `getResolvedFormalArtifactResponsibilityView(...)`
- `getResolvedReleaseClosureView(...)`
- `getNextAction(...)`
- `getProjectStageAdmission(...)`

Do not add new snapshot fields.

**Step 2: Run targeted tests**

Run:

```bash
npm test -- forge-home-page.test.tsx forge-projects-page.test.tsx
```

Expected: still FAIL, but only because the page components have not been updated yet.

### Task 3: Rebuild Home page structure

**Files:**
- Modify: `../../src/components/forge-home-page.tsx`

**Step 1: Replace the current wide `推进判断` block**

Restructure the first-screen information into:
- `当前态势`
- `责任链`
- `证据与风险`

Keep:
- workflow rail
- action cards
- execution snapshot
- queue

Reduce repeated labels and move secondary details out of the first summary block.

**Step 2: Verify page tests**

Run:

```bash
npm test -- forge-home-page.test.tsx
```

Expected: PASS

### Task 4: Rebuild Projects page structure

**Files:**
- Modify: `../../src/components/forge-projects-page.tsx`

**Step 1: Replace fragmented status panels**

Restructure the page around:
- `项目总览`
- `推进与接棒`
- `放行与缺口`

Keep the project list, bootstrap form, and task list, but demote them below the main operator summaries.

**Step 2: Verify page tests**

Run:

```bash
npm test -- forge-projects-page.test.tsx
```

Expected: PASS

### Task 5: Add minimal style support if required

**Files:**
- Modify: `../../app/globals.css`

**Step 1: Add only the CSS needed by the new grouped layout**

Prefer reusing:
- existing panel styles
- summary list styles
- context strip / hero grid

Only add new classes for grouped summary layout if the current utility classes are insufficient.

**Step 2: Verify no visual-regression driven test breakage**

Run:

```bash
npm test -- forge-home-page.test.tsx forge-projects-page.test.tsx forge-os-pages.test.tsx
```

Expected: PASS

### Task 6: Full verification and docs

**Files:**
- Modify: `../../README.md`
- Modify: `../../docs/plans/2026-03-09-forge-takeover-next-phase.md`

**Step 1: Update docs**

Record that:
- backend facts remained frozen
- Home/Projects were restructured around operator-facing IA
- responsibility and release summaries now surface through shared helpers

**Step 2: Run full verification**

Run:

```bash
npm test
npm run build
npm run build:electron
```

Expected: all pass
