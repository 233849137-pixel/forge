# Forge Release Approval Bridge Guidance

**Date:** 2026-03-10

## Goal

让 `release.approve` 在被阻断时，显式消费 `bridgeHandoffStatus`，避免负责人只看到“缺交付说明”却不知道 bridge-backed review 已经推进到了哪一段交付链。

## Completed

- `packages/ai/src/forge-ai.ts`
  - 新增 `getReleaseApprovalBridgeGuidance(...)`
  - `release.approve` 在以下阻断路径会显式带上 bridge handoff 指导语：
    - 存在 blocking escalation action
    - 缺少可确认的 `release-brief`
  - 现在会同时影响：
    - `execution.summary`
    - `decisions[].summary`
    - `task-...-release-escalation.summary`

## Verification

- `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`

## Next

- 把 `bridgeHandoffStatus` 继续前推到 `releaseGate.escalationActions` 的结构化动作选择
- 让 release escalation 的默认 `nextAction` 也能根据 `qa-handoff / release-candidate` 自动切换
