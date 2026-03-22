const apiBaseUrl = process.env.FORGE_API_BASE_URL || "http://127.0.0.1:3000";

const tools = [
  {
    name: "forge_command_center",
    description: "读取 Forge 的标准命令中心和 Hook / Policy 基线。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "forge_command_execution_record",
    description: "写入 Forge 的标准命令执行记录，并附带策略判定结果。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "命令执行 ID" },
        commandId: { type: "string", description: "命令 ID" },
        projectId: { type: "string", description: "项目 ID" },
        status: {
          type: "string",
          enum: ["running", "done", "blocked"],
          description: "执行状态"
        },
        summary: { type: "string", description: "执行摘要" },
        triggeredBy: { type: "string", description: "触发人" },
        decisions: {
          type: "array",
          description: "策略判定结果",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              hookId: { type: "string" },
              outcome: {
                type: "string",
                enum: ["pass", "warn", "block"]
              },
              summary: { type: "string" }
            },
            required: ["id", "hookId", "outcome", "summary"],
            additionalProperties: false
          }
        }
      },
      required: ["id", "commandId", "status", "summary", "triggeredBy"],
      additionalProperties: false
    }
  },
  {
    name: "forge_command_execute",
    description: "真正执行 Forge 的标准命令，如生成 PRD 或发起测试门禁。",
    inputSchema: {
      type: "object",
      properties: {
        commandId: { type: "string", description: "命令 ID" },
        projectId: { type: "string", description: "项目 ID，默认使用当前激活项目" },
        extraNotes: { type: "string", description: "补充说明" },
        triggeredBy: { type: "string", description: "触发人" }
      },
      required: ["commandId"],
      additionalProperties: false
    }
  },
  {
    name: "forge_project_list",
    description: "列出 Forge 的本地项目和当前激活项目。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "forge_project_snapshot",
    description: "读取当前激活项目的完整工作区快照，包含原始数据和 controlPlane 聚合块。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "forge_control_plane_snapshot",
    description: "一次读取 Forge 的统一控制面聚合摘要，返回 runtime、readiness、releaseGate、blockingTasks、recentExecutions 等主状态。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID，默认使用当前激活项目" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_delivery_readiness",
    description: "读取当前项目的交付就绪度、放行闸口汇总和证据时间线。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID，默认使用当前激活项目" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_remediation_entries",
    description: "读取当前项目的统一整改入口，包含整改任务和放行升级动作。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID，默认使用当前激活项目" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_remediation_retry",
    description: "通过统一整改入口回放其来源命令，自动处理 task 与 escalation 两类整改动作。",
    inputSchema: {
      type: "object",
      properties: {
        remediationId: { type: "string", description: "整改入口 ID" },
        triggeredBy: { type: "string", description: "触发人" }
      },
      required: ["remediationId"],
      additionalProperties: false
    }
  },
  {
    name: "forge_execution_backend_prepare",
    description: "为整改任务、统一整改入口或已进入桥接移交的项目生成 execution backend adapter request，供外部编排后端直接消费。",
    inputSchema: {
      type: "object",
      properties: {
        remediationId: { type: "string", description: "整改入口 ID" },
        taskId: { type: "string", description: "整改任务 ID" },
        projectId: { type: "string", description: "已进入桥接移交阶段的项目 ID" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_execution_backend_dispatch",
    description: "为整改任务、统一整改入口或已进入桥接移交的项目生成 execution backend dispatch receipt，作为外部编排后端的统一发起入口。",
    inputSchema: {
      type: "object",
      properties: {
        remediationId: { type: "string", description: "整改入口 ID" },
        taskId: { type: "string", description: "整改任务 ID" },
        projectId: { type: "string", description: "已进入桥接移交阶段的项目 ID" },
        triggeredBy: { type: "string", description: "触发人" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_execution_backend_execute",
    description: "为整改任务、统一整改入口或已进入桥接移交的项目生成 execution backend shell execution plan，供外部执行器直接消费。",
    inputSchema: {
      type: "object",
      properties: {
        remediationId: { type: "string", description: "整改入口 ID" },
        taskId: { type: "string", description: "整改任务 ID" },
        projectId: { type: "string", description: "已进入桥接移交阶段的项目 ID" },
        triggeredBy: { type: "string", description: "触发人" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_execution_backend_bridge",
    description: "为整改任务、统一整改入口或已进入桥接移交的项目生成受控的 execution backend bridge 结果；默认返回 stub，显式启用时可走本地 shell bridge。",
    inputSchema: {
      type: "object",
      properties: {
        remediationId: { type: "string", description: "整改入口 ID" },
        taskId: { type: "string", description: "整改任务 ID" },
        projectId: { type: "string", description: "已进入桥接移交阶段的项目 ID" },
        triggeredBy: { type: "string", description: "触发人" },
        strategy: {
          type: "string",
          enum: ["stub", "local-shell"],
          description: "bridge 策略，默认 stub"
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_execution_backend_bridge_writeback",
    description: "把 execution backend bridge 结果直接落成正式 run evidence，写回 Forge 的运行时间线；支持从桥接移交阶段的项目直接触发。",
    inputSchema: {
      type: "object",
      properties: {
        remediationId: { type: "string", description: "整改入口 ID" },
        taskId: { type: "string", description: "整改任务 ID" },
        projectId: { type: "string", description: "已进入桥接移交阶段的项目 ID" },
        triggeredBy: { type: "string", description: "触发人" },
        strategy: {
          type: "string",
          enum: ["stub", "local-shell"],
          description: "bridge 策略，默认 stub"
        },
        runId: { type: "string", description: "可选的运行 ID" },
        title: { type: "string", description: "可选的运行标题" },
        executor: { type: "string", description: "可选的执行器名称" },
        cost: { type: "string", description: "可选的成本字符串" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_project_create",
    description: "创建新项目并自动激活。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "项目名称" },
        sector: { type: "string", description: "行业 / 场景" },
        owner: { type: "string", description: "负责人" }
      },
      required: ["name", "sector", "owner"],
      additionalProperties: false
    }
  },
  {
    name: "forge_project_activate",
    description: "切换 Forge 当前激活项目。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID" }
      },
      required: ["projectId"],
      additionalProperties: false
    }
  },
  {
    name: "forge_asset_search",
    description: "按关键词或类型搜索 Forge 复用资产。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
        type: {
          type: "string",
          enum: ["template", "prompt", "skill", "gate"],
          description: "资产类型"
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_task_list",
    description: "读取 Forge 的任务中枢，可按项目或状态过滤。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID" },
        status: {
          type: "string",
          enum: ["todo", "in-progress", "blocked", "done"],
          description: "任务状态"
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_task_retry",
    description: "从整改任务直接回放其来源命令，重新推进被阻断的交付链。",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "整改任务 ID" },
        triggeredBy: { type: "string", description: "触发人" }
      },
      required: ["taskId"],
      additionalProperties: false
    }
  },
  {
    name: "forge_escalation_retry",
    description: "从放行升级动作直接回放其责任任务，重新推进被阻断的交付链。",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "升级任务 ID" },
        triggeredBy: { type: "string", description: "触发人" }
      },
      required: ["taskId"],
      additionalProperties: false
    }
  },
  {
    name: "forge_runner_registry",
    description: "读取 Forge 的本地 Runner 注册表和当前执行能力。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "forge_runner_probe",
    description: "探测 Forge 本地 Runner 的能力、工作区和最近心跳，并回写探测结果。",
    inputSchema: {
      type: "object",
      properties: {
        runnerId: { type: "string", description: "可选，指定 Runner ID" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_runner_heartbeat",
    description: "更新 Forge 中某个本地 Runner 的心跳、状态和当前运行任务。",
    inputSchema: {
      type: "object",
      properties: {
        runnerId: { type: "string", description: "Runner ID" },
        status: {
          type: "string",
          enum: ["idle", "busy", "blocked", "offline"],
          description: "Runner 状态"
        },
        currentRunId: {
          anyOf: [{ type: "string" }, { type: "null" }],
          description: "当前运行任务 ID"
        },
        lastHeartbeat: { type: "string", description: "最近心跳时间" }
      },
      required: ["runnerId", "status", "currentRunId", "lastHeartbeat"],
      additionalProperties: false
    }
  },
  {
    name: "forge_run_upsert",
    description: "写入或更新 Forge 的运行记录，用于回写执行结果。",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "运行 ID" },
        projectId: { type: "string", description: "项目 ID" },
        title: { type: "string", description: "运行标题" },
        executor: { type: "string", description: "执行器" },
        cost: { type: "string", description: "成本" },
        failureCategory: {
          anyOf: [
            {
              type: "string",
              enum: ["spec-gap", "tooling", "environment", "permission", "test-failure", "unknown"]
            },
            { type: "null" }
          ],
          description: "失败归因分类，仅阻塞时使用"
        },
        failureSummary: { type: "string", description: "失败摘要，仅阻塞时使用" },
        state: {
          type: "string",
          enum: ["running", "done", "blocked"],
          description: "运行状态"
        }
      },
      required: ["id", "title", "executor", "cost", "state"],
      additionalProperties: false
    }
  },
  {
    name: "forge_run_timeline",
    description: "读取 Forge 的运行时间线和最近失败归因。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID" },
        runId: { type: "string", description: "运行 ID" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_workflow_list",
    description: "读取 Forge 的项目阶段状态机和阻塞信息。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "forge_workflow_update",
    description: "更新 Forge 中某个项目的当前阶段、阻塞状态和阻塞说明。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID" },
        currentStage: {
          type: "string",
          enum: ["项目接入", "方案与任务包", "开发执行", "测试验证", "交付发布", "归档复用"],
          description: "当前阶段"
        },
        state: {
          type: "string",
          enum: ["current", "blocked"],
          description: "阶段状态"
        },
        blockers: {
          type: "array",
          items: { type: "string" },
          description: "阻塞说明列表"
        },
        updatedBy: { type: "string", description: "更新人" }
      },
      required: ["projectId", "currentStage", "state", "blockers", "updatedBy"],
      additionalProperties: false
    }
  },
  {
    name: "forge_gate_status",
    description: "读取 Forge 当前门禁状态。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "forge_project_templates",
    description: "读取 Forge 的项目模板库。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "forge_prompt_templates",
    description: "读取 Forge 的 Prompt 模板库。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "forge_team_registry",
    description: "读取 Forge 的 Agent、Skill、SOP 和团队模板注册表。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "forge_agent_profile_update",
    description: "更新 Forge 中某个 Agent 的 Prompt 模板、岗位提示词和知识源。",
    inputSchema: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "Agent ID" },
        promptTemplateId: { type: "string", description: "Prompt 模板 ID" },
        systemPrompt: { type: "string", description: "岗位提示词" },
        knowledgeSources: {
          type: "array",
          items: { type: "string" },
          description: "知识源列表"
        }
      },
      required: ["agentId", "promptTemplateId", "systemPrompt", "knowledgeSources"],
      additionalProperties: false
    }
  },
  {
    name: "forge_capability_registry",
    description: "读取 Forge 的 Prompt、Skill、SOP 和复用资产注册表。",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "forge_component_registry",
    description: "读取 Forge 的组件注册表，可按关键词、分类、场景和来源过滤。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID，默认使用当前激活项目" },
        taskPackId: { type: "string", description: "TaskPack 工件 ID" },
        query: { type: "string", description: "搜索关键词" },
        category: {
          type: "string",
          enum: ["auth", "payment", "file", "data", "communication"],
          description: "组件分类"
        },
        sector: { type: "string", description: "适用场景，如 RAG、智能客服" },
        sourceType: {
          type: "string",
          enum: ["internal", "github"],
          description: "组件来源"
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_component_resource_search",
    description: "搜索 GitHub 上的外部候选组件资源，用于补充 TaskPack 装配建议。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID，默认使用当前激活项目" },
        taskPackId: { type: "string", description: "TaskPack 工件 ID" },
        query: { type: "string", description: "附加搜索关键词" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "附加标签"
        },
        category: {
          type: "string",
          enum: ["auth", "payment", "file", "data", "communication"],
          description: "组件分类"
        },
        language: { type: "string", description: "编程语言，例如 TypeScript" },
        maturity: {
          type: "string",
          enum: ["seed", "active", "established"],
          description: "候选成熟度"
        },
        maxItems: { type: "number", description: "最多返回多少个候选资源" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_component_assembly_plan",
    description: "基于当前项目和 TaskPack 读取组件装配计划，返回推荐组件和下一步装配动作。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID，默认使用当前激活项目" },
        taskPackId: { type: "string", description: "TaskPack 工件 ID" },
        maxItems: { type: "number", description: "最多返回多少条组件建议，默认 3" }
      },
      additionalProperties: false
    }
  },
  {
    name: "forge_component_assembly_apply",
    description: "把组件装配计划写回当前项目关联，供 TaskPack 和 Engineer Runner 继续消费。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID，默认使用当前激活项目" },
        taskPackId: { type: "string", description: "TaskPack 工件 ID" },
        componentIds: {
          type: "array",
          items: { type: "string" },
          description: "要写回项目关联的组件 ID 列表"
        },
        triggeredBy: { type: "string", description: "触发人" }
      },
      required: ["componentIds"],
      additionalProperties: false
    }
  },
  {
    name: "forge_prd_generate",
    description: "基于项目和 Prompt 模板生成一份 PRD 草案。",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "项目 ID" },
        templateId: { type: "string", description: "Prompt 模板 ID" },
        extraNotes: { type: "string", description: "补充说明" }
      },
      required: ["projectId", "templateId"],
      additionalProperties: false
    }
  }
];

