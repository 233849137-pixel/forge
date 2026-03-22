# AI Employee Demo Chain Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the AI employee page feel like one continuous demo chain by preserving the current agent/role context across categories, edits, and page refreshes.

**Architecture:** Keep the existing `/team` page structure intact and only strengthen state continuity. Use shared local state plus localStorage persistence for the selected category, agent, builder role, employee pool selection, and key filters. Update the team configuration interactions so choosing a role or binding an employee also updates the shared current agent context used by employee management, skill configuration, and governance.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, localStorage-backed client state

---

### Task 1: Add failing tests for cross-category continuity

**Files:**
- Modify: `../../tests/agent-team-page.test.tsx`

**Step 1: Write the failing test**

Add tests that verify:
- selecting an employee from `团队配置` carries into `员工管理`
- selected agent survives remount via localStorage

**Step 2: Run test to verify it fails**

Run: `CI=1 npx vitest run tests/agent-team-page.test.tsx --reporter=verbose --no-file-parallelism`

Expected: FAIL on the new continuity assertions.

### Task 2: Persist selected context and sync team builder selection

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`

**Step 1: Add localStorage keys and restore logic**

Persist:
- selected agent
- selected builder role
- selected pool agent
- selected pool / management / template / governance department filters
- selected ability tab / ability line if needed for continuity

**Step 2: Sync team configuration actions**

Update interactions so:
- clicking a workflow role selects that role and, if assigned, sets the current agent
- clicking an employee in `团队配置` both binds the employee and sets the current agent

**Step 3: Keep state valid when filters/data change**

Ensure persisted values fall back safely when the saved agent/role/filter no longer exists.

### Task 3: Re-run tests and confirm page stability

**Files:**
- Test: `../../tests/agent-team-page.test.tsx`

**Step 1: Run focused tests**

Run: `CI=1 npx vitest run tests/agent-team-page.test.tsx --reporter=verbose --no-file-parallelism`

Expected: PASS

**Step 2: Probe the page**

Run: `curl -I http://127.0.0.1:3322/team`

Expected: `HTTP/1.1 200 OK`
