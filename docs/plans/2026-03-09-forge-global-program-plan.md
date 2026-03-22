# Forge Global Program Plan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 从全盘视角推进 Forge，避免继续在局部功能上过度打磨，优先补齐决定产品成败的主链能力。

**Architecture:** 继续坚持 `Control Plane -> Runtime Plane -> Evidence Plane -> Asset Assembly` 四层结构，但后续开发必须按纵向闭环推进，每一批只完成一条从数据模型到页面与验证的主线。短期不再扩页面数量，也不再新增与主链无关的概念对象。

**Tech Stack:** Next.js App Router、Electron、SQLite、Vitest、MCP、Runner CLI、Runtime Adapter

---

## Current Snapshot

- 已有 3 个核心包：`packages/core`、`packages/ai`、`packages/db`
- 已有 8 条标准命令契约：`prd.generate`、`taskpack.generate`、`component.assemble`、`execution.start`、`review.run`、`gate.run`、`release.prepare`、`archive.capture`
- 已有 7 个 Runner Profile：`pm-orchestrator`、`architect-runner`、`engineer-runner`、`reviewer-runner`、`qa-runner`、`release-runner`、`knowledge-runner`
- 已有 25 个 Forge API 路由，覆盖项目、控制面、运行、整改、组件装配
- 当前验证基线：`npm test`、`npm run build`、`npm run build:electron` 全绿

## Overall Progress Judgment

### 已经比较成熟的层

- 产品信息架构：`85%`
- Control Plane：`85%`
- 命令契约与整改链：`80%`
- 组件注册表与基础装配：`75%`

### 仍然是关键缺口的层

- 外部资源搜索与真实装配：`35%`
- 外部模型真实执行证据：`35%`
- 资产反馈回写与评分：`20%`
- 对外可售卖产品完成度：`45%`

### 结论

Forge 当前不是“还在想法期”，也不是“只剩 UI 抛光”。它已经进入：

`可持续内测前夜，但主价值闭环仍缺 3 个系统级能力。`

这 3 个能力是：

1. 外部资源接入
2. 执行结果证据化
3. 资产效果回写

## Planning Principles

### 必须坚持

1. 每次只推进一条纵向闭环：`core -> db -> ai -> api -> page -> tests -> docs`
2. 每个批次都要有清晰退出条件，未达成前不切下一题
3. 每个批次结束都回写 `README.md` 和对应 `docs/plans/...`
4. 每个批次结束都必须跑：
   - `npm test`
   - `npm run build`
   - `npm run build:electron`

### 明确禁止

1. 不再先做新页面，再补数据链
2. 不再因为某个局部 API 或单页细节连续打磨超过一个批次
3. 不再引入新的一级概念对象
4. 不把“主题、视觉抛光、动画”当主线任务

## Task 1: Freeze The Current Baseline

**Files:**
- Modify: `../../README.md`
- Modify: `../../docs/plans/2026-03-09-forge-phase-next-implementation.md`
- Modify: `../../docs/plans/2026-03-09-forge-takeover-next-phase.md`

**Intent**
- 把当前真实能力边界写清楚，避免后续每次重做状态判断
- 形成稳定接手入口，防止会话崩溃后再次丢上下文

**Exit Criteria**
- 文档能明确回答：当前有什么、没什么、下一批做什么
- 任何新窗口只读 3 个文件就能接手继续开发

## Task 2: External Resource Search Adapter

**Files:**
- Modify: `../../packages/core/src/types.ts`
- Modify: `../../packages/ai/src/forge-ai.ts`
- Modify: `../../scripts/forge-mcp.mjs`
- Modify: `../../src/components/forge-assets-page.tsx`
- Add: `../../app/api/forge/components/search/route.ts`
- Test: `../../tests/forge-ai.test.ts`
- Test: `../../tests/forge-api-routes.test.ts`

**Intent**
- 让组件装配开始接触真实外部资源，而不是永远只在 seed 数据里循环
- 先做“候选资源搜索与解释”，不做自动拉取和自动装配

**Scope**
- 输入：标签、语言、场景、成熟度
- 输出：仓库链接、来源说明、建议理由、安全等级占位字段
- 不做：克隆仓库、不做代码拼装、不做自动依赖安装

**Exit Criteria**
- 资产页能显示“本地组件 + 外部候选资源”
- AI / API / MCP 都能按统一参数读取外部候选
- 搜索结果会明确区分 `internal`、`github-candidate`

