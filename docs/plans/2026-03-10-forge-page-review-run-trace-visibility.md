# 2026-03-10 Forge Page Review Run Trace Visibility

## Goal

把 `bridgeReviewRunId / bridgeReviewRunLabel / bridgeReviewCommandId` 这组显式追溯，从 `readiness / releaseGate / escalationItems` 的结构化数据，推进到负责人页面层。

## Completed

- 项目页 `交付就绪度` 现在会显示 `审查来源运行`，直接回答这次 QA 接棒来自哪次外部审查运行。
- 治理页 `放行闸口汇总 / 放行审批链 / 自动升级动作 / 待人工确认 / 升级事项` 现在都会显式显示 `审查来源运行 / 来源命令`。
- 页面测试改为验证“存在至少一条有效 trace”，避免因为同页多处复用同一段追溯信息而出现过宽断言误报。

## Files

- `src/components/forge-projects-page.tsx`
- `src/components/forge-governance-page.tsx`
- `tests/forge-projects-page.test.tsx`
- `tests/forge-os-pages.test.tsx`
- `README.md`
- `docs/plans/2026-03-09-forge-takeover-next-phase.md`

## Verification

- `npm test`
- `npm run build`
- `npm run build:electron`
