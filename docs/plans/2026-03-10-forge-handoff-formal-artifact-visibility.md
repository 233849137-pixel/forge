# 2026-03-10 Forge Handoff Formal Artifact Visibility

## Goal

把首页与项目页已经建立的 `正式工件沉淀 / 沉淀清单`，再前推到 `当前接棒 / 下一步动作` 负责人口径里，让负责人在第一屏判断动作时就能同时看到“已经沉淀出什么”。

## Changes

- 在 `../../src/components/forge-os-shared.tsx` 的 `ProjectContext` 中新增 `formalArtifactHint`，项目页当前上下文现在可直接显示 `当前沉淀：...`。
- 在 `../../src/components/forge-projects-page.tsx` 中，把 `getFormalArtifactCoverageSummary(...)` 的结果前推到 `ProjectContext`，使 `当前阶段` 卡片同时呈现 `默认回放 / 当前沉淀 / 默认外部执行`。
- 在 `../../src/components/forge-home-page.tsx` 的动作卡 `support-copy` 中追加 `当前沉淀：...`，让负责人在“执行前提 / 接管建议”旁边也能直接看到正式工件沉淀状态。
- 已同步更新 `../../tests/forge-home-page.test.tsx`、`../../tests/forge-projects-page.test.tsx`、`../../README.md`、`../../docs/plans/2026-03-09-forge-takeover-next-phase.md`。

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
