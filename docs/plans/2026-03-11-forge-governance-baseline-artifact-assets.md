# Forge Governance Baseline + Artifact Assets Cleanup

## Goal

继续沿 UI 主线减少负责人入口的顶层 panel 数量，把治理页和工件页下半区继续收成更少的主块。

## Scope

- `src/components/forge-governance-page.tsx`
- `src/components/forge-artifacts-page.tsx`
- `tests/forge-os-pages.test.tsx`

## Decisions

- 治理页新增顶层块 `治理基线`
  - 收口 `标准命令 / 策略 Hook / 策略判定 / 协作规则`
- 工件页新增顶层块 `工件资产`
  - 收口 `当前工件清单 / 最新 PRD 草案`
- 保留原二级标题，不改已有后端事实源，不新增新对象

## TDD

1. 先改 `tests/forge-os-pages.test.tsx`
2. 红测确认缺少 `治理基线 / 工件资产`
3. 再重构两个页面
4. 跑页面测试、全量测试、构建

## Result

- 治理页与工件页的顶层 panel 数量继续下降
- 负责人入口的层次更稳定：先判断，再看责任，再看基线/资产
- 页面测试、全量测试、Next build、Electron build 全绿
