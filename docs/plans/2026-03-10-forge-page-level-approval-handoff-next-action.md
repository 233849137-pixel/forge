# Forge Page-Level Approval Handoff Next Action

## Goal

把 `approvalHandoff.nextAction` 从命令审计和嵌套责任摘要前推到首页、项目页、工件页、治理页第一层，减少负责人还要自己从 `确认后接棒 / 接棒细节` 推断“下一步到底做什么”。

## Completed

- `getFormalArtifactResponsibilityView(...)` 现在会直接透出 `approvalHandoffAction`
- 首页、项目页、治理页已经支持显式消费顶层 `approvalHandoffNextAction`
- 工件页的 `正式工件责任` 现在也会直接显示 `接棒动作`
- 治理页 `待人工确认` 的汇总行也开始带 `接棒动作`
- 页面测试已补齐：
  - `tests/forge-home-page.test.tsx`
  - `tests/forge-projects-page.test.tsx`
  - `tests/forge-os-pages.test.tsx`

## Verification

- `npm test -- --run tests/forge-home-page.test.tsx`
- `npm test -- --run tests/forge-projects-page.test.tsx`
- `npm test -- --run tests/forge-os-pages.test.tsx`
