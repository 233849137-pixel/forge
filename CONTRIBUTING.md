# Contributing to Forge

Thanks for helping improve Forge.

## Getting Started

```bash
cp .env.example .env.local
npm install
npm run dev
```

- Default mode is `demo`, which is safe for first-time contributors.
- Use `FORGE_DATA_MODE=local` or `FORGE_DB_PATH=/absolute/path/to/db` only when you intentionally want to work against a local database.

## Development Workflow

1. Make focused changes.
2. Add or update tests for behavior changes.
3. Run the local verification commands before opening a PR.

Recommended verification:

```bash
npm test
npm run build
```

## Contribution Guidelines

- Do not commit secrets, local database files, generated workspaces, or machine-specific paths.
- Keep the default demo experience public-safe and reproducible.
- Prefer small pull requests with a clear purpose.
- If you change UX or contracts, update the relevant tests and docs in the same PR.

## Pull Request Checklist

- [ ] I ran `npm test`
- [ ] I ran `npm run build`
- [ ] I did not commit local-only files or secrets
- [ ] I updated docs/tests where behavior changed

