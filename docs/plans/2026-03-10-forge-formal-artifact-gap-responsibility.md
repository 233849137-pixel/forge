# Forge Formal Artifact Gap Responsibility

## Goal

把“正式工件还缺什么、谁来补、下一步先做什么”从首页/项目页临时文案收成正式事实源，并同步进入顶层 AI/API 聚合。

## Scope

- 新增 core selector `getFormalArtifactGapSummary(snapshot, projectId)`
- 顶层聚合返回 `formalArtifactGap`
  - `control-plane`
  - `readiness`
  - `remediations`
  - `commands`
- 首页与项目页显示
  - `正式工件缺口`
  - `补齐责任`
- 统一 formal artifact gap 使用当前 `currentHandoff` 责任链，不再页面侧自行猜测 owner / next step

## Decisions

- `formalArtifactGap` 只回答正式工件缺口本身，不再复制 `formalArtifactCoverage`
- `ownerLabel / ownerRoleLabel / nextAction` 直接复用当前项目 `currentHandoff`
- 页面上的 `补齐责任` 直接显示 `nextAction`，不再额外拼接 owner，避免 `测试 Agent · 先由测试 Agent...` 这类重复文案
- 默认 fixture 下，正式工件缺口责任归口跟随当前 `gate-failure`
- bridge / handoff 场景下，正式工件缺口责任归口跟随真实 handoff 状态

## Verification

- `npm test -- tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx`
- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
