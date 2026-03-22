# Forge 产品定义 V2（参考 CodePilot 0.28.x，面向 macOS 的本地优先 AI 交付系统）

## Overview

Forge 是一个面向 AI 服务团队的 `macOS 桌面 App`，目标不是做“AI 聊天壳”，而是做一套真正可落地的 `AI 交付操作系统`。

它把需求、模板、Prompt、项目上下文、代码生成、构建测试、交付门禁和经验沉淀放进同一个 App 里完成。  
用户只看到一个产品，但底层分为两部分：

- `本地执行层`：项目代码、资料、构建、测试、AI 执行全部在本机完成
- `联网同步层`：模板、状态、共享资产、协作信息按需同步

这版定义是在既有 Forge PRD 基础上，吸收 CodePilot `v0.28.0` 和 `v0.28.1` 的成熟做法后形成的产品定稿版。

## Why CodePilot Matters

CodePilot 最新 `v0.28.1` 不是一个“点子”，而是已经验证过的桌面 AI 工具产品形态。  
它证明了几件重要的事：

- 桌面 App + 本地 SQLite + 嵌入式本地服务是可行的
- 项目上下文、文件树、权限控制、MCP、skills 可以在一个 App 内自然共存
- 本地 AI 工具不一定要做成终端，也能做成成熟桌面产品
- 桥接外部渠道时，适配层架构比硬编码业务更重要

但 Forge 不应该复制 CodePilot。  
CodePilot 是 `session/chat-first` 的 AI 开发助手；Forge 要做的是 `project/delivery-first` 的 AI 交付系统。

## What Forge Should Borrow

### 1. 单一桌面产品形态

借鉴点：
- 一个桌面 App 承载所有能力
- 不让用户在 Web 控制台、本地脚本、聊天窗口之间来回跳

Forge 落地：
- 继续保持 `单一 macOS App`
- 项目、资产、执行、测试、交付全部在同一个壳里

### 2. 本地持久化与会话恢复

借鉴点：
- CodePilot 使用本地 SQLite 持久化会话，重启后不丢上下文
- 本地 WAL 模式保证读写性能

Forge 落地：
- 本地数据库不只存聊天，而是存：
  - 项目元信息
  - 项目 DNA
  - Prompt/Skill 引用
  - 构建记录
  - 测试记录
  - 审批与门禁结果

### 3. 项目感知上下文

借鉴点：
- CodePilot 每个 session 可以绑定工作目录，并展示文件树和文件预览

Forge 落地：
- 每个项目有自己的 `Workspace`
- Workspace 右侧固定显示：
  - 文件树
  - 关键资料
  - 当前模板
  - 当前 Prompt
  - 当前任务包
  - 最近构建/测试结果

### 4. 权限模式可视化

借鉴点：
- Approve / Deny / Auto-Allow
- 会话级权限模式切换

Forge 落地：
- 所有高风险动作必须可见可控：
  - 读取项目外目录
  - 写入关键文件
  - 执行 shell 命令
  - 启动构建
  - 运行浏览器自动化
  - 上传共享资料到云端

### 5. MCP / Skills / Extensions 管理

借鉴点：
- CodePilot 把 MCP server 和自定义 skills 做成独立扩展页

Forge 落地：
- Forge 也要有 `Extensions` 模块
- 但重点不是聊天增强，而是交付能力扩展：
  - 模板包
  - Prompt 包
  - Skill 包
  - Bridge 适配器
  - 模型接入器

### 6. Token / Cost Tracking

借鉴点：
- 每次 AI 响应显示 token 与估算成本

Forge 落地：
- Forge 要在项目级、功能级统计成本：
  - 某次任务包消耗多少
  - 某项目累计花了多少
  - 哪类模板最费钱
  - 哪个模型性价比最高

### 7. 桥接适配层

借鉴点：
- CodePilot `v0.28.1` 的 QQ bridge 说明其外部通道是通过 adapter 扩展，而不是写死在核心里

Forge 落地：
- 外部协作通道统一走 `Bridge Adapter`
- 首版即便不做，也要先定义接口：
  - 飞书
  - 企业微信
  - 邮件
  - 内部 webhook

## What Forge Should Not Copy

### 1. 不做 chat-first

CodePilot 的首页更偏聊天和 session。  
Forge 不能把聊天当主入口。Forge 的主入口必须是 `项目`。

### 2. 不绑定单模型或单 CLI

CodePilot 强绑定 Claude/Claude Code 是成立的。  
Forge 不行。Forge 必须预留多执行后端：

- Codex
- Claude Code
- Opus / Claude
- 未来的自定义 Agent

### 3. 不把“会话管理”当核心价值

Forge 的核心价值是：
- 缩短交付时间
- 提高复用率
- 提高交付质量

会话只是过程，不是产品核心。

### 4. 不把竞品的跨平台目标当首版目标

CodePilot 同时支持 Windows、macOS、Linux。  
Forge 首版只做 `macOS`，这是正确决策。速度比平台覆盖更重要。

## Final Product Thesis

Forge 的一句话定义：

`一个面向 AI 项目交付的 macOS 本地优先桌面系统，把项目上下文、资产复用、AI 执行、质量门禁和交付沉淀收敛到一个 App 中。`

## Product Positioning

