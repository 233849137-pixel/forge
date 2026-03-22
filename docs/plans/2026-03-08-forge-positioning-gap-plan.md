# Forge 产品定位差距与落地计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 Forge 从“聊天式推进的 AI 工具集合”升级成“可执行、可追踪、可复用的本地 AI 研发交付系统”，对齐用户给出的 4 条核心产品定位。

**Positioning:** 对外定位收窄为 `本地优先的 AI 研发交付系统`，目标用户锁定在小型交付团队、AI 外包团队和内部工具团队；`Agent Team` 是执行层能力，不再作为首页主卖点。

**Architecture:** 采用三层收敛：
- `Control Plane`：项目、Task Pack、工件、门禁、审计
- `Runtime Plane`：skills、hooks、rules、runner profiles、MCP profiles
- `Evidence Plane`：patch、test-report、playwright-run、review-decision、release-brief 等证据对象

UI 仍以 `项目 + 团队 + 工件 + 执行 + 资产 + 治理` 作为一级对象，但所有新增能力必须服务同一条交付链，不再围绕聊天窗口或通用工作流壳扩展。

**Tech Stack:** Electron、Next.js App Router、SQLite、MCP、本地 Runner、Prompt Registry、Skill Registry、Project Asset Graph

---

## 一、目标定位与当前现状对照

### 定位 1：模拟大厂研发团队流程，产出标准化交付物

**目标定义**
- 按固定研发阶段推进：需求分析、PRD、原型及架构、代码编写、Demo、测试、交付归档。
- 每个阶段都必须产出标准工件，而不是只更新状态。
- 系统需要能判断“当前缺什么工件”“当前卡在哪一步”“下一步谁接棒”。

**当前已具备**
- 已有项目页、团队页、工件页、执行页、资产页、治理页的一级结构。
- 已有 PRD、TaskPack、补丁、测试报告、交付说明、知识卡等工件类型定义。
- 已有基础的阶段轨道和工件列表。

**当前缺口**
- 没有真实的状态机，只是根据 `progress + gate` 推断阶段。
- 没有“原型及架构”这一层的正式工件模型。
- 没有 Demo 工件和发布就绪判断。
- 缺少按阶段强制要求的工件契约和交接规则。

**结论**
- 方向对了，但当前更像“流程展示系统”，还不是“标准化交付系统”。

### 定位 2：通过 Agent Team 进行专业分工协作

**目标定义**
- 产品经理 Agent、设计 Agent、研发 Agent、测试 Agent 等应是正式对象。
- 每个 Agent 需要拥有独立的 `skill / prompt / SOP / 知识库 / 权限 / 人设`。
- 协作方式不是聊天接龙，而是基于工件的 handoff。

**当前已具备**
- 已有 Agent 和 Team Template 的基础数据模型。
- 已有团队页和基础角色展示。

**当前缺口**
- Agent 还只是静态名册，没有独立的 Prompt Registry、Skill Registry、SOP Registry、Knowledge Binding。
- 没有 handoff 队列、待接棒、待评审、升级给人类的机制。
- 没有真正的 Agent 执行编排，只是 UI 展示。

**结论**
- 现在只是“有组织架构”，还不是“能协作的 Agent Team”。

### 定位 3：通过研发资产和历史项目复用，避免重复造轮子

**目标定义**
- 系统能从历史项目、模板、Prompt、Skill、组件库、GitHub 资源中自动发现可复用资产。
- 能把登录、支付、上传下载等常见模块自动组装到新项目里。
- 资产不只是目录，而是和项目、任务包、工件、执行结果之间存在显式关联。

**当前已具备**
- 已有 Prompt、Template、Skill、Gate 等资产概念。
- 已有 `projectAssetLinks` 这种项目到资产的显式关系。
- 资产页已经能展示当前项目推荐、Skill 使用指引和关联模板。

**当前缺口**
- 还没有真实的组件注册表。
- 没有 GitHub 搜索与筛选能力。
- 没有“任务包 -> 自动选组件 -> 生成拼装方案”的装配引擎。
- 没有基于执行成败回写资产评分和推荐结果。

**结论**
- 当前只是“资产感知”，还不是“资产装配系统”。

