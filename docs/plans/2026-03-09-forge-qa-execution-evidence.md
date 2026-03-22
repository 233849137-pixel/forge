# Forge QA Execution Evidence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 QA Runner 的运行结果补齐到和 Engineer / Reviewer 一致的证据口径，避免门禁阶段重新退回只有 `mode` 字符串的旧模型。

**Architecture:** 继续复用 `runs.outputMode + outputChecks` 作为落库事实源，不新增表。QA Runner 统一输出 `evidenceStatus / evidenceLabel / executedCommand`，Runner bridge 继续使用现有归一化逻辑，AI 与页面只补最小测试以确认 QA 链已接通。

**Tech Stack:** Node runner scripts、Vitest、Forge runner shell bridge、Forge AI core、Next.js execution UI

---

### Task 1: Standardize QA Runner Evidence Output

**Files:**
- Modify: `../../scripts/lib/forge-qa-runner.mjs`
- Test: `../../tests/forge-qa-runner.test.ts`

**Intent**
- 让 QA Runner 与 Engineer / Reviewer 使用同一套证据字段
- 明确区分 `contract / tool-ready / executed`

**Exit Criteria**
- `contract-check` 返回 `evidenceStatus=contract`
- `playwright-ready` 返回 `evidenceStatus=tool-ready`
- `playwright-executed` 返回 `evidenceStatus=executed`
- `checks` 包含标准化 `evidence` 项

**Status**
- 已完成：QA Runner 已统一输出 `evidenceStatus / evidenceLabel / executedCommand`
- 已完成：qa runner tests 已覆盖 `contract / tool-ready / executed`

### Task 2: Verify Bridge And AI Compatibility For QA Evidence

**Files:**
- Modify: `../../tests/forge-runner.test.ts`
- Modify: `../../tests/forge-ai.test.ts`

**Intent**
- 确认现有 bridge / AI 归一化逻辑对 QA runner 新字段保持兼容
- 避免只在 runner 自测里通过，落到控制面后又退化

**Exit Criteria**
- 外部 QA 执行计划能保留 `executed` 状态
- AI 时间线或运行摘要能读到 QA evidence

**Status**
- 已完成：Runner bridge 已覆盖 QA executed evidence 写回
- 已完成：AI 时间线已验证可从 QA `outputChecks.evidence` 读取 `executed` 状态

### Task 3: Sync Docs And Revalidate

**Files:**
- Modify: `../../README.md`
- Modify: `../../docs/plans/2026-03-09-forge-global-program-plan.md`
- Modify: `../../docs/plans/2026-03-09-forge-takeover-next-phase.md`

**Intent**
- 把“外部执行证据”状态更新到 QA 链
- 固定新的接手入口

**Exit Criteria**
- 文档明确写出 QA 也已统一到同一套 evidence 状态
- `npm test`、`npm run build`、`npm run build:electron` 全绿

**Status**
- 已完成：README / global plan / takeover plan 已同步 QA evidence 与执行页 Evidence 展示
- 已完成：`npm test`、`npm run build`、`npm run build:electron`、`node --check scripts/lib/forge-qa-runner.mjs` 全绿
