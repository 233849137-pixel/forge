# Forge Summary Group Tone System

## Intent

Continue the UI-only MVP cleanup by making the highest-signal summary groups visually distinct without changing backend facts.

## Changes

- Added a shared `tone` system to `SummaryGroup` with `neutral / signal / closure / provenance`.
- Applied `signal` tone to handoff-focused summary groups so the default next-step blocks read as operational cues.
- Applied `closure` tone to release-closure summary groups so final release responsibility reads as a distinct terminal state instead of another neutral list card.
- Applied `provenance` tone to archive/provenance groups on the artifacts page so origin-chain summaries separate visually from active responsibility blocks.

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
