# 2026-03-10 Forge Command Audit Archive Release Closure

## Goal

把 `releaseClosure` 从 `command-release-prepare` 的命令审计继续推进到 `command-archive-capture`，让命令中心和治理页在归档末端也能直接看到：

- 这次归档写回是不是发布链的最终收口结果
- 它的最终放行细节是什么
- 它与 `archiveProvenance` 的关系是否一致

## Scope

- `packages/core/src/selectors.ts`
- `tests/forge-selectors.test.ts`
- `tests/forge-ai.test.ts`
- `tests/forge-api-routes.test.ts`
- `tests/forge-os-pages.test.tsx`

## TDD

1. 先补红测，证明 `archive.capture` 的最近执行还没有 `releaseClosure`
2. 只扩命令审计上下文，不改全局 `releaseClosure` 语义
3. 让 `archive.capture` 命令优先用自身 `archiveProvenance` 表达最终收口
4. 跑目标测试，再跑 fresh 全量验证

## Done

- `archive.capture` 的最近执行现在会直接带 `releaseClosureSummary / releaseClosureDetail`
- 治理页 `最近命令执行` 已能在归档末端直接显示最终放行摘要
- `forge-selectors / forge-ai / forge-api-routes / forge-os-pages` 已补齐回归覆盖
