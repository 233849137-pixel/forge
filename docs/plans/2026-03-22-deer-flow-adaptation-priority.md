# DeerFlow Adaptation Priority Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 基于 `DeerFlow` 的能力边界，筛出最适合在当前 Forge 项目中迁移的底层方法，并按“2 周内可落地 / 中期再做 / 当前不建议碰”三个层级排序，避免把 demo 优先的产品节奏带偏成通用 Agent 平台重构。

**Current Project Constraint:** 当前系统已经具备 `AI 员工页 + 项目工作台 + 交付链路 + 模型网关 + 本地配置`，但仍以 demo 场景、项目推进和交付叙事为主，不适合引入大规模运行时重构。

**Core Decision:** 只迁移 `DeerFlow` 中对“员工真实性、上下文治理、执行稳定性”有直接帮助的方法；不迁移其通用 Agent 平台心智、LangGraph-first 组织方式和完整 sandbox orchestration 栈。

---

## Recommended Priority Split

### A. 2 周内值得落地

这些能力与当前工作台、AI 员工、交付链最直接相关，且能在不重写系统基础结构的前提下获得明显收益。

#### 1. Skills 按需加载

**Why now**
- 当前员工 `skillIds` 已经能配置，但工作台上下文还没真正按节点精准注入。
- 这是最接近 `DeerFlow` 且最能提升“员工像真员工”的能力。

**Target outcome**
- 不同员工在不同节点只加载必要 skill 摘要
- 不再把所有 skill 一次性塞进 prompt

**Direct fit**
- 团队页
- 项目工作台
- 员工上下文注入链

#### 2. Memory 注入预算

**Why now**
- 你已经明确担心文档和知识注入会爆 token。
- `DeerFlow` 的价值不在“有记忆”，而在“记忆有预算、有筛选”。

**Target outcome**
- 为员工上下文增加预算规则：
  - 常驻人格/岗位设定
  - 节点必要产物摘要
  - 限额知识摘录

**Direct fit**
- `resolveWorkbenchAgentContext()`
- 模型网关 prompt builder

#### 3. 动态工具组装

**Why now**
- 当前员工主要是“人设差异”，工具能力差异还不够明确。
- 你后面会越来越需要区分产品、研发、测试、资产员工。

**Target outcome**
- 不同角色拿不同工具集
- 先从“显示和控制”做起，不必一次把所有工具都做成运行时热插拔

**Direct fit**
- 工程员工：bash / 文件 / 测试
- 产品员工：知识检索 / 文档汇总
- 资产员工：归档 / 资料绑定 / 摘要

#### 4. 统一虚拟文件路径约定

**Why now**
- 你已经有项目资产、交付物、知识沉淀、截图、设计稿、测试报告。
- 但当前对“员工把东西写到哪、读自哪”没有统一规范。

**Target outcome**
- 先建立约定，不一定立刻做完整 VFS：
  - `workspace`
  - `artifacts`
  - `uploads`
  - `knowledge`
  - `skills`

**Direct fit**
- 后端研发
- DEMO 测试
- 资产管理

#### 5. 统一 Gateway 控制层视角

**Why now**
- 你已经有系统设置、模型配置、团队能力、项目执行几块控制面，但还较分散。
- 这一步不需要新服务，先做统一配置/状态视图即可。

**Target outcome**
- 明确哪些配置属于模型、技能、资产、执行状态
- 给后续扩更多 provider/runner 留好边界

**Direct fit**
- 系统设置
- 模型供应商配置
- 团队能力管理

---

### B. 2 到 6 周内再做

这些能力有价值，但对当前 demo 和交付主线不是第一优先级，太早做会放大复杂度。

#### 6. Sub-agent 真并发

**Why later**
- 当前系统更适合“节点接棒”而不是“多代理并行”。
- 真并发需要任务编排、回收、冲突控制、异常处理。

**Future value**
- 适合后续做“需求拆解 + 测试证据 + 资产归档”并行跑

#### 7. 阻塞式 task 工具

**Why later**
- 这是对并发子任务的支撑能力。
- 没有子代理并发前，收益有限。

**Future value**
- 可以减少前端轮询和模型反复查状态

#### 8. 并发上限与资源治理

**Why later**
- 只有开始真并发执行后，这件事才值钱。
- 否则容易过早工程化。

**Future value**
- 控制多项目同时跑模型/执行器时的稳定性

#### 9. 真正统一 Sandbox 抽象

**Why later**
- 当前你的“执行真实性”还在工作台和节点链路层，先补上下文和技能更值钱。
- 本地 / Docker / K8s 三模式太重，不适合现在切入。

**Future value**
- 为后端研发、测试、部署员工提供更真实执行环境

---

### C. 当前不建议碰

这些方向不是没价值，而是现在做会直接把项目带偏。

#### 10. LangGraph-first 重构

**Why not now**
- `DeerFlow` 的 Agent runtime 是围绕 LangGraph 组织的。
- 你当前产品的主线是“项目工作台 + AI 员工 + 交付中控”，不是通用 Agent 平台。

**Risk**
- 会让当前系统的核心叙事和工程结构一起失焦

#### 11. 完整 DeerFlow Harness 迁入

**Why not now**
- 太多与当前目标无关的 runtime 复杂度
- 会带来额外模型、渠道、沙箱、编排耦合

**Risk**
- 做成“另一个 DeerFlow”，而不是强化 Forge

#### 12. 通用渠道接入优先

**Why not now**
- Slack / Telegram / 飞书接入并不是你当前产品的关键卖点
- 这些能力不如项目工作台和交付链有直接价值

---

## Recommended 2-Week Execution Order

### Week 1

#### Phase 1: 员工真实性补齐
- 实现 `skill` 按需加载
- 实现上下文预算控制
- 把员工档案真正展开到工作台 prompt

**Expected result**
- 员工不仅名字不同，而且真的“知道自己会什么、该做什么、当前项目做到哪”

#### Phase 2: 统一路径和工件位置
- 给项目资产、交付物、知识沉淀建立统一路径规范
- 让不同节点产物有统一落点

**Expected result**
- 后端研发、测试、资产链更像真实交付流，而不是散落在页面状态里

### Week 2

#### Phase 3: 动态工具集
- 为员工定义最小工具集合
- 先体现在工作台能力差异和执行约束上

**Expected result**
- 研发员工和产品员工在能力边界上真正拉开

#### Phase 4: 控制面收口
- 在系统设置/团队配置中增加“模型、技能、资产、执行”统一视角

**Expected result**
- 当前系统更像一个统一 AI 交付控制面，而不是多个页面拼起来的功能区

---

## Practical Recommendation

如果只允许你现在做 3 件事，我建议就是：

1. `Skills 按需加载`
2. `Memory 注入预算`
3. `统一虚拟文件路径约定`

这 3 件事做完之后：
- 员工会更像真员工
- 工作台回复会更稳定
- 交付物会更像真交付物

而且不会把系统带偏成一个复杂的通用 Agent 平台。

---

## Final Call

**2 周内建议做**
- Skills 按需加载
- Memory 注入预算
- 动态工具组装
- 统一虚拟文件路径约定
- 统一 Gateway 控制层视角

**中期再做**
- Sub-agent 并发
- 阻塞式 task 工具
- 并发上限治理
- 统一 sandbox abstraction

**现在不要做**
- LangGraph-first 重构
- DeerFlow harness 整体迁入
- 通用渠道优先扩展
