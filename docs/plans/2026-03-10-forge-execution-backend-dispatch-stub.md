# Forge Execution Backend Dispatch Stub

**Goal:** 在 `prepare` 之上补一个统一的 `dispatch` 入口，让 Forge 不只是“能准备 adapter request”，而是已经拥有单一的 execution backend 发起面。

**Architecture:** 继续复用 `prepareExecutionBackendRequestForAI()` 和 `runtimeExecutionBackendInvocation`，不新增持久化状态，不做真实外部调用。AI 层新增 `dispatchExecutionBackendRequestForAI()`，把 prepare 结果包装成 stub 模式的 dispatch receipt；HTTP 层新增 `POST /api/forge/execution-backends/dispatch`；MCP 新增 `forge_execution_backend_dispatch`。这样 OpenClaw 一类后端后续只需要替换 dispatch 入口后的执行逻辑，而不是重新定义调用入口。

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`
- Add: `app/api/forge/execution-backends/dispatch/route.ts`
- Modify: `scripts/forge-mcp.mjs`
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-api-routes.test.ts`
- Modify: `README.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`

## Completed

1. 新增 `dispatchExecutionBackendRequestForAI()`，基于 prepare 结果返回统一 dispatch receipt。
2. dispatch receipt 当前为 `mode: stub / status: queued`，会显式返回 `sourceKind / sourceId / backend / provider / invocation / dispatchedAt / summary`。
3. 新增 `POST /api/forge/execution-backends/dispatch`，HTTP 调用方现在有了正式的统一发起入口。
4. 新增 MCP 工具 `forge_execution_backend_dispatch`，外部 Agent 可以直接走同一条 dispatch surface。
5. AI 与 API 测试已覆盖 review remediation 场景，确认 OpenClaw reviewer backend 能返回统一的 dispatch receipt。

## Verification

- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
- `node --check scripts/forge-mcp.mjs`

## Result

这批之后，Forge 在 execution backend 这条主线上已经不止有 prepare surface，也已经有了统一 dispatch surface。虽然当前仍是 stub receipt，但控制权和调用边界已经收口到单一入口，后续接真实 OpenClaw / 第三方后端时，只需要在 dispatch 入口后面替换执行器。
