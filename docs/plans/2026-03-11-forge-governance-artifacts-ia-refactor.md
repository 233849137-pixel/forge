# Forge Governance + Artifacts IA Refactor

## Goal

在冻结现有后端事实源的前提下，继续推进负责人入口的 UI 信息架构重构，把治理页和工件页收成更少、更稳、更易判断的顶层分组。

## Scope

- `src/components/forge-governance-page.tsx`
- `src/components/forge-artifacts-page.tsx`
- `src/components/forge-os-shared.tsx`
- `tests/forge-os-pages.test.tsx`

## Decisions

- 治理页顶层重组为 `放行判断 / 责任与升级 / 命令审计`
- 工件页顶层重组为 `工件总览 / 责任与来源 / 证据与评审`
- 原有 `放行闸口汇总 / 放行审批链 / 自动升级动作 / 风险与阻塞 / 待人工确认 / 升级事项 / 最近命令执行 / 待接棒队列 / 正式工件责任 / 归档接棒 / 正式来源链 / 证据时间线 / 评审结果记录 / 通过条件` 保留为二级分组标题
- 不新增后端概念，不改 selector / AI 事实源，只调整 operator-facing 排列层

## TDD

1. 先改 `tests/forge-os-pages.test.tsx`
2. 确认红测失败，缺少 `工件总览 / 责任与来源 / 证据与评审 / 放行判断 / 责任与升级 / 命令审计`
3. 再重构治理页和工件页
4. 跑页面测试、全量测试、构建

## Result

- 治理页和工件页已经切到新的顶层分组
- 四个负责人入口继续共享 `SummaryGroup`、`getResolvedFormalArtifactResponsibilityView(...)`、`getResolvedReleaseClosureView(...)`、`getFormalArtifactResponsibilitySummaryItems(...)`
- 页面测试、全量测试、Next build、Electron build 全绿
