# Forge Archive Handoff Provenance

**Date:** 2026-03-10

## Goal

把 `归档复用` 阶段的 `currentHandoff` 从“只知道谁接棒、怎么执行”推进到“还能直接追溯这次接棒来自哪次 `release.prepare` 外部执行”。

## Completed

- `getCurrentHandoffSummary()` 现在会在 archive 阶段复用 `command-release-prepare` 的命令上下文，显式返回：
  - `sourceCommandExecutionId`
  - `sourceCommandId`
  - `sourceCommandLabel`
  - `relatedRunId`
  - `relatedRunLabel`
  - `runtimeLabel`
- `getProjectCommandContext()` 现在对 `release.prepare / release.approve` 的相关运行采用命令类型打分，而不是按标题粗排：
  - 优先命中 `outputMode=release`
  - 其次命中 `title=交付说明`
  - 再其次才是执行器名里的通用“交付”信号
- 项目页与治理页新增 `当前接棒来源运行`，会同时显示：
- 首页、项目页、执行页、治理页现在都会显式显示 `当前接棒来源运行`，会同时显示：
  - 关联运行标签
  - `来源命令：...`
  - `Runtime` 标签

## Why

之前 archive handoff 已能显示默认外部执行入口，但负责人还看不到这次知识沉淀接棒是由哪次交付说明整理推进出来的。  
这会让 `approval -> archive.capture` 责任链在页面层断掉，也让外部 Agent 必须回到 runs/commands 自己做二次追溯。

## Verification

- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
