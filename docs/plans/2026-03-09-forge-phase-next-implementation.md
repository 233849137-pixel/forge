# Forge Phase Next Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 Forge 从“控制面已成型的交付系统”推进到“TaskPack 驱动、Runner 真执行、资产可装配”的下一阶段。

**Architecture:** 先收紧执行主链，把 `TaskPack` 提升为 `execution.start` 的唯一显式输入，并贯通到命令执行、运行记录、整改回放和控制面摘要。随后继续推进 Runtime Adapter 到真实外部执行器，再补组件注册表与装配入口，避免产品继续停留在“流程编排感”。

**Tech Stack:** Electron、Next.js App Router、SQLite、MCP、Runner CLI、Runtime Adapter、Control Plane Snapshot

---

## Phase A：TaskPack 作为唯一执行输入

### Task 1：补 TaskPack 输入契约

**Files:**
- Modify: `../../packages/core/src/types.ts`
- Modify: `../../packages/db/src/forge-db.ts`
- Modify: `../../packages/ai/src/forge-ai.ts`
- Test: `../../tests/forge-ai.test.ts`
- Test: `../../tests/forge-api-routes.test.ts`

**Intent**
- `execution.start`、`run`、`command execution` 要显式记录 `taskPackId`
- `snapshot / readiness / command center` 要能回答“当前执行基于哪个 TaskPack”

### Task 2：把整改回放绑定到来源 TaskPack

**Files:**
- Modify: `../../packages/core/src/selectors.ts`
- Modify: `../../packages/ai/src/forge-ai.ts`
- Modify: `../../scripts/lib/forge-runner.mjs`
- Test: `../../tests/forge-runner.test.ts`

**Intent**
- `task retry / remediation retry / runner:forge --task-id` 都要显式回放到来源 `taskPackId`
- 避免再次退回“latest task-pack” 的隐式选择

**Status**
- 已完成：`tasks / readiness / remediations / commands` 统一返回 `taskPackId / taskPackLabel`
- 已完成：`retryTask / retryRemediation / runner:forge --task-id/--remediation-id` 显式透传来源 `taskPackId`
- 已完成：seed / fixture / runner tests / api tests 已改为验证 `--taskpack-id` 回放链路
- 已完成：`Run` 已正式持久化 `taskPackId / linkedComponentIds`
- 已完成：`getRunTimelineForAI / GET /api/forge/runs` 会显式返回 `taskPackLabel / linkedComponentLabels`
- 已完成：`execution.start` 会在 `TaskPack` 仍有待装配组件且当前还没有已装配组件时直接阻断，并自动生成 `task-<project>-component-assembly` 回流任务

## Phase B：Runtime Plane 真执行

### Task 3：先做 QA 链的真实 Playwright 执行入口

**Files:**
- Modify: `../../packages/ai/src/runtime-adapters.ts`
- Modify: `../../scripts/lib/forge-qa-runner.mjs`
- Modify: `../../scripts/lib/forge-shell-executor.mjs`
- Test: `../../tests/forge-qa-runner.test.ts`

**Intent**
- 让 `gate.run` 优先尝试真实本地 Playwright 能力，再回退到合同模式

**Status**
- 已完成：`forge-qa-runner.mjs` 支持 `--execute-if-ready`
- 已完成：当工作区存在 Playwright 配置或 `test:e2e` 脚本时，QA Runner 会优先执行真实本地门禁
- 已完成：缺少可执行配置时维持 `playwright-ready` 就绪态，不会把主链直接打断

### Task 4：继续推进 Engineer / Reviewer 外部执行适配

**Files:**
- Modify: `../../scripts/lib/forge-engineer-runner.mjs`
- Modify: `../../scripts/lib/forge-review-runner.mjs`
- Modify: `../../packages/ai/src/runtime-adapters.ts`

**Intent**
- 明确区分 `contract-mode` 与 `tool-ready mode`
- 把运行遥测继续结构化回写到控制面

