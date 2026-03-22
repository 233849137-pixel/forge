# Forge P0 Continuation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Push Forge from a workflow dashboard into a usable local-first AI delivery workbench by implementing template-driven project intake, project DNA, local workspace initialization, task pack scaffolding, and real execution foundations.

**Architecture:** Keep the existing Electron + Next.js + local SQLite structure, but stop treating the app as a pure dashboard. Add explicit domain objects for project templates, project DNA, workspace metadata, and task packs in the database; expose them through the same shared core used by the UI and AI APIs; initialize a real local workspace directory on project creation so later Codex/Claude/Playwright execution has a concrete target.

**Tech Stack:** Electron, Next.js App Router, server actions, local SQLite (`better-sqlite3`), Node.js filesystem APIs, Vitest.

---

### Task 1: Project Template and DNA Foundation

**Files:**
- Modify: `../../src/types/forge.ts`
- Modify: `../../src/data/mock-data.ts`
- Modify: `../../src/lib/forge-db.ts`
- Test: `../../tests/forge-db.test.ts`

**Step 1: Write the failing test**

Add tests that require:
- dashboard snapshot exposes project templates
- creating a project with a template persists template linkage, project DNA, and workspace path
- workspace scaffold files exist on disk after project creation

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-db.test.ts`
Expected: FAIL because templates / DNA / workspace metadata do not exist yet.

**Step 3: Write minimal implementation**

Implement:
- `ForgeProjectTemplate`
- `ForgeProjectProfile` / project DNA
- `ForgeWorkspace`
- SQLite tables for templates and project detail metadata
- file-system workspace bootstrap with minimal scaffold files such as `README.md`, `context/project-dna.json`, and `notes/intake.md`

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-db.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/forge.ts src/data/mock-data.ts src/lib/forge-db.ts tests/forge-db.test.ts
git commit -m "feat: add template-driven project intake foundation"
```

### Task 2: Project Intake UI and Current Context

**Files:**
- Modify: `../../src/components/app-shell.tsx`
- Modify: `../../app/actions.ts`
- Modify: `../../app/page.tsx`
- Modify: `../../app/globals.css`
- Test: `../../tests/app-shell.test.tsx`

**Step 1: Write the failing test**

Add tests that require:
- project creation form includes template selection
- current context panel shows template, workspace path, and DNA summary
- latest PRD is scoped to the active project instead of global first item

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/app-shell.test.tsx`
Expected: FAIL because the UI still renders the old form and context model.

**Step 3: Write minimal implementation**

Implement:
- template picker in intake form
- current project DNA block in the workbench/context area
- active-project filtered PRD preview

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/app-shell.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/app-shell.tsx app/actions.ts app/page.tsx app/globals.css tests/app-shell.test.tsx
git commit -m "feat: add template-driven intake ui"
```

### Task 3: AI / HTTP Visibility for Templates and Project Details

**Files:**
- Modify: `../../src/lib/forge-ai.ts`
- Modify: `../../app/api/forge/projects/route.ts`
- Add: `../../app/api/forge/templates/route.ts`
- Modify: `../../scripts/forge-mcp.mjs`
- Test: `../../tests/forge-ai.test.ts`
- Test: `../../tests/forge-api-routes.test.ts`

**Step 1: Write the failing test**

Add tests that require:
- AI layer can list templates
- AI layer can read project detail including workspace path and DNA
- API returns template list

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
Expected: FAIL because project detail/template endpoints are incomplete.

**Step 3: Write minimal implementation**

Implement:
- AI helpers for template listing and project detail snapshot
- `/api/forge/templates`
- MCP tool for template listing and project detail

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/forge-ai.ts app/api/forge/projects/route.ts app/api/forge/templates/route.ts scripts/forge-mcp.mjs tests/forge-ai.test.ts tests/forge-api-routes.test.ts
git commit -m "feat: expose intake metadata to ai integrations"
```

### Task 4: Task Pack Domain Model

**Files:**
- Modify: `../../src/types/forge.ts`
- Modify: `../../src/lib/forge-db.ts`
- Modify: `../../src/lib/forge-ai.ts`
- Add: `../../app/api/forge/taskpacks/route.ts`
- Modify: `../../src/components/app-shell.tsx`
- Test: `../../tests/forge-db.test.ts`
- Test: `../../tests/app-shell.test.tsx`

**Step 1: Write the failing test**

Add tests that require:
- generating a task pack for the active project
- task pack includes scope, constraints, template references, acceptance criteria
- UI shows latest task pack

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-db.test.ts tests/app-shell.test.tsx`
Expected: FAIL because task packs do not exist.

**Step 3: Write minimal implementation**

Create `task_packs` table and generator based on project DNA + latest PRD + selected template.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-db.test.ts tests/app-shell.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/forge.ts src/lib/forge-db.ts src/lib/forge-ai.ts app/api/forge/taskpacks/route.ts src/components/app-shell.tsx tests/forge-db.test.ts tests/app-shell.test.tsx
git commit -m "feat: add task pack generation"
```

### Task 5: Execution Runner Skeleton

**Files:**
- Modify: `../../electron/preload.ts`
- Modify: `../../electron/main.ts`
- Add: `../../src/lib/forge-runner.ts`
- Modify: `../../src/lib/forge-db.ts`
- Test: `../../tests/runtime-config.test.ts`
- Add: `../../tests/forge-runner.test.ts`

**Step 1: Write the failing test**

Add tests that require:
- runner can accept a local execution request against a workspace path
- run records persist requested command, status, logs

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-runner.test.ts`
Expected: FAIL because no runner exists.

**Step 3: Write minimal implementation**

Create a local runner abstraction that stores execution requests and supports a dry-run mode first.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-runner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add electron/preload.ts electron/main.ts src/lib/forge-runner.ts src/lib/forge-db.ts tests/forge-runner.test.ts
git commit -m "feat: add local runner skeleton"
```

### Task 6: Full Verification

**Files:**
- Verify only

**Step 1: Run unit and integration tests**

Run: `npm test`
Expected: PASS

**Step 2: Run production build**

Run: `npm run build`
Expected: PASS

**Step 3: Run Electron bundle build**

Run: `npm run build:electron`
Expected: PASS

**Step 4: Launch desktop app**

Run: `npm run electron:dev`
Expected: Electron launches the latest Forge desktop shell.

**Step 5: Commit**

```bash
git add .
git commit -m "chore: verify forge p0 continuation"
```
