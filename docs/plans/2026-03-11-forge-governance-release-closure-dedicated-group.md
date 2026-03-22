# Forge Governance Release Closure Dedicated Group

**Date:** 2026-03-11

## Goal

把治理页里仍然混在 `放行闸口汇总` 大列表中的 `最终放行责任链` 拆成独立分组，和首页、项目页、工件页保持一致。

## Changes

- `src/components/forge-governance-page.tsx`
  - `放行闸口汇总` 不再混入 `releaseClosureView`
  - 新增独立 `SummaryGroup`
    - 标题：`最终放行责任链`
    - 内容：`最终放行摘要 / 最终放行责任链 / 放行细节 / 最终放行来源 / 放行动作`
- 继续复用共享 helper：
  - `getFormalArtifactResponsibilitySummaryItems(...)`
  - `getReleaseClosureSummaryItems(...)`

## Why

- 治理页之前还是把 gate 事实、工件责任和最终放行终态塞在一张长表里。
- 这会让“是否可放行”和“最终如何收口”在视觉上混在一起。
- 拆开后，治理页与首页/项目页/工件页的 operator-facing 信息结构更一致。

## Verification

- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
