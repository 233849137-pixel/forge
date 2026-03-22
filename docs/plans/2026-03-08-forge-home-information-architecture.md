# Forge Home Information Architecture

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 Forge 首页回到“驾驶舱”角色，把节点动作和详细操作拆到独立页面，避免首页继续膨胀。

**Architecture:** 首页只保留全局判断信息：当前项目、节点轨道、当前节点工作台、风险与阻塞、最近执行。项目接入、方案任务包、开发执行、测试验证、交付发布、归档复用分别落到独立节点页，通过统一侧边导航切换。

**Tech Stack:** Next.js App Router、React Server Components、Electron、Vitest

---

## 设计原则

1. 首页不承载录入和配置动作。
2. 一个页面只服务一个节点目标。
3. 左侧导航等于产品主流程，不再只是锚点。
4. 当前项目上下文始终可见，但不把所有明细都堆到一个长屏。

## 页面职责

### 首页 `/`
- 当前项目概览
- 节点轨道
- 当前节点工作台
- 风险与阻塞
- 最近执行

### 项目接入 `/intake`
- 新建项目
- 模板绑定
- 当前项目集切换

### 方案与任务包 `/task-pack`
- Prompt 模板库
- PRD 生成
- 最新 PRD 草案

### 开发执行 `/execution`
- 当前节点工作台
- 最近执行

### 测试验证 `/verification`
- 当前节点工作台
- 风险与阻塞
- 最近执行

### 交付发布 `/delivery`
- 当前节点工作台
- 风险与阻塞
- 当前项目 PRD 草案

### 归档复用 `/archive`
- 推荐复用资产
- 当前项目 PRD 草案

## 当前结论

- 不再把表单、Prompt 库、PRD 区、复用资产全部放首页。
- 首页的成功标准不是“信息全”，而是“用户 10 秒内知道项目卡在哪、下一步做什么”。
