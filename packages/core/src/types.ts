export type ForgeProjectStatus = "active" | "risk" | "ready";

export type ForgeWorkflowStage =
  | "项目接入"
  | "方案与任务包"
  | "开发执行"
  | "测试验证"
  | "交付发布"
  | "归档复用";

export type ForgeWorkflowStateStatus = "current" | "blocked";

export type ForgeProject = {
  id: string;
  name: string;
  sector: string;
  owner: string;
  requirement?: string;
  enterpriseName?: string;
  projectType?: string;
  deliveryDate?: string;
  note?: string;
  status: ForgeProjectStatus;
  lastRun: string;
  progress: number;
  riskNote: string;
};

export type ForgeProjectDraft = {
  id: string;
  name: string;
  sector: string;
  owner: string;
  requirement?: string;
  enterpriseName?: string;
  projectType?: string;
  deliveryDate?: string;
  note?: string;
  templateId?: string;
  teamTemplateId?: string;
};

export type ForgeAsset = {
  id: string;
  title: string;
  type: "template" | "prompt" | "skill" | "gate";
  summary: string;
};

export type ForgeComponentCategory =
  | "auth"
  | "payment"
  | "file"
  | "data"
  | "communication";

export type ForgeComponentSourceType = "internal" | "github";

export type ForgeComponentAssemblyDeliveryMode =
  | "workspace-package"
  | "local-template"
  | "git-repo"
  | "npm-package";

export type ForgeComponentAssemblyContract = {
  deliveryMode: ForgeComponentAssemblyDeliveryMode;
  sourceLocator: string;
  importPath: string;
  installCommand: string | null;
  peerDeps: string[];
  requiredEnv: string[];
  setupSteps: string[];
  smokeTestCommand: string | null;
  ownedPaths: string[];
};

export type ForgeExternalComponentCandidateSourceType = "github-candidate";

export type ForgeExternalComponentCandidateMaturity = "seed" | "active" | "established";

export type ForgeExternalComponentCandidateSecurityTier = "unknown" | "community";

export type ForgeComponent = {
  id: string;
  title: string;
  category: ForgeComponentCategory;
  summary: string;
  sourceType: ForgeComponentSourceType;
  sourceRef: string;
  tags: string[];
  recommendedSectors: string[];
  usageGuide: string;
  assemblyContract?: ForgeComponentAssemblyContract;
};

export type ForgeExternalComponentCandidate = {
  id: string;
  title: string;
  summary: string;
  sourceType: ForgeExternalComponentCandidateSourceType;
  sourceRef: string;
  repoFullName: string;
  language: string | null;
  stars: number;
  updatedAt: string | null;
  topics: string[];
  maturity: ForgeExternalComponentCandidateMaturity;
  securityTier: ForgeExternalComponentCandidateSecurityTier;
  matchedComponentIds: string[];
  matchedCategories: ForgeComponentCategory[];
  recommendationReason: string;
};

export type ForgePromptTemplate = {
  id: string;
  title: string;
  scenario: string;
  summary: string;
  template: string;
  variables: string[];
  version: string;
  useCount: number;
  lastUsedAt: string | null;
};

export type ForgeProjectTemplate = {
  id: string;
  title: string;
  sector: string;
  summary: string;
  dnaSummary: string;
  defaultPromptIds: string[];
  defaultGateIds: string[];
  constraints: string[];
};

export type ForgeProjectProfile = {
  projectId: string;
  templateId: string;
  templateTitle: string;
  teamTemplateId?: string;
  teamTemplateTitle?: string;
  workspacePath: string;
  dnaSummary: string;
  defaultPromptIds: string[];
  defaultGateIds: string[];
  constraints: string[];
  initializedAt: string;
};

export type ForgeProjectWorkflowState = {
  projectId: string;
  currentStage: ForgeWorkflowStage;
  state: ForgeWorkflowStateStatus;
  blockers: string[];
  lastTransitionAt: string;
  updatedBy: string;
};

