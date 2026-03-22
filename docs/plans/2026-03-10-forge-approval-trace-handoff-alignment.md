# Forge Approval Trace Handoff Alignment

## Goal

把 `approvalTrace` 里的 `release-brief / review-decision` 默认动作，和当前 `handoff` / 人工审批任务收成一条连续责任链。

## Scope

- `getApprovalTrace(...)` 的正式 release 工件项改为：
  - 若已创建 `release approval` 任务，则统一指向该人工审批动作
  - 若尚未进入人工审批，则跟随 `currentHandoff.nextAction`
- 不改 `release-audit / knowledge-card`
- 不改 `escalationActions` 之外的其他顶层聚合

## Decisions

- `release-brief / review-decision` 不应在人工审批前就提前跳到“等待归档沉淀”
- `release-candidate` 时，审批链条应保持和当前 handoff 一致：先由发布 Agent 收口交付说明 / 放行评审结论
- `approval` 时，两者再统一回到 `release approval task`

## Verification

- `npm test -- tests/forge-selectors.test.ts`
- `npm test -- tests/forge-ai.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
