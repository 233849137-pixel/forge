import { accessSync, constants, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";
import {
  agents,
  artifacts,
  artifactReviews,
  assets,
  components,
  deliveryGate,
  prdDocuments,
  projectAssetLinks,
  projects,
  projectTemplates,
  promptTemplates,
  skills,
  sops,
  tasks,
  commands,
  commandHooks,
  commandExecutions,
  teamTemplates,
  policyDecisions,
  runners,
  workflowTransitions,
  runEvents,
  workflowStates,
  runs
} from "../../../src/data/mock-data";
import { seedProjectTemplateMap } from "../../../src/data/mock-data";
import {
  defaultTeamWorkbenchDepartmentByRole,
  defaultTeamWorkbenchDepartmentOrder,
  defaultTeamWorkbenchPackRefsByRole,
  defaultTeamWorkbenchPrimaryAgentId,
  defaultTeamWorkbenchRoleAssignments,
  defaultTeamWorkbenchManagedAgentIds,
  sortTeamWorkbenchAgents,
  sortTeamWorkbenchOrgMembers,
  defaultTeamWorkbenchTemplates,
  defaultTeamWorkbenchSelectedTemplateId
} from "../../../src/lib/forge-team-defaults";
import type {
  DeliveryGateItem,
  ForgeAgent,
  ForgeArtifact,
  ForgeArtifactReview,
  ForgeDashboardSnapshot,
  ForgeEquippedPackRef,
  ForgeProjectAssetLink,
  ForgeProject,
  ForgeProjectWorkbenchDocument,
  ForgeProjectWorkbenchMessage,
  ForgeProjectWorkbenchNode,
  ForgeProjectWorkbenchNodeState,
  ForgeProjectWorkbenchProjectState,
  ForgeProjectWorkbenchState,
  ForgeProjectWorkbenchWorkspaceViewState,
  ForgePrdDocument,
  ForgeProjectDraft,
  ForgeProjectProfile,
  ForgeProjectTemplate,
  ForgeProjectWorkflowState,
  ForgeRun,
  ForgeRunEvent,
  ForgeRunFailureCategory,
  ForgeRunOutputCheck,
  ForgeWorkflowTransition,
  ForgePromptTemplate,
  ForgeRunnerProbeStatus,
  ForgeRunner,
  ForgeRunnerCapabilityDetail,
  ForgeModelProviderConnectionStatus,
  ForgeModelProviderId,
  ForgeModelProviderSetting,
  ForgeModelProviderSettingsInput,
  ForgeOrgChartMember,
  ForgeOrgDepartment,
  ForgeSkill,
  ForgeSop,
  ForgeTask,
  ForgeTeamWorkbenchState,
  ForgeTokenUsage,
  ForgeCommand,
  ForgeCommandHook,
  ForgeCommandExecution,
  ForgeComponent,
  ForgeCommandExecutionStatus,
  ForgeTeamTemplate,
  ForgePolicyDecision,
  ForgePolicyDecisionOutcome
} from "../../core/src/types";
import {
  getModelGatewayProviderCatalog,
  getModelGatewayProviderDefinition
} from "../../model-gateway/src";

export type ForgeDataMode = "auto" | "demo" | "local";
export type ForgeResolvedDataSource = {
  dataMode: "demo" | "local";
  dataModeLabel: "示例模式" | "本地模式";
  dataModeSummary: string;
};

const DEFAULT_DATA_DIRECTORY = "data";
const DEFAULT_LOCAL_DB_FILENAME = "forge.db";
const DEFAULT_DEMO_DB_FILENAME = "forge-demo.db";

function normalizeForgeDataMode(value?: string | null): ForgeDataMode {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "demo" || normalized === "local") {
    return normalized;
  }

  return "auto";
}

function getForgeDefaultDbPaths() {
  const dataDirectory = join(process.cwd(), DEFAULT_DATA_DIRECTORY);

  return {
    local: join(dataDirectory, DEFAULT_LOCAL_DB_FILENAME),
    demo: join(dataDirectory, DEFAULT_DEMO_DB_FILENAME)
  };
}

export function getForgeResolvedDataSource(dbPath?: string): ForgeResolvedDataSource {
  const resolvedPath = resolveForgeDbPath(dbPath);
  const defaultPaths = getForgeDefaultDbPaths();
  const isDemoDataSource = resolvedPath === defaultPaths.demo;

  if (isDemoDataSource) {
    return {
      dataMode: "demo",
      dataModeLabel: "示例模式",
      dataModeSummary: "当前展示仓库内置示例数据，适合首次体验、公开演示和开源预览。"
    };
  }

  return {
    dataMode: "local",
    dataModeLabel: "本地模式",
    dataModeSummary: "当前展示本地项目数据，页面内容会反映你自己的真实项目与工作台状态。"
  };
}

export function resolveForgeDbPath(dbPath?: string) {
  if (dbPath) {
    return dbPath;
  }

  const explicitEnvPath = process.env.FORGE_DB_PATH?.trim();
  if (explicitEnvPath) {
    return explicitEnvPath;
  }

  const mode = normalizeForgeDataMode(process.env.FORGE_DATA_MODE);
  const defaultPaths = getForgeDefaultDbPaths();

  if (mode === "local") {
    return defaultPaths.local;
  }

  if (mode === "demo") {
    return defaultPaths.demo;
  }

  return existsSync(defaultPaths.local) ? defaultPaths.local : defaultPaths.demo;
}

function resolveDbPath(dbPath?: string) {
  return resolveForgeDbPath(dbPath);
}

function openDatabase(dbPath?: string) {
  const resolvedPath = resolveDbPath(dbPath);

  mkdirSync(dirname(resolvedPath), { recursive: true });

  return new Database(resolvedPath);
}

function resolveWorkspaceRoot(dbPath?: string) {
  return join(dirname(resolveDbPath(dbPath)), "workspaces");
}

type ForgeDb = InstanceType<typeof Database>;

type PromptTemplateRow = {
  id: string;
  title: string;
  scenario: string;
  summary: string;
  template: string;
  variablesJson: string;
  version: string;
  useCount: number;
  lastUsedAt: string | null;
};

type PrdDocumentRow = {
  id: string;
  projectId: string;
  templateId: string;
  title: string;
  content: string;
  status: "draft" | "ready";
  createdAt: string;
};

type ProjectTemplateRow = {
  id: string;
  title: string;
  sector: string;
  summary: string;
  dnaSummary: string;
  defaultPromptIdsJson: string;
  defaultGateIdsJson: string;
  constraintsJson: string;
};

type ComponentRow = {
  id: string;
  title: string;
  category: ForgeComponent["category"];
  summary: string;
  sourceType: ForgeComponent["sourceType"];
  sourceRef: string;
  tagsJson: string;
  recommendedSectorsJson: string;
  usageGuide: string;
  assemblyContractJson?: string | null;
};

type ProjectProfileRow = {
  projectId: string;
  templateId: string;
  templateTitle: string;
  teamTemplateId?: string | null;
  teamTemplateTitle?: string | null;
  workspacePath: string;
  dnaSummary: string;
  defaultPromptIdsJson: string;
  defaultGateIdsJson: string;
  constraintsJson: string;
  initializedAt: string;
};

type ProjectWorkflowStateRow = {
  projectId: string;
  currentStage: ForgeProjectWorkflowState["currentStage"];
  state: ForgeProjectWorkflowState["state"];
  blockersJson: string;
  lastTransitionAt: string;
  updatedBy: string;
};

type WorkflowTransitionRow = {
  id: string;
  projectId: string;
  stage: ForgeWorkflowTransition["stage"];
  state: ForgeWorkflowTransition["state"];
  updatedBy: string;
  blockersJson: string;
  createdAt: string;
};

type AgentRow = {
  id: string;
  name: string;
  role: ForgeAgent["role"];
  runnerId: string;
  departmentLabel: string;
  persona: string;
  systemPrompt: string;
  responsibilitiesJson: string;
  skillIdsJson: string;
  sopIdsJson: string;
  knowledgeSourcesJson: string;
  promptTemplateId: string;
  policyId: string;
  permissionProfileId: string;
  ownerMode: ForgeAgent["ownerMode"];
};

type SkillRow = {
  id: string;
  name: string;
  category: ForgeSkill["category"];
  ownerRole: ForgeSkill["ownerRole"];
  summary: string;
  usageGuide: string;
};

type SopRow = {
  id: string;
  name: string;
  stage: ForgeSop["stage"];
  ownerRole: ForgeSop["ownerRole"];
  summary: string;
  checklistJson: string;
};

type TeamTemplateRow = {
  id: string;
  name: string;
  summary: string;
  agentIdsJson: string;
  leadAgentId: string;
};

type ArtifactRow = {
  id: string;
  projectId: string;
  type: ForgeArtifact["type"];
  title: string;
  ownerAgentId: string;
  status: ForgeArtifact["status"];
  updatedAt: string;
};

type ArtifactReviewRow = {
  id: string;
  artifactId: string;
  reviewerAgentId: string;
  decision: ForgeArtifactReview["decision"];
  summary: string;
  conditionsJson: string;
  reviewedAt: string;
};

type TaskRow = {
  id: string;
  projectId: string;
  stage: ForgeTask["stage"];
  title: string;
  ownerAgentId: string;
  status: ForgeTask["status"];
  priority: ForgeTask["priority"];
  category: ForgeTask["category"];
  summary: string;
};

type CommandRow = {
  id: string;
  name: string;
  type: ForgeCommand["type"];
  summary: string;
  triggerStage: ForgeCommand["triggerStage"];
  requiresArtifactsJson: string;
};

type CommandHookRow = {
  id: string;
  name: ForgeCommandHook["name"];
  summary: string;
  policy: string;
};

type CommandExecutionRow = {
  id: string;
  commandId: string;
  projectId: string | null;
  taskPackId: string | null;
  relatedRunId: string | null;
  status: ForgeCommandExecutionStatus;
  summary: string;
  triggeredBy: string;
  createdAt: string;
  followUpTaskIdsJson: string;
};

type PolicyDecisionRow = {
  id: string;
  hookId: string;
  commandExecutionId: string;
  outcome: ForgePolicyDecisionOutcome;
  summary: string;
  createdAt: string;
};

type RunnerRow = {
  id: string;
  name: string;
  status: ForgeRunner["status"];
  summary: string;
  workspacePath: string;
  capabilitiesJson: string;
  detectedCapabilitiesJson: string;
  detectedCapabilityDetailsJson: string;
  probeStatus: ForgeRunner["probeStatus"];
  probeSummary: string;
  currentRunId: string | null;
  lastHeartbeat: string;
  lastProbeAt: string | null;
};

type RunEventRow = {
  id: string;
  runId: string;
  projectId: string | null;
  type: ForgeRunEvent["type"];
  summary: string;
  failureCategory: ForgeRunFailureCategory | null;
  createdAt: string;
};

type RunRow = {
  id: string;
  projectId: string | null;
  taskPackId: string | null;
  linkedComponentIdsJson: string;
  title: string;
  executor: string;
  cost: string;
  state: ForgeRun["state"];
  outputMode: string | null;
  outputChecksJson: string;
};

type ProjectAssetLinkRow = {
  id: string;
  projectId: string;
  targetType: ForgeProjectAssetLink["targetType"];
  targetId: string;
  relation: ForgeProjectAssetLink["relation"];
  reason: string;
  usageGuide: string;
};

type GeneratePrdDraftInput = {
  projectId: string;
  templateId: string;
  extraNotes?: string;
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

type UpsertProjectComponentLinkInput = {
  projectId: string;
  componentId: string;
  relation?: ForgeProjectAssetLink["relation"];
  reason: string;
  usageGuide: string;
};

type UpdateProjectOverviewInput = {
  projectId: string;
  status?: ForgeProject["status"];
  lastRun?: string;
  progress?: number;
  riskNote?: string;
};

type UpdateProjectDetailsInput = {
  projectId: string;
  requirement?: string;
  enterpriseName?: string;
  name?: string;
  sector?: string;
  projectType?: string;
  owner?: string;
  deliveryDate?: string;
  note?: string;
  teamTemplateId?: string;
};

type UpdateDeliveryGateStatusInput = {
  id: string;
  status: DeliveryGateItem["status"];
};

type UpdateProjectWorkflowStateInput = {
  projectId: string;
  currentStage: ForgeProjectWorkflowState["currentStage"];
  state: ForgeProjectWorkflowState["state"];
  blockers: string[];
  updatedBy: string;
};

type UpsertProjectArtifactInput = {
  projectId: string;
  type: ForgeArtifact["type"];
  title: string;
  ownerAgentId: string;
  status: ForgeArtifact["status"];
  updatedAt?: string;
};

type UpsertArtifactReviewInput = {
  artifactId: string;
  reviewerAgentId: string;
  decision: ForgeArtifactReview["decision"];
  summary: string;
  conditions: string[];
  reviewedAt?: string;
};

type UpdateProjectTasksInput = {
  projectId: string;
  taskId?: string;
  titleIncludes?: string;
  stage?: ForgeTask["stage"];
  status: ForgeTask["status"];
  summary?: string;
};

type UpsertProjectTaskInput = {
  id: string;
  projectId: string;
  stage: ForgeTask["stage"];
  title: string;
  ownerAgentId: string;
  status: ForgeTask["status"];
  priority: ForgeTask["priority"];
  category: ForgeTask["category"];
  summary: string;
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
  projectId?: string | null;
  taskPackId?: string | null;
  linkedComponentIds?: string[];
  title: string;
  executor: string;
  cost: string;
  state: ForgeRun["state"];
  failureCategory?: ForgeRunFailureCategory | null;
  failureSummary?: string;
  outputSummary?: string;
  outputMode?: string | null;
  outputChecks?: ForgeRunOutputCheck[];
};

type RecordPolicyDecisionInput = {
  id: string;
  hookId: string;
  outcome: ForgePolicyDecisionOutcome;
  summary: string;
  createdAt?: string;
};

type RecordCommandExecutionInput = {
  id: string;
  commandId: string;
  projectId?: string | null;
  taskPackId?: string | null;
  relatedRunId?: string | null;
  status: ForgeCommandExecutionStatus;
  summary: string;
  triggeredBy: string;
  createdAt?: string;
  followUpTaskIds?: string[];
  decisions?: RecordPolicyDecisionInput[];
};

function ensureOptionalColumn(db: ForgeDb, tableName: string, columnName: string, columnSql: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;

  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
}

function toJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJsonArray(value: string) {
  return JSON.parse(value) as string[];
}

function parseJsonValue<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function fromJson<T>(value: string | null | undefined, fallback: T = [] as T): T {
  return parseJsonValue(value, fallback);
}

const modelProviderStateKey = "model_provider_settings";
const teamWorkbenchStateKey = "team_workbench_state";
const projectWorkbenchStateKey = "project_workbench_state";

function buildDefaultTeamWorkbenchState(): ForgeTeamWorkbenchState {
  const defaultManagedAgentIdSet = new Set<string>(defaultTeamWorkbenchManagedAgentIds);
  const managedAgents = sortTeamWorkbenchAgents(
    agents
      .filter((agent) => defaultManagedAgentIdSet.has(agent.id))
      .map((agent) => ({
      ...agent,
      departmentLabel: agent.departmentLabel ?? defaultTeamWorkbenchDepartmentByRole[agent.role]
      }))
  );

  const orgDepartments = defaultTeamWorkbenchDepartmentOrder.map((label) => ({ label }));
  const orgChartMembers = sortTeamWorkbenchOrgMembers(
    managedAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      departmentLabel: agent.departmentLabel ?? defaultTeamWorkbenchDepartmentByRole[agent.role]
    }))
  );

  return {
    managedAgents,
    selectedTemplateId: defaultTeamWorkbenchSelectedTemplateId,
    activeCategory: "organization",
    employeeDetailTab: "basic",
    abilityTemplateTab: "equipped",
    selectedAgentId: defaultTeamWorkbenchPrimaryAgentId ?? managedAgents[0]?.id ?? null,
    selectedBuilderRole: "pm",
    selectedPoolAgentId: defaultTeamWorkbenchPrimaryAgentId ?? managedAgents[0]?.id ?? null,
    selectedPoolDepartment: "全部",
    selectedManagementDepartment: "全部",
    selectedTemplateDepartment: "全部",
    selectedGovernanceDepartment: "全部",
    selectedAbilityLine: "全部",
    selectedRecommendedPackId: null,
    selectedCustomPackId: null,
    isCurrentPackListCollapsed: false,
    roleAssignments: { ...defaultTeamWorkbenchRoleAssignments },
    manualSkillIdsByAgentId: Object.fromEntries(managedAgents.map((agent) => [agent.id, []])),
    manualKnowledgeSourcesByAgentId: Object.fromEntries(
      managedAgents.map((agent) => [agent.id, [...agent.knowledgeSources]])
    ),
    removedPackSkillIdsByAgentId: Object.fromEntries(managedAgents.map((agent) => [agent.id, {}])),
    equippedPackByAgentId: Object.fromEntries(
      managedAgents.map((agent) => [agent.id, defaultTeamWorkbenchPackRefsByRole[agent.role] ?? []])
    ),
    orgDepartments,
    orgChartMembers,
    customAbilityPacks: [],
    skillCatalogOverrides: {},
    hiddenSkillIds: [],
    governanceOverridesByAgentId: {}
  };
}

function applyTeamWorkbenchStateDefaults(
  state: ForgeTeamWorkbenchState
): ForgeTeamWorkbenchState {
  const defaults = buildDefaultTeamWorkbenchState();
  const availableTemplateIds = new Set(defaultTeamWorkbenchTemplates.map((template) => template.id));
  const managedAgents = sortTeamWorkbenchAgents(
    [
      ...state.managedAgents,
      ...defaults.managedAgents.filter(
        (defaultAgent) => !state.managedAgents.some((agent) => agent.id === defaultAgent.id)
      )
    ].map((agent) => ({
      ...agent,
      departmentLabel: agent.departmentLabel ?? defaultTeamWorkbenchDepartmentByRole[agent.role]
    }))
  );

  const orgDepartments =
    state.orgDepartments.length > 0
      ? state.orgDepartments
      : defaults.orgDepartments;

  const orgChartMembers = sortTeamWorkbenchOrgMembers([
    ...state.orgChartMembers,
    ...defaults.orgChartMembers.filter(
      (defaultMember) => !state.orgChartMembers.some((member) => member.id === defaultMember.id)
    )
  ]);

  const resolvedSelectedTemplateId =
    state.selectedTemplateId && availableTemplateIds.has(state.selectedTemplateId)
      ? state.selectedTemplateId
      : defaults.selectedTemplateId;
  const resolvedTemplate =
    defaultTeamWorkbenchTemplates.find((template) => template.id === resolvedSelectedTemplateId) ??
    defaultTeamWorkbenchTemplates[0];
  const resolvedTemplateAgentIds = new Set(resolvedTemplate?.agentIds ?? []);
  const templateSelectionReset = resolvedSelectedTemplateId !== state.selectedTemplateId;
  const hasAssignedRole = Object.values(state.roleAssignments).some(
    (value) => typeof value === "string" && value
  );
  const roleAssignments =
    !templateSelectionReset && hasAssignedRole
      ? state.roleAssignments
      : defaults.roleAssignments;
  const resolvedRoleAssignments = {
    ...roleAssignments
  };
  if (
    resolvedRoleAssignments.engineer === "agent-frontend" &&
    managedAgents.some((agent) => agent.id === "agent-engineer")
  ) {
    resolvedRoleAssignments.engineer = "agent-engineer";
  }
  const hasManagedAgent = (agentId: string | null | undefined) =>
    typeof agentId === "string" && managedAgents.some((agent) => agent.id === agentId);
  const hasTemplateAgent = (agentId: string | null | undefined) =>
    typeof agentId === "string" && resolvedTemplateAgentIds.has(agentId);
  const resolvedSelectedAgentId =
    !templateSelectionReset && hasTemplateAgent(state.selectedAgentId)
      ? state.selectedAgentId
      : resolvedTemplate?.leadAgentId ?? defaults.selectedAgentId;
  const resolvedSelectedPoolAgentId =
    !templateSelectionReset && hasManagedAgent(state.selectedPoolAgentId)
      ? state.selectedPoolAgentId
      : resolvedSelectedAgentId;

  return {
    managedAgents,
    selectedTemplateId: resolvedSelectedTemplateId,
    activeCategory: state.activeCategory ?? defaults.activeCategory,
    employeeDetailTab: state.employeeDetailTab ?? defaults.employeeDetailTab,
    abilityTemplateTab: state.abilityTemplateTab ?? defaults.abilityTemplateTab,
    selectedAgentId: resolvedSelectedAgentId,
    selectedBuilderRole: state.selectedBuilderRole ?? defaults.selectedBuilderRole,
    selectedPoolAgentId: resolvedSelectedPoolAgentId,
    selectedPoolDepartment: state.selectedPoolDepartment ?? defaults.selectedPoolDepartment,
    selectedManagementDepartment:
      state.selectedManagementDepartment ?? defaults.selectedManagementDepartment,
    selectedTemplateDepartment:
      state.selectedTemplateDepartment ?? defaults.selectedTemplateDepartment,
    selectedGovernanceDepartment:
      state.selectedGovernanceDepartment ?? defaults.selectedGovernanceDepartment,
    selectedAbilityLine: state.selectedAbilityLine ?? defaults.selectedAbilityLine,
    selectedRecommendedPackId:
      state.selectedRecommendedPackId ?? defaults.selectedRecommendedPackId,
    selectedCustomPackId: state.selectedCustomPackId ?? defaults.selectedCustomPackId,
    isCurrentPackListCollapsed:
      state.isCurrentPackListCollapsed ?? defaults.isCurrentPackListCollapsed,
    roleAssignments: resolvedRoleAssignments,
    manualSkillIdsByAgentId: Object.fromEntries(
      managedAgents.map((agent) => [agent.id, state.manualSkillIdsByAgentId[agent.id] ?? []])
    ),
    manualKnowledgeSourcesByAgentId: Object.fromEntries(
      managedAgents.map((agent) => [
        agent.id,
        state.manualKnowledgeSourcesByAgentId?.[agent.id] ?? [...agent.knowledgeSources]
      ])
    ),
    removedPackSkillIdsByAgentId: Object.fromEntries(
      managedAgents.map((agent) => [agent.id, state.removedPackSkillIdsByAgentId[agent.id] ?? {}])
    ),
    equippedPackByAgentId: Object.fromEntries(
      managedAgents.map((agent) => [
        agent.id,
        state.equippedPackByAgentId[agent.id] ??
          defaults.equippedPackByAgentId[agent.id] ??
          []
      ])
    ),
    orgDepartments,
    orgChartMembers,
    customAbilityPacks: state.customAbilityPacks,
    skillCatalogOverrides: state.skillCatalogOverrides ?? {},
    hiddenSkillIds: state.hiddenSkillIds ?? [],
    governanceOverridesByAgentId: Object.fromEntries(
      managedAgents.flatMap((agent) => {
        const overrides = state.governanceOverridesByAgentId?.[agent.id];
        return overrides ? [[agent.id, overrides]] : [];
      })
    )
  };
}

