# Forge Paperclip Suite Design

## Goal

在不改动现有 `app/` 与 `src/components/` 页面实现的前提下，重新设计一套新的前台界面方案。新方案参考 `paperclip` 官网的视觉语气和模块拆分方式，但服务于 Forge 的产品边界：

- 仪表盘
- 项目管理
- AI员工
- 资产管理

这套方案不是“再做一个 agent 聊天壳”，而是把 Forge 的 `交付控制面` 做成更有产品感、更适合展示和后续实现的页面体系。

## Reference Extraction

从 `paperclip` 官网和仓库演示里提取的可借鉴风格，分成两层：

1. 顶层模块页
   - 可以更有叙事感，但仍需克制，不能做成营销页。
2. AI 员工内页
   - 必须是高密度的应用内控制台，不是概念稿。
   - 典型骨架是：窄图标栏 + 主侧栏 + 右侧主工作区。
   - 首屏先给操作按钮、最新运行、4 个小统计卡、事项表。
   - 信息组织依赖导航和卡片，不依赖大 Hero 和长文案。
3. 黑色控制台语法
   - 大面积纯黑背景、细线分隔、低饱和状态色、卡片密度高。
4. 模块分治
   - `组织架构 / 工单 / 心跳 / 治理` 这类对象适合拆成子页，而不是塞进一个“AI员工”总页。

## New Visual Direction

这次不延续现有浅色企业仪表盘方案。顶层模块页和 AI 员工页分开处理：

- 仪表盘 / 项目 / 资产：
  - 保留更强的叙事和展示感
- AI 员工：
  - 统一切成 `paperclip` 风格的应用内控制台壳
  - 使用独立样式文件，不复用之前的展示稿样式

- Base: pure black / graphite 深色基底
- Surface: near-black layered panels
- Accent: orange + blue + green 状态信号
- Typography:
  - Body: `IBM Plex Sans`
  - Mono: `IBM Plex Mono`

视觉目标：

- 让 Forge 看起来像“AI 交付指挥室”
- 保留严肃性，但不做传统 SaaS admin
- 首页能拿去演示，二级页能拿去实施

## Information Architecture

### 1. 仪表盘

作用不是汇总所有数据，而是回答三件事：

- 当前整体交付节奏怎么样
- 哪些项目最需要关注
- 接下来哪条责任链要先处理

页面结构：

1. Hero: 本周交付态势 + 当前风险
2. Program Tempo: 项目总览 / 阶段分布 / handoff 密度
3. Next Actions: 最紧急的项目、升级项、待人工确认
4. Run Ledger: 最近关键运行与证据变化
5. Release Surface: 即将进入放行的项目与缺口

### 2. 项目管理

作用是把“项目列表”升级成“在推进中的交付组合”。

页面结构：

1. Hero: 当前项目池状态
2. Filter Rail: 阶段 / 风险 / owner / backend
3. Project Cards: 每个项目展示阶段、负责人、缺口、默认执行链
4. Delivery Lane: 按 `Intake -> Build -> Review -> Gate -> Release`
5. Project Spotlight: 当前最值得介入的三个项目

### 3. AI员工

作用不是列 prompt，而是管理一组可接棒、可升级、可审计的数字员工。

页面拆成八个子页：

1. 团队总览 / 入职编制
   - 哪些执行器已经入职
   - 当前由哪些 runtime 在工作
   - 谁在线、谁卡住、谁最常被升级
2. 组织架构
   - 角色层级
   - 汇报关系
   - 默认接棒方向
3. 目标对齐
   - 公司目标
   - 项目目标
   - 工单为什么存在
4. 工单中心
   - 工单线程
   - 当前责任人
   - 升级与审计
5. 心跳排班
   - 周期性唤醒
   - 值班密度
   - 定时任务负载
6. 成本控制
   - 每名员工月预算
   - 超额停机
   - 成本热点
7. 治理控制
   - 暂停 / 接管 / 审批
   - 预算上限
   - 策略覆盖
8. 员工详情
   - 单个 AI 员工的工作台
   - 包含线程、任务、工具、知识、目标、心跳、预算、handoff

### 4. 资产管理

作用是让复用资产成为“可运营对象”，而不是静态列表。

页面结构：

1. Hero: 当前资产复用收益
2. Asset Shelves: 组件 / Prompt Pack / TaskPack / Evidence Kit / Playbook
3. Provenance Strip: 最近被哪个项目调用
4. Reuse Opportunities: 哪些资产值得提纯
5. Risk Shelf: 哪些资产版本旧、失败率高、需要回收

## AI Employee Page Rule

AI 员工区后续一律按下面的页面语法执行：

- 这是应用内页，不是营销页
- 统一使用左双栏：
  - 窄图标栏
  - 主侧栏
- 主工作区统一先给：
  - breadcrumb
  - 头部身份卡或模块卡
  - 操作按钮
  - 运行摘要
  - 紧凑统计卡 / 图表卡
  - 事项表或审批表
- 员工详情页直接参考 `paperclip` 演示里的单人控制台结构

这意味着 AI 员工区不能再使用大 Hero、长段说明和展板式长页面。

## Copy Direction

本轮新稿统一采用“中文优先”：

- 页面标题、按钮、筛选器、说明文案全部改成中文
- 保留必要专有名词：
  - `OpenClaw`
  - `TaskPack`
  - `Review`
  - `QA`
- 若必须出现英文概念，优先写成 `中文（英文）`，不再直接整页英文

## Interaction Principles

1. 页面要以“决策动作”收口
   - 每个区块底部都应回答“下一步做什么”。
2. 不靠隐藏层级表达复杂度
   - 关键状态应该在首屏可见。
3. 把运行链路做成视觉对象
   - handoff、backend、evidence、release 要有清晰卡片和标签。
4. 保留产品演示感
   - 页面能拿去讲故事，不只是内部后台。

## Deliverables

本轮新建独立 wireframe 目录：

- `docs/wireframes/2026-03-11-paperclip-suite-v1/visual-spec-card.md`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/shared.css`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/paperclip-ai.css`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-dashboard.html`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-projects.html`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-ai-workforce.html`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-ai-org-chart.html`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-ai-goal-alignment.html`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-ai-ticket-center.html`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-ai-heartbeats.html`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-ai-cost-control.html`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-ai-governance.html`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-ai-employee-detail.html`
- `docs/wireframes/2026-03-11-paperclip-suite-v1/mock-assets.html`

## Implementation Guidance

如果后续进入真实实现，建议保持以下边界：

1. 先实现新的 shell 和 tokens，不改旧页面。
2. 先做 `dashboard / projects / ai-workforce / ai-org-chart / ai-goal-alignment / ai-ticket-center / ai-heartbeats / ai-governance / ai-employee-detail / assets` 这批静态页。
3. 再把现有 Forge selectors 和 API 数据逐步映射到新页面。
4. AI 员工先按 `团队总览 / 组织架构 / 目标对齐 / 工单中心 / 心跳排班 / 成本控制 / 治理控制 / 员工详情` 八页实现。
5. 员工详情页优先落“实时线程 / 目标来源 / 心跳预算 / 上下文抽屉”四块。
