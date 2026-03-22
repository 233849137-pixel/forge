import type {
  DeliveryGateItem,
  ForgeArtifact,
  ForgeArchiveProvenanceSummary,
  ForgeArtifactType,
  ForgeAgent,
  ForgeAgentRole,
  ForgeArtifactReview,
  ForgeCommandType,
  ForgeComponent,
  ForgeComponentUsageSignal,
  ForgeCurrentHandoffSummary,
  ForgeDashboardSnapshot,
  ForgeFormalArtifactCoverageSummary,
  ForgeFormalArtifactGapSummary,
  ForgeFormalArtifactProvenanceItem,
  ForgeFormalArtifactResponsibilitySummary,
  ForgeProject,
  ForgeProjectWorkbenchNode,
  ForgeReleaseClosureResponsibilitySummary,
  ForgeReleaseClosureSummary,
  ForgeProjectStatus,
  ForgeProjectWorkflowState,
  ForgeRun,
  ForgeRunEvent,
  ForgeTask,
  ForgeWorkflowStage
} from "./types";
import { getForgeCommandContract } from "./command-contracts";
import { getForgeAgentDisplayLabel } from "./agent-display";

const projectPriority: Record<ForgeProjectStatus, number> = {
  active: 0,
  risk: 1,
  ready: 2
};

type ProjectWorkbenchSelectorSnapshot = Pick<
  ForgeDashboardSnapshot,
  "agents" | "projectProfiles" | "teamTemplates" | "teamWorkbenchState"
>;

export function getActiveProject(projects: ForgeProject[], activeProjectId?: string | null) {
  if (activeProjectId) {
    const selectedProject = projects.find((project) => project.id === activeProjectId);

    if (selectedProject) {
      return selectedProject;
    }
  }

  return [...projects].sort(
    (left, right) => projectPriority[left.status] - projectPriority[right.status]
  )[0];
}

export function getDeliveryStateLabel(gates: DeliveryGateItem[]) {
  if (gates.some((gate) => gate.status === "fail")) {
    return "已阻塞";
  }

  if (gates.some((gate) => gate.status === "pending")) {
    return "待确认";
  }

  return "可交付";
}

export const workflowStages = [
  "项目接入",
  "方案与任务包",
  "开发执行",
  "测试验证",
  "交付发布",
  "归档复用"
] as const satisfies readonly ForgeWorkflowStage[];

export type WorkflowStage = ForgeWorkflowStage;

export const projectWorkbenchNodes = [
  "需求确认",
  "项目原型",
  "UI设计",
  "后端研发",
  "DEMO测试",
  "内测调优",
  "交付发布"
] as const satisfies readonly ForgeProjectWorkbenchNode[];

const builtInVisibleProjectWorkbenchNodesByTeamTemplateId: Partial<
  Record<string, ForgeProjectWorkbenchNode[]>
> = {
  "team-standard": [...projectWorkbenchNodes],
  "team-standard-delivery": [...projectWorkbenchNodes],
  "team-lean-validation": ["需求确认", "后端研发", "DEMO测试", "交付发布"],
  "team-design-sprint": ["需求确认", "项目原型", "UI设计", "后端研发"]
};

const workbenchNodeRoles: Record<ForgeProjectWorkbenchNode, ForgeAgentRole[]> = {
  需求确认: ["pm"],
  项目原型: ["architect"],
  UI设计: ["design"],
  后端研发: ["engineer"],
  DEMO测试: ["qa"],
  内测调优: ["knowledge", "qa"],
  交付发布: ["release", "pm"]
};

const workbenchNodeByCommandType: Record<ForgeCommandType, ForgeProjectWorkbenchNode> = {
  "prd.generate": "需求确认",
  "taskpack.generate": "项目原型",
  "component.assemble": "UI设计",
  "execution.start": "后端研发",
  "review.run": "内测调优",
  "gate.run": "DEMO测试",
  "release.prepare": "交付发布",
  "release.approve": "交付发布",
  "archive.capture": "交付发布"
};

const taskPriorityOrder: Record<ForgeTask["priority"], number> = {
  P0: 0,
  P1: 1,
  P2: 2
};

const taskStatusOrder: Record<ForgeTask["status"], number> = {
  blocked: 0,
  "in-progress": 1,
  todo: 2,
  done: 3
};

const planningArtifactTypes: ForgeArtifactType[] = [
  "prd",
  "architecture-note",
  "ui-spec",
  "task-pack"
];

const evidenceArtifactTypes: ForgeArtifactType[] = [
  "patch",
  "review-report",
  "demo-build",
  "test-report",
  "playwright-run",
  "release-brief",
  "review-decision",
  "release-audit",
  "knowledge-card"
];

const releaseRequiredArtifactTypes: ForgeArtifactType[] = [
  "patch",
  "demo-build",
  "test-report",
  "playwright-run",
  "release-brief",
  "review-decision"
];

const formalArtifactTypes = [
  "release-brief",
  "review-decision",
  "release-audit",
  "knowledge-card"
] as const satisfies readonly ForgeArtifactType[];

const preferredAgentIdsByRole: Partial<Record<ForgeAgentRole, string[]>> = {
  pm: ["agent-service-strategy", "agent-pm"],
  design: ["agent-ux", "agent-design"],
  engineer: ["agent-engineer", "agent-backend-integration", "agent-frontend"],
  qa: ["agent-qa-automation", "agent-qa"],
  knowledge: ["agent-knowledge-ops", "agent-knowledge"],
  architect: ["agent-architect"],
  release: ["agent-release"]
};

function getPreferredAgent(
  snapshot: Pick<ForgeDashboardSnapshot, "agents">,
  role: ForgeAgentRole,
  allowedAgentIds?: ReadonlySet<string> | null
) {
  const preferredIds = preferredAgentIdsByRole[role] ?? [];

  for (const agentId of preferredIds) {
    const matched = snapshot.agents.find(
      (agent) => agent.id === agentId && (!allowedAgentIds || allowedAgentIds.has(agent.id))
    );

    if (matched) {
      return matched;
    }
  }

  return (
    snapshot.agents.find(
      (agent) => agent.role === role && (!allowedAgentIds || allowedAgentIds.has(agent.id))
    ) ?? null
  );
}

function getProjectAllowedAgentIds(
  snapshot: ProjectWorkbenchSelectorSnapshot,
  projectId: string | null | undefined
) {
  const teamTemplateId = snapshot.projectProfiles.find((item) => item.projectId === projectId)?.teamTemplateId;
  const teamTemplate = teamTemplateId
    ? snapshot.teamTemplates.find((item) => item.id === teamTemplateId) ?? null
    : null;

  return teamTemplate && teamTemplate.agentIds.length > 0 ? new Set(teamTemplate.agentIds) : null;
}

function getExplicitRoleAssignedAgent(
  snapshot: ProjectWorkbenchSelectorSnapshot,
  role: ForgeAgentRole
) {
  const assignedAgentId = snapshot.teamWorkbenchState?.roleAssignments?.[role];

  if (!assignedAgentId) {
    return null;
  }

  return snapshot.agents.find((agent) => agent.id === assignedAgentId) ?? null;
}

export function getProjectAgentByRoles(
  snapshot: ProjectWorkbenchSelectorSnapshot,
  projectId: string | null | undefined,
  roles: ForgeAgentRole | ForgeAgentRole[]
) {
  const normalizedRoles = Array.isArray(roles) ? roles : [roles];
  const allowedAgentIds = getProjectAllowedAgentIds(snapshot, projectId);

  for (const role of normalizedRoles) {
    const explicitAssignment = getExplicitRoleAssignedAgent(snapshot, role);

    if (explicitAssignment) {
      return explicitAssignment;
    }
  }

  for (const role of normalizedRoles) {
    const scopedAgent = getPreferredAgent(snapshot, role, allowedAgentIds);

    if (scopedAgent) {
      return scopedAgent;
    }
  }

  for (const role of normalizedRoles) {
    const fallbackAgent = getPreferredAgent(snapshot, role);

    if (fallbackAgent) {
      return fallbackAgent;
    }
  }

  return null;
}

export function getProjectAgentIdByRoles(
  snapshot: ProjectWorkbenchSelectorSnapshot,
  projectId: string | null | undefined,
  roles: ForgeAgentRole | ForgeAgentRole[],
  fallbackAgentId?: string | null
) {
  return getProjectAgentByRoles(snapshot, projectId, roles)?.id ?? fallbackAgentId ?? null;
}

export function isProjectWorkbenchNode(
  value: string | null | undefined
): value is ForgeProjectWorkbenchNode {
  return Boolean(value && (projectWorkbenchNodes as readonly string[]).includes(value));
}

export function getProjectWorkbenchNodeForCommandType(commandType: ForgeCommandType) {
  return workbenchNodeByCommandType[commandType] ?? null;
}

export function getVisibleProjectWorkbenchNodes(
  snapshot: ProjectWorkbenchSelectorSnapshot,
  projectId: string | null | undefined
) {
  const teamTemplateId = snapshot.projectProfiles.find((item) => item.projectId === projectId)?.teamTemplateId;

  if (!teamTemplateId) {
    return [...projectWorkbenchNodes];
  }

  const builtInNodes = builtInVisibleProjectWorkbenchNodesByTeamTemplateId[teamTemplateId];
  if (builtInNodes && builtInNodes.length > 0) {
    return [...builtInNodes];
  }

  const teamTemplate = snapshot.teamTemplates.find((item) => item.id === teamTemplateId);
  if (!teamTemplate) {
    return [...projectWorkbenchNodes];
  }

  const allowedAgentIds = new Set(teamTemplate.agentIds);
  const derivedNodes = projectWorkbenchNodes.filter((node) =>
    workbenchNodeRoles[node].some((role) =>
      snapshot.agents.some((agent) => allowedAgentIds.has(agent.id) && agent.role === role)
    )
  );

  return derivedNodes.length > 0 ? derivedNodes : [...projectWorkbenchNodes];
}

export function getProjectWorkbenchAgent(
  snapshot: ProjectWorkbenchSelectorSnapshot,
  projectId: string | null | undefined,
  node: ForgeProjectWorkbenchNode
) {
  return getProjectAgentByRoles(snapshot, projectId, workbenchNodeRoles[node]);
}

export function getProjectWorkbenchAgentForCommand(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined,
  commandType: ForgeCommandType
) {
  const node = getProjectWorkbenchNodeForCommandType(commandType);

  return node ? getProjectWorkbenchAgent(snapshot, projectId, node) : null;
}

function isFormalArtifactType(
  artifactType: ForgeArtifactType | null | undefined
): artifactType is (typeof formalArtifactTypes)[number] {
  return Boolean(
    artifactType &&
      (formalArtifactTypes as readonly ForgeArtifactType[]).includes(artifactType)
  );
}

const artifactTypeLabels: Record<ForgeArtifactType, string> = {
  prd: "PRD",
  "architecture-note": "架构说明",
  "ui-spec": "原型与交互规范",
  "task-pack": "TaskPack",
  "assembly-plan": "组件装配清单",
  patch: "补丁",
  "review-report": "规则审查记录",
  "demo-build": "Demo 构建",
  "test-report": "测试报告",
  "playwright-run": "Playwright 回归记录",
  "review-decision": "放行评审结论",
  "release-brief": "交付说明",
  "release-audit": "归档审计记录",
  "knowledge-card": "知识卡"
};

const commandLabelFallbackMap: Record<string, string> = {
  "command-prd-generate": "生成 PRD 草案",
  "command-taskpack-generate": "生成 TaskPack",
  "command-component-assemble": "装配交付组件",
  "command-execution-start": "启动研发执行",
  "command-review-run": "发起规则审查",
  "command-gate-run": "发起测试门禁",
  "command-release-prepare": "整理交付说明",
  "command-release-approve": "人工确认放行",
  "command-archive-capture": "触发归档沉淀"
};

const artifactStatusLabels: Record<ForgeArtifact["status"], string> = {
  draft: "草稿",
  "in-review": "评审中",
  ready: "已就绪"
};

const artifactReviewDecisionLabel: Record<ForgeArtifactReview["decision"], string> = {
  pass: "已通过",
  "changes-requested": "需修改",
  pending: "待确认"
};

const agentRoleLabel: Record<ForgeAgentRole, string> = {
  pm: "产品经理",
  architect: "架构师",
  design: "设计",
  engineer: "研发",
  qa: "测试",
  release: "发布",
  knowledge: "知识沉淀"
};

function getApprovalBreachLabel(options: {
  escalated: boolean;
  decision?: ForgeArtifactReview["decision"] | null;
  statusLabel?: string;
}) {
  if (options.escalated || options.decision === "changes-requested") {
    return "已违约";
  }

  if (options.decision === "pending" || options.statusLabel === "待形成" || options.statusLabel === "评审中") {
    return "临近 SLA";
  }

  return "正常";
}

const stageRequiredArtifacts: Record<WorkflowStage, ForgeArtifactType[]> = {
  项目接入: [],
  "方案与任务包": planningArtifactTypes,
  开发执行: [...planningArtifactTypes, "demo-build"],
  测试验证: [...planningArtifactTypes, "demo-build", "review-report", "test-report"],
  交付发布: [...planningArtifactTypes, "demo-build", "review-report", "test-report", "release-brief"],
  归档复用: [
    ...planningArtifactTypes,
    "demo-build",
    "review-report",
    "test-report",
    "release-brief",
    "knowledge-card"
  ]
};

const artifactNextRoleMap: Record<ForgeArtifactType, ForgeAgentRole[]> = {
  prd: ["design", "architect"],
  "architecture-note": ["engineer"],
  "ui-spec": ["engineer"],
  "task-pack": ["engineer"],
  "assembly-plan": ["engineer"],
  patch: ["qa"],
  "review-report": ["qa"],
  "demo-build": ["qa"],
  "test-report": ["release"],
  "playwright-run": ["release"],
  "review-decision": ["knowledge"],
  "release-brief": ["knowledge"],
  "release-audit": ["knowledge"],
  "knowledge-card": []
};

const artifactReviewerRoleMap: Record<ForgeArtifactType, ForgeAgentRole[]> = {
  prd: ["architect", "design"],
  "architecture-note": ["pm"],
  "ui-spec": ["pm"],
  "task-pack": ["engineer"],
  "assembly-plan": ["architect"],
  patch: ["qa"],
  "review-report": ["qa"],
  "demo-build": ["qa"],
  "test-report": ["release"],
  "playwright-run": ["release"],
  "review-decision": ["pm"],
  "release-brief": ["knowledge"],
  "release-audit": ["pm"],
  "knowledge-card": ["pm"]
};

const artifactEscalationRoleMap: Record<ForgeArtifactType, ForgeAgentRole[]> = {
  prd: ["pm"],
  "architecture-note": ["pm"],
  "ui-spec": ["pm"],
  "task-pack": ["pm"],
  "assembly-plan": ["architect", "pm"],
  patch: ["qa", "pm"],
  "review-report": ["qa", "pm"],
  "demo-build": ["qa", "pm"],
  "test-report": ["release", "pm"],
  "playwright-run": ["qa", "pm"],
  "review-decision": ["release", "pm"],
  "release-brief": ["release", "pm"],
  "release-audit": ["knowledge", "pm"],
  "knowledge-card": ["knowledge", "pm"]
};

const artifactSlaLabelMap: Record<ForgeArtifactType, string> = {
  prd: "SLA 4 小时",
  "architecture-note": "SLA 6 小时",
  "ui-spec": "SLA 6 小时",
  "task-pack": "SLA 4 小时",
  "assembly-plan": "SLA 2 小时",
  patch: "SLA 2 小时",
  "review-report": "SLA 2 小时",
  "demo-build": "SLA 2 小时",
  "test-report": "SLA 2 小时",
  "playwright-run": "SLA 2 小时",
  "review-decision": "SLA 4 小时",
  "release-brief": "SLA 4 小时",
  "release-audit": "SLA 4 小时",
  "knowledge-card": "SLA 8 小时"
};

const componentCategoryKeywords: Record<ForgeComponent["category"], string[]> = {
  auth: ["登录", "鉴权", "账号", "验证码", "会话"],
  payment: ["支付", "退款", "结算", "订单", "回调"],
  file: ["上传", "下载", "附件", "导入", "导出", "文件"],
  data: ["列表", "表单", "图表", "数据", "报表"],
  communication: ["对话", "聊天", "消息", "客服", "转人工", "会话"]
};

export function getProjectArtifacts(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  if (!projectId) {
    return [];
  }

  return snapshot.artifacts.filter((artifact) => artifact.projectId === projectId);
}

function matchesRecommendedSector(input: string, recommendedSectors: string[]) {
  const normalizedInput = input.trim().toLowerCase();

  if (!normalizedInput) {
    return true;
  }

  return recommendedSectors.some((sector) => {
    const normalizedSector = sector.trim().toLowerCase();
    return normalizedInput.includes(normalizedSector) || normalizedSector.includes(normalizedInput);
  });
}

function resolveProjectTaskPack(
  snapshot: ForgeDashboardSnapshot,
  projectId?: string | null,
  taskPackId?: string | null
) {
  if (!projectId) {
    return null;
  }

  const projectTaskPacks = snapshot.artifacts.filter(
    (artifact) => artifact.projectId === projectId && artifact.type === "task-pack"
  );

  if (taskPackId?.trim()) {
    return projectTaskPacks.find((artifact) => artifact.id === taskPackId.trim()) ?? null;
  }

  return projectTaskPacks.find((artifact) => artifact.status === "ready") ?? projectTaskPacks[0] ?? null;
}