### 定位 4：任务管理中枢，支持多项目同时研发

**目标定义**
- 能同时管理多个项目、多个 Agent、多个运行任务。
- 能一眼看到每个项目的阶段、阻塞、负责人、当前执行和门禁状态。
- 能跨项目分配资源和管理优先级。

**当前已具备**
- 已有多项目列表和项目切换。
- 已有运行记录和门禁列表。
- 首页已收口为负责人驾驶舱。

**当前缺口**
- 没有真正的任务对象。
- 没有按项目的看板、待办、优先级和 SLA。
- 没有跨项目队列、冲突检测、执行容量管理。
- 没有统一的“谁在忙、谁阻塞了谁”的调度视图。

**结论**
- 现在是“项目切换器”，还不是“任务管理中枢”。

## 二、当前产品的准确定位

结合当下实现，Forge 当前最准确的定义是：

`一个 local-first 的 AI 交付流水线骨架，已经完成 Agent Team OS 的一级信息架构和基础数据建模，但还没有完成执行层、装配层和协作层。`

这意味着后续优化必须围绕 3 条主线推进，而不是继续做零散页面：

1. `起盘体验`
- 把新项目从“建一条记录”升级成“5 分钟起盘并自动注入默认基线”。

2. `执行闭环`
- 把 Agent 和 Runner 从“展示层对象”升级成“真正可交接、可执行、可审计”的执行链。

3. `沉淀飞轮`
- 把资产从“目录”升级成“可搜索、可推荐、可拼装、可回写评分”的生产底座。

## 当前进展（2026-03-08 晚）

