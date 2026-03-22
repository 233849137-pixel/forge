# Forge Release Closure Dedicated Groups

**Date:** 2026-03-11 01:35:41 CST

## Goal

把 `最终放行责任链` 从 `正式工件责任` 的长清单里拆出来，变成首页、项目页、工件页的独立摘要分组，继续降低前台页面的信息缠绕。

## Changes

- 在 `src/components/forge-os-shared.tsx` 新增 `getReleaseClosureSummaryItems(...)`
- 首页 `责任与放行` 改成三块：
  - `当前接棒`
  - `正式工件责任`
  - `最终放行责任链`
- 项目页 `责任与放行` 改成三块：
  - `当前责任`
  - `正式工件责任`
  - `最终放行责任链`
- 工件页 `责任与来源` 改成四块：
  - `正式工件责任`
  - `最终放行责任链`
  - `归档接棒`
  - `正式来源链`

## Why

- 之前 `正式工件责任` 同时承载了：
  - 工件沉淀
  - 工件缺口
  - 人工确认
  - 最终放行终态
- 这会让负责人在同一块列表里混读“还缺什么”和“已经怎么收口”，前端看起来会更乱。
- 这次拆分后，`正式工件责任` 回到“工件和责任”，`最终放行责任链` 回到“放行终态和来源链”。

## Verification

- `npm test -- tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
