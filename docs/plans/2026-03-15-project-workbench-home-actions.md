# Project Workbench And Home Actions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the desktop MVP workbench feel actionable by preserving project workbench edits across project switches, enabling the composer send flow, and adding direct action entry points from the home dashboard.

**Architecture:** Keep the MVP local-first. Persist workbench state in the client by keying panel state and drafts by project id, generate a lightweight in-UI AI reply/document update on send, and pass project/node query params from the home dashboard into the projects page so users can jump directly into the right context without adding new APIs.

**Tech Stack:** Next.js App Router, React state/hooks, Vitest, Testing Library

---

### Task 1: Cover direct-action navigation from the home dashboard

**Files:**
- Modify: `tests/forge-home-page.test.tsx`
- Modify: `src/components/forge-home-page.tsx`

**Step 1: Write the failing test**

Add a test that renders the home page, finds one item in `待你处理`, and asserts there is a direct link into `/projects` that carries the target project and stage context.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-home-page.test.tsx`
Expected: FAIL because the action cards do not expose a direct CTA link yet.

**Step 3: Write minimal implementation**

Render a CTA per action card, map the item stage to a project node, and link into `/projects?projectId=...&node=...`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-home-page.test.tsx`
Expected: PASS

### Task 2: Cover project workbench send behavior

**Files:**
- Modify: `tests/forge-projects-page.test.tsx`
- Modify: `src/components/forge-projects-page.tsx`

**Step 1: Write the failing test**

Add a test that types into the composer, clicks `发送`, and asserts:
- the human message appears in the active conversation
- a lightweight AI follow-up appears
- the result panel shows generated content for the active tab
- a status toast confirms the send action

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-projects-page.test.tsx`
Expected: FAIL because the composer has no controlled draft state or send handler.

**Step 3: Write minimal implementation**

Add controlled composer state, a `handleSendMessage` function, and local workbench updates that append conversation items and create/update the active document tab.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-projects-page.test.tsx`
Expected: PASS

### Task 3: Preserve workbench state across project switching

**Files:**
- Modify: `tests/forge-projects-page.test.tsx`
- Modify: `src/components/forge-projects-page.tsx`

**Step 1: Write the failing test**

Add a test that:
- sends a message for project A
- switches to project B
- switches back to project A
- verifies the previously added conversation/document content is still present

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-projects-page.test.tsx`
Expected: FAIL because the page currently recreates node panel state whenever the selected project changes.

**Step 3: Write minimal implementation**

Store per-project workspace state in a map keyed by project id, hydrate defaults lazily, and stop wiping a project's panel state when switching away and back.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-projects-page.test.tsx`
Expected: PASS

### Task 4: Verify the touched surfaces together

**Files:**
- Verify only

**Step 1: Run focused regression tests**

Run: `npm test -- tests/forge-projects-page.test.tsx tests/forge-home-page.test.tsx`

**Step 2: Manually sanity-check the UI**

Open:
- `http://127.0.0.1:3322/`
- `http://127.0.0.1:3322/projects`

Confirm:
- `待你处理` cards have direct CTA links
- sending a message updates chat and result panel
- switching projects no longer drops local edits

