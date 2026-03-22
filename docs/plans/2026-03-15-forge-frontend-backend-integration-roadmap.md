# Forge Frontend-Backend Integration Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement each phase task-by-task.

**Goal:** 按业务线而不是按零散页面完成前后端对接，先打通项目工作台的最小 AI 交付闭环，再扩展到项目管理与团队配置。

**Architecture:** 读取统一走稳定页面合同和领域 GET API，写入逐步从 `app/actions.ts` 收口到 `app/api/forge/*`。页面层优先做“纵向闭环”：同一条业务线内把页面展示、命令执行、状态刷新、门禁摘要一起接通，而不是先把所有页面都浅浅接一遍。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library

---

## Current Baseline

### Stable page contract

- `src/lib/forge-page-contract.ts`
- `app/api/forge/pages/route.ts`

当前稳定页面合同已经覆盖：

- `home`
- `projects`
- `team`
- `artifacts`
- `assets`
- `execution`
- `governance`

### Already bridged to the formal page API

- `projects`
- `execution`
- `governance`
- `artifacts`
- `assets`

### Still SSR-only

- `home`
- `team`

### Current write-path split

`app/actions.ts` 仍承担部分写入动作：

- `createProjectAction`
- `setActiveProjectAction`
- `generatePrdDraftAction`
- `executeCommandAction`
- `updateAgentProfileAction`
- `updateProjectWorkflowStateAction`

与此同时，`app/api/forge/*` 已经有较完整的领域 API：

- `projects`
- `commands`
- `tasks`
- `runs`
- `workflow`
- `team-registry`
- `readiness`
- `remediations`
- `capabilities`
- `runners`

这意味着下一阶段重点不是“继续铺读接口”，而是“统一写接口并按业务线完成闭环”。

---

## Recommended Delivery Order

### Phase 1: 项目工作台 AI 执行线

**Priority:** Highest

**Why first:** 这是产品最核心的交付链，最能验证前后端对接是否真的打通。比起先做首页或团队配置，这条线能更早形成“下命令 -> 跑执行 -> 看状态 -> 看门禁”的真实闭环。

**Pages in scope:**

- `/projects`
- `/execution`
- `/governance`
- `/artifacts`

**Read APIs in scope:**

- `GET /api/forge/pages?view=projects`
- `GET /api/forge/pages?view=execution`
- `GET /api/forge/pages?view=governance`
- `GET /api/forge/pages?view=artifacts`
- `GET /api/forge/tasks`
- `GET /api/forge/runs`
- `GET /api/forge/workflow`
- `GET /api/forge/readiness`
- `GET /api/forge/remediations`

**Write APIs in scope:**

- `POST /api/forge/commands`
- `POST /api/forge/tasks/retry`
- `POST /api/forge/workflow`
- `POST /api/forge/runs`

**Minimum loop to ship first:**

1. 从项目工作台触发一个真实命令执行
2. 命令执行后刷新 `projects` 页面合同
3. 同时刷新 `execution` 的运行状态
4. 同时刷新 `governance` 的门禁/接棒摘要
5. 必要时在 `artifacts` 展示最新工件变化

**Do not try to ship all AI abilities at once.**

第一批只接下面 4 件事：

- 执行命令
- 查看任务状态
- 查看运行时间线
- 查看工作流/门禁摘要

整改回放、Runner 回放、复杂审批动作都放到第二批。

### Phase 2: 项目管理线

**Priority:** High

**Pages in scope:**

- `/`
- `/projects`

**Read APIs in scope:**

- `GET /api/forge/pages?view=home`
- `GET /api/forge/projects`
- `GET /api/forge/templates`
- `GET /api/forge/prompts`

**Write APIs in scope:**

- `POST /api/forge/projects`
- `POST /api/forge/prd`
- active project switch API or dedicated route replacement for server action

**Business goal:**

- 新建项目
- 切换活跃项目
- 生成 PRD 草案
- 首页和项目页看到最新项目池状态

这一阶段要开始减少 `app/actions.ts` 对项目入口流程的依赖。

### Phase 3: Agent / Team 线

**Priority:** Medium

**Pages in scope:**

- `/team`
- `/execution`

**Read APIs in scope:**

- `GET /api/forge/pages?view=team`
- `GET /api/forge/team-registry`
- `GET /api/forge/capabilities`
- `GET /api/forge/runners`

**Write APIs in scope:**

- `POST /api/forge/team-registry`
- `POST /api/forge/runners`
- `POST /api/forge/runners/probe`

**Business goal:**

- 修改 AI 员工配置
- 查看技能/能力/Runner 注册状态
- 让团队配置和执行中枢之间形成真实联动

### Phase 4: 收口与替换

**Priority:** After the three business lines are stable

**Goals:**

- 统一错误格式和前端 API client
- 让页面写入都走领域 API，而不是混用 server actions
- 只保留必要的 server action 封装，不再把它作为主写入通道
- 给三条业务线补齐契约测试和最小交互回归

---

## Phase 1 Detailed Slice

第一刀建议只做下面这条最小链：

### Slice 1: 项目工作台命令执行闭环

**Entry page:** `/projects`

**User story:**

用户在项目工作台当前节点输入指令后，前端调用正式命令 API，后端记录命令执行，随后前端刷新项目工作台、执行中枢和命令中心相关摘要。

**Implementation order:**

1. 新增项目工作台命令执行 client helper
2. 为 `POST /api/forge/commands` 增加前端调用测试
3. 把 `ForgeProjectsPage` 当前本地假消息生成逻辑改成“真实请求 + 成功后刷新 page contract”
4. 在 bridge 层或页面层触发 `projects` 合同刷新
5. 同步触发 `execution` 和 `governance` 刷新入口
6. 保留本地 UI 状态，不要因为刷新重置当前项目、节点、标签页

**Success criteria:**

- 在 `/projects` 里发送一次工作台指令会触发真实 API 请求
- 请求成功后，页面看到新的命令/任务/状态变化
- `/execution` 与 `/governance` 刷新后能看到对应摘要变化
- 现有本地交互状态不被刷新打断

---

## What Not To Do

- 不要按“把所有页面都先接一层 bridge”作为主目标
- 不要先把所有 AI 功能一次性接完
- 不要继续扩大 `app/actions.ts` 的职责
- 不要让 `/projects` 继续长期保留纯前端伪生成回复作为主路径

---

## Immediate Next Step

下一阶段直接执行：

### Phase 1 / Slice 1

先把 `/projects` 的发送动作从本地伪生成切到 `POST /api/forge/commands`，并设计刷新 `projects / execution / governance` 的最小同步机制。
