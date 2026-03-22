# Forge Responsibility Summary Cluster

## Goal

把首页、项目页、工件页里重复的“责任与来源”摘要区收成共享展示层，避免每个页面各自拼 `当前接棒 / 正式工件责任 / 最终放行责任链 / 归档接棒 / 正式来源链`。

## Completed

- 在 `src/components/forge-os-shared.tsx` 新增 `ResponsibilitySummaryCluster`
- 首页改为通过共享责任簇渲染 `当前接棒 + 正式工件责任 + 最终放行责任链`
- 项目页改为通过共享责任簇渲染 `当前责任 + 正式工件责任 + 最终放行责任链`
- 工件页改为通过共享责任簇渲染 `正式工件责任 + 最终放行责任链 + 归档接棒 + 正式来源链`
- 新增首页回归，锁定责任区已使用独立 `responsibility-summary-cluster` 展示层

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Next

- 继续把治理页里还残留的手工摘要组合往共享展示层上收
- 继续减少页面侧对责任链块的手工编排
