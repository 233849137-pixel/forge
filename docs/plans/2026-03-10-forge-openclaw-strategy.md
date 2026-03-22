# Forge OpenClaw Strategy Note

**Date:** 2026-03-10

## Context

围绕 OpenClaw 的讨论，核心不是“Forge 要不要也变成一个更强的 Agent 编排器”，而是：

- OpenClaw 拥有更大的社区、更快的玩法迭代和更强的执行生态
- Forge 是个人研发产品，不适合把胜负手压在“谁更会编排 Agent Team”上

这不是短期资源问题，而是长期产品边界问题。

## Final Judgment

Forge 继续坚持做：

`AI 研发交付系统`

而不是：

- 通用 Agent 编排器
- 另一个聊天壳
- 另一个技能市场
- 另一个 workflow graph 编辑器

## Product Boundary

### OpenClaw 负责什么

- Agent Team 编排
- 角色、工具、知识库挂载
- 长流程运行时
- 新玩法和实验性能力

### Forge 负责什么

- 项目
- TaskPack
- 工件
- 门禁
- 证据
- 整改回放
- 资产沉淀
- 多项目控制面

一句话：

`OpenClaw 负责把团队跑起来，Forge 负责让交付可控。`

## Why This Matters

如果 Forge 把自己的价值建立在“AI 能力更强”或“编排玩法更多”上，它一定会被更大生态压制。

如果 Forge 把自己的价值建立在下面这些稳定对象上，它反而会随着外部生态增强而变强：

- `TaskPack -> Patch -> Review -> Gate -> Remediation -> Release`
- 当前卡在哪
- 下一步谁接棒
- 证据够不够放行
- 失败后怎么重跑
- 哪些资产真的复用过

## Product Moat

Forge 的护城河不应该是“最强 AI”，而应该是：

1. 项目级交付状态判断
2. 工件与证据链
3. 整改与回放机制
4. 资产沉淀与复用飞轮

## Engineering Principle

后续研发统一遵守这条原则：

`不要重写 OpenClaw，要把 OpenClaw 接成 Forge 的 execution backend。`

对应的工程约束：

- 不在 Forge 内重做 workflow graph
- 不把 OpenClaw 私有字段灌入 core/db 正式模型
- 所有第三方编排器统一通过正式契约接入
- Forge 内部永远优先围绕 `TaskPack / Artifact / Evidence / Remediation` 工作

## Current Implementation Consequence

本轮已经先做了第一层准备：

- `provider` 与 `execution backend` 开始分离
- Runtime Plane 可以正式表达“谁在执行”和“谁在承载执行链”
- OpenClaw 后续将作为 `execution backend` 接入，而不是成为 Forge 产品结构的一部分
- `execution backend` 已经开始有标准命令入口，后续接 OpenClaw 时不需要把调用逻辑硬编码进页面或任务流

## Next Step

下一批优先做：

`execution backend registry`

让控制面和能力注册表能正式返回：

- 当前声明了哪些后端
- 每个后端承载哪条 provider 契约
- 后端当前是否已被实际运行证据命中

这样以后无论接的是 OpenClaw、Claude Code 团队模式，还是其他编排器，Forge 都保持同一套交付控制面。 
