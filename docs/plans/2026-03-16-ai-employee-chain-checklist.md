# AI Employee Chain Checklist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 打通 `AI员工` 模块的核心数据链，让组织架构、团队配置、员工管理、技能配置、权限管理都具备稳定的读写和刷新恢复能力，并能支撑 demo。

**Architecture:** 继续保持 `team-registry` 负责员工档案、`team-workbench-state` 负责团队/技能/组织工作台状态的边界，不再新增新页面或新数据源。优先把“改了能存、刷新还在、页面间同步”做实，再做细节 polish。

**Tech Stack:** Next.js App Router, React, TypeScript, local SQLite (`packages/db`), page DTOs, Vitest

---

## 当前判断

- `员工管理` 的保存链已经较真，核心入口是 `/api/forge/team-registry`
- `组织架构 / 团队配置 / 技能配置` 主要依赖 `/api/forge/team-workbench-state`
- 当前最该做的不是扩功能，而是把 5 条链路逐条验真并补齐持久化

## AI员工全链路检查顺序

1. `组织架构`
2. `团队配置`
3. `员工管理`
4. `技能配置`
5. `权限管理`
6. `全链回归 + demo 数据冻结`

---

### Task 1: 固定数据边界与现状清单

**Files:**
- Modify: `../../docs/plans/2026-03-16-ai-employee-chain-checklist.md`
- Read: `../../src/components/agent-team-page.tsx`
- Read: `../../src/lib/forge-team-api.ts`
- Read: `../../app/api/forge/team-registry/route.ts`
- Read: `../../app/api/forge/team-workbench-state/route.ts`

**Step 1: 记录两个数据口的职责**

- `team-registry`
  - 员工基础信息
  - 模型
  - persona
  - prompt
  - knowledge
  - 权限等级
- `team-workbench-state`
  - 部门
  - 组织架构成员
  - 团队节点绑定
  - 单技能装备
  - 技能包
  - 页面级当前状态

**Step 2: 把还未完全打通的项写出来**

- 组织架构部门和成员是否刷新不丢
- 团队节点绑定是否刷新不丢
- 技能装备、技能包、技能详情分类是否刷新不丢
- 权限等级和例外权限是否刷新不丢

**Step 3: 运行现状测试**

Run:

```bash
CI=1 npx vitest run tests/agent-team-page.test.tsx tests/forge-team-api.test.ts tests/forge-api-routes.test.ts --reporter=verbose --no-file-parallelism
```

Expected:
- 所有 `AI员工` 相关测试通过
- 明确哪些场景已有测试，哪些还没有回归覆盖

---

### Task 2: 打通组织架构持久化

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Modify: `../../packages/db/src/forge-db.ts`
- Test: `../../tests/agent-team-page.test.tsx`
- Test: `../../tests/forge-api-routes.test.ts`

**Checklist:**

- [ ] 编辑部门后刷新仍在
- [ ] 新增部门后刷新仍在
- [ ] 删除部门后刷新仍在
- [ ] 员工换部门后刷新仍在
- [ ] 组织架构页面切走再回来状态一致

**Run:**

```bash
CI=1 npx vitest run tests/agent-team-page.test.tsx tests/forge-api-routes.test.ts --reporter=verbose --no-file-parallelism
```

---

### Task 3: 打通团队配置持久化

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Modify: `../../packages/db/src/forge-db.ts`
- Test: `../../tests/agent-team-page.test.tsx`

**Checklist:**

- [ ] 项目节点和项目工作台节点名称一一对应
- [ ] 岗位绑定员工后刷新仍在
- [ ] 清空岗位后刷新仍在
- [ ] 模板切换不污染当前已绑定数据
- [ ] 团队配置选中员工能带到员工管理 / 技能配置 / 权限管理

**Run:**

```bash
CI=1 npx vitest run tests/agent-team-page.test.tsx --reporter=verbose --no-file-parallelism
```

---