function writeMessage(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

async function requestJson(path, init) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {})
    }
  });

  let payload;

  try {
    payload = await response.json();
  } catch {
    throw new Error(`Forge API 返回了非 JSON 响应: ${path}`);
  }

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message || `Forge API 调用失败: ${path}`);
  }

  return payload.data;
}

async function callTool(name, args = {}) {
  switch (name) {
    case "forge_command_center":
      return requestJson("/api/forge/commands");
    case "forge_command_execution_record":
      return requestJson("/api/forge/commands", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_command_execute":
      return requestJson("/api/forge/commands", {
        method: "POST",
        body: JSON.stringify({
          ...args,
          mode: "execute"
        })
      });
    case "forge_project_list":
      return requestJson("/api/forge/projects");
    case "forge_project_snapshot":
      return requestJson("/api/forge/snapshot");
    case "forge_control_plane_snapshot": {
      const params = new URLSearchParams();
      if (typeof args.projectId === "string" && args.projectId.trim()) {
        params.set("projectId", args.projectId.trim());
      }
      const query = params.toString();
      return requestJson(`/api/forge/control-plane${query ? `?${query}` : ""}`);
    }
    case "forge_delivery_readiness": {
      const params = new URLSearchParams();
      if (typeof args.projectId === "string" && args.projectId.trim()) {
        params.set("projectId", args.projectId.trim());
      }
      const query = params.toString();
      return requestJson(`/api/forge/readiness${query ? `?${query}` : ""}`);
    }
    case "forge_remediation_entries": {
      const params = new URLSearchParams();
      if (typeof args.projectId === "string" && args.projectId.trim()) {
        params.set("projectId", args.projectId.trim());
      }
      const query = params.toString();
      return requestJson(`/api/forge/remediations${query ? `?${query}` : ""}`);
    }
    case "forge_remediation_retry":
      return requestJson("/api/forge/remediations/retry", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_execution_backend_prepare":
      return requestJson("/api/forge/execution-backends/prepare", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_execution_backend_dispatch":
      return requestJson("/api/forge/execution-backends/dispatch", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_execution_backend_execute":
      return requestJson("/api/forge/execution-backends/execute", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_execution_backend_bridge":
      return requestJson("/api/forge/execution-backends/bridge", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_execution_backend_bridge_writeback":
      return requestJson("/api/forge/execution-backends/bridge/writeback", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_project_create":
      return requestJson("/api/forge/projects", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_project_activate":
      return requestJson("/api/forge/projects/active", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_asset_search": {
      const params = new URLSearchParams();
      if (typeof args.query === "string" && args.query.trim()) {
        params.set("query", args.query.trim());
      }
      if (typeof args.type === "string" && args.type.trim()) {
        params.set("type", args.type.trim());
      }
      const query = params.toString();
      return requestJson(`/api/forge/assets${query ? `?${query}` : ""}`);
    }
    case "forge_task_list": {
      const params = new URLSearchParams();
      if (typeof args.projectId === "string" && args.projectId.trim()) {
        params.set("projectId", args.projectId.trim());
      }
      if (typeof args.status === "string" && args.status.trim()) {
        params.set("status", args.status.trim());
      }
      const query = params.toString();
      return requestJson(`/api/forge/tasks${query ? `?${query}` : ""}`);
    }
    case "forge_task_retry":
      return requestJson("/api/forge/tasks/retry", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_escalation_retry":
      return requestJson("/api/forge/escalations/retry", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_runner_registry":
      return requestJson("/api/forge/runners");
    case "forge_runner_probe":
      return requestJson("/api/forge/runners/probe", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_runner_heartbeat":
      return requestJson("/api/forge/runners", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_run_upsert":
      return requestJson("/api/forge/runs", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_run_timeline": {
      const params = new URLSearchParams();
      if (typeof args.projectId === "string" && args.projectId.trim()) {
        params.set("projectId", args.projectId.trim());
      }
      if (typeof args.runId === "string" && args.runId.trim()) {
        params.set("runId", args.runId.trim());
      }
      const query = params.toString();
      return requestJson(`/api/forge/runs${query ? `?${query}` : ""}`);
    }
    case "forge_workflow_list":
      return requestJson("/api/forge/workflow");
    case "forge_workflow_update":
      return requestJson("/api/forge/workflow", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_gate_status":
      return requestJson("/api/forge/gates");
    case "forge_project_templates":
      return requestJson("/api/forge/templates");
    case "forge_prompt_templates":
      return requestJson("/api/forge/prompts");
    case "forge_team_registry":
      return requestJson("/api/forge/team-registry");
    case "forge_agent_profile_update":
      return requestJson("/api/forge/team-registry", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_capability_registry":
      return requestJson("/api/forge/capabilities");
    case "forge_component_registry": {
      const params = new URLSearchParams();
      if (typeof args.projectId === "string" && args.projectId.trim()) {
        params.set("projectId", args.projectId.trim());
      }
      if (typeof args.taskPackId === "string" && args.taskPackId.trim()) {
        params.set("taskPackId", args.taskPackId.trim());
      }
      if (typeof args.query === "string" && args.query.trim()) {
        params.set("query", args.query.trim());
      }
      if (typeof args.category === "string" && args.category.trim()) {
        params.set("category", args.category.trim());
      }
      if (typeof args.sector === "string" && args.sector.trim()) {
        params.set("sector", args.sector.trim());
      }
      if (typeof args.sourceType === "string" && args.sourceType.trim()) {
        params.set("sourceType", args.sourceType.trim());
      }
      const query = params.toString();
      return requestJson(`/api/forge/components${query ? `?${query}` : ""}`);
    }
    case "forge_component_resource_search": {
      const params = new URLSearchParams();
      if (typeof args.projectId === "string" && args.projectId.trim()) {
        params.set("projectId", args.projectId.trim());
      }
      if (typeof args.taskPackId === "string" && args.taskPackId.trim()) {
        params.set("taskPackId", args.taskPackId.trim());
      }
      if (typeof args.query === "string" && args.query.trim()) {
        params.set("query", args.query.trim());
      }
      if (Array.isArray(args.tags) && args.tags.length > 0) {
        params.set("tags", args.tags.map((item) => String(item).trim()).filter(Boolean).join(","));
      }
      if (typeof args.category === "string" && args.category.trim()) {
        params.set("category", args.category.trim());
      }
      if (typeof args.language === "string" && args.language.trim()) {
        params.set("language", args.language.trim());
      }
      if (typeof args.maturity === "string" && args.maturity.trim()) {
        params.set("maturity", args.maturity.trim());
      }
      if (typeof args.maxItems === "number" && Number.isFinite(args.maxItems)) {
        params.set("maxItems", String(args.maxItems));
      }
      const query = params.toString();
      return requestJson(`/api/forge/components/search${query ? `?${query}` : ""}`);
    }
    case "forge_component_assembly_plan": {
      const params = new URLSearchParams();
      if (typeof args.projectId === "string" && args.projectId.trim()) {
        params.set("projectId", args.projectId.trim());
      }
      if (typeof args.taskPackId === "string" && args.taskPackId.trim()) {
        params.set("taskPackId", args.taskPackId.trim());
      }
      if (typeof args.maxItems === "number" && Number.isFinite(args.maxItems)) {
        params.set("maxItems", String(args.maxItems));
      }
      const query = params.toString();
      return requestJson(`/api/forge/components/assemble${query ? `?${query}` : ""}`);
    }
    case "forge_component_assembly_apply":
      return requestJson("/api/forge/components/assemble", {
        method: "POST",
        body: JSON.stringify(args)
      });
    case "forge_prd_generate":
      return requestJson("/api/forge/prd", {
        method: "POST",
        body: JSON.stringify(args)
      });
    default:
      throw new Error(`未知工具: ${name}`);
  }
}

async function handleRequest(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "forge-mcp",
          version: "0.1.0"
        }
      }
    });
    return;
  }

  if (method === "notifications/initialized") {
    return;
  }

  if (method === "ping") {
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {}
    });
    return;
  }

  if (method === "tools/list") {
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: {
        tools
      }
    });
    return;
  }

  if (method === "tools/call") {
    try {
      const result = await callTool(params?.name, params?.arguments || {});
      writeMessage({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ],
          structuredContent: result
        }
      });
    } catch (error) {
      writeMessage({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : "Forge MCP 调用失败"
        }
      });
    }
    return;
  }

  if (method === "resources/list" || method === "prompts/list") {
    writeMessage({
      jsonrpc: "2.0",
      id,
      result: method === "resources/list" ? { resources: [] } : { prompts: [] }
    });
    return;
  }

  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `不支持的方法: ${method}`
    }
  });
}

let buffer = Buffer.alloc(0);

function drainBuffer() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");

    if (headerEnd === -1) {
      return;
    }

    const header = buffer.slice(0, headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);

    if (!match) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;

    if (buffer.length < bodyEnd) {
      return;
    }

    const body = buffer.slice(bodyStart, bodyEnd).toString("utf8");
    buffer = buffer.slice(bodyEnd);

    try {
      const message = JSON.parse(body);
      void handleRequest(message);
    } catch (error) {
      writeMessage({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: error instanceof Error ? error.message : "无法解析 MCP 消息"
        }
      });
    }
  }
}

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  drainBuffer();
});

process.stdin.on("end", () => {
  process.exit(0);
});