export function getTaskPackAssemblySuggestions(
  snapshot: ForgeDashboardSnapshot,
  projectId?: string | null,
  taskPackId?: string | null
) {
  const project = projectId
    ? snapshot.projects.find((item) => item.id === projectId) ?? null
    : getActiveProject(snapshot.projects, snapshot.activeProjectId);
  const taskPack = resolveProjectTaskPack(snapshot, project?.id, taskPackId);
  const contextText = [project?.name, project?.sector, taskPack?.title].filter(Boolean).join(" ").toLowerCase();

  const items = snapshot.components
    .map((component) => {
      const matchedTags = component.tags.filter((tag) => contextText.includes(tag.toLowerCase()));
      const matchedCategoryKeywords = componentCategoryKeywords[component.category].filter((keyword) =>
        contextText.includes(keyword.toLowerCase())
      );
      const sectorMatched = project ? matchesRecommendedSector(project.sector, component.recommendedSectors) : false;
      const keywordScore = matchedCategoryKeywords.filter((keyword) => !matchedTags.includes(keyword)).length;
      const score = matchedTags.length * 3 + keywordScore * 2 + (sectorMatched ? 1 : 0);

      if (score === 0) {
        return null;
      }

      const reasons: string[] = [];

      if (matchedTags.length > 0) {
        reasons.push(`TaskPack 命中标签：${matchedTags.join(" / ")}`);
      } else if (matchedCategoryKeywords.length > 0) {
        reasons.push(`TaskPack 命中能力：${matchedCategoryKeywords.join(" / ")}`);
      }

      if (sectorMatched) {
        reasons.push(`项目场景匹配：${component.recommendedSectors.join(" / ")}`);
      }

      return {
        component,
        score,
        reason: reasons.join(" · "),
        matchedKeywords: [...matchedTags, ...matchedCategoryKeywords]
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.component.title.localeCompare(right.component.title, "zh-Hans-CN");
    });

  return {
    project,
    taskPack,
    items
  };
}

function getComponentUsageSignalStatus(input: {
  linked: boolean;
  blockedCount: number;
  runningCount: number;
  successCount: number;
}): ForgeComponentUsageSignal["status"] {
  if (input.blockedCount > 0) {
    return "blocked";
  }

  if (input.runningCount > 0) {
    return "running";
  }

  if (input.successCount > 0) {
    return "verified";
  }

  if (input.linked) {
    return "linked";
  }

  return "unlinked";
}

function getComponentUsageStatusLabel(status: ForgeComponentUsageSignal["status"]) {
  switch (status) {
    case "blocked":
      return "最近阻塞";
    case "running":
      return "执行中";
    case "verified":
      return "已验证";
    case "linked":
      return "已装配待验证";
    default:
      return "未接入";
  }
}

export function getComponentUsageSignals(
  snapshot: ForgeDashboardSnapshot,
  projectId?: string | null
) {
  if (!projectId) {
    return [];
  }

  const linkedComponentIdSet = new Set(
    snapshot.projectAssetLinks
      .filter((link) => link.projectId === projectId && link.targetType === "component")
      .map((link) => link.targetId)
  );

  return snapshot.components
    .map((component) => {
      const matchingRuns = snapshot.runs.filter(
        (run) =>
          run.projectId === projectId && (run.linkedComponentIds ?? []).includes(component.id)
      );
      const lastRun = matchingRuns.at(-1) ?? null;
      const lastFailure = lastRun
        ? [...snapshot.runEvents]
            .reverse()
            .find((event) => event.runId === lastRun.id && event.type === "failure") ?? null
        : null;
      const usageCount = matchingRuns.length;
      const successCount = matchingRuns.filter((run) => run.state === "done").length;
      const blockedCount = matchingRuns.filter((run) => run.state === "blocked").length;
      const runningCount = matchingRuns.filter((run) => run.state === "running").length;
      const linked = linkedComponentIdSet.has(component.id);
      const status = getComponentUsageSignalStatus({
        linked,
        blockedCount,
        runningCount,
        successCount
      });

      return {
        component,
        projectId,
        linked,
        usageCount,
        successCount,
        blockedCount,
        runningCount,
        lastRunId: lastRun?.id ?? null,
        lastRunTitle: lastRun?.title ?? null,
        lastRunState: lastRun?.state ?? null,
        lastFailureSummary: lastFailure?.summary ?? null,
        status,
        statusLabel: getComponentUsageStatusLabel(status)
      };
    })
    .filter((signal) => signal.linked || signal.usageCount > 0)
    .sort((left, right) => {
      if (left.blockedCount !== right.blockedCount) {
        return right.blockedCount - left.blockedCount;
      }

      if (left.runningCount !== right.runningCount) {
        return right.runningCount - left.runningCount;
      }

      if (left.successCount !== right.successCount) {
        return right.successCount - left.successCount;
      }

      if (left.usageCount !== right.usageCount) {
        return right.usageCount - left.usageCount;
      }

      if (left.linked !== right.linked) {
        return left.linked ? -1 : 1;
      }

      return left.component.title.localeCompare(right.component.title, "zh-Hans-CN");
    });
}

function getReadyArtifactTypes(artifacts: ForgeArtifact[]) {
  return new Set(
    artifacts.filter((artifact) => artifact.status === "ready").map((artifact) => artifact.type)
  );
}

function hasPlanningArtifacts(artifacts: ForgeArtifact[]) {
  const readyTypes = getReadyArtifactTypes(artifacts);

  return planningArtifactTypes.every((type) => readyTypes.has(type));
}

function hasDeliveryCandidate(artifacts: ForgeArtifact[]) {
  return artifacts.some(
    (artifact) =>
      (artifact.type === "demo-build" || artifact.type === "patch") && artifact.status !== "draft"
  );
}

function hasReadyArtifactType(artifacts: ForgeArtifact[], type: ForgeArtifactType) {
  return artifacts.some((artifact) => artifact.type === type && artifact.status === "ready");
}

function getPersistedWorkflowState(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
): ForgeProjectWorkflowState | null {
  if (!projectId) {
    return null;
  }

  return snapshot.workflowStates.find((item) => item.projectId === projectId) ?? null;
}

export function getProjectWorkflowStage(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
): WorkflowStage {
  const persisted = getPersistedWorkflowState(snapshot, projectId);

  if (persisted) {
    return persisted.currentStage;
  }

  if (!projectId) {
    return "项目接入";
  }

  const projectProfile = snapshot.projectProfiles.find((profile) => profile.projectId === projectId);

  if (!projectProfile) {
    return "项目接入";
  }

  const artifacts = getProjectArtifacts(snapshot, projectId);

  if (!hasPlanningArtifacts(artifacts)) {
    return "方案与任务包";
  }

  if (!hasDeliveryCandidate(artifacts)) {
    return "开发执行";
  }

  const deliveryState = getDeliveryStateLabel(snapshot.deliveryGate);

  if (!hasReadyArtifactType(artifacts, "test-report") || deliveryState !== "可交付") {
    return "测试验证";
  }

  if (!hasReadyArtifactType(artifacts, "release-brief")) {
    return "交付发布";
  }

  return "归档复用";
}

export function getProjectStageStateMachine(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const currentStage = getProjectWorkflowStage(snapshot, projectId);
  const admission = getStageAdmissionSummary(snapshot, projectId);
  const currentStageIndex = workflowStages.indexOf(currentStage);
  const persisted = getPersistedWorkflowState(snapshot, projectId);

  return workflowStages.map((stage, index) => {
    let state: "done" | "current" | "blocked" | "pending" = "pending";

    if (index < currentStageIndex) {
      state = "done";
    } else if (index === currentStageIndex) {
      if (persisted?.state === "blocked") {
        state = "blocked";
      } else {
        state = admission.isReadyToAdvance ? "current" : "blocked";
      }
    }

    return {
      stage,
      state,
      requiredArtifacts: stageRequiredArtifacts[stage].map((type) => artifactTypeLabels[type]),
      blockers: stage === currentStage ? admission.blockers : []
    };
  });
}

export function getMissingRequiredArtifacts(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const stage = getProjectWorkflowStage(snapshot, projectId);
  const readyTypes = getReadyArtifactTypes(getProjectArtifacts(snapshot, projectId));

  return stageRequiredArtifacts[stage]
    .filter((type) => !readyTypes.has(type))
    .map((type) => ({
      type,
      label: artifactTypeLabels[type]
    }));
}

function getAgentByRole(agents: ForgeAgent[], roles: ForgeAgentRole[]) {
  for (const role of roles) {
    const agent = agents.find((item) => item.role === role);

    if (agent) {
      return agent;
    }
  }

  return null;
}

function getLeadAgent(snapshot: ForgeDashboardSnapshot) {
  const leadAgentId = snapshot.teamTemplates[0]?.leadAgentId;

  if (!leadAgentId) {
    return null;
  }

  return snapshot.agents.find((agent) => agent.id === leadAgentId) ?? null;
}

export function getArtifactHandoffQueue(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const leadAgent = getLeadAgent(snapshot);

  return getProjectArtifacts(snapshot, projectId)
    .filter((artifact) => artifact.status !== "ready")
    .map((artifact) => {
      const owner = snapshot.agents.find((agent) => agent.id === artifact.ownerAgentId) ?? null;
      const nextAgent = getAgentByRole(snapshot.agents, artifactNextRoleMap[artifact.type]);
      const reviewerAgent = getAgentByRole(snapshot.agents, artifactReviewerRoleMap[artifact.type]);
      const escalationOwner =
        getAgentByRole(snapshot.agents, artifactEscalationRoleMap[artifact.type]) ?? leadAgent;
      const ownerLabel = getAgentDisplayLabelOrFallback(owner, artifact.ownerAgentId);
      const nextAgentLabel = getAgentDisplayLabelOrFallback(nextAgent, "下一角色");
      const escalationOwnerLabel = getAgentDisplayLabelOrFallback(
        escalationOwner,
        "项目负责人"
      );
      const action =
        artifact.status === "draft"
          ? `当前由 ${ownerLabel} 补齐，再交给 ${nextAgentLabel}。`
          : `等待 ${nextAgentLabel ?? ownerLabel ?? "下一角色"} 接棒评审。`;
      const escalationRule =
        artifact.status === "draft"
          ? `若超时未补齐，升级给 ${escalationOwnerLabel} 收口范围。`
          : `若评审持续阻塞，升级给 ${escalationOwnerLabel} 处理。`;
      const slaLabel = artifactSlaLabelMap[artifact.type];

      return {
        artifact,
        owner,
        nextAgent,
        reviewerAgent,
        escalationOwner,
        slaLabel,
        action,
        escalationRule
      };
    });
}

export function getArtifactReviewRecords(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const artifacts = getProjectArtifacts(snapshot, projectId);

  return snapshot.artifactReviews
    .map((review) => {
      const artifact = artifacts.find((item) => item.id === review.artifactId);

      if (!artifact) {
        return null;
      }

      const reviewer =
        snapshot.agents.find((agent) => agent.id === review.reviewerAgentId) ?? null;

      return {
        review,
        artifact,
        reviewer
      };
    })
    .filter(
      (
        item
      ): item is {
        review: ForgeArtifactReview;
        artifact: ForgeArtifact;
        reviewer: ForgeAgent | null;
      } => Boolean(item)
    )
    .sort((left, right) => right.review.reviewedAt.localeCompare(left.review.reviewedAt));
}

export function getArtifactReviewChecklist(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getArtifactReviewRecords(snapshot, projectId).map((item) => ({
    artifactId: item.artifact.id,
    artifactTitle: item.artifact.title,
    decision: item.review.decision,
    reviewerName: getAgentDisplayLabelOrFallback(item.reviewer, item.review.reviewerAgentId),
    conditions: item.review.conditions,
    reviewedAt: item.review.reviewedAt
  }));
}

export function getStageAdmissionSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const stage = getProjectWorkflowStage(snapshot, projectId);
  const persisted = getPersistedWorkflowState(snapshot, projectId);
  const missingArtifacts = getMissingRequiredArtifacts(snapshot, projectId);
  const failedGates = snapshot.deliveryGate.filter((gate) => gate.status === "fail");
  const pendingGates = snapshot.deliveryGate.filter((gate) => gate.status === "pending");
  const blockedRuns = snapshot.runs.filter((run) => run.state === "blocked");

  const derivedBlockers = [
    ...missingArtifacts.map((item) => `${item.label} 尚未齐备`),
    ...failedGates.map((gate) => `${gate.name} 门禁失败`),
    ...pendingGates.map((gate) => `${gate.name} 门禁待确认`),
    ...blockedRuns.map((run) => `${run.title} 已阻塞`)
  ];
  const blockers = persisted?.state === "blocked" && persisted.blockers.length > 0 ? persisted.blockers : derivedBlockers;

  return {
    stage,
    missingArtifacts,
    blockers,
    isReadyToAdvance: blockers.length === 0
  };
}

export function getEvidenceTimeline(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const runtimeLabel = getProjectRuntimeNotes(snapshot, projectId)[0] ?? null;

  return getProjectArtifacts(snapshot, projectId)
    .filter((artifact) => evidenceArtifactTypes.includes(artifact.type))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((artifact) => {
      const owner = snapshot.agents.find((agent) => agent.id === artifact.ownerAgentId) ?? null;
      const commandContext = getArtifactCommandContext(snapshot, projectId, artifact.type);

      return {
        artifact,
        owner,
      ownerLabel:
        getAgentDisplayLabelOrFallback(
          owner,
          getAgentLabelFromId(artifact.ownerAgentId) ?? artifact.ownerAgentId
        ) ?? artifact.ownerAgentId,
        label: artifactTypeLabels[artifact.type],
        statusLabel: artifactStatusLabels[artifact.status],
        runtimeLabel: commandContext?.runtimeLabel ?? runtimeLabel,
        sourceCommandExecutionId: commandContext?.sourceCommandExecutionId ?? null,
        sourceCommandId: commandContext?.sourceCommandId ?? null,
        sourceCommandLabel: commandContext?.sourceCommandLabel ?? null,
        relatedRunId: commandContext?.relatedRunId ?? null,
        relatedRunLabel: commandContext?.relatedRunLabel ?? null,
        runtimeExecutionBackendLabel: commandContext?.runtimeExecutionBackendLabel ?? null,
        runtimeModelProviderLabel: commandContext?.runtimeModelProviderLabel ?? null,
        runtimeModelExecutionDetail: commandContext?.runtimeModelExecutionDetail ?? null
      };
    });
}

function getBridgeHandoffState(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  if (!projectId) {
    return {
      status: "none" as const,
      summary: null,
      detail: null
    };
  }

  const bridgeRuns = snapshot.runs.filter(
    (run) => run.projectId === projectId && run.outputMode?.startsWith("external-shell-bridge")
  );

  if (bridgeRuns.length === 0) {
    return {
      status: "none" as const,
      summary: null,
      detail: null
    };
  }

  const artifacts = getProjectArtifacts(snapshot, projectId);
  const workflowState = getPersistedWorkflowState(snapshot, projectId);
  const runnerGatesTask = snapshot.tasks.find(
    (task) => task.projectId === projectId && task.id === `task-${projectId}-runner-gates`
  );
  const qaGateTask = snapshot.tasks.find(
    (task) => task.projectId === projectId && task.id === `task-${projectId}-qa-gate`
  );
  const reviewArtifactsReady =
    artifacts.some((artifact) => artifact.type === "patch" && artifact.status !== "draft") &&
    artifacts.some((artifact) => artifact.type === "demo-build" && artifact.status !== "draft");
  const testEvidenceReady =
    hasReadyArtifactType(artifacts, "test-report") && hasReadyArtifactType(artifacts, "playwright-run");
  const releaseEvidenceReady =
    hasReadyArtifactType(artifacts, "release-brief") || workflowState?.currentStage === "交付发布";

  if (testEvidenceReady || releaseEvidenceReady) {
    return {
      status: "release-candidate" as const,
      summary: "外部执行桥产出的规则审查结果已进入放行链，可继续整理交付说明和最终放行。",
      detail: workflowState?.currentStage === "交付发布" ? "当前项目已进入交付发布阶段。" : null
    };
  }

  if (
    hasReadyArtifactType(artifacts, "review-report") ||
    qaGateTask?.status === "in-progress" ||
    workflowState?.currentStage === "测试验证"
  ) {
    return {
      status: "qa-handoff" as const,
      summary: "外部执行桥已产出规则审查记录，并已移交 QA 门禁。",
      detail: qaGateTask?.summary ?? "等待 QA 执行 Playwright 门禁、浏览器回归和人工复核。"
    };
  }

  if (
    reviewArtifactsReady ||
    (workflowState?.currentStage === "开发执行" && runnerGatesTask?.status === "done")
  ) {
    const architectOwnerLabel = getPreferredAgentDisplayLabel(snapshot, "architect", "架构负责人");

    return {
      status: "review-handoff" as const,
      summary: "外部执行桥已写回 Patch 与 Demo，等待规则审查接棒。",
      detail:
        runnerGatesTask?.summary ??
        `请先由${architectOwnerLabel}发起规则审查并补齐规则审查记录。`
    };
  }

  return {
    status: "bridge-evidence" as const,
    summary: "外部执行桥证据已写回，待继续整理正式工件和后续移交。",
    detail: bridgeRuns.at(-1)?.title ?? null
  };
}

function getBridgeReviewCommandContext(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return getProjectCommandContext(snapshot, projectId, "command-review-run");
}

function getArtifactCommandContext(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined,
  artifactType: ForgeArtifactType
) {
  switch (artifactType) {
    case "patch":
    case "demo-build":
      return getProjectCommandContext(snapshot, projectId, "command-execution-start");
    case "review-report":
      return getProjectCommandContext(snapshot, projectId, "command-review-run");
    case "test-report":
    case "playwright-run":
      return getProjectCommandContext(snapshot, projectId, "command-gate-run");
    case "release-brief":
    case "review-decision":
      return getProjectCommandContext(snapshot, projectId, "command-release-prepare");
    case "release-audit":
    case "knowledge-card":
      return getProjectCommandContext(snapshot, projectId, "command-archive-capture");
    default:
      return null;
  }
}

function getAgentLabelFromId(agentId: string | null | undefined) {
  if (!agentId?.startsWith("agent-")) {
    return null;
  }

  const role = agentId.slice("agent-".length) as ForgeAgentRole;

  return role in agentRoleLabel ? getForgeAgentDisplayLabel({ id: agentId, role }) : null;
}

function getAgentDisplayLabelOrFallback(
  agent: Pick<ForgeAgent, "id" | "name" | "role"> | null | undefined,
  fallback: string | null
) {
  return agent ? getForgeAgentDisplayLabel(agent) : fallback;
}

function getPreferredAgentDisplayLabel(
  snapshot: ForgeDashboardSnapshot,
  role: ForgeAgentRole,
  fallback: string | null
) {
  const preferredAgent = getPreferredAgent(snapshot, role);

  if (preferredAgent) {
    return getForgeAgentDisplayLabel(preferredAgent);
  }

  const preferredFallbackId = preferredAgentIdsByRole[role]?.[0];

  if (preferredFallbackId) {
    return getForgeAgentDisplayLabel({ id: preferredFallbackId, role });
  }

  return fallback;
}

function getAgentDisplayLabelById(
  snapshot: ForgeDashboardSnapshot,
  agentId: string | null | undefined,
  fallback: string | null
) {
  if (!agentId) {
    return fallback;
  }

  const agent = snapshot.agents.find((item) => item.id === agentId) ?? null;

  if (agent) {
    return getForgeAgentDisplayLabel(agent);
  }

  if (agentId.startsWith("agent-")) {
    return getForgeAgentDisplayLabel({ id: agentId });
  }

  return fallback ?? agentId;
}

function getTaskOwnerDisplayLabel(
  snapshot: ForgeDashboardSnapshot,
  task: Pick<ForgeTask, "projectId" | "ownerAgentId">,
  fallback = "项目负责人"
) {
  const resolvedAgentOwnerLabel = task.ownerAgentId
    ? (() => {
        const agent = snapshot.agents.find((item) => item.id === task.ownerAgentId) ?? null;

        if (agent) {
          return getForgeAgentDisplayLabel(agent);
        }

        if (task.ownerAgentId.startsWith("agent-")) {
          return getForgeAgentDisplayLabel({ id: task.ownerAgentId });
        }

        return null;
      })()
    : null;

  return (
    resolvedAgentOwnerLabel ??
    snapshot.projects.find((project) => project.id === task.projectId)?.owner ??
    getPreferredAgentDisplayLabel(snapshot, "pm", fallback) ??
    fallback
  );
}

