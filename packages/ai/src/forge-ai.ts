import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ForgeAsset,
  ForgeAssetRecommendationItem,
  ForgeAssetRecommendationManagementGroup,
  ForgeAssetRecommendationPriority,
  ForgeAssetRecommendationResult,
  ForgeAssetRecommendationSourceKind,
  ForgeAgent,
  ForgeAgentOwnerMode,
  ForgeAgentRole,
  ForgeCommand,
  ForgeArtifact,
  ForgeComponent,
  ForgeComponentCategory,
  ForgeExternalComponentCandidate,
  ForgeExternalComponentCandidateMaturity,
  ForgeExternalComponentCandidateSecurityTier,
  ForgeComponentSourceType,
  ForgeDashboardSnapshot,
  ForgePrdDocument,
  ForgeProject,
  ForgeProjectDraft,
  ForgeProjectWorkbenchNode,
  ForgeProjectWorkbenchState,
  ForgeProjectAssetLink,
  ForgeProjectAssetLinkRelation,
  ForgeProjectProfile,
  ForgeProjectWorkflowState,
  ForgePolicyDecisionOutcome,
  ForgeCommandModelExecution,
  ForgeModelProviderConnectionResult,
  ForgeModelProviderId,
  ForgeModelProviderSetting,
  ForgeModelProviderSettingsInput,
  ForgeProjectTemplate,
  ForgePromptTemplate,
  ForgeResolvedAgentContextPathContract,
  ForgeResolvedAgentContextTool,
  ForgeRunFailureCategory,
  ForgeRunOutputCheck,
  ForgeRunner,
  ForgeSkill,
  ForgeSop,
  ForgeTask,
  ForgeTeamWorkbenchState,
  ForgeWorkflowStage
} from "../../core/src/types";
import {
  forgeCommandContracts,
  getForgeAgentDisplayLabel,
  getCurrentHandoffSummary,
  getDeliveryReadinessSummary,
  getEvidenceTimeline,
  getFormalArtifactCoverageSummary,
  getFormalArtifactResponsibilitySummary,
  getReleaseClosureResponsibilitySummary,
  getAgentTaskLoad,
  getBlockingTaskChain,
  getComponentUsageSignals,
  getProjectAgentIdByRoles,
  getRecentCommandExecutions,
  getProjectTaskLoad,
  getProjectWorkbenchAgent,
  getProjectWorkbenchAgentForCommand,
  getRemediationTaskQueue,
  getReleaseGateSummary,
  getTaskPackAssemblySuggestions,
  getTaskDispatchQueue,
  isProjectWorkbenchNode,
} from "../../core/src";
import {
  createProject,
  deleteProject,
  generatePrdDraft,
  getProjectWorkbenchState,
  getTeamWorkbenchState,
  getModelProviderSecret,
  getModelProviderSettings,
  listRunTimeline,
  loadDashboardSnapshot,
  probeRunners,
  recordModelProviderConnectionResult,
  recordCommandExecution,
  setActiveProject,
  updateProjectDetails,
  updateDeliveryGateStatuses,
  upsertProjectComponentLink,
  upsertProjectTask,
  updateModelProviderSettings,
  updateProjectOverview,
  updateProjectTasks,
  updateProjectWorkflowState,
  updateProjectWorkbenchState,
  updateRunnerHeartbeat,
  upsertArtifactReview,
  upsertProjectArtifact,
  updateAgentProfile,
  updateTeamWorkbenchState,
  upsertRun
} from "../../db/src";
import {
  generateModelGatewayChatReply,
  generateModelGatewayReply,
  getModelGatewayProviderDefinition,
  isForgeModelProviderId,
  resolveModelGatewaySelection,
  testModelGatewayConnection
} from "../../model-gateway/src";
import {
  createDefaultRuntimeAdapters,
  getExecutionBackendAdapterRegistry,
  getRuntimeAdapterRegistry,
  selectRuntimeAdapter,
  type ForgeExecutionBackendContractConfig
} from "./runtime-adapters";
import { handleArchiveCaptureCommand } from "./command-handlers/archive-capture";
import { handleExecutionStartCommand } from "./command-handlers/execution-start";
import { handleGateRunCommand } from "./command-handlers/gate-run";
import { handlePrdGenerateCommand } from "./command-handlers/prd-generate";
import { handleReleasePrepareCommand } from "./command-handlers/release-prepare";
import { handleReviewRunCommand } from "./command-handlers/review-run";
import type { ForgeCommandHandler } from "./command-handlers/shared";
import { resolveWorkbenchAgentContext } from "./agent-context";
import executionBackendContractConfigsRaw from "../../../config/forge-execution-backend-contracts.json";

type ForgeAssetType = ForgeAsset["type"];

type CreateProjectInput = Omit<ForgeProjectDraft, "id"> & {
  requirement?: string;
  demoSeed?: boolean;
};
type UpdateProjectInput = Omit<ForgeProjectDraft, "id" | "templateId"> & {
  projectId: string;
};
type GeneratePrdDraftInput = {
  projectId: string;
  templateId: string;
  extraNotes?: string;
};
type TestModelProviderConnectionInput = {
  providerId: ForgeModelProviderId;
  apiKey?: string;
  model?: string;
};
type ListTasksInput = {
  projectId?: string;
  status?: ForgeTask["status"];
};
type RetryTaskInput = {
  taskId: string;
  triggeredBy?: string;
};
type RetryRemediationInput = {
  remediationId: string;
  triggeredBy?: string;
};
type UpdateProjectWorkbenchStateInput = ForgeProjectWorkbenchState;
type UpdateTeamWorkbenchStateInput = ForgeTeamWorkbenchState;
type PrepareExecutionBackendRequestInput = {
  remediationId?: string;
  taskId?: string;
  projectId?: string;
};
type DispatchExecutionBackendRequestInput = PrepareExecutionBackendRequestInput & {
  triggeredBy?: string;
};
type ExecuteExecutionBackendDispatchInput = DispatchExecutionBackendRequestInput;
type BridgeExecutionBackendDispatchInput = ExecuteExecutionBackendDispatchInput & {
  strategy?: "stub" | "local-shell";
};
type WritebackExecutionBackendBridgeRunInput = BridgeExecutionBackendDispatchInput & {
  runId?: string;
  title?: string;
  executor?: string;
  cost?: string;
};
type ApplyComponentAssemblyInput = {
  projectId?: string;
  taskPackId?: string;
  componentIds: string[];
  triggeredBy?: string;
};
type UpdateAgentProfileInput = {
  agentId: string;
  name?: string;
  role?: ForgeAgent["role"];
  runnerId?: string;
  departmentLabel?: string;
  ownerMode?: ForgeAgent["ownerMode"];
  persona?: string;
  policyId?: string;
  permissionProfileId?: string;
  promptTemplateId: string;
  skillIds?: string[];
  systemPrompt: string;
  knowledgeSources: string[];
};
type UpdateProjectWorkflowStateInput = {
  projectId: string;
  currentStage: ForgeProjectWorkflowState["currentStage"];
  state: ForgeProjectWorkflowState["state"];
  blockers: string[];
  updatedBy: string;
};
type UpdateRunnerHeartbeatInput = {
  runnerId: string;
  status: ForgeRunner["status"];
  currentRunId: string | null;
  lastHeartbeat: string;
};
type ProbeRunnersInput = {
  runnerId?: string;
};
type UpsertRunInput = {
  id: string;
  projectId?: string;
  taskPackId?: string | null;
  linkedComponentIds?: string[];
  title: string;
  executor: string;
  cost: string;
  state: "running" | "done" | "blocked";
  failureCategory?: ForgeRunFailureCategory | null;
  failureSummary?: string;
  outputSummary?: string;
  outputMode?: string | null;
  outputChecks?: ForgeRunOutputCheck[];
};

type RecordCommandExecutionInput = {
  id: string;
  commandId: string;
  projectId?: string;
  taskPackId?: string | null;
  relatedRunId?: string | null;
  status: "running" | "done" | "blocked";
  summary: string;
  triggeredBy: string;
  followUpTaskIds?: string[];
  decisions?: Array<{
    id: string;
    hookId: string;
    outcome: ForgePolicyDecisionOutcome;
    summary: string;
  }>;
};

type ExecuteCommandInput = {
  commandId: string;
  projectId?: string;
  taskPackId?: string;
  componentIds?: string[];
  extraNotes?: string;
  selectedModel?: string;
  thinkingBudget?: string;
  triggeredBy?: string;
};
type WorkbenchChatInput = {
  projectId?: string;
  prompt: string;
  selectedModel?: string;
  thinkingBudget?: string;
  triggeredBy?: string;
  workbenchNode?: string;
};

type ListRunTimelineInput = {
  projectId?: string;
  runId?: string;
};

type GetAssetRecommendationsInput = {
  projectId?: string;
  taskPackId?: string;
  stage?: ForgeWorkflowStage;
  query?: string;
};

const assetRecommendationManagementGroups: ForgeAssetRecommendationManagementGroup[] = [
  "启动资产",
  "执行资产",
  "规则资产",
  "证据资产",
  "知识资产"
];

const stageSkillCategoryMap: Record<ForgeWorkflowStage, ForgeSkill["category"][]> = {
  "项目接入": ["product"],
  "方案与任务包": ["product", "architecture", "design"],
  "开发执行": ["engineering"],
  "测试验证": ["quality"],
  "交付发布": ["release"],
  "归档复用": ["knowledge"]
};

const stageArtifactPreferenceMap: Partial<Record<ForgeWorkflowStage, string[]>> = {
  "项目接入": ["prd"],
  "方案与任务包": ["architecture-note", "ui-spec", "task-pack"],
  "开发执行": ["task-pack", "patch", "review-report"],
  "测试验证": ["demo-build", "test-report", "playwright-run", "patch"],
  "交付发布": ["release-brief", "release-audit", "review-decision"],
  "归档复用": ["knowledge-card", "release-audit", "review-report"]
};

export class ForgeApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "FORGE_BAD_REQUEST", status = 400) {
    super(message);
    this.name = "ForgeApiError";
    this.code = code;
    this.status = status;
  }
}

function buildProjectId(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "project"}-${Date.now().toString(36)}`;
}

function getActiveProject(snapshot: ForgeDashboardSnapshot) {
  return (
    snapshot.projects.find((project) => project.id === snapshot.activeProjectId) ??
    snapshot.projects[0] ??
    null
  );
}

function getScopedProject(snapshot: ForgeDashboardSnapshot, projectId?: string) {
  const normalizedProjectId = projectId?.trim();

  if (!normalizedProjectId) {
    return getActiveProject(snapshot);
  }

  const project = snapshot.projects.find((item) => item.id === normalizedProjectId) ?? null;

  if (!project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  return project;
}

function getQueryBoost(query: string, ...values: Array<string | null | undefined>) {
  if (!query) {
    return 0;
  }

  const haystack = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack) {
    return 0;
  }

  if (haystack.includes(query)) {
    return 12;
  }

  return query
    .split(/\s+/)
    .filter(Boolean)
    .some((token) => haystack.includes(token))
    ? 6
    : 0;
}

function getRecommendationPriorityRank(priority: ForgeAssetRecommendationPriority) {
  switch (priority) {
    case "required":
      return 3;
    case "recommended":
      return 2;
    case "reference":
    default:
      return 1;
  }
}

function mapLinkRelationToPriority(
  relation: ForgeProjectAssetLinkRelation
): ForgeAssetRecommendationPriority {
  if (relation === "required" || relation === "default") {
    return "required";
  }

  return "recommended";
}

function mapAssetTypeToManagementGroup(assetType: ForgeAsset["type"]): ForgeAssetRecommendationManagementGroup {
  switch (assetType) {
    case "template":
    case "prompt":
      return "启动资产";
    case "gate":
      return "规则资产";
    case "skill":
    default:
      return "执行资产";
  }
}

function appendAssetRecommendationItem(
  registry: Map<string, ForgeAssetRecommendationItem>,
  item: ForgeAssetRecommendationItem
) {
  const key = `${item.sourceKind}:${item.id}`;
  const existing = registry.get(key);

  if (!existing) {
    registry.set(key, item);
    return;
  }

  const useIncoming =
    getRecommendationPriorityRank(item.priority) > getRecommendationPriorityRank(existing.priority) ||
    (getRecommendationPriorityRank(item.priority) === getRecommendationPriorityRank(existing.priority) &&
      item.score > existing.score);
  const base = useIncoming ? item : existing;
  const other = useIncoming ? existing : item;

  registry.set(key, {
    ...base,
    linked: existing.linked || item.linked,
    score: Math.max(existing.score, item.score),
    relation: base.relation ?? other.relation ?? null,
    usageGuide: base.usageGuide ?? other.usageGuide ?? null,
    reason:
      existing.reason === item.reason
        ? base.reason
        : Array.from(new Set([existing.reason, item.reason].filter(Boolean))).join("；"),
    stageTags: Array.from(new Set([...existing.stageTags, ...item.stageTags])),
    sectorTags: Array.from(new Set([...existing.sectorTags, ...item.sectorTags]))
  });
}

function getActiveProjectProfile(snapshot: ForgeDashboardSnapshot): ForgeProjectProfile | null {
  if (!snapshot.activeProjectId) {
    return null;
  }

  return (
    snapshot.projectProfiles.find((profile) => profile.projectId === snapshot.activeProjectId) ??
    null
  );
}

function getOverallGateState(snapshot: ForgeDashboardSnapshot) {
  if (snapshot.deliveryGate.some((gate) => gate.status === "fail")) {
    return "blocked";
  }

  if (snapshot.deliveryGate.some((gate) => gate.status === "pending")) {
    return "pending";
  }

  return "ready";
}

function buildTaskControlCenterSummary(
  snapshot: ForgeDashboardSnapshot,
  items: ForgeTask[]
) {
  const scopedSnapshot: ForgeDashboardSnapshot = {
    ...snapshot,
    tasks: items
  };
  const dispatchQueue = getTaskDispatchQueue(scopedSnapshot);
  const projectLoad = getProjectTaskLoad(scopedSnapshot);
  const agentLoad = getAgentTaskLoad(scopedSnapshot);

  return {
    dispatchCount: dispatchQueue.length,
    blockedCount: items.filter((task) => task.status === "blocked").length,
    remediationCount: dispatchQueue.filter((item) => Boolean(item.remediationSummary)).length,
    topProject: projectLoad[0]?.project ?? null,
    busyAgent: agentLoad[0]?.agent ?? null,
    topRemediationOwner:
      dispatchQueue.find((item) => Boolean(item.remediationOwnerLabel))?.remediationOwnerLabel ?? null
  };
}

function buildControlPlaneMeta(snapshot: ForgeDashboardSnapshot, projectId?: string) {
  return {
    unifiedRemediationApiPath: "/api/forge/remediations/retry",
    runtimeSummary: buildRuntimeSummary(snapshot, projectId),
    controlPlane: buildControlPlaneSnapshot(snapshot, projectId)
  };
}

function buildGovernanceResponsibilitySummary(
  snapshot: ForgeDashboardSnapshot,
  projectId?: string
) {
  const releaseGate = getReleaseGateSummary(snapshot, projectId);
  const formalArtifactCoverage = getFormalArtifactCoverageSummary(snapshot, projectId);
  const formalArtifactGap = releaseGate.formalArtifactGap;
  const formalArtifactResponsibility = getFormalArtifactResponsibilitySummary(snapshot, projectId);
  const releaseClosureResponsibility = getReleaseClosureResponsibilitySummary(snapshot, projectId);
  const currentHandoff = buildCurrentHandoffRuntimeSummary(
    snapshot,
    projectId,
    getCurrentHandoffSummary(snapshot, projectId)
  );
  const pendingApprovals = releaseGate.approvalTrace
    .filter(
      (item) =>
        Boolean(item.nextAction) &&
        (item.artifactType === "release-brief" ||
          item.artifactType === "review-decision" ||
          item.statusLabel === "待形成" ||
          item.statusLabel === "评审中" ||
          item.statusLabel === "待确认" ||
          item.statusLabel === "需修改" ||
          Boolean(item.escalated))
    )
    .slice(0, 5)
    .map((item) => ({
      kind: item.kind,
      label: item.label,
      statusLabel: item.statusLabel,
      detail: item.detail,
      sourceCommandExecutionId: item.sourceCommandExecutionId ?? null,
      sourceCommandId: item.sourceCommandId ?? null,
      relatedRunId: item.relatedRunId ?? null,
      relatedRunLabel: item.relatedRunLabel ?? null,
      runtimeLabel: item.runtimeLabel ?? null,
      ownerLabel: item.ownerLabel ?? null,
      ownerRoleLabel: item.ownerRoleLabel ?? null,
      nextAction: item.nextAction ?? currentHandoff.nextAction,
      escalationLabel: item.escalationLabel ?? null,
      breachLabel: item.breachLabel ?? null,
      bridgeHandoffStatus: releaseGate.bridgeHandoffStatus ?? null,
      bridgeHandoffSummary: releaseGate.bridgeHandoffSummary ?? null,
      bridgeHandoffDetail: releaseGate.bridgeHandoffDetail ?? null
    }));
  const escalationItems = releaseGate.escalationActions.slice(0, 5).map((item) => ({
    label: item.label,
    detail: item.detail,
    sourceCommandExecutionId: item.sourceCommandExecutionId ?? null,
    sourceCommandId: item.sourceCommandId ?? null,
    relatedRunId: item.relatedRunId ?? null,
    relatedRunLabel: item.relatedRunLabel ?? null,
    runtimeLabel: item.runtimeLabel ?? null,
    ownerLabel: item.ownerLabel ?? null,
    ownerRoleLabel: item.ownerRoleLabel ?? null,
    nextAction: item.nextAction ?? currentHandoff.nextAction,
    escalationLabel: item.escalationLabel ?? null,
    triggerLabel: item.triggerLabel ?? null,
    taskId: item.taskId ?? null,
    taskLabel: item.taskLabel ?? null,
    blocking: item.blocking,
    bridgeHandoffStatus: item.bridgeHandoffStatus ?? null,
    bridgeHandoffSummary: item.bridgeHandoffSummary ?? null,
    bridgeHandoffDetail: item.bridgeHandoffDetail ?? null
  }));

  return {
    currentHandoff,
    formalArtifactCoverage,
    formalArtifactGap,
    formalArtifactResponsibility,
    approvalHandoff: formalArtifactResponsibility.approvalHandoff,
    releaseClosure: releaseGate.releaseClosure,
    releaseClosureResponsibility,
    archiveProvenance: releaseGate.archiveProvenance ?? null,
    pendingApprovals,
    escalationItems,
    releaseGate
  };
}

function buildCurrentHandoffRuntimeSummary(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | undefined,
  currentHandoff: ReturnType<typeof getCurrentHandoffSummary>
) {
  const controllerAgent = resolveExecutionBackendControllerAgent(snapshot);
  const summary = {
    ...currentHandoff,
    runtimeExecutionControllerLabel: controllerAgent
      ? getForgeAgentDisplayLabel(controllerAgent)
      : null,
    runtimeExecutionControllerRoleLabel: controllerAgent ? "Nano CEO 总控" : null,
    runtimeExecutionBackendLabel: null,
    runtimeExecutionBackendCommandPreview: null,
    runtimeExecutionBackendInvocation: null
  };

  if (!projectId) {
    return summary;
  }
  const handoffEntry = resolveProjectHandoffExecutionBackendEntry(snapshot, projectId);
  const invocation = handoffEntry?.invocation ?? null;

  if (!invocation) {
    return summary;
  }

  return {
    ...summary,
    runtimeExecutionControllerLabel: invocation.payload?.controllerAgent
      ? getForgeAgentDisplayLabel(invocation.payload.controllerAgent)
      : null,
    runtimeExecutionControllerRoleLabel: invocation.payload?.controllerAgent ? "Nano CEO 总控" : null,
    runtimeExecutionBackendLabel: invocation.backend,
    runtimeExecutionBackendCommandPreview: invocation.commandPreview,
    runtimeExecutionBackendInvocation: invocation
  };
}

function resolveProjectHandoffExecutionBackendEntry(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  executionBackends: ForgeExecutionBackendCoverage[] = buildExecutionBackendCoverage(snapshot)
) {
  const currentHandoff = getCurrentHandoffSummary(snapshot, projectId);
  const hasReadyPrd = snapshot.artifacts.some(
    (artifact) => artifact.projectId === projectId && artifact.type === "prd" && artifact.status === "ready"
  );
  const archiveTask = snapshot.tasks.find(
    (task) =>
      task.projectId === projectId &&
      task.id === `task-${projectId}-knowledge-card` &&
      task.status !== "done"
  );
  const commandType =
    currentHandoff.stage === "项目接入" && !hasReadyPrd
      ? ("prd.generate" as const)
      : currentHandoff.source === "review-handoff"
      ? ("review.run" as const)
      : currentHandoff.source === "qa-handoff"
        ? ("gate.run" as const)
        : currentHandoff.source === "release-candidate"
          ? ("release.prepare" as const)
          : currentHandoff.stage === "归档复用" && archiveTask
            ? ("archive.capture" as const)
            : null;
  const label =
    commandType === "prd.generate"
      ? "CEO总控"
      : commandType === "review.run"
      ? "规则审查"
      : commandType === "gate.run"
        ? "测试门禁"
        : commandType === "release.prepare"
          ? "交付说明"
          : commandType === "archive.capture"
            ? "归档沉淀"
            : null;
  const command = commandType
    ? snapshot.commands.find((item) => item.type === commandType) ?? null
    : null;
  const taskPackArtifact = resolveTaskPackArtifact(snapshot, projectId, undefined);
  const linkedComponentIds = snapshot.projectAssetLinks
    .filter((link) => link.projectId === projectId && link.targetType === "component")
    .map((link) => link.targetId);
  const invocation = command
    ? buildExecutionBackendInvocation(snapshot, {
        projectId,
        taskPackId: taskPackArtifact?.id ?? null,
        linkedComponentIds,
        commandId: command.id,
        executionBackends
      })
    : null;

  return {
    currentHandoff,
    commandType,
    label,
    command,
    taskPackArtifact,
    linkedComponentIds,
    invocation
  };
}

function withModelExecutionGuidance(
  base: string | null | undefined,
  input: {
    runtimeModelProviderLabel?: string | null;
    runtimeModelExecutionDetail?: string | null;
  }
) {
  const provider = input.runtimeModelProviderLabel ?? input.runtimeModelExecutionDetail ?? null;
  const normalizedBase = base?.trim() || null;

  if (!provider) {
    return normalizedBase;
  }

  if (normalizedBase?.includes("模型执行器：")) {
    return normalizedBase;
  }

  return normalizedBase
    ? `${normalizedBase} · 模型执行器：${provider}`
    : `模型执行器：${provider}`;
}

function withExecutionBackendGuidance(
  base: string | null | undefined,
  backendLabel?: string | null
) {
  const normalizedBase = base?.trim() || null;
  const normalizedBackend = backendLabel?.trim() || null;

  if (!normalizedBackend) {
    return normalizedBase;
  }

  if (normalizedBase?.includes("执行后端：")) {
    return normalizedBase;
  }

  return normalizedBase
    ? `${normalizedBase} · 执行后端：${normalizedBackend}`
    : `执行后端：${normalizedBackend}`;
}

function matchesRecommendedSector(input: string, recommendedSectors: string[]) {
  const normalizedInput = input.trim().toLowerCase();

  if (!normalizedInput) {
    return true;
  }

  return recommendedSectors.some((sector) => {
    const normalizedSector = sector.trim().toLowerCase();
    return normalizedSector.includes(normalizedInput) || normalizedInput.includes(normalizedSector);
  });
}

function buildComponentRegistryResult(
  snapshot: ForgeDashboardSnapshot,
  options: {
    projectId?: string;
    taskPackId?: string;
    query?: string;
    category?: ForgeComponentCategory;
    sector?: string;
    sourceType?: ForgeComponentSourceType;
  } = {}
) {
  const projectId = options.projectId?.trim() ?? "";
  const scopedProject = projectId
    ? snapshot.projects.find((project) => project.id === projectId) ?? null
    : getActiveProject(snapshot);
  const query = options.query?.trim().toLowerCase() ?? "";
  const sector = options.sector?.trim().toLowerCase() ?? scopedProject?.sector.toLowerCase() ?? "";
  const filteredItems = snapshot.components.filter((component) => {
    const matchesCategory = options.category ? component.category === options.category : true;
    const matchesSourceType = options.sourceType ? component.sourceType === options.sourceType : true;
    const matchesSector = sector ? matchesRecommendedSector(sector, component.recommendedSectors) : true;
    const matchesQuery = query
      ? [component.title, component.summary, component.tags.join(" "), component.usageGuide]
          .join(" ")
          .toLowerCase()
          .includes(query)
      : true;

    return matchesCategory && matchesSourceType && matchesSector && matchesQuery;
  });
  const recommendedCount = scopedProject
    ? filteredItems.filter((component) => matchesRecommendedSector(scopedProject.sector, component.recommendedSectors))
        .length
    : filteredItems.length;
  const assemblyPlan = getTaskPackAssemblySuggestions(snapshot, scopedProject?.id, options.taskPackId);
  const usageSignals = scopedProject
    ? getComponentUsageSignals(snapshot, scopedProject.id)
        .filter((signal) => filteredItems.some((component) => component.id === signal.component.id))
        .map((signal) => ({
          componentId: signal.component.id,
          title: signal.component.title,
          status: signal.status,
          statusLabel: signal.statusLabel,
          usageCount: signal.usageCount,
          successCount: signal.successCount,
          blockedCount: signal.blockedCount,
          runningCount: signal.runningCount,
          lastRunId: signal.lastRunId,
          lastRunTitle: signal.lastRunTitle,
          lastRunState: signal.lastRunState,
          lastFailureSummary: signal.lastFailureSummary
        }))
    : [];
  const filteredComponentIds = new Set(filteredItems.map((component) => component.id));
  const linkedItems = scopedProject
    ? snapshot.projectAssetLinks
        .filter(
          (link) =>
            link.projectId === scopedProject.id &&
            link.targetType === "component" &&
            filteredComponentIds.has(link.targetId)
        )
        .map((link) => {
          const component = filteredItems.find((item) => item.id === link.targetId);

          return component
            ? {
                componentId: component.id,
                title: component.title,
                relation: link.relation,
                reason: link.reason
              }
            : null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  return {
    total: filteredItems.length,
    categories: Array.from(new Set(snapshot.components.map((component) => component.category))),
    project: scopedProject
      ? {
          id: scopedProject.id,
          name: scopedProject.name,
          sector: scopedProject.sector
        }
      : null,
    taskPack: assemblyPlan.taskPack
      ? {
          id: assemblyPlan.taskPack.id,
          title: assemblyPlan.taskPack.title
        }
      : null,
    recommendedCount,
    linkedCount: linkedItems.length,
    linkedItems,
    usageSignals,
    assemblySuggestions: assemblyPlan.items
      .filter((item) => filteredComponentIds.has(item.component.id))
      .slice(0, 5)
      .map((item) => ({
        componentId: item.component.id,
        title: item.component.title,
        score: item.score,
        reason: item.reason
      })),
    items: filteredItems
  };
}

const githubCategorySearchTerms: Record<ForgeComponentCategory, string[]> = {
  auth: ["authentication", "login", "auth", "session"],
  payment: ["payment", "checkout", "billing", "stripe"],
  file: ["file-upload", "upload", "storage", "uploader"],
  data: ["table", "form", "dashboard", "chart"],
  communication: ["chat", "messaging", "support", "conversation"]
};

function deriveGitHubCandidateMaturity(
  stars: number,
  updatedAt: string | null
): ForgeExternalComponentCandidateMaturity {
  const updatedRecently = updatedAt ? Date.now() - Date.parse(updatedAt) < 1000 * 60 * 60 * 24 * 365 : false;

  if (stars >= 2000 && updatedRecently) {
    return "established";
  }

  if (stars >= 200 || updatedRecently) {
    return "active";
  }

  return "seed";
}

function deriveGitHubCandidateSecurityTier(
  stars: number
): ForgeExternalComponentCandidateSecurityTier {
  return stars >= 1000 ? "community" : "unknown";
}

function buildExternalComponentSearchContext(
  snapshot: ForgeDashboardSnapshot,
  options: {
    projectId?: string;
    taskPackId?: string;
    query?: string;
    tags?: string[];
    category?: ForgeComponentCategory;
    sector?: string;
    sourceType?: ForgeComponentSourceType;
  } = {}
) {
  const registry = buildComponentRegistryResult(snapshot, options);
  const componentIndex = new Map(registry.items.map((item) => [item.id, item] as const));
  const selectedComponents =
    registry.assemblySuggestions.length > 0
      ? registry.assemblySuggestions
          .map((item) => componentIndex.get(item.componentId))
          .filter((item): item is ForgeComponent => Boolean(item))
      : registry.items.slice(0, 3);
  const categories = Array.from(
    new Set(
      (options.category ? [options.category] : selectedComponents.map((item) => item.category)).filter(Boolean)
    )
  );
  const tagTerms = Array.from(
    new Set(
      [
        ...(options.tags ?? []),
        ...selectedComponents.flatMap((item) => item.tags.slice(0, 2))
      ]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
  const keywordTerms = Array.from(
    new Set(
      categories.flatMap((category) => githubCategorySearchTerms[category] ?? []).slice(0, 6)
    )
  );
  const textTerms = Array.from(
    new Set(
      [options.query?.trim() ?? "", ...tagTerms, ...keywordTerms]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  return {
    registry,
    categories,
    selectedComponents,
    searchTerms: textTerms.length > 0 ? textTerms : ["nextjs", "react", "typescript", "component"],
    project: registry.project,
    taskPack: registry.taskPack
  };
}

function buildGitHubRepositorySearchQuery(input: {
  searchTerms: string[];
  language?: string;
}) {
  const terms = [...input.searchTerms, "nextjs", "react", "typescript"].slice(0, 8);
  const qualifiers = ["archived:false"];

  if (input.language?.trim()) {
    qualifiers.push(`language:${input.language.trim()}`);
  }

  return [...terms, ...qualifiers].join(" ");
}

export async function searchExternalComponentResourcesForAI(
  options: {
    projectId?: string;
    taskPackId?: string;
    query?: string;
    tags?: string[];
    category?: ForgeComponentCategory;
    sector?: string;
    sourceType?: ForgeComponentSourceType;
    language?: string;
    maturity?: ForgeExternalComponentCandidateMaturity;
    maxItems?: number;
  } = {},
  dbPath?: string,
  fetchImpl: typeof fetch = fetch
): Promise<{
  status: "ready" | "degraded";
  warning: string | null;
  total: number;
  project: Pick<ForgeProject, "id" | "name" | "sector"> | null;
  taskPack: Pick<ForgeArtifact, "id" | "title"> | null;
  categories: ForgeComponentCategory[];
  searchQuery: string;
  items: ForgeExternalComponentCandidate[];
}> {
  const snapshot = loadDashboardSnapshot(dbPath);
  const context = buildExternalComponentSearchContext(snapshot, options);
  const maxItems = Math.max(1, Math.min(options.maxItems ?? 5, 10));
  const searchQuery = buildGitHubRepositorySearchQuery({
    searchTerms: context.searchTerms,
    language: options.language
  });

  try {
    const response = await fetchImpl(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=stars&order=desc&per_page=${maxItems}`,
      {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "forge-local-search"
        }
      }
    );

    if (!response.ok) {
      return {
        status: "degraded",
        warning: `GitHub 搜索暂不可用（HTTP ${response.status}）。`,
        total: 0,
        project: context.project,
        taskPack: context.taskPack,
        categories: context.categories,
        searchQuery,
        items: []
      };
    }

    const payload = (await response.json()) as {
      items?: Array<{
        id: number;
        full_name: string;
        name: string;
        description: string | null;
        html_url: string;
        language: string | null;
        stargazers_count: number;
        pushed_at: string | null;
        topics?: string[];
      }>;
    };

    const items = (payload.items ?? [])
      .map((item) => {
        const maturity = deriveGitHubCandidateMaturity(item.stargazers_count, item.pushed_at);

        if (options.maturity && maturity !== options.maturity) {
          return null;
        }

        return {
          id: `github-candidate-${item.id}`,
          title: item.name,
          summary: item.description ?? "暂无仓库说明。",
          sourceType: "github-candidate" as const,
          sourceRef: item.html_url,
          repoFullName: item.full_name,
          language: item.language,
          stars: item.stargazers_count,
          updatedAt: item.pushed_at,
          topics: item.topics ?? [],
          maturity,
          securityTier: deriveGitHubCandidateSecurityTier(item.stargazers_count),
          matchedComponentIds: context.selectedComponents.map((component) => component.id),
          matchedCategories: context.categories,
          recommendationReason:
            context.selectedComponents.length > 0
              ? `匹配当前 TaskPack / 项目建议：${context.selectedComponents.map((component) => component.title).join(" / ")}`
              : `匹配当前搜索上下文：${context.searchTerms.join(" / ")}`
        };
      })
      .filter((item): item is ForgeExternalComponentCandidate => Boolean(item));

    return {
      status: "ready",
      warning: items.length === 0 ? "没有找到匹配的 GitHub 候选资源。" : null,
      total: items.length,
      project: context.project,
      taskPack: context.taskPack,
      categories: context.categories,
      searchQuery,
      items
    };
  } catch (error) {
    return {
      status: "degraded",
      warning: error instanceof Error ? `GitHub 搜索失败：${error.message}` : "GitHub 搜索失败。",
      total: 0,
      project: context.project,
      taskPack: context.taskPack,
      categories: context.categories,
      searchQuery,
      items: []
    };
  }
}

