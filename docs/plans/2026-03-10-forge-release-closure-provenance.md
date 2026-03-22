# Forge Release Closure Provenance

**Date:** 2026-03-10

## Background

上一批已经把顶层 `releaseClosure` 收成了终态 `archive-recorded`，但它仍然只返回 `summary / detail / nextAction`。负责人如果想知道这次最终收口具体来自哪条命令和哪次运行，还要回头再读 `archiveProvenance`。

## Goal

让 `releaseClosure` 自己成为可直接消费的最终放行事实源：

- 顶层聚合直接返回 `sourceCommand / relatedRun / runtime`
- 首页、项目页、治理页直接显示 `最终放行来源`
- 不改变既有 `approvalHandoff / archiveProvenance` 的职责，只减少调用方二次拼接

## Implementation

- 在 `../../packages/core/src/types.ts` 为 `ForgeReleaseClosureSummary` 增加：
  - `sourceCommandExecutionId`
  - `sourceCommandId`
  - `sourceCommandLabel`
  - `relatedRunId`
  - `relatedRunLabel`
  - `runtimeLabel`
- 在 `../../packages/core/src/selectors.ts`：
  - `archive-recorded` 场景直接复用 `archiveProvenance` 的 archive command 上下文
  - `pending-approval / approval-handoff` 场景直接复用 pending approval 与 approval handoff 的已有 provenance
- 在负责人页面层：
  - `../../src/components/forge-home-page.tsx`
  - `../../src/components/forge-projects-page.tsx`
  - `../../src/components/forge-governance-page.tsx`
  统一新增 `最终放行来源`
- 路由透传补在：
  - `../../app/page.tsx`
  - `../../app/[view]/page.tsx`

## Testing

红测先补在：

- `../../tests/forge-selectors.test.ts`
- `../../tests/forge-ai.test.ts`
- `../../tests/forge-api-routes.test.ts`
- `../../tests/forge-home-page.test.tsx`
- `../../tests/forge-projects-page.test.tsx`
- `../../tests/forge-os-pages.test.tsx`

另外补了 3 条局部长测超时：

- review bridge -> qa handoff
- qa handoff -> gate backend bridge writeback
- release candidate -> backend prepare route

只改单测局部超时，不动全局基线。

## Verification

- `npm test -- --run tests/forge-selectors.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx`
  - 6 个测试文件，197 个测试通过
