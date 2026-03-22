# Forge Backend Invocation Payloads

**Goal:** 把 `runtimeExecutionBackendCommandPreview` 从单一字符串升级成结构化 `runtimeExecutionBackendInvocation`，让 Forge 后续接真实 execution backend adapter 时，不需要再从 preview 文案里反解析调用上下文。

**Architecture:** 继续复用 execution backend registry、runtime adapter 描述层和现有 preview helper，不新增持久化状态。AI 层新增共享 `buildExecutionBackendInvocation(...)`，把 `backendId / backend / provider / runnerProfile / commandType / expectedArtifacts / artifactType / taskPackId / linkedComponentIds / workspacePath / commandPreview` 收成同一份 payload。现有 `runtimeExecutionBackendCommandPreview` 保留兼容，并直接退化为 `runtimeExecutionBackendInvocation.commandPreview`。

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-api-routes.test.ts`
- Modify: `README.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`

## Completed

1. 新增共享 helper `buildExecutionBackendInvocation(...)`，统一生成结构化 backend invocation payload。
2. `buildExecutionBackendCommandPreview(...)` 现在退化为读取 `runtimeExecutionBackendInvocation.commandPreview`，preview 和结构化调用上下文不再双轨维护。
3. `GET /api/forge/tasks / remediations / control-plane` 与 `retryTaskForAI() / retryRemediationForAI()` 现在都会显式返回 `runtimeExecutionBackendInvocation`。
4. `control-plane.remediationQueue` 与 `control-plane.recentExecutions.followUpTasks` 现在也会共享这份 payload，控制面快照已具备 adapter-ready 的回放上下文。
5. AI 与 API 测试已覆盖 review remediation 场景，确认 OpenClaw reviewer backend 会返回：
   - `backendId: reviewer-execution-backend`
   - `backend: OpenClaw`
   - `provider: Claude Code Review`
   - `commandType: review.run`
   - `artifactType: patch`
   - `commandPreview: openclaw run-review ...`

## Verification

- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，Forge 针对外部编排后端的回放上下文不再只是“可读字符串”。控制面、整改入口和统一回放结果已经开始返回 adapter-ready 的结构化 invocation payload，后续把 OpenClaw 真正接成 execution backend 时，可以直接消费这份对象而不是重新拼命令。
