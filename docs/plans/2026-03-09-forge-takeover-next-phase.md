# Forge Takeover Next Phase

**Date:** 2026-03-09

## Current Verified Baseline

- `npm test` 通过
- `npm run build` 通过
- `npm run build:electron` 通过
- `node --check scripts/forge-mcp.mjs` 通过
- `node --check scripts/forge-runner.mjs` 通过

## Current Product State

- TaskPack 已成为执行主链的显式输入
- 组件注册表、组件装配命令、组件装配 API、MCP 工具、资产页入口都已接通
- `execution.start` 已开始把“待装配组件”视为正式前置条件
- 控制面、运行记录、整改回放都已能看到 `taskPackId / linkedComponentIds / pendingComponentIds`

## Takeover Protocol

后续研发统一按下面的方式继续：

1. 只做纵向切片，不做横向发散
2. 每次只推进一个闭环：`core -> ai -> api -> page -> tests -> docs`
3. 每个批次结束必须回写：
   - `docs/plans/...` 当前阶段状态
   - `README.md` 对外能力描述
4. 每个批次结束必须验证：
   - `npm test`
   - `npm run build`
   - `npm run build:electron`
5. 如果会话或窗口崩溃，以下文件视为接手入口：
   - `README.md`
   - `docs/plans/2026-03-09-forge-phase-next-implementation.md`
   - `docs/plans/2026-03-09-forge-takeover-next-phase.md`
   - `docs/plans/2026-03-09-forge-asset-feedback-writeback.md`

## Recommended Next Batch

### Batch 1: GitHub Resource Search Adapter

**Status**
- 已完成：新增 `GET /api/forge/components/search`
- 已完成：新增 MCP 工具 `forge_component_resource_search`
- 已完成：资产页已开始展示 `外部候选资源`
- 已完成：AI / API / Page 测试已覆盖外部候选搜索

### Batch 2: Asset Feedback Writeback

**Status**
- 已完成：新增 `getComponentUsageSignals(...)`，基于运行链派生组件使用次数、成功/阻塞/执行中信号
- 已完成：`GET /api/forge/components` 与 `control-plane.componentRegistry` 统一返回 `usageSignals`
- 已完成：资产页已新增 `组件使用信号`，直接显示最近阻塞、最近执行和失败摘要
- 已完成：默认 seed 运行记录已补齐 `linkedComponentIds`，本地数据库也能生成真实反馈信号

### Batch 3: Real External Execution Evidence

