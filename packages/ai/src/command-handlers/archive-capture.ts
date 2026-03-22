import type { ForgeCommandHandler } from "./shared";

export const handleArchiveCaptureCommand: ForgeCommandHandler = (context) => {
  const getProjectRuntimeSignal = context.deps.getProjectRuntimeSignal as (
    snapshot: typeof context.snapshot,
    projectId: string
  ) => string;
  const selectRunnerForCommand = context.deps.selectRunnerForCommand as (
    snapshot: typeof context.snapshot,
    commandType: typeof context.command.type
  ) => typeof context.snapshot.runners[number] | null;
  const recordCommandExecutionForAI = context.deps.recordCommandExecutionForAI as (
    input: {
      id: string;
      commandId: string;
      projectId: string;
      status: "done" | "blocked" | "running";
      summary: string;
      triggeredBy: string;
      decisions?: Array<{
        id: string;
        hookId: string;
        outcome: "pass" | "warn" | "block";
        summary: string;
      }>;
    },
    dbPath?: string
  ) => { execution: unknown; decisions: unknown };
  const buildDecisionId = context.deps.buildDecisionId as (executionId: string, suffix: string) => string;
  const upsertRun = context.deps.upsertRun as (
    input: {
      id: string;
      projectId: string;
      title: string;
      executor: string;
      cost: string;
      state: "running" | "done" | "blocked";
    },
    dbPath?: string
  ) => unknown;
  const updateRunnerHeartbeat = context.deps.updateRunnerHeartbeat as (
    input: { runnerId: string; status: string; currentRunId: string | null; lastHeartbeat: string },
    dbPath?: string
  ) => unknown;
  const upsertProjectArtifact = context.deps.upsertProjectArtifact as (
    input: {
      projectId: string;
      type: string;
      title: string;
      ownerAgentId: string;
      status: string;
    },
    dbPath?: string
  ) => { id: string; title: string };
  const upsertArtifactReview = context.deps.upsertArtifactReview as (
    input: {
      artifactId: string;
      reviewerAgentId: string;
      decision: "pass" | "pending" | "changes-requested";
      summary: string;
      conditions: string[];
    },
    dbPath?: string
  ) => unknown;
  const appendExtraNotes = context.deps.appendExtraNotes as (
    summary: string,
    extraNotes?: string
  ) => string;
  const updateProjectTasks = context.deps.updateProjectTasks as (
    input: {
      projectId: string;
      taskId?: string;
      status: string;
      summary: string;
    },
    dbPath?: string
  ) => unknown;
  const updateProjectWorkflowState = context.deps.updateProjectWorkflowState as (
    input: {
      projectId: string;
      currentStage: string;
      state: string;
      blockers: string[];
      updatedBy: string;
    },
    dbPath?: string
  ) => unknown;
  const getProjectAgentIdByRoles = context.deps.getProjectAgentIdByRoles as (
    snapshot: typeof context.snapshot,
    projectId: string,
    roles: string | string[],
    fallbackAgentId?: string | null
  ) => string | null;
  const knowledgeAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "knowledge", "agent-knowledge-ops") ??
    "agent-knowledge-ops";
  const releaseAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "release", "agent-release") ??
    "agent-release";
  const pmAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "pm", "agent-service-strategy") ??
    "agent-service-strategy";

  const runtimeSignal = getProjectRuntimeSignal(context.snapshot, context.projectId);
  const runner = selectRunnerForCommand(context.snapshot, context.command.type);
  const hasReleaseBrief = context.snapshot.artifacts.some(
    (artifact: (typeof context.snapshot.artifacts)[number]) =>
      artifact.projectId === context.projectId &&
      artifact.type === "release-brief" &&
      artifact.status === "ready"
  );

  if (!hasReleaseBrief) {
    const recorded = recordCommandExecutionForAI(
      {
        id: context.executionId,
        commandId: context.command.id,
        projectId: context.projectId,
        status: "blocked",
        summary: "缺少交付说明，暂时无法归档沉淀。",
        triggeredBy: context.triggeredBy,
        decisions: [
          {
            id: buildDecisionId(context.executionId, "before-release"),
            hookId: "hook-before-release",
            outcome: "block",
            summary: "缺少交付说明，无法生成知识卡和沉淀结果。"
          }
        ]
      },
      context.dbPath
    );

    return {
      command: context.command,
      project: context.project,
      execution: recorded.execution,
      decisions: recorded.decisions
    };
  }

  const runId = `run-${context.projectId}-archive-${Date.now().toString(36)}`;
  upsertRun(
    {
      id: runId,
      projectId: context.projectId,
      title: `${context.project.name} 归档沉淀`,
      executor: runner?.name ?? "交付编排执行器",
      cost: "$0.00",
      state: "done"
    },
    context.dbPath
  );

  if (runner) {
    updateRunnerHeartbeat(
      {
        runnerId: runner.id,
        status: "idle",
        currentRunId: null,
        lastHeartbeat: "刚刚"
      },
      context.dbPath
    );
  }

  const artifact = upsertProjectArtifact(
    {
      projectId: context.projectId,
      type: "knowledge-card",
      title: `${context.project.name} 交付知识卡`,
      ownerAgentId: knowledgeAgentId,
      status: "ready"
    },
    context.dbPath
  );
  const releaseAuditArtifact = upsertProjectArtifact(
    {
      projectId: context.projectId,
      type: "release-audit",
      title: `${context.project.name} 归档审计记录`,
      ownerAgentId: releaseAgentId,
      status: "ready"
    },
    context.dbPath
  );

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
    context.dbPath
  );

  updateProjectTasks(
    {
      projectId: context.projectId,
      taskId: `task-${context.projectId}-knowledge-card`,
      status: "done",
      summary: "交付知识卡、归档审计和复用建议已沉淀完成。"
    },
    context.dbPath
  );

  updateProjectWorkflowState(
    {
      projectId: context.projectId,
      currentStage: "归档复用",
      state: "current",
      blockers: [],
      updatedBy: "knowledge"
    },
    context.dbPath
  );

  const recorded = recordCommandExecutionForAI(
    {
      id: context.executionId,
      commandId: context.command.id,
      projectId: context.projectId,
      status: "done",
      summary: `已沉淀《${artifact.title}》，项目进入归档复用。`,
      triggeredBy: context.triggeredBy,
      decisions: [
        {
          id: buildDecisionId(context.executionId, "after-run"),
          hookId: "hook-after-run",
          outcome: "pass",
          summary: "交付说明已齐备，允许沉淀知识卡和复用建议。"
        }
      ]
    },
    context.dbPath
  );

  return {
    command: context.command,
    project: context.project,
    artifact,
    execution: recorded.execution,
    decisions: recorded.decisions
  };
};
