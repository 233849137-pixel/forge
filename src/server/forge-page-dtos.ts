import {
  getComponentRegistryForAI,
  getControlPlaneSnapshotForAI,
  resolveWorkbenchAgentContext,
  resolveWorkbenchAgentContextForAgent
} from "../../packages/ai/src";
import { getForgeAgentDisplayLabel, getVisibleProjectWorkbenchNodes } from "../../packages/core/src";
import type {
  ForgeAssetRecommendationResult,
  ForgeDashboardSnapshot,
  ForgeModelProviderSetting,
  ForgeProjectWorkbenchNode,
  ForgeResolvedAgentContext
} from "../../packages/core/src/types";
import { getConfiguredModelGatewayOptions } from "../../packages/model-gateway/src";
import {
  buildForgeExecutionPageData,
  type ForgeExecutionPageData
} from "../lib/forge-execution-page-data";
import {
  loadForgeObsidianKnowledgeBase,
  type ForgeObsidianKnowledgeBaseData
} from "./forge-obsidian-kb";
import {
  buildKnowledgeAssetRecommendations,
  buildKnowledgeAssetsFromKnowledgeBase,
  type ForgeKnowledgeAsset
} from "./forge-knowledge-assets";
import { buildForgeMaterialAssetsFromKnowledgeBase } from "./forge-material-assets";
import { buildForgeCuratedExternalMaterialAssets } from "./forge-curated-material-assets";

type ForgeControlPlane = ReturnType<typeof getControlPlaneSnapshotForAI>;

export type ForgeDataModePresentation = {
  dataMode?: "demo" | "local";
  dataModeLabel?: "示例模式" | "本地模式";
  dataModeSummary?: string;
};

export type ForgeHomePageData = Pick<
  ForgeDashboardSnapshot,
  | "activeProjectId"
  | "agents"
  | "projects"
  | "projectProfiles"
  | "tasks"
  | "workflowStates"
  | "projectTemplates"
  | "teamTemplates"
> &
  ForgeDataModePresentation;

export type ForgeProjectsPageData = Pick<
  ForgeDashboardSnapshot,
  | "activeProjectId"
  | "agents"
  | "projects"
  | "projectWorkbenchState"
  | "workflowStates"
  | "projectProfiles"
  | "projectTemplates"
  | "prdDocuments"
  | "projectAssetLinks"
  | "artifacts"
  | "artifactReviews"
  | "tasks"
  | "runs"
  | "runEvents"
  | "commandExecutions"
  | "deliveryGate"
  | "components"
  | "teamTemplates"
> & {
  availableModelOptions?: string[];
  externalExecutionSummary?: string;
  externalExecutionRecommendation?: string;
  modelProviderSummary?: string;
  agentContextPreviewByProjectId?: Record<
    string,
    Partial<Record<ForgeProjectWorkbenchNode, ForgeResolvedAgentContext | null>>
  >;
} &
  ForgeDataModePresentation;

export type ForgeTeamPageData = Pick<
  ForgeDashboardSnapshot,
  | "activeProjectId"
  | "projects"
  | "workflowStates"
  | "tasks"
  | "artifacts"
  | "agents"
  | "promptTemplates"
  | "runners"
  | "skills"
  | "teamTemplates"
  | "teamWorkbenchState"
> & {
  agentContextPreviewByAgentId?: Record<string, ForgeResolvedAgentContext | null>;
  ceoExecutionBackendLabel?: string;
  ceoExecutionRoleLabel?: string;
  ceoExecutionModeLabel?: string;
  ceoExecutionStatusLabel?: string;
  ceoExecutionStatusSummary?: string;
};

export type ForgeArtifactsPageData = Pick<
  ForgeDashboardSnapshot,
  | "activeProjectId"
  | "projects"
  | "projectProfiles"
  | "workflowStates"
  | "artifacts"
  | "artifactReviews"
  | "tasks"
  | "runs"
  | "runEvents"
  | "deliveryGate"
  | "commands"
  | "commandExecutions"
  | "agents"
  | "teamTemplates"
  | "prdDocuments"
  | "projectAssetLinks"
  | "components"
>;

export type ForgeAssetsPageData = {
  knowledgeBase: ForgeObsidianKnowledgeBaseData;
  knowledgeAssets: ForgeKnowledgeAsset[];
  materialAssets: import("../components/forge-assets-page.types").ForgeMaterialAsset[];
  reusableModules: ReturnType<typeof getComponentRegistryForAI>;
  assetRecommendations: ForgeAssetRecommendationResult;
};

