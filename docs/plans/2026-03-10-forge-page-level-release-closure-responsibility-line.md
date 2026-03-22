# Forge Page-level Release Closure Responsibility Line

## Goal

把首页与治理页已有的 `最终放行摘要 / 放行细节 / 放行动作 / 最终放行来源` 再压成一条共享的 `最终放行责任链`，让负责人在第一屏直接看清发布链如何收口。

## Red

- 在 [tests/forge-home-page.test.tsx](../../tests/forge-home-page.test.tsx) 和 [tests/forge-os-pages.test.tsx](../../tests/forge-os-pages.test.tsx) 为首页、治理页补 `最终放行责任链` 断言。
- 红测确认页面尚未暴露这条统一摘要。

## Green

- 在 [src/components/forge-os-shared.tsx](../../src/components/forge-os-shared.tsx) 新增 `getReleaseClosureResponsibilityLine(...)`。
- 首页与治理页改为复用这条 helper，统一收口：
  - `最终放行摘要`
  - `当前动作`
  - `确认后接棒`
  - `归档接棒`
  - `最终放行来源`
- 同时过滤占位文案 `当前无需等待审批后接棒。`，避免把空责任链拼进摘要。

## Verification

```bash
npm test -- --run tests/forge-home-page.test.tsx
npm test -- --run tests/forge-os-pages.test.tsx
npm test
npm run build
npm run build:electron
```
