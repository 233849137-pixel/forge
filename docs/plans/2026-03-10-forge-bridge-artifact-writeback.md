# Forge Bridge Artifact Writeback

**Date:** 2026-03-10

## Goal

让 `execution backend bridge writeback` 不只写回 run evidence，也能把 backend invocation 的 `expectedArtifacts` 落成正式 artifact，占位物开始进入 Forge 工件面。

## Scope

- `packages/ai/src/forge-ai.ts`
- `tests/forge-ai.test.ts`
- `tests/forge-api-routes.test.ts`

## Completed

- `writebackExecutionBackendBridgeRunForAI()` 在 `bridgeStatus === executed` 时会按 runtime adapter 默认产物写回 artifact
- review backend bridge 现在会自动落地 `review-report`
- bridge writeback 返回值和 route 返回值现在都会带 `artifacts`

## Verification

- `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
- `node --check scripts/forge-mcp.mjs`