**已完成**
- 一级信息架构已切到 `首页 / 项目 / 团队 / 工件 / 执行 / 资产 / 治理`
- 已补齐 `Architecture Note / UI Spec / Demo Build` 工件模型
- 工件页已支持 `待接棒队列 / 关键缺失工件 / 评审结果记录 / 通过条件`
- 团队页已支持 `待接棒事项 / 评审与升级规则 / SLA / 升级责任人`
- 执行页已补 `待处理任务中枢`，并将 `run` 与 `project` 建立显式关联
- 已补 `Task` 正式对象、项目级任务清单、项目状态机判断
- 已开放 `tasks` 的 HTTP API、AI Core 和 MCP 工具入口
- 已补齐 `Agent / Skill / SOP` 正式数据模型并接入 SQLite 持久化
- 已为 Agent 补上正式的岗位提示词字段，避免团队只剩 `promptTemplateId` 占位
- 团队页已升级为 `当前团队 / Agent 注册表 / SOP 与知识绑定 / 工件流转` 的工作页
- 资产页已升级为 `Prompt 模板库 / Skill 注册表 / SOP 规范库 / 项目关联约束` 的能力页
- 已开放 `team-registry / capabilities` 的 HTTP API、AI Core 和 MCP 工具入口
- 已把所有 Agent 引用到的 Skill 补齐为正式注册表条目，避免能力引用悬空
- 已补 `Agent Prompt Registry + Knowledge Binding` 的可编辑链路，支持 UI、HTTP API、AI Core 和 MCP 更新
- 已修复 Agent 配置被 seed 同步覆盖的问题，避免“保存后刷新丢失”
- 已补项目级 `workflowStates` 正式对象，并持久化到 SQLite
- 项目页已支持编辑 `当前阶段 / 状态 / 阻塞说明`，不再只靠选择器推断阶段
- 已开放 `workflow` 的 HTTP API、AI Core 和 MCP 工具入口
- 已让状态机判断优先使用持久化阶段状态，再回退到选择器推断逻辑
- 已补 `workflowTransitions` 阶段流转历史，支持 SQLite 落盘和治理页展示
- 已让项目创建与阶段更新自动写入流转审计记录，补上“怎么走到这里”的历史链路
- 已补跨项目 `Task 中枢` 选择器，首页与执行页都能展示调度摘要、项目负载与 Agent 负载
- 已让 `tasks` 的 HTTP API、AI Core 与 MCP 工具返回统一的任务中枢摘要，口径不再只停留在页面层
- 已补最小 `Runner` 注册表，执行页可查看本地执行器状态，HTTP API、AI Core 与 MCP 也可读取 Runner 注册表
- 已补 `Runner 心跳更新` 与 `Run 结果回写` 写入口，执行面不再只能读取静态注册表
- 已补 `Runner` 能力探测、探测结果持久化与自动心跳采集；执行页可直接看到探测状态、最近探测与本地上下文
- 已开放 `Runner probe` 的 HTTP API、AI Core 与 MCP 工具入口，Runner 不再只是手工更新状态
- 已让 `Runner probe` 返回结构化能力详情（能力 / 路径 / 版本），执行页开始能直接查看环境证据
- 已补 `Run Event` 事件流与失败归因分类，执行失败不再只显示“阻塞中”
- 已开放 `runs` 的时间线读取入口，HTTP API、AI Core 与 MCP 都能读取最近事件流和最新失败归因
- 执行页已新增 `失败归因` 与 `最近事件流`，开始从状态页升级成 Runner 控制台
- 已把首页产品表达改成“本地 AI 交付流水线”，不再把产品卖点写成抽象的 `Agent Team OS`
- 已把项目页改成“项目起盘与推进”，新增 `5 分钟起盘` 与 `起盘后自动注入` 区块
- 已让创建项目自动注入首批 `PRD / 架构说明 / 原型与交互规范 / TaskPack` 工件
- 已让创建项目自动注入首批 `需求确认 / PRD / 原型架构 / 本地执行与门禁` 任务
- 已让项目创建默认完成模板、Prompt、门禁、工作区三类起盘基线注入
- 已让项目 profile 正式记录 `teamTemplateId / teamTemplateTitle`，默认团队编制不再只是页面文案
- 已补 `Command Execution` 与 `Policy Decision` 两类正式对象，命令中心不再只有静态注册表
- 已让 `Command Execution` 显式回写 `followUpTaskIds`，任务中枢开始能反查“哪个阻断命令生成了这个任务”
- 已让 `tasks` 的 HTTP API 返回 `sourceCommandLabel / sourceCommandAction`，外部 Agent 与桌面页开始共用同一条任务责任链
- 已让任务中枢继续返回 `relatedArtifactLabels / missingArtifactLabels / evidenceAction`，开始回答“这个任务挂着哪些证据、还缺哪些证据”
- 已让任务中枢进一步返回 `relatedRunId / relatedRunLabel / runtimeLabel`，开始回答“是哪次运行把这条任务卡住了”
- 已让任务中枢继续返回 `remediationOwnerLabel / remediationSummary / remediationAction`，开始回答“谁来修、先怎么修”
- 已让任务中枢继续返回 `retryCommandId / retryCommandLabel`，开始回答“修完后该重跑哪个标准命令”
- 已让任务中枢继续返回 `retryRunnerCommand`，控制面和外部 Agent 可以直接拿到本地 Runner 回放入口
- 已让命令中心最近执行返回 `followUpTasks`，控制面开始共享 `命令 -> 后续任务 -> 证据缺口` 这条链
- 已让命令中心最近执行继续返回 `runtimeEvidenceSummary`，治理后台开始能直接回答“是哪条运行链、哪个版本的执行器把命令卡住”
- 已让命令中心返回 `remediationQueue`，控制面开始共享“当前最该处理的整改任务列表”
- 已新增 `task retry` 入口，整改任务现在可以直接回放其来源命令，而不是手工查找回流动作
- 已新增统一整改入口 `remediations`，把整改任务与放行升级动作收成同一份控制面事实源，并同步开放给 HTTP API、AI Core 与 MCP
- 已新增统一整改回放入口 `remediations/retry`，Runner 与外部 Agent 不再需要自己分流到 `tasks/retry` 或 `escalations/retry`
- 已让 `followUpTasks / blockingTasks / remediationQueue / releaseGate.escalationActions` 统一返回 `unifiedRetryApiPath / unifiedRetryRunnerCommand`，控制面默认以 remediation 协议做整改回放，旧路由只保留兼容
- 已让 `readiness / commands` 两个控制面主接口统一返回 `runtimeSummary`，Runner 健康度与版本证据不再需要由外部调用方自行拼装
- 已把 `tasks / remediations` 也收进同一套 `runtimeSummary`，控制面四个主入口现在共享同一份运行底座摘要
- 已把 `runners` 也收进统一控制面结构，五个主入口都已共享 `unifiedRemediationApiPath + runtimeSummary`
- 已让 `snapshot` 同时返回原始快照和 `controlPlane` 聚合块，外部 Agent 可以一次读取控制面主状态，不必串行拉取多条接口
- 已新增 MCP `forge_control_plane_snapshot`，外部 Agent 现在可以一次调用拿到 `runtimeSummary / readiness / blockingTasks / remediationQueue / recentExecutions`
- 已新增 `GET /api/forge/control-plane`，统一暴露 `runtimeSummary / readiness / releaseGate / blockingTasks / remediationQueue / evidenceTimeline / recentExecutions`
- 已开放 `commands` 的写入口，支持通过 HTTP API、AI Core 与 MCP 回写标准命令执行记录与策略判定
- 治理页已新增 `最近命令执行` 与 `策略判定`，能够直接看到“谁执行了什么标准命令、被哪条策略拦住”
- 已补最小自动策略判定：命令写入时若未显式提供 `decisions`，系统会按依赖工件和门禁状态自动生成默认阻断结论
- 已把一级入口重新收口成“前台交付 / 后台训练”结构：工作台只负责项目交付主链，`团队` 与 `命令中心` 明确降为训练与配置后台
- 首页已改成 `项目交付工作台`，团队页改成 `Agent 训练中心`，治理页改成 `命令中心`
- 已让首页 `立即动作` 变成真实命令触发入口，可直接执行 `生成 PRD / 发起测试门禁` 等标准命令
- 已补 `executeCommandForAI`，支持命令执行落盘、PRD 草案生成与门禁阻断结果回写
- 已开放命令执行的 HTTP API 与 MCP 工具 `forge_command_execute`，外部 Agent 不再只能写审计记录
- 已让 `生成 PRD` 命令联动更新 `PRD 工件 / 项目任务 / 当前阶段阻塞`，不再只产生一条文档
- 已让 `发起测试门禁` 命令联动回写 `测试报告工件 / 测试任务阻塞 / 测试验证阶段 blocker`
- 已让 `生成 TaskPack` 命令联动回写 `TaskPack 工件 / 开发接棒任务 / 开发执行阶段`
- 已让 `启动研发执行` 命令联动回写 `Run / Runner 心跳 / Demo 构建工件 / 开发执行状态`
- 已让 `启动研发执行` 命令同步产出 `Patch` 证据工件，执行链开始从“只有 Demo”升级成“Patch + Demo”双证据输出
- 已新增 `整理交付说明` 标准命令，交付发布阶段不再没有可执行动作
- 已让 `触发归档沉淀` 命令联动生成 `知识卡工件` 并推进到 `归档复用`
- 已让 `启动研发执行` 自动为 `Demo 构建` 创建待评审记录，测试 Agent 不再只看到工件状态
- 已让 `发起测试门禁` 在阻塞时自动把 Demo 评审更新为 `changes-requested`，评审闭环开始与门禁结果联动
- 已让 `发起测试门禁` 在阻塞时自动创建 `研发修复 remediation task`，失败结果会重新回流给 Engineer，而不是只停在 PM 升级事项
- 已让 `发起测试门禁` 正式绑定到 `QA Runner`，并留下独立门禁运行记录，运行时开始区分工程执行与浏览器验证职责
- 已让 `发起测试门禁` 同步产出 `playwright-run` 证据对象，门禁结果不再只体现在 run 和 test-report 上
- 已让 `发起测试门禁` 在通过时自动把 Demo 标记为 `ready`，并创建 `交付说明` 工件与发布接棒任务
- 已让 `发起测试门禁` 在阻塞时自动生成 `升级事项`，由产品经理接手处理门禁异常
- 已让 `整理交付说明` 命令进入 `人工确认` 状态：生成 `交付说明`、挂起 PM 评审，并阻塞在交付发布阶段
- 已新增 `确认交付放行` 标准命令，负责人确认后才允许进入 `归档复用`
- 已让 `确认交付放行` 命令联动回写 `交付说明通过 / 人工确认完成 / 归档知识任务`
- 已让 `确认交付放行` 同步产出 `review-decision` 证据对象，放行结果正式进入 Evidence Plane
- 已让 `整理交付说明` 正式绑定到 `交付编排执行器`，Release 阶段开始具备独立 Runner 责任链
- 已让 `整理交付说明` 提前产出 `review-decision` 待确认证据对象，放行评审从“批准时出现”升级成“待确认时已存在”
- 已让 `触发归档沉淀` 正式绑定到 `交付编排执行器`，归档阶段开始具备独立 Runner 执行责任
- 已让 `触发归档沉淀` 同步产出 `release-audit` 证据对象，Release 到 Knowledge 的交接开始具备正式审计记录
- 命令中心已新增 `待人工确认 / 升级事项` 两类视图，治理页不再只看门禁和审计
- 工件中心已新增 `证据时间线`，项目证据不再只散落在工件列表和运行记录里
- 项目页已新增 `交付就绪度`，可以直接回答当前项目是否具备放行条件
- 已新增交付 readiness 控制面接口，HTTP 与 MCP 都能直接读取 `交付就绪度 / 放行闸口汇总 / 证据时间线`
- 已新增 `发起规则审查` 标准命令，把主链补成 `Engineer -> Reviewer -> QA -> Release`
- 已新增 `代码评审执行器` 与 `review-report` 证据对象，规则审查开始具备独立 Runner 和正式证据输出
- `发起测试门禁` 已正式依赖 `review-report`，QA 不再绕过规则审查直接接管交付主链
- 已把 `7 条标准命令` 收成正式 `Command Contract`，并暴露给 AI Core，命令中心不再只依赖 seed 命令定义
- 已新增 `runner:forge` CLI，本地 Runner 现在可以真实回写 `busy -> execute -> idle/blocked` 状态链
- 已让 `runner:forge` 支持按命令契约自动选 Runner，并把整次执行回写成正式 `run` 生命周期
- 已让 `runner:forge` 支持 `--task-id`，整改任务现在可以直接通过本地 Runner 回放，不再手工查 `command-id`
- 已让 `tasks / readiness / commands` 三条控制面接口共享 `retryRunnerCommand`，整改链开始具备统一回放入口
- 已完成一次真实 smoke check：`runner-reviewer` 成功执行 `command-review-run` 并回写规则审查结果
- 已重写 README，对外叙事已收口为 `本地优先的 AI 研发交付系统`，并明确当前主链、Runner 边界与接口入口
- 已补最小 `Runtime Adapter` 层，并让 `execution.start / review.run / gate.run` 开始通过 adapter 产出证据与执行摘要
- 当前 Runtime Adapter 已把 `Engineer / Reviewer / QA` 三类职责从 `forge-ai.ts` 的命令分支里抽离出第一层可替换实现
- 已把 Runtime Adapter 注册表暴露给命令中心，Runner CLI 现在可以直接读到 `execution plan`
- Runner CLI 已支持返回 `mode / cwd / command / expectedArtifacts`，开始具备外部执行器接入壳
- 已新增 `--execute-plan` 真执行模式，Runner 可直接尝试执行本地 shell plan，并把失败回写成阻塞
- 已补通用 `shell executor`，为后续接 Playwright / Codex / Reviewer 提供统一的本地进程执行基础
- 已让 `shell executor` 识别本地执行器的 JSON 输出，并优先把结构化 `summary` 写回 Runner 结果
- 已把 QA 本地执行器的结构化摘要写入 `run` 遥测，Run 时间线不再只有状态变更
- 已新增 `forge-engineer-runner.mjs`，Engineer 链不再直接依赖裸 `codex exec` 模板，开始具备真实本地 wrapper
- 已新增 `forge-review-runner.mjs`，Reviewer 链不再依赖不存在的 `forge-review` 裸命令，开始具备真实本地 wrapper
- 当前 Runtime Adapter 已经分别挂上 `forge-engineer-runner.mjs`、`forge-review-runner.mjs` 和 `forge-qa-runner.mjs`，Engineer / Reviewer / QA 三条链都开始有可替换本地执行壳
- 已让 `execution.start` 的执行计划显式解析当前项目的 `taskpack-id`，工程链开始从“latest” 模糊引用收口为正式工件输入
- 已让 `tasks / readiness / remediations / recent command executions` 全部显式返回 `taskPackId / taskPackLabel`，整改链和控制面不再依赖隐式 `latest task-pack`
- 已让 `task retry / remediation retry / runner:forge --task-id/--remediation-id` 显式回放到来源 `taskPackId`，整改回放不再退回模糊工件选择
- 已给 Engineer / Reviewer / QA 三个本地执行器补上最小能力探测，开始显式区分 `codex-ready / review-ready / playwright-ready` 与合同模式
- 已让 Runner 在 `--execute-plan` 成功后显式回传本地执行器的 `mode / checks / summary`，执行结果开始具备可观察的能力状态
- 已让 `checks.summary` 继续透传进 run 遥测、执行页和命令摘要，控制面开始能看到本机工具路径与版本摘要，而不只是一句 `pass/fail`
- 已把 runtime notes 继续透传进命令执行摘要，控制面在阻塞态下也能看到当时的本地执行能力状态
- 已新增结构化 `放行审批链`，把 `最新运行信号 / 交付说明评审 / 放行评审结论 / 归档审计记录` 收成正式控制面输出，而不再只靠摘要字符串
- 已让 `release gate` 继续产出 `自动升级动作`，控制面现在不仅能看到审批风险，还能明确给出 `负责人 / 触发条件 / 下一步 / 是否阻断发布`
- 已让 `release gate` 的 `自动升级动作` 继续带上 `runtimeEvidenceLabel`，控制面开始能直接解释“基于哪条运行证据、哪个版本做升级判断”
- 已让 `release gate` 的 `自动升级动作` 继续带上 `taskId / taskLabel / retryRunnerCommand`，治理后台开始能直接从升级动作定位责任任务并回放到本地 Runner
- 已让项目页、执行页和命令中心开始共用“来源命令 -> 后续任务”的责任链，任务不再只是孤立待办
- 已让 `readiness` 控制面返回 `blockingTasks`，发布判断开始同时引用当前阻断任务链
- 已让 `blockingTasks` 一起返回任务证据链，放行判断开始共享 `来源命令 -> 任务 -> 证据缺口`
- 已让 `blockingTasks` 一起返回整改责任链，放行判断开始共享 `来源命令 -> 任务 -> 证据缺口 -> 谁来修`
- 已让 `blockingTasks` 一起返回整改后的回流命令，放行判断开始共享 `来源命令 -> 任务 -> 谁来修 -> 修完重跑什么`
- 已让 `blockingTasks / remediationQueue` 一起返回 `runtimeCapabilityDetails`，整改链开始共享版本号和本地执行器证据
- 已让命令中心的 `阻断任务链 / 后续任务` 直接显示这些运行能力证据，治理后台开始具备更清晰的环境归因
- 已让 `readiness` 一起返回 `runtimeCapabilityDetails`，发布判断开始同时引用运行信号和二进制/版本证据

