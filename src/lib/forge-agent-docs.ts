import { getForgeAgentDisplayLabel } from "../../packages/core/src/agent-display";
import type { ForgeAgent, ForgeDashboardSnapshot } from "../../packages/core/src/types";

export type ForgeAgentDocSection = "basic" | "ability" | "runtime";

const roleLabelMap: Record<ForgeAgent["role"], string> = {
  pm: "产品负责人",
  architect: "架构负责人",
  design: "设计负责人",
  engineer: "工程执行员",
  qa: "测试负责人",
  release: "放行负责人",
  knowledge: "知识沉淀员"
};

const roleMissionMap: Record<ForgeAgent["role"], string> = {
  pm: "把原始客户诉求收口成可执行的需求定义、验收标准和优先级判断。",
  architect: "把需求拆成结构清晰的方案、原型和技术边界，保证后续设计研发能顺畅接手。",
  design: "把方案转成统一、可交付的界面设计和组件约束，减少返工和风格漂移。",
  engineer: "把任务包落成稳定可运行的实现结果，并对核心链路和边界行为负责。",
  qa: "用验证、回归和问题分诊把交付风险收口，确保结果在上线前足够可信。",
  release: "判断项目是否达到发布门槛，整理上线说明和放行结论，完成最终交付。",
  knowledge: "把项目中的经验、模板、复盘和规范沉淀下来，供后续团队和 AI 调用。"
};

const roleCriticalRulesMap: Record<ForgeAgent["role"], string[]> = {
  pm: [
    "不要在需求未澄清前推进到后续节点。",
    "不要跳过验收标准和边界条件定义。",
    "不要把模糊需求直接交给下游执行。"
  ],
  architect: [
    "不要在方案边界不清时输出原型或技术拆解。",
    "不要跳过约束条件和异常流。",
    "不要用实现细节替代方案表达。"
  ],
  design: [
    "不要输出与组件体系不一致的设计。",
    "不要忽略关键状态、异常态和空状态。",
    "不要在交互未确认时擅自扩展页面范围。"
  ],
  engineer: [
    "不要跳过回归验证直接提交交付结果。",
    "不要在需求和设计未定稿时擅自扩展实现范围。",
    "不要引入未经授权的高风险依赖。"
  ],
  qa: [
    "不要在关键链路未验证完成时给出放行建议。",
    "不要把问题描述成抽象结论，必须给复现路径。",
    "不要忽略失败用例和边界场景。"
  ],
  release: [
    "不要在交付物不完整时推进放行。",
    "不要跳过回滚方案和上线风险说明。",
    "不要在责任边界不清时给出最终结论。"
  ],
  knowledge: [
    "不要把未经验证的经验沉淀为标准模板。",
    "不要遗漏失败原因和改进建议。",
    "不要只归档结果，不归档方法和上下文。"
  ]
};

const roleDeliverablesMap: Record<ForgeAgent["role"], string[]> = {
  pm: ["结构化 PRD", "验收标准清单", "范围与优先级结论"],
  architect: ["方案说明", "原型结构", "技术边界与任务拆解"],
  design: ["关键页面设计稿", "组件约束说明", "状态与交互规范"],
  engineer: ["实现结果摘要", "关键接口/模块说明", "联调与交付记录"],
  qa: ["测试记录", "问题分诊结果", "回归验证结论"],
  release: ["放行结论", "发布说明", "部署与交付确认"],
  knowledge: ["复盘摘要", "知识卡片", "模板与规范沉淀"]
};

const roleWorkflowMap: Record<ForgeAgent["role"], string[]> = {
  pm: ["接收客户诉求", "澄清范围与目标", "输出 PRD", "交接给架构负责人"],
  architect: ["读取 PRD", "定义结构与边界", "产出原型与方案", "交接给设计负责人"],
  design: ["读取方案与原型", "产出页面与组件规范", "补齐交互状态", "交接给工程执行员"],
  engineer: ["读取设计与任务包", "完成实现", "整理结果说明", "交接给测试负责人"],
  qa: ["读取实现结果", "执行验证与回归", "输出问题与结论", "交接给放行负责人"],
  release: ["核对交付物", "确认门禁与风险", "形成放行意见", "进入发布完成态"],
  knowledge: ["收集项目结果", "整理复盘", "沉淀模板和规范", "归档到资料库"]
};

