# Forge Agent Team Architecture

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 Forge 从“单个 AI 工具工作台”升级成“Agent Team 研发组织系统”，在一个 App 内模拟互联网大厂研发团队的分工、协作、质检和沉淀方式。

**Architecture:** Forge 不再只围绕项目节点做页面，而是围绕 `Agent Team + Artifact Flow + Governance` 三层运行。每个 Agent 有独立人设、职责、提示词、技能包、工作规范和权限；Agent 不直接互相乱聊，而是围绕标准工件协作，如 PRD、TaskPack、Patch、Test Report、Release Note。

**Tech Stack:** Electron、Next.js App Router、SQLite、MCP、Local Runner、Prompt Registry、Skill Registry

---

## 1. 产品定义升级

Forge 的新定义不是“项目管理工具”，也不是“AI IDE”。

Forge 应该被定义为：

`一个本地优先的 Agent Team Operating System，用来组织多个专业 Agent，像互联网大厂研发团队一样协作完成需求、设计、开发、测试、发布和沉淀。`

这意味着 Forge 未来的核心不再只是页面和节点，而是：

1. `团队编制`
2. `角色职责`
3. `协作协议`
4. `工件流转`
5. `质量与权限治理`

## 2. 目标组织形态

首版不要做“任意多 Agent 自由编排”，而是先做固定团队编制。

建议首批 Agent Team：

1. `产品经理 Agent`
- 负责需求澄清、PRD 生成、范围收口、验收标准。

2. `架构师 Agent`
- 负责技术方案、模块拆分、依赖和风险评估。

3. `设计系统 Agent`
- 负责页面结构、组件约束、交互规范、UI 审查。

4. `研发 Agent`
- 负责代码生成、重构、补丁、接口和数据层实现。

5. `测试 Agent`
- 负责测试用例、门禁、回归、失败归因。

6. `发布 Agent`
- 负责构建、预览、交付检查、变更说明。

7. `知识沉淀 Agent`
- 负责模板抽取、Prompt 沉淀、踩坑记录、最佳实践归档。

首版用户只需要“组建一支团队”，不需要自己从零造角色。

## 3. Agent 元模型

Forge 里每个 Agent 都必须是正式对象，而不是一段 prompt。

### Agent

- `id`
- `name`
- `role`
- `persona`
- `responsibilities`
- `inputArtifacts`
- `outputArtifacts`
- `skills`
- `promptTemplateId`
- `policyId`
- `permissionProfileId`
- `handoffRules`
- `reviewRules`
- `ownerMode`

### 关键要求

1. `技能` 和 `提示词` 分开管理
- Skill 是能力包
- Prompt 是行为模板

2. `人设` 和 `职责` 分开
- 人设定义表达风格与决策倾向
- 职责定义允许做什么、不允许做什么

3. `权限` 独立配置
- 哪些 Agent 能读代码
- 哪些 Agent 能跑命令
- 哪些 Agent 只能产出建议不能落地

## 4. 协作方式

Forge 不应该让 Agent 自由对话式协作，因为那会失控。

应该采用：

`基于工件的协作`

每个 Agent 不直接把结果塞给下一个 Agent，而是产出标准工件：

- `PRD`
- `Architecture Note`
- `UI Spec`
- `TaskPack`
- `Patch`
- `Test Report`
- `Release Brief`
- `Knowledge Card`

下一个 Agent 只消费被授权的工件。

这会带来 4 个好处：

1. 协作可追踪
2. 结果可回放
3. 失败可定位
4. 经验可沉淀

## 5. 协作协议

每次协作都必须经过明确协议，而不是一句“继续”。

建议 Forge 内置这 5 类协议：

### 5.1 Handoff 协议
- 上一个 Agent 交付什么工件
- 下一个 Agent 需要确认什么输入
- 缺失什么信息时阻断

### 5.2 Review 协议
- 哪些工件必须被谁审
- 通过条件是什么
- 是否允许跳过

### 5.3 Escalation 协议
- 何时升级给人类
- 何时回退到上一节点
- 何时标红风险

### 5.4 Execution 协议
- 哪些 Agent 可以真正执行代码、命令、测试
- 哪些 Agent 只能提方案不能执行

### 5.5 Archive 协议
- 什么结果可以沉淀为模板
- 什么结果只能作为项目私有经验

## 6. Forge 页面结构要跟着变化

如果要做 Agent Team，页面结构也要升级。

建议一级导航变成：

1. `首页`
- 只看项目态势、当前团队进度、阻塞和下一动作

2. `项目`
- 项目接入、模板绑定、项目 DNA

3. `团队`
- Agent 列表
- 角色分工
- 当前谁在处理什么

4. `工件`
- PRD
- TaskPack
- Patch
- Test Report
- Release Brief

5. `执行`
- 本地 Runner
- AI 调用
- 构建
- 测试

6. `资产`
- Prompt
- Skill
- 模板
- 经验沉淀

7. `治理`
- 权限
- 门禁
- 审计
- 成本

现在的“节点页”还需要保留，但它们应该服务于工件流和团队协作，而不是单独存在。

## 7. 首版团队运作模式

首版不做开放式多 Agent 编排，先做 3 种固定 Team 模板：

### Team A: 标准交付团队
- 产品经理 Agent
- 架构师 Agent
- 研发 Agent
- 测试 Agent
- 发布 Agent

### Team B: UI 强约束团队
- 产品经理 Agent
- 设计系统 Agent
- 研发 Agent
- 测试 Agent

### Team C: 沉淀优先团队
- 产品经理 Agent
- 研发 Agent
- 测试 Agent
- 知识沉淀 Agent

用户创建项目时，不是只选项目模板，还要选 `Team Template`。

## 8. 首版最关键的新模块

### 8.1 Agent Registry
- 管理所有 Agent 定义

### 8.2 Skill Registry
- 管理 Agent 可调用技能

### 8.3 Prompt Registry
- 管理 Agent 专属提示词模板

### 8.4 Policy Registry
- 管理工作规范、审查规范、交付规范

### 8.5 Artifact Hub
- 管理工件流转和版本

### 8.6 Team Runtime
- 让多个 Agent 围绕工件按协议运行

## 9. 对当前 Forge 的改造优先级

### P0

1. 增加 `Agent`、`TeamTemplate`、`Artifact` 数据模型
2. 增加 `团队` 页面
3. 增加 `Agent Registry / Prompt Registry / Skill Registry` 基础表结构
4. 让 PRD、任务包、测试结果变成正式工件

### P1

1. 增加 Handoff 记录
2. 增加 Review 记录
3. 增加 Team Runtime 状态面板
4. 增加每个 Agent 的权限和执行模式

### P2

1. 多 Team 并行
2. 自定义 Agent 编制
3. 高级协作编排
4. 云端共享团队模板

## 10. 当前判断

如果你要的真的是“像大厂研发团队一样跑”，那 Forge 的核心产品单位必须从：

`Project -> Workflow Node`

升级成：

`Project -> Team -> Agent -> Artifact -> Review -> Release`

这是本质变化，不是加几个机器人头像就够了。

## 11. 下一步实施建议

下一步不要继续堆首页，而是按下面顺序推进：

1. 先补 `Agent / Team / Artifact` 三个核心数据模型
2. 再做 `团队` 页面和 `工件` 页面
3. 再把 PRD / TaskPack / Test Report 接入 Artifact Hub
4. 最后做最小 Team Runtime，让固定编制团队先跑起来
