# Forge Workbench Panel Cluster

## Goal

把首页 `动作与执行` 和项目页 `任务与起盘` 里的工作区卡片壳层收成共享展示层，避免每个页面手工写 `summary-card-grid` 外壳。

## Completed

- 在 `src/components/forge-os-shared.tsx` 新增 `WorkbenchPanelCluster`
- 首页改为通过共享工作区簇承载：
  - `当前动作`
  - `执行快照`
- 项目页改为通过共享工作区簇承载：
  - `交付判断`
  - `当前项目集`
  - `5 分钟起盘`
  - `起盘后自动注入`
  - `项目任务清单`
- 新增页面回归，锁定：
  - 首页 `动作与执行` 区使用 `workbench-panel-cluster`
  - 项目页 `任务与起盘` 区使用 `workbench-panel-cluster`

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Next

- 继续把首页 `后台入口 / 推进队列` 与项目页 `任务与起盘` 的剩余壳层组合收得更统一
- 继续减少页面层对 `subpanel` 结构的手工重复
