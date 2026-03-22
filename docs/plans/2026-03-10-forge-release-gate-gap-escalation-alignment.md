# Forge Release Gate Gap Escalation Alignment

## Goal

把 `releaseGate.escalationActions` 里“正式工件缺失”的默认责任动作，和 `formalArtifactGap / currentHandoff` 收成同一套 handoff 文案。

## Scope

- `getReleaseGateEscalationActions(...)` 新增 `formalArtifactGap` 输入
- 仅对 `missingItems` 中属于正式工件缺口的项复用 `formalArtifactGap.ownerLabel / ownerRoleLabel / nextAction`
- 门禁失败项、运行时阻塞项维持原有分流逻辑

## Decisions

- `交付说明 / 放行评审结论` 这类正式工件缺失项不再默认回退到 `产品经理 Agent`
- 当处于 `qa-handoff` 时，这些缺失项应跟随 `测试 Agent -> 补齐测试报告 / Playwright 回归记录`
- 当处于 `release-candidate` 时，这些缺失项应跟随 `发布 Agent -> 收口交付说明 / 放行评审结论`
- 非正式工件缺失项仍继续使用原有 `getReleaseGateEscalationNextAction(...)`

## Verification

- `npm test -- tests/forge-selectors.test.ts`
- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
