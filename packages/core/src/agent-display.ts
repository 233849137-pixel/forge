import type { ForgeAgent } from "./types";

type ForgeAgentDisplaySource = Pick<ForgeAgent, "id" | "name" | "role">;

export type ForgeAgentDisplayProfile = {
  positionName: string;
  displayName: string;
  responsibilityLabel: string;
  orgMetaLine: string;
  assignmentLabel: string;
};

type ForgeAgentDisplaySeed = {
  positionName: string;
  displayName: string;
  responsibilityLabel: string;
  aliases?: string[];
};

const roleLabelByAgentRole: Record<ForgeAgent["role"], string> = {
  pm: "产品负责人",
  architect: "架构负责人",
  design: "设计负责人",
  engineer: "工程执行员",
  qa: "测试负责人",
  release: "放行负责人",
  knowledge: "知识沉淀员"
};

const displaySeedByAgentId: Partial<Record<string, ForgeAgentDisplaySeed>> = {
  "agent-pm": {
    positionName: "产品总监",
    displayName: "Elephant",
    responsibilityLabel: "产品负责人",
    aliases: ["产品经理 Agent", "产品策略 Agent"]
  },
  "agent-service-strategy": {
    positionName: "项目经理",
    displayName: "Lion",
    responsibilityLabel: "项目负责人",
    aliases: ["项目牧羊人 Agent"]
  },
  "agent-discovery": {
    positionName: "需求分析师",
    displayName: "Fox",
    responsibilityLabel: "需求负责人",
    aliases: ["需求洞察 Agent"]
  },
  "agent-architect": {
    positionName: "技术架构师",
    displayName: "Eagle",
    responsibilityLabel: "架构负责人",
    aliases: ["架构师 Agent"]
  },
  "agent-solution-architect": {
    positionName: "解决方案架构师",
    displayName: "Wolf",
    responsibilityLabel: "方案负责人",
    aliases: ["方案统筹 Agent"]
  },
  "agent-design": {
    positionName: "UI设计师",
    displayName: "Rabbit",
    responsibilityLabel: "设计负责人",
    aliases: ["设计 Agent", "设计系统 Agent"]
  },
  "agent-ux": {
    positionName: "体验设计师",
    displayName: "Cat",
    responsibilityLabel: "体验负责人",
    aliases: ["体验架构 Agent"]
  },
  "agent-ux-research": {
    positionName: "用户研究员",
    displayName: "Deer",
    responsibilityLabel: "体验研究",
    aliases: ["体验研究 Agent"]
  },
  "agent-engineer": {
    positionName: "后端工程师",
    displayName: "Tiger",
    responsibilityLabel: "工程负责人",
    aliases: ["研发 Agent", "后端研发 Agent"]
  },
  "agent-dev": {
    positionName: "后端工程师",
    displayName: "Tiger",
    responsibilityLabel: "工程负责人",
    aliases: ["研发 Agent", "后端研发 Agent"]
  },
  "agent-frontend": {
    positionName: "前端工程师",
    displayName: "Dog",
    responsibilityLabel: "前端负责人",
    aliases: ["前端开发 Agent"]
  },
  "agent-backend-integration": {
    positionName: "集成工程师",
    displayName: "Bear",
    responsibilityLabel: "集成负责人",
    aliases: ["后端集成 Agent"]
  },
  "agent-qa": {
    positionName: "测试工程师",
    displayName: "Owl",
    responsibilityLabel: "测试负责人",
    aliases: ["测试 Agent", "测试策略 Agent"]
  },
  "agent-qa-automation": {
    positionName: "测试开发工程师",
    displayName: "Monkey",
    responsibilityLabel: "质量负责人",
    aliases: ["现实校验 Agent"]
  },
  "agent-security-gate": {
    positionName: "安全工程师",
    displayName: "Shark",
    responsibilityLabel: "安全负责人",
    aliases: ["安全门禁 Agent"]
  },
  "agent-release": {
    positionName: "发布工程师",
    displayName: "Horse",
    responsibilityLabel: "发布负责人",
    aliases: ["发布 Agent"]
  },
  "agent-delivery-ops": {
    positionName: "交付经理",
    displayName: "Dolphin",
    responsibilityLabel: "交付运营",
    aliases: ["交付运营 Agent"]
  },
  "agent-knowledge": {
    positionName: "知识运营专员",
    displayName: "Panda",
    responsibilityLabel: "知识沉淀",
    aliases: ["知识沉淀 Agent"]
  },
  "agent-knowledge-ops": {
    positionName: "流程运营专员",
    displayName: "Duck",
    responsibilityLabel: "流程沉淀",
    aliases: ["流程优化 Agent"]
  },
  "agent-asset-curator": {
    positionName: "资产运营专员",
    displayName: "Squirrel",
    responsibilityLabel: "资产沉淀",
    aliases: ["资产编目 Agent"]
  }
};

const displaySeedByAgentName = Object.values(displaySeedByAgentId)
  .filter((seed): seed is ForgeAgentDisplaySeed => Boolean(seed))
  .reduce<Record<string, ForgeAgentDisplaySeed>>((registry, seed) => {
    for (const alias of seed.aliases ?? []) {
      registry[alias] = seed;
    }

    return registry;
  }, {});

function normalizeAgentName(name: string | null | undefined) {
  return name?.replace(/\s*Agent$/i, "").trim() ?? "";
}

function resolveDisplaySeed(agent: Partial<ForgeAgentDisplaySource>) {
  return (
    (agent.id ? displaySeedByAgentId[agent.id] : undefined) ??
    (agent.name ? displaySeedByAgentName[agent.name.trim()] : undefined) ??
    undefined
  );
}

export function getForgeAgentDisplayProfile(agent: Partial<ForgeAgentDisplaySource>): ForgeAgentDisplayProfile {
  const displaySeed = resolveDisplaySeed(agent);
  const normalizedName = normalizeAgentName(agent.name);
  const positionName =
    displaySeed?.positionName ||
    normalizedName ||
    (agent.role ? roleLabelByAgentRole[agent.role] : "") ||
    "AI员工";
  const displayName = displaySeed?.displayName || normalizedName || positionName;
  const responsibilityLabel =
    displaySeed?.responsibilityLabel ||
    (agent.role ? roleLabelByAgentRole[agent.role] : "") ||
    positionName;

  return {
    positionName,
    displayName,
    responsibilityLabel,
    orgMetaLine: `${responsibilityLabel} · ${displayName}`,
    assignmentLabel: `${positionName} · ${displayName}`
  };
}

export function getForgeAgentDisplayLabel(agent: Partial<ForgeAgentDisplaySource>) {
  return getForgeAgentDisplayProfile(agent).assignmentLabel;
}
