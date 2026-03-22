# Forge Governance Release Decision Cluster

## Goal

把治理页 `放行判断` 从一条超长摘要清单拆成更清晰的三层结构：

- `闸口判断`
- `执行链信号`
- `最终放行责任链`

不新增后端字段，只重排展示层。

## Changes

- 在 `src/components/forge-os-shared.tsx` 新增共享 `ReleaseDecisionCluster`
- 在 `src/components/forge-governance-page.tsx` 中，把原 `放行闸口汇总` 改成：
  - `闸口判断`
  - `执行链信号`
  - `最终放行责任链`
- 保留现有 labels 和事实源：
  - `releaseGateSummary`
  - `formalArtifactResponsibility`
  - `releaseClosureResponsibility`
  - `archiveProvenance`

## Verification

- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test -- tests/forge-home-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
