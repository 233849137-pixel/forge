import type {
  ForgeAgent,
  ForgeEquippedPackRef,
  ForgeOrgChartMember,
  ForgeTeamTemplate
} from "../../packages/core/src/types";

export const defaultTeamWorkbenchDepartmentOrder = [
  "项目管理",
  "产品与方案",
  "技术研发",
  "运营支持"
] as const;

export const defaultTeamWorkbenchDepartmentByRole: Record<ForgeAgent["role"], string> = {
  pm: "项目管理",
  architect: "产品与方案",
  design: "产品与方案",
  engineer: "技术研发",
  qa: "技术研发",
  release: "技术研发",
  knowledge: "运营支持"
};

const legacyDepartmentLabelMap: Record<string, string> = {
  管理层: "项目管理"
};

export function normalizeTeamWorkbenchDepartmentLabel(label: string | null | undefined) {
  if (!label) {
    return label ?? "";
  }

  return legacyDepartmentLabelMap[label] ?? label;
}

export function getDefaultTeamWorkbenchDepartmentForAgent(
  agent: Pick<ForgeAgent, "id" | "role">
) {
  if (agent.id === "agent-pm" || agent.id === "agent-discovery") {
    return "产品与方案";
  }

  return defaultTeamWorkbenchDepartmentByRole[agent.role];
}

export function resolveTeamWorkbenchDepartmentLabel(
  agent: Pick<ForgeAgent, "id" | "role"> & { departmentLabel?: string | null }
) {
  if (agent.id === "agent-pm" || agent.id === "agent-discovery") {
    return "产品与方案";
  }

  if (agent.departmentLabel) {
    return normalizeTeamWorkbenchDepartmentLabel(agent.departmentLabel);
  }

  return getDefaultTeamWorkbenchDepartmentForAgent(agent);
}

export const defaultTeamWorkbenchRoleAssignments: Record<ForgeAgent["role"], string | null> = {
  pm: "agent-service-strategy",
  architect: "agent-architect",
  design: "agent-ux",
  engineer: "agent-engineer",
  qa: "agent-qa-automation",
  release: "agent-release",
  knowledge: "agent-knowledge-ops"
};

export const defaultTeamWorkbenchManagedAgentIds = [
  "agent-service-strategy",
  "agent-discovery",
  "agent-architect",
  "agent-solution-architect",
  "agent-ux",
  "agent-ux-research",
  "agent-engineer",
  "agent-frontend",
  "agent-backend-integration",
  "agent-qa-automation",
  "agent-security-gate",
  "agent-release",
  "agent-delivery-ops",
  "agent-knowledge-ops",
  "agent-asset-curator"
] as const;

export const defaultTeamWorkbenchAgentOrder = [...defaultTeamWorkbenchManagedAgentIds] as const;

const defaultTeamWorkbenchAgentOrderIndex = new Map<string, number>(
  defaultTeamWorkbenchAgentOrder.map((id, index) => [id, index])
);

export function sortTeamWorkbenchAgents<T extends Pick<ForgeAgent, "id" | "departmentLabel" | "name">>(
  agents: T[]
) {
  return [...agents].sort((left, right) => {
    const leftIndex = defaultTeamWorkbenchAgentOrderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = defaultTeamWorkbenchAgentOrderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    if (left.departmentLabel !== right.departmentLabel) {
      return defaultTeamWorkbenchDepartmentOrder.indexOf(
        normalizeTeamWorkbenchDepartmentLabel(
          left.departmentLabel
        ) as (typeof defaultTeamWorkbenchDepartmentOrder)[number]
      ) -
        defaultTeamWorkbenchDepartmentOrder.indexOf(
          normalizeTeamWorkbenchDepartmentLabel(
            right.departmentLabel
          ) as (typeof defaultTeamWorkbenchDepartmentOrder)[number]
        );
    }

    return left.name.localeCompare(right.name, "zh-Hans-CN");
  });
}

