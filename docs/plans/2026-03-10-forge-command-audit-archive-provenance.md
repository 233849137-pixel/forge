# Forge Command Audit Archive Provenance

## Goal

把 `archiveProvenance` 从顶层放行/归档摘要继续前推到 `recentExecutions` 命令审计层，让命令中心和治理页最近执行记录也能直接回答：

- 哪次 `archive.capture` 写回了归档审计
- 当前归档沉淀最初来自哪次 `release.prepare`

## Implementation

- 在 `packages/core/src/selectors.ts` 为 `getRecentCommandExecutions()` 增加 `archiveProvenanceSummary / archiveProvenanceDetail`
- 仅对 `archive.capture` 命令执行注入这组字段，复用 `getArchiveProvenanceSummary(...)`
- 在治理页 `最近命令执行` 中显式展示 `归档接棒 / 归档来源`
- 让 AI 聚合与 `/api/forge/commands` 自然透传这组字段，不新增旁路结构

## Verification

- `npm test -- --run tests/forge-selectors.test.ts`
- `npm test -- --run tests/forge-ai.test.ts`
- `npm test -- --run tests/forge-api-routes.test.ts`
- `npm test -- --run tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
