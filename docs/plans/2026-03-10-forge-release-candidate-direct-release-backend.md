# Forge Release Candidate Direct Release Backend

**Date:** 2026-03-10

## Goal

把项目级 `release-candidate` 继续推进成外部 backend 的直连入口，让 Forge 在 `review-handoff -> qa-handoff -> release-candidate -> approval` 这条桥接链上不再停在“描述下一步”，而是能直接把交付说明整理和人工确认责任链做实。

## Scope

- 新增 Release 外部执行契约：
  - `FORGE_RELEASE_EXEC_COMMAND`
  - `FORGE_RELEASE_EXEC_PROVIDER`
  - `FORGE_RELEASE_EXEC_BACKEND`
  - `FORGE_RELEASE_EXEC_BACKEND_COMMAND`
- 扩展 execution backend registry 与 runtime adapter：
  - `release-execution-backend`
  - `release-runner`
  - `commandType = release.prepare`
  - `expectedArtifacts = release-brief / review-decision`
- 让 `prepare / dispatch / execute / bridge / bridge-writeback` 支持按 `projectId` 直接消费 `release-candidate`
- 在 bridge writeback 成功后：
  - 写回 `command-release-prepare`
  - 落地 `release-brief / review-decision`
  - 创建 `task-<projectId>-release-approval`
  - 把 `currentHandoff` 提升到 `approval`

## Result

- 外部后端现在已经可以从项目级 `release-candidate` 直接进入 `release.prepare`
- bridge-backed `release.prepare` 写回后，Forge 不再停留在 `release-candidate`，而是正式进入 `approval`
- `readiness / commands / API routes` 现在都能显式返回这条人工确认责任链

## Verification

- `npm test -- tests/runtime-capability-detect.test.ts`
- `npm test -- tests/forge-selectors.test.ts`
- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