export function sortTeamWorkbenchOrgMembers(members: ForgeOrgChartMember[]) {
  return [...members].sort((left, right) => {
    const leftIndex = defaultTeamWorkbenchAgentOrderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = defaultTeamWorkbenchAgentOrderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER;

    if (left.departmentLabel !== right.departmentLabel) {
      return defaultTeamWorkbenchDepartmentOrder.indexOf(
        normalizeTeamWorkbenchDepartmentLabel(
          left.departmentLabel
        ) as (typeof defaultTeamWorkbenchDepartmentOrder)[number]
      ) -
        defaultTeamWorkbenchDepartmentOrder.indexOf(
          normalizeTeamWorkbenchDepartmentLabel(
            right.departmentLabel
          ) as (typeof defaultTeamWorkbenchDepartmentOrder)[number]
        );
    }

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.name.localeCompare(right.name, "zh-Hans-CN");
  });
}

export const defaultTeamWorkbenchPackRefsByRole: Record<ForgeAgent["role"], ForgeEquippedPackRef[]> = {
  pm: [{ source: "preset", id: "pack-AI智能" }],
  architect: [{ source: "preset", id: "pack-开发工具" }],
  design: [{ source: "preset", id: "pack-内容创作" }],
  engineer: [{ source: "preset", id: "pack-开发工具" }],
  qa: [
    { source: "preset", id: "pack-开发工具" },
    { source: "preset", id: "pack-安全合规" }
  ],
  release: [{ source: "preset", id: "pack-通讯协作" }],
  knowledge: [
    { source: "preset", id: "pack-数据分析" },
    { source: "preset", id: "pack-效率提升" }
  ]
};

export const defaultTeamWorkbenchPrimaryAgentId = defaultTeamWorkbenchRoleAssignments.pm;

export const defaultTeamWorkbenchSelectedTemplateId = "team-standard-delivery" as const;

export const defaultTeamWorkbenchTemplates: ForgeTeamTemplate[] = [
  {
    id: "team-standard-delivery",
    name: "标准交付团队",
    summary: "覆盖需求洞察、方案统筹、设计、研发、测试、交付和沉淀的完整扩编团队。",
    agentIds: [
      "agent-service-strategy",
      "agent-discovery",
      "agent-architect",
      "agent-solution-architect",
      "agent-ux",
      "agent-ux-research",
      "agent-engineer",
      "agent-frontend",
      "agent-backend-integration",
      "agent-qa-automation",
      "agent-security-gate",
      "agent-release",
      "agent-delivery-ops",
      "agent-knowledge-ops",
      "agent-asset-curator"
    ],
    leadAgentId: "agent-service-strategy"
  },
  {
    id: "team-lean-validation",
    name: "最小验证团队",
    summary: "保留需求收口、核心研发、门禁验证和交付主链，适合快速验证 DEMO。",
    agentIds: [
      "agent-service-strategy",
      "agent-discovery",
      "agent-engineer",
      "agent-frontend",
      "agent-backend-integration",
      "agent-qa-automation",
      "agent-release",
      "agent-knowledge-ops"
    ],
    leadAgentId: "agent-service-strategy"
  },
  {
    id: "team-design-sprint",
    name: "设计冲刺团队",
    summary: "以需求、方案、体验研究和前端落地为主，适合快速出方案和界面。",
    agentIds: [
      "agent-service-strategy",
      "agent-discovery",
      "agent-architect",
      "agent-solution-architect",
      "agent-ux",
      "agent-ux-research",
      "agent-engineer",
      "agent-frontend"
    ],
    leadAgentId: "agent-service-strategy"
  }
];

export const defaultTeamWorkbenchTemplateRolesById: Record<
  ForgeTeamTemplate["id"],
  ForgeAgent["role"][]
> = {
  "team-standard-delivery": ["pm", "architect", "design", "engineer", "qa", "knowledge", "release"],
  "team-lean-validation": ["pm", "engineer", "qa", "knowledge", "release"],
  "team-design-sprint": ["pm", "architect", "design", "engineer"]
};
