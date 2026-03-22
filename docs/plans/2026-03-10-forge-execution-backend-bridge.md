# Forge Execution Backend Bridge

## Goal

在既有 `prepare -> dispatch -> execute` 三段契约之外，再补一个显式的 `bridge` 入口，让 Forge 可以在不改动持久化和主命令链的前提下，受控地把 shell execution plan 交给外部执行桥。

## Decision

- 不把现有 `execute` 入口改成有副作用的黑箱，保持它继续只负责返回标准化 shell execution plan。
- 新增 `bridgeExecutionBackendDispatchForAI()`，默认 `strategy: "stub"`，只返回 bridge receipt。
- 仅当显式传入 `strategy: "local-shell"` 时，才通过本地 shell executor 实际执行 plan。
- 先不把 bridge 结果回写 runs / artifacts / evidence；这批只把 Forge 推进到“有受控执行桥”。

## Shipped

1. 新增 AI core `bridgeExecutionBackendDispatchForAI()`，复用既有 `executeExecutionBackendDispatchForAI()` 生成的 execution plan。
2. 新增 `POST /api/forge/execution-backends/bridge`，把 `remediationId / taskId / strategy` 收成统一 HTTP surface。
3. 新增 MCP 工具 `forge_execution_backend_bridge`，让外部 Agent 可直接走这条受控桥。
4. `strategy: "stub"` 返回 `mode: external-shell-bridge-stub`、`bridgeStatus: "stub"`、`executionResult: null`。
5. `strategy: "local-shell"` 返回 `mode: external-shell-bridge`、`bridgeStatus: "executed" | "failed"` 与统一 `executionResult`。
6. bridge 返回现在也会显式带 `outputMode / outputChecks / evidenceStatus / evidenceLabel`，直接对齐现有 Runner / Run 证据结构。

## Verification

- `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
- `node --check scripts/forge-mcp.mjs`
