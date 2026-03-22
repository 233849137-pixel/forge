# 2026-03-10 Forge Review Handoff Command Audit

**Goal:** 让项目级 `review-handoff` 直连外部 backend 后，不只写回 `run / review-report / qa-handoff`，还正式补齐 `command-review-run` 命令执行审计。

**Architecture:** 不新增持久化表，也不改页面交互。继续复用现有 `writebackExecutionBackendBridgeRunForAI()`、`recordCommandExecutionForAI()` 和命令中心聚合，只在 `project-handoff + review.run` 成功写回时补一条正式命令执行记录。

## Implementation

1. `writebackExecutionBackendBridgeRunForAI()` 现在在 `project-handoff + review.run` 下会额外生成 `commandExecution`。
2. 这条记录使用标准 `command-review-run` 契约，摘要统一收成 `已通过 OpenClaw Bridge 完成规则审查，项目移交 QA。`
3. API `bridge/writeback` 返回值现在会直接带 `commandExecution`，命令中心与治理审计因此能看到完整规则审查命令链，而不再只看到 run/artifact。

## Verification

- `tests/forge-ai.test.ts`
- `tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，Forge 的项目级 `review-handoff -> review.run -> qa-handoff` 已不再只是运行证据链，也进入了正式命令审计链。对外部 backend 而言，这意味着项目级默认外部审查入口已经开始具备更完整的审计闭环。
