# Forge Governance Formal Artifact Gap

## Goal

把 `formalArtifactGap` 从首页/项目页继续前推到治理页，让 gate 负责人在 `放行闸口汇总` 第一屏就能看到正式工件缺口。

## Scope

- 治理页 `放行闸口汇总` 新增：
  - `正式工件缺口`
  - `补齐责任`
- 直接复用现有 `getFormalArtifactGapSummary(snapshot, projectId)`
- 不新增 `releaseGate` 子结构
- 不改 AI/API 契约

## Decisions

- 维持最窄方案：治理页只消费顶层已有事实源，不把 `formalArtifactGap` 再复制进 `releaseGate`
- `补齐责任` 沿用 `formalArtifactGap.nextAction ?? ownerLabel`
- 这批页面测试只验证治理页已纳入该事实源，不在治理页用例里重复断言已有的 `当前接棒`

## Verification

- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
