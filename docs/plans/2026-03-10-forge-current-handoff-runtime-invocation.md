# 2026-03-10 Forge Current Handoff Runtime Invocation

**Goal:** 把 `review-handoff` 的默认外部审查入口从“标签 + 命令预览”进一步推进成结构化 `runtimeExecutionBackendInvocation`，让外部 Agent 能直接消费当前项目级 handoff。

**Architecture:** 继续复用现有 `buildExecutionBackendInvocation(...)` 与 `currentHandoff` 聚合，不新增持久化状态。仅在 `review-handoff` 下补出 invocation，并让 `currentHandoff`、control-plane、readiness 共享同一份项目级默认外部审查入口。

## Implementation

1. `ForgeCurrentHandoffSummary` 现在新增 `runtimeExecutionBackendInvocation`。
2. `buildCurrentHandoffRuntimeSummary(...)` 在 `review-handoff` 下会直接挂入 `review.run` 对应的 execution backend invocation。
3. API 路由与 AI 聚合测试已覆盖这层新字段，执行页也已补齐 `默认外部审查 / 审查入口预览`，与首页、项目页、治理页一致。

## Verification

- `tests/forge-ai.test.ts`
- `tests/forge-api-routes.test.ts`
- `tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，`review-handoff` 已经不只是“当前该谁接”的结构化状态，还包含“该通过哪条外部审查入口接”的结构化 invocation。Forge 围绕主线又往前走了一步：从解释 handoff，推进到给出项目级、adapter-ready 的下一跳入口。