export type ForgeWorkflowTransition = {
  id: string;
  projectId: string;
  stage: ForgeWorkflowStage;
  state: ForgeWorkflowStateStatus;
  updatedBy: string;
  blockers: string[];
  createdAt: string;
};

export type ForgePrdDocument = {
  id: string;
  projectId: string;
  templateId: string;
  title: string;
  content: string;
  status: "draft" | "ready";
  createdAt: string;
};

export type ForgeAgentRole =
  | "pm"
  | "architect"
  | "design"
  | "engineer"
  | "qa"
  | "release"
  | "knowledge";

export type ForgeAgentOwnerMode = "human-approved" | "review-required" | "auto-execute";

export type ForgeAgent = {
  id: string;
  name: string;
  role: ForgeAgentRole;
  runnerId: string;
  departmentLabel?: string;
  persona: string;
  systemPrompt: string;
  responsibilities: string[];
  skillIds: string[];
  sopIds: string[];
  knowledgeSources: string[];
  promptTemplateId: string;
  policyId: string;
  permissionProfileId: string;
  ownerMode: ForgeAgentOwnerMode;
};

export type ForgeSkillCategory =
  | "product"
  | "architecture"
  | "design"
  | "engineering"
  | "quality"
  | "release"
  | "knowledge";

export type ForgeSkill = {
  id: string;
  name: string;
  category: ForgeSkillCategory;
  ownerRole: ForgeAgentRole;
  summary: string;
  usageGuide: string;
  line?: string;
  displayCategory?: string;
  sourceLabel?: string;
  sourcePath?: string;
  recommendedRoles?: ForgeAgentRole[];
};

export type ForgeSop = {
  id: string;
  name: string;
  stage: ForgeWorkflowStage;
  ownerRole: ForgeAgentRole;
  summary: string;
  checklist: string[];
};

export type ForgeTeamTemplate = {
  id: string;
  name: string;
  summary: string;
  agentIds: string[];
  leadAgentId: string;
};

export type ForgeEquippedPackRef = {
  source: "preset" | "custom";
  id: string;
};

export type ForgeCustomAbilityPack = {
  id: string;
  name: string;
  line: string;
  category: string;
  summary: string;
  skillIds: string[];
  updatedAt: string;
};

export type ForgeSkillCatalogOverride = {
  name: string;
  summary: string;
  line: string;
  category: string;
};

export type ForgeOrgDepartment = {
  label: string;
};

export type ForgeOrgChartMember = {
  id: string;
  name: string;
  role: ForgeAgentRole;
  departmentLabel: string;
};

export type ForgeTeamWorkbenchCategory =
  | "orgChart"
  | "organization"
  | "employees"
  | "templates"
  | "automation"
  | "governance";

export type ForgeTeamWorkbenchEmployeeDetailTab = "basic" | "ability" | "runtime";

export type ForgeTeamWorkbenchAbilityTab = "equipped" | "skills" | "packs" | "custom";

export type ForgeTeamWorkbenchState = {
  managedAgents: ForgeAgent[];
  selectedTemplateId?: string | null;
  activeCategory?: ForgeTeamWorkbenchCategory | null;
  employeeDetailTab?: ForgeTeamWorkbenchEmployeeDetailTab | null;
  abilityTemplateTab?: ForgeTeamWorkbenchAbilityTab | null;
  selectedAgentId?: string | null;
  selectedBuilderRole?: ForgeAgentRole | null;
  selectedPoolAgentId?: string | null;
  selectedPoolDepartment?: string | null;
  selectedManagementDepartment?: string | null;
  selectedTemplateDepartment?: string | null;
  selectedGovernanceDepartment?: string | null;
  selectedAbilityLine?: string | null;
  selectedRecommendedPackId?: string | null;
  selectedCustomPackId?: string | null;
  isCurrentPackListCollapsed?: boolean;
  roleAssignments: Record<ForgeAgentRole, string | null>;
  manualSkillIdsByAgentId: Record<string, string[]>;
  manualKnowledgeSourcesByAgentId: Record<string, string[]>;
  removedPackSkillIdsByAgentId: Record<string, Record<string, string[]>>;
  equippedPackByAgentId: Record<string, ForgeEquippedPackRef[]>;
  orgDepartments: ForgeOrgDepartment[];
  orgChartMembers: ForgeOrgChartMember[];
  customAbilityPacks: ForgeCustomAbilityPack[];
  skillCatalogOverrides?: Record<string, ForgeSkillCatalogOverride>;
  hiddenSkillIds?: string[];
  governanceOverridesByAgentId?: Record<string, { enabled: string[]; disabled: string[] }>;
};

