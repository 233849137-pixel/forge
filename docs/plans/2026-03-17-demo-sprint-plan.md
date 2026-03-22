# Demo Sprint Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Get the product to a believable, stable demo state where NanoClaw can take one customer requirement, spin up the main product project, assemble an AI team, and make the project feel actively in motion across the dashboard, project management, AI team, and asset pages.

**Architecture:** Treat the next few days as a demo sprint, not general product development. Reuse the existing product shell and page routes on `http://127.0.0.1:3322`, but force one seeded project narrative through every surface. Prioritize product story, seeded consistency, and presentation reliability over full autonomy or backend purity.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, local APIs, seeded page DTOs, existing page modules under `src/components` and `src/server`.

---

## Demo contract

This sprint supports one story only:

1. The presenter inputs one customer requirement.
2. NanoClaw takes over the product project.
3. The system creates and activates the main project: `示例案件协作平台`.
4. The system shows that an AI team has been assembled around that project.
5. The system shows seeded PRD, work plan, design kickoff, and stage progression.
6. The system shows reusable product assets generated from the same project story.

### Non-goals

- Do **not** chase full real-time autonomy.
- Do **not** add new modules.
- Do **not** spend time on Electron.
- Do **not** try to demo every existing backend capability.
- Do **not** let case records become the main “project” again.

### Golden demo flow

The live click path for the demo is fixed:

1. `仪表盘`
2. `项目管理`
3. `AI员工`
4. `资产管理`

Everything we change this sprint must strengthen that path.

---

### Task 1: Freeze the demo story and seed source of truth

**Files:**
- Modify: `../../src/lib/forge-demo-contract.ts`
- Modify: `../../src/server/forge-demo-seed.ts`
- Modify: `../../docs/plans/2026-03-17-nanoclaw-demo-takeover-plan.md`

**Step 1: Lock the main project identity**

Use one canonical project:
- `示例案件协作平台`

Seed these minimum facts into the demo contract:
- customer requirement summary
- project id / project name
- takeover summary
- PRD summary
- work plan summary
- design kickoff summary
- AI team summary
- asset summary

**Step 2: Remove old scenario drift**

Delete or stop referencing:
- retail copilot copy
- case-as-project modeling
- extra demo scenario names

**Step 3: Keep seeded data UI-facing**

All copy should sound like product language:
- no backend jargon
- no “bridge” or “execution backend” language
- no internal orchestration wording

**Step 4: Verify**

Run:

```bash
npx vitest run tests/forge-page-dtos.test.ts
```

**Step 5: Commit**

```bash
git add src/lib/forge-demo-contract.ts src/server/forge-demo-seed.ts docs/plans/2026-03-17-nanoclaw-demo-takeover-plan.md
git commit -m "docs: freeze demo story around law platform project"
```

---

### Task 2: Make the dashboard a clear demo opening

**Files:**
- Modify: `../../src/components/forge-home-page.tsx`
- Modify: `../../src/components/forge-home-page.module.css`
- Test: `../../tests/forge-home-page.test.tsx`

**Step 1: Promote the takeover headline**

At the top of the page, clearly show:
- NanoClaw has taken over the project
- the product project is active
- one primary CTA leads into project management

**Step 2: Keep only the three useful blocks**

Dashboard blocks must stay limited to:
- project status
- pending actions
- today’s focus

If a block does not support one of those, remove or demote it.

**Step 3: Make the current project obvious**

The active project row/card must visibly point to:
- `示例案件协作平台`
- current stage
- current owner focus
- next milestone

**Step 4: Verify**

Run:

```bash
npx vitest run tests/forge-home-page.test.tsx
```

**Step 5: Commit**

```bash
git add src/components/forge-home-page.tsx src/components/forge-home-page.module.css tests/forge-home-page.test.tsx
git commit -m "feat: refocus dashboard on demo project takeover"
```

---

### Task 3: Turn project management into the demo centerpiece

**Files:**
- Modify: `../../src/components/forge-projects-page.tsx`
- Modify: `../../src/components/forge-projects-page.module.css`
- Modify: `../../app/[view]/page.tsx`
- Test: `../../tests/forge-projects-page.test.tsx`

**Step 1: Make project detail read like a running project**

Project detail must clearly show:
- requirement origin
- PRD draft
- work plan
- design kickoff
- milestone / stage progression

**Step 2: Replace “information page” feeling with “project in motion”**

Add visible copy that tells the story:
- created from a customer ask
- AI takeover started
- the initial package is generated
- the next stage is already defined

**Step 3: Keep legal product context grounded**

The project must read as the user’s actual product:
- law platform
- case workflow system
- real case data as product usage

Do **not** let the page drift back into presenting a single legal case as the main project.

**Step 4: Verify**

Run:

```bash
npx vitest run tests/forge-projects-page.test.tsx
```

**Step 5: Commit**

```bash
git add src/components/forge-projects-page.tsx src/components/forge-projects-page.module.css app/[view]/page.tsx tests/forge-projects-page.test.tsx
git commit -m "feat: make project page the demo centerpiece"
```

---

### Task 4: Make AI team assembly visibly driven by the project

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Modify: `../../src/components/agent-team-page.module.css`
- Test: `../../tests/agent-team-page.test.tsx`

