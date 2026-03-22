import { selectRuntimeAdapter } from "../runtime-adapters";
import type { ForgeCommandHandler } from "./shared";

export const handleGateRunCommand: ForgeCommandHandler = (context) => {
  const selectRunnerForCommand = context.deps.selectRunnerForCommand as (
    snapshot: typeof context.snapshot,
    commandType: typeof context.command.type
  ) => typeof context.snapshot.runners[number] | null;
  const buildDecisionId = context.deps.buildDecisionId as (executionId: string, suffix: string) => string;
  const appendExtraNotes = context.deps.appendExtraNotes as (summary: string, extraNotes?: string) => string;
  const artifactLabels = context.deps.artifactLabels as Record<string, string>;
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
  const getProjectAgentIdByRoles = context.deps.getProjectAgentIdByRoles as (
    snapshot: typeof context.snapshot,
    projectId: string,
    roles: string | string[],
    fallbackAgentId?: string | null
  ) => string | null;
  const qaAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "qa", "agent-qa-automation") ??
    "agent-qa-automation";
  const pmAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "pm", "agent-service-strategy") ??
    "agent-service-strategy";
  const engineerAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "engineer", "agent-frontend") ??
    "agent-frontend";
  const releaseAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "release", "agent-release") ??
    "agent-release";

  const runner = selectRunnerForCommand(context.snapshot, context.command.type);
  const runtimeAdapter = selectRuntimeAdapter(context.runtimeAdapters, context.command.type);
  const missingArtifacts = context.command.requiresArtifacts.filter(
    (type: (typeof context.command.requiresArtifacts)[number]) =>
      !context.snapshot.artifacts.some((artifact: (typeof context.snapshot.artifacts)[number]) => {
        if (artifact.projectId !== context.projectId || artifact.type !== type) {
          return false;
        }

        if (type === "demo-build") {
          return artifact.status !== "draft";
        }

        return artifact.status === "ready";
      })
  );
  const failedGates = context.snapshot.deliveryGate.filter(
    (gate: (typeof context.snapshot.deliveryGate)[number]) => gate.status === "fail"
  );
  const pendingGates = context.snapshot.deliveryGate.filter(
    (gate: (typeof context.snapshot.deliveryGate)[number]) => gate.status === "pending"
  );
  const decisions: Array<{
    id: string;
    hookId: string;
    outcome: "pass" | "warn" | "block";
    summary: string;
  }> = [];

  if (missingArtifacts.length > 0) {
    decisions.push({
      id: buildDecisionId(context.executionId, "before-run"),
      hookId: "hook-before-run",
      outcome: "block",
      summary: `门禁所需工件未齐备：${missingArtifacts.join(" / ")}。`
    });
  }

  if (failedGates.length > 0 || pendingGates.length > 0) {
    decisions.push({
      id: buildDecisionId(context.executionId, "before-release"),
      hookId: "hook-before-release",
      outcome: failedGates.length > 0 ? "block" : "warn",
      summary:
        failedGates.length > 0
          ? `当前门禁未通过：${failedGates
              .map((gate: (typeof failedGates)[number]) => gate.name)
              .join(" / ")}。`
          : `当前门禁仍待确认：${pendingGates
              .map((gate: (typeof pendingGates)[number]) => gate.name)
              .join(" / ")}。`
    });
  }

  const status = decisions.some((decision) => decision.outcome === "block") ? "blocked" : "done";
  const runtimeResult =
    runner && runtimeAdapter && status !== "blocked"
      ? runtimeAdapter.run({
          command: context.command,
          project: context.project,
          runner,
          extraNotes: context.input.extraNotes?.trim()
        })
      : null;
  const runId = `run-${context.projectId}-gate-${Date.now().toString(36)}`;

  upsertRun(
    {
      id: runId,
      projectId: context.projectId,
      title: `${context.project.name} 测试门禁`,
      executor: runner?.name ?? "浏览器验证执行器",
      cost: "$0.00",
      state: status === "blocked" ? "blocked" : runtimeResult?.status ?? "done"
    },
    context.dbPath
  );

  if (runner) {
    updateRunnerHeartbeat(
      {
        runnerId: runner.id,
        status: status === "blocked" ? "blocked" : "idle",
        currentRunId: status === "blocked" ? runId : null,
        lastHeartbeat: "刚刚"
      },
      context.dbPath
    );
  }

  const testReportArtifact = upsertProjectArtifact(
    {
      projectId: context.projectId,
      type: "test-report",
      title:
        status === "blocked"
          ? `${context.project.name} 测试阻塞报告`
          : runtimeResult?.artifacts.find(
              (item: NonNullable<typeof runtimeResult>["artifacts"][number]) =>
                item.type === "test-report"
            )?.title ??
            `${context.project.name} 测试报告`,
      ownerAgentId: qaAgentId,
      status:
        status === "blocked"
          ? "in-review"
          : runtimeResult?.artifacts.find(
              (item: NonNullable<typeof runtimeResult>["artifacts"][number]) =>
                item.type === "test-report"
            )?.status ?? "ready"
    },
    context.dbPath
  );

  upsertProjectArtifact(
    {
      projectId: context.projectId,
      type: "playwright-run",
      title:
        status === "blocked"
          ? `${context.project.name} Playwright 阻塞回归记录`
          : runtimeResult?.artifacts.find(
              (item: NonNullable<typeof runtimeResult>["artifacts"][number]) =>
                item.type === "playwright-run"
            )?.title ??
            `${context.project.name} Playwright 回归记录`,
      ownerAgentId: qaAgentId,
      status:
        status === "blocked"
          ? "in-review"
          : runtimeResult?.artifacts.find(
              (item: NonNullable<typeof runtimeResult>["artifacts"][number]) =>
                item.type === "playwright-run"
            )?.status ?? "ready"
    },
    context.dbPath
  );

  const demoBuildArtifact = context.snapshot.artifacts.find(
    (artifact: (typeof context.snapshot.artifacts)[number]) =>
      artifact.projectId === context.projectId && artifact.type === "demo-build"
  );
  const reviewTarget = demoBuildArtifact ?? testReportArtifact;

  if (status === "blocked") {
      upsertArtifactReview(
        {
          artifactId: reviewTarget.id,
          reviewerAgentId: qaAgentId,
          decision: "changes-requested",
        summary:
          failedGates.length > 0
            ? `门禁未通过：${failedGates
                .map((gate: (typeof failedGates)[number]) => gate.name)
                .join(" / ")}。`
            : "门禁待确认，仍需补充验证。",
        conditions: [
          ...missingArtifacts.map(
            (type: (typeof missingArtifacts)[number]) => `${artifactLabels[type] ?? type} 需要补齐`
          ),
          ...failedGates.map((gate: (typeof failedGates)[number]) => `${gate.name} 需要重新通过`),
          ...pendingGates.map((gate: (typeof pendingGates)[number]) => `${gate.name} 仍待确认`)
        ]
      },
      context.dbPath
    );
      upsertProjectTask(
        {
          id: `task-${context.projectId}-gate-escalation`,
          projectId: context.projectId,
          stage: "测试验证",
          title: "处理测试门禁阻塞",
          ownerAgentId: pmAgentId,
        status: "todo",
        priority: "P0",
        category: "handoff",
        summary:
          failedGates.length > 0
            ? `门禁阻塞待处理：${failedGates
                .map((gate: (typeof failedGates)[number]) => gate.name)
                .join(" / ")}。`
            : "门禁待确认，需由负责人决定是否继续推进。"
      },
      context.dbPath
    );
      upsertProjectTask(
        {
          id: `task-${context.projectId}-gate-remediation`,
          projectId: context.projectId,
          stage: "开发执行",
          title: "修复门禁阻塞并回流研发执行",
          ownerAgentId: engineerAgentId,
        status: "todo",
        priority: "P0",
        category: "execution",
        summary:
          failedGates.length > 0
            ? `根据门禁失败项修复问题并重新提交验证：${failedGates
                .map((gate: (typeof failedGates)[number]) => gate.name)
                .join(" / ")}。`
            : "根据待确认门禁补齐缺失实现与验证材料，回流研发执行。"
      },
      context.dbPath
    );
  } else {
    if (demoBuildArtifact) {
      upsertProjectArtifact(
        {
          projectId: context.projectId,
          type: "demo-build",
          title: demoBuildArtifact.title,
          ownerAgentId: demoBuildArtifact.ownerAgentId,
          status: "ready"
        },
        context.dbPath
      );
      upsertArtifactReview(
        {
          artifactId: demoBuildArtifact.id,
          reviewerAgentId: qaAgentId,
          decision: "pass",
          summary: "门禁已通过，Demo 可进入交付说明整理。",
          conditions: ["构建通过", "自动化回归通过", "人工复核已完成"]
        },
        context.dbPath
      );
    }
    updateProjectTasks(
      {
        projectId: context.projectId,
        taskId: `task-${context.projectId}-gate-escalation`,
        status: "done",
        summary: "测试门禁已通过，升级任务已关闭。"
      },
      context.dbPath
    );
    upsertProjectArtifact(
      {
        projectId: context.projectId,
        type: "release-brief",
        title: `${context.project.name} 交付说明`,
        ownerAgentId: releaseAgentId,
        status: "draft"
      },
      context.dbPath
    );
    upsertProjectTask(
      {
        id: `task-${context.projectId}-release-brief`,
        projectId: context.projectId,
        stage: "交付发布",
        title: "整理交付说明与验收口径",
        ownerAgentId: releaseAgentId,
        status: "todo",
        priority: "P1",
        category: "release",
        summary: "测试门禁已通过，开始整理交付摘要、验收说明和发布备注。"
      },
      context.dbPath
    );
  }

  updateProjectTasks(
    {
      projectId: context.projectId,
      titleIncludes: "Playwright",
      status: status === "blocked" ? "blocked" : "done",
      summary:
        status === "blocked"
          ? "测试门禁存在阻塞，需先修复回归链路再继续交付。"
          : "测试门禁已通过，可以继续准备交付。"
    },
    context.dbPath
  );
  updateProjectWorkflowState(
    {
      projectId: context.projectId,
      currentStage: status === "blocked" ? "测试验证" : "交付发布",
      state: status === "blocked" ? "blocked" : "current",
      blockers: status === "blocked" ? decisions.map((decision) => decision.summary) : [],
      updatedBy: "qa"
    },
    context.dbPath
  );

  const summary =
    status === "blocked"
      ? appendExtraNotes("门禁未通过，需先处理失败项后再继续。", context.input.extraNotes)
      : runtimeResult?.summary ?? "门禁已执行，当前没有失败项。";
  const recorded = recordCommandExecutionForAI(
    {
      id: context.executionId,
      commandId: context.command.id,
      projectId: context.projectId,
      status,
      summary,
      triggeredBy: context.triggeredBy,
      followUpTaskIds:
        status === "blocked"
          ? [`task-${context.projectId}-gate-escalation`, `task-${context.projectId}-gate-remediation`]
          : [],
      decisions
    },
    context.dbPath
  );

  return {
    command: context.command,
    project: context.project,
    execution: recorded.execution,
    decisions: recorded.decisions,
    gates: context.snapshot.deliveryGate
  };
};
