# AI员工完整链路 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 AI员工 模块从“可演示”推进到“完整可编辑、刷新不丢、跨页一致”的真实链路。

**Architecture:** 保留当前双层数据边界：`team-registry` 负责员工档案，`team-workbench-state` 负责组织架构、团队配置、技能配置、权限管理等工作台状态。通过补齐持久化字段、统一状态来源、增加跨页同步和回归测试，把五个页面收成同一条连续链路。

**Tech Stack:** Next.js App Router、React、Vitest、Testing Library、SQLite、Forge page DTO / API routes

---

### Task 1: 固定 AI员工 数据边界

**Files:**
- Modify: `../../packages/core/src/types.ts`
- Modify: `../../packages/db/src/forge-db.ts`
- Modify: `../../src/components/agent-team-page.tsx`
- Test: `../../tests/forge-team-api.test.ts`
- Test: `../../tests/forge-api-routes.test.ts`

**Step 1: 明确 team-registry 与 team-workbench-state 的职责**
- `team-registry` 只保存员工基础/能力/运行档案。
- `team-workbench-state` 只保存组织架构、团队配置、技能配置、权限管理工作台状态。

**Step 2: 补齐 workbench state 缺失字段**
- 组织架构、技能配置、权限管理中还在本地状态但刷新会丢的字段补进类型和归一化。

**Step 3: 为新增字段补 route/client roundtrip 测试**
- 确认 `saveForgeTeamWorkbenchState` 发出的 payload 和 `/api/forge/team-workbench-state` 返回结果一致。

### Task 2: 组织架构数据一致性

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Test: `../../tests/agent-team-page.test.tsx`

**Step 1: 部门编辑同步 managedAgents**
- 改名、删除、迁移部门时，同步更新 `managedAgents.departmentLabel`，避免只改 `orgChartMembers`。

**Step 2: 员工换部门同步 managedAgents**
- 拖拽换部门后，刷新后员工基础页也应显示新部门。

**Step 3: 删除员工清理派生状态**
- 删除员工时同步清理 governance overrides、选中态和无效引用。

**Step 4: 写回归测试**
- 验证编辑部门、换部门、删除员工后，保存 payload 中的 `managedAgents` 与 `orgChartMembers` 口径一致。

### Task 3: 团队配置真实链路

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Test: `../../tests/agent-team-page.test.tsx`

**Step 1: 模板与岗位绑定保持同源**
- `selectedTemplateId`、`roleAssignments` 和当前选中员工保持同一个保存入口。

**Step 2: 岗位绑定与员工详情联动**
- 在团队配置绑定员工后，员工管理/技能配置/权限管理默认聚焦同一员工。

**Step 3: 回归测试**
- 验证切模板、绑员工、刷新后仍然一致。

### Task 4: 员工管理完整保存

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Modify: `../../app/api/forge/team-registry/route.ts`
- Test: `../../tests/agent-team-page.test.tsx`
- Test: `../../tests/forge-api-routes.test.ts`

**Step 1: 基础/能力/运行字段全部回写 team-registry**
- 确认模型、部门、权限等级、技能引用等字段刷新后不丢。

**Step 2: 员工文档入口与档案一致**
- `打开文档` 读取真实档案，字段变化与 profile 一致。

### Task 5: 技能配置单一数据源

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Modify: `../../src/server/forge-real-skills.ts`
- Test: `../../tests/agent-team-page.test.tsx`

**Step 1: 技能库 / 技能组合 / 自定义组包共用当前技能包**
- 消除多份技能包状态。

**Step 2: 技能详情、分类、卸载、装备都落到同一状态源**
- 刷新后和页面筛选口径一致。

**Step 3: 回归测试**
- 验证单技能、技能包、当前技能包、自定义组包之间的数据一致性。

### Task 6: 权限管理真实链路

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Test: `../../tests/agent-team-page.test.tsx`
- Test: `../../tests/forge-team-api.test.ts`
- Test: `../../tests/forge-api-routes.test.ts`

**Step 1: 权限等级回写员工 profile**
- 保证 `permissionProfileId` 和页面等级映射一致。

**Step 2: 例外权限回写 workbench state**
- 刷新后仍能看到放开/收紧项。

**Step 3: 回归测试**
- 验证切等级、改例外权限、刷新后数据还在。

### Task 7: Demo 团队冻结

**Files:**
- Modify: `../../src/data/mock-data.ts`
- Modify: `../../docs/agents/*.md`
- Test: `../../tests/forge-team-roster.test.ts`

**Step 1: 冻结演示团队名单、部门、技能包、权限等级**
- 不再边做边改 roster。

**Step 2: 用真实团队语义校准角色与岗位**
- 让组织架构、团队配置、员工管理、技能配置说的是同一支团队。

### Task 8: 端到端验证

**Files:**
- Test: `../../tests/agent-team-page.test.tsx`
- Verify: `../../src/components/agent-team-page.tsx`

**Step 1: 跑 AI员工 专项测试**
- `CI=1 npx vitest run tests/forge-team-api.test.ts tests/forge-api-routes.test.ts tests/agent-team-page.test.tsx --reporter=verbose --no-file-parallelism`

**Step 2: 跑页面探活**
- `curl -I http://127.0.0.1:3322/team`

**Step 3: 手动走演示主链**
- 组织架构 -> 团队配置 -> 员工管理 -> 技能配置 -> 权限管理
- 每一步改动后刷新确认不丢
