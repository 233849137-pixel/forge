# Forge Home And Project Formal Artifact Coverage

**Date:** 2026-03-10

## Goal

把工件页第一屏已经成立的 `正式来源链`，再前推到首页与项目页的负责人口径里，让负责人在不切换到工件工作台的前提下，也能先看到当前是否已经沉淀出正式交付工件。

## Completed

- 在 `../../src/components/forge-os-shared.tsx` 中新增 `getFormalArtifactCoverageSummary(...)`，统一输出 `正式工件沉淀 / 沉淀清单` 摘要。
- 在 `../../src/components/forge-home-page.tsx` 的 `推进判断` 中新增这组正式工件沉淀摘要。
- 在 `../../src/components/forge-projects-page.tsx` 的 `交付就绪度` 中新增这组正式工件沉淀摘要。
- 在默认 fixture 仍未形成正式工件沉淀时，首页与项目页会明确提示：
  - `当前还没有沉淀正式工件。`
  - `先完成交付说明、放行评审结论和归档沉淀写回。`
- 已同步更新 `../../tests/forge-home-page.test.tsx`、`../../tests/forge-projects-page.test.tsx`、`../../README.md`、`../../docs/plans/2026-03-09-forge-takeover-next-phase.md`。

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
