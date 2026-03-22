# 2026-03-10 Forge Page Formal Artifact Responsibility Alignment

## Goal

把首页、项目页、治理页对 `正式工件责任` 的消费统一到 `formalArtifactResponsibility`，收掉页面层各自拼 `coverage / gap / approvalTrace` 的分叉。

## Done

- 在 [forge-os-shared.tsx](../../src/components/forge-os-shared.tsx) 新增 `getFormalArtifactResponsibilityView()`，把页面层需要的 `待人工确认 / 确认责任` 收成单一 view helper。
- 首页 [forge-home-page.tsx](../../src/components/forge-home-page.tsx) 现在直接显示 `待人工确认 / 确认责任`，与工件页共用同一份正式工件责任摘要。
- 项目页 [forge-projects-page.tsx](../../src/components/forge-projects-page.tsx) 的 `交付就绪度` 现在也直接显示 `待人工确认 / 确认责任`。
- 治理页 [forge-governance-page.tsx](../../src/components/forge-governance-page.tsx) 的 `待人工确认` 已改为直接消费 `formalArtifactResponsibility.pendingApprovals`；无真实审批链时会回到空态。
- 页面测试已同步：
  - [forge-home-page.test.tsx](../../tests/forge-home-page.test.tsx)
  - [forge-projects-page.test.tsx](../../tests/forge-projects-page.test.tsx)
  - [forge-os-pages.test.tsx](../../tests/forge-os-pages.test.tsx)

## Verification

```bash
npm test -- --run tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx
npm test
npm run build
npm run build:electron
```