export type { ForgeExecutionPageData };

export type ForgeGovernancePageData = {
  snapshot: ForgeDashboardSnapshot;
  externalExecutionSummary?: string;
  externalExecutionDetails?: string[];
  executionBackendSummary?: string;
  executionBackendDetails?: string[];
  bridgeExecutionSummary?: string;
  bridgeExecutionDetails?: string[];
  archiveProvenanceSummary?: string;
  archiveProvenanceDetail?: string;
  approvalHandoffSummary?: string;
  approvalHandoffDetail?: string;
  approvalHandoffNextAction?: string;
  releaseClosureResponsibilitySummary?: string;
  releaseClosureResponsibilityDetail?: string;
  releaseClosureResponsibilityNextAction?: string;
  releaseClosureResponsibilitySourceLabel?: string;
  releaseClosureSummary?: string;
  releaseClosureDetail?: string;
  releaseClosureNextAction?: string;
  releaseClosureSourceCommandLabel?: string;
  releaseClosureRelatedRunLabel?: string;
  releaseClosureRuntimeLabel?: string;
  currentHandoffExecutionBackendLabel?: string;
  currentHandoffExecutionBackendCommandPreview?: string;
  currentHandoffControllerLabel?: string;
  currentHandoffControllerRoleLabel?: string;
  currentHandoffOwnerLabel?: string;
  currentHandoffOwnerRoleLabel?: string;
  currentHandoffSourceCommandLabel?: string;
  currentHandoffRelatedRunLabel?: string;
  currentHandoffRuntimeLabel?: string;
  externalExecutionRecommendation?: string;
  remediationQueueItems?: ForgeControlPlane["remediationQueue"];
};

export function getForgeHomePageData(
  snapshot: ForgeDashboardSnapshot,
  dataModePresentation: ForgeDataModePresentation = {}
): ForgeHomePageData {
  const {
    activeProjectId,
    agents,
    projects,
    projectProfiles,
    tasks,
    workflowStates,
    projectTemplates,
    teamTemplates
  } = snapshot;

  return {
    activeProjectId,
    agents,
    projects,
    projectProfiles,
    tasks,
    workflowStates,
    projectTemplates,
    teamTemplates,
    ...dataModePresentation
  };
}

function getConfiguredLocalModelOptions(modelProviders: ForgeModelProviderSetting[] = []) {
  return getConfiguredModelGatewayOptions(modelProviders);
}

function getModelProviderSummary(modelProviders: ForgeModelProviderSetting[] = []) {
  const configuredProviders = modelProviders.filter(
    (provider) => provider.enabled && provider.hasApiKey && provider.status !== "error"
  );

  if (configuredProviders.length === 0) {
    return undefined;
  }

  return `已在本机接通 ${configuredProviders.length} 个模型供应商：${configuredProviders
    .map((provider) => provider.label)
    .join(" / ")}。`;
}

export function getForgeProjectsPageData(
  snapshot: ForgeDashboardSnapshot,
  controlPlane?: ForgeControlPlane | null,
  modelProviders: ForgeModelProviderSetting[] = [],
  dataModePresentation: ForgeDataModePresentation = {}
): ForgeProjectsPageData {
  const {
    activeProjectId,
    agents,
    projects,
    projectWorkbenchState,
    workflowStates,
    projectProfiles,
    projectTemplates,
    prdDocuments,
    projectAssetLinks,
    artifacts,
    artifactReviews,
    tasks,
    runs,
    runEvents,
    commandExecutions,
    deliveryGate,
    components,
    teamTemplates
  } = snapshot;
  const availableModelOptions = Array.from(new Set(getConfiguredLocalModelOptions(modelProviders)));
  const modelProviderSummary = getModelProviderSummary(modelProviders);
  const agentContextPreviewByProjectId = Object.fromEntries(
    projects.map((project) => [
      project.id,
      Object.fromEntries(
        getVisibleProjectWorkbenchNodes(snapshot, project.id).map((node) => [
          node,
          resolveWorkbenchAgentContext(snapshot, project.id, node)
        ])
      )
    ])
  );

  return {
    activeProjectId,
    agents,
    projects,
    projectWorkbenchState,
    workflowStates,
    projectProfiles,
    projectTemplates,
    prdDocuments,
    projectAssetLinks,
    artifacts,
    artifactReviews,
    tasks,
    runs,
    runEvents,
    commandExecutions,
    deliveryGate,
    components,
    teamTemplates,
    availableModelOptions,
    externalExecutionSummary: controlPlane?.runtimeSummary.externalExecutionSummary ?? undefined,
    externalExecutionRecommendation:
      controlPlane?.runtimeSummary.externalExecutionRecommendation ?? undefined,
    modelProviderSummary,
    agentContextPreviewByProjectId,
    ...dataModePresentation
  };
}

