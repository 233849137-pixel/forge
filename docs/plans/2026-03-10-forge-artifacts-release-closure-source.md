# Forge Artifacts Release Closure Source

## Goal

让工件页 `正式工件责任` 和首页、项目页、治理页保持同一条 `releaseClosure provenance` 口径，在第一屏直接显示 `最终放行来源`。

## Red

- 在 [tests/forge-os-pages.test.tsx](../../tests/forge-os-pages.test.tsx) 为工件页 `最终放行来源` 补充断言。
- 初次红测失败，原因不是页面实现缺字段，而是测试场景没有补齐 `archive.capture` 对应的 command execution 和 bridge run，预期却按 `archive-recorded` 终态断言。

## Green

- 在 [src/components/forge-artifacts-page.tsx](../../src/components/forge-artifacts-page.tsx) 的 `正式工件责任` 中补出 `最终放行来源` 行。
- 把工件页场景修正成真实的 `archive-recorded`：
  - 增加 `command-execution-retail-archive`
  - 增加 `run-retail-archive-bridge`
  - 将 `release.prepare` 的 follow-up 改成知识沉淀链

## Result

- 工件页第一屏现在也能直接回答“这次最终放行来自哪条外部执行链”。
- `releaseClosure` 的 provenance 在首页、项目页、工件页、治理页四个负责人入口已经对齐。

## Verification

```bash
npm test -- --run tests/forge-os-pages.test.tsx
npm test
npm run build
npm run build:electron
```
