# Forge Execution Backend Prepare Route

**Goal:** 给外部 execution backend 一个单一准备入口，让 Forge 不只是“在各个 API 里顺带返回 invocation 字段”，而是能按 `taskId / remediationId` 明确产出可消费的 adapter request。

**Architecture:** 复用上一批已经打通的 `runtimeExecutionBackendInvocation`，不新增持久化状态。AI 层新增 `prepareExecutionBackendRequestForAI()` 作为单一准备 helper，按 `remediationId` 或 `taskId` 查找当前整改链并返回统一 payload。HTTP 层新增 `POST /api/forge/execution-backends/prepare`，MCP 新增 `forge_execution_backend_prepare`，这样 OpenClaw 一类后端后续只需要调用一个稳定入口。

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`
- Add: `app/api/forge/execution-backends/prepare/route.ts`
- Modify: `scripts/forge-mcp.mjs`
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-api-routes.test.ts`
- Modify: `README.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`

## Completed

1. 新增 `prepareExecutionBackendRequestForAI()`，支持按 `remediationId` 或 `taskId` 返回标准 adapter request。
2. 当目标整改链没有可用 backend invocation 时，helper 会显式返回 `FORGE_BACKEND_NOT_READY`，避免调用方误把本地 fallback 当成外部后端已就绪。
3. 新增 `POST /api/forge/execution-backends/prepare`，HTTP 调用方现在有了正式 prepare 入口。
4. 新增 MCP 工具 `forge_execution_backend_prepare`，外部 Agent 不需要自己拼 `/api/forge/...` 路径。
5. AI 与 API 测试已覆盖 review remediation 场景，确认 prepare 入口会返回 OpenClaw reviewer backend 的 adapter request。

## Verification

- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，Forge 在“execution backend adapter”这条主线上已经有了真正的单一准备入口。后续无论是接 OpenClaw，还是接别的外部编排后端，都可以直接消费这条 prepare route 和对应 MCP 工具，而不必从多个控制面出口里拼上下文。