**仍待推进**
- 建立 Agent 的独立 Prompt Registry 版本历史与审计记录
- 建立更细粒度的 `Runner` 能力遥测、结果日志和失败归因链路，把当前半模拟执行继续推进到真实外部模型与测试执行
- 建立组件注册表和 GitHub 资源装配链路
- 让命令执行结果继续联动更完整的 `Release Audit / Approval Trace / MCP 命令更新`，而不只推进工件和任务状态
- 把 `TaskPack -> Patch -> Review -> Gate -> Remediation` 收成 Evidence Plane 的正式主链，而不是分散在多处状态更新里

## 三、建议的产品主轴

建议正式锁定 Forge 的产品主轴为：

`Agent Team + Artifact Flow + Asset Assembly + Task Control`

换句话说：
- **首页** 看整体态势
- **项目** 看阶段推进和项目 DNA
- **团队** 看 Agent 协作和 handoff
- **工件** 看标准交付物和评审流
- **执行** 看真实 Runner 和 AI 运行
- **资产** 看 Prompt / Skill / 模板 / 组件装配
- **治理** 看门禁、审计、成本、权限

如果继续把系统理解成“流程型仪表盘”，产品会继续混乱；只有把这 7 个对象的职责彻底固定，系统才会稳定。

## 四、实施顺序