const artifactLabels: Record<string, string> = {
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

const stageArtifactBlockers: Record<string, string> = {
  "architecture-note": "架构说明 尚未齐备",
  "ui-spec": "原型与交互规范 尚未齐备",
  "task-pack": "TaskPack 尚未齐备",
  "review-report": "规则审查记录 尚未齐备",
  "demo-build": "Demo 构建 尚未齐备",
  "test-report": "测试报告 尚未齐备",
  "release-brief": "交付说明 尚未齐备",
  "knowledge-card": "知识卡 尚未齐备"
};

const runtimeAdapters = createDefaultRuntimeAdapters();

const commandHandlerRegistry: Partial<Record<ForgeCommand["type"], ForgeCommandHandler>> = {
  "archive.capture": handleArchiveCaptureCommand,
  "execution.start": handleExecutionStartCommand,
  "release.prepare": handleReleasePrepareCommand,
  "prd.generate": handlePrdGenerateCommand,
  "review.run": handleReviewRunCommand,
  "gate.run": handleGateRunCommand
};

export function getCommandHandler(commandType: ForgeCommand["type"]) {
  return commandHandlerRegistry[commandType] ?? null;
}

function buildDefaultPolicyDecisions(
  snapshot: ForgeDashboardSnapshot,
  input: RecordCommandExecutionInput
) {
  const command = snapshot.commands.find((item) => item.id === input.commandId);

  if (!command) {
    return [];
  }

  const readyArtifactTypes = new Set(
    snapshot.artifacts
      .filter(
        (artifact) => artifact.projectId === input.projectId && artifact.status === "ready"
      )
      .map((artifact) => artifact.type)
  );
  const missingArtifacts = command.requiresArtifacts.filter((type) => !readyArtifactTypes.has(type));
  const effectiveMissingArtifacts = command.requiresArtifacts.filter(
    (type) =>
      !snapshot.artifacts.some((artifact) => {
        if (artifact.projectId !== input.projectId || artifact.type !== type) {
          return false;
        }

        if (command.type === "review.run" && (type === "patch" || type === "demo-build")) {
          return artifact.status !== "draft";
        }

        return readyArtifactTypes.has(type);
      })
  );

  if (effectiveMissingArtifacts.length > 0) {
    return [
      {
        id: `${input.id}-decision-before-run`,
        hookId: "hook-before-run",
        outcome: "block" as const,
        summary: `缺少必要工件：${effectiveMissingArtifacts
          .map((type) => artifactLabels[type] ?? type)
          .join(" / ")}。`
      }
    ];
  }

  if (
    command.triggerStage === "交付发布" &&
    snapshot.deliveryGate.some((gate) => gate.status === "fail")
  ) {
    return [
      {
        id: `${input.id}-decision-before-release`,
        hookId: "hook-before-release",
        outcome: "block" as const,
        summary: "存在失败门禁，禁止推进交付发布。"
      }
    ];
  }

  return [];
}

function requireText(value: string, label: string) {
  if (!value.trim()) {
    throw new ForgeApiError(`${label}不能为空`, "FORGE_VALIDATION_ERROR", 400);
  }

  return value.trim();
}

function requireTextList(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ForgeApiError(`${label}必须是字符串数组`, "FORGE_VALIDATION_ERROR", 400);
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function requireAgentRole(value: string, label = "员工角色"): ForgeAgentRole {
  const normalized = requireText(value, label);
  const validRoles: ForgeAgentRole[] = [
    "pm",
    "architect",
    "design",
    "engineer",
    "qa",
    "release",
    "knowledge"
  ];

  if (!validRoles.includes(normalized as ForgeAgentRole)) {
    throw new ForgeApiError("当前员工角色不受支持", "FORGE_VALIDATION_ERROR", 400);
  }

  return normalized as ForgeAgentRole;
}

function requireAgentOwnerMode(value: string, label = "负责人模式"): ForgeAgentOwnerMode {
  const normalized = requireText(value, label);
  const validModes: ForgeAgentOwnerMode[] = ["human-approved", "review-required", "auto-execute"];

  if (!validModes.includes(normalized as ForgeAgentOwnerMode)) {
    throw new ForgeApiError("当前负责人模式不受支持", "FORGE_VALIDATION_ERROR", 400);
  }

  return normalized as ForgeAgentOwnerMode;
}

function requireModelProviderId(value: string, label = "模型供应商 ID"): ForgeModelProviderId {
  const normalized = requireText(value, label);

  if (!isForgeModelProviderId(normalized)) {
    throw new ForgeApiError("当前模型供应商不受支持", "FORGE_VALIDATION_ERROR", 400);
  }

  return normalized;
}

function appendExtraNotes(summary: string, extraNotes?: string) {
  const notes = extraNotes?.trim();

  if (!notes) {
    return summary;
  }

  return `${summary} | ${notes}`;
}

function resolveProjectAgentId(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  roles: ForgeAgentRole | ForgeAgentRole[],
  fallbackAgentId: string
) {
  return getProjectAgentIdByRoles(snapshot, projectId, roles, fallbackAgentId) ?? fallbackAgentId;
}

function getFixedCeoOrchestratorAgent(snapshot: ForgeDashboardSnapshot) {
  return snapshot.agents.find((agent) => agent.id === "agent-service-strategy") ?? null;
}

function resolveExecutionBackendAgent(
  snapshot: ForgeDashboardSnapshot,
  projectId: string | null | undefined,
  commandType: ForgeCommand["type"] | null
) {
  if (commandType === "prd.generate") {
    return (
      getFixedCeoOrchestratorAgent(snapshot) ??
      (projectId ? getProjectWorkbenchAgentForCommand(snapshot, projectId, commandType) : null)
    );
  }

  return projectId && commandType
    ? getProjectWorkbenchAgentForCommand(snapshot, projectId, commandType)
    : null;
}

function resolveCeoOrchestratorAgentId(
  snapshot: ForgeDashboardSnapshot,
  projectId: string
) {
  return getFixedCeoOrchestratorAgent(snapshot)?.id ??
    resolveProjectAgentId(snapshot, projectId, "pm", "agent-service-strategy");
}

function resolveExecutionBackendControllerAgent(snapshot: ForgeDashboardSnapshot) {
  return getFixedCeoOrchestratorAgent(snapshot);
}

const executionPreferenceCommandTypes = new Set<ForgeCommand["type"]>([
  "archive.capture",
  "execution.start",
  "gate.run",
  "release.prepare",
  "review.run"
]);

function buildExecutionPreferenceLines(
  input: Pick<ExecuteCommandInput, "selectedModel" | "thinkingBudget">
) {
  const selectedModel = input.selectedModel?.trim();
  const thinkingBudget = input.thinkingBudget?.trim();
  const lines: string[] = [];

  if (selectedModel) {
    lines.push(`模型偏好：${selectedModel}`);
  }

  if (thinkingBudget) {
    lines.push(`思考预算：${thinkingBudget}`);
  }

  return lines;
}

function withExecutionPreferenceNotes(
  input: ExecuteCommandInput,
  commandType: ForgeCommand["type"]
): ExecuteCommandInput {
  const nextInput: ExecuteCommandInput = {
    ...input,
    selectedModel: input.selectedModel?.trim(),
    thinkingBudget: input.thinkingBudget?.trim(),
    extraNotes: input.extraNotes?.trim()
  };

  if (!executionPreferenceCommandTypes.has(commandType)) {
    return nextInput;
  }

  const preferenceLines = buildExecutionPreferenceLines(nextInput);

  if (preferenceLines.length === 0) {
    return nextInput;
  }

  nextInput.extraNotes = [nextInput.extraNotes, ...preferenceLines].filter(Boolean).join("\n");

  return nextInput;
}

function decorateExecutionSummaryWithPreferences(
  summary: string,
  input: Pick<ExecuteCommandInput, "selectedModel" | "thinkingBudget">
) {
  const preferenceLines = buildExecutionPreferenceLines(input).filter(
    (line) => !summary.includes(line)
  );

  if (preferenceLines.length === 0) {
    return summary;
  }

  return [summary, ...preferenceLines].join(" | ");
}

function finalizeExecuteCommandResult<T extends { execution?: { summary?: string } }>(
  result: T,
  commandType: ForgeCommand["type"],
  input: ExecuteCommandInput
) {
  if (!executionPreferenceCommandTypes.has(commandType) || !result.execution?.summary) {
    return result;
  }

  return {
    ...result,
    execution: {
      ...result.execution,
      summary: decorateExecutionSummaryWithPreferences(result.execution.summary, input)
    }
  };
}

function deriveEvidenceStatusFromOutputMode(outputMode?: string | null) {
  const normalizedMode = outputMode?.trim() ?? "";

  if (!normalizedMode) {
    return "";
  }

  if (normalizedMode.startsWith("contract-")) {
    return "contract";
  }

  if (normalizedMode.endsWith("-executed")) {
    return "executed";
  }

  if (normalizedMode.endsWith("-ready")) {
    return "tool-ready";
  }

  return "";
}

function getEvidenceLabel(evidenceStatus: string) {
  const labels: Record<string, string> = {
    contract: "合同模式",
    "tool-ready": "工具就绪",
    executed: "已执行"
  };

  return labels[evidenceStatus] ?? "";
}

function getRunEvidenceStatus(run: Pick<ForgeDashboardSnapshot["runs"][number], "outputMode" | "outputChecks">) {
  const evidenceCheck = run.outputChecks.find((check) => check.name === "evidence");

  if (typeof evidenceCheck?.status === "string" && evidenceCheck.status.trim()) {
    return evidenceCheck.status.trim();
  }

  return deriveEvidenceStatusFromOutputMode(run.outputMode);
}

function getRunModelExecutionDetail(
  run: Pick<ForgeDashboardSnapshot["runs"][number], "outputChecks">
) {
  const modelExecutionCheck = run.outputChecks.find((check) => check.name === "model-execution");

  if (typeof modelExecutionCheck?.summary === "string" && modelExecutionCheck.summary.trim()) {
    return modelExecutionCheck.summary.trim();
  }

  return "";
}

function getRunModelExecutionProvider(
  run: Pick<ForgeDashboardSnapshot["runs"][number], "outputChecks">
) {
  const detail = getRunModelExecutionDetail(run);

  if (!detail) {
    return "";
  }

  return detail.split(" · ")[0]?.trim() ?? "";
}

function getProjectRuntimeSignal(snapshot: ForgeDashboardSnapshot, projectId: string) {
  const latestRuntimeRun = snapshot.runs.find(
    (run) =>
      run.projectId === projectId &&
      (Boolean(run.outputMode) || run.outputChecks.length > 0)
  );

  if (!latestRuntimeRun) {
    return "";
  }

  const parts = [
    latestRuntimeRun.outputMode ? `Runtime:${latestRuntimeRun.outputMode}` : "",
    getRunEvidenceStatus(latestRuntimeRun)
      ? `Evidence:${getRunEvidenceStatus(latestRuntimeRun)}`
      : "",
    latestRuntimeRun.outputChecks.length > 0
      ? `checks:${latestRuntimeRun.outputChecks
          .map((check) => `${check.name}=${check.status}`)
          .join(", ")}`
      : ""
  ].filter(Boolean);

  return parts.join(" | ");
}

function buildExecutionId(commandId: string) {
  return `command-execution-${commandId}-${Date.now().toString(36)}`;
}

function buildDecisionId(executionId: string, suffix: string) {
  return `${executionId}-${suffix}`;
}

function buildMissingArtifactBlockers(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  artifactTypes: string[]
) {
  return artifactTypes
    .filter(
      (type) =>
        !snapshot.artifacts.some(
          (artifact) =>
            artifact.projectId === projectId &&
            artifact.type === type &&
            artifact.status === "ready"
        )
    )
    .map((type) => stageArtifactBlockers[type] ?? `${artifactLabels[type] ?? type} 尚未齐备`);
}

function resolveTaskPackArtifact(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  taskPackId?: string
) {
  const projectTaskPacks = snapshot.artifacts.filter(
    (artifact) => artifact.projectId === projectId && artifact.type === "task-pack"
  );

  if (taskPackId?.trim()) {
    return (
      projectTaskPacks.find(
        (artifact) => artifact.id === taskPackId.trim() && artifact.status === "ready"
      ) ?? null
    );
  }

  return (
    projectTaskPacks.find((artifact) => artifact.status === "ready") ??
    projectTaskPacks[0] ??
    null
  );
}

function selectRunnerForCommand(
  snapshot: ForgeDashboardSnapshot,
  commandType: ForgeCommand["type"]
) {
  if (commandType === "execution.start") {
    return (
      snapshot.runners.find((runner) => runner.capabilities.includes("TaskPack 执行")) ?? null
    );
  }

  if (commandType === "review.run") {
    return (
      snapshot.runners.find(
        (runner) =>
          runner.capabilities.includes("规则审查") || runner.capabilities.includes("补丁评审")
      ) ?? null
    );
  }

  if (commandType === "gate.run") {
    return (
      snapshot.runners.find(
        (runner) =>
          runner.capabilities.includes("门禁回归") || runner.capabilities.includes("Playwright")
      ) ?? null
    );
  }

  if (commandType === "release.prepare" || commandType === "release.approve") {
    return (
      snapshot.runners.find((runner) => runner.capabilities.includes("发布说明")) ?? null
    );
  }

  if (commandType === "archive.capture") {
    return (
      snapshot.runners.find((runner) => runner.capabilities.includes("归档")) ?? null
    );
  }

  return null;
}

function getProjectLinkedComponents(
  snapshot: ForgeDashboardSnapshot,
  projectId: string
) {
  const componentIds = snapshot.projectAssetLinks
    .filter((link) => link.projectId === projectId && link.targetType === "component")
    .map((link) => link.targetId);

  return snapshot.components.filter((component) => componentIds.includes(component.id));
}

export function listProjectsForAI(dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);

  return {
    activeProjectId: snapshot.activeProjectId,
    projects: snapshot.projects
  };
}

export function getSnapshotForAI(dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const activeProject = getActiveProject(snapshot);
  const activeProjectProfile = getActiveProjectProfile(snapshot);
  const projectId = activeProject?.id;

  return {
    activeProject,
    activeProjectProfile,
    activeProjectId: snapshot.activeProjectId,
    projectCount: snapshot.projects.length,
    projects: snapshot.projects,
    projectProfiles: snapshot.projectProfiles,
    artifacts: snapshot.artifacts,
    artifactReviews: snapshot.artifactReviews,
    prdDocuments: snapshot.prdDocuments,
    commandExecutions: snapshot.commandExecutions,
    workflowStates: snapshot.workflowStates,
    workflowTransitions: snapshot.workflowTransitions,
    tasks: snapshot.tasks,
    runs: snapshot.runs,
    runEvents: snapshot.runEvents,
    deliveryState: getOverallGateState(snapshot),
    deliveryGate: snapshot.deliveryGate,
    controlPlane: buildControlPlaneSnapshot(snapshot, projectId)
  };
}

function buildControlPlaneSnapshot(snapshot: ForgeDashboardSnapshot, projectId?: string) {
  const componentRegistry = buildComponentRegistryResult(snapshot, { projectId });
  const executionBackends = buildExecutionBackendCoverage(snapshot);
  const governanceResponsibility = buildGovernanceResponsibilitySummary(snapshot, projectId);
  const remediationQueue = getRemediationTaskQueue(snapshot, projectId)
    .slice(0, 5)
    .map((item) => {
      const runtimeExecutionBackendInvocation = buildExecutionBackendInvocation(snapshot, {
        projectId: item.projectId,
        taskPackId: item.taskPackId ?? null,
        linkedComponentIds: item.linkedComponentIds ?? [],
        commandId: item.retryCommandId ?? null,
        executionBackends
      });

      return {
        ...item,
        runtimeExecutionBackendInvocation,
        runtimeExecutionBackendCommandPreview: runtimeExecutionBackendInvocation?.commandPreview ?? null
      };
    });
  const recentExecutions = getRecentCommandExecutions(snapshot, projectId).map((execution) => ({
    ...execution,
    followUpTasks: execution.followUpTasks.map((task) => {
      const runtimeExecutionBackendInvocation = buildExecutionBackendInvocation(snapshot, {
        projectId: execution.projectId ?? projectId ?? null,
        taskPackId: task.taskPackId ?? null,
        linkedComponentIds: task.linkedComponentIds ?? [],
        commandId: task.retryCommandId ?? null,
        executionBackends
      });

      return {
        ...task,
        runtimeExecutionBackendInvocation,
        runtimeExecutionBackendCommandPreview: runtimeExecutionBackendInvocation?.commandPreview ?? null
      };
    })
  }));

  return {
    unifiedRemediationApiPath: "/api/forge/remediations/retry",
    runtimeSummary: buildRuntimeSummary(snapshot, projectId),
    readiness: getDeliveryReadinessSummary(snapshot, projectId),
    releaseGate: governanceResponsibility.releaseGate,
    currentHandoff: governanceResponsibility.currentHandoff,
    formalArtifactCoverage: governanceResponsibility.formalArtifactCoverage,
    formalArtifactGap: governanceResponsibility.formalArtifactGap,
    formalArtifactResponsibility: governanceResponsibility.formalArtifactResponsibility,
    approvalHandoff: governanceResponsibility.approvalHandoff,
    releaseClosure: governanceResponsibility.releaseClosure,
    releaseClosureResponsibility: governanceResponsibility.releaseClosureResponsibility,
    archiveProvenance: governanceResponsibility.archiveProvenance,
    pendingApprovals: governanceResponsibility.pendingApprovals,
    escalationItems: governanceResponsibility.escalationItems,
    executionBackends,
    componentRegistry: {
      project: componentRegistry.project,
      taskPack: componentRegistry.taskPack,
      recommendedCount: componentRegistry.recommendedCount,
      linkedCount: componentRegistry.linkedCount,
      pendingCount: Math.max(
        componentRegistry.assemblySuggestions.length - componentRegistry.linkedCount,
        0
      ),
      linkedItems: componentRegistry.linkedItems.slice(0, 5),
      usageSignals: componentRegistry.usageSignals.slice(0, 5),
      items: componentRegistry.items.slice(0, 5),
      assemblySuggestions: componentRegistry.assemblySuggestions.slice(0, 3)
    },
    blockingTasks: getBlockingTaskChain(snapshot, projectId),
    remediationQueue,
    evidenceTimeline: getEvidenceTimeline(snapshot, projectId).slice(0, 10),
    recentExecutions
  };
}

export function getControlPlaneSnapshotForAI(
  input: { projectId?: string } = {},
  dbPath?: string
) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const resolvedProjectId =
    input.projectId?.trim() || snapshot.activeProjectId || snapshot.projects[0]?.id || "";
  const project = snapshot.projects.find((item) => item.id === resolvedProjectId) ?? null;

  if (resolvedProjectId && !project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  return {
    activeProjectId: snapshot.activeProjectId,
    project,
    ...buildControlPlaneMeta(snapshot, project?.id).controlPlane
  };
}

export function getDeliveryReadinessForAI(
  input: { projectId?: string } = {},
  dbPath?: string
) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const resolvedProjectId =
    input.projectId?.trim() || snapshot.activeProjectId || snapshot.projects[0]?.id || "";
  const project = snapshot.projects.find((item) => item.id === resolvedProjectId) ?? null;

  if (resolvedProjectId && !project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  const governanceResponsibility = buildGovernanceResponsibilitySummary(snapshot, project?.id);

  return {
    activeProjectId: snapshot.activeProjectId,
    project,
    ...buildControlPlaneMeta(snapshot, project?.id),
    currentHandoff: governanceResponsibility.currentHandoff,
    formalArtifactCoverage: governanceResponsibility.formalArtifactCoverage,
    formalArtifactGap: governanceResponsibility.formalArtifactGap,
    formalArtifactResponsibility: governanceResponsibility.formalArtifactResponsibility,
    approvalHandoff: governanceResponsibility.approvalHandoff,
    releaseClosure: governanceResponsibility.releaseClosure,
    releaseClosureResponsibility: governanceResponsibility.releaseClosureResponsibility,
    archiveProvenance: governanceResponsibility.archiveProvenance,
    pendingApprovals: governanceResponsibility.pendingApprovals,
    escalationItems: governanceResponsibility.escalationItems,
    executionBackends: buildExecutionBackendCoverage(snapshot),
    readiness: getDeliveryReadinessSummary(snapshot, project?.id),
    blockingTasks: getBlockingTaskChain(snapshot, project?.id),
    remediationQueue: getRemediationTaskQueue(snapshot, project?.id).slice(0, 5),
    releaseGate: governanceResponsibility.releaseGate,
    evidenceTimeline: getEvidenceTimeline(snapshot, project?.id).slice(0, 10)
  };
}

export function getRemediationsForAI(
  input: { projectId?: string } = {},
  dbPath?: string
) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const resolvedProjectId =
    input.projectId?.trim() || snapshot.activeProjectId || snapshot.projects[0]?.id || "";
  const project = snapshot.projects.find((item) => item.id === resolvedProjectId) ?? null;

  if (resolvedProjectId && !project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  const remediationQueue = getRemediationTaskQueue(snapshot, project?.id).slice(0, 10);
  const governanceResponsibility = buildGovernanceResponsibilitySummary(snapshot, project?.id);
  const releaseGate = governanceResponsibility.releaseGate;
  const executionBackends = buildExecutionBackendCoverage(snapshot);
  const escalationEntries = releaseGate.escalationActions.map((item) => {
    const retryCommandId =
      snapshot.commandExecutions.find((execution) =>
        execution.followUpTaskIds.includes(item.taskId ?? "")
      )?.commandId ?? null;
    const executionBackend = resolveExecutionBackendForCommandId(
      snapshot,
      retryCommandId,
      executionBackends
    );
    const runtimeExecutionBackendInvocation = buildExecutionBackendInvocation(snapshot, {
      projectId: project?.id ?? null,
      taskPackId:
        item.taskId
          ? remediationQueue.find((queueItem) => queueItem.id === item.taskId)?.taskPackId ?? null
          : null,
      linkedComponentIds:
        item.taskId
          ? remediationQueue.find((queueItem) => queueItem.id === item.taskId)?.linkedComponentIds ?? []
          : [],
      commandId: retryCommandId,
      executionBackends
    });

    return {
      kind: "escalation" as const,
      id: item.taskId ?? `escalation-${item.label}`,
      projectId: project?.id ?? null,
      title: item.taskLabel ?? item.label,
      detail: item.detail,
      taskPackId:
        item.taskId
          ? remediationQueue.find((queueItem) => queueItem.id === item.taskId)?.taskPackId ?? null
          : null,
      taskPackLabel:
        item.taskId
          ? remediationQueue.find((queueItem) => queueItem.id === item.taskId)?.taskPackLabel ?? null
          : null,
      ownerLabel: item.ownerLabel ?? null,
      ownerRoleLabel: item.ownerRoleLabel ?? null,
      retryCommandId,
      retryCommandLabel:
        item.taskId
          ? snapshot.commands.find((command) => command.id === retryCommandId)?.name ?? null
          : null,
      retryApiPath: item.retryApiPath ?? null,
      retryRunnerCommand: item.retryRunnerCommand ?? null,
      unifiedRetryApiPath: item.unifiedRetryApiPath ?? "/api/forge/remediations/retry",
      unifiedRetryRunnerArgs: item.unifiedRetryRunnerArgs ?? [],
      unifiedRetryRunnerCommand: item.unifiedRetryRunnerCommand ?? null,
      runtimeCapabilityDetails: item.runtimeEvidenceLabel ? [item.runtimeEvidenceLabel] : [],
      runtimeExecutionBackendLabel: executionBackend?.backend ?? null,
      runtimeExecutionBackendInvocation,
      runtimeExecutionBackendCommandPreview: runtimeExecutionBackendInvocation?.commandPreview ?? null,
      runtimeModelProviderLabel: item.runtimeModelProviderLabel ?? null,
      runtimeModelExecutionDetail: item.runtimeModelExecutionDetail ?? null,
      bridgeHandoffStatus: item.bridgeHandoffStatus ?? null,
      bridgeHandoffSummary: item.bridgeHandoffSummary ?? null,
      bridgeHandoffDetail: item.bridgeHandoffDetail ?? null,
      nextAction: withExecutionBackendGuidance(
        withModelExecutionGuidance(item.nextAction ?? null, item),
        executionBackend?.backend
      )
    };
  });
  const items = [
    ...remediationQueue.map((item) => {
      const runtimeExecutionBackendInvocation = buildExecutionBackendInvocation(snapshot, {
        projectId: item.projectId,
        taskPackId: item.taskPackId ?? null,
        linkedComponentIds: item.linkedComponentIds ?? [],
        commandId: item.retryCommandId ?? null,
        executionBackends
      });

      return {
        kind: "task" as const,
        id: item.id,
        projectId: item.projectId,
        title: item.title,
        detail: item.remediationSummary ?? item.evidenceAction,
        taskPackId: item.taskPackId ?? null,
        taskPackLabel: item.taskPackLabel ?? null,
        linkedComponentIds: item.linkedComponentIds ?? [],
        linkedComponentLabels: item.linkedComponentLabels ?? [],
        pendingComponentIds: item.pendingComponentIds ?? [],
        pendingComponentLabels: item.pendingComponentLabels ?? [],
        componentAssemblyAction: item.componentAssemblyAction ?? null,
        ownerLabel: item.remediationOwnerLabel ?? null,
        ownerRoleLabel: null,
        retryCommandId: item.retryCommandId ?? null,
        retryCommandLabel: item.retryCommandLabel ?? null,
        retryApiPath: item.retryApiPath ?? null,
        retryRunnerCommand: item.retryRunnerCommand ?? null,
        runtimeCapabilityDetails: item.runtimeCapabilityDetails ?? [],
        runtimeExecutionBackendLabel: item.runtimeExecutionBackendLabel ?? null,
        runtimeExecutionBackendInvocation,
        runtimeExecutionBackendCommandPreview: runtimeExecutionBackendInvocation?.commandPreview ?? null,
        runtimeModelProviderLabel: item.runtimeModelProviderLabel ?? null,
        runtimeModelExecutionDetail: item.runtimeModelExecutionDetail ?? null,
        bridgeHandoffStatus: item.bridgeHandoffStatus ?? null,
        bridgeHandoffSummary: item.bridgeHandoffSummary ?? null,
        bridgeHandoffDetail: item.bridgeHandoffDetail ?? null,
        nextAction: withExecutionBackendGuidance(
          withModelExecutionGuidance(item.remediationAction ?? null, item),
          resolveExecutionBackendForCommandId(snapshot, item.retryCommandId ?? null, executionBackends)?.backend
        )
      };
    }),
    ...escalationEntries
  ];

  return {
    activeProjectId: snapshot.activeProjectId,
    project,
    ...buildControlPlaneMeta(snapshot, project?.id),
    currentHandoff: governanceResponsibility.currentHandoff,
    formalArtifactCoverage: governanceResponsibility.formalArtifactCoverage,
    formalArtifactGap: governanceResponsibility.formalArtifactGap,
    formalArtifactResponsibility: governanceResponsibility.formalArtifactResponsibility,
    approvalHandoff: governanceResponsibility.approvalHandoff,
    releaseClosure: governanceResponsibility.releaseClosure,
    releaseClosureResponsibility: governanceResponsibility.releaseClosureResponsibility,
    pendingApprovals: governanceResponsibility.pendingApprovals,
    escalationItems: governanceResponsibility.escalationItems,
    executionBackends,
    total: items.length,
    items
  };
}

function extractProjectNameFromRequirement(requirement: string) {
  const patterns = [
    /(?:帮我|请|想要|需要)?(?:做一个|做个|做一套|搭一个|搭个|搭建一个|搭建)([^，。,；;]+)/,
    /(?:需要|想要)(?:一个|一套)?([^，。,；;]+)/
  ];

  for (const pattern of patterns) {
    const match = requirement.match(pattern);
    const candidate = match?.[1]
      ?.replace(/^(一个|一套)/, "")
      .split(/支持|包含|具备|提供/)[0]
      ?.trim();

    if (candidate) {
      return candidate;
    }
  }

  return (
    requirement
      .replace(/[。！？!?,，；;].*$/, "")
      .trim()
      .slice(0, 18) || "AI 交付项目"
  );
}

function inferProjectDraftFromRequirement(input: CreateProjectInput) {
  const requirement = requireText(input.requirement ?? "", "客户原始需求");
  const projectName = input.name?.trim() || extractProjectNameFromRequirement(requirement);
  const isRetailService = /(客服|售后|订单|支付|退款|零售|电商|副驾驶)/.test(requirement);
  const isRag = /(知识库|检索|问答|RAG)/i.test(requirement);
  const isOps = /(运营|简报|周报|内容)/.test(requirement);

  const templateId =
    input.templateId?.trim() ||
    (isRetailService
      ? "template-smart-service"
      : isRag
        ? "template-rag-service"
        : isOps
          ? "template-ops-automation"
          : "template-smart-service");
  const sector =
    input.sector?.trim() ||
    (isRetailService
      ? "智能客服 / 零售"
      : isRag
        ? "医疗问答 / RAG"
        : isOps
          ? "运营自动化 / Agent"
          : "AI 交付 / 通用");
  const projectType =
    input.projectType?.trim() ||
    (isRetailService
      ? "客服副驾驶"
      : isRag
        ? "知识助手"
        : isOps
          ? "运营自动化"
          : "AI 应用");

  return {
    requirement,
    project: {
      id: buildProjectId(projectName),
      name: projectName,
      sector,
      requirement,
      enterpriseName: input.enterpriseName?.trim() || "演示客户",
      owner: input.owner?.trim() || "Jy",
      projectType,
      deliveryDate: input.deliveryDate?.trim() || "",
      note: input.note?.trim() || "",
      templateId,
      teamTemplateId: input.teamTemplateId?.trim() || undefined
    }
  };
}

function seedDemoSafeProject(project: ForgeProjectDraft, requirement: string, dbPath?: string) {
  const scenarioLabel = /(支付失败|退款)/.test(requirement) ? "退款失败" : project.name;

  createProject(project, dbPath);

  const snapshot = loadDashboardSnapshot(dbPath);
  const pmAgentId = resolveProjectAgentId(snapshot, project.id, "pm", "agent-service-strategy");
  const architectAgentId = resolveProjectAgentId(
    snapshot,
    project.id,
    "architect",
    "agent-architect"
  );
  const designAgentId = resolveProjectAgentId(snapshot, project.id, "design", "agent-ux");
  const engineerAgentId = resolveProjectAgentId(
    snapshot,
    project.id,
    "engineer",
    "agent-frontend"
  );
  const qaAgentId = resolveProjectAgentId(snapshot, project.id, "qa", "agent-qa-automation");
  const releaseAgentId = resolveProjectAgentId(snapshot, project.id, "release", "agent-release");
  const knowledgeAgentId = resolveProjectAgentId(
    snapshot,
    project.id,
    "knowledge",
    "agent-knowledge-ops"
  );
  const profile =
    snapshot.projectProfiles.find((item) => item.projectId === project.id) ?? null;
  const templateId = profile?.defaultPromptIds[0] ?? snapshot.promptTemplates[0]?.id ?? "";

  if (templateId) {
    generatePrdDraft(
      {
        projectId: project.id,
        templateId,
        extraNotes: requirement
      },
      dbPath
    );
  }

  updateProjectOverview(
    {
      projectId: project.id,
      status: "ready",
      lastRun: "刚刚",
      progress: 88,
      riskNote: "等待演示现场确认交付口径"
    },
    dbPath
  );

  updateDeliveryGateStatuses(
    snapshot.deliveryGate.map((gate) => ({
      id: gate.id,
      status: "pass" as const
    })),
    dbPath
  );

  upsertProjectArtifact(
    {
      projectId: project.id,
      type: "prd",
      title: `${project.name} PRD 草案`,
      ownerAgentId: pmAgentId,
      status: "ready"
    },
    dbPath
  );
  upsertProjectArtifact(
    {
      projectId: project.id,
      type: "architecture-note",
      title: `${scenarioLabel}流程架构说明`,
      ownerAgentId: architectAgentId,
      status: "ready"
    },
    dbPath
  );
  upsertProjectArtifact(
    {
      projectId: project.id,
      type: "ui-spec",
      title: `${scenarioLabel}流程原型与交互规范`,
      ownerAgentId: designAgentId,
      status: "ready"
    },
    dbPath
  );
  const taskPackArtifact = upsertProjectArtifact(
    {
      projectId: project.id,
      type: "task-pack",
      title: `${scenarioLabel}主流程 TaskPack`,
      ownerAgentId: architectAgentId,
      status: "ready"
    },
    dbPath
  );
  upsertProjectArtifact(
    {
      projectId: project.id,
      type: "patch",
      title: `${scenarioLabel}补丁`,
      ownerAgentId: engineerAgentId,
      status: "ready"
    },
    dbPath
  );
  const demoBuildArtifact = upsertProjectArtifact(
    {
      projectId: project.id,
      type: "demo-build",
      title: `${scenarioLabel}流程 Demo 构建`,
      ownerAgentId: engineerAgentId,
      status: "ready"
    },
    dbPath
  );
  upsertProjectArtifact(
    {
      projectId: project.id,
      type: "review-report",
      title: `${scenarioLabel}流程规则审查记录`,
      ownerAgentId: architectAgentId,
      status: "ready"
    },
    dbPath
  );
  upsertProjectArtifact(
    {
      projectId: project.id,
      type: "test-report",
      title: `${scenarioLabel}流程测试报告`,
      ownerAgentId: qaAgentId,
      status: "ready"
    },
    dbPath
  );
  upsertProjectArtifact(
    {
      projectId: project.id,
      type: "playwright-run",
      title: `${scenarioLabel}流程 Playwright 回归`,
      ownerAgentId: qaAgentId,
      status: "ready"
    },
    dbPath
  );
  const releaseBriefArtifact = upsertProjectArtifact(
    {
      projectId: project.id,
      type: "release-brief",
      title: `${project.name} 交付说明`,
      ownerAgentId: releaseAgentId,
      status: "ready"
    },
    dbPath
  );
  upsertProjectArtifact(
    {
      projectId: project.id,
      type: "review-decision",
      title: `${project.name} 放行评审结论`,
      ownerAgentId: pmAgentId,
      status: "ready"
    },
    dbPath
  );

  upsertArtifactReview(
    {
      artifactId: demoBuildArtifact.id,
      reviewerAgentId: qaAgentId,
      decision: "pass",
      summary: "主流程已经通过，保留历史失败证据以便现场说明修复闭环。",
      conditions: ["主流程通过", "支付失败异常态已复核", "可进入交付说明确认"]
    },
    dbPath
  );
  upsertArtifactReview(
    {
      artifactId: releaseBriefArtifact.id,
      reviewerAgentId: pmAgentId,
      decision: "pass",
      summary: "交付说明、验收口径和演示备注已经确认，可直接进入一键部署演示。",
      conditions: ["演示话术已核对", "交付范围已确认", "现场可直接放行"]
    },
    dbPath
  );

  updateProjectTasks(
    {
      projectId: project.id,
      taskId: `task-${project.id}-intake`,
      status: "done",
      summary: "客户原始需求已收口，项目已进入演示链路。"
    },
    dbPath
  );
  updateProjectTasks(
    {
      projectId: project.id,
      taskId: `task-${project.id}-prd`,
      status: "done",
      summary: "结构化 PRD 已生成，可直接进入方案与任务包展示。"
    },
    dbPath
  );
  updateProjectTasks(
    {
      projectId: project.id,
      taskId: `task-${project.id}-design-arch`,
      status: "done",
      summary: "原型、架构说明与首轮 TaskPack 已全部就绪。"
    },
    dbPath
  );
  updateProjectTasks(
    {
      projectId: project.id,
      taskId: `task-${project.id}-runner-gates`,
      status: "done",
      summary: "研发执行、Demo 构建与回归门禁已经形成完整证据。"
    },
    dbPath
  );
  upsertProjectTask(
    {
      id: `task-${project.id}-release-approval`,
      projectId: project.id,
      stage: "交付发布",
      title: "确认交付说明并执行演示部署",
      ownerAgentId: "agent-release",
      status: "todo",
      priority: "P0",
      category: "release",
      summary: "交付资料已准备完成，现场点击一键部署即可完成闭环。"
    },
    dbPath
  );

  upsertRun(
    {
      id: `run-${project.id}-patch`,
      projectId: project.id,
      taskPackId: taskPackArtifact.id,
      linkedComponentIds: ["component-auth-email", "component-payment-checkout"],
      title: `生成${scenarioLabel}补丁`,
      executor: "Codex",
      cost: "$0.91",
      state: "done",
      outputMode: "codex-ready",
      outputChecks: [
        { name: "codex", status: "pass", summary: "Codex CLI 0.25.0" },
        {
          name: "model-execution",
          status: "pass",
          summary: "Claude Code · claude 2.1.34 · 来源 env:FORGE_ENGINEER_EXEC_COMMAND"
        }
      ],
      outputSummary: "已生成可回放的最小修复补丁，并同步到 Demo 构建分支。"
    },
    dbPath
  );
  upsertRun(
    {
      id: `run-${project.id}-playwright`,
      projectId: project.id,
      taskPackId: taskPackArtifact.id,
      linkedComponentIds: ["component-payment-checkout"],
      title: "主流程回归验证",
      executor: "Playwright",
      cost: "$0.37",
      state: "blocked",
      failureCategory: "test-failure",
      failureSummary: "登录态失效，主流程在支付确认页超时。",
      outputMode: "playwright-ready",
      outputChecks: [{ name: "playwright", status: "pass", summary: "Version 1.55.0" }]
    },
    dbPath
  );
  upsertRun(
    {
      id: `run-${project.id}-release-brief`,
      projectId: project.id,
      taskPackId: taskPackArtifact.id,
      title: `${project.name} 交付说明整理`,
      executor: "交付编排执行器",
      cost: "$0.00",
      state: "done",
      outputMode: "release-ready",
      outputChecks: [{ name: "release", status: "pass", summary: "交付说明、验收口径、部署备注已对齐" }],
      outputSummary: "交付说明与放行结论已经整理完毕，现场可直接进入部署演示。"
    },
    dbPath
  );

  updateProjectWorkflowState(
    {
      projectId: project.id,
      currentStage: "方案与任务包",
      state: "current",
      blockers: [],
      updatedBy: "pm"
    },
    dbPath
  );
  updateProjectWorkflowState(
    {
      projectId: project.id,
      currentStage: "开发执行",
      state: "current",
      blockers: [],
      updatedBy: "architect"
    },
    dbPath
  );
  updateProjectWorkflowState(
    {
      projectId: project.id,
      currentStage: "测试验证",
      state: "current",
      blockers: [],
      updatedBy: "qa"
    },
    dbPath
  );
  updateProjectWorkflowState(
    {
      projectId: project.id,
      currentStage: "交付发布",
      state: "current",
      blockers: [],
      updatedBy: "release"
    },
    dbPath
  );
}

export function createProjectForAI(input: CreateProjectInput, dbPath?: string) {
  const requirement = input.requirement?.trim();
  const shouldSeedDemoProject = Boolean(requirement) && input.demoSeed === true;
  const project = requirement
    ? inferProjectDraftFromRequirement(input).project
    : {
        id: buildProjectId(requireText(input.name, "项目名称")),
        name: requireText(input.name, "项目名称"),
        requirement: input.requirement?.trim() || "",
        enterpriseName: input.enterpriseName?.trim() || "",
        sector: requireText(input.sector, "行业 / 场景"),
        projectType: input.projectType?.trim() || "",
        owner: requireText(input.owner, "负责人"),
        deliveryDate: input.deliveryDate?.trim() || "",
        note: input.note?.trim() || "",
        templateId: input.templateId?.trim(),
        teamTemplateId: input.teamTemplateId?.trim()
      };

  if (shouldSeedDemoProject && requirement) {
    seedDemoSafeProject(project, requirement, dbPath);
  } else {
    createProject(project, dbPath);
  }

  return {
    activeProjectId: project.id,
    project
  };
}

export function updateProjectForAI(input: UpdateProjectInput, dbPath?: string) {
  const projectId = requireText(input.projectId, "项目 ID");

  return {
    activeProjectId: projectId,
    project: updateProjectDetails(
      {
        projectId,
        requirement: input.requirement,
        enterpriseName: input.enterpriseName,
        name: input.name,
        sector: input.sector,
        projectType: input.projectType,
        owner: input.owner,
        deliveryDate: input.deliveryDate,
        note: input.note,
        teamTemplateId: input.teamTemplateId
      },
      dbPath
    )
  };
}

export function deleteProjectForAI(projectId: string, dbPath?: string) {
  const normalizedProjectId = requireText(projectId, "项目 ID");
  const snapshot = loadDashboardSnapshot(dbPath);
  const project = snapshot.projects.find((item) => item.id === normalizedProjectId);

  if (!project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  return deleteProject(normalizedProjectId, dbPath);
}

export function activateProjectForAI(projectId: string, dbPath?: string) {
  const normalizedProjectId = requireText(projectId, "项目 ID");
  const snapshot = loadDashboardSnapshot(dbPath);
  const project = snapshot.projects.find((item) => item.id === normalizedProjectId);

  if (!project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  setActiveProject(normalizedProjectId, dbPath);

  return {
    activeProjectId: normalizedProjectId,
    project
  };
}

export function searchAssetsForAI(
  options: { query?: string; type?: ForgeAssetType } = {},
  dbPath?: string
) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const query = options.query?.trim().toLowerCase() ?? "";
  const promptItems = snapshot.promptTemplates.map((template) => ({
    id: template.id,
    title: template.title,
    type: "prompt" as const,
    summary: template.summary
  }));
  const items = [...snapshot.assets, ...promptItems].filter((asset) => {
    const matchesType = options.type ? asset.type === options.type : true;
    const matchesQuery = query
      ? `${asset.title} ${asset.summary}`.toLowerCase().includes(query)
      : true;

    return matchesType && matchesQuery;
  });

  return {
    total: items.length,
    items
  };
}

export function buildAssetRecommendationsForAI(
  snapshot: ForgeDashboardSnapshot,
  input: GetAssetRecommendationsInput = {}
): ForgeAssetRecommendationResult {
  const project = getScopedProject(snapshot, input.projectId);
  const workflowState = project
    ? snapshot.workflowStates.find((item) => item.projectId === project.id) ?? null
    : null;
  const stage = input.stage ?? workflowState?.currentStage ?? null;
  const query = input.query?.trim().toLowerCase() ?? "";
  const projectProfile = project
    ? snapshot.projectProfiles.find((profile) => profile.projectId === project.id) ?? null
    : null;
  const projectLinks = project
    ? snapshot.projectAssetLinks.filter((link) => link.projectId === project.id)
    : [];
  const taskPack = project ? resolveTaskPackArtifact(snapshot, project.id, input.taskPackId) : null;
  const recommendationRegistry = new Map<string, ForgeAssetRecommendationItem>();
  const sectorTags = project ? [project.sector] : [];

  if (!project) {
    return {
      project: null,
      stage,
      taskPack: null,
      query: input.query?.trim() || null,
      managementGroups: assetRecommendationManagementGroups,
      requiredItems: [],
      recommendedItems: [],
      referenceItems: [],
      total: 0,
      items: []
    };
  }

  const projectTemplate =
    snapshot.projectTemplates.find((item) => item.id === projectProfile?.templateId) ?? null;
  const templateLink =
    projectLinks.find((link) => link.targetType === "template" && link.targetId === projectTemplate?.id) ?? null;

  if (projectTemplate) {
    appendAssetRecommendationItem(recommendationRegistry, {
      id: projectTemplate.id,
      title: projectTemplate.title,
      sourceKind: "project-template",
      managementGroup: "启动资产",
      priority: "required",
      summary: projectTemplate.summary,
      reason: templateLink?.reason ?? "当前项目继承的默认模板，用于锁定启动资产与约束基线。",
      usageGuide: templateLink?.usageGuide ?? projectTemplate.dnaSummary,
      linked: true,
      score: 96 + getQueryBoost(query, projectTemplate.title, projectTemplate.summary, projectTemplate.sector),
      stageTags: ["项目接入", "方案与任务包"],
      sectorTags: [projectTemplate.sector],
      relation: templateLink?.relation ?? "default"
    });
  }

  const promptIds = Array.from(
    new Set([...(projectProfile?.defaultPromptIds ?? []), ...(projectTemplate?.defaultPromptIds ?? [])])
  );

  for (const promptId of promptIds) {
    const promptTemplate = snapshot.promptTemplates.find((item) => item.id === promptId);
    const promptLink =
      projectLinks.find((link) => link.targetType === "prompt" && link.targetId === promptId) ?? null;

    if (!promptTemplate) {
      continue;
    }

    appendAssetRecommendationItem(recommendationRegistry, {
      id: promptTemplate.id,
      title: promptTemplate.title,
      sourceKind: "prompt-template",
      managementGroup: "启动资产",
      priority: promptLink ? mapLinkRelationToPriority(promptLink.relation) : "required",
      summary: promptTemplate.summary,
      reason: promptLink?.reason ?? "项目默认 Prompt，用于生成 PRD、任务说明和首轮执行上下文。",
      usageGuide: promptLink?.usageGuide ?? promptTemplate.template,
      linked: true,
      score: 90 + getQueryBoost(query, promptTemplate.title, promptTemplate.summary, promptTemplate.scenario),
      stageTags: ["项目接入", "方案与任务包"],
      sectorTags,
      relation: promptLink?.relation ?? "default"
    });
  }

  const defaultGateIds = Array.from(
    new Set([...(projectProfile?.defaultGateIds ?? []), ...(projectTemplate?.defaultGateIds ?? [])])
  );

  for (const gateId of defaultGateIds) {
    const gate = snapshot.deliveryGate.find((item) => item.id === gateId);

    if (!gate) {
      continue;
    }

    const gateSummary = `当前状态：${
      gate.status === "fail" ? "失败" : gate.status === "pending" ? "待确认" : "通过"
    }`;

    appendAssetRecommendationItem(recommendationRegistry, {
      id: gate.id,
      title: gate.name,
      sourceKind: "gate",
      managementGroup: "规则资产",
      priority: "required",
      summary: gateSummary,
      reason:
        stage === "测试验证" || stage === "交付发布"
          ? `当前阶段需要以 ${gate.name} 门禁作为放行前置条件。`
          : `项目默认要求持续跟踪 ${gate.name} 门禁状态。`,
      usageGuide: "优先确认门禁状态，再决定是否继续执行或放行。",
      linked: true,
      score: 88 + (gate.status === "fail" ? 8 : gate.status === "pending" ? 4 : 0) + getQueryBoost(query, gate.name),
      stageTags: ["测试验证", "交付发布"],
      sectorTags,
      relation: "default"
    });
  }

  for (const link of projectLinks.filter((item) => item.targetType === "asset")) {
    const asset = snapshot.assets.find((item) => item.id === link.targetId);

    if (!asset) {
      continue;
    }

    appendAssetRecommendationItem(recommendationRegistry, {
      id: asset.id,
      title: asset.title,
      sourceKind: "asset",
      managementGroup: mapAssetTypeToManagementGroup(asset.type),
      priority: mapLinkRelationToPriority(link.relation),
      summary: asset.summary,
      reason: link.reason,
      usageGuide: link.usageGuide,
      linked: true,
      score: 74 + getRecommendationPriorityRank(mapLinkRelationToPriority(link.relation)) * 4 +
        getQueryBoost(query, asset.title, asset.summary),
      stageTags: stage ? [stage] : [],
      sectorTags,
      relation: link.relation
    });
  }

  const componentRegistry = buildComponentRegistryResult(snapshot, {
    projectId: project.id,
    taskPackId: taskPack?.id ?? input.taskPackId,
    query: input.query
  });
  const componentSuggestionMap = new Map(
    componentRegistry.assemblySuggestions.map((item) => [item.componentId, item] as const)
  );

  for (const component of componentRegistry.items) {
    const componentLink =
      projectLinks.find((link) => link.targetType === "component" && link.targetId === component.id) ?? null;
    const assemblySuggestion = componentSuggestionMap.get(component.id) ?? null;
    const sectorMatch = matchesRecommendedSector(project.sector, component.recommendedSectors);

    if (!componentLink && !assemblySuggestion && !sectorMatch) {
      continue;
    }

    appendAssetRecommendationItem(recommendationRegistry, {
      id: component.id,
      title: component.title,
      sourceKind: "component",
      managementGroup: "执行资产",
      priority: componentLink ? mapLinkRelationToPriority(componentLink.relation) : "recommended",
      summary: component.summary,
      reason:
        componentLink?.reason ??
        assemblySuggestion?.reason ??
        `适配 ${project.sector}，可补强当前项目执行链路。`,
      usageGuide: componentLink?.usageGuide ?? component.usageGuide,
      linked: Boolean(componentLink),
      score:
        72 +
        (assemblySuggestion ? 12 : 0) +
        (sectorMatch ? 8 : 0) +
        getQueryBoost(query, component.title, component.summary, component.tags.join(" ")),
      stageTags: stage ? [stage] : ["开发执行"],
      sectorTags: component.recommendedSectors,
      relation: componentLink?.relation ?? null
    });
  }

  const stageSkillCategories = stage ? stageSkillCategoryMap[stage] ?? [] : [];

  for (const skill of snapshot.skills.filter((item) => stageSkillCategories.includes(item.category))) {
    appendAssetRecommendationItem(recommendationRegistry, {
      id: skill.id,
      title: skill.name,
      sourceKind: "skill",
      managementGroup: "执行资产",
      priority: "recommended",
      summary: skill.summary,
      reason: stage ? `当前阶段 ${stage} 需要对应执行技能来补齐能力短板。` : "建议补齐当前项目执行能力。",
      usageGuide: skill.usageGuide,
      linked: false,
      score: 68 + getQueryBoost(query, skill.name, skill.summary),
      stageTags: stage ? [stage] : [],
      sectorTags,
      relation: null
    });
  }

  for (const sop of snapshot.sops.filter((item) => (stage ? item.stage === stage : true))) {
    appendAssetRecommendationItem(recommendationRegistry, {
      id: sop.id,
      title: sop.name,
      sourceKind: "sop",
      managementGroup: "规则资产",
      priority: "recommended",
      summary: sop.summary,
      reason: stage ? `当前阶段 ${stage} 需要按 SOP 收口执行与验收动作。` : "建议按 SOP 收口项目动作。",
      usageGuide: sop.checklist.join(" / "),
      linked: false,
      score: 70 + getQueryBoost(query, sop.name, sop.summary, sop.checklist.join(" ")),
      stageTags: [sop.stage],
      sectorTags,
      relation: null
    });
  }

  const preferredArtifactTypes = stage ? stageArtifactPreferenceMap[stage] ?? [] : [];

  for (const artifact of snapshot.artifacts.filter((item) => item.projectId === project.id)) {
    const preferredRank = preferredArtifactTypes.indexOf(artifact.type);
    const preferredScore = preferredRank >= 0 ? Math.max(14 - preferredRank * 2, 4) : 0;
    const readinessScore = artifact.status === "ready" ? 8 : artifact.status === "in-review" ? 5 : 2;

    appendAssetRecommendationItem(recommendationRegistry, {
      id: artifact.id,
      title: artifact.title,
      sourceKind: "artifact",
      managementGroup: "证据资产",
      priority: "reference",
      summary: `${artifactLabels[artifact.type] ?? artifact.type} · ${artifact.status === "ready" ? "可复用" : "进行中"}`,
      reason:
        stage
          ? `当前阶段可复用既有 ${artifactLabels[artifact.type] ?? artifact.type} 作为背景参考。`
          : `可复用既有 ${artifactLabels[artifact.type] ?? artifact.type} 作为背景参考。`,
      usageGuide: "优先复用既有工件里的约束、示例和验收线索。",
      linked: true,
      score: 44 + preferredScore + readinessScore + getQueryBoost(query, artifact.title, artifactLabels[artifact.type]),
      stageTags: stage ? [stage] : [],
      sectorTags,
      relation: null
    });
  }

  const items = Array.from(recommendationRegistry.values()).sort((left, right) => {
    const priorityDelta =
      getRecommendationPriorityRank(right.priority) - getRecommendationPriorityRank(left.priority);

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.title.localeCompare(right.title, "zh-CN");
  });

  return {
    project: {
      id: project.id,
      name: project.name,
      sector: project.sector
    },
    stage,
    taskPack: taskPack
      ? {
          id: taskPack.id,
          title: taskPack.title
        }
      : null,
    query: input.query?.trim() || null,
    managementGroups: assetRecommendationManagementGroups,
    requiredItems: items.filter((item) => item.priority === "required"),
    recommendedItems: items.filter((item) => item.priority === "recommended"),
    referenceItems: items.filter((item) => item.priority === "reference"),
    total: items.length,
    items
  };
}

export function getAssetRecommendationsForAI(
  input: GetAssetRecommendationsInput = {},
  dbPath?: string
): ForgeAssetRecommendationResult {
  return buildAssetRecommendationsForAI(loadDashboardSnapshot(dbPath), input);
}

export function getGateStatusForAI(dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const blockedGate = snapshot.deliveryGate.find((gate) => gate.status === "fail") ?? null;

  return {
    overallState: getOverallGateState(snapshot),
    blockedGate,
    gates: snapshot.deliveryGate
  };
}

function formatRunnerCapabilityDetail(detail: NonNullable<ForgeRunner["detectedCapabilityDetails"]>[number]) {
  return [detail.capability, detail.path ?? null, detail.version ? `Version ${detail.version}` : null]
    .filter(Boolean)
    .join(" · ");
}

const externalExecutionContractConfigs = [
  ...executionBackendContractConfigsRaw
] as ForgeExecutionBackendContractConfig[];

const defaultNanoManagerCommandTemplate =
  'node "{repoRoot}/scripts/forge-nanoclaw-manager.mjs" --command "{commandType}" --project-id "{projectId}" --stage "{stage}" --taskpack-id "{taskPackId}" --agent-id "{agentId}" --controller-id "{controllerAgentId}" --provider "{provider}" --workspace "{cwd}"';

const defaultNanoManagerHealthcheckCommandTemplate =
  'node "{repoRoot}/scripts/forge-nanoclaw-manager.mjs" --healthcheck';

const forgeRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function getTrimmedEnvValue(
  env: Record<string, string | undefined>,
  key: string
) {
  return String(env[key] || "").trim();
}

function splitCommandString(commandTemplate: string) {
  return String(commandTemplate)
    .trim()
    .match(/(?:[^\s"]+|"[^"]*")+/g)
    ?.map((part) => part.replace(/^"(.*)"$/, "$1")) ?? [];
}

function detectExecutablePath(command: string) {
  if (!command.trim()) {
    return null;
  }

  const result = spawnSync("which", [command.trim()], {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return null;
  }

  return String(result.stdout || "").trim() || null;
}

function detectExecutableVersion(binaryPath: string, args: string[] = ["--version"]) {
  if (!binaryPath.trim()) {
    return null;
  }

  const result = spawnSync(binaryPath.trim(), args, {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return null;
  }

  return [result.stdout, result.stderr]
    .map((item) => String(item || "").trim())
    .find(Boolean) ?? null;
}

type ForgeBackendExecutableProbe = {
  binary: string;
  path: string | null;
  version: string | null;
};

type ForgeBackendHealthcheckProbe = {
  status: "ready" | "degraded";
  summary: string;
  details: string[];
  version: string | null;
};

function parseStructuredHealthcheckOutput(output: string | null) {
  if (!output || !output.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(output);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const rawStatus = String((parsed as { status?: string }).status || "")
      .trim()
      .toLowerCase();
    const status =
      ["ready", "healthy", "ok", "success", "online"].includes(rawStatus)
        ? ("ready" as const)
        : ["degraded", "error", "fail", "failed", "offline"].includes(rawStatus)
          ? ("degraded" as const)
          : null;
    const summary = String((parsed as { summary?: string }).summary || "").trim();
    const details = Array.isArray((parsed as { details?: unknown[] }).details)
      ? (parsed as { details: unknown[] }).details.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const version = String((parsed as { version?: string }).version || "").trim() || null;

    if (!status || !summary) {
      return null;
    }

    return {
      status,
      summary,
      details,
      version
    };
  } catch {
    return null;
  }
}

function probeExecutable(
  binary: string,
  cache: Map<string, ForgeBackendExecutableProbe>
): ForgeBackendExecutableProbe {
  const normalizedBinary = binary.trim();

  if (cache.has(normalizedBinary)) {
    return cache.get(normalizedBinary)!;
  }

  const path = detectExecutablePath(normalizedBinary);
  const version = path ? detectExecutableVersion(path) : null;
  const probe = {
    binary: normalizedBinary,
    path,
    version
  };

  cache.set(normalizedBinary, probe);

  return probe;
}

function getNumericEnvValue(
  env: Record<string, string | undefined>,
  key: string,
  fallback: number
) {
  const raw = getTrimmedEnvValue(env, key);
  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function probeHealthcheckCommand(
  command: string[],
  env: Record<string, string | undefined>,
  cache: Map<string, ForgeBackendHealthcheckProbe>
) {
  const cacheKey = command.join("\u0000");

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const timeoutMs = getNumericEnvValue(env, "FORGE_NANO_HEALTHCHECK_TIMEOUT_MS", 2000);
  const [binary, ...args] = command;
  const result = spawnSync(binary, args, {
    encoding: "utf8",
    timeout: timeoutMs
  });
  const output = [result.stdout, result.stderr]
    .map((item) => String(item || "").trim())
    .find(Boolean) ?? null;
  const parsedOutput = parseStructuredHealthcheckOutput(output);
  const timedOut =
    result.error instanceof Error &&
    ("code" in result.error ? result.error.code === "ETIMEDOUT" : false);
  const successful = result.status === 0 && !result.error;
  if (parsedOutput) {
    const probe = {
      status: successful && parsedOutput.status === "ready" ? ("ready" as const) : ("degraded" as const),
      summary: parsedOutput.summary,
      details: [
        ...parsedOutput.details,
        ...(timedOut ? [`超时阈值：${timeoutMs}ms`] : []),
        ...(!successful ? [`退出码 ${result.status ?? "unknown"}`] : []),
        ...(result.error instanceof Error ? [`错误：${result.error.message}`] : [])
      ],
      version: parsedOutput.version
    };

    cache.set(cacheKey, probe);

    return probe;
  }

  const probe = successful
    ? {
        status: "ready" as const,
        summary: `健康检查通过：${command.join(" ")}`,
        details: output ? [`健康检查输出：${output}`] : [],
        version: output
      }
    : {
        status: "degraded" as const,
        summary: timedOut
          ? `健康检查超时：${command.join(" ")}`
          : `健康检查失败：${command.join(" ")} · 退出码 ${result.status ?? "unknown"}`,
        details: [
          timedOut ? `超时阈值：${timeoutMs}ms` : `退出码 ${result.status ?? "unknown"}`,
          ...(output ? [`健康检查输出：${output}`] : []),
          ...(result.error instanceof Error ? [`错误：${result.error.message}`] : [])
        ],
        version: null
      };

  cache.set(cacheKey, probe);

  return probe;
}

function getExternalExecutionContracts(
  env: Record<string, string | undefined> = process.env
) {
  return externalExecutionContractConfigs.flatMap((item) => {
    const laneCommandTemplate = getTrimmedEnvValue(env, item.source);
    const laneProvider = getTrimmedEnvValue(env, item.providerKey);
    const laneBackend = getTrimmedEnvValue(env, item.backendKey);
    const laneBackendCommandTemplate = getTrimmedEnvValue(env, item.commandKey);
    const nanoProvider = getTrimmedEnvValue(env, "FORGE_NANO_EXEC_PROVIDER") || "Nano CEO";
    const nanoBackend = getTrimmedEnvValue(env, "FORGE_NANO_EXEC_BACKEND");
    const nanoBackendCommandTemplate = getTrimmedEnvValue(env, "FORGE_NANO_EXEC_BACKEND_COMMAND");
    const usesGlobalNanoManager =
      !laneCommandTemplate &&
      !laneBackend &&
      !laneBackendCommandTemplate &&
      Boolean(nanoBackend || nanoBackendCommandTemplate);

    if (!laneCommandTemplate && !usesGlobalNanoManager) {
      return [];
    }

    const provider =
      laneProvider ||
      (laneCommandTemplate ? laneCommandTemplate.split(/\s+/)[0] || "未命名执行器" : nanoProvider);
    const backend = laneBackend || nanoBackend;
    const backendCommandTemplate =
      laneBackendCommandTemplate ||
      nanoBackendCommandTemplate ||
      (usesGlobalNanoManager ? defaultNanoManagerCommandTemplate : null);
    const commandConfigured = Boolean(backendCommandTemplate);

    return [
      {
        id: item.id,
        kind: item.kind,
        label: item.label,
        provider,
        backend,
        source: laneCommandTemplate ? item.source : "FORGE_NANO_EXEC_BACKEND_COMMAND",
        commandKey: item.commandKey,
        backendCommandTemplate: commandConfigured ? backendCommandTemplate : null,
        commandSource: commandConfigured
          ? laneBackendCommandTemplate
            ? item.commandKey
            : nanoBackendCommandTemplate
              ? "FORGE_NANO_EXEC_BACKEND_COMMAND"
              : "internal-default:nanoclaw-manager"
          : null,
        commandConfigured
      }
    ];
  });
}

function getCommandTemplatePlaceholders(commandTemplate?: string | null) {
  if (!commandTemplate) {
    return [];
  }

  return Array.from(
    new Set(
      Array.from(commandTemplate.matchAll(/\{([^}]+)\}/g))
        .map((match) => match[1]?.trim() ?? "")
        .filter(Boolean)
    )
  );
}

function renderCommandStringTemplate(
  commandTemplate: string,
  replacements: Record<string, string>
) {
  return Object.entries(replacements).reduce(
    (value, [token, replacement]) => value.replaceAll(`{${token}}`, replacement),
    commandTemplate
  );
}

function getCommandTemplateFlagValue(commandTemplate: string[], flag: string) {
  const flagIndex = commandTemplate.findIndex((item) => item === flag);

  if (flagIndex < 0) {
    return "";
  }

  return commandTemplate[flagIndex + 1] ?? "";
}

function getExternalExecutionContractDetails(
  env: Record<string, string | undefined> = process.env
) {
  return getExternalExecutionContracts(env).map(
    (item) => `${item.label}：${item.provider} · 来源 env:${item.source}`
  );
}

function getExecutionBackendContractDetails(
  env: Record<string, string | undefined> = process.env
) {
  return getExternalExecutionContracts(env)
    .filter((item) => item.backend)
    .map((item) => `${item.label}：${item.backend} · 承载 ${item.provider} · 来源 env:${item.source}`);
}

function getRunExecutionBackend(
  run: Pick<ForgeDashboardSnapshot["runs"][number], "outputChecks">
) {
  const detail = getRunModelExecutionDetail(run);

  if (!detail) {
    return "";
  }

  const backendSegment = detail
    .split(" · ")
    .find((part) => part.trim().startsWith("后端 "));

  return backendSegment?.replace(/^后端\s+/, "").trim() ?? "";
}

function getRunBridgeExecutionDetail(
  run: Pick<ForgeDashboardSnapshot["runs"][number], "executor" | "outputMode" | "outputChecks">
) {
  if (!run.outputMode?.startsWith("external-shell-bridge")) {
    return "";
  }

  const bridgeExecutionSummary =
    run.outputChecks.find((check) => check.name === "bridge-execution")?.summary?.trim() || "";

  return [run.executor?.trim() || null, run.outputMode, bridgeExecutionSummary]
    .filter(Boolean)
    .join(" · ");
}

function getExternalExecutionReadiness(input: {
  activeProviders: string[];
  details: string[];
}) {
  const contractCount = input.details.length;
  const activeProviderCount = input.activeProviders.length;

  if (contractCount === 0) {
    return {
      status: "fallback" as const,
      contractCount,
      activeProviderCount,
      summary: "当前未配置外部模型执行契约，默认仍走本地 fallback。",
      recommendation:
        "未配置外部模型执行契约，当前继续使用本地 fallback；如需真实模型执行，先配置 Engineer / Reviewer provider 契约。"
    };
  }

  if (activeProviderCount > 0) {
    return {
      status: "provider-active" as const,
      contractCount,
      activeProviderCount,
      summary: `已配置 ${contractCount} 条外部模型执行契约，当前证据来自 ${input.activeProviders.join(
        " / "
      )}。`,
      recommendation: `当前已有 ${input.activeProviders.join(
        " / "
      )} 的 provider 证据；后续执行、整改和回放优先沿现有外部执行链推进。`
    };
  }

  return {
    status: "contracts-ready" as const,
    contractCount,
    activeProviderCount,
    summary: `已配置 ${contractCount} 条外部模型执行契约，当前尚未产出新的 provider 证据。`,
    recommendation:
      "已配置外部模型执行契约，但尚未产出 provider 证据；建议先执行研发或规则审查，写回第一条外部执行证据。"
  };
}

function getExecutionBackendReadiness(input: {
  activeBackends: string[];
  details: string[];
}) {
  const configuredBackends = Array.from(
    new Set(
      input.details
        .map((item) => item.split("：")[1]?.split(" · ")[0]?.trim() ?? "")
        .filter(Boolean)
    )
  );

  if (configuredBackends.length === 0) {
    return {
      labels: [] as string[],
      summary: "当前外部执行契约未声明执行后端，默认仍由模型执行器直连。"
    };
  }

  if (input.activeBackends.length > 0) {
    return {
      labels: configuredBackends,
      summary: `当前外部执行后端为 ${input.activeBackends.join(" / ")}，后续执行与整改可继续沿该后端推进。`
    };
  }

  return {
    labels: configuredBackends,
    summary: `已声明 ${configuredBackends.length} 个外部执行后端：${configuredBackends.join(
      " / "
    )}，后续可把研发执行与规则审查统一接到这些后端。`
  };
}

function getNanoManagerReadiness(executionBackends: ForgeExecutionBackendCoverage[]) {
  const nanoBackends = executionBackends.filter((item) => item.backend === "NanoClaw");

  if (nanoBackends.length === 0) {
    return {
      status: "unconfigured" as const,
      summary: "当前还没有声明 NanoClaw CEO 总控后端。",
      details: [] as string[]
    };
  }

  const readyBackends = nanoBackends.filter((item) => item.probeStatus === "ready");
  const details = Array.from(
    new Set(nanoBackends.map((item) => `${item.label}：${item.probeSummary}`).filter(Boolean))
  );

  if (readyBackends.length === nanoBackends.length) {
    return {
      status: "ready" as const,
      summary: "NanoClaw CEO 总控已就绪，可继续接管 Forge 执行链。",
      details
    };
  }

  const degradedBackends = nanoBackends.filter((item) => item.probeStatus === "degraded");

  if (degradedBackends.length > 0) {
    return {
      status: "degraded" as const,
      summary: "NanoClaw CEO 总控响应异常，健康检查失败。",
      details
    };
  }

  return {
    status: "missing" as const,
    summary: "NanoClaw CEO 总控已声明，但当前仍有执行入口待接线。",
    details
  };
}

function buildRuntimeSummary(snapshot: ForgeDashboardSnapshot, projectId?: string | null) {
  const readiness = getDeliveryReadinessSummary(snapshot, projectId);
  const runtimeRuns = snapshot.runs.filter((run) =>
    (projectId ? run.projectId === projectId : true) &&
    (Boolean(run.outputMode) || run.outputChecks.length > 0)
  );
  const bridgeExecutionRuns = runtimeRuns.filter((run) =>
    run.outputMode?.startsWith("external-shell-bridge")
  );
  const evidenceStates = Array.from(
    new Set(runtimeRuns.map((run) => getRunEvidenceStatus(run)).filter(Boolean))
  );
  const evidenceLabels = Array.from(
    new Set(evidenceStates.map((status) => getEvidenceLabel(status)).filter(Boolean))
  );
  const capabilityDetails = Array.from(
    new Set(
      [
        ...readiness.runtimeCapabilityDetails,
        ...snapshot.runners.flatMap((runner) =>
          (runner.detectedCapabilityDetails ?? [])
            .map((detail) => formatRunnerCapabilityDetail(detail))
            .filter(Boolean)
        )
      ].filter(Boolean)
    )
  );
  const modelExecutionProviders = Array.from(
    new Set(runtimeRuns.map((run) => getRunModelExecutionProvider(run)).filter(Boolean))
  );
  const modelExecutionDetails = Array.from(
    new Set(runtimeRuns.map((run) => getRunModelExecutionDetail(run)).filter(Boolean))
  );
  const bridgeExecutionDetails = Array.from(
    new Set(bridgeExecutionRuns.map((run) => getRunBridgeExecutionDetail(run)).filter(Boolean))
  );
  const externalExecutionDetails = getExternalExecutionContractDetails();
  const executionBackendDetails = getExecutionBackendContractDetails();
  const executionBackends = buildExecutionBackendCoverage(snapshot);
  const externalExecutionReadiness = getExternalExecutionReadiness({
    activeProviders: modelExecutionProviders,
    details: externalExecutionDetails
  });
  const executionBackendReadiness = getExecutionBackendReadiness({
    activeBackends: Array.from(
      new Set(runtimeRuns.map((run) => getRunExecutionBackend(run)).filter(Boolean))
    ),
    details: executionBackendDetails
  });
  const nanoManagerReadiness = getNanoManagerReadiness(executionBackends);
  const bridgeExecutionCount = bridgeExecutionRuns.length;
  const bridgeExecutionSummary =
    bridgeExecutionCount > 0
      ? `已写回 ${bridgeExecutionCount} 条外部执行桥证据，最近一条已进入正式运行时间线。`
      : "当前还没有外部执行桥写回证据。";

  return {
    totalRunners: snapshot.runners.length,
    healthyRunnerCount: snapshot.runners.filter((runner) => runner.probeStatus === "healthy").length,
    degradedRunnerCount: snapshot.runners.filter((runner) => runner.probeStatus === "degraded").length,
    offlineRunnerCount: snapshot.runners.filter((runner) => runner.probeStatus === "offline").length,
    executionBackendReadyCount: executionBackends.filter((item) => item.probeStatus === "ready").length,
    executionBackendMissingCount: executionBackends.filter((item) => item.probeStatus === "missing").length,
    evidenceStates,
    evidenceLabels,
    modelExecutionProviders,
    modelExecutionDetails,
    externalExecutionStatus: externalExecutionReadiness.status,
    externalExecutionContractCount: externalExecutionReadiness.contractCount,
    externalExecutionActiveProviderCount: externalExecutionReadiness.activeProviderCount,
    externalExecutionSummary: externalExecutionReadiness.summary,
    externalExecutionRecommendation: externalExecutionReadiness.recommendation,
    externalExecutionDetails,
    executionBackendLabels: executionBackendReadiness.labels,
    executionBackendSummary: executionBackendReadiness.summary,
    executionBackendDetails,
    nanoManagerStatus: nanoManagerReadiness.status,
    nanoManagerSummary: nanoManagerReadiness.summary,
    nanoManagerDetails: nanoManagerReadiness.details,
    bridgeExecutionCount,
    bridgeExecutionSummary,
    bridgeExecutionDetails,
    notes: readiness.runtimeNotes,
    capabilityDetails
  };
}

type ForgeExecutionBackendCoverage = {
  id: string;
  kind: "pm" | "engineer" | "reviewer" | "qa" | "release" | "archive";
  label: string;
  runnerProfile: string;
  backend: string;
  provider: string;
  source: string;
  commandKey: string;
  adapterIds: string[];
  supportedCommandTypes: ForgeCommand["type"][];
  expectedArtifacts: ForgeArtifact["type"][];
  backendCommandTemplate: string | null;
  backendCommandPlaceholders: string[];
  active: boolean;
  commandConfigured: boolean;
  commandSource: string | null;
  probeStatus: "ready" | "degraded" | "missing";
  probeSummary: string;
  probeDetails: string[];
  probePath: string | null;
  probeVersion: string | null;
};

type ForgeExecutionBackendInvocation = {
  backendId: string;
  backendLabel: string;
  backend: string;
  provider: string;
  runnerProfile: string;
  adapterIds: string[];
  commandType: ForgeCommand["type"];
  expectedArtifacts: ForgeArtifact["type"][];
  artifactType: string | null;
  projectId: string | null;
  taskPackId: string | null;
  linkedComponentIds: string[];
  workspacePath: string | null;
  commandPreview: string;
  payload: {
    projectId?: string | null;
    projectName?: string | null;
    stage?: ForgeWorkflowStage | null;
    taskPackId?: string | null;
    commandId?: string | null;
    commandName?: string | null;
    commandType?: ForgeCommand["type"] | null;
    taskInstruction?: string | null;
    expectedOutput?: ForgeArtifact["type"][];
    linkedAssets?: Array<{
      id: string;
      type: ForgeAsset["type"];
      title: string;
      summary: string;
    }>;
    linkedComponents?: Array<{
      id: string;
      title: string;
      category: ForgeComponent["category"];
    }>;
    toolCapabilities?: ForgeResolvedAgentContextTool[];
    workspacePaths?: ForgeResolvedAgentContextPathContract | null;
    agent?: Pick<
      ForgeAgent,
      | "id"
      | "name"
      | "role"
      | "runnerId"
      | "persona"
      | "systemPrompt"
      | "knowledgeSources"
      | "skillIds"
      | "permissionProfileId"
      | "ownerMode"
    > | null;
    controllerAgent?: Pick<
      ForgeAgent,
      | "id"
      | "name"
      | "role"
      | "runnerId"
      | "persona"
      | "systemPrompt"
      | "knowledgeSources"
      | "skillIds"
      | "permissionProfileId"
      | "ownerMode"
    > | null;
  } | null;
};

function buildExecutionBackendProbe(
  item: ReturnType<typeof getExternalExecutionContracts>[number],
  env: Record<string, string | undefined>,
  cache: Map<string, ForgeBackendExecutableProbe>,
  healthcheckCache: Map<string, ForgeBackendHealthcheckProbe>
) {
  const backendCommandTemplate = item.backendCommandTemplate?.trim() || "";

  if (!backendCommandTemplate) {
    return {
      probeStatus: "missing" as const,
      probeSummary: `${item.label} 未声明可执行后端命令。`,
      probeDetails: [],
      probePath: null,
      probeVersion: null
    };
  }

  if (item.backend === "NanoClaw") {
    const nodeProbe = probeExecutable("node", cache);
    const nanoBinary = getTrimmedEnvValue(env, "FORGE_NANO_EXEC_BIN") || "nanoclaw";
    const nanoProbe = probeExecutable(nanoBinary, cache);
    const healthcheckCommandTemplate =
      item.commandSource === "internal-default:nanoclaw-manager"
        ? defaultNanoManagerHealthcheckCommandTemplate.replace("{repoRoot}", forgeRepoRoot)
        : getTrimmedEnvValue(env, "FORGE_NANO_HEALTHCHECK_COMMAND") || `${nanoBinary} --version`;
    const healthcheckCommand = splitCommandString(healthcheckCommandTemplate);
    const healthcheckBinary = healthcheckCommand[0] || nanoBinary;
    const healthcheckBinaryProbe = probeExecutable(healthcheckBinary, cache);
    const requiredProbes =
      item.commandSource === "internal-default:nanoclaw-manager"
        ? [nodeProbe, healthcheckBinaryProbe]
        : [healthcheckBinaryProbe];
    const missingBinaries = requiredProbes
      .filter((probe) => !probe.path)
      .map((probe) => probe.binary);
    const baseDetails = [
      ...(item.commandSource === "internal-default:nanoclaw-manager"
        ? [`Node wrapper：${nodeProbe.version || nodeProbe.path || "未找到"}`]
        : []),
      `Nano manager：${nanoProbe.version || nanoProbe.path || "未找到"}`,
      `健康检查命令：${healthcheckCommand.join(" ")}`
    ];

    if (missingBinaries.length > 0) {
      return {
        probeStatus: "missing" as const,
        probeSummary: `NanoClaw CEO 总控待接线，缺少 ${missingBinaries.join(" / ")}。`,
        probeDetails: baseDetails,
        probePath: healthcheckBinaryProbe.path || nanoProbe.path || nodeProbe.path,
        probeVersion: healthcheckBinaryProbe.version || nanoProbe.version || nodeProbe.version
      };
    }

    const healthcheck = probeHealthcheckCommand(healthcheckCommand, env, healthcheckCache);

    return {
      probeStatus: healthcheck.status,
      probeSummary:
        healthcheck.status === "ready"
          ? `NanoClaw CEO 总控已就绪，${healthcheck.summary}。`
          : `NanoClaw CEO 总控响应异常，${healthcheck.summary}。`,
      probeDetails: [...baseDetails, ...healthcheck.details],
      probePath: healthcheckBinaryProbe.path || nanoProbe.path || nodeProbe.path,
      probeVersion: healthcheck.version || healthcheckBinaryProbe.version || nanoProbe.version || nodeProbe.version
    };
  }

  const backendCommand = splitCommandString(backendCommandTemplate);
  const primaryProbe =
    backendCommand.length > 0 ? probeExecutable(backendCommand[0] || "", cache) : null;
  const ready = Boolean(primaryProbe?.path);

  return {
    probeStatus: ready ? ("ready" as const) : ("missing" as const),
    probeSummary: ready
      ? `${item.backend || item.provider} 后端已就绪，可调用 ${primaryProbe?.version || primaryProbe?.path || backendCommand[0]}.`
      : `${item.backend || item.provider} 后端待接线，未找到 ${backendCommand[0] || "可执行命令"}。`,
    probeDetails: primaryProbe
      ? [`执行入口：${primaryProbe.version || primaryProbe.path || primaryProbe.binary}`]
      : [],
    probePath: primaryProbe?.path ?? null,
    probeVersion: primaryProbe?.version ?? null
  };
}

function buildExecutionBackendCoverage(snapshot: ForgeDashboardSnapshot): ForgeExecutionBackendCoverage[] {
  const runtimeRuns = snapshot.runs.filter((run) => Boolean(run.outputMode) || run.outputChecks.length > 0);
  const activeProviders = new Set(
    runtimeRuns.map((run) => getRunModelExecutionProvider(run)).filter(Boolean)
  );
  const activeBackends = new Set(
    runtimeRuns.map((run) => getRunExecutionBackend(run)).filter(Boolean)
  );
  const adapterDescriptors = getExecutionBackendAdapterRegistry(externalExecutionContractConfigs, runtimeAdapters);
  const descriptorMap = new Map(adapterDescriptors.map((item) => [item.id, item]));
  const probeCache = new Map<string, ForgeBackendExecutableProbe>();
  const healthcheckCache = new Map<string, ForgeBackendHealthcheckProbe>();
  const env = process.env as Record<string, string | undefined>;

  return getExternalExecutionContracts(env)
    .filter((item) => item.backend)
    .map((item) => {
      const descriptor = descriptorMap.get(item.id);
      const probe = buildExecutionBackendProbe(item, env, probeCache, healthcheckCache);

      return {
        id: item.id,
        kind: item.kind,
        label: item.label,
        runnerProfile: descriptor?.runnerProfile ?? "",
        backend: item.backend,
        provider: item.provider,
        source: item.source,
        commandKey: item.commandKey,
        adapterIds: descriptor?.adapterIds ?? [],
        supportedCommandTypes: descriptor?.supportedCommandTypes ?? [],
        expectedArtifacts: descriptor?.expectedArtifacts ?? [],
        backendCommandTemplate: item.backendCommandTemplate,
        backendCommandPlaceholders: getCommandTemplatePlaceholders(item.backendCommandTemplate),
        active: activeBackends.has(item.backend) || activeProviders.has(item.provider),
        commandConfigured: item.commandConfigured,
        commandSource: item.commandConfigured ? item.commandSource : null,
        probeStatus: probe.probeStatus,
        probeSummary: probe.probeSummary,
        probeDetails: probe.probeDetails,
        probePath: probe.probePath,
        probeVersion: probe.probeVersion
      };
    });
}

function resolveExecutionBackendForCommandId(
  snapshot: ForgeDashboardSnapshot,
  commandId?: string | null,
  executionBackends: ForgeExecutionBackendCoverage[] = buildExecutionBackendCoverage(snapshot)
) {
  const normalizedCommandId = commandId?.trim() || "";

  if (!normalizedCommandId) {
    return null;
  }

  const commandType = snapshot.commands.find((command) => command.id === normalizedCommandId)?.type;

  if (!commandType) {
    return null;
  }

  return (
    executionBackends
      .filter((item) => item.supportedCommandTypes.includes(commandType))
      .sort((left, right) => {
        const activeDelta = Number(right.active) - Number(left.active);

        if (activeDelta !== 0) {
          return activeDelta;
        }

        return Number(right.commandConfigured) - Number(left.commandConfigured);
      })[0] ?? null
  );
}

function buildExecutionBackendCommandPreview(
  snapshot: ForgeDashboardSnapshot,
  input: {
    projectId?: string | null;
    taskPackId?: string | null;
    linkedComponentIds?: string[];
    commandId?: string | null;
    executionBackends?: ForgeExecutionBackendCoverage[];
  }
) {
  return buildExecutionBackendInvocation(snapshot, input)?.commandPreview ?? null;
}

function buildExecutionBackendInvocation(
  snapshot: ForgeDashboardSnapshot,
  input: {
    projectId?: string | null;
    taskPackId?: string | null;
    linkedComponentIds?: string[];
    commandId?: string | null;
    executionBackends?: ForgeExecutionBackendCoverage[];
  }
): ForgeExecutionBackendInvocation | null {
  const executionBackends = input.executionBackends ?? buildExecutionBackendCoverage(snapshot);
  const commandType =
    snapshot.commands.find((command) => command.id === (input.commandId?.trim() || ""))?.type ?? null;
  const executionBackend = resolveExecutionBackendForCommandId(
    snapshot,
    input.commandId ?? null,
    executionBackends
  );

  if (
    !executionBackend?.commandConfigured ||
    !executionBackend.backendCommandTemplate ||
    !commandType
  ) {
    return null;
  }

  const adapter =
    runtimeAdapters.find(
      (item) =>
        item.runnerProfile === executionBackend.runnerProfile &&
        item.commandType === commandType
    ) ?? null;
  const projectProfile = snapshot.projectProfiles.find(
    (item) => item.projectId === (input.projectId ?? "").trim()
  );
  const project = snapshot.projects.find((item) => item.id === (input.projectId ?? "").trim()) ?? null;
  const command = snapshot.commands.find((item) => item.id === (input.commandId?.trim() || "")) ?? null;
  const artifactType = adapter ? getCommandTemplateFlagValue(adapter.commandTemplate, "--artifact") || null : null;
  const linkedComponentIds = input.linkedComponentIds ?? [];
  const linkedAssets = snapshot.projectAssetLinks
    .filter((link) => link.projectId === (input.projectId ?? "").trim() && link.targetType === "asset")
    .map((link) => snapshot.assets.find((asset) => asset.id === link.targetId))
    .filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
    .map((asset) => ({
      id: asset.id,
      type: asset.type,
      title: asset.title,
      summary: asset.summary
    }));
  const linkedComponents = snapshot.components
    .filter((component) => linkedComponentIds.includes(component.id))
    .map((component) => ({
      id: component.id,
      title: component.title,
      category: component.category
    }));
  const projectAgent = resolveExecutionBackendAgent(snapshot, input.projectId, commandType);
  const controllerAgent = resolveExecutionBackendControllerAgent(snapshot);
  const resolvedAgentContext =
    project?.id && commandType
      ? resolveWorkbenchAgentContext(snapshot, project.id, commandType)
      : null;
  const taskPackId = input.taskPackId?.trim() || "latest";
  const stage =
    snapshot.workflowStates.find((item) => item.projectId === (input.projectId ?? "").trim())?.currentStage ??
    command?.triggerStage ??
    null;
  const taskInstruction = command
    ? `${command.name}：${command.summary}`
    : project
      ? `${project.name} 当前节点执行`
      : "执行当前交付节点";
  const expectedOutput = adapter?.expectedArtifacts ?? executionBackend.expectedArtifacts;
  const payload = project
    ? {
        projectId: project.id,
        projectName: project.name,
        stage,
        taskPackId: input.taskPackId?.trim() || null,
        commandId: command?.id ?? null,
        commandName: command?.name ?? null,
        commandType,
        taskInstruction,
        expectedOutput,
        linkedAssets,
        linkedComponents,
        toolCapabilities: resolvedAgentContext?.tools ?? [],
        workspacePaths: resolvedAgentContext?.paths ?? null,
        agent: projectAgent
          ? {
              id: projectAgent.id,
              name: projectAgent.name,
              role: projectAgent.role,
              runnerId: projectAgent.runnerId,
              persona: projectAgent.persona,
              systemPrompt: projectAgent.systemPrompt,
              knowledgeSources: projectAgent.knowledgeSources,
              skillIds: projectAgent.skillIds,
              permissionProfileId: projectAgent.permissionProfileId,
              ownerMode: projectAgent.ownerMode
            }
          : null,
        controllerAgent: controllerAgent
          ? {
              id: controllerAgent.id,
              name: controllerAgent.name,
              role: controllerAgent.role,
              runnerId: controllerAgent.runnerId,
              persona: controllerAgent.persona,
              systemPrompt: controllerAgent.systemPrompt,
              knowledgeSources: controllerAgent.knowledgeSources,
              skillIds: controllerAgent.skillIds,
              permissionProfileId: controllerAgent.permissionProfileId,
              ownerMode: controllerAgent.ownerMode
            }
          : null
      }
    : null;
  const commandPreview = renderCommandStringTemplate(executionBackend.backendCommandTemplate, {
    commandType,
    projectId: input.projectId?.trim() || "",
    projectName: project?.name ?? "",
    stage: stage ?? "",
    agentId: projectAgent?.id ?? "",
    agentName: projectAgent?.name ?? "",
    agentRole: projectAgent?.role ?? "",
    controllerAgentId: controllerAgent?.id ?? "",
    controllerAgentName: controllerAgent?.name ?? "",
    controllerAgentRole: controllerAgent?.role ?? "",
    taskPackId,
    provider: executionBackend.provider,
    backend: executionBackend.backend,
    componentIds: linkedComponentIds.join(","),
    artifactType: artifactType ?? "",
    workspace: projectProfile?.workspacePath ?? "",
    cwd: projectProfile?.workspacePath ?? "",
    repoRoot: forgeRepoRoot
  });

  return {
    backendId: executionBackend.id,
    backendLabel: executionBackend.label,
    backend: executionBackend.backend,
    provider: executionBackend.provider,
    runnerProfile: executionBackend.runnerProfile,
    adapterIds: executionBackend.adapterIds,
    commandType,
    expectedArtifacts: executionBackend.expectedArtifacts,
    artifactType,
    projectId: input.projectId?.trim() || null,
    taskPackId: input.taskPackId?.trim() || null,
    linkedComponentIds,
    workspacePath: projectProfile?.workspacePath ?? null,
    commandPreview,
    payload
  };
}

function splitShellCommand(commandPreview: string) {
  return Array.from(commandPreview.matchAll(/"([^"]*)"|[^\s]+/g)).map((match) =>
    match[1] ?? match[0] ?? ""
  );
}

function tryParseJson(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getExecutionResultEntityId(value: unknown, key: "command" | "project") {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entity = (value as Record<string, unknown>)[key];

  if (!entity || typeof entity !== "object") {
    return null;
  }

  const id = (entity as Record<string, unknown>).id;

  return typeof id === "string" && id.trim() ? id : null;
}

async function executeBridgeShellPlan(plan: {
  cwd?: string | null;
  command?: string[];
  commandPreview?: string;
  env?: Record<string, string>;
}) {
  return await new Promise<{
    ok: boolean;
    exitCode: number | null;
    summary: string;
    data: Record<string, unknown> | null;
  }>((resolve) => {
    const [command, ...args] = Array.isArray(plan.command) ? plan.command : [];

    if (!command) {
      resolve({
        ok: false,
        exitCode: null,
        summary: "执行桥缺少可执行命令。",
        data: null
      });
      return;
    }

    const workingDirectory = plan.cwd || process.cwd();
    mkdirSync(workingDirectory, { recursive: true });

    const child = spawn(command, args, {
      cwd: workingDirectory,
      env: {
        ...process.env,
        ...(plan.env ?? {})
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        exitCode: null,
        summary: `无法启动 execution backend bridge：${error.message}`,
        data: null
      });
    });

    child.on("close", (code) => {
      const stdoutText = stdout.trim();
      const stderrText = stderr.trim();
      const parsed = tryParseJson(stdoutText);
      const parsedSummary = parsed && typeof parsed.summary === "string" ? parsed.summary : null;
      const text = [parsedSummary || stdoutText, stderrText].filter(Boolean).join(" | ");

      resolve({
        ok: code === 0,
        exitCode: code,
        summary:
          text ||
          (code === 0
            ? "execution backend bridge 已完成。"
            : `execution backend bridge 失败，退出码 ${code ?? "unknown"}。`),
        data: parsed
      });
    });
  });
}

function buildExecutionBackendBridgeArtifacts(
  snapshot: ForgeDashboardSnapshot,
  invocation: ForgeExecutionBackendInvocation
) {
  if (!invocation.projectId) {
    return [];
  }

  const adapter =
    runtimeAdapters.find(
      (item) =>
        item.runnerProfile === invocation.runnerProfile &&
        item.commandType === invocation.commandType
    ) ?? null;
  const projectId = invocation.projectId;
  const project = projectId ? snapshot.projects.find((item) => item.id === projectId) ?? null : null;
  const command = snapshot.commands.find((item) => item.type === invocation.commandType) ?? null;
  const runner =
    snapshot.runners.find((item) => item.id === invocation.runnerProfile) ?? snapshot.runners[0] ?? null;

  if (!adapter || !project || !command || !runner || !projectId) {
    return [];
  }

  const taskPackArtifact = invocation.taskPackId
    ? snapshot.artifacts.find((item) => item.id === invocation.taskPackId) ?? null
    : null;
  const linkedComponents = snapshot.components.filter((component) =>
    invocation.linkedComponentIds.includes(component.id)
  );

  return adapter.run({
    command,
    project,
    taskPackArtifact,
    linkedComponents,
    runner
  }).artifacts.map((artifact) => ({
    ...artifact,
    ownerAgentId: resolveBridgeArtifactOwnerAgentId(
      snapshot,
      projectId,
      artifact.type,
      artifact.ownerAgentId
    )
  }));
}

function resolveBridgeArtifactOwnerAgentId(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  artifactType: ForgeArtifact["type"],
  fallbackOwnerAgentId: string
) {
  switch (artifactType) {
    case "prd":
    case "review-decision":
      return resolveCeoOrchestratorAgentId(snapshot, projectId);
    case "assembly-plan":
      return resolveProjectAgentId(snapshot, projectId, "architect", fallbackOwnerAgentId);
    case "patch":
    case "demo-build":
      return resolveProjectAgentId(snapshot, projectId, "engineer", fallbackOwnerAgentId);
    case "review-report":
      return resolveProjectAgentId(snapshot, projectId, "architect", fallbackOwnerAgentId);
    case "test-report":
    case "playwright-run":
      return resolveProjectAgentId(snapshot, projectId, "qa", fallbackOwnerAgentId);
    case "release-brief":
    case "release-audit":
      return resolveProjectAgentId(snapshot, projectId, "release", fallbackOwnerAgentId);
    case "knowledge-card":
      return resolveProjectAgentId(snapshot, projectId, "knowledge", fallbackOwnerAgentId);
    default:
      return fallbackOwnerAgentId;
  }
}

function moveReviewExecutionToQaHandoff(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  dbPath?: string
) {
  const architectAgentId = resolveProjectAgentId(snapshot, projectId, "architect", "agent-architect");
  const qaAgentId = resolveProjectAgentId(snapshot, projectId, "qa", "agent-qa-automation");
  const patchArtifact = snapshot.artifacts.find(
    (artifact) => artifact.projectId === projectId && artifact.type === "patch"
  );
  const demoBuildArtifact = snapshot.artifacts.find(
    (artifact) => artifact.projectId === projectId && artifact.type === "demo-build"
  );

  if (patchArtifact) {
    upsertProjectArtifact(
      {
        projectId,
        type: "patch",
        title: patchArtifact.title,
        ownerAgentId: patchArtifact.ownerAgentId,
        status: "ready"
      },
      dbPath
    );
    upsertArtifactReview(
      {
        artifactId: patchArtifact.id,
        reviewerAgentId: architectAgentId,
        decision: "pass",
        summary: "Patch 规则审查通过，可以进入 QA 验证。",
        conditions: ["TaskPack 范围未扩散", "实现符合架构边界", "补丁已具备回归条件"]
      },
      dbPath
    );
  }

  if (demoBuildArtifact) {
    upsertProjectArtifact(
      {
        projectId,
        type: "demo-build",
        title: demoBuildArtifact.title,
        ownerAgentId: demoBuildArtifact.ownerAgentId,
        status: "ready"
      },
      dbPath
    );
    upsertArtifactReview(
      {
        artifactId: demoBuildArtifact.id,
        reviewerAgentId: architectAgentId,
        decision: "pass",
        summary: "Demo 规则审查通过，可以移交 QA 做门禁验证。",
        conditions: ["主流程可运行", "异常路径可验证", "可进入 QA 门禁"]
      },
      dbPath
    );
  }

  upsertProjectTask(
    {
      id: `task-${projectId}-qa-gate`,
      projectId,
      stage: "测试验证",
      title: "执行 Playwright 门禁与人工复核",
      ownerAgentId: qaAgentId,
      status: "in-progress",
      priority: "P0",
      category: "execution",
      summary: "规则审查已通过，等待 QA 执行门禁、浏览器回归和人工复核。"
    },
    dbPath
  );
  updateProjectWorkflowState(
    {
      projectId,
      currentStage: "测试验证",
      state: "current",
      blockers: [],
      updatedBy: "architect"
    },
    dbPath
  );
}

function movePrdExecutionToTaskpackStage(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  bridge: {
    executionResult?: { summary: string; data: Record<string, unknown> | null } | null;
  },
  dbPath?: string
) {
  const profile = snapshot.projectProfiles.find((item) => item.projectId === projectId) ?? null;
  const templateId = profile?.defaultPromptIds[0] ?? snapshot.promptTemplates[0]?.id ?? "";

  if (!templateId) {
    throw new ForgeApiError("缺少可用 Prompt 模板", "FORGE_NOT_FOUND", 404);
  }

  const bridgeSummary =
    (typeof bridge.executionResult?.data?.summary === "string"
      ? bridge.executionResult?.data?.summary
      : null) ??
    bridge.executionResult?.summary ??
    "";
  const generated = generatePrdDraftForAI(
    {
      projectId,
      templateId,
      extraNotes: bridgeSummary
    },
    dbPath
  );
  const pmAgentId = resolveCeoOrchestratorAgentId(snapshot, projectId);

  upsertProjectArtifact(
    {
      projectId,
      type: "prd",
      title: generated.document.title,
      ownerAgentId: pmAgentId,
      status: "ready"
    },
    dbPath
  );
  updateProjectTasks(
    {
      projectId,
      stage: "项目接入",
      status: "done",
      summary: "需求摘要与成功标准已锁定，已进入方案与任务包阶段。"
    },
    dbPath
  );
  updateProjectTasks(
    {
      projectId,
      titleIncludes: "PRD",
      status: "done",
      summary: `已通过 CEO 总控生成《${generated.document.title}》。`
    },
    dbPath
  );
  updateProjectTasks(
    {
      projectId,
      taskId: `task-${projectId}-design-arch`,
      status: "in-progress",
      summary: "PRD 已就绪，等待补齐原型、架构说明和首轮 TaskPack。"
    },
    dbPath
  );

  const refreshedSnapshot = loadDashboardSnapshot(dbPath);
  updateProjectWorkflowState(
    {
      projectId,
      currentStage: "方案与任务包",
      state: "blocked",
      blockers: buildMissingArtifactBlockers(refreshedSnapshot, projectId, [
        "architecture-note",
        "ui-spec",
        "task-pack"
      ]),
      updatedBy: "pm"
    },
    dbPath
  );
}

function moveQaExecutionToReleaseCandidate(
  snapshot: ForgeDashboardSnapshot,
  projectId: string,
  dbPath?: string
) {
  const qaAgentId = resolveProjectAgentId(snapshot, projectId, "qa", "agent-qa-automation");
  const releaseAgentId = resolveProjectAgentId(snapshot, projectId, "release", "agent-release");
  const project = snapshot.projects.find((item) => item.id === projectId) ?? null;
  const demoBuildArtifact = snapshot.artifacts.find(
    (artifact) => artifact.projectId === projectId && artifact.type === "demo-build"
  );

  if (demoBuildArtifact) {
    upsertArtifactReview(
      {
        artifactId: demoBuildArtifact.id,
        reviewerAgentId: qaAgentId,
        decision: "pass",
        summary: "测试门禁已通过，Demo 可进入交付说明整理。",
        conditions: ["构建通过", "自动化回归通过", "人工复核已完成"]
      },
      dbPath
    );
  }

  updateProjectTasks(
    {
      projectId,
      taskId: `task-${projectId}-gate-escalation`,
      status: "done",
      summary: "测试门禁已通过，升级任务已关闭。"
    },
    dbPath
  );
  updateProjectTasks(
    {
      projectId,
      titleIncludes: "Playwright",
      status: "done",
      summary: "测试门禁已通过，可以继续准备交付。"
    },
    dbPath
  );

  if (project) {
    upsertProjectArtifact(
      {
        projectId,
        type: "release-brief",
        title: `${project.name} 交付说明`,
        ownerAgentId: releaseAgentId,
        status: "draft"
      },
      dbPath
    );
  }

  upsertProjectTask(
    {
      id: `task-${projectId}-release-brief`,
      projectId,
      stage: "交付发布",
      title: "整理交付说明与验收口径",
      ownerAgentId: releaseAgentId,
      status: "todo",
      priority: "P1",
      category: "release",
      summary: "测试门禁已通过，开始整理交付摘要、验收说明和发布备注。"
    },
    dbPath
  );
  updateProjectWorkflowState(
    {
      projectId,
      currentStage: "交付发布",
      state: "current",
      blockers: [],
      updatedBy: "qa"
    },
    dbPath
  );
}

function moveReleaseExecutionToApproval(projectId: string, dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const pmAgentId = resolveProjectAgentId(snapshot, projectId, "pm", "agent-service-strategy");
  const releaseBrief = snapshot.artifacts.find(
    (artifact) =>
      artifact.projectId === projectId &&
      artifact.type === "release-brief" &&
      artifact.status !== "draft"
  );
  const runtimeSignal = getProjectRuntimeSignal(snapshot, projectId);

  if (releaseBrief) {
    upsertArtifactReview(
      {
        artifactId: releaseBrief.id,
        reviewerAgentId: pmAgentId,
        decision: "pending",
        summary: appendExtraNotes(
          "交付说明已整理，等待负责人确认验收口径与放行条件。",
          runtimeSignal
        ),
        conditions: ["交付范围无遗漏", "验收口径已确认", "预览与说明保持一致"]
      },
      dbPath
    );
  }

  updateProjectTasks(
    {
      projectId,
      taskId: `task-${projectId}-release-brief`,
      status: "done",
      summary: "交付说明、验收口径和发布备注已经整理完成。"
    },
    dbPath
  );
  upsertProjectTask(
    {
      id: `task-${projectId}-release-approval`,
      projectId,
      stage: "交付发布",
      title: "确认交付说明与放行口径",
      ownerAgentId: pmAgentId,
      status: "todo",
      priority: "P0",
      category: "review",
      summary: "负责人需要确认交付说明、验收范围和发布口径。"
    },
    dbPath
  );
  updateProjectWorkflowState(
    {
      projectId,
      currentStage: "交付发布",
      state: "blocked",
      blockers: ["等待人工确认交付说明"],
      updatedBy: "release"
    },
    dbPath
  );
}

function finalizeArchiveExecution(projectId: string, dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const pmAgentId = resolveProjectAgentId(snapshot, projectId, "pm", "agent-service-strategy");
  const runtimeSignal = getProjectRuntimeSignal(snapshot, projectId);
  const releaseAuditArtifact = snapshot.artifacts.find(
    (artifact) =>
      artifact.projectId === projectId &&
      artifact.type === "release-audit" &&
      artifact.status === "ready"
  );

  if (releaseAuditArtifact) {
    upsertArtifactReview(
      {
        artifactId: releaseAuditArtifact.id,
        reviewerAgentId: pmAgentId,
        decision: "pass",
        summary: appendExtraNotes(
          "交付知识卡、归档审计和复用建议已沉淀完成。",
          runtimeSignal
        ),
        conditions: ["交付说明已归档", "运行信号已留痕", "复用建议已生成"]
      },
      dbPath
    );
  }

  updateProjectTasks(
    {
      projectId,
      taskId: `task-${projectId}-knowledge-card`,
      status: "done",
      summary: "交付知识卡、归档审计和复用建议已沉淀完成。"
    },
    dbPath
  );
  updateProjectWorkflowState(
    {
      projectId,
      currentStage: "归档复用",
      state: "current",
      blockers: [],
      updatedBy: "knowledge"
    },
    dbPath
  );
}

function finalizeExecutionBridgeWriteback(projectId: string, dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const qaAgentId = resolveProjectAgentId(snapshot, projectId, "qa", "agent-qa-automation");
  const qaReviewOwnerLabel = getForgeAgentDisplayLabel({ id: qaAgentId });
  const demoBuildArtifact = snapshot.artifacts.find(
    (artifact) => artifact.projectId === projectId && artifact.type === "demo-build"
  );

  if (demoBuildArtifact) {
    upsertArtifactReview(
      {
        artifactId: demoBuildArtifact.id,
        reviewerAgentId: qaAgentId,
        decision: "pending",
        summary: `外部执行桥已写回 Demo 构建，等待 ${qaReviewOwnerLabel} 执行主流程与异常路径复核。`,
        conditions: ["主流程可运行", "异常路径已覆盖", "人工复核说明已补齐"]
      },
      dbPath
    );
  }

  updateProjectTasks(
    {
      projectId,
      taskId: `task-${projectId}-runner-gates`,
      status: "done",
      summary: "外部执行桥已写回 Patch 与 Demo，可继续发起规则审查。"
    },
    dbPath
  );
  updateProjectWorkflowState(
    {
      projectId,
      currentStage: "开发执行",
      state: "current",
      blockers: [],
      updatedBy: "engineer"
    },
    dbPath
  );
}

function buildExecutionBackendBridgeEvidence(input: {
  backend: string;
  provider: string;
  commandPreview: string;
  bridgeStatus: "stub" | "executed" | "failed";
  executionSummary?: string;
}) {
  const outputMode =
    input.bridgeStatus === "executed"
      ? "external-shell-bridge-executed"
      : input.bridgeStatus === "failed"
        ? "external-shell-bridge-failed"
        : "external-shell-bridge-ready";
  const evidenceStatus =
    input.bridgeStatus === "executed"
      ? "executed"
      : input.bridgeStatus === "failed"
        ? ""
        : "tool-ready";
  const evidenceLabel = getEvidenceLabel(evidenceStatus);
  const outputChecks: ForgeRunOutputCheck[] = [
    {
      name: "execution-backend",
      status: "pass",
      summary: [input.backend, input.provider, input.commandPreview].filter(Boolean).join(" · ")
    }
  ];

  if (input.bridgeStatus !== "stub") {
    outputChecks.push({
      name: "bridge-execution",
      status: input.bridgeStatus === "executed" ? "pass" : "fail",
      summary: input.executionSummary || `${input.backend} bridge ${input.bridgeStatus}`
    });
  }

  if (evidenceStatus) {
    outputChecks.push({
      name: "evidence",
      status: evidenceStatus,
      summary: [evidenceLabel, input.backend].filter(Boolean).join(" · ")
    });
  }

  return {
    outputMode,
    evidenceStatus,
    evidenceLabel,
    outputChecks
  };
}

function getReleaseApprovalBridgeGuidance(input: {
  releaseGate: ReturnType<typeof getReleaseGateSummary>;
  includeReleaseBriefHint?: boolean;
}) {
  const bridgeSummary = input.releaseGate.bridgeHandoffSummary?.trim() || "";

  if (!bridgeSummary) {
    return "";
  }

  if (input.releaseGate.bridgeHandoffStatus === "qa-handoff") {
    return input.includeReleaseBriefHint
      ? `${bridgeSummary} 当前还在 QA 门禁阶段，请先等待 QA 完成测试报告、Playwright 回归和交付说明。`
      : `${bridgeSummary} 当前仍需先完成 QA 门禁，再处理放行阻断。`;
  }

  if (input.releaseGate.bridgeHandoffStatus === "release-candidate") {
    return input.includeReleaseBriefHint
      ? `${bridgeSummary} 当前已经进入放行链，请先补齐交付说明后再重新发起放行确认。`
      : `${bridgeSummary} 当前已进入放行链，可围绕放行阻断项继续收口。`;
  }

  return bridgeSummary;
}

export function getPromptTemplatesForAI(dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);

  return {
    total: snapshot.promptTemplates.length,
    items: snapshot.promptTemplates
  };
}

export function getTeamRegistryForAI(dbPath?: string): {
  totalAgents: number;
  totalSkills: number;
  totalSops: number;
  teamTemplates: ForgeDashboardSnapshot["teamTemplates"];
  agents: ForgeAgent[];
  skills: ForgeSkill[];
  sops: ForgeSop[];
} {
  const snapshot = loadDashboardSnapshot(dbPath);

  return {
    totalAgents: snapshot.agents.length,
    totalSkills: snapshot.skills.length,
    totalSops: snapshot.sops.length,
    teamTemplates: snapshot.teamTemplates,
    agents: snapshot.agents,
    skills: snapshot.skills,
    sops: snapshot.sops
  };
}

export function getTeamWorkbenchStateForAI(dbPath?: string): ForgeTeamWorkbenchState {
  return getTeamWorkbenchState(dbPath);
}

export function getProjectWorkbenchStateForAI(dbPath?: string): ForgeProjectWorkbenchState {
  return getProjectWorkbenchState(dbPath);
}

export function updateTeamWorkbenchStateForAI(
  input: UpdateTeamWorkbenchStateInput,
  dbPath?: string
): { state: ForgeTeamWorkbenchState } {
  return {
    state: updateTeamWorkbenchState(input, dbPath)
  };
}

export function updateProjectWorkbenchStateForAI(
  input: UpdateProjectWorkbenchStateInput,
  dbPath?: string
): { state: ForgeProjectWorkbenchState } {
  return {
    state: updateProjectWorkbenchState(input, dbPath)
  };
}

export function getCapabilityRegistryForAI(dbPath?: string): {
  totalAssets: number;
  totalPrompts: number;
  totalComponents: number;
  totalSkills: number;
  totalSops: number;
  executionBackendCount: number;
  activeExecutionBackendCount: number;
  executionBackends: ForgeExecutionBackendCoverage[];
  assets: ForgeAsset[];
  promptTemplates: ForgePromptTemplate[];
  components: ForgeComponent[];
  skills: ForgeSkill[];
  sops: ForgeSop[];
} {
  const snapshot = loadDashboardSnapshot(dbPath);
  const executionBackends = buildExecutionBackendCoverage(snapshot);

  return {
    totalAssets: snapshot.assets.length,
    totalPrompts: snapshot.promptTemplates.length,
    totalComponents: snapshot.components.length,
    totalSkills: snapshot.skills.length,
    totalSops: snapshot.sops.length,
    executionBackendCount: executionBackends.length,
    activeExecutionBackendCount: executionBackends.filter((item) => item.active).length,
    executionBackends,
    assets: snapshot.assets,
    promptTemplates: snapshot.promptTemplates,
    components: snapshot.components,
    skills: snapshot.skills,
    sops: snapshot.sops
  };
}

export function getComponentRegistryForAI(
  options: {
    projectId?: string;
    taskPackId?: string;
    query?: string;
    category?: ForgeComponentCategory;
    sector?: string;
    sourceType?: ForgeComponentSourceType;
  } = {},
  dbPath?: string
): {
  total: number;
  categories: ForgeComponentCategory[];
  project: Pick<ForgeProject, "id" | "name" | "sector"> | null;
  taskPack: Pick<ForgeArtifact, "id" | "title"> | null;
  recommendedCount: number;
  linkedCount: number;
  linkedItems: Array<{
    componentId: string;
    title: string;
    relation: string;
    reason: string;
  }>;
  usageSignals: Array<{
    componentId: string;
    title: string;
    status: string;
    statusLabel: string;
    usageCount: number;
    successCount: number;
    blockedCount: number;
    runningCount: number;
    lastRunId: string | null;
    lastRunTitle: string | null;
    lastRunState: string | null;
    lastFailureSummary: string | null;
  }>;
  assemblySuggestions: Array<{
    componentId: string;
    title: string;
    score: number;
    reason: string;
  }>;
  items: ForgeComponent[];
} {
  const snapshot = loadDashboardSnapshot(dbPath);
  return buildComponentRegistryResult(snapshot, options);
}

export function getComponentAssemblyPlanForAI(
  options: {
    projectId?: string;
    taskPackId?: string;
    maxItems?: number;
  } = {},
  dbPath?: string
) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const result = buildComponentRegistryResult(snapshot, {
    projectId: options.projectId,
    taskPackId: options.taskPackId
  });
  const maxItems = Math.max(1, Math.min(options.maxItems ?? 3, 10));
  const linkedComponentIds = new Set(result.linkedItems.map((item) => item.componentId));
  const selectedItems = result.assemblySuggestions.slice(0, maxItems).map((item) => {
    const component = result.items.find((candidate) => candidate.id === item.componentId);

    return {
      componentId: item.componentId,
      title: item.title,
      category: component?.category ?? null,
      sourceType: component?.sourceType ?? null,
      sourceRef: component?.sourceRef ?? null,
      assemblyContract: component?.assemblyContract ?? null,
      usageGuide: component?.usageGuide ?? "",
      score: item.score,
      reason: item.reason,
      linked: linkedComponentIds.has(item.componentId)
    };
  });
  const pendingItems = selectedItems.filter((item) => !item.linked);

  return {
    project: result.project,
    taskPack: result.taskPack,
    totalSuggested: result.assemblySuggestions.length,
    selectedCount: selectedItems.length,
    pendingCount: pendingItems.length,
    linkedCount: result.linkedCount,
    items: selectedItems,
    pendingItems,
    nextAction:
      pendingItems.length > 0
        ? "把这些组件写入 TaskPack 装配段，并交给 Engineer Runner 继续执行。"
        : selectedItems.length > 0
          ? "当前推荐组件已全部写回项目关联，可直接交给 Engineer Runner 继续执行。"
      : "当前没有命中组件建议，先补齐 TaskPack 标签或项目场景后再装配。"
  };
}

function dedupeNonEmptyStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)));
}

