# Forge Formal Artifact Summary Items Alignment

## Goal

把四个负责人入口里重复拼装的 `正式工件责任` 清单项收成共享 helper，减少页面级责任链再次分叉的机会。

## Completed

- 新增 `getFormalArtifactResponsibilitySummaryItems(...)`
- 首页、项目页、治理页、工件页都改为复用这组共享清单项
- `正式工件沉淀 / 缺口 / 待人工确认 / 确认后接棒 / 最终放行责任链` 的顺序与默认文案已对齐
- 保留工件页自己的 `gapActionFallback`，不影响原有“当前没有额外的正式工件补齐动作。”语义

## Verification

- `npm test -- --run tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