export type ForgeProjectWorkbenchNode =
  | "需求确认"
  | "项目原型"
  | "UI设计"
  | "后端研发"
  | "DEMO测试"
  | "内测调优"
  | "交付发布";

export type ForgeProjectWorkbenchMessage = {
  id: string;
  speaker: string;
  role: "human" | "ai";
  text: string;
  time: string;
  tokenUsage?: ForgeTokenUsage | null;
};

export type ForgeProjectWorkbenchDocument = {
  title: string;
  body: string;
  updatedAt?: string | null;
};

export type ForgeProjectWorkbenchConversationTab = {
  id: string;
  label: string;
  messages: ForgeProjectWorkbenchMessage[];
};

export type ForgeProjectWorkbenchDocumentTab = {
  id: string;
  label: string;
  document: ForgeProjectWorkbenchDocument | null;
};

export type ForgeProjectWorkbenchNodeState = {
  conversationTabs: ForgeProjectWorkbenchConversationTab[];
  activeConversationTabId: string;
  documentTabs: ForgeProjectWorkbenchDocumentTab[];
  activeDocumentTabId: string;
};

export type ForgeProjectWorkbenchWorkspaceViewState = {
  isOpen?: boolean | null;
  selectedFilePath?: string | null;
  expandedDirectories?: string[];
};

export type ForgeProjectWorkbenchProjectState = {
  selectedNode?: ForgeProjectWorkbenchNode | null;
  workspaceView?: ForgeProjectWorkbenchWorkspaceViewState;
  drafts: Partial<Record<ForgeProjectWorkbenchNode, string>>;
  nodePanels: Partial<Record<ForgeProjectWorkbenchNode, ForgeProjectWorkbenchNodeState>>;
};

export type ForgeProjectWorkbenchState = Record<string, ForgeProjectWorkbenchProjectState>;

export type ForgeResolvedAgentContextBudget = {
  maxSkills: number;
  maxSops: number;
  maxKnowledgeSnippets: number;
  maxDeliverables: number;
};

export type ForgeResolvedAgentContextIdentity = {
  agentId: string;
  name: string;
  role: ForgeAgentRole;
  persona: string;
  ownerMode: ForgeAgentOwnerMode;
};

export type ForgeResolvedAgentContextSkill = {
  id: string;
  name: string;
  summary: string;
  usageGuide: string;
};

export type ForgeResolvedAgentContextSop = {
  id: string;
  name: string;
  summary: string;
  checklist: string[];
};

export type ForgeResolvedAgentContextKnowledgeSnippet = {
  label: string;
  summary: string;
  sourceTitle: string;
  matchReason: string;
};

export type ForgeResolvedAgentContextDeliverable = {
  id: string;
  type: ForgeArtifactType | "prd-document";
  label: string;
  title: string;
  status: string;
  updatedAt: string;
  summary: string;
};

export type ForgeResolvedAgentContextTool = {
  id: string;
  label: string;
  summary: string;
  mode: "read" | "write" | "execute" | "review";
};

export type ForgeResolvedAgentContextPathContract = {
  workspaceRoot: string;
  artifactsRoot: string;
  uploadsRoot: string;
  knowledgeRoot: string;
  skillsRoot: string;
};

