# Forge Backend Command Previews

**Goal:** 让整改与回放链不仅返回默认 `execution backend` 标签，还能直接预览当前上下文下会展开成哪条 backend command。

**Architecture:** 继续复用 execution backend registry 和 runtime adapter 描述层，不新增持久化状态。AI 层基于 `projectId / taskPackId / linkedComponentIds / retryCommandId` 派生 `runtimeExecutionBackendCommandPreview`，并只先接到 remediations / retry / task list 这些最贴近回放链的出口。

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-api-routes.test.ts`
- Modify: `README.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`

## Completed

1. 新增共享 helper，把 backend command template 和当前 `projectId / taskPackId / provider / artifactType` 上下文展开成预览字符串。
2. `GET /api/forge/remediations`、`retryTaskForAI()`、`retryRemediationForAI()` 已开始返回 `runtimeExecutionBackendCommandPreview`。
3. `listTasksForAI()` 也开始透传同一字段，为后续把 preview 前推到项目页/执行页保留统一入口。
4. AI 与 API 测试已覆盖 review remediation 场景，确认 OpenClaw reviewer backend 会预览成：
   - `openclaw run-review --project "retail-support" --taskpack "artifact-taskpack-retail" --artifact "patch" --provider "Claude Code Review"`
5. README 与 takeover 文档已同步。

## Verification

- `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Next

- 把 `runtimeExecutionBackendCommandPreview` 前推到项目页/执行页的整改卡片，减少负责人在 CLI 和页面之间来回切换。
- 再往前一步，把 preview 升级成真正的 `execution backend adapter` 调用负载，而不只是可读字符串。
