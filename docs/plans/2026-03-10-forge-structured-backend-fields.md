# Forge Structured Backend Fields

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把默认执行后端从整改文案升级成结构化字段，让 selector、AI 和 API 都能稳定返回 `runtimeExecutionBackendLabel`。

**Architecture:** 保持现有 snapshot-first 架构，不引入新表或新持久化状态。直接复用运行证据里的 `model-execution` summary，从 `后端 ...` 片段提取结构化后端标签，并把它沿 `selector -> ai -> api` 透传。这样只有真实运行证据已经声明后端的链路才会得到该字段。

**Tech Stack:** TypeScript, Vitest, Forge core selectors, Forge AI routes

---

## Scope

- 修改 `packages/core/src/selectors.ts`
- 修改 `packages/ai/src/forge-ai.ts`
- 更新 selector / AI / API 测试
- 回写 README 与 takeover 文档

## Implemented

1. `selectors.ts` 现在会从 `model-execution` detail 中提取 `runtimeExecutionBackendLabel`
2. 该字段已进入：
   - `getTaskDispatchQueue(...)`
   - `getBlockingTaskChain(...)`
   - `getRemediationTaskQueue(...)`
   - `getCommandExecutionRuntimeContext(...)`
   - `getRecentCommandExecutions(...).followUpTasks`
3. `forge-ai.ts` 已把该字段透传到：
   - `getRemediationsForAI()`
   - `retryTaskForAI()`
   - `retryRemediationForAI()`
   - `getTasksForAI()`
4. selector / AI / API 测试已覆盖 review remediation 场景，确认字段值为 `OpenClaw`

## Verified

- `npm test -- tests/forge-selectors.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，调用方有两条稳定路径：

- 读 `runtimeExecutionBackendLabel`
- 读人类可读文案 `执行后端：...`

前者适合页面和自动化决策，后者适合负责人阅读和回放解释。
