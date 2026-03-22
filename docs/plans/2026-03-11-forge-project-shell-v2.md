# Forge Project Shell V2

## Goal

把项目页从“多块同权重 panel 顺排”改成和首页一致的 `主工作区 + 右侧操作轨`。

## Changes

- 新增：
  - `project-dashboard-shell`
  - `project-dashboard-primary`
  - `project-dashboard-secondary`
- 左轨保留：
  - `项目推进轨道`
  - `项目态势`
  - `责任与放行`
- 右轨收口：
  - `任务与起盘`
  - `阶段状态`

## Why

项目页需要先回答：

- 这个项目现在在哪一阶段
- 谁在接棒
- 当前责任链是否可继续推进

起盘、项目切换和状态维护应该退到右轨，不应继续和主责任链同权重并列。

## Verification

- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test -- tests/forge-home-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