export type ForgeResolvedAgentProjectContext = {
  projectId: string;
  projectName: string;
  goal: string;
  currentNode: ForgeProjectWorkbenchNode | null;
  currentStage: ForgeWorkflowStage | null;
  blockers: string[];
};

export type ForgeResolvedAgentContext = {
  identity: ForgeResolvedAgentContextIdentity;
  rolePrompt: string;
  skills: ForgeResolvedAgentContextSkill[];
  sops: ForgeResolvedAgentContextSop[];
  knowledgeSources: string[];
  knowledgeSnippets: ForgeResolvedAgentContextKnowledgeSnippet[];
  projectContext: ForgeResolvedAgentProjectContext;
  deliverables: ForgeResolvedAgentContextDeliverable[];
  tools: ForgeResolvedAgentContextTool[];
  paths: ForgeResolvedAgentContextPathContract;
  budget: ForgeResolvedAgentContextBudget;
};

export type ForgeArtifactType =
  | "prd"
  | "architecture-note"
  | "ui-spec"
  | "task-pack"
  | "assembly-plan"
  | "patch"
  | "review-report"
  | "demo-build"
  | "test-report"
  | "playwright-run"
  | "review-decision"
  | "release-brief"
  | "release-audit"
  | "knowledge-card";

export type ForgeArtifactStatus = "draft" | "in-review" | "ready";

export type ForgeArtifact = {
  id: string;
  projectId: string;
  type: ForgeArtifactType;
  title: string;
  ownerAgentId: string;
  status: ForgeArtifactStatus;
  updatedAt: string;
};

export type ForgeArtifactReviewDecision = "pass" | "changes-requested" | "pending";

export type ForgeArtifactReview = {
  id: string;
  artifactId: string;
  reviewerAgentId: string;
  decision: ForgeArtifactReviewDecision;
  summary: string;
  conditions: string[];
  reviewedAt: string;
};

export type ForgeProjectAssetLinkTarget = "prompt" | "asset" | "template" | "gate" | "component";

export type ForgeProjectAssetLinkRelation = "default" | "required" | "recommended";

export type ForgeProjectAssetLink = {
  id: string;
  projectId: string;
  targetType: ForgeProjectAssetLinkTarget;
  targetId: string;
  relation: ForgeProjectAssetLinkRelation;
  reason: string;
  usageGuide: string;
};

export type ForgeAssetRecommendationManagementGroup =
  | "启动资产"
  | "执行资产"
  | "规则资产"
  | "证据资产"
  | "知识资产";

export type ForgeAssetRecommendationPriority = "required" | "recommended" | "reference";

export type ForgeAssetRecommendationSourceKind =
  | "project-template"
  | "prompt-template"
  | "asset"
  | "gate"
  | "component"
  | "skill"
  | "sop"
  | "artifact"
  | "knowledge-asset";

export type ForgeAssetRecommendationItem = {
  id: string;
  title: string;
  sourceKind: ForgeAssetRecommendationSourceKind;
  managementGroup: ForgeAssetRecommendationManagementGroup;
  priority: ForgeAssetRecommendationPriority;
  summary: string;
  reason: string;
  usageGuide: string | null;
  linked: boolean;
  score: number;
  stageTags: ForgeWorkflowStage[];
  sectorTags: string[];
  relation: ForgeProjectAssetLinkRelation | null;
};

export type ForgeAssetRecommendationResult = {
  project: Pick<ForgeProject, "id" | "name" | "sector"> | null;
  stage: ForgeWorkflowStage | null;
  taskPack: {
    id: string;
    title: string;
  } | null;
  query: string | null;
  managementGroups: ForgeAssetRecommendationManagementGroup[];
  requiredItems: ForgeAssetRecommendationItem[];
  recommendedItems: ForgeAssetRecommendationItem[];
  referenceItems: ForgeAssetRecommendationItem[];
  total: number;
  items: ForgeAssetRecommendationItem[];
};

