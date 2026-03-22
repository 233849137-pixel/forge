# Changelog

All notable changes to this project will be documented in this file.

This project follows a lightweight, pre-`1.0` changelog style.

## [0.1.0-alpha] - 2026-03-22

### Added

- A local-first Forge control plane with project, execution, asset, team, governance, and workbench surfaces.
- A stable demo mode and local mode split for open-source startup.
- OSS-safe homepage behavior that can render without external skills, Obsidian, Nano, or local workspaces.
- Project workbench persistence for conversations, node selection, active tabs, and workspace drawer state.
- GitHub community files:
  - `CONTRIBUTING.md`
  - `SECURITY.md`
  - issue templates
  - pull request template
  - CI workflow

### Changed

- Public demo copy, placeholders, and seeded sample data were normalized for open-source presentation.
- Local debug page mappings were moved behind explicit environment configuration.
- Knowledge-base defaults were renamed to a generic `Knowledge Vault` / `forge-knowledge-vault` convention.

### Fixed

- Production build blockers in selector and agent-context typing paths.
- Homepage fallback behavior when real-skill hydration is unavailable.
- Open-source startup stability when local-only dependencies are missing.

