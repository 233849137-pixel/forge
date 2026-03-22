# NanoClaw CEO Backend Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `Nano/OpenClaw` 以单总控执行后端接入 Forge，并打通 `需求确认 -> PRD 生成 -> bridge/writeback` 的第一条真实链路。

**Architecture:** 保持 Forge 为唯一控制面和主数据真源，NanoClaw 只作为 `pm-execution-backend` 的轻量 shell/CLI 执行后端。实现上复用现有 `prepare -> dispatch -> execute -> bridge -> writeback` 契约，扩充 PM 链路 payload、统一 NanoClaw 文案口径，并把 CEO 总控标识透传到工作台、控制面和 AI 员工页。

**Tech Stack:** TypeScript, Next.js route handlers, Forge AI core, SQLite-backed snapshot selectors, Vitest.

---

### Task 1: 固化产品口径与页面数据出口

**Files:**
- Modify: `../../src/server/forge-page-dtos.ts`
- Modify: `../../src/components/agent-team-page.tsx`
- Test: `../../tests/agent-team-page.test.tsx`

**Step 1: Write the failing test**

验证 AI 员工页在 `项目牧羊人 Agent` 上显示：
- `执行后端：NanoClaw`
- `总控角色：项目牧羊人 Agent`
- `执行模式：单 runtime / 多员工 profile 调度`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/agent-team-page.test.tsx -t "NanoClaw"`
Expected: FAIL，当前 team page data 不包含该展示字段。

**Step 3: Write minimal implementation**

从 control plane 透传 PM execution backend 覆盖信息到 team page data，并在 agent detail 的“模型与后端”区域为 `agent-service-strategy` 渲染 NanoClaw 总控说明。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/agent-team-page.test.tsx -t "NanoClaw"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/forge-page-dtos.ts src/components/agent-team-page.tsx tests/agent-team-page.test.tsx
git commit -m "feat: expose NanoClaw CEO backend in team page"
```

### Task 2: 强化 PM execution backend payload

**Files:**
- Modify: `../../packages/ai/src/forge-ai.ts`
- Test: `../../tests/forge-ai.test.ts`
- Test: `../../tests/forge-api-routes.test.ts`

**Step 1: Write the failing test**

为 `prepareExecutionBackendRequestForAI({ projectId })` 的 PRD/项目接入场景补测试，断言 invocation payload 包含：
- `projectId`
- `stage`
- `commandType = "prd.generate"`
- `taskInstruction`
- `expectedOutput`
- `agent.id/name/persona/systemPrompt/knowledgeSources/skillIds/permissionProfileId/ownerMode`

并断言在配置 `FORGE_PM_EXEC_BACKEND=NanoClaw` 时，`backend = "NanoClaw"`。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts -t "NanoClaw|pm external execution|prd handoff"`
Expected: FAIL，当前缺少完整 PM handoff 覆盖。

**Step 3: Write minimal implementation**

复用 `resolveProjectHandoffExecutionBackendEntry` 和 `buildExecutionBackendInvocation`，确保 PM/PRD 链的 invocation payload 输出稳定、结构完整，且 API route 直接透出 NanoClaw backend label。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts -t "NanoClaw|pm external execution|prd handoff"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/ai/src/forge-ai.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts
git commit -m "feat: add NanoClaw PM backend payload for PRD handoff"
```

### Task 3: 验证 bridge/writeback 回写口径

**Files:**
- Modify: `../../packages/ai/src/forge-ai.ts`
- Modify: `../../packages/ai/src/runtime-adapters.ts`
- Test: `../../tests/forge-ai.test.ts`
- Test: `../../tests/forge-runtime-adapters.test.ts`

**Step 1: Write the failing test**

补 PM bridge/writeback 测试，验证：
- `dispatch / execute / bridge / writeback` 可以对 `prd.generate` 返回 `NanoClaw`
- 回写后项目进入 `方案与任务包`
- PRD 文档、运行时间线、command execution summary 使用 CEO 总控 / NanoClaw 文案

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-runtime-adapters.test.ts -t "prd generate|NanoClaw|CEO总控"`
Expected: FAIL，当前 PM adapter/bridge 口径覆盖不足。

**Step 3: Write minimal implementation**

将 PM adapter 与 bridge/writeback 的摘要、evidence、executor 文案统一到 `NanoClaw` / `CEO 总控`，但不改动非 PM 链路的 OpenClaw fallback 行为。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-ai.test.ts tests/forge-runtime-adapters.test.ts -t "prd generate|NanoClaw|CEO总控"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/ai/src/forge-ai.ts packages/ai/src/runtime-adapters.ts tests/forge-ai.test.ts tests/forge-runtime-adapters.test.ts
git commit -m "feat: wire NanoClaw CEO bridge for PRD generation"
```

### Task 4: 回归现有非 PM 后端链路

**Files:**
- Test: `../../tests/forge-api-routes.test.ts`
- Test: `../../tests/forge-projects-page.test.tsx`
- Test: `../../tests/runtime-capability-detect.test.ts`

**Step 1: Run focused regression**

Run:
- `npm test -- tests/runtime-capability-detect.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test -- tests/forge-projects-page.test.tsx`

Expected: existing OpenClaw and local fallback behavior remains green.

**Step 2: Fix only true regressions**

若出现失败，仅收口 PM/NanoClaw 口径相关兼容问题，不重写 reviewer/qa/release/archive 的外部后端策略。

**Step 3: Re-run all focused regression**

Run:
- `npm test -- tests/runtime-capability-detect.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts tests/forge-projects-page.test.tsx tests/agent-team-page.test.tsx`

Expected: PASS

**Step 4: Commit**

```bash
git add .
git commit -m "test: cover NanoClaw CEO backend phase 1 regressions"
```
