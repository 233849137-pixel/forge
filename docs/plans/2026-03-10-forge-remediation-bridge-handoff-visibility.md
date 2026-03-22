# 2026-03-10 Forge Remediation Bridge Handoff Visibility

## Goal

把 `bridgeHandoff` 从 release gate 升级动作继续下沉到整改任务项和执行页整改回放，让统一整改入口也能直接说明“当前是否已移交 QA”。

## Changes

- `getTaskDispatchQueue()` 现在会把项目级 `bridgeHandoffStatus / bridgeHandoffSummary / bridgeHandoffDetail` 附加到任务派发项
- `getRemediationTaskQueue()` 继续透传这组字段，所以执行页和 AI remediations 都能直接使用
- `getRemediationsForAI()` 的 task 项现在也会返回同一组 bridge handoff 字段
- 执行页 `整改回放` 现在会直接显示：
  - `桥接移交`
  - `移交细节`

## Verification

- `npm test -- tests/forge-selectors.test.ts tests/forge-api-routes.test.ts tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