function getProjectCommandContext(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined,
  commandId: string
) {
  if (!projectId) {
    return null;
  }

  const execution = [...snapshot.commandExecutions]
    .filter(
      (item) => item.projectId === projectId && item.commandId === commandId
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (!execution) {
    return null;
  }

  const runtimeContext = getCommandExecutionRuntimeContext(snapshot, execution.id);
  const commandType = snapshot.commands.find((item) => item.id === execution.commandId)?.type ?? null;
  const getInferredRunScore = (run: ForgeRun) => {
    const executor = run.executor.toLowerCase();
    const outputMode = (run.outputMode ?? "").toLowerCase();
    const title = run.title.toLowerCase();

    if (commandType === "review.run") {
      return (
        (executor.includes("review") ? 4 : 0) +
        (outputMode.includes("review") ? 3 : 0) +
        (title.includes("审查") ? 2 : 0)
      );
    }

    if (commandType === "gate.run") {
      return (
        (executor.includes("playwright") ? 4 : 0) +
        (outputMode.includes("playwright") ? 3 : 0) +
        (title.includes("回归") ? 2 : 0)
      );
    }

    if (commandType === "release.prepare" || commandType === "release.approve") {
      return (
        (outputMode.includes("release") ? 5 : 0) +
        (title.includes("交付说明") ? 4 : 0) +
        (executor.includes("release") ? 3 : 0) +
        (executor.includes("交付") ? 1 : 0)
      );
    }

    if (commandType === "archive.capture") {
      return (
        (outputMode.includes("archive") ? 5 : 0) +
        (title.includes("归档") || title.includes("知识卡") ? 4 : 0) +
        (executor.includes("知识") || executor.includes("归档") ? 3 : 0)
      );
    }

    return 0;
  };
  const inferredRun = (() => {
    if (!commandType) {
      return null;
    }

    return [...snapshot.runs]
      .filter((run) => run.projectId === projectId)
      .map((run) => ({
        run,
        score: getInferredRunScore(run)
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return right.run.title.localeCompare(left.run.title);
      })[0]?.run ?? null;
  })();
  const runtimeModelExecutionDetail =
    runtimeContext.runtimeModelExecutionDetail ??
    (inferredRun ? getRunModelExecutionDetail(inferredRun) || null : null);
  const runtimeModelProviderLabel =
    runtimeContext.runtimeModelProviderLabel ??
    (inferredRun ? getRunModelExecutionProvider(inferredRun) || null : null);
  const runtimeExecutionBackendLabel =
    runtimeContext.runtimeExecutionBackendLabel ??
    getRunExecutionBackendLabelFromDetail(runtimeModelExecutionDetail ?? "") ??
    null;
  const relatedRunId = runtimeContext.relatedRunId ?? inferredRun?.id ?? execution.relatedRunId ?? null;
  const relatedRunLabel =
    runtimeContext.relatedRunLabel ??
    (inferredRun ? `${inferredRun.title} · ${inferredRun.executor}` : null);
  const runtimeLabel =
    runtimeContext.runtimeLabel ?? (inferredRun ? formatRunRuntimeLabel(inferredRun) : null);

  return {
    sourceCommandExecutionId: execution.id,
    sourceCommandId: execution.commandId,
    sourceCommandLabel:
      snapshot.commands.find((item) => item.id === execution.commandId)?.name ??
      commandLabelFallbackMap[execution.commandId] ??
      execution.commandId,
    relatedRunId,
    relatedRunLabel,
    runtimeLabel,
    runtimeExecutionBackendLabel,
    runtimeModelProviderLabel,
    runtimeModelExecutionDetail
  };
}

function getReleaseGateEscalationNextAction(input: {
  snapshot: ForgeDashboardSnapshot;
  label: string;
  fallbackNextAction?: string;
  bridgeHandoff: ReturnType<typeof getBridgeHandoffState>;
}) {
  const normalizedLabel = input.label.trim();
  const qaOwnerLabel = getPreferredAgentDisplayLabel(
    input.snapshot,
    "qa",
    "测试负责人"
  );
  const releaseOwnerLabel = getPreferredAgentDisplayLabel(
    input.snapshot,
    "release",
    "发布负责人"
  );
  const architectOwnerLabel = getPreferredAgentDisplayLabel(
    input.snapshot,
    "architect",
    "架构负责人"
  );

  if (input.bridgeHandoff.status === "qa-handoff") {
    if (normalizedLabel === "测试报告" || normalizedLabel === "Playwright 回归记录") {
      return `桥接评审已移交 QA，先由${qaOwnerLabel}补齐 ${normalizedLabel}，再重新发起放行检查`;
    }

    return `桥接评审已移交 QA，待${qaOwnerLabel}完成门禁后再补齐 ${normalizedLabel}，并重新发起放行检查`;
  }

  if (input.bridgeHandoff.status === "release-candidate") {
    if (normalizedLabel === "交付说明" || normalizedLabel === "放行评审结论") {
      return `桥接链已进入放行候选，优先由${releaseOwnerLabel}补齐 ${normalizedLabel}，再推进最终放行`;
    }

    return `桥接链已进入放行候选，先收口 ${normalizedLabel}，再推进最终放行`;
  }

  if (input.bridgeHandoff.status === "review-handoff") {
    return `桥接研发执行已完成，先由${architectOwnerLabel}发起规则审查并补齐规则审查记录，再继续收口 ${normalizedLabel}`;
  }

  if (input.bridgeHandoff.status === "bridge-evidence") {
    return (
      input.fallbackNextAction ??
      `外部执行桥证据已写回，继续整理 ${normalizedLabel} 并推进后续移交`
    );
  }

  return input.fallbackNextAction;
}

function withBridgeHandoffReleaseAction(input: {
  action: string | undefined;
  bridgeHandoff: ReturnType<typeof getBridgeHandoffState>;
}) {
  if (!input.action) {
    return input.action;
  }

  if (input.bridgeHandoff.status === "qa-handoff") {
    return `桥接评审已移交 QA，${input.action}`;
  }

  if (input.bridgeHandoff.status === "review-handoff") {
    return `桥接研发执行已完成，${input.action}`;
  }

  if (input.bridgeHandoff.status === "release-candidate") {
    return `桥接链已进入放行候选，${input.action}`;
  }

  if (input.bridgeHandoff.status === "bridge-evidence") {
    return `外部执行桥证据已写回，${input.action}`;
  }

  return input.action;
}

export function getDeliveryReadinessSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const artifacts = getProjectArtifacts(snapshot, projectId);
  const missingEvidence = releaseRequiredArtifactTypes
    .filter((type) => !hasReadyArtifactType(artifacts, type))
    .map((type) => ({
      type,
      label: artifactTypeLabels[type]
    }));
  const failedGates = snapshot.deliveryGate.filter((gate) => gate.status === "fail");
  const pendingGates = snapshot.deliveryGate.filter((gate) => gate.status === "pending");
  const blockingEvidenceTypes: ForgeArtifactType[] = ["patch", "demo-build", "test-report", "playwright-run"];
  const blockingEvidence = missingEvidence.filter((item) => blockingEvidenceTypes.includes(item.type));
  const pendingEvidence = missingEvidence.filter((item) => !blockingEvidenceTypes.includes(item.type));
  const blockers = [
    ...blockingEvidence.map((item) => `${item.label} 尚未齐备`),
    ...failedGates.map((gate) => `${gate.name} 门禁失败`)
  ];
  const pendingItems = [
    ...pendingEvidence.map((item) => `${item.label} 待确认`),
    ...pendingGates.map((gate) => `${gate.name} 门禁待确认`)
  ];
  const bridgeHandoff = getBridgeHandoffState(snapshot, projectId);
  const bridgeReviewContext = getBridgeReviewCommandContext(snapshot, projectId);
  const runtimeNotes = getProjectRuntimeNotes(snapshot, projectId);
  const runtimeCapabilityDetails = getProjectRuntimeCapabilityDetails(snapshot, projectId);

  let statusLabel = "阻塞中";
  let summary = "当前还不能交付，先补齐关键证据和失败门禁。";

  if (blockers.length === 0 && pendingItems.length === 0) {
    statusLabel = "可交付";
    summary = "关键证据和门禁都已转绿，可以进入交付放行。";
  } else if (blockers.length === 0) {
    statusLabel = "待确认";
    summary = "主链证据已齐，但仍有待确认项，适合进入放行确认。";
  }

  if (bridgeHandoff.summary) {
    summary = `${bridgeHandoff.summary} ${summary}`;
  }

  if (runtimeNotes.length > 0) {
    summary = `${summary} 当前运行信号：${runtimeNotes[0]}`;
  }

  return {
    statusLabel,
    summary,
    bridgeHandoffStatus: bridgeHandoff.status,
    bridgeHandoffSummary: bridgeHandoff.summary,
    bridgeHandoffDetail: bridgeHandoff.detail,
    bridgeReviewCommandExecutionId: bridgeReviewContext?.sourceCommandExecutionId ?? null,
    bridgeReviewCommandId: bridgeReviewContext?.sourceCommandId ?? null,
    bridgeReviewRunId: bridgeReviewContext?.relatedRunId ?? null,
    bridgeReviewRunLabel: bridgeReviewContext?.relatedRunLabel ?? null,
    bridgeReviewRuntimeLabel: bridgeReviewContext?.runtimeLabel ?? null,
    bridgeReviewExecutionBackendLabel: bridgeReviewContext?.runtimeExecutionBackendLabel ?? null,
    missingEvidence,
    blockers,
    pendingItems,
    runtimeNotes,
    runtimeCapabilityDetails
  };
}

export function getReleaseGateSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  const readiness = getDeliveryReadinessSummary(snapshot, projectId);
  const bridgeHandoff = getBridgeHandoffState(snapshot, projectId);
  const bridgeReviewContext = getBridgeReviewCommandContext(snapshot, projectId);
  const approvalTrace = getApprovalTrace(snapshot, projectId);
  const archiveProvenance = getArchiveProvenanceSummary(snapshot, projectId);
  const formalArtifactGap = getFormalArtifactGapSummary(snapshot, projectId);
  const approvalHandoff = getFormalArtifactResponsibilitySummary(snapshot, projectId).approvalHandoff;
  const releaseClosure = getReleaseClosureSummary(snapshot, projectId);
  const releaseClosureResponsibility = getReleaseClosureResponsibilitySummary(snapshot, projectId);
  const items = [
    ...releaseRequiredArtifactTypes.map((type) => {
      const artifact = getProjectArtifacts(snapshot, projectId).find(
        (item) => item.type === type && item.status === "ready"
      );

      return {
        key: type,
        label: artifactTypeLabels[type],
        statusLabel: artifact ? "已就绪" : "缺失",
        detail: artifact ? `${artifact.title} · ${artifact.updatedAt}` : "当前还未形成可放行证据"
      };
    }),
    ...snapshot.deliveryGate.map((gate) => ({
      key: gate.id,
      label: gate.name,
      statusLabel:
        gate.status === "pass" ? "通过" : gate.status === "pending" ? "待确认" : "失败",
      detail:
        gate.status === "pass"
          ? "当前门禁已通过"
          : gate.status === "pending"
            ? "等待负责人或 QA 补充确认"
            : "存在阻塞，必须先修复再放行"
    }))
  ];
  const missingItems = items.filter((item) => item.statusLabel !== "已就绪" && item.statusLabel !== "通过");
  const overallLabel =
    readiness.statusLabel === "可交付"
      ? "可放行"
      : readiness.statusLabel === "待确认"
        ? "待确认"
        : "已阻塞";
  let summary =
    overallLabel === "可放行"
      ? "交付证据和门禁都已达标，可以进入发布确认。"
      : overallLabel === "待确认"
        ? "关键证据已基本齐备，但仍有待确认项。"
        : "当前仍有关键缺口，不能推进发布。";

  if (bridgeHandoff.summary) {
    summary = `${bridgeHandoff.summary} ${summary}`;
  }

  return {
    overallLabel,
    summary,
    bridgeHandoffStatus: bridgeHandoff.status,
    bridgeHandoffSummary: bridgeHandoff.summary,
    bridgeHandoffDetail: bridgeHandoff.detail,
    bridgeReviewCommandExecutionId: bridgeReviewContext?.sourceCommandExecutionId ?? null,
    bridgeReviewCommandId: bridgeReviewContext?.sourceCommandId ?? null,
    bridgeReviewRunId: bridgeReviewContext?.relatedRunId ?? null,
    bridgeReviewRunLabel: bridgeReviewContext?.relatedRunLabel ?? null,
    bridgeReviewRuntimeLabel: bridgeReviewContext?.runtimeLabel ?? null,
    bridgeReviewExecutionBackendLabel: bridgeReviewContext?.runtimeExecutionBackendLabel ?? null,
    formalArtifactGap,
    approvalHandoff,
    releaseClosure,
    releaseClosureResponsibility,
    archiveProvenance,
    runtimeNotes: readiness.runtimeNotes,
    runtimeCapabilityDetails: readiness.runtimeCapabilityDetails,
    approvalTrace,
    escalationActions: getReleaseGateEscalationActions({
      snapshot,
      projectId,
      overallLabel,
      bridgeHandoff,
      bridgeReviewContext,
      approvalTrace,
      formalArtifactGap,
      runtimeCapabilityDetails: readiness.runtimeCapabilityDetails,
      missingItems
    }),
    missingItems,
    items
  };
}

function getReleaseGateEscalationActions(input: {
  snapshot: ForgeDashboardSnapshot;
  projectId: string | null | undefined;
  overallLabel: "可放行" | "待确认" | "已阻塞";
  bridgeHandoff: ReturnType<typeof getBridgeHandoffState>;
  bridgeReviewContext: ReturnType<typeof getBridgeReviewCommandContext>;
  approvalTrace: ReturnType<typeof getApprovalTrace>;
  formalArtifactGap: ReturnType<typeof getFormalArtifactGapSummary>;
  runtimeCapabilityDetails: string[];
  missingItems: Array<{ label: string; statusLabel: string; detail: string }>;
}) {
  const blockingTasks = getBlockingTaskChain(input.snapshot, input.projectId);
  const escalationTask =
    blockingTasks.find((task) => task.id.includes("escalation")) ?? blockingTasks[0] ?? null;
  const escalationProjectId = input.projectId ?? null;
  const escalationUnifiedRetryArgs = escalationTask
    ? ["--remediation-id", escalationTask.id, ...(escalationProjectId ? ["--project-id", escalationProjectId] : [])]
    : [];
  const escalationUnifiedRetryCommand = escalationTask
    ? `npm run runner:forge -- --remediation-id ${escalationTask.id}${
        escalationProjectId ? ` --project-id ${escalationProjectId}` : ""
      }`
    : null;
  const architectOwnerLabel = getPreferredAgentDisplayLabel(
    input.snapshot,
    "architect",
    "架构负责人"
  );
  const traceActions = input.approvalTrace
    .filter(
      (item) =>
        item.escalated ||
        item.breachLabel === "已违约" ||
        item.breachLabel === "临近 SLA" ||
        item.statusLabel === "待形成" ||
        item.statusLabel === "评审中" ||
        item.statusLabel === "待确认" ||
        item.statusLabel === "需修改"
    )
    .map((item) => ({
      label: `${item.label} · ${item.statusLabel}`,
      detail: item.detail,
      sourceCommandExecutionId: item.sourceCommandExecutionId ?? input.bridgeReviewContext?.sourceCommandExecutionId ?? null,
      sourceCommandId: item.sourceCommandId ?? input.bridgeReviewContext?.sourceCommandId ?? null,
      relatedRunId: item.relatedRunId ?? input.bridgeReviewContext?.relatedRunId ?? null,
      relatedRunLabel: item.relatedRunLabel ?? input.bridgeReviewContext?.relatedRunLabel ?? null,
      runtimeLabel: item.runtimeLabel ?? input.bridgeReviewContext?.runtimeLabel ?? null,
      ownerLabel: item.ownerLabel,
      ownerRoleLabel: item.ownerRoleLabel,
      nextAction: withBridgeHandoffReleaseAction({
        action: item.nextAction,
        bridgeHandoff: input.bridgeHandoff
      }),
      triggerLabel: item.escalationTrigger ?? item.breachLabel,
      escalationLabel: item.escalationLabel,
      runtimeEvidenceLabel:
        item.kind === "runtime"
          ? item.detail
          : input.runtimeCapabilityDetails.length > 0
            ? input.runtimeCapabilityDetails.join(" / ")
            : null,
      runtimeExecutionBackendLabel: escalationTask?.runtimeExecutionBackendLabel ?? null,
      runtimeModelProviderLabel: escalationTask?.runtimeModelProviderLabel ?? null,
      runtimeModelExecutionDetail: escalationTask?.runtimeModelExecutionDetail ?? null,
      bridgeHandoffStatus: input.bridgeHandoff.status,
      bridgeHandoffSummary: input.bridgeHandoff.summary,
      bridgeHandoffDetail: input.bridgeHandoff.detail,
      taskId: escalationTask?.id ?? null,
      taskLabel: escalationTask?.title ?? null,
      retryApiPath: escalationTask ? "/api/forge/escalations/retry" : null,
      retryRunnerCommand: escalationTask?.retryRunnerCommand ?? null,
      unifiedRetryApiPath: escalationTask ? "/api/forge/remediations/retry" : null,
      unifiedRetryRunnerArgs: escalationUnifiedRetryArgs,
      unifiedRetryRunnerCommand: escalationUnifiedRetryCommand,
      blocking:
        item.kind === "runtime"
          ? item.escalated || item.breachLabel === "已违约"
          : input.overallLabel !== "可放行" || item.breachLabel === "已违约"
    }));

  const reviewHandoffActions =
    input.bridgeHandoff.status === "review-handoff"
      ? [
          {
            label: "规则审查记录 · 待形成",
            detail: "外部执行桥已写回 Patch 与 Demo，需先完成规则审查，再继续推进 QA 与放行链。",
            sourceCommandExecutionId: input.bridgeReviewContext?.sourceCommandExecutionId ?? null,
            sourceCommandId: input.bridgeReviewContext?.sourceCommandId ?? null,
            relatedRunId: input.bridgeReviewContext?.relatedRunId ?? null,
            relatedRunLabel: input.bridgeReviewContext?.relatedRunLabel ?? null,
            runtimeLabel: input.bridgeReviewContext?.runtimeLabel ?? null,
            ownerLabel: architectOwnerLabel,
            ownerRoleLabel: "架构师",
            nextAction:
              `桥接研发执行已完成，先由${architectOwnerLabel}发起规则审查并补齐规则审查记录，再重新发起放行检查`,
            triggerLabel: "等待规则审查",
            escalationLabel: "若规则审查迟迟未启动，升级给项目负责人收口",
            runtimeEvidenceLabel:
              input.runtimeCapabilityDetails.length > 0
                ? input.runtimeCapabilityDetails.join(" / ")
                : null,
            runtimeExecutionBackendLabel: escalationTask?.runtimeExecutionBackendLabel ?? null,
            runtimeModelProviderLabel: escalationTask?.runtimeModelProviderLabel ?? null,
            runtimeModelExecutionDetail: escalationTask?.runtimeModelExecutionDetail ?? null,
            bridgeHandoffStatus: input.bridgeHandoff.status,
            bridgeHandoffSummary: input.bridgeHandoff.summary,
            bridgeHandoffDetail: input.bridgeHandoff.detail,
            taskId: escalationTask?.id ?? null,
            taskLabel: escalationTask?.title ?? null,
            retryApiPath: escalationTask ? "/api/forge/escalations/retry" : null,
            retryRunnerCommand: escalationTask?.retryRunnerCommand ?? null,
            unifiedRetryApiPath: escalationTask ? "/api/forge/remediations/retry" : null,
            unifiedRetryRunnerArgs: escalationUnifiedRetryArgs,
            unifiedRetryRunnerCommand: escalationUnifiedRetryCommand,
            blocking: true
          }
        ]
      : [];

  const missingItemActions = input.missingItems.map((item) => {
    const isFormalArtifactGap = input.formalArtifactGap.missingArtifactLabels.includes(item.label);

    return {
      label: `${item.label} · ${item.statusLabel}`,
      detail: item.detail,
      sourceCommandExecutionId: input.bridgeReviewContext?.sourceCommandExecutionId ?? null,
      sourceCommandId: input.bridgeReviewContext?.sourceCommandId ?? null,
      relatedRunId: input.bridgeReviewContext?.relatedRunId ?? null,
      relatedRunLabel: input.bridgeReviewContext?.relatedRunLabel ?? null,
      runtimeLabel: input.bridgeReviewContext?.runtimeLabel ?? null,
      ownerLabel: isFormalArtifactGap
        ? input.formalArtifactGap.ownerLabel ??
          getPreferredAgentDisplayLabel(input.snapshot, "pm", "项目负责人")
        : getPreferredAgentDisplayLabel(input.snapshot, "pm", "项目负责人"),
      ownerRoleLabel: isFormalArtifactGap
        ? input.formalArtifactGap.ownerRoleLabel ?? "产品经理"
        : "产品经理",
      nextAction:
        (isFormalArtifactGap ? input.formalArtifactGap.nextAction : null) ??
        getReleaseGateEscalationNextAction({
          snapshot: input.snapshot,
          label: item.label,
          fallbackNextAction: `先补齐 ${item.label}，再重新发起放行检查`,
          bridgeHandoff: input.bridgeHandoff
        }),
      triggerLabel: "放行证据缺失",
      escalationLabel: "若持续缺失，升级给项目负责人收口",
      runtimeEvidenceLabel:
        input.runtimeCapabilityDetails.length > 0
          ? input.runtimeCapabilityDetails.join(" / ")
          : null,
      runtimeExecutionBackendLabel: escalationTask?.runtimeExecutionBackendLabel ?? null,
      runtimeModelProviderLabel: escalationTask?.runtimeModelProviderLabel ?? null,
      runtimeModelExecutionDetail: escalationTask?.runtimeModelExecutionDetail ?? null,
      bridgeHandoffStatus: input.bridgeHandoff.status,
      bridgeHandoffSummary: input.bridgeHandoff.summary,
      bridgeHandoffDetail: input.bridgeHandoff.detail,
      taskId: escalationTask?.id ?? null,
      taskLabel: escalationTask?.title ?? null,
      retryApiPath: escalationTask ? "/api/forge/escalations/retry" : null,
      retryRunnerCommand: escalationTask?.retryRunnerCommand ?? null,
      unifiedRetryApiPath: escalationTask ? "/api/forge/remediations/retry" : null,
      unifiedRetryRunnerArgs: escalationUnifiedRetryArgs,
      unifiedRetryRunnerCommand: escalationUnifiedRetryCommand,
      blocking: true
    };
  });

  const actions = [...reviewHandoffActions, ...traceActions, ...missingItemActions];

  if (actions.length > 0) {
    return actions;
  }

  return [
    {
      label: "保持放行链路稳定",
      detail: "当前关键证据和门禁已齐备，可以进入最终放行与归档。",
      sourceCommandExecutionId: input.bridgeReviewContext?.sourceCommandExecutionId ?? null,
      sourceCommandId: input.bridgeReviewContext?.sourceCommandId ?? null,
      relatedRunId: input.bridgeReviewContext?.relatedRunId ?? null,
      relatedRunLabel: input.bridgeReviewContext?.relatedRunLabel ?? null,
      runtimeLabel: input.bridgeReviewContext?.runtimeLabel ?? null,
      ownerLabel: getPreferredAgentDisplayLabel(input.snapshot, "release", "发布负责人"),
      ownerRoleLabel: "发布",
      nextAction: "确认交付说明与最终放行结论",
      triggerLabel: "进入最终放行",
      escalationLabel: `若人工确认超时，升级给 ${getPreferredAgentDisplayLabel(input.snapshot, "pm", "项目负责人")}`,
      runtimeEvidenceLabel:
        input.runtimeCapabilityDetails.length > 0
          ? input.runtimeCapabilityDetails.join(" / ")
          : null,
      runtimeExecutionBackendLabel: escalationTask?.runtimeExecutionBackendLabel ?? null,
      runtimeModelProviderLabel: escalationTask?.runtimeModelProviderLabel ?? null,
      runtimeModelExecutionDetail: escalationTask?.runtimeModelExecutionDetail ?? null,
      bridgeHandoffStatus: input.bridgeHandoff.status,
      bridgeHandoffSummary: input.bridgeHandoff.summary,
      bridgeHandoffDetail: input.bridgeHandoff.detail,
      taskId: escalationTask?.id ?? null,
      taskLabel: escalationTask?.title ?? null,
      retryApiPath: escalationTask ? "/api/forge/escalations/retry" : null,
      retryRunnerCommand: escalationTask?.retryRunnerCommand ?? null,
      unifiedRetryApiPath: escalationTask ? "/api/forge/remediations/retry" : null,
      unifiedRetryRunnerArgs: escalationUnifiedRetryArgs,
      unifiedRetryRunnerCommand: escalationUnifiedRetryCommand,
      blocking: false
    }
  ];
}

function getArchiveProvenanceSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
): ForgeArchiveProvenanceSummary | null {
  if (!projectId) {
    return null;
  }

  const artifact =
    getProjectArtifacts(snapshot, projectId).find((item) => item.type === "release-audit") ??
    getProjectArtifacts(snapshot, projectId).find((item) => item.type === "knowledge-card") ??
    null;

  if (!artifact) {
    return null;
  }

  const archiveContext = getArtifactCommandContext(snapshot, projectId, artifact.type);
  const handoffContext = getProjectCommandContext(snapshot, projectId, "command-release-prepare");
  const artifactLabel = artifactTypeLabels[artifact.type];
  const statusLabel = artifactStatusLabels[artifact.status];
  const archiveCommandLabel = archiveContext?.sourceCommandLabel ?? "触发归档沉淀";
  const handoffCommandLabel = handoffContext?.sourceCommandLabel ?? "整理交付说明";

  return {
    artifactType: artifact.type,
    artifactLabel,
    artifactTitle: artifact.title,
    statusLabel,
    updatedAt: artifact.updatedAt,
    summary: `${artifactLabel} 已由 ${archiveCommandLabel} 写回正式工件面。`,
    detail: handoffContext?.relatedRunLabel
      ? `当前归档沉淀接棒来源于 ${handoffCommandLabel} · ${handoffContext.relatedRunLabel}。`
      : `当前归档沉淀接棒来源于 ${handoffCommandLabel}。`,
    archiveCommandExecutionId: archiveContext?.sourceCommandExecutionId ?? null,
    archiveCommandId: archiveContext?.sourceCommandId ?? null,
    archiveCommandLabel,
    archiveRunId: archiveContext?.relatedRunId ?? null,
    archiveRunLabel: archiveContext?.relatedRunLabel ?? null,
    archiveRuntimeLabel: archiveContext?.runtimeLabel ?? null,
    archiveExecutionBackendLabel: archiveContext?.runtimeExecutionBackendLabel ?? null,
    handoffCommandExecutionId: handoffContext?.sourceCommandExecutionId ?? null,
    handoffCommandId: handoffContext?.sourceCommandId ?? null,
    handoffCommandLabel,
    handoffRunId: handoffContext?.relatedRunId ?? null,
    handoffRunLabel: handoffContext?.relatedRunLabel ?? null,
    handoffRuntimeLabel: handoffContext?.runtimeLabel ?? null,
    handoffExecutionBackendLabel: handoffContext?.runtimeExecutionBackendLabel ?? null
  };
}

export function getFormalArtifactCoverageSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
): ForgeFormalArtifactCoverageSummary {
  const entries = getEvidenceTimeline(snapshot, projectId).filter((item) =>
    formalArtifactTypes.includes(item.artifact.type as (typeof formalArtifactTypes)[number])
  );
  const coveredArtifactTypes = formalArtifactTypes.filter((artifactType) =>
    entries.some((entry) => entry.artifact.type === artifactType)
  );

  if (coveredArtifactTypes.length === 0) {
    return {
      count: 0,
      summary: "当前还没有沉淀正式工件。",
      detail: "先完成交付说明、放行评审结论和归档沉淀写回。"
    };
  }

  return {
    count: coveredArtifactTypes.length,
    summary: `已沉淀 ${coveredArtifactTypes.length} 项正式工件`,
    detail: coveredArtifactTypes.map((artifactType) => artifactTypeLabels[artifactType]).join(" / ")
  };
}

export function getFormalArtifactGapSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
): ForgeFormalArtifactGapSummary {
  const projectArtifacts = getProjectArtifacts(snapshot, projectId);
  const missingArtifactTypes = formalArtifactTypes.filter(
    (artifactType) =>
      !projectArtifacts.some((artifact) => artifact.type === artifactType && artifact.status === "ready")
  );
  const currentHandoff = getCurrentHandoffSummary(snapshot, projectId);
  const bridgeHandoff = getBridgeHandoffState(snapshot, projectId);
  const guidance =
    getBridgeHandoffGuidance(snapshot, bridgeHandoff.status) ?? {
      ownerLabel: currentHandoff.ownerLabel ?? null,
      ownerRoleLabel: currentHandoff.ownerRoleLabel ?? null,
      nextAction: currentHandoff.nextAction ?? null
    };

  return {
    missingArtifactTypes: [...missingArtifactTypes],
    missingArtifactLabels: missingArtifactTypes.map((artifactType) => artifactTypeLabels[artifactType]),
    summary:
      missingArtifactTypes.length > 0
        ? `当前仍缺少 ${missingArtifactTypes
            .map((artifactType) => artifactTypeLabels[artifactType])
            .join(" / ")}。`
        : "当前正式工件缺口已清零。",
    ownerLabel: guidance.ownerLabel,
    ownerRoleLabel: guidance.ownerRoleLabel,
    nextAction: guidance.nextAction
  };
}

export function getFormalArtifactProvenanceSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
): ForgeFormalArtifactProvenanceItem[] {
  const entries = getEvidenceTimeline(snapshot, projectId).filter((item) =>
    formalArtifactTypes.includes(item.artifact.type as (typeof formalArtifactTypes)[number])
  );

  return formalArtifactTypes.flatMap((artifactType) => {
    const item = entries.find((entry) => entry.artifact.type === artifactType);

    if (!item) {
      return [];
    }

    const parts = [
      item.sourceCommandLabel ? `来源命令：${item.sourceCommandLabel}` : `状态：${item.statusLabel}`,
      item.relatedRunLabel ? `来源运行：${item.relatedRunLabel}` : null,
      item.runtimeLabel ?? null
    ].filter(Boolean);

    return [
      {
        artifactType,
        artifactTitle: item.artifact.title,
        statusLabel: item.statusLabel,
        sourceCommandLabel: item.sourceCommandLabel ?? null,
        relatedRunLabel: item.relatedRunLabel ?? null,
        runtimeLabel: item.runtimeLabel ?? null,
        value:
          parts.length > 0
            ? parts.join(" · ")
            : `${item.ownerLabel} · ${item.artifact.updatedAt}`
      }
    ];
  });
}

export function getFormalArtifactResponsibilitySummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
): ForgeFormalArtifactResponsibilitySummary {
  const coverage = getFormalArtifactCoverageSummary(snapshot, projectId);
  const gap = getFormalArtifactGapSummary(snapshot, projectId);
  const provenance = getFormalArtifactProvenanceSummary(snapshot, projectId);
  const formalArtifactPriority = new Map(formalArtifactTypes.map((artifactType, index) => [artifactType, index]));
  const pendingApprovals = getApprovalTrace(snapshot, projectId)
    .filter(
      (item) =>
        item.kind !== "runtime" &&
        Boolean(item.nextAction) &&
        (Boolean(isFormalArtifactType(item.artifactType)) ||
          item.statusLabel === "待形成" ||
          item.statusLabel === "评审中" ||
          item.statusLabel === "待确认" ||
          item.statusLabel === "需修改" ||
          Boolean(item.escalated))
    )
    .sort((left, right) => {
      const leftPriority =
        isFormalArtifactType(left.artifactType)
          ? formalArtifactPriority.get(left.artifactType) ?? Number.MAX_SAFE_INTEGER
          : Number.MAX_SAFE_INTEGER;
      const rightPriority =
        isFormalArtifactType(right.artifactType)
          ? formalArtifactPriority.get(right.artifactType) ?? Number.MAX_SAFE_INTEGER
          : Number.MAX_SAFE_INTEGER;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return right.createdAt.localeCompare(left.createdAt);
    })
    .slice(0, 5)
    .map((item) => ({
      kind: item.kind === "audit" ? ("audit" as const) : ("review" as const),
      artifactType: item.artifactType,
      label: item.label,
      statusLabel: item.statusLabel,
      detail: item.detail,
      ownerLabel: item.ownerLabel ?? null,
      ownerRoleLabel: item.ownerRoleLabel ?? null,
      nextAction: item.nextAction ?? null,
      sourceCommandExecutionId: item.sourceCommandExecutionId ?? null,
      sourceCommandId: item.sourceCommandId ?? null,
      sourceCommandLabel: item.sourceCommandId
        ? snapshot.commands.find((command) => command.id === item.sourceCommandId)?.name ??
          item.sourceCommandId
        : null,
      relatedRunId: item.relatedRunId ?? null,
      relatedRunLabel: item.relatedRunLabel ?? null,
      runtimeLabel: item.runtimeLabel ?? null
    }));
  const releasePrepareContext = getProjectCommandContext(
    snapshot,
    projectId,
    "command-release-prepare"
  );
  const knowledgeTask = projectId
    ? snapshot.tasks.find(
        (task) =>
          task.projectId === projectId &&
          task.id === `task-${projectId}-knowledge-card` &&
          task.status !== "done"
      ) ?? null
    : null;
  const knowledgeOwner =
    knowledgeTask
      ? snapshot.agents.find((agent) => agent.id === knowledgeTask.ownerAgentId) ?? null
      : null;
  const approvalHandoffParts = [
    releasePrepareContext?.sourceCommandLabel
      ? `来源命令：${releasePrepareContext.sourceCommandLabel}`
      : null,
    releasePrepareContext?.relatedRunLabel
      ? `来源运行：${releasePrepareContext.relatedRunLabel}`
      : null,
    releasePrepareContext?.runtimeLabel
      ? releasePrepareContext.runtimeLabel
      : null
  ].filter((item): item is string => Boolean(item));
  const approvalHandoff =
    pendingApprovals.length > 0 || Boolean(knowledgeTask)
      ? {
          summary: knowledgeTask
            ? `确认后将由 ${getAgentDisplayLabelById(snapshot, knowledgeTask.ownerAgentId, "知识负责人")} 接棒归档沉淀。`
            : "确认后将继续进入归档沉淀。",
          detail: `${
            knowledgeTask?.title ?? "确认交付说明与放行口径后，继续沉淀知识卡与归档审计。"
          }${approvalHandoffParts.length > 0 ? ` · ${approvalHandoffParts.join(" · ")}` : ""}`,
          ownerLabel: knowledgeTask
            ? getAgentDisplayLabelById(snapshot, knowledgeTask.ownerAgentId, "知识负责人")
            : getPreferredAgentDisplayLabel(snapshot, "knowledge", "知识负责人"),
          ownerRoleLabel: knowledgeOwner?.role
            ? agentRoleLabel[knowledgeOwner.role]
            : agentRoleLabel.knowledge,
          nextAction: knowledgeTask?.title ?? "沉淀交付知识卡与归档审计记录",
          sourceCommandExecutionId: releasePrepareContext?.sourceCommandExecutionId ?? null,
          sourceCommandId: releasePrepareContext?.sourceCommandId ?? null,
          sourceCommandLabel: releasePrepareContext?.sourceCommandLabel ?? null,
          relatedRunId: releasePrepareContext?.relatedRunId ?? null,
          relatedRunLabel: releasePrepareContext?.relatedRunLabel ?? null,
          runtimeLabel: releasePrepareContext?.runtimeLabel ?? null
        }
      : {
          summary: "当前无需等待审批后接棒。",
          detail: "当前没有待人工确认事项。",
          ownerLabel: null,
          ownerRoleLabel: null,
          nextAction: null,
          sourceCommandExecutionId: null,
          sourceCommandId: null,
          sourceCommandLabel: null,
          relatedRunId: null,
          relatedRunLabel: null,
          runtimeLabel: null
        };

  return {
    coverage,
    gap,
    pendingApprovals,
    approvalHandoff,
    provenance
  };
}

export function getReleaseClosureSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
): ForgeReleaseClosureSummary {
  const responsibility = getFormalArtifactResponsibilitySummary(snapshot, projectId);
  const archiveProvenance = getArchiveProvenanceSummary(snapshot, projectId);

  if (archiveProvenance) {
    return {
      status: "archive-recorded",
      summary: "发布链已完成最终放行，归档沉淀已写回正式工件面。",
      detail: archiveProvenance.detail ?? "当前归档沉淀已进入正式工件面。",
      ownerLabel: null,
      ownerRoleLabel: null,
      nextAction: null,
      sourceCommandExecutionId: archiveProvenance.archiveCommandExecutionId ?? null,
      sourceCommandId: archiveProvenance.archiveCommandId ?? null,
      sourceCommandLabel: archiveProvenance.archiveCommandLabel ?? null,
      relatedRunId: archiveProvenance.archiveRunId ?? null,
      relatedRunLabel: archiveProvenance.archiveRunLabel ?? null,
      runtimeLabel: archiveProvenance.archiveRuntimeLabel ?? null
    };
  }

  return getActiveReleaseClosureSummary(snapshot, projectId, responsibility);
}

export function getReleaseClosureResponsibilitySummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
): ForgeReleaseClosureResponsibilitySummary | null {
  const releaseClosure = getReleaseClosureSummary(snapshot, projectId);

  if (!releaseClosure.summary) {
    return null;
  }

  const responsibility = getFormalArtifactResponsibilitySummary(snapshot, projectId);
  const archiveProvenance = getArchiveProvenanceSummary(snapshot, projectId);
  const meaningfulApprovalHandoffSummary =
    responsibility.approvalHandoff.summary &&
    responsibility.approvalHandoff.summary !== "当前无需等待审批后接棒。"
      ? responsibility.approvalHandoff.summary
      : null;
  const sourceLabel =
    releaseClosure.relatedRunLabel || releaseClosure.sourceCommandLabel
      ? `${releaseClosure.relatedRunLabel ?? "未记录来源运行"}${
          releaseClosure.sourceCommandLabel ? ` · 来源命令：${releaseClosure.sourceCommandLabel}` : ""
        }${releaseClosure.runtimeLabel ? ` · ${releaseClosure.runtimeLabel}` : ""}`
      : null;

  return {
    summary: [
      releaseClosure.summary,
      releaseClosure.nextAction ? `当前动作：${releaseClosure.nextAction}` : null,
      !releaseClosure.nextAction && responsibility.approvalHandoff.nextAction
        ? `确认后动作：${responsibility.approvalHandoff.nextAction}`
        : null,
      meaningfulApprovalHandoffSummary ? `确认后接棒：${meaningfulApprovalHandoffSummary}` : null,
      archiveProvenance?.summary ? `归档接棒：${archiveProvenance.summary}` : null,
      sourceLabel ? `来源：${sourceLabel}` : null
    ]
      .filter(Boolean)
      .join(" · "),
    detail: releaseClosure.detail ?? archiveProvenance?.detail ?? null,
    nextAction: releaseClosure.nextAction ?? responsibility.approvalHandoff.nextAction ?? null,
    sourceLabel
  };
}

function getActiveReleaseClosureSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined,
  responsibility = getFormalArtifactResponsibilitySummary(snapshot, projectId)
): ForgeReleaseClosureSummary {
  const primaryPendingApproval = responsibility.pendingApprovals[0] ?? null;

  if (primaryPendingApproval) {
    return {
      status: "pending-approval",
      summary: "发布链已经进入人工确认，等待最终放行口径。",
      detail: [
        primaryPendingApproval.detail,
        primaryPendingApproval.nextAction
          ? `确认责任：${primaryPendingApproval.nextAction}`
          : primaryPendingApproval.ownerLabel
            ? `确认责任：${primaryPendingApproval.ownerLabel}`
            : null,
        responsibility.approvalHandoff.summary !== "当前无需等待审批后接棒。"
          ? `确认后接棒：${responsibility.approvalHandoff.summary}`
          : null
      ]
        .filter(Boolean)
        .join(" · "),
      ownerLabel: primaryPendingApproval.ownerLabel ?? null,
      ownerRoleLabel: primaryPendingApproval.ownerRoleLabel ?? null,
      nextAction: primaryPendingApproval.nextAction ?? responsibility.approvalHandoff.nextAction,
      sourceCommandExecutionId: primaryPendingApproval.sourceCommandExecutionId ?? null,
      sourceCommandId: primaryPendingApproval.sourceCommandId ?? null,
      sourceCommandLabel: primaryPendingApproval.sourceCommandLabel ?? null,
      relatedRunId: primaryPendingApproval.relatedRunId ?? null,
      relatedRunLabel: primaryPendingApproval.relatedRunLabel ?? null,
      runtimeLabel: primaryPendingApproval.runtimeLabel ?? null
    };
  }

  if (responsibility.approvalHandoff.nextAction) {
    return {
      status: "approval-handoff",
      summary: responsibility.approvalHandoff.summary,
      detail: responsibility.approvalHandoff.detail,
      ownerLabel: responsibility.approvalHandoff.ownerLabel ?? null,
      ownerRoleLabel: responsibility.approvalHandoff.ownerRoleLabel ?? null,
      nextAction: responsibility.approvalHandoff.nextAction,
      sourceCommandExecutionId: responsibility.approvalHandoff.sourceCommandExecutionId ?? null,
      sourceCommandId: responsibility.approvalHandoff.sourceCommandId ?? null,
      sourceCommandLabel: responsibility.approvalHandoff.sourceCommandLabel ?? null,
      relatedRunId: responsibility.approvalHandoff.relatedRunId ?? null,
      relatedRunLabel: responsibility.approvalHandoff.relatedRunLabel ?? null,
      runtimeLabel: responsibility.approvalHandoff.runtimeLabel ?? null
    };
  }

  return {
    status: "idle",
    summary: "当前还没有进入放行收口链。",
    detail: "先补齐正式工件、门禁和人工确认，再进入最终放行与归档。",
    ownerLabel: null,
    ownerRoleLabel: null,
    nextAction: null,
    sourceCommandExecutionId: null,
    sourceCommandId: null,
    sourceCommandLabel: null,
    relatedRunId: null,
    relatedRunLabel: null,
    runtimeLabel: null
  };
}

function getBridgeHandoffGuidance(
  snapshot: ForgeDashboardSnapshot,
  bridgeHandoffStatus: ReturnType<typeof getBridgeHandoffState>["status"]
) {
  const architectOwnerLabel = getPreferredAgentDisplayLabel(snapshot, "architect", "架构负责人");
  const qaOwnerLabel = getPreferredAgentDisplayLabel(snapshot, "qa", "测试负责人");
  const releaseOwnerLabel = getPreferredAgentDisplayLabel(snapshot, "release", "发布负责人");

  if (bridgeHandoffStatus === "review-handoff") {
    return {
      ownerLabel: architectOwnerLabel,
      ownerRoleLabel: agentRoleLabel.architect,
      nextAction: `桥接研发执行已完成，先由${architectOwnerLabel} 发起规则审查并补齐规则审查记录。`
    };
  }

  if (bridgeHandoffStatus === "qa-handoff") {
    return {
      ownerLabel: qaOwnerLabel,
      ownerRoleLabel: agentRoleLabel.qa,
      nextAction: `桥接评审已移交 QA，先由${qaOwnerLabel} 补齐测试报告 / Playwright 回归记录。`
    };
  }

  if (bridgeHandoffStatus === "release-candidate") {
    return {
      ownerLabel: releaseOwnerLabel,
      ownerRoleLabel: agentRoleLabel.release,
      nextAction: `桥接链已进入放行候选，先由${releaseOwnerLabel} 收口交付说明 / 放行评审结论。`
    };
  }

  return null;
}

export function getApprovalTrace(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  if (!projectId) {
    return [];
  }

  const projectArtifacts = getProjectArtifacts(snapshot, projectId);
  const projectReviews = getArtifactReviewRecords(snapshot, projectId);
  const runtimeNotes = getProjectRuntimeNotes(snapshot, projectId);
  const releaseApprovalTask = snapshot.tasks.find(
    (task) => task.projectId === projectId && task.id === `task-${projectId}-release-approval`
  );
  const knowledgeTask = snapshot.tasks.find(
    (task) => task.projectId === projectId && task.id === `task-${projectId}-knowledge-card`
  );
  const escalationTask = snapshot.tasks.find(
    (task) =>
      task.projectId === projectId &&
      task.id.includes("escalation") &&
      task.status !== "done"
  );
  const escalationOwner =
    escalationTask
      ? snapshot.agents.find((agent) => agent.id === escalationTask.ownerAgentId) ?? null
      : null;
  const latestRunEvent = getRunTimeline(snapshot, { projectId })
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const bridgeReviewContext = getBridgeReviewCommandContext(snapshot, projectId);
  const currentHandoff = getCurrentHandoffSummary(snapshot, projectId);
  const escalationOwnerLabel = escalationTask
    ? getAgentDisplayLabelById(
        snapshot,
        escalationTask.ownerAgentId,
        getPreferredAgentDisplayLabel(snapshot, "pm", "项目负责人")
      )
    : getPreferredAgentDisplayLabel(snapshot, "pm", "项目负责人");

  const trace = [
    ...(runtimeNotes.length > 0
      ? runtimeNotes.slice(0, 1).map((runtimeNote) => ({
          kind: "runtime" as const,
          label: "最新运行信号",
          statusLabel: "已留痕",
          detail: runtimeNote,
          createdAt: latestRunEvent?.createdAt ?? "当前",
          sourceCommandExecutionId: bridgeReviewContext?.sourceCommandExecutionId ?? null,
          sourceCommandId: bridgeReviewContext?.sourceCommandId ?? null,
          relatedRunId: bridgeReviewContext?.relatedRunId ?? null,
          relatedRunLabel: bridgeReviewContext?.relatedRunLabel ?? null,
          runtimeLabel: bridgeReviewContext?.runtimeLabel ?? null,
          runtimeExecutionBackendLabel: bridgeReviewContext?.runtimeExecutionBackendLabel ?? null,
          runtimeModelProviderLabel: bridgeReviewContext?.runtimeModelProviderLabel ?? null,
          runtimeModelExecutionDetail: bridgeReviewContext?.runtimeModelExecutionDetail ?? null,
          ownerLabel: escalationTask ? escalationOwnerLabel : "本地执行器",
          ownerRoleLabel: escalationOwner ? agentRoleLabel[escalationOwner.role] : "运行时",
          nextAction: escalationTask?.title ?? releaseApprovalTask?.title ?? "继续推进评审与放行",
          slaLabel: escalationTask?.priority === "P0" ? "SLA 2 小时" : "SLA 4 小时",
          breachLabel: escalationTask ? "已违约" : "正常",
          escalationTrigger: escalationTask ? "运行信号异常或门禁阻塞" : "运行信号持续异常",
          escalationLabel: escalationTask
            ? `若未收敛，升级给 ${escalationOwnerLabel} 处理`
            : `若运行信号异常，升级给 ${getPreferredAgentDisplayLabel(snapshot, "pm", "项目负责人")} 收口`,
          escalated: Boolean(escalationTask),
          artifactType: null
        }))
      : escalationTask
        ? [
            {
              kind: "runtime" as const,
              label: "最新运行信号",
              statusLabel: "已升级",
              detail: escalationTask.summary,
              createdAt: "当前",
              sourceCommandExecutionId: bridgeReviewContext?.sourceCommandExecutionId ?? null,
              sourceCommandId: bridgeReviewContext?.sourceCommandId ?? null,
              relatedRunId: bridgeReviewContext?.relatedRunId ?? null,
              relatedRunLabel: bridgeReviewContext?.relatedRunLabel ?? null,
              runtimeLabel: bridgeReviewContext?.runtimeLabel ?? null,
              runtimeExecutionBackendLabel: bridgeReviewContext?.runtimeExecutionBackendLabel ?? null,
              runtimeModelProviderLabel: bridgeReviewContext?.runtimeModelProviderLabel ?? null,
              runtimeModelExecutionDetail: bridgeReviewContext?.runtimeModelExecutionDetail ?? null,
              ownerLabel: escalationOwnerLabel,
              ownerRoleLabel: escalationOwner ? agentRoleLabel[escalationOwner.role] : "产品经理",
              nextAction: escalationTask.title,
              slaLabel: escalationTask.priority === "P0" ? "SLA 2 小时" : "SLA 4 小时",
              breachLabel: "已违约",
              escalationTrigger: "门禁失败或运行信号异常",
              escalationLabel: `若未收敛，升级给 ${escalationOwnerLabel} 处理`,
              escalated: true,
              artifactType: null
            }
          ]
        : []),
    ...(["release-brief", "review-decision", "release-audit"] as const).flatMap((artifactType) => {
      const artifact = projectArtifacts.find((item) => item.type === artifactType);

      if (!artifact) {
        return [];
      }

      const artifactCommandContext = getArtifactCommandContext(snapshot, projectId, artifact.type);
      const matchedReview = projectReviews.find((item) => item.artifact.id === artifact.id);
      const statusLabel = matchedReview
        ? artifactReviewDecisionLabel[matchedReview.review.decision]
        : artifactStatusLabels[artifact.status];
      const detail = matchedReview?.review.summary ?? `${artifact.title} 当前处于${artifactStatusLabels[artifact.status]}。`;
      const createdAt = matchedReview?.review.reviewedAt ?? artifact.updatedAt;
      const ownerLabel =
        (matchedReview?.reviewer
          ? getForgeAgentDisplayLabel(matchedReview.reviewer)
          : null) ??
        getAgentDisplayLabelById(snapshot, artifact.ownerAgentId, artifact.ownerAgentId);
      const ownerRole =
        matchedReview?.reviewer?.role ??
        snapshot.agents.find((agent) => agent.id === artifact.ownerAgentId)?.role ??
        null;
      const nextAction =
        artifact.type === "release-brief" || artifact.type === "review-decision"
          ? releaseApprovalTask?.title ??
            currentHandoff.nextAction ??
            "确认交付说明与放行口径"
          : knowledgeTask?.status === "done"
            ? "归档沉淀已完成"
            : knowledgeTask?.title ?? "继续完成知识沉淀";
      const escalationLabel = (() => {
        const escalationRoles = artifactEscalationRoleMap[artifact.type];
        const escalationAgent = getAgentByRole(snapshot.agents, escalationRoles);

        if (!escalationAgent) {
          return "若超时未处理，升级给项目负责人";
        }

        return `若超时未处理，升级给 ${getForgeAgentDisplayLabel(escalationAgent)}`;
      })();
      const escalationTrigger =
        artifact.type === "release-brief"
          ? "交付说明待确认超时"
          : artifact.type === "review-decision"
            ? "放行评审超时或结论被打回"
            : "归档审计超时或沉淀未完成";
      const breachLabel = getApprovalBreachLabel({
        escalated: Boolean(escalationTask),
        decision: matchedReview?.review.decision ?? null,
        statusLabel
      });

      return [
        {
          kind: artifact.type === "release-audit" ? ("audit" as const) : ("review" as const),
          label: artifactTypeLabels[artifact.type],
          statusLabel,
          detail,
          createdAt,
          sourceCommandExecutionId: artifactCommandContext?.sourceCommandExecutionId ?? null,
          sourceCommandId: artifactCommandContext?.sourceCommandId ?? null,
          relatedRunId: artifactCommandContext?.relatedRunId ?? null,
          relatedRunLabel: artifactCommandContext?.relatedRunLabel ?? null,
          runtimeLabel: artifactCommandContext?.runtimeLabel ?? null,
          runtimeExecutionBackendLabel: artifactCommandContext?.runtimeExecutionBackendLabel ?? null,
          runtimeModelProviderLabel: artifactCommandContext?.runtimeModelProviderLabel ?? null,
          runtimeModelExecutionDetail: artifactCommandContext?.runtimeModelExecutionDetail ?? null,
          ownerLabel,
          ownerRoleLabel: ownerRole ? agentRoleLabel[ownerRole] : "未指定",
          nextAction,
          slaLabel: artifactSlaLabelMap[artifact.type],
          breachLabel,
          escalationTrigger,
          escalationLabel,
          escalated: Boolean(escalationTask),
          artifactType: artifact.type
        }
      ];
    })
  ];

  const sorted = trace.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (sorted.length > 0) {
    return sorted;
  }

  const pmAgent =
    getPreferredAgent(snapshot, "pm") ??
    snapshot.agents[0] ??
    null;

  return [
    {
      kind: "review" as const,
      label: "放行审批尚未启动",
      statusLabel: "待形成",
      detail: "当前还没有形成交付说明与放行评审证据，暂时不能进入人工放行。",
      createdAt: "当前",
      sourceCommandExecutionId: bridgeReviewContext?.sourceCommandExecutionId ?? null,
      sourceCommandId: bridgeReviewContext?.sourceCommandId ?? null,
      relatedRunId: bridgeReviewContext?.relatedRunId ?? null,
      relatedRunLabel: bridgeReviewContext?.relatedRunLabel ?? null,
      runtimeLabel: bridgeReviewContext?.runtimeLabel ?? null,
      runtimeExecutionBackendLabel: bridgeReviewContext?.runtimeExecutionBackendLabel ?? null,
      runtimeModelProviderLabel: bridgeReviewContext?.runtimeModelProviderLabel ?? null,
      runtimeModelExecutionDetail: bridgeReviewContext?.runtimeModelExecutionDetail ?? null,
      ownerLabel: getAgentDisplayLabelOrFallback(pmAgent, "项目负责人"),
      ownerRoleLabel: pmAgent?.role ? agentRoleLabel[pmAgent.role] : "产品经理",
      nextAction: "先补齐交付说明与放行评审",
      slaLabel: "SLA 4 小时",
      breachLabel: "临近 SLA",
      escalationTrigger: "迟迟未形成 release 证据",
      escalationLabel: `若超时未处理，升级给 ${getPreferredAgentDisplayLabel(snapshot, "pm", "项目负责人")}`,
      escalated: false,
      artifactType: null
    }
  ];
}

export function getProjectTaskQueue(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  if (!projectId) {
    return [];
  }

  return snapshot.tasks
    .filter((task) => task.projectId === projectId && task.status !== "done")
    .map((task) => {
      const evidenceContext = getTaskEvidenceContext(snapshot, task);
      const runContext = getTaskRelatedRunContext(snapshot, task);
      const retryContext = getTaskRetryCommandContext(snapshot, task);
      const retryRunnerContext = getTaskRetryRunnerContext(task);
      const unifiedRetryContext = getTaskUnifiedRetryContext(task);
      const ownerLabel = getTaskOwnerDisplayLabel(snapshot, task);
      const remediationSummary = getTaskRemediationSummary({
        task,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        relatedRunId: runContext.relatedRunId,
        latestFailure: getLatestRunFailure(snapshot, {
          projectId: task.projectId,
          runId: runContext.relatedRunId ?? undefined
        })
      });
      const remediationAction = getTaskRemediationAction({
        ownerLabel,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        relatedRunLabel: runContext.relatedRunLabel,
        runtimeModelProviderLabel: runContext.runtimeModelProviderLabel,
        runtimeModelExecutionDetail: runContext.runtimeModelExecutionDetail,
        task
      });

      return {
        ...task,
        sourceCommandExecutionId: evidenceContext.sourceCommandExecutionId,
        sourceCommandLabel: evidenceContext.sourceCommandLabel,
        relatedArtifactLabels: evidenceContext.relatedArtifactLabels,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        evidenceAction: evidenceContext.evidenceAction,
        relatedRunId: runContext.relatedRunId,
        relatedRunLabel: runContext.relatedRunLabel,
        runtimeLabel: runContext.runtimeLabel,
        runtimeExecutionBackendLabel: runContext.runtimeExecutionBackendLabel,
        runtimeModelProviderLabel: runContext.runtimeModelProviderLabel,
        runtimeModelExecutionDetail: runContext.runtimeModelExecutionDetail,
        runtimeCapabilityDetails: runContext.runtimeCapabilityDetails,
        remediationOwnerLabel: ownerLabel,
        remediationSummary,
        remediationAction,
        retryCommandId: retryContext.retryCommandId,
        retryCommandLabel: retryContext.retryCommandLabel,
        retryApiPath: getTaskRetryApiPath(task),
        retryRunnerArgs: retryRunnerContext.retryRunnerArgs,
        retryRunnerCommand: retryRunnerContext.retryRunnerCommand,
        unifiedRetryApiPath: unifiedRetryContext.unifiedRetryApiPath,
        unifiedRetryRunnerArgs: unifiedRetryContext.unifiedRetryRunnerArgs,
        unifiedRetryRunnerCommand: unifiedRetryContext.unifiedRetryRunnerCommand,
        summary: [
          task.summary,
          evidenceContext.sourceCommandLabel
            ? `来源命令：${evidenceContext.sourceCommandLabel}。`
            : "",
          evidenceContext.evidenceAction,
          runContext.runtimeLabel ? `运行信号：${runContext.runtimeLabel}` : "",
          runContext.runtimeCapabilityDetails.length > 0
            ? `运行证据：${runContext.runtimeCapabilityDetails.join(" / ")}`
            : "",
          remediationSummary ? `整改建议：${remediationSummary}` : "",
          remediationAction ? `整改动作：${remediationAction}` : "",
          retryContext.retryCommandLabel ? `恢复命令：${retryContext.retryCommandLabel}` : "",
          retryRunnerContext.retryRunnerCommand ? `Runner 回放：${retryRunnerContext.retryRunnerCommand}` : ""
        ]
          .filter(Boolean)
          .join(" ")
      };
    })
    .sort((left, right) => {
      const priorityDelta = taskPriorityOrder[left.priority] - taskPriorityOrder[right.priority];

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return taskStatusOrder[left.status] - taskStatusOrder[right.status];
    });
}

