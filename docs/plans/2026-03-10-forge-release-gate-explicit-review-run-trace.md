# Forge Release Gate Explicit Review Run Trace

## Goal
- 把 `command-review-run -> relatedRunId` 这条显式追溯链前推到 `readiness / releaseGate / escalationItems`
- 让 `qa-handoff` 和后续放行判断能直接指出“是哪次外部规则审查 run 推进了这次移交”

## Completed
- `command-review-run` 的显式 `relatedRunId` 现在不只存在于命令审计和最近执行里，也会进入 `releaseGate.bridgeReviewCommandId / bridgeReviewRunId / bridgeReviewRunLabel`
- `approvalTrace / escalationActions` 现在也会透传 `sourceCommandId / sourceCommandExecutionId / relatedRunId / relatedRunLabel / runtimeLabel`
- 整改式 `review.run` bridge writeback 现在会优先复用原始 `command-review-run` 记录，并回写 `relatedRunId`
- `readiness / command center / routes` 侧的顶层聚合继续保持一致，`escalationItems` 也会带这条显式 run 追溯

## Verification
- `npm test -- tests/forge-selectors.test.ts`
- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
