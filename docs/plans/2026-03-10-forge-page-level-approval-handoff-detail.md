# Forge Page-Level Approval Handoff Detail

**Date:** 2026-03-10

## Goal

把已经进入顶层聚合的 `approvalHandoff` 真正推到首页与治理页第一屏，减少页面继续从嵌套 `formalArtifactResponsibility` 手工拼接“确认后接棒”文案。

## Completed

- 首页现在支持直接消费顶层 `approvalHandoffSummary / approvalHandoffDetail`
- 治理页现在支持直接消费顶层 `approvalHandoffSummary / approvalHandoffDetail`
- 首页与治理页第一屏都新增 `接棒细节`
- `app/page.tsx` 与 `app/[view]/page.tsx` 已直接透传顶层 `controlPlane.approvalHandoff`

## Verification

- `npm test -- --run tests/forge-home-page.test.tsx tests/forge-os-pages.test.tsx`