**Step 1: Open the page with project-aware takeover context**

The top of the page should tell the user:
- this team was assembled for `示例案件协作平台`
- each role exists because of the current project stage
- NanoClaw is coordinating the team

**Step 2: Show roles as project participants, not generic employees**

At minimum, the seeded roles should imply:
- requirement / product
- architecture / planning
- design
- engineering
- testing / delivery

**Step 3: Show current work and next handoff**

Every highlighted role cluster should answer:
- what it is doing now
- what it already produced
- who receives the next handoff

**Step 4: Verify**

Run:

```bash
npx vitest run tests/agent-team-page.test.tsx
```

**Step 5: Commit**

```bash
git add src/components/agent-team-page.tsx src/components/agent-team-page.module.css tests/agent-team-page.test.tsx
git commit -m "feat: tie ai team assembly to demo project"
```

---

### Task 5: Make assets prove the project is producing output

**Files:**
- Modify: `../../src/components/forge-assets-page.tsx`
- Modify: `../../src/components/forge-assets-page.module.css`
- Test: `../../tests/forge-os-pages.test.tsx`

**Step 1: Surface only demo-relevant product outputs**

Asset management must clearly show that the project has produced:
- PRD output
- work plan output
- design kickoff output
- reusable product asset / knowledge artifact

**Step 2: Keep this page secondary**

Do not overload it with every possible asset type.
The page’s role in the demo is to prove that project work gets captured and reused.

**Step 3: Keep naming simple**

Use product-facing labels only. Avoid control-plane or backend labels.

**Step 4: Verify**

Run:

```bash
npx vitest run tests/forge-os-pages.test.tsx
```

**Step 5: Commit**

```bash
git add src/components/forge-assets-page.tsx src/components/forge-assets-page.module.css tests/forge-os-pages.test.tsx
git commit -m "feat: align asset page to demo project outputs"
```

---

### Task 6: Add one stable intake trigger for the demo

**Files:**
- Modify: `../../src/components/forge-home-page.tsx`
- Modify: `../../src/server/forge-demo-seed.ts`
- Test: `../../tests/forge-home-page.test.tsx`

**Step 1: Add a simple customer requirement intake action**

The presenter must be able to show one obvious action, such as:
- `提交客户需求`
- `让 NanoClaw 接管`

**Step 2: Map the action to the seeded demo state**

For the demo, the action can move the UI into the seeded state instead of doing full live orchestration.

**Step 3: Make the transition explicit**

After the action:
- show takeover success language
- activate the main project
- enable the click path into project management

**Step 4: Verify**

Run:

```bash
npx vitest run tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx
```

**Step 5: Commit**

```bash
git add src/components/forge-home-page.tsx src/server/forge-demo-seed.ts tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx
git commit -m "feat: add demo-safe nanoclaw intake trigger"
```

---

### Task 7: Lock the demo script and trim distractions

**Files:**
- Create: `../../docs/plans/2026-03-17-demo-script.md`
- Modify: `../../README.md`

**Step 1: Write the exact presenter click path**

Document:
1. open dashboard
2. submit the customer requirement
3. open project management
4. open AI team
5. open asset management

**Step 2: List what must be hidden or ignored during the demo**

Examples:
- unfinished buttons
- low-value stats
- backend-only wording
- secondary modules that break the story

**Step 3: Add a pre-demo reset checklist**

Include:
- open `3322`
- verify the seeded main project is active
- verify AI team page shows the same project
- verify asset page shows the same project outputs

**Step 4: Commit**

```bash
git add docs/plans/2026-03-17-demo-script.md README.md
git commit -m "docs: lock demo script and trim distractions"
```

---

### Task 8: Run the full acceptance pass

**Files:**
- Test: `../../tests/forge-home-page.test.tsx`
- Test: `../../tests/forge-projects-page.test.tsx`
- Test: `../../tests/agent-team-page.test.tsx`
- Test: `../../tests/forge-os-pages.test.tsx`

**Step 1: Run page-focused tests**

```bash
npx vitest run tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/agent-team-page.test.tsx tests/forge-os-pages.test.tsx
```

**Step 2: Run full build**

```bash
npm run build
```

**Step 3: Verify the live demo path**

Check manually on `http://127.0.0.1:3322`:
- dashboard opens on the right project story
- project management shows the main seeded work package
- AI team shows the same project context
- asset management shows the same outputs

**Step 4: Demo-ready definition**

The demo is ready when all of the following are true:
- the presenter can explain the product in one sentence
- one requirement intake starts the story
- the project page looks like a running project, not a data bucket
- the AI team page clearly looks assembled by the project
- the asset page proves the work turned into outputs
- all pages speak about the same project
- `3322` is the only validation target

---

## Window split

### Window A: AI takeover and seeded orchestration
- Task 1
- Task 4
- Task 6

### Window B: UI demo polish and story continuity
- Task 2
- Task 3
- Task 5
- Task 7

### Final pass
- Task 8 together

---

## Priority if time slips

If we run short on time, keep only this order:

1. Task 3: Project management demo centerpiece
2. Task 4: AI team assembly by project
3. Task 2: Dashboard opening
4. Task 6: Intake trigger
5. Task 5: Asset proof

The project page and AI team page carry the demo. Everything else supports them.
