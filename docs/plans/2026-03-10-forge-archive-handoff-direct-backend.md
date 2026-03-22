# Forge Archive Handoff Direct Backend

**Date:** 2026-03-10

## Goal

把 MVP 主链补到 `approval -> archive.capture`，让负责人完成人工放行后，Forge 可以继续把知识沉淀交给外部 execution backend，而不是重新退回手工拼接。

## Scope

- 新增 Archive 外部执行契约：
  - `FORGE_ARCHIVE_EXEC_COMMAND`
  - `FORGE_ARCHIVE_EXEC_PROVIDER`
  - `FORGE_ARCHIVE_EXEC_BACKEND`
  - `FORGE_ARCHIVE_EXEC_BACKEND_COMMAND`
- 扩展 execution backend registry 与 runtime adapter：
  - `archive-execution-backend`
  - `knowledge-runner`
  - `commandType = archive.capture`
  - `expectedArtifacts = knowledge-card / release-audit`
- 让 `prepare / dispatch / execute / bridge / bridge-writeback` 支持按 `projectId` 直接消费 `归档复用` 阶段
- 在 bridge writeback 成功后：
  - 写回 `command-archive-capture`
  - 落地 `knowledge-card / release-audit`
  - 补齐 `release-audit` 评审记录
  - 关闭 `task-<projectId>-knowledge-card`

## Result

- Forge 现在已经能从 `review-handoff -> qa-handoff -> release-candidate -> approval -> archive.capture` 连续推进
- `archive.capture` 不再只存在于本地命令路径，也已经成为项目级外部 backend 可直连的最后一棒
- 归档沉淀结果已经会同时进入命令审计、正式工件和任务闭环

## Verification

- `npm test -- tests/runtime-capability-detect.test.ts`
- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