export function getExecutionFocus(snapshot: ForgeDashboardSnapshot) {
  return (
    snapshot.runs.find((run) => run.state === "running") ??
    snapshot.runs.find((run) => run.state === "blocked") ??
    snapshot.runs[0] ??
    null
  );
}

export function getRunTimeline(
  snapshot: ForgeDashboardSnapshot,
  options: { projectId?: string | null; runId?: string | null } = {}
) {
  return snapshot.runEvents.filter((event) => {
    const matchesProject = options.projectId ? event.projectId === options.projectId : true;
    const matchesRun = options.runId ? event.runId === options.runId : true;

    return matchesProject && matchesRun;
  });
}

export function getLatestRunFailure(
  snapshot: ForgeDashboardSnapshot,
  options: { projectId?: string | null; runId?: string | null } = {}
): ForgeRunEvent | null {
  return (
    getRunTimeline(snapshot, options).find((event) => event.type === "failure") ??
    null
  );
}

function getProjectForRun(snapshot: ForgeDashboardSnapshot, run: ForgeRun) {
  if (run.projectId) {
    const matchedProject = snapshot.projects.find((project) => project.id === run.projectId);

    if (matchedProject) {
      return matchedProject;
    }
  }

  return getActiveProject(snapshot.projects, snapshot.activeProjectId) ?? null;
}

function formatRunRuntimeLabel(run: ForgeRun) {
  const evidenceCheck = run.outputChecks.find((check) => check.name === "evidence");
  const evidenceStatus =
    (typeof evidenceCheck?.status === "string" && evidenceCheck.status.trim()) ||
    (() => {
      const outputMode = run.outputMode?.trim() ?? "";

      if (!outputMode) {
        return "";
      }

      if (outputMode.startsWith("contract-")) {
        return "contract";
      }

      if (outputMode.endsWith("-executed")) {
        return "executed";
      }

      if (outputMode.endsWith("-ready")) {
        return "tool-ready";
      }

      return "";
    })();
  const parts = [
    run.outputMode ? `Runtime:${run.outputMode}` : "",
    evidenceStatus ? `Evidence:${evidenceStatus}` : "",
    run.outputChecks.length > 0
      ? `checks:${run.outputChecks.map((check) => `${check.name}=${check.status}`).join(", ")}`
      : ""
  ].filter(Boolean);

  return parts.join(" | ");
}

function getRunModelExecutionDetail(run: ForgeRun) {
  const modelExecutionCheck = run.outputChecks.find((check) => check.name === "model-execution");

  if (typeof modelExecutionCheck?.summary === "string" && modelExecutionCheck.summary.trim()) {
    return modelExecutionCheck.summary.trim();
  }

  return "";
}

function getRunModelExecutionProvider(run: ForgeRun) {
  const detail = getRunModelExecutionDetail(run);

  if (!detail) {
    return "";
  }

  return detail.split(" · ")[0]?.trim() ?? "";
}

function getRunExecutionBackendLabelFromDetail(detail?: string | null) {
  if (!detail) {
    return "";
  }

  const backendSegment = detail
    .split(" · ")
    .find((part) => part.trim().startsWith("后端 "));

  return backendSegment?.replace(/^后端\s+/, "").trim() ?? "";
}

function getProjectRuntimeNotes(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return snapshot.runs
    .filter((run) => {
      if (projectId && run.projectId !== projectId) {
        return false;
      }

      return Boolean(run.outputMode) || run.outputChecks.length > 0;
    })
    .map((run) => formatRunRuntimeLabel(run))
    .filter(Boolean)
    .filter((note, index, items) => items.indexOf(note) === index);
}

function getProjectRuntimeCapabilityDetails(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  return snapshot.runs
    .filter((run) => {
      if (projectId && run.projectId !== projectId) {
        return false;
      }

      return run.outputChecks.some((check) => Boolean(check.summary));
    })
    .flatMap((run) =>
      run.outputChecks
        .filter((check) => Boolean(check.summary))
        .map((check) => {
          const prefix = run.outputMode ? `Runtime:${run.outputMode}` : run.executor;

          return `${prefix} · ${check.name}=${check.status} · ${check.summary}`;
        })
    )
    .filter((detail, index, items) => items.indexOf(detail) === index);
}