### P0-A：5 分钟起盘体验

**目标**
- 让新项目创建后立即具备模板、角色、工件、任务、门禁和本地工作区，不再从空白页面开始。

**要做的事**
1. 创建项目自动注入模板、Prompt、门禁与工作区
2. 自动生成首批工件与首批任务
3. 项目页明确展示“起盘后自动注入”与默认基线
4. 首页改成价值表达，直接说明 Forge 在解决什么问题

**当前状态**
- 已完成第一版
- 下一步补“快速开始向导”和“默认团队模板切换”

### P0-B：交付骨架成型

**目标**
- 让 Forge 真正能表达一条完整交付链，而不是停留在展示层。

**要做的事**
1. 建立正式的工作流状态机
- 不再用 `progress` 推断阶段。
- 阶段流转基于工件、门禁和 handoff 条件决定。

2. 补齐标准工件模型
- 新增：`Architecture Note`、`UI Spec`、`Demo Build`。
- 让“原型及架构”和“demo”成为正式对象。

3. 建立工件交接规则
- 谁产出
- 谁评审
- 通过条件
- 缺失输入时如何阻断

4. 工件页升级成交接中心
- 待接棒队列
- 待评审工件
- 当前缺失工件
- 交付 readiness

**验收标准**
- 任意一个项目都能看清楚当前阶段、已完成工件、缺失工件、下一个责任角色。

