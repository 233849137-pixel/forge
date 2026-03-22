# 2026-03-10 Forge Page-Level Archive Provenance

## Context

上一批已经把 `archiveProvenance` 提升到了 `releaseGate` 和 `controlPlane / readiness` 顶层，但负责人页面第一屏仍然看不到这条归档来源链。这样虽然 API 已经能回答“哪次 `archive.capture` 写回了归档审计”，负责人还需要自己下钻。

## Implementation

- `ForgeHomePage`
  - `推进判断` 新增：
    - `归档接棒`
    - `归档来源`
- `ForgeGovernancePage`
  - `放行闸口汇总` 新增：
    - `归档接棒`
    - `归档来源`
- `app/page.tsx` 与 `app/[view]/page.tsx`
  - 开始把 `controlPlane.archiveProvenance.summary/detail` 透传到首页与治理页

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
