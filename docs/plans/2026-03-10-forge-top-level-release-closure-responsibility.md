# 2026-03-10 Forge 顶层最终放行责任链

## Goal

把首页与治理页正在使用的 `最终放行责任链` 从页面 helper 上提成正式事实源，进入 `core selector -> AI 顶层聚合 -> route -> page`，减少页面继续各自拼 `releaseClosure + approvalHandoff + archiveProvenance`。

## Completed

- 在 `packages/core/src/types.ts` 新增 `ForgeReleaseClosureResponsibilitySummary`
- 在 `packages/core/src/selectors.ts` 新增 `getReleaseClosureResponsibilitySummary(...)`
- `releaseGate` 现在会直接返回 `releaseClosureResponsibility`
- `control-plane / readiness / remediations / commands` 现在都会直接透传 `releaseClosureResponsibility`
- 首页与治理页新增 `releaseClosureResponsibilitySummary` props，并优先消费顶层事实源；旧 `getReleaseClosureResponsibilityLine(...)` 保留为 fallback
- 补齐 AI、API、首页、治理页对应红绿测试

## Verification

- `npm test -- --run tests/forge-ai.test.ts`
- `npm test -- --run tests/forge-api-routes.test.ts`
- `npm test -- --run tests/forge-home-page.test.tsx tests/forge-os-pages.test.tsx`
- 后续再跑 fresh 全量：
  - `npm test`
  - `npm run build`
  - `npm run build:electron`
