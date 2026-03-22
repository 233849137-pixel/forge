# Forge Command Audit Approval Handoff

## Goal

把 `approvalHandoff` 从顶层放行摘要继续前推到 `recentExecutions` 命令审计层，让命令中心和治理页最近执行记录也能直接回答：

- 这次 `release.prepare` 确认后交给谁
- 接棒细节是什么
- 确认后默认下一步做什么

## Implementation

- 在 `packages/core/src/selectors.ts` 为 `getRecentCommandExecutions()` 增加 `approvalHandoffSummary / approvalHandoffDetail / approvalHandoffOwnerLabel / approvalHandoffNextAction`
- 仅对 `release.prepare` 命令执行注入这组字段，复用 `getFormalArtifactResponsibilitySummary(...).approvalHandoff`
- 在治理页 `最近命令执行` 中显式展示 `确认后接棒 / 接棒细节 / 接棒动作`
- 让 AI 聚合与 `/api/forge/commands` 自然透传这组字段，不新增旁路结构

## Verification

- `npm test -- --run tests/forge-selectors.test.ts`
- `npm test -- --run tests/forge-ai.test.ts`
- `npm test -- --run tests/forge-api-routes.test.ts`
- `npm test -- --run tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
