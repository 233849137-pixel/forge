"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ForgeDashboardSnapshot, ForgeTask } from "../../packages/core/src/types";
import { getForgeAgentDisplayLabel } from "../../packages/core/src";
import type {
  CreateForgeProjectInput,
  DeleteForgeProjectResult,
  ForgeProjectMutationResult,
  UpdateForgeProjectInput
} from "../lib/forge-project-api";
import { dispatchForgePageContractRefresh } from "../lib/forge-page-refresh-events";
import type { ForgeHomePageData } from "../server/forge-page-dtos";
import ForgeConfirmDialog from "./forge-confirm-dialog";
import ForgeConsoleShell, { getToneBadgeClassName } from "./forge-console-shell";
import ForgeEditDialog from "./forge-edit-dialog";
import shellStyles from "./forge-console-shell.module.css";
import {
  formatTimestamp,
  formatWorkflowStageLabel,
  getRelativeTimeSortValue,
  getHealthTone,
  getNextMilestone,
  getProjectHealth,
  getRoleLabel,
  getWorkflowState
} from "./forge-console-utils";
import styles from "./forge-home-page.module.css";

type ForgeHomePageProps = {
  createWorkbenchProject?: (
    input: CreateForgeProjectInput
  ) => Promise<ForgeProjectMutationResult>;
  updateWorkbenchProject?: (
    input: UpdateForgeProjectInput
  ) => Promise<ForgeProjectMutationResult>;
  deleteWorkbenchProject?: (projectId: string) => Promise<DeleteForgeProjectResult>;
  data?: ForgeHomePageData;
  snapshot?: ForgeHomePageData;
  showNavigation?: boolean;
  enableLiveAiWorkReport?: boolean;
};

type SourceNode =
  | "需求确认"
  | "项目原型"
  | "UI设计"
  | "后端研发"
  | "DEMO测试"
  | "内测调优"
  | "交付发布"
  | "已完成";

const sourceNodes: SourceNode[] = [
  "需求确认",
  "项目原型",
  "UI设计",
  "后端研发",
  "DEMO测试",
  "内测调优",
  "交付发布",
  "已完成"
];

type ProjectSortRule = "risk" | "recent" | "delivery" | "progress";
type ProjectProgressFilter = "all" | "in-progress" | "completed";

const projectSortOptions: Array<{ value: ProjectSortRule; label: string }> = [
  { value: "risk", label: "风险优先" },
  { value: "recent", label: "最近更新" },
  { value: "delivery", label: "临近交付" },
  { value: "progress", label: "进度优先" }
];

type ProjectFormDraft = {
  requirement: string;
  enterpriseName: string;
  name: string;
  sector: string;
  projectType: string;
  teamTemplateId: string;
  owner: string;
  deliveryDate: string;
  note: string;
};

type LiveAiWorkReport = {
  projectId: string;
  projectName: string;
  stage: string | null;
  summary: string;
  report: string;
};

function isPortfolioAiWorkReport(report: LiveAiWorkReport | null) {
  return report?.projectId === "portfolio";
}

function createEmptyProjectDraft(): ProjectFormDraft {
  return {
    requirement: "",
    enterpriseName: "",
    name: "",
    sector: "",
    projectType: "",
    teamTemplateId: "",
    owner: "",
    deliveryDate: "",
    note: ""
  };
}

function getTaskSortWeight(task: ForgeTask) {
  const statusOrder = { blocked: 0, "in-progress": 1, todo: 2, done: 3 };
  const priorityOrder = { P0: 0, P1: 1, P2: 2 };

  return statusOrder[task.status] * 10 + priorityOrder[task.priority];
}

function getTaskNextStep(status: ForgeTask["status"], blockerOwner: string) {
  if (status === "blocked") {
    return `请 ${blockerOwner} 先解除阻塞，再继续推进。`;
  }

  if (status === "todo") {
    return `请 ${blockerOwner} 先接手并补齐当前阶段材料。`;
  }

  return `继续由 ${blockerOwner} 推进，完成后再进入下一里程碑。`;
}

const deliveryDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit"
});

function formatDeliveryMonthDay(date: Date) {
  return deliveryDateFormatter.format(date).replace(/\//g, "-");
}

function normalizeExplicitDeliveryDate(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return "";
  }

  const fullDateMatch = trimmedValue.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (fullDateMatch) {
    return fullDateMatch.slice(5);
  }

  const parsedDate = new Date(trimmedValue);
  if (!Number.isNaN(parsedDate.getTime())) {
    return formatDeliveryMonthDay(parsedDate);
  }

  return trimmedValue;
}

function getDeliveryDateLabel(value: string | null | undefined) {
  const formatDate = (date: Date) => formatDeliveryMonthDay(date);

  if (!value) {
    return "待定";
  }

  if (value.includes("刚刚")) {
    return formatDate(new Date());
  }

  if (value.includes("今天")) {
    return formatDate(new Date());
  }

  if (value.includes("昨天")) {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatDate(date);
  }

  if (value.includes("分钟前") || value.includes("小时前")) {
    return formatDate(new Date());
  }

  if (value.includes("T")) {
    return normalizeExplicitDeliveryDate(value);
  }

  if (value.includes(" ")) {
    return normalizeExplicitDeliveryDate(value.split(" ")[0]);
  }

  return normalizeExplicitDeliveryDate(value);
}

function getExplicitDeliverySortValue(value: string | null | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return Number.POSITIVE_INFINITY;
  }

  const fullDateMatch = trimmedValue.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (fullDateMatch) {
    const timestamp = Date.parse(`${fullDateMatch}T00:00:00+08:00`);
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  const parsedDate = Date.parse(trimmedValue);
  if (!Number.isNaN(parsedDate)) {
    return parsedDate;
  }

  return Number.POSITIVE_INFINITY;
}