- 不是 AI 聊天工具
- 不是 通用 IDE
- 不是 单纯项目管理工具
- 不是 纯云端协作后台

Forge 是：

- `项目驱动` 的 AI 交付系统
- `本地优先` 的研发工作台
- `带质量门禁` 的 AI 生产线
- `可沉淀资产` 的交付中台

## Information Architecture

Forge 首版建议采用以下一级结构：

1. `Projects`
   - 项目列表
   - 项目状态
   - 风险和成本

2. `Workspace`
   - 当前项目工作区
   - 任务包生成
   - AI 执行
   - 文件树 / 资料 / Prompt / 运行记录

3. `Assets`
   - 模板库
   - Prompt 库
   - Skill 库
   - 经验沉淀

4. `Delivery`
   - 构建
   - 预览
   - 测试
   - 门禁
   - 交付归档

5. `Extensions`
   - MCP
   - Bridge Adapter
   - 模型接入器

6. `Settings`
   - API Key
   - 权限模式
   - 同步设置
   - 本地路径

## Core Product Objects

### Project DNA

描述一个项目默认携带的基因：
- 行业模板
- 技术模板
- UI 风格
- Prompt 包
- 测试清单
- 禁忌项
- 客户偏好

### Asset Pack

可复用资产的统一封装：
- 模板
- Prompt
- Skill
- 测试包
- 部署配置

### Task Pack

发给 AI 执行引擎的最小任务单元：
- 需求摘要
- 约束
- 资产引用
- 目标文件
- 验收标准

### Run Record

一次执行记录：
- 执行器
- 输入
- 输出
- token / cost
- 结果
- 日志

### Delivery Gate

一次交付门禁结果：
- build
- lint
- typecheck
- e2e
- manual review

## P0 Feature Set

### P0-1 项目驱动首页

首页默认展示项目，不展示聊天历史。

### P0-2 项目工作区

每个项目有独立工作区，包含文件树、资料、Prompt、任务记录和构建结果。

### P0-3 资产中心

支持模板、Prompt、Skill、经验沉淀的检索与复用。

### P0-4 任务包生成

将项目 DNA + 需求 + 资产引用组合成标准任务包，供 AI 执行。

### P0-5 本地执行

支持本地执行 AI 任务、本地读写仓库、本地构建和本地预览。

### P0-6 质量门禁

必须支持基础构建检查、测试和交付阻断。

### P0-7 项目成本与风险看板

每个项目可查看成本、状态、失败记录和风险提示。

### P0-8 本地优先 + 联网同步

本地可离线工作；联网后同步项目状态和共享资产。

## P1 Feature Set

- Bridge Adapter 接入飞书/企微
- 多执行器智能路由
- 更细粒度的权限策略
- 更丰富的门禁规则
- 自动周报 / 自动复盘
- 团队级资产推荐

## Functional Requirements

### FR-001: 项目优先入口
当用户打开 Forge 时，系统应默认进入项目首页，并展示项目状态而不是聊天列表。

### FR-002: 工作区绑定
当用户进入某个项目时，系统应自动绑定该项目的本地目录、项目 DNA 和资产引用。

### FR-003: 任务包执行
当用户在工作区发起任务时，系统应基于当前项目上下文生成任务包，并调用配置好的执行器。

### FR-004: 执行记录沉淀
当一次 AI 执行完成时，系统应记录输入、输出、成本、日志和关联文件。

### FR-005: 交付门禁
当用户申请交付时，系统应执行预定义门禁；若存在失败项，必须阻止交付。

### FR-006: 本地优先
当网络不可用时，系统应继续支持项目浏览、任务生成、本地构建和本地测试。

### FR-007: 联网同步
当网络恢复时，系统应同步项目状态、共享资产和必要审计信息。

### FR-008: 扩展接入
当用户安装 Extension 时，系统应将其注册到统一扩展中心，并控制其权限范围。

## Technical Direction

如果目标是 `尽快做出来并吸收 CodePilot 的成熟模式`，Forge 首版建议采用：

- 桌面壳：`Electron`
- 前端：`Next.js / React`
- 本地数据库：`SQLite`
- 本地执行：`Node.js worker + CLI bridge`
- 自动测试：`Playwright`
- 云端同步：`轻量 API + PostgreSQL`

这里我建议从之前的 `Tauri` 调整为 `Electron`，原因不是 Electron 更先进，而是：

- CodePilot 已证明这条路可行
- 本地进程、Node 生态、CLI 调用、Playwright 集成更直接
- 你的目标是尽快做出 `macOS 单 App MVP`
- 首版速度比安装包体积更重要

## Product Delta vs Previous Forge PRD

相较上一版 Forge PRD，这次定稿有四个关键升级：

1. `项目优先` 替代 `聊天优先`
2. `本地持久化 + 项目数据库` 明确化
3. `Extensions / Bridge Adapter` 作为正式模块写入产品
4. `Electron + Next + SQLite` 成为更现实的首版实现路径

## Final Decision

Forge 不是 CodePilot 的中文版，也不是换皮版。  
Forge 是站在 CodePilot 这类桌面 AI 工具已经验证过的产品壳之上，往前走一步，做成一套真正面向 AI 项目交付的 `Project-First / Delivery-First / Local-First` 产品。