**Status**
- 已完成：`forge-engineer-runner.mjs` 支持 `--execute-if-ready`
- 已完成：`forge-review-runner.mjs` 支持 `--execute-if-ready`
- 已完成：Runtime Adapter 已为 Engineer / Reviewer 执行计划显式带上 `--execute-if-ready`
- 已完成：Reviewer / QA Runtime Plan 现在也显式带 `--taskpack-id / --component-ids`
- 已完成：`forge-review-runner.mjs / forge-qa-runner.mjs` 现在会把 `TaskPack / 组件` 写回检查结果和执行摘要
- 已完成：Runtime Adapter 的 Reviewer / QA contract summary 现在也显式带 `TaskPack / 关联组件`
- 当前状态：三条主 Runner 已统一为“满足条件时真执行，否则安全回退”

## Phase C：资产装配底座

### Task 5：组件注册表与装配入口

**Files:**
- Modify: `../../packages/core/src/types.ts`
- Modify: `../../packages/db/src/forge-db.ts`
- Modify: `../../packages/ai/src/forge-ai.ts`
- Add: `../../app/api/forge/components/route.ts`

**Intent**
- 先把登录、支付、上传下载这类通用模块变成正式注册表对象
- 先做“可查询、可推荐”，再做自动拼装

**Status**
- 已完成：组件注册表已接入 SQLite seed / sync / snapshot，`ForgeDashboardSnapshot` 不再丢失 `components`
- 已完成：AI core 已新增 `getComponentRegistryForAI`，支持 `query / category / sector / sourceType` 过滤
- 已完成：已新增 `GET /api/forge/components`，资产页同步补出“组件装配入口 / 组件注册表”
- 已完成：组件入口已支持 `projectId / taskPackId`，会按项目上下文和当前 TaskPack 输出装配建议与推荐理由
- 已完成：`GET /api/forge/capabilities` 已显式返回 `components / totalComponents`，能力注册表与资产层口径一致
- 已完成：已新增 `GET/POST /api/forge/components/assemble` 与 MCP `forge_component_assembly_plan / forge_component_assembly_apply`
- 已完成：组件装配写回会生成 `projectAssetLinks(targetType=component)`，资产页和控制面都能读取已装配组件
- 已完成：`taskpack.generate` 现在会自动挂接首批推荐组件，不再完全依赖手动装配
- 已完成：`taskpack.generate` 的命令执行记录现在会显式带 `followUpTaskIds=task-<project>-component-assembly`，并在摘要中写出待装配组件
- 已完成：组件装配已经收成正式标准命令 `component.assemble`，命令中心和 `executeCommand` 主入口都可以直接执行
- 已完成：`component-assembly` 任务的回放优先指向 `command-component-assemble`，不再错误退回 `taskpack.generate / execution.start`
- 已完成：`retryTask / retryRemediation` 在组件装配任务上会优先透传 `pendingComponentIds`，确保整改回放真正装配待补组件
- 已完成：Runtime Adapter 已新增 `component.assemble -> architect-runner -> forge-architect-runner.mjs`
- 已完成：`forge-architect-runner.mjs` 已接入本地 shell 计划，可走 `runner:forge --execute-plan`
- 已完成：Engineer Runtime Plan 已显式注入 `--component-ids`，研发执行摘要与 run 标题会带入已装配组件
- 已完成：如果当前 TaskPack 仍无任何已装配组件，`execution.start` 会被视为前置条件不足，必须先完成组件装配再继续执行
- 已完成：`control-plane` 聚合块已带 `componentRegistry + assemblySuggestions`，外部 Agent 不必再额外拼一跳组件推荐
- 已完成：治理页 `最近命令执行` 已改为直接消费统一 recent execution selector，`相关运行 / TaskPack / 待装配组件` 不再由页面手工拼装
- 已完成：`forge-ai / forge-api-routes / forge-os-pages / build / build:electron` 已验证通过

## 验证基线

- `npm test -- --run tests/forge-ai.test.ts tests/forge-api-routes.test.ts tests/forge-runner.test.ts`
- `npm run build`
- `npm run build:electron`
- `node --check ../../scripts/forge-mcp.mjs`
- `node --check ../../scripts/forge-runner.mjs`
