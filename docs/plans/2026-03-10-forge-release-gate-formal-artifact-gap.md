# Forge Release Gate Formal Artifact Gap

## Goal

把 `formalArtifactGap` 从顶层聚合继续收进 `releaseGate`，让 gate 视角、治理页和 `readiness` 都消费同一份正式工件缺口事实源。

## Scope

- `getReleaseGateSummary(snapshot, projectId)` 直接返回 `formalArtifactGap`
- `buildGovernanceResponsibilitySummary(...)` 改成复用 `releaseGate.formalArtifactGap`
- 治理页改成从 `releaseGateSummary.formalArtifactGap` 读取 `正式工件缺口 / 补齐责任`
- 不新增新的 top-level 聚合对象

## Decisions

- `formalArtifactGap` 的 `补齐责任` 不再盲目沿用任务队列的缺件文案
- 当 bridge handoff 已进入 `review-handoff / qa-handoff / release-candidate` 时，统一输出规范化 handoff 责任文案
- 这样 `releaseGate.formalArtifactGap` 可以稳定代表 gate 阶段的“还缺什么正式工件，谁来补”

## Verification

- `npm test -- tests/forge-selectors.test.ts`
- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