function getSourceCommandContext(
  snapshot: ForgeDashboardSnapshot,
  taskId: string
) {
  const commandExecution = [...snapshot.commandExecutions]
    .filter((execution) => execution.followUpTaskIds.includes(taskId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (!commandExecution) {
    return null;
  }

  const command = snapshot.commands.find((item) => item.id === commandExecution.commandId) ?? null;

  return {
    commandExecution,
    command,
    label: command?.name ?? commandExecution.commandId
  };
}

export function getTaskEvidenceContext(
  snapshot: ForgeDashboardSnapshot,
  task: ForgeTask
) {
  const sourceCommand = getSourceCommandContext(snapshot, task.id);
  const contract = sourceCommand?.command
    ? getForgeCommandContract(sourceCommand.command.type)
    : null;
  const expectedArtifactTypes = contract?.outputArtifacts ?? [];
  const projectArtifacts = getProjectArtifacts(snapshot, task.projectId);
  const relatedArtifacts = expectedArtifactTypes
    .map((type) =>
      [...projectArtifacts]
        .filter((artifact) => artifact.type === type)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
    )
    .filter((artifact): artifact is ForgeArtifact => Boolean(artifact));
  const relatedArtifactLabels = relatedArtifacts.map(
    (artifact) => `${artifactTypeLabels[artifact.type]}（${artifactStatusLabels[artifact.status]}）`
  );
  const missingArtifactLabels = expectedArtifactTypes
    .filter((type) => !relatedArtifacts.some((artifact) => artifact.type === type))
    .map((type) => artifactTypeLabels[type]);
  const runContext = getTaskRelatedRunContext(snapshot, task);

  let evidenceAction = "关联证据：系统自动注入";

  if (expectedArtifactTypes.length > 0) {
    evidenceAction =
      missingArtifactLabels.length > 0
        ? `证据缺口：${missingArtifactLabels.join(" / ")}`
        : `关联证据：${relatedArtifactLabels.join(" / ")}`;
  }

  const latestFailure = getLatestRunFailure(snapshot, {
    projectId: task.projectId,
    runId: runContext.relatedRunId ?? undefined
  });
  const remediationSummary = getTaskRemediationSummary({
    task,
    missingArtifactLabels,
    relatedRunId: runContext.relatedRunId,
    latestFailure
  });

  return {
    sourceCommandExecutionId: sourceCommand?.commandExecution.id,
    sourceCommandLabel: sourceCommand?.label,
    relatedArtifacts,
    relatedArtifactLabels,
    missingArtifactLabels,
    evidenceAction,
    relatedRunId: runContext.relatedRunId,
    relatedRunLabel: runContext.relatedRunLabel,
    runtimeLabel: runContext.runtimeLabel,
    runtimeExecutionBackendLabel: runContext.runtimeExecutionBackendLabel,
    runtimeModelProviderLabel: runContext.runtimeModelProviderLabel,
    runtimeModelExecutionDetail: runContext.runtimeModelExecutionDetail,
    remediationSummary
  };
}

function getTaskRelatedRunContext(
  snapshot: ForgeDashboardSnapshot,
  task: ForgeTask
) {
  const sourceCommand = getSourceCommandContext(snapshot, task.id);
  const contract = sourceCommand?.command
    ? getForgeCommandContract(sourceCommand.command.type)
    : null;
  const projectRuns = snapshot.runs.filter((run) => run.projectId === task.projectId);

  const matcher = (() => {
    switch (contract?.type) {
      case "gate.run":
        return (run: ForgeRun) =>
          run.executor.toLowerCase().includes("playwright") ||
          (run.outputMode ?? "").includes("playwright") ||
          run.title.includes("回归");
      case "review.run":
        return (run: ForgeRun) =>
          run.executor.toLowerCase().includes("review") ||
          (run.outputMode ?? "").includes("review") ||
          run.title.includes("审查");
      case "execution.start":
        return (run: ForgeRun) =>
          run.executor.toLowerCase().includes("codex") ||
          (run.outputMode ?? "").includes("codex") ||
          run.title.includes("补丁");
      case "release.prepare":
      case "release.approve":
      case "archive.capture":
        return (run: ForgeRun) =>
          run.executor.includes("Release") ||
          run.executor.includes("交付") ||
          (run.outputMode ?? "").includes("release");
      default:
        return (_run: ForgeRun) => false;
    }
  })();

  const relatedRun = [...projectRuns]
    .filter(matcher)
    .sort((left, right) => {
      const leftState = left.state === "blocked" ? 0 : left.state === "running" ? 1 : 2;
      const rightState = right.state === "blocked" ? 0 : right.state === "running" ? 1 : 2;

      if (leftState !== rightState) {
        return leftState - rightState;
      }

      return right.title.localeCompare(left.title);
    })[0];

  const runtimeModelExecutionDetail = relatedRun ? getRunModelExecutionDetail(relatedRun) : "";
  const runtimeModelProviderLabel = relatedRun ? getRunModelExecutionProvider(relatedRun) : "";
  const runtimeExecutionBackendLabel = relatedRun
    ? getRunExecutionBackendLabelFromDetail(runtimeModelExecutionDetail)
    : "";

  return {
    relatedRunId: relatedRun?.id,
    relatedRunLabel: relatedRun ? `${relatedRun.title} · ${relatedRun.executor}` : null,
    taskPackId: relatedRun?.taskPackId ?? null,
    taskPackLabel:
      relatedRun?.taskPackId
        ? snapshot.artifacts.find((artifact) => artifact.id === relatedRun.taskPackId)?.title ?? null
        : null,
    runtimeLabel: relatedRun ? formatRunRuntimeLabel(relatedRun) : null,
    runtimeExecutionBackendLabel: runtimeExecutionBackendLabel || null,
    runtimeModelProviderLabel: runtimeModelProviderLabel || null,
    runtimeModelExecutionDetail: runtimeModelExecutionDetail || null,
    runtimeCapabilityDetails: relatedRun
      ? relatedRun.outputChecks
          .filter((check) => Boolean(check.summary))
          .map((check) => {
            const prefix = relatedRun.outputMode
              ? `Runtime:${relatedRun.outputMode}`
              : relatedRun.executor;

            return `${prefix} · ${check.name}=${check.status} · ${check.summary}`;
          })
      : []
  };
}

function getTaskRemediationSummary(input: {
  task: ForgeTask;
  missingArtifactLabels: string[];
  relatedRunId?: string;
  latestFailure?: ForgeRunEvent | null;
}) {
  const steps: string[] = [];

  if (input.latestFailure?.summary) {
    steps.push(`先处理运行失败：${input.latestFailure.summary}`);
  }

  if (input.missingArtifactLabels.length > 0) {
    steps.push(`优先补齐：${input.missingArtifactLabels.join(" / ")}`);
  }

  if (steps.length === 0 && input.relatedRunId) {
    steps.push("先复跑关联运行并确认输出证据");
  }

  if (steps.length === 0 && input.task.status === "blocked") {
    steps.push("先解除当前阻塞，再继续推进该任务");
  }

  return steps.join(" · ");
}

function getTaskRemediationAction(input: {
  ownerLabel: string;
  missingArtifactLabels: string[];
  relatedRunLabel?: string | null;
  runtimeModelProviderLabel?: string | null;
  runtimeModelExecutionDetail?: string | null;
  task: ForgeTask;
}) {
  const providerLabel =
    input.runtimeModelProviderLabel ??
    input.runtimeModelExecutionDetail ??
    null;
  const providerSuffix = providerLabel ? ` · 模型执行器：${providerLabel}` : "";
  const executionBackendLabel = getRunExecutionBackendLabelFromDetail(
    input.runtimeModelExecutionDetail
  );
  const backendSuffix = executionBackendLabel ? ` · 执行后端：${executionBackendLabel}` : "";

  if (input.missingArtifactLabels.length > 0) {
    return `由 ${input.ownerLabel} 补齐 ${input.missingArtifactLabels.join(" / ")}${providerSuffix}${backendSuffix}`;
  }

  if (input.relatedRunLabel) {
    return `由 ${input.ownerLabel} 复跑 ${input.relatedRunLabel}${providerSuffix}${backendSuffix}`;
  }

  if (input.task.status === "blocked") {
    return `由 ${input.ownerLabel} 解除当前阻塞后继续推进${providerSuffix}${backendSuffix}`;
  }

  return `由 ${input.ownerLabel} 继续推进 ${input.task.title}${providerSuffix}${backendSuffix}`;
}

function getTaskRetryCommandContext(
  snapshot: ForgeDashboardSnapshot,
  task: ForgeTask
) {
  if (task.id.includes("runner-gates") || task.title.includes("研发执行")) {
    const command = snapshot.commands.find((item) => item.id === "command-execution-start");

    return {
      retryCommandId: command?.id ?? "command-execution-start",
      retryCommandLabel: command?.name ?? "启动研发执行"
    };
  }

  if (task.id.includes("component-assembly") || task.title.includes("组件装配")) {
    const command = snapshot.commands.find((item) => item.id === "command-component-assemble");

    return {
      retryCommandId: command?.id ?? "command-component-assemble",
      retryCommandLabel: command?.name ?? "补齐组件装配"
    };
  }

  const sourceCommand = getSourceCommandContext(snapshot, task.id);

  return {
    retryCommandId: sourceCommand?.commandExecution.commandId ?? null,
    retryCommandLabel: sourceCommand?.label ?? null
  };
}

function getTaskTaskPackContext(snapshot: ForgeDashboardSnapshot, task: ForgeTask) {
  const sourceCommand = getSourceCommandContext(snapshot, task.id);
  const latestProjectTaskPack = snapshot.artifacts
    .filter(
      (artifact) =>
        artifact.projectId === task.projectId &&
        artifact.type === "task-pack" &&
        artifact.status === "ready"
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  const taskPackId =
    sourceCommand?.commandExecution.taskPackId ??
    getTaskRelatedRunContext(snapshot, task).taskPackId ??
    (task.id.includes("runner-gates") ? latestProjectTaskPack?.id ?? null : null) ??
    null;
  const taskPackArtifact = taskPackId
    ? snapshot.artifacts.find((artifact) => artifact.id === taskPackId)
    : null;

  return {
    taskPackId,
    taskPackLabel: taskPackArtifact?.title ?? null
  };
}

function getTaskComponentAssemblyContext(
  snapshot: ForgeDashboardSnapshot,
  task: ForgeTask,
  taskPackId?: string | null
) {
  const linkedComponentIds = snapshot.projectAssetLinks
    .filter((link) => link.projectId === task.projectId && link.targetType === "component")
    .map((link) => link.targetId);
  const linkedComponentLabels = linkedComponentIds
    .map((componentId) => snapshot.components.find((component) => component.id === componentId)?.title ?? null)
    .filter((label): label is string => Boolean(label));
  const linkedComponentIdSet = new Set(linkedComponentIds);
  const pendingComponents = getTaskPackAssemblySuggestions(snapshot, task.projectId, taskPackId)
    .items
    .filter((item) => !linkedComponentIdSet.has(item.component.id))
    .map((item) => item.component);
  const pendingComponentLabels = getTaskPackAssemblySuggestions(snapshot, task.projectId, taskPackId)
    .items
    .filter((item) => !linkedComponentIdSet.has(item.component.id))
    .map((item) => item.component.title);
  const pendingComponentIds = pendingComponents.map((component) => component.id);
  const componentAssemblyAction =
    pendingComponentLabels.length > 0
      ? `待装配组件：${pendingComponentLabels.join(" / ")}`
      : linkedComponentLabels.length > 0
        ? `已装配组件：${linkedComponentLabels.join(" / ")}`
        : "当前 TaskPack 暂无待装配组件";

  return {
    linkedComponentIds,
    linkedComponentLabels,
    pendingComponentIds,
    pendingComponentLabels,
    componentAssemblyAction
  };
}

function getTaskRetryRunnerContext(task: ForgeTask, taskPackId?: string | null) {
  const taskPackArgs = taskPackId ? ["--taskpack-id", taskPackId] : [];

  return {
    retryRunnerArgs: ["--task-id", task.id, "--project-id", task.projectId, ...taskPackArgs],
    retryRunnerCommand: `npm run runner:forge -- --task-id ${task.id} --project-id ${task.projectId}${
      taskPackId ? ` --taskpack-id ${taskPackId}` : ""
    }`
  };
}

function getTaskUnifiedRetryContext(task: ForgeTask, taskPackId?: string | null) {
  const taskPackArgs = taskPackId ? ["--taskpack-id", taskPackId] : [];

  return {
    unifiedRetryApiPath: "/api/forge/remediations/retry",
    unifiedRetryRunnerArgs: ["--remediation-id", task.id, "--project-id", task.projectId, ...taskPackArgs],
    unifiedRetryRunnerCommand: `npm run runner:forge -- --remediation-id ${task.id} --project-id ${task.projectId}${
      taskPackId ? ` --taskpack-id ${taskPackId}` : ""
    }`
  };
}

function getTaskRetryApiPath(task: ForgeTask) {
  return task.id.includes("escalation")
    ? "/api/forge/escalations/retry"
    : "/api/forge/tasks/retry";
}

export function getExecutionTaskQueue(snapshot: ForgeDashboardSnapshot) {
  return snapshot.tasks
    .filter((task) => task.status !== "done")
    .map((task) => {
      const evidenceContext = getTaskEvidenceContext(snapshot, task);
      const runContext = getTaskRelatedRunContext(snapshot, task);
      const retryContext = getTaskRetryCommandContext(snapshot, task);
      const taskPackContext = getTaskTaskPackContext(snapshot, task);
      const componentAssemblyContext = getTaskComponentAssemblyContext(
        snapshot,
        task,
        taskPackContext.taskPackId
      );
      const retryRunnerContext = getTaskRetryRunnerContext(task, taskPackContext.taskPackId);
      const unifiedRetryContext = getTaskUnifiedRetryContext(task, taskPackContext.taskPackId);
      const ownerLabel = getTaskOwnerDisplayLabel(snapshot, task);
      const remediationSummary = getTaskRemediationSummary({
        task,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        relatedRunId: runContext.relatedRunId,
        latestFailure: getLatestRunFailure(snapshot, {
          projectId: task.projectId,
          runId: runContext.relatedRunId ?? undefined
        })
      });
      const remediationAction = getTaskRemediationAction({
        ownerLabel,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        relatedRunLabel: runContext.relatedRunLabel,
        runtimeModelProviderLabel: runContext.runtimeModelProviderLabel,
        runtimeModelExecutionDetail: runContext.runtimeModelExecutionDetail,
        task
      });

      return {
        task,
        project: snapshot.projects.find((project) => project.id === task.projectId) ?? null,
        priorityLabel: task.priority,
        sourceCommandExecutionId: evidenceContext.sourceCommandExecutionId,
        sourceCommandLabel: evidenceContext.sourceCommandLabel,
        relatedArtifactLabels: evidenceContext.relatedArtifactLabels,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        evidenceAction: evidenceContext.evidenceAction,
        relatedRunId: runContext.relatedRunId,
        relatedRunLabel: runContext.relatedRunLabel,
        runtimeLabel: runContext.runtimeLabel,
        runtimeExecutionBackendLabel: runContext.runtimeExecutionBackendLabel,
        runtimeModelProviderLabel: runContext.runtimeModelProviderLabel,
        runtimeModelExecutionDetail: runContext.runtimeModelExecutionDetail,
        runtimeCapabilityDetails: runContext.runtimeCapabilityDetails,
        taskPackId: taskPackContext.taskPackId,
        taskPackLabel: taskPackContext.taskPackLabel,
        linkedComponentIds: componentAssemblyContext.linkedComponentIds,
        linkedComponentLabels: componentAssemblyContext.linkedComponentLabels,
        pendingComponentIds: componentAssemblyContext.pendingComponentIds,
        pendingComponentLabels: componentAssemblyContext.pendingComponentLabels,
        componentAssemblyAction: componentAssemblyContext.componentAssemblyAction,
        remediationOwnerLabel: ownerLabel,
        remediationSummary,
        remediationAction,
        retryCommandId: retryContext.retryCommandId,
        retryCommandLabel: retryContext.retryCommandLabel,
        retryApiPath: getTaskRetryApiPath(task),
        retryRunnerArgs: retryRunnerContext.retryRunnerArgs,
        retryRunnerCommand: retryRunnerContext.retryRunnerCommand,
        unifiedRetryApiPath: unifiedRetryContext.unifiedRetryApiPath,
        unifiedRetryRunnerArgs: unifiedRetryContext.unifiedRetryRunnerArgs,
        unifiedRetryRunnerCommand: unifiedRetryContext.unifiedRetryRunnerCommand,
        action:
          task.status === "blocked"
            ? `先解除阻塞，再回到 ${task.stage}。`
            : task.status === "in-progress"
              ? `继续推进 ${task.title}，完成后进入下一次交接。`
              : `尽快领取 ${task.title}，避免影响 ${task.stage}。`
      };
    })
    .map((item) => ({
      ...item,
      action: [
        item.action,
        item.sourceCommandLabel ? `来源命令：${item.sourceCommandLabel}。` : "",
        item.evidenceAction,
        item.runtimeLabel ? `运行信号：${item.runtimeLabel}` : "",
        item.runtimeCapabilityDetails.length > 0
          ? `运行证据：${item.runtimeCapabilityDetails.join(" / ")}`
          : "",
        item.remediationSummary ? `整改建议：${item.remediationSummary}` : "",
        item.remediationAction ? `整改动作：${item.remediationAction}` : "",
        item.retryCommandLabel ? `恢复命令：${item.retryCommandLabel}` : "",
        item.retryRunnerCommand ? `Runner 回放：${item.retryRunnerCommand}` : ""
      ]
        .filter(Boolean)
        .join(" ")
    }))
    .sort((left, right) => {
      return taskPriorityOrder[left.priorityLabel] - taskPriorityOrder[right.priorityLabel];
    });
}

export function getTaskDispatchQueue(snapshot: ForgeDashboardSnapshot) {
  return snapshot.tasks
    .filter((task) => task.status !== "done")
    .map((task) => {
      const project = snapshot.projects.find((item) => item.id === task.projectId) ?? null;
      const ownerAgent = snapshot.agents.find((item) => item.id === task.ownerAgentId) ?? null;
      const evidenceContext = getTaskEvidenceContext(snapshot, task);
      const runContext = getTaskRelatedRunContext(snapshot, task);
      const retryContext = getTaskRetryCommandContext(snapshot, task);
      const taskPackContext = getTaskTaskPackContext(snapshot, task);
      const componentAssemblyContext = getTaskComponentAssemblyContext(
        snapshot,
        task,
        taskPackContext.taskPackId
      );
      const retryRunnerContext = getTaskRetryRunnerContext(task, taskPackContext.taskPackId);
      const unifiedRetryContext = getTaskUnifiedRetryContext(task, taskPackContext.taskPackId);
      const ownerLabel =
        getAgentDisplayLabelOrFallback(ownerAgent, null) ??
        getTaskOwnerDisplayLabel(snapshot, task);
      const remediationSummary = getTaskRemediationSummary({
        task,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        relatedRunId: runContext.relatedRunId,
        latestFailure: getLatestRunFailure(snapshot, {
          projectId: task.projectId,
          runId: runContext.relatedRunId ?? undefined
        })
      });
      const remediationAction = getTaskRemediationAction({
        ownerLabel,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        relatedRunLabel: runContext.relatedRunLabel,
        runtimeModelProviderLabel: runContext.runtimeModelProviderLabel,
        runtimeModelExecutionDetail: runContext.runtimeModelExecutionDetail,
        task
      });
      const bridgeHandoff = getBridgeHandoffState(snapshot, task.projectId);

      return {
        task,
        project,
        ownerAgent,
        sourceCommandExecutionId: evidenceContext.sourceCommandExecutionId,
        sourceCommandLabel: evidenceContext.sourceCommandLabel,
        relatedArtifactLabels: evidenceContext.relatedArtifactLabels,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        evidenceAction: evidenceContext.evidenceAction,
        relatedRunId: runContext.relatedRunId,
        relatedRunLabel: runContext.relatedRunLabel,
        runtimeLabel: runContext.runtimeLabel,
        runtimeExecutionBackendLabel: runContext.runtimeExecutionBackendLabel,
        runtimeModelProviderLabel: runContext.runtimeModelProviderLabel,
        runtimeModelExecutionDetail: runContext.runtimeModelExecutionDetail,
        runtimeCapabilityDetails: runContext.runtimeCapabilityDetails,
        taskPackId: taskPackContext.taskPackId,
        taskPackLabel: taskPackContext.taskPackLabel,
        linkedComponentIds: componentAssemblyContext.linkedComponentIds,
        linkedComponentLabels: componentAssemblyContext.linkedComponentLabels,
        pendingComponentIds: componentAssemblyContext.pendingComponentIds,
        pendingComponentLabels: componentAssemblyContext.pendingComponentLabels,
        componentAssemblyAction: componentAssemblyContext.componentAssemblyAction,
        remediationOwnerLabel: ownerLabel,
        remediationSummary,
        remediationAction,
        bridgeHandoffStatus: bridgeHandoff.status,
        bridgeHandoffSummary: bridgeHandoff.summary,
        bridgeHandoffDetail: bridgeHandoff.detail,
        retryCommandId: retryContext.retryCommandId,
        retryCommandLabel: retryContext.retryCommandLabel,
        retryApiPath: getTaskRetryApiPath(task),
        retryRunnerArgs: retryRunnerContext.retryRunnerArgs,
        retryRunnerCommand: retryRunnerContext.retryRunnerCommand,
        unifiedRetryApiPath: unifiedRetryContext.unifiedRetryApiPath,
        unifiedRetryRunnerArgs: unifiedRetryContext.unifiedRetryRunnerArgs,
        unifiedRetryRunnerCommand: unifiedRetryContext.unifiedRetryRunnerCommand,
        action:
          task.status === "blocked"
            ? `优先解除阻塞，再回到 ${task.stage}。`
            : task.status === "in-progress"
              ? `继续由 ${ownerLabel} 推进，完成后进入下一次交接。`
              : `等待 ${ownerLabel} 领取，避免拖慢 ${task.stage}。`,
        sourceCommandAction: evidenceContext.sourceCommandLabel
          ? `来源命令：${evidenceContext.sourceCommandLabel}`
          : "来源命令：系统自动注入"
      };
    })
    .sort((left, right) => {
      const priorityDelta = taskPriorityOrder[left.task.priority] - taskPriorityOrder[right.task.priority];

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const statusDelta = taskStatusOrder[left.task.status] - taskStatusOrder[right.task.status];

      if (statusDelta !== 0) {
        return statusDelta;
      }

      return (left.project?.progress ?? 0) - (right.project?.progress ?? 0);
    });
}

export function getCurrentHandoffSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
): ForgeCurrentHandoffSummary {
  if (!projectId) {
    return {
      stage: null,
      source: "bootstrap",
      nextAction: "先选择模板并建立项目，再注入标准团队和本地工作区。",
      ownerLabel: null,
      ownerRoleLabel: null,
      bridgeHandoffStatus: "none",
      bridgeHandoffSummary: null,
      bridgeHandoffDetail: null
    };
  }

  const stage = getProjectWorkflowStage(snapshot, projectId);
  const bridgeHandoff = getBridgeHandoffState(snapshot, projectId);
  const project = snapshot.projects.find((item) => item.id === projectId) ?? null;
  const qaAgent = getPreferredAgent(snapshot, "qa");
  const releaseAgent = getPreferredAgent(snapshot, "release");
  const pmAgent = getPreferredAgent(snapshot, "pm");
  const qaOwnerLabel = getAgentDisplayLabelOrFallback(qaAgent, "测试负责人");
  const releaseOwnerLabel = getAgentDisplayLabelOrFallback(releaseAgent, "发布负责人");
  const approvalOwnerLabel = getAgentDisplayLabelOrFallback(pmAgent, "项目负责人");
  const getOwnerRoleLabel = (ownerAgentId: string | null | undefined) => {
    const ownerRole = snapshot.agents.find((agent) => agent.id === ownerAgentId)?.role;

    return ownerRole ? agentRoleLabel[ownerRole] : null;
  };
  const bridgeHandoffGuidance = getBridgeHandoffGuidance(snapshot, bridgeHandoff.status);

  if (bridgeHandoff.status === "review-handoff" && bridgeHandoffGuidance) {
    return {
      stage,
      source: "review-handoff",
      nextAction: bridgeHandoffGuidance.nextAction,
      ownerLabel: bridgeHandoffGuidance.ownerLabel,
      ownerRoleLabel: bridgeHandoffGuidance.ownerRoleLabel,
      bridgeHandoffStatus: bridgeHandoff.status,
      bridgeHandoffSummary: bridgeHandoff.summary,
      bridgeHandoffDetail: bridgeHandoff.detail
    };
  }

  const releaseApprovalTask = snapshot.tasks.find(
    (task) =>
      task.projectId === projectId &&
      task.id === `task-${projectId}-release-approval` &&
      task.status !== "done"
  );
  const releasePrepareContext = getProjectCommandContext(
    snapshot,
    projectId,
    "command-release-prepare"
  );

  if (releaseApprovalTask) {
    return {
      stage,
      source: "approval",
      nextAction: releaseApprovalTask.title,
      ownerLabel: getAgentDisplayLabelById(
        snapshot,
        releaseApprovalTask.ownerAgentId,
        approvalOwnerLabel
      ),
      ownerRoleLabel:
        getOwnerRoleLabel(releaseApprovalTask.ownerAgentId) ?? agentRoleLabel.pm,
      sourceCommandExecutionId: releasePrepareContext?.sourceCommandExecutionId ?? null,
      sourceCommandId: releasePrepareContext?.sourceCommandId ?? null,
      sourceCommandLabel: releasePrepareContext?.sourceCommandLabel ?? null,
      relatedRunId: releasePrepareContext?.relatedRunId ?? null,
      relatedRunLabel: releasePrepareContext?.relatedRunLabel ?? null,
      runtimeLabel: releasePrepareContext?.runtimeLabel ?? null,
      bridgeHandoffStatus: bridgeHandoff.status,
      bridgeHandoffSummary: bridgeHandoff.summary,
      bridgeHandoffDetail: bridgeHandoff.detail
    };
  }

  if (bridgeHandoff.status === "qa-handoff" && bridgeHandoffGuidance) {
    return {
      stage,
      source: "qa-handoff",
      nextAction: bridgeHandoffGuidance.nextAction,
      ownerLabel: bridgeHandoffGuidance.ownerLabel,
      ownerRoleLabel: bridgeHandoffGuidance.ownerRoleLabel,
      bridgeHandoffStatus: bridgeHandoff.status,
      bridgeHandoffSummary: bridgeHandoff.summary,
      bridgeHandoffDetail: bridgeHandoff.detail
    };
  }

  if (bridgeHandoff.status === "release-candidate" && bridgeHandoffGuidance) {
    return {
      stage,
      source: "release-candidate",
      nextAction: bridgeHandoffGuidance.nextAction,
      ownerLabel: bridgeHandoffGuidance.ownerLabel,
      ownerRoleLabel: bridgeHandoffGuidance.ownerRoleLabel,
      bridgeHandoffStatus: bridgeHandoff.status,
      bridgeHandoffSummary: bridgeHandoff.summary,
      bridgeHandoffDetail: bridgeHandoff.detail
    };
  }

  const failedGate = snapshot.deliveryGate.find((gate) => gate.status === "fail");

  if (stage === "测试验证" && failedGate) {
    return {
      stage,
      source: "gate-failure",
      nextAction: `先处理 ${failedGate.name} 失败项，再推进交付或归档。`,
      ownerLabel: qaOwnerLabel,
      ownerRoleLabel: agentRoleLabel.qa,
      bridgeHandoffStatus: bridgeHandoff.status,
      bridgeHandoffSummary: bridgeHandoff.summary,
      bridgeHandoffDetail: bridgeHandoff.detail
    };
  }

  if (stage === "归档复用") {
    const knowledgeTask = snapshot.tasks.find(
      (task) =>
        task.projectId === projectId &&
        task.id === `task-${projectId}-knowledge-card` &&
        task.status !== "done"
    );

    if (knowledgeTask) {
      const knowledgeOwner =
        snapshot.agents.find((agent) => agent.id === knowledgeTask.ownerAgentId) ?? null;

      return {
        stage,
        source: "stage-default",
        nextAction: knowledgeTask.title,
        ownerLabel: getAgentDisplayLabelById(
          snapshot,
          knowledgeTask.ownerAgentId,
          "知识负责人"
        ),
        ownerRoleLabel: knowledgeOwner?.role
          ? agentRoleLabel[knowledgeOwner.role]
          : agentRoleLabel.knowledge,
        sourceCommandExecutionId: releasePrepareContext?.sourceCommandExecutionId ?? null,
        sourceCommandId: releasePrepareContext?.sourceCommandId ?? null,
        sourceCommandLabel: releasePrepareContext?.sourceCommandLabel ?? null,
        relatedRunId: releasePrepareContext?.relatedRunId ?? null,
        relatedRunLabel: releasePrepareContext?.relatedRunLabel ?? null,
        runtimeLabel: releasePrepareContext?.runtimeLabel ?? null,
        bridgeHandoffStatus: bridgeHandoff.status,
        bridgeHandoffSummary: bridgeHandoff.summary,
        bridgeHandoffDetail: bridgeHandoff.detail
      };
    }
  }

  const defaultActions: Record<
    WorkflowStage,
    { nextAction: string; ownerLabel: string | null; ownerRoleLabel: string | null }
  > = {
    项目接入: {
      nextAction: "补齐需求摘要、模板和项目 DNA。",
      ownerLabel: project?.owner ?? null,
      ownerRoleLabel: "项目负责人"
    },
    "方案与任务包": {
      nextAction: "产出 PRD、TaskPack 和实现边界。",
      ownerLabel: getPreferredAgentDisplayLabel(snapshot, "pm", "项目负责人"),
      ownerRoleLabel: agentRoleLabel.pm
    },
    开发执行: {
      nextAction: "推进编码、补丁和回归修复。",
      ownerLabel: getPreferredAgentDisplayLabel(snapshot, "engineer", "工程负责人"),
      ownerRoleLabel: agentRoleLabel.engineer
    },
    测试验证: {
      nextAction: "跑完门禁、补齐人工复核。",
      ownerLabel: qaOwnerLabel,
      ownerRoleLabel: agentRoleLabel.qa
    },
    交付发布: {
      nextAction: "整理预览、交付说明和验收材料。",
      ownerLabel: releaseOwnerLabel,
      ownerRoleLabel: agentRoleLabel.release
    },
    归档复用: {
      nextAction: "沉淀 Prompt、模板、知识卡和修复经验。",
      ownerLabel: getPreferredAgentDisplayLabel(snapshot, "knowledge", "知识负责人"),
      ownerRoleLabel: agentRoleLabel.knowledge
    }
  };

  return {
    stage,
    source: "stage-default",
    ...defaultActions[stage],
    bridgeHandoffStatus: bridgeHandoff.status,
    bridgeHandoffSummary: bridgeHandoff.summary,
    bridgeHandoffDetail: bridgeHandoff.detail
  };
}

export function getBlockingTaskChain(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined
) {
  if (!projectId) {
    return [];
  }

  return getTaskDispatchQueue(snapshot)
    .filter((item) => item.task.projectId === projectId && item.task.status !== "done")
    .slice(0, 5)
    .map((item) => ({
      id: item.task.id,
      title: item.task.title,
      status: item.task.status,
      priority: item.task.priority,
      stage: item.task.stage,
      action: item.action,
      sourceCommandExecutionId: item.sourceCommandExecutionId,
      sourceCommandLabel: item.sourceCommandLabel ?? null,
      sourceCommandAction: item.sourceCommandAction,
      relatedArtifactLabels: item.relatedArtifactLabels ?? [],
      missingArtifactLabels: item.missingArtifactLabels ?? [],
      evidenceAction: item.evidenceAction,
      relatedRunId: item.relatedRunId,
      relatedRunLabel: item.relatedRunLabel,
      taskPackId: item.taskPackId,
      taskPackLabel: item.taskPackLabel,
      linkedComponentIds: item.linkedComponentIds,
      linkedComponentLabels: item.linkedComponentLabels,
      pendingComponentIds: item.pendingComponentIds,
      pendingComponentLabels: item.pendingComponentLabels,
      componentAssemblyAction: item.componentAssemblyAction,
      runtimeLabel: item.runtimeLabel,
      runtimeExecutionBackendLabel: item.runtimeExecutionBackendLabel,
      runtimeModelProviderLabel: item.runtimeModelProviderLabel,
      runtimeModelExecutionDetail: item.runtimeModelExecutionDetail,
      runtimeCapabilityDetails: item.runtimeCapabilityDetails,
      remediationOwnerLabel: item.remediationOwnerLabel,
      remediationSummary: item.remediationSummary,
      remediationAction: item.remediationAction,
      retryCommandId: item.retryCommandId,
      retryCommandLabel: item.retryCommandLabel,
      retryApiPath: item.retryApiPath,
      retryRunnerArgs: item.retryRunnerArgs,
      retryRunnerCommand: item.retryRunnerCommand,
      unifiedRetryApiPath: item.unifiedRetryApiPath,
      unifiedRetryRunnerArgs: item.unifiedRetryRunnerArgs,
      unifiedRetryRunnerCommand: item.unifiedRetryRunnerCommand
    }));
}

export function getRemediationTaskQueue(
  snapshot: ForgeDashboardSnapshot,
  projectId?: string | null
) {
  return getTaskDispatchQueue(snapshot)
    .filter((item) => item.task.status !== "done")
    .filter((item) => (projectId ? item.task.projectId === projectId : true))
    .filter((item) => Boolean(item.remediationSummary))
    .map((item) => ({
      id: item.task.id,
      title: item.task.title,
      priority: item.task.priority,
      status: item.task.status,
      stage: item.task.stage,
      projectId: item.task.projectId,
      projectName: item.project?.name ?? item.task.projectId,
      remediationOwnerLabel: item.remediationOwnerLabel,
      remediationSummary: item.remediationSummary,
      remediationAction: item.remediationAction,
      bridgeHandoffStatus: item.bridgeHandoffStatus,
      bridgeHandoffSummary: item.bridgeHandoffSummary,
      bridgeHandoffDetail: item.bridgeHandoffDetail,
      sourceCommandLabel: item.sourceCommandLabel ?? null,
      evidenceAction: item.evidenceAction,
      runtimeLabel: item.runtimeLabel,
      runtimeExecutionBackendLabel: item.runtimeExecutionBackendLabel,
      runtimeModelProviderLabel: item.runtimeModelProviderLabel,
      runtimeModelExecutionDetail: item.runtimeModelExecutionDetail,
      runtimeCapabilityDetails: item.runtimeCapabilityDetails,
      taskPackId: item.taskPackId,
      taskPackLabel: item.taskPackLabel,
      linkedComponentIds: item.linkedComponentIds,
      linkedComponentLabels: item.linkedComponentLabels,
      pendingComponentIds: item.pendingComponentIds,
      pendingComponentLabels: item.pendingComponentLabels,
      componentAssemblyAction: item.componentAssemblyAction,
      retryCommandId: item.retryCommandId,
      retryCommandLabel: item.retryCommandLabel,
      retryApiPath: item.retryApiPath,
      retryRunnerArgs: item.retryRunnerArgs,
      retryRunnerCommand: item.retryRunnerCommand,
      unifiedRetryApiPath: item.unifiedRetryApiPath,
      unifiedRetryRunnerArgs: item.unifiedRetryRunnerArgs,
      unifiedRetryRunnerCommand: item.unifiedRetryRunnerCommand
    }));
}

export function getCommandExecutionFollowUpSummary(
  snapshot: ForgeDashboardSnapshot,
  executionId: string
) {
  const execution = snapshot.commandExecutions.find((item) => item.id === executionId);

  if (!execution) {
    return [];
  }

  return execution.followUpTaskIds
    .map((taskId) => snapshot.tasks.find((task) => task.id === taskId))
    .filter((task): task is ForgeTask => Boolean(task))
    .map((task) => {
      const evidenceContext = getTaskEvidenceContext(snapshot, task);
      const runContext = getTaskRelatedRunContext(snapshot, task);
      const retryContext = getTaskRetryCommandContext(snapshot, task);
      const taskPackContext = getTaskTaskPackContext(snapshot, task);
      const componentAssemblyContext = getTaskComponentAssemblyContext(
        snapshot,
        task,
        taskPackContext.taskPackId
      );
      const retryRunnerContext = getTaskRetryRunnerContext(task, taskPackContext.taskPackId);
      const unifiedRetryContext = getTaskUnifiedRetryContext(task, taskPackContext.taskPackId);
      const ownerLabel = getTaskOwnerDisplayLabel(snapshot, task);
      const remediationSummary = getTaskRemediationSummary({
        task,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        relatedRunId: runContext.relatedRunId,
        latestFailure: getLatestRunFailure(snapshot, {
          projectId: task.projectId,
          runId: runContext.relatedRunId ?? undefined
        })
      });
      const remediationAction = getTaskRemediationAction({
        ownerLabel,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        relatedRunLabel: runContext.relatedRunLabel,
        runtimeModelProviderLabel: runContext.runtimeModelProviderLabel,
        runtimeModelExecutionDetail: runContext.runtimeModelExecutionDetail,
        task
      });

      return {
        id: task.id,
        title: task.title,
        stage: task.stage,
        status: task.status,
        priority: task.priority,
        sourceCommandExecutionId: evidenceContext.sourceCommandExecutionId,
        sourceCommandLabel: evidenceContext.sourceCommandLabel ?? null,
        relatedArtifactLabels: evidenceContext.relatedArtifactLabels,
        missingArtifactLabels: evidenceContext.missingArtifactLabels,
        evidenceAction: evidenceContext.evidenceAction,
        relatedRunId: runContext.relatedRunId,
        relatedRunLabel: runContext.relatedRunLabel,
        taskPackId: taskPackContext.taskPackId,
        taskPackLabel: taskPackContext.taskPackLabel,
        linkedComponentIds: componentAssemblyContext.linkedComponentIds,
        linkedComponentLabels: componentAssemblyContext.linkedComponentLabels,
        pendingComponentIds: componentAssemblyContext.pendingComponentIds,
        pendingComponentLabels: componentAssemblyContext.pendingComponentLabels,
        componentAssemblyAction: componentAssemblyContext.componentAssemblyAction,
        runtimeLabel: runContext.runtimeLabel,
        runtimeExecutionBackendLabel: runContext.runtimeExecutionBackendLabel,
        runtimeModelProviderLabel: runContext.runtimeModelProviderLabel,
        runtimeModelExecutionDetail: runContext.runtimeModelExecutionDetail,
        runtimeCapabilityDetails: runContext.runtimeCapabilityDetails,
        remediationOwnerLabel: ownerLabel,
        remediationSummary,
        remediationAction,
        retryCommandId: retryContext.retryCommandId,
        retryCommandLabel: retryContext.retryCommandLabel,
        retryApiPath: getTaskRetryApiPath(task),
        retryRunnerArgs: retryRunnerContext.retryRunnerArgs,
        retryRunnerCommand: retryRunnerContext.retryRunnerCommand,
        unifiedRetryApiPath: unifiedRetryContext.unifiedRetryApiPath,
        unifiedRetryRunnerArgs: unifiedRetryContext.unifiedRetryRunnerArgs,
        unifiedRetryRunnerCommand: unifiedRetryContext.unifiedRetryRunnerCommand
      };
    });
}

export function getCommandExecutionRuntimeEvidenceSummary(
  snapshot: ForgeDashboardSnapshot,
  executionId: string
) {
  const runtimeCapabilityDetails = Array.from(
    new Set(
      getCommandExecutionFollowUpSummary(snapshot, executionId).flatMap(
        (task) => task.runtimeCapabilityDetails ?? []
      )
    )
  );

  if (runtimeCapabilityDetails.length === 0) {
    return null;
  }

  return runtimeCapabilityDetails.join(" / ");
}

export function getCommandExecutionRuntimeContext(
  snapshot: ForgeDashboardSnapshot,
  executionId: string
) {
  const execution = snapshot.commandExecutions.find((item) => item.id === executionId) ?? null;
  const followUpTasks = getCommandExecutionFollowUpSummary(snapshot, executionId);
  const explicitRun =
    execution?.relatedRunId
      ? snapshot.runs.find((run) => run.id === execution.relatedRunId) ?? null
      : null;
  const contextSource =
    followUpTasks.find(
      (task) =>
        task.relatedRunId ||
        task.taskPackId ||
        (task.linkedComponentIds?.length ?? 0) > 0 ||
        task.runtimeLabel
    ) ?? null;

  const linkedComponentIds = Array.from(
    new Set(followUpTasks.flatMap((task) => task.linkedComponentIds ?? []))
  );
  const linkedComponentLabels = Array.from(
    new Set(followUpTasks.flatMap((task) => task.linkedComponentLabels ?? []))
  );
  const pendingComponentIds = Array.from(
    new Set(followUpTasks.flatMap((task) => task.pendingComponentIds ?? []))
  );
  const pendingComponentLabels = Array.from(
    new Set(followUpTasks.flatMap((task) => task.pendingComponentLabels ?? []))
  );
  const componentAssemblyAction =
    followUpTasks.find((task) => task.componentAssemblyAction)?.componentAssemblyAction ?? null;

  if (explicitRun) {
    const runtimeModelExecutionDetail = getRunModelExecutionDetail(explicitRun) || null;
    const runtimeModelProviderLabel = getRunModelExecutionProvider(explicitRun) || null;
    const runtimeExecutionBackendLabel =
      getRunExecutionBackendLabelFromDetail(runtimeModelExecutionDetail ?? "") || null;
    const explicitLinkedComponentLabels = (explicitRun.linkedComponentIds ?? [])
      .map((componentId) => snapshot.components.find((component) => component.id === componentId)?.title)
      .filter((label): label is string => Boolean(label));

    return {
      relatedRunId: explicitRun.id,
      relatedRunLabel: `${explicitRun.title} · ${explicitRun.executor}`,
      runtimeLabel: formatRunRuntimeLabel(explicitRun),
      runtimeExecutionBackendLabel,
      runtimeModelProviderLabel,
      runtimeModelExecutionDetail,
      runtimeCapabilityDetails: explicitRun.outputChecks
        .filter((check) => Boolean(check.summary))
        .map((check) => {
          const prefix = explicitRun.outputMode ? `Runtime:${explicitRun.outputMode}` : explicitRun.executor;

          return `${prefix} · ${check.name}=${check.status} · ${check.summary}`;
        }),
      taskPackId: explicitRun.taskPackId ?? null,
      taskPackLabel:
        explicitRun.taskPackId
          ? snapshot.artifacts.find((artifact) => artifact.id === explicitRun.taskPackId)?.title ?? null
          : null,
      linkedComponentIds: Array.from(
        new Set([...(explicitRun.linkedComponentIds ?? []), ...linkedComponentIds])
      ),
      linkedComponentLabels: Array.from(
        new Set([...explicitLinkedComponentLabels, ...linkedComponentLabels])
      ),
      pendingComponentIds,
      pendingComponentLabels,
      componentAssemblyAction
    };
  }

  return {
    relatedRunId: contextSource?.relatedRunId ?? null,
    relatedRunLabel: contextSource?.relatedRunLabel ?? null,
    runtimeLabel: contextSource?.runtimeLabel ?? null,
    runtimeExecutionBackendLabel: contextSource?.runtimeExecutionBackendLabel ?? null,
    runtimeModelProviderLabel: contextSource?.runtimeModelProviderLabel ?? null,
    runtimeModelExecutionDetail: contextSource?.runtimeModelExecutionDetail ?? null,
    runtimeCapabilityDetails: contextSource?.runtimeCapabilityDetails ?? [],
    taskPackId: contextSource?.taskPackId ?? null,
    taskPackLabel: contextSource?.taskPackLabel ?? null,
    linkedComponentIds,
    linkedComponentLabels,
    pendingComponentIds,
    pendingComponentLabels,
    componentAssemblyAction
  };
}

function getCommandExecutionApprovalHandoffContext(
  snapshot: ForgeDashboardSnapshot,
  execution: ForgeDashboardSnapshot["commandExecutions"][number]
) {
  if (!execution.projectId) {
    return null;
  }

  const commandType =
    snapshot.commands.find((item) => item.id === execution.commandId)?.type ?? null;

  if (commandType !== "release.prepare") {
    return null;
  }

  const approvalHandoff = getFormalArtifactResponsibilitySummary(
    snapshot,
    execution.projectId
  ).approvalHandoff;

  return approvalHandoff.nextAction ? approvalHandoff : null;
}

function getCommandExecutionReleaseClosureContext(
  snapshot: ForgeDashboardSnapshot,
  execution: ForgeDashboardSnapshot["commandExecutions"][number]
) {
  if (!execution.projectId) {
    return null;
  }

  const commandType =
    snapshot.commands.find((item) => item.id === execution.commandId)?.type ?? null;

  if (commandType !== "release.prepare" && commandType !== "archive.capture") {
    return null;
  }

  if (commandType === "archive.capture") {
    const archiveProvenance = getArchiveProvenanceSummary(snapshot, execution.projectId);

    if (archiveProvenance?.archiveCommandId !== execution.commandId) {
      return null;
    }

    return {
      status: "archive-recorded",
      summary: "发布链已完成最终放行，归档沉淀已写回正式工件面。",
      detail: archiveProvenance.detail ?? "当前归档沉淀已进入正式工件面。",
      ownerLabel: null,
      ownerRoleLabel: null,
      nextAction: null
    };
  }

  const releaseClosure = getActiveReleaseClosureSummary(snapshot, execution.projectId);

  return releaseClosure.nextAction ? releaseClosure : null;
}

function getCommandExecutionArchiveProvenanceContext(
  snapshot: ForgeDashboardSnapshot,
  execution: ForgeDashboardSnapshot["commandExecutions"][number]
) {
  if (!execution.projectId) {
    return null;
  }

  const commandType =
    snapshot.commands.find((item) => item.id === execution.commandId)?.type ?? null;

  if (commandType !== "archive.capture") {
    return null;
  }

  const archiveProvenance = getArchiveProvenanceSummary(snapshot, execution.projectId);

  return archiveProvenance?.archiveCommandId === execution.commandId ? archiveProvenance : null;
}

export function getRecentCommandExecutions(
  snapshot: ForgeDashboardSnapshot,
  projectId?: string | null
) {
  return snapshot.commandExecutions
    .filter((execution) => (projectId ? execution.projectId === projectId : true))
    .slice(0, 5)
    .map((execution) => {
      const approvalHandoff = getCommandExecutionApprovalHandoffContext(snapshot, execution);
      const releaseClosure = getCommandExecutionReleaseClosureContext(snapshot, execution);
      const releaseClosureResponsibility = execution.projectId
        ? getReleaseClosureResponsibilitySummary(snapshot, execution.projectId)
        : null;
      const archiveProvenance = getCommandExecutionArchiveProvenanceContext(snapshot, execution);

      return {
        ...execution,
        ...getCommandExecutionRuntimeContext(snapshot, execution.id),
        runtimeEvidenceSummary: getCommandExecutionRuntimeEvidenceSummary(snapshot, execution.id),
        approvalHandoffSummary: approvalHandoff?.summary ?? null,
        approvalHandoffDetail: approvalHandoff?.detail ?? null,
        approvalHandoffOwnerLabel: approvalHandoff?.ownerLabel ?? null,
        approvalHandoffOwnerRoleLabel: approvalHandoff?.ownerRoleLabel ?? null,
        approvalHandoffNextAction: approvalHandoff?.nextAction ?? null,
        releaseClosureSummary: releaseClosure?.summary ?? null,
        releaseClosureDetail: releaseClosure?.detail ?? null,
        releaseClosureOwnerLabel: releaseClosure?.ownerLabel ?? null,
        releaseClosureOwnerRoleLabel: releaseClosure?.ownerRoleLabel ?? null,
        releaseClosureNextAction: releaseClosure?.nextAction ?? null,
        releaseClosureResponsibilitySummary: releaseClosureResponsibility?.summary ?? null,
        releaseClosureResponsibilityDetail: releaseClosureResponsibility?.detail ?? null,
        releaseClosureResponsibilityNextAction: releaseClosureResponsibility?.nextAction ?? null,
        releaseClosureResponsibilitySourceLabel: releaseClosureResponsibility?.sourceLabel ?? null,
        archiveProvenanceSummary: archiveProvenance?.summary ?? null,
        archiveProvenanceDetail: archiveProvenance?.detail ?? null,
        followUpTasks: getCommandExecutionFollowUpSummary(snapshot, execution.id)
      };
    });
}

export function getProjectTaskLoad(snapshot: ForgeDashboardSnapshot) {
  return snapshot.projects
    .map((project) => {
      const tasks = snapshot.tasks.filter((task) => task.projectId === project.id && task.status !== "done");
      const blockedCount = tasks.filter((task) => task.status === "blocked").length;
      const inProgressCount = tasks.filter((task) => task.status === "in-progress").length;
      const todoCount = tasks.filter((task) => task.status === "todo").length;
      const highestPriority = [...tasks]
        .sort((left, right) => taskPriorityOrder[left.priority] - taskPriorityOrder[right.priority])[0]?.priority ?? null;
      const topTask = getTaskDispatchQueue(snapshot).find((item) => item.task.projectId === project.id) ?? null;

      return {
        project,
        openCount: tasks.length,
        blockedCount,
        inProgressCount,
        todoCount,
        highestPriority,
        topTask
      };
    })
    .filter((item) => item.openCount > 0)
    .sort((left, right) => {
      if (left.blockedCount !== right.blockedCount) {
        return right.blockedCount - left.blockedCount;
      }

      const priorityDelta =
        taskPriorityOrder[left.highestPriority ?? "P2"] - taskPriorityOrder[right.highestPriority ?? "P2"];

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return right.openCount - left.openCount;
    });
}

export function getAgentTaskLoad(snapshot: ForgeDashboardSnapshot) {
  return snapshot.agents
    .map((agent) => {
      const tasks = snapshot.tasks.filter((task) => task.ownerAgentId === agent.id && task.status !== "done");
      const blockedCount = tasks.filter((task) => task.status === "blocked").length;
      const inProgressCount = tasks.filter((task) => task.status === "in-progress").length;
      const todoCount = tasks.filter((task) => task.status === "todo").length;
      const openCount = tasks.length;

      let capacityLabel = "空闲";

      if (blockedCount > 0) {
        capacityLabel = "存在阻塞";
      } else if (inProgressCount >= 2 || openCount >= 3) {
        capacityLabel = "负载较高";
      } else if (openCount > 0) {
        capacityLabel = "可继续接单";
      }

      return {
        agent,
        openCount,
        blockedCount,
        inProgressCount,
        todoCount,
        capacityLabel
      };
    })
    .filter((item) => item.openCount > 0)
    .sort((left, right) => {
      if (left.blockedCount !== right.blockedCount) {
        return right.blockedCount - left.blockedCount;
      }

      if (left.inProgressCount !== right.inProgressCount) {
        return right.inProgressCount - left.inProgressCount;
      }

      return right.openCount - left.openCount;
    });
}

export function getExecutionBlockers(snapshot: ForgeDashboardSnapshot) {
  const blockedRuns = snapshot.runs
    .filter((run) => run.state === "blocked")
    .map((run) => {
      const latestFailure = getLatestRunFailure(snapshot, { runId: run.id });

      return latestFailure?.summary ?? `${run.title}：执行已阻塞，需要排查失败原因。`;
    });
  const failedGates = snapshot.deliveryGate
    .filter((gate) => gate.status === "fail")
    .map((gate) => `${gate.name}：当前门禁失败，不能继续推进交付。`);
  const pendingGates = snapshot.deliveryGate
    .filter((gate) => gate.status === "pending")
    .map((gate) => `${gate.name}：仍待人工确认。`);

  return [...blockedRuns, ...failedGates, ...pendingGates];
}
