# Forge Formal Artifact Responsibility Helper Alignment

## Goal

把页面层对 `formalArtifactResponsibility` 的消费收成单一 helper，避免首页、项目页、治理页、工件页各自拼：

- `coverage`
- `gap`
- `pending approvals`
- `approval handoff`

## Completed

- 新增 `getResolvedFormalArtifactResponsibilityView(...)`
- 首页、项目页、治理页、工件页全部切到该 helper
- `approvalHandoffSummary / detail / nextAction` 的显式传入值现在会优先于 snapshot 默认值
- 新增首页回归用例，锁住显式 handoff 覆盖默认 handoff 的行为

## Verification

- `npm test -- --run tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