export type DeliveryGateItem = {
  id: string;
  name: string;
  status: "pass" | "pending" | "fail";
};

export type ForgeRunState = "running" | "done" | "blocked";

export type ForgeRunFailureCategory =
  | "spec-gap"
  | "tooling"
  | "environment"
  | "permission"
  | "test-failure"
  | "unknown";

export type ForgeRunOutputCheck = {
  name: string;
  status: string;
  summary?: string;
};

export type ForgeRun = {
  id: string;
  projectId?: string;
  taskPackId?: string | null;
  linkedComponentIds?: string[];
  title: string;
  executor: string;
  cost: string;
  state: ForgeRunState;
  outputMode?: string | null;
  outputChecks: ForgeRunOutputCheck[];
};

export type ForgeComponentUsageSignalStatus =
  | "blocked"
  | "running"
  | "verified"
  | "linked"
  | "unlinked";

export type ForgeComponentUsageSignal = {
  component: ForgeComponent;
  projectId: string;
  linked: boolean;
  usageCount: number;
  successCount: number;
  blockedCount: number;
  runningCount: number;
  lastRunId: string | null;
  lastRunTitle: string | null;
  lastRunState: ForgeRunState | null;
  lastFailureSummary: string | null;
  status: ForgeComponentUsageSignalStatus;
  statusLabel: string;
};

export type ForgeRunEventType = "status" | "failure" | "output";

export type ForgeRunEvent = {
  id: string;
  runId: string;
  projectId?: string;
  type: ForgeRunEventType;
  summary: string;
  failureCategory: ForgeRunFailureCategory | null;
  createdAt: string;
};

export type ForgeRunnerStatus = "idle" | "busy" | "blocked" | "offline";

export type ForgeRunnerProbeStatus = "unknown" | "healthy" | "degraded" | "offline";

export type ForgeRunnerCapabilityDetail = {
  capability: string;
  status: "pass" | "fail" | "warn";
  path?: string | null;
  version?: string | null;
};

export type ForgeRunner = {
  id: string;
  name: string;
  status: ForgeRunnerStatus;
  summary: string;
  workspacePath: string;
  capabilities: string[];
  detectedCapabilities: string[];
  detectedCapabilityDetails?: ForgeRunnerCapabilityDetail[];
  probeStatus: ForgeRunnerProbeStatus;
  probeSummary: string;
  currentRunId: string | null;
  lastHeartbeat: string;
  lastProbeAt: string | null;
};

export type ForgeModelProviderId =
  | "kimi"
  | "kimi-coding"
  | "openai"
  | "anthropic"
  | "google";
export type ForgeModelProviderConnectionStatus = "untested" | "success" | "error";

export type ForgeModelProviderSetting = {
  id: ForgeModelProviderId;
  label: string;
  vendor: string;
  summary: string;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  modelPriority: string[];
  defaultModelPriority: string[];
  catalogModels: string[];
  docsUrl: string;
  baseUrl: string;
  status: ForgeModelProviderConnectionStatus;
  lastTestedAt: string | null;
  lastTestMessage: string | null;
  supportsCustomModels: boolean;
};

export type ForgeModelProviderSettingsInput = {
  providerId: ForgeModelProviderId;
  enabled?: boolean;
  apiKey?: string;
  modelPriority?: string[];
};

export type ForgeModelProviderConnectionResult = {
  providerId: ForgeModelProviderId;
  providerLabel: string;
  model: string;
  status: "success" | "error";
  testedAt: string;
  message: string;
};

export type ForgeTokenUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens: number;
};

export type ForgeCommandModelExecution = {
  providerId: ForgeModelProviderId;
  providerLabel: string;
  model: string;
  status: "success" | "error";
  summary: string;
  message: string;
  content?: string;
  tokenUsage?: ForgeTokenUsage | null;
};

