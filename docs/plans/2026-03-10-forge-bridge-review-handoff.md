# Forge Bridge Review Handoff

**Date:** 2026-03-10

## Goal

让 `review backend bridge writeback` 不只落地 `review-report` 和 run evidence，还能真正触发 QA 接棒，把外部 backend 审查结果推进到下一阶段。

## Scope

- `packages/ai/src/forge-ai.ts`
- `tests/forge-ai.test.ts`

## Completed

- 抽出共享 helper，把标准 `review.run` 成功后的 QA handoff 收成单一逻辑
- `writebackExecutionBackendBridgeRunForAI()` 在 `review.run + bridgeStatus=executed` 时会复用这份 handoff
- bridge review 成功后现在会自动生成 `task-...-qa-gate` 并把项目推进到 `测试验证`

## Verification

- `npm test -- tests/forge-ai.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
- `node --check scripts/forge-mcp.mjs`