function buildComponentAssemblyManifest(
  linkedItems: Array<{
    linkId: string;
    component: ForgeComponent;
    reason: string;
  }>
) {
  const items = linkedItems.map(({ linkId, component, reason }) => {
    const contract = component.assemblyContract;

    return {
      linkId,
      componentId: component.id,
      title: component.title,
      category: component.category,
      sourceType: component.sourceType,
      reason,
      deliveryMode: contract?.deliveryMode ?? null,
      sourceLocator: contract?.sourceLocator ?? component.sourceRef,
      importPath: contract?.importPath ?? null,
      installCommand: contract?.installCommand ?? null,
      peerDeps: contract?.peerDeps ?? [],
      requiredEnv: contract?.requiredEnv ?? [],
      setupSteps: contract?.setupSteps ?? [],
      smokeTestCommand: contract?.smokeTestCommand ?? null,
      ownedPaths: contract?.ownedPaths ?? []
    };
  });

  return {
    items,
    installCommands: dedupeNonEmptyStrings(items.map((item) => item.installCommand)),
    peerDeps: dedupeNonEmptyStrings(items.flatMap((item) => item.peerDeps)),
    requiredEnv: dedupeNonEmptyStrings(items.flatMap((item) => item.requiredEnv)),
    setupSteps: dedupeNonEmptyStrings(items.flatMap((item) => item.setupSteps)),
    smokeTestCommands: dedupeNonEmptyStrings(items.map((item) => item.smokeTestCommand)),
    ownedPaths: dedupeNonEmptyStrings(items.flatMap((item) => item.ownedPaths))
  };
}

