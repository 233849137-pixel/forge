# Forge Section Panel Region Shell Refresh

## Intent

Continue the UI-only MVP cleanup without changing backend facts. This batch focuses on shared panel structure and workflow rail shell so the major page blocks stop reading like interchangeable cards.

## Changes

- Upgraded `SectionPanel` into a labeled `region` using `aria-labelledby`, so major page sections are now queryable and screen-reader friendly.
- Split the shared panel header into `panel-head-copy` and `panel-head-meta`, giving every section a stronger title and badge hierarchy.
- Refreshed the shared `panel` shell with a top accent, stronger surface treatment, and clearer separation from nested `subpanel` cards.
- Refreshed `workflow-rail` to read like a dedicated delivery track instead of another generic card band.

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
