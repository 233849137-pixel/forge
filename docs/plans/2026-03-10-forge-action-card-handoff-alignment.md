# 2026-03-10 Forge Action Card Handoff Alignment

## Goal

让首页动作卡、项目页当前上下文、项目页阶段准入三处都使用同一套 `bridge-aware next action`。

## Changes

- 首页动作卡 `support-copy` 现在会显式显示 `负责人动作：...`
- 项目页 `阶段准入与缺口` 现在新增 `当前接棒`
- 两者都直接复用 `getNextAction()` 的 bridge-aware 结果，不新增额外派生状态

## Verification

- `npm test -- tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
