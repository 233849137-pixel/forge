import type {
  ForgeAgent,
  ForgeDashboardSnapshot,
  ForgeProject,
  ForgeRun,
  ForgeTask,
  ForgeWorkflowStage
} from "../../packages/core/src/types";

export type Tone = "neutral" | "good" | "warn" | "risk" | "info";

type ActiveProjectSnapshot = Pick<ForgeDashboardSnapshot, "activeProjectId" | "projects">;
type WorkflowStateSnapshot = Pick<ForgeDashboardSnapshot, "workflowStates">;
type TaskSnapshot = Pick<ForgeDashboardSnapshot, "tasks">;
type ArtifactSnapshot = Pick<ForgeDashboardSnapshot, "artifacts">;

export function getActiveProject(snapshot: ActiveProjectSnapshot) {
  return (
    snapshot.projects.find((project) => project.id === snapshot.activeProjectId) ??
    snapshot.projects[0] ??
    null
  );
}

export function getWorkflowState(
  snapshot: WorkflowStateSnapshot,
  projectId: string | null | undefined
) {
  if (!projectId) {
    return null;
  }

  return snapshot.workflowStates.find((item) => item.projectId === projectId) ?? null;
}

export function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "刚刚";
  }

  if (value.includes("T")) {
    return value.replace("T", " ").slice(0, 16);
  }

  return value;
}

export function getRelativeTimeSortValue(value: string | null | undefined, referenceDate?: Date) {
  if (!value) {
    return 0;
  }

  const now = referenceDate ?? new Date();
  const normalizedValue = value.trim();

  if (normalizedValue === "刚刚") {
    return 4_000_000_000_000;
  }

  const todayMatch = normalizedValue.match(/^今天\s+(\d{1,2}):(\d{2})$/);
  if (todayMatch) {
    const [, hour, minute] = todayMatch;
    return 3_000_000_000_000 + Number(hour) * 60 + Number(minute);
  }

  const minutesAgoMatch = normalizedValue.match(/^(\d+)\s*分钟前$/);
  if (minutesAgoMatch) {
    return 2_000_000_000_000 - Number(minutesAgoMatch[1]);
  }

  const hoursAgoMatch = normalizedValue.match(/^(\d+)\s*小时前$/);
  if (hoursAgoMatch) {
    return 1_500_000_000_000 - Number(hoursAgoMatch[1]) * 60;
  }

  if (normalizedValue.startsWith("昨天")) {
    return 1_000_000_000_000;
  }

  if (normalizedValue.includes("T")) {
    const isoTime = Date.parse(normalizedValue);
    return Number.isNaN(isoTime) ? 0 : isoTime;
  }

  const explicitDateMatch = normalizedValue.match(/(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (explicitDateMatch) {
    const [, datePart, hour = "00", minute = "00"] = explicitDateMatch;
    const explicitDate = Date.parse(`${datePart}T${hour}:${minute}:00+08:00`);
    return Number.isNaN(explicitDate) ? 0 : explicitDate;
  }

  if (normalizedValue.includes("今天")) {
    return 3_000_000_000_000 + now.getHours() * 60 + now.getMinutes();
  }

  return 0;
}

export function getNextMilestone(stage: ForgeWorkflowStage | string | null | undefined) {
  const milestones: Record<ForgeWorkflowStage, string> = {
    项目接入: "确认项目范围",
    方案与任务包: "锁定任务包",
    开发执行: "完成本轮执行",
    测试验证: "推进门禁转绿",
    交付发布: "整理放行摘要",
    归档复用: "项目已完成"
  };

  if (!stage || !(stage in milestones)) {
    return "继续推进当前阶段";
  }

  return milestones[stage as ForgeWorkflowStage];
}

export function formatWorkflowStageLabel(stage: ForgeWorkflowStage | string | null | undefined) {
  if (!stage) {
    return "待定义";
  }

  return stage === "归档复用" ? "已完成" : stage;
}

export function getProjectHealth(project: ForgeProject, blockers: string[]) {
  if (project.status === "risk" || blockers.length > 0) {
    return "风险";
  }

  if (project.progress < 75) {
    return "关注";
  }

  return "正常";
}

export function getHealthTone(health: string): Tone {
  if (health === "风险") {
    return "risk";
  }

  if (health === "关注") {
    return "warn";
  }

  return "good";
}

export function getRoleLabel(role: ForgeAgent["role"]) {
  const labels: Record<ForgeAgent["role"], string> = {
    pm: "产品负责人",
    architect: "架构负责人",
    design: "设计负责人",
    engineer: "工程执行员",
    qa: "测试负责人",
    release: "放行负责人",
    knowledge: "知识沉淀员"
  };

  return labels[role] ?? role;
}

export function getOwnerModeLabel(ownerMode: ForgeAgent["ownerMode"]) {
  const labels: Record<ForgeAgent["ownerMode"], string> = {
    "human-approved": "人工确认",
    "review-required": "复核后执行",
    "auto-execute": "自动执行"
  };

  return labels[ownerMode] ?? ownerMode;
}

export function getTaskStatusLabel(status: ForgeTask["status"]) {
  const labels: Record<ForgeTask["status"], string> = {
    todo: "待确认",
    "in-progress": "处理中",
    blocked: "已阻塞",
    done: "已完成"
  };

  return labels[status] ?? status;
}

export function getTaskStatusTone(status: ForgeTask["status"]): Tone {
  if (status === "blocked") {
    return "risk";
  }

  if (status === "in-progress") {
    return "info";
  }

  if (status === "done") {
    return "good";
  }

  return "warn";
}

export function getPriorityTone(priority: ForgeTask["priority"]): Tone {
  if (priority === "P0") {
    return "risk";
  }

  if (priority === "P1") {
    return "warn";
  }

  return "info";
}

export function getRunStateLabel(run: ForgeRun) {
  const labels: Record<ForgeRun["state"], string> = {
    running: "执行中",
    done: "已完成",
    blocked: "已阻塞"
  };

  return labels[run.state] ?? run.state;
}

export function getRunStateTone(run: ForgeRun): Tone {
  if (run.state === "blocked") {
    return "risk";
  }

  if (run.state === "running") {
    return "info";
  }

  return "good";
}

export function getCurrentTask(
  snapshot: TaskSnapshot,
  agentId: string,
  projectId: string | null | undefined
) {
  return (
    snapshot.tasks.find(
      (task) =>
        task.ownerAgentId === agentId &&
        task.projectId === projectId &&
        task.status !== "done"
    ) ?? null
  );
}

export function getLatestArtifact(
  snapshot: ArtifactSnapshot,
  agentId: string,
  projectId: string | null | undefined
) {
  return (
    snapshot.artifacts
      .filter((artifact) => artifact.ownerAgentId === agentId && artifact.projectId === projectId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

export function getAgentStatusLabel(
  snapshot: TaskSnapshot,
  agent: ForgeAgent,
  projectId: string | null | undefined
) {
  const currentTask = getCurrentTask(snapshot, agent.id, projectId);

  if (currentTask) {
    return "处理中";
  }

  if (agent.ownerMode === "auto-execute") {
    return "待命";
  }

  return "待确认";
}

export function getAgentStatusTone(statusLabel: string): Tone {
  if (statusLabel === "处理中") {
    return "info";
  }

  if (statusLabel === "待确认") {
    return "warn";
  }

  return "good";
}
