# 2026-03-11 Forge Overview Signal Cluster

## Goal

Reduce another layer of page-level manual composition by moving the home/projects two-column overview blocks onto a shared display component.

## Scope

- `src/components/forge-os-shared.tsx`
- `src/components/forge-home-page.tsx`
- `src/components/forge-projects-page.tsx`
- `tests/forge-home-page.test.tsx`
- `tests/forge-projects-page.test.tsx`

## Change

- Added `OverviewSignalCluster` as a shared display layer for the operator-facing two-column overview sections.
- Switched home `总览判断` from hand-built `SummaryCluster + SummaryGroup` composition to the shared overview cluster.
- Switched projects `项目态势` from hand-built `SummaryCluster + SummaryGroup` composition to the shared overview cluster.

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
