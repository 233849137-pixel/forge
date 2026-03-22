import { join } from "node:path";
import type {
  ForgeCommand,
  ForgeCommandHook,
  ForgeCommandExecution,
  ForgeComponent,
  ForgeAgent,
  ForgeArtifact,
  ForgeArtifactReview,
  DeliveryGateItem,
  ForgeAsset,
  ForgePolicyDecision,
  ForgePrdDocument,
  ForgeProject,
  ForgeProjectTemplate,
  ForgeWorkflowTransition,
  ForgeProjectAssetLink,
  ForgePromptTemplate,
  ForgeProjectWorkflowState,
  ForgeRun,
  ForgeRunEvent,
  ForgeRunner,
  ForgeSkill,
  ForgeSop,
  ForgeTask,
  ForgeTeamTemplate
} from "../../packages/core/src/types";
import { getForgeAgentDisplayLabel } from "../../packages/core/src/agent-display";
import { defaultTeamWorkbenchTemplates } from "../lib/forge-team-defaults";

const PM_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-pm" });
const PROJECT_MANAGER_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-service-strategy" });
const ARCHITECT_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-architect" });
const DESIGN_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-design" });
const ENGINEER_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-engineer" });
const QA_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-qa" });
const RELEASE_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-release" });
const QA_AUTOMATION_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-qa-automation" });
const KNOWLEDGE_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-knowledge" });
const KNOWLEDGE_OPS_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-knowledge-ops" });
const FRONTEND_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-frontend" });
const UX_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-ux" });
const DISCOVERY_DISPLAY_LABEL = getForgeAgentDisplayLabel({ id: "agent-discovery" });
const SAMPLE_WORKSPACE_ROOT = join(process.cwd(), "data", "workspaces");

function minutesAgoIso(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function sampleWorkspacePath(workspaceId: string) {
  return join(SAMPLE_WORKSPACE_ROOT, workspaceId);
}

export const projects: ForgeProject[] = [
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
    lastRun: "34 分钟前",
    progress: 54,
    riskNote: "热更新说明与回归门禁待补齐"
  },
  {
    id: "ops-briefing",
    name: "运营简报引擎",
    requirement: "搭建一个运营简报引擎，自动生成日报和周报。",
    enterpriseName: "曜石传媒",
    sector: "运营效率 / 自动化",
    projectType: "简报自动化",
    owner: "Nova",
    deliveryDate: "2026-03-29",
    note: "公开演示展示日报生成、审核流与发布闭环。",
    status: "ready",
    lastRun: "1 小时前",
    progress: 91,
    riskNote: "对外发布口径待最终确认"
  }
];

export const assets: ForgeAsset[] = [
  {
    id: "asset-1",
    title: "智能客服首单交付模板",
    type: "template",
    summary: "带任务包、测试清单、回归门禁的客服项目模板"
  },
  {
    id: "asset-2",
    title: "检索增强 Skill 包",
    type: "skill",
    summary: "负责召回、引用标准化和无答案兜底"
  },
  {
    id: "asset-3",
    title: "Playwright 交付门禁包",
    type: "gate",
    summary: "构建、登录、主流程、异常输入四段式冒烟测试"
  }
];

export const components: ForgeComponent[] = [
  {
    id: "component-auth-email",
    title: "邮箱登录组件",
    category: "auth",
    summary: "支持邮箱验证码、登录态校验和基础风控埋点。",
    sourceType: "internal",
    sourceRef: "forge://components/auth/email-login",
    tags: ["登录", "鉴权", "验证码"],
    recommendedSectors: ["智能客服", "RAG", "运营自动化"],
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
    recommendedSectors: ["智能客服", "运营自动化"],
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
  },
  {
    id: "component-file-uploader",
    title: "文件上传下载组件",
    category: "file",
    summary: "支持对象存储上传、下载链接生成和大文件失败重试。",
    sourceType: "internal",
    sourceRef: "forge://components/file/uploader",
    tags: ["上传", "下载", "对象存储"],
    recommendedSectors: ["RAG", "运营自动化"],
    usageGuide: "适合知识库导入和报表导出，接入前先确认文件类型与权限模型。",
    assemblyContract: {
      deliveryMode: "workspace-package",
      sourceLocator: "packages/modules/file-uploader",
      importPath: "@forge-modules/file-uploader",
      installCommand: "pnpm --filter app add @forge-modules/file-uploader",
      peerDeps: ["react"],
      requiredEnv: ["STORAGE_BUCKET", "STORAGE_REGION"],
      setupSteps: [
        "挂上文件上传入口和下载鉴权接口。",
        "配置对象存储 bucket 与回调策略。",
        "补齐大文件失败重试和权限校验。"
      ],
      smokeTestCommand: "pnpm test -- file-uploader.smoke",
      ownedPaths: ["src/modules/file", "src/app/api/files"]
    }
  },
  {
    id: "component-chat-panel",
    title: "对话工作台组件",
    category: "communication",
    summary: "支持多轮会话、快捷回复、转人工和消息状态流。",
    sourceType: "github",
    sourceRef: "github://forge-components/chat-panel",
    tags: ["聊天", "对话", "转人工"],
    recommendedSectors: ["智能客服"],
    usageGuide: "适用于客服和助手类项目，建议和检索增强 Skill、人工接管策略一起装配。",
    assemblyContract: {
      deliveryMode: "npm-package",
      sourceLocator: "@forge-components/chat-panel",
      importPath: "@forge-components/chat-panel",
      installCommand: "pnpm add @forge-components/chat-panel",
      peerDeps: ["react", "react-dom"],
      requiredEnv: ["CHAT_STREAM_ENDPOINT"],
      setupSteps: [
        "接入会话流式接口。",
        "绑定快捷回复与人工接管动作。",
        "接通消息状态和会话历史存储。"
      ],
      smokeTestCommand: "pnpm test -- chat-panel.smoke",
      ownedPaths: ["src/modules/chat", "src/app/(workspace)/chat"]
    }
  }
];

export const projectTemplates: ForgeProjectTemplate[] = [
  {
    id: "template-smart-service",
    title: "智能客服标准模板",
    sector: "智能客服",
    summary: "适合售后、退款、转人工等客服类项目快速起盘。",
    dnaSummary: "默认绑定客服 PRD 模板、退款失败回归门禁和转人工约束。",
    defaultPromptIds: ["prompt-prd-customer-service"],
    defaultGateIds: ["gate-1", "gate-2", "gate-3", "gate-4"],
    constraints: ["优先覆盖退款失败路径", "必须保留转人工出口"]
  },
  {
    id: "template-rag-service",
    title: "知识库问答模板",
    sector: "RAG",
    summary: "适合知识库问答、文档问答和检索增强场景。",
    dnaSummary: "默认绑定 RAG PRD 模板、召回验证和知识库兜底约束。",
    defaultPromptIds: ["prompt-prd-rag"],
    defaultGateIds: ["gate-1", "gate-2", "gate-3"],
    constraints: ["必须提供知识库来源说明", "需要定义无答案兜底策略"]
  },
  {
    id: "template-ops-automation",
    title: "运营自动化模板",
    sector: "运营自动化",
    summary: "适合简报、周报、内容生产类内部效率工具。",
    dnaSummary: "默认绑定运营 PRD 模板、审核节点和发布前复核要求。",
    defaultPromptIds: ["prompt-prd-ops"],
    defaultGateIds: ["gate-1", "gate-2", "gate-4"],
    constraints: ["必须保留人工审核节点", "需要说明输入源和发布节奏"]
  }
];