export type ForgeTaskStatus = "todo" | "in-progress" | "blocked" | "done";

export type ForgeTaskPriority = "P0" | "P1" | "P2";

export type ForgeTaskCategory = "handoff" | "review" | "execution" | "release" | "knowledge";

export type ForgeTask = {
  id: string;
  projectId: string;
  stage: ForgeWorkflowStage;
  title: string;
  ownerAgentId: string;
  status: ForgeTaskStatus;
  priority: ForgeTaskPriority;
  category: ForgeTaskCategory;
  summary: string;
};

export type ForgeCommandType =
  | "prd.generate"
  | "taskpack.generate"
  | "component.assemble"
  | "execution.start"
  | "review.run"
  | "gate.run"
  | "release.prepare"
  | "release.approve"
  | "archive.capture";

export type ForgeCommand = {
  id: string;
  name: string;
  type: ForgeCommandType;
  summary: string;
  triggerStage: ForgeWorkflowStage;
  requiresArtifacts: ForgeArtifactType[];
};

export type ForgeCommandHook = {
  id: string;
  name: "beforeRun" | "afterRun" | "beforeRelease";
  summary: string;
  policy: string;
};

export type ForgeCommandExecutionStatus = "running" | "done" | "blocked";

export type ForgeCommandExecution = {
  id: string;
  commandId: string;
  projectId?: string;
  taskPackId?: string | null;
  relatedRunId?: string | null;
  status: ForgeCommandExecutionStatus;
  summary: string;
  triggeredBy: string;
  createdAt: string;
  followUpTaskIds: string[];
};

export type ForgePolicyDecisionOutcome = "pass" | "warn" | "block";

export type ForgePolicyDecision = {
  id: string;
  hookId: string;
  commandExecutionId: string;
  outcome: ForgePolicyDecisionOutcome;
  summary: string;
  createdAt: string;
};

export type ForgeApprovalTraceKind = "runtime" | "review" | "audit";

export type ForgeApprovalTraceItem = {
  kind: ForgeApprovalTraceKind;
  label: string;
  statusLabel: string;
  detail: string;
  createdAt: string;
  sourceCommandExecutionId?: string | null;
  sourceCommandId?: string | null;
  relatedRunId?: string | null;
  relatedRunLabel?: string | null;
  runtimeLabel?: string | null;
  runtimeExecutionBackendLabel?: string | null;
  runtimeModelProviderLabel?: string | null;
  runtimeModelExecutionDetail?: string | null;
  ownerLabel?: string;
  ownerRoleLabel?: string;
  nextAction?: string;
  slaLabel?: string;
  breachLabel?: string;
  escalationTrigger?: string;
  escalationLabel?: string;
  escalated?: boolean;
  artifactType?: ForgeArtifactType | null;
};

export type ForgeEscalationAction = {
  label: string;
  detail: string;
  sourceCommandExecutionId?: string | null;
  sourceCommandId?: string | null;
  relatedRunId?: string | null;
  relatedRunLabel?: string | null;
  runtimeLabel?: string | null;
  ownerLabel?: string;
  ownerRoleLabel?: string;
  nextAction?: string;
  triggerLabel?: string;
  escalationLabel?: string;
  taskId?: string | null;
  taskLabel?: string | null;
  retryApiPath?: string | null;
  retryRunnerCommand?: string | null;
  unifiedRetryApiPath?: string | null;
  unifiedRetryRunnerArgs?: string[];
  unifiedRetryRunnerCommand?: string | null;
  runtimeEvidenceLabel?: string | null;
  runtimeExecutionBackendLabel?: string | null;
  runtimeModelProviderLabel?: string | null;
  runtimeModelExecutionDetail?: string | null;
  bridgeHandoffStatus?:
    | "none"
    | "bridge-evidence"
    | "review-handoff"
    | "qa-handoff"
    | "release-candidate"
    | null;
  bridgeHandoffSummary?: string | null;
  bridgeHandoffDetail?: string | null;
  blocking: boolean;
};

