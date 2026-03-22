import type { ForgeCommandHandler } from "./shared";

export const handleReleasePrepareCommand: ForgeCommandHandler = (context) => {
  const getProjectRuntimeSignal = context.deps.getProjectRuntimeSignal as (
    snapshot: typeof context.snapshot,
    projectId: string
  ) => string;
  const selectRunnerForCommand = context.deps.selectRunnerForCommand as (
    snapshot: typeof context.snapshot,
    commandType: typeof context.command.type
  ) => typeof context.snapshot.runners[number] | null;
  const buildDefaultPolicyDecisions = context.deps.buildDefaultPolicyDecisions as (
    snapshot: typeof context.snapshot,
    input: {
      id: string;
      commandId: string;
      projectId: string;
      status: "running" | "done" | "blocked";
      summary: string;
      triggeredBy: string;
    }
  ) => Array<{
    id: string;
    hookId: string;
    outcome: "pass" | "warn" | "block";
    summary: string;
  }>;
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
  const updateProjectTasks = context.deps.updateProjectTasks as (
    input: {
      projectId: string;
      taskId?: string;
      status: string;
      summary: string;
    },
    dbPath?: string
  ) => unknown;
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
  const upsertProjectTask = context.deps.upsertProjectTask as (
    input: {
      id: string;
      projectId: string;
      stage: string;
      title: string;
      ownerAgentId: string;
      status: string;
      priority: string;
      category: string;
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
  const getProjectAgentIdByRoles = context.deps.getProjectAgentIdByRoles as (
    snapshot: typeof context.snapshot,
    projectId: string,
    roles: string | string[],
    fallbackAgentId?: string | null
  ) => string | null;
  const releaseAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "release", "agent-release") ??
    "agent-release";
  const pmAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "pm", "agent-service-strategy") ??
    "agent-service-strategy";

  const runtimeSignal = getProjectRuntimeSignal(context.snapshot, context.projectId);
  const runner = selectRunnerForCommand(context.snapshot, context.command.type);
  const decisions = buildDefaultPolicyDecisions(context.snapshot, {
    id: context.executionId,
    commandId: context.command.id,
    projectId: context.projectId,
    status: "running",
    summary: context.command.summary,
    triggeredBy: context.triggeredBy
  });

  if (decisions.some((decision) => decision.outcome === "block")) {
    const recorded = recordCommandExecutionForAI(
      {
        id: context.executionId,
        commandId: context.command.id,
        projectId: context.projectId,
        status: "blocked",
        summary: "交付说明前置条件未满足。",
        triggeredBy: context.triggeredBy,
        decisions
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

  const runId = `run-${context.projectId}-release-${Date.now().toString(36)}`;
  upsertRun(
    {
      id: runId,
      projectId: context.projectId,
      title: `${context.project.name} 交付说明整理`,
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
      type: "release-brief",
      title: `${context.project.name} 交付说明`,
      ownerAgentId: releaseAgentId,
      status: "in-review"
    },
    context.dbPath
  );

  upsertProjectArtifact(
    {
      projectId: context.projectId,
      type: "review-decision",
      title: `${context.project.name} 放行评审结论`,
      ownerAgentId: pmAgentId,
      status: "in-review"
    },
    context.dbPath
  );

  updateProjectTasks(
    {
      projectId: context.projectId,
      taskId: `task-${context.projectId}-release-brief`,
      status: "done",
      summary: "交付说明、验收口径和发布备注已经整理完成。"
    },
    context.dbPath
  );

  upsertArtifactReview(
    {
      artifactId: artifact.id,
      reviewerAgentId: pmAgentId,
      decision: "pending",
      summary: appendExtraNotes(
        "交付说明已整理，等待负责人确认验收口径与放行条件。",
        runtimeSignal
      ),
      conditions: ["交付范围无遗漏", "验收口径已确认", "预览与说明保持一致"]
    },
    context.dbPath
  );

  upsertProjectTask(
    {
      id: `task-${context.projectId}-release-approval`,
      projectId: context.projectId,
      stage: "交付发布",
      title: "确认交付说明与放行口径",
      ownerAgentId: pmAgentId,
      status: "todo",
      priority: "P0",
      category: "review",
      summary: "负责人需要确认交付说明、验收范围和发布口径。"
    },
    context.dbPath
  );

  updateProjectWorkflowState(
    {
      projectId: context.projectId,
      currentStage: "交付发布",
      state: "blocked",
      blockers: ["等待人工确认交付说明"],
      updatedBy: "release"
    },
    context.dbPath
  );

  const recorded = recordCommandExecutionForAI(
    {
      id: context.executionId,
      commandId: context.command.id,
      projectId: context.projectId,
      status: "done",
      summary: `已整理《${artifact.title}》，等待负责人确认后放行。`,
      triggeredBy: context.triggeredBy,
      decisions: [
        {
          id: buildDecisionId(context.executionId, "before-release"),
          hookId: "hook-before-release",
          outcome: "pass",
          summary: "测试报告与 Demo 已齐备，允许整理交付说明。"
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
