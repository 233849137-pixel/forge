# 2026-03-10 Forge release closure summary block from responsibility

## Goal

让首页与治理页的 `最终放行摘要` 模块不再强依赖旧的 `releaseClosureSummary`，而是直接由结构化 `releaseClosureResponsibility` 驱动。

## Why

- 之前首页与治理页虽然已经能消费 `releaseClosureResponsibility.detail / sourceLabel / nextAction`，但整块摘要仍被 `releaseClosureSummary` 门控。
- 这会导致调用方只传结构化责任链时，`最终放行摘要 / 责任链 / 放行细节 / 最终放行来源 / 放行动作` 整块消失。
- 这与 Forge 当前把最终放行责任链上提为顶层事实源的方向不一致。

## TDD

1. 修改页面测试：
   - `tests/forge-home-page.test.tsx`
   - `tests/forge-os-pages.test.tsx`
2. 去掉测试里的 `releaseClosureSummary`，只保留 `releaseClosureResponsibility*`
3. 先确认红测，证明旧门控仍存在
4. 修改页面实现，让摘要块改由结构化责任链驱动
5. 回跑目标测试与全量验证

## Implementation

- `src/components/forge-home-page.tsx`
  - 新增 `hasReleaseClosureSummaryBlock`
  - 只要存在 `releaseClosureResponsibility*` 或旧的 `releaseClosure*` 任一结构化字段，就渲染最终放行摘要块
  - 当旧 `releaseClosureSummary` 缺失时，摘要行会回退到 `releaseClosureResponsibilitySummary`
- `src/components/forge-governance-page.tsx`
  - 同样改为 `hasReleaseClosureSummaryBlock`
  - 摘要块与首页保持一致的回退逻辑

## Verification

- `npm test -- --run tests/forge-home-page.test.tsx`
- `npm test -- --run tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
