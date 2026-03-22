# Forge Archive Current Handoff Visibility

**Date:** 2026-03-10

## Goal

把 `归档复用` 阶段的 `currentHandoff` 从通用归档文案收成真实责任任务，并让负责人页面与外部 Agent 直接看到归档后端入口。

## Completed

- `getCurrentHandoffSummary()` 现在会在 `归档复用` 阶段优先认领 `task-<projectId>-knowledge-card`
- `currentHandoff` 的默认接棒已切到 `知识沉淀 Agent -> 沉淀交付知识卡`
- `buildCurrentHandoffRuntimeSummary()` 现在复用统一的项目级 execution backend invocation 解析，不再只覆盖 `review-handoff`
- `currentHandoff.runtimeExecutionBackendInvocation` 已覆盖 archive 阶段，可直接返回 `archive.capture` 的 backend payload
- 首页、项目页、执行页、治理页已把 `默认外部审查 / 审查入口预览` 统一改成 `默认外部执行 / 执行入口预览`

## Verification

- `npm test -- tests/forge-selectors.test.ts`
- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx`
