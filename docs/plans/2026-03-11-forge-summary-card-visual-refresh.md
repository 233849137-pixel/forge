# Forge Summary Card Visual Refresh

## Goal

Make the four owner-facing views feel less like stacked default cards and more like a delivery control console.

## Change

- upgraded shared `SummaryGroup` into a dedicated summary card shell
- upgraded shared `SummaryList` rows from inline label/value layout to stacked editorial rows
- kept the existing information architecture intact; only changed the shared visual layer
- removed `沉淀清单` from home/project first screens so the visual refresh also reduced first-screen density

## Files

- `src/components/forge-os-shared.tsx`
- `app/globals.css`
- `src/components/forge-home-page.tsx`
- `src/components/forge-projects-page.tsx`
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
