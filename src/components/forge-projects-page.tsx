"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  ForgeAgentOwnerMode,
  ForgeDashboardSnapshot,
  ForgeProject,
  ForgeProjectWorkbenchNode,
  ForgeProjectWorkbenchNodeState,
  ForgeProjectWorkbenchProjectState,
  ForgeProjectWorkbenchState,
  ForgeProjectWorkbenchWorkspaceViewState,
  ForgeTokenUsage,
  ForgeWorkflowStage
} from "../../packages/core/src/types";
import {
  getForgeAgentDisplayLabel,
  getForgeAgentDisplayProfile,
  getProjectWorkbenchAgent,
  getVisibleProjectWorkbenchNodes,
  projectWorkbenchNodes
} from "../../packages/core/src";
import { FORGE_LOCAL_FALLBACK_MODEL_OPTION } from "../../packages/model-gateway/src";
import type {
  ExecuteForgeCommandInput,
  ExecuteForgeCommandResult,
  SendForgeWorkbenchChatInput,
  SendForgeWorkbenchChatResult
} from "../lib/forge-command-api";
import type {
  CreateForgeProjectInput,
  ForgeProjectMutationResult,
  GenerateForgePrdDraftInput,
  GenerateForgePrdDraftResult
} from "../lib/forge-project-api";
import {
  createForgeWorkspaceDirectory,
  createForgeWorkspaceMarkdown,
  deleteForgeWorkspaceEntry,
  getForgeWorkspaceFile,
  saveForgeWorkspaceFile,
  type ForgeWorkspaceFileRecord
} from "../lib/forge-workspace-api";
import { dispatchForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import type { ForgeProjectsPageData } from "../server/forge-page-dtos";
import ForgeConfirmDialog from "./forge-confirm-dialog";
import ForgeConsoleShell, { getToneBadgeClassName } from "./forge-console-shell";
import shellStyles from "./forge-console-shell.module.css";
import ForgeEditDialog from "./forge-edit-dialog";
import ForgeProjectWorkspaceDrawer from "./forge-project-workspace-drawer";
import {
  formatTimestamp,
  formatWorkflowStageLabel,
  getActiveProject,
  getHealthTone,
  getNextMilestone,
  getRelativeTimeSortValue,
  getProjectHealth,
  getRunStateLabel,
  getTaskStatusLabel,
  getWorkflowState
} from "./forge-console-utils";
import styles from "./forge-projects-page.module.css";

type ForgeProjectsPageProps = {
  data?: ForgeProjectsPageData;
  snapshot?: ForgeProjectsPageData;
  createWorkbenchProject?: (
    input: CreateForgeProjectInput
  ) => Promise<ForgeProjectMutationResult>;
  saveProjectWorkbenchState?: (
    state: ForgeProjectWorkbenchState
  ) => Promise<{ state: ForgeProjectWorkbenchState }>;
  generateWorkbenchPrd?: (
    input: GenerateForgePrdDraftInput
  ) => Promise<GenerateForgePrdDraftResult>;
  executeWorkbenchCommand?: (
    input: ExecuteForgeCommandInput
  ) => Promise<ExecuteForgeCommandResult>;
  sendWorkbenchChatMessage?: (
    input: SendForgeWorkbenchChatInput
  ) => Promise<SendForgeWorkbenchChatResult>;
  activateWorkbenchProject?: (projectId: string) => Promise<ForgeProjectMutationResult>;
  initialProjectId?: string;
  initialNode?: string;
  showNavigation?: boolean;
};

type WorkNode = ForgeProjectWorkbenchNode;

type NodeStatus = "已完成" | "进行中" | "已阻塞" | "待开始";

type ConversationMessage = {
  id: string;
  speaker: string;
  role: "human" | "ai";
  text: string;
  time: string;
  tokenUsage?: ForgeTokenUsage | null;
};

type NodeDocument = {
  title: string;
  body: string;
  updatedAt?: string | null;
};

type SeededDocumentTab = {
  id: string;
  label: string;
  document: NodeDocument | null;
};

type DocumentVisualPreviewCard = {
  eyebrow: string;
  title: string;
  description: string;
  chips: string[];
  accent: "blue" | "amber" | "green";
};

type DocumentVisualPreview = {
  ariaLabel: string;
  title: string;
  summary: string;
  variant: "prototype" | "design";
  cards: DocumentVisualPreviewCard[];
};

type NodeWorkbench = {
  node: WorkNode;
  status: NodeStatus;
  summary: string;
  nextAction: string;
  agentName: string;
  agentRole: string;
  conversation: ConversationMessage[];
  documents: SeededDocumentTab[];
};

type ConversationTab = {
  id: string;
  label: string;
  messages: ConversationMessage[];
};

type DocumentTab = {
  id: string;
  label: string;
  document: NodeDocument | null;
};

const WORKBENCH_CONTEXT_TOKEN_LIMIT = 258_000;
const WORKBENCH_CONTEXT_COMPRESSION_TARGET = 206_000;
const WORKBENCH_CONTEXT_RECENT_MESSAGE_COUNT = 8;
const WORKBENCH_CONTEXT_SUMMARY_SNIPPET_COUNT = 6;
const WORKBENCH_CONTEXT_SUMMARY_SPEAKER = "系统摘要";
const PROJECT_MANAGER_AGENT_NAME = getForgeAgentDisplayLabel({
  id: "agent-service-strategy",
  role: "pm"
});
const ARCHITECT_AGENT_NAME = getForgeAgentDisplayLabel({ id: "agent-architect", role: "architect" });
const DESIGN_AGENT_NAME = getForgeAgentDisplayLabel({ id: "agent-design", role: "design" });
const ENGINEER_AGENT_NAME = getForgeAgentDisplayLabel({ id: "agent-engineer", role: "engineer" });
const QA_AGENT_NAME = getForgeAgentDisplayLabel({ id: "agent-qa", role: "qa" });
const KNOWLEDGE_AGENT_NAME = getForgeAgentDisplayLabel({
  id: "agent-knowledge-ops",
  role: "knowledge"
});
const RELEASE_AGENT_NAME = getForgeAgentDisplayLabel({ id: "agent-release", role: "release" });
const projectOverviewDeliveryDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit"
});
const projectOverviewLogTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});
const projectOverviewLogDateKeyFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const projectOverviewArtifactStageLabels: Record<string, string> = {
  prd: "需求确认",
  "architecture-note": "项目原型",
  "ui-spec": "UI设计",
  "task-pack": "项目原型",
  "demo-build": "后端研发",
  "test-report": "DEMO测试",
  "release-brief": "交付发布",
  "knowledge-card": "归档复用"
};

type ProjectDebugWorkspaceMapping = {
  workspacePath: string;
  debugUrl: string;
};

function toProjectDebugWorkspaceMapping(
  workspacePath: unknown,
  debugUrl: unknown
): ProjectDebugWorkspaceMapping | null {
  if (typeof workspacePath !== "string" || typeof debugUrl !== "string") {
    return null;
  }

  const normalizedWorkspacePath = normalizeWorkspacePath(workspacePath);
  const normalizedDebugUrl = debugUrl.trim();

  if (!normalizedWorkspacePath || !/^https?:\/\//iu.test(normalizedDebugUrl)) {
    return null;
  }

  return {
    workspacePath: normalizedWorkspacePath,
    debugUrl: normalizedDebugUrl
  };
}

function parseProjectDebugWorkspaceMappings(
  value?: string | null
): ProjectDebugWorkspaceMapping[] {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmedValue) as unknown;

    if (Array.isArray(parsed)) {
      return parsed
        .map((item) =>
          item && typeof item === "object"
            ? toProjectDebugWorkspaceMapping(
                (item as Record<string, unknown>).workspacePath,
                (item as Record<string, unknown>).debugUrl
              )
            : null
        )
        .filter((item): item is ProjectDebugWorkspaceMapping => item !== null);
    }

    if (parsed && typeof parsed === "object") {
      return Object.entries(parsed).flatMap(([workspacePath, debugUrl]) => {
        const mapping = toProjectDebugWorkspaceMapping(workspacePath, debugUrl);
        return mapping ? [mapping] : [];
      });
    }
  } catch {
    return trimmedValue
      .split(/[\n;]+/u)
      .map((item) => item.trim())
      .filter(Boolean)
      .flatMap((item) => {
        const separatorIndex = item.indexOf("=");

        if (separatorIndex <= 0) {
          return [];
        }

        const mapping = toProjectDebugWorkspaceMapping(
          item.slice(0, separatorIndex),
          item.slice(separatorIndex + 1)
        );

        return mapping ? [mapping] : [];
      });
  }

  return [];
}

function getConfiguredProjectDebugWorkspaceMappings() {
  return parseProjectDebugWorkspaceMappings(
    process.env.NEXT_PUBLIC_FORGE_DEBUG_WORKSPACE_MAPPINGS
  );
}

function formatProjectOverviewDeliveryDate(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return "待排期";
  }

  const resolvedValue = trimmedValue.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? trimmedValue;
  const date = new Date(`${resolvedValue}T00:00:00+08:00`);

  if (Number.isNaN(date.getTime())) {
    return trimmedValue;
  }

  return projectOverviewDeliveryDateFormatter.format(date).replace(/\//g, "-");
}

function formatProjectOverviewLogTime(value: string | null | undefined, referenceDate?: Date) {
  const normalizedValue = value?.trim();
  const now = referenceDate ?? new Date();
  const formatConcreteTime = (date: Date) => projectOverviewLogTimeFormatter.format(date).replace(/\//g, "-");
  const getDateKey = (date: Date) => projectOverviewLogDateKeyFormatter.format(date).replace(/\//g, "-");

  if (!normalizedValue || normalizedValue === "刚刚") {
    return formatConcreteTime(now);
  }

  const todayMatch = normalizedValue.match(/^今天\s+(\d{1,2}):(\d{2})$/);
  if (todayMatch) {
    const [, hour, minute] = todayMatch;
    return formatConcreteTime(
      new Date(`${getDateKey(now)}T${hour.padStart(2, "0")}:${minute}:00+08:00`)
    );
  }

  const yesterdayMatch = normalizedValue.match(/^昨天\s+(\d{1,2}):(\d{2})$/);
  if (yesterdayMatch) {
    const [, hour, minute] = yesterdayMatch;
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return formatConcreteTime(
      new Date(`${getDateKey(yesterday)}T${hour.padStart(2, "0")}:${minute}:00+08:00`)
    );
  }

  const minutesAgoMatch = normalizedValue.match(/^(\d+)\s*分钟前$/);
  if (minutesAgoMatch) {
    return formatConcreteTime(new Date(now.getTime() - Number(minutesAgoMatch[1]) * 60 * 1000));
  }

  const hoursAgoMatch = normalizedValue.match(/^(\d+)\s*小时前$/);
  if (hoursAgoMatch) {
    return formatConcreteTime(new Date(now.getTime() - Number(hoursAgoMatch[1]) * 60 * 60 * 1000));
  }

  if (normalizedValue.includes("T")) {
    const timestamp = Date.parse(normalizedValue);
    if (!Number.isNaN(timestamp)) {
      return formatConcreteTime(new Date(timestamp));
    }
  }

  const explicitDateMatch = normalizedValue.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}):(\d{2})/);
  if (explicitDateMatch) {
    const [, datePart, hour, minute] = explicitDateMatch;
    const timestamp = Date.parse(`${datePart}T${hour}:${minute}:00+08:00`);
    if (!Number.isNaN(timestamp)) {
      return formatConcreteTime(new Date(timestamp));
    }
  }

  return normalizedValue;
}

function getProjectOverviewArtifactStageLabel(type: string) {
  return projectOverviewArtifactStageLabels[type] ?? "项目计划";
}

function getProjectOverviewArtifactStatusLabel(status: string) {
  if (status === "ready") {
    return "已完成";
  }

  if (status === "in-review") {
    return "评审中";
  }

  return "待形成";
}

function getProjectOverviewArtifactTone(status: string): ProjectOverviewTone {
  if (status === "ready") {
    return "good";
  }

  if (status === "in-review") {
    return "warn";
  }

  return "neutral";
}

function createProjectOverviewState(input: {
  activePlanId: string;
  projectName: string;
  progress: number;
  currentStage: string;
  projectRiskSummary: string;
  projectNextMilestone: string;
  currentProjectNextAction: string;
  latestProjectDeliverable: string;
}) {
  return {
    messages: [
      createSeededConversationMessage(
        PROJECT_MANAGER_AGENT_NAME,
        `${input.projectName} 当前整体进度 ${input.progress}%，目前处于${input.currentStage}。${input.projectRiskSummary} 下一里程碑是${input.projectNextMilestone}，当前建议优先推进：${input.currentProjectNextAction}。最近产出为《${input.latestProjectDeliverable}》。`
      )
    ],
    draft: "",
    pendingReplyId: null,
    activePlanId: input.activePlanId
  } satisfies ProjectOverviewState;
}

function formatTokenUsageCount(value: number) {
  if (value >= 1000) {
    const compactValue = value >= 100000 ? Math.round(value / 1000) : Math.round((value / 1000) * 10) / 10;
    return `${Number.isInteger(compactValue) ? compactValue.toFixed(0) : compactValue.toFixed(1)}k`;
  }

  return `${value}`;
}

function formatAgentOwnerModeLabel(ownerMode: ForgeAgentOwnerMode | string) {
  if (ownerMode === "auto-execute") {
    return "自动执行";
  }

  if (ownerMode === "review-required") {
    return "评审后执行";
  }

  if (ownerMode === "human-approved") {
    return "人工确认后执行";
  }

  return ownerMode;
}

function formatAgentToolModeSummary(
  tools: Array<{
    mode: "read" | "write" | "execute" | "review";
  }>
) {
  const labels = Array.from(
    new Set(
      tools.map((tool) => {
        if (tool.mode === "write") {
          return "写入";
        }

        if (tool.mode === "execute") {
          return "执行";
        }

        if (tool.mode === "review") {
          return "审查";
        }

        return "读取";
      })
    )
  );

  return labels.length ? labels.join(" / ") : "只读";
}

function getOrderedToolModes(
  tools: Array<{
    mode: "read" | "write" | "execute" | "review";
  }>
) {
  const orderedModes: Array<"read" | "write" | "execute" | "review"> = [
    "read",
    "write",
    "execute",
    "review"
  ];
  const availableModes = new Set(tools.map((tool) => tool.mode));
  return orderedModes.filter((mode) => availableModes.has(mode));
}

function getToolModeLabel(mode: "read" | "write" | "execute" | "review") {
  if (mode === "write") {
    return "写";
  }

  if (mode === "execute") {
    return "执行";
  }

  if (mode === "review") {
    return "审查";
  }

  return "读";
}

function getToolModeBadgeClassName(mode: "read" | "write" | "execute" | "review") {
  if (mode === "write") {
    return styles.handoffContextModeBadgeWrite;
  }

  if (mode === "execute") {
    return styles.handoffContextModeBadgeExecute;
  }

  if (mode === "review") {
    return styles.handoffContextModeBadgeReview;
  }

  return styles.handoffContextModeBadgeRead;
}

function estimateTextTokenCount(text: string) {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return 0;
  }

  const nonAsciiCount = (normalizedText.match(/[^\x00-\x7F]/g) ?? []).length;
  const whitespaceCount = (normalizedText.match(/\s/g) ?? []).length;
  const asciiVisibleCount = Math.max(0, normalizedText.length - nonAsciiCount - whitespaceCount);

  return nonAsciiCount + Math.ceil(asciiVisibleCount / 4);
}

function estimateConversationMessageTokenCount(message: ConversationMessage) {
  return estimateTextTokenCount(`${message.speaker} ${message.text}`) + 6;
}

function getConversationContextTokenCount(messages: ConversationMessage[]) {
  return messages.reduce((total, message) => total + estimateConversationMessageTokenCount(message), 0);
}

function formatConversationContextUsageSummary(tokenCount: number) {
  if (tokenCount <= 0) {
    return "";
  }

  return `已用 ${formatTokenUsageCount(tokenCount)} 标记，共 ${formatTokenUsageCount(
    WORKBENCH_CONTEXT_TOKEN_LIMIT
  )}`;
}

function getConversationContextUsagePercent(tokenCount: number) {
  if (tokenCount <= 0) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(1, Math.round((tokenCount / WORKBENCH_CONTEXT_TOKEN_LIMIT) * 100))
  );
}

function normalizeWorkspacePath(value: string | null | undefined) {
  const normalizedValue = value?.replace(/\\/gu, "/").trim().replace(/\/+$/u, "") ?? "";
  return normalizedValue ? normalizedValue : null;
}

function createWorkspaceViewState(
  persistedWorkspaceView?: ForgeProjectWorkbenchWorkspaceViewState | null
): WorkspaceViewState {
  const expandedDirectories = Object.fromEntries(
    (persistedWorkspaceView?.expandedDirectories ?? [])
      .map((path) => normalizeWorkspacePath(path))
      .filter((path): path is string => Boolean(path))
      .map((path) => [path, true] as const)
  );

  return {
    isOpen: persistedWorkspaceView?.isOpen === true,
    selectedFilePath: normalizeWorkspacePath(persistedWorkspaceView?.selectedFilePath),
    expandedDirectories
  };
}

function serializeWorkspaceViewState(
  workspaceView?: WorkspaceViewState | null
): ForgeProjectWorkbenchWorkspaceViewState {
  const resolvedWorkspaceView = workspaceView ?? createWorkspaceViewState();

  return {
    isOpen: resolvedWorkspaceView.isOpen,
    selectedFilePath: resolvedWorkspaceView.selectedFilePath,
    expandedDirectories: Object.entries(resolvedWorkspaceView.expandedDirectories)
      .filter(([, expanded]) => expanded)
      .map(([path]) => path)
  };
}

function getWorkspaceAncestorDirectoryRecord(path: string) {
  const normalizedPath = normalizeWorkspacePath(path);

  if (!normalizedPath) {
    return {};
  }

  const segments = normalizedPath.split("/").filter(Boolean);
  const directorySegments = /\.[^/.]+$/u.test(segments.at(-1) ?? "") ? segments.slice(0, -1) : segments;
  const expandedDirectories: Record<string, boolean> = {};

  directorySegments.forEach((_, index) => {
    const directoryPath = directorySegments.slice(0, index + 1).join("/");
    expandedDirectories[directoryPath] = true;
  });

  return expandedDirectories;
}

function removeWorkspacePaths(
  expandedDirectories: Record<string, boolean>,
  deletedPath: string
) {
  return Object.fromEntries(
    Object.entries(expandedDirectories).filter(
      ([path]) => path !== deletedPath && !path.startsWith(`${deletedPath}/`)
    )
  );
}

function buildDefaultWorkspaceEntryPath(
  kind: "markdown" | "directory",
  selectedFilePath: string | null
) {
  const normalizedSelectedPath = normalizeWorkspacePath(selectedFilePath);
  const selectedSegments = normalizedSelectedPath?.split("/").filter(Boolean) ?? [];
  const baseSegments =
    normalizedSelectedPath && /\.[^/.]+$/u.test(selectedSegments.at(-1) ?? "")
      ? selectedSegments.slice(0, -1)
      : selectedSegments;
  const fallbackSegments = baseSegments.length > 0 ? baseSegments : ["notes"];

  return [...fallbackSegments, kind === "markdown" ? "new-note.md" : "new-folder"].join("/");
}

function truncateConversationSummaryText(text: string, maxLength = 48) {
  const normalizedText = text.replace(/\s+/g, " ").trim();

  if (!normalizedText) {
    return "";
  }

  if (normalizedText.length <= maxLength) {
    return normalizedText;
  }

  return `${normalizedText.slice(0, maxLength - 1)}…`;
}

function createCompressedConversationMessage(messages: ConversationMessage[]): ConversationMessage {
  const snippetLines = messages
    .filter((message) => message.text.trim())
    .slice(-WORKBENCH_CONTEXT_SUMMARY_SNIPPET_COUNT)
    .map((message) => {
      const speakerLabel = message.role === "human" ? "你" : message.speaker || "AI";
      return `- ${speakerLabel}：${truncateConversationSummaryText(message.text)}`;
    });

  const compressedTokenCount = getConversationContextTokenCount(messages);
  const text = [
    "历史会话已自动压缩，已保留摘要与最近消息。",
    `已压缩 ${messages.length} 条历史消息，约 ${formatTokenUsageCount(compressedTokenCount)} 标记。`,
    ...snippetLines
  ].join("\n");

  return {
    id: `compressed-${messages[messages.length - 1]?.id ?? "history"}`,
    speaker: WORKBENCH_CONTEXT_SUMMARY_SPEAKER,
    role: "ai",
    text,
    time: messages[messages.length - 1]?.time ?? "刚刚",
    tokenUsage: null
  };
}

function compressConversationMessages(messages: ConversationMessage[]) {
  if (getConversationContextTokenCount(messages) <= WORKBENCH_CONTEXT_TOKEN_LIMIT) {
    return messages;
  }

  const maxTailCount = Math.min(
    WORKBENCH_CONTEXT_RECENT_MESSAGE_COUNT,
    Math.max(messages.length - 1, 0)
  );
  const tailCandidates = Array.from(
    new Set([maxTailCount, 6, 4, 2, 1, 0].filter((count) => count >= 0 && count <= maxTailCount))
  ).sort((left, right) => right - left);

  for (const tailCount of tailCandidates) {
    const preservedTail = tailCount > 0 ? messages.slice(-tailCount) : [];
    const historyMessages = messages.slice(0, messages.length - preservedTail.length);

    if (historyMessages.length === 0) {
      continue;
    }

    const nextMessages = [createCompressedConversationMessage(historyMessages), ...preservedTail];
    if (getConversationContextTokenCount(nextMessages) <= WORKBENCH_CONTEXT_COMPRESSION_TARGET) {
      return nextMessages;
    }
  }

  return [createCompressedConversationMessage(messages)];
}

function normalizeConversationTabsWithinBudget(conversationTabs: ConversationTab[]) {
  let hasChanges = false;
  const nextConversationTabs = conversationTabs.map((tab) => {
    const nextMessages = compressConversationMessages(tab.messages);
    if (nextMessages === tab.messages) {
      return tab;
    }

    hasChanges = true;
    return {
      ...tab,
      messages: nextMessages
    };
  });

  return hasChanges ? nextConversationTabs : conversationTabs;
}

type NodePanelState = {
  conversationTabs: ConversationTab[];
  activeConversationTabId: string;
  documentTabs: DocumentTab[];
  activeDocumentTabId: string;
};

type NodePanelStateMap = Record<WorkNode, NodePanelState>;

type PendingReplyState = {
  requestId: string;
  conversationTabId: string;
  documentTabId: string;
  assistantMessageId: string;
  baseDocument: NodeDocument | null;
};

type WorkspaceViewState = {
  isOpen: boolean;
  selectedFilePath: string | null;
  expandedDirectories: Record<string, boolean>;
};

type ProjectOverviewTone = "neutral" | "good" | "warn" | "risk" | "info";

type ProjectOverviewLogEntry = {
  id: string;
  time: string;
  kind: string;
  summary: string;
  meta: string;
  tone: ProjectOverviewTone;
};

type ProjectOverviewPlanItem = {
  id: string;
  label: string;
  stage: string;
  status: NodeStatus;
  updatedAt: string | null;
  summary: string;
  document: NodeDocument | null;
};

type ProjectOverviewState = {
  messages: ConversationMessage[];
  draft: string;
  pendingReplyId: string | null;
  activePlanId: string;
};

type ProjectWorkspace = {
  selectedNode: WorkNode;
  workspaceView: WorkspaceViewState;
  drafts: Partial<Record<WorkNode, string>>;
  nodePanels: NodePanelStateMap;
  pendingReplies: Partial<Record<WorkNode, PendingReplyState>>;
};

type EditingTabState = {
  kind: "conversation" | "document";
  node: WorkNode;
  tabId: string;
  value: string;
} | null;

type EditingDocumentState = {
  node: WorkNode;
  tabId: string;
  value: string;
} | null;

type PendingTabDeleteState = {
  kind: "conversation" | "document";
  node: WorkNode;
  tabId: string;
  label: string;
} | null;

type CreateProjectDraft = {
  requirement: string;
  name: string;
  templateId: string;
  sector: string;
  owner: string;
};

type WorkspaceDocumentStatus = "idle" | "loading" | "ready" | "saving" | "error";