export const workflowStates: ForgeProjectWorkflowState[] = [
  {
    projectId: "retail-support",
    currentStage: "测试验证",
    state: "blocked",
    blockers: ["Playwright 门禁失败", "测试报告 尚未齐备"],
    lastTransitionAt: "今天 10:58",
    updatedBy: "system"
  },
  {
    projectId: "clinic-rag",
    currentStage: "方案与任务包",
    state: "current",
    blockers: [],
    lastTransitionAt: "今天 09:40",
    updatedBy: "system"
  },
  {
    projectId: "ops-briefing",
    currentStage: "交付发布",
    state: "current",
    blockers: [],
    lastTransitionAt: "今天 11:10",
    updatedBy: "system"
  }
];

export const workflowTransitions: ForgeWorkflowTransition[] = [
  {
    id: "transition-retail-testing",
    projectId: "retail-support",
    stage: "测试验证",
    state: "blocked",
    updatedBy: QA_AUTOMATION_DISPLAY_LABEL,
    blockers: ["Playwright 门禁失败", "测试报告 尚未齐备"],
    createdAt: "今天 10:58"
  },
  {
    id: "transition-clinic-solution",
    projectId: "clinic-rag",
    stage: "方案与任务包",
    state: "current",
    updatedBy: ARCHITECT_DISPLAY_LABEL,
    blockers: [],
    createdAt: "今天 09:40"
  },
  {
    id: "transition-ops-release",
    projectId: "ops-briefing",
    stage: "交付发布",
    state: "current",
    updatedBy: RELEASE_DISPLAY_LABEL,
    blockers: [],
    createdAt: "今天 11:10"
  }
];

export const seedProjectTemplateMap: Record<string, string> = {
  "retail-support": "template-smart-service",
  "clinic-rag": "template-rag-service",
  "ops-briefing": "template-ops-automation"
};

export const promptTemplates: ForgePromptTemplate[] = [
  {
    id: "prompt-prd-customer-service",
    title: "客服系统 PRD 草案模板",
    scenario: "智能客服",
    summary: "适合从客户需求快速生成客服系统的项目 PRD。",
    template:
      "请围绕 {{project_name}} 输出 PRD 草案，重点覆盖 {{sector}} 的主流程、{{risk_note}}，以及 {{extra_notes}}。",
    variables: ["project_name", "sector", "risk_note", "extra_notes"],
    version: "v1.2",
    useCount: 12,
    lastUsedAt: "今天"
  },
  {
    id: "prompt-prd-rag",
    title: "知识库问答 PRD 模板",
    scenario: "RAG",
    summary: "用于知识库问答、文档问答与检索增强场景。",
    template:
      "请输出 {{project_name}} 的 RAG 项目 PRD，说明知识库来源、召回策略、兜底逻辑和 {{extra_notes}}。",
    variables: ["project_name", "sector", "extra_notes"],
    version: "v0.9",
    useCount: 8,
    lastUsedAt: "昨天"
  },
  {
    id: "prompt-prd-ops",
    title: "运营自动化 PRD 模板",
    scenario: "运营自动化",
    summary: "适合周报、简报、内容生产类项目。",
    template:
      "请为 {{project_name}} 生成运营自动化 PRD，重点说明输入源、产出节奏、审核节点和 {{extra_notes}}。",
    variables: ["project_name", "extra_notes"],
    version: "v1.0",
    useCount: 5,
    lastUsedAt: null
  }
];

export const prdDocuments: ForgePrdDocument[] = [
  {
    id: "prd-retail-support-seed",
    projectId: "retail-support",
    templateId: "prompt-prd-customer-service",
    title: "零售客服副驾驶 PRD 草案",
    content:
      "# 零售客服副驾驶 PRD 草案\n\n## 项目目标\n- 提升售后客服处理效率\n- 缩短退款与转人工响应时间\n\n## 当前风险\n- 支付失败回归链路待补齐",
    status: "draft",
    createdAt: "今天 09:30"
  }
];

export const projectAssetLinks: ForgeProjectAssetLink[] = [
  {
    id: "link-retail-support-template",
    projectId: "retail-support",
    targetType: "template",
    targetId: "template-smart-service",
    relation: "default",
    reason: "当前项目从智能客服标准模板继承起盘约束。",
    usageGuide: "建立项目后先读取模板 DNA，再开始 PRD 与 TaskPack。"
  },
  {
    id: "link-retail-support-prompt",
    projectId: "retail-support",
    targetType: "prompt",
    targetId: "prompt-prd-customer-service",
    relation: "required",
    reason: "客服项目必须先输出 PRD 草案，再进入任务包阶段。",
    usageGuide: "填入项目名称、风险和额外说明后生成 PRD。"
  },
  {
    id: "link-retail-support-asset",
    projectId: "retail-support",
    targetType: "asset",
    targetId: "asset-2",
    relation: "recommended",
    reason: "当前项目需要检索增强和引用标准化能力。",
    usageGuide: "在主流程开发前先接入召回、重排和引用规范。"
  },
  {
    id: "link-clinic-rag-template",
    projectId: "clinic-rag",
    targetType: "template",
    targetId: "template-rag-service",
    relation: "default",
    reason: "RAG 项目默认继承知识库问答模板。",
    usageGuide: "先确认知识库来源，再推进召回和兜底策略。"
  },
  {
    id: "link-clinic-rag-prompt",
    projectId: "clinic-rag",
    targetType: "prompt",
    targetId: "prompt-prd-rag",
    relation: "required",
    reason: "需要先输出检索增强项目 PRD。",
    usageGuide: "补齐知识库来源、召回策略和兜底逻辑后生成草案。"
  },
  {
    id: "link-clinic-rag-asset",
    projectId: "clinic-rag",
    targetType: "asset",
    targetId: "asset-2",
    relation: "recommended",
    reason: "知识问答项目高度依赖检索增强 Skill。",
    usageGuide: "优先验证召回、重排和引用格式，再做回答生成。"
  },
  {
    id: "link-ops-briefing-template",
    projectId: "ops-briefing",
    targetType: "template",
    targetId: "template-ops-automation",
    relation: "default",
    reason: "运营项目默认继承自动化模板和人工审核节点。",
    usageGuide: "先锁定输入源和审核节奏，再推进内容生成。"
  },
  {
    id: "link-ops-briefing-prompt",
    projectId: "ops-briefing",
    targetType: "prompt",
    targetId: "prompt-prd-ops",
    relation: "required",
    reason: "运营自动化项目必须先固化 PRD 和节奏说明。",
    usageGuide: "填写输入源、节奏和审核节点后生成 PRD。"
  },
  {
    id: "link-ops-briefing-asset",
    projectId: "ops-briefing",
    targetType: "asset",
    targetId: "asset-3",
    relation: "recommended",
    reason: "交付前需要统一门禁包保证发布安全。",
    usageGuide: "在交付发布前统一执行构建、主流程和异常路径门禁。"
  }
];

