# Forge Task Control Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 Forge 现有的 `Task` 从项目内列表升级成跨项目的任务中枢，让首页和执行页都能围绕调度工作，而不是只显示运行记录。

**Architecture:** 不新增页面，也不引入真实 Runner。先复用现有 `Task / Project / Agent / Workflow` 数据，补出跨项目任务选择器、项目负载摘要、Agent 负载摘要，并让首页和执行页消费这些中枢视图。这样可以先把 control plane 调度能力立住，再在下一阶段把它接到 `packages/runner`。

**Tech Stack:** TypeScript、Vitest、React Server Components、SQLite（现有 schema 不变）

---

### Task 1: 先写任务中枢选择器回归测试

**Files:**
- Modify: `../../tests/forge-selectors.test.ts`
- Test data: `../../tests/fixtures/forge-snapshot.ts`

**Step 1: 写失败测试**
- 增加跨项目任务中枢测试，覆盖：
  - 调度队列按 `P0 -> P1 -> P2` 与状态排序
  - 每个项目的 open / blocked / in-progress 负载摘要
  - 每个 Agent 的任务负载与容量标签

**Step 2: 跑测试确认失败**
- Run: `npm test -- tests/forge-selectors.test.ts`
- Expected: 选择器缺失或断言失败

**Step 3: 最小实现**
- 在 `packages/core/src/selectors.ts` 增加：
  - `getTaskDispatchQueue`
  - `getProjectTaskLoad`
  - `getAgentTaskLoad`

**Step 4: 跑测试确认通过**
- Run: `npm test -- tests/forge-selectors.test.ts`

---

### Task 2: 让执行页变成任务中枢控制台

**Files:**
- Modify: `../../src/components/forge-execution-page.tsx`
- Modify: `../../src/components/forge-os-shared.tsx`
- Test: `../../tests/forge-os-pages.test.tsx`

**Step 1: 写失败测试**
- 执行页新增断言：
  - `项目负载`
  - `Agent 负载`

**Step 2: 跑测试确认失败**
- Run: `npm test -- tests/forge-os-pages.test.tsx`

**Step 3: 最小实现**
- 在 shared 层加 summary 包装器
- 执行页新增两个 panel：
  - 项目负载
  - Agent 负载

**Step 4: 跑测试确认通过**
- Run: `npm test -- tests/forge-os-pages.test.tsx`

---

### Task 3: 让首页真正看到跨项目调度焦点

**Files:**
- Modify: `../../src/components/forge-home-page.tsx`
- Test: `../../tests/forge-home-page.test.tsx`

**Step 1: 写失败测试**
- 首页新增断言：
  - `任务中枢摘要`

**Step 2: 跑测试确认失败**
- Run: `npm test -- tests/forge-home-page.test.tsx`

**Step 3: 最小实现**
- 首页用跨项目调度队列的前几项替换泛泛的“待推进事项”
- 增加任务中枢摘要卡，显示：
  - 待调度任务数
  - 阻塞任务数
  - 最优先项目

**Step 4: 跑测试确认通过**
- Run: `npm test -- tests/forge-home-page.test.tsx`

---

### Task 4: 回归验证并同步主计划

**Files:**
- Modify: `../../docs/plans/2026-03-08-forge-positioning-gap-plan.md`

**Step 1: 跑针对性验证**
- Run: `npm test -- tests/forge-selectors.test.ts tests/forge-os-pages.test.tsx tests/forge-home-page.test.tsx`

**Step 2: 跑全量验证**
- Run: `npm test`
- Run: `npm run build`
- Run: `npm run build:electron`

**Step 3: 文档回写**
- 在主计划中记录 `Task 中枢` 已完成的最小范围

