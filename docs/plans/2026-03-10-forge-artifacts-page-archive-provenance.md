# Forge Artifacts Page Archive Provenance

**Date:** 2026-03-10

## Goal

把 `archiveProvenance` 从 `controlPlane / readiness / command center` 再前推到工件页第一屏，让负责人在工件工作台里直接看到当前 `release-audit / knowledge-card` 是由哪条归档沉淀链写回的，而不必先翻 `证据时间线`。

## Completed

- 在 `../../src/components/forge-artifacts-page.tsx` 中接入 `getReleaseGateSummaryView(...)`，并新增工件页顶层 `归档接棒` 面板。
- 工件页第一屏现在会直接显示：
  - `归档接棒`
  - `归档来源`
- 在 `../../tests/forge-os-pages.test.tsx` 中补齐真实 `release.prepare -> archive.capture` 双跳链场景，验证工件页第一屏和证据时间线都能显示正确 provenance。
- 已同步更新 `../../README.md` 和 `../../docs/plans/2026-03-09-forge-takeover-next-phase.md`。

## Verification

- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
