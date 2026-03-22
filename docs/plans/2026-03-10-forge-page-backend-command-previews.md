# Forge Page Backend Command Previews

**Goal:** 把已经在整改入口可用的 `runtimeExecutionBackendCommandPreview` 前推到控制面快照和页面层，让执行负责人、治理负责人和外部 Agent 在同一份视图里直接看到默认 backend command。

**Architecture:** 继续复用 AI 层已经完成的 preview helper，不新增持久化状态。`buildControlPlaneSnapshot()` 直接把 preview 透传到 `remediationQueue / recentExecutions.followUpTasks`；执行页和治理页优先使用 AI 聚合后的整改队列数据，页面只负责显示，不自行拼接命令模板。

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`
- Modify: `src/components/forge-execution-page.tsx`
- Modify: `src/components/forge-governance-page.tsx`
- Modify: `app/[view]/page.tsx`
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-api-routes.test.ts`
- Modify: `tests/forge-os-pages.test.tsx`
- Modify: `README.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`

## Completed

1. `buildControlPlaneSnapshot()` 现在会在 `remediationQueue` 与 `recentExecutions.followUpTasks` 里透传 `runtimeExecutionBackendCommandPreview`。
2. `ForgeExecutionPage` 新增 `remediationQueueItems` 接线，`整改回放` 已开始直接显示 `后端命令预览：...`。
3. `ForgeGovernancePage` 新增 `remediationQueueItems` 接线，`整改队列` 已开始直接显示同一份 preview。
4. `[view]/page.tsx` 现在会把 `controlPlane.remediationQueue` 透传给执行页和治理页，页面不再依赖 snapshot selector 自行猜 backend command。
5. AI / API / Page 测试已覆盖 review remediation 场景，确认 OpenClaw review backend 的 preview 能贯通到控制面和页面。
6. README 与 takeover 文档已同步。

## Verification

- `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，backend command preview 不再只存在于整改 API 和统一回放结果里。控制面快照、执行页和治理页已经共享同一份 preview，负责人可以直接在页面判断默认会调用哪条外部编排后端命令。
