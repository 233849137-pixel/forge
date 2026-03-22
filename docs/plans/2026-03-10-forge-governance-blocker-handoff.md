# Forge Governance Blocker Handoff

## Goal

把治理页剩余的负责人动作入口继续收口，让 `风险与阻塞`、`自动升级动作` 和 `放行闸口汇总` 都复用同一套 bridge-aware handoff 逻辑。

## Why

- `放行闸口汇总` 已经开始复用共享 `getNextAction(...)`
- 但治理页里的 `风险与阻塞` 和 `自动升级动作` 仍然容易和负责人默认动作分叉
- 对 `bridge-backed review -> qa-handoff` 这条主线来说，治理后台必须稳定回答“当前由谁接棒”

## Scope

- `风险与阻塞` 新增显式 `当前接棒`
- `自动升级动作` 将 `下一步` 收成 `当前接棒`
- 测试覆盖治理页 bridge handoff 场景下的接棒文本

## TDD

1. 先让治理页 bridge handoff 场景对 `当前接棒` 形成红测
2. 再把治理页剩余两处动作入口收口到同一条 handoff 链
3. 收绿后补 README 和接手文档

## Result

- `放行闸口汇总`
- `风险与阻塞`
- `自动升级动作`

现在都开始共享同一套 bridge-aware 默认接棒逻辑。
