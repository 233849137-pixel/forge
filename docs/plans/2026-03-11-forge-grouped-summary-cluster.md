# 2026-03-11 Forge Grouped Summary Cluster

## Goal

Continue reducing page-level hand-built summary stacks by moving repeated vertical `SummaryGroup` compositions onto a shared display component.

## Scope

- `src/components/forge-os-shared.tsx`
- `src/components/forge-artifacts-page.tsx`
- `src/components/forge-governance-page.tsx`
- `tests/forge-os-pages.test.tsx`

## Change

- Added `GroupedSummaryCluster` as a shared display layer for stacked summary group sections.
- Switched artifacts `工件总览` onto the shared grouped cluster.
- Switched governance `治理基线` summary stack onto the shared grouped cluster while keeping `协作规则` as a dedicated subpanel.

## Verification

- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