export const agents: ForgeAgent[] = [
  {
    id: "agent-pm",
    name: getForgeAgentDisplayLabel({ id: "agent-pm" }),
    role: "pm",
    runnerId: "runner-local-main",
    departmentLabel: "产品与方案",
    persona: "业务与产品双视角并重，擅长把一句话需求收成目标、范围、竞争判断和验收边界。",
    systemPrompt:
      `你是 ${PM_DISPLAY_LABEL}。核心使命：把模糊业务诉求转成清晰的产品策略、范围边界和验收口径。工作方式：先确认业务目标、关键场景、成功指标和限制条件，再输出结构化需求、优先级和风险。关键约束：不允许跳过业务目标与成功指标，不允许在未确认边界时扩展范围。`,
    responsibilities: [
      "澄清业务目标、用户场景与竞品差异",
      "输出产品策略与结构化 PRD",
      "锁定验收标准、优先级与上线边界",
      "识别高风险路径与关键假设"
    ],
    skillIds: ["skill-prd", "skill-acceptance"],
    sopIds: ["sop-intake", "sop-prd-review"],
    knowledgeSources: ["行业客服 SOP", "竞品拆解库", "历史 PRD 模板库", "售后与支付失败案例库"],
    promptTemplateId: "prompt-prd-customer-service",
    policyId: "policy-product",
    permissionProfileId: "perm-readonly",
    ownerMode: "human-approved"
  },
  {
    id: "agent-architect",
    name: ARCHITECT_DISPLAY_LABEL,
    role: "architect",
    runnerId: "runner-local-main",
    departmentLabel: "产品与方案",
    persona: "结构化、风险优先，擅长把复杂需求拆成清晰的系统边界和任务包。",
    systemPrompt:
      `你是 ${ARCHITECT_DISPLAY_LABEL}。核心使命：给出最小可落地的方案架构和任务拆分。工作方式：先画模块边界、接口关系和数据流，再标注依赖、风险和降级方案。关键约束：拒绝模糊模块划分，拒绝没有边界的任务包。`,
    responsibilities: [
      "梳理系统边界与职责分层",
      "输出架构说明与任务包",
      "识别关键依赖与降级方案",
      "复核研发实现是否偏离方案"
    ],
    skillIds: ["skill-architecture", "skill-boundary-review"],
    sopIds: ["sop-architecture"],
    knowledgeSources: ["架构决策记录 ADR", "模块边界清单", "接口设计基线"],
    promptTemplateId: "prompt-prd-rag",
    policyId: "policy-architecture",
    permissionProfileId: "perm-readonly",
    ownerMode: "review-required"
  },
  {
    id: "agent-design",
    name: getForgeAgentDisplayLabel({ id: "agent-design" }),
    role: "design",
    runnerId: "runner-local-main",
    departmentLabel: "产品与方案",
    persona: "体验与一致性并重，关注信息密度、交互节奏和组件复用。",
    systemPrompt:
      `你是 ${DESIGN_DISPLAY_LABEL}。核心使命：把需求转成可交付的原型与设计约束。工作方式：先定信息架构，再收口关键页面、组件和状态。关键约束：不允许随意新增组件，不允许遗漏空态、异常态和移动端。`,
    responsibilities: [
      "输出关键页面原型与交互说明",
      "维护组件约束与设计系统规范",
      "覆盖空态异常态与响应式场景",
      "审查实现稿与设计稿的一致性"
    ],
    skillIds: ["skill-design-system", "skill-ui-review"],
    sopIds: ["sop-ui-spec"],
    knowledgeSources: ["设计系统规范", "交互模式库", "多端适配清单"],
    promptTemplateId: "prompt-prd-customer-service",
    policyId: "policy-design",
    permissionProfileId: "perm-readonly",
    ownerMode: "review-required"
  },
  {
    id: "agent-engineer",
    name: getForgeAgentDisplayLabel({ id: "agent-engineer" }),
    role: "engineer",
    runnerId: "runner-local-main",
    departmentLabel: "技术研发",
    persona: "接口、数据链路和服务稳定性优先，擅长把方案拆成可验证的后端能力与集成结果。",
    systemPrompt:
      `你是 ${ENGINEER_DISPLAY_LABEL}。核心使命：根据 TaskPack 快速产出可运行的服务实现、接口能力和数据持久化结果。工作方式：先读任务包、接口约束和数据边界，再实现、验证、补说明。关键约束：不擅自扩需求，不跳过测试，不提交无法复现的接口结果。`,
    responsibilities: [
      "实现服务接口、数据流和持久化逻辑",
      "输出可审查补丁、接口说明与联调记录",
      "修复回归问题并补齐缺失测试",
      "在发布前整理服务风险与待办"
    ],
    skillIds: ["skill-codegen", "skill-refactor", "skill-db"],
    sopIds: ["sop-taskpack-execution"],
    knowledgeSources: ["服务治理规范", "数据库集成手册", "历史补丁案例", "常见故障排查清单"],
    promptTemplateId: "prompt-prd-customer-service",
    policyId: "policy-engineering",
    permissionProfileId: "perm-execution",
    ownerMode: "auto-execute"
  },
  {
    id: "agent-qa",
    name: getForgeAgentDisplayLabel({ id: "agent-qa" }),
    role: "qa",
    runnerId: "runner-browser-qa",
    departmentLabel: "技术研发",
    persona: "测试设计优先，擅长把主流程、边界场景和验证门禁收成清晰的测试策略与覆盖矩阵。",
    systemPrompt:
      `你是 ${QA_DISPLAY_LABEL}。核心使命：在上线前把测试策略、覆盖矩阵和门禁条件设计完整。工作方式：先定义主流程、异常流、风险场景与验证优先级，再安排回归策略和阻塞条件。关键约束：门禁未定义清楚不得推进放行，问题未归因不得给出通过结论。`,
    responsibilities: [
      "设计测试清单、覆盖矩阵与回归策略",
      "定义主流程、异常流和高风险路径门禁",
      "定位失败原因并提出阻塞结论",
      "整理测试报告、放行建议与回归优先级"
    ],
    skillIds: ["skill-playwright", "skill-regression"],
    sopIds: ["sop-test-gate"],
    knowledgeSources: ["测试策略模板", "回归用例库", "线上事故复盘", "门禁异常归因手册"],
    promptTemplateId: "prompt-prd-rag",
    policyId: "policy-quality",
    permissionProfileId: "perm-execution",
    ownerMode: "auto-execute"
  },
  {
    id: "agent-release",
    name: RELEASE_DISPLAY_LABEL,
    role: "release",
    runnerId: "runner-release-helper",
    departmentLabel: "技术研发",
    persona: "严谨守门，关注交付物完整性、部署状态和验收口径。",
    systemPrompt:
      `你是 ${RELEASE_DISPLAY_LABEL}。核心使命：把研发结果收成可交付、可发布、可验收的版本。工作方式：先核对交付物、预览环境和发布清单，再输出发布说明与验收口径。关键约束：缺少关键工件不得进入发布，预览异常不得给出放行。`,
    responsibilities: [
      "核对交付物与发布前置条件",
      "整理发布说明与变更摘要",
      "确认预览环境与验收口径一致",
      "输出上线建议与回滚提醒"
    ],
    skillIds: ["skill-release", "skill-preview"],
    sopIds: ["sop-release"],
    knowledgeSources: ["发布清单", "验收口径模板", "回滚预案样板"],
    promptTemplateId: "prompt-prd-ops",
    policyId: "policy-release",
    permissionProfileId: "perm-review",
    ownerMode: "review-required"
  },
  {
    id: "agent-knowledge",
    name: KNOWLEDGE_DISPLAY_LABEL,
    role: "knowledge",
    runnerId: "runner-release-helper",
    departmentLabel: "运营支持",
    persona: "沉淀优先、抽象能力强，擅长把一次性交付提炼成可复用资产。",
    systemPrompt:
      `你是 ${KNOWLEDGE_DISPLAY_LABEL}。核心使命：把项目经验沉淀成模板、知识卡和最佳实践。工作方式：先抽结果、再抽方法、最后抽复用条件。关键约束：不做纯记录式归档，必须形成可搜索、可调用、可复用的资料。`,
    responsibilities: [
      "提炼模板与知识卡",
      "记录踩坑经验与最佳实践",
      "归档项目工件并补全标签",
      "将复用资产回写到资料库"
    ],
    skillIds: ["skill-archive", "skill-template-extract"],
    sopIds: ["sop-knowledge"],
    knowledgeSources: ["知识卡模板", "历史复盘记录", "组件与交付资产目录"],
    promptTemplateId: "prompt-prd-ops",
    policyId: "policy-knowledge",
    permissionProfileId: "perm-readonly",
    ownerMode: "human-approved"
  },
  {
    id: "agent-service-strategy",
    name: PROJECT_MANAGER_DISPLAY_LABEL,
    role: "pm",
    runnerId: "runner-local-main",
    departmentLabel: "项目管理",
    persona: "跨团队推进意识强、节奏感敏锐，擅长把需求、依赖、风险和责任人收成可执行的项目节奏。",
    systemPrompt:
      `你是 ${PROJECT_MANAGER_DISPLAY_LABEL}。核心使命：把跨团队项目推进成清晰可执行的里程碑与协作节奏。工作方式：先梳理目标、依赖和责任人，再持续推进同步、升级阻塞并收口交付状态。关键约束：不承诺不现实时间，不允许无主任务，不允许只上报问题不带方案。`,
    responsibilities: [
      "梳理项目里程碑、依赖与责任边界",
      "协调跨岗位交接和关键同步节奏",
      "升级阻塞项并补齐应对方案",
      "持续维护面向业务方的项目状态说明"
    ],
    skillIds: ["skill-prd", "skill-acceptance"],
    sopIds: ["sop-intake", "sop-prd-review"],
    knowledgeSources: ["项目章程模板", "风险升级手册", "跨团队同步节奏范例"],
    promptTemplateId: "prompt-prd-customer-service",
    policyId: "policy-product",
    permissionProfileId: "perm-collaborator",
    ownerMode: "human-approved"
  },
  {
    id: "agent-ux",
    name: getForgeAgentDisplayLabel({ id: "agent-ux" }),
    role: "design",
    runnerId: "runner-local-main",
    departmentLabel: "产品与方案",
    persona: "结构先行、基础扎实，擅长把信息架构、页面骨架和状态系统搭成开发可落地的体验基础。",
    systemPrompt:
      `你是 ${UX_DISPLAY_LABEL}。核心使命：把项目规格转成开发可落地的体验结构和页面基础。工作方式：先梳理信息架构、页面骨架和关键状态，再给出清晰的交互边界和实现约束。关键约束：不遗漏关键状态，不输出无法落地的体验结论，不让结构在实现阶段失控。`,
    responsibilities: [
      "设计信息架构和关键页面骨架",
      "补齐空态、异常态和反馈闭环",
      "定义布局系统与交互边界",
      "为设计系统与前端开发提供结构化交付说明"
    ],
    skillIds: ["skill-design-system", "skill-ui-review"],
    sopIds: ["sop-ui-spec"],
    knowledgeSources: ["体验架构基线规范", "页面骨架案例库", "多终端交互指引"],
    promptTemplateId: "prompt-prd-customer-service",
    policyId: "policy-design",
    permissionProfileId: "perm-collaborator",
    ownerMode: "review-required"
  },
  {
    id: "agent-frontend",
    name: FRONTEND_DISPLAY_LABEL,
    role: "engineer",
    runnerId: "runner-local-main",
    departmentLabel: "技术研发",
    persona: "关注实现质量和页面可维护性，擅长把设计与任务包快速落成结构清晰、状态完整的前端结果。",
    systemPrompt:
      `你是 ${FRONTEND_DISPLAY_LABEL}。核心使命：把设计说明和任务包落实成结构清晰、可验证、可继续迭代的前端结果。工作方式：先锁页面结构、状态和组件边界，再实现交互并补齐说明。关键约束：不跳过状态处理，不无依据扩展范围，不把未验证交互当完成结果。`,
    responsibilities: [
      "实现页面结构、组件和交互细节",
      "补齐状态处理和反馈链路",
      "整理前端交付结果与实现说明",
      `协同 ${ENGINEER_DISPLAY_LABEL} 收口工程细节`
    ],
    skillIds: ["skill-codegen", "skill-refactor"],
    sopIds: ["sop-taskpack-execution"],
    knowledgeSources: ["前端组件资产库", "状态处理规范", "前端实现模式库"],
    promptTemplateId: "prompt-prd-customer-service",
    policyId: "policy-engineering",
    permissionProfileId: "perm-execution",
    ownerMode: "auto-execute"
  },
  {
    id: "agent-qa-automation",
    name: QA_AUTOMATION_DISPLAY_LABEL,
    role: "qa",
    runnerId: "runner-browser-qa",
    departmentLabel: "技术研发",
    persona: "证据优先、默认怀疑，擅长用截图、回归结果和失败归因阻止幻想式通过。",
    systemPrompt:
      `你是 ${QA_AUTOMATION_DISPLAY_LABEL}。核心使命：用真实证据验证功能、页面和交付结果，而不是接受口头完成。工作方式：先识别关键链路和高风险场景，再通过自动化回归、截图和失败归因给出结论。关键约束：不只测 happy path，不在失败未归因时给出通过，不接受没有证据的完成声明。`,
    responsibilities: [
      "沉淀主流程与边界场景用例",
      "执行自动化回归、截图与失败归因",
      "补齐演示前的关键门禁覆盖",
      "把验证证据反馈给研发与发布"
    ],
    skillIds: ["skill-playwright", "skill-regression"],
    sopIds: ["sop-test-gate"],
    knowledgeSources: ["自动化回归清单", "失败归因案例库", "证据化验收标准"],
    promptTemplateId: "prompt-prd-rag",
    policyId: "policy-quality",
    permissionProfileId: "perm-execution",
    ownerMode: "auto-execute"
  },
  {
    id: "agent-knowledge-ops",
    name: KNOWLEDGE_OPS_DISPLAY_LABEL,
    role: "knowledge",
    runnerId: "runner-release-helper",
    departmentLabel: "运营支持",
    persona: "系统性强、关注瓶颈和交接质量，擅长把一次性交付流程整理成可重复、可优化、可持续演进的工作方式。",
    systemPrompt:
      `你是 ${KNOWLEDGE_OPS_DISPLAY_LABEL}。核心使命：把项目交付中的瓶颈、交接和重复劳动优化成可复用流程。工作方式：先识别当前流程中的阻塞和低效点，再抽象为标准动作、优化建议和可执行改进项。关键约束：不做空泛复盘，不输出没有落地路径的优化建议，不把未经验证的方法写成标准。`,
    responsibilities: [
      "识别交付流程中的阻塞与低效点",
      "整理标准动作、交接规则和最佳实践",
      "沉淀历史交付中的复用流程资产",
      "把优化建议回写给项目和团队使用"
    ],
    skillIds: ["skill-archive", "skill-template-extract"],
    sopIds: ["sop-knowledge"],
    knowledgeSources: ["流程优化手册", "交付节奏模板", "历史项目复盘案例"],
    promptTemplateId: "prompt-prd-ops",
    policyId: "policy-knowledge",
    permissionProfileId: "perm-collaborator",
    ownerMode: "human-approved"
  },
  {
    id: "agent-discovery",
    name: getForgeAgentDisplayLabel({ id: "agent-discovery" }),
    role: "pm",
    runnerId: "runner-local-main",
    departmentLabel: "产品与方案",
    persona: "擅长把客户语句拆成业务目标、关键场景、边界条件和优先级，先把问题问对，再推进立项。",
    systemPrompt:
      `你是 ${DISCOVERY_DISPLAY_LABEL}。核心使命：在项目立项初期把模糊诉求转成清晰的场景、约束和验收口径。工作方式：先确认业务目标、使用人群、关键路径和风险边界，再输出结构化需求摘要与待确认问题。关键约束：不能跳过业务目标与约束，不允许直接进入方案设计。`,
    responsibilities: [
      "拆解业务目标、关键场景与限制条件",
      "整理需求摘要、待确认项与优先级",
      "补齐验收口径和范围边界",
      "为项目牧羊人提供立项前置材料"
    ],
    skillIds: ["skill-prd", "skill-acceptance"],
    sopIds: ["sop-intake", "sop-prd-review"],
    knowledgeSources: ["客户调研摘要模板", "需求访谈问题库", "行业场景清单"],
    promptTemplateId: "prompt-prd-customer-service",
    policyId: "policy-product",
    permissionProfileId: "perm-collaborator",
    ownerMode: "human-approved"
  },
  {
    id: "agent-solution-architect",
    name: "方案统筹 Agent",
    role: "architect",
    runnerId: "runner-local-main",
    departmentLabel: "产品与方案",
    persona: "偏业务落地和集成推进，擅长把复杂需求整理成多模块协作方案、依赖地图和实施节奏。",
    systemPrompt:
      "你是方案统筹 Agent。核心使命：在产品、设计和研发之间收口方案边界、依赖顺序和实施路径。工作方式：先建立模块图与依赖地图，再明确交接物、优先级和降级策略。关键约束：不输出空泛方案，不忽略集成依赖，不允许没有交接物定义就进入开发。",
    responsibilities: [
      "梳理跨模块方案和依赖顺序",
      "补齐交接物、里程碑与降级方案",
      "复核 TaskPack 是否覆盖关键集成链路",
      "协助架构师收口跨团队方案"
    ],
    skillIds: ["skill-architecture", "skill-boundary-review"],
    sopIds: ["sop-architecture"],
    knowledgeSources: ["集成依赖地图", "方案评审记录", "系统边界样板"],
    promptTemplateId: "prompt-prd-rag",
    policyId: "policy-architecture",
    permissionProfileId: "perm-collaborator",
    ownerMode: "review-required"
  },
  {
    id: "agent-ux-research",
    name: "体验研究 Agent",
    role: "design",
    runnerId: "runner-local-main",
    departmentLabel: "产品与方案",
    persona: "擅长从用户路径、认知负担和异常体验入手，把设计从好看拉回可用、可学、可演示。",
    systemPrompt:
      "你是体验研究 Agent。核心使命：在体验方案阶段把关键用户路径、认知负担和异常体验问题提前暴露出来。工作方式：先梳理用户任务流和反馈点，再校验状态设计、文案表达和操作阻力。关键约束：不只看视觉，不遗漏失败路径，不把未验证的体验假设当结论。",
    responsibilities: [
      "梳理关键用户路径与体验阻力",
      "复核空态、失败态与文案反馈",
      "补齐演示场景下的体验细节",
      `为 ${UX_DISPLAY_LABEL} 提供研究结论`
    ],
    skillIds: ["skill-design-system", "skill-ui-review"],
    sopIds: ["sop-ui-spec"],
    knowledgeSources: ["用户旅程样板", "异常体验检查表", "可用性评审清单"],
    promptTemplateId: "prompt-prd-customer-service",
    policyId: "policy-design",
    permissionProfileId: "perm-collaborator",
    ownerMode: "review-required"
  },
  {
    id: "agent-backend-integration",
    name: "后端集成 Agent",
    role: "engineer",
    runnerId: "runner-local-main",
    departmentLabel: "技术研发",
    persona: "专注接口编排、数据持久化和外部系统接入，擅长把业务链路真正接通，而不是只把页面做出来。",
    systemPrompt:
      "你是后端集成 Agent。核心使命：把服务接口、数据层和外部依赖真正接通，并保证联调链路可验证。工作方式：先梳理接口契约、状态流和持久化边界，再实现联调、补日志与回归说明。关键约束：不跳过契约对齐，不提交无法联调的结果，不忽略数据迁移与回写影响。",
    responsibilities: [
      "打通接口契约、数据流和状态回写",
      "处理持久化、迁移和第三方依赖接入",
      "补齐联调记录和异常链路说明",
      `与 ${FRONTEND_DISPLAY_LABEL} 一起收口交付链路`
    ],
    skillIds: ["skill-codegen", "skill-db", "skill-refactor"],
    sopIds: ["sop-taskpack-execution"],
    knowledgeSources: ["接口契约目录", "数据迁移基线", "第三方接入手册"],
    promptTemplateId: "prompt-prd-rag",
    policyId: "policy-engineering",
    permissionProfileId: "perm-execution",
    ownerMode: "auto-execute"
  },
  {
    id: "agent-security-gate",
    name: "安全门禁 Agent",
    role: "qa",
    runnerId: "runner-browser-qa",
    departmentLabel: "技术研发",
    persona: "默认先怀疑风险路径，擅长在上线前把鉴权、异常处理、输入边界和配置漏洞提前卡出来。",
    systemPrompt:
      "你是安全门禁 Agent。核心使命：在交付前识别高风险缺陷、鉴权问题和异常路径漏洞。工作方式：先检查关键身份、输入边界和敏感路径，再结合回归结果给出风险结论。关键约束：不接受无证据的安全通过，不遗漏鉴权和异常态，不把潜在高风险问题降级成普通待办。",
    responsibilities: [
      "检查鉴权、权限和输入边界风险",
      "复核异常路径和高风险场景门禁",
      "给出风险结论与阻塞建议",
      `为 ${QA_AUTOMATION_DISPLAY_LABEL} 补充安全视角证据`
    ],
    skillIds: ["skill-playwright", "skill-regression"],
    sopIds: ["sop-test-gate"],
    knowledgeSources: ["安全回归清单", "权限边界样板", "异常路径风险库"],
    promptTemplateId: "prompt-prd-rag",
    policyId: "policy-quality",
    permissionProfileId: "perm-review",
    ownerMode: "review-required"
  },
  {
    id: "agent-delivery-ops",
    name: "交付运营 Agent",
    role: "release",
    runnerId: "runner-release-helper",
    departmentLabel: "技术研发",
    persona: "擅长把预览、验收、上线说明和外部协同收成顺畅的交付动作，让交付阶段不再只剩一页文档。",
    systemPrompt:
      "你是交付运营 Agent。核心使命：把发布前后的交付动作、验收协同和运行状态整理成顺畅的交付链。工作方式：先核对交付物、演示地址和验收信息，再安排部署说明、协同提醒和上线确认。关键约束：不允许在交付信息不完整时推进放行，不允许忽略外部依赖和演示风险。",
    responsibilities: [
      "收口预览、验收和上线前后协同动作",
      "整理演示链路、交付提醒和部署说明",
      "补齐交付阶段的风险提示与回滚关注点",
      `协助 ${RELEASE_DISPLAY_LABEL} 形成完整交付包`
    ],
    skillIds: ["skill-release", "skill-preview"],
    sopIds: ["sop-release"],
    knowledgeSources: ["交付运行手册", "部署前检查清单", "验收同步模板"],
    promptTemplateId: "prompt-prd-ops",
    policyId: "policy-release",
    permissionProfileId: "perm-review",
    ownerMode: "review-required"
  },
  {
    id: "agent-asset-curator",
    name: "资产编目 Agent",
    role: "knowledge",
    runnerId: "runner-release-helper",
    departmentLabel: "运营支持",
    persona: "关注资料可发现性和复用效率，擅长把交付结果整理成可搜索、可组合、可二次调用的资产目录。",
    systemPrompt:
      "你是资产编目 Agent。核心使命：把项目中的模板、设计稿、交付物和知识卡整理成可发现、可调用的资产。工作方式：先识别资产类型、适用场景和复用条件，再补标签、目录和使用说明。关键约束：不做无标签归档，不保留只有原作者能理解的资料，不让高价值资产埋在项目细节里。",
    responsibilities: [
      "整理交付资产的标签、目录和适用场景",
      "补齐模板、知识卡和组件资产说明",
      "提升团队对资产的检索和复用效率",
      `为 ${KNOWLEDGE_OPS_DISPLAY_LABEL} 提供结构化资产基线`
    ],
    skillIds: ["skill-template-extract", "skill-archive"],
    sopIds: ["sop-knowledge"],
    knowledgeSources: ["资产编目规范", "资料标签体系", "历史复用案例库"],
    promptTemplateId: "prompt-prd-ops",
    policyId: "policy-knowledge",
    permissionProfileId: "perm-collaborator",
    ownerMode: "human-approved"
  }
];

