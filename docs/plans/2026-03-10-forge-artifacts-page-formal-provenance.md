# Forge Artifacts Page Formal Provenance

**Date:** 2026-03-10

## Goal

把工件页里已经存在于 `证据时间线` 的正式工件来源链，再前推到第一屏摘要，让负责人不用逐条扫时间线，也能直接看到 `release-brief / review-decision / release-audit / knowledge-card` 分别来自哪条命令与运行链。

## Completed

- 在 `../../src/components/forge-os-shared.tsx` 中新增 `getFormalArtifactProvenanceSummary(...)`，基于现有 `evidenceTimeline` 统一过滤并排序正式工件来源链。
- 在 `../../src/components/forge-artifacts-page.tsx` 中新增工件页第一屏 `正式来源链` 面板。
- 工件页现在会统一展示：
  - `release-brief`
  - `review-decision`
  - `release-audit`
  - `knowledge-card`
  的来源命令和来源运行。
- 在 `../../tests/forge-os-pages.test.tsx` 中补齐真实 `release.prepare -> archive.capture` 场景，验证第一屏和证据时间线口径一致。
- 已同步更新 `../../README.md` 和 `../../docs/plans/2026-03-09-forge-takeover-next-phase.md`。

## Verification

- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
