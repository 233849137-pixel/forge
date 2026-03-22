# 2026-03-10 Forge Artifacts Release Closure Action Alignment

## Goal

继续压平四个负责人入口对 `releaseClosureResponsibility` 的消费差异，让工件页在 archive 终态也能直接显示 `放行动作`。

## Problem

工件页 `正式工件责任` 之前仍主要依赖 `releaseGateSummary.releaseClosure.nextAction`。

- 在 `archive-recorded` 终态下，这个字段为空
- 但顶层 `releaseClosureResponsibility.nextAction` 已经能稳定返回 `沉淀交付知识卡与归档审计记录`

结果是：首页、项目页、治理页已经显示放行动作，工件页仍然缺一段。

## Change

- 在 `src/components/forge-artifacts-page.tsx` 中增加：
  - `resolvedReleaseClosureDetail`
  - `resolvedReleaseClosureSourceValue`
  - `resolvedReleaseClosureAction`
- 回退顺序改为优先消费：
  - `releaseClosureResponsibility.detail`
  - `releaseClosureResponsibility.sourceLabel`
  - `releaseClosureResponsibility.nextAction`

## Result

工件页 `正式工件责任` 现在在 archive 终态下也会直接显示：

- 最终放行摘要
- 最终放行责任链
- 放行细节
- 最终放行来源
- 放行动作

四个负责人入口的最终放行口径继续收平。

## Verification

- `npm test -- --run tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