### P0-C：执行闭环

**目标**
- 让 Runner、Run 和失败归因形成最小闭环，而不是只有“运行中 / 阻塞中”的平面状态。

**已完成**
1. `Run Event` 事件流
- 每次回写运行结果时自动落一条事件记录。

2. 失败归因分类
- 已支持 `规格缺口 / 工具链问题 / 环境问题 / 权限问题 / 测试失败 / 未知问题`。

3. 执行页增强
- 已能直接看到最新失败归因和最近事件流。

**下一步**
1. 做 `命令中心`
- 把 `生成 PRD / 生成 TaskPack / 启动执行 / 发起门禁 / 归档沉淀` 做成标准命令。

2. 做 `Hook / Policy`
- 在 `beforeRun / afterRun / beforeRelease` 这类节点挂自动检查和审计。

### P0-D：命令中心与策略基线

**目标**
- 把高频交付动作从“散落在不同页面的按钮”升级成“标准命令 + 可审计策略”。

**最小命令集**
1. `生成 PRD`
2. `生成 TaskPack`
3. `启动研发执行`
4. `发起测试门禁`
5. `触发归档沉淀`

**最小 Hook / Policy**
1. `beforeRun`
- 校验当前项目是否具备必要工件和 Runner。

2. `afterRun`
- 回写 run event、失败归因和下一个 handoff 建议。

