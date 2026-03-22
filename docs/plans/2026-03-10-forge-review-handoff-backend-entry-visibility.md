# 2026-03-10 Forge Review Handoff Backend Entry Visibility

**Goal:** 让 `review-handoff` 不再只是一个结构化阶段状态，而是直接暴露默认外部审查后端和负责人可读的审查入口预览。

**Architecture:** 继续复用现有 `currentHandoff`、execution backend coverage 和 invocation helper，不新增持久化状态。仅在 `review-handoff` 这个中间态下，把 `review.run` 对应的 execution backend 入口补进 `currentHandoff`，并前推到负责人页面。

## Implementation

1. `buildCurrentHandoffRuntimeSummary(...)` 现在会在 `review-handoff` 下派生 `runtimeExecutionBackendLabel / runtimeExecutionBackendCommandPreview`。
2. `/api/forge/control-plane` 与所有复用 `currentHandoff` 聚合块的入口，会直接返回这组字段。
3. 首页、项目页、治理页现在会在 `review-handoff` 下直接显示 `默认外部审查 / 审查入口预览`。

## Verification

- `tests/forge-ai.test.ts`
- `tests/forge-api-routes.test.ts`
- `tests/forge-home-page.test.tsx`
- `tests/forge-projects-page.test.tsx`
- `tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，负责人在看到 `review-handoff` 时，不只知道“下一步该规则审查”，还会直接知道“默认由哪个 execution backend 接审、入口长什么样”。这让 Forge 从“解释 handoff”进一步收敛成“给出可执行入口”，同时仍然保持 Forge 只做交付控制面，不自己变成编排器 UI。
