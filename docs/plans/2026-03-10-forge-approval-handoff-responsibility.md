# 2026-03-10 Forge Approval Handoff Responsibility

## Goal

把“还差谁确认、确认后谁接棒归档沉淀”收成正式事实源，并同步到首页、项目页、工件页、治理页。

## Done

- 在 [packages/core/src/types.ts](../../packages/core/src/types.ts) 为 `formalArtifactResponsibility` 增加 `approvalHandoff`。
- 在 [packages/core/src/selectors.ts](../../packages/core/src/selectors.ts) 里基于 `release.prepare` 来源链和 `knowledge-card` 任务，统一生成“确认后接棒”摘要。
- 在 [src/components/forge-os-shared.tsx](../../src/components/forge-os-shared.tsx) 增加页面层 view helper，避免首页、项目页、工件页、治理页各自拼接审批后责任链。
- 页面已同步：
  - [src/components/forge-home-page.tsx](../../src/components/forge-home-page.tsx)
  - [src/components/forge-projects-page.tsx](../../src/components/forge-projects-page.tsx)
  - [src/components/forge-artifacts-page.tsx](../../src/components/forge-artifacts-page.tsx)
  - [src/components/forge-governance-page.tsx](../../src/components/forge-governance-page.tsx)
- `control-plane / readiness / remediations / commands` 不需要额外改接口拼装，因为它们已经直接透传 `formalArtifactResponsibility`。

## Verification

```bash
npm test -- --run tests/forge-selectors.test.ts tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx tests/forge-ai.test.ts tests/forge-api-routes.test.ts
npm test
npm run build
npm run build:electron
```