### Task 4: 打通员工管理持久化

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Modify: `../../src/lib/forge-team-api.ts`
- Modify: `../../app/api/forge/team-registry/route.ts`
- Test: `../../tests/agent-team-page.test.tsx`
- Test: `../../tests/forge-api-routes.test.ts`

**Checklist:**

- [ ] 基础信息保存后刷新仍在
- [ ] 模型选项保存后刷新仍在
- [ ] 能力信息保存后刷新仍在
- [ ] 运行信息保存后刷新仍在
- [ ] 员工卡里的部门、权限等级、角色和详情一致

**Run:**

```bash
CI=1 npx vitest run tests/agent-team-page.test.tsx tests/forge-api-routes.test.ts --reporter=verbose --no-file-parallelism
```

---

### Task 5: 打通技能配置单一数据源

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Modify: `../../src/server/forge-real-skills.ts`
- Modify: `../../packages/db/src/forge-db.ts`
- Test: `../../tests/agent-team-page.test.tsx`
- Test: `../../tests/forge-real-skills.test.ts`

**Checklist:**

- [ ] 技能库读取真实技能源
- [ ] 技能库标签和技能详情分类体系对应
- [ ] 装备单技能后刷新仍在
- [ ] 装备技能包后刷新仍在
- [ ] 技能组合和自定义组包使用同一套当前技能包数据
- [ ] 修改技能包内容后，技能组合页立刻同步
- [ ] 技能详情修改分类后，列表筛选和 badge 同步

**Run:**

```bash
CI=1 npx vitest run tests/agent-team-page.test.tsx tests/forge-real-skills.test.ts --reporter=verbose --no-file-parallelism
```

---

### Task 6: 打通权限管理持久化

**Files:**
- Modify: `../../src/components/agent-team-page.tsx`
- Modify: `../../app/api/forge/team-registry/route.ts`
- Test: `../../tests/agent-team-page.test.tsx`
- Test: `../../tests/forge-api-routes.test.ts`

**Checklist:**

- [ ] 权限等级切换后刷新仍在
- [ ] 例外权限覆盖后刷新仍在
- [ ] 员工卡权限等级 badge 与权限管理详情一致
- [ ] 权限等级映射到真实权限清单稳定

**Run:**

```bash
CI=1 npx vitest run tests/agent-team-page.test.tsx tests/forge-api-routes.test.ts --reporter=verbose --no-file-parallelism
```

---

### Task 7: 全链回归与 demo 数据冻结

**Files:**
- Modify: `../../src/data/mock-data.ts`
- Modify: `../../docs/agents/*.md`
- Test: `../../tests/agent-team-page.test.tsx`
- Test: `../../tests/forge-api-routes.test.ts`
- Test: `../../tests/forge-real-skills.test.ts`

**Checklist:**

- [ ] 冻结演示团队部门结构
- [ ] 冻结演示员工名单
- [ ] 冻结每个员工默认权限等级
- [ ] 冻结每个员工默认技能和技能包
- [ ] 冻结团队配置中的项目节点绑定
- [ ] 完整走一遍：组织架构 -> 团队配置 -> 员工管理 -> 技能配置 -> 权限管理

**Run:**

```bash
CI=1 npx vitest run tests/agent-team-page.test.tsx tests/forge-api-routes.test.ts tests/forge-real-skills.test.ts --reporter=verbose --no-file-parallelism
curl -I http://127.0.0.1:3322/team
```

Expected:
- 所有 AI员工链路相关测试通过
- `/team` 返回 `HTTP 200`
- 手工刷新验证 5 条主链都不丢状态

---

## 最后执行顺序

如果现在只问“马上先干嘛”，顺序就是：

1. 先做 `Task 5 技能配置单一数据源`
2. 再做 `Task 2 组织架构持久化`
3. 再做 `Task 3 团队配置持久化`
4. 再做 `Task 6 权限管理持久化`
5. 最后做 `Task 7 demo 数据冻结`

原因：
- 技能配置最复杂，也最容易产生“看起来通了，其实两边不一致”的问题
- 组织架构和团队配置决定 demo 的骨架
- 权限管理最后补，风险最小

