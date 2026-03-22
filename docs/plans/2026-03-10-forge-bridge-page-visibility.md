# Forge Bridge Page Visibility

**Date:** 2026-03-10

## Goal

把已经进入 `runtimeSummary` 的 bridge 写回证据继续前推到执行页和治理页，避免负责人页面之间对 bridge 状态的口径不一致。

## Scope

- `src/components/forge-execution-page.tsx`
- `src/components/forge-governance-page.tsx`
- `app/[view]/page.tsx`
- `tests/forge-os-pages.test.tsx`

## Completed

- 执行页 `本地运行上下文` 已显式显示 `桥接证据 / 桥接明细`
- 治理页 `放行闸口汇总 / 风险与阻塞` 已显式显示 `桥接证据 / 桥接明细`
- `[view]` loader 已为 `execution / governance` 透传 `bridgeExecutionSummary / bridgeExecutionDetails`

## Verification

- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
