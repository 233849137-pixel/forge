# Forge Execution Backend Contracts

**Date:** 2026-03-10

## Goal

把“外部执行器”从单纯的模型 provider 口径，升级成更贴近真实交付系统的两层口径：

- `模型执行器`：Claude Code、Codex、Review CLI 这类真正执行代码或审查的工具
- `执行后端`：OpenClaw 这类负责编排、挂工具、调知识库和驱动多 Agent 运行时的外部后端

Forge 仍然是 `AI 研发交付系统`，不是编排器；这批工作只负责让控制面能正式表达这层边界。

## Why This Batch Exists

最近围绕 OpenClaw 的讨论说明了一个风险：

- 现在的 Forge 已经能表达 `provider`
- 但还不能明确表达“provider 是直接执行，还是被某个外部后端接管”

如果不把这层抽象补出来，后续一旦接 OpenClaw，控制面就会把它误记成“另一个模型 provider”，产品边界会再次模糊。

## Scope

本批只做 1 条纵向闭环：

`runtime capability detect -> runner evidence -> runtimeSummary -> home/governance -> tests/docs`

明确不做：

- 不做 OpenClaw workflow graph 编辑器
- 不做 OpenClaw 私有字段灌入 core/db
- 不做 OpenClaw 真实 API 适配器
- 不改 Forge 的产品定位

## Implemented

### 1. 外部执行后端契约

新增 opt-in 环境变量：

- `FORGE_ENGINEER_EXEC_BACKEND`
- `FORGE_REVIEW_EXEC_BACKEND`
- `FORGE_ENGINEER_EXEC_BACKEND_COMMAND`
- `FORGE_REVIEW_EXEC_BACKEND_COMMAND`

其中前两项描述“谁在承载这条执行链”，后两项描述“如何调用这个后端”，例如 `OpenClaw`。

### 2. Runner 证据开始显式携带执行后端

当 Engineer / Reviewer 命中外部执行契约时，`model-execution` check 会继续保留原有 provider 证据，同时追加：

- `后端 OpenClaw`

这样控制面可以同时看见：

- 谁在真正执行
- 谁在承载整条执行链

如果声明了 `*_EXEC_BACKEND_COMMAND`，Runner 在真实执行时会优先走后端命令，而不是直接走 provider 命令。

### 3. runtimeSummary 新增执行后端口径

`runtimeSummary` 现在除了原有的：

- `externalExecutionSummary`
- `externalExecutionDetails`
- `externalExecutionRecommendation`

还新增：

- `executionBackendLabels`
- `executionBackendSummary`
- `executionBackendDetails`

这让控制面可以直接回答：

- 当前是否声明了外部执行后端
- 当前后端是不是 OpenClaw
- 后端承载的是哪条 provider 契约

### 4. 首页与治理页开始显示执行后端

本批只把这层能力前推到最需要决策的位置：

- 首页 `推进判断`
- 治理页 `放行闸口汇总`
- 治理页 `风险与阻塞`

负责人现在可以同时看到：

- 外部执行准备度
- Provider 契约
- 执行后端
- 后端契约

### 5. capabilities 开始暴露后端命令准备度

`getCapabilityRegistryForAI / GET /api/forge/capabilities` 现在会返回：

- `executionBackends`
- `executionBackendCount`
- `activeExecutionBackendCount`

并在每个后端对象上标记：

- `id`
- `kind`
- `commandKey`
- `commandConfigured`
- `commandSource`

这样控制面就能区分：

- 只是声明了 OpenClaw
- 还是已经给 OpenClaw 配好了标准调用命令
- 以及这条后端契约究竟属于 `engineer` 还是 `reviewer`

### 6. 共享注册表成为单一事实源

新增：

- `config/forge-execution-backend-contracts.json`

用于统一描述：

- `label`
- `kind`
- `runnerProfile`
- `source`
- `providerKey`
- `backendKey`
- `commandKey`

Runner 脚本和 AI capability registry 现在都读取这份配置，不再各自手写 engineer/reviewer 的 env 键位。

在 capability registry 中，这份配置还会继续派生为：

- `supportedCommandTypes`
- `expectedArtifacts`
- `adapterIds`

这样控制面看到的不只是“怎么调这个后端”，还包括“这个后端承载哪类标准交付命令、预期会产出什么证据工件”。

这份 coverage 现在也已经前推到：

- `buildControlPlaneSnapshot()`
- `GET /api/forge/control-plane`
- `GET /api/forge/commands`
- `GET /api/forge/readiness`
- `GET /api/forge/remediations`
- `retryTaskForAI() / retryRemediationForAI()`

外部 Agent 拿控制面快照或命令中心时，不需要额外再查一次 capabilities。

另外，整改与回放的 `nextAction` 在命中 coverage 时也会直接追加：

- `执行后端：OpenClaw`

这样系统不只知道“有哪些 backend 可用”，还会在整改动作层直接说明“这次默认会落到哪条 backend 上”。

本轮又把这层提示继续前推到 selector：

- `taskDispatchQueue`
- `blockingTaskChain`
- `remediationQueue`
- `recentCommandExecutions.followUpTasks`

只要运行证据里的 `model-execution` summary 已显式带上 `后端 ...`，这些任务级整改动作也会直接补上 `执行后端：...`，不再只停留在 AI 聚合层。

这轮还把同一层信息收成了结构化字段：

- `runtimeExecutionBackendLabel`

现在这条字段已经贯通：

- core selector
- AI remediations / retry
- API routes

后续页面和自动化调用方可以直接读字段，不必再从文案里拆分默认执行后端。

## Verified

- `npm test -- tests/runtime-capability-detect.test.ts`
- `npm test -- tests/forge-engineer-runner.test.ts`
- `npm test -- tests/forge-review-runner.test.ts`
- `npm test -- tests/forge-home-page.test.tsx`
- `npm test -- tests/forge-os-pages.test.tsx`
- `npm test -- tests/forge-ai.test.ts tests/forge-api-routes.test.ts`
- `npm run build`
- `npm run build:electron`

## Next Step

下一批不应该继续打磨文案，而应该开始做：

`通用编排后端适配层`

目标是让 Forge 能把 OpenClaw 当作 `execution backend` 接入，但仍然只通过标准对象通信：

- 输入：`projectId / taskPackId / workspacePath / componentIds / constraints`
- 输出：`status / provider / backend / logs / producedArtifacts / evidence`

一句话收口：

`Forge 统一交付责任链，OpenClaw 只作为执行后端存在。`