const forgeAgentRoles = [
  "pm",
  "architect",
  "design",
  "engineer",
  "qa",
  "release",
  "knowledge"
] as const;

const forgeTeamWorkbenchCategories = [
  "orgChart",
  "organization",
  "employees",
  "templates",
  "automation",
  "governance"
] as const;

const forgeTeamWorkbenchEmployeeTabs = ["basic", "ability", "runtime"] as const;

const forgeTeamWorkbenchAbilityTabs = ["equipped", "skills", "packs", "custom"] as const;

const forgeProjectWorkbenchNodes = [
  "需求确认",
  "项目原型",
  "UI设计",
  "后端研发",
  "DEMO测试",
  "内测调优",
  "交付发布"
] as const satisfies readonly ForgeProjectWorkbenchNode[];

function isEquippedPackRef(value: unknown): value is ForgeEquippedPackRef {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<ForgeEquippedPackRef>;
  return (
    (candidate.source === "preset" || candidate.source === "custom") &&
    typeof candidate.id === "string" &&
    candidate.id.trim().length > 0
  );
}

function normalizeWorkbenchManagedAgents(
  value: Partial<ForgeTeamWorkbenchState> | null | undefined
): ForgeAgent[] {
  if (!Array.isArray(value?.managedAgents)) {
    return [];
  }

  return value.managedAgents
    .filter(
      (agent): agent is ForgeAgent =>
        Boolean(
          agent &&
            typeof agent === "object" &&
            typeof agent.id === "string" &&
            agent.id.trim() &&
            typeof agent.name === "string" &&
            agent.name.trim() &&
            forgeAgentRoles.includes(agent.role) &&
            typeof agent.runnerId === "string" &&
            agent.runnerId.trim()
        )
    )
    .map((agent) => {
      const canonicalAgent = agents.find((item) => item.id === agent.id.trim());

      return {
        id: canonicalAgent?.id ?? agent.id.trim(),
        name: canonicalAgent?.name ?? agent.name.trim(),
        role: canonicalAgent?.role ?? agent.role,
        runnerId: canonicalAgent?.runnerId ?? agent.runnerId.trim(),
        departmentLabel:
          typeof agent.departmentLabel === "string" && agent.departmentLabel.trim()
            ? agent.departmentLabel.trim()
            : canonicalAgent?.departmentLabel,
        persona:
          canonicalAgent?.persona ?? (typeof agent.persona === "string" ? agent.persona.trim() : ""),
        systemPrompt:
          canonicalAgent?.systemPrompt ??
          (typeof agent.systemPrompt === "string" ? agent.systemPrompt.trim() : ""),
        responsibilities: canonicalAgent?.responsibilities ??
          (Array.isArray(agent.responsibilities)
            ? agent.responsibilities.filter(
                (item): item is string => typeof item === "string" && item.trim().length > 0
              )
            : []),
        skillIds: canonicalAgent?.skillIds ??
          (Array.isArray(agent.skillIds)
            ? agent.skillIds.filter(
                (item): item is string => typeof item === "string" && item.trim().length > 0
              )
            : []),
        sopIds: canonicalAgent?.sopIds ??
          (Array.isArray(agent.sopIds)
            ? agent.sopIds.filter(
                (item): item is string => typeof item === "string" && item.trim().length > 0
              )
            : []),
        knowledgeSources: canonicalAgent?.knowledgeSources ??
          (Array.isArray(agent.knowledgeSources)
            ? agent.knowledgeSources.filter(
                (item): item is string => typeof item === "string" && item.trim().length > 0
              )
            : []),
        promptTemplateId:
          canonicalAgent?.promptTemplateId ??
          (typeof agent.promptTemplateId === "string" ? agent.promptTemplateId.trim() : ""),
        policyId: canonicalAgent?.policyId ?? (typeof agent.policyId === "string" ? agent.policyId.trim() : ""),
        permissionProfileId:
          canonicalAgent?.permissionProfileId ??
          (typeof agent.permissionProfileId === "string" ? agent.permissionProfileId.trim() : ""),
        ownerMode:
          canonicalAgent?.ownerMode ??
          (agent.ownerMode === "auto-execute" ||
          agent.ownerMode === "human-approved" ||
          agent.ownerMode === "review-required"
            ? agent.ownerMode
            : "human-approved")
      };
    });
}

function normalizeWorkbenchDepartments(
  value: Partial<ForgeTeamWorkbenchState> | null | undefined
): ForgeOrgDepartment[] {
  if (!Array.isArray(value?.orgDepartments)) {
    return [];
  }

  return value.orgDepartments
    .filter(
      (department): department is ForgeOrgDepartment =>
        Boolean(
          department &&
            typeof department === "object" &&
            typeof department.label === "string" &&
            department.label.trim()
        )
    )
    .map((department) => ({ label: department.label.trim() }));
}

function normalizeWorkbenchOrgChartMembers(
  value: Partial<ForgeTeamWorkbenchState> | null | undefined
): ForgeOrgChartMember[] {
  if (!Array.isArray(value?.orgChartMembers)) {
    return [];
  }

  return value.orgChartMembers
    .filter(
      (member): member is ForgeOrgChartMember =>
        Boolean(
          member &&
            typeof member === "object" &&
            typeof member.id === "string" &&
            member.id.trim() &&
            typeof member.name === "string" &&
            member.name.trim() &&
            forgeAgentRoles.includes(member.role) &&
            typeof member.departmentLabel === "string" &&
            member.departmentLabel.trim()
        )
    )
    .map((member) => {
      const canonicalAgent = agents.find((item) => item.id === member.id.trim());

      return {
        id: canonicalAgent?.id ?? member.id.trim(),
        name: canonicalAgent?.name ?? member.name.trim(),
        role: canonicalAgent?.role ?? member.role,
        departmentLabel: member.departmentLabel.trim()
      };
    });
}

function normalizeTeamWorkbenchState(
  value: Partial<ForgeTeamWorkbenchState> | null | undefined
): ForgeTeamWorkbenchState {
  const managedAgents = normalizeWorkbenchManagedAgents(value);
  const selectedTemplateId =
    typeof value?.selectedTemplateId === "string" && value.selectedTemplateId.trim().length > 0
      ? value.selectedTemplateId.trim()
      : null;
  const activeCategory = forgeTeamWorkbenchCategories.includes(
    value?.activeCategory as (typeof forgeTeamWorkbenchCategories)[number]
  )
    ? (value?.activeCategory as (typeof forgeTeamWorkbenchCategories)[number])
    : null;
  const employeeDetailTab = forgeTeamWorkbenchEmployeeTabs.includes(
    value?.employeeDetailTab as (typeof forgeTeamWorkbenchEmployeeTabs)[number]
  )
    ? (value?.employeeDetailTab as (typeof forgeTeamWorkbenchEmployeeTabs)[number])
    : null;
  const abilityTemplateTab = forgeTeamWorkbenchAbilityTabs.includes(
    value?.abilityTemplateTab as (typeof forgeTeamWorkbenchAbilityTabs)[number]
  )
    ? (value?.abilityTemplateTab as (typeof forgeTeamWorkbenchAbilityTabs)[number])
    : null;
  const selectedAgentId =
    typeof value?.selectedAgentId === "string" && value.selectedAgentId.trim().length > 0
      ? value.selectedAgentId.trim()
      : null;
  const selectedBuilderRole = forgeAgentRoles.includes(
    value?.selectedBuilderRole as (typeof forgeAgentRoles)[number]
  )
    ? (value?.selectedBuilderRole as (typeof forgeAgentRoles)[number])
    : null;
  const selectedPoolAgentId =
    typeof value?.selectedPoolAgentId === "string" && value.selectedPoolAgentId.trim().length > 0
      ? value.selectedPoolAgentId.trim()
      : null;
  const selectedPoolDepartment =
    typeof value?.selectedPoolDepartment === "string"
      ? value.selectedPoolDepartment.trim() || null
      : null;
  const selectedManagementDepartment =
    typeof value?.selectedManagementDepartment === "string"
      ? value.selectedManagementDepartment.trim() || null
      : null;
  const selectedTemplateDepartment =
    typeof value?.selectedTemplateDepartment === "string"
      ? value.selectedTemplateDepartment.trim() || null
      : null;
  const selectedGovernanceDepartment =
    typeof value?.selectedGovernanceDepartment === "string"
      ? value.selectedGovernanceDepartment.trim() || null
      : null;
  const selectedAbilityLine =
    typeof value?.selectedAbilityLine === "string"
      ? value.selectedAbilityLine.trim() || null
      : null;
  const selectedRecommendedPackId =
    typeof value?.selectedRecommendedPackId === "string"
      ? value.selectedRecommendedPackId.trim() || null
      : null;
  const selectedCustomPackId =
    typeof value?.selectedCustomPackId === "string"
      ? value.selectedCustomPackId.trim() || null
      : null;
  const isCurrentPackListCollapsed =
    typeof value?.isCurrentPackListCollapsed === "boolean"
      ? value.isCurrentPackListCollapsed
      : undefined;
  const roleAssignments = forgeAgentRoles.reduce(
    (accumulator, role) => {
      const candidate = value?.roleAssignments?.[role];
      accumulator[role] =
        candidate === null
          ? null
          : typeof candidate === "string" && candidate.trim()
            ? candidate.trim()
            : null;
      return accumulator;
    },
    {} as Record<(typeof forgeAgentRoles)[number], string | null>
  );

  const manualSkillIdsByAgentId = Object.fromEntries(
    Object.entries(value?.manualSkillIdsByAgentId ?? {}).map(([agentId, skillIds]) => [
      agentId,
      Array.isArray(skillIds)
        ? skillIds.filter((skillId): skillId is string => typeof skillId === "string" && skillId.trim().length > 0)
        : []
    ])
  );

  const manualKnowledgeSourcesByAgentId = Object.fromEntries(
    Object.entries(value?.manualKnowledgeSourcesByAgentId ?? {}).map(([agentId, knowledgeSources]) => [
      agentId,
      Array.isArray(knowledgeSources)
        ? knowledgeSources.filter(
            (knowledgeSource): knowledgeSource is string =>
              typeof knowledgeSource === "string" && knowledgeSource.trim().length > 0
          )
        : []
    ])
  );

  const removedPackSkillIdsByAgentId = Object.fromEntries(
    Object.entries(value?.removedPackSkillIdsByAgentId ?? {}).map(([agentId, packState]) => [
      agentId,
      Object.fromEntries(
        Object.entries(packState ?? {}).map(([packKey, skillIds]) => [
          packKey,
          Array.isArray(skillIds)
            ? skillIds.filter(
                (skillId): skillId is string => typeof skillId === "string" && skillId.trim().length > 0
              )
            : []
        ])
      )
    ])
  );

  const equippedPackByAgentId = Object.fromEntries(
    Object.entries(value?.equippedPackByAgentId ?? {}).map(([agentId, packRefs]) => [
      agentId,
      Array.isArray(packRefs) ? packRefs.filter(isEquippedPackRef) : []
    ])
  );

  const customAbilityPacks = Array.isArray(value?.customAbilityPacks)
    ? value.customAbilityPacks
        .filter(
          (pack): pack is ForgeTeamWorkbenchState["customAbilityPacks"][number] =>
            Boolean(
              pack &&
                typeof pack === "object" &&
                typeof pack.id === "string" &&
                pack.id.trim() &&
                typeof pack.name === "string" &&
                pack.name.trim()
            )
        )
        .map((pack) => ({
          id: pack.id.trim(),
          name: pack.name.trim(),
          line: typeof pack.line === "string" && pack.line.trim() ? pack.line.trim() : "研发交付",
          category:
            typeof pack.category === "string" && pack.category.trim() ? pack.category.trim() : "通用",
          summary: typeof pack.summary === "string" ? pack.summary.trim() : "",
          skillIds: Array.isArray(pack.skillIds)
            ? pack.skillIds.filter(
                (skillId): skillId is string => typeof skillId === "string" && skillId.trim().length > 0
              )
            : [],
          updatedAt:
            typeof pack.updatedAt === "string" && pack.updatedAt.trim() ? pack.updatedAt.trim() : "刚刚"
        }))
    : [];

  const skillCatalogOverrides = Object.fromEntries(
    Object.entries(value?.skillCatalogOverrides ?? {}).flatMap(([skillId, override]) => {
      if (!override || typeof override !== "object") {
        return [];
      }

      const name =
        typeof override.name === "string" && override.name.trim().length > 0
          ? override.name.trim()
          : "";
      const summary =
        typeof override.summary === "string" && override.summary.trim().length > 0
          ? override.summary.trim()
          : "";
      const line =
        typeof override.line === "string" && override.line.trim().length > 0
          ? override.line.trim()
          : "";
      const category =
        typeof override.category === "string" && override.category.trim().length > 0
          ? override.category.trim()
          : "";

      if (!skillId.trim() || !name || !summary || !line || !category) {
        return [];
      }

      return [
        [
          skillId.trim(),
          {
            name,
            summary,
            line,
            category
          }
        ] as const
      ];
    })
  );

  const hiddenSkillIds = Array.isArray(value?.hiddenSkillIds)
    ? value.hiddenSkillIds.filter(
        (skillId): skillId is string => typeof skillId === "string" && skillId.trim().length > 0
      )
    : [];

  const governanceOverridesByAgentId = Object.fromEntries(
    Object.entries(value?.governanceOverridesByAgentId ?? {}).map(([agentId, overrides]) => [
      agentId,
      {
        enabled: Array.isArray(overrides?.enabled)
          ? overrides.enabled.filter(
              (permissionId): permissionId is string =>
                typeof permissionId === "string" && permissionId.trim().length > 0
            )
          : [],
        disabled: Array.isArray(overrides?.disabled)
          ? overrides.disabled.filter(
              (permissionId): permissionId is string =>
                typeof permissionId === "string" && permissionId.trim().length > 0
            )
          : []
      }
    ])
  );

  const orgDepartments = normalizeWorkbenchDepartments(value);
  const orgChartMembers = normalizeWorkbenchOrgChartMembers(value);

  return {
    managedAgents,
    selectedTemplateId,
    activeCategory,
    employeeDetailTab,
    abilityTemplateTab,
    selectedAgentId,
    selectedBuilderRole,
    selectedPoolAgentId,
    selectedPoolDepartment,
    selectedManagementDepartment,
    selectedTemplateDepartment,
    selectedGovernanceDepartment,
    selectedAbilityLine,
    selectedRecommendedPackId,
    selectedCustomPackId,
    isCurrentPackListCollapsed,
    roleAssignments,
    manualSkillIdsByAgentId,
    manualKnowledgeSourcesByAgentId,
    removedPackSkillIdsByAgentId,
    equippedPackByAgentId,
    orgDepartments,
    orgChartMembers,
    customAbilityPacks,
    skillCatalogOverrides,
    hiddenSkillIds,
    governanceOverridesByAgentId
  };
}

function normalizeProjectWorkbenchTokenUsage(value: unknown): ForgeTokenUsage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ForgeTokenUsage>;
  const inputTokens =
    typeof candidate.inputTokens === "number" && Number.isFinite(candidate.inputTokens)
      ? Math.max(0, Math.round(candidate.inputTokens))
      : null;
  const outputTokens =
    typeof candidate.outputTokens === "number" && Number.isFinite(candidate.outputTokens)
      ? Math.max(0, Math.round(candidate.outputTokens))
      : null;
  const totalTokens =
    typeof candidate.totalTokens === "number" && Number.isFinite(candidate.totalTokens)
      ? Math.max(0, Math.round(candidate.totalTokens))
      : inputTokens !== null || outputTokens !== null
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : null;

  if (totalTokens === null || totalTokens <= 0) {
    return null;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens
  };
}

function normalizeProjectWorkbenchMessage(
  value: unknown
): ForgeProjectWorkbenchMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ForgeProjectWorkbenchMessage>;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const speaker = typeof candidate.speaker === "string" ? candidate.speaker.trim() : "";
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  const time = typeof candidate.time === "string" ? candidate.time.trim() : "";

  if (!id || !text) {
    return null;
  }

  return {
    id,
    speaker: speaker || (candidate.role === "human" ? "你" : "AI"),
    role: candidate.role === "human" ? "human" : "ai",
    text,
    time: time || "刚刚",
    tokenUsage: normalizeProjectWorkbenchTokenUsage(candidate.tokenUsage)
  };
}

function normalizeProjectWorkbenchDocument(
  value: unknown
): ForgeProjectWorkbenchDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ForgeProjectWorkbenchDocument>;
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const body = typeof candidate.body === "string" ? candidate.body : "";

  if (!title && !body.trim()) {
    return null;
  }

  return {
    title: title || "未命名结果",
    body,
    updatedAt:
      typeof candidate.updatedAt === "string"
        ? candidate.updatedAt.trim() || null
        : candidate.updatedAt ?? null
  };
}

