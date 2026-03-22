# Forge Selector Backend Guidance

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把执行后端提示从 AI 聚合层继续前推到 selector 级任务队列，让任务中枢和最近命令执行的后续任务也能直接解释默认回放后端。

**Architecture:** 保持现有 snapshot-only selector 边界，不从 AI 层反向注入 env。直接复用运行证据里的 `model-execution` summary，在 core selector 内解析 `后端 ...` 片段，并把它追加到 `remediationAction`。这样只有实际带后端证据的链路会出现提示，`gate.run` 这类尚未声明 coverage 的链路不会被误绑到 OpenClaw。

**Tech Stack:** TypeScript, Vitest, Forge core selectors

---

## Scope

- 只修改 `packages/core/src/selectors.ts` 的整改动作文案生成
- 只新增 selector 测试覆盖 review remediation 链路
- 只补接手文档与 README 的能力记录

## Implemented

1. 在 `tests/forge-selectors.test.ts` 为 review remediation 链路增加红测，要求以下入口都补上 `执行后端：OpenClaw`
   - `getRemediationTaskQueue(...)`
   - `getTaskDispatchQueue(...)`
   - `getRecentCommandExecutions(...).followUpTasks`
2. 在 `packages/core/src/selectors.ts` 新增运行证据解析 helper，从 `model-execution` detail 中提取 `后端 ...`
3. `getTaskRemediationAction(...)` 现在会在 `runtimeModelExecutionDetail` 已显式带后端时追加 `执行后端：...`
4. README、execution backend 合同说明、takeover 文档已同步

## Verified

- `npm test -- tests/forge-selectors.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，执行后端提示不再只存在于：

- `runtimeSummary`
- `remediations.nextAction`
- `retryTask / retryRemediation`

而是已经下沉到任务级 selector 输出，控制面拿任务队列就能直接回答：

`这条整改默认会落到哪个 execution backend 上。`
