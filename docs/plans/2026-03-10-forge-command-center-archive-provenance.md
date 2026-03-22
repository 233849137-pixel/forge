# Forge Command Center Archive Provenance

**Date:** 2026-03-10

## Goal

把 `archiveProvenance` 从 `controlPlane / readiness` 再前推到 `command center` 顶层，让命令中心和外部 Agent 不需要额外反查嵌套聚合，就能直接读取当前归档沉淀来自哪条 `archive.capture` 与哪次 `release.prepare`。

## Completed

- 在 `../../packages/ai/src/forge-ai.ts` 中把 `governanceResponsibility.archiveProvenance` 提升到 `getCommandCenterForAI()` 顶层返回。
- 在 `../../tests/forge-ai.test.ts` 中补齐 archive bridge writeback 之后对 `commandCenter.archiveProvenance` 的断言。
- 在 `../../tests/forge-api-routes.test.ts` 中补齐 `GET /api/forge/commands` 对顶层 `archiveProvenance` 的断言。
- 已同步更新 `../../README.md` 和 `../../docs/plans/2026-03-09-forge-takeover-next-phase.md`。

## Verification

- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
