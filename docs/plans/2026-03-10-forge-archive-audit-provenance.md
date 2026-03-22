# 2026-03-10 Forge Archive Audit Provenance

## Context

Archive-stage `bridge writeback` 已经能把 `knowledge-card / release-audit` 写回正式工件面，但 `approvalTrace` 与工件页 `证据时间线` 仍然默认沿用 `review.run` 上下文。结果是：

- `release-audit` 在放行链里显示错误的 `sourceCommandId`
- 工件页只能看到泛化 runtime 摘要，不能直接回答“这条归档审计来自哪次 archive backend 执行”

这会把刚打通的 `archive.capture` 审计链重新冲淡。

## Implementation

- 在 `packages/core/src/selectors.ts` 新增共享 `artifactType -> command provenance` 映射：
  - `patch / demo-build -> command-execution-start`
  - `review-report -> command-review-run`
  - `test-report / playwright-run -> command-gate-run`
  - `release-brief / review-decision -> command-release-prepare`
  - `release-audit / knowledge-card -> command-archive-capture`
- `getApprovalTrace()` 现在对 artifact trace 按工件类型消费 provenance，`release-audit` 不再继承 `bridgeReviewContext`
- `getEvidenceTimeline()` 现在返回工件级 `sourceCommand* / relatedRun* / runtime*` 字段
- 工件页 `证据时间线` 现在显式显示 `来源命令 / 来源运行`
- 当 snapshot 缺少 `commands` 注册项时，selector 会用 fallback map 把 `command-archive-capture` 还原成正式命令名 `触发归档沉淀`

## Verification

- `npm test -- tests/forge-selectors.test.ts`
- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
