# Forge Chrome Shell Refresh

## Goal

Upgrade the shared app shell so the product no longer feels like a default dashboard with a side nav.

## Change

- rebuilt `ForgeChrome` into:
  - brand block
  - module navigation block
  - hero title block
  - signal cards
- kept all page-specific content blocks unchanged
- relied on shared shell and CSS so the four operator-facing pages refresh together

## Files

- `src/components/forge-chrome.tsx`
- `app/globals.css`

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm run build`
- `npm run build:electron`