const permissionLevelLabelMap: Record<string, string> = {
  "perm-observer": "L1",
  "perm-collaborator": "L2",
  "perm-executor": "L3",
  "perm-manager": "L4"
};

const ownerModeLabelMap: Record<ForgeAgent["ownerMode"], string> = {
  "human-approved": "人工确认",
  "review-required": "复核后执行",
  "auto-execute": "自动执行"
};

function getDepartmentLabel(agent: ForgeAgent) {
  return agent.departmentLabel?.trim() || "未分配部门";
}

function getRoleLabel(role: ForgeAgent["role"]) {
  return roleLabelMap[role] ?? role;
}

function getPermissionLevelLabel(permissionProfileId: string) {
  return permissionLevelLabelMap[permissionProfileId] ?? "L1";
}

function getRunnerLabel(snapshot: ForgeDashboardSnapshot, runnerId: string) {
  return snapshot.runners.find((runner) => runner.id === runnerId)?.name ?? "未配置执行器";
}

function getPromptTemplateLabel(snapshot: ForgeDashboardSnapshot, promptTemplateId: string) {
  return (
    snapshot.promptTemplates.find((prompt) => prompt.id === promptTemplateId)?.title ??
    "未绑定 Prompt 模板"
  );
}

function getSkillNames(snapshot: ForgeDashboardSnapshot, skillIds: string[]) {
  return skillIds
    .map((skillId) => snapshot.skills.find((skill) => skill.id === skillId)?.name)
    .filter((item): item is string => Boolean(item));
}

function getActiveProjectLabel(snapshot: ForgeDashboardSnapshot) {
  return (
    snapshot.projects.find((project) => project.id === snapshot.activeProjectId)?.name ??
    snapshot.projects[0]?.name ??
    "未绑定项目"
  );
}

export function buildForgeAgentMarkdown(
  snapshot: ForgeDashboardSnapshot,
  agent: ForgeAgent,
  section: ForgeAgentDocSection = "ability"
) {
  const roleLabel = getRoleLabel(agent.role);
  const departmentLabel = getDepartmentLabel(agent);
  const runnerLabel = getRunnerLabel(snapshot, agent.runnerId);
  const promptTemplateLabel = getPromptTemplateLabel(snapshot, agent.promptTemplateId);
  const skillNames = getSkillNames(snapshot, agent.skillIds);
  const activeProjectLabel = getActiveProjectLabel(snapshot);
  const permissionLevelLabel = getPermissionLevelLabel(agent.permissionProfileId);
  const displayName = getForgeAgentDisplayLabel(agent);
  const focusLabelMap: Record<ForgeAgentDocSection, string> = {
    basic: "基础档案",
    ability: "能力配置",
    runtime: "运行配置"
  };

  return `---
name: ${displayName}
role: ${roleLabel}
department: ${departmentLabel}
permission_level: ${permissionLevelLabel}
focus: ${focusLabelMap[section]}
---

# ${displayName}

## Identity
- 角色：${roleLabel}
- 部门：${departmentLabel}
- 当前项目：${activeProjectLabel}
- 权限等级：${permissionLevelLabel}

## Persona
${agent.persona || "未配置人格设定"}

## Core Mission
${roleMissionMap[agent.role]}

## Responsibilities
${agent.responsibilities.map((item) => `- ${item}`).join("\n")}

## Workflow
${roleWorkflowMap[agent.role].map((item, index) => `${index + 1}. ${item}`).join("\n")}

## Prompt & Skills
- Prompt 模板：${promptTemplateLabel}
- 默认提示词：${agent.systemPrompt || "未配置默认提示词"}
- 技能：${
    skillNames.length > 0 ? skillNames.map((item) => `\`${item}\``).join("、") : "未绑定技能"
  }

## Knowledge Sources
${(agent.knowledgeSources.length > 0 ? agent.knowledgeSources : ["未配置知识来源"])
  .map((item) => `- ${item}`)
  .join("\n")}

## Critical Rules
${roleCriticalRulesMap[agent.role].map((item) => `- ${item}`).join("\n")}

## Deliverables
${roleDeliverablesMap[agent.role].map((item) => `- ${item}`).join("\n")}

## Runtime
- 执行器：${runnerLabel}
- 执行方式：${ownerModeLabelMap[agent.ownerMode] ?? agent.ownerMode}
- 权限配置：${agent.permissionProfileId || "未配置权限"}
- 治理策略：${agent.policyId || "未配置治理策略"}
`;
}
