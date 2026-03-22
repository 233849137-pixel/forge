# Forge Open Source Launch Kit

This file is a practical launch pack for publishing Forge on GitHub.

## 1. Repository Profile

### Recommended repository name

- `forge`
- or `forge-local-delivery-os` if `forge` is unavailable

### Suggested GitHub description

`A local-first AI delivery control plane for turning customer requirements into structured project execution, evidence, and release workflows.`

### Suggested website / homepage

- Use the repository URL at first.
- Add a product page later only if you want a public landing page.

### Suggested topics

- `ai`
- `agentic-workflow`
- `local-first`
- `nextjs`
- `electron`
- `sqlite`
- `developer-tools`
- `project-management`
- `workflow-automation`
- `mcp`

## 2. README Positioning

When people land on the repo, they should understand three things quickly:

1. Forge is a control plane, not a chat toy.
2. The repository starts safely in demo mode.
3. Local integrations are optional, not required for first run.

If you refine the README later, keep the top section centered on:

- what Forge is
- what it does today
- how to run it in under 3 minutes

## 3. First Public Release

### Suggested tag

- `v0.1.0-alpha`

### Suggested release title

- `Forge v0.1.0-alpha: open-source first release`

### Suggested release notes

```md
## Highlights

- Local-first Forge control plane for AI delivery workflows
- Safe demo mode for first-time contributors
- Project workbench, asset management, execution, governance, and AI team surfaces
- Built-in CI, contribution guide, and security policy

## What works today

- Run the app locally with demo data
- Explore project workbench flows and formal artifacts
- Switch to local database mode with explicit configuration
- Extend execution backends and local integrations

## Notes

- This is an alpha open-source release
- Demo mode is the default public entry point
- Some advanced local integrations remain optional and environment-driven
```

## 4. Publish Checklist

Before pushing the public repository:

- [ ] confirm the remote repository is the intended public repo
- [ ] confirm `git status` does not include secrets or local-only files
- [ ] confirm `.env.local`, `data/forge.db`, and `data/workspaces/` are ignored
- [ ] run `npm test`
- [ ] run `npm run build`
- [ ] review README top section and Quick Start
- [ ] verify GitHub Actions is enabled after push
- [ ] add repository description and topics
- [ ] create the first tagged release

## 5. Suggested First Push Sequence

```bash
git add .
git commit -m "chore: prepare forge for open-source release"
git remote add origin <your-github-repo-url>
git push -u origin main
git tag v0.1.0-alpha
git push origin v0.1.0-alpha
```

## 6. Suggested Post-Launch Follow-Ups

- Add screenshots or a short demo GIF to the README
- Trim the README implementation deep-dive into a separate architecture doc
- Add a `CODEOWNERS` file if multiple maintainers join
- Consider a `docs/architecture.md` for external contributors
