# Forge Evidence Audit Cluster

## Goal

把工件页 `证据与评审` 和治理页 `命令审计` 里的证据摘要块收成共享展示层，避免继续在两个页面手工堆 `SummaryGroup`。

## Completed

- 在 `src/components/forge-os-shared.tsx` 新增 `EvidenceAuditCluster`
- 工件页改为通过共享证据簇渲染：
  - `证据时间线`
  - `评审结果记录`
  - `通过条件`
- 治理页改为通过共享证据簇渲染：
  - `最近流转记录`
  - `最近命令执行`
- 新增页面回归，锁定：
  - `artifact-evidence-cluster`
  - `governance-audit-cluster`

## Verification

- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Next

- 继续把首页 `动作与执行` 和项目页 `任务与起盘` 往更少的共享展示层压
- 继续减少页面级块结构的手工组合
