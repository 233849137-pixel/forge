# Forge Control Plane Handoff Summary

**Date:** 2026-03-10

## Goal

把已经在首页、项目页、治理页收紧过的 `当前接棒 / 待人工确认 / 升级事项` 责任链，下沉成外部 Agent 也能直接读取的结构化 control-plane 事实源。

## Completed

- 在 `packages/core/src/selectors.ts` 新增共享 selector `getCurrentHandoffSummary()`，统一承接：
  - `qa-handoff`
  - `release-candidate`
  - `gate-failure`
  - `stage-default`
- `src/components/forge-os-shared.tsx` 的 `getNextAction()` 已改为复用共享 selector，负责人默认动作不再只存在于页面层。
- `packages/ai/src/forge-ai.ts` 新增治理责任链聚合，`buildControlPlaneSnapshot()` 现在会直接返回：
  - `currentHandoff`
  - `pendingApprovals`
  - `escalationItems`
- `pendingApprovals` 与 `escalationItems` 直接复用 `releaseGate.approvalTrace / escalationActions`，并补齐统一的 bridge handoff 字段。

## Verification

- `npm test -- tests/forge-selectors.test.ts tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Next

- 把这组结构化 handoff 责任链继续前推到 `commands / readiness / remediations` 的顶层摘要，减少调用方对嵌套 `controlPlane` 的依赖。
- 在保持 Forge 只做交付控制面的前提下，继续把 `execution backend bridge` 推向更真实的 adapter executor。
