# Forge 项目页补齐 archive provenance

## 目标

- 让项目页作为负责人主入口，和首页、治理页、工件页保持一致的归档来源链可见性。
- 修复组件已支持 `archiveProvenance / currentHandoff provenance`，但项目页路由没有把顶层事实源透传进去的问题。

## 本批完成

- `ForgeProjectsPage` 新增并消费：
  - `archiveProvenanceSummary`
  - `archiveProvenanceDetail`
- 项目页路由现在会透传：
  - `approvalHandoffSummary / detail / nextAction`
  - `archiveProvenanceSummary / detail`
  - `currentHandoffSourceCommandLabel / relatedRunLabel / runtimeLabel`
- `交付就绪度` 现在会直接显示：
  - `归档接棒`
  - `归档来源`
  - `当前接棒来源运行`

## 结果

- `首页 / 项目页 / 治理页 / 工件页` 四个负责人入口现在都能读到同一条 archive provenance 责任链。
- 项目负责人不需要离开项目页，就能判断“当前归档沉淀来自哪次外部执行链、当前接棒又来自哪次运行”。