**Status**
- 已完成：新增 `GET /api/forge/components/search`
- 已完成：新增 MCP 工具 `forge_component_resource_search`
- 已完成：资产页已挂接轻量桥接组件，显示 GitHub 外部候选资源
- 已完成：AI / API / Page 测试已覆盖外部搜索链路

## Task 3: Asset Feedback Writeback

**Files:**
- Modify: `../../packages/core/src/types.ts`
- Modify: `../../packages/db/src/forge-db.ts`
- Modify: `../../packages/core/src/selectors.ts`
- Modify: `../../packages/ai/src/forge-ai.ts`
- Modify: `../../src/components/forge-assets-page.tsx`
- Test: `../../tests/forge-db.test.ts`
- Test: `../../tests/forge-selectors.test.ts`
- Test: `../../tests/forge-ai.test.ts`

**Intent**
- 让系统知道哪些组件真实参与了运行，结果是成功还是失败
- 把“装配建议”从静态推荐推进到带反馈的推荐

**Scope**
- 回写字段：使用次数、成功次数、失败次数、最近关联运行、最近关联门禁
- 先按组件维度统计，不做复杂排序模型

**Exit Criteria**
- 资产页能看到基础评分或使用信号
- 控制面能回答“这个组件最近是否导致阻塞”
- 后续推荐至少能根据使用反馈做简单排序

**Status**
- 已完成：新增 `getComponentUsageSignals(...)`，基于 `runs.linkedComponentIds + runEvents` 派生组件使用反馈
- 已完成：`getComponentRegistryForAI / /api/forge/components / control-plane.componentRegistry` 统一返回 `usageSignals`
- 已完成：资产页已新增 `组件使用信号`，直接显示最近阻塞、执行中、已验证等最小反馈
- 已完成：selector / ai / api / page 测试已覆盖这一批反馈链路

## Task 4: Real External Execution Evidence

**Files:**
- Modify: `../../scripts/lib/forge-engineer-runner.mjs`
- Modify: `../../scripts/lib/forge-review-runner.mjs`
- Modify: `../../packages/ai/src/runtime-adapters.ts`
- Modify: `../../packages/ai/src/forge-ai.ts`
- Modify: `../../packages/db/src/forge-db.ts`
- Test: `../../tests/forge-engineer-runner.test.ts`
- Test: `../../tests/forge-review-runner.test.ts`
- Test: `../../tests/forge-runtime-adapters.test.ts`

**Intent**
- 把 Runtime Plane 从“已能编排”继续推进到“已能证明真执行了什么”
- 统一沉淀 `contract-* / tool-ready / executed` 三种状态

**Scope**
- 重点不是让模型更聪明，而是让执行证据更可靠
- 必须把外部执行结果转成结构化 evidence，再进入控制面

**Exit Criteria**
- 控制面能明确显示哪些运行是真执行、哪些只是合同模式
- 最近执行、运行时间线、整改链使用同一份 evidence 口径
- Engineer / Reviewer 不再只输出摘要字符串

