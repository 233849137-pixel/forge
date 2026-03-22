# Forge Top-Level Approval Handoff

**Date:** 2026-03-10

## Goal

把 `approvalHandoff` 从嵌套的 `formalArtifactResponsibility` 前推到顶层治理聚合与 `releaseGate`，避免外部 Agent、控制面入口和负责人口径继续自己拆嵌套责任摘要。

## Completed

- `getReleaseGateSummary(...)` 现在直接返回 `approvalHandoff`
- `buildGovernanceResponsibilitySummary(...)` 现在把 `approvalHandoff` 作为顶层治理事实源返回
- `/api/forge/control-plane`
- `/api/forge/readiness`
- `/api/forge/remediations`
- `/api/forge/commands`

以上入口现在都会直接返回顶层 `approvalHandoff`

## Verification

- `npm test -- --run tests/forge-selectors.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
