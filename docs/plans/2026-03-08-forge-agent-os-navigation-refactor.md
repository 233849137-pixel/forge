# Forge Agent OS Navigation Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 Forge 从“节点页导航”重构为“Agent Team Operating System”一级信息架构，让首页、项目、团队、工件、执行、资产、治理各自承担清晰职责。

**Architecture:** 保留现有本地数据模型与 SQLite，不先改底层能力；先在产品层完成导航和页面职责切换。旧的节点视图从一级导航降级为“项目页内部推进轨道”，团队页改用统一外壳，新增工件、资产、治理三个主视图。

**Tech Stack:** Next.js App Router、React Server Components、Electron、Vitest、现有 SQLite 数据层

---

### Task 1: 固化新的一级导航定义

**Files:**
- Modify: `../../src/lib/forge-views.ts`
- Test: `../../tests/forge-navigation.test.ts`

**Step 1: Write the failing test**

验证新导航只包含：
- 首页
- 项目
- 团队
- 工件
- 执行
- 资产
- 治理

并验证旧节点页路由不再出现在导航中。

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-navigation.test.ts`

**Step 3: Write minimal implementation**

把 `AppShellView` 和 `forgeNavigationItems` 改成 Agent OS 结构。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-navigation.test.ts`

### Task 2: 建立统一桌面外壳

**Files:**
- Create: `../../src/components/forge-chrome.tsx`
- Modify: `../../app/globals.css`
- Test: `../../tests/forge-chrome.test.tsx`

**Step 1: Write the failing test**

验证统一外壳会显示：
- 应用标题
- 新一级导航
- 当前页面标题
- 页面描述

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-chrome.test.tsx`

**Step 3: Write minimal implementation**

抽出公共框架，供首页、项目、团队、工件、执行、资产、治理页复用。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-chrome.test.tsx`

### Task 3: 重构首页为真正的首页驾驶舱

**Files:**
- Create: `../../src/components/forge-home-page.tsx`
- Test: `../../tests/forge-home-page.test.tsx`

**Step 1: Write the failing test**

验证首页只显示：
- 项目态势
- 当前焦点
- 阻塞与下一动作
- 活跃执行

并明确不显示：
- 新建项目表单
- Prompt 模板库
- PRD 生成

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-home-page.test.tsx`

**Step 3: Write minimal implementation**

使用统一外壳实现首页驾驶舱，移除节点型导航负担。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-home-page.test.tsx`

### Task 4: 重构项目页并吸收旧节点轨道

**Files:**
- Create: `../../src/components/forge-projects-page.tsx`
- Test: `../../tests/forge-projects-page.test.tsx`

**Step 1: Write the failing test**

验证项目页承载：
- 当前项目总览
- 项目推进轨道
- 项目接入动作
- 项目 DNA / 模板 / 工作区信息

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-projects-page.test.tsx`

**Step 3: Write minimal implementation**

把旧的节点推进逻辑降级成项目页内部内容，不再独立成一级页。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-projects-page.test.tsx`

### Task 5: 拆出工件、执行、资产、治理专页

**Files:**
- Create: `../../src/components/forge-artifacts-page.tsx`
- Create: `../../src/components/forge-execution-page.tsx`
- Create: `../../src/components/forge-assets-page.tsx`
- Create: `../../src/components/forge-governance-page.tsx`
- Test: `../../tests/forge-os-pages.test.tsx`

**Step 1: Write the failing test**

验证：
- 工件页只看 PRD / Artifact / 交接结果
- 执行页只看执行队列和运行上下文
- 资产页只看 Prompt / 模板 / 可复用资产
- 治理页只看门禁 / 风险 / 协作规则

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-os-pages.test.tsx`

**Step 3: Write minimal implementation**

基于现有 snapshot 数据生成 4 个清晰页面。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-os-pages.test.tsx`

### Task 6: 接线路由并迁移团队页

**Files:**
- Modify: `../../app/page.tsx`
- Modify: `../../app/[view]/page.tsx`
- Modify: `../../src/components/agent-team-page.tsx`

**Step 1: Write the failing test**

验证：
- `/` 使用新首页
- `/projects` `/team` `/artifacts` `/execution` `/assets` `/governance` 都能返回对应页面

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/forge-os-pages.test.tsx tests/agent-team-page.test.tsx`

**Step 3: Write minimal implementation**

完成路由切换，并让团队页复用统一桌面外壳。

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/forge-os-pages.test.tsx tests/agent-team-page.test.tsx`

### Task 7: 全量验证

**Files:**
- Verify only

**Step 1: Run targeted tests**

Run: `npm test -- tests/forge-navigation.test.ts tests/forge-home-page.test.tsx tests/forge-projects-page.test.tsx tests/forge-os-pages.test.tsx tests/agent-team-page.test.tsx`

**Step 2: Run full suite**

Run: `npm test`

**Step 3: Run production build**

Run: `npm run build`

**Step 4: Restart desktop dev instance**

Run: `npm run electron:dev`
