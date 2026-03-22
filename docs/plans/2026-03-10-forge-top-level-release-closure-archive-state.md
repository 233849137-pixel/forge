# Forge Top-Level Release Closure Archive State

**Date:** 2026-03-10

## Background

`releaseClosure` 已经进入 `releaseGate / control-plane / readiness / commands` 顶层，也已经进入 `command-release-prepare / command-archive-capture` 命令审计。之前顶层与命令层仍共用同一套审批前文案，导致项目已经完成 `archive.capture` 写回时，负责人第一层仍看到“还差人工确认”的旧语义。

## Goal

收口两层不同但都合理的语义：

1. 顶层 `releaseClosure`
   - 在 `archive.capture` 写回后进入终态 `archive-recorded`
   - 摘要明确回答“发布链已完成最终放行，归档沉淀已写回正式工件面”
2. 命令级 `releaseClosure`
   - `command-release-prepare` 继续保留审批前语义
   - `command-archive-capture` 明确表达最终收口结果

## Implementation

- 在 `../../packages/core/src/selectors.ts` 中让 `getReleaseClosureSummary(...)` 优先消费 `archiveProvenance`，并在归档写回后返回：
  - `status: "archive-recorded"`
  - `summary: "发布链已完成最终放行，归档沉淀已写回正式工件面。"`
  - `detail: archiveProvenance.detail`
  - `nextAction: null`
- 新增 `getActiveReleaseClosureSummary(...)`，专供 `release.prepare` 命令审计继续保留审批前语义。
- 调整 `getCommandExecutionReleaseClosureContext(...)`：
  - `release.prepare` 使用 `getActiveReleaseClosureSummary(...)`
  - `archive.capture` 使用终态 `archive-recorded` 语义

## Verification

- `npm test -- --run tests/forge-selectors.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts tests/forge-os-pages.test.tsx`
  - 4 个测试文件，174 个测试通过

## Notes

- 这次没有改变 `release.prepare` 的命令审计语义，只修正了顶层 `releaseClosure` 与 `archive.capture` 命令审计的终态表达。
- 工件页由于同一条 archive provenance 细节会在两个面板中同时出现，页面测试已改成允许重复命中，而不是假定唯一文本实例。
