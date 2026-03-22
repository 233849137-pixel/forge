# Forge Project Release Closure Responsibility Details

## Goal

让项目页 `交付就绪度` 和首页 / 治理页一样，优先直接消费顶层 `releaseClosureResponsibility`，而不是继续依赖旧的 `releaseClosureSummary / detail / nextAction` 透传。

## Changes

- `ForgeProjectsPage` 新增 `releaseClosureResponsibilityDetail / NextAction / SourceLabel` 输入
- 项目页 `最终放行摘要` 块现在会在只有 `releaseClosureResponsibility` 时也完整渲染
- `[view]/page.tsx` 为项目页透传顶层 `releaseClosureResponsibility` 结构化字段

## Verification

- `npm test -- --run tests/forge-projects-page.test.tsx tests/forge-home-page.test.tsx tests/forge-os-pages.test.tsx tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
