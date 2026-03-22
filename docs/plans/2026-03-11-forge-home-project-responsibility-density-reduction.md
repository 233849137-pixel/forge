# Forge Home Project Responsibility Density Reduction

## Goal

Reduce first-screen density on the owner-facing home and project pages.

## Change

- home and project pages no longer expand `沉淀清单` in `正式工件责任`
- artifact accumulation detail remains on the artifacts page
- when there is no real approval chain, home and project pages no longer render empty `待人工确认 / 确认责任 / 确认后接棒`

## Result

The first screen now answers only:

- what has been accumulated
- what is still missing
- who should complete it

## Files

- `src/components/forge-home-page.tsx`
- `src/components/forge-projects-page.tsx`
- `src/components/forge-os-shared.tsx`
- `tests/forge-home-page.test.tsx`
- `tests/forge-projects-page.test.tsx`
- `tests/forge-os-pages.test.tsx`

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
