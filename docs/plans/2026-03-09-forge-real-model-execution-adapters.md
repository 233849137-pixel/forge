# Forge Real Model Execution Adapters

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 Engineer / Reviewer Runner 开始支持受控的真实外部模型执行，而不再只停留在本地探测、`contract` 和 `tool-ready` 两种前置态。

**Why This Next:** 当前四层主线和页面职责已经收口，最大的剩余缺口不再是 UI，而是“运行链已经有证据口径，但真实外部模型还没有稳定接进来”。

**Guardrails:**
- 只做 opt-in 的真实执行适配，不默认打开
- 先从 Engineer / Reviewer 两条链开始，不同时动 QA / Release
- 必须保留现有 contract/ready fallback，不能让本地 demo 链断掉
- 真实执行产物先只要求结构化 evidence，不要求自动产出最终业务文件

---

### Task 1: Define External Execution Capability Contract

**Intent**
- 明确哪些环境变量、命令入口、返回字段可视为“真实模型执行能力”
- 避免把 Runner 脚本写成一堆 provider-specific if/else

**Candidate Files**
- `../../scripts/lib/forge-engineer-runner.mjs`
- `../../scripts/lib/forge-review-runner.mjs`
- `../../scripts/lib/runtime-capability-detect.mjs`

**Status**
- 已完成：新增 `detectExternalExecutionCapability(kind, env, runtime)`，统一读取 `FORGE_ENGINEER_EXEC_COMMAND / FORGE_REVIEW_EXEC_COMMAND` 契约
- 已完成：新增 `tests/runtime-capability-detect.test.ts` 锁定 env 契约与默认空配置行为

### Task 2: Add Opt-In External Execution Path For Engineer

**Intent**
- 在现有 `executeIfReady` 基础上增加真正可调用的外部执行入口
- 让 `executedCommand` 和 `checks` 不再只是本地占位命令

**Status**
- 已完成：Engineer Runner 现在会优先使用外部执行契约
- 已完成：外部命中后会把 provider 证据写入 `model-execution` check，同时保留现有 `codex-ready / codex-executed` 模式兼容

### Task 3: Add Opt-In External Execution Path For Reviewer

**Intent**
- 让规则审查也能基于真实外部模型执行，而不只是本地 `--version` 或空壳 ready

**Status**
- 已完成：Reviewer Runner 现在会优先使用外部执行契约
- 已完成：外部命中后会把 provider 证据写入 `model-execution` check，同时保留现有 `review-ready / review-executed` 模式兼容

### Task 4: Normalize Evidence Persistence And Fallback

**Intent**
- 真实执行成功时写回 provider / command / exit summary
- 真实执行失败时仍保留 fallback 和最小可解释 evidence

**Status**
- 已完成：Runner 结果现在会显式返回 `executionProvider / executionSource / executedCommand`
- 已完成：provider 信息会落入 `checks.model-execution`，可继续被 runner bridge 原样写入 `runs.outputChecks`
- 已完成：AI / control-plane 已把 provider 提升成一等字段，`runtimeSummary / run timeline` 会直接返回 `modelExecutionProviders / modelExecutionDetails`

### Task 5: Verification And Documentation

**Exit Criteria**
- Engineer / Reviewer 至少各有一条真实执行路径可被测试注入
- 失败时不会破坏当前本地 demo 链
- Evidence 仍统一落到 `contract / tool-ready / executed`
- 文档明确写出启用条件、fallback 逻辑、验证方式

**Status**
- 已完成：contract tests、Engineer runner tests、Reviewer runner tests 均已覆盖外部执行契约
- 已完成：README / takeover plan 已同步 env 契约、fallback 和 provider 证据前推状态
- 已完成：`npm test`、`npm run build`、`npm run build:electron`、脚本 `node --check` 全绿
