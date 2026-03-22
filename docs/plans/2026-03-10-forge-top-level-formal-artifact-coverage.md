# 2026-03-10 Forge Top-Level Formal Artifact Coverage

## Goal

把首页与项目页已经在使用的 `正式工件沉淀` 从页面 helper 升格成控制面事实源，让 `control-plane / readiness / remediations / commands` 直接返回同一份正式工件沉淀摘要。

## Changes

- 在 `../../packages/core/src/types.ts` 中新增 `ForgeFormalArtifactCoverageSummary`，并在 `../../packages/core/src/selectors.ts` 中新增 `getFormalArtifactCoverageSummary(...)`。
- `../../src/components/forge-os-shared.tsx` 的 `getFormalArtifactCoverageSummary(...)` 现在直接复用 core selector，不再单独维护一份页面内逻辑。
- `../../packages/ai/src/forge-ai.ts` 的 `buildGovernanceResponsibilitySummary(...)` 现在统一挂载 `formalArtifactCoverage`，并透传到：
  - `buildControlPlaneSnapshot(...)`
  - `getDeliveryReadinessForAI(...)`
  - `getRemediationsForAI(...)`
  - `getCommandCenterForAI(...)`
- 已同步更新 `../../tests/forge-ai.test.ts`、`../../tests/forge-api-routes.test.ts`、`../../README.md`、`../../docs/plans/2026-03-09-forge-takeover-next-phase.md`。

## Verification

- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test -- tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
