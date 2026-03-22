# Forge Home Mobile Shell Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the broken mobile navigation path, combine home-page source and search filters correctly, and tighten the shared visual/typography system for Forge.

**Architecture:** Keep the current page structure and server data flow intact. Solve the interaction bugs in the shared shell and home page, then refresh the visual hierarchy through shared CSS tokens plus a few targeted home-page UI elements.

**Tech Stack:** Next.js App Router, React 19, CSS Modules, Vitest, Testing Library

---

### Task 1: Lock the behavior with tests

**Files:**
- Modify: `tests/forge-console-shell.test.tsx`
- Modify: `tests/forge-home-page.test.tsx`

**Step 1: Write the failing shell test**

- Assert that `ForgeHomePage` with `showNavigation` renders a dedicated mobile navigation landmark with the primary module links.

**Step 2: Run the targeted shell test**

Run: `npm test -- tests/forge-console-shell.test.tsx`

Expected: FAIL because the mobile navigation landmark does not exist yet.

**Step 3: Write the failing home filter test**

- Assert that source-stage filtering and text search compose together instead of falling back to the full project list.

**Step 4: Run the targeted home-page test**

Run: `npm test -- tests/forge-home-page.test.tsx`

Expected: FAIL because the search currently filters `allProjectRows` instead of the already filtered rows.

### Task 2: Implement shared shell fixes

**Files:**
- Modify: `src/components/forge-console-shell.tsx`
- Modify: `src/components/forge-console-shell.module.css`

**Step 1: Add a mobile primary navigation bar**

- Render a second nav landmark for mobile when `showNavigation` is enabled.
- Reuse the existing primary view model so desktop and mobile stay aligned.

**Step 2: Add mobile-safe shell spacing**

- Ensure the main content reserves space for the bottom bar on narrow viewports.
- Keep the desktop sidebar behavior unchanged.

**Step 3: Run shell tests**

Run: `npm test -- tests/forge-console-shell.test.tsx`

Expected: PASS

### Task 3: Implement home-page interaction and hierarchy refresh

**Files:**
- Modify: `src/components/forge-home-page.tsx`
- Modify: `src/components/forge-home-page.module.css`

**Step 1: Fix composed filtering**

- Filter from `sourceProjectRows` when search text is present.

**Step 2: Improve scannability**

- Add a lightweight summary strip for total projects, blocked items, and current action load.
- Promote project state with visible badges instead of burying status in muted metadata.

**Step 3: Strengthen panel contrast**

- Differentiate the project desk, action panel, active rows, and risk-heavy states with stronger surface contrast.

**Step 4: Run home-page tests**

Run: `npm test -- tests/forge-home-page.test.tsx`

Expected: PASS

### Task 4: Unify global typography and shared tokens

**Files:**
- Modify: `app/globals.css`
- Modify: `src/components/forge-console-shell.module.css`

**Step 1: Define shared font variables**

- Use the already imported families consistently for body, display, and mono text.

**Step 2: Replace shell-specific fallback stacks**

- Remove the current `IBM Plex Sans` and `Newsreader` fallbacks so the shell actually uses the shared type system.

**Step 3: Verify style build health**

Run: `npm test -- tests/forge-console-shell.test.tsx tests/forge-home-page.test.tsx`

Expected: PASS

### Task 5: Final verification

**Files:**
- No additional code changes expected

**Step 1: Run targeted UI tests**

Run: `npm test -- tests/forge-console-shell.test.tsx tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx`

Expected: PASS

**Step 2: Run a production build**

Run: `npm run build`

Expected: PASS
