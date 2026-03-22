import { selectRuntimeAdapter } from "../runtime-adapters";
import type { ForgeCommandHandler } from "./shared";

export const handleReviewRunCommand: ForgeCommandHandler = (context) => {
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
  ) => { id?: string; type?: string };
  const moveReviewExecutionToQaHandoff = context.deps.moveReviewExecutionToQaHandoff as (
    snapshot: typeof context.snapshot,
    projectId: string,
    dbPath?: string
  ) => void;
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
  const architectAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "architect", "agent-architect") ??
    "agent-architect";

  const runner = selectRunnerForCommand(context.snapshot, context.command.type);
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
      id: buildDecisionId(context.executionId, "reviewer-runner"),
      hookId: "hook-before-run",
      outcome: "block",
      summary: "当前没有可用 Reviewer Runner，无法执行规则审查。"
    });
  }

  if (decisions.some((decision) => decision.outcome === "block")) {
    const recorded = recordCommandExecutionForAI(
      {
        id: context.executionId,
        commandId: context.command.id,
        projectId: context.projectId,
        status: "blocked",
        summary: "规则审查前置条件未满足。",
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

  const runId = `run-${context.projectId}-review-${Date.now().toString(36)}`;
  const runtimeResult =
    runner && runtimeAdapter
      ? runtimeAdapter.run({
          command: context.command,
          project: context.project,
          runner,
          extraNotes: context.input.extraNotes?.trim()
        })
      : null;

  upsertRun(
    {
      id: runId,
      projectId: context.projectId,
      title: `${context.project.name} 规则审查`,
      executor: runner?.name ?? "代码评审执行器",
      cost: "$0.00",
      state: runtimeResult?.status ?? "done"
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
      type: "review-report",
      title:
        runtimeResult?.artifacts.find(
          (item: NonNullable<typeof runtimeResult>["artifacts"][number]) =>
            item.type === "review-report"
        )?.title ??
        `${context.project.name} 规则审查记录`,
      ownerAgentId: architectAgentId,
      status:
        runtimeResult?.artifacts.find(
          (item: NonNullable<typeof runtimeResult>["artifacts"][number]) =>
            item.type === "review-report"
        )?.status ?? "ready"
    },
    context.dbPath
  );

  moveReviewExecutionToQaHandoff(context.snapshot, context.projectId, context.dbPath);

  const recorded = recordCommandExecutionForAI(
    {
      id: context.executionId,
      commandId: context.command.id,
      projectId: context.projectId,
      status: "done",
      summary:
        runtimeResult?.summary ??
        `已由 ${runner?.name ?? "代码评审执行器"} 完成规则审查，项目移交 QA。`,
      triggeredBy: context.triggeredBy,
      decisions: [
        {
          id: buildDecisionId(context.executionId, "before-run"),
          hookId: "hook-before-run",
          outcome: "pass",
          summary: "Patch 与 Demo 已齐备，允许执行规则审查。"
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
