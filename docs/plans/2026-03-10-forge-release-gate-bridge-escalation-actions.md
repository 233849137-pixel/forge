# 2026-03-10 Forge Release Gate Bridge Escalation Actions

## Goal

把 `bridgeHandoffStatus` 从 `releaseGate` 的总览字段推进到 `escalationActions` 本身，并让升级动作的 `nextAction` 按 `qa-handoff / release-candidate` 分流。

## Why

- 负责人已经能在 `readiness / releaseGate` 顶层看到 `bridgeHandoffStatus`
- 但 `releaseGate.escalationActions` 之前还是偏通用文案，动作本身还不能直接表达“当前已移交 QA”还是“已经进入放行候选”
- 这会让 `release.approve` 被阻断后的升级动作说明状态，却不能把整改动作精确落到 QA 或发布链

## Changes

- 给 `ForgeEscalationAction` 新增：
  - `bridgeHandoffStatus`
  - `bridgeHandoffSummary`
  - `bridgeHandoffDetail`
- `getReleaseGateEscalationActions()` 现在会把当前项目的 bridge handoff 状态附加到每条升级动作上
- 缺失证据动作的 `nextAction` 现在按 bridge handoff 状态分流：
  - `qa-handoff`
    - `测试报告 / Playwright 回归记录` 优先指向 `测试 Agent`
    - 其他放行缺口会明确要求等待 QA 收口后再补齐
  - `release-candidate`
    - `交付说明 / 放行评审结论` 优先指向 `发布 Agent`
- `getRemediationsForAI()` 里的 escalation entries 也同步透传 bridge handoff 结构化字段

## Verification

- `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