export type ForgeCurrentHandoffSource =
  | "bootstrap"
  | "review-handoff"
  | "qa-handoff"
  | "release-candidate"
  | "approval"
  | "gate-failure"
  | "stage-default";

export type ForgeCurrentHandoffSummary = {
  stage: ForgeWorkflowStage | null;
  source: ForgeCurrentHandoffSource;
  nextAction: string;
  ownerLabel: string | null;
  ownerRoleLabel: string | null;
  runtimeExecutionControllerLabel?: string | null;
  runtimeExecutionControllerRoleLabel?: string | null;
  sourceCommandExecutionId?: string | null;
  sourceCommandId?: string | null;
  sourceCommandLabel?: string | null;
  relatedRunId?: string | null;
  relatedRunLabel?: string | null;
  runtimeLabel?: string | null;
  runtimeExecutionBackendLabel?: string | null;
  runtimeExecutionBackendCommandPreview?: string | null;
  runtimeExecutionBackendInvocation?: {
    backendId: string;
    backendLabel: string;
    backend: string;
    provider: string;
    runnerProfile: string;
    adapterIds: string[];
    commandType: string;
    expectedArtifacts: string[];
    artifactType: string | null;
    projectId: string | null;
    taskPackId: string | null;
    linkedComponentIds: string[];
    workspacePath: string | null;
    commandPreview: string;
    payload?: {
      projectId?: string | null;
      projectName?: string | null;
      stage?: string | null;
      taskPackId?: string | null;
      commandId?: string | null;
      commandName?: string | null;
      commandType?: string | null;
      taskInstruction?: string | null;
      expectedOutput?: string[];
      linkedAssets?: Array<{
        id: string;
        type: "template" | "prompt" | "skill" | "gate";
        title: string;
        summary: string;
      }>;
      linkedComponents?: Array<{
        id: string;
        title: string;
        category: string;
      }>;
      agent?: {
        id: string;
        name: string;
        role: string;
        runnerId?: string | null;
        persona?: string | null;
        systemPrompt?: string | null;
        knowledgeSources?: string[];
        skillIds?: string[];
        permissionProfileId?: string | null;
        ownerMode?: string | null;
      } | null;
      controllerAgent?: {
        id: string;
        name: string;
        role: string;
        runnerId?: string | null;
        persona?: string | null;
        systemPrompt?: string | null;
        knowledgeSources?: string[];
        skillIds?: string[];
        permissionProfileId?: string | null;
        ownerMode?: string | null;
      } | null;
    } | null;
  } | null;
  bridgeHandoffStatus:
    | "none"
    | "bridge-evidence"
    | "review-handoff"
    | "qa-handoff"
    | "release-candidate"
    | null;
  bridgeHandoffSummary: string | null;
  bridgeHandoffDetail: string | null;
};

export type ForgeFormalArtifactCoverageSummary = {
  count: number;
  summary: string;
  detail: string;
};

export type ForgeFormalArtifactGapSummary = {
  missingArtifactTypes: ForgeArtifactType[];
  missingArtifactLabels: string[];
  summary: string;
  ownerLabel: string | null;
  ownerRoleLabel: string | null;
  nextAction: string | null;
};

export type ForgeFormalArtifactProvenanceItem = {
  artifactType: ForgeArtifactType;
  artifactTitle: string;
  statusLabel: string;
  sourceCommandLabel: string | null;
  relatedRunLabel: string | null;
  runtimeLabel: string | null;
  value: string;
};

export type ForgeFormalArtifactResponsibilityItem = {
  kind: "review" | "audit";
  artifactType: ForgeArtifactType | null;
  label: string;
  statusLabel: string;
  detail: string;
  ownerLabel: string | null;
  ownerRoleLabel: string | null;
  nextAction: string | null;
  sourceCommandExecutionId?: string | null;
  sourceCommandId?: string | null;
  sourceCommandLabel?: string | null;
  relatedRunId?: string | null;
  relatedRunLabel?: string | null;
  runtimeLabel?: string | null;
};

