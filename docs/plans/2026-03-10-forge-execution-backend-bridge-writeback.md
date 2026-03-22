# Forge Execution Backend Bridge Writeback

## Goal

把 execution backend bridge 的结果从“只存在返回值里”推进成“进入 Forge 正式运行时间线的证据”。

## Decision

- 不修改现有 `bridge` 的返回结构，继续让它专注于受控桥接。
- 新增 `writebackExecutionBackendBridgeRunForAI()`，复用 `bridgeExecutionBackendDispatchForAI()` 和 `upsertRunForAI()`。
- 新增 `POST /api/forge/execution-backends/bridge/writeback` 与 MCP `forge_execution_backend_bridge_writeback`。
- 先只落成 run evidence，不直接驱动新的 artifact 或 gate 逻辑。

## Shipped

1. bridge writeback 会把 `outputMode / outputChecks / evidenceStatus / evidenceLabel` 直接写进正式 run。
2. writeback 结果进入现有 `GET /api/forge/runs` 时间线，不需要新建第二套证据对象。
3. local-shell bridge 的执行结果现在已经能在 run timeline 中看到 `external-shell-bridge-executed` 和对应 evidence。

## Verification

- `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
- `node --check scripts/forge-mcp.mjs`
