# Forge SQLite Local Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace mock-backed dashboard data with a local SQLite-backed data layer so Forge loads projects, assets, runs, and delivery gates from a real on-disk database.

**Architecture:** Use `better-sqlite3` on the server side only. Create a tiny repository layer that initializes schema, seeds first-run data, and returns a typed dashboard snapshot to the Next.js page, while tests use temporary database files.

**Tech Stack:** Next.js App Router, TypeScript, `better-sqlite3`, Vitest

---

### Task 1: SQLite repository

**Files:**
- Create: `src/lib/forge-db.ts`
- Create: `tests/forge-db.test.ts`
- Modify: `src/types/forge.ts`

**Step 1: Write the failing test**

Add tests asserting:
- a new database initializes schema and seeds first-run data
- loading the dashboard snapshot returns seeded projects, assets, runs, and gates

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because `src/lib/forge-db.ts` does not exist yet

**Step 3: Write minimal implementation**

Implement a small SQLite repository with:
- schema creation
- first-run seed
- typed dashboard snapshot loader

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for the new DB tests

### Task 2: Wire dashboard to SQLite

**Files:**
- Modify: `app/page.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `tests/app-shell.test.tsx`

**Step 1: Write the failing test**

Add or update tests to assert the app shell renders from injected dashboard data instead of hardcoded module-level mock imports.

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because the shell still depends on mock-data directly

**Step 3: Write minimal implementation**

Pass a dashboard snapshot from the page into the app shell and remove direct mock-data coupling.

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for the shell and DB tests

### Task 3: Verification

**Files:**
- Verify only

**Step 1: Run tests**

Run: `npm test`
Expected: all tests passing

**Step 2: Run build**

Run: `npm run build`
Expected: production build succeeds with SQLite-backed page code

**Step 3: Run desktop dev flow**

Run: `npm run electron:dev`
Expected: Electron launches and the dashboard loads from the local SQLite file

## Out of Scope

- Cloud sync
- User editing flows
- Write APIs for creating or updating projects
- App data migration strategy beyond first-run seed