function compareRiskFirstProjects(
  left: { abnormal: boolean; updatedAt: string | null | undefined; progress: number; name: string },
  right: { abnormal: boolean; updatedAt: string | null | undefined; progress: number; name: string }
) {
  const abnormalOrder = Number(right.abnormal) - Number(left.abnormal);
  if (abnormalOrder !== 0) {
    return abnormalOrder;
  }

  const recencyOrder = getRelativeTimeSortValue(right.updatedAt) - getRelativeTimeSortValue(left.updatedAt);
  if (recencyOrder !== 0) {
    return recencyOrder;
  }

  const progressOrder = right.progress - left.progress;
  if (progressOrder !== 0) {
    return progressOrder;
  }

  return left.name.localeCompare(right.name, "zh-CN");
}

function compareProjectRows(
  left: {
    abnormal: boolean;
    deliveryDate: string;
    name: string;
    progress: number;
    updatedAt: string | null | undefined;
  },
  right: {
    abnormal: boolean;
    deliveryDate: string;
    name: string;
    progress: number;
    updatedAt: string | null | undefined;
  },
  sortRule: ProjectSortRule
) {
  if (sortRule === "recent") {
    const recencyOrder = getRelativeTimeSortValue(right.updatedAt) - getRelativeTimeSortValue(left.updatedAt);
    if (recencyOrder !== 0) {
      return recencyOrder;
    }

    return compareRiskFirstProjects(left, right);
  }

  if (sortRule === "delivery") {
    const deliveryOrder =
      getExplicitDeliverySortValue(left.deliveryDate) - getExplicitDeliverySortValue(right.deliveryDate);
    if (deliveryOrder !== 0) {
      return deliveryOrder;
    }

    return compareRiskFirstProjects(left, right);
  }

  if (sortRule === "progress") {
    const progressOrder = right.progress - left.progress;
    if (progressOrder !== 0) {
      return progressOrder;
    }

    return compareRiskFirstProjects(left, right);
  }

  return compareRiskFirstProjects(left, right);
}

function isCompletedProjectStage(stage?: string | null) {
  return stage === "归档复用" || stage === "已完成";
}

function getWorkflowSourceNode(stage?: string | null): SourceNode | null {
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
      return "已完成";
    default:
      return null;
  }
}

function getTaskSourceNode(role?: string): SourceNode {
  switch (role) {
    case "pm":
      return "需求确认";
    case "architect":
      return "项目原型";
    case "design":
      return "UI设计";
    case "engineer":
      return "后端研发";
    case "qa":
      return "DEMO测试";
    case "release":
      return "交付发布";
    default:
      return "内测调优";
  }
}

function getActionRank(kind: "待补料" | "待确认" | "待放行" | "待接管") {
  const rankMap = {
    待补料: 0,
    待接管: 1,
    待确认: 2,
    待放行: 3
  } as const;

  return rankMap[kind];
}

function getWorkbenchNodeFromStage(stage?: string | null) {
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
    case "归档复用":
      return "交付发布";
    default:
      return "需求确认";
  }
}

function buildProjectWorkbenchHref(projectId: string, stage?: string | null) {
  const node =
    stage && sourceNodes.includes(stage as SourceNode) ? stage : getWorkbenchNodeFromStage(stage);

  return `/projects?projectId=${encodeURIComponent(projectId)}&node=${encodeURIComponent(node)}`;
}

