# 2026-03-10 Forge Command Audit Release Closure Responsibility Details

## Goal

把 `releaseClosureResponsibility` 从单行摘要继续前推到命令审计层，让 `GET /api/forge/commands` 和治理页 `最近命令执行` 不只显示“最终放行责任链”，还直接显示：

- 放行细节
- 放行动作
- 最终放行来源

## Changes

- 在 `packages/core/src/selectors.ts` 的最近命令执行聚合中补齐：
  - `releaseClosureResponsibilityDetail`
  - `releaseClosureResponsibilityNextAction`
  - `releaseClosureResponsibilitySourceLabel`
- 在 `src/components/forge-governance-page.tsx` 中让 `最近命令执行` 优先消费这些结构化字段，避免继续从旧的 `releaseClosureDetail / nextAction / sourceLabel` 回退推断。
- 修正相关测试断言，使 archive 终态与 release prepare 审计阶段分别匹配正确语义。

## Result

命令审计层现在可以直接回答：

- 这次命令执行为什么还卡在最终放行链
- 下一步应该由谁接棒、做什么
- 当前责任链来源于哪条外部执行命令与运行

## Verification

- `npm test -- --run tests/forge-selectors.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
