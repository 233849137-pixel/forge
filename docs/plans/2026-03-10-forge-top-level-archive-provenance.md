# 2026-03-10 Forge Top-Level Archive Provenance

## Context

上一批已经把 archive provenance 修到了 `approvalTrace` 和工件页 `证据时间线`，但负责人和外部 Agent 在读取 `control-plane / readiness` 时，仍然需要自己扫描 `releaseGate.approvalTrace` 才能判断：

- 哪次 `archive.capture` 写回了 `release-audit`
- 这次 archive 执行最初是由哪次 `release.prepare` 推进出来的

这会让控制面顶层继续承担字符串解析工作。

## Implementation

- `packages/core/src/selectors.ts`
  - 新增 `getArchiveProvenanceSummary()`
  - 统一返回 `release-audit / knowledge-card` 的归档 provenance
  - 同时包含两段链路：
    - `archiveCommand* / archiveRun* / archiveRuntime*`
    - `handoffCommand* / handoffRun* / handoffRuntime*`
- `getReleaseGateSummary()` 现在显式带 `archiveProvenance`
- `packages/ai/src/forge-ai.ts`
  - `buildGovernanceResponsibilitySummary()` 现在统一透传 `archiveProvenance`
  - `buildControlPlaneSnapshot()` 和 `getDeliveryReadinessForAI()` 现在把 `archiveProvenance` 提升到顶层

## Verification

- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
