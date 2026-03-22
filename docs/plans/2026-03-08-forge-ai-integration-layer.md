# Forge AI 调用层设计

日期：2026-03-08  
阶段：MVP  
目标：让 Forge 不只是人用的桌面工作台，还能被外部 AI 作为本地工具调用。

## 1. 定位

Forge 的 AI 调用层不是聊天接口，也不是让 AI 去操作 UI。

它的职责是把 Forge 内部已有的项目、资产、门禁、执行状态，统一暴露成稳定的工具协议，让不同 AI 都能调用同一套能力。

首版采用两层结构：

1. `Forge Core`
- 负责项目、资产、门禁的真实读写能力。
- 不关心调用方是桌面 UI、HTTP 还是 MCP。

2. `AI Adapter`
- `本地 HTTP API`
- `MCP Server`

## 2. 首批开放能力

### 2.1 项目

- `project.list`
  - 返回全部项目和当前激活项目
- `project.snapshot`
  - 返回当前工作区快照
- `project.create`
  - 创建项目并自动激活
- `project.activate`
  - 切换当前项目

### 2.2 资产

- `asset.search`
  - 支持按 `query` 和 `type` 搜索模板、提示词、技能、门禁资产

### 2.3 门禁

- `gate.status`
  - 返回当前门禁列表和整体状态

## 3. HTTP API 设计

本地 HTTP API 仅监听 `localhost`，不暴露公网。

### 路由

- `GET /api/forge/health`
- `GET /api/forge/projects`
- `POST /api/forge/projects`
- `POST /api/forge/projects/active`
- `GET /api/forge/snapshot`
- `GET /api/forge/assets`
- `GET /api/forge/gates`

### 响应约束

- 成功统一返回：

```json
{
  "ok": true,
  "data": {}
}
```

- 失败统一返回：

```json
{
  "ok": false,
  "error": {
    "code": "FORGE_NOT_FOUND",
    "message": "项目不存在"
  }
}
```

## 4. MCP 设计

MCP 首版作为本地 `stdio` 工具服务运行，不直接操作数据库，而是调用 Forge 的本地 HTTP API。

### 工具列表

- `forge_project_list`
- `forge_project_snapshot`
- `forge_project_create`
- `forge_project_activate`
- `forge_asset_search`
- `forge_gate_status`

### 设计原则

- MCP 不重复实现业务逻辑
- MCP 只做参数校验、请求转发、结果格式化
- Forge 桌面端运行时，AI 即可通过 MCP 获取本地项目状态

## 5. 安全边界

- 首版默认只允许本机调用
- 不开放任意文件系统读写
- 不开放任意 shell 执行
- 项目切换、项目创建、门禁读取全部进入审计日志扩展位
- 缺少必填参数时直接拒绝，不做猜测式执行

## 6. 非功能要求

- 所有接口响应为 JSON
- API 超时时间默认 10 秒
- 所有接口在本地 SQLite 上运行，不依赖云端
- MCP 工具必须兼容 Codex / Claude Desktop 这类通用 MCP 客户端

## 7. MVP 验收

1. 本地 `GET /api/forge/projects` 能拿到项目列表
2. 本地 `POST /api/forge/projects` 能创建并激活项目
3. 本地 `GET /api/forge/assets?query=客服` 能返回相关资产
4. 本地 `GET /api/forge/gates` 能返回门禁状态
5. MCP `tools/list` 能列出 Forge 工具
6. MCP `tools/call` 能成功调用至少一个项目类工具

## 8. 后续扩展

- `taskpack.generate`
- `run.list`
- `run.create`
- `review.summary`
- `archive.promote`

## 9. 实施顺序

1. 抽出 `Forge Core`
2. 落本地 HTTP API
3. 落 MCP Server
4. 做最小联调验证