**Status**
- 已完成：Engineer / Reviewer Runner 统一输出 `evidenceStatus / evidenceLabel / executedCommand`
- 已完成：Runner CLI 在外部执行成功或失败时都会把统一证据状态写回运行记录
- 已完成：`runtimeSummary / run timeline` 已能直接给出 `contract / tool-ready / executed` 归一化状态
- 已完成：QA Runner 也已统一输出同一套 evidence 字段，门禁阶段不再退回旧 `mode` 口径
- 已完成：执行页运行卡片已显式展示 `Evidence`，页面视角与控制面证据口径一致
- 已完成：`Narrow Productization Pass` 已完成，首页、资产页、执行页职责边界进一步收紧
- 已完成：真实外部模型执行适配器第一版已落地，Engineer / Reviewer 可通过 env 契约 opt-in 走外部 provider 命令
- 已完成：`model-execution` provider 证据已前推到 AI / control-plane 一等字段，`runtimeSummary / run timeline` 可直接返回 provider 聚合与明细
- 已完成：首页与执行页已显式显示 `当前模型执行器 / 外部模型执行器`，负责人不需要再到运行详情里猜当前是谁在执行
- 已完成：整改任务、最近命令执行、统一回放结果现在都会直接返回 `runtimeModelProviderLabel / runtimeModelExecutionDetail`
- 已完成：治理页的 `最近命令执行 / 自动升级动作 / 风险与阻塞` 已显式显示 `模型执行器`，回放入口不再只给 Runner 命令而不给接管执行器
- 已完成：`commands.followUpTasks.remediationAction` 与 `remediations.items.nextAction` 现在会自动带上 provider 感知文案，API 调用方可以直接展示“将由哪个模型执行器接管”
- 已完成：`runtimeSummary` 现在也会返回 `externalExecutionSummary / externalExecutionDetails`，控制面可以直接解释当前是否已经配置真实外部执行契约
- 已完成：首页的 `推进判断` 与执行页的 `本地运行上下文` 现在都已显式显示 `外部执行准备度 / Provider 契约`
- 已完成：项目页的 `交付就绪度` 与治理页的 `放行闸口汇总` 现在也已显式显示 `外部执行准备度 / Provider 契约`
- 已完成：`runtimeSummary` 现在会返回结构化的 `externalExecutionStatus / externalExecutionContractCount / externalExecutionActiveProviderCount / externalExecutionRecommendation`
- 已完成：首页的 `推进判断 / 下一步动作` 与治理页的 `放行闸口汇总 / 风险与阻塞` 现在会显式显示 `外部执行建议 / 接管建议`
- 已完成：项目页的 `交付就绪度` 与执行页的 `本地运行上下文` 现在也会显式显示 `外部执行建议`
- 已完成：`FORGE_ENGINEER_EXEC_BACKEND / FORGE_REVIEW_EXEC_BACKEND` 已成为正式契约，控制面现在可以区分“模型执行器”与“执行后端”
- 已完成：`runtimeSummary` 现在也会返回 `executionBackendSummary / executionBackendDetails`，首页与治理页已开始显式显示 `执行后端 / 后端契约`
- 已完成：`GET /api/forge/capabilities` 与 `getCapabilityRegistryForAI` 现在会返回 `executionBackends / executionBackendCount / activeExecutionBackendCount`，执行后端已经成为正式能力注册表对象
- 已完成：新增 `FORGE_ENGINEER_EXEC_BACKEND_COMMAND / FORGE_REVIEW_EXEC_BACKEND_COMMAND`，Runner 在命中后端命令模板时会优先通过外部编排后端发起执行
- 已完成：新增共享注册表 `config/forge-execution-backend-contracts.json`，Engineer / Reviewer 的 execution backend 契约开始由单一事实源驱动
- 已完成：execution backend 注册表现在也会派生 `runnerProfile / supportedCommandTypes / expectedArtifacts`，控制面开始能直接判断某个后端承载哪条交付链
- 已完成：`controlPlane.executionBackends` 与 `getCommandCenterForAI().executionBackends` 已开始直接暴露这份 coverage，外部 Agent 不需要再额外查询 capabilities
- 已完成：`getDeliveryReadinessForAI()` 与 `getRemediationsForAI()` 顶层现在也会直接返回 `executionBackends`，放行判断与整改回放可直接读取后端覆盖链
- 已完成：`retryTaskForAI()` 与 `retryRemediationForAI()` 的 `nextAction` 现在会在命中 coverage 时直接提示默认 `执行后端`
- 已完成：selector 级 `remediationAction` 现在也会在运行证据已显式携带 `后端 ...` 时直接追加默认 `执行后端`，任务队列、阻断链与最近命令执行的 follow-up task 已共享这层提示
- 已完成：selector / AI / API 现在都会显式返回 `runtimeExecutionBackendLabel`，调用方不再需要从整改文案或 `model-execution` summary 里反解析默认后端
- 已完成：`GET /api/forge/remediations`、`retryTaskForAI()`、`retryRemediationForAI()` 现在还会显式返回 `runtimeExecutionBackendCommandPreview`，整改入口已经可以直接预览将展开成哪条 backend command
- 已完成：`/api/forge/control-plane` 现在也会在 `remediationQueue / recentExecutions.followUpTasks` 中直接返回 `runtimeExecutionBackendCommandPreview`，控制面快照已具备回放级 backend command preview
- 已完成：`/api/forge/tasks / remediations / control-plane` 与 `retryTaskForAI() / retryRemediationForAI()` 现在都会返回结构化 `runtimeExecutionBackendInvocation`，后续接真实 execution backend adapter 不需要再从 preview 字符串反推调用上下文
- 已完成：新增 `prepareExecutionBackendRequestForAI()`、`POST /api/forge/execution-backends/prepare` 与 MCP `forge_execution_backend_prepare`，外部 Agent 已可按 `taskId / remediationId` 直接生成 execution backend adapter request
- 已完成：新增 `dispatchExecutionBackendRequestForAI()`、`POST /api/forge/execution-backends/dispatch` 与 MCP `forge_execution_backend_dispatch`，Forge 已有统一的 execution backend 发起入口，并先以 stub receipt 形式收口调度事实源
- 已完成：新增 `executeExecutionBackendDispatchForAI()`、`POST /api/forge/execution-backends/execute` 与 MCP `forge_execution_backend_execute`，Forge 现已可把 dispatch 结果推进成标准化 shell execution plan
- 已完成：新增 `bridgeExecutionBackendDispatchForAI()`、`POST /api/forge/execution-backends/bridge` 与 MCP `forge_execution_backend_bridge`，Forge 现已具备受控的 execution backend bridge；默认 stub，显式 `local-shell` 时可触发本地 shell bridge
- 已完成：execution backend bridge 现在也会直接返回 `outputMode / outputChecks / evidenceStatus / evidenceLabel`，下一批接正式 run evidence 回写时无需再定义新协议
- 已完成：新增 `writebackExecutionBackendBridgeRunForAI()`、`POST /api/forge/execution-backends/bridge/writeback` 与 MCP `forge_execution_backend_bridge_writeback`，bridge 结果现已可以直接落成正式 run evidence 并进入运行时间线
- 已完成：bridge writeback 结果现在也会进入 `runtimeSummary.bridgeExecutionCount / bridgeExecutionSummary / bridgeExecutionDetails`，`/api/forge/readiness` 与负责人页面不需要再从 runs 时间线二次归纳 bridge 证据
- 已完成：bridge writeback 成功时现在还会按 backend invocation 的 `expectedArtifacts` 自动落地正式 artifact，外部 backend 执行链已经开始直接进入工件面
- 已完成：review backend bridge 写回成功时现在也会复用标准 review handoff，自动生成 `task-...-qa-gate` 并推进项目到 `测试验证`
- 已完成：`readiness / releaseGate` 现在会显式返回 `bridgeHandoffStatus / bridgeHandoffSummary / bridgeHandoffDetail`，控制面已能直接判断 bridge-backed review 是否已推进到 `QA handoff / release candidate`
- 已完成：`release.approve` 在被阻断时现在也会显式消费 `bridgeHandoffStatus`，如果 bridge-backed review 只推进到 `QA handoff`，放行阻断、升级任务和决策摘要都会直接说明“当前已移交 QA 门禁”
- 已完成：`releaseGate.escalationActions` 现在也会显式返回 `bridgeHandoffStatus / bridgeHandoffSummary / bridgeHandoffDetail`，升级动作本身开始区分 `qa-handoff / release-candidate`
- 已完成：当 bridge-backed review 只推进到 `QA handoff` 时，`releaseGate.escalationActions.nextAction` 会优先把 `测试报告 / Playwright 回归记录` 指向 `测试 Agent`，放行升级动作不再停留在通用“补齐后重试”
- 已完成：`getRemediationTaskQueue()` 与 `GET /api/forge/remediations` 里的 task 项现在也会显式返回 `bridgeHandoffStatus / bridgeHandoffSummary / bridgeHandoffDetail`，统一整改入口开始共享 bridge handoff 事实源
- 已完成：执行页的 `整改回放` 现在也会显示每条整改任务的 `桥接移交 / 移交细节`，执行负责人可直接判断当前整改是否已经进入 QA handoff
- 已完成：首页的 `下一步动作` 现在会优先消费 `qa-handoff` 整改链，bridge-backed review 已移交 QA 时会直接指向测试 Agent 补齐门禁证据
- 已完成：首页动作卡的 `support-copy` 现在也会显式显示 `负责人动作`，默认处理动作与命令入口已共享同一套 handoff-aware 文案
- 已完成：项目页的 `当前上下文` 现在也会优先消费 `qa-handoff` 整改链，负责人在项目页即可看到当前默认接棒角色
- 已完成：项目页的 `阶段准入与缺口` 现在也会显式显示 `当前接棒`，准入判断已开始直接复用 bridge-aware next action
- 已完成：执行页的 `整改回放 / 本地运行上下文` 与治理页的 `最近命令执行 / 自动升级动作` 现在也会优先显示结构化 `执行后端`
- 已完成：执行页的 `本地运行上下文` 现在也会显式显示 `桥接移交 / 移交细节`，执行负责人已能直接判断 bridge-backed review 是否正式移交 QA
- 已完成：治理页的 `放行闸口汇总 / 自动升级动作 / 风险与阻塞` 现在也会显式显示 `桥接移交`，放行与整改判断已开始直接消费 bridge-backed handoff 状态
- 已完成：执行页的 `整改回放` 与治理页的 `整改队列` 现在也会直接显示 `后端命令预览`，页面负责人无需切回 API 或 CLI 才能确认默认 backend command
- 已完成：项目页的 `交付就绪度` 现在也会显式显示 `执行后端 / 后端契约`，负责人视角已和首页、执行页、治理页共享同一份 backend 口径
- 已完成：首页的 `推进判断` 与项目页的 `交付就绪度` 现在也会显式显示 `桥接证据`，项目负责人可以直接确认外部 backend bridge 是否已写回正式运行时间线
- 已完成：执行页的 `本地运行上下文` 与治理页的 `放行闸口汇总 / 风险与阻塞` 现在也会显式显示 `桥接证据 / 桥接明细`，执行与放行负责人不需要再翻 runs 时间线确认 bridge 写回状态
- 已完成：项目页的 `交付就绪度` 现在也会显式显示 `桥接移交`，负责人已能直接看到 bridge-backed review 是否已移交 QA 门禁
- 已完成：项目页的 `项目任务清单` 现在也会显式显示每条任务的 `执行后端 / 本地 Runner` 路径，项目负责人不再需要从整改摘要猜默认回放链
- 已完成：项目页的 `当前上下文` 现在也会显式显示 `默认回放：执行后端 / 本地 Runner`，负责人打开项目页就能知道下一步默认走哪条执行链
- 已完成：项目页的 `阶段准入与缺口` 现在也会显式显示 `默认回放`，负责人在判断是否可继续推进时也能看到默认执行链
- 已完成：首页的 `阻塞与风险` 现在也会显式显示 `当前接棒`，阻塞摘要与默认负责人动作已开始共享同一条 handoff-aware 接棒链
- 已完成：治理页的 `放行闸口汇总` 现在也会显式显示 `当前接棒`，并和首页/项目页复用同一条 bridge-aware 默认动作，不再依赖 escalation 数组顺序
- 已完成：治理页的 `风险与阻塞` 现在也会显式显示 `当前接棒`，阻塞摘要与负责人默认动作已开始共享同一条 bridge-aware 接棒链
- 已完成：治理页的 `自动升级动作` 现在也会显式显示 `当前接棒`，升级动作与负责人 handoff 已开始共享同一套 bridge-aware 责任链
- 已完成：治理页的 `待人工确认` 现在也开始复用正式 `approvalTrace`，人工放行摘要不再回退到原始 task 列表
- 已完成：治理页的 `升级事项` 现在也开始复用正式 `escalationActions`，升级摘要与结构化放行链不再分叉
- 已完成：core 已新增共享 `getCurrentHandoffSummary()`，首页 / 项目页 / 治理页的默认接棒不再只存在于页面层逻辑
- 已完成：`/api/forge/control-plane` 与所有复用 `controlPlane` 聚合块的入口现在都会直接返回结构化 `currentHandoff / pendingApprovals / escalationItems`，外部 Agent 可直接读取统一治理责任链
- 已完成：`/api/forge/commands / readiness / remediations` 顶层现在也会直接返回 `currentHandoff / pendingApprovals / escalationItems`，外部 Agent 不需要再先展开嵌套 controlPlane
- 已完成：当外部研发执行桥已写回 `Patch / Demo`、但尚未进入 `review.run` 时，Forge 现在会把该中间态显式标记为 `review-handoff`，并把负责人默认接棒统一切到 `架构师 Agent -> 规则审查`
- 已完成：首页现在也会显式显示 `桥接移交 / 移交细节`，负责人在第一屏即可判断当前 bridge 结果已经推进到 `review-handoff / qa-handoff / release-candidate` 的哪一棒
- 已完成：治理页与 releaseGate escalation 现在也会把 `review-handoff` 收成正式升级项，自动生成 `规则审查记录 · 待形成`，并把默认接棒稳定落到 `架构师 Agent -> 发起规则审查`
- 已完成：`prepare / dispatch / execute / bridge / bridge-writeback` 这组 execution backend 入口现在也支持按 `projectId` 直接消费 `review-handoff`，外部后端可以从“研发桥已写回 Patch / Demo，等待规则审查”直接进入 `review.run`
- 已完成：`currentHandoff` 在项目级 handoff 下现在会直接返回 `runtimeExecutionBackendLabel / runtimeExecutionBackendCommandPreview`，控制面、readiness 与外部 Agent 可直接读取默认外部执行入口
- 已完成：首页、项目页、治理页现在也会在项目级 handoff 下直接显示 `默认外部执行 / 执行入口预览`，负责人不需要再从整改队列或 runs 时间线反推下一条外部执行链
- 已完成：`currentHandoff` 在项目级 handoff 下现在还会直接返回结构化 `runtimeExecutionBackendInvocation`，外部 Agent 可直接把当前项目默认执行入口推进到 adapter request / dispatch，而不必再从命令预览字符串反解析
- 已完成：执行页的 `本地运行上下文` 现在也会直接显示 `默认外部执行 / 执行入口预览`，首页 / 项目页 / 执行页 / 治理页的 handoff 入口提示已经一致
- 已完成：项目级 `review-handoff` 直连外部 backend 的 `bridge writeback` 现在也会正式写入 `command-review-run` 命令执行记录，命令中心与治理审计已能直接看到这条规则审查命令链
- 已完成：`command_executions` 现在也会显式持久化 `run_id`，项目级外部审查命令与对应 bridge run 已建立一对一追溯，selectors 不再只靠标题/执行器启发式匹配
- 已完成：`readiness / releaseGate / escalationItems` 现在也会显式返回 `bridgeReviewCommandId / bridgeReviewRunId / bridgeReviewRunLabel`，放行链可直接回答“是哪次外部规则审查 run 推进了 QA handoff”
- 已完成：整改式 `review.run` bridge writeback 现在也会补齐原始 `command-review-run.relatedRunId`，外部审查 run 的显式追溯不再只覆盖项目级直连入口
- 已完成：项目页 `交付就绪度` 与治理页 `放行闸口汇总 / 放行审批链 / 自动升级动作 / 待人工确认 / 升级事项` 现在也会显式显示 `审查来源运行 / 来源命令`，负责人视角可直接确认“这次 QA 接棒来自哪次外部审查运行”
- 已完成：execution backend 契约现在也已覆盖 QA，可通过 `FORGE_QA_EXEC_*` 为 `gate.run` 声明外部测试门禁后端
- 已完成：`prepare / dispatch / execute / bridge / bridge-writeback` 这组 execution backend 入口现在也支持按 `projectId` 直接消费 `qa-handoff`，外部后端可从“规则审查已完成、等待测试门禁”直接进入 `gate.run`
- 已完成：项目级 `qa-handoff` 直连外部 backend 的 `bridge writeback` 现在也会正式写入 `command-gate-run` 命令执行记录，并自动把 `test-report / playwright-run` 推进到 `release-candidate`
- 已完成：execution backend 契约现在也已覆盖 Release，可通过 `FORGE_RELEASE_EXEC_*` 为 `release.prepare` 声明外部交付说明整理后端
- 已完成：`prepare / dispatch / execute / bridge / bridge-writeback` 这组 execution backend 入口现在也支持按 `projectId` 直接消费 `release-candidate`，外部后端可从“测试门禁已完成、等待交付说明整理”直接进入 `release.prepare`
- 已完成：项目级 `release-candidate` 直连外部 backend 的 `bridge writeback` 现在也会正式写入 `command-release-prepare` 命令执行记录，并自动把项目推进到 `approval` 人工确认链
- 已完成：`currentHandoff` 现在会在 `release-approval` 任务存在时优先提升到 `approval`，负责人默认接棒不再继续停留在 `release-candidate`
- 已完成：execution backend 契约现在也已覆盖 Archive，可通过 `FORGE_ARCHIVE_EXEC_*` 为 `archive.capture` 声明外部归档沉淀后端
- 已完成：`prepare / dispatch / execute / bridge / bridge-writeback` 这组 execution backend 入口现在也支持按 `projectId` 直接消费 `归档复用` 阶段，外部后端可从“人工放行已完成、等待知识沉淀”直接进入 `archive.capture`
- 已完成：项目级 `archive.capture` 直连外部 backend 的 `bridge writeback` 现在也会正式写入 `command-archive-capture` 命令执行记录，并自动把 `knowledge-card / release-audit` 写回正式工件面
- 已完成：`currentHandoff` 在 `归档复用` 阶段现在会优先认领 `task-<projectId>-knowledge-card`，负责人默认接棒已切到 `知识沉淀 Agent -> 沉淀交付知识卡`
- 已完成：`currentHandoff.runtimeExecutionBackendInvocation` 现在也会覆盖 archive 阶段的知识沉淀接棒，负责人页面与外部 Agent 可直接读取 `archive.capture` 的默认外部执行入口
- 已完成：`currentHandoff` 在 `归档复用` 阶段现在还会显式返回 `sourceCommandId / sourceCommandLabel / relatedRunId / relatedRunLabel / runtimeLabel`，archive handoff 已能直接追溯“这次知识沉淀接棒来自哪次交付说明整理运行”
- 已完成：项目页与治理页现在也会显式显示 `当前接棒来源运行 / 来源命令`，负责人可直接判断 archive 接棒是由哪次 `release.prepare` 外部执行推进出来的
- 已完成：首页与执行页现在也会显式显示 `当前接棒来源运行 / 来源命令`，负责人在第一屏和执行视角下也能直接看到 archive 接棒的来源运行
- 已完成：工件页的 `证据时间线` 现在也会按工件类型直接消费 command provenance，`release-audit / knowledge-card` 会显式显示 `来源命令 / 来源运行`，并正确落到 `archive.capture`，不再继承 `review.run`
- 已完成：`releaseGate` 现在会显式返回结构化 `archiveProvenance`，`controlPlane / readiness` 顶层也会直接透传，负责人和外部 Agent 已能直接读取“哪次 `archive.capture` 写回了归档审计，以及它最初来自哪次 `release.prepare`”
- 已完成：首页的 `推进判断` 与治理页的 `放行闸口汇总` 现在也会直接显示 `归档接棒 / 归档来源`，负责人第一屏已能直接判断这次知识沉淀来自哪条 `archive.capture` 与哪次 `release.prepare`
- 已完成：`getCommandCenterForAI()` 与 `GET /api/forge/commands` 现在也会在顶层直接返回 `archiveProvenance`，命令中心与外部 Agent 已能直接读取“哪次 `archive.capture` 写回了归档审计，以及它最初来自哪次 `release.prepare`”
- 已完成：工件页现在也会在第一屏直接显示 `归档接棒 / 归档来源`，负责人不需要先翻 `证据时间线` 才能判断这次 `release-audit / knowledge-card` 来自哪条归档沉淀链
- 已完成：工件页现在也会在第一屏直接显示 `正式来源链`，把 `release-brief / review-decision / release-audit / knowledge-card` 的来源命令与来源运行收成统一摘要
- 已完成：首页与项目页现在也会直接显示 `正式工件沉淀`，负责人不用切到工件工作台，也能先判断当前是否已经形成正式交付物沉淀；`沉淀清单` 现已退回工件页
- 已完成：首页动作卡与项目页当前上下文现在也会直接显示 `当前沉淀：...`，负责人在判断 `当前接棒 / 下一步动作` 时可以同时看到已经沉淀出的正式工件状态
- 已完成：`formalArtifactCoverage` 现在已经从页面 helper 收成 core selector，并直接进入 `control-plane / readiness / remediations / commands` 顶层；外部 Agent 已能直接读取“当前已经沉淀出哪些正式工件”
- 已完成：`formalArtifactGap` 现在也已经从页面文案收成 core selector，并直接进入 `control-plane / readiness / remediations / commands` 顶层；负责人和外部 Agent 已能直接读取“当前还缺哪些正式工件、由谁补、下一步先做什么”
- 已完成：`formalArtifactProvenance` 现在也已经从工件页 helper 收成 core selector，`release-brief / review-decision / release-audit / knowledge-card` 的来源命令与来源运行开始有统一事实源
- 已完成：`formalArtifactResponsibility` 现在也已经从工件页临时文案收成 core selector，并直接进入 `control-plane / readiness / remediations / commands` 顶层；负责人和外部 Agent 已能直接读取“正式工件沉淀 / 缺口 / 待人工确认 / 来源链”
- 已完成：工件页现在也会在第一屏直接显示 `正式工件责任`，把 `正式工件沉淀 / 正式工件缺口 / 补齐责任 / 待人工确认` 收成同一块摘要，不再让负责人自己在工件页和治理页之间拼责任链
- 已完成：首页与项目页现在也会直接显示 `待人工确认 / 确认责任`，并与工件页共用同一份 `formalArtifactResponsibility`，负责人第一屏就能判断“当前有没有真实审批链、由谁确认”
- 已完成：治理页的 `待人工确认` 现在也直接消费 `formalArtifactResponsibility.pendingApprovals`；没有真实审批链时会回到空态，不再把未来缺件混进人工确认列表
- 已完成：`formalArtifactResponsibility` 现在也会直接返回 `approvalHandoff`，把“确认后谁接棒归档沉淀、来源于哪次 release.prepare”收成正式事实源
- 已完成：`approvalHandoff` 现在也已从 `formalArtifactResponsibility` 前推到 `releaseGate / control-plane / readiness / remediations / commands` 顶层，外部 Agent 与负责人入口不需要再从嵌套责任摘要里二次拆“确认后谁接棒”
- 已完成：首页、项目页、工件页、治理页现在都能直接显示 `确认后接棒`；负责人不需要再从 `archiveProvenance` 和人工确认条目之间自己拼“审批完成后会交给谁”
- 已完成：首页与治理页现在也会直接消费顶层 `approvalHandoff`，显式显示 `接棒细节`，负责人第一屏即可看到“确认后谁接棒，以及这条接棒来自哪次外部执行链”
- 已完成：工件页的 `正式工件责任` 现在也会直接显示 `接棒细节`，`首页 / 项目页 / 工件页 / 治理页` 四处现在已经对齐到同一条 `approvalHandoff` 责任链
- 已完成：项目页现在也会直接显示 `归档接棒 / 归档来源 / 当前接棒来源运行`，项目负责人主入口已经补齐 `archiveProvenance + currentHandoff provenance`，不再比首页/治理页少一段来源链
- 已完成：首页、项目页、工件页、治理页现在也会在第一层显式显示 `接棒动作`；负责人不只知道“确认后交给谁”，也能直接看到“接下来具体要补什么正式工件/沉淀动作”
- 已完成：`GET /api/forge/commands` 的最近执行、治理页 `最近命令执行` 现在也会直接显示 `确认后接棒 / 接棒细节 / 接棒动作`，命令审计已能直接回答“这次 release.prepare 确认后交给谁、接下来要做什么”
- 已完成：`GET /api/forge/commands` 的最近执行、治理页 `最近命令执行` 现在也会直接显示 `归档接棒 / 归档来源`，命令审计已能直接回答“哪次 archive.capture 写回了归档审计，以及它最初来自哪次 release.prepare”
- 已完成：治理页的 `放行闸口汇总` 现在也会直接显示 `正式工件缺口 / 补齐责任`，负责人在 gate 视角下不需要再切回首页或项目页，也能直接判断“当前还缺哪些正式工件”
- 已完成：`releaseGate` 现在也会直接携带 `formalArtifactGap`，治理页、`readiness` 与外部 Agent 已开始共享同一份 gate 级正式工件缺口事实源
- 已完成：`formalArtifactGap` 的 `补齐责任` 现在也会按 `review-handoff / qa-handoff / release-candidate` 输出规范化 handoff 文案，避免被任务队列里的临时缺件说明带偏
- 已完成：`currentHandoff` 现在也开始复用同一套 bridge handoff 规范文案，首页 / 项目页 / 外部 Agent 读取到的 `当前接棒` 不再受任务队列临时缺件标签影响
- 已完成：`releaseGate.escalationActions` 里的正式工件缺失项现在也会直接复用 `formalArtifactGap` 的 owner 与 nextAction，放行升级动作和首页/项目页的负责人口径已开始共享同一条责任链
- 已完成：`approvalTrace` 里的 `release-brief / review-decision` 现在也会在“人工审批前跟随当前 handoff、人工审批后回到 release approval task”之间切换，放行审批链不再提前跳到“等待归档沉淀”
- 已完成：项目页 `交付就绪度` 现在也会直接显示 `最终放行摘要 / 放行细节 / 放行动作`，项目负责人入口已补齐统一的 release closure 末端摘要
- 已完成：工件页 `正式工件责任` 现在也会直接显示 `最终放行摘要 / 放行细节 / 放行动作`，工件工作台已经和首页/治理页共享同一层 release closure 事实源
- 已完成：`GET /api/forge/commands` 的最近执行与治理页 `最近命令执行` 现在也会直接显示 `最终放行摘要 / 放行细节 / 放行动作`，命令审计已经开始直接回答“这次 release.prepare 已收口到哪一步、最终放行还差什么”
- 已完成：`archive.capture` 的最近执行现在也会直接显示 `最终放行摘要 / 放行细节`，命令审计末端已能直接回答“这次归档写回本身就是哪条最终放行链的收口结果”
- 已完成：顶层 `releaseClosure` 现在也会直接带 `sourceCommand / relatedRun / runtime`，负责人和外部 Agent 已能直接读取“这次最终放行来自哪条命令/运行链”
- 已完成：首页、项目页、治理页现在也会直接显示 `最终放行来源`，负责人不需要再并读 `archiveProvenance` 才知道最终收口来自哪条外部执行链
- 已完成：工件页 `正式工件责任` 现在也会直接显示 `最终放行来源`，工件工作台第一屏已经和首页 / 项目页 / 治理页对齐到同一条 release closure provenance 口径
- 已完成：首页与治理页现在也会直接显示 `最终放行责任链`，把 `最终放行摘要 / 当前动作 / 确认后接棒 / 归档接棒 / 最终放行来源` 收成一条统一摘要
- 已完成：`releaseClosureResponsibility` 现在也已经从页面 helper 收成 core selector，并直接进入 `releaseGate / control-plane / readiness / remediations / commands` 顶层；首页与治理页开始优先直接消费这份事实源，不再各自拼 `approvalHandoff + archiveProvenance + releaseClosure`
- 已完成：顶层 `releaseClosure` 现在会在 `archive.capture` 写回后进入终态 `archive-recorded`；`control-plane / readiness / commands` 已能直接回答“发布链已完成最终放行，归档沉淀已写回正式工件面”
- 已完成：`release.prepare` 与 `archive.capture` 的命令审计现在已分阶段表达：前者继续回答审批前缺口，后者明确回答最终收口已完成
- 已完成：项目页 `交付就绪度` 与工件页 `正式工件责任` 现在也都会直接显示 `最终放行责任链`，四个负责人入口已经对齐到同一份顶层 `releaseClosureResponsibility`
- 已完成：首页与治理页现在在没有拆分 `releaseClosureDetail / source / nextAction` 时，也会直接消费顶层 `releaseClosureResponsibility.detail / sourceLabel / nextAction` 渲染最终放行明细
- 已完成：首页与治理页现在在没有旧的 `releaseClosureSummary` 时，也会直接按 `releaseClosureResponsibility` 渲染整块 `最终放行摘要 / 责任链 / 放行细节 / 最终放行来源 / 放行动作`，最终放行摘要块已经切换到结构化责任链驱动
- 已完成：`GET /api/forge/commands` 的最近执行与治理页 `最近命令执行` 现在也会直接显示 `最终放行责任链`，并且 `release.prepare / archive.capture` 的命令审计都会携带同一份 `releaseClosureResponsibilitySummary`
- 已完成：项目页 `交付就绪度` 现在也会直接消费顶层 `releaseClosureResponsibility.detail / sourceLabel / nextAction`，不再依赖旧的 `releaseClosureSummary / detail / nextAction` 透传也能完整渲染最终放行块
- 已完成：`GET /api/forge/commands` 的最近执行与治理页 `最近命令执行` 现在也会直接消费结构化的 `releaseClosureResponsibility.detail / nextAction / sourceLabel`，命令审计末端已经能直接回答“为什么卡住最终放行、接下来做什么、来源于哪条外部执行链”
- 已完成：工件页 `正式工件责任` 现在也会在 archive 终态直接显示 `放行动作`，并优先消费 `releaseClosureResponsibility.detail / nextAction / sourceLabel`，工件工作台与首页 / 项目页 / 治理页的最终放行口径继续收平
- 已完成：首页、项目页、治理页、工件页现在都统一通过 `getResolvedReleaseClosureView(...)` 优先消费结构化的 `releaseClosureResponsibility.*`；即使同时存在 legacy `releaseClosureSummary`，最终放行摘要块也不会再回退到旧口径
- 已完成：治理页与工件页的 `最终放行摘要 / 责任链 / 放行细节 / 最终放行来源 / 放行动作` 现在也已经切到同一套 helper，四个负责人入口的页面级最终放行摘要优先级已完全收平
- 已完成：首页、项目页、治理页、工件页现在也统一通过 `getResolvedFormalArtifactResponsibilityView(...)` 解析 `正式工件沉淀 / 缺口 / 待人工确认 / 确认后接棒`；显式传入的 `approvalHandoff*` 已能稳定覆盖 snapshot 默认责任链
- 已完成：首页、项目页、治理页、工件页现在也统一通过 `getFormalArtifactResponsibilitySummaryItems(...)` 生成 `正式工件责任` 清单项，`沉淀 / 缺口 / 待人工确认 / 确认后接棒 / 最终放行责任链` 的展示顺序与默认文案已共享
- 已完成：治理页 `放行判断` 现在已拆成 `闸口判断 / 执行链信号 / 最终放行责任链` 三层，原来的超长 `放行闸口汇总` 已退场，放行结论和执行链状态开始分层显示
- 已完成：首页与项目页现在也统一通过共享 `OverviewSignalCluster` 渲染双栏总览区，`项目态势 / 运行链` 与 `当前项目 / 执行入口` 不再继续手工拼 `SummaryCluster + SummaryGroup`
- 已完成：项目页现在也切到 `主工作区 + 右侧操作轨` 壳层，`项目推进轨道 / 项目态势 / 责任与放行` 与 `任务与起盘 / 阶段状态` 开始分轨显示，不再像一堵同权重 panel 墙
- 已完成：工件页 `工件总览` 与治理页 `治理基线` 现在也统一通过共享 `GroupedSummaryCluster` 渲染纵向摘要堆，`待接棒队列 / 关键缺失工件` 与 `标准命令 / 策略 Hook / 策略判定` 不再继续手工拼 `SummaryCluster + SummaryGroup`
- 已完成：`ForgeChrome` 已切到更接近 admin shell 的 `品牌导航 + 侧栏信号卡 + 顶部上下文条 + 内容区` 壳层；首页也已切成 `主工作区 + 右侧操作轨`，不再把所有主块平铺成同权重卡片墙
- 已完成：首页、项目页、治理页、工件页现在在没有真实审批链时，不再展示空的 `待人工确认 / 确认责任 / 确认后接棒` 行；负责人默认先看 `沉淀 / 缺口 / 补齐责任`，有真实审批链时才展开确认责任
- 已完成：首页、项目页第一屏的 `正式工件责任` 不再展开 `沉淀清单`；详细沉淀明细只留在工件页，首页和项目页只回答“沉淀到了什么 / 还缺什么 / 谁来补”
- 已完成：共享 `SummaryGroup / SummaryList` 已切到编辑部式摘要卡样式，四个负责人入口不再只是普通列表卡，视觉层级开始跟 `交付控制台` 定位对齐
- 已完成：`ForgeChrome` 已重做为 `品牌区 / 模块导航 / hero 标题区 / 信号卡` 壳层，导航和 hero 不再只是默认侧栏加标题条，整体气质开始接近编辑部式交付控制台
- 已完成：共享 `SectionPanel` 已升级为带标题的具名 region，`panel` 与 `workflow-rail` 也切到更清晰的壳层层级，页面大块结构不再都像同一种卡片
- 已完成：`SummaryGroup` 已升级为共享 tone system，`signal / closure / provenance` 现在开始区分接棒、最终放行和来源链摘要，负责人页面不再所有摘要块都长得一样
- 已完成：首页、项目页、工件页现在都把 `最终放行责任链` 从 `正式工件责任` 里拆成了独立分组，负责人第一屏不再需要在同一块列表里混读“工件缺口”和“放行终态”
- 已完成：首页、项目页、治理页、工件页现在也开始统一通过共享 helper 解析 `正式工件责任 / 最终放行责任链`，展示层剩余的优先级判断进一步减少
- 已完成：首页、项目页、工件页现在开始统一通过共享 `ResponsibilitySummaryCluster` 组织 `当前接棒 / 正式工件责任 / 最终放行责任链 / 归档接棒 / 正式来源链`，责任区不再每页各自拼三四个 `SummaryGroup`
- 已完成：首页、项目页、治理页、工件页现在也开始统一通过共享 `SummaryCluster / ResponsibilitySummaryCluster` 的显示层收口责任链区块，页面层剩余的手工组合进一步减少
- 已完成：治理页 `责任与升级` 现在也开始统一通过共享 `GovernanceResponsibilityCluster` 组织 `放行审批链 / 自动升级动作 / 风险与阻塞 / 待人工确认 / 升级事项`，治理责任区不再手工堆五块 `SummaryGroup`
- 已完成：工件页 `证据与评审` 与治理页 `命令审计` 现在也开始统一通过共享 `EvidenceAuditCluster` 组织证据/审计摘要，页面层继续减少手工组合
- 已完成：首页 `动作与执行` 与项目页 `任务与起盘` 现在也开始统一通过共享 `WorkbenchPanelCluster` 承载工作区卡片，页面层继续减少手工壳层
- 已完成：首页现在不再用一张长清单承载全部前台信息，而是改成 `当前态势 / 责任链 / 证据与风险` 三块 operator-facing 摘要，`推进判断 / 阻塞与风险` 已退出首页主入口
- 已完成：项目页现在也改成 `项目总览 / 推进与接棒 / 放行与缺口` 三块前台摘要，旧的 `当前上下文 / 阶段准入与缺口 / 交付就绪度` 已不再作为前台主结构

