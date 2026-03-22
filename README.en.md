# Forge

[中文](./README.md) | [English](./README.en.md)

> An enterprise AI team control plane for turning customer requirements into structured delivery workflows.

Forge is a local-first AI delivery system for teams. Instead of treating delivery as a single chat session, it turns a project into a traceable workflow across intake, planning, implementation, verification, release, and knowledge capture.

![Forge Dashboard Preview](./.github/assets/forge-dashboard.png)

Forge is not mainly about making one agent "smarter". It is about operating an AI team in a structured way:

- Project control center: multi-project visibility, risk-first prioritization, clear owner actions
- AI team operations: role assignment, team templates, node handoff, role-specific execution
- Asset and knowledge accumulation: project artifacts, SOPs, reusable knowledge, workspace-linked context

## Why Forge

Most AI tools are good at generating output, but weak at managing delivery. Forge is designed as a delivery control plane rather than another general-purpose agent orchestrator.

With Forge, you can:

- turn a one-sentence customer request into a formal project
- organize delivery around projects, tasks, artifacts, gates, and execution evidence
- coordinate AI teammates, knowledge assets, and execution backends on one shared workflow
- keep the system local-first, auditable, and demo-friendly

Typical workflow:

`Intake -> PRD -> TaskPack -> Execution -> Review -> QA Gate -> Release Brief -> Human Approval -> Archive`

## Core Capabilities

### 1. Project Workbench

- dashboard, project management, and delivery tracking views
- node-based workbench: project control, requirement confirmation, prototype, UI design, engineering, demo testing, and release
- AI chat on the left, structured documents/results in the middle, workspace files on the right
- project-level workspace, project DNA, template injection, and formal artifact persistence

![Forge Project Workbench Preview](./.github/assets/forge-project-control.png)

### 2. Control Plane

- local SQLite persistence for projects, tasks, artifacts, command executions, gates, and evidence
- local HTTP APIs and MCP tools for desktop UI and external agents
- standard command chain: `prd.generate`, `taskpack.generate`, `execution.start`, `review.run`, `gate.run`, `release.prepare`, `archive.capture`
- unified remediation, replay, release gate, and evidence timeline

### 3. Runtime Plane

- runner registry and local runner CLI
- local Engineer / Reviewer / QA execution entry points
- external execution backend bridge for Nano, OpenClaw, or similar systems
- shared `prepare / dispatch / execute / bridge / writeback` contract for backend integration

### 4. Assets and Knowledge

- component registry and assembly suggestions
- example knowledge vault and workspace file browser
- formal artifact types such as `prd`, `task-pack`, `ui-spec`, `patch`, `review-report`, `test-report`, `release-brief`, and `knowledge-card`

## What You See in Forge

### Project Control Center

- the dashboard answers: what is in progress, what is risky, and what needs action next
- project overview and action lists are optimized for project leads, not just chat transcripts
- useful for multi-project coordination and status reporting

### AI Team and Node-Based Handoffs

- each project can bind a team template and node-level roles
- project managers get a cross-project view, while specialist AI teammates work inside their assigned nodes
- nodes are advanced step by step across a delivery chain instead of through one-shot generation

![Forge Team Builder Preview](./.github/assets/forge-team-builder.png)

![Forge Skill Library Preview](./.github/assets/forge-skill-library.png)

### Asset, Knowledge, and Reuse

- project outputs are persisted as structured assets instead of disappearing inside chat
- SOPs, reusable knowledge, workspace files, and artifact history become reusable inputs for later projects
- the system is designed to get stronger over time instead of starting from scratch each run

## Who Forge Is For

- small AI delivery teams
- internal tools teams
- AI outsourcing teams
- project leads who want to move from chat-driven execution to evidence-driven delivery

## Quick Start

### Requirements

- Node.js / npm
- macOS first

### Run Locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Default URL:

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

The repository defaults to demo mode, so you can open the dashboard and workbench without Nano, Obsidian, or a real skills environment.

### Common Commands

```bash
npm run dev
npm run build
npm run start
npm test
npm run electron:dev
npm run build:electron
npm run mcp:forge
```

Runner entry points:

```bash
npm run runner:forge
npm run runner:engineer
npm run runner:review
npm run runner:qa
```

## Data Modes

Forge supports two primary data modes:

- `demo`: default sample mode for first-time use, demos, and open-source setup
- `local`: uses your own local database

Key environment variables:

- `FORGE_DATA_MODE=demo|local|auto`
- `FORGE_DB_PATH=/absolute/path/to/forge.db`
- `NEXT_PUBLIC_FORGE_DEBUG_WORKSPACE_MAPPINGS=...`

If you only want to explore the workbench, start with `demo`.

## Nano / External Execution Backends

Forge is the control plane. It does not require one built-in executor. You can attach Nano, OpenClaw, or similar systems under the Runtime Plane.

The open-source repo already exposes this integration surface:

- `FORGE_NANO_EXEC_PROVIDER`
- `FORGE_NANO_EXEC_BACKEND`
- `FORGE_NANO_EXEC_BIN`
- `FORGE_NANO_HEALTHCHECK_COMMAND`
- `FORGE_NANO_MANAGE_COMMAND`

If none of these are configured, Forge still runs in demo mode with local fallback behavior.

## Public Interfaces

### Local HTTP API

Key endpoints include:

- `GET /api/forge/pages`
- `GET /api/forge/projects`
- `GET /api/forge/tasks`
- `GET /api/forge/remediations`
- `GET /api/forge/control-plane`
- `GET /api/forge/readiness`
- `GET /api/forge/runners`
- `POST /api/forge/commands`
- `POST /api/forge/remediations/retry`
- `POST /api/forge/execution-backends/prepare`
- `POST /api/forge/execution-backends/dispatch`
- `POST /api/forge/execution-backends/execute`
- `POST /api/forge/execution-backends/bridge`
- `POST /api/forge/execution-backends/bridge/writeback`

### MCP

```bash
npm run mcp:forge
```

The MCP server exposes projects, tasks, control-plane state, runners, artifacts, execution backends, and component assembly tools so external agents can consume Forge as a unified control surface.

## Repository Layout

```text
app/        Next.js App Router pages and APIs
src/        frontend components, bridges, and server assembly logic
packages/   AI, DB, core, model-gateway, and related packages
scripts/    Electron, MCP, Runner, and local backend bridge scripts
config/     runtime contracts and config
data/       local databases and workspace data
docs/       plans, release notes, and open-source materials
```

## Current Status

Forge is currently a usable public alpha:

- full local product shell, project workbench, and control plane
- MCP, runner CLI, and execution backend bridge already in place
- open-source safe demo mode works without external dependencies
- LICENSE, CI, contribution guide, and security docs are already included

Still early-stage:

- multi-user collaboration and cloud sync
- more complete automatic component assembly
- more mature prompt / skill feedback loops
- DMG signing, notarization, and auto-update
- fully connected real execution backends across the whole system

## Open Source Notes

- License: `Apache-2.0`
- Release: [v0.1.0-alpha](https://github.com/233849137-pixel/forge/releases/tag/v0.1.0-alpha)
- Demo mode is the recommended default experience
- If you want local debug links back, configure `NEXT_PUBLIC_FORGE_DEBUG_WORKSPACE_MAPPINGS` explicitly

## Contributing and Security

- Contribution guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: [SECURITY.md](./SECURITY.md)
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Launch kit: [docs/open-source-launch-kit.md](./docs/open-source-launch-kit.md)

Before opening a PR, please run:

```bash
npm test
npm run build
```
