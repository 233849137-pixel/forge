# 2026-03-10 Forge Command Audit Release Closure

## Goal

把 `releaseClosure` 从顶层 `readiness / control-plane / commands` 摘要，继续压到命令审计层，让 `command-release-prepare` 的最近执行也能直接回答：

- 当前是否已经进入最终放行
- 放行细节是什么
- 下一步确认动作是什么

## Scope

- `packages/core/src/selectors.ts`
- `src/components/forge-governance-page.tsx`
- `tests/forge-selectors.test.ts`
- `tests/forge-ai.test.ts`
- `tests/forge-api-routes.test.ts`
- `tests/forge-os-pages.test.tsx`

## TDD

1. 先补红测，证明 `recentExecutions` 还没有 `releaseClosureSummary / detail / nextAction`
2. 只在 `getRecentCommandExecutions()` 上下文里补 `release.prepare -> releaseClosure`
3. 让治理页 `最近命令执行` 直接显示三段新信息
4. 跑目标测试，再跑全量验证

## Done

- `getRecentCommandExecutions()` 现在会为 `command-release-prepare` 直接透传 `releaseClosureSummary / releaseClosureDetail / releaseClosureNextAction`
- 治理页 `最近命令执行` 已显式显示 `最终放行摘要 / 放行细节 / 放行动作`
- `forge-selectors / forge-ai / forge-api-routes / forge-os-pages` 已补齐回归覆盖