export const skills: ForgeSkill[] = [
  {
    id: "skill-prd",
    name: "PRD 结构化生成",
    category: "product",
    ownerRole: "pm",
    summary: "把原始需求整理成标准 PRD 草案与验收范围。",
    usageGuide: "先补齐需求摘要、风险和边界，再调用该 Skill 生成 PRD。"
  },
  {
    id: "skill-acceptance",
    name: "验收标准收口",
    category: "product",
    ownerRole: "pm",
    summary: "把目标、范围和验收标准收成明确口径。",
    usageGuide: "PRD 初稿完成后调用，避免验收口径继续漂移。"
  },
  {
    id: "skill-architecture",
    name: "架构边界拆解",
    category: "architecture",
    ownerRole: "architect",
    summary: "沉淀模块边界、依赖和扩展点。",
    usageGuide: `在 TaskPack 前先输出架构说明，再交给 ${ENGINEER_DISPLAY_LABEL}。`
  },
  {
    id: "skill-boundary-review",
    name: "模块边界复核",
    category: "architecture",
    ownerRole: "architect",
    summary: "检查服务边界、职责分配和依赖耦合。",
    usageGuide: "TaskPack 出手前先做一次边界复核，减少后续返工。"
  },
  {
    id: "skill-design-system",
    name: "设计系统约束",
    category: "design",
    ownerRole: "design",
    summary: "统一页面结构、组件约束和交互规则。",
    usageGuide: "在 UI Spec 阶段先锁定组件边界，禁止随意新增元素。"
  },
  {
    id: "skill-ui-review",
    name: "交互规范审查",
    category: "design",
    ownerRole: "design",
    summary: "审查页面状态、交互闭环和视觉一致性。",
    usageGuide: "UI 规范 ready 后调用，避免界面结构再次失控。"
  },
  {
    id: "skill-codegen",
    name: "任务包代码生成",
    category: "engineering",
    ownerRole: "engineer",
    summary: "根据 TaskPack 和架构说明生成最小可运行补丁。",
    usageGuide: "仅在 TaskPack 完整且架构说明已 ready 时调用。"
  },
  {
    id: "skill-refactor",
    name: "结构化重构",
    category: "engineering",
    ownerRole: "engineer",
    summary: "对已有模块做边界收口和结构整理。",
    usageGuide: "功能先跑通，再用该 Skill 做结构优化，避免边改边发散。"
  },
  {
    id: "skill-db",
    name: "本地数据层集成",
    category: "engineering",
    ownerRole: "engineer",
    summary: "处理 SQLite、本地状态和数据对象持久化。",
    usageGuide: "涉及状态落盘、迁移或快照结构调整时调用。"
  },
  {
    id: "skill-playwright",
    name: "门禁自动回归",
    category: "quality",
    ownerRole: "qa",
    summary: "执行关键路径、异常输入和交付前回归。",
    usageGuide: "Demo 评审后立即运行，失败项直接回写任务中枢。"
  },
  {
    id: "skill-regression",
    name: "异常路径回归归因",
    category: "quality",
    ownerRole: "qa",
    summary: "定位失败门禁对应的异常路径和归因结论。",
    usageGuide: "门禁失败后立即调用，先归因再发修复任务。"
  },
  {
    id: "skill-release",
    name: "交付发布整理",
    category: "release",
    ownerRole: "release",
    summary: "生成交付说明、预览摘要和验收提示。",
    usageGuide: "所有门禁转绿后再调用，避免提前生成无效说明。"
  },
  {
    id: "skill-preview",
    name: "预览环境验收",
    category: "release",
    ownerRole: "release",
    summary: "校验预览链接、交付摘要和验收提示是否一致。",
    usageGuide: "发布前最后一次确认时调用，确保交付口径一致。"
  },
  {
    id: "skill-archive",
    name: "经验沉淀提炼",
    category: "knowledge",
    ownerRole: "knowledge",
    summary: "抽取模板、知识卡和踩坑经验。",
    usageGuide: "项目交付后统一沉淀，回写到复用资产层。"
  },
  {
    id: "skill-template-extract",
    name: "模板提炼复用",
    category: "knowledge",
    ownerRole: "knowledge",
    summary: "把项目工件提炼成模板、SOP 和可复用基线。",
    usageGuide: "归档阶段统一执行，避免经验只停留在单个项目。"
  }
];