export default function ForgeHomePage({
  createWorkbenchProject,
  data,
  deleteWorkbenchProject,
  enableLiveAiWorkReport = false,
  snapshot: legacySnapshot,
  showNavigation = false,
  updateWorkbenchProject
}: ForgeHomePageProps) {
  const router = useRouter();
  const snapshot = data ?? legacySnapshot;

  if (!snapshot) {
    throw new Error("ForgeHomePage requires page data.");
  }

  const actionFeedbackTimerRef = useRef<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(snapshot.activeProjectId ?? null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectSortRule, setProjectSortRule] = useState<ProjectSortRule>("risk");
  const [projectProgressFilter, setProjectProgressFilter] = useState<ProjectProgressFilter>("all");
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isDeleteProjectConfirmOpen, setIsDeleteProjectConfirmOpen] = useState(false);
  const [isUpdatingProject, setIsUpdatingProject] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [createProjectDraft, setCreateProjectDraft] = useState<ProjectFormDraft>(createEmptyProjectDraft);
  const [editProjectDraft, setEditProjectDraft] = useState<ProjectFormDraft>(createEmptyProjectDraft);
  const [deletedProjectIds, setDeletedProjectIds] = useState<string[]>([]);
  const [projectOverrides, setProjectOverrides] = useState<
    Record<string, Partial<ProjectFormDraft> & { name?: string; owner?: string; sector?: string }>
  >({});
  const [actionFeedback, setActionFeedback] = useState<{
    message: string;
    tone: "success" | "info" | "warn";
  } | null>(null);
  const [isRefreshingAiReport, setIsRefreshingAiReport] = useState(false);
  const [liveAiWorkReport, setLiveAiWorkReport] = useState<LiveAiWorkReport | null>(null);
  const defaultTeamTemplateId = snapshot.teamTemplates[0]?.id ?? "";
  const dataModeBadgeClassName =
    snapshot.dataMode === "local" ? styles.dataModeBadgeLocal : styles.dataModeBadgeDemo;
  const projectProfileByProjectId = useMemo(
    () => new Map(snapshot.projectProfiles.map((profile) => [profile.projectId, profile])),
    [snapshot.projectProfiles]
  );
  const agentById = new Map(snapshot.agents.map((agent) => [agent.id, agent]));

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

  useEffect(() => {
    return () => {
      if (actionFeedbackTimerRef.current !== null) {
        window.clearTimeout(actionFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!defaultTeamTemplateId) {
      return;
    }

    setCreateProjectDraft((current) =>
      current.teamTemplateId
        ? current
        : {
            ...current,
            teamTemplateId: defaultTeamTemplateId
          }
    );
  }, [defaultTeamTemplateId]);

  const visibleProjectIds = useMemo(
    () => new Set(snapshot.projects.filter((project) => !deletedProjectIds.includes(project.id)).map((project) => project.id)),
    [deletedProjectIds, snapshot.projects]
  );

  const projectPortfolio = useMemo(
    () =>
      snapshot.projects
        .filter((project) => !deletedProjectIds.includes(project.id))
        .map((project) => {
          const workflowState = getWorkflowState(snapshot, project.id);
          const blockers = workflowState?.blockers ?? [];
          const mergedProject = {
            ...project,
            ...projectOverrides[project.id]
          };
          const health = getProjectHealth(mergedProject, blockers);

          return {
            id: mergedProject.id,
            name: mergedProject.name,
            stage: workflowState?.currentStage ?? "待定义",
            stageLabel: formatWorkflowStageLabel(workflowState?.currentStage),
            progress: mergedProject.progress,
            health,
            healthTone: getHealthTone(health),
            owner: mergedProject.owner,
            partnerName: mergedProject.enterpriseName?.trim() || mergedProject.sector,
            sector: mergedProject.sector,
            requirement: mergedProject.requirement?.trim() || "",
            projectType: mergedProject.projectType?.trim() || "",
            deliveryDate: mergedProject.deliveryDate?.trim() || "",
            note: mergedProject.note?.trim() || "",
            nextMilestone: getNextMilestone(workflowState?.currentStage),
            abnormal: blockers.length > 0,
            updatedAt: workflowState?.lastTransitionAt ?? mergedProject.lastRun,
            blockers,
            riskNote: mergedProject.riskNote
          };
        })
        .sort((left, right) => compareProjectRows(left, right, "risk")),
    [deletedProjectIds, projectOverrides, snapshot]
  );

  const portfolioRows = projectPortfolio;

  const pendingItems = useMemo(
    () =>
      snapshot.tasks
        .filter((task) => visibleProjectIds.has(task.projectId) && task.status !== "done")
        .sort((left, right) => getTaskSortWeight(left) - getTaskSortWeight(right))
        .map((task) => {
          const project = snapshot.projects.find((item) => item.id === task.projectId);
          const owner = agentById.get(task.ownerAgentId);
          const blockerOwner = owner
            ? getForgeAgentDisplayLabel(owner)
            : task.ownerAgentId;
          const workflowState = getWorkflowState(snapshot, task.projectId);

          return {
            id: task.id,
            projectId: task.projectId,
            title: task.title,
            projectName: project?.name ?? "未绑定项目",
            stage: task.stage,
            blockerOwner,
            blockerRole: owner ? getRoleLabel(owner.role) : "待确认",
            priority: task.priority,
            status: task.status,
            summary: task.summary,
            blockers: workflowState?.blockers ?? [],
            nextStep: getTaskNextStep(task.status, blockerOwner),
            sourceNode: getTaskSourceNode(owner?.role)
          };
        }),
    [agentById, snapshot, visibleProjectIds]
  );

  const completedItems = useMemo(
    () =>
      snapshot.tasks
        .filter((task) => visibleProjectIds.has(task.projectId) && task.status === "done")
        .sort((left, right) => getTaskSortWeight(left) - getTaskSortWeight(right))
        .map((task) => {
          const project = snapshot.projects.find((item) => item.id === task.projectId);
          const owner = agentById.get(task.ownerAgentId);
          const blockerOwner = owner
            ? getForgeAgentDisplayLabel(owner)
            : task.ownerAgentId;

          return {
            id: task.id,
            projectId: task.projectId,
            title: task.title,
            projectName: project?.name ?? "未绑定项目",
            stage: task.stage,
            blockerOwner,
            blockerRole: owner ? getRoleLabel(owner.role) : "待确认",
            priority: task.priority,
            status: task.status,
            summary: task.summary,
            blockers: [],
            nextStep: "当前事项已完成，可切换到下一个阶段继续推进。",
            sourceNode: "已完成" as const
          };
        }),
    [agentById, snapshot, visibleProjectIds]
  );

  const [selectedSourceNode, setSelectedSourceNode] = useState<SourceNode | null>(null);
  const workbenchItems = [...pendingItems, ...completedItems];

  const sourceCounts = useMemo(
    () =>
      sourceNodes.map((node) => ({
        node,
        count: new Set(workbenchItems.filter((item) => item.sourceNode === node).map((item) => item.projectId)).size
      })),
    [workbenchItems]
  );

  const allProjectRows = useMemo(
    () =>
      portfolioRows
        .map((project) => {
          const relatedItems = workbenchItems.filter((item) => item.projectId === project.id);
          const workflowSourceNode = getWorkflowSourceNode(project.stage);

          const leadItem = relatedItems[0] ?? null;
          const isCompleted = isCompletedProjectStage(project.stage) || project.progress >= 100;
          const currentBlocker = isCompleted
            ? "项目已完成，无需继续推进"
            : leadItem?.blockers[0] ?? project.blockers[0] ?? "当前没有明显卡点";
          const nextAction = isCompleted
            ? "项目已完成并沉淀归档。"
            : leadItem?.nextStep ?? `继续推进 ${project.nextMilestone}`;
          const deliveryTime =
            normalizeExplicitDeliveryDate(project.deliveryDate) ||
            getDeliveryDateLabel(formatTimestamp(project.updatedAt || "待定"));

          return {
            ...project,
            relatedItems,
            currentBlocker,
            nextAction,
            planTitle: isCompleted ? "已完成该项目并沉淀归档" : leadItem?.title ?? project.nextMilestone,
            deliveryTime,
            workflowSourceNode
          };
        })
        .filter((project): project is NonNullable<typeof project> => Boolean(project)),
    [portfolioRows, workbenchItems]
  );

  const sourceProjectRows = useMemo(
    () =>
      allProjectRows.filter((project) =>
        selectedSourceNode == null
          ? true
          : project.relatedItems.some((item) => item.sourceNode === selectedSourceNode) ||
            project.workflowSourceNode === selectedSourceNode
      ),
    [allProjectRows, selectedSourceNode]
  );

  const keywordMatchedProjectRows = useMemo(() => {
    const keyword = projectSearch.trim().toLowerCase();
    return !keyword
      ? sourceProjectRows
      : sourceProjectRows.filter((project) =>
          [project.partnerName, project.name, project.stage, project.owner, project.planTitle]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        );
  }, [projectSearch, sourceProjectRows]);

  const completedProjectCount = keywordMatchedProjectRows.filter((project) =>
    isCompletedProjectStage(project.stage)
  ).length;
  const inProgressProjectCount = keywordMatchedProjectRows.length - completedProjectCount;

  const searchedProjectRows = useMemo(() => {
    const progressFilteredRows = keywordMatchedProjectRows.filter((project) => {
      if (projectProgressFilter === "completed") {
        return isCompletedProjectStage(project.stage);
      }

      if (projectProgressFilter === "in-progress") {
        return !isCompletedProjectStage(project.stage);
      }

      return true;
    });

    return [...progressFilteredRows].sort((left, right) => compareProjectRows(left, right, projectSortRule));
  }, [keywordMatchedProjectRows, projectProgressFilter, projectSortRule]);

  const selectedProject =
    allProjectRows.find((project) => project.id === selectedProjectId) ?? allProjectRows[0] ?? null;

  const personalActionItems = useMemo(
    () =>
      allProjectRows
        .map((project) => {
          const leadItem = project.relatedItems[0] ?? null;

          if (project.abnormal) {
            if (project.stage === "测试验证") {
              return {
                id: `${project.id}-material`,
                projectId: project.id,
                projectName: project.name,
                kind: "待补料" as const,
                summary: project.currentBlocker,
                targetNode: getWorkbenchNodeFromStage(project.stage),
                nextStep: "先补齐测试材料，再决定是否继续回归。"
              };
            }

            if (project.stage === "交付发布") {
              return {
                id: `${project.id}-release`,
                projectId: project.id,
                projectName: project.name,
                kind: "待放行" as const,
                summary: project.currentBlocker,
                targetNode: getWorkbenchNodeFromStage(project.stage),
                nextStep: "先确认交付说明和验收口径，再决定是否发布。"
              };
            }

            return {
              id: `${project.id}-handoff`,
              projectId: project.id,
              projectName: project.name,
              kind: "待接管" as const,
              summary: project.currentBlocker,
              targetNode: getWorkbenchNodeFromStage(project.stage),
              nextStep: `确认是否改由 ${leadItem?.blockerOwner ?? project.owner} 接手当前卡点。`
            };
          }

          if (project.stage === "方案与任务包" || leadItem?.status === "todo") {
            return {
              id: `${project.id}-confirm`,
              projectId: project.id,
              projectName: project.name,
              kind: "待确认" as const,
              summary: leadItem?.summary ?? project.planTitle,
              targetNode: getWorkbenchNodeFromStage(project.stage),
              nextStep: "先确认方案边界和交接口径，再继续推进。"
            };
          }

          if (project.stage === "交付发布" || project.progress >= 85) {
            return {
              id: `${project.id}-ready`,
              projectId: project.id,
              projectName: project.name,
              kind: "待放行" as const,
              summary: project.planTitle,
              targetNode: getWorkbenchNodeFromStage(project.stage),
              nextStep: "确认交付包齐备后，可直接进入发布。"
            };
          }

          return null;
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort((left, right) => getActionRank(left.kind) - getActionRank(right.kind))
        .slice(0, 3),
    [allProjectRows]
  );

  const aiWorkReports = useMemo(() => {
    if (personalActionItems.length === 0) {
      return [];
    }

    const introTemplates = [
      (projectName: string, summary: string) => `${projectName} 当前重点：${summary}。`,
      (projectName: string, summary: string) => `${projectName} 当前需要先处理：${summary}。`,
      (projectName: string, summary: string) => `${projectName} 下一步建议优先推进：${summary}。`
    ];
    return personalActionItems.map((item, index) => ({
      ...item,
      reportIntro: introTemplates[index % introTemplates.length](
        item.projectName,
        item.summary
      )
    }));
  }, [personalActionItems]);

  const selectedSourceSummaryLabel = selectedSourceNode ?? "全部来源";

  const handleRefreshAiReport = async () => {
    if (allProjectRows.length === 0) {
      showActionFeedback("当前没有可用于刷新汇报的项目", "warn");
      return;
    }

    setIsRefreshingAiReport(true);

    try {
      const response = await fetch("/api/forge/ai-work-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          scope: "portfolio",
          triggeredBy: "Forge Home · AI工作汇报"
        })
      });
      const payload = (await response.json()) as
        | {
            ok: true;
            data?: {
              projectId: string;
              projectName: string;
              stage?: string | null;
              summary?: string | null;
              report?: string | null;
            };
          }
        | { ok: false; error?: { message?: string } };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.ok ? "NanoClaw 工作汇报刷新失败" : payload.error?.message || "NanoClaw 工作汇报刷新失败");
      }

      const nextReport = payload.data?.report?.trim() || "";
      const nextSummary = payload.data?.summary?.trim() || "NanoClaw 工作汇报已刷新";

      setLiveAiWorkReport({
        projectId: payload.data?.projectId || "portfolio",
        projectName: payload.data?.projectName || "全部项目",
        stage: payload.data?.stage?.trim() || null,
        summary: nextSummary,
        report: nextReport || nextSummary
      });
      dispatchForgePageContractRefresh(["home"]);
      showActionFeedback(nextSummary, "info");
    } catch (error) {
      showActionFeedback(error instanceof Error ? error.message : "NanoClaw 工作汇报刷新失败", "warn");
    } finally {
      setIsRefreshingAiReport(false);
    }
  };

  const handleCreateProject = async () => {
    if (!createWorkbenchProject) {
      router.push("/projects");
      return;
    }

    const draft = {
      requirement: createProjectDraft.requirement.trim(),
      enterpriseName: createProjectDraft.enterpriseName.trim(),
      name: createProjectDraft.name.trim(),
      sector: createProjectDraft.sector.trim(),
      projectType: createProjectDraft.projectType.trim(),
      teamTemplateId: createProjectDraft.teamTemplateId.trim(),
      owner: createProjectDraft.owner.trim(),
      deliveryDate: createProjectDraft.deliveryDate.trim(),
      note: createProjectDraft.note.trim()
    };

    if (
      !draft.requirement ||
      !draft.enterpriseName ||
      !draft.name ||
      !draft.sector ||
      !draft.projectType ||
      !draft.teamTemplateId ||
      !draft.owner ||
      !draft.deliveryDate
    ) {
      showActionFeedback("请先补全项目信息", "warn");
      return;
    }

    setIsCreatingProject(true);

    try {
      const result = await createWorkbenchProject(draft);
      setIsCreateProjectOpen(false);
      setCreateProjectDraft(createEmptyProjectDraft());
      dispatchForgePageContractRefresh([
        "home",
        "projects",
        "team",
        "artifacts",
        "assets",
        "execution",
        "governance"
      ]);
      showActionFeedback("已创建项目，正在进入项目管理", "success");
      router.push(`/projects?projectId=${encodeURIComponent(result.activeProjectId)}`);
    } catch (error) {
      showActionFeedback(error instanceof Error ? error.message : "创建项目失败", "warn");
    } finally {
      setIsCreatingProject(false);
    }
  };

  const openEditProjectDialog = (projectId: string) => {
    const project = allProjectRows.find((item) => item.id === projectId);

    if (!project) {
      return;
    }

    setEditingProjectId(projectId);
    setIsDeleteProjectConfirmOpen(false);
    const projectProfile = projectProfileByProjectId.get(projectId);
    setEditProjectDraft({
      requirement: project.requirement,
      enterpriseName: project.partnerName,
      name: project.name,
      sector: project.sector,
      projectType: project.projectType,
      teamTemplateId: projectProfile?.teamTemplateId ?? defaultTeamTemplateId,
      owner: project.owner,
      deliveryDate: project.deliveryDate,
      note: project.note
    });
    setIsEditProjectOpen(true);
  };

  const handleUpdateProject = async () => {
    if (!updateWorkbenchProject || !editingProjectId) {
      setIsEditProjectOpen(false);
      return;
    }

    const draft = {
      requirement: editProjectDraft.requirement.trim(),
      enterpriseName: editProjectDraft.enterpriseName.trim(),
      name: editProjectDraft.name.trim(),
      sector: editProjectDraft.sector.trim(),
      projectType: editProjectDraft.projectType.trim(),
      teamTemplateId: editProjectDraft.teamTemplateId.trim(),
      owner: editProjectDraft.owner.trim(),
      deliveryDate: editProjectDraft.deliveryDate.trim(),
      note: editProjectDraft.note.trim()
    };

    if (
      !draft.requirement ||
      !draft.enterpriseName ||
      !draft.name ||
      !draft.sector ||
      !draft.projectType ||
      !draft.teamTemplateId ||
      !draft.owner ||
      !draft.deliveryDate
    ) {
      showActionFeedback("请先补全项目信息", "warn");
      return;
    }

    setIsUpdatingProject(true);

    try {
      await updateWorkbenchProject({
        projectId: editingProjectId,
        ...draft
      });
      setProjectOverrides((current) => ({
        ...current,
        [editingProjectId]: draft
      }));
      setIsEditProjectOpen(false);
      setEditingProjectId(null);
      setEditProjectDraft(createEmptyProjectDraft());
      dispatchForgePageContractRefresh([
        "home",
        "projects",
        "team",
        "artifacts",
        "assets",
        "execution",
        "governance"
      ]);
      showActionFeedback("已更新项目信息", "success");
    } catch (error) {
      showActionFeedback(error instanceof Error ? error.message : "更新项目信息失败", "warn");
    } finally {
      setIsUpdatingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteWorkbenchProject || !editingProjectId || isDeletingProject) {
      return;
    }

    setIsDeletingProject(true);

    try {
      const result = await deleteWorkbenchProject(editingProjectId);
      setDeletedProjectIds((current) =>
        current.includes(result.deletedProjectId) ? current : [...current, result.deletedProjectId]
      );
      setProjectOverrides((current) => {
        const next = { ...current };
        delete next[result.deletedProjectId];
        return next;
      });
      setSelectedProjectId(result.activeProjectId);
      setIsDeleteProjectConfirmOpen(false);
      setIsEditProjectOpen(false);
      setEditingProjectId(null);
      setEditProjectDraft(createEmptyProjectDraft());
      dispatchForgePageContractRefresh([
        "home",
        "projects",
        "team",
        "artifacts",
        "assets",
        "execution",
        "governance"
      ]);
      showActionFeedback("已删除项目", "success");
    } catch (error) {
      showActionFeedback(error instanceof Error ? error.message : "删除项目失败", "warn");
    } finally {
      setIsDeletingProject(false);
    }
  };

  return (
    <ForgeConsoleShell
      activeView="home"
      breadcrumb={["控制台", "仪表盘"]}
      contentLayout="full-bleed"
      hideHeader
      showNavigation={showNavigation}
      sidebarSections={[
        {
          label: "事项来源",
          items: sourceCounts.map((item) => ({
            title: item.node,
            badge: String(item.count),
            tone: item.node === selectedSourceNode ? "info" : item.count > 0 ? "warn" : "neutral",
            active: item.node === selectedSourceNode,
            onSelect: () =>
              setSelectedSourceNode((currentNode) => (currentNode === item.node ? null : item.node))
          }))
        }
      ]}
      sidebarTitle="Forge"
    >
      <div className={styles.dashboardCanvas}>
        <section className={styles.dashboardGrid}>
          <div className={styles.leftStack}>
            <section
              aria-label="项目操盘台"
              className={`${shellStyles.card} ${styles.projectDeskPanel}`}
              role="region"
            >
              <div className={shellStyles.cardHeader}>
                <div>
                  <div className={styles.sectionHeadingRow}>
                    <h2>项目总览</h2>
                    {snapshot.dataModeLabel ? (
                      <span className={`${styles.dataModeBadge} ${dataModeBadgeClassName}`}>
                        {snapshot.dataModeLabel}
                      </span>
                    ) : null}
                  </div>
                  {snapshot.dataModeSummary ? (
                    <p className={styles.sectionSubheading}>{snapshot.dataModeSummary}</p>
                  ) : null}
                </div>
                <div className={styles.cardActions}>
                  <label className={styles.searchField}>
                    <span className={styles.searchIcon} aria-hidden="true">
                      ⌕
                    </span>
                    <input
                      aria-label="搜索项目"
                      onChange={(event) => setProjectSearch(event.target.value)}
                      placeholder="搜索项目"
                      type="search"
                      value={projectSearch}
                    />
                  </label>
                  <label className={styles.sortField}>
                    <span className={styles.sortLabel}>排序</span>
                    <select
                      aria-label="排序规则"
                      onChange={(event) => setProjectSortRule(event.target.value as ProjectSortRule)}
                      value={projectSortRule}
                    >
                      {projectSortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    aria-label="刷新项目"
                    className={styles.iconAction}
                    onClick={() => {
                      setSelectedProjectId(searchedProjectRows[0]?.id ?? allProjectRows[0]?.id ?? null);
                      showActionFeedback("项目列表已刷新", "info");
                    }}
                    type="button"
                  >
                    ↻
                  </button>
                  {createWorkbenchProject ? (
                    <button
                      className={shellStyles.primaryButton}
                      onClick={() => setIsCreateProjectOpen(true)}
                      type="button"
                    >
                      新建项目
                    </button>
                  ) : (
                    <Link className={shellStyles.primaryButton} href="/projects">
                      新建项目
                    </Link>
                  )}
                </div>
              </div>

              <div className={styles.summaryRow}>
                <p className={styles.summaryLabel}>
                  当前视角：
                  <strong>{selectedSourceSummaryLabel}</strong>
                </p>
                <div className={styles.summaryChips}>
                  <button
                    aria-pressed={projectProgressFilter === "in-progress"}
                    className={`${styles.summaryChip} ${styles.summaryChipAction} ${
                      projectProgressFilter === "in-progress"
                        ? styles.summaryChipInProgressActive
                        : styles.summaryChipInProgress
                    }`}
                    onClick={() =>
                      setProjectProgressFilter((current) =>
                        current === "in-progress" ? "all" : "in-progress"
                      )
                    }
                    type="button"
                  >
                    进行中 {inProgressProjectCount}
                  </button>
                  <button
                    aria-pressed={projectProgressFilter === "completed"}
                    className={`${styles.summaryChip} ${styles.summaryChipAction} ${
                      projectProgressFilter === "completed"
                        ? styles.summaryChipDoneActive
                        : styles.summaryChipDone
                    }`}
                    onClick={() =>
                      setProjectProgressFilter((current) =>
                        current === "completed" ? "all" : "completed"
                      )
                    }
                    type="button"
                  >
                    已完成 {completedProjectCount}
                  </button>
                </div>
              </div>

              <div className={styles.projectTableWrap}>
                {searchedProjectRows.length > 0 ? (
                  <table className={styles.projectOpsTable}>
                    <colgroup>
                      <col className={styles.colPartner} />
                      <col className={styles.colName} />
                      <col className={styles.colStage} />
                      <col className={styles.colPlan} />
                      <col className={styles.colDelivery} />
                      <col className={styles.colEdit} />
                    </colgroup>
                    <thead>
                      <tr className={styles.projectOpsHead}>
                        <th scope="col">合作企业</th>
                        <th scope="col">项目名</th>
                        <th scope="col">阶段</th>
                        <th scope="col">计划</th>
                        <th scope="col">交付时间</th>
                        <th scope="col">编辑</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchedProjectRows.map((project) => {
                        const isActive = selectedProject?.id === project.id;

                        return (
                          <tr
                            aria-selected={isActive}
                            className={`${styles.projectOpsRow} ${isActive ? styles.projectOpsRowActive : ""}`}
                            key={project.id}
                            onClick={() => setSelectedProjectId(project.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedProjectId(project.id);
                              }
                            }}
                            tabIndex={0}
                          >
                            <td className={styles.projectOpsPartner}>
                              <strong>{project.partnerName}</strong>
                              <small className={styles.inlineMeta}>{project.sector}</small>
                            </td>
                            <td className={styles.projectOpsName}>
                              <strong>
                                <Link
                                  className={styles.projectNameLink}
                                  href={buildProjectWorkbenchHref(project.id, project.stage)}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {project.name}
                                </Link>
                              </strong>
                              <div className={styles.nameMetaRow}>
                                <small className={styles.inlineMeta}>{project.owner}</small>
                                {project.projectType ? (
                                  <small className={styles.inlineMeta}>{project.projectType}</small>
                                ) : null}
                                <span className={getToneBadgeClassName(project.healthTone)}>
                                  {project.health}
                                </span>
                              </div>
                            </td>
                            <td className={styles.projectOpsStage}>
                              {isCompletedProjectStage(project.stage) || project.progress >= 100 ? (
                                <>
                                  <span className={`${styles.stageBadge} ${styles.stageBadgeDone}`}>
                                    {project.stageLabel}
                                  </span>
                                </>
                              ) : (
                                <span
                                  className={`${styles.stageBadge} ${
                                    isCompletedProjectStage(project.stage)
                                      ? styles.stageBadgeDone
                                      : project.abnormal
                                        ? styles.stageBadgeRisk
                                        : styles.stageBadgeStable
                                  }`}
                                >
                                  {project.stageLabel}
                                </span>
                              )}
                            </td>
                            <td className={styles.projectOpsPlan}>
                              <strong>{project.planTitle}</strong>
                            </td>
                            <td className={styles.projectOpsDelivery}>
                              <strong>{project.deliveryTime}</strong>
                            </td>
                            <td className={styles.projectOpsEdit} onClick={(event) => event.stopPropagation()}>
                              <button
                                aria-label={`编辑 ${project.name}`}
                                className={styles.iconAction}
                                onClick={() => openEditProjectDialog(project.id)}
                                title={`编辑 ${project.name}`}
                                type="button"
                              >
                                ✎
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className={shellStyles.cardSoft}>
                    <p className={shellStyles.muted}>当前来源阶段还没有可展示的项目。</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside
            aria-label="项目动态"
            className={`${shellStyles.card} ${styles.actionPanel}`}
            role="region"
          >
            <div className={shellStyles.cardHeader}>
              <div>
                <h2>项目动态</h2>
              </div>
              {enableLiveAiWorkReport ? (
                <button
                  className={shellStyles.secondaryButton}
                  disabled={isRefreshingAiReport}
                  onClick={() => {
                    void handleRefreshAiReport();
                  }}
                  type="button"
                >
                  {isRefreshingAiReport ? "刷新中..." : "刷新汇报"}
                </button>
              ) : null}
            </div>

            <div className={shellStyles.denseList}>
              {enableLiveAiWorkReport && liveAiWorkReport ? (
                <article className={shellStyles.denseListItem}>
                  <div className={shellStyles.denseListHead}>
                    <strong>{liveAiWorkReport.projectName}</strong>
                    <span className={getToneBadgeClassName("info")}>实时汇报</span>
                  </div>
                  <p className={styles.reportBody}>{liveAiWorkReport.report}</p>
                  <div className={styles.actionFooter}>
                    <span className={styles.actionMeta}>
                      {isPortfolioAiWorkReport(liveAiWorkReport)
                        ? "建议进入项目管理查看项目组合"
                        : `建议进入 ${getWorkbenchNodeFromStage(liveAiWorkReport.stage)}`}
                    </span>
                    {isPortfolioAiWorkReport(liveAiWorkReport) ? (
                      <Link
                        aria-label="进入项目管理"
                        className={`${shellStyles.secondaryButton} ${styles.actionLink}`}
                        href="/projects"
                      >
                        进入项目管理
                      </Link>
                    ) : (
                      <Link
                        aria-label={`进入 ${liveAiWorkReport.projectName} 项目工作台`}
                        className={`${shellStyles.secondaryButton} ${styles.actionLink}`}
                        href={buildProjectWorkbenchHref(
                          liveAiWorkReport.projectId,
                          liveAiWorkReport.stage
                        )}
                      >
                        进入项目工作台
                      </Link>
                    )}
                  </div>
                </article>
              ) : aiWorkReports.length > 0 ? (
                aiWorkReports.map((item) => (
                  <article className={shellStyles.denseListItem} key={item.id}>
                    <div className={shellStyles.denseListHead}>
                      <strong>{item.projectName}</strong>
                      <span className={getToneBadgeClassName("warn")}>{item.kind}</span>
                    </div>
                    <p>{item.reportIntro}</p>
                    <p className={styles.nextAction}>{item.nextStep}</p>
                    <div className={styles.actionFooter}>
                      <span className={styles.actionMeta}>建议进入 {item.targetNode}</span>
                      <Link
                        aria-label={`进入 ${item.projectName} 项目工作台`}
                        className={`${shellStyles.secondaryButton} ${styles.actionLink}`}
                        href={buildProjectWorkbenchHref(item.projectId, item.targetNode)}
                      >
                        进入项目工作台
                      </Link>
                    </div>
                  </article>
                ))
              ) : (
                <div className={shellStyles.cardSoft}>
                  <p className={shellStyles.muted}>当前没有新的项目动态。</p>
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
      {isCreateProjectOpen ? (
        <ForgeEditDialog
          ariaLabel="新建项目"
          dialogClassName={styles.projectDialog}
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
          <div className={`${styles.actionDialogBody} ${styles.dialogGrid}`}>
            <label className={`${styles.dialogField} ${styles.dialogFieldWide}`}>
              <span>客户需求</span>
              <textarea
                aria-label="客户需求"
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
              <span>企业名称</span>
              <input
                aria-label="企业名称"
                className={styles.dialogInput}
                onChange={(event) =>
                  setCreateProjectDraft((current) => ({
                    ...current,
                    enterpriseName: event.target.value
                  }))
                }
                placeholder="例如：示例企业"
                type="text"
                value={createProjectDraft.enterpriseName}
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
              <span>所属行业</span>
              <input
                aria-label="所属行业"
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
              <span>项目类型</span>
              <input
                aria-label="项目类型"
                className={styles.dialogInput}
                onChange={(event) =>
                  setCreateProjectDraft((current) => ({
                    ...current,
                    projectType: event.target.value
                  }))
                }
                placeholder="例如：智能助手"
                type="text"
                value={createProjectDraft.projectType}
              />
            </label>
            <label className={styles.dialogField}>
              <span>AI团队</span>
              <select
                aria-label="AI团队"
                className={styles.dialogSelect}
                onChange={(event) =>
                  setCreateProjectDraft((current) => ({
                    ...current,
                    teamTemplateId: event.target.value
                  }))
                }
                value={createProjectDraft.teamTemplateId}
              >
                {snapshot.teamTemplates.length === 0 ? (
                  <option value="">暂无可选团队</option>
                ) : null}
                {snapshot.teamTemplates.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
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
            <label className={styles.dialogField}>
              <span>交付时间</span>
              <input
                aria-label="交付时间"
                className={styles.dialogInput}
                onChange={(event) =>
                  setCreateProjectDraft((current) => ({
                    ...current,
                    deliveryDate: event.target.value
                  }))
                }
                type="date"
                value={createProjectDraft.deliveryDate}
              />
            </label>
            <label className={`${styles.dialogField} ${styles.dialogFieldWide}`}>
              <span>备注</span>
              <textarea
                aria-label="备注"
                className={styles.dialogTextarea}
                onChange={(event) =>
                  setCreateProjectDraft((current) => ({
                    ...current,
                    note: event.target.value
                  }))
                }
                placeholder="例如：优先展示知识检索、工单流转和交付闭环。"
                rows={4}
                value={createProjectDraft.note}
              />
            </label>
          </div>
        </ForgeEditDialog>
      ) : null}
      {isEditProjectOpen ? (
        <ForgeEditDialog
          ariaLabel="编辑项目"
          dialogClassName={styles.projectDialog}
          eyebrow="项目管理"
          onClose={() => {
            setIsEditProjectOpen(false);
            setIsDeleteProjectConfirmOpen(false);
            setEditingProjectId(null);
            setEditProjectDraft(createEmptyProjectDraft());
          }}
          title="编辑项目"
          footer={
            <>
              {deleteWorkbenchProject ? (
                <button
                  className={styles.destructiveButton}
                  onClick={() => setIsDeleteProjectConfirmOpen(true)}
                  type="button"
                >
                  删除项目
                </button>
              ) : null}
              <button
                className={shellStyles.secondaryButton}
                onClick={() => {
                  setIsEditProjectOpen(false);
                  setIsDeleteProjectConfirmOpen(false);
                  setEditingProjectId(null);
                  setEditProjectDraft(createEmptyProjectDraft());
                }}
                type="button"
              >
                取消
              </button>
              <button
                className={shellStyles.primaryButton}
                disabled={isUpdatingProject}
                onClick={handleUpdateProject}
                type="button"
              >
                {isUpdatingProject ? "保存中..." : "保存项目"}
              </button>
            </>
          }
        >
          <div className={`${styles.actionDialogBody} ${styles.dialogGrid}`}>
            <div className={`${styles.dialogHint} ${styles.dialogFieldWide}`}>
              更新后会真实写回项目档案，并同步刷新项目管理页。
            </div>
            <label className={`${styles.dialogField} ${styles.dialogFieldWide}`}>
              <span>客户需求</span>
              <textarea
                aria-label="客户需求"
                className={styles.dialogTextarea}
                onChange={(event) =>
                  setEditProjectDraft((current) => ({
                    ...current,
                    requirement: event.target.value
                  }))
                }
                rows={5}
                value={editProjectDraft.requirement}
              />
            </label>
            <label className={styles.dialogField}>
              <span>企业名称</span>
              <input
                aria-label="企业名称"
                className={styles.dialogInput}
                onChange={(event) =>
                  setEditProjectDraft((current) => ({
                    ...current,
                    enterpriseName: event.target.value
                  }))
                }
                type="text"
                value={editProjectDraft.enterpriseName}
              />
            </label>
            <label className={styles.dialogField}>
              <span>项目名称</span>
              <input
                aria-label="项目名称"
                className={styles.dialogInput}
                onChange={(event) =>
                  setEditProjectDraft((current) => ({
                    ...current,
                    name: event.target.value
                  }))
                }
                type="text"
                value={editProjectDraft.name}
              />
            </label>
            <label className={styles.dialogField}>
              <span>所属行业</span>
              <input
                aria-label="所属行业"
                className={styles.dialogInput}
                onChange={(event) =>
                  setEditProjectDraft((current) => ({
                    ...current,
                    sector: event.target.value
                  }))
                }
                type="text"
                value={editProjectDraft.sector}
              />
            </label>
            <label className={styles.dialogField}>
              <span>项目类型</span>
              <input
                aria-label="项目类型"
                className={styles.dialogInput}
                onChange={(event) =>
                  setEditProjectDraft((current) => ({
                    ...current,
                    projectType: event.target.value
                  }))
                }
                type="text"
                value={editProjectDraft.projectType}
              />
            </label>
            <label className={styles.dialogField}>
              <span>AI团队</span>
              <select
                aria-label="AI团队"
                className={styles.dialogSelect}
                onChange={(event) =>
                  setEditProjectDraft((current) => ({
                    ...current,
                    teamTemplateId: event.target.value
                  }))
                }
                value={editProjectDraft.teamTemplateId}
              >
                {snapshot.teamTemplates.length === 0 ? (
                  <option value="">暂无可选团队</option>
                ) : null}
                {snapshot.teamTemplates.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.dialogField}>
              <span>负责人</span>
              <input
                aria-label="负责人"
                className={styles.dialogInput}
                onChange={(event) =>
                  setEditProjectDraft((current) => ({
                    ...current,
                    owner: event.target.value
                  }))
                }
                type="text"
                value={editProjectDraft.owner}
              />
            </label>
            <label className={styles.dialogField}>
              <span>交付时间</span>
              <input
                aria-label="交付时间"
                className={styles.dialogInput}
                onChange={(event) =>
                  setEditProjectDraft((current) => ({
                    ...current,
                    deliveryDate: event.target.value
                  }))
                }
                type="date"
                value={editProjectDraft.deliveryDate}
              />
            </label>
            <label className={`${styles.dialogField} ${styles.dialogFieldWide}`}>
              <span>备注</span>
              <textarea
                aria-label="备注"
                className={styles.dialogTextarea}
                onChange={(event) =>
                  setEditProjectDraft((current) => ({
                    ...current,
                    note: event.target.value
                  }))
                }
                rows={4}
                value={editProjectDraft.note}
              />
            </label>
          </div>
        </ForgeEditDialog>
      ) : null}
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
        confirmButtonClassName={styles.destructiveButton}
        confirmLabel={isDeletingProject ? "删除中..." : "确认删除"}
        description="删除后会同步移除项目档案、工作流记录和项目工作台内容。"
        label="确认删除项目"
        onCancel={() => {
          if (isDeletingProject) {
            return;
          }

          setIsDeleteProjectConfirmOpen(false);
        }}
        onConfirm={handleDeleteProject}
        open={isDeleteProjectConfirmOpen}
        title="确认删除项目"
      />
    </ForgeConsoleShell>
  );
}
