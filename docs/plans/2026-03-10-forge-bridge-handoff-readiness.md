# Forge Bridge Handoff Readiness

**Date:** 2026-03-10

## Goal

把 execution backend bridge 已经写回的 review 结果，继续前推到 `readiness / releaseGate / 项目页负责人视角`，让系统能直接回答：

- bridge-backed review 是否已经产出正式 `review-report`
- 是否已经把项目移交到 `QA gate`
- 是否已经进入 `release candidate`

## Completed

- `packages/core/src/selectors.ts`
  - 新增 bridge handoff 派生逻辑
  - `getDeliveryReadinessSummary()` 现在返回：
    - `bridgeHandoffStatus`
    - `bridgeHandoffSummary`
    - `bridgeHandoffDetail`
  - `getReleaseGateSummary()` 现在也返回同一组 bridge handoff 字段
- `packages/ai/src/forge-ai.ts`
  - `/api/forge/readiness` 透传新的 bridge handoff 字段，无需额外适配
- `src/components/forge-projects-page.tsx`
  - 项目页 `交付就绪度` 新增 `桥接移交`
  - 负责人可以直接看到 “已移交 QA 门禁 / 已进入放行链”
- 测试已补齐：
  - `tests/forge-selectors.test.ts`
  - `tests/forge-ai.test.ts`
  - `tests/forge-api-routes.test.ts`
  - `tests/forge-projects-page.test.tsx`

## Verification

- `npm test -- tests/forge-selectors.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts tests/forge-projects-page.test.tsx`

## Next

- 把 bridge handoff 状态继续前推到执行页 / 治理页的 gate 与 handoff 判断
- 让 release escalation action 也能直接解释 “当前 bridge 产出已经推进到哪条交付链”
