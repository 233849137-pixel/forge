# Forge macOS MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a runnable macOS-first desktop MVP for Forge that proves the product shape: project-first navigation, local workspace model, asset center, and delivery gate placeholders inside a single desktop app shell.

**Architecture:** Use Electron as the desktop shell and Next.js as the UI/runtime layer. Keep the first milestone local-first and mock-backed: a typed local data module provides project, asset, run, and gate data so the app can render the intended workflow before introducing SQLite and cloud sync.

**Tech Stack:** Electron, Next.js App Router, React, TypeScript, Vitest, Testing Library

---

### Task 1: Project Skeleton

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `next-env.d.ts`
- Create: `electron/main.ts`
- Create: `electron/preload.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `public/.gitkeep`

**Step 1: Write the failing test**

Create a smoke test that expects the project home shell to render a Forge heading and at least one project card.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because no app code or test setup exists yet

**Step 3: Write minimal implementation**

Create the Next.js + Electron skeleton and a minimal `app/page.tsx` rendering a project-first dashboard.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for the smoke test

### Task 2: Forge Information Architecture

**Files:**
- Create: `src/data/mock-data.ts`
- Create: `src/types/forge.ts`
- Create: `src/components/app-shell.tsx`
- Create: `src/components/projects-overview.tsx`
- Create: `src/components/workspace-panel.tsx`
- Create: `src/components/assets-panel.tsx`
- Create: `src/components/delivery-panel.tsx`
- Create: `src/components/settings-panel.tsx`
- Modify: `app/page.tsx`

**Step 1: Write the failing test**

Add tests asserting the home screen shows the core product areas: Projects, Workspace, Assets, Delivery, Settings.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the shell only renders a minimal page

**Step 3: Write minimal implementation**

Implement the typed mock data layer and the multi-panel product-first interface.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for the navigation and panel tests

### Task 3: Workspace + Delivery Gate Behaviors

**Files:**
- Create: `src/lib/forge-selectors.ts`
- Create: `tests/forge-selectors.test.ts`
- Create: `tests/home-page.test.tsx`
- Modify: `src/components/workspace-panel.tsx`
- Modify: `src/components/delivery-panel.tsx`
- Modify: `src/data/mock-data.ts`

**Step 1: Write the failing test**

Add tests for derived behaviors:
- selecting the active project returns the right workspace
- failed delivery gate blocks the “Ready to Deliver” state

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because derived selectors are not implemented

**Step 3: Write minimal implementation**

Implement typed selector helpers and delivery gate summary logic.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for selectors and UI behaviors

### Task 4: Desktop Development Workflow

**Files:**
- Create: `scripts/electron-dev.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Update: `package.json`
- Update: `README.md`

**Step 1: Write the failing test**

Add a lightweight config test or script validation step that confirms required scripts exist.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the dev workflow scripts are incomplete

**Step 3: Write minimal implementation**

Add scripts for Next dev, Electron dev, build, and test. Document how to run the desktop shell.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS and app scripts available

### Task 5: Verification

**Files:**
- Verify only

**Step 1: Run tests**

Run: `npm test -- --runInBand`
Expected: all tests passing

**Step 2: Run lint/build checks**

Run: `npm run build`
Expected: Next.js build completes successfully

**Step 3: Launch desktop shell**

Run: `npm run electron:dev`
Expected: Electron launches the Forge desktop shell

## Out of Scope

- SQLite persistence
- Cloud sync
- Real Codex/Claude execution
- Real Git integration
- Packaging/signing DMG
- Bridge adapters

## Open Questions

- Whether to keep Electron for V1 shipping or switch to Tauri later
- Whether project state should first persist to JSON or move directly to SQLite
