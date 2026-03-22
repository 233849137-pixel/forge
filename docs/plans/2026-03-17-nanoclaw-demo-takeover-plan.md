# NanoClaw Demo Takeover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a stable demo flow where NanoClaw receives one client requirement, creates a project, assembles an AI team, seeds PRD/plan/design outputs, and makes the product feel like a running AI project workspace.

**Architecture:** Treat this as a demo-first orchestration slice, not a full autonomous platform. Use one deterministic seeded scenario and a thin “takeover” state layer that feeds the existing dashboard, project, AI team, and asset pages. Optimize for a believable story, stable rendering on `http://127.0.0.1:3322`, and one coherent narrative across pages.

**Tech Stack:** Next.js app router, React client components, local page DTOs, existing `packages/core` types/selectors, existing project/team/workspace APIs, Vitest.

---

## Demo target

The demo must support this story without hand-waving:

1. User enters one client requirement.
2. NanoClaw creates a new project.
3. The system auto-builds the initial project package:
   - project overview
   - PRD draft
   - work plan
   - design kickoff placeholders
   - stage timeline
4. The system auto-assembles an AI team around the project.
5. The dashboard, project page, AI team page, and asset page all show the same project as an actively running initiative.

## Scope guardrails

- Do **not** attempt true full autonomy for the demo.
- Do **not** expand backend architecture unless needed for the demo slice.
- Do **not** spend time on Electron validation; demo target is the Web instance at `http://127.0.0.1:3322`.
- Use one flagship scenario with deterministic seeded outputs.
- Favor stable seeded state over live multi-step AI generation.

## Scenario assumption

Use one flagship customer story throughout the demo:

- Customer: retail enterprise
- Ask: AI customer support copilot
- Project name example: `零售客服副驾驶`

This scenario can be renamed later, but the whole demo should stay on one project narrative.

---

### Task 1: Freeze the demo contract

**Files:**
- Create: `../../src/lib/forge-demo-contract.ts`
- Modify: `../../README.md`
- Modify: `../../docs/plans/2026-03-09-forge-takeover-next-phase.md`

**Step 1: Define the canonical demo story**

Write a single exported constant structure describing:
- scenario id
- customer ask
- demo project name
- stage labels
- expected AI roles
- expected seeded assets
- demo CTA copy

**Step 2: Keep the contract UI-facing**

The contract should use product language only:
- no internal runner wording
- no raw backend contracts
- no “bridge / execution backend” copy

**Step 3: Document the scope**

Update README and the active planning log with:
- what the demo does
- what it intentionally fakes
- what pages participate

**Step 4: Commit**

```bash
git add src/lib/forge-demo-contract.ts README.md docs/plans/2026-03-09-forge-takeover-next-phase.md
git commit -m "docs: define nanoclaw demo contract"
```

---

### Task 2: Add seeded “AI takeover” state

**Files:**
- Create: `../../src/server/forge-demo-seed.ts`
- Modify: `../../src/server/forge-page-dtos.ts`
- Modify: `../../packages/core/src/types.ts`
- Test: `../../tests/forge-page-dtos.test.ts`

**Step 1: Define a thin demo takeover shape**

Add a typed structure for:
- intake requirement
- takeover status
- generated project id/name
- generated PRD/plan/design summary
- generated team summary
- generated assets summary

**Step 2: Seed one deterministic demo state**

Implement one helper that returns the same believable project state every time.

**Step 3: Thread it into page DTOs**

Expose the seeded takeover state to pages without rewriting the whole data model.

**Step 4: Write DTO tests**

Add tests that assert the DTO includes:
- one active demo project
- one generated team
- one seeded delivery asset set

**Step 5: Verify**

Run:

```bash
npx vitest run tests/forge-page-dtos.test.ts
```

**Step 6: Commit**

```bash
git add src/server/forge-demo-seed.ts src/server/forge-page-dtos.ts packages/core/src/types.ts tests/forge-page-dtos.test.ts
git commit -m "feat: add demo takeover seeded state"
```

---

### Task 3: Build the dashboard around “AI starts the project”

**Files:**
- Modify: `../../src/components/forge-home-page.tsx`
- Modify: `../../src/components/forge-home-page.module.css`
- Modify: `../../src/components/forge-console-shell.tsx`
- Test: `../../tests/forge-home-page.test.tsx`

**Step 1: Replace generic dashboard framing**

The dashboard should open with one primary message:
- NanoClaw has taken over a client request
- the project is now in motion

**Step 2: Keep only three decision blocks**

The page should emphasize:
- project portfolio / current project state
- pending actions
- today’s focus

**Step 3: Add one primary CTA**

The main action should move into the demo flow:
- `查看项目详情`
- or `进入项目工作台`

Do not make AI settings the hero CTA.

**Step 4: Write page tests**

Assert the dashboard shows:
- the seeded project
- a takeover message
- a primary path into the project page

**Step 5: Verify**

Run:

```bash
npx vitest run tests/forge-home-page.test.tsx
```

**Step 6: Commit**

```bash
git add src/components/forge-home-page.tsx src/components/forge-home-page.module.css src/components/forge-console-shell.tsx tests/forge-home-page.test.tsx
git commit -m "feat: refocus dashboard on demo takeover flow"
```

---

### Task 4: Turn project management into the real demo centerpiece

**Files:**
- Modify: `../../src/components/forge-projects-page.tsx`
- Modify: `../../src/components/forge-projects-page.module.css`
- Modify: `../../app/[view]/page.tsx`
- Test: `../../tests/forge-projects-page.test.tsx`

**Step 1: Make project detail the demo workbench**

The selected project should clearly show:
- requirement origin
- PRD draft
- work plan
- design kickoff
- milestone progression