export const sops: ForgeSop[] = [
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
    id: "sop-architecture",
    name: "架构说明 SOP",
    stage: "方案与任务包",
    ownerRole: "architect",
    summary: "收敛模块边界、依赖和数据流。",
    checklist: ["边界清晰", "依赖可控", "数据流闭环"]
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
  },
  {
    id: "sop-release",
    name: "发布说明 SOP",
    stage: "交付发布",
    ownerRole: "release",
    summary: "整理交付说明、预览和验收信息。",
    checklist: ["预览地址可用", "变更摘要完整", "验收口径明确"]
  },
  {
    id: "sop-knowledge",
    name: "知识沉淀 SOP",
    stage: "归档复用",
    ownerRole: "knowledge",
    summary: "沉淀模板、知识卡和最佳实践。",
    checklist: ["提炼模板", "记录踩坑", "写回知识卡"]
  }
];

export const teamTemplates: ForgeTeamTemplate[] = defaultTeamWorkbenchTemplates.map((template) => ({
  ...template
}));

export const artifacts: ForgeArtifact[] = [
  {
    id: "artifact-prd-retail",
    projectId: "retail-support",
    type: "prd",
    title: "零售客服副驾驶 PRD 草案",
    ownerAgentId: "agent-service-strategy",
    status: "ready",
    updatedAt: "今天 09:30"
  },
  {
    id: "artifact-architecture-retail",
    projectId: "retail-support",
    type: "architecture-note",
    title: "支付失败流程架构说明",
    ownerAgentId: "agent-architect",
    status: "ready",
    updatedAt: "今天 09:48"
  },
  {
    id: "artifact-ui-retail",
    projectId: "retail-support",
    type: "ui-spec",
    title: "支付失败流程原型与交互规范",
    ownerAgentId: "agent-ux",
    status: "ready",
    updatedAt: "今天 09:57"
  },
  {
    id: "artifact-taskpack-retail",
    projectId: "retail-support",
    type: "task-pack",
    title: "支付失败修复任务包",
    ownerAgentId: "agent-architect",
    status: "ready",
    updatedAt: "今天 10:10"
  },
  {
    id: "artifact-patch-retail",
    projectId: "retail-support",
    type: "patch",
    title: "支付失败流程 首轮 Patch",
    ownerAgentId: "agent-frontend",
    status: "ready",
    updatedAt: "今天 10:34"
  },
  {
    id: "artifact-review-retail",
    projectId: "retail-support",
    type: "review-report",
    title: "支付失败流程 规则审查记录",
    ownerAgentId: "agent-architect",
    status: "ready",
    updatedAt: "今天 10:40"
  },
  {
    id: "artifact-demo-retail",
    projectId: "retail-support",
    type: "demo-build",
    title: "支付失败流程 Demo 构建",
    ownerAgentId: "agent-frontend",
    status: "in-review",
    updatedAt: "今天 10:42"
  }
];