3. `beforeRelease`
- 校验门禁、测试报告和交付说明是否齐备。

**页面边界**
- `治理` 页承接命令中心与策略摘要
- `执行` 页只显示 Runner 与实际运行结果

**当前状态**
- 已完成最小 `Command Registry`
- 已完成最小 `Hook / Policy` 注册表
- 已接通 `治理` 页、HTTP API、AI Core 与 MCP 的读取链路
- 已接通 `Command Execution / Policy Decision` 的写入链路，并形成最小审计闭环
- 已让 `commands` 写入口具备最小自动判定能力，不再要求前端先手工构造所有策略结论

### P1：Agent Team 可运行

**目标**
- 让 Agent 真正变成协作单位。

**要做的事**
1. 建立 Agent Registry
- 每个 Agent 独立拥有：
  - 人设
  - Prompt 模板
  - Skill 集
  - SOP
  - 知识库绑定
  - 权限配置

2. 建立 Handoff Engine
- 产出工件后自动生成待接棒任务。
- 下一个 Agent 只能消费授权工件。

3. 建立 Review / Escalation 机制
- 哪些工件必须人工确认
- 哪些工件必须 QA / 发布审查
- 何时升级给人类

4. 团队页升级成协作页
- 当前谁在处理什么
- 谁在等待输入
- 哪些交接超过时限

