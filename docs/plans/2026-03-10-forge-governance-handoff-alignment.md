# Forge Governance Handoff Alignment

## Goal

把负责人视角里关于 `qa-handoff` 的默认接棒链继续收口，确保首页、项目页、治理页不再各自从不同来源推导下一步动作。

## Why

- 首页和项目页已经复用 `getNextAction(...)`，但治理页的 `放行闸口汇总` 仍然直接读取 `releaseGate.escalationActions[0]`
- 一旦 escalation 数组顺序变化，治理页就会显示错误的默认接棒对象
- 对 `bridge-backed review -> qa-handoff` 这条主线来说，负责人入口必须统一回答“先由谁接棒”

## Scope

- 首页 `阻塞与风险` 显式显示 `当前接棒`
- 治理页 `放行闸口汇总` 改为复用共享 `getNextAction(...)`
- 保留 release gate escalation 的结构化 bridge handoff 字段，不再依赖数组顺序推导负责人动作

## TDD

1. 先让 `tests/forge-home-page.test.tsx` 和 `tests/forge-os-pages.test.tsx` 对 `当前接棒` 形成红测
2. 让治理页改为走共享默认动作链而不是 `escalationActions[0]`
3. 收绿后补 README 和接手文档

## Result

- 首页 `阻塞与风险` 现在会显式显示 `当前接棒`
- 治理页 `放行闸口汇总` 现在也会显式显示 `当前接棒`
- 三个负责人入口现在共享同一条 bridge-aware handoff 口径：
  - 首页
  - 项目页
  - 治理页
