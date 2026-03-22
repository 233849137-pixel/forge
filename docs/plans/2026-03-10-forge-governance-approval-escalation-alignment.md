# Forge Governance Approval Escalation Alignment

## Goal

把治理页最后两块仍然依赖原始 task 列表的区域收口到结构化放行链上：

- `待人工确认`
- `升级事项`

## Why

- `放行闸口汇总 / 自动升级动作 / 风险与阻塞` 已经开始共享 bridge-aware handoff
- 但 `待人工确认` 和 `升级事项` 还停留在原始 task 摘要层
- 这会让治理后台出现两套责任链来源

## Scope

- `待人工确认` 改为复用 `releaseGateSummary.approvalTrace`
- `升级事项` 改为复用 `releaseGateSummary.escalationActions`
- 两个区域都显式显示 `当前接棒`

## TDD

1. 先让治理页 bridge handoff / release approval 场景对 `当前接棒` 形成红测
2. 让两个 section 改为复用结构化放行链
3. 收绿后补 README 和接手文档

## Result

治理页现在从放行总览到人工确认、升级摘要，都开始共享同一套结构化 handoff 责任链。
