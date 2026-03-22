# Forge Formal Artifact Responsibility Summary

## Context

首页、项目页、治理页已经把 `formalArtifactCoverage / formalArtifactGap / currentHandoff / approvalTrace` 收得比较紧，但工件页第一屏仍然要求负责人自己在：

- `正式来源链`
- `归档接棒`
- `待人工确认`
- `正式工件缺口`

之间手动拼接“现在沉淀到哪、还差什么、谁来补、卡在谁手里”。

这说明工件页还缺一个更靠近交付责任链的正式事实源。

## Goal

新增一份最小的 `formalArtifactResponsibility` selector，并让工件页第一屏直接消费它。

它只回答四件事：

1. 已经沉淀出哪些正式工件
2. 还缺哪些正式工件
3. 当前谁该补齐
4. 当前正式工件链上还有哪些待人工确认

## Implementation

- 在 `../../packages/core/src/types.ts` 中新增：
  - `ForgeFormalArtifactProvenanceItem`
  - `ForgeFormalArtifactResponsibilityItem`
  - `ForgeFormalArtifactResponsibilitySummary`
- 在 `../../packages/core/src/selectors.ts` 中新增：
  - `getFormalArtifactProvenanceSummary(...)`
  - `getFormalArtifactResponsibilitySummary(...)`
- `getFormalArtifactResponsibilitySummary(...)` 直接复用：
  - `getFormalArtifactCoverageSummary(...)`
  - `getFormalArtifactGapSummary(...)`
  - `getApprovalTrace(...)`
  - `getEvidenceTimeline(...)`
- `pendingApprovals` 的优先级按正式工件顺序固定为：
  - `release-brief`
  - `review-decision`
  - `release-audit`
  - `knowledge-card`
  避免 archive 场景先把负责人注意力拉到归档审计，而不是放行确认。
- 在 `../../src/components/forge-os-shared.tsx` 中把旧的页面 helper 改成直接复用 core selector。
- 在 `../../src/components/forge-artifacts-page.tsx` 中新增第一屏面板 `正式工件责任`：
  - `正式工件沉淀`
  - `正式工件缺口`
  - `补齐责任`
  - `待人工确认`
- 在 `../../packages/ai/src/forge-ai.ts` 中把 `formalArtifactResponsibility` 前推到：
  - `control-plane`
  - `readiness`
  - `remediations`
  - `commands`

## Verification

- `npm test -- tests/forge-selectors.test.ts`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`

