# Forge Governance Responsibility Cluster

## Goal

把治理页 `责任与升级` 里的审批、升级、风险、人工确认、升级事项收成共享展示层，避免治理页继续手工堆叠五块责任卡。

## Completed

- 在 `src/components/forge-os-shared.tsx` 新增 `GovernanceResponsibilityCluster`
- 治理页改为通过共享治理责任簇渲染：
  - `放行审批链`
  - `自动升级动作`
  - `风险与阻塞`
  - `待人工确认`
  - `升级事项`
- 新增治理页回归，锁定 `责任与升级` 区已经使用独立 `governance-responsibility-cluster` 展示层

## Verification

- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Next

- 继续把治理页和首页/项目页/工件页剩余的责任摘要压进更少的共享展示层
- 继续减少页面级字符串拼接和块级手工组合
