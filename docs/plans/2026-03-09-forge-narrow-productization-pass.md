# Forge Narrow Productization Pass

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不增加一级导航、不引入新数据模型的前提下，把首页、资产页、执行页各自的职责边界再收紧一轮，让页面本身就能回答“这里只负责什么”。

**Recommended Approach:** 采用轻量重排而不是大改信息架构。保留现有 selectors 和数据链，只替换最容易越界的页面面板与标题，让首页更像驾驶舱、资产页更像装配台、执行页更像运行中枢。

**Non-Goals:**
- 不做新页面
- 不做视觉主题大改
- 不改控制面数据模型
- 不引入新的一级对象

---

### Task 1: Tighten Home Page To A Delivery Cockpit

**Files:**
- Modify: `../../src/components/forge-home-page.tsx`
- Test: `../../tests/forge-home-page.test.tsx`

**Intent**
- 首页只回答当前项目在哪个阶段、下一步该做什么、为什么被卡住
- 后台入口保留，但不能抢前台叙事

**Planned Changes**
- 把工作台摘要改成更明确的“推进判断”
- 把执行按钮区改成“下一步动作”
- 把活跃运行区改成“执行快照”
- 把后台链接区改成明显的“后台入口”

**Status**
- 已完成：首页已改成 `推进判断 / 下一步动作 / 执行快照 / 后台入口 / 推进队列`
- 已完成：首页测试已更新并通过

### Task 2: Tighten Assets Page To An Assembly Desk

**Files:**
- Modify: `../../src/components/forge-assets-page.tsx`
- Test: `../../tests/forge-os-pages.test.tsx`

**Intent**
- 资产页优先讲装配优先级、待装配、已装配、外部候选、组件反馈
- Prompt / Skill / SOP 保留为底座信息，不再和装配主链抢叙事

**Planned Changes**
- 用更明确的标题标记“装配优先级”和“复用基线”
- 保留现有信息，但把主链相关面板放在更前面

**Status**
- 已完成：资产页已改成 `装配优先级 / Prompt 基线 / Skill 基线 / 资产底座`
- 已完成：资产页测试已更新并通过

### Task 3: Tighten Execution Page To A Runtime Console

**Files:**
- Modify: `../../src/components/forge-execution-page.tsx`
- Test: `../../tests/forge-os-pages.test.tsx`

**Intent**
- 执行页不再承担项目负载和团队负载摘要
- 用“证据状态 + 整改回放”替换最容易越界的负载面板

**Planned Changes**
- 新增 `证据状态` 面板，汇总 `contract / tool-ready / executed`
- 新增 `整改回放` 面板，直接显示 remediation owner、summary、runner 回放入口
- 保留 Runner 注册表、探测、失败归因、事件流、执行队列、本地上下文

**Status**
- 已完成：执行页已用 `证据状态 + 整改回放` 替换 `项目负载 + Agent 负载`
- 已完成：执行页测试已更新并通过

### Task 4: Sync Docs And Revalidate

**Files:**
- Modify: `../../README.md`
- Modify: `../../docs/plans/2026-03-09-forge-global-program-plan.md`
- Modify: `../../docs/plans/2026-03-09-forge-takeover-next-phase.md`

**Exit Criteria**
- 首页、资产页、执行页的标题和面板顺序能明显体现职责边界
- 页面测试更新并通过
- `npm test`、`npm run build`、`npm run build:electron` 全绿

**Status**
- 已完成：`npm test` 22 个测试文件、182 个测试全部通过
- 已完成：`npm run build`、`npm run build:electron` 全绿
