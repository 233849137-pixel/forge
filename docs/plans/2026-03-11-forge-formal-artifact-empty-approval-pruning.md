# Forge Formal Artifact Empty Approval Pruning

## Goal

Reduce operator-facing UI noise in the four owner pages without changing backend facts.

## Change

- keep `正式工件责任` focused on `沉淀 / 缺口 / 补齐责任`
- only render `待人工确认 / 确认责任 / 确认后接棒 / 接棒细节 / 接棒动作` when there is a real approval chain
- preserve explicit `approvalHandoff*` overrides when approval state exists

## Files

- `src/components/forge-os-shared.tsx`
- `tests/forge-home-page.test.tsx`
- `tests/forge-projects-page.test.tsx`
- `README.md`
- `docs/plans/2026-03-09-forge-takeover-next-phase.md`

## Verification

- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`
