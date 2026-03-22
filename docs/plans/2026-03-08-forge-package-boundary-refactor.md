# Forge Package Boundary Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 Forge 从单体源码结构拆成可持续扩展的能力边界，为后续 Runner、TaskPack、版本历史和多人协作打基础。

**Architecture:** 首先建立 `packages/core`、`packages/db`、`packages/ai` 三个稳定能力层，再让页面、API、测试逐步切到新边界。旧的 `src/lib/*` 与 `src/types/*` 只保留兼容 shim，避免一次性大迁移带来桌面端回归。

**Tech Stack:** Next.js 15、Electron、Vitest、better-sqlite3、TypeScript

---

### Task 1: 建立稳定能力边界

**Files:**
- Create: `../../packages/core/src/index.ts`
- Create: `../../packages/core/src/types.ts`
- Create: `../../packages/core/src/selectors.ts`
- Create: `../../packages/db/src/index.ts`
- Create: `../../packages/db/src/forge-db.ts`
- Create: `../../packages/ai/src/index.ts`
- Create: `../../packages/ai/src/forge-ai.ts`
- Test: `../../tests/forge-packages.test.ts`

**Step 1: 写失败测试**
- 断言 `packages/core`、`packages/db`、`packages/ai` 都能被导入，并导出关键能力。

**Step 2: 跑测试确认变红**
- Run: `npm test -- tests/forge-packages.test.ts`

**Step 3: 建立三层包结构**
- `core` 承载类型和 selectors。
- `db` 承载 SQLite 和项目工作区初始化。
- `ai` 承载 HTTP/MCP 共用的 AI 服务层。

**Step 4: 再跑测试确认转绿**
- Run: `npm test -- tests/forge-packages.test.ts`

### Task 2: 切换运行入口到新边界

**Files:**
- Modify: `../../app/page.tsx`
- Modify: `../../app/actions.ts`
- Modify: `../../app/api/forge/assets/route.ts`
- Modify: `../../app/api/forge/gates/route.ts`
- Modify: `../../app/api/forge/prd/route.ts`
- Modify: `../../app/api/forge/projects/route.ts`
- Modify: `../../app/api/forge/projects/active/route.ts`
- Modify: `../../app/api/forge/prompts/route.ts`
- Modify: `../../app/api/forge/snapshot/route.ts`
- Modify: `../../app/api/forge/templates/route.ts`
- Modify: `../../src/components/app-shell.tsx`

**Step 1: 把页面、Server Action、API 路由切到 packages**

**Step 2: 保留 shim**
- `../../src/lib/forge-db.ts`
- `../../src/lib/forge-ai.ts`
- `../../src/lib/forge-selectors.ts`
- `../../src/types/forge.ts`

**Step 3: 跑核心回归**
- Run: `npm test -- tests/forge-db.test.ts tests/forge-ai.test.ts tests/forge-selectors.test.ts`

### Task 3: 修复开发链路回归

**Files:**
- Create: `../../scripts/lib/dev-server.mjs`
- Modify: `../../scripts/electron-dev.mjs`
- Test: `../../tests/electron-dev-runtime.test.ts`

**Step 1: 写失败测试**
- 断言开发端口可用时复用现有服务，不可用时再拉起 Next。

**Step 2: 跑测试确认变红**
- Run: `npm test -- tests/electron-dev-runtime.test.ts`

**Step 3: 实现端口复用逻辑**

**Step 4: 跑测试确认转绿**
- Run: `npm test -- tests/electron-dev-runtime.test.ts`

### Task 4: 全量验证

**Files:**
- Test: `../../tests`

**Step 1: 跑全量单测**
- Run: `npm test`

**Step 2: 跑 Next 生产构建**
- Run: `npm run build`

**Step 3: 跑 Electron 构建**
- Run: `npm run build:electron`

**Step 4: 冷启动桌面端**
- Run: `npm run electron:dev`

### 下一阶段

1. 继续拆 `packages/workflow`，把节点判断逻辑从页面层移出。
2. 新建 `packages/runner`，承载 Codex / Claude / Playwright 的真实执行。
3. 把 `TaskPack`、`Run`、`Artifact` 变成正式数据模型，而不是只挂在页面文案上。