export function applyComponentAssemblyForAI(
  input: ApplyComponentAssemblyInput,
  dbPath?: string
) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const resolvedProjectId =
    input.projectId?.trim() || snapshot.activeProjectId || snapshot.projects[0]?.id || "";
  const projectId = requireText(resolvedProjectId, "项目 ID");
  const project = snapshot.projects.find((item) => item.id === projectId);

  if (!project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  const assemblyPlan = getComponentAssemblyPlanForAI(
    {
      projectId,
      taskPackId: input.taskPackId,
      maxItems: Math.max(input.componentIds.length, 3)
    },
    dbPath
  );
  const selectedIds = Array.from(new Set(input.componentIds.map((item) => item.trim()).filter(Boolean)));

  if (selectedIds.length === 0) {
    throw new ForgeApiError("组件 ID 不能为空", "FORGE_VALIDATION_ERROR", 400);
  }

  const linkedItems = selectedIds.map((componentId) => {
    const suggestedItem = assemblyPlan.items.find((item) => item.componentId === componentId);

    if (!suggestedItem) {
      throw new ForgeApiError(`组件 ${componentId} 不在当前装配计划内`, "FORGE_VALIDATION_ERROR", 400);
    }

    const linked = upsertProjectComponentLink(
      {
        projectId,
        componentId,
        relation: "recommended",
        reason: suggestedItem.reason,
        usageGuide: suggestedItem.usageGuide
      },
      dbPath
    );

    return {
      linkId: linked.linkId,
      component: linked.component,
      reason: suggestedItem.reason
    };
  });
  const taskPackId = assemblyPlan.taskPack?.id ?? null;
  const refreshedAssemblyPlan = getComponentAssemblyPlanForAI(
    {
      projectId,
      taskPackId: taskPackId ?? input.taskPackId,
      maxItems: Math.max(selectedIds.length, 5)
    },
    dbPath
  );
  const componentAssemblyTaskId =
    refreshedAssemblyPlan.pendingCount > 0 ? `task-${projectId}-component-assembly` : null;
  const assemblyManifest = buildComponentAssemblyManifest(linkedItems);
  const artifact = upsertProjectArtifact(
    {
      projectId,
      type: "assembly-plan",
      title: `${project.name} 组件装配清单`,
      ownerAgentId: "agent-architect",
      status: "ready"
    },
    dbPath
  );

  if (taskPackId) {
    upsertProjectTask(
      {
        id: `task-${projectId}-component-assembly`,
        projectId,
        stage: "开发执行",
        title: "补齐 TaskPack 组件装配",
        ownerAgentId: "agent-architect",
        status: componentAssemblyTaskId ? "in-progress" : "done",
        priority: "P0",
        category: "execution",
        summary: componentAssemblyTaskId
          ? `待装配组件：${refreshedAssemblyPlan.pendingItems.map((item) => item.title).join(" / ")}。继续补齐组件装配，再推进研发执行。`
          : "TaskPack 组件装配已补齐，可继续推进研发执行。"
      },
      dbPath
    );
  }

  const executionId = buildExecutionId("command-component-assemble");
  const recorded = recordCommandExecutionForAI(
    {
      id: executionId,
      commandId: "command-component-assemble",
      projectId,
      taskPackId,
      status: "done",
      summary: `已装配组件：${linkedItems.map((item) => item.component.title).join(
        " / "
      )}；已生成《${artifact.title}》${
        componentAssemblyTaskId
          ? `；待装配组件：${refreshedAssemblyPlan.pendingItems.map((item) => item.title).join(" / ")}`
          : "；当前 TaskPack 装配建议已处理完毕"
      }。`,
      triggeredBy: input.triggeredBy?.trim() || "组件装配入口",
      followUpTaskIds: componentAssemblyTaskId ? [componentAssemblyTaskId] : [],
      decisions: [
        {
          id: buildDecisionId(executionId, "before-run"),
          hookId: "hook-before-run",
          outcome: "pass",
          summary: "TaskPack 已齐备，允许写回组件装配结果。"
        }
      ]
    },
    dbPath
  );

  return {
    project: {
      id: project.id,
      name: project.name
    },
    taskPack: assemblyPlan.taskPack,
    triggeredBy: input.triggeredBy?.trim() || "组件装配入口",
    linkedCount: linkedItems.length,
    items: linkedItems,
    artifact,
    assemblyManifest,
    nextAction: componentAssemblyTaskId
      ? "已写回项目组件关联和装配清单，先按清单完成安装、配置与冒烟，再补齐剩余组件后交给 Engineer Runner。"
      : "已写回项目组件关联和装配清单，下一步按清单完成安装、配置与冒烟，再交给 Engineer Runner 执行。",
    execution: recorded.execution
  };
}