function normalizeProjectWorkbenchNodeState(
  value: unknown
): ForgeProjectWorkbenchNodeState {
  if (!value || typeof value !== "object") {
    return {
      conversationTabs: [],
      activeConversationTabId: "",
      documentTabs: [],
      activeDocumentTabId: ""
    };
  }

  const candidate = value as Partial<ForgeProjectWorkbenchNodeState>;
  const conversationTabs = Array.isArray(candidate.conversationTabs)
    ? candidate.conversationTabs
        .filter(
          (
            tab
          ): tab is NonNullable<ForgeProjectWorkbenchNodeState["conversationTabs"][number]> =>
            Boolean(
              tab &&
                typeof tab === "object" &&
                typeof tab.id === "string" &&
                tab.id.trim() &&
                typeof tab.label === "string"
            )
        )
        .map((tab) => ({
          id: tab.id.trim(),
          label: tab.label.trim() || "会话",
          messages: Array.isArray(tab.messages)
            ? tab.messages
                .map((message) => normalizeProjectWorkbenchMessage(message))
                .filter((message): message is ForgeProjectWorkbenchMessage => Boolean(message))
            : []
        }))
    : [];
  const documentTabs = Array.isArray(candidate.documentTabs)
    ? candidate.documentTabs
        .filter(
          (
            tab
          ): tab is NonNullable<ForgeProjectWorkbenchNodeState["documentTabs"][number]> =>
            Boolean(
              tab &&
                typeof tab === "object" &&
                typeof tab.id === "string" &&
                tab.id.trim() &&
                typeof tab.label === "string"
            )
        )
        .map((tab) => ({
          id: tab.id.trim(),
          label: tab.label.trim() || "结果",
          document: normalizeProjectWorkbenchDocument(tab.document)
        }))
    : [];

  const activeConversationTabId =
    typeof candidate.activeConversationTabId === "string"
      ? candidate.activeConversationTabId.trim()
      : "";
  const activeDocumentTabId =
    typeof candidate.activeDocumentTabId === "string"
      ? candidate.activeDocumentTabId.trim()
      : "";

  return {
    conversationTabs,
    activeConversationTabId:
      conversationTabs.some((tab) => tab.id === activeConversationTabId)
        ? activeConversationTabId
        : conversationTabs[0]?.id ?? "",
    documentTabs,
    activeDocumentTabId: documentTabs.some((tab) => tab.id === activeDocumentTabId)
      ? activeDocumentTabId
      : documentTabs[0]?.id ?? ""
  };
}

function normalizeProjectWorkbenchProjectState(
  value: unknown
): ForgeProjectWorkbenchProjectState {
  if (!value || typeof value !== "object") {
    return {
      drafts: {},
      nodePanels: {}
    };
  }

  const candidate = value as Partial<ForgeProjectWorkbenchProjectState>;
  const selectedNode = forgeProjectWorkbenchNodes.includes(
    candidate.selectedNode as ForgeProjectWorkbenchNode
  )
    ? (candidate.selectedNode as ForgeProjectWorkbenchNode)
    : null;
  const drafts = Object.fromEntries(
    forgeProjectWorkbenchNodes
      .map((node) => {
        const draft = candidate.drafts?.[node];
        return typeof draft === "string" ? ([node, draft] as const) : null;
      })
      .filter((entry): entry is readonly [ForgeProjectWorkbenchNode, string] => Boolean(entry))
  );
  const nodePanels = Object.fromEntries(
    forgeProjectWorkbenchNodes
      .map((node) => {
        const nodeState = candidate.nodePanels?.[node];

        if (!nodeState || typeof nodeState !== "object") {
          return null;
        }

        return [node, normalizeProjectWorkbenchNodeState(nodeState)] as const;
      })
      .filter(
        (
          entry
        ): entry is readonly [ForgeProjectWorkbenchNode, ForgeProjectWorkbenchNodeState] =>
          Boolean(entry)
      )
  );
  const workspaceView = normalizeProjectWorkbenchWorkspaceViewState(candidate.workspaceView);

  return {
    selectedNode,
    workspaceView,
    drafts,
    nodePanels
  };
}

function normalizeProjectWorkbenchWorkspaceViewState(
  value: unknown
): ForgeProjectWorkbenchWorkspaceViewState {
  if (!value || typeof value !== "object") {
    return {};
  }

  const candidate = value as Partial<ForgeProjectWorkbenchWorkspaceViewState>;
  const selectedFilePath =
    typeof candidate.selectedFilePath === "string" && candidate.selectedFilePath.trim()
      ? candidate.selectedFilePath.trim()
      : null;
  const expandedDirectories = Array.isArray(candidate.expandedDirectories)
    ? candidate.expandedDirectories
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];

  return {
    isOpen: candidate.isOpen === true,
    selectedFilePath,
    expandedDirectories
  };
}

function normalizeProjectWorkbenchState(
  value: unknown
): ForgeProjectWorkbenchState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([projectId, projectState]) => {
        const normalizedProjectId = projectId.trim();

        if (!normalizedProjectId) {
          return null;
        }

        return [
          normalizedProjectId,
          normalizeProjectWorkbenchProjectState(projectState)
        ] as const;
      })
      .filter(
        (
          entry
        ): entry is readonly [string, ForgeProjectWorkbenchProjectState] => Boolean(entry)
      )
  );
}

type StoredModelProviderConfig = {
  enabled?: boolean;
  apiKey?: string;
  modelPriority?: string[];
  status?: ForgeModelProviderConnectionStatus;
  lastTestedAt?: string | null;
  lastTestMessage?: string | null;
};

type StoredModelProviderState = Partial<Record<ForgeModelProviderId, StoredModelProviderConfig>>;

const modelProviderCatalog = getModelGatewayProviderCatalog().reduce(
  (accumulator, provider) => {
    accumulator[provider.id] = provider;
    return accumulator;
  },
  {} as Record<
    ForgeModelProviderId,
    ReturnType<typeof getModelGatewayProviderDefinition>
  >
);

function normalizeTextList(values: string[] | undefined, fallback: string[]) {
  const normalized = (values ?? []).map((item) => item.trim()).filter(Boolean);

  return normalized.length > 0 ? normalized : fallback;
}

function maskApiKey(apiKey: string) {
  const normalized = apiKey.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= 8) {
    return `${normalized.slice(0, 2)}••••`;
  }

  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

function readAppStateValue(db: ForgeDb, key: string) {
  return (
    (db.prepare(
      `
        SELECT value
        FROM app_state
        WHERE key = ?
      `
    ).get(key) as { value?: string } | undefined)?.value ?? null
  );
}

function writeAppStateValue(db: ForgeDb, key: string, value: string) {
  db.prepare(
    `
      INSERT INTO app_state (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `
  ).run(key, value);
}

function loadStoredModelProviderState(db: ForgeDb): StoredModelProviderState {
  return parseJsonValue<StoredModelProviderState>(
    readAppStateValue(db, modelProviderStateKey),
    {}
  );
}

function saveStoredModelProviderState(db: ForgeDb, state: StoredModelProviderState) {
  writeAppStateValue(db, modelProviderStateKey, toJson(state));
}

function loadStoredTeamWorkbenchState(db: ForgeDb): ForgeTeamWorkbenchState {
  return applyTeamWorkbenchStateDefaults(
    normalizeTeamWorkbenchState(
      parseJsonValue<Partial<ForgeTeamWorkbenchState>>(
        readAppStateValue(db, teamWorkbenchStateKey),
        {}
      )
    )
  );
}

function saveStoredTeamWorkbenchState(db: ForgeDb, state: ForgeTeamWorkbenchState) {
  writeAppStateValue(db, teamWorkbenchStateKey, toJson(normalizeTeamWorkbenchState(state)));
}

function loadStoredProjectWorkbenchState(db: ForgeDb): ForgeProjectWorkbenchState {
  return normalizeProjectWorkbenchState(
    parseJsonValue<ForgeProjectWorkbenchState>(
      readAppStateValue(db, projectWorkbenchStateKey),
      {}
    )
  );
}

function saveStoredProjectWorkbenchState(db: ForgeDb, state: ForgeProjectWorkbenchState) {
  writeAppStateValue(
    db,
    projectWorkbenchStateKey,
    toJson(normalizeProjectWorkbenchState(state))
  );
}

function normalizeModelProviderSetting(
  providerId: ForgeModelProviderId,
  stored: StoredModelProviderConfig | undefined
): ForgeModelProviderSetting {
  const definition = modelProviderCatalog[providerId];
  const apiKey = stored?.apiKey?.trim() ?? "";

  return {
    id: providerId,
    label: definition.label,
    vendor: definition.vendor,
    summary: definition.summary,
    enabled: stored?.enabled ?? false,
    hasApiKey: Boolean(apiKey),
    apiKeyHint: apiKey ? maskApiKey(apiKey) : null,
    modelPriority: normalizeTextList(stored?.modelPriority, definition.defaultModelPriority),
    defaultModelPriority: [...definition.defaultModelPriority],
    catalogModels: [...definition.catalogModels],
    docsUrl: definition.docsUrl,
    baseUrl: definition.baseUrl,
    status: stored?.status ?? "untested",
    lastTestedAt: stored?.lastTestedAt ?? null,
    lastTestMessage: stored?.lastTestMessage ?? null,
    supportsCustomModels: definition.supportsCustomModels
  };
}

function parseCapabilityDetails(value: string) {
  return JSON.parse(value || "[]") as ForgeRunnerCapabilityDetail[];
}

function parseVariables(row: PromptTemplateRow): ForgePromptTemplate {
  return {
    id: row.id,
    title: row.title,
    scenario: row.scenario,
    summary: row.summary,
    template: row.template,
    variables: JSON.parse(row.variablesJson) as string[],
    version: row.version,
    useCount: row.useCount,
    lastUsedAt: row.lastUsedAt
  };
}

function normalizeProjectTemplate(row: ProjectTemplateRow): ForgeProjectTemplate {
  return {
    id: row.id,
    title: row.title,
    sector: row.sector,
    summary: row.summary,
    dnaSummary: row.dnaSummary,
    defaultPromptIds: parseJsonArray(row.defaultPromptIdsJson),
    defaultGateIds: parseJsonArray(row.defaultGateIdsJson),
    constraints: parseJsonArray(row.constraintsJson)
  };
}

function normalizeComponent(row: ComponentRow): ForgeComponent {
  const defaultAssemblyContract = {
    deliveryMode:
      row.sourceType === "internal" ? "workspace-package" : "git-repo",
    sourceLocator: row.sourceRef,
    importPath: row.sourceRef.replace(/^forge:\/\//, "@forge/").replace(/^github:\/\//, "@github/"),
    installCommand:
      row.sourceType === "internal"
        ? "pnpm --filter app add <workspace-module>"
        : "pnpm add <module-package>",
    peerDeps: ["react"],
    requiredEnv: [],
    setupSteps: ["把模块接入当前项目页面、接口与状态流。"],
    smokeTestCommand: null,
    ownedPaths: [],
  } satisfies NonNullable<ForgeComponent["assemblyContract"]>;

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    summary: row.summary,
    sourceType: row.sourceType,
    sourceRef: row.sourceRef,
    tags: parseJsonArray(row.tagsJson),
    recommendedSectors: parseJsonArray(row.recommendedSectorsJson),
    usageGuide: row.usageGuide,
    assemblyContract: fromJson(row.assemblyContractJson, defaultAssemblyContract)
  };
}

function normalizeProjectProfile(row: ProjectProfileRow): ForgeProjectProfile {
  return {
    projectId: row.projectId,
    templateId: row.templateId,
    templateTitle: row.templateTitle,
    teamTemplateId: row.teamTemplateId ?? undefined,
    teamTemplateTitle: row.teamTemplateTitle ?? undefined,
    workspacePath: row.workspacePath,
    dnaSummary: row.dnaSummary,
    defaultPromptIds: parseJsonArray(row.defaultPromptIdsJson),
    defaultGateIds: parseJsonArray(row.defaultGateIdsJson),
    constraints: parseJsonArray(row.constraintsJson),
    initializedAt: row.initializedAt
  };
}

function normalizeProjectWorkflowState(row: ProjectWorkflowStateRow): ForgeProjectWorkflowState {
  return {
    projectId: row.projectId,
    currentStage: row.currentStage,
    state: row.state,
    blockers: parseJsonArray(row.blockersJson),
    lastTransitionAt: row.lastTransitionAt,
    updatedBy: row.updatedBy
  };
}

function normalizeWorkflowTransition(row: WorkflowTransitionRow): ForgeWorkflowTransition {
  return {
    id: row.id,
    projectId: row.projectId,
    stage: row.stage,
    state: row.state,
    updatedBy: row.updatedBy,
    blockers: parseJsonArray(row.blockersJson),
    createdAt: row.createdAt
  };
}

function buildWorkflowTransitionId(projectId: string) {
  return `workflow-${projectId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function insertWorkflowTransition(
  db: ForgeDb,
  input: {
    id?: string;
    projectId: string;
    stage: ForgeWorkflowTransition["stage"];
    state: ForgeWorkflowTransition["state"];
    updatedBy: string;
    blockers: string[];
    createdAt: string;
  }
) {
  db.prepare(`
    INSERT INTO workflow_transitions (
      id, project_id, stage, state, updated_by, blockers_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.id ?? buildWorkflowTransitionId(input.projectId),
    input.projectId,
    input.stage,
    input.state,
    input.updatedBy,
    toJson(input.blockers),
    input.createdAt
  );
}

function normalizePrdDocument(row: PrdDocumentRow): ForgePrdDocument {
  return {
    id: row.id,
    projectId: row.projectId,
    templateId: row.templateId,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt
  };
}

function getDefaultDepartmentLabel(role: ForgeAgent["role"]) {
  const departmentByRole: Record<ForgeAgent["role"], string> = {
    pm: "管理层",
    architect: "产品与方案",
    design: "产品与方案",
    engineer: "技术研发",
    qa: "技术研发",
    release: "技术研发",
    knowledge: "运营支持"
  };

  return departmentByRole[role];
}

function normalizeAgent(row: AgentRow): ForgeAgent {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    runnerId: row.runnerId,
    departmentLabel: row.departmentLabel || getDefaultDepartmentLabel(row.role),
    persona: row.persona,
    systemPrompt: row.systemPrompt,
    responsibilities: parseJsonArray(row.responsibilitiesJson),
    skillIds: parseJsonArray(row.skillIdsJson),
    sopIds: parseJsonArray(row.sopIdsJson),
    knowledgeSources: parseJsonArray(row.knowledgeSourcesJson),
    promptTemplateId: row.promptTemplateId,
    policyId: row.policyId,
    permissionProfileId: row.permissionProfileId,
    ownerMode: row.ownerMode
  };
}

function normalizeSkill(row: SkillRow): ForgeSkill {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    ownerRole: row.ownerRole,
    summary: row.summary,
    usageGuide: row.usageGuide
  };
}

function normalizeSop(row: SopRow): ForgeSop {
  return {
    id: row.id,
    name: row.name,
    stage: row.stage,
    ownerRole: row.ownerRole,
    summary: row.summary,
    checklist: parseJsonArray(row.checklistJson)
  };
}

function normalizeTeamTemplate(row: TeamTemplateRow): ForgeTeamTemplate {
  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    agentIds: parseJsonArray(row.agentIdsJson),
    leadAgentId: row.leadAgentId
  };
}

function normalizeArtifact(row: ArtifactRow): ForgeArtifact {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type,
    title: row.title,
    ownerAgentId: row.ownerAgentId,
    status: row.status,
    updatedAt: row.updatedAt
  };
}

function normalizeArtifactReview(row: ArtifactReviewRow): ForgeArtifactReview {
  return {
    id: row.id,
    artifactId: row.artifactId,
    reviewerAgentId: row.reviewerAgentId,
    decision: row.decision,
    summary: row.summary,
    conditions: parseJsonArray(row.conditionsJson),
    reviewedAt: row.reviewedAt
  };
}

function normalizeProjectAssetLink(row: ProjectAssetLinkRow): ForgeProjectAssetLink {
  return {
    id: row.id,
    projectId: row.projectId,
    targetType: row.targetType,
    targetId: row.targetId,
    relation: row.relation,
    reason: row.reason,
    usageGuide: row.usageGuide
  };
}

function normalizeTask(row: TaskRow): ForgeTask {
  return {
    id: row.id,
    projectId: row.projectId,
    stage: row.stage,
    title: row.title,
    ownerAgentId: row.ownerAgentId,
    status: row.status,
    priority: row.priority,
    category: row.category,
    summary: row.summary
  };
}

function normalizeCommand(row: CommandRow): ForgeCommand {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    summary: row.summary,
    triggerStage: row.triggerStage,
    requiresArtifacts: parseJsonArray(row.requiresArtifactsJson) as ForgeCommand["requiresArtifacts"]
  };
}

function normalizeCommandHook(row: CommandHookRow): ForgeCommandHook {
  return {
    id: row.id,
    name: row.name,
    summary: row.summary,
    policy: row.policy
  };
}

function normalizeCommandExecution(row: CommandExecutionRow): ForgeCommandExecution {
  return {
    id: row.id,
    commandId: row.commandId,
    projectId: row.projectId ?? undefined,
    taskPackId: row.taskPackId ?? undefined,
    relatedRunId: row.relatedRunId ?? undefined,
    status: row.status,
    summary: row.summary,
    triggeredBy: row.triggeredBy,
    createdAt: row.createdAt,
    followUpTaskIds: parseJsonArray(row.followUpTaskIdsJson)
  };
}

function normalizePolicyDecision(row: PolicyDecisionRow): ForgePolicyDecision {
  return {
    id: row.id,
    hookId: row.hookId,
    commandExecutionId: row.commandExecutionId,
    outcome: row.outcome,
    summary: row.summary,
    createdAt: row.createdAt
  };
}

function normalizeRunner(row: RunnerRow): ForgeRunner {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    summary: row.summary,
    workspacePath: row.workspacePath,
    capabilities: parseJsonArray(row.capabilitiesJson),
    detectedCapabilities: parseJsonArray(row.detectedCapabilitiesJson),
    detectedCapabilityDetails: parseCapabilityDetails(row.detectedCapabilityDetailsJson),
    probeStatus: row.probeStatus,
    probeSummary: row.probeSummary,
    currentRunId: row.currentRunId,
    lastHeartbeat: row.lastHeartbeat,
    lastProbeAt: row.lastProbeAt
  };
}

function normalizeRun(row: RunRow): ForgeRun {
  return {
    id: row.id,
    projectId: row.projectId ?? undefined,
    taskPackId: row.taskPackId ?? undefined,
    linkedComponentIds: parseJsonArray(row.linkedComponentIdsJson),
    title: row.title,
    executor: row.executor,
    cost: row.cost,
    state: row.state,
    outputMode: row.outputMode ?? null,
    outputChecks: JSON.parse(row.outputChecksJson) as ForgeRunOutputCheck[]
  };
}

function normalizeRunEvent(row: RunEventRow): ForgeRunEvent {
  return {
    id: row.id,
    runId: row.runId,
    projectId: row.projectId ?? undefined,
    type: row.type,
    summary: row.summary,
    failureCategory: row.failureCategory,
    createdAt: row.createdAt
  };
}

function formatRelativeNow() {
  return "刚刚";
}