export function getForgeTeamPageData(
  snapshot: ForgeDashboardSnapshot,
  controlPlane?: ForgeControlPlane | null
): ForgeTeamPageData {
  const {
    activeProjectId,
    projects,
    workflowStates,
    tasks,
    artifacts,
    agents,
    promptTemplates,
    runners,
    skills,
    teamTemplates,
    teamWorkbenchState
  } = snapshot;
  const previewAgents = teamWorkbenchState?.managedAgents?.length
    ? teamWorkbenchState.managedAgents
    : agents;
  const previewSnapshot = {
    ...snapshot,
    agents: previewAgents
  };
  const previewNodeByRole = {
    pm: "需求确认",
    architect: "项目原型",
    design: "UI设计",
    engineer: "后端研发",
    qa: "DEMO测试",
    knowledge: "内测调优",
    release: "交付发布"
  } as const;
  const previewProjectId = activeProjectId ?? projects[0]?.id ?? null;
  const agentContextPreviewByAgentId = Object.fromEntries(
    previewAgents.map((agent) => [
      agent.id,
      previewProjectId
        ? resolveWorkbenchAgentContextForAgent(
            previewSnapshot,
            previewProjectId,
            agent.id,
            previewNodeByRole[agent.role]
          )
        : null
    ])
  );
  const pmExecutionBackend = controlPlane?.executionBackends.find(
    (item) => item.kind === "pm" && item.commandConfigured && item.backend
  );
  const nanoManagerStatus = controlPlane?.runtimeSummary.nanoManagerStatus;
  const ceoExecutionStatusLabel =
    nanoManagerStatus === "ready"
      ? "已接线"
      : nanoManagerStatus === "degraded"
        ? "异常"
      : nanoManagerStatus === "missing"
        ? "待接线"
        : undefined;

  return {
    activeProjectId,
    projects,
    workflowStates,
    tasks,
    artifacts,
    agents,
    promptTemplates,
    runners,
    skills,
    teamTemplates,
    teamWorkbenchState,
    agentContextPreviewByAgentId,
    ceoExecutionBackendLabel: pmExecutionBackend?.backend ?? undefined,
    ceoExecutionRoleLabel: pmExecutionBackend
      ? getForgeAgentDisplayLabel({
          id: "agent-service-strategy",
          role: "pm"
        })
      : undefined,
    ceoExecutionModeLabel: pmExecutionBackend ? "单 runtime / 多员工 profile 调度" : undefined,
    ceoExecutionStatusLabel,
    ceoExecutionStatusSummary: ceoExecutionStatusLabel
      ? controlPlane?.runtimeSummary.nanoManagerSummary ?? undefined
      : undefined
  };
}

export function getForgeArtifactsPageData(snapshot: ForgeDashboardSnapshot): ForgeArtifactsPageData {
  const {
    activeProjectId,
    projects,
    projectProfiles,
    workflowStates,
    artifacts,
    artifactReviews,
    tasks,
    runs,
    runEvents,
    deliveryGate,
    commands,
    commandExecutions,
    agents,
    teamTemplates,
    prdDocuments,
    projectAssetLinks,
    components
  } = snapshot;

  return {
    activeProjectId,
    projects,
    projectProfiles,
    workflowStates,
    artifacts,
    artifactReviews,
    tasks,
    runs,
    runEvents,
    deliveryGate,
    commands,
    commandExecutions,
    agents,
    teamTemplates,
    prdDocuments,
    projectAssetLinks,
    components
  };
}