export type ForgeFormalArtifactApprovalHandoffSummary = {
  summary: string;
  detail: string;
  ownerLabel: string | null;
  ownerRoleLabel: string | null;
  nextAction: string | null;
  sourceCommandExecutionId?: string | null;
  sourceCommandId?: string | null;
  sourceCommandLabel?: string | null;
  relatedRunId?: string | null;
  relatedRunLabel?: string | null;
  runtimeLabel?: string | null;
};

export type ForgeFormalArtifactResponsibilitySummary = {
  coverage: ForgeFormalArtifactCoverageSummary;
  gap: ForgeFormalArtifactGapSummary;
  pendingApprovals: ForgeFormalArtifactResponsibilityItem[];
  approvalHandoff: ForgeFormalArtifactApprovalHandoffSummary;
  provenance: ForgeFormalArtifactProvenanceItem[];
};

export type ForgeReleaseClosureSummary = {
  status: "idle" | "pending-approval" | "approval-handoff" | "archive-recorded";
  summary: string;
  detail: string;
  ownerLabel: string | null;
  ownerRoleLabel: string | null;
  nextAction: string | null;
  sourceCommandExecutionId?: string | null;
  sourceCommandId?: string | null;
  sourceCommandLabel?: string | null;
  relatedRunId?: string | null;
  relatedRunLabel?: string | null;
  runtimeLabel?: string | null;
};

export type ForgeReleaseClosureResponsibilitySummary = {
  summary: string;
  detail: string | null;
  nextAction: string | null;
  sourceLabel: string | null;
};

export type ForgeArchiveProvenanceSummary = {
  artifactType: ForgeArtifactType;
  artifactLabel: string;
  artifactTitle: string;
  statusLabel: string;
  updatedAt: string;
  summary: string;
  detail: string | null;
  archiveCommandExecutionId?: string | null;
  archiveCommandId?: string | null;
  archiveCommandLabel?: string | null;
  archiveRunId?: string | null;
  archiveRunLabel?: string | null;
  archiveRuntimeLabel?: string | null;
  archiveExecutionBackendLabel?: string | null;
  handoffCommandExecutionId?: string | null;
  handoffCommandId?: string | null;
  handoffCommandLabel?: string | null;
  handoffRunId?: string | null;
  handoffRunLabel?: string | null;
  handoffRuntimeLabel?: string | null;
  handoffExecutionBackendLabel?: string | null;
};

export type ForgeDashboardSnapshot = {
  activeProjectId: string | null;
  projects: ForgeProject[];
  projectTemplates: ForgeProjectTemplate[];
  projectProfiles: ForgeProjectProfile[];
  workflowStates: ForgeProjectWorkflowState[];
  workflowTransitions: ForgeWorkflowTransition[];
  assets: ForgeAsset[];
  components: ForgeComponent[];
  promptTemplates: ForgePromptTemplate[];
  prdDocuments: ForgePrdDocument[];
  projectAssetLinks: ForgeProjectAssetLink[];
  agents: ForgeAgent[];
  skills: ForgeSkill[];
  sops: ForgeSop[];
  teamTemplates: ForgeTeamTemplate[];
  artifacts: ForgeArtifact[];
  artifactReviews: ForgeArtifactReview[];
  tasks: ForgeTask[];
  commands: ForgeCommand[];
  commandHooks: ForgeCommandHook[];
  commandExecutions: ForgeCommandExecution[];
  policyDecisions: ForgePolicyDecision[];
  runs: ForgeRun[];
  runEvents: ForgeRunEvent[];
  runners: ForgeRunner[];
  deliveryGate: DeliveryGateItem[];
  teamWorkbenchState?: ForgeTeamWorkbenchState;
  projectWorkbenchState?: ForgeProjectWorkbenchState;
};