function buildRunEventId(runId: string) {
  return `run-event-${runId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildCommandExecutionCreatedAt(input?: string) {
  return input?.trim() || new Date().toISOString();
}

function buildRunEventFromInput(input: UpsertRunInput): ForgeRunEvent {
  const createdAt = new Date().toISOString();
  const failureCategory = input.state === "blocked" ? input.failureCategory ?? "unknown" : null;
  const summary =
    input.state === "running"
      ? `${input.executor} 已开始执行「${input.title}」。`
      : input.state === "done"
        ? `${input.executor} 已完成「${input.title}」。`
        : input.failureSummary?.trim() || `${input.executor} 执行「${input.title}」时发生阻塞。`;

  return {
    id: buildRunEventId(input.id),
    runId: input.id,
    projectId: input.projectId ?? undefined,
    type: input.state === "blocked" ? "failure" : "status",
    summary,
    failureCategory,
    createdAt
  };
}

function buildRunOutputEventFromInput(input: UpsertRunInput): ForgeRunEvent | null {
  const summary = input.outputSummary?.trim();

  if (!summary) {
    return null;
  }

  const telemetryParts = [
    input.outputMode?.trim() ? `Runtime:${input.outputMode.trim()}` : "",
    input.outputChecks && input.outputChecks.length > 0
      ? `checks:${input.outputChecks
          .map((check) =>
            `${check.name}=${check.status}${check.summary ? `[${check.summary}]` : ""}`
          )
          .join(", ")}`
      : ""
  ].filter(Boolean);

  return {
    id: buildRunEventId(input.id),
    runId: input.id,
    projectId: input.projectId ?? undefined,
    type: "output",
    summary: [...telemetryParts, summary].join(" | "),
    failureCategory: null,
    createdAt: new Date().toISOString()
  };
}

export function recordCommandExecution(input: RecordCommandExecutionInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const executionCreatedAt = buildCommandExecutionCreatedAt(input.createdAt);

    db.prepare(`
      INSERT INTO command_executions (
        id, command_id, project_id, task_pack_id, run_id, status, summary, triggered_by, created_at, follow_up_task_ids_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        command_id = excluded.command_id,
        project_id = excluded.project_id,
        task_pack_id = excluded.task_pack_id,
        run_id = excluded.run_id,
        status = excluded.status,
        summary = excluded.summary,
        triggered_by = excluded.triggered_by,
        created_at = excluded.created_at,
        follow_up_task_ids_json = excluded.follow_up_task_ids_json
    `).run(
      input.id,
      input.commandId,
      input.projectId ?? null,
      input.taskPackId ?? null,
      input.relatedRunId ?? null,
      input.status,
      input.summary,
      input.triggeredBy,
      executionCreatedAt,
      toJson(input.followUpTaskIds ?? [])
    );

    const decisions = (input.decisions ?? []).map((decision) => {
      const createdAt = buildCommandExecutionCreatedAt(decision.createdAt);

      db.prepare(`
        INSERT INTO policy_decisions (
          id, hook_id, command_execution_id, outcome, summary, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          hook_id = excluded.hook_id,
          command_execution_id = excluded.command_execution_id,
          outcome = excluded.outcome,
          summary = excluded.summary,
          created_at = excluded.created_at
      `).run(
        decision.id,
        decision.hookId,
        input.id,
        decision.outcome,
        decision.summary,
        createdAt
      );

      return normalizePolicyDecision({
        id: decision.id,
        hookId: decision.hookId,
        commandExecutionId: input.id,
        outcome: decision.outcome,
        summary: decision.summary,
        createdAt
      });
    });

    const executionRow = db.prepare(`
      SELECT
        id,
        command_id AS commandId,
        project_id AS projectId,
        task_pack_id AS taskPackId,
        run_id AS relatedRunId,
        status,
        summary,
        triggered_by AS triggeredBy,
        created_at AS createdAt,
        follow_up_task_ids_json AS followUpTaskIdsJson
      FROM command_executions
      WHERE id = ?
    `).get(input.id) as CommandExecutionRow;

    return {
      execution: normalizeCommandExecution(executionRow),
      decisions
    };
  } finally {
    db.close();
  }
}

function probeCommandAvailable(command: string) {
  return Boolean(probeCommandInfo(command));
}

function probeCommandInfo(command: string) {
  try {
    const pathResult = spawnSync("which", [command], {
      encoding: "utf8"
    });

    if (pathResult.status !== 0) {
      return null;
    }

    const path = String(pathResult.stdout || "").trim();

    if (!path) {
      return null;
    }

    const versionResult = spawnSync(command, ["--version"], {
      encoding: "utf8",
    });

    const version =
      versionResult.status === 0
        ? [versionResult.stdout, versionResult.stderr]
            .map((item) => String(item || "").trim())
            .find(Boolean) ?? null
        : null;

    return { path, version };
  } catch {
    return null;
  }
}

function probeWorkspaceWritable(workspacePath: string) {
  try {
    accessSync(workspacePath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function deriveRunnerWorkspacePath(runner: ForgeRunner, dbPath?: string) {
  const workspaceRoot = resolveWorkspaceRoot(dbPath);

  if (runner.id === "runner-release-helper") {
    return join(workspaceRoot, "ops-briefing");
  }

  return join(workspaceRoot, "retail-support");
}

function resolveRunnerCapabilityChecks(runner: ForgeRunner) {
  const playwrightBinary = join(process.cwd(), "node_modules", ".bin", "playwright");
  const workspaceExists = existsSync(runner.workspacePath);
  const workspaceWritable = workspaceExists && probeWorkspaceWritable(runner.workspacePath);
  const gitInfo = probeCommandInfo("git");
  const nodeInfo = probeCommandInfo("node");
  const codexInfo = probeCommandInfo("codex");
  const playwrightAvailable = existsSync(playwrightBinary);
  const detectedCapabilityDetails: ForgeRunnerCapabilityDetail[] = [];

  if (workspaceWritable) {
    detectedCapabilityDetails.push({
      capability: "文件写入",
      status: "pass",
      path: runner.workspacePath,
      version: null
    });
  }

  if (gitInfo) {
    detectedCapabilityDetails.push({
      capability: "Git",
      status: "pass",
      path: gitInfo.path,
      version: gitInfo.version
    });
  }

  if (workspaceWritable && nodeInfo) {
    detectedCapabilityDetails.push({
      capability: "TaskPack 执行",
      status: "pass",
      path: nodeInfo.path,
      version: nodeInfo.version
    });
  }

  if (playwrightAvailable) {
    const versionResult = spawnSync(playwrightBinary, ["--version"], { encoding: "utf8" });
    const playwrightVersion =
      versionResult.status === 0
        ? [versionResult.stdout, versionResult.stderr]
            .map((item) => String(item || "").trim())
            .find(Boolean) ?? null
        : null;
    for (const capability of ["Playwright", "截图", "门禁回归"]) {
      detectedCapabilityDetails.push({
        capability,
        status: "pass",
        path: playwrightBinary,
        version: playwrightVersion
      });
    }
  }

  if (workspaceExists && codexInfo) {
    detectedCapabilityDetails.push({
      capability: "Codex",
      status: "pass",
      path: codexInfo.path,
      version: codexInfo.version
    });
  }

  return {
    "文件写入": workspaceWritable,
    Git: Boolean(gitInfo),
    "TaskPack 执行": workspaceWritable && Boolean(nodeInfo),
    Playwright: playwrightAvailable,
    截图: playwrightAvailable,
    门禁回归: playwrightAvailable,
    构建整理: workspaceWritable,
    发布说明: workspaceWritable,
    归档: workspaceWritable,
    Codex: workspaceExists && Boolean(codexInfo),
    detectedCapabilityDetails
  };
}

function probeRunnerState(runner: ForgeRunner) {
  const checks = resolveRunnerCapabilityChecks(runner);
  const detectedCapabilities = runner.capabilities.filter((capability) => checks[capability as keyof typeof checks]);
  const detectedCapabilityDetails = checks.detectedCapabilityDetails.filter((detail) =>
    detectedCapabilities.includes(detail.capability)
  );
  const missingCapabilities = runner.capabilities.filter((capability) => !detectedCapabilities.includes(capability));
  const workspaceExists = existsSync(runner.workspacePath);
  const probeStatus: ForgeRunnerProbeStatus = !workspaceExists
    ? "offline"
    : missingCapabilities.length > 0
      ? "degraded"
      : "healthy";
  const status: ForgeRunner["status"] =
    probeStatus === "offline"
      ? "offline"
      : probeStatus === "degraded"
        ? "blocked"
        : runner.currentRunId
          ? "busy"
          : "idle";
  const probeSummary = !workspaceExists
    ? "工作区不存在，Runner 当前不可用。"
    : missingCapabilities.length > 0
      ? `缺少能力：${missingCapabilities.join(" / ")}`
      : `探测完成：${detectedCapabilities.join(" / ") || "基础能力"} 可用。`;

  return {
    status,
    probeStatus,
    probeSummary,
    detectedCapabilities,
    detectedCapabilityDetails
  };
}

function buildSeedRunner(runner: ForgeRunner, dbPath?: string): ForgeRunner {
  return {
    ...runner,
    workspacePath: deriveRunnerWorkspacePath(runner, dbPath)
  };
}

function createWorkspaceScaffold(args: {
  project: { id: string; name: string; sector: string; owner: string };
  profile: ForgeProjectProfile;
}) {
  const workspacePath = args.profile.workspacePath;
  const contextDir = join(workspacePath, "context");
  const notesDir = join(workspacePath, "notes");

  mkdirSync(contextDir, { recursive: true });
  mkdirSync(notesDir, { recursive: true });

  writeFileSync(
    join(workspacePath, "README.md"),
    `# ${args.project.name}\n\n- 模板：${args.profile.templateTitle}\n- 团队编制：${args.profile.teamTemplateTitle ?? "未指定"}\n- 场景：${args.project.sector}\n- 负责人：${args.project.owner}\n- 工作区：${workspacePath}\n`,
    "utf8"
  );
  writeFileSync(
    join(contextDir, "project-dna.json"),
    JSON.stringify(
      {
        projectId: args.project.id,
        projectName: args.project.name,
        sector: args.project.sector,
        owner: args.project.owner,
        templateId: args.profile.templateId,
        templateTitle: args.profile.templateTitle,
        teamTemplateId: args.profile.teamTemplateId,
        teamTemplateTitle: args.profile.teamTemplateTitle,
        dnaSummary: args.profile.dnaSummary,
        defaultPromptIds: args.profile.defaultPromptIds,
        defaultGateIds: args.profile.defaultGateIds,
        constraints: args.profile.constraints
      },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(
    join(notesDir, "intake.md"),
    `# 项目接入\n\n- 项目：${args.project.name}\n- 场景：${args.project.sector}\n- 负责人：${args.project.owner}\n- 模板：${args.profile.templateTitle}\n- 团队编制：${args.profile.teamTemplateTitle ?? "未指定"}\n- DNA：${args.profile.dnaSummary}\n`,
    "utf8"
  );
}

function buildProjectProfile(args: {
  project: { id: string; name: string; sector: string; owner: string };
  template: ForgeProjectTemplate;
  teamTemplateId?: string;
  dbPath?: string;
}) {
  const teamTemplate = resolveTeamTemplateForProjectTemplate(args.template.id, args.teamTemplateId);

  return {
    projectId: args.project.id,
    templateId: args.template.id,
    templateTitle: args.template.title,
    teamTemplateId: teamTemplate.id,
    teamTemplateTitle: teamTemplate.name,
    workspacePath: join(resolveWorkspaceRoot(args.dbPath), args.project.id),
    dnaSummary: args.template.dnaSummary,
    defaultPromptIds: args.template.defaultPromptIds,
    defaultGateIds: args.template.defaultGateIds,
    constraints: args.template.constraints,
    initializedAt: formatRelativeNow()
  } satisfies ForgeProjectProfile;
}

function resolveTeamTemplateForProjectTemplate(
  templateId: string,
  preferredTeamTemplateId?: string
): ForgeTeamTemplate {
  const normalizedPreferredTeamTemplateId = preferredTeamTemplateId?.trim();
  if (normalizedPreferredTeamTemplateId) {
    const preferredTemplate = teamTemplates.find(
      (item) => item.id === normalizedPreferredTeamTemplateId
    );

    if (preferredTemplate) {
      return preferredTemplate;
    }
  }

  const mappedId =
    templateId === "template-rag-service"
      ? "team-lean-validation"
      : templateId === "template-ops-automation"
        ? "team-design-sprint"
        : "team-standard-delivery";

  return teamTemplates.find((item) => item.id === mappedId) ?? teamTemplates[0]!;
}

function resolveRecommendedAssetId(templateId: string) {
  if (templateId === "template-ops-automation") {
    return "asset-3";
  }

  return "asset-2";
}

function buildProjectAssetLinks(args: {
  projectId: string;
  template: ForgeProjectTemplate;
}): ForgeProjectAssetLink[] {
  const promptId = args.template.defaultPromptIds[0];
  const assetId = resolveRecommendedAssetId(args.template.id);
  const links: ForgeProjectAssetLink[] = [
    {
      id: `link-${args.projectId}-template`,
      projectId: args.projectId,
      targetType: "template",
      targetId: args.template.id,
      relation: "default",
      reason: `当前项目从 ${args.template.title} 继承起盘基线。`,
      usageGuide: "先读取模板 DNA 和约束，再开始 PRD 与 TaskPack。"
    }
  ];

  if (promptId) {
    links.push({
      id: `link-${args.projectId}-prompt`,
      projectId: args.projectId,
      targetType: "prompt",
      targetId: promptId,
      relation: "required",
      reason: "该项目要求先生成 PRD 草案，再拆任务包。",
      usageGuide: "先填项目名、风险和补充说明，再生成 PRD。"
    });
  }

  if (assetId) {
    links.push({
      id: `link-${args.projectId}-asset`,
      projectId: args.projectId,
      targetType: "asset",
      targetId: assetId,
      relation: "recommended",
      reason:
        assetId === "asset-3"
          ? "交付前建议统一套用门禁包。"
          : "当前项目推荐先接入检索增强 Skill。",
      usageGuide:
        assetId === "asset-3"
          ? "进入交付前统一执行构建、主流程和异常路径门禁。"
          : "在主流程开发前先接入召回、重排和引用标准化。"
    });
  }

  return links;
}

function buildProjectBootstrapArtifacts(args: {
  projectId: string;
  projectName: string;
  initializedAt: string;
}): ForgeArtifact[] {
  return [
    {
      id: `artifact-${args.projectId}-prd`,
      projectId: args.projectId,
      type: "prd",
      title: `${args.projectName} PRD 初稿`,
      ownerAgentId: "agent-service-strategy",
      status: "draft",
      updatedAt: args.initializedAt
    },
    {
      id: `artifact-${args.projectId}-architecture`,
      projectId: args.projectId,
      type: "architecture-note",
      title: `${args.projectName} 架构与流程说明`,
      ownerAgentId: "agent-architect",
      status: "draft",
      updatedAt: args.initializedAt
    },
    {
      id: `artifact-${args.projectId}-ui-spec`,
      projectId: args.projectId,
      type: "ui-spec",
      title: `${args.projectName} 原型与交互规范`,
      ownerAgentId: "agent-ux",
      status: "draft",
      updatedAt: args.initializedAt
    },
    {
      id: `artifact-${args.projectId}-task-pack`,
      projectId: args.projectId,
      type: "task-pack",
      title: `${args.projectName} 首轮 TaskPack`,
      ownerAgentId: "agent-architect",
      status: "draft",
      updatedAt: args.initializedAt
    }
  ];
}

function buildProjectBootstrapTasks(args: {
  projectId: string;
  projectName: string;
  templateTitle: string;
  dnaSummary: string;
  defaultGateIds: string[];
}): ForgeTask[] {
  return [
    {
      id: `task-${args.projectId}-intake`,
      projectId: args.projectId,
      stage: "项目接入",
      title: "确认需求摘要与成功标准",
      ownerAgentId: "agent-service-strategy",
      status: "todo",
      priority: "P0",
      category: "handoff",
      summary: `基于 ${args.templateTitle} 模板确认目标、边界和成功标准，锁定 ${args.projectName} 的起盘范围。`
    },
    {
      id: `task-${args.projectId}-prd`,
      projectId: args.projectId,
      stage: "方案与任务包",
      title: "生成 PRD 初稿",
      ownerAgentId: "agent-service-strategy",
      status: "todo",
      priority: "P0",
      category: "execution",
      summary: `结合项目 DNA「${args.dnaSummary}」生成首版 PRD，并补齐验收标准与关键约束。`
    },
    {
      id: `task-${args.projectId}-design-arch`,
      projectId: args.projectId,
      stage: "方案与任务包",
      title: "产出原型与架构基线",
      ownerAgentId: "agent-architect",
      status: "todo",
      priority: "P0",
      category: "execution",
      summary: "完成原型、架构边界和首轮 TaskPack，为研发执行建立可交付输入。"
    },
    {
      id: `task-${args.projectId}-runner-gates`,
      projectId: args.projectId,
      stage: "开发执行",
      title: "初始化本地执行与门禁",
      ownerAgentId: "agent-frontend",
      status: "todo",
      priority: "P0",
      category: "execution",
      summary: `接通本地 Runner，并准备 ${args.defaultGateIds.length} 个默认门禁，确保后续执行可追踪、可回归。`
    }
  ];
}

function resolveTemplateIdForProject(projectId: string, sector: string) {
  const seededTemplateId = seedProjectTemplateMap[projectId];

  if (seededTemplateId) {
    return seededTemplateId;
  }

  if (sector.toLowerCase().includes("rag")) {
    return "template-rag-service";
  }

  if (sector.includes("运营")) {
    return "template-ops-automation";
  }

  return "template-smart-service";
}

function renderTemplate(
  template: string,
  values: Record<string, string | undefined>
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return values[key] ?? "";
  });
}

function buildPrdContent(args: {
  project: {
    name: string;
    sector: string;
    owner: string;
    riskNote: string;
    progress: number;
  };
  template: ForgePromptTemplate;
  extraNotes: string;
}) {
  const promptBody = renderTemplate(args.template.template, {
    project_name: args.project.name,
    sector: args.project.sector,
    owner: args.project.owner,
    risk_note: args.project.riskNote,
    extra_notes: args.extraNotes
  });

  return `# ${args.project.name} PRD 草案

## 一、项目概述
- 项目名称：${args.project.name}
- 项目场景：${args.project.sector}
- 当前负责人：${args.project.owner}
- 当前进度：${args.project.progress}%

## 二、核心目标
- 围绕 ${args.project.sector} 场景收敛可交付版本
- 降低当前风险：${args.project.riskNote}
- 让团队可以基于统一任务包继续开发与回归

## 三、关键用户场景
1. 用户提交需求后，系统能快速输出标准化 PRD 草案
2. 工程师基于草案生成任务包并推进实现
3. 在测试验证阶段，关键门禁失败项可以被快速追踪和修复

## 四、功能范围
### P0
- 项目接入与模板选择
- Prompt 模板变量填充
- PRD 草案生成与本地保存
- 测试门禁回归追踪

### P1
- 真实 AI 执行集成
- 经验沉淀与模板提升

## 五、工作流节点计划
1. 项目接入：确认需求、约束和负责人
2. 方案与任务包：收敛实现边界并生成任务包
3. 开发执行：围绕当前任务包推进开发
4. 测试验证：处理失败项并回归
5. 交付发布：生成预览与验收说明
6. 归档复用：沉淀模板、提示词和经验

## 六、验收标准
- 能生成结构化 PRD 草案并持久化
- 草案包含项目目标、功能范围、工作流和风险说明
- 草案与当前项目上下文一致

## 七、补充说明
${args.extraNotes || "暂无额外说明"}

## 八、生成所用 Prompt
${promptBody}
`;
}

const schema = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sector TEXT NOT NULL,
    owner TEXT NOT NULL,
    requirement TEXT NOT NULL DEFAULT '',
    enterprise_name TEXT NOT NULL DEFAULT '',
    project_type TEXT NOT NULL DEFAULT '',
    delivery_date TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    last_run TEXT NOT NULL,
    progress INTEGER NOT NULL,
    risk_note TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    summary TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS components (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    tags_json TEXT NOT NULL,
    recommended_sectors_json TEXT NOT NULL,
    usage_guide TEXT NOT NULL,
    assembly_contract_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    task_pack_id TEXT,
    linked_component_ids_json TEXT NOT NULL DEFAULT '[]',
    title TEXT NOT NULL,
    executor TEXT NOT NULL,
    cost TEXT NOT NULL,
    state TEXT NOT NULL,
    output_mode TEXT,
    output_checks_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS runners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    summary TEXT NOT NULL,
    workspace_path TEXT NOT NULL,
    capabilities_json TEXT NOT NULL,
    detected_capabilities_json TEXT NOT NULL DEFAULT '[]',
    detected_capability_details_json TEXT NOT NULL DEFAULT '[]',
    probe_status TEXT NOT NULL DEFAULT 'unknown',
    probe_summary TEXT NOT NULL DEFAULT '',
    current_run_id TEXT,
    last_heartbeat TEXT NOT NULL,
    last_probe_at TEXT
  );

  CREATE TABLE IF NOT EXISTS delivery_gates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_templates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    sector TEXT NOT NULL,
    summary TEXT NOT NULL,
    dna_summary TEXT NOT NULL,
    default_prompt_ids_json TEXT NOT NULL,
    default_gate_ids_json TEXT NOT NULL,
    constraints_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_profiles (
    project_id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL,
    template_title TEXT NOT NULL,
    team_template_id TEXT,
    team_template_title TEXT,
    workspace_path TEXT NOT NULL,
    dna_summary TEXT NOT NULL,
    default_prompt_ids_json TEXT NOT NULL,
    default_gate_ids_json TEXT NOT NULL,
    constraints_json TEXT NOT NULL,
    initialized_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_workflow_states (
    project_id TEXT PRIMARY KEY,
    current_stage TEXT NOT NULL,
    state TEXT NOT NULL,
    blockers_json TEXT NOT NULL,
    last_transition_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS workflow_transitions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    state TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    blockers_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    scenario TEXT NOT NULL,
    summary TEXT NOT NULL,
    template TEXT NOT NULL,
    variables_json TEXT NOT NULL,
    version TEXT NOT NULL,
    use_count INTEGER NOT NULL,
    last_used_at TEXT
  );

  CREATE TABLE IF NOT EXISTS prd_documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    template_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_asset_links (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation TEXT NOT NULL,
    reason TEXT NOT NULL,
    usage_guide TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    runner_id TEXT NOT NULL DEFAULT '',
    department_label TEXT NOT NULL DEFAULT '',
    persona TEXT NOT NULL,
    system_prompt TEXT NOT NULL DEFAULT '',
    responsibilities_json TEXT NOT NULL,
    skill_ids_json TEXT NOT NULL,
    sop_ids_json TEXT NOT NULL DEFAULT '[]',
    knowledge_sources_json TEXT NOT NULL DEFAULT '[]',
    prompt_template_id TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    permission_profile_id TEXT NOT NULL,
    owner_mode TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    owner_role TEXT NOT NULL,
    summary TEXT NOT NULL,
    usage_guide TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stage TEXT NOT NULL,
    owner_role TEXT NOT NULL,
    summary TEXT NOT NULL,
    checklist_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS team_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    summary TEXT NOT NULL,
    agent_ids_json TEXT NOT NULL,
    lead_agent_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    owner_agent_id TEXT NOT NULL,
    status TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS artifact_reviews (
    id TEXT PRIMARY KEY,
    artifact_id TEXT NOT NULL,
    reviewer_agent_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    summary TEXT NOT NULL,
    conditions_json TEXT NOT NULL,
    reviewed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    title TEXT NOT NULL,
    owner_agent_id TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    category TEXT NOT NULL,
    summary TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS commands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    trigger_stage TEXT NOT NULL,
    requires_artifacts_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS command_hooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    summary TEXT NOT NULL,
    policy TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS command_executions (
    id TEXT PRIMARY KEY,
    command_id TEXT NOT NULL,
    project_id TEXT,
    task_pack_id TEXT,
    run_id TEXT,
    status TEXT NOT NULL,
    summary TEXT NOT NULL,
    triggered_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    follow_up_task_ids_json TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS policy_decisions (
    id TEXT PRIMARY KEY,
    hook_id TEXT NOT NULL,
    command_execution_id TEXT NOT NULL,
    outcome TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS run_events (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    project_id TEXT,
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    failure_category TEXT,
    created_at TEXT NOT NULL
  );
`;

function seedIfEmpty(db: ForgeDb, dbPath?: string) {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM projects")
    .get() as { count: number };

  if (row.count > 0) {
    return;
  }

  const insertProject = db.prepare(`
    INSERT INTO projects (
      id, name, sector, owner, requirement, enterprise_name, project_type, delivery_date, note,
      status, last_run, progress, risk_note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAsset = db.prepare(`
    INSERT INTO assets (id, title, type, summary)
    VALUES (?, ?, ?, ?)
  `);
  const insertComponent = db.prepare(`
    INSERT INTO components (
      id, title, category, summary, source_type, source_ref, tags_json, recommended_sectors_json, usage_guide, assembly_contract_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRun = db.prepare(`
    INSERT INTO runs (
      id, project_id, task_pack_id, linked_component_ids_json, title, executor, cost, state, output_mode, output_checks_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRunner = db.prepare(`
    INSERT INTO runners (
      id, name, status, summary, workspace_path, capabilities_json, detected_capabilities_json,
      detected_capability_details_json,
      probe_status, probe_summary, current_run_id, last_heartbeat, last_probe_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertGate = db.prepare(`
    INSERT INTO delivery_gates (id, name, status)
    VALUES (?, ?, ?)
  `);
  const insertProjectTemplate = db.prepare(`
    INSERT INTO project_templates (
      id, title, sector, summary, dna_summary, default_prompt_ids_json, default_gate_ids_json, constraints_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProjectProfile = db.prepare(`
    INSERT INTO project_profiles (
      project_id, template_id, template_title, team_template_id, team_template_title,
      workspace_path, dna_summary, default_prompt_ids_json, default_gate_ids_json, constraints_json, initialized_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProjectWorkflowState = db.prepare(`
    INSERT INTO project_workflow_states (
      project_id, current_stage, state, blockers_json, last_transition_at, updated_by
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertPromptTemplate = db.prepare(`
    INSERT INTO prompt_templates (
      id, title, scenario, summary, template, variables_json, version, use_count, last_used_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPrdDocument = db.prepare(`
    INSERT INTO prd_documents (
      id, project_id, template_id, title, content, status, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertProjectAssetLink = db.prepare(`
    INSERT INTO project_asset_links (
      id, project_id, target_type, target_id, relation, reason, usage_guide
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertAgent = db.prepare(`
    INSERT INTO agents (
      id, name, role, runner_id, department_label, persona, system_prompt, responsibilities_json, skill_ids_json, sop_ids_json, knowledge_sources_json,
      prompt_template_id, policy_id, permission_profile_id, owner_mode
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSkill = db.prepare(`
    INSERT INTO skills (
      id, name, category, owner_role, summary, usage_guide
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertSop = db.prepare(`
    INSERT INTO sops (
      id, name, stage, owner_role, summary, checklist_json
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertTeamTemplate = db.prepare(`
    INSERT INTO team_templates (
      id, name, summary, agent_ids_json, lead_agent_id
    )
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertArtifact = db.prepare(`
    INSERT INTO artifacts (
      id, project_id, type, title, owner_agent_id, status, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertArtifactReview = db.prepare(`
    INSERT INTO artifact_reviews (
      id, artifact_id, reviewer_agent_id, decision, summary, conditions_json, reviewed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTask = db.prepare(`
    INSERT INTO tasks (
      id, project_id, stage, title, owner_agent_id, status, priority, category, summary
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertCommand = db.prepare(`
    INSERT INTO commands (
      id, name, type, summary, trigger_stage, requires_artifacts_json
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertCommandHook = db.prepare(`
    INSERT INTO command_hooks (
      id, name, summary, policy
    )
    VALUES (?, ?, ?, ?)
  `);
  const insertCommandExecution = db.prepare(`
    INSERT INTO command_executions (
      id, command_id, project_id, task_pack_id, run_id, status, summary, triggered_by, created_at, follow_up_task_ids_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPolicyDecision = db.prepare(`
    INSERT INTO policy_decisions (
      id, hook_id, command_execution_id, outcome, summary, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertRunEvent = db.prepare(`
    INSERT INTO run_events (
      id, run_id, project_id, type, summary, failure_category, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const project of projects) {
    insertProject.run(
      project.id,
      project.name,
      project.sector,
      project.owner,
      project.requirement ?? "",
      project.enterpriseName ?? "",
      project.projectType ?? "",
      project.deliveryDate ?? "",
      project.note ?? "",
      project.status,
      project.lastRun,
      project.progress,
      project.riskNote
    );
  }

  for (const asset of assets) {
    insertAsset.run(asset.id, asset.title, asset.type, asset.summary);
  }

  for (const component of components) {
    insertComponent.run(
      component.id,
      component.title,
      component.category,
      component.summary,
      component.sourceType,
      component.sourceRef,
      toJson(component.tags),
      toJson(component.recommendedSectors),
      component.usageGuide,
      toJson(component.assemblyContract ?? {})
    );
  }

  for (const run of runs) {
    insertRun.run(
      run.id,
      run.projectId ?? null,
      run.taskPackId ?? null,
      toJson(run.linkedComponentIds ?? []),
      run.title,
      run.executor,
      run.cost,
      run.state,
      run.outputMode ?? null,
      toJson(run.outputChecks ?? [])
    );
  }

  for (const seededRunner of runners) {
    const runner = buildSeedRunner(seededRunner, dbPath);
    mkdirSync(runner.workspacePath, { recursive: true });
    insertRunner.run(
      runner.id,
      runner.name,
      runner.status,
      runner.summary,
      runner.workspacePath,
      toJson(runner.capabilities),
      toJson(runner.detectedCapabilities),
      toJson(runner.detectedCapabilityDetails ?? []),
      runner.probeStatus,
      runner.probeSummary,
      runner.currentRunId,
      runner.lastHeartbeat,
      runner.lastProbeAt
    );
  }

  for (const gate of deliveryGate) {
    insertGate.run(gate.id, gate.name, gate.status);
  }

  for (const template of projectTemplates) {
    insertProjectTemplate.run(
      template.id,
      template.title,
      template.sector,
      template.summary,
      template.dnaSummary,
      toJson(template.defaultPromptIds),
      toJson(template.defaultGateIds),
      toJson(template.constraints)
    );
  }

  for (const template of promptTemplates) {
    insertPromptTemplate.run(
      template.id,
      template.title,
      template.scenario,
      template.summary,
      template.template,
      toJson(template.variables),
      template.version,
      template.useCount,
      template.lastUsedAt
    );
  }

  for (const workflow of workflowStates) {
    insertProjectWorkflowState.run(
      workflow.projectId,
      workflow.currentStage,
      workflow.state,
      toJson(workflow.blockers),
      workflow.lastTransitionAt,
      workflow.updatedBy
    );
  }

  for (const transition of workflowTransitions) {
    insertWorkflowTransition(db, transition);
  }

  for (const document of prdDocuments) {
    insertPrdDocument.run(
      document.id,
      document.projectId,
      document.templateId,
      document.title,
      document.content,
      document.status,
      document.createdAt
    );
  }

  for (const link of projectAssetLinks) {
    insertProjectAssetLink.run(
      link.id,
      link.projectId,
      link.targetType,
      link.targetId,
      link.relation,
      link.reason,
      link.usageGuide
    );
  }

  for (const agent of agents) {
    insertAgent.run(
      agent.id,
      agent.name,
      agent.role,
      agent.runnerId,
      agent.departmentLabel ?? getDefaultDepartmentLabel(agent.role),
      agent.persona,
      agent.systemPrompt,
      toJson(agent.responsibilities),
      toJson(agent.skillIds),
      toJson(agent.sopIds),
      toJson(agent.knowledgeSources),
      agent.promptTemplateId,
      agent.policyId,
      agent.permissionProfileId,
      agent.ownerMode
    );
  }

  for (const skill of skills) {
    insertSkill.run(
      skill.id,
      skill.name,
      skill.category,
      skill.ownerRole,
      skill.summary,
      skill.usageGuide
    );
  }

  for (const sop of sops) {
    insertSop.run(
      sop.id,
      sop.name,
      sop.stage,
      sop.ownerRole,
      sop.summary,
      toJson(sop.checklist)
    );
  }

  for (const team of teamTemplates) {
    insertTeamTemplate.run(
      team.id,
      team.name,
      team.summary,
      toJson(team.agentIds),
      team.leadAgentId
    );
  }

  for (const artifact of artifacts) {
    insertArtifact.run(
      artifact.id,
      artifact.projectId,
      artifact.type,
      artifact.title,
      artifact.ownerAgentId,
      artifact.status,
      artifact.updatedAt
    );
  }

  for (const review of artifactReviews) {
    insertArtifactReview.run(
      review.id,
      review.artifactId,
      review.reviewerAgentId,
      review.decision,
      review.summary,
      toJson(review.conditions),
      review.reviewedAt
    );
  }

  for (const task of tasks) {
    insertTask.run(
      task.id,
      task.projectId,
      task.stage,
      task.title,
      task.ownerAgentId,
      task.status,
      task.priority,
      task.category,
      task.summary
    );
  }

  for (const command of commands) {
    insertCommand.run(
      command.id,
      command.name,
      command.type,
      command.summary,
      command.triggerStage,
      toJson(command.requiresArtifacts)
    );
  }

  for (const hook of commandHooks) {
    insertCommandHook.run(hook.id, hook.name, hook.summary, hook.policy);
  }

  for (const execution of commandExecutions) {
    insertCommandExecution.run(
      execution.id,
      execution.commandId,
      execution.projectId ?? null,
      execution.taskPackId ?? null,
      execution.relatedRunId ?? null,
      execution.status,
      execution.summary,
      execution.triggeredBy,
      execution.createdAt,
      toJson(execution.followUpTaskIds ?? [])
    );
  }

  for (const decision of policyDecisions) {
    insertPolicyDecision.run(
      decision.id,
      decision.hookId,
      decision.commandExecutionId,
      decision.outcome,
      decision.summary,
      decision.createdAt
    );
  }

  for (const event of runEvents) {
    insertRunEvent.run(
      event.id,
      event.runId,
      event.projectId ?? null,
      event.type,
      event.summary,
      event.failureCategory,
      event.createdAt
    );
  }

  for (const project of projects) {
    const templateId = resolveTemplateIdForProject(project.id, project.sector);
    const template = projectTemplates.find((item) => item.id === templateId) ?? projectTemplates[0];

    if (!template) {
      continue;
    }

    const profile = buildProjectProfile({ project, template, dbPath });

    insertProjectProfile.run(
      profile.projectId,
      profile.templateId,
      profile.templateTitle,
      profile.teamTemplateId ?? null,
      profile.teamTemplateTitle ?? null,
      profile.workspacePath,
      profile.dnaSummary,
      toJson(profile.defaultPromptIds),
      toJson(profile.defaultGateIds),
      toJson(profile.constraints),
      profile.initializedAt
    );

    createWorkspaceScaffold({ project, profile });
  }

  db.prepare(`
    INSERT INTO app_state (key, value)
    VALUES ('active_project_id', ?)
  `).run(projects[0]?.id ?? "");
  db.prepare(`
    INSERT INTO app_state (key, value)
    VALUES (?, ?)
  `).run(teamWorkbenchStateKey, toJson(buildDefaultTeamWorkbenchState()));
}

function syncSeedData(db: ForgeDb, dbPath?: string) {
  const upsertProject = db.prepare(`
    INSERT INTO projects (
      id, name, sector, owner, requirement, enterprise_name, project_type, delivery_date, note,
      status, last_run, progress, risk_note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      sector = excluded.sector,
      owner = excluded.owner,
      requirement = excluded.requirement,
      enterprise_name = excluded.enterprise_name,
      project_type = excluded.project_type,
      delivery_date = excluded.delivery_date,
      note = excluded.note,
      status = excluded.status,
      last_run = excluded.last_run,
      progress = excluded.progress,
      risk_note = excluded.risk_note
  `);
  const upsertAsset = db.prepare(`
    INSERT INTO assets (id, title, type, summary)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      type = excluded.type,
      summary = excluded.summary
  `);
  const upsertComponent = db.prepare(`
    INSERT INTO components (
      id, title, category, summary, source_type, source_ref, tags_json, recommended_sectors_json, usage_guide, assembly_contract_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      summary = excluded.summary,
      source_type = excluded.source_type,
      source_ref = excluded.source_ref,
      tags_json = excluded.tags_json,
      recommended_sectors_json = excluded.recommended_sectors_json,
      usage_guide = excluded.usage_guide,
      assembly_contract_json = excluded.assembly_contract_json
  `);
  const upsertRun = db.prepare(`
    INSERT INTO runs (
      id, project_id, task_pack_id, linked_component_ids_json, title, executor, cost, state, output_mode, output_checks_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      task_pack_id = excluded.task_pack_id,
      linked_component_ids_json = excluded.linked_component_ids_json,
      title = excluded.title,
      executor = excluded.executor,
      cost = excluded.cost,
      state = excluded.state
  `);
  const upsertRunner = db.prepare(`
    INSERT INTO runners (
      id, name, status, summary, workspace_path, capabilities_json, detected_capabilities_json,
      detected_capability_details_json,
      probe_status, probe_summary, current_run_id, last_heartbeat, last_probe_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      summary = excluded.summary,
      workspace_path = excluded.workspace_path,
      capabilities_json = excluded.capabilities_json,
      detected_capability_details_json = excluded.detected_capability_details_json
  `);
  const upsertGate = db.prepare(`
    INSERT INTO delivery_gates (id, name, status)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name
  `);
  const upsertProjectTemplate = db.prepare(`
    INSERT INTO project_templates (
      id, title, sector, summary, dna_summary, default_prompt_ids_json, default_gate_ids_json, constraints_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      sector = excluded.sector,
      summary = excluded.summary,
      dna_summary = excluded.dna_summary,
      default_prompt_ids_json = excluded.default_prompt_ids_json,
      default_gate_ids_json = excluded.default_gate_ids_json,
      constraints_json = excluded.constraints_json
  `);
  const upsertProjectProfile = db.prepare(`
    INSERT INTO project_profiles (
      project_id, template_id, template_title, team_template_id, team_template_title,
      workspace_path, dna_summary, default_prompt_ids_json, default_gate_ids_json, constraints_json, initialized_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO NOTHING
  `);
  const upsertProjectWorkflowState = db.prepare(`
    INSERT INTO project_workflow_states (
      project_id, current_stage, state, blockers_json, last_transition_at, updated_by
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO NOTHING
  `);
  const upsertWorkflowTransition = db.prepare(`
    INSERT INTO workflow_transitions (
      id, project_id, stage, state, updated_by, blockers_json, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  const upsertPromptTemplate = db.prepare(`
    INSERT INTO prompt_templates (
      id, title, scenario, summary, template, variables_json, version, use_count, last_used_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      scenario = excluded.scenario,
      summary = excluded.summary,
      template = excluded.template,
      variables_json = excluded.variables_json,
      version = excluded.version
  `);
  const upsertPrdDocument = db.prepare(`
    INSERT INTO prd_documents (
      id, project_id, template_id, title, content, status, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  const upsertProjectAssetLink = db.prepare(`
    INSERT INTO project_asset_links (
      id, project_id, target_type, target_id, relation, reason, usage_guide
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      target_type = excluded.target_type,
      target_id = excluded.target_id,
      relation = excluded.relation,
      reason = excluded.reason,
      usage_guide = excluded.usage_guide
  `);
  const upsertAgent = db.prepare(`
    INSERT INTO agents (
      id, name, role, runner_id, department_label, persona, system_prompt, responsibilities_json, skill_ids_json, sop_ids_json, knowledge_sources_json,
      prompt_template_id, policy_id, permission_profile_id, owner_mode
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      role = excluded.role,
      runner_id = excluded.runner_id,
      department_label = excluded.department_label,
      persona = excluded.persona,
      system_prompt = excluded.system_prompt,
      responsibilities_json = excluded.responsibilities_json,
      skill_ids_json = excluded.skill_ids_json,
      sop_ids_json = excluded.sop_ids_json,
      knowledge_sources_json = excluded.knowledge_sources_json,
      prompt_template_id = excluded.prompt_template_id,
      policy_id = excluded.policy_id,
      permission_profile_id = excluded.permission_profile_id,
      owner_mode = excluded.owner_mode
  `);
  const upsertSkill = db.prepare(`
    INSERT INTO skills (
      id, name, category, owner_role, summary, usage_guide
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      owner_role = excluded.owner_role,
      summary = excluded.summary,
      usage_guide = excluded.usage_guide
  `);
  const upsertSop = db.prepare(`
    INSERT INTO sops (
      id, name, stage, owner_role, summary, checklist_json
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      stage = excluded.stage,
      owner_role = excluded.owner_role,
      summary = excluded.summary,
      checklist_json = excluded.checklist_json
  `);
  const upsertTeamTemplate = db.prepare(`
    INSERT INTO team_templates (
      id, name, summary, agent_ids_json, lead_agent_id
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      summary = excluded.summary,
      agent_ids_json = excluded.agent_ids_json,
      lead_agent_id = excluded.lead_agent_id
  `);
  const deleteStaleTeamTemplates = db.prepare(`
    DELETE FROM team_templates
    WHERE id NOT IN (${teamTemplates.map(() => "?").join(", ")})
  `);
  const upsertArtifact = db.prepare(`
    INSERT INTO artifacts (
      id, project_id, type, title, owner_agent_id, status, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      type = excluded.type,
      title = excluded.title,
      owner_agent_id = excluded.owner_agent_id,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);
  const upsertArtifactReview = db.prepare(`
    INSERT INTO artifact_reviews (
      id, artifact_id, reviewer_agent_id, decision, summary, conditions_json, reviewed_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      artifact_id = excluded.artifact_id,
      reviewer_agent_id = excluded.reviewer_agent_id,
      decision = excluded.decision,
      summary = excluded.summary,
      conditions_json = excluded.conditions_json,
      reviewed_at = excluded.reviewed_at
  `);
  const upsertTask = db.prepare(`
    INSERT INTO tasks (
      id, project_id, stage, title, owner_agent_id, status, priority, category, summary
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      stage = excluded.stage,
      title = excluded.title,
      owner_agent_id = excluded.owner_agent_id,
      status = excluded.status,
      priority = excluded.priority,
      category = excluded.category,
      summary = excluded.summary
  `);
  const upsertCommand = db.prepare(`
    INSERT INTO commands (
      id, name, type, summary, trigger_stage, requires_artifacts_json
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      summary = excluded.summary,
      trigger_stage = excluded.trigger_stage,
      requires_artifacts_json = excluded.requires_artifacts_json
  `);
  const upsertCommandHook = db.prepare(`
    INSERT INTO command_hooks (
      id, name, summary, policy
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      summary = excluded.summary,
      policy = excluded.policy
  `);
  const upsertCommandExecution = db.prepare(`
    INSERT INTO command_executions (
      id, command_id, project_id, task_pack_id, run_id, status, summary, triggered_by, created_at, follow_up_task_ids_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  const upsertPolicyDecision = db.prepare(`
    INSERT INTO policy_decisions (
      id, hook_id, command_execution_id, outcome, summary, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  const upsertRunEvent = db.prepare(`
    INSERT INTO run_events (
      id, run_id, project_id, type, summary, failure_category, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  for (const project of projects) {
    upsertProject.run(
      project.id,
      project.name,
      project.sector,
      project.owner,
      project.requirement ?? "",
      project.enterpriseName ?? "",
      project.projectType ?? "",
      project.deliveryDate ?? "",
      project.note ?? "",
      project.status,
      project.lastRun,
      project.progress,
      project.riskNote
    );
  }

  for (const asset of assets) {
    upsertAsset.run(asset.id, asset.title, asset.type, asset.summary);
  }

  for (const component of components) {
    upsertComponent.run(
      component.id,
      component.title,
      component.category,
      component.summary,
      component.sourceType,
      component.sourceRef,
      toJson(component.tags),
      toJson(component.recommendedSectors),
      component.usageGuide,
      toJson(component.assemblyContract ?? {})
    );
  }

  for (const run of runs) {
    const existing = db.prepare(`
      SELECT
        linked_component_ids_json AS linkedComponentIdsJson,
        output_mode AS outputMode,
        output_checks_json AS outputChecksJson
      FROM runs
      WHERE id = ?
    `).get(run.id) as
      | { linkedComponentIdsJson?: string; outputMode?: string | null; outputChecksJson?: string }
      | undefined;

    upsertRun.run(
      run.id,
      run.projectId ?? null,
      run.taskPackId ?? null,
      existing?.linkedComponentIdsJson ?? toJson(run.linkedComponentIds ?? []),
      run.title,
      run.executor,
      run.cost,
      run.state,
      existing?.outputMode ?? run.outputMode ?? null,
      existing?.outputChecksJson ?? toJson(run.outputChecks ?? [])
    );
  }

  for (const seededRunner of runners) {
    const runner = buildSeedRunner(seededRunner, dbPath);
    mkdirSync(runner.workspacePath, { recursive: true });
    upsertRunner.run(
      runner.id,
      runner.name,
      runner.status,
      runner.summary,
      runner.workspacePath,
      toJson(runner.capabilities),
      toJson(runner.detectedCapabilities),
      toJson(runner.detectedCapabilityDetails ?? []),
      runner.probeStatus,
      runner.probeSummary,
      runner.currentRunId,
      runner.lastHeartbeat,
      runner.lastProbeAt
    );
  }

  for (const gate of deliveryGate) {
    upsertGate.run(gate.id, gate.name, gate.status);
  }

  for (const template of projectTemplates) {
    upsertProjectTemplate.run(
      template.id,
      template.title,
      template.sector,
      template.summary,
      template.dnaSummary,
      toJson(template.defaultPromptIds),
      toJson(template.defaultGateIds),
      toJson(template.constraints)
    );
  }

  for (const template of promptTemplates) {
    upsertPromptTemplate.run(
      template.id,
      template.title,
      template.scenario,
      template.summary,
      template.template,
      toJson(template.variables),
      template.version,
      template.useCount,
      template.lastUsedAt
    );
  }

  for (const workflow of workflowStates) {
    upsertProjectWorkflowState.run(
      workflow.projectId,
      workflow.currentStage,
      workflow.state,
      toJson(workflow.blockers),
      workflow.lastTransitionAt,
      workflow.updatedBy
    );
  }

  for (const transition of workflowTransitions) {
    upsertWorkflowTransition.run(
      transition.id,
      transition.projectId,
      transition.stage,
      transition.state,
      transition.updatedBy,
      toJson(transition.blockers),
      transition.createdAt
    );
  }

  for (const document of prdDocuments) {
    upsertPrdDocument.run(
      document.id,
      document.projectId,
      document.templateId,
      document.title,
      document.content,
      document.status,
      document.createdAt
    );
  }

  for (const link of projectAssetLinks) {
    upsertProjectAssetLink.run(
      link.id,
      link.projectId,
      link.targetType,
      link.targetId,
      link.relation,
      link.reason,
      link.usageGuide
    );
  }

  for (const agent of agents) {
    upsertAgent.run(
      agent.id,
      agent.name,
      agent.role,
      agent.runnerId,
      agent.departmentLabel ?? getDefaultDepartmentLabel(agent.role),
      agent.persona,
      agent.systemPrompt,
      toJson(agent.responsibilities),
      toJson(agent.skillIds),
      toJson(agent.sopIds),
      toJson(agent.knowledgeSources),
      agent.promptTemplateId,
      agent.policyId,
      agent.permissionProfileId,
      agent.ownerMode
    );
  }

  for (const skill of skills) {
    upsertSkill.run(
      skill.id,
      skill.name,
      skill.category,
      skill.ownerRole,
      skill.summary,
      skill.usageGuide
    );
  }

  for (const sop of sops) {
    upsertSop.run(
      sop.id,
      sop.name,
      sop.stage,
      sop.ownerRole,
      sop.summary,
      toJson(sop.checklist)
    );
  }

  for (const team of teamTemplates) {
    upsertTeamTemplate.run(
      team.id,
      team.name,
      team.summary,
      toJson(team.agentIds),
      team.leadAgentId
    );
  }

  deleteStaleTeamTemplates.run(...teamTemplates.map((template) => template.id));

  for (const artifact of artifacts) {
    upsertArtifact.run(
      artifact.id,
      artifact.projectId,
      artifact.type,
      artifact.title,
      artifact.ownerAgentId,
      artifact.status,
      artifact.updatedAt
    );
  }

  for (const review of artifactReviews) {
    upsertArtifactReview.run(
      review.id,
      review.artifactId,
      review.reviewerAgentId,
      review.decision,
      review.summary,
      toJson(review.conditions),
      review.reviewedAt
    );
  }

  for (const task of tasks) {
    upsertTask.run(
      task.id,
      task.projectId,
      task.stage,
      task.title,
      task.ownerAgentId,
      task.status,
      task.priority,
      task.category,
      task.summary
    );
  }

  for (const command of commands) {
    upsertCommand.run(
      command.id,
      command.name,
      command.type,
      command.summary,
      command.triggerStage,
      toJson(command.requiresArtifacts)
    );
  }

  for (const hook of commandHooks) {
    upsertCommandHook.run(hook.id, hook.name, hook.summary, hook.policy);
  }

  for (const execution of commandExecutions) {
    upsertCommandExecution.run(
      execution.id,
      execution.commandId,
      execution.projectId ?? null,
      execution.taskPackId ?? null,
      execution.relatedRunId ?? null,
      execution.status,
      execution.summary,
      execution.triggeredBy,
      execution.createdAt,
      toJson(execution.followUpTaskIds ?? [])
    );
  }

  for (const decision of policyDecisions) {
    upsertPolicyDecision.run(
      decision.id,
      decision.hookId,
      decision.commandExecutionId,
      decision.outcome,
      decision.summary,
      decision.createdAt
    );
  }

  for (const event of runEvents) {
    upsertRunEvent.run(
      event.id,
      event.runId,
      event.projectId ?? null,
      event.type,
      event.summary,
      event.failureCategory,
      event.createdAt
    );
  }

  for (const project of projects) {
    const templateId = resolveTemplateIdForProject(project.id, project.sector);
    const template = projectTemplates.find((item) => item.id === templateId) ?? projectTemplates[0];

    if (!template) {
      continue;
    }

    const profile = buildProjectProfile({ project, template, dbPath });

    upsertProjectProfile.run(
      profile.projectId,
      profile.templateId,
      profile.templateTitle,
      profile.teamTemplateId ?? null,
      profile.teamTemplateTitle ?? null,
      profile.workspacePath,
      profile.dnaSummary,
      toJson(profile.defaultPromptIds),
      toJson(profile.defaultGateIds),
      toJson(profile.constraints),
      profile.initializedAt
    );

    upsertProjectWorkflowState.run(
      project.id,
      "项目接入",
      "current",
      toJson([]),
      profile.initializedAt,
      "system"
    );

    for (const link of buildProjectAssetLinks({ projectId: project.id, template })) {
      upsertProjectAssetLink.run(
        link.id,
        link.projectId,
        link.targetType,
        link.targetId,
        link.relation,
        link.reason,
        link.usageGuide
      );
    }

    createWorkspaceScaffold({ project, profile });
  }
}

type ForgeSeedMode = "if-empty" | "sync-demo";

export function ensureForgeDatabase(dbPath?: string, seedMode: ForgeSeedMode = "if-empty") {
  const db = openDatabase(dbPath);

  db.exec(schema);
  ensureOptionalColumn(db, "projects", "requirement", "requirement TEXT NOT NULL DEFAULT ''");
  ensureOptionalColumn(
    db,
    "projects",
    "enterprise_name",
    "enterprise_name TEXT NOT NULL DEFAULT ''"
  );
  ensureOptionalColumn(db, "projects", "project_type", "project_type TEXT NOT NULL DEFAULT ''");
  ensureOptionalColumn(db, "projects", "delivery_date", "delivery_date TEXT NOT NULL DEFAULT ''");
  ensureOptionalColumn(db, "projects", "note", "note TEXT NOT NULL DEFAULT ''");
  ensureOptionalColumn(
    db,
    "components",
    "assembly_contract_json",
    "assembly_contract_json TEXT NOT NULL DEFAULT '{}'"
  );
  ensureOptionalColumn(db, "runs", "project_id", "project_id TEXT");
  ensureOptionalColumn(db, "runs", "task_pack_id", "task_pack_id TEXT");
  ensureOptionalColumn(
    db,
    "runs",
    "linked_component_ids_json",
    "linked_component_ids_json TEXT NOT NULL DEFAULT '[]'"
  );
  ensureOptionalColumn(db, "runs", "output_mode", "output_mode TEXT");
  ensureOptionalColumn(db, "runs", "output_checks_json", "output_checks_json TEXT NOT NULL DEFAULT '[]'");
  ensureOptionalColumn(db, "command_executions", "task_pack_id", "task_pack_id TEXT");
  ensureOptionalColumn(db, "command_executions", "run_id", "run_id TEXT");
  ensureOptionalColumn(
    db,
    "command_executions",
    "follow_up_task_ids_json",
    "follow_up_task_ids_json TEXT NOT NULL DEFAULT '[]'"
  );
  ensureOptionalColumn(db, "project_profiles", "team_template_id", "team_template_id TEXT");
  ensureOptionalColumn(db, "project_profiles", "team_template_title", "team_template_title TEXT");
  ensureOptionalColumn(
    db,
    "runners",
    "detected_capabilities_json",
    "detected_capabilities_json TEXT NOT NULL DEFAULT '[]'"
  );
  ensureOptionalColumn(
    db,
    "runners",
    "detected_capability_details_json",
    "detected_capability_details_json TEXT NOT NULL DEFAULT '[]'"
  );
  ensureOptionalColumn(
    db,
    "runners",
    "probe_status",
    "probe_status TEXT NOT NULL DEFAULT 'unknown'"
  );
  ensureOptionalColumn(
    db,
    "runners",
    "probe_summary",
    "probe_summary TEXT NOT NULL DEFAULT ''"
  );
  ensureOptionalColumn(db, "runners", "last_probe_at", "last_probe_at TEXT");
  ensureOptionalColumn(db, "agents", "runner_id", "runner_id TEXT NOT NULL DEFAULT ''");
  ensureOptionalColumn(
    db,
    "agents",
    "department_label",
    "department_label TEXT NOT NULL DEFAULT ''"
  );
  ensureOptionalColumn(db, "agents", "system_prompt", "system_prompt TEXT NOT NULL DEFAULT ''");
  ensureOptionalColumn(db, "agents", "sop_ids_json", "sop_ids_json TEXT NOT NULL DEFAULT '[]'");
  ensureOptionalColumn(
    db,
    "agents",
    "knowledge_sources_json",
    "knowledge_sources_json TEXT NOT NULL DEFAULT '[]'"
  );
  const seedMissingComponent = db.prepare(`
    INSERT INTO components (
      id, title, category, summary, source_type, source_ref, tags_json, recommended_sectors_json, usage_guide, assembly_contract_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      assembly_contract_json = CASE
        WHEN components.assembly_contract_json = '{}' OR components.assembly_contract_json = ''
          THEN excluded.assembly_contract_json
        ELSE components.assembly_contract_json
      END,
      usage_guide = CASE
        WHEN components.usage_guide = ''
          THEN excluded.usage_guide
        ELSE components.usage_guide
      END
  `);

  for (const seededAgent of agents) {
    db.prepare(`
      UPDATE agents
      SET runner_id = CASE
            WHEN runner_id = '' THEN ?
            ELSE runner_id
          END,
          department_label = CASE
            WHEN department_label = '' THEN ?
            ELSE department_label
          END
      WHERE id = ?
    `).run(
      seededAgent.runnerId,
      seededAgent.departmentLabel ?? getDefaultDepartmentLabel(seededAgent.role),
      seededAgent.id
    );
  }

  db.prepare(`
    UPDATE agents
    SET department_label = CASE role
      WHEN 'pm' THEN '管理层'
      WHEN 'architect' THEN '产品与方案'
      WHEN 'design' THEN '产品与方案'
      WHEN 'engineer' THEN '技术研发'
      WHEN 'qa' THEN '技术研发'
      WHEN 'release' THEN '技术研发'
      WHEN 'knowledge' THEN '运营支持'
      ELSE department_label
    END
    WHERE department_label = ''
  `).run();

  seedIfEmpty(db, dbPath);

  for (const component of components) {
    seedMissingComponent.run(
      component.id,
      component.title,
      component.category,
      component.summary,
      component.sourceType,
      component.sourceRef,
      toJson(component.tags),
      toJson(component.recommendedSectors),
      component.usageGuide,
      toJson(component.assemblyContract ?? {})
    );
  }

  if (seedMode === "sync-demo") {
    syncSeedData(db, dbPath);
    saveStoredTeamWorkbenchState(db, buildDefaultTeamWorkbenchState());
  }

  db.close();
}

export function setActiveProject(projectId: string, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    db.prepare(`
      INSERT INTO app_state (key, value)
      VALUES ('active_project_id', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(projectId);
  } finally {
    db.close();
  }
}

export function getTeamWorkbenchState(dbPath?: string): ForgeTeamWorkbenchState {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    return loadStoredTeamWorkbenchState(db);
  } finally {
    db.close();
  }
}

export function updateTeamWorkbenchState(
  state: ForgeTeamWorkbenchState,
  dbPath?: string
): ForgeTeamWorkbenchState {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const normalizedState = normalizeTeamWorkbenchState(state);
    saveStoredTeamWorkbenchState(db, normalizedState);
    return normalizedState;
  } finally {
    db.close();
  }
}

export function getProjectWorkbenchState(dbPath?: string): ForgeProjectWorkbenchState {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    return loadStoredProjectWorkbenchState(db);
  } finally {
    db.close();
  }
}

export function updateProjectWorkbenchState(
  state: ForgeProjectWorkbenchState,
  dbPath?: string
): ForgeProjectWorkbenchState {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const normalizedState = normalizeProjectWorkbenchState(state);
    saveStoredProjectWorkbenchState(db, normalizedState);
    return normalizedState;
  } finally {
    db.close();
  }
}

export function getModelProviderSettings(dbPath?: string): ForgeModelProviderSetting[] {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const state = loadStoredModelProviderState(db);

    return (Object.keys(modelProviderCatalog) as ForgeModelProviderId[]).map((providerId) =>
      normalizeModelProviderSetting(providerId, state[providerId])
    );
  } finally {
    db.close();
  }
}

export function getModelProviderSecret(
  providerId: ForgeModelProviderId,
  dbPath?: string
) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const state = loadStoredModelProviderState(db);

    return state[providerId]?.apiKey?.trim() || null;
  } finally {
    db.close();
  }
}

export function updateModelProviderSettings(
  input: ForgeModelProviderSettingsInput,
  dbPath?: string
): ForgeModelProviderSetting {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const state = loadStoredModelProviderState(db);
    const current = state[input.providerId] ?? {};
    const definition = modelProviderCatalog[input.providerId];
    const nextApiKey = input.apiKey?.trim() ? input.apiKey.trim() : current.apiKey?.trim() ?? "";
    const shouldAutoEnable = Boolean(input.apiKey?.trim());
    const nextState: StoredModelProviderConfig = {
      enabled: shouldAutoEnable ? true : input.enabled ?? current.enabled ?? false,
      apiKey: nextApiKey || undefined,
      modelPriority: normalizeTextList(input.modelPriority, current.modelPriority ?? definition.defaultModelPriority),
      status: current.status ?? "untested",
      lastTestedAt: current.lastTestedAt ?? null,
      lastTestMessage: current.lastTestMessage ?? null
    };

    state[input.providerId] = nextState;
    saveStoredModelProviderState(db, state);

    return normalizeModelProviderSetting(input.providerId, nextState);
  } finally {
    db.close();
  }
}

export function recordModelProviderConnectionResult(
  providerId: ForgeModelProviderId,
  input: {
    status: ForgeModelProviderConnectionStatus;
    testedAt: string;
    message: string;
  },
  dbPath?: string
): ForgeModelProviderSetting {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const state = loadStoredModelProviderState(db);
    const current = state[providerId] ?? {};
    const nextState: StoredModelProviderConfig = {
      ...current,
      modelPriority: normalizeTextList(
        current.modelPriority,
        modelProviderCatalog[providerId].defaultModelPriority
      ),
      status: input.status,
      lastTestedAt: input.testedAt,
      lastTestMessage: input.message
    };

    state[providerId] = nextState;
    saveStoredModelProviderState(db, state);

    return normalizeModelProviderSetting(providerId, nextState);
  } finally {
    db.close();
  }
}

export function createProject(project: ForgeProjectDraft, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    db.prepare(`
      INSERT INTO projects (
        id, name, sector, owner, requirement, enterprise_name, project_type, delivery_date, note,
        status, last_run, progress, risk_note
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '刚刚', 0, '等待首次执行')
    `).run(
      project.id,
      project.name,
      project.sector,
      project.owner,
      project.requirement ?? "",
      project.enterpriseName ?? "",
      project.projectType ?? "",
      project.deliveryDate ?? "",
      project.note ?? ""
    );

    const templateId = project.templateId || resolveTemplateIdForProject(project.id, project.sector);
    const templateRow = db.prepare(`
      SELECT
        id,
        title,
        sector,
        summary,
        dna_summary AS dnaSummary,
        default_prompt_ids_json AS defaultPromptIdsJson,
        default_gate_ids_json AS defaultGateIdsJson,
        constraints_json AS constraintsJson
      FROM project_templates
      WHERE id = ?
    `).get(templateId) as ProjectTemplateRow | undefined;
    const template = templateRow
      ? normalizeProjectTemplate(templateRow)
      : projectTemplates[0];

    if (template) {
      const profile = buildProjectProfile({
        project,
        template,
        teamTemplateId: project.teamTemplateId,
        dbPath
      });
      const links = buildProjectAssetLinks({
        projectId: project.id,
        template
      });
      const bootstrapArtifacts = buildProjectBootstrapArtifacts({
        projectId: project.id,
        projectName: project.name,
        initializedAt: profile.initializedAt
      });
      const bootstrapTasks = buildProjectBootstrapTasks({
        projectId: project.id,
        projectName: project.name,
        templateTitle: profile.templateTitle,
        dnaSummary: profile.dnaSummary,
        defaultGateIds: profile.defaultGateIds
      });

      db.prepare(`
        INSERT INTO project_profiles (
          project_id, template_id, template_title, team_template_id, team_template_title,
          workspace_path, dna_summary, default_prompt_ids_json, default_gate_ids_json, constraints_json, initialized_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        profile.projectId,
        profile.templateId,
        profile.templateTitle,
        profile.teamTemplateId ?? null,
        profile.teamTemplateTitle ?? null,
        profile.workspacePath,
        profile.dnaSummary,
        toJson(profile.defaultPromptIds),
        toJson(profile.defaultGateIds),
        toJson(profile.constraints),
        profile.initializedAt
      );

      db.prepare(`
        INSERT INTO project_workflow_states (
          project_id, current_stage, state, blockers_json, last_transition_at, updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(project.id, "项目接入", "current", toJson([]), profile.initializedAt, "system");

      insertWorkflowTransition(db, {
        projectId: project.id,
        stage: "项目接入",
        state: "current",
        updatedBy: "system",
        blockers: [],
        createdAt: profile.initializedAt
      });

      for (const link of links) {
        db.prepare(`
          INSERT INTO project_asset_links (
            id, project_id, target_type, target_id, relation, reason, usage_guide
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            project_id = excluded.project_id,
            target_type = excluded.target_type,
            target_id = excluded.target_id,
            relation = excluded.relation,
            reason = excluded.reason,
            usage_guide = excluded.usage_guide
        `).run(
          link.id,
          link.projectId,
          link.targetType,
          link.targetId,
          link.relation,
          link.reason,
          link.usageGuide
        );
      }

      for (const artifact of bootstrapArtifacts) {
        db.prepare(`
          INSERT INTO artifacts (
            id, project_id, type, title, owner_agent_id, status, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          artifact.id,
          artifact.projectId,
          artifact.type,
          artifact.title,
          artifact.ownerAgentId,
          artifact.status,
          artifact.updatedAt
        );
      }

      for (const task of bootstrapTasks) {
        db.prepare(`
          INSERT INTO tasks (
            id, project_id, stage, title, owner_agent_id, status, priority, category, summary
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.id,
          task.projectId,
          task.stage,
          task.title,
          task.ownerAgentId,
          task.status,
          task.priority,
          task.category,
          task.summary
        );
      }

      createWorkspaceScaffold({ project, profile });
    }
  } finally {
    db.close();
  }

  setActiveProject(project.id, dbPath);
}

export function updateProjectOverview(input: UpdateProjectOverviewInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const row = db.prepare(`
      SELECT
        id,
        name,
        sector,
        owner,
        requirement,
        enterprise_name AS enterpriseName,
        project_type AS projectType,
        delivery_date AS deliveryDate,
        note,
        status,
        last_run AS lastRun,
        progress,
        risk_note AS riskNote
      FROM projects
      WHERE id = ?
    `).get(input.projectId) as
      | {
          id: string;
          name: string;
          sector: string;
          owner: string;
          requirement: string;
          enterpriseName: string;
          projectType: string;
          deliveryDate: string;
          note: string;
          status: ForgeProject["status"];
          lastRun: string;
          progress: number;
          riskNote: string;
        }
      | undefined;

    if (!row) {
      throw new Error("项目不存在");
    }

    db.prepare(`
      UPDATE projects
      SET status = ?,
          last_run = ?,
          progress = ?,
          risk_note = ?
      WHERE id = ?
    `).run(
      input.status ?? row.status,
      input.lastRun?.trim() || row.lastRun,
      typeof input.progress === "number" ? input.progress : row.progress,
      input.riskNote?.trim() || row.riskNote,
      input.projectId
    );

    return db.prepare(`
      SELECT
        id,
        name,
        sector,
        owner,
        requirement,
        enterprise_name AS enterpriseName,
        project_type AS projectType,
        delivery_date AS deliveryDate,
        note,
        status,
        last_run AS lastRun,
        progress,
        risk_note AS riskNote
      FROM projects
      WHERE id = ?
    `).get(input.projectId) as {
      id: string;
      name: string;
      sector: string;
      owner: string;
      requirement: string;
      enterpriseName: string;
      projectType: string;
      deliveryDate: string;
      note: string;
      status: ForgeProject["status"];
      lastRun: string;
      progress: number;
      riskNote: string;
    };
  } finally {
    db.close();
  }
}

export function updateProjectDetails(input: UpdateProjectDetailsInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const row = db.prepare(`
      SELECT
        id,
        name,
        sector,
        owner,
        requirement,
        enterprise_name AS enterpriseName,
        project_type AS projectType,
        delivery_date AS deliveryDate,
        note,
        status,
        last_run AS lastRun,
        progress,
        risk_note AS riskNote
      FROM projects
      WHERE id = ?
    `).get(input.projectId) as
      | {
          id: string;
          name: string;
          sector: string;
          owner: string;
          requirement: string;
          enterpriseName: string;
          projectType: string;
          deliveryDate: string;
          note: string;
          status: ForgeProject["status"];
          lastRun: string;
          progress: number;
          riskNote: string;
        }
      | undefined;

    if (!row) {
      throw new Error("项目不存在");
    }

    db.prepare(`
      UPDATE projects
      SET requirement = ?,
          enterprise_name = ?,
          name = ?,
          sector = ?,
          project_type = ?,
          owner = ?,
          delivery_date = ?,
          note = ?
      WHERE id = ?
    `).run(
      input.requirement?.trim() ?? row.requirement,
      input.enterpriseName?.trim() ?? row.enterpriseName,
      input.name?.trim() ?? row.name,
      input.sector?.trim() ?? row.sector,
      input.projectType?.trim() ?? row.projectType,
      input.owner?.trim() ?? row.owner,
      input.deliveryDate?.trim() ?? row.deliveryDate,
      input.note?.trim() ?? row.note,
      input.projectId
    );

    const normalizedTeamTemplateId = input.teamTemplateId?.trim();
    if (normalizedTeamTemplateId) {
      const teamTemplate = teamTemplates.find((item) => item.id === normalizedTeamTemplateId);

      if (!teamTemplate) {
        throw new Error("AI团队不存在");
      }

      db.prepare(`
        UPDATE project_profiles
        SET team_template_id = ?,
            team_template_title = ?
        WHERE project_id = ?
      `).run(teamTemplate.id, teamTemplate.name, input.projectId);
    }

    return db.prepare(`
      SELECT
        id,
        name,
        sector,
        owner,
        requirement,
        enterprise_name AS enterpriseName,
        project_type AS projectType,
        delivery_date AS deliveryDate,
        note,
        status,
        last_run AS lastRun,
        progress,
        risk_note AS riskNote
      FROM projects
      WHERE id = ?
    `).get(input.projectId) as ForgeProject;
  } finally {
    db.close();
  }
}

export function deleteProject(projectId: string, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const existingProject = db.prepare(`
      SELECT id
      FROM projects
      WHERE id = ?
    `).get(projectId) as { id: string } | undefined;

    if (!existingProject) {
      throw new Error("项目不存在");
    }

    const currentActiveProjectId = readAppStateValue(db, "active_project_id")?.trim() || null;

    const deleteProjectTransaction = db.transaction(() => {
      const projectWorkbenchState = loadStoredProjectWorkbenchState(db);

      if (projectId in projectWorkbenchState) {
        const nextProjectWorkbenchState = { ...projectWorkbenchState };
        delete nextProjectWorkbenchState[projectId];
        saveStoredProjectWorkbenchState(db, nextProjectWorkbenchState);
      }

      db.prepare(`
        DELETE FROM policy_decisions
        WHERE command_execution_id IN (
          SELECT id
          FROM command_executions
          WHERE project_id = ?
        )
      `).run(projectId);

      db.prepare(`
        DELETE FROM artifact_reviews
        WHERE artifact_id IN (
          SELECT id
          FROM artifacts
          WHERE project_id = ?
        )
      `).run(projectId);

      db.prepare(`
        DELETE FROM run_events
        WHERE project_id = ?
           OR run_id IN (
             SELECT id
             FROM runs
             WHERE project_id = ?
           )
      `).run(projectId, projectId);

      db.prepare(`DELETE FROM command_executions WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM prd_documents WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM project_asset_links WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM workflow_transitions WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM project_workflow_states WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM project_profiles WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM artifacts WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM tasks WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM runs WHERE project_id = ?`).run(projectId);
      db.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);
    });

    deleteProjectTransaction();

    const currentActiveProjectStillExists =
      currentActiveProjectId && currentActiveProjectId !== projectId
        ? Boolean(
            db.prepare(`
              SELECT id
              FROM projects
              WHERE id = ?
            `).get(currentActiveProjectId)
          )
        : false;
    const nextActiveProjectId =
      currentActiveProjectStillExists && currentActiveProjectId
        ? currentActiveProjectId
        : ((db.prepare(`
            SELECT id
            FROM projects
            ORDER BY
              CASE status
                WHEN 'active' THEN 0
                WHEN 'risk' THEN 1
                ELSE 2
              END,
              name ASC
            LIMIT 1
          `).get() as { id: string } | undefined)?.id ?? null);

    writeAppStateValue(db, "active_project_id", nextActiveProjectId ?? "");

    return {
      deletedProjectId: projectId,
      activeProjectId: nextActiveProjectId
    };
  } finally {
    db.close();
  }
}

export function updateDeliveryGateStatuses(
  items: UpdateDeliveryGateStatusInput[],
  dbPath?: string
) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const updateGate = db.prepare(`
      UPDATE delivery_gates
      SET status = ?
      WHERE id = ?
    `);

    for (const item of items) {
      updateGate.run(item.status, item.id);
    }

    return db.prepare(`
      SELECT
        id,
        name,
        status
      FROM delivery_gates
      ORDER BY rowid ASC
    `).all() as DeliveryGateItem[];
  } finally {
    db.close();
  }
}

export function updateAgentProfile(input: UpdateAgentProfileInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const agentRow = db.prepare(`
      SELECT
        id,
        name,
        role,
        runner_id AS runnerId,
        department_label AS departmentLabel,
        persona,
        system_prompt AS systemPrompt,
        responsibilities_json AS responsibilitiesJson,
        skill_ids_json AS skillIdsJson,
        sop_ids_json AS sopIdsJson,
        knowledge_sources_json AS knowledgeSourcesJson,
        prompt_template_id AS promptTemplateId,
        policy_id AS policyId,
        permission_profile_id AS permissionProfileId,
        owner_mode AS ownerMode
      FROM agents
      WHERE id = ?
    `).get(input.agentId) as AgentRow | undefined;

    if (!agentRow) {
      throw new Error("Agent 不存在");
    }

    const promptTemplateExists = db.prepare(`
      SELECT id
      FROM prompt_templates
      WHERE id = ?
    `).get(input.promptTemplateId) as { id: string } | undefined;

    if (!promptTemplateExists) {
      throw new Error("Prompt 模板不存在");
    }

    const nextPersona =
      typeof input.persona === "string" ? input.persona.trim() : agentRow.persona;
    const nextName = typeof input.name === "string" ? input.name.trim() : agentRow.name;
    const nextRole = input.role ?? agentRow.role;
    const nextRunnerId =
      typeof input.runnerId === "string" ? input.runnerId.trim() : agentRow.runnerId;
    const nextDepartmentLabel =
      typeof input.departmentLabel === "string"
        ? input.departmentLabel.trim()
        : agentRow.departmentLabel || getDefaultDepartmentLabel(nextRole);
    const nextPolicyId =
      typeof input.policyId === "string" ? input.policyId.trim() : agentRow.policyId;
    const nextPermissionProfileId =
      typeof input.permissionProfileId === "string"
        ? input.permissionProfileId.trim()
        : agentRow.permissionProfileId;
    const nextSkillIds = input.skillIds ?? fromJson<string[]>(agentRow.skillIdsJson);
    const nextOwnerMode = input.ownerMode ?? agentRow.ownerMode;

    const runnerExists = db.prepare(`
      SELECT id
      FROM runners
      WHERE id = ?
    `).get(nextRunnerId) as { id: string } | undefined;

    if (!runnerExists) {
      throw new Error("Runner 不存在");
    }

    db.prepare(`
      UPDATE agents
      SET name = ?,
          role = ?,
          runner_id = ?,
          department_label = ?,
          persona = ?,
          policy_id = ?,
          permission_profile_id = ?,
          prompt_template_id = ?,
          system_prompt = ?,
          skill_ids_json = ?,
          owner_mode = ?,
          knowledge_sources_json = ?
      WHERE id = ?
    `).run(
      nextName,
      nextRole,
      nextRunnerId,
      nextDepartmentLabel,
      nextPersona,
      nextPolicyId,
      nextPermissionProfileId,
      input.promptTemplateId,
      input.systemPrompt,
      toJson(nextSkillIds),
      nextOwnerMode,
      toJson(input.knowledgeSources),
      input.agentId
    );

    const updatedRow = db.prepare(`
      SELECT
        id,
        name,
        role,
        runner_id AS runnerId,
        department_label AS departmentLabel,
        persona,
        system_prompt AS systemPrompt,
        responsibilities_json AS responsibilitiesJson,
        skill_ids_json AS skillIdsJson,
        sop_ids_json AS sopIdsJson,
        knowledge_sources_json AS knowledgeSourcesJson,
        prompt_template_id AS promptTemplateId,
        policy_id AS policyId,
        permission_profile_id AS permissionProfileId,
        owner_mode AS ownerMode
      FROM agents
      WHERE id = ?
    `).get(input.agentId) as AgentRow;

    return normalizeAgent(updatedRow);
  } finally {
    db.close();
  }
}

export function upsertProjectComponentLink(input: UpsertProjectComponentLinkInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const project = db.prepare(`
      SELECT id
      FROM projects
      WHERE id = ?
    `).get(input.projectId) as { id: string } | undefined;

    if (!project) {
      throw new Error("项目不存在");
    }

    const component = db.prepare(`
      SELECT
        id,
        title,
        category,
        summary,
        source_type AS sourceType,
        source_ref AS sourceRef,
        tags_json AS tagsJson,
        recommended_sectors_json AS recommendedSectorsJson,
        usage_guide AS usageGuide,
        assembly_contract_json AS assemblyContractJson
      FROM components
      WHERE id = ?
    `).get(input.componentId) as ComponentRow | undefined;

    if (!component) {
      throw new Error("组件不存在");
    }

    const linkId = `link-${input.projectId}-component-${input.componentId}`;

    db.prepare(`
      INSERT INTO project_asset_links (
        id, project_id, target_type, target_id, relation, reason, usage_guide
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        relation = excluded.relation,
        reason = excluded.reason,
        usage_guide = excluded.usage_guide
    `).run(
      linkId,
      input.projectId,
      "component",
      input.componentId,
      input.relation ?? "recommended",
      input.reason,
      input.usageGuide
    );

    return {
      linkId,
      component: normalizeComponent(component)
    };
  } finally {
    db.close();
  }
}

export function updateProjectWorkflowState(input: UpdateProjectWorkflowStateInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const project = db.prepare(`
      SELECT id
      FROM projects
      WHERE id = ?
    `).get(input.projectId) as { id: string } | undefined;

    if (!project) {
      throw new Error("项目不存在");
    }

    const lastTransitionAt = formatRelativeNow();

    db.prepare(`
      INSERT INTO project_workflow_states (
        project_id, current_stage, state, blockers_json, last_transition_at, updated_by
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        current_stage = excluded.current_stage,
        state = excluded.state,
        blockers_json = excluded.blockers_json,
        last_transition_at = excluded.last_transition_at,
        updated_by = excluded.updated_by
    `).run(
      input.projectId,
      input.currentStage,
      input.state,
      toJson(input.blockers),
      lastTransitionAt,
      input.updatedBy
    );

    insertWorkflowTransition(db, {
      projectId: input.projectId,
      stage: input.currentStage,
      state: input.state,
      updatedBy: input.updatedBy,
      blockers: input.blockers,
      createdAt: lastTransitionAt
    });

    const row = db.prepare(`
      SELECT
        project_id AS projectId,
        current_stage AS currentStage,
        state,
        blockers_json AS blockersJson,
        last_transition_at AS lastTransitionAt,
        updated_by AS updatedBy
      FROM project_workflow_states
      WHERE project_id = ?
    `).get(input.projectId) as ProjectWorkflowStateRow;

    return normalizeProjectWorkflowState(row);
  } finally {
    db.close();
  }
}

export function upsertProjectArtifact(input: UpsertProjectArtifactInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const updatedAt = input.updatedAt ?? formatRelativeNow();
    const existing = db.prepare(`
      SELECT
        id,
        project_id AS projectId,
        type,
        title,
        owner_agent_id AS ownerAgentId,
        status,
        updated_at AS updatedAt
      FROM artifacts
      WHERE project_id = ? AND type = ?
      ORDER BY updated_at DESC, rowid DESC
      LIMIT 1
    `).get(input.projectId, input.type) as ArtifactRow | undefined;

    const artifactId = existing?.id ?? `artifact-${input.projectId}-${input.type}-${Date.now().toString(36)}`;

    db.prepare(`
      INSERT INTO artifacts (
        id, project_id, type, title, owner_agent_id, status, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        owner_agent_id = excluded.owner_agent_id,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(
      artifactId,
      input.projectId,
      input.type,
      input.title,
      input.ownerAgentId,
      input.status,
      updatedAt
    );

    const updated = db.prepare(`
      SELECT
        id,
        project_id AS projectId,
        type,
        title,
        owner_agent_id AS ownerAgentId,
        status,
        updated_at AS updatedAt
      FROM artifacts
      WHERE id = ?
    `).get(artifactId) as ArtifactRow;

    return normalizeArtifact(updated);
  } finally {
    db.close();
  }
}

export function upsertArtifactReview(input: UpsertArtifactReviewInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const reviewedAt = input.reviewedAt ?? formatRelativeNow();
    const existing = db.prepare(`
      SELECT
        id,
        artifact_id AS artifactId,
        reviewer_agent_id AS reviewerAgentId,
        decision,
        summary,
        conditions_json AS conditionsJson,
        reviewed_at AS reviewedAt
      FROM artifact_reviews
      WHERE artifact_id = ? AND reviewer_agent_id = ?
      ORDER BY reviewed_at DESC, rowid DESC
      LIMIT 1
    `).get(input.artifactId, input.reviewerAgentId) as ArtifactReviewRow | undefined;

    const reviewId =
      existing?.id ??
      `review-${input.artifactId}-${input.reviewerAgentId}-${Date.now().toString(36)}`;

    db.prepare(`
      INSERT INTO artifact_reviews (
        id, artifact_id, reviewer_agent_id, decision, summary, conditions_json, reviewed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        artifact_id = excluded.artifact_id,
        reviewer_agent_id = excluded.reviewer_agent_id,
        decision = excluded.decision,
        summary = excluded.summary,
        conditions_json = excluded.conditions_json,
        reviewed_at = excluded.reviewed_at
    `).run(
      reviewId,
      input.artifactId,
      input.reviewerAgentId,
      input.decision,
      input.summary,
      toJson(input.conditions),
      reviewedAt
    );

    const updated = db.prepare(`
      SELECT
        id,
        artifact_id AS artifactId,
        reviewer_agent_id AS reviewerAgentId,
        decision,
        summary,
        conditions_json AS conditionsJson,
        reviewed_at AS reviewedAt
      FROM artifact_reviews
      WHERE id = ?
    `).get(reviewId) as ArtifactReviewRow;

    return normalizeArtifactReview(updated);
  } finally {
    db.close();
  }
}

export function updateProjectTasks(input: UpdateProjectTasksInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const conditions = ["project_id = ?"];
    const params: Array<string> = [input.projectId];

    if (input.taskId) {
      conditions.push("id = ?");
      params.push(input.taskId);
    }

    if (input.titleIncludes) {
      conditions.push("title LIKE ?");
      params.push(`%${input.titleIncludes}%`);
    }

    if (input.stage) {
      conditions.push("stage = ?");
      params.push(input.stage);
    }

    const rows = db.prepare(`
      SELECT
        id,
        project_id AS projectId,
        stage,
        title,
        owner_agent_id AS ownerAgentId,
        status,
        priority,
        category,
        summary
      FROM tasks
      WHERE ${conditions.join(" AND ")}
    `).all(...params) as TaskRow[];

    if (rows.length === 0) {
      return [];
    }

    const updateTask = db.prepare(`
      UPDATE tasks
      SET status = ?,
          summary = ?
      WHERE id = ?
    `);

    rows.forEach((row) => {
      updateTask.run(input.status, input.summary?.trim() || row.summary, row.id);
    });

    return db.prepare(`
      SELECT
        id,
        project_id AS projectId,
        stage,
        title,
        owner_agent_id AS ownerAgentId,
        status,
        priority,
        category,
        summary
      FROM tasks
      WHERE ${conditions.join(" AND ")}
    `).all(...params).map((row) => normalizeTask(row as TaskRow));
  } finally {
    db.close();
  }
}

export function upsertProjectTask(input: UpsertProjectTaskInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    db.prepare(`
      INSERT INTO tasks (
        id, project_id, stage, title, owner_agent_id, status, priority, category, summary
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        stage = excluded.stage,
        title = excluded.title,
        owner_agent_id = excluded.owner_agent_id,
        status = excluded.status,
        priority = excluded.priority,
        category = excluded.category,
        summary = excluded.summary
    `).run(
      input.id,
      input.projectId,
      input.stage,
      input.title,
      input.ownerAgentId,
      input.status,
      input.priority,
      input.category,
      input.summary
    );

    const updated = db.prepare(`
      SELECT
        id,
        project_id AS projectId,
        stage,
        title,
        owner_agent_id AS ownerAgentId,
        status,
        priority,
        category,
        summary
      FROM tasks
      WHERE id = ?
    `).get(input.id) as TaskRow;

    return normalizeTask(updated);
  } finally {
    db.close();
  }
}

export function updateRunnerHeartbeat(input: UpdateRunnerHeartbeatInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const runner = db.prepare(`
      SELECT
        id,
        name,
        status,
        summary,
        workspace_path AS workspacePath,
        capabilities_json AS capabilitiesJson,
        detected_capabilities_json AS detectedCapabilitiesJson,
        detected_capability_details_json AS detectedCapabilityDetailsJson,
        probe_status AS probeStatus,
        probe_summary AS probeSummary,
        current_run_id AS currentRunId,
        last_heartbeat AS lastHeartbeat,
        last_probe_at AS lastProbeAt
      FROM runners
      WHERE id = ?
    `).get(input.runnerId) as RunnerRow | undefined;

    if (!runner) {
      throw new Error("Runner 不存在");
    }

    db.prepare(`
      UPDATE runners
      SET status = ?,
          current_run_id = ?,
          last_heartbeat = ?
      WHERE id = ?
    `).run(input.status, input.currentRunId, input.lastHeartbeat, input.runnerId);

    const updated = db.prepare(`
      SELECT
        id,
        name,
        status,
        summary,
        workspace_path AS workspacePath,
        capabilities_json AS capabilitiesJson,
        detected_capabilities_json AS detectedCapabilitiesJson,
        detected_capability_details_json AS detectedCapabilityDetailsJson,
        probe_status AS probeStatus,
        probe_summary AS probeSummary,
        current_run_id AS currentRunId,
        last_heartbeat AS lastHeartbeat,
        last_probe_at AS lastProbeAt
      FROM runners
      WHERE id = ?
    `).get(input.runnerId) as RunnerRow;

    return normalizeRunner(updated);
  } finally {
    db.close();
  }
}

export function probeRunners(input: ProbeRunnersInput = {}, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const rows = db.prepare(`
      SELECT
        id,
        name,
        status,
        summary,
        workspace_path AS workspacePath,
        capabilities_json AS capabilitiesJson,
        detected_capabilities_json AS detectedCapabilitiesJson,
        detected_capability_details_json AS detectedCapabilityDetailsJson,
        probe_status AS probeStatus,
        probe_summary AS probeSummary,
        current_run_id AS currentRunId,
        last_heartbeat AS lastHeartbeat,
        last_probe_at AS lastProbeAt
      FROM runners
      ${input.runnerId ? "WHERE id = ?" : ""}
      ORDER BY name ASC
    `).all(...(input.runnerId ? [input.runnerId] : [])) as RunnerRow[];

    const now = new Date().toISOString();

    const items = rows.map((row) => {
      const runner = normalizeRunner(row);
      const probe = probeRunnerState(runner);

      db.prepare(`
      UPDATE runners
      SET status = ?,
          detected_capabilities_json = ?,
          detected_capability_details_json = ?,
          probe_status = ?,
          probe_summary = ?,
          last_heartbeat = ?,
          last_probe_at = ?
      WHERE id = ?
      `).run(
        probe.status,
        toJson(probe.detectedCapabilities),
        toJson(probe.detectedCapabilityDetails),
        probe.probeStatus,
        probe.probeSummary,
        now,
        now,
        runner.id
      );

      const updated = db.prepare(`
        SELECT
          id,
          name,
          status,
          summary,
          workspace_path AS workspacePath,
          capabilities_json AS capabilitiesJson,
          detected_capabilities_json AS detectedCapabilitiesJson,
          detected_capability_details_json AS detectedCapabilityDetailsJson,
          probe_status AS probeStatus,
          probe_summary AS probeSummary,
          current_run_id AS currentRunId,
          last_heartbeat AS lastHeartbeat,
          last_probe_at AS lastProbeAt
        FROM runners
        WHERE id = ?
      `).get(runner.id) as RunnerRow;

      return {
        runner: normalizeRunner(updated),
        probeStatus: probe.probeStatus,
        probeSummary: probe.probeSummary,
        detectedCapabilities: probe.detectedCapabilities,
        detectedCapabilityDetails: probe.detectedCapabilityDetails
      };
    });

    return {
      probedCount: items.length,
      items
    };
  } finally {
    db.close();
  }
}

export function upsertRun(input: UpsertRunInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const events = [buildRunEventFromInput(input), buildRunOutputEventFromInput(input)].filter(
      Boolean
    ) as ForgeRunEvent[];

    db.prepare(`
      INSERT INTO runs (
        id, project_id, task_pack_id, linked_component_ids_json, title, executor, cost, state, output_mode, output_checks_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        task_pack_id = excluded.task_pack_id,
        linked_component_ids_json = excluded.linked_component_ids_json,
        title = excluded.title,
        executor = excluded.executor,
        cost = excluded.cost,
        state = excluded.state,
        output_mode = excluded.output_mode,
        output_checks_json = excluded.output_checks_json
    `).run(
      input.id,
      input.projectId ?? null,
      input.taskPackId ?? null,
      toJson(input.linkedComponentIds ?? []),
      input.title,
      input.executor,
      input.cost,
      input.state,
      input.outputMode ?? null,
      toJson(input.outputChecks ?? [])
    );

    const upsertRunEvent = db.prepare(`
      INSERT INTO run_events (id, run_id, project_id, type, summary, failure_category, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const event of events) {
      upsertRunEvent.run(
        event.id,
        event.runId,
        event.projectId ?? null,
        event.type,
        event.summary,
        event.failureCategory,
        event.createdAt
      );
    }

    const row = db.prepare(`
      SELECT
        id,
        project_id AS projectId,
        task_pack_id AS taskPackId,
        linked_component_ids_json AS linkedComponentIdsJson,
        title,
        executor,
        cost,
        state,
        output_mode AS outputMode,
        output_checks_json AS outputChecksJson
      FROM runs
      WHERE id = ?
    `).get(input.id) as RunRow;

    return {
      run: normalizeRun(row),
      event: events[0],
      events
    };
  } finally {
    db.close();
  }
}

export function listRunTimeline(
  options: { projectId?: string; runId?: string } = {},
  dbPath?: string
) {
  const snapshot = loadDashboardSnapshot(dbPath);
  const items = snapshot.runs.filter((run) => {
    const matchesProject = options.projectId ? run.projectId === options.projectId : true;
    const matchesRun = options.runId ? run.id === options.runId : true;

    return matchesProject && matchesRun;
  });
  const events = snapshot.runEvents.filter((event) => {
    const matchesProject = options.projectId ? event.projectId === options.projectId : true;
    const matchesRun = options.runId ? event.runId === options.runId : true;

    return matchesProject && matchesRun;
  });
  const latestFailure =
    events.find((event) => event.type === "failure") ?? null;

  return {
    totalRuns: items.length,
    totalEvents: events.length,
    latestFailure,
    items,
    events
  };
}

export function generatePrdDraft(input: GeneratePrdDraftInput, dbPath?: string) {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const project = db.prepare(`
      SELECT
        id,
        name,
        sector,
        owner,
        requirement,
        enterprise_name AS enterpriseName,
        project_type AS projectType,
        delivery_date AS deliveryDate,
        note,
        status,
        last_run AS lastRun,
        progress,
        risk_note AS riskNote
      FROM projects
      WHERE id = ?
    `).get(input.projectId) as
      | {
          id: string;
          name: string;
          sector: string;
          owner: string;
          requirement: string;
          enterpriseName: string;
          projectType: string;
          deliveryDate: string;
          note: string;
          status: string;
          lastRun: string;
          progress: number;
          riskNote: string;
        }
      | undefined;

    const templateRow = db.prepare(`
      SELECT
        id,
        title,
        scenario,
        summary,
        template,
        variables_json AS variablesJson,
        version,
        use_count AS useCount,
        last_used_at AS lastUsedAt
      FROM prompt_templates
      WHERE id = ?
    `).get(input.templateId) as PromptTemplateRow | undefined;

    if (!project) {
      throw new Error("项目不存在");
    }

    if (!templateRow) {
      throw new Error("Prompt 模板不存在");
    }

    const template = parseVariables(templateRow);
    const content = buildPrdContent({
      project,
      template,
      extraNotes: input.extraNotes?.trim() || "暂无"
    });
    const createdAt = formatRelativeNow();
    const document = {
      id: `prd-${Date.now().toString(36)}`,
      projectId: project.id,
      templateId: template.id,
      title: `${project.name} PRD 草案`,
      content,
      status: "draft" as const,
      createdAt
    };

    db.prepare(`
      INSERT INTO prd_documents (
        id, project_id, template_id, title, content, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      document.id,
      document.projectId,
      document.templateId,
      document.title,
      document.content,
      document.status,
      document.createdAt
    );

    db.prepare(`
      UPDATE prompt_templates
      SET use_count = use_count + 1,
          last_used_at = ?
      WHERE id = ?
    `).run(createdAt, template.id);

    db.prepare(`
      INSERT INTO runs (id, project_id, title, executor, cost, state)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `run-prd-${Date.now().toString(36)}`,
      project.id,
      `生成 ${project.name} PRD 草案`,
      "Claude",
      "$0.36",
      "done"
    );

    return document;
  } finally {
    db.close();
  }
}

export function loadDashboardSnapshot(dbPath?: string): ForgeDashboardSnapshot {
  ensureForgeDatabase(dbPath);

  const db = openDatabase(dbPath);

  try {
    const appState = db.prepare(`
      SELECT value
      FROM app_state
      WHERE key = 'active_project_id'
    `).get() as { value?: string } | undefined;
    const teamWorkbenchState = loadStoredTeamWorkbenchState(db);
    const projectWorkbenchState = loadStoredProjectWorkbenchState(db);
    const projectRows = db.prepare(`
      SELECT
        id,
        name,
        sector,
        owner,
        requirement,
        enterprise_name AS enterpriseName,
        project_type AS projectType,
        delivery_date AS deliveryDate,
        note,
        status,
        last_run AS lastRun,
        progress,
        risk_note AS riskNote
      FROM projects
      ORDER BY
        CASE status
          WHEN 'active' THEN 0
          WHEN 'risk' THEN 1
          ELSE 2
        END,
        name ASC
    `).all();
    const activeProjectId =
      appState?.value?.trim() || (projectRows[0] as { id: string } | undefined)?.id || null;

    return {
      activeProjectId,
      projects: projectRows,
      projectTemplates: db.prepare(`
        SELECT
          id,
          title,
          sector,
          summary,
          dna_summary AS dnaSummary,
          default_prompt_ids_json AS defaultPromptIdsJson,
          default_gate_ids_json AS defaultGateIdsJson,
          constraints_json AS constraintsJson
        FROM project_templates
        ORDER BY title ASC
      `).all().map((row) => normalizeProjectTemplate(row as ProjectTemplateRow)),
      projectProfiles: db.prepare(`
        SELECT
          project_id AS projectId,
          template_id AS templateId,
          template_title AS templateTitle,
          team_template_id AS teamTemplateId,
          team_template_title AS teamTemplateTitle,
          workspace_path AS workspacePath,
          dna_summary AS dnaSummary,
          default_prompt_ids_json AS defaultPromptIdsJson,
          default_gate_ids_json AS defaultGateIdsJson,
          constraints_json AS constraintsJson,
          initialized_at AS initializedAt
        FROM project_profiles
        ORDER BY project_id ASC
      `).all().map((row) => normalizeProjectProfile(row as ProjectProfileRow)),
      workflowStates: db.prepare(`
        SELECT
          project_id AS projectId,
          current_stage AS currentStage,
          state,
          blockers_json AS blockersJson,
          last_transition_at AS lastTransitionAt,
          updated_by AS updatedBy
        FROM project_workflow_states
        ORDER BY project_id ASC
      `).all().map((row) => normalizeProjectWorkflowState(row as ProjectWorkflowStateRow)),
      workflowTransitions: db.prepare(`
        SELECT
          id,
          project_id AS projectId,
          stage,
          state,
          updated_by AS updatedBy,
          blockers_json AS blockersJson,
          created_at AS createdAt
        FROM workflow_transitions
        ORDER BY rowid DESC
      `).all().map((row) => normalizeWorkflowTransition(row as WorkflowTransitionRow)),
      assets: db.prepare(`
        SELECT id, title, type, summary
        FROM assets
        ORDER BY title ASC
      `).all(),
      components: db.prepare(`
        SELECT
          id,
          title,
          category,
          summary,
          source_type AS sourceType,
          source_ref AS sourceRef,
          tags_json AS tagsJson,
          recommended_sectors_json AS recommendedSectorsJson,
          usage_guide AS usageGuide,
          assembly_contract_json AS assemblyContractJson
        FROM components
        ORDER BY title ASC
      `).all().map((row) => normalizeComponent(row as ComponentRow)),
      promptTemplates: db.prepare(`
        SELECT
          id,
          title,
          scenario,
          summary,
          template,
          variables_json AS variablesJson,
          version,
          use_count AS useCount,
          last_used_at AS lastUsedAt
        FROM prompt_templates
        ORDER BY use_count DESC, title ASC
      `).all().map((row) => parseVariables(row as PromptTemplateRow)),
      prdDocuments: db.prepare(`
        SELECT
          id,
          project_id AS projectId,
          template_id AS templateId,
          title,
          content,
          status,
          created_at AS createdAt
        FROM prd_documents
        ORDER BY rowid DESC
      `).all().map((row) => normalizePrdDocument(row as PrdDocumentRow)),
      projectAssetLinks: db.prepare(`
        SELECT
          id,
          project_id AS projectId,
          target_type AS targetType,
          target_id AS targetId,
          relation,
          reason,
          usage_guide AS usageGuide
        FROM project_asset_links
        ORDER BY project_id ASC, id ASC
      `).all().map((row) => normalizeProjectAssetLink(row as ProjectAssetLinkRow)),
      agents: db.prepare(`
        SELECT
          id,
          name,
          role,
          runner_id AS runnerId,
          department_label AS departmentLabel,
          persona,
          system_prompt AS systemPrompt,
          responsibilities_json AS responsibilitiesJson,
          skill_ids_json AS skillIdsJson,
          sop_ids_json AS sopIdsJson,
          knowledge_sources_json AS knowledgeSourcesJson,
          prompt_template_id AS promptTemplateId,
          policy_id AS policyId,
          permission_profile_id AS permissionProfileId,
          owner_mode AS ownerMode
        FROM agents
        ORDER BY name ASC
      `).all().map((row) => normalizeAgent(row as AgentRow)),
      skills: db.prepare(`
        SELECT
          id,
          name,
          category,
          owner_role AS ownerRole,
          summary,
          usage_guide AS usageGuide
        FROM skills
        ORDER BY name ASC
      `).all().map((row) => normalizeSkill(row as SkillRow)),
      sops: db.prepare(`
        SELECT
          id,
          name,
          stage,
          owner_role AS ownerRole,
          summary,
          checklist_json AS checklistJson
        FROM sops
        ORDER BY name ASC
      `).all().map((row) => normalizeSop(row as SopRow)),
      teamTemplates: (() => {
        const canonicalTemplateIds = new Set(defaultTeamWorkbenchTemplates.map((template) => template.id));
        const persistedTemplates = db.prepare(`
        SELECT
          id,
          name,
          summary,
          agent_ids_json AS agentIdsJson,
          lead_agent_id AS leadAgentId
        FROM team_templates
        ORDER BY name ASC
      `).all().map((row) => normalizeTeamTemplate(row as TeamTemplateRow));
        const filteredTemplates = persistedTemplates.filter((template) =>
          canonicalTemplateIds.has(template.id)
        );
        return defaultTeamWorkbenchTemplates.map(
          (template) => filteredTemplates.find((item) => item.id === template.id) ?? template
        );
      })(),
      artifacts: db.prepare(`
        SELECT
          id,
          project_id AS projectId,
          type,
          title,
          owner_agent_id AS ownerAgentId,
          status,
          updated_at AS updatedAt
        FROM artifacts
        ORDER BY updated_at DESC, title ASC
      `).all().map((row) => normalizeArtifact(row as ArtifactRow)),
      artifactReviews: db.prepare(`
        SELECT
          id,
          artifact_id AS artifactId,
          reviewer_agent_id AS reviewerAgentId,
          decision,
          summary,
          conditions_json AS conditionsJson,
          reviewed_at AS reviewedAt
        FROM artifact_reviews
        ORDER BY reviewed_at DESC, id ASC
      `).all().map((row) => normalizeArtifactReview(row as ArtifactReviewRow)),
      tasks: db.prepare(`
        SELECT
          id,
          project_id AS projectId,
          stage,
          title,
          owner_agent_id AS ownerAgentId,
          status,
          priority,
          category,
          summary
        FROM tasks
        ORDER BY
          CASE priority
            WHEN 'P0' THEN 0
            WHEN 'P1' THEN 1
            ELSE 2
          END,
          CASE status
            WHEN 'blocked' THEN 0
            WHEN 'in-progress' THEN 1
            WHEN 'todo' THEN 2
            ELSE 3
          END,
          title ASC
      `).all().map((row) => normalizeTask(row as TaskRow)),
      commands: db.prepare(`
        SELECT
          id,
          name,
          type,
          summary,
          trigger_stage AS triggerStage,
          requires_artifacts_json AS requiresArtifactsJson
        FROM commands
        ORDER BY rowid ASC
      `).all().map((row) => normalizeCommand(row as CommandRow)),
      commandHooks: db.prepare(`
        SELECT
          id,
          name,
          summary,
          policy
        FROM command_hooks
        ORDER BY rowid ASC
      `).all().map((row) => normalizeCommandHook(row as CommandHookRow)),
      commandExecutions: db.prepare(`
        SELECT
          id,
          command_id AS commandId,
          project_id AS projectId,
          task_pack_id AS taskPackId,
          run_id AS relatedRunId,
          status,
          summary,
          triggered_by AS triggeredBy,
          created_at AS createdAt,
          follow_up_task_ids_json AS followUpTaskIdsJson
        FROM command_executions
        ORDER BY created_at DESC, rowid DESC
      `).all().map((row) => normalizeCommandExecution(row as CommandExecutionRow)),
      policyDecisions: db.prepare(`
        SELECT
          id,
          hook_id AS hookId,
          command_execution_id AS commandExecutionId,
          outcome,
          summary,
          created_at AS createdAt
        FROM policy_decisions
        ORDER BY created_at DESC, rowid DESC
      `).all().map((row) => normalizePolicyDecision(row as PolicyDecisionRow)),
      runs: db.prepare(`
        SELECT
          id,
          project_id AS projectId,
          task_pack_id AS taskPackId,
          linked_component_ids_json AS linkedComponentIdsJson,
          title,
          executor,
          cost,
          state,
          output_mode AS outputMode,
          output_checks_json AS outputChecksJson
        FROM runs
        ORDER BY rowid DESC
      `).all().map((row) => normalizeRun(row as RunRow)),
      runEvents: db.prepare(`
        SELECT
          id,
          run_id AS runId,
          project_id AS projectId,
          type,
          summary,
          failure_category AS failureCategory,
          created_at AS createdAt
        FROM run_events
        ORDER BY rowid DESC
      `).all().map((row) => normalizeRunEvent(row as RunEventRow)),
      runners: db.prepare(`
        SELECT
          id,
          name,
          status,
          summary,
          workspace_path AS workspacePath,
          capabilities_json AS capabilitiesJson,
          detected_capabilities_json AS detectedCapabilitiesJson,
          detected_capability_details_json AS detectedCapabilityDetailsJson,
          probe_status AS probeStatus,
          probe_summary AS probeSummary,
          current_run_id AS currentRunId,
          last_heartbeat AS lastHeartbeat,
          last_probe_at AS lastProbeAt
        FROM runners
        ORDER BY
          CASE status
            WHEN 'busy' THEN 0
            WHEN 'blocked' THEN 1
            WHEN 'idle' THEN 2
            ELSE 3
          END,
          name ASC
      `).all().map((row) => normalizeRunner(row as RunnerRow)),
      deliveryGate: db.prepare(`
        SELECT id, name, status
        FROM delivery_gates
        ORDER BY name ASC
      `).all(),
      teamWorkbenchState,
      projectWorkbenchState
    } as ForgeDashboardSnapshot;
  } finally {
    db.close();
  }
}
