import { getForgeAgentDisplayLabel } from "../../../core/src/agent-display";
import { selectRuntimeAdapter } from "../runtime-adapters";
import type { ForgeCommandHandler } from "./shared";

export const handleExecutionStartCommand: ForgeCommandHandler = (context) => {
  const resolveTaskPackArtifact = context.deps.resolveTaskPackArtifact as (
    snapshot: typeof context.snapshot,
    projectId: string,
    taskPackId?: string
  ) => (typeof context.snapshot.artifacts)[number] | null;
  const getProjectLinkedComponents = context.deps.getProjectLinkedComponents as (
    snapshot: typeof context.snapshot,
    projectId: string
  ) => Array<(typeof context.snapshot.components)[number]>;
  const getComponentAssemblyPlanForAI = context.deps.getComponentAssemblyPlanForAI as (
    input: {
      projectId: string;
      taskPackId?: string;
      maxItems?: number;
    },
    dbPath?: string
  ) => {
    pendingItems: Array<{ title: string }>;
  };
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
      taskPackId?: string | null;
      status: "done" | "blocked" | "running";
      summary: string;
      triggeredBy: string;
      followUpTaskIds?: string[];
      decisions?: Array<{
        id: string;
        hookId: string;
        outcome: "pass" | "warn" | "block";
        summary: string;
      }>;
    },
    dbPath?: string
  ) => { execution: unknown; decisions: unknown };
  const upsertRun = context.deps.upsertRun as (
    input: {
      id: string;
      projectId: string;
      taskPackId?: string | null;
      linkedComponentIds?: string[];
      title: string;
      executor: string;
      cost: string;
      state: "running" | "done" | "blocked";
    },
    dbPath?: string
  ) => { run: unknown };
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
  ) => { id: string };
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
  const updateProjectTasks = context.deps.updateProjectTasks as (
    input: {
      projectId: string;
      taskId?: string;
      titleIncludes?: string;
      status: string;
      summary: string;
    },
    dbPath?: string
  ) => unknown;
  const getProjectAgentIdByRoles = context.deps.getProjectAgentIdByRoles as (
    snapshot: typeof context.snapshot,
    projectId: string,
    roles: string | string[],
    fallbackAgentId?: string | null
  ) => string | null;
  const architectAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "architect", "agent-architect") ??
    "agent-architect";
  const engineerAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "engineer", "agent-frontend") ??
    "agent-frontend";
  const qaAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "qa", "agent-qa-automation") ??
    "agent-qa-automation";
  const qaReviewOwnerLabel = getForgeAgentDisplayLabel({ id: qaAgentId });

  const taskPackArtifact = resolveTaskPackArtifact(
    context.snapshot,
    context.projectId,
    context.input.taskPackId
  );
  const linkedComponents = getProjectLinkedComponents(context.snapshot, context.projectId);
  const componentAssemblyPlan = taskPackArtifact
    ? getComponentAssemblyPlanForAI(
        {
          projectId: context.projectId,
          taskPackId: taskPackArtifact.id,
          maxItems: 3
        },
        context.dbPath
      )
    : null;
  const runner =
    selectRunnerForCommand(context.snapshot, context.command.type) ??
    context.snapshot.runners.find(
      (item: (typeof context.snapshot.runners)[number]) =>
        item.status !== "offline" && item.probeStatus !== "offline"
    ) ??
    null;
  const runtimeAdapter = selectRuntimeAdapter(context.runtimeAdapters, context.command.type);
  const decisions = buildDefaultPolicyDecisions(context.snapshot, {
    id: context.executionId,
    commandId: context.command.id,
    projectId: context.projectId,
    status: "running",
    summary: context.command.summary,
    triggeredBy: context.triggeredBy
  });

  if (!runner) {
    decisions.push({
      id: buildDecisionId(context.executionId, "runner"),
      hookId: "hook-before-run",
      outcome: "block",
      summary: "当前没有可用 Runner，无法启动研发执行。"
    });
  }

  if (!taskPackArtifact || taskPackArtifact.status !== "ready") {
    decisions.push({
      id: buildDecisionId(context.executionId, "task-pack"),
      hookId: "hook-before-run",
      outcome: "block",
      summary: context.input.taskPackId?.trim()
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
      id: buildDecisionId(context.executionId, "component-assembly"),
      hookId: "hook-before-run",
      outcome: "block",
      summary: `当前 TaskPack 仍有待装配组件：${componentAssemblyPlan?.pendingItems
        .map((item) => item.title)
        .join(" / ")}。请先完成组件装配后再启动研发执行。`
    });
  }

  if (decisions.some((decision) => decision.outcome === "block")) {
    const assemblyBlockingDecision = decisions.find(
      (decision) => decision.id === buildDecisionId(context.executionId, "component-assembly")
    );

    if (assemblyBlockingDecision) {
      upsertProjectTask(
        {
          id: `task-${context.projectId}-component-assembly`,
          projectId: context.projectId,
          stage: "开发执行",
          title: "补齐 TaskPack 组件装配",
          ownerAgentId: architectAgentId,
          status: "todo",
          priority: "P0",
          category: "execution",
          summary: assemblyBlockingDecision.summary
        },
        context.dbPath
      );
      updateProjectWorkflowState(
        {
          projectId: context.projectId,
          currentStage: "开发执行",
          state: "blocked",
          blockers: [assemblyBlockingDecision.summary],
          updatedBy: "architect"
        },
        context.dbPath
      );
    }

    const recorded = recordCommandExecutionForAI(
      {
        id: context.executionId,
        commandId: context.command.id,
        projectId: context.projectId,
        taskPackId: taskPackArtifact?.id ?? context.input.taskPackId?.trim() ?? null,
        status: "blocked",
        summary: assemblyBlockingDecision?.summary ?? "研发执行前置条件未满足。",
        triggeredBy: context.triggeredBy,
        followUpTaskIds: assemblyBlockingDecision
          ? [`task-${context.projectId}-component-assembly`]
          : [],
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

  const runtimeResult =
    runner && runtimeAdapter
      ? runtimeAdapter.run({
          command: context.command,
          project: context.project,
          taskPackArtifact,
          linkedComponents,
          runner,
          extraNotes: context.input.extraNotes?.trim()
        })
      : null;
  const linkedComponentSummary =
    linkedComponents.length > 0
      ? ` · 装配组件：${linkedComponents.map((component) => component.title).join(" / ")}`
      : "";
  const runId = `run-${context.projectId}-execution-${Date.now().toString(36)}`;
  const runResult = upsertRun(
    {
      id: runId,
      projectId: context.projectId,
      taskPackId: taskPackArtifact?.id ?? null,
      linkedComponentIds: linkedComponents.map((component) => component.id),
      title: `${context.project.name} 研发执行${linkedComponentSummary}`,
      executor: runner?.name ?? "本地 Runner",
      cost: "$0.00",
      state: "running"
    },
    context.dbPath
  );

  if (runner) {
    updateRunnerHeartbeat(
      {
        runnerId: runner.id,
        status: "busy",
        currentRunId: runId,
        lastHeartbeat: "刚刚"
      },
      context.dbPath
    );
  }

  upsertProjectArtifact(
    {
      projectId: context.projectId,
      type: "patch",
      title:
        runtimeResult?.artifacts.find((item) => item.type === "patch")?.title ??
        `${context.project.name} 首轮 Patch`,
      ownerAgentId: engineerAgentId,
      status:
        runtimeResult?.artifacts.find((item) => item.type === "patch")?.status ?? "in-review"
    },
    context.dbPath
  );
  const demoArtifact = upsertProjectArtifact(
    {
      projectId: context.projectId,
      type: "demo-build",
      title:
        runtimeResult?.artifacts.find((item) => item.type === "demo-build")?.title ??
        `${context.project.name} Demo 构建`,
      ownerAgentId: engineerAgentId,
      status:
        runtimeResult?.artifacts.find((item) => item.type === "demo-build")?.status ??
        "in-review"
    },
    context.dbPath
  );

  upsertArtifactReview(
      {
        artifactId: demoArtifact.id,
        reviewerAgentId: qaAgentId,
        decision: "pending",
        summary: `Demo 构建已生成，等待 ${qaReviewOwnerLabel} 执行主流程与异常路径复核。`,
        conditions: ["主流程可运行", "异常路径已覆盖", "人工复核说明已补齐"]
      },
    context.dbPath
  );

  updateProjectTasks(
    {
      projectId: context.projectId,
      taskId: `task-${context.projectId}-runner-gates`,
      status: "done",
      summary: "本地 Runner 与默认门禁已接通，研发执行正在进行。"
    },
    context.dbPath
  );
  updateProjectWorkflowState(
    {
      projectId: context.projectId,
      currentStage: "开发执行",
      state: "current",
      blockers: [],
      updatedBy: "engineer"
    },
    context.dbPath
  );

  const recorded = recordCommandExecutionForAI(
    {
      id: context.executionId,
      commandId: context.command.id,
      projectId: context.projectId,
      taskPackId: taskPackArtifact?.id ?? null,
      status: "done",
      summary:
        runtimeResult?.summary ??
        `已把 ${taskPackArtifact?.title ?? "TaskPack"} 分配给 ${runner?.name ?? "本地 Runner"}，研发执行开始${linkedComponentSummary}。`,
      triggeredBy: context.triggeredBy,
      decisions: [
        {
          id: buildDecisionId(context.executionId, "before-run"),
          hookId: "hook-before-run",
          outcome: "pass",
          summary: `${taskPackArtifact?.title ?? "TaskPack"} 已就绪，Runner 可用，允许启动研发执行。`
        }
      ]
    },
    context.dbPath
  );

  return {
    command: context.command,
    project: context.project,
    run: runResult.run,
    taskPackArtifact,
    artifact: demoArtifact,
    execution: recorded.execution,
    decisions: recorded.decisions
  };
};
