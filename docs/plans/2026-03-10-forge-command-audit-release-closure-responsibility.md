# Forge Command Audit Release Closure Responsibility

## Goal

让 `GET /api/forge/commands` 的最近执行和治理页 `最近命令执行` 直接显示结构化 `最终放行责任链`，不再只依赖 `最终放行摘要 / 放行细节` 的侧向组合。

## Changes

- 在 `getRecentCommandExecutions(...)` 中为每条带 `projectId` 的命令执行追加 `releaseClosureResponsibilitySummary`
- 治理页 `最近命令执行` 直接显示 `最终放行责任链：...`
- 保持 `release.prepare / archive.capture` 两段命令审计都复用同一份 `releaseClosureResponsibilitySummary`

## Verification

- `npm test -- --run tests/forge-selectors.test.ts tests/forge-os-pages.test.tsx tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
