# Forge 与 “Kubernetes for Agents” 对齐设计

**日期：** 2026-03-08  
**目标：** 明确 Forge 在 `Kubernetes for Agents` 语境下的 `control plane / data plane` 边界，避免产品继续把“管理、编排、执行、治理”混在一起。  
**结论：** Forge 应先成为 `Agent Team OS control plane`，数据执行面保持 `local-first runner mesh`，而不是急着把整套系统直接部署到 Kubernetes。

---

## 1. 为什么现在要做这个划分

当前 Forge 已经具备 `项目 / 团队 / 工件 / 执行 / 资产 / 治理` 六个一级对象，也已经有：
- Agent Registry
- Skill / SOP / Prompt Registry
- Project Workflow State
- Artifact Flow
- Task / Run / Gate
- 审计与阶段流转历史

但这些能力仍然散落在同一产品壳里，容易出现两个问题：
- 把“谁来决定”与“谁来执行”混在一起
- 把“产品管理台”与“本地执行引擎”混成一套页面和模型

如果继续这样长，Forge 会越来越像一个不断加卡片的桌面后台，而不是一个真正可扩展的 Agent 编排系统。

---

## 2. Forge 的推荐定位

Forge 不应该被定义成：
- 纯聊天式 AI IDE
- 单纯项目管理工具
- 直接等价于 Kubernetes 本体

Forge 应定义成：

`一个 local-first 的 Agent Team Control Plane，负责定义团队、工件、流程、策略和调度；一个可插拔的本地 Data Plane 负责真实执行 AI、工具、构建和测试。`

换句话说：
- Forge 桌面 App 主要承担 `control plane`
- 本地 Runner、模型适配器、Playwright、构建器承担 `data plane`
- 未来如果要上云，只是把 data plane 从单机扩成多 Runner，而不是重写产品主轴

---

## 3. Control Plane 对应什么

### 3.1 Forge 里的 Control Plane

这些能力属于控制面，应该由 Forge 主应用负责：

1. `Project Control`
- 项目创建
- 项目 DNA
- 模板注入
- 项目生命周期

2. `Workflow Control`
- 阶段状态机
- 阶段准入规则
- handoff 条件
- reviewer / escalation 规则

3. `Agent Control`
- Agent Registry
- Team Template
- Prompt / Skill / SOP / Knowledge Binding
- Agent 权限与 owner mode

4. `Artifact Control`
- PRD、架构说明、UI Spec、TaskPack、Patch、Demo、Test Report、Release Brief
- 工件 owner / reviewer / next role
- 工件 readiness

5. `Task Control`
- 多项目任务中枢
- 优先级
- SLA
- 调度约束

6. `Governance Control`
- 门禁策略
- 成本策略
- 审计
- 风险升级

### 3.2 当前已经具备的控制面基础

- `projects / project_profiles / workflow_states / workflow_transitions`
- `agents / skills / sops / team_templates`
- `artifacts / artifact_reviews`
- `tasks / delivery_gates / project_asset_links`

这些基础已经说明 Forge 走对了方向，只是还没有把“控制面”这个角色显式化。

---

## 4. Data Plane 对应什么

### 4.1 Forge 里的 Data Plane

这些能力属于数据执行面，不应和控制面搅在一起：

1. `Local Runner`
- 本地任务进程
- 队列执行
- 进程管理
- 重试与取消

2. `Model Adapters`
- Claude
- Codex
- 本地模型
- 未来的多模型路由

3. `Tool Execution`
- 文件读写
- Git 操作
- Shell 命令
- Playwright
- 构建 / 测试 / 打包

4. `Workspace Runtime`
- 本地项目目录
- 临时文件
- 缓存
- 构建产物

5. `Run Telemetry`
- 日志
- 成本
- token / duration
- exit status
- artifact output

### 4.2 为什么要和控制面分开

因为执行面天然更脏、更重、更依赖环境：
- 本地权限
- 外部 CLI
- 模型网络可用性
- Playwright 浏览器
- 构建缓存与依赖

如果这些都挤进主应用页面和主数据模型里，Forge 很快会失控。

---

## 5. Forge 当前模块映射

### Control Plane
- `首页`：负责人态势视图
- `项目`：Project + Workflow Control
- `团队`：Agent Control
- `工件`：Artifact Control
- `资产`：Asset / Capability Registry
- `治理`：Policy / Audit / Gate Control

### Data Plane
- `执行`：Run Console，只显示 data plane 状态，不负责定义流程
- `packages/runner`：后续真正的 runner 编排层
- `packages/ai`：模型和执行适配层
- `packages/db`：本地控制面状态与执行结果落盘

---

## 6. 推荐的产品边界

### Forge App 负责
- 定义
- 编排
- 决策
- 规则
- 审计
- 调度

### Runner 负责
- 执行
- 回传
- 失败归因
- 产物写入

一句话：

`Forge 决定“该做什么、谁来做、做到什么算通过”；Runner 负责“真的去做”。`

---

## 7. 下一阶段实现顺序

### Phase A：把控制面彻底做实
- 给 `Task` 增加跨项目中枢视图
- 给 `Workflow` 增加正式推进规则和审计查询
- 给 `Artifact` 增加更严格的 owner / reviewer / readiness 契约
- 给 `Governance` 增加策略与历史面板

### Phase B：建立最小 Data Plane
- 新建 `packages/runner`
- 定义 `RunSpec / RunnerCapability / RunnerStatus`
- 把 Claude / Codex / Playwright 包成统一执行协议
- 执行页改成真正的 runner console

### Phase C：建立 Control -> Data 的调度链
- Task 触发 RunSpec
- RunSpec 分配到本地 Runner
- Runner 回写 Run / Artifact / Workflow
- Gate 决定是否允许阶段推进

### Phase D：再考虑云端扩展
- 本地单 Runner
- 多本地 Runner
- 云端 Runner Pool
- 多租户隔离

这一步之前，不需要真的上 Kubernetes。

---

## 8. 对当前产品路线的直接建议

现在最该继续做的，不是“再加一个 Agent 页面”或“再加一个图表”，而是：

1. 把 `Task 中枢` 做成真正的 control plane 调度入口  
2. 把 `packages/runner` 做成最小 data plane  
3. 把 `执行页` 改造成 runner console  
4. 把 `治理页` 做成 policy + audit 页面  

这样 Forge 才会从：

`有很多对象的桌面产品`

变成：

`一个能编排 Agent Team、并驱动本地执行面的控制系统`

---

## 9. 最终判断

如果用一句话定义 Forge 与 “Kubernetes for Agents” 的关系：

`Forge 不该先成为“跑在 Kubernetes 上的 Agent 产品”，而应先成为“借鉴 Kubernetes 控制面思想的 Agent Team 控制系统”。`

等本地控制面、Runner、调度和治理成熟以后，再决定是否把 data plane 扩展到云端。
