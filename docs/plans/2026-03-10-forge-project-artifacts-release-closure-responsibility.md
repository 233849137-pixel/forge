# 2026-03-10 Forge Project/Artifacts Release Closure Responsibility

## Goal

把 `releaseClosureResponsibility` 从首页 / 治理页继续前推到项目页与工件页，让四个负责人入口对 `最终放行责任链` 使用同一份顶层事实源。

## Completed

- 项目页 `交付就绪度` 现在会直接显示 `最终放行责任链`，优先消费顶层 `releaseClosureResponsibilitySummary`，没有显式透传时回退到 `releaseGateSummary.releaseClosureResponsibility?.summary`。
- 工件页 `正式工件责任` 现在也会直接显示 `最终放行责任链`，负责人不需要再从 `最终放行摘要 + 归档接棒` 手工拼责任链。
- 项目页路由已补齐 `releaseClosureResponsibilitySummary` 透传，页面和顶层 `controlPlane` 不再分叉。
- 相关页面测试里的旧唯一匹配断言已经改成稳定存在性断言，避免同一句文案同时出现在 `最终放行摘要` 和 `最终放行责任链` 时产生误报。

## Verification

- `npm test -- --run tests/forge-projects-page.test.tsx`
- `npm test -- --run tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