**Step 2: Show “this project was auto-started”**

Add visible copy proving:
- this was created from a customer ask
- the initial docs were generated
- the stage line is already established

**Step 3: Remove backend-feeling clutter**

Hide or de-emphasize:
- low-level execution language
- internal ops language
- anything that feels like a control plane instead of a project workspace

**Step 4: Write page tests**

Assert the project page renders:
- project overview
- seeded PRD section
- seeded work plan
- stage progression

**Step 5: Verify**

Run:

```bash
npx vitest run tests/forge-projects-page.test.tsx
```

**Step 6: Commit**

```bash
git add src/components/forge-projects-page.tsx src/components/forge-projects-page.module.css app/[view]/page.tsx tests/forge-projects-page.test.tsx
git commit -m "feat: make project page the demo workbench"
```

---

### Task 5: Make the AI team feel assembled by the project

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Modify: `../../src/components/agent-team-page.module.css`
- Modify: `../../src/lib/forge-team-defaults.ts`
- Test: `../../tests/agent-team-page.test.tsx`

**Step 1: Tie team assembly to the active project**

The page must communicate:
- NanoClaw assembled this team for this project
- each role exists because of the project stage

**Step 2: Show role-to-project mapping**

For each key AI employee, show:
- role
- current assignment
- current output
- next handoff target

**Step 3: Reduce generic org-chart noise**

Do not let this become a generic employee admin page.
It should feel like a project response team.

**Step 4: Write tests**

Assert the page includes:
- project-linked team intro
- seeded roles
- current assignment / output

**Step 5: Verify**

Run:

```bash
npx vitest run tests/agent-team-page.test.tsx
```

**Step 6: Commit**

```bash
git add src/components/agent-team-page.tsx src/components/agent-team-page.module.css src/lib/forge-team-defaults.ts tests/agent-team-page.test.tsx
git commit -m "feat: align ai team page with project takeover story"
```

---

### Task 6: Make asset management prove the system created real outputs

**Files:**
- Modify: `../../src/components/forge-assets-page.tsx`
- Modify: `../../src/components/forge-assets-page.module.css`
- Test: `../../tests/forge-os-pages.test.tsx`

**Step 1: Reframe assets as generated delivery outputs**

The page should answer:
- what the system already produced
- what can be reused later

**Step 2: Surface seeded demo assets**

At minimum show:
- PRD draft
- work plan
- design kickoff package
- delivery asset placeholder

**Step 3: Keep it secondary in the demo**

This page is proof, not the star.
Optimize for fast confirmation, not deep management.

**Step 4: Add tests**

Assert the asset page shows the seeded outputs tied to the demo project.

**Step 5: Verify**

Run:

```bash
npx vitest run tests/forge-os-pages.test.tsx
```

**Step 6: Commit**

```bash
git add src/components/forge-assets-page.tsx src/components/forge-assets-page.module.css tests/forge-os-pages.test.tsx
git commit -m "feat: show seeded delivery outputs in assets page"
```

---

### Task 7: Add the intake trigger that starts the story

**Files:**
- Modify: `../../src/lib/forge-project-api.ts`
- Modify: `../../src/components/forge-home-page.tsx`
- Modify: `../../src/server/forge-page-dtos.ts`
- Test: `../../tests/forge-home-page.test.tsx`

**Step 1: Add a demo-safe intake action**

The user should be able to submit one short customer request and enter the takeover flow.

**Step 2: Keep the action deterministic**

The intake action can map into the seeded scenario for the demo.
Do not attempt open-ended generation under time pressure.

**Step 3: Confirm the UI transition**

After intake:
- dashboard updates
- project becomes active
- team reflects assignment

**Step 4: Add tests**

Assert that the intake action leads to:
- active project state
- visible seeded project takeover copy

**Step 5: Verify**

Run:

```bash
npx vitest run tests/forge-home-page.test.tsx
```

**Step 6: Commit**

```bash
git add src/lib/forge-project-api.ts src/components/forge-home-page.tsx src/server/forge-page-dtos.ts tests/forge-home-page.test.tsx
git commit -m "feat: add demo intake trigger for project takeover"
```

---

### Task 8: Lock the demo script and acceptance checklist

**Files:**
- Create: `../../docs/plans/2026-03-17-nanoclaw-demo-script.md`
- Modify: `../../README.md`

**Step 1: Write the exact 5-minute story**

Include:
- opening positioning
- each page transition
- what to click
- what to say
- what not to open

**Step 2: Add a pass/fail acceptance checklist**

The demo is ready only if:
- `3322` loads
- intake works
- project page shows generated PRD/plan/design
- AI team page shows assembled roles
- assets page shows generated outputs

**Step 3: Verify the full flow manually**

Manual flow:
1. open dashboard on `3322`
2. submit the demo requirement
3. open project page
4. open AI team page
5. open assets page

**Step 4: Commit**

```bash
git add docs/plans/2026-03-17-nanoclaw-demo-script.md README.md
git commit -m "docs: add nanoclaw demo script and acceptance checklist"
```

---

## Suggested work split

If another window is already focused on “AI takeover”:

- **Window A (AI takeover):**
  - Task 2
  - Task 7
  - seeded orchestration state
  - intake trigger

- **Window B (UI demo polish):**
  - Task 3
  - Task 4
  - Task 5
  - Task 6
  - page presentation and story continuity

- **Integration pass:**
  - Task 8

## Definition of done

The demo is at “100% demo effect” when:

- a viewer can understand the product in under 30 seconds
- one client requirement appears to start a real project
- project, team, and asset pages all reflect the same project state
- the story feels continuous, not like four disconnected pages
- no one needs Electron to understand the product; the Web demo on `3322` is stable

