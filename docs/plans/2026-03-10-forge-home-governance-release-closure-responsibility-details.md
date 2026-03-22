# 2026-03-10 Forge Home/Governance Release Closure Responsibility Details

## Goal

把首页和治理页对 `releaseClosureResponsibility` 的消费从“只吃 summary”推进到“直接吃 detail / nextAction / sourceLabel”，减少对拆分 `releaseClosure*` 字段的依赖。

## Completed

- `ForgeHomePage` 现在支持 `releaseClosureResponsibilityDetail / releaseClosureResponsibilityNextAction / releaseClosureResponsibilitySourceLabel`。
- `ForgeGovernancePage` 现在支持同一组结构化 responsibility 字段。
- 当拆分 `releaseClosureDetail / releaseClosureNextAction / releaseClosureSource*` 缺失时，两页会自动回退到顶层 `releaseClosureResponsibility`，仍能稳定显示：
  - `放行细节`
  - `最终放行来源`
  - `放行动作`
- 首页根路由和 `[view]` 路由都已经补齐这些透传字段。

## Verification

- `npm test -- --run tests/forge-home-page.test.tsx`
- `npm test -- --run tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