type WorkspaceDocumentState = {
  file: ForgeWorkspaceFileRecord | null;
  status: WorkspaceDocumentStatus;
  error: string;
  editingValue: string | null;
};

type WorkspaceCreateDialogState = {
  kind: "markdown" | "directory";
  path: string;
} | null;

type PendingWorkspaceDeleteState = {
  path: string;
  name: string;
  kind: "file" | "directory";
} | null;

const workNodes: WorkNode[] = [...projectWorkbenchNodes];

const fallbackWorkbenchModelOptions = [FORGE_LOCAL_FALLBACK_MODEL_OPTION];

function getProjectTemplate(snapshot: ForgeProjectsPageData, project: ForgeProject | null) {
  const profile = snapshot.projectProfiles.find((item) => item.projectId === project?.id);

  return (
    snapshot.projectTemplates.find(
      (item) => item.id === profile?.templateId || item.sector === project?.sector
    ) ?? null
  );
}

function getNodeFromStage(stage?: ForgeWorkflowStage | null): WorkNode {
  switch (stage) {
    case "项目接入":
      return "需求确认";
    case "方案与任务包":
      return "项目原型";
    case "开发执行":
      return "后端研发";
    case "测试验证":
      return "DEMO测试";
    case "交付发布":
      return "交付发布";
    case "归档复用":
      return "交付发布";
    default:
      return "需求确认";
  }
}

function getNodeIndex(node: WorkNode) {
  return workNodes.indexOf(node);
}

function isWorkNode(value?: string | null): value is WorkNode {
  return workNodes.includes(value as WorkNode);
}

function clampWorkNodeToVisible(node: WorkNode, visibleNodes: WorkNode[]) {
  return visibleNodes.includes(node) ? node : visibleNodes[0] ?? workNodes[0];
}

function getVisibleWorkNodesForProject(
  snapshot: ForgeProjectsPageData,
  projectId?: string | null
) {
  return getVisibleProjectWorkbenchNodes(snapshot, projectId) as WorkNode[];
}

function getValidInitialProjectId(snapshot: ForgeProjectsPageData, projectId?: string) {
  if (projectId && snapshot.projects.some((project) => project.id === projectId)) {
    return projectId;
  }

  return getActiveProject(snapshot)?.id ?? snapshot.projects[0]?.id ?? "";
}

function getNodeTone(status: NodeStatus) {
  switch (status) {
    case "已完成":
      return "good" as const;
    case "进行中":
      return "info" as const;
    case "已阻塞":
      return "risk" as const;
    default:
      return "neutral" as const;
  }
}

function createGeneratedNodeReply(input: {
  prompt: string;
  projectName: string;
  node: WorkNode;
  model: string;
  thinkingBudget: string;
}) {
  return `已根据你的输入更新当前节点结果，并补进 ${input.projectName} 的${input.node}上下文。当前采用 ${input.model}，思考预算 ${input.thinkingBudget}。`;
}

function createGeneratedDocument(input: {
  currentDocument: NodeDocument | null;
  projectName: string;
  prompt: string;
  node: WorkNode;
  model: string;
  thinkingBudget: string;
}): NodeDocument {
  const nextSection = [
    `## ${input.node}补充记录`,
    `用户输入：${input.prompt}`,
    `处理结论：已根据你的输入更新当前节点结果，并整理成可继续推进的版本。`,
    `执行参数：${input.model} · 思考预算 ${input.thinkingBudget}`
  ].join("\n");

  return {
    title: input.currentDocument?.title ?? `${input.projectName} ${input.node}结果`,
    updatedAt: "刚刚",
    body: input.currentDocument?.body
      ? `${input.currentDocument.body}\n\n${nextSection}`
      : `# ${input.node}\n\n${nextSection}`
  };
}

function createWorkbenchChatDocument(input: {
  currentDocument: NodeDocument | null;
  projectName: string;
  prompt: string;
  node: WorkNode;
  model: string;
  assistantReply: string;
}): NodeDocument {
  const nextSection = [
    `## ${input.node}工作台对话`,
    `用户输入：${input.prompt}`,
    `模型：${input.model}`,
    `回复：${input.assistantReply}`
  ].join("\n");

  return {
    title: input.currentDocument?.title ?? `${input.projectName} ${input.node}对话记录`,
    updatedAt: "刚刚",
    body: input.currentDocument?.body
      ? `${input.currentDocument.body}\n\n${nextSection}`
      : `# ${input.node}\n\n${nextSection}`
  };
}

function createPendingWorkbenchDocument(input: {
  currentDocument: NodeDocument | null;
  projectName: string;
  prompt: string;
  node: WorkNode;
  model: string;
}): NodeDocument {
  const nextSection = [
    `## ${input.node}工作台对话`,
    `用户输入：${input.prompt}`,
    `模型：${input.model}`,
    "回复：正在等待模型回复..."
  ].join("\n");

  return {
    title: input.currentDocument?.title ?? `${input.projectName} ${input.node}对话记录`,
    updatedAt: "刚刚",
    body: input.currentDocument?.body
      ? `${input.currentDocument.body}\n\n${nextSection}`
      : `# ${input.node}\n\n${nextSection}`
  };
}

function createCommandExecutionDocument(input: {
  currentDocument: NodeDocument | null;
  executionSummary: string;
  assistantReply?: string;
  modelExecution?: ExecuteForgeCommandResult["modelExecution"];
  node: WorkNode;
  projectName: string;
  prompt: string;
  commandId: string;
}): NodeDocument {
  const nextSection = [
    `## ${input.node}真实执行`,
    `用户输入：${input.prompt}`,
    `触发命令：${input.commandId}`,
    `执行结果：${input.executionSummary}`,
    input.modelExecution?.summary ? `模型回复：${input.modelExecution.summary}` : null,
    input.assistantReply?.trim() && input.assistantReply.trim() !== input.executionSummary.trim()
      ? input.assistantReply.trim()
      : null
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: input.currentDocument?.title ?? `${input.projectName} ${input.node}结果`,
    updatedAt: "刚刚",
    body: input.currentDocument?.body
      ? `${input.currentDocument.body}\n\n${nextSection}`
      : `# ${input.node}\n\n${nextSection}`
  };
}

function getWorkbenchCommandId(node: WorkNode) {
  switch (node) {
    case "需求确认":
      return "command-prd-generate";
    case "项目原型":
      return "command-taskpack-generate";
    case "UI设计":
      return "command-component-assemble";
    case "后端研发":
      return "command-execution-start";
    case "DEMO测试":
      return "command-gate-run";
    case "内测调优":
      return "command-review-run";
    case "交付发布":
      return "command-release-prepare";
    default:
      return null;
  }
}

function getNodeStatus(
  node: WorkNode,
  currentNode: WorkNode,
  workflowState: ForgeDashboardSnapshot["workflowStates"][number] | null
): NodeStatus {
  if (workflowState?.currentStage === "归档复用") {
    return "已完成";
  }

  const nodeIndex = getNodeIndex(node);
  const currentIndex = getNodeIndex(currentNode);

  if (nodeIndex < currentIndex) {
    return "已完成";
  }

  if (nodeIndex === currentIndex) {
    return workflowState?.state === "blocked" ? "已阻塞" : "进行中";
  }

  return "待开始";
}

function getAgentMeta(
  snapshot: ForgeProjectsPageData,
  projectId: string | null | undefined,
  node: WorkNode
) {
  const resolvedAgent = getProjectWorkbenchAgent(snapshot, projectId, node);

  if (resolvedAgent) {
    const displayProfile = getForgeAgentDisplayProfile(resolvedAgent);

    return {
      name: displayProfile.assignmentLabel,
      role: resolvedAgent.responsibilities[0] ?? "负责当前节点推进"
    };
  }

  switch (node) {
    case "需求确认":
      return {
        name: getForgeAgentDisplayLabel({ id: "agent-pm", role: "pm" }),
        role: "负责需求澄清与验收边界"
      };
    case "项目原型":
      return {
        name: ARCHITECT_AGENT_NAME,
        role: "负责方案收口与模块边界"
      };
    case "UI设计":
      return {
        name: DESIGN_AGENT_NAME,
        role: "负责页面结构与交互规范"
      };
    case "后端研发":
      return {
        name: ENGINEER_AGENT_NAME,
        role: "负责研发落地与结果生成"
      };
    case "DEMO测试":
      return {
        name: QA_AGENT_NAME,
        role: "负责回归验证与阻塞归因"
      };
    case "内测调优":
      return {
        name: KNOWLEDGE_AGENT_NAME,
        role: "负责内测反馈与调优建议"
      };
    case "交付发布":
      return {
        name: RELEASE_AGENT_NAME,
        role: "负责交付说明与放行结论"
      };
    default:
      return { name: "执行 Agent", role: "负责当前节点推进" };
  }
}

function createSeededConversationMessage(
  speaker: string,
  text: string,
  time = "刚刚"
): ConversationMessage {
  return {
    id: `${speaker}-${text.slice(0, 12)}-${time}`,
    speaker,
    role: "ai",
    text,
    time
  };
}

function createSeededDocument(
  title: string,
  sections: Array<string | null | undefined>,
  updatedAt?: string | null
): NodeDocument {
  return {
    title,
    updatedAt: updatedAt ?? "刚刚",
    body: sections.filter(Boolean).join("\n\n")
  };
}

function createSeededDocumentTab(
  id: string,
  label: string,
  document: NodeDocument | null
): SeededDocumentTab {
  return {
    id,
    label,
    document
  };
}

function buildRequirementUserStoryLines(project: ForgeProject | null, capabilities: string[]) {
  const projectSignals = [project?.name, project?.requirement, project?.sector, project?.projectType]
    .filter(Boolean)
    .join(" ");

  if (/(律所|法律|案件管理|案件工作台|客户进度|非诉)/.test(projectSignals)) {
    return [
      "- 作为案件主办律师，我需要在案件工作台里统一查看阶段推进、任务、日志和文件，避免跨系统协作。",
      "- 作为律所运营或合伙人，我需要在案件中心快速检索案件并判断当前推进状态，便于统筹资源。",
      "- 作为委托客户，我需要查看案件当前阶段、最近更新和关键进展，减少线下重复沟通。"
    ];
  }

  if (capabilities.length > 0) {
    return capabilities.map((capability) => `- 作为业务负责人，我需要系统稳定支持「${capability}」这类核心场景。`);
  }

  return ["- 作为项目负责人，我需要先锁定首轮交付范围、核心流程和验收口径。"];
}

function buildRequirementFlowLines(project: ForgeProject | null) {
  const projectSignals = [project?.name, project?.requirement, project?.sector, project?.projectType]
    .filter(Boolean)
    .join(" ");

  if (/(律所|法律|案件管理|案件工作台|客户进度|非诉)/.test(projectSignals)) {
    return [
      "- 案件录入后进入案件中心，支持按案号、案由和委托人检索。",
      "- 主办律师进入案件工作台，按阶段轨道推进任务、日志、文件和日程。",
      "- 客户进度页同步关键阶段与最近进展，形成对外口径。"
    ];
  }

  return [
    "- 客户需求进入项目后，先确认首轮范围和关键目标。",
    "- 再由方案、设计和研发节点逐步拆解成可交付产物。",
    "- 最终通过测试、发布和交付形成闭环。"
  ];
}

function buildRequirementAcceptanceLines(project: ForgeProject | null, capabilities: string[]) {
  const projectSignals = [project?.name, project?.requirement, project?.sector, project?.projectType]
    .filter(Boolean)
    .join(" ");

  if (/(律所|法律|案件管理|案件工作台|客户进度|非诉)/.test(projectSignals)) {
    return [
      "- 案件中心可按关键字段检索并展示案件台账。",
      "- 案件工作台能覆盖阶段推进、任务协作、案件日志和案件文件。",
      "- 客户进度查询页能展示阶段、最近更新和关键进展。"
    ];
  }

  if (capabilities.length > 0) {
    return capabilities.map((capability) => `- 已明确「${capability}」进入首轮验收范围。`);
  }

  return ["- 已明确首轮主链路、核心页面和交付边界。"];
}

function formatProjectDeliveryDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = value.match(/(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildRequirementRiskLines(project: ForgeProject | null) {
  const deliveryDate = formatProjectDeliveryDate(project?.deliveryDate);

  return [
    deliveryDate ? `- 交付时间以 ${deliveryDate} 为目标，需要控制范围膨胀。` : null,
    "- 当前版本优先保障主链路可演示，复杂场景和边缘流程按后续迭代收口。",
    "- 若上游业务口径继续变化，需要同步更新 PRD、原型和研发任务包。"
  ].filter((line): line is string => Boolean(line));
}

function buildArchitectureObjectLines(project: ForgeProject | null) {
  const projectSignals = [project?.name, project?.requirement, project?.sector, project?.projectType]
    .filter(Boolean)
    .join(" ");

  if (/(律所|法律|案件管理|案件工作台|客户进度|非诉)/.test(projectSignals)) {
    return [
      "- 案件：案号、案由、委托人、当前阶段、负责人。",
      "- 阶段任务：节点、状态、责任人、完成时间。",
      "- 案件日志：关键动作、更新时间、操作人。",
      "- 案件文件：目录、文件类型、上传记录、归档状态。"
    ];
  }

  return [
    "- 项目主体对象：项目、任务、文档、日志。",
    "- 交付对象：阶段、产物、状态、负责人。"
  ];
}

function buildArchitectureInterfaceLines(project: ForgeProject | null) {
  const projectSignals = [project?.name, project?.requirement, project?.sector, project?.projectType]
    .filter(Boolean)
    .join(" ");

  if (/(律所|法律|案件管理|案件工作台|客户进度|非诉)/.test(projectSignals)) {
    return [
      "- 案件中心需要案件列表、检索和案件详情读取接口。",
      "- 案件工作台需要阶段流转、任务更新、日志写入和文件目录接口。",
      "- 客户进度查询需要只读进度接口，对外暴露最新阶段与关键进展。"
    ];
  }

  return [
    "- 需要补齐列表查询、详情读取和状态流转接口边界。",
    "- 对外展示和内部编辑的接口口径要保持一致。"
  ];
}

function buildArchitectureTaskLines(
  taskPackArtifact: ForgeDashboardSnapshot["artifacts"][number] | null,
  patchRun: ForgeDashboardSnapshot["runs"][number] | null
) {
  return [
    "- 先完成模块划分和对象边界，再进入接口与页面联调。",
    taskPackArtifact ? `- 研发执行按《${taskPackArtifact.title}》拆分任务。` : "- 研发执行需要按任务包拆分实现范围。",
    patchRun ? `- 当前实现链路已接入《${patchRun.title}》执行。` : "- 下游实现链路将在研发节点继续推进。"
  ];
}

function buildUiRuleLines(project: ForgeProject | null) {
  const projectSignals = [project?.name, project?.requirement, project?.sector, project?.projectType]
    .filter(Boolean)
    .join(" ");

  if (/(律所|法律|案件管理|案件工作台|客户进度|非诉)/.test(projectSignals)) {
    return [
      "- 阶段轨道、案件任务、案件日志和案件文件使用统一状态反馈与层级结构。",
      "- 关键列表页优先保证检索、筛选、状态标识和进入详情的路径清晰。",
      "- 对外客户进度页与内部案件状态保持同源字段，避免口径不一致。"
    ];
  }

  return [
    "- 关键页面沿用统一的信息分层、状态反馈和操作节奏。",
    "- 主链路优先，次级操作与边缘交互后置。"
  ];
}

function buildUiExceptionLines(project: ForgeProject | null) {
  const projectSignals = [project?.name, project?.requirement, project?.sector, project?.projectType]
    .filter(Boolean)
    .join(" ");

  if (/(律所|法律|案件管理|案件工作台|客户进度|非诉)/.test(projectSignals)) {
    return [
      "- 案件文件上传失败时，需要保留失败状态、重试入口和目录上下文。",
      "- 阶段流转受限时，需要明确提示依赖条件和待补动作。",
      "- 客户进度页无更新时，需要展示最近一次有效进展而不是空白页。"
    ];
  }

  return [
    "- 网络失败、空数据和权限不足场景需有统一兜底。",
    "- 关键操作失败后要保留当前上下文并支持重试。"
  ];
}

function getProjectDebugUrl(
  profile:
    | ForgeDashboardSnapshot["projectProfiles"][number]
    | null
    | undefined
) {
  const normalizedWorkspacePath = normalizeWorkspacePath(profile?.workspacePath);

  if (!normalizedWorkspacePath) {
    return null;
  }

  const configuredWorkspace = getConfiguredProjectDebugWorkspaceMappings().find(
    (item) => item.workspacePath === normalizedWorkspacePath
  );

  return configuredWorkspace?.debugUrl ?? null;
}

function stripMarkdownLinePrefix(line: string) {
  return line.replace(/^- /u, "").trim();
}

function splitPreviewLine(line: string) {
  const normalizedLine = stripMarkdownLinePrefix(line);
  const [title, ...rest] = normalizedLine.split("：");
  return {
    title: title?.trim() || normalizedLine,
    description: rest.join("：").trim() || normalizedLine
  };
}

function buildDocumentVisualPreview(
  node: WorkNode,
  outputProfile: ProjectOutputProfile
): DocumentVisualPreview | null {
  const architectureEntries = outputProfile.architectureLines.map(splitPreviewLine);
  const coverageEntries = outputProfile.uiCoverageLines.map(splitPreviewLine);
  const architectureByTitle = new Map(
    architectureEntries.map((entry) => [entry.title, entry.description] as const)
  );
  const coverageByTitle = new Map(
    coverageEntries.map((entry) => [entry.title, entry.description] as const)
  );
  const isLawProject =
    architectureByTitle.has("案件中心") ||
    architectureByTitle.has("案件工作台") ||
    coverageByTitle.has("客户进度查询");

  if (node === "项目原型") {
    return {
      ariaLabel: "原型预览",
      title: "结构与线框预览",
      summary: "把模块结构和主流程先变成可看的原型画板，方便台上讲解。",
      variant: "prototype",
      cards: [
        {
          eyebrow: "信息架构",
          title: isLawProject ? "案件中心总览" : "模块总览",
          description:
            architectureByTitle.get("案件中心") ??
            architectureEntries[0]?.description ??
            "先把核心模块、列表检索和台账入口放到统一总览里。",
          chips: isLawProject ? ["检索", "排序", "台账"] : ["导航", "模块", "总览"],
          accent: "blue"
        },
        {
          eyebrow: "主工作区",
          title: isLawProject ? "阶段轨道工作区" : "主流程工作区",
          description:
            architectureByTitle.get("案件工作台") ??
            coverageEntries[0]?.description ??
            "用阶段轨道、任务区和日志区串起核心推进链路。",
          chips: isLawProject ? ["轨道", "任务", "日志"] : ["流程", "任务", "记录"],
          accent: "amber"
        },
        {
          eyebrow: "对外同步",
          title: isLawProject ? "客户端进度页" : "进度同步页",
          description:
            architectureByTitle.get("客户进度查询") ??
            coverageByTitle.get("客户进度查询") ??
            outputProfile.designConclusionLines[2] ??
            "把关键里程碑和最近更新整理成对外可查看页面。",
          chips: isLawProject ? ["节点状态", "最近更新", "委托人"] : ["里程碑", "更新", "交付"],
          accent: "green"
        }
      ]
    };
  }

  if (node === "UI设计") {
    return {
      ariaLabel: "设计稿预览",
      title: "页面设计稿预览",
      summary: "保留关键页面的视觉画板，方便在讲解时直接展示界面布局。",
      variant: "design",
      cards: [
        {
          eyebrow: "设计稿 01",
          title: isLawProject ? "案件工作台画板" : "主流程画板",
          description:
            coverageByTitle.get("案件工作台") ??
            outputProfile.designConclusionLines[0] ??
            coverageEntries[0]?.description ??
            "突出主流程的阶段推进、任务协作和日志留痕。",
          chips: isLawProject ? ["阶段轨道", "任务列表", "日志侧栏"] : ["主流程", "导航", "信息区"],
          accent: "blue"
        },
        {
          eyebrow: "设计稿 02",
          title: isLawProject ? "案件文件抽屉" : "资料协同抽屉",
          description:
            architectureByTitle.get("案件文件") ??
            outputProfile.designConclusionLines[1] ??
            "突出目录树、上传反馈和归档动作，体现资料协同能力。",
          chips: isLawProject ? ["目录树", "上传", "归档"] : ["附件", "抽屉", "协同"],
          accent: "amber"
        },
        {
          eyebrow: "设计稿 03",
          title: isLawProject ? "客户端进度页" : "外部进度页",
          description:
            coverageByTitle.get("客户进度查询") ??
            outputProfile.designConclusionLines[2] ??
            "把里程碑、最近更新和对外同步口径收在一个轻量页面里。",
          chips: isLawProject ? ["里程碑", "最近更新", "客户视角"] : ["里程碑", "同步", "外部视图"],
          accent: "green"
        }
      ]
    };
  }

  return null;
}

function extractRequirementCapabilities(requirement: string | null | undefined) {
  const normalizedRequirement = requirement?.trim() ?? "";

  if (!normalizedRequirement) {
    return [];
  }

  const capabilityClause =
    normalizedRequirement.match(/支持([^。；]+)/)?.[1] ??
    normalizedRequirement.match(/覆盖([^。；]+)/)?.[1] ??
    "";

  if (!capabilityClause) {
    return [];
  }

  return capabilityClause
    .split(/[、，,和及]/)
    .map((item) => item.replace(/[。；；,.]/g, "").trim())
    .filter(Boolean);
}

type ProjectOutputProfile = {
  architectureHeading: string;
  architectureLines: string[];
  uiCoverageHeading: string;
  uiCoverageLines: string[];
  designConclusionLines: string[];
  engineeringHeading: string;
  engineeringLines: string[];
  testingHeading: string;
  testingLines: string[];
  releaseHeading: string;
  releaseLines: string[];
};

function getProjectOutputProfile(
  project: ForgeProject | null,
  capabilities: string[]
): ProjectOutputProfile {
  const projectSignals = [
    project?.name,
    project?.sector,
    project?.projectType,
    project?.requirement
  ]
    .filter(Boolean)
    .join(" ");

  if (/(律所|法律|案件管理|案件工作台|客户进度|非诉)/.test(projectSignals)) {
    return {
      architectureHeading: "模块结构",
      architectureLines: [
        "- 案件中心：支持案件检索、排序和案件台账浏览。",
        "- 案件工作台：围绕阶段轨道推进案件任务、基础信息和案件日程。",
        "- 案件日志：记录关键动作并同步最近更新时间。",
        "- 案件文件：按案件目录归档委托手续、证据材料和内部文件。",
        "- 客户进度查询：向委托人同步当前阶段、最近更新和关键进展。"
      ],
      uiCoverageHeading: "页面与流程覆盖",
      uiCoverageLines: [
        "- 案件工作台：阶段轨道、案件任务、案件日志、基础信息、案件日程、案件文件。",
        "- 案件中心：支持按案号、案由、委托人检索案件。",
        "- 客户进度查询：向委托人展示案件推进进度和最近更新。"
      ],
      designConclusionLines: [
        "- 已收口案件工作台的阶段推进、任务协作和日志留痕。",
        "- 已明确案件文件目录、上传、重命名和归档反馈。",
        "- 已统一客户进度查询与内部案件状态的同步口径。"
      ],
      engineeringHeading: "联调覆盖",
      engineeringLines: [
        "- 案件录入与立案准备主链路。",
        "- 阶段轨道与任务状态流转。",
        "- 案件文件目录创建、上传与证据归档。",
        "- 客户进度查询与案件更新同步。"
      ],
      testingHeading: "回归范围",
      testingLines: [
        "- 案件录入",
        "- 任务流转",
        "- 证据归档",
        "- 客户进度查询"
      ],
      releaseHeading: "现场演示范围",
      releaseLines: [
        "- 案件中心与案件搜索",
        "- 案件工作台阶段推进",
        "- 案件文件与目录管理",
        "- 客户进度查询"
      ]
    };
  }

  const normalizedCapabilities =
    capabilities.length > 0
      ? capabilities
      : [project?.projectType, project?.sector].filter(Boolean) as string[];
  const coverageLines =
    normalizedCapabilities.length > 0
      ? normalizedCapabilities.map((item) => `- ${item}`)
      : ["- 已围绕当前项目需求收口首轮范围。"];

  return {
    architectureHeading: "方案覆盖",
    architectureLines: coverageLines,
    uiCoverageHeading: "页面与流程覆盖",
    uiCoverageLines: coverageLines,
    designConclusionLines: [
      "- 关键页面结构和主流程已经收口。",
      "- 已补齐主要异常态和交互说明。",
      "- 交互规范已对齐到可研发的组件边界。"
    ],
    engineeringHeading: "联调覆盖",
    engineeringLines: coverageLines,
    testingHeading: "回归范围",
    testingLines: coverageLines,
    releaseHeading: "现场演示范围",
    releaseLines: coverageLines
  };
}

function getAgentLabelById(
  snapshot: ForgeProjectsPageData,
  agentId: string | null | undefined
) {
  if (!agentId) {
    return "未指定";
  }

  const matchedAgent = snapshot.agents.find((agent) => agent.id === agentId);

  return matchedAgent ? getForgeAgentDisplayLabel(matchedAgent) : agentId;
}

function getComponentLabelsByIds(
  snapshot: ForgeProjectsPageData,
  componentIds: string[] | undefined
) {
  return (componentIds ?? [])
    .map((componentId) => snapshot.components.find((component) => component.id === componentId)?.title ?? componentId)
    .filter(Boolean);
}

function formatReviewDecisionLabel(decision: ForgeDashboardSnapshot["artifactReviews"][number]["decision"]) {
  switch (decision) {
    case "pass":
      return "通过";
    case "changes-requested":
      return "需修改";
    default:
      return "待确认";
  }
}

function formatDeliveryGateStatusLabel(status: ForgeDashboardSnapshot["deliveryGate"][number]["status"]) {
  switch (status) {
    case "pass":
      return "通过";
    case "fail":
      return "失败";
    default:
      return "待确认";
  }
}

function getDefaultNextAction(node: WorkNode, status: NodeStatus) {
  if (status === "待开始") {
    return "等待上游节点完成后再推进当前节点。";
  }

  switch (node) {
    case "需求确认":
      return "继续查看项目原型、UI 设计和研发任务包。";
    case "项目原型":
      return "将原型、架构说明和 TaskPack 一起移交研发执行。";
    case "UI设计":
      return "基于交互规范推进主流程和异常态联调。";
    case "后端研发":
      return "将补丁与 Demo 构建移交给测试节点做回归。";
    case "DEMO测试":
      return "说明历史阻塞已修复，再进入交付发布确认。";
    case "内测调优":
      return "整理内测反馈，收口演示版本和发布备注。";
    case "交付发布":
      return "确认交付说明后，点击一键部署完成闭环。";
    default:
      return "继续推进当前节点。";
  }
}

function buildSeededNodeWorkbench(
  snapshot: ForgeProjectsPageData,
  project: ForgeProject | null,
  workflowState: ForgeDashboardSnapshot["workflowStates"][number] | null
): NodeWorkbench[] {
  const currentNode = getNodeFromStage(workflowState?.currentStage);
  const isArchivedProject = workflowState?.currentStage === "归档复用";
  const projectId = project?.id;
  const projectPrd =
    snapshot.prdDocuments.find((item) => item.projectId === projectId) ?? null;
  const projectArtifacts = snapshot.artifacts.filter((item) => item.projectId === projectId);
  const projectTasks = snapshot.tasks.filter((item) => item.projectId === projectId);
  const projectRuns = snapshot.runs.filter((item) => item.projectId === projectId);
  const projectRunEvents = snapshot.runEvents.filter((item) => item.projectId === projectId);
  const projectCapabilities = extractRequirementCapabilities(project?.requirement);
  const outputProfile = getProjectOutputProfile(project, projectCapabilities);
  const artifactByType = (type: ForgeDashboardSnapshot["artifacts"][number]["type"]) =>
    projectArtifacts.find((item) => item.type === type) ?? null;
  const latestFailureEvent =
    [...projectRunEvents].reverse().find((item) => item.type === "failure") ?? null;
  const activeReview =
    snapshot.artifactReviews.find((review) =>
      projectArtifacts.some((artifact) => artifact.id === review.artifactId)
    ) ?? null;
  const patchRun =
    projectRuns.find((item) => item.title.includes("补丁")) ??
    projectRuns.find((item) => item.outputChecks.some((check) => check.summary?.includes("Claude Code"))) ??
    null;
  const playwrightRun =
    projectRuns.find((item) => item.executor.includes("Playwright")) ??
    projectRuns.find((item) => item.title.includes("回归")) ??
    null;
  const releaseBrief = artifactByType("release-brief");
  const releaseDecision = artifactByType("review-decision");
  const architectureArtifact = artifactByType("architecture-note");
  const uiSpecArtifact = artifactByType("ui-spec");
  const taskPackArtifact = artifactByType("task-pack");
  const demoBuildArtifact = artifactByType("demo-build");
  const testReportArtifact = artifactByType("test-report");
  const demoBuildReview =
    snapshot.artifactReviews.find((review) => review.artifactId === demoBuildArtifact?.id) ?? null;
  const readyArtifacts = projectArtifacts.filter((item) => item.status === "ready");
  const openProjectTasks = projectTasks.filter((item) => item.status !== "done");
  const testingTasks = projectTasks.filter(
    (item) => item.stage === "测试验证" && item.status !== "done"
  );
  const releaseBlockers = workflowState?.blockers ?? [];
  const nextTask =
    projectTasks.find((item) => item.status !== "done") ??
    projectTasks.find((item) => item.stage === "交付发布") ??
    null;

  return workNodes.map((node) => {
    const status = getNodeStatus(node, currentNode, workflowState);
    const agent = getAgentMeta(snapshot, projectId, node);
    let summary =
      node === currentNode && workflowState?.blockers.length
        ? workflowState.blockers[0]
        : getDefaultNextAction(node, status);
    let nextAction = getDefaultNextAction(node, status);
    let conversation: ConversationMessage[] = [];
    let documents: SeededDocumentTab[] = [];

    if (node === "需求确认" && projectPrd) {
      summary = "客户原始需求已整理成结构化 PRD，可直接进入后续节点讲解。";
      nextAction = "继续切到项目原型和 UI 设计，展示方案如何被团队分工推进。";
      conversation = [
        createSeededConversationMessage(
          agent.name,
          `已将客户原始需求收口成《${projectPrd.title}》，核心目标和验收范围已经锁定。`,
          projectPrd.createdAt
        )
      ];
      documents = [
        createSeededDocumentTab(
          projectPrd.id,
          projectPrd.title,
          createSeededDocument(
            projectPrd.title,
            [
              projectPrd.content,
              "## 项目背景",
              project?.enterpriseName ? `- 企业名称：${project.enterpriseName}` : null,
              project?.sector ? `- 所属行业：${project.sector}` : null,
              project?.projectType ? `- 项目类型：${project.projectType}` : null,
              project?.requirement ? `- 客户原始需求：${project.requirement}` : null,
              "## 项目目标",
              "- 先交付首轮可演示主链路，再按节点逐步补齐扩展能力。",
              projectCapabilities.length > 0
                ? `## 用户故事\n${buildRequirementUserStoryLines(project, projectCapabilities).join("\n")}`
                : `## 用户故事\n${buildRequirementUserStoryLines(project, projectCapabilities).join("\n")}`,
              `## 核心流程\n${buildRequirementFlowLines(project).join("\n")}`,
              `## 验收标准\n${buildRequirementAcceptanceLines(project, projectCapabilities).join("\n")}`,
              `## 风险边界\n${buildRequirementRiskLines(project).join("\n")}`
            ],
            projectPrd.createdAt
          )
        )
      ];
    }

    if (node === "项目原型" && (architectureArtifact || uiSpecArtifact || taskPackArtifact)) {
      summary = "原型、架构说明和 TaskPack 已形成，可交给研发继续执行。";
      nextAction = "说明这是多角色协作产物，而不是单次生成结果。";
      conversation = [
        createSeededConversationMessage(
          agent.name,
          `项目原型阶段已经产出 ${[architectureArtifact?.title, uiSpecArtifact?.title, taskPackArtifact?.title]
            .filter(Boolean)
            .join("、")}。`
        )
      ];
      documents = [
        architectureArtifact
          ? createSeededDocumentTab(
              `${node}-architecture-note`,
              architectureArtifact.title,
              createSeededDocument(
                architectureArtifact.title,
                [
                  `# ${architectureArtifact.title}`,
                  "## 产物信息",
                  `- 状态：${getProjectOverviewArtifactStatusLabel(architectureArtifact.status)}`,
                  `- 负责人：${getAgentLabelById(snapshot, architectureArtifact.ownerAgentId)}`,
                  `- 更新时间：${formatTimestamp(architectureArtifact.updatedAt)}`,
                  projectPrd ? `## 上游依据\n- PRD：${projectPrd.title}` : null,
                  outputProfile.architectureLines.length > 0
                    ? `## 模块划分\n${outputProfile.architectureLines.join("\n")}`
                    : null,
                  `## 关键对象\n${buildArchitectureObjectLines(project).join("\n")}`,
                  `## 接口边界\n${buildArchitectureInterfaceLines(project).join("\n")}`,
                  `## 任务拆分\n${buildArchitectureTaskLines(taskPackArtifact, patchRun).join("\n")}`
                ],
                architectureArtifact.updatedAt
              )
            )
          : null,
        uiSpecArtifact
          ? createSeededDocumentTab(
              `${node}-ui-spec`,
              uiSpecArtifact.title,
              createSeededDocument(
                uiSpecArtifact.title,
                [
                  `# ${uiSpecArtifact.title}`,
                  "## 产物信息",
                  `- 状态：${getProjectOverviewArtifactStatusLabel(uiSpecArtifact.status)}`,
                  `- 负责人：${getAgentLabelById(snapshot, uiSpecArtifact.ownerAgentId)}`,
                  `- 更新时间：${formatTimestamp(uiSpecArtifact.updatedAt)}`,
                  outputProfile.uiCoverageLines.length > 0
                    ? `## 页面清单\n${outputProfile.uiCoverageLines.join("\n")}`
                    : null,
                  `## 交互规则\n${buildUiRuleLines(project).join("\n")}`,
                  `## 异常态\n${buildUiExceptionLines(project).join("\n")}`,
                  taskPackArtifact
                    ? `## 研发交接\n- 已同步到《${taskPackArtifact.title}》供研发执行。`
                    : "## 研发交接\n- 下一步进入研发节点拆解实现任务。"
                ],
                uiSpecArtifact.updatedAt
              )
            )
          : null,
        taskPackArtifact
          ? createSeededDocumentTab(
              `${node}-task-pack`,
              taskPackArtifact.title,
              createSeededDocument(
                taskPackArtifact.title,
                [
                  `# ${taskPackArtifact.title}`,
                  "## 产物信息",
                  `- 状态：${getProjectOverviewArtifactStatusLabel(taskPackArtifact.status)}`,
                  `- 负责人：${getAgentLabelById(snapshot, taskPackArtifact.ownerAgentId)}`,
                  `- 更新时间：${formatTimestamp(taskPackArtifact.updatedAt)}`,
                  "## 执行范围",
                  "- 已整理研发执行所需的任务包和交接口径",
                  projectCapabilities.length > 0
                    ? projectCapabilities.map((item) => `- ${item}`).join("\n")
                    : null,
                  patchRun ? `## 下游进展\n- 已进入《${patchRun.title}》执行链。` : null
                ],
                taskPackArtifact.updatedAt
              )
            )
          : null
      ].filter((item): item is SeededDocumentTab => Boolean(item));
    }

    if (node === "UI设计" && uiSpecArtifact) {
      summary = "设计角色已把原型和交互规范沉淀成可交付的 UI 结果。";
      nextAction = "继续切到后端研发，展示设计结果如何进入实现。";
      conversation = [
        createSeededConversationMessage(
          agent.name,
          `已输出《${uiSpecArtifact.title}》，关键页面结构和异常态交互都已经收口。`
        )
      ];
      documents = [
        createSeededDocumentTab(
          `${node}-ui-spec`,
          uiSpecArtifact.title,
          createSeededDocument(
            uiSpecArtifact.title,
            [
              `# ${uiSpecArtifact.title}`,
              "## 产物信息",
              `- 状态：${getProjectOverviewArtifactStatusLabel(uiSpecArtifact.status)}`,
              `- 负责人：${getAgentLabelById(snapshot, uiSpecArtifact.ownerAgentId)}`,
              `- 更新时间：${formatTimestamp(uiSpecArtifact.updatedAt)}`,
              outputProfile.uiCoverageLines.length > 0
                ? `## 页面清单\n${outputProfile.uiCoverageLines.join("\n")}`
                : null,
              "## 关键画板",
              outputProfile.designConclusionLines.join("\n"),
              `## 交互规则\n${buildUiRuleLines(project).join("\n")}`,
              `## 异常态\n${buildUiExceptionLines(project).join("\n")}`,
              taskPackArtifact ? `## 研发交接\n- 已同步到《${taskPackArtifact.title}》供研发执行。` : "## 研发交接\n- 研发将按页面清单和交互规范进入实现。"
            ],
            uiSpecArtifact.updatedAt
          )
        )
      ];
    }

    if (node === "后端研发" && patchRun) {
      const runChecks = patchRun.outputChecks
        .map((check) => `- ${check.name}：${check.summary ?? check.status}`)
        .join("\n");
      const linkedComponentLabels = getComponentLabelsByIds(snapshot, patchRun.linkedComponentIds);
      const engineeringChangeLines = [
        linkedComponentLabels.length > 0 ? `- 关联组件：${linkedComponentLabels.join("、")}` : null,
        taskPackArtifact ? `- 关联任务包：${taskPackArtifact.title}` : null,
        demoBuildArtifact ? `- 下游交付件：${demoBuildArtifact.title}` : null
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n");
      const openTaskLines = openProjectTasks
        .map((task) => `- [${task.priority}] ${task.title}（${getTaskStatusLabel(task.status)}）`)
        .join("\n");
      summary = "研发执行已经产出补丁和 Demo 构建，可直接展示运行证据。";
      nextAction = "切到 DEMO 测试，展示测试结果如何回流项目工作台。";
      conversation = [
        createSeededConversationMessage(
          agent.name,
          `${agent.name} 已完成《${patchRun.title}》，并保留了运行时证据和模型执行记录。`
        )
      ];
      documents = [
        createSeededDocumentTab(
          `${node}-patch-run`,
          patchRun.title,
          createSeededDocument(
            patchRun.title,
            [
              `# ${patchRun.title}`,
              "## 当前状态",
              `- 状态：${getRunStateLabel(patchRun)}`,
              `- 执行器：${patchRun.executor}`,
              `- 成本：${patchRun.cost}`,
              patchRun.outputMode ? `- 输出模式：${patchRun.outputMode}` : null,
              outputProfile.engineeringLines.length > 0
                ? `## 实现范围\n${outputProfile.engineeringLines.join("\n")}`
                : null,
              engineeringChangeLines ? `## 关键改动\n${engineeringChangeLines}` : null,
              runChecks ? `## 运行验证\n${runChecks}` : null,
              openTaskLines ? `## 风险与待补\n${openTaskLines}` : "## 风险与待补\n- 当前无新增待补事项。"
            ],
            "刚刚"
          )
        ),
        demoBuildArtifact
          ? createSeededDocumentTab(
              `${node}-demo-build`,
              demoBuildArtifact.title,
              createSeededDocument(
                demoBuildArtifact.title,
                [
                  `# ${demoBuildArtifact.title}`,
                  "## 交付件状态",
                  `- 状态：${getProjectOverviewArtifactStatusLabel(demoBuildArtifact.status)}`,
                  `- 负责人：${getAgentLabelById(snapshot, demoBuildArtifact.ownerAgentId)}`,
                  `- 更新时间：${formatTimestamp(demoBuildArtifact.updatedAt)}`,
                  demoBuildReview ? `## 评审结论\n- ${demoBuildReview.summary}` : null,
                  demoBuildReview?.conditions.length
                    ? `## 整改要求\n${demoBuildReview.conditions.map((item) => `- ${item}`).join("\n")}`
                    : null,
                  "## 下游移交",
                  "- Demo 构建已准备好移交测试节点回归。"
                ],
                demoBuildArtifact.updatedAt
              )
            )
          : null
      ].filter((item): item is SeededDocumentTab => Boolean(item));
    }

    if (node === "DEMO测试" && (latestFailureEvent || testReportArtifact || activeReview || playwrightRun)) {
      const testingActionLines = [
        ...(activeReview?.conditions ?? []).map((item) => `- ${item}`),
        ...testingTasks.map((task) => `- [${task.priority}] ${task.title}（${getTaskStatusLabel(task.status)}）`)
      ].join("\n");
      summary = latestFailureEvent
        ? "测试节点保留了历史失败证据，便于现场说明修复闭环。"
        : "测试结果已经沉淀，可直接说明回归结论。";
      nextAction =
        nextTask?.summary ??
        "说明问题已经定位完成，再进入交付发布执行一键部署。";
      conversation = [
        createSeededConversationMessage(
          agent.name,
          latestFailureEvent
            ? `已保留失败证据「${latestFailureEvent.summary}」，同时把下一步动作回写到工作台。`
            : "测试报告与评审结论已经整理完成。"
        )
      ];
      documents = [
        createSeededDocumentTab(
          `${node}-test-report`,
          testReportArtifact?.title ?? "测试门禁与回归记录",
          createSeededDocument(
            testReportArtifact?.title ?? "测试门禁与回归记录",
            [
              `# ${testReportArtifact?.title ?? "测试门禁与回归记录"}`,
              "## 测试结论",
              latestFailureEvent
                ? `- ${latestFailureEvent.summary}`
                : `- ${activeReview?.summary ?? "测试验证正在推进中。"}`,
              `- 阶段状态：${status}`,
              snapshot.deliveryGate.length > 0
                ? `## 门禁状态\n${snapshot.deliveryGate
                    .map((gate) => `- ${gate.name}：${formatDeliveryGateStatusLabel(gate.status)}`)
                    .join("\n")}`
                : null,
              outputProfile.testingLines.length > 0
                ? `## 测试范围\n${outputProfile.testingLines.join("\n")}`
                : null,
              latestFailureEvent ? `## 阻塞项\n- ${latestFailureEvent.summary}` : null,
              activeReview
                ? `## 评审结论\n- 决议：${formatReviewDecisionLabel(activeReview.decision)}\n- ${activeReview.summary}`
                : null,
              testingActionLines ? `## 整改建议\n${testingActionLines}` : "## 整改建议\n- 当前无需新增整改动作。",
              `## 放行建议\n- ${nextAction}`,
              playwrightRun
                ? `## 回归执行\n- ${playwrightRun.title}\n- 状态：${getRunStateLabel(playwrightRun)}\n- 执行器：${playwrightRun.executor}\n- 成本：${playwrightRun.cost}`
                : null,
            ],
            testReportArtifact?.updatedAt ?? "刚刚"
          )
        ),
        playwrightRun
          ? createSeededDocumentTab(
              `${node}-playwright-run`,
              playwrightRun.title,
              createSeededDocument(
                playwrightRun.title,
                [
                  `# ${playwrightRun.title}`,
                  "## 执行状态",
                  `- 状态：${getRunStateLabel(playwrightRun)}`,
                  `- 执行器：${playwrightRun.executor}`,
                  `- 成本：${playwrightRun.cost}`,
                  playwrightRun.outputChecks.length > 0
                    ? `## 运行检查\n${playwrightRun.outputChecks
                        .map((check) => `- ${check.name}：${check.summary ?? check.status}`)
                        .join("\n")}`
                    : null,
                  latestFailureEvent ? `## 当前阻塞\n- ${latestFailureEvent.summary}` : null
                ],
                "刚刚"
              )
            )
          : null,
        activeReview
          ? createSeededDocumentTab(
              `${node}-review`,
              "测试评审结论",
              createSeededDocument(
                "测试评审结论",
                [
                  "# 测试评审结论",
                  `- 评审人：${getAgentLabelById(snapshot, activeReview.reviewerAgentId)}`,
                  `- 决议：${formatReviewDecisionLabel(activeReview.decision)}`,
                  `- 结论：${activeReview.summary}`,
                  activeReview.conditions.length
                    ? `## 修改条件\n${activeReview.conditions.map((item) => `- ${item}`).join("\n")}`
                    : null
                ],
                activeReview.reviewedAt
              )
            )
          : null
      ].filter((item): item is SeededDocumentTab => Boolean(item));
    }

    if (node === "内测调优") {
      summary =
        projectTasks.find((item) => item.stage === "测试验证" && item.status !== "done")?.summary ??
        "内测调优暂未单独展开，可按测试结论继续收口。";
      nextAction = "根据现场问题决定是否回流研发，或直接进入交付发布。";
      conversation =
        status === "待开始"
          ? []
          : [
              createSeededConversationMessage(
                agent.name,
                "内测调优节点已准备好承接测试反馈，当前演示可重点关注主链路。"
              )
            ];
      documents =
        status === "待开始"
          ? []
          : [
              createSeededDocumentTab(
                `${node}-review-report`,
                `${project?.name ?? "项目"} 内测调优建议`,
                createSeededDocument(`${project?.name ?? "项目"} 内测调优建议`, [
                  `# ${project?.name ?? "项目"} 内测调优建议`,
                  `- 当前结论：${summary}`,
                  `- 下一步：${nextAction}`
                ])
              )
            ];
    }

    if (node === "交付发布") {
      if (isArchivedProject) {
        summary = "已确认交付说明，部署演示已完成，项目进入归档复用。";
        nextAction = "可以切到资产管理或 AI 员工，继续展示知识沉淀与复用链路。";
        conversation = [
          createSeededConversationMessage(
            agent.name,
            `已确认《${releaseBrief?.title ?? "交付说明"}》，项目已进入归档复用，可继续展示资产沉淀。`
          )
        ];
        documents = [
          createSeededDocumentTab(
            `${node}-deployment-result`,
            `${project?.name ?? "项目"} 部署结果`,
            createSeededDocument(
              `${project?.name ?? "项目"} 部署结果`,
              [
                `# ${project?.name ?? "项目"} 部署结果`,
                `## 发布结论\n- 已确认《${releaseBrief?.title ?? "交付说明"}》，项目进入归档复用。`,
                readyArtifacts.length > 0
                  ? `## 交付清单\n${readyArtifacts
                      .map((artifact) => `- [${getProjectOverviewArtifactStageLabel(artifact.type)}] ${artifact.title}`)
                      .join("\n")}`
                  : null,
                "## 归档结果",
                "- 交付链路已经闭环，可继续展示交付说明、工件与归档沉淀。"
              ],
              releaseBrief?.updatedAt ?? "刚刚"
            )
          ),
          releaseBrief
            ? createSeededDocumentTab(
                `${node}-release-brief`,
                releaseBrief.title,
                createSeededDocument(
                  releaseBrief.title,
                  [
                    `# ${releaseBrief.title}`,
                    `## 发布结论\n- ${releaseBrief.status}`
                  ],
                  releaseBrief.updatedAt
                )
              )
            : null,
          releaseDecision
            ? createSeededDocumentTab(
                `${node}-review-decision`,
                releaseDecision.title,
                createSeededDocument(
                  releaseDecision.title,
                  [
                    `# ${releaseDecision.title}`,
                    "## 发布结论",
                    "- 放行评审已确认，可复用到后续交付归档"
                  ],
                  releaseDecision.updatedAt
                )
              )
            : null
        ].filter((item): item is SeededDocumentTab => Boolean(item));
      } else {
        summary = releaseBlockers.length
          ? "交付发布前还有阻塞项未清空，需要先完成门禁和待办收口。"
          : "交付说明和放行结论已经准备完成，可以直接触发部署演示。";
        nextAction = releaseBlockers[0] ?? "点击一键部署，展示从一句需求到可交付结果的闭环。";
        conversation = [
          createSeededConversationMessage(
            agent.name,
            releaseBlockers.length > 0
              ? `当前交付仍被阻塞：${releaseBlockers[0]}。建议先清空测试门禁和整改任务，再进入放行。`
              : `《${releaseBrief?.title ?? "交付说明"}》和《${releaseDecision?.title ?? "放行评审结论"}》均已就绪。`
          )
        ];
        documents = [
          createSeededDocumentTab(
            `${node}-release-readiness`,
            "交付准备清单",
            createSeededDocument(
              `${project?.name ?? "项目"} 交付准备清单`,
              [
                `# ${project?.name ?? "项目"} 交付准备清单`,
                "## 发布条件",
                `- 项目阶段：${formatWorkflowStageLabel(workflowState?.currentStage)}`,
                `- 交付判断：${releaseBlockers.length > 0 ? "未就绪" : "可推进"}`,
                snapshot.deliveryGate.length > 0
                  ? `## 门禁状态\n${snapshot.deliveryGate
                      .map((gate) => `- ${gate.name}：${formatDeliveryGateStatusLabel(gate.status)}`)
                      .join("\n")}`
                  : null,
                outputProfile.releaseLines.length > 0
                  ? `## 交付清单\n${outputProfile.releaseLines.join("\n")}`
                  : null,
                readyArtifacts.length > 0
                  ? `## 已就绪项\n${readyArtifacts
                      .map(
                        (artifact) =>
                          `- [${getProjectOverviewArtifactStageLabel(artifact.type)}] ${artifact.title}`
                      )
                      .join("\n")}`
                  : null,
                releaseBlockers.length > 0
                  ? `## 遗留项\n${releaseBlockers.map((item) => `- ${item}`).join("\n")}`
                  : null,
                openProjectTasks.length > 0
                  ? `## 遗留项\n${openProjectTasks
                      .map((task) => `- [${task.priority}] ${task.title}（${getTaskStatusLabel(task.status)}）`)
                      .join("\n")}`
                  : null,
                `## 发布结论\n- ${nextAction}`
              ],
              workflowState?.lastTransitionAt ?? "刚刚"
            )
          ),
          releaseBrief
            ? createSeededDocumentTab(
                `${node}-release-brief`,
                releaseBrief.title,
                createSeededDocument(
                  releaseBrief.title,
                  [
                    `# ${releaseBrief.title}`,
                    `## 发布条件\n- ${getProjectOverviewArtifactStatusLabel(releaseBrief.status)}`,
                    `- 负责人：${getAgentLabelById(snapshot, releaseBrief.ownerAgentId)}`,
                    `- 更新时间：${formatTimestamp(releaseBrief.updatedAt)}`,
                    releaseDecision ? `## 发布结论\n- ${releaseDecision.title} 已就绪` : null,
                    "## 交付提示",
                    "- 结果已准备完成，可直接点击一键部署完成现场闭环"
                  ],
                  releaseBrief.updatedAt
                )
              )
            : null,
          releaseDecision
            ? createSeededDocumentTab(
                `${node}-review-decision`,
                releaseDecision.title,
                createSeededDocument(
                  releaseDecision.title,
                  [
                    `# ${releaseDecision.title}`,
                    "## 发布结论",
                    "- 放行评审已经完成，可直接进入部署演示"
                  ],
                  releaseDecision.updatedAt
                )
              )
            : null
        ].filter((item): item is SeededDocumentTab => Boolean(item));
      }
    }

    return {
      node,
      status,
      summary,
      nextAction,
      agentName: agent.name,
      agentRole: agent.role,
      conversation,
      documents
    };
  });
}

function createConversationTabs(item: NodeWorkbench): ConversationTab[] {
  return [
    {
      id: `${item.node}-conversation-main`,
      label: "主会话",
      messages: item.conversation.map((message) => ({ ...message }))
    },
    {
      id: `${item.node}-conversation-followup`,
      label: "追问",
      messages: []
    }
  ];
}

function createDocumentTabs(item: NodeWorkbench): DocumentTab[] {
  if (item.documents.length === 0) {
    return [
      {
        id: `${item.node}-document-1`,
        label: "结果 1",
        document: null
      }
    ];
  }

  return item.documents.map((itemDocument, index) => ({
    id: itemDocument.id || `${item.node}-document-${index + 1}`,
    label: itemDocument.label,
    document: itemDocument.document
      ? {
          ...itemDocument.document
        }
      : null
  }));
}

function isLegacyGenericDocumentTabLabel(label: string) {
  return /^结果 \d+$/i.test(label.trim());
}

function shouldRefreshPersistedGeneratedDocument(
  node: WorkNode,
  persistedTab: DocumentTab,
  defaultTab: DocumentTab
) {
  const persistedBody = persistedTab.document?.body ?? "";
  const defaultBody = defaultTab.document?.body ?? "";

  if (!persistedBody || !defaultBody || persistedBody === defaultBody) {
    return false;
  }

  switch (node) {
    case "需求确认":
      return (
        (/## 核心能力范围/.test(persistedBody) && /## 用户故事/.test(defaultBody)) ||
        (!persistedBody.includes("## 验收标准") && defaultBody.includes("## 验收标准"))
      );
    case "项目原型":
      return (
        /项目原型总览/.test(persistedBody) ||
        (!persistedBody.includes("## 模块划分") && defaultBody.includes("## 模块划分")) ||
        (!persistedBody.includes("## 接口边界") && defaultBody.includes("## 接口边界"))
      );
    case "UI设计":
      return (
        /知识问答、订单查询和支付失败处理/.test(persistedBody) ||
        (!persistedBody.includes("案件工作台") && defaultBody.includes("案件工作台")) ||
        (!persistedBody.includes("## 页面清单") && defaultBody.includes("## 页面清单"))
      );
    case "后端研发":
      return (
        (/## 执行器/.test(persistedBody) || /## Runtime 证据/.test(persistedBody)) &&
        /## 实现范围/.test(defaultBody)
      );
    case "DEMO测试":
      return (
        (/## 失败证据/.test(persistedBody) && /## 测试结论/.test(defaultBody)) ||
        (!persistedBody.includes("## 测试范围") && defaultBody.includes("## 测试范围")) ||
        (!persistedBody.includes("案件录入") && defaultBody.includes("案件录入"))
      );
    case "交付发布":
      return (
        (!persistedBody.includes("## 交付清单") && defaultBody.includes("## 交付清单")) ||
        (!persistedBody.includes("## 发布条件") && defaultBody.includes("## 发布条件"))
      );
    default:
      return false;
  }
}

function shouldReplacePersistedDocumentSet(
  node: WorkNode,
  persistedTabs: DocumentTab[],
  defaultTabs: DocumentTab[]
) {
  const persistedBody = persistedTabs.map((tab) => tab.document?.body ?? "").join("\n\n");
  const defaultBody = defaultTabs.map((tab) => tab.document?.body ?? "").join("\n\n");
  const hasDefaultTabOverlap = persistedTabs.some((tab) =>
    isLegacyGenericDocumentTabLabel(tab.label) ||
    defaultTabs.some(
      (defaultTab) =>
        defaultTab.id === tab.id ||
        defaultTab.label === tab.label ||
        defaultTab.document?.title === tab.document?.title
    )
  );
  const hasCustomPersistedTabs = persistedTabs.some(
    (tab) =>
      !isLegacyGenericDocumentTabLabel(tab.label) &&
      !defaultTabs.some(
        (defaultTab) =>
          defaultTab.id === tab.id ||
          defaultTab.label === tab.label ||
          defaultTab.document?.title === tab.document?.title
      )
  );

  if (
    !persistedBody ||
    !defaultBody ||
    persistedBody === defaultBody ||
    !hasDefaultTabOverlap ||
    hasCustomPersistedTabs
  ) {
    return false;
  }

  switch (node) {
    case "需求确认":
      return (
        (!persistedBody.includes("## 用户故事") && defaultBody.includes("## 用户故事")) ||
        (!persistedBody.includes("## 验收标准") && defaultBody.includes("## 验收标准"))
      );
    case "项目原型":
      return (
        (!persistedBody.includes("## 模块划分") && defaultBody.includes("## 模块划分")) ||
        (!persistedBody.includes("## 接口边界") && defaultBody.includes("## 接口边界")) ||
        (/## 交付状态/.test(persistedBody) && defaultBody.includes("案件中心"))
      );
    case "UI设计":
      return (
        /知识问答、订单查询和支付失败处理/.test(persistedBody) ||
        persistedBody.includes("## UI设计工作台对话") ||
        (!persistedBody.includes("案件工作台") && defaultBody.includes("案件工作台")) ||
        (!persistedBody.includes("## 页面清单") && defaultBody.includes("## 页面清单"))
      );
    case "后端研发":
      return (
        (/## 执行器/.test(persistedBody) || /## Runtime 证据/.test(persistedBody)) &&
        /## 实现范围/.test(defaultBody)
      );
    case "DEMO测试":
      return (
        persistedBody.includes("## DEMO测试工作台对话") ||
        (!persistedBody.includes("## 测试范围") && defaultBody.includes("## 测试范围")) ||
        (/## 回归执行/.test(persistedBody) && /## 测试结论/.test(defaultBody))
      );
    case "交付发布":
      return (
        (!persistedBody.includes("## 交付清单") && defaultBody.includes("## 交付清单")) ||
        (!persistedBody.includes("## 发布条件") && defaultBody.includes("## 发布条件"))
      );
    default:
      return false;
  }
}

function normalizePersistedDocumentTabs(
  node: WorkNode,
  persistedTabs: ForgeProjectWorkbenchNodeState["documentTabs"] | undefined,
  defaultTabs: DocumentTab[]
) {
  if (!persistedTabs || persistedTabs.length === 0) {
    return defaultTabs;
  }

  const normalizedTabs = persistedTabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    document: tab.document
      ? {
          title: tab.document.title,
          body: tab.document.body,
          updatedAt: tab.document.updatedAt ?? null
        }
      : null
  }));

  if (defaultTabs.length === 0) {
    return normalizedTabs;
  }

  if (shouldReplacePersistedDocumentSet(node, normalizedTabs, defaultTabs)) {
    return defaultTabs.map((tab) => ({
      id: tab.id,
      label: tab.label,
      document: tab.document
        ? {
            ...tab.document
          }
        : null
    }));
  }

  const legacyPrimaryTab =
    normalizedTabs.length === 1 && isLegacyGenericDocumentTabLabel(normalizedTabs[0]?.label ?? "");

  if (!legacyPrimaryTab) {
    return normalizedTabs.map((tab) => {
      const matchedDefaultTab =
        defaultTabs.find((item) => item.label === tab.label || item.id === tab.id) ??
        defaultTabs.find((item) => item.document?.title === tab.document?.title);

      if (
        !matchedDefaultTab ||
        !shouldRefreshPersistedGeneratedDocument(node, tab, matchedDefaultTab)
      ) {
        return tab;
      }

      return {
        ...tab,
        label: matchedDefaultTab.label,
        document: matchedDefaultTab.document
          ? {
              ...matchedDefaultTab.document
            }
          : null
      };
    });
  }

  if (defaultTabs.length === 1) {
    const defaultTab = defaultTabs[0];
    const legacyTab = normalizedTabs[0];

    return [
      {
        ...legacyTab,
        label: defaultTab.label,
        document: legacyTab.document ?? defaultTab.document
      }
    ];
  }

  return defaultTabs;
}

function createNodePanelState(nodeWorkbench: NodeWorkbench[]): NodePanelStateMap {
  return workNodes.reduce<NodePanelStateMap>((accumulator, node) => {
    const workbench =
      nodeWorkbench.find((item) => item.node === node) ??
      ({
        node,
        status: "待开始",
        summary: "等待进入该节点",
        nextAction: "等待上游节点完成后继续推进",
        agentName: "AI",
        agentRole: "",
        conversation: [],
        documents: []
      } satisfies NodeWorkbench);

    const conversationTabs = createConversationTabs(workbench);
    const documentTabs = createDocumentTabs(workbench);

    accumulator[node] = {
      conversationTabs,
      activeConversationTabId: conversationTabs[0]?.id ?? "",
      documentTabs,
      activeDocumentTabId: documentTabs[0]?.id ?? ""
    };

    return accumulator;
  }, {} as NodePanelStateMap);
}

function createProjectWorkspace(
  defaultNodePanels: NodePanelStateMap,
  persistedWorkspace?: ForgeProjectWorkbenchProjectState,
  fallbackNode?: WorkNode
): ProjectWorkspace {
  const nodePanels = workNodes.reduce<NodePanelStateMap>((accumulator, node) => {
    const defaultPanel = defaultNodePanels[node];
    const persistedPanel = persistedWorkspace?.nodePanels?.[node];
    const conversationTabs =
      persistedPanel?.conversationTabs && persistedPanel.conversationTabs.length > 0
        ? persistedPanel.conversationTabs.map((tab) => ({
            id: tab.id,
            label: tab.label,
            messages: tab.messages.map((message) => ({
              id: message.id,
              speaker: message.speaker,
              role: message.role,
              text: message.text,
              time: message.time,
              tokenUsage: message.tokenUsage ?? null
            }))
          }))
        : defaultPanel.conversationTabs;
    const documentTabs = normalizePersistedDocumentTabs(
      node,
      persistedPanel?.documentTabs,
      defaultPanel.documentTabs
    );

    const normalizedConversationTabs = normalizeConversationTabsWithinBudget(conversationTabs);

    accumulator[node] = {
      conversationTabs: normalizedConversationTabs,
      activeConversationTabId:
        normalizedConversationTabs.find((tab) => tab.id === persistedPanel?.activeConversationTabId)?.id ??
        normalizedConversationTabs[0]?.id ??
        "",
      documentTabs,
      activeDocumentTabId:
        documentTabs.find((tab) => tab.id === persistedPanel?.activeDocumentTabId)?.id ??
        documentTabs[0]?.id ??
        ""
    };

    return accumulator;
  }, {} as NodePanelStateMap);

  const drafts = workNodes.reduce<ProjectWorkspace["drafts"]>((accumulator, node) => {
    const draft = persistedWorkspace?.drafts?.[node];
    if (typeof draft === "string") {
      accumulator[node] = draft;
    }
    return accumulator;
  }, {});

  return {
    selectedNode:
      (persistedWorkspace?.selectedNode as WorkNode | undefined) ??
      fallbackNode ??
      workNodes[0],
    workspaceView: createWorkspaceViewState(persistedWorkspace?.workspaceView),
    drafts,
    nodePanels,
    pendingReplies: {}
  };
}

function serializeProjectWorkspaceState(
  state: Record<string, ProjectWorkspace>
): ForgeProjectWorkbenchState {
  return Object.fromEntries(
    Object.entries(state).map(([projectId, workspace]) => [
      projectId,
      {
        selectedNode: workspace.selectedNode,
        workspaceView: serializeWorkspaceViewState(workspace.workspaceView),
        drafts: workspace.drafts,
        nodePanels: Object.fromEntries(
          Object.entries(workspace.nodePanels).map(([node, panel]) => [
            node,
            {
              conversationTabs: panel.conversationTabs,
              activeConversationTabId: panel.activeConversationTabId,
              documentTabs: panel.documentTabs,
              activeDocumentTabId: panel.activeDocumentTabId
            } satisfies ForgeProjectWorkbenchNodeState
          ])
        )
      } satisfies ForgeProjectWorkbenchProjectState
    ])
  );
}

function getProjectWorkbenchStateSignature(state?: ForgeProjectWorkbenchState | null) {
  return JSON.stringify(state ?? {});
}

function enforceProjectWorkspaceTokenBudget(workspace: ProjectWorkspace): ProjectWorkspace {
  let hasChanges = false;

  const nextNodePanels = workNodes.reduce<NodePanelStateMap>((accumulator, node) => {
    const panel = workspace.nodePanels[node];
    const normalizedConversationTabs = normalizeConversationTabsWithinBudget(panel.conversationTabs);

    if (normalizedConversationTabs !== panel.conversationTabs) {
      hasChanges = true;
      accumulator[node] = {
        ...panel,
        conversationTabs: normalizedConversationTabs,
        activeConversationTabId:
          normalizedConversationTabs.find((tab) => tab.id === panel.activeConversationTabId)?.id ??
          normalizedConversationTabs[0]?.id ??
          ""
      };
      return accumulator;
    }

    accumulator[node] = panel;
    return accumulator;
  }, {} as NodePanelStateMap);

  if (!hasChanges) {
    return workspace;
  }

  return {
    ...workspace,
    nodePanels: nextNodePanels
  };
}

function hasPendingProjectReplies(state: Record<string, ProjectWorkspace>) {
  return Object.values(state).some((workspace) => Object.keys(workspace.pendingReplies).length > 0);
}

function getPreferredProjectNode(input: {
  projectId?: string | null;
  workflowStage?: ForgeWorkflowStage | null;
  localWorkspaceState: Record<string, ProjectWorkspace>;
  persistedWorkspaceState?: ForgeProjectWorkbenchState;
  visibleNodes?: WorkNode[];
}) {
  const visibleNodes = input.visibleNodes ?? workNodes;
  const projectId = input.projectId?.trim();
  if (!projectId) {
    return clampWorkNodeToVisible(getNodeFromStage(input.workflowStage), visibleNodes);
  }

  const localSelectedNode = input.localWorkspaceState[projectId]?.selectedNode;
  if (localSelectedNode) {
    return clampWorkNodeToVisible(localSelectedNode, visibleNodes);
  }

  const persistedSelectedNode = input.persistedWorkspaceState?.[projectId]?.selectedNode;
  if (persistedSelectedNode && isWorkNode(persistedSelectedNode)) {
    return clampWorkNodeToVisible(persistedSelectedNode, visibleNodes);
  }

  return clampWorkNodeToVisible(getNodeFromStage(input.workflowStage), visibleNodes);
}

export default function ForgeProjectsPage({
  data,
  snapshot: legacySnapshot,
  createWorkbenchProject,
  saveProjectWorkbenchState,
  generateWorkbenchPrd,
  activateWorkbenchProject,
  executeWorkbenchCommand,
  sendWorkbenchChatMessage,
  initialProjectId,
  initialNode: initialNodeParam,
  showNavigation = false
}: ForgeProjectsPageProps) {
  const snapshot = data ?? legacySnapshot;

  if (!snapshot) {
    throw new Error("ForgeProjectsPage requires page data.");
  }

  const dataModeBadgeClassName =
    snapshot.dataMode === "local" ? styles.dataModeBadgeLocal : styles.dataModeBadgeDemo;

  const actionFeedbackTimerRef = useRef<number | null>(null);
  const workbenchSaveTimerRef = useRef<number | null>(null);
  const hasMountedWorkbenchPersistenceRef = useRef(false);
  const lastPersistedProjectWorkspaceStateRef = useRef(
    getProjectWorkbenchStateSignature(snapshot.projectWorkbenchState)
  );
  const resolvedInitialProjectId = getValidInitialProjectId(snapshot, initialProjectId);
  const defaultProject =
    snapshot.projects.find((project) => project.id === resolvedInitialProjectId) ??
    getActiveProject(snapshot) ??
    snapshot.projects[0] ??
    null;
  const defaultWorkflow = getWorkflowState(snapshot, defaultProject?.id);
  const defaultVisibleWorkNodes = getVisibleWorkNodesForProject(snapshot, defaultProject?.id);
  const resolvedInitialNode = isWorkNode(initialNodeParam)
    ? clampWorkNodeToVisible(initialNodeParam, defaultVisibleWorkNodes)
    : getPreferredProjectNode({
        projectId: defaultProject?.id,
        workflowStage: defaultWorkflow?.currentStage,
        localWorkspaceState: {},
        persistedWorkspaceState: snapshot.projectWorkbenchState,
        visibleNodes: defaultVisibleWorkNodes
      });
  const availableModelOptions =
    snapshot.availableModelOptions && snapshot.availableModelOptions.length > 0
      ? snapshot.availableModelOptions
      : fallbackWorkbenchModelOptions;
  const [selectedProjectId, setSelectedProjectId] = useState(resolvedInitialProjectId);
  const [selectedNode, setSelectedNode] = useState<WorkNode>(resolvedInitialNode);
  const [isProjectOverviewActive, setIsProjectOverviewActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isPrdGenerationOpen, setIsPrdGenerationOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    availableModelOptions[0] ?? FORGE_LOCAL_FALLBACK_MODEL_OPTION
  );
  const [thinkingBudget, setThinkingBudget] = useState("自动");
  const [editingTab, setEditingTab] = useState<EditingTabState>(null);
  const [editingDocument, setEditingDocument] = useState<EditingDocumentState>(null);
  const [workspaceDocumentState, setWorkspaceDocumentState] = useState<WorkspaceDocumentState>({
    file: null,
    status: "idle",
    error: "",
    editingValue: null
  });
  const [workspaceTreeReloadToken, setWorkspaceTreeReloadToken] = useState(0);
  const [workspaceCreateDialog, setWorkspaceCreateDialog] = useState<WorkspaceCreateDialogState>(null);
  const [pendingWorkspaceDelete, setPendingWorkspaceDelete] = useState<PendingWorkspaceDeleteState>(null);
  const [pendingTabDelete, setPendingTabDelete] = useState<PendingTabDeleteState>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isGeneratingPrd, setIsGeneratingPrd] = useState(false);
  const [isUsageTooltipOpen, setIsUsageTooltipOpen] = useState(false);
  const [isContextPreviewDialogOpen, setIsContextPreviewDialogOpen] = useState(false);
  const pendingProjectSelectionRef = useRef<{
    projectId: string;
    node?: WorkNode;
  } | null>(null);
  const [createProjectDraft, setCreateProjectDraft] = useState<CreateProjectDraft>({
    requirement: "",
    name: "",
    templateId: snapshot.projectTemplates[0]?.id ?? "",
    sector: "",
    owner: ""
  });
  const [prdExtraNotes, setPrdExtraNotes] = useState("");
  const [projectWorkspaceState, setProjectWorkspaceState] = useState<Record<string, ProjectWorkspace>>(
    {}
  );
  const [projectOverviewState, setProjectOverviewState] = useState<Record<string, ProjectOverviewState>>(
    {}
  );
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    tone: "success" | "info" | "warn";
  } | null>(null);

  const showActionFeedback = (
    message: string,
    tone: "success" | "info" | "warn" = "success"
  ) => {
    if (actionFeedbackTimerRef.current !== null) {
      window.clearTimeout(actionFeedbackTimerRef.current);
    }
    setActionFeedback({ message, tone });
    actionFeedbackTimerRef.current = window.setTimeout(() => {
      setActionFeedback((current) => (current?.message === message ? null : current));
      actionFeedbackTimerRef.current = null;
    }, 2200);
  };

  const allProjectRows = useMemo(
    () =>
      snapshot.projects
        .map((project) => {
          const workflow = getWorkflowState(snapshot, project.id);
          const health = getProjectHealth(project, workflow?.blockers ?? []);

          return {
            project,
            workflow: workflow ?? null,
            health,
            updatedAt: workflow?.lastTransitionAt ?? project.lastRun,
            milestone: getNextMilestone(workflow?.currentStage)
          };
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [snapshot]
  );

  const filteredProjectRows = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return allProjectRows;
    }

    return allProjectRows.filter((item) =>
      [
        item.project.name,
        item.project.sector,
        item.project.owner,
        item.workflow?.currentStage ?? "",
        item.health,
        item.milestone
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [allProjectRows, searchQuery]);

  useEffect(() => {
    if (filteredProjectRows.length === 0) {
      return;
    }

    if (
      pendingProjectSelectionRef.current &&
      pendingProjectSelectionRef.current.projectId === selectedProjectId
    ) {
      return;
    }

    const stillVisible = filteredProjectRows.some((item) => item.project.id === selectedProjectId);
    if (stillVisible) {
      return;
    }

    const nextProject = filteredProjectRows[0];
    const nextNode = clampWorkNodeToVisible(
      getNodeFromStage(nextProject.workflow?.currentStage),
      getVisibleWorkNodesForProject(snapshot, nextProject.project.id)
    );
    setSelectedProjectId(nextProject.project.id);
    setSelectedNode(nextNode);
  }, [filteredProjectRows, selectedProjectId, snapshot]);

  useEffect(() => {
    if (!pendingProjectSelectionRef.current) {
      return;
    }

    const pendingProjectId = pendingProjectSelectionRef.current.projectId;
    const nextProjectRow =
      allProjectRows.find((item) => item.project.id === pendingProjectId) ?? null;

    if (!nextProjectRow) {
      return;
    }

    const preferredNode = pendingProjectSelectionRef.current.node;
    pendingProjectSelectionRef.current = null;
    setSelectedProjectId(pendingProjectId);
    setSelectedNode(
      clampWorkNodeToVisible(
        preferredNode ?? getNodeFromStage(nextProjectRow.workflow?.currentStage),
        getVisibleWorkNodesForProject(snapshot, pendingProjectId)
      )
    );
  }, [allProjectRows, snapshot]);

  useEffect(() => {
    if (!initialProjectId && !initialNodeParam) {
      return;
    }

    const nextProjectId = getValidInitialProjectId(snapshot, initialProjectId);
    const nextWorkflow = getWorkflowState(snapshot, nextProjectId);
    const nextVisibleWorkNodes = getVisibleWorkNodesForProject(snapshot, nextProjectId);

    setSelectedProjectId(nextProjectId);
    setSelectedNode(
      isWorkNode(initialNodeParam)
        ? clampWorkNodeToVisible(initialNodeParam, nextVisibleWorkNodes)
        : getPreferredProjectNode({
            projectId: nextProjectId,
            workflowStage: nextWorkflow?.currentStage,
            localWorkspaceState: projectWorkspaceState,
            persistedWorkspaceState: snapshot.projectWorkbenchState,
            visibleNodes: nextVisibleWorkNodes
          })
    );
  }, [initialNodeParam, initialProjectId, projectWorkspaceState, snapshot]);

  useEffect(() => {
    setCreateProjectDraft((current) => ({
      ...current,
      templateId: current.templateId || snapshot.projectTemplates[0]?.id || ""
    }));
  }, [snapshot.projectTemplates]);

  useEffect(() => {
    if (availableModelOptions.includes(selectedModel)) {
      return;
    }

    setSelectedModel(availableModelOptions[0] ?? FORGE_LOCAL_FALLBACK_MODEL_OPTION);
  }, [availableModelOptions, selectedModel]);

  useEffect(() => {
    return () => {
      if (actionFeedbackTimerRef.current !== null) {
        window.clearTimeout(actionFeedbackTimerRef.current);
      }
      if (workbenchSaveTimerRef.current !== null) {
        window.clearTimeout(workbenchSaveTimerRef.current);
      }
    };
  }, []);

  const selectedProjectRow =
    filteredProjectRows.find((item) => item.project.id === selectedProjectId) ??
    allProjectRows.find((item) => item.project.id === selectedProjectId) ??
    filteredProjectRows[0] ??
    allProjectRows[0] ??
    null;

  const selectedProject = selectedProjectRow?.project ?? null;
  const selectedWorkflow = selectedProjectRow?.workflow ?? null;
  const selectedTemplate = getProjectTemplate(snapshot, selectedProject);
  const selectedProfile =
    snapshot.projectProfiles.find((item) => item.projectId === selectedProject?.id) ?? null;
  const selectedTeamTemplate =
    snapshot.teamTemplates.find((item) => item.id === selectedProfile?.teamTemplateId) ?? null;
  const selectedWorkspaceLabel =
    selectedProfile?.workspacePath.split(/[\\/]/).filter(Boolean).pop() ??
    selectedProject?.name ??
    "默认工作区";
  const selectedProjectDebugUrl = getProjectDebugUrl(selectedProfile);
  const defaultPromptTemplateId =
    selectedProfile?.defaultPromptIds[0] ?? selectedTemplate?.defaultPromptIds[0] ?? "";
  const visibleWorkNodes = useMemo(
    () => getVisibleWorkNodesForProject(snapshot, selectedProject?.id),
    [selectedProject?.id, snapshot]
  );

  const nodeWorkbench = useMemo<NodeWorkbench[]>(() => {
    return buildSeededNodeWorkbench(snapshot, selectedProject, selectedWorkflow);
  }, [selectedProject, selectedWorkflow, snapshot]);
  const visibleNodeWorkbench = useMemo(
    () => nodeWorkbench.filter((item) => visibleWorkNodes.includes(item.node)),
    [nodeWorkbench, visibleWorkNodes]
  );
  const selectedProjectTasks = useMemo(
    () =>
      selectedProject?.id
        ? snapshot.tasks.filter((task) => task.projectId === selectedProject.id)
        : [],
    [selectedProject?.id, snapshot.tasks]
  );
  const selectedProjectArtifacts = useMemo(
    () =>
      selectedProject?.id
        ? snapshot.artifacts.filter((artifact) => artifact.projectId === selectedProject.id)
        : [],
    [selectedProject?.id, snapshot.artifacts]
  );
  const selectedPrdDocument =
    snapshot.prdDocuments.find((item) => item.projectId === selectedProject?.id) ?? null;

  const activeNodeWorkbench =
    visibleNodeWorkbench.find((item) => item.node === selectedNode) ?? visibleNodeWorkbench[0] ?? null;
  const activeNodeContextPreview =
    selectedProject?.id && activeNodeWorkbench
      ? snapshot.agentContextPreviewByProjectId?.[selectedProject.id]?.[activeNodeWorkbench.node] ?? null
      : null;

  useEffect(() => {
    setIsContextPreviewDialogOpen(false);
  }, [selectedProject?.id, activeNodeWorkbench?.node]);
  const currentProjectTask =
    selectedProjectTasks.find((task) => task.status === "in-progress") ??
    selectedProjectTasks.find((task) => task.status === "blocked") ??
    selectedProjectTasks.find((task) => task.status === "todo") ??
    null;
  const projectOverviewStatusLabel =
    selectedWorkflow?.state === "blocked"
      ? "需收口"
      : selectedProject?.status === "ready"
        ? "已就绪"
        : "推进中";
  const latestProjectDeliverable =
    selectedPrdDocument?.title ?? selectedProjectArtifacts[0]?.title ?? "等待首批交付物";
  const blockedProjectTasks = selectedProjectTasks.filter((task) => task.status === "blocked");
  const inProgressProjectTasks = selectedProjectTasks.filter((task) => task.status === "in-progress");
  const projectOwnerLabel = selectedProject?.owner || activeNodeWorkbench?.agentName || "待分配";
  const projectNextMilestone = getNextMilestone(selectedWorkflow?.currentStage);
  const selectedWorkflowStageLabel = formatWorkflowStageLabel(
    selectedWorkflow?.currentStage ?? "待确认阶段"
  );
  const projectDeliveryDateLabel = formatProjectOverviewDeliveryDate(selectedProject?.deliveryDate);
  const projectRiskSummary =
    selectedProject?.riskNote ||
    (blockedProjectTasks.length > 0
      ? `当前有 ${blockedProjectTasks.length} 个事项待收口，建议优先处理阻塞链路。`
      : "当前未发现明显阻塞项。");
  const projectDecisionSummary =
    blockedProjectTasks.length > 0
      ? "当前项目存在待收口事项，建议先处理风险与依赖，再推进下一里程碑。"
      : "当前项目节奏稳定，可继续按既定节点推进交付。";
  const currentProjectNextAction = activeNodeWorkbench?.nextAction ?? projectNextMilestone;
  const projectOverviewPlanItems = useMemo(() => {
    const seen = new Set<string>();

    return visibleNodeWorkbench.flatMap((item) =>
      item.documents.flatMap((documentTab) => {
        const planKey = documentTab.label.trim() || `${item.node}-${documentTab.id}`;

        if (seen.has(planKey)) {
          return [];
        }
        seen.add(planKey);

        return [
          {
            id: documentTab.id || planKey,
            label: documentTab.label,
            stage: item.node,
            status: item.status,
            updatedAt: documentTab.document?.updatedAt ?? null,
            summary: item.summary,
            document: documentTab.document
          } satisfies ProjectOverviewPlanItem
        ];
      })
    );
  }, [visibleNodeWorkbench]);
  const projectOverviewPlanCounts = {
    completed: projectOverviewPlanItems.filter((item) => item.status === "已完成").length,
    inProgress: projectOverviewPlanItems.filter((item) => item.status === "进行中").length,
    blocked: projectOverviewPlanItems.filter((item) => item.status === "已阻塞").length
  };
  const projectOverviewLogs = useMemo(() => {
    if (!selectedProject?.id) {
      return [] as ProjectOverviewLogEntry[];
    }

    const projectArtifactIds = new Set(selectedProjectArtifacts.map((artifact) => artifact.id));
    const logEntries: ProjectOverviewLogEntry[] = [];

    if (selectedWorkflow) {
      logEntries.push({
        id: `workflow-${selectedProject.id}`,
        time: selectedWorkflow.lastTransitionAt ?? selectedProject.lastRun,
        kind: selectedWorkflow.state === "blocked" ? "风险" : "里程碑",
        summary:
          selectedWorkflow.state === "blocked"
            ? `${selectedWorkflowStageLabel} 阶段存在待收口事项`
            : `项目已推进到 ${selectedWorkflowStageLabel}`,
        meta:
          selectedWorkflow.blockers[0] ??
          `更新人：${selectedWorkflow.updatedBy || PROJECT_MANAGER_AGENT_NAME}`,
        tone: selectedWorkflow.state === "blocked" ? "risk" : "info"
      });
    }

    blockedProjectTasks.forEach((task) => {
      logEntries.push({
        id: `task-${task.id}`,
        time: selectedWorkflow?.lastTransitionAt ?? selectedProject.lastRun,
        kind: "风险",
        summary: task.title,
        meta: task.summary,
        tone: "risk"
      });
    });

    selectedProjectArtifacts.forEach((artifact) => {
      logEntries.push({
        id: `artifact-${artifact.id}`,
        time: artifact.updatedAt ?? selectedProject.lastRun,
        kind: "产出",
        summary: `${artifact.title} · ${getProjectOverviewArtifactStatusLabel(artifact.status)}`,
        meta: getProjectOverviewArtifactStageLabel(artifact.type),
        tone: getProjectOverviewArtifactTone(artifact.status)
      });
    });

    (snapshot.artifactReviews ?? [])
      .filter((review) => projectArtifactIds.has(review.artifactId))
      .forEach((review) => {
        logEntries.push({
          id: `review-${review.id}`,
          time: review.reviewedAt,
          kind: "决策",
          summary: review.summary,
          meta: review.conditions[0] ?? "已形成评审结论",
          tone: review.decision === "changes-requested" ? "warn" : "good"
        });
      });

    (snapshot.commandExecutions ?? [])
      .filter((execution) => execution.projectId === selectedProject.id)
      .forEach((execution) => {
        logEntries.push({
          id: `command-${execution.id}`,
          time: execution.createdAt,
          kind: execution.status === "blocked" ? "风险" : "执行",
          summary: execution.summary,
          meta: execution.triggeredBy,
          tone: execution.status === "blocked" ? "risk" : "info"
        });
      });

    (snapshot.runEvents ?? [])
      .filter((event) => event.projectId === selectedProject.id)
      .forEach((event) => {
        logEntries.push({
          id: `run-event-${event.id}`,
          time: event.createdAt,
          kind: event.type === "failure" ? "风险" : "执行",
          summary: event.summary,
          meta: event.failureCategory ? `分类：${event.failureCategory}` : "执行事件",
          tone: event.type === "failure" ? "risk" : "info"
        });
      });

    return logEntries
      .sort((left, right) => getRelativeTimeSortValue(right.time) - getRelativeTimeSortValue(left.time))
      .slice(0, 5);
  }, [
    blockedProjectTasks,
    selectedProject?.id,
    selectedProject?.lastRun,
    selectedProjectArtifacts,
    selectedWorkflow,
    snapshot.artifactReviews,
    snapshot.commandExecutions,
    snapshot.runEvents
  ]);
  const defaultNodePanelState = useMemo(() => createNodePanelState(nodeWorkbench), [nodeWorkbench]);
  const persistedSelectedProjectWorkspace = selectedProject?.id
    ? snapshot.projectWorkbenchState?.[selectedProject.id]
    : undefined;

  useEffect(() => {
    if (!selectedProject?.id) {
      return;
    }

    setProjectWorkspaceState((current) => {
      if (current[selectedProject.id]) {
        return current;
      }

      return {
        ...current,
        [selectedProject.id]: createProjectWorkspace(
          createNodePanelState(nodeWorkbench),
          snapshot.projectWorkbenchState?.[selectedProject.id],
          clampWorkNodeToVisible(getNodeFromStage(selectedWorkflow?.currentStage), visibleWorkNodes)
        )
      };
    });
    setEditingTab(null);
  }, [
    nodeWorkbench,
    selectedProject?.id,
    selectedWorkflow?.currentStage,
    snapshot.projectWorkbenchState,
    visibleWorkNodes
  ]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return;
    }

    const preferredNode = getPreferredProjectNode({
      projectId: selectedProject.id,
      workflowStage: selectedWorkflow?.currentStage,
      localWorkspaceState: projectWorkspaceState,
      persistedWorkspaceState: snapshot.projectWorkbenchState,
      visibleNodes: visibleWorkNodes
    });

    setSelectedNode((current) => (current === preferredNode ? current : preferredNode));
  }, [
    projectWorkspaceState,
    selectedProject?.id,
    selectedWorkflow?.currentStage,
    snapshot.projectWorkbenchState,
    visibleWorkNodes
  ]);

  useEffect(() => {
    setWorkspaceDocumentState({
      file: null,
      status: "idle",
      error: "",
      editingValue: null
    });
  }, [selectedProject?.id]);

  useEffect(() => {
    lastPersistedProjectWorkspaceStateRef.current = getProjectWorkbenchStateSignature(
      snapshot.projectWorkbenchState
    );
  }, [snapshot.projectWorkbenchState]);

  useEffect(() => {
    if (!saveProjectWorkbenchState) {
      return;
    }

    if (!hasMountedWorkbenchPersistenceRef.current) {
      hasMountedWorkbenchPersistenceRef.current = true;
      return;
    }

    if (hasPendingProjectReplies(projectWorkspaceState)) {
      if (workbenchSaveTimerRef.current !== null) {
        window.clearTimeout(workbenchSaveTimerRef.current);
        workbenchSaveTimerRef.current = null;
      }
      return;
    }

    const nextState = serializeProjectWorkspaceState(projectWorkspaceState);
    const nextStateSignature = getProjectWorkbenchStateSignature(nextState);

    if (nextStateSignature === lastPersistedProjectWorkspaceStateRef.current) {
      return;
    }

    if (workbenchSaveTimerRef.current !== null) {
      window.clearTimeout(workbenchSaveTimerRef.current);
    }

    workbenchSaveTimerRef.current = window.setTimeout(() => {
      void saveProjectWorkbenchState(nextState)
        .then(() => {
          lastPersistedProjectWorkspaceStateRef.current = nextStateSignature;
        })
        .catch(() => {
          // Keep the workbench editable even when silent persistence fails.
        });
    }, 250);

    return () => {
      if (workbenchSaveTimerRef.current !== null) {
        window.clearTimeout(workbenchSaveTimerRef.current);
        workbenchSaveTimerRef.current = null;
      }
    };
  }, [projectWorkspaceState, saveProjectWorkbenchState]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return;
    }

    setProjectWorkspaceState((current) => {
      const baseWorkspace =
        current[selectedProject.id] ??
        createProjectWorkspace(
          createNodePanelState(nodeWorkbench),
          snapshot.projectWorkbenchState?.[selectedProject.id],
          clampWorkNodeToVisible(getNodeFromStage(selectedWorkflow?.currentStage), visibleWorkNodes)
        );

      if (baseWorkspace.selectedNode === selectedNode) {
        return current;
      }

      return {
        ...current,
        [selectedProject.id]: {
          ...baseWorkspace,
          selectedNode
        }
      };
    });
  }, [
    nodeWorkbench,
    selectedNode,
    selectedProject?.id,
    selectedWorkflow?.currentStage,
    snapshot.projectWorkbenchState,
    visibleWorkNodes
  ]);

  useEffect(() => {
    if (!selectedProject?.id) {
      return;
    }

    setProjectOverviewState((current) => {
      const existing = current[selectedProject.id];
      const nextActivePlanId =
        (existing?.activePlanId &&
        projectOverviewPlanItems.some((item) => item.id === existing.activePlanId)
          ? existing.activePlanId
          : projectOverviewPlanItems[0]?.id) ?? "";

      if (existing) {
        if (existing.activePlanId === nextActivePlanId) {
          return current;
        }

        return {
          ...current,
          [selectedProject.id]: {
            ...existing,
            activePlanId: nextActivePlanId
          }
        };
      }

      return {
        ...current,
        [selectedProject.id]: createProjectOverviewState({
          activePlanId: nextActivePlanId,
          projectName: selectedProject.name,
          progress: selectedProject.progress,
          currentStage: selectedWorkflowStageLabel,
          projectRiskSummary,
          projectNextMilestone,
          currentProjectNextAction,
          latestProjectDeliverable
        })
      };
    });
  }, [
    currentProjectNextAction,
    latestProjectDeliverable,
    projectNextMilestone,
    projectOverviewPlanItems,
    projectRiskSummary,
    selectedProject?.id,
    selectedProject?.name,
    selectedProject?.progress,
    selectedWorkflowStageLabel
  ]);

  const activeProjectWorkspace = selectedProject?.id
    ? projectWorkspaceState[selectedProject.id] ??
      createProjectWorkspace(
        defaultNodePanelState,
        persistedSelectedProjectWorkspace,
        clampWorkNodeToVisible(getNodeFromStage(selectedWorkflow?.currentStage), visibleWorkNodes)
      )
    : null;
  const activeProjectOverview =
    selectedProject?.id && selectedProject
      ? projectOverviewState[selectedProject.id] ??
        createProjectOverviewState({
          activePlanId: projectOverviewPlanItems[0]?.id ?? "",
          projectName: selectedProject.name,
          progress: selectedProject.progress,
          currentStage: selectedWorkflowStageLabel,
          projectRiskSummary,
          projectNextMilestone,
          currentProjectNextAction,
          latestProjectDeliverable
        })
      : null;
  const activeWorkspaceView = activeProjectWorkspace?.workspaceView ?? createWorkspaceViewState();
  const isWorkspaceDrawerOpen = activeWorkspaceView.isOpen;
  const activeNodePanelState =
    (activeNodeWorkbench && activeProjectWorkspace?.nodePanels[activeNodeWorkbench.node]) ||
    (activeNodeWorkbench && defaultNodePanelState[activeNodeWorkbench.node]) ||
    null;
  const activeProjectOverviewPlan =
    projectOverviewPlanItems.find((item) => item.id === activeProjectOverview?.activePlanId) ??
    projectOverviewPlanItems[0] ??
    null;
  const activeConversationMessages = isProjectOverviewActive
    ? activeProjectOverview?.messages ?? []
    : activeNodePanelState?.conversationTabs.find(
        (item) => item.id === activeNodePanelState.activeConversationTabId
      )?.messages ??
      activeNodePanelState?.conversationTabs[0]?.messages ??
      [];
  const activeConversationTab =
    activeNodePanelState?.conversationTabs.find(
      (item) => item.id === activeNodePanelState.activeConversationTabId
    ) ?? activeNodePanelState?.conversationTabs[0] ?? null;
  const activeConversationContextTokenCount = getConversationContextTokenCount(activeConversationMessages);
  const activeConversationContextUsageSummary = formatConversationContextUsageSummary(
    activeConversationContextTokenCount
  );
  const activeConversationContextUsagePercent = getConversationContextUsagePercent(
    activeConversationContextTokenCount
  );
  const activeConversationWasCompressed =
    activeConversationMessages.some(
      (message) =>
        message.speaker === WORKBENCH_CONTEXT_SUMMARY_SPEAKER &&
        message.text.includes("历史会话已自动压缩")
    );
  const activeConversationContextTooltipId = selectedProject?.id
    ? `conversation-context-usage-${selectedProject.id}-${isProjectOverviewActive ? "project-overview" : `${selectedNode}-${activeConversationTab?.id ?? "conversation"}`}`
    : "conversation-context-usage";
  const activeDocumentTab =
    activeNodePanelState?.documentTabs.find(
      (item) => item.id === activeNodePanelState.activeDocumentTabId
    ) ?? activeNodePanelState?.documentTabs[0] ?? null;
  const activeDocumentVisualPreview = useMemo(() => {
    if (
      !activeDocumentTab?.document ||
      selectedNode === "需求确认" ||
      selectedNode === "后端研发" ||
      selectedNode === "DEMO测试" ||
      selectedNode === "内测调优" ||
      selectedNode === "交付发布"
    ) {
      return null;
    }

    const projectCapabilities = extractRequirementCapabilities(selectedProject?.requirement);
    const outputProfile = getProjectOutputProfile(selectedProject, projectCapabilities);

    return buildDocumentVisualPreview(selectedNode, outputProfile);
  }, [activeDocumentTab?.document, selectedNode, selectedProject]);
  const activeWorkspaceFile = workspaceDocumentState.file;
  const isPreviewingWorkspaceFile = Boolean(activeWorkspaceFile);
  const isEditingWorkspaceFile = workspaceDocumentState.editingValue !== null;
  const isEditingActiveDocument =
    editingDocument?.node === selectedNode &&
    editingDocument?.tabId === activeDocumentTab?.id;
  const activeComposerDraft = isProjectOverviewActive
    ? activeProjectOverview?.draft ?? ""
    : (selectedProject?.id && activeProjectWorkspace?.drafts[selectedNode]) ?? "";
  const canTriggerReleaseApprove =
    selectedNode === "交付发布" &&
    !!executeWorkbenchCommand &&
    selectedWorkflow?.currentStage !== "归档复用";

  const handleOpenDebugPage = () => {
    if (!selectedProjectDebugUrl || typeof window === "undefined") {
      return;
    }

    window.open(selectedProjectDebugUrl, "_blank", "noopener,noreferrer");
  };

  const updateActiveProjectWorkspace = (updater: (workspace: ProjectWorkspace) => ProjectWorkspace) => {
    if (!selectedProject?.id) {
      return;
    }

    setProjectWorkspaceState((current) => {
      const baseWorkspace =
        current[selectedProject.id] ??
        createProjectWorkspace(
          createNodePanelState(nodeWorkbench),
          snapshot.projectWorkbenchState?.[selectedProject.id],
          getNodeFromStage(selectedWorkflow?.currentStage)
        );

      return {
        ...current,
        [selectedProject.id]: enforceProjectWorkspaceTokenBudget(updater(baseWorkspace))
      };
    });
  };

  const updateActiveWorkspaceView = (
    updater: (workspaceView: WorkspaceViewState) => WorkspaceViewState
  ) => {
    updateActiveProjectWorkspace((current) => ({
      ...current,
      workspaceView: updater(current.workspaceView)
    }));
  };

  const activePendingReply = isProjectOverviewActive
    ? activeProjectOverview?.pendingReplyId ?? null
    : activeProjectWorkspace?.pendingReplies[selectedNode] ?? null;

  const renderSharedConversationMessages = (
    messages: ConversationMessage[],
    options?: { scrollTestId?: string }
  ) => (
    <div
      className={styles.chatScrollRegion}
      data-testid={options?.scrollTestId}
    >
      <div className={styles.messageList}>
        {messages.length > 0 ? (
          messages.map((message) => (
            <article
              className={`${styles.messageBubble} ${
                message.role === "human" ? styles.messageHuman : styles.messageAi
              }`}
              key={message.id}
            >
              <p>{message.text}</p>
            </article>
          ))
        ) : (
          <div className={styles.emptyConversationState}>
            <p>当前会话还没有内容，直接开始输入即可。</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSharedConversationComposer = () => (
    <div className={styles.composer}>
      <div className={styles.composerShell}>
        <textarea
          aria-label="继续输入内容"
          className={styles.composerTextarea}
          onChange={(event) => handleComposerDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void handleSendMessage();
            }
          }}
          placeholder="继续输入内容"
          value={activeComposerDraft}
        />
        <div className={styles.composerToolbar}>
          <div className={styles.composerToolbarLeft}>
            <button
              aria-label="添加附件"
              className={styles.composerIconButton}
              type="button"
            >
              +
            </button>
            <label className={styles.composerSelectField}>
              <span className={shellStyles.srOnly}>选择模型</span>
              <select
                aria-label="选择模型"
                className={styles.composerSelect}
                onChange={(event) => setSelectedModel(event.target.value)}
                value={selectedModel}
              >
                {availableModelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.composerSelectField}>
              <span className={shellStyles.srOnly}>思考预算</span>
              <select
                aria-label="思考预算"
                className={styles.composerSelect}
                onChange={(event) => setThinkingBudget(event.target.value)}
                value={thinkingBudget}
              >
                <option value="自动">自动</option>
                <option value="低">低</option>
                <option value="中">中</option>
                <option value="高">高</option>
              </select>
            </label>
          </div>
          <div className={styles.composerToolbarRight}>
            <button
              aria-label="语音录入"
              className={styles.composerGhostButton}
              type="button"
            >
              ◉
            </button>
            {activeConversationContextUsageSummary ? (
              <div
                className={styles.composerUsageIndicator}
                onMouseEnter={() => setIsUsageTooltipOpen(true)}
                onMouseLeave={() => setIsUsageTooltipOpen(false)}
              >
                <button
                  aria-describedby={
                    isUsageTooltipOpen ? activeConversationContextTooltipId : undefined
                  }
                  aria-label="背景信息窗口占用"
                  className={styles.composerUsageButton}
                  onBlur={() => setIsUsageTooltipOpen(false)}
                  onFocus={() => setIsUsageTooltipOpen(true)}
                  style={
                    {
                      "--usage-progress-angle": `${Math.max(
                        activeConversationContextUsagePercent * 3.6,
                        activeConversationContextUsagePercent > 0 ? 8 : 0
                      )}deg`
                    } as React.CSSProperties
                  }
                  type="button"
                >
                  <span aria-hidden="true" className={styles.composerUsageRing}>
                    <span className={styles.composerUsageCore} />
                  </span>
                  <span className={shellStyles.srOnly}>
                    {activeConversationContextUsageSummary}
                  </span>
                </button>
                {isUsageTooltipOpen ? (
                  <div
                    className={styles.composerUsageTooltip}
                    id={activeConversationContextTooltipId}
                    role="tooltip"
                  >
                    <p className={styles.composerUsageTooltipTitle}>背景信息窗口</p>
                    <p className={styles.composerUsageTooltipPercent}>
                      {activeConversationContextUsagePercent}% 已用
                    </p>
                    <p className={styles.composerUsageTooltipSummary}>
                      {activeConversationContextUsageSummary}
                    </p>
                    <p className={styles.composerUsageTooltipHint}>
                      {activeConversationWasCompressed
                        ? "历史会话已自动压缩，已保留摘要与最近消息。"
                        : "当前会话会按 258k 上限持续管理上下文。"}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              className={styles.composerSendButton}
              disabled={!activeComposerDraft.trim() || Boolean(activePendingReply)}
              onClick={() => {
                void handleSendMessage();
              }}
              type="button"
            >
              {activePendingReply ? "发送中..." : "发送"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    setIsUsageTooltipOpen(false);
  }, [selectedProject?.id, selectedNode, activeConversationTab?.id]);

  useEffect(() => {
    if (!selectedProject?.id || !activeWorkspaceView.isOpen || !activeWorkspaceView.selectedFilePath) {
      return;
    }

    if (
      workspaceDocumentState.file?.path === activeWorkspaceView.selectedFilePath &&
      workspaceDocumentState.status === "ready"
    ) {
      return;
    }

    void handleSelectWorkspaceFile(activeWorkspaceView.selectedFilePath);
  }, [
    activeWorkspaceView.isOpen,
    activeWorkspaceView.selectedFilePath,
    selectedProject?.id
  ]);

  useEffect(() => {
    if (!editingDocument) {
      return;
    }

    if (editingDocument.node !== selectedNode || editingDocument.tabId !== activeDocumentTab?.id) {
      setEditingDocument(null);
    }
  }, [activeDocumentTab?.id, editingDocument, selectedNode]);

  const projectSectionItems =
    selectedProjectRow
      ? [
          {
            title: selectedProjectRow.project.name,
            meta: `${formatWorkflowStageLabel(selectedProjectRow.workflow?.currentStage)} · ${selectedProjectRow.project.owner} · ${selectedProjectRow.health}`,
            badge: "↻",
            tone: "neutral" as const,
            active: true,
            onSelect: () => setIsProjectPickerOpen(true)
          }
        ]
      : [
          {
            title: "还没有选中项目",
            meta: "请先打开项目选择器",
            badge: "空",
            tone: "neutral" as const
          }
        ];

  const nodeSectionItems =
    activeNodeWorkbench != null
      ? [
          {
            title: "项目总控",
            meta: PROJECT_MANAGER_AGENT_NAME,
            badge: "概览",
            tone: "neutral" as const,
            active: isProjectOverviewActive,
            onSelect: () => {
              setIsProjectOverviewActive(true);
            }
          },
          ...visibleNodeWorkbench.map((item) => ({
            title: item.node,
            meta: item.agentName,
            badge: item.status,
            tone: getNodeTone(item.status),
            active: !isProjectOverviewActive && item.node === activeNodeWorkbench.node,
            onSelect: () => {
              setIsProjectOverviewActive(false);
              setSelectedNode(item.node);
            }
          }))
        ]
      : [];

  const handleSelectProject = async (projectId: string) => {
    const nextProjectRow =
      allProjectRows.find((item) => item.project.id === projectId) ?? null;
    const nextVisibleWorkNodes = getVisibleWorkNodesForProject(snapshot, projectId);
    const nextNode = getPreferredProjectNode({
      projectId,
      workflowStage: nextProjectRow?.workflow?.currentStage,
      localWorkspaceState: projectWorkspaceState,
      persistedWorkspaceState: snapshot.projectWorkbenchState,
      visibleNodes: nextVisibleWorkNodes
    });

    if (activateWorkbenchProject && projectId !== selectedProject?.id) {
      try {
        await activateWorkbenchProject(projectId);
      } catch (error) {
        showActionFeedback(
          error instanceof Error ? error.message : "切换当前项目失败",
          "warn"
        );
        return;
      }
    }

    setSelectedProjectId(projectId);
    setSelectedNode(nextNode);
    setIsProjectOverviewActive(false);
    setSearchQuery("");
    setIsProjectPickerOpen(false);
    showActionFeedback("已切换当前项目", "info");

    if (activateWorkbenchProject && projectId !== selectedProject?.id) {
      dispatchForgePageContractRefresh([
        "home",
        "projects",
        "team",
        "artifacts",
        "assets",
        "execution",
        "governance"
      ]);
    }
  };

  const handleSelectConversationTab = (tabId: string) => {
    updateActiveProjectWorkspace((current) => ({
      ...current,
      nodePanels: {
        ...current.nodePanels,
        [selectedNode]: {
          ...current.nodePanels[selectedNode],
          activeConversationTabId: tabId
        }
      }
    }));
  };

  const handleStartRenamingTab = (
    kind: "conversation" | "document",
    tabId: string,
    label: string
  ) => {
    setEditingTab({
      kind,
      node: selectedNode,
      tabId,
      value: label
    });
  };

  const handleRenameInputChange = (value: string) => {
    setEditingTab((current) => (current ? { ...current, value } : current));
  };

  const handleCommitRename = () => {
    if (!editingTab) {
      return;
    }

    const nextLabel = editingTab.value.trim();
    if (!nextLabel) {
      setEditingTab(null);
      return;
    }

    updateActiveProjectWorkspace((current) => {
      const panel = current.nodePanels[editingTab.node];
      if (!panel) {
        return current;
      }

      if (editingTab.kind === "conversation") {
        return {
          ...current,
          nodePanels: {
            ...current.nodePanels,
            [editingTab.node]: {
              ...panel,
              conversationTabs: panel.conversationTabs.map((item) =>
                item.id === editingTab.tabId ? { ...item, label: nextLabel } : item
              )
            }
          }
        };
      }

      return {
        ...current,
        nodePanels: {
          ...current.nodePanels,
          [editingTab.node]: {
            ...panel,
            documentTabs: panel.documentTabs.map((item) =>
              item.id === editingTab.tabId ? { ...item, label: nextLabel } : item
            )
          }
        }
      };
    });
    setEditingTab(null);
  };

  const handleCancelRename = () => {
    setEditingTab(null);
  };

  const handleDeleteConversationTab = (tabId: string, node: WorkNode = selectedNode) => {
    updateActiveProjectWorkspace((current) => {
      const panel = current.nodePanels[node];
      if (!panel || panel.conversationTabs.length <= 1) {
        return current;
      }

      const currentIndex = panel.conversationTabs.findIndex((item) => item.id === tabId);
      const nextConversationTabs = panel.conversationTabs.filter((item) => item.id !== tabId);
      const fallbackTab =
        nextConversationTabs[Math.max(0, currentIndex - 1)] ?? nextConversationTabs[0];

      return {
        ...current,
        nodePanels: {
          ...current.nodePanels,
          [node]: {
            ...panel,
            conversationTabs: nextConversationTabs,
            activeConversationTabId:
              panel.activeConversationTabId === tabId
                ? fallbackTab?.id ?? ""
                : panel.activeConversationTabId
          }
        }
      };
    });
    showActionFeedback("已删除会话标签", "warn");
  };

  const handleAddConversationTab = () => {
    updateActiveProjectWorkspace((current) => {
      const panel = current.nodePanels[selectedNode];
      if (!panel) {
        return current;
      }

      const nextIndex = panel.conversationTabs.length + 1;
      const nextTab: ConversationTab = {
        id: `${selectedNode}-conversation-${Date.now()}`,
        label: `会话 ${nextIndex}`,
        messages: []
      };

      return {
        ...current,
        nodePanels: {
          ...current.nodePanels,
          [selectedNode]: {
            ...panel,
            conversationTabs: [...panel.conversationTabs, nextTab],
            activeConversationTabId: nextTab.id
          }
        }
      };
    });
    showActionFeedback("已新增会话标签", "success");
  };

  const handleConversationTabClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    tabId: string,
    label: string
  ) => {
    handleSelectConversationTab(tabId);

    if (event.detail > 1) {
      handleStartRenamingTab("conversation", tabId, label);
    }
  };

  const handleSelectDocumentTab = (tabId: string) => {
    updateActiveProjectWorkspace((current) => ({
      ...current,
      nodePanels: {
        ...current.nodePanels,
        [selectedNode]: {
          ...current.nodePanels[selectedNode],
          activeDocumentTabId: tabId
        }
      }
    }));
  };

  const handleAddDocumentTab = () => {
    updateActiveProjectWorkspace((current) => {
      const panel = current.nodePanels[selectedNode];
      if (!panel) {
        return current;
      }

      const nextIndex = panel.documentTabs.length + 1;
      const nextTab: DocumentTab = {
        id: `${selectedNode}-document-${Date.now()}`,
        label: `结果 ${nextIndex}`,
        document: null
      };

      return {
        ...current,
        nodePanels: {
          ...current.nodePanels,
          [selectedNode]: {
            ...panel,
            documentTabs: [...panel.documentTabs, nextTab],
            activeDocumentTabId: nextTab.id
          }
        }
      };
    });
    showActionFeedback("已新增文档标签", "success");
  };

  const handleDocumentTabClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    tabId: string,
    label: string
  ) => {
    handleSelectDocumentTab(tabId);

    if (event.detail > 1) {
      handleStartRenamingTab("document", tabId, label);
    }
  };

  const handleDeleteDocumentTab = (tabId: string, node: WorkNode = selectedNode) => {
    updateActiveProjectWorkspace((current) => {
      const panel = current.nodePanels[node];
      if (!panel || panel.documentTabs.length <= 1) {
        return current;
      }

      const currentIndex = panel.documentTabs.findIndex((item) => item.id === tabId);
      const nextDocumentTabs = panel.documentTabs.filter((item) => item.id !== tabId);
      const fallbackTab = nextDocumentTabs[Math.max(0, currentIndex - 1)] ?? nextDocumentTabs[0];

      return {
        ...current,
        nodePanels: {
          ...current.nodePanels,
          [node]: {
            ...panel,
            documentTabs: nextDocumentTabs,
            activeDocumentTabId:
              panel.activeDocumentTabId === tabId
                ? fallbackTab?.id ?? ""
                : panel.activeDocumentTabId
          }
        }
      };
    });
    showActionFeedback("已删除文档标签", "warn");
  };

  const handleStartDocumentEdit = () => {
    if (!activeDocumentTab?.document) {
      return;
    }

    setEditingDocument({
      node: selectedNode,
      tabId: activeDocumentTab.id,
      value: activeDocumentTab.document.body
    });
  };

  const handleDocumentEditChange = (value: string) => {
    setEditingDocument((current) => (current ? { ...current, value } : current));
  };

  const handleCancelDocumentEdit = () => {
    setEditingDocument(null);
  };

  const handleSaveDocumentEdit = () => {
    if (!editingDocument) {
      return;
    }

    updateActiveProjectWorkspace((current) => {
      const panel = current.nodePanels[editingDocument.node];
      if (!panel) {
        return current;
      }

      return {
        ...current,
        nodePanels: {
          ...current.nodePanels,
          [editingDocument.node]: {
            ...panel,
            documentTabs: panel.documentTabs.map((item) =>
              item.id === editingDocument.tabId && item.document
                ? {
                    ...item,
                    document: {
                      ...item.document,
                      body: editingDocument.value,
                      updatedAt: "刚刚"
                    }
                  }
                : item
            )
          }
        }
      };
    });

    setEditingDocument(null);
    showActionFeedback("已更新当前文档", "success");
  };

  const clearWorkspaceDocumentPreview = () => {
    setWorkspaceDocumentState({
      file: null,
      status: "idle",
      error: "",
      editingValue: null
    });
  };

  const handleSelectWorkspaceFile = async (path: string) => {
    if (!selectedProject) {
      return;
    }

    updateActiveWorkspaceView((current) => ({
      ...current,
      isOpen: true,
      selectedFilePath: path,
      expandedDirectories: {
        ...current.expandedDirectories,
        ...getWorkspaceAncestorDirectoryRecord(path)
      }
    }));

    setWorkspaceDocumentState((current) => ({
      ...current,
      file:
        current.file?.path === path
          ? current.file
          : current.file
            ? {
                ...current.file,
                path,
                name: path.split(/[\\/]/).pop() ?? path
              }
            : null,
      status: "loading",
      error: "",
      editingValue: null
    }));

    try {
      const result = await getForgeWorkspaceFile(selectedProject.id, path);
      setWorkspaceDocumentState({
        file: result.file,
        status: "ready",
        error: "",
        editingValue: null
      });
    } catch (error) {
      setWorkspaceDocumentState({
        file: null,
        status: "error",
        error: error instanceof Error ? error.message : "工作区文件读取失败",
        editingValue: null
      });
      showActionFeedback(error instanceof Error ? error.message : "工作区文件读取失败", "warn");
    }
  };

  const handleOpenWorkspaceDrawer = () => {
    updateActiveWorkspaceView((current) => ({
      ...current,
      isOpen: true
    }));
  };

  const handleStartWorkspaceFileEdit = () => {
    if (!activeWorkspaceFile?.editable) {
      return;
    }

    setWorkspaceDocumentState((current) =>
      current.file
        ? {
            ...current,
            editingValue: current.file.body
          }
        : current
    );
  };

  const handleCancelWorkspaceFileEdit = () => {
    setWorkspaceDocumentState((current) => ({
      ...current,
      editingValue: null
    }));
  };

  const handleWorkspaceFileEditChange = (value: string) => {
    setWorkspaceDocumentState((current) => ({
      ...current,
      editingValue: value
    }));
  };

  const handleSaveWorkspaceFileEdit = async () => {
    if (!selectedProject || !activeWorkspaceFile || workspaceDocumentState.editingValue === null) {
      return;
    }

    setWorkspaceDocumentState((current) => ({
      ...current,
      status: "saving",
      error: ""
    }));

    try {
      const result = await saveForgeWorkspaceFile({
        projectId: selectedProject.id,
        path: activeWorkspaceFile.path,
        body: workspaceDocumentState.editingValue
      });

      setWorkspaceDocumentState({
        file: result.file,
        status: "ready",
        error: "",
        editingValue: null
      });
      showActionFeedback("已保存工作区 Markdown", "success");
    } catch (error) {
      setWorkspaceDocumentState((current) => ({
        ...current,
        status: "error",
        error: error instanceof Error ? error.message : "工作区 Markdown 保存失败"
      }));
      showActionFeedback(error instanceof Error ? error.message : "工作区 Markdown 保存失败", "warn");
    }
  };

  const handleCloseWorkspaceDrawer = () => {
    updateActiveWorkspaceView((current) => ({
      ...current,
      isOpen: false
    }));
    clearWorkspaceDocumentPreview();
  };

  const handleOpenWorkspaceCreateDialog = (kind: "markdown" | "directory") => {
    setWorkspaceCreateDialog({
      kind,
      path: buildDefaultWorkspaceEntryPath(kind, activeWorkspaceView.selectedFilePath)
    });
  };

  const handleCreateWorkspaceDialogPathChange = (value: string) => {
    setWorkspaceCreateDialog((current) => (current ? { ...current, path: value } : current));
  };

  const handleCloseWorkspaceCreateDialog = () => {
    setWorkspaceCreateDialog(null);
  };

  const handleConfirmWorkspaceCreate = async () => {
    if (!selectedProject || !workspaceCreateDialog) {
      return;
    }

    const targetPath = workspaceCreateDialog.path.trim();

    if (!targetPath) {
      showActionFeedback("请先输入工作区路径", "warn");
      return;
    }

    try {
      if (workspaceCreateDialog.kind === "markdown") {
        const result = await createForgeWorkspaceMarkdown({
          projectId: selectedProject.id,
          path: targetPath
        });

        updateActiveWorkspaceView((current) => ({
          ...current,
          isOpen: true,
          selectedFilePath: result.file?.path ?? targetPath,
          expandedDirectories: {
            ...current.expandedDirectories,
            ...getWorkspaceAncestorDirectoryRecord(targetPath)
          }
        }));
        setWorkspaceDocumentState({
          file: result.file ?? null,
          status: "ready",
          error: "",
          editingValue: result.file?.body ?? ""
        });
        showActionFeedback("已新建工作区 Markdown", "success");
      } else {
        await createForgeWorkspaceDirectory({
          projectId: selectedProject.id,
          path: targetPath
        });

        updateActiveWorkspaceView((current) => ({
          ...current,
          isOpen: true,
          expandedDirectories: {
            ...current.expandedDirectories,
            ...getWorkspaceAncestorDirectoryRecord(targetPath),
            [targetPath]: true
          }
        }));
        showActionFeedback("已新建工作区文件夹", "success");
      }

      setWorkspaceTreeReloadToken((current) => current + 1);
      setWorkspaceCreateDialog(null);
    } catch (error) {
      showActionFeedback(error instanceof Error ? error.message : "新建工作区条目失败", "warn");
    }
  };

  const handleRequestWorkspaceDelete = (entry: PendingWorkspaceDeleteState) => {
    setPendingWorkspaceDelete(entry);
  };

  const handleCancelWorkspaceDelete = () => {
    setPendingWorkspaceDelete(null);
  };

  const handleConfirmWorkspaceDelete = async () => {
    if (!selectedProject || !pendingWorkspaceDelete) {
      return;
    }

    try {
      await deleteForgeWorkspaceEntry({
        projectId: selectedProject.id,
        path: pendingWorkspaceDelete.path
      });

      updateActiveWorkspaceView((current) => {
        const selectedFilePath = current.selectedFilePath;
        const nextSelectedFilePath =
          selectedFilePath &&
          (selectedFilePath === pendingWorkspaceDelete.path ||
            selectedFilePath.startsWith(`${pendingWorkspaceDelete.path}/`))
            ? null
            : selectedFilePath;

        return {
          ...current,
          selectedFilePath: nextSelectedFilePath,
          expandedDirectories: removeWorkspacePaths(current.expandedDirectories, pendingWorkspaceDelete.path)
        };
      });

      if (
        activeWorkspaceFile?.path === pendingWorkspaceDelete.path ||
        activeWorkspaceFile?.path.startsWith(`${pendingWorkspaceDelete.path}/`)
      ) {
        clearWorkspaceDocumentPreview();
      }

      setWorkspaceTreeReloadToken((current) => current + 1);
      setPendingWorkspaceDelete(null);
      showActionFeedback(
        pendingWorkspaceDelete.kind === "directory" ? "已删除工作区文件夹" : "已删除工作区文件",
        "success"
      );
    } catch (error) {
      showActionFeedback(error instanceof Error ? error.message : "删除工作区条目失败", "warn");
    }
  };

  const handleComposerDraftChange = (value: string) => {
    if (isProjectOverviewActive && selectedProject?.id) {
      setProjectOverviewState((current) => ({
        ...current,
        [selectedProject.id]: {
          ...(current[selectedProject.id] ??
            createProjectOverviewState({
              activePlanId: projectOverviewPlanItems[0]?.id ?? "",
              projectName: selectedProject.name,
              progress: selectedProject.progress,
              currentStage: selectedWorkflow?.currentStage ?? "待确认阶段",
              projectRiskSummary,
              projectNextMilestone,
              currentProjectNextAction,
              latestProjectDeliverable
            })),
          draft: value
        }
      }));
      return;
    }

    updateActiveProjectWorkspace((current) => ({
      ...current,
      drafts: {
        ...current.drafts,
        [selectedNode]: value
      }
    }));
  };

  const handleSelectProjectOverviewPlan = (planId: string) => {
    if (!selectedProject?.id) {
      return;
    }

    setProjectOverviewState((current) => ({
      ...current,
      [selectedProject.id]: {
        ...(current[selectedProject.id] ??
          createProjectOverviewState({
            activePlanId: planId,
            projectName: selectedProject.name,
            progress: selectedProject.progress,
            currentStage: selectedWorkflow?.currentStage ?? "待确认阶段",
            projectRiskSummary,
            projectNextMilestone,
            currentProjectNextAction,
            latestProjectDeliverable
          })),
        activePlanId: planId
      }
    }));
  };

  const handleSendProjectOverviewMessage = async () => {
    if (!selectedProject) {
      return;
    }

    const prompt = (activeProjectOverview?.draft ?? "").trim();
    if (!prompt || activeProjectOverview?.pendingReplyId) {
      return;
    }

    const requestId = `project-overview-${Date.now()}`;
    const assistantMessageId = `project-overview-pending-${Date.now() + 1}`;

    setProjectOverviewState((current) => {
      const baseState =
        current[selectedProject.id] ??
        createProjectOverviewState({
          activePlanId: projectOverviewPlanItems[0]?.id ?? "",
          projectName: selectedProject.name,
          progress: selectedProject.progress,
          currentStage: selectedWorkflow?.currentStage ?? "待确认阶段",
          projectRiskSummary,
          projectNextMilestone,
          currentProjectNextAction,
          latestProjectDeliverable
        });

      return {
        ...current,
        [selectedProject.id]: {
          ...baseState,
          draft: "",
          pendingReplyId: requestId,
          messages: [
            ...baseState.messages,
            {
              id: `project-overview-human-${Date.now()}`,
              speaker: "你",
              role: "human",
              text: prompt,
              time: "刚刚"
            },
            {
              id: assistantMessageId,
              speaker: PROJECT_MANAGER_AGENT_NAME,
              role: "ai",
              text: "正在整理项目全局状态...",
              time: "刚刚"
            }
          ]
        }
      };
    });

    const applyProjectOverviewReply = (reply: string, tokenUsage?: ForgeTokenUsage | null) => {
      setProjectOverviewState((current) => {
        const baseState = current[selectedProject.id];
        if (!baseState || baseState.pendingReplyId !== requestId) {
          return current;
        }

        return {
          ...current,
          [selectedProject.id]: {
            ...baseState,
            pendingReplyId: null,
            messages: baseState.messages.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    text: reply,
                    tokenUsage: tokenUsage ?? null
                  }
                : message
            )
          }
        };
      });
    };

    const fallbackReply = `${selectedProject.name} 当前整体进度 ${selectedProject.progress}%，阶段为${selectedWorkflowStageLabel}。当前风险：${projectRiskSummary} 下一步建议：${currentProjectNextAction}。重点文档可优先查看《${activeProjectOverviewPlan?.label ?? latestProjectDeliverable}》。`;
    const shouldUseRealtimeChat =
      Boolean(sendWorkbenchChatMessage) &&
      selectedModel.trim() !== FORGE_LOCAL_FALLBACK_MODEL_OPTION;

    if (shouldUseRealtimeChat && sendWorkbenchChatMessage) {
      try {
        const result = await sendWorkbenchChatMessage({
          projectId: selectedProject.id,
          prompt,
          selectedModel,
          thinkingBudget,
          triggeredBy: PROJECT_MANAGER_AGENT_NAME
        });
        const assistantReply =
          result.modelExecution.content?.trim() ||
          (result.modelExecution.status === "error"
            ? result.modelExecution.message
            : fallbackReply);
        applyProjectOverviewReply(assistantReply, result.modelExecution.tokenUsage ?? null);
        showActionFeedback("已收到项目经理视角回复", "success");
        return;
      } catch (error) {
        const assistantReply = error instanceof Error ? error.message : fallbackReply;
        applyProjectOverviewReply(assistantReply);
        showActionFeedback(error instanceof Error ? error.message : "项目经理对话失败", "warn");
        return;
      }
    }

    applyProjectOverviewReply(fallbackReply);
    showActionFeedback("已更新项目经理视角结论", "success");
  };

  const handleCreateProject = async () => {
    if (!createWorkbenchProject) {
      return;
    }

    const requirement = createProjectDraft.requirement.trim();
    const draft = requirement
      ? {
          requirement,
          ...(createProjectDraft.name.trim() ? { name: createProjectDraft.name.trim() } : {}),
          ...(createProjectDraft.templateId.trim()
            ? { templateId: createProjectDraft.templateId.trim() }
            : {}),
          ...(createProjectDraft.sector.trim() ? { sector: createProjectDraft.sector.trim() } : {}),
          ...(createProjectDraft.owner.trim() ? { owner: createProjectDraft.owner.trim() } : {})
        }
      : {
          name: createProjectDraft.name.trim(),
          templateId: createProjectDraft.templateId.trim(),
          sector: createProjectDraft.sector.trim(),
          owner: createProjectDraft.owner.trim()
        };

    if (
      !requirement &&
      (!("name" in draft) || !draft.name || !draft.templateId || !draft.sector || !draft.owner)
    ) {
      showActionFeedback("请先补全项目信息", "warn");
      return;
    }

    setIsCreatingProject(true);

    try {
      const result = await createWorkbenchProject(draft);
      pendingProjectSelectionRef.current = {
        projectId: result.activeProjectId,
        node: "需求确认"
      };
      setSelectedProjectId(result.activeProjectId);
      setSelectedNode("需求确认");
      setIsProjectOverviewActive(false);
      setSearchQuery("");
      setIsCreateProjectOpen(false);
      setCreateProjectDraft({
        requirement: "",
        name: "",
        templateId: snapshot.projectTemplates[0]?.id ?? "",
        sector: "",
        owner: ""
      });
      dispatchForgePageContractRefresh([
        "home",
        "projects",
        "team",
        "artifacts",
        "assets",
        "execution",
        "governance"
      ]);
      showActionFeedback("已创建并激活项目", "success");
    } catch (error) {
      showActionFeedback(error instanceof Error ? error.message : "创建项目失败", "warn");
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleGeneratePrd = async () => {
    if (!generateWorkbenchPrd || !selectedProject) {
      return;
    }

    if (!defaultPromptTemplateId) {
      showActionFeedback("当前项目还没有配置默认 PRD 模板", "warn");
      return;
    }

    setIsGeneratingPrd(true);

    try {
      const result = await generateWorkbenchPrd({
        projectId: selectedProject.id,
        templateId: defaultPromptTemplateId,
        extraNotes: prdExtraNotes.trim() || undefined
      });

      updateActiveProjectWorkspace((current) => {
        const targetNode: WorkNode = "需求确认";
        const panel = current.nodePanels[targetNode] ?? createNodePanelState(nodeWorkbench)[targetNode];
        const targetConversationTabId = panel.conversationTabs[0]?.id ?? panel.activeConversationTabId;
        const targetDocumentTabId = panel.documentTabs[0]?.id ?? panel.activeDocumentTabId;
        const summary = `已根据 ${result.template.title} 生成《${result.document.title}》。`;

        const nextConversationTabs = panel.conversationTabs.map((tab) =>
          tab.id === targetConversationTabId
            ? {
                ...tab,
                messages: [
                  ...tab.messages,
                  {
                    id: `${targetNode}-prd-ai-${Date.now()}`,
                    speaker: PROJECT_MANAGER_AGENT_NAME,
                    role: "ai" as const,
                    text: summary,
                    time: "刚刚"
                  }
                ]
              }
            : tab
        );

        const nextDocumentTabs = panel.documentTabs.map((tab) =>
          tab.id === targetDocumentTabId
            ? {
                ...tab,
                document: {
                  title: result.document.title,
                  updatedAt: "刚刚",
                  body: [
                    `# ${result.document.title}`,
                    "",
                    `已通过 ${result.template.title} 生成正式 PRD 草案。`,
                    prdExtraNotes.trim() ? `补充说明：${prdExtraNotes.trim()}` : null
                  ]
                    .filter(Boolean)
                    .join("\n")
                }
              }
            : tab
        );

        return {
          ...current,
          nodePanels: {
            ...current.nodePanels,
            [targetNode]: {
              ...panel,
              activeConversationTabId: targetConversationTabId,
              activeDocumentTabId: targetDocumentTabId,
              conversationTabs: nextConversationTabs,
              documentTabs: nextDocumentTabs
            }
          }
        };
      });

      setSelectedNode("需求确认");
      setIsPrdGenerationOpen(false);
      setPrdExtraNotes("");
      dispatchForgePageContractRefresh(["home", "projects", "artifacts"]);
      showActionFeedback("已生成 PRD 草案", "success");
    } catch (error) {
      showActionFeedback(error instanceof Error ? error.message : "生成 PRD 失败", "warn");
    } finally {
      setIsGeneratingPrd(false);
    }
  };

  const handleSendMessage = async () => {
    if (isProjectOverviewActive) {
      await handleSendProjectOverviewMessage();
      return;
    }

    const prompt = activeComposerDraft.trim();
    if (!prompt || !selectedProject || !activeConversationTab || !activeDocumentTab || activePendingReply) {
      return;
    }

    const commandId = getWorkbenchCommandId(selectedNode);
    const shouldUseRealtimeChat =
      Boolean(sendWorkbenchChatMessage) &&
      selectedModel.trim() !== FORGE_LOCAL_FALLBACK_MODEL_OPTION;
    const requestId = `${selectedNode}-${Date.now()}`;
    const assistantMessageId = `${selectedNode}-pending-${Date.now() + 1}`;
    const pendingReplyState: PendingReplyState = {
      requestId,
      conversationTabId: activeConversationTab.id,
      documentTabId: activeDocumentTab.id,
      assistantMessageId,
      baseDocument: activeDocumentTab.document
    };

    updateActiveProjectWorkspace((current) => {
      const panel = current.nodePanels[selectedNode];
      if (!panel) {
        return current;
      }

      const nextConversationTabs = panel.conversationTabs.map((tab) =>
        tab.id === pendingReplyState.conversationTabId
          ? {
              ...tab,
              messages: [
                ...tab.messages,
                {
                  id: `${selectedNode}-human-${Date.now()}`,
                  speaker: "你",
                  role: "human" as const,
                  text: prompt,
                  time: "刚刚"
                },
                {
                  id: pendingReplyState.assistantMessageId,
                  speaker: activeNodeWorkbench?.agentName ?? "AI",
                  role: "ai" as const,
                  text: "正在回复...",
                  time: "刚刚"
                }
              ]
            }
          : tab
      );

      return {
        ...current,
        drafts: {
          ...current.drafts,
          [selectedNode]: ""
        },
        nodePanels: {
          ...current.nodePanels,
          [selectedNode]: {
            ...panel,
            conversationTabs: nextConversationTabs,
            documentTabs: panel.documentTabs
          }
        },
        pendingReplies: {
          ...current.pendingReplies,
          [selectedNode]: pendingReplyState
        }
      };
    });

    const applyPendingReplyResolution = (input: {
      assistantReply: string;
      buildDocument?: (baseDocument: NodeDocument | null) => NodeDocument;
      tokenUsage?: ForgeTokenUsage | null;
    }) => {
      updateActiveProjectWorkspace((current) => {
        const panel = current.nodePanels[selectedNode];
        const pendingReply = current.pendingReplies[selectedNode];
        if (!panel || !pendingReply || pendingReply.requestId !== requestId) {
          return current;
        }

        const nextConversationTabs = panel.conversationTabs.map((tab) =>
          tab.id === pendingReply.conversationTabId
            ? {
                ...tab,
                messages: tab.messages.map((message) =>
                  message.id === pendingReply.assistantMessageId
                    ? {
                        ...message,
                        text: input.assistantReply,
                        tokenUsage: input.tokenUsage ?? null
                      }
                    : message
                )
              }
            : tab
        );

        const nextDocumentTabs = input.buildDocument
          ? panel.documentTabs.map((tab) =>
              tab.id === pendingReply.documentTabId
                ? {
                    ...tab,
                    document: input.buildDocument?.(pendingReply.baseDocument)
                  }
                : tab
            )
          : panel.documentTabs;

        const nextPendingReplies = { ...current.pendingReplies };
        delete nextPendingReplies[selectedNode];

        return {
          ...current,
          nodePanels: {
            ...current.nodePanels,
            [selectedNode]: {
              ...panel,
              conversationTabs: nextConversationTabs,
              documentTabs: nextDocumentTabs
            }
          },
          pendingReplies: nextPendingReplies
        };
      });
    };

    if (shouldUseRealtimeChat && sendWorkbenchChatMessage) {
      try {
        const result = await sendWorkbenchChatMessage({
          projectId: selectedProject.id,
          prompt,
          selectedModel,
          thinkingBudget,
          triggeredBy: activeNodeWorkbench?.agentName ?? "项目工作台",
          workbenchNode: selectedNode
        });
        const assistantReply =
          result.modelExecution.content?.trim() ||
          (result.modelExecution.status === "error"
            ? result.modelExecution.message
            : "当前模型没有返回可展示内容。");
        applyPendingReplyResolution({
          assistantReply,
          tokenUsage: result.modelExecution.tokenUsage ?? null
        });

        showActionFeedback("已收到真实模型回复", "success");
        return;
      } catch (error) {
        const assistantReply = error instanceof Error ? error.message : "工作台聊天失败";
        applyPendingReplyResolution({
          assistantReply
        });
        showActionFeedback(error instanceof Error ? error.message : "工作台聊天失败", "warn");
        return;
      }
    }

    if (executeWorkbenchCommand && commandId) {
      try {
        const result = await executeWorkbenchCommand({
          commandId,
          projectId: selectedProject.id,
          extraNotes: prompt,
          selectedModel,
          thinkingBudget,
          triggeredBy: activeNodeWorkbench?.agentName ?? "项目工作台"
        });
        const executionSummary =
          result.execution.summary || `已发起 ${selectedNode} 节点的真实命令执行。`;
        const assistantReply =
          result.modelExecution?.content?.trim() ||
          (result.modelExecution?.status === "error"
            ? result.modelExecution.message
            : executionSummary);
        applyPendingReplyResolution({
          assistantReply,
          tokenUsage: result.modelExecution?.tokenUsage ?? null,
          buildDocument: (baseDocument) =>
            createCommandExecutionDocument({
              currentDocument: baseDocument,
              executionSummary,
              assistantReply,
              modelExecution: result.modelExecution,
              node: selectedNode,
              projectName: selectedProject.name,
              prompt,
              commandId
            })
        });

        dispatchForgePageContractRefresh([
          "projects",
          "team",
          "artifacts",
          "execution",
          "governance"
        ]);
        showActionFeedback("已发起真实命令执行", "success");
        return;
      } catch (error) {
        const assistantReply =
          error instanceof Error ? error.message : "真实命令执行失败";
        applyPendingReplyResolution({
          assistantReply
        });
        showActionFeedback(
          error instanceof Error ? error.message : "真实命令执行失败",
          "warn"
        );
        return;
      }
    }

    const nextAiReply = createGeneratedNodeReply({
      prompt,
      projectName: selectedProject.name,
      node: selectedNode,
      model: selectedModel,
      thinkingBudget
    });

    applyPendingReplyResolution({
      assistantReply: nextAiReply
    });

    showActionFeedback("已更新当前会话", "success");
  };

  const handleReleaseApprove = async () => {
    if (
      !selectedProject ||
      !executeWorkbenchCommand ||
      selectedNode !== "交付发布" ||
      !activeConversationTab ||
      !activeDocumentTab
    ) {
      return;
    }

    try {
      const result = await executeWorkbenchCommand({
        commandId: "command-release-approve",
        projectId: selectedProject.id,
        selectedModel,
        thinkingBudget,
        triggeredBy: activeNodeWorkbench?.agentName ?? "项目工作台"
      });

      updateActiveProjectWorkspace((current) => {
        const panel = current.nodePanels[selectedNode];
        if (!panel) {
          return current;
        }

        const nextConversationTabs = panel.conversationTabs.map((tab) =>
          tab.id === activeConversationTab.id
            ? {
                ...tab,
                messages: [
                  ...tab.messages,
                  {
                    id: `${selectedNode}-release-${Date.now()}`,
                    speaker: activeNodeWorkbench?.agentName ?? RELEASE_AGENT_NAME,
                    role: "ai" as const,
                    text: result.execution.summary,
                    time: "刚刚"
                  }
                ]
              }
            : tab
        );
        const nextDocumentTabs = panel.documentTabs.map((tab) =>
          tab.id === activeDocumentTab.id
            ? {
                ...tab,
                document: createSeededDocument(
                  activeDocumentTab.document?.title ?? `${selectedProject.name} 部署结果`,
                  [
                    `# ${selectedProject.name} 部署结果`,
                    `## 当前状态\n- ${result.execution.summary}`,
                    "## 演示结果",
                    "- 交付链路已经闭环，可继续展示交付说明、工件与归档沉淀"
                  ],
                  "刚刚"
                )
              }
            : tab
        );

        return {
          ...current,
          nodePanels: {
            ...current.nodePanels,
            [selectedNode]: {
              ...panel,
              conversationTabs: nextConversationTabs,
              documentTabs: nextDocumentTabs
            }
          }
        };
      });

      dispatchForgePageContractRefresh([
        "home",
        "projects",
        "artifacts",
        "execution",
        "governance"
      ]);
      showActionFeedback(result.execution.summary || "已完成一键部署", "success");
    } catch (error) {
      showActionFeedback(error instanceof Error ? error.message : "一键部署失败", "warn");
    }
  };

  const openPendingTabDelete = (nextPendingDelete: Exclude<PendingTabDeleteState, null>) => {
    setPendingTabDelete(nextPendingDelete);
  };

  const closePendingTabDelete = () => {
    setPendingTabDelete(null);
  };

  const confirmPendingTabDelete = () => {
    if (!pendingTabDelete) return;

    if (pendingTabDelete.kind === "conversation") {
      handleDeleteConversationTab(pendingTabDelete.tabId, pendingTabDelete.node);
    } else {
      handleDeleteDocumentTab(pendingTabDelete.tabId, pendingTabDelete.node);
    }

    closePendingTabDelete();
  };

  return (
    <ForgeConsoleShell
      activeView="projects"
      breadcrumb={["控制台", "项目工作台"]}
      contentLayout="full-bleed"
      hideHeader
      showNavigation={showNavigation}
      sidebarCollapsible
      sidebarSections={[
        {
          label: "项目选择",
          items: projectSectionItems
        },
        {
          label: "工作节点",
          items: nodeSectionItems
        }
      ]}
      sidebarTitle="Forge"
    >
      {selectedProject && activeNodeWorkbench && activeConversationTab && activeDocumentTab ? (
        <>
          {isProjectPickerOpen ? (
            <div
              aria-label="选择项目"
              className={styles.projectPickerOverlay}
              role="dialog"
            >
              <div className={`${shellStyles.card} ${styles.projectPickerDialog}`}>
                <div className={shellStyles.cardHeader}>
                  <div>
                    <p className={shellStyles.eyebrow}>切换项目</p>
                    <h2>选择项目</h2>
                  </div>
                  <button
                    aria-label="关闭项目选择"
                    className={styles.iconAction}
                    onClick={() => {
                      setIsProjectPickerOpen(false);
                      setSearchQuery("");
                    }}
                    type="button"
                  >
                    ×
                  </button>
                </div>

                <label className={styles.searchField}>
                  <span className={styles.searchIcon} aria-hidden="true">
                    ⌕
                  </span>
                  <input
                    aria-label="搜索项目"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="搜索项目"
                    type="search"
                    value={searchQuery}
                  />
                </label>

                <div className={styles.projectPickerList}>
                  {filteredProjectRows.map((item) => (
                    <button
                      className={`${styles.projectPickerItem} ${
                        item.project.id === selectedProject?.id ? styles.projectPickerItemActive : ""
                      }`}
                      key={item.project.id}
                      onClick={() => handleSelectProject(item.project.id)}
                      type="button"
                    >
                      <span className={styles.projectPickerPrimary}>
                        <strong>{item.project.name}</strong>
                        <small>
                          {formatWorkflowStageLabel(item.workflow?.currentStage)} · {item.project.owner}
                        </small>
                      </span>
                      <span className={getToneBadgeClassName(getHealthTone(item.health))}>
                        {item.health}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {isCreateProjectOpen ? (
            <ForgeEditDialog
              ariaLabel="新建项目"
              dialogClassName={styles.createProjectDialog}
              eyebrow="项目接入"
              onClose={() => setIsCreateProjectOpen(false)}
              title="新建项目"
              footer={
                <>
                  <button
                    className={shellStyles.secondaryButton}
                    onClick={() => setIsCreateProjectOpen(false)}
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    className={shellStyles.primaryButton}
                    disabled={isCreatingProject}
                    onClick={handleCreateProject}
                    type="button"
                  >
                    {isCreatingProject ? "创建中..." : "创建项目"}
                  </button>
                </>
              }
            >
              <div className={styles.actionDialogBody}>
                <label className={styles.dialogField}>
                  <span>客户原始需求</span>
                  <textarea
                    aria-label="客户原始需求"
                    className={styles.dialogTextarea}
                    onChange={(event) =>
                      setCreateProjectDraft((current) => ({
                        ...current,
                        requirement: event.target.value
                      }))
                    }
                    placeholder="例如：搭建一个企业知识助手，支持问答、检索和工单处理。"
                    rows={5}
                    value={createProjectDraft.requirement}
                  />
                </label>
                <label className={styles.dialogField}>
                  <span>项目名称</span>
                  <input
                    aria-label="项目名称"
                    className={styles.dialogInput}
                    onChange={(event) =>
                      setCreateProjectDraft((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                    placeholder="例如：企业知识助手"
                    type="text"
                    value={createProjectDraft.name}
                  />
                </label>
                <label className={styles.dialogField}>
                  <span>项目模板</span>
                  <select
                    aria-label="项目模板"
                    className={styles.dialogSelect}
                    onChange={(event) =>
                      setCreateProjectDraft((current) => ({
                        ...current,
                        templateId: event.target.value
                      }))
                    }
                    value={createProjectDraft.templateId}
                  >
                    {snapshot.projectTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.dialogField}>
                  <span>行业 / 场景</span>
                  <input
                    aria-label="行业 / 场景"
                    className={styles.dialogInput}
                    onChange={(event) =>
                      setCreateProjectDraft((current) => ({
                        ...current,
                        sector: event.target.value
                      }))
                    }
                    placeholder="例如：企业服务 / 知识管理"
                    type="text"
                    value={createProjectDraft.sector}
                  />
                </label>
                <label className={styles.dialogField}>
                  <span>负责人</span>
                  <input
                    aria-label="负责人"
                    className={styles.dialogInput}
                    onChange={(event) =>
                      setCreateProjectDraft((current) => ({
                        ...current,
                        owner: event.target.value
                      }))
                    }
                    placeholder="例如：项目负责人"
                    type="text"
                    value={createProjectDraft.owner}
                  />
                </label>
              </div>
            </ForgeEditDialog>
          ) : null}

          {isPrdGenerationOpen ? (
            <ForgeEditDialog
              ariaLabel="生成 PRD"
              eyebrow="需求确认"
              onClose={() => setIsPrdGenerationOpen(false)}
              title="生成 PRD"
              footer={
                <>
                  <button
                    className={shellStyles.secondaryButton}
                    onClick={() => setIsPrdGenerationOpen(false)}
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    className={shellStyles.primaryButton}
                    disabled={isGeneratingPrd || !defaultPromptTemplateId}
                    onClick={handleGeneratePrd}
                    type="button"
                  >
                    {isGeneratingPrd ? "生成中..." : "生成 PRD"}
                  </button>
                </>
              }
            >
              <div className={styles.actionDialogBody}>
                <div className={styles.dialogHint}>
                  当前项目会优先使用 {selectedTemplate?.title ?? "默认模板"} 绑定的默认 PRD 模板。
                </div>
                <label className={styles.dialogField}>
                  <span>补充说明</span>
                  <textarea
                    aria-label="补充说明"
                    className={styles.dialogTextarea}
                    onChange={(event) => setPrdExtraNotes(event.target.value)}
                    placeholder="例如：强调核心流程、异常处理与验收边界。"
                    rows={6}
                    value={prdExtraNotes}
                  />
                </label>
              </div>
            </ForgeEditDialog>
          ) : null}

          <section
            className={`${styles.workspaceGrid} ${styles.workspaceGridFullBleed} ${
              isProjectOverviewActive
                ? styles.workspaceGridOverviewMode
                : !isProjectOverviewActive && isWorkspaceDrawerOpen
                ? styles.workspaceGridFilePaneOpen
                : ""
            }`}
            data-testid="project-workspace-grid"
          >
            {isProjectOverviewActive ? (
              <section
                aria-label="项目总控"
                className={styles.projectOverviewWorkspace}
                role="region"
              >
                {snapshot.dataModeLabel ? (
                  <section aria-label="数据模式" className={styles.projectOverviewModeBanner}>
                    <span className={`${styles.dataModeBadge} ${dataModeBadgeClassName}`}>
                      {snapshot.dataModeLabel}
                    </span>
                    {snapshot.dataModeSummary ? <p>{snapshot.dataModeSummary}</p> : null}
                  </section>
                ) : null}

                <section aria-label="项目摘要" className={styles.handoffStrip}>
                  <article className={styles.handoffCard}>
                    <span>项目名称</span>
                    <strong>{selectedProject.name}</strong>
                  </article>
                  <article className={styles.handoffCard}>
                    <span>当前状态</span>
                    <strong>{projectOverviewStatusLabel}</strong>
                  </article>
                  <article className={styles.handoffCard}>
                    <span>总进度</span>
                    <strong>{selectedProject.progress}%</strong>
                  </article>
                  <article className={styles.handoffCard}>
                    <span>负责人</span>
                    <strong>{projectOwnerLabel}</strong>
                  </article>
                  <article className={styles.handoffCard}>
                    <span>交付日期</span>
                    <strong>{projectDeliveryDateLabel}</strong>
                  </article>
                </section>

                <section aria-label="AI 对话" className={`${shellStyles.card} ${styles.chatPanel}`} role="region">
                  <div
                    className={`${styles.projectOverviewPanelHeader} ${styles.projectOverviewPanelHeaderCompact}`}
                  >
                    <span className={styles.projectOverviewSectionBadge}>项目经理</span>
                    <p className={styles.projectOverviewPanelMeta}>{projectDecisionSummary}</p>
                  </div>

                  {renderSharedConversationMessages(activeConversationMessages)}
                  {renderSharedConversationComposer()}
                </section>

                <div className={styles.projectOverviewSidebar}>
                  <section
                    aria-label="重要日志"
                    className={`${shellStyles.card} ${styles.projectOverviewSidebarPanel}`}
                    role="region"
                  >
                    <div className={styles.projectOverviewPanelHeader}>
                      <span className={styles.projectOverviewSectionBadge}>重要日志</span>
                    </div>
                    <div className={styles.projectOverviewLogList}>
                      {projectOverviewLogs.map((item) => (
                        <article className={styles.projectOverviewLogItem} key={item.id}>
                          <span className={styles.projectOverviewLogTime}>
                            {formatProjectOverviewLogTime(item.time)}
                          </span>
                          <div className={styles.projectOverviewLogSummary}>
                            <span className={getToneBadgeClassName(item.tone)}>{item.kind}</span>
                            <strong>{item.summary}</strong>
                            {item.meta ? <span className={styles.projectOverviewLogInlineMeta}>{item.meta}</span> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section
                    aria-label="计划文档"
                    className={`${shellStyles.card} ${styles.projectOverviewSidebarPanel}`}
                    role="region"
                  >
                    <div className={styles.projectOverviewPanelHeader}>
                      <span className={styles.projectOverviewSectionBadge}>计划文档</span>
                      <div className={styles.projectOverviewPlanCounts}>
                        <span>已完成 {projectOverviewPlanCounts.completed}</span>
                        <span>进行中 {projectOverviewPlanCounts.inProgress}</span>
                        <span>已阻塞 {projectOverviewPlanCounts.blocked}</span>
                      </div>
                    </div>

                    <div className={styles.projectOverviewPlanLayout}>
                      <div className={styles.projectOverviewPlanList}>
                        {projectOverviewPlanItems.map((item) => (
                          <button
                            aria-pressed={item.id === activeProjectOverviewPlan?.id}
                            className={`${styles.projectOverviewPlanButton} ${
                              item.id === activeProjectOverviewPlan?.id
                                ? styles.projectOverviewPlanButtonActive
                                : ""
                            }`}
                            key={item.id}
                            onClick={() => handleSelectProjectOverviewPlan(item.id)}
                            type="button"
                          >
                            <div className={styles.projectOverviewPlanButtonHeader}>
                              <strong>{item.label}</strong>
                              <span className={getToneBadgeClassName(getNodeTone(item.status))}>
                                {item.status}
                              </span>
                            </div>
                            <p>{item.stage} · {formatTimestamp(item.updatedAt ?? "待更新")}</p>
                          </button>
                        ))}
                      </div>

                      <div className={styles.projectOverviewPlanPreview}>
                        {activeProjectOverviewPlan?.document ? (
                          <>
                            <div className={styles.projectOverviewPlanPreviewHeader}>
                              <strong>{activeProjectOverviewPlan.label}</strong>
                              <p>
                                {activeProjectOverviewPlan.stage} · {activeProjectOverviewPlan.status} ·{" "}
                                {formatTimestamp(activeProjectOverviewPlan.updatedAt ?? "待更新")}
                              </p>
                            </div>
                            <pre className={styles.documentBody}>
                              {activeProjectOverviewPlan.document.body}
                            </pre>
                          </>
                        ) : (
                          <div className={styles.emptyDocumentState}>
                            <p>当前还没有可展示的计划文档。</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                </div>
              </section>
            ) : (
              <>
                <section className={styles.handoffStrip} aria-label="当前节点摘要">
                  <article className={styles.handoffCard}>
                    <span>当前负责人</span>
                    <strong>{activeNodeWorkbench.agentName}</strong>
                  </article>
                  <article className={styles.handoffCard}>
                    <span>节点状态</span>
                    <strong>{activeNodeWorkbench.status}</strong>
                  </article>
                  <article className={`${styles.handoffCard} ${styles.handoffCardWide}`}>
                    <span>当前结论</span>
                    <p>{activeNodeWorkbench.summary}</p>
                  </article>
                  <article className={`${styles.handoffCard} ${styles.handoffCardWide}`}>
                    <span>下一步动作</span>
                    <p>{activeNodeWorkbench.nextAction}</p>
                  </article>
                  {activeNodeContextPreview ? (
                    <article className={`${styles.handoffCard} ${styles.handoffCardContext}`}>
                      <span>AI 上下文</span>
                      <button
                        aria-haspopup="dialog"
                        aria-label="查看 AI 上下文"
                        className={styles.handoffContextToggle}
                        onClick={() => setIsContextPreviewDialogOpen(true)}
                        type="button"
                      >
                        查看 AI 上下文
                      </button>
                    </article>
                  ) : null}
                </section>
                <section aria-label="AI 对话" className={`${shellStyles.card} ${styles.chatPanel}`} role="region">
                  <div className={styles.panelTabHeader}>
                    <div
                      aria-label="AI 会话标签"
                      className={styles.panelTabBar}
                      role="tablist"
                    >
                      {activeNodePanelState?.conversationTabs.map((item) => (
                        <div className={styles.panelTabChip} key={`chat-${item.id}`}>
                          {editingTab?.kind === "conversation" &&
                          editingTab.node === selectedNode &&
                          editingTab.tabId === item.id ? (
                            <input
                              aria-label="重命名会话标签"
                              autoFocus
                              className={styles.panelTabInput}
                              onBlur={handleCommitRename}
                              onChange={(event) => handleRenameInputChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  handleCommitRename();
                                }

                                if (event.key === "Escape") {
                                  handleCancelRename();
                                }
                              }}
                              type="text"
                              value={editingTab.value}
                            />
                          ) : (
                            <button
                              aria-selected={item.id === activeConversationTab.id}
                              className={`${styles.panelTabButton} ${
                                item.id === activeConversationTab.id ? styles.panelTabButtonActive : ""
                              }`}
                              onClick={(event) => handleConversationTabClick(event, item.id, item.label)}
                              role="tab"
                              type="button"
                            >
                              {item.label}
                            </button>
                          )}
                          {activeNodePanelState.conversationTabs.length > 1 ? (
                            <button
                              aria-label={`删除会话标签 ${item.label}`}
                              className={styles.panelTabRemoveButton}
                              onClick={() =>
                                openPendingTabDelete({
                                  kind: "conversation",
                                  node: selectedNode,
                                  tabId: item.id,
                                  label: item.label
                                })
                              }
                              type="button"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <button
                      aria-label="新增会话标签"
                      className={styles.panelTabAddButton}
                      onClick={handleAddConversationTab}
                      type="button"
                    >
                      +
                    </button>
                  </div>

                  {renderSharedConversationMessages(activeConversationTab.messages, {
                    scrollTestId: "project-chat-scroll"
                  })}
                  {renderSharedConversationComposer()}
                </section>

                <section aria-label="节点结果" className={`${shellStyles.card} ${styles.documentPanel}`} role="region">
                  {isPreviewingWorkspaceFile ? (
                    <>
                      <div className={styles.workspaceDocumentHeader}>
                        <div className={styles.workspaceDocumentHeading}>
                          <span className={styles.workspaceDocumentBadge}>工作区文件</span>
                          <strong>{activeWorkspaceFile?.name ?? "未选择文件"}</strong>
                          <p>{activeWorkspaceFile?.path ?? "从最右侧文件树中选择一个文件即可查看。"}</p>
                        </div>
                        <div className={styles.documentActions}>
                          {selectedProjectDebugUrl ? (
                            <button
                              aria-label="打开调试页"
                              className={styles.documentActionButton}
                              onClick={handleOpenDebugPage}
                              type="button"
                            >
                              打开调试页
                            </button>
                          ) : null}
                          <button
                            aria-label="返回节点文档"
                            className={styles.documentActionButton}
                            onClick={clearWorkspaceDocumentPreview}
                            type="button"
                          >
                            返回节点文档
                          </button>
                          {activeWorkspaceFile?.editable ? (
                            isEditingWorkspaceFile ? (
                              <>
                                <button
                                  aria-label="取消 Markdown 编辑"
                                  className={styles.documentActionButton}
                                  onClick={handleCancelWorkspaceFileEdit}
                                  type="button"
                                >
                                  取消
                                </button>
                                <button
                                  aria-label="保存 Markdown"
                                  className={styles.documentActionButtonPrimary}
                                  onClick={() => {
                                    void handleSaveWorkspaceFileEdit();
                                  }}
                                  type="button"
                                >
                                  保存 Markdown
                                </button>
                              </>
                            ) : (
                              <button
                                aria-label="编辑 Markdown"
                                className={styles.documentActionButton}
                                onClick={handleStartWorkspaceFileEdit}
                                type="button"
                              >
                                编辑 Markdown
                              </button>
                            )
                          ) : null}
                        </div>
                      </div>

                      <div className={styles.documentScrollRegion} data-testid="project-document-scroll">
                        {workspaceDocumentState.status === "loading" || workspaceDocumentState.status === "saving" ? (
                          <div className={styles.emptyDocumentState}>
                            <p>
                              {workspaceDocumentState.status === "saving"
                                ? "正在保存工作区 Markdown…"
                                : "正在读取工作区文件…"}
                            </p>
                          </div>
                        ) : workspaceDocumentState.status === "error" ? (
                          <div className={styles.emptyDocumentState}>
                            <p>{workspaceDocumentState.error}</p>
                          </div>
                        ) : isEditingWorkspaceFile ? (
                          <div className={styles.documentEditorSurface}>
                            <textarea
                              aria-label="编辑工作区 Markdown"
                              className={styles.documentEditorTextarea}
                              onChange={(event) => handleWorkspaceFileEditChange(event.target.value)}
                              value={workspaceDocumentState.editingValue ?? ""}
                            />
                          </div>
                        ) : activeWorkspaceFile ? (
                          <article className={styles.documentSurface}>
                            <pre className={styles.documentBody}>{activeWorkspaceFile.body}</pre>
                          </article>
                        ) : (
                          <div className={styles.emptyDocumentState}>
                            <p>从最右侧文件树中选择一个文件即可查看。</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.panelTabHeader}>
                        <div
                          aria-label="文档标签"
                          className={styles.panelTabBar}
                          role="tablist"
                        >
                          {activeNodePanelState?.documentTabs.map((item) => (
                            <div className={styles.panelTabChip} key={`document-${item.id}`}>
                              {editingTab?.kind === "document" &&
                              editingTab.node === selectedNode &&
                              editingTab.tabId === item.id ? (
                                <input
                                  aria-label="重命名文档标签"
                                  autoFocus
                                  className={styles.panelTabInput}
                                  onBlur={handleCommitRename}
                                  onChange={(event) => handleRenameInputChange(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      handleCommitRename();
                                    }

                                    if (event.key === "Escape") {
                                      handleCancelRename();
                                    }
                                  }}
                                  type="text"
                                  value={editingTab.value}
                                />
                              ) : (
                                <button
                                  aria-selected={item.id === activeDocumentTab.id}
                                  className={`${styles.panelTabButton} ${
                                    item.id === activeDocumentTab.id ? styles.panelTabButtonActive : ""
                                  }`}
                                  onClick={(event) => handleDocumentTabClick(event, item.id, item.label)}
                                  role="tab"
                                  type="button"
                                >
                                  {item.label}
                                </button>
                              )}
                              {activeNodePanelState.documentTabs.length > 1 ? (
                                <button
                                  aria-label={`删除文档标签 ${item.label}`}
                                  className={styles.panelTabRemoveButton}
                                  onClick={() =>
                                    openPendingTabDelete({
                                      kind: "document",
                                      node: selectedNode,
                                      tabId: item.id,
                                      label: item.label
                                    })
                                  }
                                  type="button"
                                >
                                  ×
                                </button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                        <div className={styles.documentActions}>
                          {selectedProjectDebugUrl ? (
                            <button
                              aria-label="打开调试页"
                              className={styles.documentActionButton}
                              onClick={handleOpenDebugPage}
                              type="button"
                            >
                              打开调试页
                            </button>
                          ) : null}
                          {activeDocumentTab.document ? (
                            isEditingActiveDocument ? (
                              <>
                                <button
                                  aria-label="取消正文编辑"
                                  className={styles.documentActionButton}
                                  onClick={handleCancelDocumentEdit}
                                  type="button"
                                >
                                  取消
                                </button>
                                <button
                                  aria-label="保存正文"
                                  className={styles.documentActionButtonPrimary}
                                  onClick={handleSaveDocumentEdit}
                                  type="button"
                                >
                                  保存正文
                                </button>
                              </>
                            ) : (
                              <button
                                aria-label="编辑正文"
                                className={styles.documentActionButton}
                                onClick={handleStartDocumentEdit}
                                type="button"
                              >
                                编辑正文
                              </button>
                            )
                          ) : null}
                          {canTriggerReleaseApprove ? (
                            <button
                              className={styles.releaseActionButton}
                              onClick={handleReleaseApprove}
                              type="button"
                            >
                              一键部署
                            </button>
                          ) : null}
                          <button
                            aria-label="新增文档标签"
                            className={styles.panelTabAddButton}
                            onClick={handleAddDocumentTab}
                            type="button"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className={styles.documentScrollRegion} data-testid="project-document-scroll">
                        {activeDocumentTab.document ? (
                          isEditingActiveDocument && editingDocument ? (
                            <div className={styles.documentEditorSurface}>
                              <textarea
                                aria-label="编辑当前文档 Markdown"
                                className={styles.documentEditorTextarea}
                                onChange={(event) => handleDocumentEditChange(event.target.value)}
                                value={editingDocument.value}
                              />
                            </div>
                          ) : (
                            <article className={styles.documentSurface}>
                              {activeDocumentVisualPreview ? (
                                <section
                                  aria-label={activeDocumentVisualPreview.ariaLabel}
                                  className={`${styles.documentVisualPreview} ${
                                    activeDocumentVisualPreview.variant === "design"
                                      ? styles.documentVisualPreviewDesign
                                      : styles.documentVisualPreviewPrototype
                                  }`}
                                >
                                  <div className={styles.documentVisualPreviewHeader}>
                                    <div>
                                      <span className={styles.documentVisualPreviewBadge}>
                                        {activeDocumentVisualPreview.ariaLabel}
                                      </span>
                                      <strong>{activeDocumentVisualPreview.title}</strong>
                                    </div>
                                    <p>{activeDocumentVisualPreview.summary}</p>
                                  </div>
                                  <div className={styles.documentVisualPreviewGrid}>
                                    {activeDocumentVisualPreview.cards.map((card) => (
                                      <article
                                        className={`${styles.documentVisualCard} ${
                                          card.accent === "amber"
                                            ? styles.documentVisualCardAmber
                                            : card.accent === "green"
                                              ? styles.documentVisualCardGreen
                                              : styles.documentVisualCardBlue
                                        }`}
                                        key={`${activeDocumentVisualPreview.ariaLabel}-${card.title}`}
                                      >
                                        <div className={styles.documentVisualCardHeader}>
                                          <span>{card.eyebrow}</span>
                                          <strong>{card.title}</strong>
                                          <p>{card.description}</p>
                                        </div>
                                        <div className={styles.documentVisualCanvas}>
                                          <div className={styles.documentVisualToolbar}>
                                            <i />
                                            <i />
                                            <i />
                                          </div>
                                          <div className={styles.documentVisualLayout}>
                                            <div className={styles.documentVisualRail}>
                                              <span />
                                              <span />
                                              <span />
                                            </div>
                                            <div className={styles.documentVisualMain}>
                                              <div className={styles.documentVisualHero} />
                                              <div className={styles.documentVisualRows}>
                                                <span />
                                                <span />
                                                <span />
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        <div className={styles.documentVisualChipRow}>
                                          {card.chips.map((chip) => (
                                            <span
                                              className={styles.documentVisualChip}
                                              key={`${card.title}-${chip}`}
                                            >
                                              {chip}
                                            </span>
                                          ))}
                                        </div>
                                      </article>
                                    ))}
                                  </div>
                                </section>
                              ) : null}
                              <pre className={styles.documentBody}>{activeDocumentTab.document.body}</pre>
                            </article>
                          )
                        ) : (
                          <div className={styles.emptyDocumentState}>
                            <p>请先在左侧会话中生成内容</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </section>
                {activeNodeContextPreview && isContextPreviewDialogOpen ? (
                  <ForgeEditDialog
                    ariaLabel="AI 上下文详情"
                    bodyClassName={styles.contextPreviewDialogBody}
                    dialogClassName={styles.contextPreviewDialog}
                    onClose={() => setIsContextPreviewDialogOpen(false)}
                    style={{
                      width: "min(1040px, calc(100vw - 48px))"
                    }}
                    title="AI 上下文详情"
                  >
                    <div className={styles.handoffContextBody}>
                      <div className={styles.handoffContextRow}>
                        <strong>可用技能</strong>
                        <p>
                          {activeNodeContextPreview.skills.length
                            ? activeNodeContextPreview.skills.map((skill) => skill.name).join(" / ")
                            : "当前没有额外技能摘要"}
                        </p>
                      </div>
                      <div className={styles.handoffContextRow}>
                        <strong>可用工具</strong>
                        {activeNodeContextPreview.tools.length ? (
                          <div className={styles.handoffContextToolSummary}>
                            <div className={styles.handoffContextModeBadges}>
                              {getOrderedToolModes(activeNodeContextPreview.tools).map((mode) => (
                                <span
                                  className={`${styles.handoffContextModeBadge} ${getToolModeBadgeClassName(mode)}`}
                                  key={mode}
                                >
                                  {getToolModeLabel(mode)}
                                </span>
                              ))}
                            </div>
                            <p>
                              {activeNodeContextPreview.tools.map((tool) => tool.label).join(" / ")}
                            </p>
                          </div>
                        ) : (
                          <p>当前没有工具权限</p>
                        )}
                      </div>
                      <div className={styles.handoffContextRow}>
                        <strong>关键交付物</strong>
                        <p>
                          {activeNodeContextPreview.deliverables.length
                            ? activeNodeContextPreview.deliverables
                                .map((deliverable) => deliverable.label)
                                .join(" / ")
                            : "当前没有关键交付物"}
                        </p>
                      </div>
                      <div className={styles.handoffContextExpandedSection}>
                        <strong>知识命中</strong>
                        {activeNodeContextPreview.knowledgeSnippets.length ? (
                          <div className={styles.handoffContextKnowledgeList}>
                            {activeNodeContextPreview.knowledgeSnippets.map((snippet) => (
                              <article
                                className={styles.handoffContextKnowledgeItem}
                                key={`${snippet.label}-${snippet.sourceTitle}`}
                              >
                                <header>
                                  <span>{snippet.label}</span>
                                  <p>来源：{snippet.sourceTitle}</p>
                                </header>
                                <p className={styles.handoffContextKnowledgeReason}>
                                  命中：{snippet.matchReason}
                                </p>
                                <p>{snippet.summary}</p>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p>当前没有额外知识摘录</p>
                        )}
                      </div>
                      <div className={styles.handoffContextExpandedSection}>
                        <strong>工作区路径</strong>
                        <div className={styles.handoffContextPathList}>
                          <p>
                            <span>workspaceRoot</span>
                            <code>{activeNodeContextPreview.paths.workspaceRoot}</code>
                          </p>
                          <p>
                            <span>artifactsRoot</span>
                            <code>{activeNodeContextPreview.paths.artifactsRoot}</code>
                          </p>
                          <p>
                            <span>knowledgeRoot</span>
                            <code>{activeNodeContextPreview.paths.knowledgeRoot}</code>
                          </p>
                          <p>
                            <span>skillsRoot</span>
                            <code>{activeNodeContextPreview.paths.skillsRoot}</code>
                          </p>
                        </div>
                      </div>
                      <div className={styles.handoffContextExpandedSection}>
                        <strong>执行边界</strong>
                        <div className={styles.handoffContextBoundaryList}>
                          <p>
                            <span>owner 模式</span>
                            <code>
                              {formatAgentOwnerModeLabel(activeNodeContextPreview.identity.ownerMode)}
                            </code>
                          </p>
                          <p>
                            <span>工具权限</span>
                            <code>{formatAgentToolModeSummary(activeNodeContextPreview.tools)}</code>
                          </p>
                          <p>
                            <span>上下文预算</span>
                            <code>
                              技能 {activeNodeContextPreview.budget.maxSkills} / SOP{" "}
                              {activeNodeContextPreview.budget.maxSops} / 知识{" "}
                              {activeNodeContextPreview.budget.maxKnowledgeSnippets} / 交付物{" "}
                              {activeNodeContextPreview.budget.maxDeliverables}
                            </code>
                          </p>
                        </div>
                      </div>
                    </div>
                  </ForgeEditDialog>
                ) : null}
              </>
            )}
            {!isProjectOverviewActive && selectedProject ? (
              <ForgeProjectWorkspaceDrawer
                onClose={handleCloseWorkspaceDrawer}
                onCreateDirectory={() => handleOpenWorkspaceCreateDialog("directory")}
                onCreateMarkdown={() => handleOpenWorkspaceCreateDialog("markdown")}
                onDeleteEntry={handleRequestWorkspaceDelete}
                onExpandedDirectoriesChange={(expandedDirectories) => {
                  updateActiveWorkspaceView((current) => ({
                    ...current,
                    expandedDirectories
                  }));
                }}
                onOpen={handleOpenWorkspaceDrawer}
                onSelectFile={(path) => {
                  void handleSelectWorkspaceFile(path);
                }}
                expandedDirectories={activeWorkspaceView.expandedDirectories}
                open={isWorkspaceDrawerOpen}
                projectId={selectedProject.id}
                reloadToken={workspaceTreeReloadToken}
                selectedFilePath={activeWorkspaceView.selectedFilePath}
                workspaceLabel={selectedWorkspaceLabel}
              />
            ) : null}
          </section>
        </>
      ) : (
        <section className={shellStyles.cardSoft}>
          <p className={shellStyles.muted}>当前没有可展示的项目，请先创建或搜索新的项目。</p>
        </section>
      )}
      {actionFeedback ? (
        <div
          aria-live="polite"
          className={`${shellStyles.floatingStatusToast} ${
            actionFeedback.tone === "info"
              ? shellStyles.floatingStatusToastInfo
              : actionFeedback.tone === "warn"
                ? shellStyles.floatingStatusToastWarn
                : ""
          }`}
          role="status"
        >
          {actionFeedback.message}
        </div>
      ) : null}
      <ForgeConfirmDialog
        closeLabel="关闭删除确认"
        confirmLabel="确认删除"
        description={
          pendingTabDelete
            ? pendingTabDelete.kind === "conversation"
              ? `删除会话标签「${pendingTabDelete.label}」后，对应对话内容将不再保留。`
              : `删除文档标签「${pendingTabDelete.label}」后，对应结果内容将不再保留。`
            : ""
        }
        label={pendingTabDelete?.kind === "conversation" ? "确认删除会话标签" : "确认删除文档标签"}
        onCancel={closePendingTabDelete}
        onConfirm={confirmPendingTabDelete}
        open={Boolean(pendingTabDelete)}
        title={pendingTabDelete?.kind === "conversation" ? "确认删除会话标签" : "确认删除文档标签"}
      />
      {workspaceCreateDialog ? (
        <ForgeEditDialog
          ariaLabel={workspaceCreateDialog.kind === "markdown" ? "新建工作区 Markdown" : "新建工作区文件夹"}
          bodyClassName={styles.actionDialogBody}
          dialogClassName={styles.projectPickerDialog}
          footer={
            <>
              <button className={shellStyles.secondaryButton} onClick={handleCloseWorkspaceCreateDialog} type="button">
                取消
              </button>
              <button className={shellStyles.primaryButton} onClick={() => void handleConfirmWorkspaceCreate()} type="button">
                确认新建
              </button>
            </>
          }
          onClose={handleCloseWorkspaceCreateDialog}
          title={workspaceCreateDialog.kind === "markdown" ? "新建工作区 Markdown" : "新建工作区文件夹"}
        >
          <label className={styles.dialogField}>
            <span>相对路径</span>
            <input
              aria-label="工作区路径"
              autoFocus
              className={styles.dialogInput}
              onChange={(event) => handleCreateWorkspaceDialogPathChange(event.target.value)}
              type="text"
              value={workspaceCreateDialog.path}
            />
          </label>
          <div className={styles.dialogHint}>
            {workspaceCreateDialog.kind === "markdown"
              ? "请输入工作区内的 Markdown 相对路径，例如 notes/summary.md。"
              : "请输入要创建的文件夹相对路径，例如 notes/handoff。"}
          </div>
        </ForgeEditDialog>
      ) : null}
      <ForgeConfirmDialog
        closeLabel="关闭工作区删除确认"
        confirmLabel="确认删除"
        description={
          pendingWorkspaceDelete
            ? pendingWorkspaceDelete.kind === "directory"
              ? `删除文件夹「${pendingWorkspaceDelete.name}」后，里面的内容也会一起移除。`
              : `删除文件「${pendingWorkspaceDelete.name}」后，将无法在工作区中继续查看。`
            : ""
        }
        label="确认删除工作区条目"
        onCancel={handleCancelWorkspaceDelete}
        onConfirm={() => void handleConfirmWorkspaceDelete()}
        open={Boolean(pendingWorkspaceDelete)}
        title={
          pendingWorkspaceDelete?.kind === "directory" ? "确认删除工作区文件夹" : "确认删除工作区文件"
        }
      />
    </ForgeConsoleShell>
  );
}
