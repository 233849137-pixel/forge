# Forge Project Page Backend Readiness

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把结构化执行后端信息前推到项目页的 `交付就绪度`，让负责人视角不再只看到外部模型执行契约，也能直接判断当前由哪条外部编排后端承载执行链。

**Architecture:** 复用已经打通的 `runtimeSummary.executionBackendSummary / executionBackendDetails`，不新增持久化状态，不新增推导逻辑。项目页只做最小接线：路由把控制面已有字段透传给 `ForgeProjectsPage`，页面在交付就绪度卡片中增加 `执行后端 / 后端契约` 两行。

**Tech Stack:** TypeScript, React, Next.js App Router, Vitest

---

## Implemented

1. `ForgeProjectsPage` 新增：
   - `executionBackendSummary`
   - `executionBackendDetails`
2. 项目页 `交付就绪度` 现在显式显示：
   - `执行后端`
   - `后端契约`
3. `[view]/page.tsx` 已把 `controlPlane.runtimeSummary.executionBackendSummary / executionBackendDetails` 传给项目页
4. 项目页测试已补齐对应断言，确保负责人的项目视角不会再落后于首页、执行页和治理页

## Verified

- `npm test -- tests/forge-projects-page.test.tsx`
- `npm test`
- `npm run build`
- `npm run build:electron`

## Result

这批之后，负责人在项目页就能直接回答两个问题：

- 当前项目是否已经接通真实外部模型执行契约
- 当前整改与回放默认落在哪条外部执行后端上

这样项目页的交付判断口径就和首页、执行页、治理页统一了。
