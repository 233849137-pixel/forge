# Forge Review Handoff Bridge State

日期：2026-03-10

## 背景

在 `execution backend bridge/writeback` 已经把 Engineer 外部执行结果写回为正式 `patch / demo-build` 工件后，控制面此前仍只把这类状态归类为 `bridge-evidence`。这会让负责人视角缺少一个关键中间态：

- 研发执行已经完成
- Patch 与 Demo 已进入正式工件面
- 但规则审查还没有开始

这条责任链如果不被显式建模，首页、项目页、治理页只能给出宽泛的桥接提示，无法稳定回答“下一步谁接棒”。

## 本批实现

本批把这段中间态收成正式 `review-handoff`：

- `getBridgeHandoffState()` 新增 `review-handoff`
- 触发条件：
  - 项目存在外部 bridge run
  - `patch / demo-build` 已写回，且状态不为 `draft`
  - 尚未进入 `qa-handoff / release-candidate`
- `getCurrentHandoffSummary()` 在该状态下会统一返回：
  - `source = review-handoff`
  - `ownerLabel = 架构师 Agent`
  - `ownerRoleLabel = 架构师`
  - `nextAction = 先由架构师 Agent 发起规则审查并补齐规则审查记录`

## 影响范围

- `packages/core/src/types.ts`
- `packages/core/src/selectors.ts`
- `tests/forge-selectors.test.ts`
- `tests/forge-ai.test.ts`
- `README.md`
- `docs/plans/2026-03-09-forge-takeover-next-phase.md`

## 验证

本批完成后应满足：

- selector 级 readiness 能返回 `bridgeHandoffStatus = review-handoff`
- AI `getDeliveryReadinessForAI()` 能返回：
  - `readiness.bridgeHandoffStatus = review-handoff`
  - `currentHandoff.source = review-handoff`
- 负责人默认接棒从“泛桥接提示”收成“架构师 -> 规则审查”

## 后续

下一批继续沿主线推进：

- 把 `review-handoff` 进一步接到页面级负责人口径验证
- 让 `review.run` 的 adapter / bridge 结果与该中间态形成更直接的前后链路