**Status**
- 已完成：Engineer / Reviewer Runner 统一输出 `evidenceStatus / evidenceLabel / executedCommand`
- 已完成：Runner CLI 会在外部执行成功或失败时把统一证据状态保留到 `runs.outputChecks`
- 已完成：`runtimeSummary / run timeline` 已开始返回归一化证据状态，控制面可直接区分 `contract / tool-ready / executed`
- 已完成：`runtimeSummary / run timeline / control-plane` 已开始返回 `modelExecutionProviders / modelExecutionDetails`，外部模型 provider 不再只藏在 `outputChecks`
- 已完成：QA Runner 也已统一输出同一套 evidence 字段，门禁阶段不再退回旧 `mode` 口径
- 已完成：执行页运行卡片已显式展示 `Evidence`，页面级运行视图与控制面证据口径一致
- 已完成：任务队列、整改队列、最近命令执行、统一回放结果现在都显式返回 `runtimeModelProviderLabel / runtimeModelExecutionDetail`
- 已完成：治理页的 `最近命令执行 / 自动升级动作 / 风险与阻塞` 已显式显示 `模型执行器`，整改入口开始具备 provider 可解释性
- 已完成：`commands.followUpTasks.remediationAction` 与 `remediations.items.nextAction` 现在会自动带上 provider 感知文案，外部调用方可以直接展示整改接管说明
- 已完成：`runtimeSummary` 现在也会返回 `externalExecutionSummary / externalExecutionDetails`，readiness / control-plane / commands / remediations 四个入口可以直接解释外部执行契约准备度
- 已完成：首页 `推进判断` 与执行页 `本地运行上下文` 已开始显式显示 `外部执行准备度 / Provider 契约`，负责人不再需要翻环境变量确认外部执行配置
- 已完成：项目页 `交付就绪度` 与治理页 `放行闸口汇总` 也已接入同一份 `外部执行准备度 / Provider 契约`，交付判断和命令治理开始共享统一外部执行配置口径
- 已完成：`runtimeSummary` 现在会返回结构化的 `externalExecutionStatus / externalExecutionContractCount / externalExecutionActiveProviderCount / externalExecutionRecommendation`
- 已完成：首页 `推进判断 / 下一步动作` 与治理页 `放行闸口汇总 / 风险与阻塞` 已开始显式显示 `外部执行建议 / 接管建议`，调用方不再依赖字符串摘要猜下一步
- 已完成：项目页 `交付就绪度` 与执行页 `本地运行上下文` 也已开始显式显示 `外部执行建议`，交付判断、执行判断和整改判断开始共享同一份结构化接管建议
- 已完成：新增 `FORGE_ENGINEER_EXEC_BACKEND / FORGE_REVIEW_EXEC_BACKEND`，控制面现在能正式区分“模型执行器”与“执行后端”
- 已完成：`runtimeSummary` 现在也会返回 `executionBackendSummary / executionBackendDetails`，首页与治理页已开始显式显示 `执行后端 / 后端契约`
- 已完成：`capabilities` 能力注册表现在也会返回 `executionBackends / executionBackendCount / activeExecutionBackendCount`，OpenClaw 这类外部后端开始有独立入口，不再只存在于运行摘要里
- 已完成：新增 `FORGE_ENGINEER_EXEC_BACKEND_COMMAND / FORGE_REVIEW_EXEC_BACKEND_COMMAND`，Engineer / Reviewer Runner 在命中后端命令模板时会优先通过编排后端发起执行
- 已完成：新增共享注册表 `config/forge-execution-backend-contracts.json`，脚本层与 AI 层开始共用同一套 execution backend contract 元数据

## Task 5: Narrow Productization Pass

**Files:**
- Modify: `../../README.md`
- Modify: `../../src/components/forge-home-page.tsx`
- Modify: `../../src/components/forge-assets-page.tsx`
- Modify: `../../src/components/forge-execution-page.tsx`
- Test: `../../tests/forge-home-page.test.tsx`
- Test: `../../tests/forge-os-pages.test.tsx`

**Intent**
- 在不新增一级导航的前提下，把首页、资产页、执行页收紧到真正的主价值
- 避免页面继续“功能很多，但主线模糊”

**Scope**
- 首页只讲交付主链、风险、当前阻塞、下一步动作
- 资产页只讲可复用资产、装配建议、评分信号
- 执行页只讲运行、证据、Runner、整改回放

**Exit Criteria**
- 任何页面都能明确回答“它只负责什么”
- 不再出现同一类状态在多个页面重复解释三遍

**Status**
- 已完成：首页已收紧为 `推进判断 / 下一步动作 / 执行快照 / 后台入口 / 推进队列`
- 已完成：资产页已收紧为“装配优先级 + 组件反馈 + 外部候选 + 复用基线”
- 已完成：执行页已收紧为“证据状态 + 整改回放 + Runner / 时间线 / 本地上下文”
- 已完成：页面测试已更新，`npm test / npm run build / npm run build:electron` 全绿

## Recommended Sequence

按下面顺序推进，不跳步：

1. `Task 1` 文档和接手入口固定
2. `Task 2` 外部资源搜索
3. `Task 3` 反馈回写
4. `Task 4` 真实执行证据
5. `Task 5` 产品化收口

## Success Definition For The Next 2 Weeks

如果未来两周只完成下面 4 件事，就算方向正确：

1. Forge 能搜索外部候选组件，而不只看本地 seed
2. Forge 能记录组件使用成败，而不只看“是否推荐”
3. Forge 能明确区分真执行和合同模式
4. Forge 首页、资产页、执行页的职责边界进一步收紧

## What We Explicitly Do Not Do Now

- 不做多人实时协作
- 不做云同步
- 不做 DMG 签名、公证、自动更新
- 不做自动从 GitHub 拉代码并拼进工作区
- 不做大规模 UI 改版
