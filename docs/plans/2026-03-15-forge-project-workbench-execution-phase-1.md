# Forge Project Workbench Execution Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把项目工作台的发送动作从本地伪生成切到真实命令 API，并在成功后触发 `projects / execution / governance / artifacts` 的合同刷新入口。

**Architecture:** 新增前端命令执行 client helper，`ForgeProjectsPage` 通过注入式执行器发起真实 `POST /api/forge/commands` 请求。项目工作台先保留本地标签页状态，但发送成功后会写入“命令执行回执”到当前会话和结果面板，同时通过页面刷新事件通知对应 bridge 更新合同数据。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: 为命令执行 helper 与工作台发送动作建立 red test

**Files:**
- Create: `tests/forge-command-api.test.ts`
- Modify: `tests/forge-projects-page.test.tsx`

**Step 1: Write the failing test**

新增断言:
- `executeForgeCommand()` 会向 `/api/forge/commands` 发送 `mode: "execute"` 的 POST 请求
- `ForgeProjectsPage` 在传入执行器时，点击发送会调用真实执行器
- 成功后会写入“你”的输入和 AI 的执行回执
- 成功后会触发页面刷新通知

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-command-api.test.ts tests/forge-projects-page.test.tsx`

Expected: FAIL because helper、页面执行器接线和刷新事件都还不存在

### Task 2: 实现命令执行 helper、页面刷新事件与工作台接线

**Files:**
- Create: `src/lib/forge-command-api.ts`
- Create: `src/lib/forge-page-refresh-events.ts`
- Modify: `src/components/forge-projects-page.tsx`
- Modify: `src/components/forge-projects-page-bridge.tsx`

**Step 1: Write minimal implementation**

- `executeForgeCommand()` 封装 `/api/forge/commands` POST 和错误处理
- 增加页面刷新事件 helper，支持广播稳定页面视图刷新
- `ForgeProjectsPage` 新增可注入的 `executeWorkbenchCommand`
- 发送成功后:
  - 调用真实命令 API
  - 把用户输入和执行回执写入当前会话
  - 更新当前结果面板为执行回执摘要
  - 清空输入框
  - 广播 `projects / execution / governance / artifacts` 刷新
- 对没有可映射命令的节点给出明确提示，不再伪造成功执行

**Step 2: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-command-api.test.ts tests/forge-projects-page.test.tsx`

Expected: PASS

### Task 3: 让相关 bridge 响应页面刷新事件

**Files:**
- Modify: `src/components/forge-projects-page-bridge.tsx`
- Modify: `src/components/forge-execution-page-bridge.tsx`
- Modify: `src/components/forge-governance-page-bridge.tsx`
- Modify: `src/components/forge-artifacts-page-bridge.tsx`

**Step 1: Write minimal implementation**

- bridge 继续保留挂载后的一次刷新
- 额外监听页面刷新事件
- 当事件包含自己的 view 时触发合同刷新

**Step 2: Run focused tests to verify they pass**

Run: `npm test -- tests/forge-command-api.test.ts tests/forge-projects-page.test.tsx tests/forge-projects-page-bridge.test.tsx tests/forge-execution-page-bridge.test.tsx tests/forge-governance-page-bridge.test.tsx tests/forge-artifacts-page-bridge.test.tsx`

Expected: PASS

### Task 4: 做一轮业务线回归验证

**Files:**
- Verify only

**Step 1: Run verification**

Run: `npm test -- tests/forge-command-api.test.ts tests/forge-projects-page.test.tsx tests/forge-projects-page-bridge.test.tsx tests/forge-execution-page-bridge.test.tsx tests/forge-governance-page-bridge.test.tsx tests/forge-artifacts-page-bridge.test.tsx tests/forge-page-api.test.ts tests/forge-api-routes.test.ts tests/forge-os-pages.test.tsx`

Expected: PASS with 0 failures
