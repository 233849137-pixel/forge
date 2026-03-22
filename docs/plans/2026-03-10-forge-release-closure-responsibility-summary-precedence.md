# Forge Release Closure Responsibility Summary Precedence

## Goal

把页面级 `最终放行摘要` 的优先级彻底收平：只要结构化的 `releaseClosureResponsibility.*` 已存在，就不再让首页、项目页、治理页、工件页回退到 legacy `releaseClosureSummary`。

## Completed

- 新增并复用 `getResolvedReleaseClosureView(...)`，统一处理：
  - `summary`
  - `responsibilityLine`
  - `detail`
  - `nextAction`
  - `sourceLabel`
  - `visible`
- 首页与项目页已切到该 helper。
- 本批继续把治理页与工件页切到该 helper。
- 新增页面级回归断言，锁住“结构化 summary 优先于 legacy summary”的行为。

## Why It Matters

- 避免四个负责人入口在最终放行末端继续出现“同一条责任链，两套摘要优先级”的分叉。
- 让 `releaseClosureResponsibility` 真正成为页面第一口径，而不是只存在于 selector / AI 顶层聚合里。
- 为后续完全移除 legacy `releaseClosureSummary` 展示依赖创造条件。

## Verification

- `npm test -- --run tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
