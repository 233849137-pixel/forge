# Forge Agent Team P0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 先把 Forge 从“单 Agent 工作台”推进到“可承载 Agent Team”的基础形态，具备团队编制、角色注册和工件归属。

**Architecture:** P0 只做 3 层基础设施：`Agent Registry`、`Team Template Registry`、`Artifact Hub`。先不做自由编排和多 Agent 自动接力，所有协作先通过标准工件和固定编制来表达。

**Tech Stack:** Next.js、Electron、SQLite、Vitest、TypeScript

---

### Task 1: 核心数据模型

**Files:**
- Modify: `../../packages/core/src/types.ts`
- Modify: `../../src/data/mock-data.ts`
- Test: `../../tests/forge-db.test.ts`

**Step 1: 写失败测试**
- 快照里必须出现 `agents`、`teamTemplates`、`artifacts`。

**Step 2: 跑测试确认变红**
- Run: `npm test -- tests/forge-db.test.ts`

**Step 3: 补类型和种子数据**
- Agent
- TeamTemplate
- Artifact

**Step 4: 跑测试确认转绿**
- Run: `npm test -- tests/forge-db.test.ts`

### Task 2: SQLite 持久化

**Files:**
- Modify: `../../packages/db/src/forge-db.ts`
- Test: `../../tests/forge-db.test.ts`

**Step 1: 为 Agent Team 建表**
- `agents`
- `team_templates`
- `artifacts`

**Step 2: 写入 seed / sync / snapshot**

**Step 3: 跑测试**
- Run: `npm test -- tests/forge-db.test.ts`

### Task 3: 团队页面

**Files:**
- Create: `../../src/components/agent-team-page.tsx`
- Modify: `../../src/lib/forge-views.ts`
- Modify: `../../app/[view]/page.tsx`
- Modify: `../../app/globals.css`
- Test: `../../tests/agent-team-page.test.tsx`

**Step 1: 写失败测试**
- 团队页必须能显示团队模板、Agent Registry 和工件归属。

**Step 2: 跑测试确认变红**
- Run: `npm test -- tests/agent-team-page.test.tsx`

**Step 3: 实现团队页**

**Step 4: 跑测试确认转绿**
- Run: `npm test -- tests/agent-team-page.test.tsx`

### Task 4: 下一阶段

1. 增加 `Prompt Registry` 页面
2. 增加 `Skill Registry` 页面
3. 让 Artifact Hub 接入真实 PRD / TaskPack / Test Report
4. 增加 Handoff / Review / Escalation 记录
5. 开始做 Team Runtime 最小闭环
