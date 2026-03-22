# Forge Review Handoff Direct Backend Entry

**Date:** 2026-03-10

## Goal

让 `review-handoff` 不再只是负责人视角和治理动作里的状态，而是能直接进入现有 `execution backend prepare -> dispatch -> execute -> bridge -> writeback` 链。

## Delivered

- `prepareExecutionBackendRequestForAI()` 现在支持 `projectId`
- 仅当 `currentHandoff.source === review-handoff` 时，系统才会为项目直接准备 `review.run` 的 execution backend invocation
- `dispatch / execute / bridge / bridge-writeback` 入口现已一并透传 `projectId`
- `POST /api/forge/execution-backends/prepare` 现在可直接从 `review-handoff` 项目生成 review backend adapter request
- `writebackExecutionBackendBridgeRunForAI({ projectId })` 现在可直接把 `review-handoff` 项目推进到 `qa-handoff`
- MCP `forge_execution_backend_prepare / forge_execution_backend_dispatch / forge_execution_backend_execute / forge_execution_backend_bridge / forge_execution_backend_bridge_writeback` 的输入说明已同步支持项目级桥接移交入口

## Why It Matters

这一步让 Forge 的主线从：

`execution.start -> engineer bridge writeback -> review-handoff`

推进到：

`execution.start -> engineer bridge writeback -> review-handoff -> review.run -> qa-handoff`

而且外部后端现在可以直接站在 `review-handoff` 上继续跑，不需要先人为补一条整改 task 才能接管。