export function getForgeAssetsPageData(
  snapshot: ForgeDashboardSnapshot,
  knowledgeBase: ForgeObsidianKnowledgeBaseData = loadForgeObsidianKnowledgeBase(),
  dbPath?: string
): ForgeAssetsPageData {
  const focusProjectId = snapshot.activeProjectId ?? snapshot.projects[0]?.id;
  const sanitizedKnowledgeBaseNotes = knowledgeBase.notes.map((note) => ({
    ...note,
    openUri: "obsidian://open"
  }));
  const sanitizedRecentKnowledgeBaseNotes = knowledgeBase.recentNotes.map((note) => ({
    ...note,
    openUri: "obsidian://open"
  }));
  const knowledgeBaseSummary: ForgeObsidianKnowledgeBaseData = {
    ...knowledgeBase,
    vaultName: knowledgeBase.vaultName ? "Knowledge Vault" : "",
    vaultPath: "",
    notes: sanitizedKnowledgeBaseNotes,
    recentNotes: sanitizedRecentKnowledgeBaseNotes,
    summary:
      knowledgeBase.cliStatus === "ready"
        ? "当前已接入外部知识库连接器，可在资产页查看同步笔记与沉淀资产。"
        : "当前尚未完成知识库连接，可先浏览资产结构与公开示例。",
    cliSummary:
      knowledgeBase.cliStatus === "ready"
        ? "知识库连接器已接通，可同步最近打开与知识目录。"
        : knowledgeBase.cliStatus === "disabled"
          ? "知识库连接器已发现，但当前尚未启用。"
          : knowledgeBase.cliStatus === "error"
            ? "知识库连接器校验失败，当前已回退到只读模式。"
            : "当前还没有接通可用的知识库连接器。"
  };
  const knowledgeAssets = buildKnowledgeAssetsFromKnowledgeBase(knowledgeBase).map((asset) => ({
    ...asset,
    openUri: "obsidian://open"
  }));
  const materialAssets = [
    ...buildForgeCuratedExternalMaterialAssets(),
    ...buildForgeMaterialAssetsFromKnowledgeBase(knowledgeBase),
  ]
    .map((asset) =>
      asset.sourceKind === "obsidian"
        ? {
            ...asset,
            openUri: "obsidian://open",
            actionLabel: "在知识库中打开"
          }
        : asset
    )
    .sort((left, right) => Date.parse(right.modifiedAt) - Date.parse(left.modifiedAt));
  const reusableModuleContext = getComponentRegistryForAI({
    projectId: focusProjectId ?? undefined
  }, dbPath);
  const reusableModuleItems = snapshot.components.filter(
    (component) => component.assemblyContract,
  );
  const reusableModules = {
    ...reusableModuleContext,
    total: reusableModuleItems.length,
    categories: Array.from(
      new Set(reusableModuleItems.map((component) => component.category)),
    ),
    items: reusableModuleItems,
  };
  const assetRecommendations = buildKnowledgeAssetRecommendations(knowledgeAssets, snapshot);

  return {
    knowledgeBase: knowledgeBaseSummary,
    knowledgeAssets,
    materialAssets,
    reusableModules,
    assetRecommendations
  };
}

export function getForgeExecutionPageData(
  snapshot: ForgeDashboardSnapshot,
  controlPlane: ForgeControlPlane
): ForgeExecutionPageData {
  return buildForgeExecutionPageData({
    snapshot,
    externalExecutionSummary: controlPlane.runtimeSummary.externalExecutionSummary ?? undefined,
    externalExecutionDetails: controlPlane.runtimeSummary.externalExecutionDetails,
    executionBackendSummary: controlPlane.runtimeSummary.executionBackendSummary ?? undefined,
    executionBackendDetails: controlPlane.runtimeSummary.executionBackendDetails,
    bridgeExecutionSummary: controlPlane.runtimeSummary.bridgeExecutionSummary ?? undefined,
    bridgeExecutionDetails: controlPlane.runtimeSummary.bridgeExecutionDetails,
    currentHandoffExecutionBackendLabel:
      controlPlane.currentHandoff.runtimeExecutionBackendLabel ?? undefined,
    currentHandoffExecutionBackendCommandPreview:
      controlPlane.currentHandoff.runtimeExecutionBackendCommandPreview ?? undefined,
    currentHandoffControllerLabel:
      controlPlane.currentHandoff.runtimeExecutionControllerLabel ?? undefined,
    currentHandoffControllerRoleLabel:
      controlPlane.currentHandoff.runtimeExecutionControllerRoleLabel ?? undefined,
    currentHandoffOwnerLabel: controlPlane.currentHandoff.ownerLabel ?? undefined,
    currentHandoffOwnerRoleLabel: controlPlane.currentHandoff.ownerRoleLabel ?? undefined,
    currentHandoffSourceCommandLabel: controlPlane.currentHandoff.sourceCommandLabel ?? undefined,
    currentHandoffRelatedRunLabel: controlPlane.currentHandoff.relatedRunLabel ?? undefined,
    currentHandoffRuntimeLabel: controlPlane.currentHandoff.runtimeLabel ?? undefined,
    externalExecutionRecommendation:
      controlPlane.runtimeSummary.externalExecutionRecommendation ?? undefined,
    remediationQueueItems: controlPlane.remediationQueue
  });
}

