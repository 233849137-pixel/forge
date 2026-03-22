# Forge Top-Level Handoff Aggregates

**Date:** 2026-03-10

## Goal

把已经进入 `controlPlane` 的结构化治理责任链继续前推到 `commands / readiness / remediations` 顶层返回，减少外部 Agent 对嵌套聚合块的依赖。

## Completed

- `getDeliveryReadinessForAI()` 顶层现在直接返回：
  - `currentHandoff`
  - `pendingApprovals`
  - `escalationItems`
- `getRemediationsForAI()` 顶层现在直接返回同一份治理责任链。
- `getCommandCenterForAI()` 顶层现在也直接返回同一份治理责任链。
- 三个入口全部复用同一份 `buildGovernanceResponsibilitySummary(...)`，没有新增第二套 handoff 组装逻辑。

## Verification

- `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Next

- 继续把这条结构化 responsibility chain 推进到更真实的 adapter executor 和 bridge 工件回写联动上。
- 目标是让外部 backend 的桥接产出不只影响 `run evidence` 和 `release gate`，还进一步影响正式 artifact 与 handoff 决策。