export function getCommandCenterForAI(dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const activeProject = getActiveProject(snapshot);
  const governanceResponsibility = buildGovernanceResponsibilitySummary(snapshot, activeProject?.id);

  return {
    totalCommands: forgeCommandContracts.length,
    totalHooks: snapshot.commandHooks.length,
    totalExecutions: snapshot.commandExecutions.length,
    blockedExecutions: snapshot.commandExecutions.filter((item) => item.status === "blocked").length,
    totalDecisions: snapshot.policyDecisions.length,
    ...buildControlPlaneMeta(snapshot, activeProject?.id),
    currentHandoff: governanceResponsibility.currentHandoff,
    formalArtifactCoverage: governanceResponsibility.formalArtifactCoverage,
    formalArtifactGap: governanceResponsibility.formalArtifactGap,
    formalArtifactResponsibility: governanceResponsibility.formalArtifactResponsibility,
    approvalHandoff: governanceResponsibility.approvalHandoff,
    releaseClosure: governanceResponsibility.releaseClosure,
    releaseClosureResponsibility: governanceResponsibility.releaseClosureResponsibility,
    archiveProvenance: governanceResponsibility.archiveProvenance,
    pendingApprovals: governanceResponsibility.pendingApprovals,
    escalationItems: governanceResponsibility.escalationItems,
    commandContracts: forgeCommandContracts,
    runtimeAdapters: getRuntimeAdapterRegistry(runtimeAdapters),
    executionBackends: buildExecutionBackendCoverage(snapshot),
    commands: snapshot.commands,
    hooks: snapshot.commandHooks,
    recentExecutions: getRecentCommandExecutions(snapshot, activeProject?.id),
    recentDecisions: snapshot.policyDecisions.slice(0, 5),
    remediationQueue: getRemediationTaskQueue(snapshot).slice(0, 5),
    releaseGate: governanceResponsibility.releaseGate
  };
}

