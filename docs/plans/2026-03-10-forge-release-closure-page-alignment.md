# Forge Release Closure Page Alignment

## Context

`releaseClosure` 已经进入 core selector、`releaseGate`、`control-plane / readiness / remediations / commands` 顶层，也已经在首页和治理页第一层显示。但项目页和工件页仍然只展示它拆开的 `approvalHandoff / archiveProvenance / pendingApproval` 片段，负责人需要自行拼“当前发布链到底收口到哪一步”。

## Goal

把项目页和工件页也收拢到同一份 `releaseClosure` 事实上：

- 项目页 `交付就绪度` 直接显示：
  - `最终放行摘要`
  - `放行细节`
  - `放行动作`
- 工件页 `正式工件责任` 直接显示同一组字段

这样首页、项目页、工件页、治理页四个负责人入口对放行末端共享同一层事实源，而不再各自拼审批链碎片。

## Implementation

- 在 [ForgeProjectsPage](../../src/components/forge-projects-page.tsx) 中新增 `releaseClosureSummary / detail / nextAction` props，并在 `交付就绪度` 区块直接展示。
- 项目页路由已经透传顶层 `controlPlane.releaseClosure`，无需再改 AI 聚合层。
- 在 [ForgeArtifactsPage](../../src/components/forge-artifacts-page.tsx) 中直接复用 `releaseGateSummary.releaseClosure`，不新增新 props。

## Tests

- [forge-projects-page.test.tsx](../../tests/forge-projects-page.test.tsx)
  - 新增项目页 `releaseClosure` 可见性断言
- [forge-os-pages.test.tsx](../../tests/forge-os-pages.test.tsx)
  - 新增工件页 `releaseClosure` 可见性断言
  - 因为同一责任文案现在会在 `releaseClosure` 与 `approvalHandoff` 两处同时出现，更新原有断言为 `getAllByText(...)`

## Verification

- `npm test -- --run tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
