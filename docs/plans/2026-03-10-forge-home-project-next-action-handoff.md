# 2026-03-10 Forge Home Project Next Action Handoff

## Goal

把 `bridge-aware remediation` 前推到首页和项目页的负责人摘要，让负责人不进入执行页也能知道当前默认接棒角色。

## Changes

- `getNextAction()` 现在会优先检查当前项目的整改队列
- 当存在 `bridgeHandoffStatus === "qa-handoff"` 的整改项时：
  - 首页 `推进判断 -> 下一步动作` 会直接指向测试 Agent 补齐 `测试报告 / Playwright 回归记录`
  - 项目页 `当前上下文` 也会显示同一条 bridge-aware next action
- 只有在没有 bridge-aware 整改链时，才回退到原来的阶段通用话术或门禁失败话术

## Verification

- `npm test -- tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