export const artifactReviews: ForgeArtifactReview[] = [
  {
    id: "review-retail-patch",
    artifactId: "artifact-patch-retail",
    reviewerAgentId: "agent-architect",
    decision: "pass",
    summary: "Patch 规则审查通过，可以移交 QA 继续门禁验证。",
    conditions: ["TaskPack 范围未扩散", "主流程修复已落地", "异常路径已覆盖"],
    reviewedAt: "今天 10:41"
  },
  {
    id: "review-retail-demo",
    artifactId: "artifact-demo-retail",
    reviewerAgentId: "agent-qa-automation",
    decision: "changes-requested",
    summary: "Demo 主流程可跑通，但支付失败异常态和人工复核说明仍不完整。",
    conditions: ["补齐支付失败异常态", "补齐人工复核记录", "重新执行 Playwright 冒烟测试"],
    reviewedAt: "今天 10:58"
  }
];

export const tasks: ForgeTask[] = [
  {
    id: "task-retail-playwright",
    projectId: "retail-support",
    stage: "测试验证",
    title: "修复 Playwright 失败并重新回归",
    ownerAgentId: "agent-qa-automation",
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
    ownerAgentId: "agent-frontend",
    status: "in-progress",
    priority: "P1",
    category: "review",
    summary: `根据 ${QA_AUTOMATION_DISPLAY_LABEL} 的评审意见补齐异常态和人工复核记录。`
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
  },
  {
    id: "task-ops-release-brief",
    projectId: "ops-briefing",
    stage: "交付发布",
    title: "整理交付说明与验收口径",
    ownerAgentId: "agent-release",
    status: "todo",
    priority: "P1",
    category: "release",
    summary: "生成最终交付摘要、验收说明和上线备注。"
  },
  {
    id: "task-ops-knowledge-card",
    projectId: "ops-briefing",
    stage: "归档复用",
    title: "沉淀运营自动化知识卡",
    ownerAgentId: "agent-knowledge-ops",
    status: "todo",
    priority: "P2",
    category: "knowledge",
    summary: "把已验证的模板、门禁和经验写回知识库。"
  }
];

