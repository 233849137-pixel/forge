# 2026-03-10 Forge QA Handoff Direct Gate Backend

## Goal

把项目级 `qa-handoff` 也接成正式的 execution backend 直连入口，让外部后端能从“规则审查已完成、等待测试门禁”直接进入 `gate.run`，并在 bridge writeback 后把项目推进到 `release-candidate`。

## Completed

- execution backend 共享契约现在新增 QA 条目：`qa-execution-backend`
- `FORGE_QA_EXEC_COMMAND / FORGE_QA_EXEC_PROVIDER / FORGE_QA_EXEC_BACKEND / FORGE_QA_EXEC_BACKEND_COMMAND` 已成为正式 env 契约
- `prepareExecutionBackendRequestForAI({ projectId })` 在项目当前 handoff 为 `qa-handoff` 时，会直接返回 `command-gate-run` 的结构化 invocation
- 项目级 `qa-handoff` bridge writeback 现在会：
  - 写回 `command-gate-run` 命令审计
  - 自动落地 `test-report / playwright-run`
  - 自动生成 `release-brief` 草稿和发布整理任务
  - 把项目推进到 `release-candidate`

## Files

- `config/forge-execution-backend-contracts.json`
- `packages/ai/src/runtime-adapters.ts`
- `packages/ai/src/forge-ai.ts`
- `tests/runtime-capability-detect.test.ts`
- `tests/forge-ai.test.ts`
- `tests/forge-api-routes.test.ts`
- `README.md`
- `docs/plans/2026-03-09-forge-takeover-next-phase.md`

## Verification

- `npm test`
- `npm run build`
- `npm run build:electron`
