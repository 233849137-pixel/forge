# Forge Execution Backend Execute Stub

**Goal:** 在 `dispatch` 之上补齐统一的 `execute` 入口，让 Forge 不只是能生成 backend request 和 dispatch receipt，还能产出真正可被外部执行器消费的标准化 shell execution plan。

**Architecture:** 继续复用 `dispatchExecutionBackendRequestForAI()` 和既有的 `runtimeExecutionBackendInvocation`，不做真实外部调用。AI 层新增 `executeExecutionBackendDispatchForAI()`，把 dispatch 结果升级成 `mode: external-shell-stub` 的 execution plan；HTTP 层新增 `POST /api/forge/execution-backends/execute`；MCP 新增 `forge_execution_backend_execute`。当前只返回 `cwd / command / commandPreview`，后续接真实 OpenClaw 执行桥时，只需要替换 execute 入口背后的执行器。

**Files:**
- Modify: `packages/ai/src/forge-ai.ts`
- Add: `app/api/forge/execution-backends/execute/route.ts`
- Modify: `scripts/forge-mcp.mjs`
- Modify: `tests/forge-ai.test.ts`
- Modify: `tests/forge-api-routes.test.ts`
- Modify: `README.md`
- Modify: `docs/plans/2026-03-09-forge-takeover-next-phase.md`

## Completed

1. 新增 `executeExecutionBackendDispatchForAI()`，基于 dispatch 结果返回统一 shell execution plan。
2. 当前 execute 返回：
   - `status: ready`
   - `mode: external-shell-stub`
   - `backend / provider / invocation`
   - `execution.cwd`
   - `execution.command`
   - `execution.commandPreview`
3. 新增 `POST /api/forge/execution-backends/execute`，HTTP 调用方已有单一 execute 入口。
4. 新增 MCP 工具 `forge_execution_backend_execute`，外部 Agent 可直接读取统一 shell plan。
5. AI 与 API 测试已覆盖 review remediation 场景，确认 OpenClaw reviewer backend 会产出标准化 command 数组：
   - `openclaw`
   - `run-review`
   - `--project retail-support`
   - `--taskpack artifact-taskpack-retail`
   - `--artifact patch`
   - `--provider Claude Code Review`

## Verification

- `npm test -- tests/forge-ai.test.ts`
- `npm test -- tests/forge-api-routes.test.ts`
- `npm test`
- `npm run build`
- `npm run build:electron`
- `node --check scripts/forge-mcp.mjs`

## Result

这批之后，Forge 在 execution backend 这条主线上已经具备三段式入口：

- `prepare`：生成 adapter request
- `dispatch`：生成统一 dispatch receipt
- `execute`：生成标准化 shell execution plan

虽然当前仍是 stub，但后续接真实外部执行桥时，边界已经固定，不需要再重写控制面或回放链。