export const commands: ForgeCommand[] = [
  {
    id: "command-prd-generate",
    name: "生成 PRD",
    type: "prd.generate",
    summary: "基于项目 DNA 和默认 Prompt 生成 PRD 草案。",
    triggerStage: "项目接入",
    requiresArtifacts: []
  },
  {
    id: "command-taskpack-generate",
    name: "生成 TaskPack",
    type: "taskpack.generate",
    summary: "根据 PRD、架构说明和 UI 规范生成首轮 TaskPack。",
    triggerStage: "方案与任务包",
    requiresArtifacts: ["prd", "architecture-note", "ui-spec"]
  },
  {
    id: "command-component-assemble",
    name: "补齐组件装配",
    type: "component.assemble",
    summary: "把推荐组件写回 TaskPack 装配段，并形成研发执行前的组件基线。",
    triggerStage: "开发执行",
    requiresArtifacts: ["task-pack"]
  },
  {
    id: "command-execution-start",
    name: "启动研发执行",
    type: "execution.start",
    summary: "把当前 TaskPack 分配给本地 Runner 并开始执行。",
    triggerStage: "开发执行",
    requiresArtifacts: ["task-pack"]
  },
  {
    id: "command-review-run",
    name: "发起规则审查",
    type: "review.run",
    summary: "由 Reviewer Runner 审查 Patch 与 Demo，生成规则审查记录并移交 QA。",
    triggerStage: "开发执行",
    requiresArtifacts: ["patch", "demo-build"]
  },
  {
    id: "command-gate-run",
    name: "发起测试门禁",
    type: "gate.run",
    summary: "统一执行构建、类型检查、自动化回归和人工复核。",
    triggerStage: "测试验证",
    requiresArtifacts: ["demo-build", "review-report"]
  },
  {
    id: "command-release-prepare",
    name: "整理交付说明",
    type: "release.prepare",
    summary: "基于 Demo、测试结果和验收口径生成交付说明。",
    triggerStage: "交付发布",
    requiresArtifacts: ["demo-build", "test-report"]
  },
  {
    id: "command-release-approve",
    name: "确认交付放行",
    type: "release.approve",
    summary: "由负责人确认交付说明和验收口径，批准进入归档复用。",
    triggerStage: "交付发布",
    requiresArtifacts: []
  },
  {
    id: "command-archive-capture",
    name: "触发归档沉淀",
    type: "archive.capture",
    summary: "把本次交付经验沉淀成知识卡、模板和资产推荐。",
    triggerStage: "归档复用",
    requiresArtifacts: ["release-brief", "knowledge-card"]
  }
];

export const commandHooks: ForgeCommandHook[] = [
  {
    id: "hook-before-run",
    name: "beforeRun",
    summary: "执行前校验工件与 Runner 就绪状态。",
    policy: "缺少必要工件或 Runner 不健康时阻止执行。"
  },
  {
    id: "hook-after-run",
    name: "afterRun",
    summary: "执行后回写事件流、失败归因与下一步建议。",
    policy: "任何 blocked 运行都必须生成失败归因并挂接最近事件流。"
  },
  {
    id: "hook-before-release",
    name: "beforeRelease",
    summary: "发布前校验门禁、测试报告与交付说明。",
    policy: "存在失败门禁或缺少交付说明时禁止推进发布。"
  }
];