**验收标准**
- 至少跑通一条固定团队模板：
  - 产品经理 Agent -> 设计/架构 Agent -> 研发 Agent -> 测试 Agent -> 发布 Agent

### P2：资产装配系统

**目标**
- 让 Forge 真正具备“少写代码、快组装”的能力。

**要做的事**
1. 建立 Component Registry
- 登录
- 支付
- 上传下载
- 权限
- 列表/表单/图表

2. 建立 TaskPack 装配器
- 输入 PRD / TaskPack
- 识别需要的功能模块
- 推荐可复用组件和 Skill
- 生成拼装方案

3. 建立 GitHub Resource Search Adapter
- 按标签、语言、成熟度搜索外部资源
- 标注安全等级和适配建议

4. 建立资产评分回写
- 哪些组件被用了
- 哪些成功交付
- 哪些门禁失败
- 回写推荐权重

**验收标准**
- 新项目建立后，系统能自动推荐至少一组可直接复用的组件 / Skill / Prompt 组合。

### P3：任务管理中枢

**目标**
- 支持多个项目同时运转，不靠人工记忆。

**要做的事**
1. 建立 Task 对象
- 项目任务
- Agent 任务
- Handoff 任务
- 阻塞任务

2. 建立多项目驾驶舱
- 当前阶段
- 当前负责人
- 阻塞原因
- 当前运行
- 预计交付时间

3. 建立执行容量视图
- 哪些 Agent 正在忙
- 哪些 Runner 正在跑
- 哪些项目互相抢占资源

4. 建立优先级和 SLA
- 高优先级项目优先调度
- 交接超时自动预警

**验收标准**
- 负责人能够在一个页面里同时盯住多个项目、多个 Agent 和多个运行任务。

## 五、推荐的实际推进顺序

不按“页面数量”推进，而按“系统骨架”推进：

1. 先做 `工作流状态机 + 工件契约`
2. 再做 `Agent Registry + Handoff Engine`
3. 再做 `Runner 接入 + 执行控制台`
4. 再做 `资产装配器 + 组件注册表`
5. 最后做 `多项目任务中枢`

原因很直接：
- 没有工件契约，协作会乱
- 没有 handoff，Agent Team 只是展示
- 没有 Runner，执行还是假的
- 没有资产装配，复用只是口号
- 没有任务中枢，多项目协作无法成立

## 六、下一阶段我建议立刻开工的内容

下一刀直接做：

### 主题：`工件驱动状态机 + Handoff 队列`

**原因**
- 这是 4 条产品定位的共同底座。
- 一旦这层做对，项目、团队、执行、资产四个页的职责都会稳定下来。

**本轮目标**
1. 为阶段定义正式进入/退出条件
2. 为每个阶段定义 required artifacts
3. 为每类工件定义 owner / reviewer / next role
4. 在团队页和工件页展示待接棒队列

---

## 六点五、当前进展

截至 `2026-03-08` 当前工作区已经完成：

1. 核心工作流状态机已从页面逻辑下沉到 `packages/core`
2. 团队页已加入 `待接棒事项`
3. 工件页已加入 `待接棒队列` 与 `关键缺失工件`
4. 默认 seed 数据已补齐 `架构说明 / 原型规范 / Demo 构建`
5. 项目页已加入 `阶段准入与缺口`
6. 执行页已加入 `当前执行焦点 / 阻塞原因`
7. Handoff 已补 `reviewerAgent / escalationRule`

下一步继续做：

1. 为 Handoff 增加超时与责任升级策略
2. 给执行页接入真实 Runner 状态
3. 给工件补 reviewer 通过条件与 review 结果记录
4. 将持久化状态机接入多项目任务中枢和阶段推进审计

---

## 七、最终判断

Forge 不应该继续被理解为：
- 聊天式 AI IDE
- 节点型仪表盘
- 只是项目管理工具

Forge 应该被坚定定义为：

`一个本地优先的 Agent Team 研发操作系统，用标准工件、专业 Agent、资产装配和任务中枢，去模拟并加速互联网大厂的标准化研发交付流程。`

补充架构稿：
- [Forge 与 “Kubernetes for Agents” 对齐设计](../../docs/plans/2026-03-08-forge-agent-kubernetes-control-plane-design.md)