export function getForgeGovernancePageData(
  snapshot: ForgeDashboardSnapshot,
  controlPlane: ForgeControlPlane
): ForgeGovernancePageData {
  return {
    snapshot,
    externalExecutionSummary: controlPlane.runtimeSummary.externalExecutionSummary ?? undefined,
    externalExecutionDetails: controlPlane.runtimeSummary.externalExecutionDetails,
    executionBackendSummary: controlPlane.runtimeSummary.executionBackendSummary ?? undefined,
    executionBackendDetails: controlPlane.runtimeSummary.executionBackendDetails,
    bridgeExecutionSummary: controlPlane.runtimeSummary.bridgeExecutionSummary ?? undefined,
    bridgeExecutionDetails: controlPlane.runtimeSummary.bridgeExecutionDetails,
    archiveProvenanceSummary: controlPlane.archiveProvenance?.summary ?? undefined,
    archiveProvenanceDetail: controlPlane.archiveProvenance?.detail ?? undefined,
    approvalHandoffSummary: controlPlane.approvalHandoff?.summary ?? undefined,
    approvalHandoffDetail: controlPlane.approvalHandoff?.detail ?? undefined,
    approvalHandoffNextAction: controlPlane.approvalHandoff?.nextAction ?? undefined,
    releaseClosureResponsibilitySummary:
      controlPlane.releaseClosureResponsibility?.summary ?? undefined,
    releaseClosureResponsibilityDetail:
      controlPlane.releaseClosureResponsibility?.detail ?? undefined,
    releaseClosureResponsibilityNextAction:
      controlPlane.releaseClosureResponsibility?.nextAction ?? undefined,
    releaseClosureResponsibilitySourceLabel:
      controlPlane.releaseClosureResponsibility?.sourceLabel ?? undefined,
    releaseClosureSummary: controlPlane.releaseClosure?.summary ?? undefined,
    releaseClosureDetail: controlPlane.releaseClosure?.detail ?? undefined,
    releaseClosureNextAction: controlPlane.releaseClosure?.nextAction ?? undefined,
    releaseClosureSourceCommandLabel:
      controlPlane.releaseClosure?.sourceCommandLabel ?? undefined,
    releaseClosureRelatedRunLabel: controlPlane.releaseClosure?.relatedRunLabel ?? undefined,
    releaseClosureRuntimeLabel: controlPlane.releaseClosure?.runtimeLabel ?? undefined,
    currentHandoffExecutionBackendLabel:
      controlPlane.currentHandoff.runtimeExecutionBackendLabel ?? undefined,
    currentHandoffExecutionBackendCommandPreview:
      controlPlane.currentHandoff.runtimeExecutionBackendCommandPreview ?? undefined,
    currentHandoffControllerLabel:
      controlPlane.currentHandoff.runtimeExecutionControllerLabel ?? undefined,
    currentHandoffControllerRoleLabel:
      controlPlane.currentHandoff.runtimeExecutionControllerRoleLabel ?? undefined,
    currentHandoffOwnerLabel: controlPlane.currentHandoff.ownerLabel ?? undefined,
    currentHandoffOwnerRoleLabel: controlPlane.currentHandoff.ownerRoleLabel ?? undefined,
    currentHandoffSourceCommandLabel: controlPlane.currentHandoff.sourceCommandLabel ?? undefined,
    currentHandoffRelatedRunLabel: controlPlane.currentHandoff.relatedRunLabel ?? undefined,
    currentHandoffRuntimeLabel: controlPlane.currentHandoff.runtimeLabel ?? undefined,
    externalExecutionRecommendation:
      controlPlane.runtimeSummary.externalExecutionRecommendation ?? undefined,
    remediationQueueItems: controlPlane.remediationQueue
  };
}

export function getForgePages(
  snapshot: ForgeDashboardSnapshot,
  controlPlane: ForgeControlPlane,
  modelProviders: ForgeModelProviderSetting[] = [],
  dbPath?: string,
  dataModePresentation: ForgeDataModePresentation = {}
) {
  return {
    home: getForgeHomePageData(snapshot, dataModePresentation),
    projects: getForgeProjectsPageData(snapshot, controlPlane, modelProviders, dataModePresentation),
    team: getForgeTeamPageData(snapshot, controlPlane),
    artifacts: getForgeArtifactsPageData(snapshot),
    execution: getForgeExecutionPageData(snapshot, controlPlane),
    assets: getForgeAssetsPageData(snapshot, undefined, dbPath),
    governance: getForgeGovernancePageData(snapshot, controlPlane)
  };
}
