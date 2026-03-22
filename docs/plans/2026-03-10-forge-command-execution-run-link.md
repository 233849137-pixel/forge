# 2026-03-10 Forge Command Execution Run Link

**Goal:** 让项目级外部审查命令审计不只停留在“有一条 command-review-run 记录”，而是能显式追溯到对应的 bridge run。

**Architecture:** 在现有 `command_executions` 上新增可选 `run_id`，不新增新表。Bridge writeback 在 `project-handoff + review.run` 成功时，把 `command-review-run` 与对应 bridge run 绑定；selectors 和命令中心优先使用这条显式关联，不再只靠启发式匹配 run。

## Implementation

1. `command_executions` 现在支持可选 `run_id`，并已加到迁移、seed/upsert、snapshot 读取里。
2. `writebackExecutionBackendBridgeRunForAI()` 在项目级 `review-handoff` 直连成功时，会把 `normalizedRunId` 写进正式 `commandExecution.relatedRunId`。
3. `getCommandExecutionRuntimeContext()` 现在会优先消费 `execution.relatedRunId`，命令中心和治理后续视图开始稳定拿到这条显式追溯链。

## Verification

- `tests/forge-ai.test.ts`
- `tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，Forge 的项目级 `review-handoff -> review.run -> qa-handoff` 不只进入了正式命令审计，还把命令审计和真实 bridge run 显式绑在了一起。对 MVP 来说，这让外部 backend 的项目级审查闭环开始具备更可靠的证据追溯能力。
