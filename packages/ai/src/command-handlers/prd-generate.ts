import type { ForgeCommandHandler } from "./shared";

export const handlePrdGenerateCommand: ForgeCommandHandler = (context) => {
  const profile =
    context.snapshot.projectProfiles.find(
      (item: (typeof context.snapshot.projectProfiles)[number]) => item.projectId === context.projectId
    ) ?? null;
  const templateId = profile?.defaultPromptIds[0] ?? context.snapshot.promptTemplates[0]?.id ?? "";

  if (!templateId) {
    throw new Error("缺少可用 Prompt 模板");
  }

  const generatePrdDraftForAI = context.deps.generatePrdDraftForAI as (
    input: { projectId: string; templateId: string; extraNotes?: string },
    dbPath?: string
  ) => { document: { title: string }; template: unknown };
  const upsertProjectArtifact = context.deps.upsertProjectArtifact as (
    input: {
      projectId: string;
      type: string;
      title: string;
      ownerAgentId: string;
      status: string;
    },
    dbPath?: string
  ) => unknown;
  const updateProjectTasks = context.deps.updateProjectTasks as (
    input: {
      projectId: string;
      taskId?: string;
      titleIncludes?: string;
      stage?: string;
      status: string;
      summary: string;
    },
    dbPath?: string
  ) => unknown;
  const loadDashboardSnapshot = context.deps.loadDashboardSnapshot as (dbPath?: string) => typeof context.snapshot;
  const buildMissingArtifactBlockers = context.deps.buildMissingArtifactBlockers as (
    snapshot: typeof context.snapshot,
    projectId: string,
    artifactTypes: string[]
  ) => string[];
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
  const buildDecisionId = context.deps.buildDecisionId as (executionId: string, suffix: string) => string;
  const getProjectAgentIdByRoles = context.deps.getProjectAgentIdByRoles as (
    snapshot: typeof context.snapshot,
    projectId: string,
    roles: string | string[],
    fallbackAgentId?: string | null
  ) => string | null;
  const pmAgentId =
    getProjectAgentIdByRoles(context.snapshot, context.projectId, "pm", "agent-service-strategy") ??
    "agent-service-strategy";

  const generated = generatePrdDraftForAI(
    {
      projectId: context.projectId,
      templateId,
      extraNotes: context.input.extraNotes?.trim() ?? ""
    },
    context.dbPath
  );

  upsertProjectArtifact(
    {
      projectId: context.projectId,
      type: "prd",
      title: generated.document.title,
      ownerAgentId: pmAgentId,
      status: "ready"
    },
    context.dbPath
  );
  updateProjectTasks(
    {
      projectId: context.projectId,
      stage: "项目接入",
      status: "done",
      summary: "需求摘要与成功标准已锁定，已进入方案与任务包阶段。"
    },
    context.dbPath
  );
  updateProjectTasks(
    {
      projectId: context.projectId,
      titleIncludes: "PRD",
      status: "done",
      summary: `已通过标准命令生成《${generated.document.title}》。`
    },
    context.dbPath
  );
  updateProjectTasks(
    {
      projectId: context.projectId,
      taskId: `task-${context.projectId}-design-arch`,
      status: "in-progress",
      summary: "PRD 已就绪，等待补齐原型、架构说明和首轮 TaskPack。"
    },
    context.dbPath
  );

  const refreshedSnapshot = loadDashboardSnapshot(context.dbPath);
  updateProjectWorkflowState(
    {
      projectId: context.projectId,
      currentStage: "方案与任务包",
      state: "blocked",
      blockers: buildMissingArtifactBlockers(refreshedSnapshot, context.projectId, [
        "architecture-note",
        "ui-spec",
        "task-pack"
      ]),
      updatedBy: "pm"
    },
    context.dbPath
  );

  const recorded = recordCommandExecutionForAI(
    {
      id: context.executionId,
      commandId: context.command.id,
      projectId: context.projectId,
      status: "done",
      summary: `已生成《${generated.document.title}》。`,
      triggeredBy: context.triggeredBy,
      decisions: [
        {
          id: buildDecisionId(context.executionId, "before-run"),
          hookId: "hook-before-run",
          outcome: "pass",
          summary: "项目 DNA 与默认 Prompt 已齐备，允许生成 PRD。"
        }
      ]
    },
    context.dbPath
  );

  return {
    command: context.command,
    project: context.project,
    document: generated.document,
    template: generated.template,
    execution: recorded.execution,
    decisions: recorded.decisions
  };
};
