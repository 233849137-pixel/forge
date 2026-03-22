# 2026-03-11 Forge Chrome + Home Shell V2

## Goal

Stop micro-tuning old card walls and move Forge toward a cleaner admin-shell layout inspired by modern dashboard structure.

## Scope

- `src/components/forge-chrome.tsx`
- `src/components/forge-home-page.tsx`
- `app/globals.css`
- `tests/forge-home-page.test.tsx`

## Change

- Reworked `ForgeChrome` into a stronger dashboard shell:
  - brand/navigation rail
  - sidebar signal card
  - top context strip
  - dedicated content area
- Reworked the home page into `main workspace + right action rail`.
- Added a regression test to lock the new `home-dashboard-shell / primary / secondary` layout.
- Shifted the visual language away from the earlier editorial-card wall toward a denser admin-shell hierarchy.

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