## Non-Goals

- 先不做多人协作和云同步
- 先不做 DMG 签名、公证、自动更新
- 先不做全自动组件拼装

## Immediate Start Point

当前批次已经切到 `UI 信息架构收口`，下一个开发批次建议直接从：

- `src/components/forge-os-shared.tsx`
- `src/components/forge-home-page.tsx`
- `src/components/forge-projects-page.tsx`
- `src/components/forge-governance-page.tsx`
- `src/components/forge-artifacts-page.tsx`
- `tests/forge-home-page.test.tsx`
- `tests/forge-projects-page.test.tsx`
- `tests/forge-os-pages.test.tsx`
- `docs/plans/2026-03-10-forge-home-project-ia-refactor.md`
- `docs/plans/2026-03-11-forge-governance-artifacts-ia-refactor.md`
- `docs/plans/2026-03-11-forge-governance-baseline-artifact-assets.md`
- `docs/plans/2026-03-10-forge-formal-artifact-summary-items-alignment.md`
- `docs/plans/2026-03-11-forge-release-closure-dedicated-groups.md`
- `docs/plans/2026-03-11-forge-summary-group-tone-system.md`
- `docs/plans/2026-03-10-forge-formal-artifact-responsibility-helper-alignment.md`
- `docs/plans/2026-03-11-forge-responsibility-summary-cluster.md`
- `docs/plans/2026-03-11-forge-governance-responsibility-cluster.md`
- `docs/plans/2026-03-11-forge-evidence-audit-cluster.md`
- `docs/plans/2026-03-11-forge-workbench-panel-cluster.md`

开始，主题锁定为：

`冻结后端事实源，继续收首页 / 项目页 / 治理页 / 工件页的 operator-facing 信息架构`

- 已完成：首页 / 项目页已经切到 `当前态势 / 责任链 / 证据与风险` 与 `项目总览 / 推进与接棒 / 放行与缺口`
- 已完成：治理页已经切到 `放行判断 / 责任与升级 / 命令审计`
- 已完成：工件页已经切到 `工件总览 / 责任与来源 / 证据与评审`
- 已完成：治理页下半区已经继续收成 `治理基线`
- 已完成：工件页下半区已经继续收成 `工件资产`