export function recordCommandExecutionForAI(input: RecordCommandExecutionInput, dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const executionId = requireText(input.id, "命令执行 ID");
  const commandId = requireText(input.commandId, "命令 ID");
  const summary = requireText(input.summary, "执行摘要");
  const triggeredBy = requireText(input.triggeredBy, "触发人");
  const decisions = (input.decisions?.length ? input.decisions : buildDefaultPolicyDecisions(snapshot, input)).map(
    (decision) => ({
      id: requireText(decision.id, "策略判定 ID"),
      hookId: requireText(decision.hookId, "Hook ID"),
      outcome: decision.outcome,
      summary: requireText(decision.summary, "策略摘要")
    })
  );

  return recordCommandExecution(
    {
      id: executionId,
      commandId,
      projectId: input.projectId?.trim() || undefined,
      taskPackId: input.taskPackId?.trim() || undefined,
      relatedRunId: input.relatedRunId?.trim() || undefined,
      status: input.status,
      summary,
      triggeredBy,
      followUpTaskIds: input.followUpTaskIds ?? [],
      decisions
    },
    dbPath
  );
}

export function executeCommandForAI(input: ExecuteCommandInput, dbPath?: string) {
  const commandId = requireText(input.commandId, "命令 ID");
  const snapshot = loadDashboardSnapshot(dbPath);
  const command = snapshot.commands.find((item) => item.id === commandId);

  if (!command) {
    throw new ForgeApiError("命令不存在", "FORGE_NOT_FOUND", 404);
  }

  const resolvedProjectId =
    input.projectId?.trim() || snapshot.activeProjectId || snapshot.projects[0]?.id || "";
  const projectId = requireText(resolvedProjectId, "项目 ID");
  const project = snapshot.projects.find((item) => item.id === projectId);

  if (!project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  const resolvedCommandOwner = getProjectWorkbenchAgentForCommand(snapshot, projectId, command.type);
  const triggeredByInput = input.triggeredBy?.trim();
  const triggeredBy =
    triggeredByInput && triggeredByInput !== "项目工作台"
      ? triggeredByInput
      : resolvedCommandOwner?.name ?? triggeredByInput ?? "工作台";
  const executionId = buildExecutionId(command.id);
  const handler = getCommandHandler(command.type);
  const resolvedInput = withExecutionPreferenceNotes(input, command.type);

  if (handler) {
    return finalizeExecuteCommandResult(
      handler({
        input: resolvedInput,
        snapshot,
        command,
        project,
        projectId,
        triggeredBy,
        executionId,
        dbPath,
        runtimeAdapters,
        deps: {
          appendExtraNotes,
          artifactLabels,
          buildDecisionId,
          buildDefaultPolicyDecisions,
          buildMissingArtifactBlockers,
          getProjectAgentIdByRoles,
          getComponentAssemblyPlanForAI,
          getProjectLinkedComponents,
          getProjectRuntimeSignal,
          generatePrdDraftForAI,
          loadDashboardSnapshot,
          moveReviewExecutionToQaHandoff,
          recordCommandExecutionForAI,
          resolveTaskPackArtifact,
          selectRunnerForCommand,
          updateProjectTasks,
          updateProjectWorkflowState,
          updateRunnerHeartbeat,
          upsertArtifactReview,
          upsertProjectArtifact,
          upsertProjectTask,
          upsertRun
        }
      }) as { execution?: { summary?: string } },
      command.type,
      resolvedInput
    );
  }

  if (command.type === "prd.generate") {
    const profile =
      snapshot.projectProfiles.find((item) => item.projectId === projectId) ?? null;
    const templateId =
      profile?.defaultPromptIds[0] ?? snapshot.promptTemplates[0]?.id ?? "";

    if (!templateId) {
      throw new ForgeApiError("缺少可用 Prompt 模板", "FORGE_NOT_FOUND", 404);
    }

    const generated = generatePrdDraftForAI(
      {
        projectId,
        templateId,
        extraNotes: input.extraNotes?.trim() ?? ""
      },
      dbPath
    );

    upsertProjectArtifact(
      {
        projectId,
        type: "prd",
        title: generated.document.title,
        ownerAgentId: "agent-service-strategy",
        status: "ready"
      },
      dbPath
    );
    updateProjectTasks(
      {
        projectId,
        stage: "项目接入",
        status: "done",
        summary: "需求摘要与成功标准已锁定，已进入方案与任务包阶段。"
      },
      dbPath
    );
    updateProjectTasks(
      {
        projectId,
        titleIncludes: "PRD",
        status: "done",
        summary: `已通过标准命令生成《${generated.document.title}》。`
      },
      dbPath
    );
    updateProjectTasks(
      {
        projectId,
        taskId: `task-${projectId}-design-arch`,
        status: "in-progress",
        summary: "PRD 已就绪，等待补齐原型、架构说明和首轮 TaskPack。"
      },
      dbPath
    );

    const refreshedSnapshot = loadDashboardSnapshot(dbPath);
    updateProjectWorkflowState(
      {
        projectId,
        currentStage: "方案与任务包",
        state: "blocked",
        blockers: buildMissingArtifactBlockers(refreshedSnapshot, projectId, [
          "architecture-note",
          "ui-spec",
          "task-pack"
        ]),
        updatedBy: "pm"
      },
      dbPath
    );

    const recorded = recordCommandExecutionForAI(
      {
        id: executionId,
        commandId: command.id,
        projectId,
        status: "done",
        summary: `已生成《${generated.document.title}》。`,
        triggeredBy,
        decisions: [
          {
            id: buildDecisionId(executionId, "before-run"),
            hookId: "hook-before-run",
            outcome: "pass",
            summary: "项目 DNA 与默认 Prompt 已齐备，允许生成 PRD。"
          }
        ]
      },
      dbPath
    );

    return {
      command,
      project,
      document: generated.document,
      template: generated.template,
      execution: recorded.execution,
      decisions: recorded.decisions
    };
  }

  if (command.type === "review.run") {
    const runner = selectRunnerForCommand(snapshot, command.type);
    const runtimeAdapter = selectRuntimeAdapter(runtimeAdapters, command.type);
    const decisions = buildDefaultPolicyDecisions(snapshot, {
      id: executionId,
      commandId: command.id,
      projectId,
      status: "running",
      summary: command.summary,
      triggeredBy
    });

    if (!runner) {
      decisions.push({
        id: buildDecisionId(executionId, "reviewer-runner"),
        hookId: "hook-before-run",
        outcome: "block",
        summary: "当前没有可用 Reviewer Runner，无法执行规则审查。"
      });
    }

    if (decisions.some((decision) => decision.outcome === "block")) {
      const recorded = recordCommandExecutionForAI(
        {
          id: executionId,
          commandId: command.id,
          projectId,
          status: "blocked",
          summary: "规则审查前置条件未满足。",
          triggeredBy,
          decisions
        },
        dbPath
      );

      return {
        command,
        project,
        execution: recorded.execution,
        decisions: recorded.decisions
      };
    }

    const runId = `run-${projectId}-review-${Date.now().toString(36)}`;
    const runtimeResult =
      runner && runtimeAdapter
        ? runtimeAdapter.run({
            command,
            project,
            runner,
            extraNotes: input.extraNotes?.trim()
          })
        : null;

    upsertRun(
      {
        id: runId,
        projectId,
        title: `${project.name} 规则审查`,
        executor: runner?.name ?? "代码评审执行器",
        cost: "$0.00",
        state: runtimeResult?.status ?? "done"
      },
      dbPath
    );
    if (runner) {
      updateRunnerHeartbeat(
        {
          runnerId: runner.id,
          status: "idle",
          currentRunId: null,
          lastHeartbeat: "刚刚"
        },
        dbPath
      );
    }

    const artifact = upsertProjectArtifact(
      {
        projectId,
        type: "review-report",
        title: runtimeResult?.artifacts.find((item) => item.type === "review-report")?.title ?? `${project.name} 规则审查记录`,
        ownerAgentId:
          runtimeResult?.artifacts.find((item) => item.type === "review-report")?.ownerAgentId ??
          "agent-architect",
        status:
          runtimeResult?.artifacts.find((item) => item.type === "review-report")?.status ?? "ready"
      },
      dbPath
    );
    moveReviewExecutionToQaHandoff(snapshot, projectId, dbPath);

    const recorded = recordCommandExecutionForAI(
      {
        id: executionId,
        commandId: command.id,
        projectId,
        status: "done",
        summary:
          runtimeResult?.summary ??
          `已由 ${runner?.name ?? "代码评审执行器"} 完成规则审查，项目移交 QA。`,
        triggeredBy,
        decisions: [
          {
            id: buildDecisionId(executionId, "before-run"),
            hookId: "hook-before-run",
            outcome: "pass",
            summary: "Patch 与 Demo 已齐备，允许执行规则审查。"
          }
        ]
      },
      dbPath
    );

    return {
      command,
      project,
      artifact,
      execution: recorded.execution,
      decisions: recorded.decisions
    };
  }

  if (command.type === "gate.run") {
    const runner = selectRunnerForCommand(snapshot, command.type);
    const runtimeAdapter = selectRuntimeAdapter(runtimeAdapters, command.type);
    const missingArtifacts = command.requiresArtifacts.filter(
      (type) =>
        !snapshot.artifacts.some((artifact) => {
          if (artifact.projectId !== projectId || artifact.type !== type) {
            return false;
          }

          if (type === "demo-build") {
            return artifact.status !== "draft";
          }

          return artifact.status === "ready";
        })
    );
    const failedGates = snapshot.deliveryGate.filter((gate) => gate.status === "fail");
    const pendingGates = snapshot.deliveryGate.filter((gate) => gate.status === "pending");
    const decisions: Array<{
      id: string;
      hookId: string;
      outcome: ForgePolicyDecisionOutcome;
      summary: string;
    }> = [];

    if (missingArtifacts.length > 0) {
      decisions.push({
        id: buildDecisionId(executionId, "before-run"),
        hookId: "hook-before-run",
        outcome: "block" as const,
        summary: `门禁所需工件未齐备：${missingArtifacts.join(" / ")}。`
      });
    }

    if (failedGates.length > 0 || pendingGates.length > 0) {
      decisions.push({
        id: buildDecisionId(executionId, "before-release"),
        hookId: "hook-before-release",
        outcome: failedGates.length > 0 ? ("block" as const) : ("warn" as const),
        summary:
          failedGates.length > 0
            ? `当前门禁未通过：${failedGates.map((gate) => gate.name).join(" / ")}。`
            : `当前门禁仍待确认：${pendingGates.map((gate) => gate.name).join(" / ")}。`
      });
    }

    const status = decisions.some((decision) => decision.outcome === "block")
      ? "blocked"
      : "done";
    const runtimeResult =
      runner && runtimeAdapter && status !== "blocked"
        ? runtimeAdapter.run({
            command,
            project,
            runner,
            extraNotes: input.extraNotes?.trim()
          })
        : null;
    const runId = `run-${projectId}-gate-${Date.now().toString(36)}`;
    upsertRun(
      {
        id: runId,
        projectId,
        title: `${project.name} 测试门禁`,
        executor: runner?.name ?? "浏览器验证执行器",
        cost: "$0.00",
        state: status === "blocked" ? "blocked" : runtimeResult?.status ?? "done"
      },
      dbPath
    );
    if (runner) {
      updateRunnerHeartbeat(
        {
          runnerId: runner.id,
          status: status === "blocked" ? "blocked" : "idle",
          currentRunId: status === "blocked" ? runId : null,
          lastHeartbeat: "刚刚"
        },
        dbPath
      );
    }
    const testReportArtifact = upsertProjectArtifact(
      {
        projectId,
        type: "test-report",
        title:
          status === "blocked"
            ? `${project.name} 测试阻塞报告`
            : runtimeResult?.artifacts.find((item) => item.type === "test-report")?.title ??
              `${project.name} 测试报告`,
        ownerAgentId:
          runtimeResult?.artifacts.find((item) => item.type === "test-report")?.ownerAgentId ??
          "agent-qa-automation",
        status:
          status === "blocked"
            ? "in-review"
            : runtimeResult?.artifacts.find((item) => item.type === "test-report")?.status ?? "ready"
      },
      dbPath
    );
    upsertProjectArtifact(
      {
        projectId,
        type: "playwright-run",
        title:
          status === "blocked"
            ? `${project.name} Playwright 阻塞回归记录`
            : runtimeResult?.artifacts.find((item) => item.type === "playwright-run")?.title ??
              `${project.name} Playwright 回归记录`,
        ownerAgentId:
          runtimeResult?.artifacts.find((item) => item.type === "playwright-run")?.ownerAgentId ??
          "agent-qa-automation",
        status:
          status === "blocked"
            ? "in-review"
            : runtimeResult?.artifacts.find((item) => item.type === "playwright-run")?.status ??
              "ready"
      },
      dbPath
    );
    const demoBuildArtifact = snapshot.artifacts.find(
      (artifact) => artifact.projectId === projectId && artifact.type === "demo-build"
    );
    const reviewTarget = demoBuildArtifact ?? testReportArtifact;

    if (status === "blocked") {
      upsertArtifactReview(
        {
          artifactId: reviewTarget.id,
          reviewerAgentId: "agent-qa-automation",
          decision: "changes-requested",
          summary:
            failedGates.length > 0
              ? `门禁未通过：${failedGates.map((gate) => gate.name).join(" / ")}。`
              : "门禁待确认，仍需补充验证。",
          conditions: [
            ...missingArtifacts.map(
              (type) => `${artifactLabels[type] ?? type} 需要补齐`
            ),
            ...failedGates.map((gate) => `${gate.name} 需要重新通过`),
            ...pendingGates.map((gate) => `${gate.name} 仍待确认`)
          ]
        },
        dbPath
      );
      upsertProjectTask(
        {
          id: `task-${projectId}-gate-escalation`,
          projectId,
          stage: "测试验证",
          title: "处理测试门禁阻塞",
          ownerAgentId: "agent-service-strategy",
          status: "todo",
          priority: "P0",
          category: "handoff",
          summary:
            failedGates.length > 0
              ? `门禁阻塞待处理：${failedGates.map((gate) => gate.name).join(" / ")}。`
              : "门禁待确认，需由负责人决定是否继续推进。"
        },
        dbPath
      );
      upsertProjectTask(
        {
          id: `task-${projectId}-gate-remediation`,
          projectId,
          stage: "开发执行",
          title: "修复门禁阻塞并回流研发执行",
          ownerAgentId: "agent-frontend",
          status: "todo",
          priority: "P0",
          category: "execution",
          summary:
            failedGates.length > 0
              ? `根据门禁失败项修复问题并重新提交验证：${failedGates
                  .map((gate) => gate.name)
                  .join(" / ")}。`
              : "根据待确认门禁补齐缺失实现与验证材料，回流研发执行。"
        },
        dbPath
      );
    } else {
      if (demoBuildArtifact) {
        upsertProjectArtifact(
          {
            projectId,
            type: "demo-build",
            title: demoBuildArtifact.title,
            ownerAgentId: demoBuildArtifact.ownerAgentId,
            status: "ready"
          },
          dbPath
        );
        upsertArtifactReview(
          {
            artifactId: demoBuildArtifact.id,
            reviewerAgentId: "agent-qa-automation",
            decision: "pass",
            summary: "门禁已通过，Demo 可进入交付说明整理。",
            conditions: ["构建通过", "自动化回归通过", "人工复核已完成"]
          },
          dbPath
        );
      }
      updateProjectTasks(
        {
          projectId,
          taskId: `task-${projectId}-gate-escalation`,
          status: "done",
          summary: "测试门禁已通过，升级任务已关闭。"
        },
        dbPath
      );
      upsertProjectArtifact(
        {
          projectId,
          type: "release-brief",
          title: `${project.name} 交付说明`,
          ownerAgentId: "agent-release",
          status: "draft"
        },
        dbPath
      );
      upsertProjectTask(
        {
          id: `task-${projectId}-release-brief`,
          projectId,
          stage: "交付发布",
          title: "整理交付说明与验收口径",
          ownerAgentId: "agent-release",
          status: "todo",
          priority: "P1",
          category: "release",
          summary: "测试门禁已通过，开始整理交付摘要、验收说明和发布备注。"
        },
        dbPath
      );
    }
    updateProjectTasks(
      {
        projectId,
        titleIncludes: "Playwright",
        status: status === "blocked" ? "blocked" : "done",
        summary:
          status === "blocked"
            ? "测试门禁存在阻塞，需先修复回归链路再继续交付。"
            : "测试门禁已通过，可以继续准备交付。"
      },
      dbPath
    );
    updateProjectWorkflowState(
      {
        projectId,
        currentStage: status === "blocked" ? "测试验证" : "交付发布",
        state: status === "blocked" ? "blocked" : "current",
        blockers:
          status === "blocked"
            ? decisions.map((decision) => decision.summary)
            : [],
        updatedBy: "qa"
      },
      dbPath
    );

    const summary =
      status === "blocked"
        ? appendExtraNotes("门禁未通过，需先处理失败项后再继续。", input.extraNotes)
        : runtimeResult?.summary ?? "门禁已执行，当前没有失败项。";
    const recorded = recordCommandExecutionForAI(
      {
        id: executionId,
        commandId: command.id,
        projectId,
        status,
        summary,
        triggeredBy,
        followUpTaskIds:
          status === "blocked"
            ? [`task-${projectId}-gate-escalation`, `task-${projectId}-gate-remediation`]
            : [],
        decisions
      },
      dbPath
    );

    return {
      command,
      project,
      execution: recorded.execution,
      decisions: recorded.decisions,
      gates: snapshot.deliveryGate
    };
  }

  if (command.type === "release.prepare") {
    const runtimeSignal = getProjectRuntimeSignal(snapshot, projectId);
    const runner = selectRunnerForCommand(snapshot, command.type);
    const decisions = buildDefaultPolicyDecisions(snapshot, {
      id: executionId,
      commandId: command.id,
      projectId,
      status: "running",
      summary: command.summary,
      triggeredBy
    });

    if (decisions.some((decision) => decision.outcome === "block")) {
      const recorded = recordCommandExecutionForAI(
        {
          id: executionId,
          commandId: command.id,
          projectId,
          status: "blocked",
          summary: "交付说明前置条件未满足。",
          triggeredBy,
          decisions
        },
        dbPath
      );

      return {
        command,
        project,
        execution: recorded.execution,
        decisions: recorded.decisions
      };
    }

    const runId = `run-${projectId}-release-${Date.now().toString(36)}`;
    upsertRun(
      {
        id: runId,
        projectId,
        title: `${project.name} 交付说明整理`,
        executor: runner?.name ?? "交付编排执行器",
        cost: "$0.00",
        state: "done"
      },
      dbPath
    );
    if (runner) {
      updateRunnerHeartbeat(
        {
          runnerId: runner.id,
          status: "idle",
          currentRunId: null,
          lastHeartbeat: "刚刚"
        },
        dbPath
      );
    }
    const artifact = upsertProjectArtifact(
      {
        projectId,
        type: "release-brief",
        title: `${project.name} 交付说明`,
        ownerAgentId: "agent-release",
        status: "in-review"
      },
      dbPath
    );
    upsertProjectArtifact(
      {
        projectId,
        type: "review-decision",
        title: `${project.name} 放行评审结论`,
        ownerAgentId: "agent-service-strategy",
        status: "in-review"
      },
      dbPath
    );
    updateProjectTasks(
      {
        projectId,
        taskId: `task-${projectId}-release-brief`,
        status: "done",
        summary: "交付说明、验收口径和发布备注已经整理完成。"
      },
      dbPath
    );
    upsertArtifactReview(
      {
        artifactId: artifact.id,
        reviewerAgentId: "agent-service-strategy",
        decision: "pending",
        summary: appendExtraNotes(
          "交付说明已整理，等待负责人确认验收口径与放行条件。",
          runtimeSignal
        ),
        conditions: ["交付范围无遗漏", "验收口径已确认", "预览与说明保持一致"]
      },
      dbPath
    );
    upsertProjectTask(
      {
        id: `task-${projectId}-release-approval`,
        projectId,
        stage: "交付发布",
        title: "确认交付说明与放行口径",
        ownerAgentId: "agent-service-strategy",
        status: "todo",
        priority: "P0",
        category: "review",
        summary: "负责人需要确认交付说明、验收范围和发布口径。"
      },
      dbPath
    );
    updateProjectWorkflowState(
      {
        projectId,
        currentStage: "交付发布",
        state: "blocked",
        blockers: ["等待人工确认交付说明"],
        updatedBy: "release"
      },
      dbPath
    );

    const recorded = recordCommandExecutionForAI(
      {
        id: executionId,
        commandId: command.id,
        projectId,
        status: "done",
        summary: `已整理《${artifact.title}》，等待负责人确认后放行。`,
        triggeredBy,
        decisions: [
          {
            id: buildDecisionId(executionId, "before-release"),
            hookId: "hook-before-release",
            outcome: "pass",
            summary: "测试报告与 Demo 已齐备，允许整理交付说明。"
          }
        ]
      },
      dbPath
    );

    return {
      command,
      project,
      artifact,
      execution: recorded.execution,
      decisions: recorded.decisions
    };
  }

  if (command.type === "release.approve") {
    const runtimeSignal = getProjectRuntimeSignal(snapshot, projectId);
    const releaseGate = getReleaseGateSummary(snapshot, projectId);
    const bridgeGuidance = getReleaseApprovalBridgeGuidance({
      releaseGate,
      includeReleaseBriefHint: true
    });
    const blockingEscalationAction = releaseGate.escalationActions.find(
      (item) =>
        item.blocking &&
        !item.label.includes("最新运行信号") &&
        !item.label.includes("交付说明") &&
        !item.label.includes("放行评审结论") &&
        !item.label.includes("归档审计") &&
        !item.nextAction?.includes("确认交付说明")
    );
    const releaseBrief = snapshot.artifacts.find(
      (artifact) =>
        artifact.projectId === projectId &&
        artifact.type === "release-brief" &&
        artifact.status !== "draft"
    );

    if (blockingEscalationAction) {
      upsertProjectTask(
        {
          id: `task-${projectId}-release-escalation`,
          projectId,
          stage: "交付发布",
          title: "处理放行阻塞并重新确认",
          ownerAgentId: "agent-service-strategy",
          status: "todo",
          priority: "P0",
          category: "handoff",
          summary: `自动升级动作待处理：${blockingEscalationAction.label}。${
            bridgeGuidance ? `${bridgeGuidance} ` : ""
          }${blockingEscalationAction.nextAction ?? "请先处理阻断项。"}`
        },
        dbPath
      );
      updateProjectWorkflowState(
        {
          projectId,
          currentStage: "交付发布",
          state: "blocked",
          blockers: [blockingEscalationAction.label],
          updatedBy: "pm"
        },
        dbPath
      );
      const recorded = recordCommandExecutionForAI(
        {
          id: executionId,
          commandId: command.id,
          projectId,
          status: "blocked",
          summary: `存在自动升级动作，暂不允许放行：${blockingEscalationAction.label}。${
            bridgeGuidance ? `${bridgeGuidance} ` : ""
          }${blockingEscalationAction.nextAction ?? "请先处理阻断项。"}。`,
          triggeredBy,
          followUpTaskIds: [`task-${projectId}-release-escalation`],
          decisions: [
            {
              id: buildDecisionId(executionId, "before-release"),
              hookId: "hook-before-release",
              outcome: "block",
              summary: `${blockingEscalationAction.detail}${bridgeGuidance ? ` 当前桥接移交：${bridgeGuidance}` : ""}`
            }
          ]
        },
        dbPath
      );

      return {
        command,
        project,
        execution: recorded.execution,
        decisions: recorded.decisions
      };
    }

    if (!releaseBrief) {
      upsertProjectTask(
        {
          id: `task-${projectId}-release-escalation`,
          projectId,
          stage: "交付发布",
          title: "处理放行阻塞并重新确认",
          ownerAgentId: "agent-service-strategy",
          status: "todo",
          priority: "P0",
          category: "handoff",
          summary: `自动升级动作待处理：${bridgeGuidance ? `${bridgeGuidance} ` : ""}先补齐交付说明，再重新发起放行确认。`
        },
        dbPath
      );
      const recorded = recordCommandExecutionForAI(
        {
          id: executionId,
          commandId: command.id,
          projectId,
          status: "blocked",
          summary: `${bridgeGuidance ? `${bridgeGuidance} ` : ""}缺少待确认的交付说明，无法放行。`,
          triggeredBy,
          followUpTaskIds: [`task-${projectId}-release-escalation`],
          decisions: [
            {
              id: buildDecisionId(executionId, "before-release"),
              hookId: "hook-before-release",
              outcome: "block",
              summary: `${bridgeGuidance ? `${bridgeGuidance} ` : ""}当前没有待确认的交付说明，无法执行放行。`
            }
          ]
        },
        dbPath
      );

      return {
        command,
        project,
        execution: recorded.execution,
        decisions: recorded.decisions
      };
    }

    const artifact = upsertProjectArtifact(
      {
        projectId,
        type: "release-brief",
        title: releaseBrief.title,
        ownerAgentId: releaseBrief.ownerAgentId,
        status: "ready"
      },
      dbPath
    );
    upsertProjectArtifact(
      {
        projectId,
        type: "review-decision",
        title: `${project.name} 放行评审结论`,
        ownerAgentId: "agent-service-strategy",
        status: "ready"
      },
      dbPath
    );
    upsertArtifactReview(
      {
        artifactId: artifact.id,
        reviewerAgentId: "agent-service-strategy",
        decision: "pass",
        summary: appendExtraNotes(
          "负责人已确认交付说明与放行口径，可以进入归档复用。",
          runtimeSignal
        ),
        conditions: ["交付范围已确认", "验收口径已签收", "可进入沉淀环节"]
      },
      dbPath
    );
    updateProjectTasks(
      {
        projectId,
        taskId: `task-${projectId}-release-approval`,
        status: "done",
        summary: "负责人已确认交付说明，允许进入归档复用。"
      },
      dbPath
    );
    updateProjectTasks(
      {
        projectId,
        taskId: `task-${projectId}-release-escalation`,
        status: "done",
        summary: "放行阻塞已解除，升级任务已关闭。"
      },
      dbPath
    );
    upsertProjectTask(
      {
        id: `task-${projectId}-knowledge-card`,
        projectId,
        stage: "归档复用",
        title: "沉淀交付知识卡",
        ownerAgentId: "agent-knowledge-ops",
        status: "todo",
        priority: "P2",
        category: "knowledge",
        summary: "基于交付说明和测试结果提炼知识卡、模板和复用建议。"
      },
      dbPath
    );
    updateProjectWorkflowState(
      {
        projectId,
        currentStage: "归档复用",
        state: "current",
        blockers: [],
        updatedBy: "pm"
      },
      dbPath
    );

    const recorded = recordCommandExecutionForAI(
      {
        id: executionId,
        commandId: command.id,
        projectId,
        status: "done",
        summary: `已确认《${artifact.title}》，项目进入归档复用。`,
        triggeredBy,
        decisions: [
          {
            id: buildDecisionId(executionId, "before-release"),
            hookId: "hook-before-release",
            outcome: "pass",
            summary: "交付说明已完成人工确认，允许进入归档复用。"
          }
        ]
      },
      dbPath
    );

    return {
      command,
      project,
      artifact,
      execution: recorded.execution,
      decisions: recorded.decisions
    };
  }

  if (command.type === "taskpack.generate") {
    const decisions = buildDefaultPolicyDecisions(snapshot, {
      id: executionId,
      commandId: command.id,
      projectId,
      status: "running",
      summary: command.summary,
      triggeredBy
    });

    if (decisions.some((decision) => decision.outcome === "block")) {
      const recorded = recordCommandExecutionForAI(
        {
          id: executionId,
          commandId: command.id,
          projectId,
          status: "blocked",
          summary: "TaskPack 生成前置工件未齐备。",
          triggeredBy,
          decisions
        },
        dbPath
      );

      return {
        command,
        project,
        execution: recorded.execution,
        decisions: recorded.decisions
      };
    }

    const artifact = upsertProjectArtifact(
      {
        projectId,
        type: "task-pack",
        title: `${project.name} 首轮 TaskPack`,
        ownerAgentId: "agent-architect",
        status: "ready"
      },
      dbPath
    );
    const assemblyPlan = getComponentAssemblyPlanForAI(
      {
        projectId,
        taskPackId: artifact.id,
        maxItems: 2
      },
      dbPath
    );
    const autoLinkedComponents = assemblyPlan.items.map((item) =>
      upsertProjectComponentLink(
        {
          projectId,
          componentId: item.componentId,
          relation: "recommended",
          reason: item.reason,
          usageGuide: item.usageGuide
        },
        dbPath
      )
    );
    const pendingAssemblyPlan = getComponentAssemblyPlanForAI(
      {
        projectId,
        taskPackId: artifact.id,
        maxItems: 5
      },
      dbPath
    );
    const componentAssemblyTaskId =
      pendingAssemblyPlan.pendingCount > 0 ? `task-${projectId}-component-assembly` : null;

    if (componentAssemblyTaskId) {
      upsertProjectTask(
        {
          id: componentAssemblyTaskId,
          projectId,
          stage: "开发执行",
          title: "补齐 TaskPack 组件装配",
          ownerAgentId: "agent-architect",
          status: "todo",
          priority: "P0",
          category: "execution",
          summary: `待装配组件：${pendingAssemblyPlan.pendingItems
            .map((item) => item.title)
            .join(" / ")}。先完成组件装配，再继续推进研发执行。`
        },
        dbPath
      );
    }
    updateProjectTasks(
      {
        projectId,
        taskId: `task-${projectId}-design-arch`,
        status: "done",
        summary: "原型、架构说明和首轮 TaskPack 已齐备，可进入研发执行。"
      },
      dbPath
    );
    updateProjectTasks(
      {
        projectId,
        taskId: `task-${projectId}-runner-gates`,
        status: "in-progress",
        summary: "TaskPack 已下发，等待初始化本地 Runner 与默认门禁。"
      },
      dbPath
    );
    updateProjectWorkflowState(
      {
        projectId,
        currentStage: "开发执行",
        state: "current",
        blockers: [],
        updatedBy: "architect"
      },
      dbPath
    );

    const recorded = recordCommandExecutionForAI(
      {
        id: executionId,
        commandId: command.id,
        projectId,
        taskPackId: artifact.id,
        status: "done",
        summary: `已生成《${artifact.title}》，项目进入研发执行${
          autoLinkedComponents.length > 0
            ? `，已挂接组件：${autoLinkedComponents.map((item) => item.component.title).join(" / ")}`
            : ""
        }${
          pendingAssemblyPlan.pendingCount > 0
            ? `；待装配组件：${pendingAssemblyPlan.pendingItems.map((item) => item.title).join(" / ")}`
            : ""
        }。`,
        triggeredBy,
        followUpTaskIds: componentAssemblyTaskId ? [componentAssemblyTaskId] : [],
        decisions: [
          {
            id: buildDecisionId(executionId, "before-run"),
            hookId: "hook-before-run",
            outcome: "pass",
            summary: "PRD、架构说明和 UI 规范已齐备，允许生成 TaskPack。"
          }
        ]
      },
      dbPath
    );

    return {
      command,
      project,
      artifact,
      execution: recorded.execution,
      decisions: recorded.decisions
    };
  }

  if (command.type === "component.assemble") {
    const assembled = applyComponentAssemblyForAI(
      {
        projectId,
        taskPackId: input.taskPackId,
        componentIds: input.componentIds ?? [],
        triggeredBy
      },
      dbPath
    );

    return {
      command,
      ...assembled
    };
  }

  if (command.type === "execution.start") {
    const taskPackArtifact = resolveTaskPackArtifact(snapshot, projectId, input.taskPackId);
    const linkedComponents = getProjectLinkedComponents(snapshot, projectId);
    const componentAssemblyPlan = taskPackArtifact
      ? getComponentAssemblyPlanForAI(
          {
            projectId,
            taskPackId: taskPackArtifact.id,
            maxItems: 3
          },
          dbPath
        )
      : null;
    const runner =
      selectRunnerForCommand(snapshot, command.type) ??
      snapshot.runners.find((item) => item.status !== "offline" && item.probeStatus !== "offline");
    const runtimeAdapter = selectRuntimeAdapter(runtimeAdapters, command.type);
    const decisions = buildDefaultPolicyDecisions(snapshot, {
      id: executionId,
      commandId: command.id,
      projectId,
      status: "running",
      summary: command.summary,
      triggeredBy
    });

    if (!runner) {
      decisions.push({
        id: buildDecisionId(executionId, "runner"),
        hookId: "hook-before-run",
        outcome: "block",
        summary: "当前没有可用 Runner，无法启动研发执行。"
      });
    }

    if (!taskPackArtifact || taskPackArtifact.status !== "ready") {
      decisions.push({
        id: buildDecisionId(executionId, "task-pack"),
        hookId: "hook-before-run",
        outcome: "block",
        summary: input.taskPackId?.trim()
          ? "指定的 TaskPack 不存在或尚未 ready，无法启动研发执行。"
          : "当前没有 ready 的 TaskPack，无法启动研发执行。"
      });
    }

    if (
      taskPackArtifact &&
      linkedComponents.length === 0 &&
      (componentAssemblyPlan?.pendingItems.length ?? 0) > 0
    ) {
      decisions.push({
        id: buildDecisionId(executionId, "component-assembly"),
        hookId: "hook-before-run",
        outcome: "block",
        summary: `当前 TaskPack 仍有待装配组件：${componentAssemblyPlan?.pendingItems
          .map((item) => item.title)
          .join(" / ")}。请先完成组件装配后再启动研发执行。`
      });
    }

    if (decisions.some((decision) => decision.outcome === "block")) {
      const assemblyBlockingDecision = decisions.find(
        (decision) => decision.id === buildDecisionId(executionId, "component-assembly")
      );

      if (assemblyBlockingDecision) {
        upsertProjectTask(
          {
            id: `task-${projectId}-component-assembly`,
            projectId,
            stage: "开发执行",
            title: "补齐 TaskPack 组件装配",
            ownerAgentId: "agent-architect",
            status: "todo",
            priority: "P0",
            category: "execution",
            summary: assemblyBlockingDecision.summary
          },
          dbPath
        );
        updateProjectWorkflowState(
          {
            projectId,
            currentStage: "开发执行",
            state: "blocked",
            blockers: [assemblyBlockingDecision.summary],
            updatedBy: "architect"
          },
          dbPath
        );
      }

      const recorded = recordCommandExecutionForAI(
        {
          id: executionId,
          commandId: command.id,
          projectId,
          taskPackId: taskPackArtifact?.id ?? input.taskPackId?.trim() ?? null,
          status: "blocked",
          summary: assemblyBlockingDecision?.summary ?? "研发执行前置条件未满足。",
          triggeredBy,
          followUpTaskIds: assemblyBlockingDecision ? [`task-${projectId}-component-assembly`] : [],
          decisions
        },
        dbPath
      );

      return {
        command,
        project,
        execution: recorded.execution,
        decisions: recorded.decisions
      };
    }

    const runtimeResult =
      runner && runtimeAdapter
        ? runtimeAdapter.run({
            command,
            project,
            taskPackArtifact,
            linkedComponents,
            runner,
            extraNotes: input.extraNotes?.trim()
          })
        : null;
    const linkedComponentSummary =
      linkedComponents.length > 0
        ? ` · 装配组件：${linkedComponents.map((component) => component.title).join(" / ")}`
        : "";
    const runId = `run-${projectId}-execution-${Date.now().toString(36)}`;
    const runResult = upsertRun(
      {
        id: runId,
        projectId,
        taskPackId: taskPackArtifact?.id ?? null,
        linkedComponentIds: linkedComponents.map((component) => component.id),
        title: `${project.name} 研发执行${linkedComponentSummary}`,
        executor: runner?.name ?? "本地 Runner",
        cost: "$0.00",
        state: "running"
      },
      dbPath
    );
    if (runner) {
      updateRunnerHeartbeat(
        {
          runnerId: runner.id,
          status: "busy",
          currentRunId: runId,
          lastHeartbeat: "刚刚"
        },
        dbPath
      );
    }

    const artifact = upsertProjectArtifact(
      {
        projectId,
        type: "patch",
        title: runtimeResult?.artifacts.find((item) => item.type === "patch")?.title ?? `${project.name} 首轮 Patch`,
        ownerAgentId:
          runtimeResult?.artifacts.find((item) => item.type === "patch")?.ownerAgentId ??
          "agent-frontend",
        status:
          runtimeResult?.artifacts.find((item) => item.type === "patch")?.status ?? "in-review"
      },
      dbPath
    );
    const demoArtifact = upsertProjectArtifact(
      {
        projectId,
        type: "demo-build",
        title:
          runtimeResult?.artifacts.find((item) => item.type === "demo-build")?.title ??
          `${project.name} Demo 构建`,
        ownerAgentId:
          runtimeResult?.artifacts.find((item) => item.type === "demo-build")?.ownerAgentId ??
          "agent-frontend",
        status:
          runtimeResult?.artifacts.find((item) => item.type === "demo-build")?.status ??
          "in-review"
      },
      dbPath
    );
    upsertArtifactReview(
      {
        artifactId: demoArtifact.id,
        reviewerAgentId: "agent-qa-automation",
        decision: "pending",
        summary: `Demo 构建已生成，等待 ${getForgeAgentDisplayLabel({ id: "agent-qa-automation" })} 执行主流程与异常路径复核。`,
        conditions: ["主流程可运行", "异常路径已覆盖", "人工复核说明已补齐"]
      },
      dbPath
    );
    updateProjectTasks(
      {
        projectId,
        taskId: `task-${projectId}-runner-gates`,
        status: "done",
        summary: "本地 Runner 与默认门禁已接通，研发执行正在进行。"
      },
      dbPath
    );
    updateProjectWorkflowState(
      {
        projectId,
        currentStage: "开发执行",
        state: "current",
        blockers: [],
        updatedBy: "engineer"
      },
      dbPath
    );

    const recorded = recordCommandExecutionForAI(
      {
        id: executionId,
        commandId: command.id,
        projectId,
        taskPackId: taskPackArtifact?.id ?? null,
        status: "done",
        summary:
          runtimeResult?.summary ??
          `已把 ${taskPackArtifact?.title ?? "TaskPack"} 分配给 ${runner?.name ?? "本地 Runner"}，研发执行开始${linkedComponentSummary}。`,
        triggeredBy,
        decisions: [
          {
            id: buildDecisionId(executionId, "before-run"),
            hookId: "hook-before-run",
            outcome: "pass",
            summary: `${taskPackArtifact?.title ?? "TaskPack"} 已就绪，Runner 可用，允许启动研发执行。`
          }
        ]
      },
      dbPath
    );

    return {
      command,
      project,
      run: runResult.run,
      taskPackArtifact,
      artifact: demoArtifact,
      execution: recorded.execution,
      decisions: recorded.decisions
    };
  }

  if (command.type === "archive.capture") {
    const runtimeSignal = getProjectRuntimeSignal(snapshot, projectId);
    const runner = selectRunnerForCommand(snapshot, command.type);
    const hasReleaseBrief = snapshot.artifacts.some(
      (artifact) =>
        artifact.projectId === projectId &&
        artifact.type === "release-brief" &&
        artifact.status === "ready"
    );

    if (!hasReleaseBrief) {
      const recorded = recordCommandExecutionForAI(
        {
          id: executionId,
          commandId: command.id,
          projectId,
          status: "blocked",
          summary: "缺少交付说明，暂时无法归档沉淀。",
          triggeredBy,
          decisions: [
            {
              id: buildDecisionId(executionId, "before-release"),
              hookId: "hook-before-release",
              outcome: "block",
              summary: "缺少交付说明，无法生成知识卡和沉淀结果。"
            }
          ]
        },
        dbPath
      );

      return {
        command,
        project,
        execution: recorded.execution,
        decisions: recorded.decisions
      };
    }

    const runId = `run-${projectId}-archive-${Date.now().toString(36)}`;
    upsertRun(
      {
        id: runId,
        projectId,
        title: `${project.name} 归档沉淀`,
        executor: runner?.name ?? "交付编排执行器",
        cost: "$0.00",
        state: "done"
      },
      dbPath
    );
    if (runner) {
      updateRunnerHeartbeat(
        {
          runnerId: runner.id,
          status: "idle",
          currentRunId: null,
          lastHeartbeat: "刚刚"
        },
        dbPath
      );
    }
    const artifact = upsertProjectArtifact(
      {
        projectId,
        type: "knowledge-card",
        title: `${project.name} 交付知识卡`,
        ownerAgentId: "agent-knowledge-ops",
        status: "ready"
      },
      dbPath
    );
    const releaseAuditArtifact = upsertProjectArtifact(
      {
        projectId,
        type: "release-audit",
        title: `${project.name} 归档审计记录`,
        ownerAgentId: "agent-release",
        status: "ready"
      },
      dbPath
    );
    upsertArtifactReview(
      {
        artifactId: releaseAuditArtifact.id,
        reviewerAgentId: "agent-service-strategy",
        decision: "pass",
        summary: appendExtraNotes(
          "交付知识卡、归档审计和复用建议已沉淀完成。",
          runtimeSignal
        ),
        conditions: ["交付说明已归档", "运行信号已留痕", "复用建议已生成"]
      },
      dbPath
    );
    updateProjectTasks(
      {
        projectId,
        taskId: `task-${projectId}-knowledge-card`,
        status: "done",
        summary: "交付知识卡、归档审计和复用建议已沉淀完成。"
      },
      dbPath
    );
    updateProjectWorkflowState(
      {
        projectId,
        currentStage: "归档复用",
        state: "current",
        blockers: [],
        updatedBy: "knowledge"
      },
      dbPath
    );

    const recorded = recordCommandExecutionForAI(
      {
        id: executionId,
        commandId: command.id,
        projectId,
        status: "done",
        summary: `已沉淀《${artifact.title}》，项目进入归档复用。`,
        triggeredBy,
        decisions: [
          {
            id: buildDecisionId(executionId, "after-run"),
            hookId: "hook-after-run",
            outcome: "pass",
            summary: "交付说明已齐备，允许沉淀知识卡和复用建议。"
          }
        ]
      },
      dbPath
    );

    return {
      command,
      project,
      artifact,
      execution: recorded.execution,
      decisions: recorded.decisions
    };
  }

  const decisions = buildDefaultPolicyDecisions(snapshot, {
    id: executionId,
    commandId: command.id,
    projectId,
    status: "running",
    summary: command.summary,
    triggeredBy
  });
  const status = decisions.some((decision) => decision.outcome === "block") ? "blocked" : "done";
  const recorded = recordCommandExecutionForAI(
    {
      id: executionId,
      commandId: command.id,
      projectId,
      status,
      summary:
        status === "blocked"
          ? `命令「${command.name}」因前置条件不足被阻断。`
          : `命令「${command.name}」已登记，等待后续执行链接入。`,
      triggeredBy,
      decisions
    },
    dbPath
  );

  return {
    command,
    project,
    execution: recorded.execution,
    decisions: recorded.decisions
  };
}

export function retryTaskForAI(input: RetryTaskInput, dbPath?: string) {
  const taskId = requireText(input.taskId, "任务 ID");
  const snapshot = loadDashboardSnapshot(dbPath);
  const taskItem = getTaskDispatchQueue(snapshot).find((item) => item.task.id === taskId);

  if (!taskItem) {
    throw new ForgeApiError("任务不存在", "FORGE_NOT_FOUND", 404);
  }

  if (!taskItem.retryCommandId) {
    throw new ForgeApiError("当前任务没有可回放的来源命令", "FORGE_RETRY_NOT_AVAILABLE", 400);
  }

  const prefersPendingComponents =
    taskItem.retryCommandId === "command-component-assemble" || taskItem.task.id.includes("component-assembly");
  const selectedComponentIds = prefersPendingComponents
    ? (taskItem.pendingComponentIds?.length ?? 0) > 0
      ? taskItem.pendingComponentIds ?? []
      : taskItem.linkedComponentIds ?? []
    : taskItem.linkedComponentIds ?? [];
  const selectedComponentLabels = prefersPendingComponents
    ? (taskItem.pendingComponentLabels?.length ?? 0) > 0
      ? taskItem.pendingComponentLabels ?? []
      : taskItem.linkedComponentLabels ?? []
    : taskItem.linkedComponentLabels ?? [];

  const result = executeCommandForAI(
    {
      commandId: taskItem.retryCommandId,
      projectId: taskItem.task.projectId,
      taskPackId: taskItem.taskPackId ?? undefined,
      componentIds: selectedComponentIds,
      triggeredBy:
        input.triggeredBy?.trim() ||
        `${taskItem.remediationOwnerLabel ?? taskItem.task.ownerAgentId} 重试任务`
    },
    dbPath
  );
  const linkedComponentIds = selectedComponentIds;
  const linkedComponentLabels = selectedComponentLabels;
  const componentArgs = linkedComponentIds.length > 0 ? ["--component-ids", linkedComponentIds.join(",")] : [];
  const componentCommandSuffix =
    linkedComponentIds.length > 0 ? ` --component-ids ${linkedComponentIds.join(",")}` : "";
  const executionBackend = resolveExecutionBackendForCommandId(snapshot, taskItem.retryCommandId ?? null);
  const runtimeExecutionBackendInvocation = buildExecutionBackendInvocation(snapshot, {
    projectId: taskItem.task.projectId,
    taskPackId: taskItem.taskPackId ?? null,
    linkedComponentIds,
    commandId: taskItem.retryCommandId ?? null
  });

  return {
    ...result,
    taskPackId: taskItem.taskPackId ?? null,
    taskPackLabel: taskItem.taskPackLabel ?? null,
    linkedComponentIds,
    linkedComponentLabels,
    pendingComponentIds: taskItem.pendingComponentIds ?? [],
    pendingComponentLabels: taskItem.pendingComponentLabels ?? [],
    componentAssemblyAction: taskItem.componentAssemblyAction ?? null,
    runtimeExecutionBackendLabel: taskItem.runtimeExecutionBackendLabel ?? null,
    runtimeExecutionBackendInvocation,
    runtimeExecutionBackendCommandPreview: runtimeExecutionBackendInvocation?.commandPreview ?? null,
    runtimeModelProviderLabel: taskItem.runtimeModelProviderLabel ?? null,
    runtimeModelExecutionDetail: taskItem.runtimeModelExecutionDetail ?? null,
    nextAction: withExecutionBackendGuidance(
      withModelExecutionGuidance(taskItem.remediationAction ?? null, taskItem),
      executionBackend?.backend
    ),
    retryApiPath: "/api/forge/tasks/retry",
    retryRunnerArgs: [...taskItem.retryRunnerArgs, ...componentArgs],
    retryRunnerCommand: `${taskItem.retryRunnerCommand}${componentCommandSuffix}`
  };
}

export function retryEscalationForAI(input: RetryTaskInput, dbPath?: string) {
  const result = retryTaskForAI(input, dbPath);

  if (!("project" in result) || !result.project?.id) {
    throw new ForgeApiError("当前回放结果缺少项目上下文", "FORGE_VALIDATION_ERROR", 500);
  }

  const taskPackArgs = result.taskPackId ? ["--taskpack-id", result.taskPackId] : [];

  return {
    ...result,
    retryApiPath: "/api/forge/escalations/retry",
    unifiedRetryApiPath: "/api/forge/remediations/retry",
    unifiedRetryRunnerArgs: [
      "--remediation-id",
      input.taskId,
      "--project-id",
      result.project.id,
      ...taskPackArgs,
      ...((result.linkedComponentIds?.length ?? 0) > 0
        ? ["--component-ids", result.linkedComponentIds.join(",")]
        : [])
    ],
    unifiedRetryRunnerCommand: `npm run runner:forge -- --remediation-id ${input.taskId} --project-id ${result.project.id}${
      result.taskPackId ? ` --taskpack-id ${result.taskPackId}` : ""
    }${
      (result.linkedComponentIds?.length ?? 0) > 0
        ? ` --component-ids ${result.linkedComponentIds.join(",")}`
        : ""
    }`
  };
}

export function retryRemediationForAI(input: RetryRemediationInput, dbPath?: string) {
  const remediationId = requireText(input.remediationId, "整改入口 ID");
  const snapshot = loadDashboardSnapshot(dbPath);
  const remediations = getRemediationsForAI({}, dbPath);
  const remediation = remediations.items.find((item) => item.id === remediationId);

  if (!remediation) {
    throw new ForgeApiError("整改入口不存在", "FORGE_NOT_FOUND", 404);
  }

  const result =
    remediation.kind === "escalation"
      ? retryEscalationForAI({ taskId: remediationId, triggeredBy: input.triggeredBy }, dbPath)
      : retryTaskForAI({ taskId: remediationId, triggeredBy: input.triggeredBy }, dbPath);
  const remediationLinkedComponentIds =
    remediation.kind === "task" ? remediation.linkedComponentIds ?? [] : result.linkedComponentIds ?? [];
  const remediationLinkedComponentLabels =
    remediation.kind === "task"
      ? remediation.linkedComponentLabels ?? []
      : result.linkedComponentLabels ?? [];
  const remediationPendingComponentIds =
    remediation.kind === "task" ? remediation.pendingComponentIds ?? [] : result.pendingComponentIds ?? [];
  const remediationPendingComponentLabels =
    remediation.kind === "task"
      ? remediation.pendingComponentLabels ?? []
      : result.pendingComponentLabels ?? [];
  const remediationComponentAssemblyAction =
    remediation.kind === "task"
      ? remediation.componentAssemblyAction ?? result.componentAssemblyAction ?? null
      : result.componentAssemblyAction ?? null;
  const fallbackCommandId = getExecutionResultEntityId(result, "command");
  const fallbackProjectId = getExecutionResultEntityId(result, "project");
  const commandId = remediation.retryCommandId ?? fallbackCommandId;
  const projectId = remediation.projectId ?? fallbackProjectId;

  if (!commandId || !projectId) {
    throw new ForgeApiError("当前整改入口缺少回放命令或项目上下文", "FORGE_VALIDATION_ERROR", 500);
  }

  const executionBackend = resolveExecutionBackendForCommandId(
    snapshot,
    commandId,
    remediations.executionBackends
  );
  const runtimeExecutionBackendInvocation = buildExecutionBackendInvocation(snapshot, {
    projectId,
    taskPackId: remediation.taskPackId ?? result.taskPackId ?? null,
    linkedComponentIds: remediationLinkedComponentIds,
    commandId,
    executionBackends: remediations.executionBackends
  });

  return {
    ...result,
    taskPackId: remediation.taskPackId ?? result.taskPackId ?? null,
    taskPackLabel: remediation.taskPackLabel ?? result.taskPackLabel ?? null,
    linkedComponentIds: remediationLinkedComponentIds,
    linkedComponentLabels: remediationLinkedComponentLabels,
    pendingComponentIds: remediationPendingComponentIds,
    pendingComponentLabels: remediationPendingComponentLabels,
    componentAssemblyAction: remediationComponentAssemblyAction,
    runtimeExecutionBackendLabel:
      remediation.runtimeExecutionBackendLabel ??
      result.runtimeExecutionBackendLabel ??
      executionBackend?.backend ??
      null,
    runtimeExecutionBackendInvocation:
      remediation.runtimeExecutionBackendInvocation ??
      result.runtimeExecutionBackendInvocation ??
      runtimeExecutionBackendInvocation,
    runtimeExecutionBackendCommandPreview:
      remediation.runtimeExecutionBackendCommandPreview ??
      result.runtimeExecutionBackendCommandPreview ??
      runtimeExecutionBackendInvocation?.commandPreview ??
      null,
    runtimeModelProviderLabel:
      remediation.runtimeModelProviderLabel ?? result.runtimeModelProviderLabel ?? null,
    runtimeModelExecutionDetail:
      remediation.runtimeModelExecutionDetail ?? result.runtimeModelExecutionDetail ?? null,
    nextAction: withModelExecutionGuidance(
      withExecutionBackendGuidance(remediation.nextAction ?? result.nextAction ?? null, executionBackend?.backend),
      {
        runtimeModelProviderLabel:
          remediation.runtimeModelProviderLabel ?? result.runtimeModelProviderLabel ?? null,
        runtimeModelExecutionDetail:
          remediation.runtimeModelExecutionDetail ?? result.runtimeModelExecutionDetail ?? null
      }
    ),
    retryApiPath: "/api/forge/remediations/retry",
    retryRunnerArgs: [
      "--remediation-id",
      remediationId,
      "--project-id",
      remediation.projectId ?? "",
      ...(remediation.taskPackId ? ["--taskpack-id", remediation.taskPackId] : []),
      ...((result.linkedComponentIds?.length ?? 0) > 0
        ? [
            "--component-ids",
            result.linkedComponentIds.join(",")
          ]
        : [])
    ].filter(Boolean),
    retryRunnerCommand: `npm run runner:forge -- --remediation-id ${remediationId}${
      remediation.projectId ? ` --project-id ${remediation.projectId}` : ""
    }${remediation.taskPackId ? ` --taskpack-id ${remediation.taskPackId}` : ""
    }${
      (result.linkedComponentIds?.length ?? 0) > 0
        ? ` --component-ids ${result.linkedComponentIds.join(",")}`
        : ""
    }`
  };
}

export function prepareExecutionBackendRequestForAI(
  input: PrepareExecutionBackendRequestInput,
  dbPath?: string
) {
  const remediationId = input.remediationId?.trim() ?? "";
  const taskId = input.taskId?.trim() ?? "";
  const projectId = input.projectId?.trim() ?? "";

  if (!remediationId && !taskId && !projectId) {
    throw new ForgeApiError(
      "必须提供 remediationId、taskId 或 projectId",
      "FORGE_BAD_REQUEST",
      400
    );
  }

  if (remediationId) {
    const remediations = getRemediationsForAI({}, dbPath);
    const remediation = remediations.items.find((item) => item.id === remediationId);

    if (!remediation) {
      throw new ForgeApiError("整改入口不存在", "FORGE_NOT_FOUND", 404);
    }

    if (!remediation.runtimeExecutionBackendInvocation) {
      throw new ForgeApiError(
        "当前整改入口没有可用的执行后端调用负载",
        "FORGE_BACKEND_NOT_READY",
        409
      );
    }

    return {
      sourceKind: "remediation" as const,
      sourceId: remediation.id,
      projectId: remediation.projectId ?? null,
      taskPackId: remediation.taskPackId ?? null,
      taskPackLabel: remediation.taskPackLabel ?? null,
      retryCommandId: remediation.retryCommandId ?? null,
      retryCommandLabel: remediation.retryCommandLabel ?? null,
      invocation: remediation.runtimeExecutionBackendInvocation
    };
  }

  if (taskId) {
    const tasks = listTasksForAI({}, dbPath);
    const task = tasks.items.find((item) => item.id === taskId);

    if (!task) {
      throw new ForgeApiError("整改任务不存在", "FORGE_NOT_FOUND", 404);
    }

    if (!task.runtimeExecutionBackendInvocation) {
      throw new ForgeApiError(
        "当前整改任务没有可用的执行后端调用负载",
        "FORGE_BACKEND_NOT_READY",
        409
      );
    }

    return {
      sourceKind: "task" as const,
      sourceId: task.id,
      projectId: task.projectId,
      taskPackId: task.taskPackId ?? null,
      taskPackLabel: task.taskPackLabel ?? null,
      retryCommandId: task.retryCommandId ?? null,
      retryCommandLabel: task.retryCommandLabel ?? null,
      invocation: task.runtimeExecutionBackendInvocation
    };
  }

  const snapshot = loadDashboardSnapshot(dbPath);
  const project = snapshot.projects.find((item) => item.id === projectId) ?? null;

  if (!project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  const projectHandoff = resolveProjectHandoffExecutionBackendEntry(snapshot, project.id);
  const projectHandoffCommandType = projectHandoff.commandType;
  const projectHandoffLabel = projectHandoff.label;

  if (!projectHandoffCommandType || !projectHandoffLabel) {
    throw new ForgeApiError(
      "当前项目尚未进入可直连外部规则审查、测试门禁、交付说明或归档沉淀的桥接移交阶段",
      "FORGE_BACKEND_NOT_READY",
      409
    );
  }

  const projectHandoffCommand = projectHandoff.command;

  if (!projectHandoffCommand) {
    throw new ForgeApiError(`${projectHandoffLabel}命令不存在`, "FORGE_NOT_FOUND", 404);
  }

  const taskPackArtifact = projectHandoff.taskPackArtifact;
  const invocation = projectHandoff.invocation;

  if (!invocation) {
    throw new ForgeApiError(
      `当前项目没有可用的${projectHandoffLabel}执行后端调用负载`,
      "FORGE_BACKEND_NOT_READY",
      409
    );
  }

  return {
    sourceKind: "project-handoff" as const,
    sourceId: project.id,
    projectId: project.id,
    taskPackId: taskPackArtifact?.id ?? null,
    taskPackLabel: taskPackArtifact?.title ?? null,
    retryCommandId: projectHandoffCommand.id,
    retryCommandLabel: projectHandoffCommand.name,
    invocation
  };
}

export function dispatchExecutionBackendRequestForAI(
  input: DispatchExecutionBackendRequestInput,
  dbPath?: string
) {
  const prepared = prepareExecutionBackendRequestForAI(input, dbPath);

  return {
    receiptId: `dispatch-${prepared.sourceKind}-${prepared.sourceId}`,
    status: "queued" as const,
    mode: "stub" as const,
    sourceKind: prepared.sourceKind,
    sourceId: prepared.sourceId,
    projectId: prepared.projectId,
    taskPackId: prepared.taskPackId,
    taskPackLabel: prepared.taskPackLabel,
    retryCommandId: prepared.retryCommandId,
    retryCommandLabel: prepared.retryCommandLabel,
    backend: prepared.invocation.backend,
    provider: prepared.invocation.provider,
    triggeredBy: input.triggeredBy?.trim() || "Forge Execution Backend Dispatcher",
    dispatchedAt: new Date().toISOString(),
    summary: `已生成 ${prepared.invocation.backend} 的 execution backend dispatch receipt，可交给外部后端继续执行 ${prepared.invocation.commandType}。`,
    invocation: prepared.invocation
  };
}

export function executeExecutionBackendDispatchForAI(
  input: ExecuteExecutionBackendDispatchInput,
  dbPath?: string
) {
  const dispatched = dispatchExecutionBackendRequestForAI(input, dbPath);
  const payload =
    dispatched.invocation.payload && Object.keys(dispatched.invocation.payload).length > 0
      ? JSON.stringify(dispatched.invocation.payload)
      : "";
  const executionEnv: Record<string, string> = {};

  if (payload) {
    executionEnv.FORGE_EXECUTION_PAYLOAD = payload;
  }

  return {
    ...dispatched,
    status: "ready" as const,
    mode: "external-shell-stub" as const,
    summary: `已生成 ${dispatched.backend} 的 execution backend shell plan，可由外部执行器继续接管 ${dispatched.invocation.commandType}。`,
    execution: {
      cwd: dispatched.invocation.workspacePath ?? process.cwd(),
      command: splitShellCommand(dispatched.invocation.commandPreview),
      commandPreview: dispatched.invocation.commandPreview,
      env: executionEnv
    }
  };
}

export async function bridgeExecutionBackendDispatchForAI(
  input: BridgeExecutionBackendDispatchInput,
  dbPath?: string
) {
  const executionPlan = executeExecutionBackendDispatchForAI(input, dbPath);
  const strategy = input.strategy === "local-shell" ? "local-shell" : "stub";

  if (strategy !== "local-shell") {
    const evidence = buildExecutionBackendBridgeEvidence({
      backend: executionPlan.backend,
      provider: executionPlan.provider,
      commandPreview: executionPlan.execution.commandPreview,
      bridgeStatus: "stub"
    });

    return {
      ...executionPlan,
      mode: "external-shell-bridge-stub" as const,
      bridgeStatus: "stub" as const,
      strategy,
      ...evidence,
      summary: `已生成 ${executionPlan.backend} 的 execution backend bridge stub，可由外部后端按 shell plan 接管 ${executionPlan.invocation.commandType}。`,
      executionResult: null
    };
  }

  const executionResult = await executeBridgeShellPlan(executionPlan.execution);
  const bridgeStatus = executionResult.ok ? ("executed" as const) : ("failed" as const);
  const evidence = buildExecutionBackendBridgeEvidence({
    backend: executionPlan.backend,
    provider: executionPlan.provider,
    commandPreview: executionPlan.execution.commandPreview,
    bridgeStatus,
    executionSummary: executionResult.summary
  });

  return {
    ...executionPlan,
    status: executionResult.ok ? ("executed" as const) : ("blocked" as const),
    mode: "external-shell-bridge" as const,
    bridgeStatus,
    strategy,
    ...evidence,
    summary: executionResult.ok
      ? `已通过本地 shell bridge 执行 ${executionPlan.backend} 的 ${executionPlan.invocation.commandType}。`
      : executionResult.summary,
    executionResult
  };
}

export async function writebackExecutionBackendBridgeRunForAI(
  input: WritebackExecutionBackendBridgeRunInput,
  dbPath?: string
) {
  const bridge = await bridgeExecutionBackendDispatchForAI(input, dbPath);
  const snapshot = loadDashboardSnapshot(dbPath);
  const normalizedRunId =
    input.runId?.trim() ||
    `run-bridge-${bridge.sourceKind}-${bridge.sourceId}-${Date.now().toString(36)}`;
  const normalizedTitle =
    input.title?.trim() ||
    `${bridge.backend} Bridge · ${bridge.retryCommandLabel || bridge.taskPackLabel || bridge.sourceId}`;
  const normalizedExecutor = input.executor?.trim() || `${bridge.backend} Bridge`;
  const normalizedCost = input.cost?.trim() || "$0.00";
  const isBlocked = bridge.status === "blocked";
  const artifacts =
    bridge.bridgeStatus === "executed"
      ? buildExecutionBackendBridgeArtifacts(snapshot, bridge.invocation).map((artifact) =>
          upsertProjectArtifact(
            {
              projectId: bridge.projectId ?? "",
              type: artifact.type,
              title: artifact.title,
              ownerAgentId: artifact.ownerAgentId,
              status: artifact.status
            },
            dbPath
          )
        )
      : [];

  if (bridge.bridgeStatus === "executed" && bridge.projectId && bridge.invocation.commandType === "prd.generate") {
    movePrdExecutionToTaskpackStage(snapshot, bridge.projectId, bridge, dbPath);
  }

  if (bridge.bridgeStatus === "executed" && bridge.projectId && bridge.invocation.commandType === "review.run") {
    moveReviewExecutionToQaHandoff(snapshot, bridge.projectId, dbPath);
  }

  if (bridge.bridgeStatus === "executed" && bridge.projectId && bridge.invocation.commandType === "gate.run") {
    moveQaExecutionToReleaseCandidate(snapshot, bridge.projectId, dbPath);
  }

  if (
    bridge.bridgeStatus === "executed" &&
    bridge.projectId &&
    bridge.invocation.commandType === "release.prepare"
  ) {
    moveReleaseExecutionToApproval(bridge.projectId, dbPath);
  }

  if (
    bridge.bridgeStatus === "executed" &&
    bridge.projectId &&
    bridge.invocation.commandType === "archive.capture"
  ) {
    finalizeArchiveExecution(bridge.projectId, dbPath);
  }

  if (
    bridge.bridgeStatus === "executed" &&
    bridge.projectId &&
    bridge.invocation.commandType === "execution.start"
  ) {
    finalizeExecutionBridgeWriteback(bridge.projectId, dbPath);
  }

  const auditSnapshot = loadDashboardSnapshot(dbPath);
  const bridgeCommandType = bridge.invocation.commandType;
  const shouldAuditBridgeCommand =
    bridge.projectId &&
    bridge.retryCommandId &&
    (bridgeCommandType === "prd.generate" ||
      bridgeCommandType === "review.run" ||
      bridgeCommandType === "gate.run" ||
      bridgeCommandType === "release.prepare" ||
      bridgeCommandType === "archive.capture");
  const matchedRetryCommandExecution =
    shouldAuditBridgeCommand
      ? [...auditSnapshot.commandExecutions]
          .filter(
            (item) =>
              item.projectId === bridge.projectId &&
              item.commandId === bridge.retryCommandId &&
              (bridge.sourceKind === "project-handoff"
                ? true
                : item.followUpTaskIds.includes(bridge.sourceId))
          )
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null
      : null;
  const bridgeCommandExecutionId =
    shouldAuditBridgeCommand
      ? matchedRetryCommandExecution?.id ??
        (bridge.sourceKind === "project-handoff" && bridge.retryCommandId
          ? buildExecutionId(bridge.retryCommandId)
          : null)
      : null;
  const commandExecution =
    shouldAuditBridgeCommand && bridgeCommandExecutionId
      ? recordCommandExecutionForAI(
          {
            id: bridgeCommandExecutionId,
            commandId: bridge.retryCommandId ?? "",
            projectId: bridge.projectId ?? undefined,
            taskPackId: bridge.taskPackId ?? undefined,
            relatedRunId: normalizedRunId,
            status: bridge.bridgeStatus === "executed" ? "done" : "blocked",
            summary:
              bridge.bridgeStatus === "executed"
                ? bridgeCommandType === "prd.generate"
                  ? `已通过 ${bridge.backend} Bridge 完成需求确认与 PRD 生成，项目进入方案与任务包。`
                  : bridgeCommandType === "review.run"
                  ? `已通过 ${bridge.backend} Bridge 完成规则审查，项目移交 QA。`
                  : bridgeCommandType === "gate.run"
                    ? `已通过 ${bridge.backend} Bridge 完成测试门禁，项目进入放行候选。`
                    : bridgeCommandType === "release.prepare"
                      ? `已通过 ${bridge.backend} Bridge 完成交付说明整理，等待负责人确认。`
                      : `已通过 ${bridge.backend} Bridge 完成归档沉淀，知识卡与审计记录已回写。`
                : bridge.summary,
            triggeredBy: input.triggeredBy?.trim() || `${bridge.backend} Bridge`,
            followUpTaskIds:
              matchedRetryCommandExecution?.followUpTaskIds ??
              (bridge.sourceKind === "project-handoff" ? [] : [bridge.sourceId]),
            decisions: [
              {
                id: buildDecisionId(bridgeCommandExecutionId, "before-run"),
                hookId: "hook-before-run",
                outcome: bridge.bridgeStatus === "executed" ? "pass" : "block",
                summary:
                  bridge.bridgeStatus === "executed"
                    ? bridgeCommandType === "prd.generate"
                      ? "项目处于需求确认阶段，允许通过 CEO 总控执行桥生成 PRD。"
                      : bridgeCommandType === "review.run"
                      ? "项目已进入 review-handoff，允许通过外部执行桥发起规则审查。"
                      : bridgeCommandType === "gate.run"
                        ? "项目已进入 qa-handoff，允许通过外部执行桥发起测试门禁。"
                        : bridgeCommandType === "release.prepare"
                          ? "项目已进入 release-candidate，允许通过外部执行桥整理交付说明。"
                          : "项目已进入归档复用，允许通过外部执行桥沉淀知识卡与归档审计。"
                    : bridgeCommandType === "prd.generate"
                      ? "CEO 总控执行桥未能完成需求确认与 PRD 生成，当前命令保持阻断。"
                    : bridgeCommandType === "review.run"
                      ? "外部执行桥未能完成规则审查，当前命令保持阻断。"
                      : bridgeCommandType === "gate.run"
                        ? "外部执行桥未能完成测试门禁，当前命令保持阻断。"
                        : bridgeCommandType === "release.prepare"
                          ? "外部执行桥未能完成交付说明整理，当前命令保持阻断。"
                          : "外部执行桥未能完成归档沉淀，当前命令保持阻断。"
              }
            ]
          },
          dbPath
        ).execution
      : null;

  const result = upsertRunForAI(
    {
      id: normalizedRunId,
      projectId: bridge.projectId ?? undefined,
      taskPackId: bridge.taskPackId ?? undefined,
      linkedComponentIds: bridge.invocation.linkedComponentIds ?? [],
      title: normalizedTitle,
      executor: normalizedExecutor,
      cost: normalizedCost,
      state: isBlocked ? "blocked" : "done",
      failureCategory: isBlocked ? "unknown" : null,
      failureSummary: isBlocked ? bridge.summary : "",
      outputSummary: bridge.summary,
      outputMode: bridge.outputMode,
      outputChecks: bridge.outputChecks
    },
    dbPath
  );

  return {
    bridge,
    artifacts,
    commandExecution,
    ...result
  };
}

export function getRunnerRegistryForAI(dbPath?: string): {
  totalRunners: number;
  healthyCount: number;
  degradedCount: number;
  offlineCount: number;
  unifiedRemediationApiPath: string;
  runtimeSummary: ReturnType<typeof buildRuntimeSummary>;
  controlPlane: ReturnType<typeof buildControlPlaneSnapshot>;
  items: ForgeRunner[];
} {
  const snapshot = loadDashboardSnapshot(dbPath);

  return {
    totalRunners: snapshot.runners.length,
    healthyCount: snapshot.runners.filter((runner) => runner.probeStatus === "healthy").length,
    degradedCount: snapshot.runners.filter((runner) => runner.probeStatus === "degraded").length,
    offlineCount: snapshot.runners.filter((runner) => runner.probeStatus === "offline").length,
    ...buildControlPlaneMeta(snapshot, snapshot.activeProjectId ?? undefined),
    items: snapshot.runners
  };
}

export function getRunTimelineForAI(input: ListRunTimelineInput = {}, dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const timeline = listRunTimeline(
    {
      projectId: input.projectId?.trim() || undefined,
      runId: input.runId?.trim() || undefined
    },
    dbPath
  );

  const items = timeline.items.map((item) => ({
    ...item,
    evidenceStatus: getRunEvidenceStatus(item),
    evidenceLabel: getEvidenceLabel(getRunEvidenceStatus(item)),
    modelExecutionProvider: getRunModelExecutionProvider(item) || null,
    modelExecutionDetail: getRunModelExecutionDetail(item) || null,
    taskPackLabel: item.taskPackId
      ? snapshot.artifacts.find((artifact) => artifact.id === item.taskPackId)?.title ?? null
      : null,
    linkedComponentLabels: (item.linkedComponentIds ?? [])
      .map((componentId) => snapshot.components.find((component) => component.id === componentId)?.title)
      .filter((label): label is string => Boolean(label))
  }));

  return {
    ...timeline,
    items
  };
}

export function probeRunnersForAI(input: ProbeRunnersInput = {}, dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const executionBackends = buildExecutionBackendCoverage(snapshot);
  const nanoManager = getNanoManagerReadiness(executionBackends);

  if (input.runnerId) {
    const runnerId = requireText(input.runnerId, "Runner ID");
    const runner = snapshot.runners.find((item) => item.id === runnerId);

    if (!runner) {
      throw new ForgeApiError("Runner 不存在", "FORGE_NOT_FOUND", 404);
    }

    return {
      ...probeRunners({ runnerId }, dbPath),
      nanoManager
    };
  }

  return {
    ...probeRunners({}, dbPath),
    nanoManager
  };
}

export function updateRunnerHeartbeatForAI(input: UpdateRunnerHeartbeatInput, dbPath?: string) {
  const runnerId = requireText(input.runnerId, "Runner ID");
  const lastHeartbeat = requireText(input.lastHeartbeat, "心跳时间");
  const snapshot = loadDashboardSnapshot(dbPath);
  const runner = snapshot.runners.find((item) => item.id === runnerId);

  if (!runner) {
    throw new ForgeApiError("Runner 不存在", "FORGE_NOT_FOUND", 404);
  }

  if (input.currentRunId) {
    const runExists = snapshot.runs.some((item) => item.id === input.currentRunId);

    if (!runExists) {
      throw new ForgeApiError("运行记录不存在", "FORGE_NOT_FOUND", 404);
    }
  }

  return {
    runner: updateRunnerHeartbeat(
      {
        runnerId,
        status: input.status,
        currentRunId: input.currentRunId,
        lastHeartbeat
      },
      dbPath
    )
  };
}

export function upsertRunForAI(input: UpsertRunInput, dbPath?: string) {
  const id = requireText(input.id, "运行 ID");
  const title = requireText(input.title, "运行标题");
  const executor = requireText(input.executor, "执行器");
  const cost = requireText(input.cost, "成本");
  const snapshot = loadDashboardSnapshot(dbPath);

  if (input.projectId) {
    const project = snapshot.projects.find((item) => item.id === input.projectId);

    if (!project) {
      throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
    }
  }

  return {
    ...upsertRun(
      {
        id,
        projectId: input.projectId,
        taskPackId: input.taskPackId?.trim() || undefined,
        linkedComponentIds: input.linkedComponentIds ?? [],
        title,
        executor,
        cost,
        state: input.state,
        failureCategory: input.failureCategory ?? null,
        failureSummary: input.failureSummary,
        outputSummary: input.outputSummary,
        outputMode: input.outputMode ?? null,
        outputChecks: input.outputChecks ?? []
      },
      dbPath
    )
  };
}

export function getProjectTemplatesForAI(dbPath?: string): {
  total: number;
  items: ForgeProjectTemplate[];
} {
  const snapshot = loadDashboardSnapshot(dbPath);

  return {
    total: snapshot.projectTemplates.length,
    items: snapshot.projectTemplates
  };
}

export function getModelProviderSettingsForAI(dbPath?: string): {
  providers: ForgeModelProviderSetting[];
} {
  return {
    providers: getModelProviderSettings(dbPath)
  };
}

export function updateModelProviderSettingsForAI(
  input: ForgeModelProviderSettingsInput,
  dbPath?: string
): {
  provider: ForgeModelProviderSetting;
} {
  const providerId = requireModelProviderId(input.providerId, "模型供应商 ID");

  return {
    provider: updateModelProviderSettings(
      {
        providerId,
        enabled: input.enabled,
        apiKey: input.apiKey?.trim() || undefined,
        modelPriority: input.modelPriority
      },
      dbPath
    )
  };
}

function buildModelExecutionCheckSummary(modelExecution: ForgeCommandModelExecution) {
  if (modelExecution.status === "success") {
    return `${modelExecution.providerLabel} · ${modelExecution.model} · 来源 本机系统设置`;
  }

  return `${modelExecution.providerLabel} · ${modelExecution.model} · ${modelExecution.message}`;
}

function attachModelExecutionToRun<T extends { run?: ForgeDashboardSnapshot["runs"][number] }>(
  result: T,
  modelExecution: ForgeCommandModelExecution,
  dbPath?: string
) {
  if (!result.run?.id) {
    return result;
  }

  const nextRun = upsertRunForAI(
    {
      ...result.run,
      outputChecks: [
        ...(result.run.outputChecks ?? []).filter((check) => check.name !== "model-execution"),
        {
          name: "model-execution",
          status: modelExecution.status === "success" ? "pass" : "fail",
          summary: buildModelExecutionCheckSummary(modelExecution)
        }
      ]
    },
    dbPath
  ).run;

  return {
    ...result,
    run: nextRun
  };
}

export async function executeCommandWithModelForAI(input: ExecuteCommandInput, dbPath?: string) {
  const result = executeCommandForAI(input, dbPath) as {
    command?: ForgeCommand;
    project?: ForgeProject;
    execution?: { summary?: string };
    run?: ForgeDashboardSnapshot["runs"][number];
  };
  const selectedModel = input.selectedModel?.trim();

  if (!selectedModel) {
    return result;
  }

  const provider = resolveModelGatewaySelection(selectedModel, getModelProviderSettings(dbPath));

  if (!provider) {
    return result;
  }

  const modelExecutionBase = {
    providerId: provider.providerId,
    providerLabel: provider.providerLabel,
    model: provider.model,
    summary: `${provider.providerLabel} · ${provider.model}`
  } satisfies Omit<ForgeCommandModelExecution, "status" | "message">;
  const apiKey = getModelProviderSecret(provider.providerId, dbPath);

  if (!apiKey) {
    const modelExecution: ForgeCommandModelExecution = {
      ...modelExecutionBase,
      status: "error",
      message: `${provider.providerLabel} 尚未在本机配置可用密钥。`
    };

    return {
      ...attachModelExecutionToRun(result, modelExecution, dbPath),
      modelExecution
    };
  }

  const snapshot = loadDashboardSnapshot(dbPath);
  const ownerAgent =
    result.command?.type && result.project?.id
      ? getProjectWorkbenchAgentForCommand(
          snapshot,
          result.project.id,
          result.command.type
        )
      : null;
  const agentContext =
    result.project?.id && result.command?.type
      ? resolveWorkbenchAgentContext(snapshot, result.project.id, result.command.type)
      : null;
  const reply = await generateModelGatewayReply({
    providerId: provider.providerId,
    apiKey,
    model: provider.model,
    projectName: result.project?.name ?? input.projectId?.trim() ?? "当前项目",
    commandName: result.command?.name ?? input.commandId.trim(),
    commandType: result.command?.type ?? "unknown",
    executionSummary: result.execution?.summary?.trim() ?? "",
    prompt: input.extraNotes?.trim() ?? "",
    thinkingBudget: input.thinkingBudget?.trim(),
    agentName: ownerAgent?.name,
    agentPersona: ownerAgent?.persona,
    agentSystemPrompt: ownerAgent?.systemPrompt,
    agentKnowledgeSources: ownerAgent?.knowledgeSources,
    agentOwnerMode: ownerAgent?.ownerMode,
    agentContext
  });
  const modelExecution: ForgeCommandModelExecution = {
    ...modelExecutionBase,
    status: reply.status,
    message: reply.message,
    content: reply.content,
    tokenUsage: reply.tokenUsage ?? null
  };

  return {
    ...attachModelExecutionToRun(result, modelExecution, dbPath),
    modelExecution
  };
}

export async function generateWorkbenchChatReplyForAI(
  input: WorkbenchChatInput,
  dbPath?: string
): Promise<{
  modelExecution: ForgeCommandModelExecution;
}> {
  const prompt = requireText(input.prompt, "聊天内容");
  const selectedModel = requireText(input.selectedModel ?? "", "模型");
  const provider = resolveModelGatewaySelection(selectedModel, getModelProviderSettings(dbPath));

  if (!provider) {
    throw new ForgeApiError(
      "当前选择的模型尚未在本机启用，请先到系统设置完成配置。",
      "FORGE_VALIDATION_ERROR",
      400
    );
  }

  const modelExecutionBase = {
    providerId: provider.providerId,
    providerLabel: provider.providerLabel,
    model: provider.model,
    summary: `${provider.providerLabel} · ${provider.model}`
  } satisfies Omit<ForgeCommandModelExecution, "status" | "message">;
  const apiKey = getModelProviderSecret(provider.providerId, dbPath);

  if (!apiKey) {
    return {
      modelExecution: {
        ...modelExecutionBase,
        status: "error",
        message: `${provider.providerLabel} 尚未在本机配置可用密钥。`
      }
    };
  }

  const projectId = input.projectId?.trim();
  const snapshot = loadDashboardSnapshot(dbPath);
  const project =
    snapshot.projects.find((item) => item.id === projectId) ??
    (projectId ? null : getActiveProject(snapshot)) ??
    null;
  const requestedWorkbenchNode = input.workbenchNode?.trim() ?? "";
  const workbenchNode: ForgeProjectWorkbenchNode | null = isProjectWorkbenchNode(
    requestedWorkbenchNode
  )
    ? requestedWorkbenchNode
    : null;
  const ownerAgent =
    project && workbenchNode ? getProjectWorkbenchAgent(snapshot, project.id, workbenchNode) : null;
  const agentContext =
    project?.id && workbenchNode
      ? resolveWorkbenchAgentContext(snapshot, project.id, workbenchNode)
      : null;
  const reply = await generateModelGatewayChatReply({
    providerId: provider.providerId,
    apiKey,
    model: provider.model,
    projectName: project?.name ?? projectId ?? "当前项目",
    prompt,
    workbenchNode: workbenchNode ?? undefined,
    thinkingBudget: input.thinkingBudget?.trim(),
    agentName: ownerAgent?.name,
    agentPersona: ownerAgent?.persona,
    agentSystemPrompt: ownerAgent?.systemPrompt,
    agentKnowledgeSources: ownerAgent?.knowledgeSources,
    agentOwnerMode: ownerAgent?.ownerMode,
    agentContext
  });

  return {
    modelExecution: {
      ...modelExecutionBase,
      status: reply.status,
      message: reply.message,
      content: reply.content,
      tokenUsage: reply.tokenUsage ?? null
    }
  };
}

export async function testModelProviderConnectionForAI(
  input: TestModelProviderConnectionInput,
  dbPath?: string
): Promise<{
  provider: ForgeModelProviderSetting;
  connection: ForgeModelProviderConnectionResult;
}> {
  const providerId = requireModelProviderId(input.providerId, "模型供应商 ID");
  const provider =
    getModelProviderSettings(dbPath).find((item) => item.id === providerId) ?? null;
  const apiKey = input.apiKey?.trim() || getModelProviderSecret(providerId, dbPath) || "";

  if (!apiKey) {
    throw new ForgeApiError("请先输入并保存 API 密钥", "FORGE_VALIDATION_ERROR", 400);
  }

  const model =
    input.model?.trim() ||
    provider?.modelPriority[0] ||
    getModelGatewayProviderDefinition(providerId).defaultModelPriority[0];
  const testedAt = new Date().toISOString();
  const result = await testModelGatewayConnection({
    providerId,
    apiKey,
    model
  });
  if (result.status === "success") {
    updateModelProviderSettingsForAI(
      {
        providerId,
        enabled: true,
        apiKey: input.apiKey?.trim() || undefined,
        modelPriority: provider?.modelPriority?.length ? provider.modelPriority : [model]
      },
      dbPath
    );
  }
  const nextProvider = recordModelProviderConnectionResult(
    providerId,
    {
      status: result.status,
      testedAt,
      message: result.message
    },
    dbPath
  );

  return {
    provider: nextProvider,
    connection: {
      providerId,
      providerLabel: nextProvider.label,
      model,
      status: result.status,
      testedAt,
      message: result.message
    }
  };
}

export function listTasksForAI(options: ListTasksInput = {}, dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const items = snapshot.tasks.filter((task) => {
    const matchesProject = options.projectId ? task.projectId === options.projectId : true;
    const matchesStatus = options.status ? task.status === options.status : true;

    return matchesProject && matchesStatus;
  });
  const enrichedItems = getTaskDispatchQueue(snapshot)
    .filter((item) => {
      const matchesProject = options.projectId ? item.task.projectId === options.projectId : true;
      const matchesStatus = options.status ? item.task.status === options.status : true;

      return matchesProject && matchesStatus;
    })
    .map((item) => {
      const runtimeExecutionBackendInvocation = buildExecutionBackendInvocation(snapshot, {
        projectId: item.task.projectId,
        taskPackId: item.taskPackId ?? null,
        linkedComponentIds: item.linkedComponentIds ?? [],
        commandId: item.retryCommandId ?? null
      });

      return {
        ...item.task,
        sourceCommandExecutionId: item.sourceCommandExecutionId,
        sourceCommandLabel: item.sourceCommandLabel ?? null,
        sourceCommandAction: item.sourceCommandAction,
        relatedArtifactLabels: item.relatedArtifactLabels,
        missingArtifactLabels: item.missingArtifactLabels,
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
        runtimeExecutionBackendInvocation,
        runtimeExecutionBackendCommandPreview:
          runtimeExecutionBackendInvocation?.commandPreview ?? null,
        runtimeCapabilityDetails: item.runtimeCapabilityDetails,
        remediationOwnerLabel: item.remediationOwnerLabel,
        remediationSummary: item.remediationSummary,
        remediationAction: item.remediationAction,
        retryCommandId: item.retryCommandId,
        retryCommandLabel: item.retryCommandLabel,
        retryApiPath: item.task.id.includes("escalation")
          ? "/api/forge/escalations/retry"
          : "/api/forge/tasks/retry",
        unifiedRetryApiPath: item.unifiedRetryApiPath,
        retryRunnerArgs: item.retryRunnerArgs,
        retryRunnerCommand: item.retryRunnerCommand,
        unifiedRetryRunnerArgs: item.unifiedRetryRunnerArgs,
        unifiedRetryRunnerCommand: item.unifiedRetryRunnerCommand
      };
    });

  return {
    ...buildControlPlaneMeta(snapshot, options.projectId),
    total: items.length,
    items: enrichedItems,
    summary: buildTaskControlCenterSummary(snapshot, items)
  };
}

export function updateAgentProfileForAI(input: UpdateAgentProfileInput, dbPath?: string) {
  const agentId = requireText(input.agentId, "Agent ID");
  const promptTemplateId = requireText(input.promptTemplateId, "Prompt 模板 ID");
  const systemPrompt = requireText(input.systemPrompt, "岗位提示词");
  const snapshot = loadDashboardSnapshot(dbPath);
  const agent = snapshot.agents.find((item) => item.id === agentId);

  if (!agent) {
    throw new ForgeApiError("Agent 不存在", "FORGE_NOT_FOUND", 404);
  }

  const ownerMode =
    input.ownerMode === undefined
      ? agent.ownerMode
      : requireAgentOwnerMode(input.ownerMode, "运行方式");
  const name = typeof input.name === "string" ? requireText(input.name, "员工名称") : agent.name;
  const role = input.role === undefined ? agent.role : requireAgentRole(input.role, "员工角色");
  const runnerId =
    typeof input.runnerId === "string" ? requireText(input.runnerId, "Runner ID") : agent.runnerId;
  const departmentLabel =
    typeof input.departmentLabel === "string"
      ? requireText(input.departmentLabel, "所属部门")
      : agent.departmentLabel ?? "";
  const persona = typeof input.persona === "string" ? input.persona.trim() : agent.persona;
  const policyId = typeof input.policyId === "string" ? input.policyId.trim() : agent.policyId;
  const permissionProfileId =
    typeof input.permissionProfileId === "string"
      ? input.permissionProfileId.trim()
      : agent.permissionProfileId;
  const skillIds =
    input.skillIds === undefined ? agent.skillIds : requireTextList(input.skillIds, "技能包");
  const knowledgeSources = requireTextList(input.knowledgeSources, "知识来源");

  const promptTemplate = snapshot.promptTemplates.find((item) => item.id === promptTemplateId);

  if (!promptTemplate) {
    throw new ForgeApiError("Prompt 模板不存在", "FORGE_NOT_FOUND", 404);
  }

  return {
    agent: updateAgentProfile(
      {
        agentId,
        name,
        role,
        runnerId,
        departmentLabel,
        ownerMode,
        persona,
        policyId,
        permissionProfileId,
        promptTemplateId,
        skillIds,
        systemPrompt,
        knowledgeSources
      },
      dbPath
    )
  };
}

export function getWorkflowStatesForAI(dbPath?: string) {
  const snapshot = loadDashboardSnapshot(dbPath);

  return {
    total: snapshot.workflowStates.length,
    items: snapshot.workflowStates,
    transitions: snapshot.workflowTransitions
  };
}

export function updateProjectWorkflowStateForAI(input: UpdateProjectWorkflowStateInput, dbPath?: string) {
  const projectId = requireText(input.projectId, "项目 ID");
  const updatedBy = requireText(input.updatedBy, "更新人");
  const snapshot = loadDashboardSnapshot(dbPath);
  const project = snapshot.projects.find((item) => item.id === projectId);

  if (!project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  return {
    workflow: updateProjectWorkflowState(
      {
        projectId,
        currentStage: input.currentStage,
        state: input.state,
        blockers: requireTextList(input.blockers, "阻塞项"),
        updatedBy
      },
      dbPath
    )
  };
}

export function generatePrdDraftForAI(input: GeneratePrdDraftInput, dbPath?: string): {
  activeProjectId: string;
  document: ForgePrdDocument;
  template: ForgePromptTemplate;
} {
  const projectId = requireText(input.projectId, "项目 ID");
  const templateId = requireText(input.templateId, "Prompt 模板 ID");
  const snapshot = loadDashboardSnapshot(dbPath);
  const project = snapshot.projects.find((item) => item.id === projectId);
  const template = snapshot.promptTemplates.find((item) => item.id === templateId);

  if (!project) {
    throw new ForgeApiError("项目不存在", "FORGE_NOT_FOUND", 404);
  }

  if (!template) {
    throw new ForgeApiError("Prompt 模板不存在", "FORGE_NOT_FOUND", 404);
  }

  const document = generatePrdDraft(
    {
      projectId,
      templateId,
      extraNotes: input.extraNotes?.trim() ?? ""
    },
    dbPath
  );

  return {
    activeProjectId: projectId,
    document,
    template
  };
}
