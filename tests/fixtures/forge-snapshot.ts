import type { ForgeDashboardSnapshot } from "../../packages/core/src/types";

export const forgeSnapshotFixture: ForgeDashboardSnapshot = {
  activeProjectId: "retail-support",
  projects: [
    {
      id: "retail-support",
      name: "零售客服副驾驶",
      requirement: "帮我做一个零售客服副驾驶，支持知识问答、订单查询和支付失败处理。",
      enterpriseName: "百川零售",
      sector: "企业服务 / 智能客服",
      projectType: "客服助手",
      owner: "Iris",
      deliveryDate: "2026-03-22",
      note: "公开演示展示问答、订单查询与异常处理闭环。",
      status: "active",
      lastRun: "8 分钟前",
      progress: 72,
      riskNote: "支付失败回归链路待补齐"
    },
    {
      id: "clinic-rag",
      name: "诊所知识助手",
      requirement: "帮诊所做一个知识助手，支持诊疗知识问答和资料检索。",
      enterpriseName: "和安诊所",
      sector: "医疗服务 / 知识检索",
      projectType: "知识助手",
      owner: "Theo",
      deliveryDate: "2026-03-25",
      note: "公开演示展示知识检索、引用回答与资料回查。",
      status: "risk",
      lastRun: "14 分钟前",
      progress: 58,
      riskNote: "热更新说明与回归门禁待补齐"
    }
  ],
  projectTemplates: [
    {
      id: "template-rag",
      title: "知识库问答模板",
      sector: "RAG",
      summary: "适用于问答和检索增强项目",
      dnaSummary: "绑定知识库、兜底问答和标准测试门禁。",
      defaultPromptIds: ["prompt-prd"],
      defaultGateIds: ["gate-build", "gate-playwright"],
      constraints: ["必须定义知识库来源"]
    }
  ],
  projectProfiles: [
    {
      projectId: "retail-support",
      templateId: "template-rag",
      templateTitle: "知识库问答模板",
      workspacePath: "/tmp/forge/retail-support",
      dnaSummary: "绑定知识库、兜底问答和标准测试门禁。",
      defaultPromptIds: ["prompt-prd"],
      defaultGateIds: ["gate-build", "gate-playwright"],
      constraints: ["必须定义知识库来源"],
      initializedAt: "今天 09:10"
    }
  ],
  workflowStates: [
    {
      projectId: "retail-support",
      currentStage: "测试验证",
      state: "blocked",
      blockers: ["测试报告 尚未齐备", "Playwright 门禁失败"],
      lastTransitionAt: "今天 10:58",
      updatedBy: "system"
    },
    {
      projectId: "clinic-rag",
      currentStage: "方案与任务包",
      state: "current",
      blockers: [],
      lastTransitionAt: "今天 09:20",
      updatedBy: "system"
    }
  ],
  workflowTransitions: [
    {
      id: "transition-retail-testing",
      projectId: "retail-support",
      stage: "测试验证",
      state: "blocked",
      updatedBy: "产品经理 Agent",
      blockers: ["测试报告 尚未齐备", "Playwright 门禁失败"],
      createdAt: "今天 10:58"
    },
    {
      id: "transition-clinic-solution",
      projectId: "clinic-rag",
      stage: "方案与任务包",
      state: "current",
      updatedBy: "系统",
      blockers: [],
      createdAt: "今天 09:20"
    }
  ],
  assets: [
    {
      id: "asset-template-fallback",
      title: "支付失败兜底模板",
      type: "template",
      summary: "覆盖失败态补偿、转人工和订单恢复。"
    },
    {
      id: "asset-skill-search",
      title: "检索增强 Skill",
      type: "skill",
      summary: "负责召回、重排和引用标准化。"
    }
  ],
  promptTemplates: [
    {
      id: "prompt-prd",
      title: "客服 PRD 模板",
      scenario: "智能客服",
      summary: "生成客服和兜底流程的 PRD 草案。",
      template: "请围绕 {{project_name}} 输出 PRD。",
      variables: ["project_name", "risk_note"],
      version: "v1.2",
      useCount: 9,
      lastUsedAt: "今天 10:21"
    }
  ],
  prdDocuments: [
    {
      id: "prd-retail",
      projectId: "retail-support",
      templateId: "prompt-prd",
      title: "零售客服副驾驶 PRD 草案",
      content: "# 零售客服副驾驶 PRD 草案\n\n## 核心目标\n- 降低退款失败率",
      status: "draft",
      createdAt: "今天 10:22"
    }
  ],
  projectAssetLinks: [
    {
      id: "link-template",
      projectId: "retail-support",
      targetType: "template",
      targetId: "template-rag",
      relation: "default",
      reason: "当前项目继承知识库问答模板。",
      usageGuide: "先读取模板约束，再推进 PRD 和 TaskPack。"
    },
    {
      id: "link-prompt",
      projectId: "retail-support",
      targetType: "prompt",
      targetId: "prompt-prd",
      relation: "required",
      reason: "必须先生成 PRD 草案。",
      usageGuide: "补齐项目名和风险说明后生成 PRD。"
    },
    {
      id: "link-skill",
      projectId: "retail-support",
      targetType: "asset",
      targetId: "asset-skill-search",
      relation: "recommended",
      reason: "当前项目依赖检索增强和引用标准化。",
      usageGuide: "在主流程开发前先接入检索增强 Skill。"
    }
  ],
  components: [
    {
      id: "component-auth-email",
      title: "邮箱登录组件",
      category: "auth",
      summary: "支持邮箱验证码、登录态校验和基础风控埋点。",
      sourceType: "internal",
      sourceRef: "forge://components/auth/email-login",
      tags: ["登录", "鉴权", "验证码"],
      recommendedSectors: ["智能客服", "RAG"],
      usageGuide: "优先用于需要邮箱登录和会话保持的项目，接入前先确认用户体系。",
      assemblyContract: {
        deliveryMode: "workspace-package",
        sourceLocator: "packages/modules/auth-email-login",
        importPath: "@forge-modules/auth-email-login",
        installCommand: "pnpm --filter app add @forge-modules/auth-email-login",
        peerDeps: ["react", "next"],
        requiredEnv: ["AUTH_API_BASE_URL", "AUTH_SESSION_SECRET"],
        setupSteps: [
          "把登录页路由挂到应用入口。",
          "接通验证码发送 API 和会话校验接口。",
          "把鉴权守卫接到需要登录的页面。"
        ],
        smokeTestCommand: "pnpm test -- auth-email-login.smoke",
        ownedPaths: ["src/modules/auth", "src/app/(auth)"]
      }
    },
    {
      id: "component-payment-checkout",
      title: "支付结算组件",
      category: "payment",
      summary: "支持支付下单、失败回调、人工复核和支付结果追踪。",
      sourceType: "github",
      sourceRef: "github://forge-components/payment-checkout",
      tags: ["支付", "回调", "退款"],
      recommendedSectors: ["智能客服"],
      usageGuide: "适用于支付与退款场景，必须同时绑定支付失败门禁和异常态回归。",
      assemblyContract: {
        deliveryMode: "git-repo",
        sourceLocator: "github://forge-components/payment-checkout#v1",
        importPath: "@forge-components/payment-checkout",
        installCommand: "pnpm add @forge-components/payment-checkout",
        peerDeps: ["react", "zod"],
        requiredEnv: ["PAYMENT_CALLBACK_BASE_URL", "PAYMENT_PROVIDER_KEY"],
        setupSteps: [
          "注册支付下单和回调路由。",
          "把订单状态映射到当前项目的业务模型。",
          "补齐失败补偿和人工复核入口。"
        ],
        smokeTestCommand: "pnpm test -- payment-checkout.integration",
        ownedPaths: ["src/modules/payment", "src/app/api/payment"]
      }
    }
  ],
  agents: [
    {
      id: "agent-pm",
      name: "产品经理 Agent",
      role: "pm",
      persona: "范围收口、强调验收标准",
      systemPrompt: "先收口范围，再输出结构化 PRD。",
      responsibilities: ["澄清需求", "输出 PRD", "锁定验收标准"],
      skillIds: ["skill-prd"],
      sopIds: ["sop-intake", "sop-prd-review"],
      knowledgeSources: ["产品需求手册", "历史 PRD 范式"],
      runnerId: "runner-local-main",
      promptTemplateId: "prompt-prd",
      policyId: "policy-product",
      permissionProfileId: "perm-readonly",
      ownerMode: "human-approved"
    },
    {
      id: "agent-design",
      name: "设计 Agent",
      role: "design",
      persona: "强调结构清晰、交互收口和组件约束",
      systemPrompt: "先锁定页面结构和交互边界，再输出 UI 规范。",
      responsibilities: ["输出 UI 结构", "定义页面约束", "审阅交互规范"],
      skillIds: ["skill-ui"],
      sopIds: ["sop-ui-spec"],
      knowledgeSources: ["设计系统规范", "交互约束清单"],
      runnerId: "runner-local-main",
      promptTemplateId: "prompt-design",
      policyId: "policy-design",
      permissionProfileId: "perm-readonly",
      ownerMode: "review-required"
    },
    {
      id: "agent-architect",
      name: "架构师 Agent",
      role: "architect",
      persona: "模块拆分优先，强调边界和可维护性",
      systemPrompt: "先说明模块边界、依赖和风险，再进入研发。",
      responsibilities: ["拆模块", "定义技术方案", "评估风险"],
      skillIds: ["skill-architecture"],
      sopIds: ["sop-architecture"],
      knowledgeSources: ["架构决策记录", "模块边界清单"],
      runnerId: "runner-local-main",
      promptTemplateId: "prompt-architect",
      policyId: "policy-architecture",
      permissionProfileId: "perm-readonly",
      ownerMode: "review-required"
    },
    {
      id: "agent-dev",
      name: "研发 Agent",
      role: "engineer",
      persona: "最小实现优先",
      systemPrompt: "严格按 TaskPack 输出最小实现，不擅自加需求。",
      responsibilities: ["生成补丁", "实现模块", "修复回归"],
      skillIds: ["skill-code"],
      sopIds: ["sop-taskpack-execution"],
      knowledgeSources: ["代码规范", "历史补丁案例"],
      runnerId: "runner-local-main",
      promptTemplateId: "prompt-dev",
      policyId: "policy-engineering",
      permissionProfileId: "perm-execution",
      ownerMode: "auto-execute"
    },
    {
      id: "agent-qa",
      name: "现实校验 Agent",
      role: "qa",
      persona: "先找风险，再确认通过",
      systemPrompt: "先跑门禁和异常路径，再判断是否允许放行。",
      responsibilities: ["设计回归用例", "执行验证", "归因失败项"],
      skillIds: ["skill-qa"],
      sopIds: ["sop-test-gate"],
      knowledgeSources: ["回归用例库", "门禁异常归因手册"],
      runnerId: "runner-browser-qa",
      promptTemplateId: "prompt-qa",
      policyId: "policy-qa",
      permissionProfileId: "perm-readonly",
      ownerMode: "review-required"
    }
  ],
  skills: [
    {
      id: "skill-prd",
      name: "PRD 结构化生成",
      category: "product",
      ownerRole: "pm",
      summary: "把原始需求整理成标准 PRD 草案与验收范围。",
      usageGuide: "先补齐需求摘要、风险和边界，再调用该 Skill 生成 PRD。"
    },
    {
      id: "skill-ui",
      name: "设计系统约束",
      category: "design",
      ownerRole: "design",
      summary: "统一页面结构、组件约束和交互规则。",
      usageGuide: "在 UI Spec 阶段先锁定组件边界，禁止随意新增元素。"
    },
    {
      id: "skill-architecture",
      name: "架构边界拆解",
      category: "architecture",
      ownerRole: "architect",
      summary: "沉淀模块边界、依赖和扩展点。",
      usageGuide: "在 TaskPack 前先输出架构说明，再交给研发 Agent。"
    },
    {
      id: "skill-code",
      name: "任务包代码生成",
      category: "engineering",
      ownerRole: "engineer",
      summary: "根据 TaskPack 和架构说明生成最小可运行补丁。",
      usageGuide: "仅在 TaskPack 完整且架构说明已 ready 时调用。"
    },
    {
      id: "skill-qa",
      name: "门禁自动回归",
      category: "quality",
      ownerRole: "qa",
      summary: "执行关键路径、异常输入和交付前回归。",
      usageGuide: "Demo 评审后立即运行，失败项直接回写任务中枢。"
    }
  ],
  sops: [
    {
      id: "sop-intake",
      name: "需求接入 SOP",
      stage: "项目接入",
      ownerRole: "pm",
      summary: "确认范围、负责人、模板与项目 DNA。",
      checklist: ["确认行业场景", "锁定负责人", "选择模板", "写入项目 DNA"]
    },
    {
      id: "sop-prd-review",
      name: "PRD 评审 SOP",
      stage: "方案与任务包",
      ownerRole: "pm",
      summary: "确保 PRD 范围、验收和风险说明完整。",
      checklist: ["目标清晰", "验收标准齐备", "风险说明明确"]
    },
    {
      id: "sop-ui-spec",
      name: "UI 规范 SOP",
      stage: "方案与任务包",
      ownerRole: "design",
      summary: "统一页面结构、组件和交互限制。",
      checklist: ["组件复用", "交互明确", "状态覆盖完整"]
    },
    {
      id: "sop-architecture",
      name: "架构说明 SOP",
      stage: "方案与任务包",
      ownerRole: "architect",
      summary: "收敛模块边界、依赖和数据流。",
      checklist: ["边界清晰", "依赖可控", "数据流闭环"]
    },
    {
      id: "sop-taskpack-execution",
      name: "TaskPack 执行 SOP",
      stage: "开发执行",
      ownerRole: "engineer",
      summary: "基于 TaskPack 逐项实现和提交补丁。",
      checklist: ["先读 TaskPack", "再看架构说明", "最后输出补丁"]
    },
    {
      id: "sop-test-gate",
      name: "测试门禁 SOP",
      stage: "测试验证",
      ownerRole: "qa",
      summary: "统一跑构建、自动回归和人工复核。",
      checklist: ["构建通过", "自动回归通过", "人工复核确认"]
    }
  ],
  teamTemplates: [
    {
      id: "team-standard",
      name: "标准交付团队",
      summary: "覆盖需求、研发、测试与发布的标准团队。",
      agentIds: ["agent-pm", "agent-dev"],
      leadAgentId: "agent-pm"
    }
  ],
  artifacts: [
    {
      id: "artifact-prd",
      projectId: "retail-support",
      type: "prd",
      title: "零售客服副驾驶 PRD 草案",
      ownerAgentId: "agent-pm",
      status: "ready",
      updatedAt: "今天 10:22"
    },
    {
      id: "artifact-architecture",
      projectId: "retail-support",
      type: "architecture-note",
      title: "退款失败流程架构说明",
      ownerAgentId: "agent-architect",
      status: "ready",
      updatedAt: "今天 10:26"
    },
    {
      id: "artifact-ui-spec",
      projectId: "retail-support",
      type: "ui-spec",
      title: "退款失败流程原型与交互规范",
      ownerAgentId: "agent-design",
      status: "ready",
      updatedAt: "今天 10:31"
    },
    {
      id: "artifact-task-pack",
      projectId: "retail-support",
      type: "task-pack",
      title: "退款失败主流程 TaskPack",
      ownerAgentId: "agent-pm",
      status: "ready",
      updatedAt: "今天 10:40"
    },
    {
      id: "artifact-demo-build",
      projectId: "retail-support",
      type: "demo-build",
      title: "退款失败流程 Demo 构建",
      ownerAgentId: "agent-dev",
      status: "in-review",
      updatedAt: "今天 10:48"
    }
  ],
  artifactReviews: [
    {
      id: "review-demo-build",
      artifactId: "artifact-demo-build",
      reviewerAgentId: "agent-qa",
      decision: "changes-requested",
      summary: "主流程通过，但支付失败异常态和回退提示仍不完整。",
      conditions: ["补齐支付失败异常态", "确认回退提示文案", "重新执行冒烟回归"],
      reviewedAt: "今天 10:58"
    }
  ],
  tasks: [
    {
      id: "task-retail-playwright",
      projectId: "retail-support",
      stage: "测试验证",
      title: "修复 Playwright 失败并重新回归",
      ownerAgentId: "agent-qa",
      status: "blocked",
      priority: "P0",
      category: "execution",
      summary: "当前门禁失败，必须先修复回归链路再继续交付。"
    },
    {
      id: "task-retail-demo-review",
      projectId: "retail-support",
      stage: "测试验证",
      title: "补齐 Demo 评审修改项",
      ownerAgentId: "agent-dev",
      status: "in-progress",
      priority: "P1",
      category: "review",
      summary: "根据现实校验 Agent 的评审意见补齐异常态和人工复核记录。"
    },
    {
      id: "task-clinic-architecture",
      projectId: "clinic-rag",
      stage: "方案与任务包",
      title: "补齐热更新架构说明",
      ownerAgentId: "agent-architect",
      status: "todo",
      priority: "P1",
      category: "handoff",
      summary: "先定义热更新和索引重建边界，再继续 TaskPack。"
    }
  ],
  commands: [
    {
      id: "command-prd-generate",
      name: "生成 PRD",
      type: "prd.generate",
      summary: "基于项目 DNA 和默认 Prompt 生成 PRD 草案。",
      triggerStage: "项目接入",
      requiresArtifacts: []
    },
    {
      id: "command-gate-run",
      name: "发起测试门禁",
      type: "gate.run",
      summary: "统一执行构建、类型检查、自动化回归和人工复核。",
      triggerStage: "测试验证",
      requiresArtifacts: ["demo-build", "test-report"]
    }
  ],
  commandHooks: [
    {
      id: "hook-before-run",
      name: "beforeRun",
      summary: "执行前校验工件与 Runner 就绪状态。",
      policy: "缺少必要工件或 Runner 不健康时阻止执行。"
    }
  ],
  commandExecutions: [
    {
      id: "command-execution-gate-run",
      commandId: "command-gate-run",
      projectId: "retail-support",
      taskPackId: "artifact-task-pack",
      status: "blocked",
      summary: "发起测试门禁时被 beforeRelease 策略阻止。",
      triggeredBy: "现实校验 Agent",
      createdAt: "今天 10:48",
      followUpTaskIds: ["task-retail-playwright"]
    }
  ],
  policyDecisions: [
    {
      id: "policy-decision-before-release",
      hookId: "hook-before-release",
      commandExecutionId: "command-execution-gate-run",
      outcome: "block",
      summary: "存在失败门禁，禁止推进交付发布。",
      createdAt: "今天 10:49"
    }
  ],
  runs: [
    {
      id: "run-retail-patch",
      projectId: "retail-support",
      taskPackId: "artifact-task-pack",
      linkedComponentIds: ["component-auth-email"],
      title: "生成退款失败补丁",
      executor: "Codex",
      cost: "$0.91",
      state: "running",
      outputMode: "codex-ready",
      outputChecks: [
        { name: "codex", status: "pass", summary: "Codex CLI 0.25.0" },
        {
          name: "model-execution",
          status: "pass",
          summary: "Claude Code · claude 2.1.34 · 来源 env:FORGE_ENGINEER_EXEC_COMMAND"
        }
      ]
    },
    {
      id: "run-retail-playwright",
      projectId: "retail-support",
      taskPackId: "artifact-task-pack",
      linkedComponentIds: ["component-payment-checkout"],
      title: "主流程回归验证",
      executor: "Playwright",
      cost: "$0.37",
      state: "blocked",
      outputMode: "playwright-ready",
      outputChecks: [{ name: "playwright", status: "pass", summary: "Version 1.55.0" }]
    }
  ],
  runEvents: [
    {
      id: "run-event-retail-patch",
      runId: "run-retail-patch",
      projectId: "retail-support",
      type: "status",
      summary: "Codex 已接管退款失败补丁任务，正在生成最小修复补丁。",
      failureCategory: null,
      createdAt: "今天 10:36"
    },
    {
      id: "run-event-retail-playwright-failure",
      runId: "run-retail-playwright",
      projectId: "retail-support",
      type: "failure",
      summary: "登录态失效，主流程在支付确认页超时。",
      failureCategory: "test-failure",
      createdAt: "今天 10:42"
    }
  ],
  runners: [
    {
      id: "runner-local-main",
      name: "本地主执行器",
      status: "busy",
      summary: "负责 Codex 补丁生成和主工作区写入。",
      workspacePath: "/tmp/forge/retail-support",
      capabilities: ["Codex", "文件写入", "Git"],
      detectedCapabilities: ["文件写入", "Git"],
      detectedCapabilityDetails: [
        {
          capability: "Git",
          status: "pass",
          path: "/usr/bin/git",
          version: "git version 2.39.5"
        }
      ],
      probeStatus: "healthy",
      probeSummary: "本地工作区与 Git 能力正常。",
      currentRunId: "run-retail-patch",
      lastHeartbeat: "2026-03-08T12:00:00.000Z",
      lastProbeAt: "2026-03-08T11:59:00.000Z"
    },
    {
      id: "runner-browser-qa",
      name: "浏览器验证执行器",
      status: "blocked",
      summary: "负责 Playwright 主流程回归与失败截图采集。",
      workspacePath: "/tmp/forge/retail-support",
      capabilities: ["Playwright", "截图", "门禁回归"],
      detectedCapabilities: ["截图"],
      detectedCapabilityDetails: [
        {
          capability: "Playwright",
          status: "pass",
          path: "/tmp/forge/node_modules/.bin/playwright",
          version: "Version 1.55.0"
        }
      ],
      probeStatus: "degraded",
      probeSummary: "Playwright 回归链缺失。",
      currentRunId: "run-retail-playwright",
      lastHeartbeat: "2026-03-08T11:58:00.000Z",
      lastProbeAt: "2026-03-08T11:57:00.000Z"
    }
  ],
  deliveryGate: [
    {
      id: "gate-build",
      name: "构建",
      status: "pass"
    },
    {
      id: "gate-playwright",
      name: "Playwright",
      status: "fail"
    }
  ]
};