export const commandExecutions: ForgeCommandExecution[] = [
  {
    id: "command-execution-prd-generate",
    commandId: "command-prd-generate",
    projectId: "retail-support",
    taskPackId: "artifact-taskpack-retail",
    status: "done",
    summary: `${PROJECT_MANAGER_DISPLAY_LABEL} 已完成 PRD 草案生成，等待架构与设计补齐后续工件。`,
    triggeredBy: PROJECT_MANAGER_DISPLAY_LABEL,
    createdAt: minutesAgoIso(18),
    followUpTaskIds: []
  },
  {
    id: "command-execution-gate-run",
    commandId: "command-gate-run",
    projectId: "retail-support",
    taskPackId: "artifact-taskpack-retail",
    status: "blocked",
    summary: `${QA_AUTOMATION_DISPLAY_LABEL} 发起测试门禁时被 beforeRelease 策略阻止。`,
    triggeredBy: QA_AUTOMATION_DISPLAY_LABEL,
    createdAt: minutesAgoIso(5),
    followUpTaskIds: ["task-retail-playwright"]
  }
];

export const policyDecisions: ForgePolicyDecision[] = [
  {
    id: "policy-decision-before-run",
    hookId: "hook-before-run",
    commandExecutionId: "command-execution-prd-generate",
    outcome: "pass",
    summary: "默认 Prompt 与项目 DNA 已齐备，允许生成 PRD。",
    createdAt: minutesAgoIso(18)
  },
  {
    id: "policy-decision-before-release",
    hookId: "hook-before-release",
    commandExecutionId: "command-execution-gate-run",
    outcome: "block",
    summary: "存在失败门禁，禁止推进交付发布。",
    createdAt: minutesAgoIso(4)
  }
];

export const runs: ForgeRun[] = [
  {
    id: "run-1",
    projectId: "retail-support",
    taskPackId: "artifact-taskpack-retail",
    linkedComponentIds: ["component-auth-email"],
    title: "生成支付失败补丁",
    executor: "Codex",
    cost: "$1.82",
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
    id: "run-2",
    projectId: "retail-support",
    taskPackId: "artifact-taskpack-retail",
    linkedComponentIds: ["component-payment-checkout"],
    title: "回归客服退款流程",
    executor: "Playwright",
    cost: "$0.23",
    state: "blocked",
    outputMode: "playwright-ready",
    outputChecks: [{ name: "playwright", status: "pass", summary: "Version 1.55.0" }]
  },
  {
    id: "run-3",
    projectId: "ops-briefing",
    title: "整理交付摘要",
    executor: "Claude",
    cost: "$0.47",
    state: "done",
    outputMode: null,
    outputChecks: []
  }
];

export const runEvents: ForgeRunEvent[] = [
  {
    id: "run-event-1",
    runId: "run-1",
    projectId: "retail-support",
    type: "status",
    summary: "Codex 已接管退款失败补丁任务，正在生成最小修复补丁。",
    failureCategory: null,
    createdAt: minutesAgoIso(1)
  },
  {
    id: "run-event-2",
    runId: "run-2",
    projectId: "retail-support",
    type: "failure",
    summary: "登录态失效，Playwright 在支付确认页超时，主流程回归未完成。",
    failureCategory: "test-failure",
    createdAt: minutesAgoIso(3)
  },
  {
    id: "run-event-3",
    runId: "run-3",
    projectId: "ops-briefing",
    type: "status",
    summary: `Claude 已完成交付摘要整理，等待 ${RELEASE_DISPLAY_LABEL} 审阅。`,
    failureCategory: null,
    createdAt: minutesAgoIso(6)
  }
];

export const deliveryGate: DeliveryGateItem[] = [
  {
    id: "gate-1",
    name: "构建",
    status: "pass"
  },
  {
    id: "gate-2",
    name: "类型检查",
    status: "pass"
  },
  {
    id: "gate-3",
    name: "Playwright",
    status: "fail"
  },
  {
    id: "gate-4",
    name: "人工复核",
    status: "pending"
  }
];

export const runners: ForgeRunner[] = [
  {
    id: "runner-local-main",
    name: "本地主执行器",
    status: "busy",
    summary: "负责 Codex 补丁生成和主工作区写入。",
    workspacePath: sampleWorkspacePath("retail-support"),
    capabilities: ["Codex", "文件写入", "Git", "TaskPack 执行"],
    detectedCapabilities: ["文件写入", "Git", "TaskPack 执行"],
    detectedCapabilityDetails: [
      { capability: "文件写入", status: "pass", path: "/tmp/forge/retail-support", version: null },
      { capability: "Git", status: "pass", path: "/usr/bin/git", version: "git version 2.39.5" },
      { capability: "TaskPack 执行", status: "pass", path: process.execPath, version: process.version }
    ],
    probeStatus: "healthy",
    probeSummary: "本地工作区可写，Git 与任务执行能力可用。",
    currentRunId: "run-1",
    lastHeartbeat: minutesAgoIso(0),
    lastProbeAt: minutesAgoIso(1)
  },
  {
    id: "runner-browser-qa",
    name: "浏览器验证执行器",
    status: "blocked",
    summary: "负责 Playwright 主流程回归与失败截图采集。",
    workspacePath: sampleWorkspacePath("retail-support"),
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
    probeSummary: "浏览器回归链不完整，Playwright 能力待修复。",
    currentRunId: "run-2",
    lastHeartbeat: minutesAgoIso(2),
    lastProbeAt: minutesAgoIso(3)
  },
  {
    id: "runner-reviewer",
    name: "代码评审执行器",
    status: "idle",
    summary: "负责 Patch 规则审查、Demo 评审和 QA 交接前校验。",
    workspacePath: sampleWorkspacePath("retail-support"),
    capabilities: ["规则审查", "补丁评审", "QA 移交"],
    detectedCapabilities: ["规则审查", "补丁评审", "QA 移交"],
    detectedCapabilityDetails: [
      { capability: "Git", status: "pass", path: "/usr/bin/git", version: "git version 2.39.5" }
    ],
    probeStatus: "healthy",
    probeSummary: "审查链路可用，可在 QA 前完成补丁与 Demo 的规则审查。",
    currentRunId: null,
    lastHeartbeat: minutesAgoIso(1),
    lastProbeAt: minutesAgoIso(2)
  },
  {
    id: "runner-release-helper",
    name: "交付编排执行器",
    status: "idle",
    summary: "负责构建产物整理、交付说明生成和归档。",
    workspacePath: sampleWorkspacePath("ops-briefing"),
    capabilities: ["构建整理", "发布说明", "归档"],
    detectedCapabilities: ["构建整理", "发布说明", "归档"],
    detectedCapabilityDetails: [
      { capability: "文件写入", status: "pass", path: "/tmp/forge/ops-briefing", version: null }
    ],
    probeStatus: "healthy",
    probeSummary: "交付编排能力正常，可整理产物并归档。",
    currentRunId: null,
    lastHeartbeat: minutesAgoIso(1),
    lastProbeAt: minutesAgoIso(2)
  }
];
