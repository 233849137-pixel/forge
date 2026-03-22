# Forge Current Handoff Gap Alignment

## Goal

把首页 / 项目页 / 外部 Agent 看到的 `currentHandoff.nextAction` 和 `formalArtifactGap.nextAction` 收成同一套 bridge handoff 规范文案，避免负责人动作被任务队列里的临时缺件标签带偏。

## Scope

- 新增共享 bridge handoff guidance helper
- `getCurrentHandoffSummary(...)` 在 `review-handoff / qa-handoff / release-candidate` 下改为复用该 helper
- `getFormalArtifactGapSummary(...)` 继续复用同一 helper
- 不新增新的 top-level 对象

## Decisions

- `qa-handoff` 的默认接棒固定为：`测试 Agent -> 补齐测试报告 / Playwright 回归记录`
- `release-candidate` 的默认接棒固定为：`发布 Agent -> 收口交付说明 / 放行评审结论`
- `review-handoff` 继续固定为：`架构师 Agent -> 发起规则审查并补齐规则审查记录`

## Verification

- `npm test -- tests/forge-selectors.test.ts`
- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
